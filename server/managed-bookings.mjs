import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { standardServicePrices } from '../lib/pricing.mjs';
import { manualConfirmationDeadline, staffedHoursLabel } from '../lib/manual-booking-window.mjs';

let database;
let mysqlPool;
let mysqlReady;
let sqliteForTests = false;

export function enableSqliteBookingStorageForTests() {
  if (process.env.NODE_ENV !== 'test') throw new Error('SQLite live-flow testing is only available in test runs');
  sqliteForTests = true;
}

export function closeManagedBookingStorage() {
  database?.close();
  database = undefined;
  const pool = mysqlPool;
  mysqlPool = undefined;
  mysqlReady = undefined;
  return pool?.end();
}

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function configured() {
  const credentials = razorpayCredentials();
  const testMode = process.env.SAHAAN_PAYMENT_TEST_MODE === '1' && credentials.id.startsWith('rzp_test_');
  const liveMode = process.env.SAHAAN_PAYMENT_TEST_MODE !== '1'
    && credentials.id.startsWith('rzp_live_')
    && (manualMode()
      ? /^\d{4}-\d{2}-\d{2}$/.test(process.env.SAHAAN_MANUAL_PILOT_END || '')
      : Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID)
        && /^v[0-9]+\.[0-9]+$/.test(process.env.META_GRAPH_VERSION || '')
        && Boolean(process.env.META_TEMPLATE_PAYMENT && process.env.META_TEMPLATE_CUSTOMER_ASSIGNED && process.env.META_TEMPLATE_ARTIST_ASSIGNED));
  return process.env.SAHAAN_PAYMENTS_ENABLED === '1'
    && process.env.SAHAAN_POLICY_APPROVED === '1'
    && (testMode || sqliteForTests ? Boolean(process.env.SAHAAN_DATA_FILE && isAbsolute(process.env.SAHAAN_DATA_FILE))
      : hasMysqlConfig())
    && Boolean(process.env.SAHAAN_ADMIN_TOKEN && process.env.SAHAAN_ADMIN_TOKEN.length >= 32)
    && Boolean(credentials.id && credentials.secret)
    && (testMode ? Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)
      : Boolean((process.env.RAZORPAY_LIVE_WEBHOOK_SECRET || '').length >= 32))
    && (testMode || liveMode);
}

function manualMode() {
  return process.env.SAHAAN_NOTIFICATION_MODE === 'manual';
}

function manualPilotOpen() {
  if (testMode() || !manualMode()) return true;
  const end = process.env.SAHAAN_MANUAL_PILOT_END || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(end)
    && Number.isFinite(Date.parse(`${end}T18:29:59.999Z`))
    && Date.now() <= Date.parse(`${end}T18:29:59.999Z`);
}

function hasMysqlConfig() {
  return ['SAHAAN_MYSQL_HOST', 'SAHAAN_MYSQL_USER', 'SAHAAN_MYSQL_PASSWORD', 'SAHAAN_MYSQL_DATABASE']
    .every((name) => Boolean(process.env[name]));
}

function testMode() {
  return process.env.SAHAAN_PAYMENT_TEST_MODE === '1' && (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_');
}

function razorpayCredentials() {
  // Never fall back to test credentials after the live switch is selected.
  return process.env.SAHAAN_PAYMENT_TEST_MODE === '1'
    ? { id: process.env.RAZORPAY_KEY_ID || '', secret: process.env.RAZORPAY_KEY_SECRET || '' }
    : { id: process.env.RAZORPAY_LIVE_KEY_ID || '', secret: process.env.RAZORPAY_LIVE_KEY_SECRET || '' };
}

async function db() {
  if (!configured()) throw new Error('Managed bookings are not configured');
  if (!testMode() && !sqliteForTests) {
    if (!mysqlReady) {
      mysqlReady = (async () => {
        const { createPool } = await import('mysql2/promise');
        mysqlPool = createPool({
          host: process.env.SAHAAN_MYSQL_HOST,
          user: process.env.SAHAAN_MYSQL_USER,
          password: process.env.SAHAAN_MYSQL_PASSWORD,
          database: process.env.SAHAAN_MYSQL_DATABASE,
          timezone: 'Z', waitForConnections: true, connectionLimit: 4,
        });
        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS managed_quotes (
          id CHAR(36) PRIMARY KEY, token CHAR(64) NOT NULL UNIQUE,
          customer_name VARCHAR(100) NOT NULL, customer_phone VARCHAR(16) NOT NULL,
          service VARCHAR(100) NOT NULL, scope TEXT NOT NULL,
          service_address VARCHAR(500) NOT NULL, appointment_window VARCHAR(100) NOT NULL,
          service_paise INT NOT NULL, travel_paise INT NOT NULL, extras_paise INT NOT NULL,
          tax_paise INT NOT NULL, total_paise INT NOT NULL, status VARCHAR(24) NOT NULL,
          razorpay_order_id VARCHAR(80) UNIQUE, razorpay_payment_id VARCHAR(80) UNIQUE,
          artist_name VARCHAR(100), artist_phone VARCHAR(16), artist_consent_at VARCHAR(35),
          created_at VARCHAR(35) NOT NULL, expires_at VARCHAR(35) NOT NULL,
          coverage_confirmed_at VARCHAR(35), customer_consent_at VARCHAR(35),
          paid_at VARCHAR(35), assigned_at VARCHAR(35), refunded_at VARCHAR(35),
          INDEX managed_quotes_created (created_at), INDEX managed_quotes_status (status)
        ) ENGINE=InnoDB`);
        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS managed_notification_outbox (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, quote_id CHAR(36) NOT NULL,
          kind VARCHAR(32) NOT NULL, state VARCHAR(20) NOT NULL DEFAULT 'pending',
          attempts INT NOT NULL DEFAULT 0, last_error VARCHAR(200), sent_at VARCHAR(35),
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          UNIQUE KEY managed_outbox_unique (quote_id,kind),
          INDEX managed_outbox_state (state,id),
          CONSTRAINT managed_outbox_quote FOREIGN KEY (quote_id) REFERENCES managed_quotes(id)
        ) ENGINE=InnoDB`);
        const [sentColumns] = await mysqlPool.query("SHOW COLUMNS FROM managed_notification_outbox LIKE 'sent_at'");
        if (!sentColumns.length) await mysqlPool.query('ALTER TABLE managed_notification_outbox ADD COLUMN sent_at VARCHAR(35)');
        await mysqlPool.query("UPDATE managed_notification_outbox SET state='needs_review',last_error='Server restarted during send; verify delivery manually' WHERE state='sending'");
        return {
          prepare(sql) {
            const query = sql.replace(/\bquotes\b/g, 'managed_quotes')
              .replace(/\bnotification_outbox\b/g, 'managed_notification_outbox')
              .replace(/INSERT OR IGNORE/gi, 'INSERT IGNORE');
            return {
              async get(...values) { const [rows] = await mysqlPool.execute(query, values); return rows[0]; },
              async all(...values) { const [rows] = await mysqlPool.execute(query, values); return rows; },
              async run(...values) { const [result] = await mysqlPool.execute(query, values); return { changes: result.affectedRows }; },
            };
          },
        };
      })().catch((error) => { mysqlReady = undefined; throw error; });
    }
    return mysqlReady;
  }
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
        last_error TEXT, sent_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(quote_id, kind)
      );`);
    if (!database.prepare('PRAGMA table_info(notification_outbox)').all().some((column) => column.name === 'sent_at')) {
      database.exec('ALTER TABLE notification_outbox ADD COLUMN sent_at TEXT');
    }
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
    testMode: testMode(), manualPilot: manualMode() && !testMode(),
    confirmationBy: manualMode() && row.paid_at ? manualConfirmationDeadline(row.paid_at) : null,
    staffedHours: manualMode() ? staffedHoursLabel : null,
    paymentsOpen: manualPilotOpen(),
  };
}

async function razorpay(path, options = {}) {
  const { id, secret } = razorpayCredentials();
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    ...options,
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Razorpay API returned ${response.status}`);
  return result;
}

async function markPaid(row, paymentId) {
  const store = await db();
  await store.prepare(`UPDATE quotes SET status='paid_unassigned', razorpay_payment_id=?, paid_at=?
    WHERE id=? AND status IN ('quoted','payment_pending') AND (razorpay_payment_id IS NULL OR razorpay_payment_id=?)`)
    .run(paymentId, new Date().toISOString(), row.id, paymentId);
  const updated = await store.prepare('SELECT * FROM quotes WHERE id=?').get(row.id);
  if (!testMode() && !manualMode() && updated?.razorpay_payment_id === paymentId) {
    await store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind) VALUES(?,'payment_customer')`).run(row.id);
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
  const result = await response.json();
  if (typeof result.messages?.[0]?.id !== 'string') throw new Error('WhatsApp API response lacked a message ID');
}

export async function drainBookingNotifications() {
  if (!configured() || testMode() || manualMode()) return;
  const store = await db();
  // Recover an acknowledgement if the process stopped between recording a
  // captured payment and queueing its customer message.
  await store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind)
    SELECT id,'payment_customer' FROM quotes
    WHERE status IN ('paid_unassigned','assigned') AND razorpay_payment_id IS NOT NULL`).run();
  const pending = await store.prepare(`SELECT o.id AS notification_id, o.kind, q.* FROM notification_outbox o
    JOIN quotes q ON q.id=o.quote_id WHERE o.state='pending' AND o.attempts<10 ORDER BY o.id LIMIT 10`).all();
  for (const item of pending) {
    const claimed = await store.prepare(`UPDATE notification_outbox SET state='sending',attempts=attempts+1 WHERE id=? AND state='pending'`).run(item.notification_id);
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
      await store.prepare(`UPDATE notification_outbox SET state='submitted',last_error=NULL WHERE id=?`).run(item.notification_id);
    } catch (error) {
      await store.prepare(`UPDATE notification_outbox SET state='needs_review',last_error=? WHERE id=?`)
        .run(String(error).slice(0, 200), item.notification_id);
    }
  }
}

export async function handleManagedBooking(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/managed-bookings', '');
  if (path === '/health' && request.method === 'GET') {
    if (!configured()) return json({ enabled: false, testMode: false });
    try { await db(); return json({ enabled: true, testMode: testMode(), manualPilot: manualMode() && !testMode(), paymentsOpen: manualPilotOpen() }); }
    catch { return json({ enabled: false, testMode: testMode() }, 503); }
  }
  // A signed live webhook can be connected before checkout goes live. While
  // test payments are active, acknowledge it without touching test bookings.
  if (path === '/webhook' && request.method === 'POST' && (!configured() || testMode())) {
    const liveSecret = process.env.RAZORPAY_LIVE_WEBHOOK_SECRET || '';
    if (liveSecret.length >= 32) {
      const raw = await request.clone().text();
      const expected = createHmac('sha256', liveSecret).update(raw).digest('hex');
      if (safeEqual(expected, request.headers.get('x-razorpay-signature'))) {
        // Record only the event category, never the payment payload or customer data.
        let event = 'other';
        try {
          const name = JSON.parse(raw)?.event;
          if (name === 'payment.captured' || name === 'refund.processed') event = name;
        } catch { /* A valid signature can still cover malformed JSON. */ }
        console.info(`Sahaan signed live webhook accepted in standby: ${event}`);
        return json({ ok: true, standby: true });
      }
    }
  }
  if (!configured()) return json({ error: 'Online booking payments are not available yet.' }, 503);
  if (request.method !== 'GET' && !sameOrigin(request) && path !== '/webhook') return json({ error: 'Origin not allowed' }, 403);
  try {
    const store = await db();
    if (path === '/quote' && request.method === 'GET') {
      const row = await store.prepare('SELECT * FROM quotes WHERE token=?').get(url.searchParams.get('token'));
      return row ? json(publicQuote(row)) : json({ error: 'Quote not found' }, 404);
    }
    if (path === '/admin/quotes' && request.method === 'POST') {
      if (!adminAllowed(request)) return json({ error: 'Unauthorized' }, 401);
      if (!manualPilotOpen()) return json({ error: 'The three-month manual pilot has ended. Do not create new payable quotes until the workflow is reviewed.' }, 409);
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
      const publishedPrice = standardServicePrices[row.service]?.paise;
      if (!testMode() && publishedPrice !== undefined && row.servicePaise + row.travelPaise !== publishedPrice) {
        return json({ error: 'The listed base-service price already includes travel. Service plus travel must equal the published price; optional extras and taxes must be itemised separately.' }, 400);
      }
      if (total < 100 || total > 2_000_000) return json({ error: 'Invalid total' }, 400);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await store.prepare(`INSERT INTO quotes(id,token,customer_name,customer_phone,service,scope,service_address,appointment_window,
        service_paise,travel_paise,extras_paise,tax_paise,total_paise,status,created_at,expires_at,coverage_confirmed_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'quoted',?,?,?)`).run(
        row.id,row.token,row.customerName,row.customerPhone,row.service,row.scope,row.serviceAddress,row.appointmentWindow,
        row.servicePaise,row.travelPaise,row.extrasPaise,row.taxPaise,total,new Date().toISOString(),expires,new Date().toISOString());
      return json({ reference: row.id, checkoutUrl: `https://sahaanstudios.in/book/${row.token}` }, 201);
    }
    if (path === '/admin/quotes' && request.method === 'GET') {
      if (!adminAllowed(request)) return json({ error: 'Unauthorized' }, 401);
      const rows = await store.prepare(`SELECT id,customer_name,customer_phone,service,scope,service_address,appointment_window,total_paise,status,paid_at,artist_name,artist_phone FROM quotes ORDER BY created_at DESC LIMIT 100`).all();
      const notifications = await store.prepare(`SELECT quote_id,kind,state,attempts,last_error,sent_at FROM notification_outbox ORDER BY id DESC LIMIT 300`).all();
      return json({ quotes: rows.map((row) => ({ ...row,
        confirmation_by: manualMode() && row.paid_at ? manualConfirmationDeadline(row.paid_at) : null,
      })), notifications });
    }
    if (path === '/admin/notifications/manual-sent' && request.method === 'POST') {
      if (!adminAllowed(request)) return json({ error: 'Unauthorized' }, 401);
      if (!manualMode() || testMode()) return json({ error: 'Manual confirmation tracking is not active.' }, 409);
      const input = await body(request);
      if (!['assigned_customer', 'assigned_artist'].includes(input.kind) || input.sentConfirmed !== true) {
        return json({ error: 'Confirm the correct WhatsApp message was actually sent before marking it complete.' }, 400);
      }
      const row = await store.prepare('SELECT status FROM quotes WHERE id=?').get(input.reference);
      if (row?.status !== 'assigned') return json({ error: 'This booking has not been assigned.' }, 409);
      const updated = await store.prepare(`UPDATE notification_outbox SET state='manual_sent',sent_at=?,last_error=NULL
        WHERE quote_id=? AND kind=? AND state='manual_pending'`)
        .run(new Date().toISOString(), input.reference, input.kind);
      return updated.changes ? json({ status: 'manual_sent' }) : json({ error: 'Message is not pending or was already marked sent.' }, 409);
    }
    if (path === '/order' && request.method === 'POST') {
      if (!manualPilotOpen()) return json({ error: 'This pilot is not accepting new payments. Please contact Sahaan.' }, 409);
      const input = await body(request);
      if (input.consent !== true) return json({ error: testMode() ? 'Please approve this simulated test transaction.' : 'Please approve the quote and WhatsApp booking updates.' }, 400);
      const row = await store.prepare('SELECT * FROM quotes WHERE token=?').get(input.token);
      if (!row) return json({ error: 'Quote not found' }, 404);
      if (new Date(row.expires_at) < new Date()) return json({ error: 'This quote has expired; ask Sahaan for a new quote.' }, 409);
      if (!['quoted','payment_pending'].includes(row.status)) return json({ error: 'This quote is not payable' }, 409);
      await store.prepare('UPDATE quotes SET customer_consent_at=COALESCE(customer_consent_at,?) WHERE id=?')
        .run(new Date().toISOString(), row.id);
      let orderId = row.razorpay_order_id;
      if (!orderId) {
        const order = await razorpay('orders', { method: 'POST', body: JSON.stringify({ amount: row.total_paise, currency: 'INR', receipt: row.id, notes: { sahaan_quote: row.id } }) });
        await store.prepare(`UPDATE quotes SET razorpay_order_id=?,status='payment_pending' WHERE id=? AND razorpay_order_id IS NULL`).run(order.id, row.id);
        orderId = (await store.prepare('SELECT razorpay_order_id FROM quotes WHERE id=?').get(row.id)).razorpay_order_id;
      }
      return json({ keyId: razorpayCredentials().id, orderId, amount: row.total_paise, currency: 'INR' });
    }
    if (path === '/verify' && request.method === 'POST') {
      const input = await body(request);
      const row = await store.prepare('SELECT * FROM quotes WHERE token=?').get(input.token);
      if (!row || row.razorpay_order_id !== input.orderId || !/^pay_[A-Za-z0-9]+$/.test(input.paymentId || '')) return json({ error: 'Payment details do not match the quote' }, 400);
      const expected = createHmac('sha256', razorpayCredentials().secret).update(`${row.razorpay_order_id}|${input.paymentId}`).digest('hex');
      if (!safeEqual(expected, input.signature)) return json({ error: 'Payment signature invalid' }, 400);
      const payment = await razorpay(`payments/${encodeURIComponent(input.paymentId)}`);
      if (payment.status !== 'captured' || payment.order_id !== row.razorpay_order_id || payment.amount !== row.total_paise || payment.currency !== 'INR') {
        return json({ error: 'Payment capture is pending. Please check again shortly; do not pay twice.' }, 202);
      }
      const updated = await markPaid(row, input.paymentId);
      await drainBookingNotifications();
      return json({ status: updated.status, reference: row.id,
        confirmationBy: manualMode() ? manualConfirmationDeadline(updated.paid_at) : null });
    }
    if (path === '/webhook' && request.method === 'POST') {
      const raw = await request.text();
      const activeSecret = testMode() ? process.env.RAZORPAY_WEBHOOK_SECRET : process.env.RAZORPAY_LIVE_WEBHOOK_SECRET;
      const expected = createHmac('sha256', activeSecret).update(raw).digest('hex');
      if (!safeEqual(expected, request.headers.get('x-razorpay-signature'))) return json({ error: 'Invalid signature' }, 401);
      const event = JSON.parse(raw);
      if (event.event === 'payment.captured') {
        const payment = event.payload?.payment?.entity;
        const row = await store.prepare('SELECT * FROM quotes WHERE razorpay_order_id=?').get(payment?.order_id);
        if (row && payment?.status === 'captured' && payment.amount === row.total_paise && payment.currency === 'INR') await markPaid(row, payment.id);
      } else if (event.event === 'refund.processed') {
        const refund = event.payload?.refund?.entity;
        const row = await store.prepare('SELECT * FROM quotes WHERE razorpay_payment_id=?').get(refund?.payment_id);
        if (row && refund?.status === 'processed' && refund.amount === row.total_paise) {
          await store.prepare(`UPDATE quotes SET status='refunded',refunded_at=? WHERE id=? AND status IN ('paid_unassigned','assigned')`)
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
      const updated = await store.prepare(`UPDATE quotes SET status='assigned',artist_name=?,artist_phone=?,artist_consent_at=?,assigned_at=? WHERE id=? AND status='paid_unassigned'`)
        .run(artistName,artistPhone,now,now,input.reference);
      if (!updated.changes) return json({ error: 'Only a paid, unassigned request can be assigned' }, 409);
      if (!testMode()) {
        if (manualMode()) {
          await store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind,state) VALUES(?,'assigned_customer','manual_pending')`).run(input.reference);
          await store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind,state) VALUES(?,'assigned_artist','manual_pending')`).run(input.reference);
        } else {
          await store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind) VALUES(?,'assigned_customer')`).run(input.reference);
          await store.prepare(`INSERT OR IGNORE INTO notification_outbox(quote_id,kind) VALUES(?,'assigned_artist')`).run(input.reference);
        }
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
