import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let database;

export function closeManagedBookingStorage() {
  database?.close();
  database = undefined;
}

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function configured() {
  const testMode = process.env.SAHAAN_PAYMENT_TEST_MODE === '1' && (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_');
  const liveMode = process.env.SAHAAN_PAYMENT_TEST_MODE !== '1'
    && (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_live_')
    && Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID)
    && /^v[0-9]+\.[0-9]+$/.test(process.env.META_GRAPH_VERSION || '')
    && Boolean(process.env.META_TEMPLATE_PAYMENT && process.env.META_TEMPLATE_CUSTOMER_ASSIGNED && process.env.META_TEMPLATE_ARTIST_ASSIGNED);
  return process.env.SAHAAN_PAYMENTS_ENABLED === '1'
    && process.env.SAHAAN_POLICY_APPROVED === '1'
    && Boolean(process.env.SAHAAN_DATA_FILE && isAbsolute(process.env.SAHAAN_DATA_FILE))
    && Boolean(process.env.SAHAAN_ADMIN_TOKEN && process.env.SAHAAN_ADMIN_TOKEN.length >= 32)
    && Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET)
    && (testMode || liveMode);
}

function testMode() {
  return process.env.SAHAAN_PAYMENT_TEST_MODE === '1' && (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_');
}

function db() {
  if (!configured()) throw new Error('Managed bookings are not configured');
  if (!database) {
    database = new DatabaseSync(process.env.SAHAAN_DATA_FILE);
    database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL, service TEXT NOT NULL, scope TEXT NOT NULL,
        service_address TEXT NOT NULL, appointment_window TEXT NOT NULL,
        service_paise INTEGER NOT NULL, travel_paise INTEGER NOT NULL,
        extras_paise INTEGER NOT NULL, tax_paise INTEGER NOT NULL, total_paise INTEGER NOT NULL,
        status TEXT NOT NULL, razorpay_order_id TEXT UNIQUE, razorpay_payment_id TEXT UNIQUE,
        artist_name TEXT, artist_phone TEXT, artist_consent_at TEXT, created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL, coverage_confirmed_at TEXT, customer_consent_at TEXT,
        paid_at TEXT, assigned_at TEXT, refunded_at TEXT
      );
      CREATE TABLE IF NOT EXISTS notification_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL, kind TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(quote_id, kind)
      );`);
    database.exec("UPDATE notification_outbox SET state='pending' WHERE state='sending'");
  }
  return database;
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function adminAllowed(request) {
  return configured() && safeEqual(request.headers.get('authorization'), `Bearer ${process.env.SAHAAN_ADMIN_TOKEN}`);
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function body(request) {
  const raw = await request.text();
  if (raw.length > 16_384) throw new Error('Request too large');
  return JSON.parse(raw);
}

function amount(value) {
  if (!Number.isInteger(value) || value < 0 || value > 2_000_000) throw new Error('Invalid amount in paise');
  return value;
}

function clean(value, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Missing or invalid field');
  return value.trim();
}

function publicQuote(row) {
  return {
    reference: row.id, customerName: row.customer_name, service: row.service,
    scope: row.scope, serviceAddress: row.service_address,
    appointmentWindow: row.appointment_window,
    servicePaise: row.service_paise, travelPaise: row.travel_paise,
    extrasPaise: row.extras_paise, taxPaise: row.tax_paise, totalPaise: row.total_paise,
    status: row.status, expiresAt: row.expires_at,
    artistName: row.status === 'assigned' ? row.artist_name : null,
    testMode: testMode(),
  };
}

async function razorpay(path, options = {}) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    ...options,
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Razorpay API returned ${response.status}`);
  return result;
}

function markPaid(row, paymentId) {
  const store = db();
  store.prepare(`UPDATE quotes SET status='paid_unassigned', razorpay_payment_id=?, paid_at=?
    WHERE id=? AND status IN ('quoted','payment_pending') AND (razorpay_payment_id IS NULL OR razorpay_payment_id=?)`)
    .run(paymentId, new Date().toISOString(), row.id, paymentId);
  const updated = store.prepare('SELECT * FROM quotes WHERE id=?').get(row.id);
  if (!testMode() && updated?.razorpay_payment_id === paymentId) {
    store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind) VALUES(?,'payment_customer')`).run(row.id);
  }
  return updated;
}

async function sendTemplate(to, name, parameters) {
  const response = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${process.env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: {
      name, language: { code: process.env.META_TEMPLATE_LANGUAGE || 'en_US' },
      components: [{ type: 'body', parameters: parameters.map((text) => ({ type: 'text', text: String(text) })) }],
    } }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`WhatsApp API returned ${response.status}`);
}

export async function drainBookingNotifications() {
  if (!configured() || testMode()) return;
  const store = db();
  const pending = store.prepare(`SELECT o.id AS notification_id, o.kind, q.* FROM notification_outbox o
    JOIN quotes q ON q.id=o.quote_id WHERE o.state='pending' AND o.attempts<10 ORDER BY o.id LIMIT 10`).all();
  for (const item of pending) {
    const claimed = store.prepare(`UPDATE notification_outbox SET state='sending',attempts=attempts+1 WHERE id=? AND state='pending'`).run(item.notification_id);
    if (!claimed.changes) continue;
    try {
      const reference = item.id.slice(0, 8).toUpperCase();
      if (item.kind === 'payment_customer') {
        await sendTemplate(item.customer_phone, process.env.META_TEMPLATE_PAYMENT,
          [item.customer_name, reference, item.service, `₹${(item.total_paise / 100).toFixed(2)}`]);
      } else if (item.kind === 'assigned_customer') {
        await sendTemplate(item.customer_phone, process.env.META_TEMPLATE_CUSTOMER_ASSIGNED,
          [item.customer_name, reference, item.artist_name, item.appointment_window]);
      } else if (item.kind === 'assigned_artist') {
        await sendTemplate(item.artist_phone, process.env.META_TEMPLATE_ARTIST_ASSIGNED,
          [item.artist_name, reference, item.service, item.appointment_window, item.service_address, item.customer_phone]);
      }
      store.prepare(`UPDATE notification_outbox SET state='submitted',last_error=NULL WHERE id=?`).run(item.notification_id);
    } catch (error) {
      store.prepare(`UPDATE notification_outbox SET state='pending',last_error=? WHERE id=?`)
        .run(String(error).slice(0, 200), item.notification_id);
    }
  }
}

export async function handleManagedBooking(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/managed-bookings', '');
  if (path === '/health' && request.method === 'GET') {
    if (!configured()) return json({ enabled: false, testMode: false });
    try { db(); return json({ enabled: true, testMode: testMode() }); }
    catch { return json({ enabled: false, testMode: testMode() }, 503); }
  }
  if (!configured()) return json({ error: 'Online booking payments are not available yet.' }, 503);
  if (request.method !== 'GET' && !sameOrigin(request) && path !== '/webhook') return json({ error: 'Origin not allowed' }, 403);
  try {
    const store = db();
    if (path === '/quote' && request.method === 'GET') {
      const row = store.prepare('SELECT * FROM quotes WHERE token=?').get(url.searchParams.get('token'));
      return row ? json(publicQuote(row)) : json({ error: 'Quote not found' }, 404);
    }
    if (path === '/admin/quotes' && request.method === 'POST') {
      if (!adminAllowed(request)) return json({ error: 'Unauthorized' }, 401);
      const input = await body(request);
      if (input.coverageConfirmed !== true) return json({ error: 'Confirm eligible artist coverage, rate and travel before creating a payable quote' }, 400);
      const row = {
        id: randomUUID(), token: randomBytes(32).toString('hex'),
        customerName: clean(input.customerName, 100),
        customerPhone: clean(input.customerPhone, 16),
        service: clean(input.service, 100), scope: clean(input.scope, 1000),
        serviceAddress: clean(input.serviceAddress, 500),
        appointmentWindow: clean(input.appointmentWindow, 100),
        servicePaise: amount(input.servicePaise), travelPaise: amount(input.travelPaise),
        extrasPaise: amount(input.extrasPaise), taxPaise: amount(input.taxPaise),
      };
      if (!/^91[6-9][0-9]{9}$/.test(row.customerPhone)) return json({ error: 'Use an Indian WhatsApp number with 91 prefix' }, 400);
      if (testMode() && (row.customerPhone !== '919999999999' || !row.customerName.toUpperCase().startsWith('TEST ')
        || !row.serviceAddress.toUpperCase().startsWith('TEST '))) {
        return json({ error: 'Test mode accepts only TEST names, TEST addresses and the synthetic 919999999999 number.' }, 400);
      }
      const total = row.servicePaise + row.travelPaise + row.extrasPaise + row.taxPaise;
      if (total < 100 || total > 2_000_000) return json({ error: 'Invalid total' }, 400);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      store.prepare(`INSERT INTO quotes(id,token,customer_name,customer_phone,service,scope,service_address,appointment_window,
        service_paise,travel_paise,extras_paise,tax_paise,total_paise,status,created_at,expires_at,coverage_confirmed_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'quoted',?,?,?)`).run(
        row.id,row.token,row.customerName,row.customerPhone,row.service,row.scope,row.serviceAddress,row.appointmentWindow,
        row.servicePaise,row.travelPaise,row.extrasPaise,row.taxPaise,total,new Date().toISOString(),expires,new Date().toISOString());
      return json({ reference: row.id, checkoutUrl: `https://sahaanstudios.in/book/${row.token}` }, 201);
    }
    if (path === '/admin/quotes' && request.method === 'GET') {
      if (!adminAllowed(request)) return json({ error: 'Unauthorized' }, 401);
      const rows = store.prepare(`SELECT id,customer_name,service,appointment_window,total_paise,status,paid_at,artist_name FROM quotes ORDER BY created_at DESC LIMIT 100`).all();
      const notifications = store.prepare(`SELECT quote_id,kind,state,attempts,last_error FROM notification_outbox ORDER BY id DESC LIMIT 300`).all();
      return json({ quotes: rows, notifications });
    }
    if (path === '/order' && request.method === 'POST') {
      const input = await body(request);
      if (input.consent !== true) return json({ error: testMode() ? 'Please approve this simulated test transaction.' : 'Please approve the quote and WhatsApp booking updates.' }, 400);
      const row = store.prepare('SELECT * FROM quotes WHERE token=?').get(input.token);
      if (!row) return json({ error: 'Quote not found' }, 404);
      if (new Date(row.expires_at) < new Date()) return json({ error: 'This quote has expired; ask Sahaan for a new quote.' }, 409);
      if (!['quoted','payment_pending'].includes(row.status)) return json({ error: 'This quote is not payable' }, 409);
      store.prepare('UPDATE quotes SET customer_consent_at=COALESCE(customer_consent_at,?) WHERE id=?')
        .run(new Date().toISOString(), row.id);
      let orderId = row.razorpay_order_id;
      if (!orderId) {
        const order = await razorpay('orders', { method: 'POST', body: JSON.stringify({ amount: row.total_paise, currency: 'INR', receipt: row.id, notes: { sahaan_quote: row.id } }) });
        store.prepare(`UPDATE quotes SET razorpay_order_id=?,status='payment_pending' WHERE id=? AND razorpay_order_id IS NULL`).run(order.id, row.id);
        orderId = store.prepare('SELECT razorpay_order_id FROM quotes WHERE id=?').get(row.id).razorpay_order_id;
      }
      return json({ keyId: process.env.RAZORPAY_KEY_ID, orderId, amount: row.total_paise, currency: 'INR' });
    }
    if (path === '/verify' && request.method === 'POST') {
      const input = await body(request);
      const row = store.prepare('SELECT * FROM quotes WHERE token=?').get(input.token);
      if (!row || row.razorpay_order_id !== input.orderId || !/^pay_[A-Za-z0-9]+$/.test(input.paymentId || '')) return json({ error: 'Payment details do not match the quote' }, 400);
      const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${row.razorpay_order_id}|${input.paymentId}`).digest('hex');
      if (!safeEqual(expected, input.signature)) return json({ error: 'Payment signature invalid' }, 400);
      const payment = await razorpay(`payments/${encodeURIComponent(input.paymentId)}`);
      if (payment.status !== 'captured' || payment.order_id !== row.razorpay_order_id || payment.amount !== row.total_paise || payment.currency !== 'INR') {
        return json({ error: 'Payment capture is pending. Please check again shortly; do not pay twice.' }, 202);
      }
      const updated = markPaid(row, input.paymentId);
      await drainBookingNotifications();
      return json({ status: updated.status, reference: row.id });
    }
    if (path === '/webhook' && request.method === 'POST') {
      const raw = await request.text();
      const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
      if (!safeEqual(expected, request.headers.get('x-razorpay-signature'))) return json({ error: 'Invalid signature' }, 401);
      const event = JSON.parse(raw);
      if (event.event === 'payment.captured') {
        const payment = event.payload?.payment?.entity;
        const row = store.prepare('SELECT * FROM quotes WHERE razorpay_order_id=?').get(payment?.order_id);
        if (row && payment?.status === 'captured' && payment.amount === row.total_paise && payment.currency === 'INR') markPaid(row, payment.id);
      } else if (event.event === 'refund.processed') {
        const refund = event.payload?.refund?.entity;
        const row = store.prepare('SELECT * FROM quotes WHERE razorpay_payment_id=?').get(refund?.payment_id);
        if (row && refund?.status === 'processed' && refund.amount === row.total_paise) {
          store.prepare(`UPDATE quotes SET status='refunded',refunded_at=? WHERE id=? AND status IN ('paid_unassigned','assigned')`)
            .run(new Date().toISOString(), row.id);
        }
      }
      await drainBookingNotifications();
      return json({ ok: true });
    }
    if (path === '/admin/assign' && request.method === 'POST') {
      if (!adminAllowed(request)) return json({ error: 'Unauthorized' }, 401);
      const input = await body(request);
      if (input.artistConsented !== true) return json({ error: testMode() ? 'Confirm this is a simulated test assignment' : 'Confirm the professional agreed to receive this assignment on WhatsApp' }, 400);
      const artistName = clean(input.artistName, 100);
      const artistPhone = clean(input.artistPhone, 16);
      if (!/^91[6-9][0-9]{9}$/.test(artistPhone)) return json({ error: 'Use an Indian WhatsApp number with 91 prefix' }, 400);
      if (testMode() && (artistPhone !== '919999999998' || !artistName.toUpperCase().startsWith('TEST '))) {
        return json({ error: 'Test mode accepts only a TEST artist and the synthetic 919999999998 number.' }, 400);
      }
      const now = new Date().toISOString();
      const updated = store.prepare(`UPDATE quotes SET status='assigned',artist_name=?,artist_phone=?,artist_consent_at=?,assigned_at=? WHERE id=? AND status='paid_unassigned'`)
        .run(artistName,artistPhone,now,now,input.reference);
      if (!updated.changes) return json({ error: 'Only a paid, unassigned request can be assigned' }, 409);
      if (!testMode()) {
        store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind) VALUES(?,'assigned_customer')`).run(input.reference);
        store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind) VALUES(?,'assigned_artist')`).run(input.reference);
      }
      await drainBookingNotifications();
      return json({ status: 'assigned' });
    }
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('Managed booking error:', error);
    return json({ error: 'Could not complete this request. Contact Sahaan for help.' }, 500);
  }
}
