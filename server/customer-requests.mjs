import { randomBytes, timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let database;
let mysqlPool;
let mysqlReady;
let drainingNotifications = false;
const services = new Set(['Gel polish', 'Manicure', 'Nail extensions', 'Custom nail art']);
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function configured() {
  const mysql = ['SAHAAN_MYSQL_HOST', 'SAHAAN_MYSQL_USER', 'SAHAAN_MYSQL_PASSWORD', 'SAHAAN_MYSQL_DATABASE']
    .every((name) => Boolean(process.env[name]));
  const sqlite = Boolean(process.env.SAHAAN_INQUIRY_DATA_FILE && isAbsolute(process.env.SAHAAN_INQUIRY_DATA_FILE));
  return (mysql || sqlite) && Boolean(process.env.SAHAAN_ADMIN_TOKEN && process.env.SAHAAN_ADMIN_TOKEN.length >= 32);
}

function hasMysqlConfig() {
  return Boolean(process.env.SAHAAN_MYSQL_HOST);
}

export function customerWhatsappReady() {
  return process.env.SAHAAN_NOTIFICATION_MODE !== 'manual'
    && process.env.SAHAAN_WHATSAPP_REQUESTS_ENABLED === '1'
    && Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID)
    && /^v[0-9]+\.[0-9]+$/.test(process.env.META_GRAPH_VERSION || '')
    && Boolean(process.env.META_TEMPLATE_REQUEST_RECEIVED);
}

async function mysql() {
  if (!mysqlReady) {
    mysqlReady = (async () => {
      const { createPool } = await import('mysql2/promise');
      mysqlPool = createPool({
        host: process.env.SAHAAN_MYSQL_HOST,
        user: process.env.SAHAAN_MYSQL_USER,
        password: process.env.SAHAAN_MYSQL_PASSWORD,
        database: process.env.SAHAAN_MYSQL_DATABASE,
        timezone: 'Z',
        waitForConnections: true,
        connectionLimit: 4,
      });
      await mysqlPool.query(`CREATE TABLE IF NOT EXISTS customer_requests (
        reference VARCHAR(24) PRIMARY KEY, customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(16) NOT NULL, service VARCHAR(100) NOT NULL,
        area VARCHAR(200) NOT NULL, preferred_date DATE NOT NULL,
        preferred_time VARCHAR(40) NOT NULL, notes TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'new', created_at DATETIME(3) NOT NULL,
        INDEX request_duplicate (customer_phone, service, preferred_date, created_at)
      )`);
      await mysqlPool.query(`CREATE TABLE IF NOT EXISTS customer_request_outbox (
        reference VARCHAR(24) PRIMARY KEY, state VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0, meta_message_id VARCHAR(255),
        last_error VARCHAR(120), created_at DATETIME(3) NOT NULL,
        INDEX notification_state (state, created_at)
      )`);
      return mysqlPool;
    })().catch((error) => { mysqlReady = undefined; throw error; });
  }
  return mysqlReady;
}

function db() {
  if (!configured()) throw new Error('Customer request storage is not configured');
  if (!database) {
    database = new DatabaseSync(process.env.SAHAAN_INQUIRY_DATA_FILE);
    database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS customer_requests (
        reference TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
        service TEXT NOT NULL, area TEXT NOT NULL, preferred_date TEXT NOT NULL,
        preferred_time TEXT NOT NULL, notes TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS customer_request_outbox (
        reference TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0, meta_message_id TEXT,
        last_error TEXT, created_at TEXT NOT NULL
      );`);
  }
  return database;
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clean(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null;
}

export function closeCustomerRequestStorage() {
  database?.close();
  database = undefined;
  const pool = mysqlPool;
  mysqlPool = undefined;
  mysqlReady = undefined;
  drainingNotifications = false;
  return pool?.end();
}

async function sendRequestTemplate(item) {
  const response = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${process.env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: item.customer_phone, type: 'template', template: {
      name: process.env.META_TEMPLATE_REQUEST_RECEIVED,
      language: { code: process.env.META_TEMPLATE_LANGUAGE || 'en_US' },
      components: [{ type: 'body', parameters: [item.customer_name, item.reference, item.service,
        item.visit_date, item.preferred_time].map((text) => ({ type: 'text', text: String(text) })) }],
    } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Meta HTTP ${response.status}`);
  const result = await response.json();
  const messageId = result.messages?.[0]?.id;
  if (typeof messageId !== 'string' || !messageId) throw new Error('Meta response lacked a message ID');
  return messageId;
}

/** Accepts approved, opted-in request templates only. A Meta ID means submitted, not delivered. */
export async function drainCustomerRequestNotifications() {
  if (drainingNotifications || !configured() || !customerWhatsappReady()) return;
  drainingNotifications = true;
  try {
    const storage = hasMysqlConfig() ? await mysql() : db();
    const cutoff = new Date(Date.now() - 60 * 60_000);
    let pending;
    if (hasMysqlConfig()) {
      await storage.execute(`UPDATE customer_request_outbox SET state='expired' WHERE state='pending' AND created_at<?`, [cutoff]);
      await storage.execute(`UPDATE customer_request_outbox SET state='needs_review' WHERE state='pending' AND attempts>=3`);
      [pending] = await storage.execute(`SELECT o.reference,r.customer_name,r.customer_phone,r.service,
        DATE_FORMAT(r.preferred_date,'%Y-%m-%d') AS visit_date,r.preferred_time
        FROM customer_request_outbox o JOIN customer_requests r ON r.reference=o.reference
        WHERE o.state='pending' AND o.attempts<3 ORDER BY o.created_at LIMIT 10`);
    } else {
      storage.prepare(`UPDATE customer_request_outbox SET state='expired' WHERE state='pending' AND created_at<?`)
        .run(cutoff.toISOString());
      storage.prepare(`UPDATE customer_request_outbox SET state='needs_review' WHERE state='pending' AND attempts>=3`).run();
      pending = storage.prepare(`SELECT o.reference,r.customer_name,r.customer_phone,r.service,
        r.preferred_date AS visit_date,r.preferred_time
        FROM customer_request_outbox o JOIN customer_requests r ON r.reference=o.reference
        WHERE o.state='pending' AND o.attempts<3 ORDER BY o.created_at LIMIT 10`).all();
    }
    for (const item of pending) {
      const claimed = hasMysqlConfig()
        ? (await storage.execute(`UPDATE customer_request_outbox SET state='sending',attempts=attempts+1
            WHERE reference=? AND state='pending'`, [item.reference]))[0].affectedRows
        : storage.prepare(`UPDATE customer_request_outbox SET state='sending',attempts=attempts+1
            WHERE reference=? AND state='pending'`).run(item.reference).changes;
      if (!claimed) continue;
      try {
        const messageId = await sendRequestTemplate(item);
        if (hasMysqlConfig()) await storage.execute(`UPDATE customer_request_outbox
          SET state='submitted',meta_message_id=?,last_error=NULL WHERE reference=?`, [messageId,item.reference]);
        else storage.prepare(`UPDATE customer_request_outbox SET state='submitted',meta_message_id=?,last_error=NULL
          WHERE reference=?`).run(messageId,item.reference);
      } catch (error) {
        // A timed-out request may have reached Meta. Manual review prevents duplicate messages.
        const state = String(error).startsWith('Error: Meta HTTP 429') ? 'pending' : 'needs_review';
        const reason = error instanceof Error ? error.message.slice(0,120) : 'Unknown send error';
        if (hasMysqlConfig()) await storage.execute(`UPDATE customer_request_outbox SET state=?,last_error=?
          WHERE reference=?`, [state,reason,item.reference]);
        else storage.prepare(`UPDATE customer_request_outbox SET state=?,last_error=? WHERE reference=?`)
          .run(state,reason,item.reference);
      }
    }
  } finally {
    drainingNotifications = false;
  }
}

export async function handleCustomerRequest(request) {
  if (!configured()) return json({ error: 'Website request storage is not available. Please send your request on WhatsApp instead.' }, 503);
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname.endsWith('/health')) {
    try { if (hasMysqlConfig()) await mysql(); else db(); return json({ enabled: true, whatsappAvailable: customerWhatsappReady() }); }
    catch { return json({ enabled: false, error: 'Website request storage is unavailable.' }, 503); }
  }

  if (request.method === 'GET' && url.pathname.endsWith('/admin')) {
    if (!safeEqual(request.headers.get('authorization'), `Bearer ${process.env.SAHAAN_ADMIN_TOKEN}`)) return json({ error: 'Not authorized' }, 401);
    const rows = hasMysqlConfig()
      ? (await (await mysql()).execute(`SELECT r.reference,r.customer_name,r.customer_phone,r.service,r.area,
          DATE_FORMAT(r.preferred_date, '%Y-%m-%d') AS preferred_date,r.preferred_time,r.notes,r.status,
          DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at,
          o.state AS whatsapp_status,o.last_error AS whatsapp_error
          FROM customer_requests r LEFT JOIN customer_request_outbox o ON o.reference=r.reference
          ORDER BY r.created_at DESC LIMIT 100`))[0]
      : db().prepare(`SELECT r.*,o.state AS whatsapp_status,o.last_error AS whatsapp_error
          FROM customer_requests r LEFT JOIN customer_request_outbox o ON o.reference=r.reference
          ORDER BY r.created_at DESC LIMIT 100`).all();
    return json({ requests: rows });
  }

  if (request.method !== 'POST' || !url.pathname.endsWith('/')) return json({ error: 'Not found' }, 404);
  if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'Invalid origin' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required' }, 415);
  const raw = await request.text();
  if (raw.length > 4096) return json({ error: 'Request is too long' }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid request' }, 400); }
  if (input.website) return json({ ok: true }); // Invisible bot field; do not store.

  const name = clean(input.name, 100);
  const phone = typeof input.phone === 'string' ? input.phone.replace(/\D/g, '') : '';
  const service = clean(input.service, 100);
  const area = clean(input.area, 200);
  const date = clean(input.date, 10);
  const time = clean(input.time, 40);
  const notes = typeof input.notes === 'string' && input.notes.length <= 1000 ? input.notes.trim() : null;
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type) => dateParts.find((item) => item.type === type)?.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const validDate = selected && !Number.isNaN(selected.getTime()) && selected.toISOString().slice(0, 10) === date && date >= today;
  if (!name || !/^91[6-9]\d{9}$/.test(phone) || !services.has(service) || !area || !validDate || !['9:00 am–12:00 pm', '12:00 pm–3:00 pm', '3:00 pm–6:00 pm', '6:00 pm–9:00 pm'].includes(time) || notes === null || input.consent !== true) {
    return json({ error: 'Please complete all required details and agree to be contacted about this request.' }, 400);
  }
  const reference = `SH-${randomBytes(5).toString('hex').toUpperCase()}`;
  const cutoff = new Date(Date.now() - 2 * 60_000);
  const storage = hasMysqlConfig() ? await mysql() : db();
  const duplicate = hasMysqlConfig()
    ? (await storage.execute(`SELECT reference FROM customer_requests WHERE customer_phone=? AND service=? AND preferred_date=? AND created_at>=? LIMIT 1`,
        [phone, service, date, cutoff]))[0][0]
    : storage.prepare(`SELECT reference FROM customer_requests WHERE customer_phone=? AND service=? AND preferred_date=? AND created_at>=? LIMIT 1`)
      .get(phone, service, date, cutoff.toISOString());
  if (duplicate) return json({ reference: duplicate.reference, status: 'request_received', whatsappUpdate: 'not_queued' });
  const values = [reference, name, phone, service, area, date, time, notes, new Date()];
  const notifyCustomer = customerWhatsappReady() && input.whatsappConsent === true;
  if (hasMysqlConfig()) {
    const connection = await storage.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(`INSERT INTO customer_requests(reference,customer_name,customer_phone,service,area,preferred_date,preferred_time,notes,created_at)
        VALUES(?,?,?,?,?,?,?,?,?)`, values);
      if (notifyCustomer) await connection.execute(`INSERT INTO customer_request_outbox(reference,created_at) VALUES(?,?)`, [reference,values[8]]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  } else {
    storage.exec('BEGIN');
    try {
      storage.prepare(`INSERT INTO customer_requests(reference,customer_name,customer_phone,service,area,preferred_date,preferred_time,notes,created_at)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(reference, name, phone, service, area, date, time, notes, values[8].toISOString());
      if (notifyCustomer) storage.prepare(`INSERT INTO customer_request_outbox(reference,created_at) VALUES(?,?)`)
        .run(reference,values[8].toISOString());
      storage.exec('COMMIT');
    } catch (error) { storage.exec('ROLLBACK'); throw error; }
  }
  return json({ reference, status: 'request_received', whatsappUpdate: notifyCustomer ? 'queued' : 'not_queued' }, 201);
}
