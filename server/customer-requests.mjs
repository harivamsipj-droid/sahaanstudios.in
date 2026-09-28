import { randomBytes, timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let database;
let mysqlPool;
let mysqlReady;
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

function useMysql() {
  return Boolean(process.env.SAHAAN_MYSQL_HOST);
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
  return pool?.end();
}

export async function handleCustomerRequest(request) {
  if (!configured()) return json({ error: 'Website request storage is not available. Please send your request on WhatsApp instead.' }, 503);
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname.endsWith('/health')) {
    try { if (useMysql()) await mysql(); else db(); return json({ enabled: true }); }
    catch { return json({ enabled: false, error: 'Website request storage is unavailable.' }, 503); }
  }

  if (request.method === 'GET' && url.pathname.endsWith('/admin')) {
    if (!safeEqual(request.headers.get('authorization'), `Bearer ${process.env.SAHAAN_ADMIN_TOKEN}`)) return json({ error: 'Not authorized' }, 401);
    const rows = useMysql()
      ? (await (await mysql()).execute(`SELECT reference, customer_name, customer_phone, service, area,
          DATE_FORMAT(preferred_date, '%Y-%m-%d') AS preferred_date, preferred_time, notes, status,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at
          FROM customer_requests ORDER BY created_at DESC LIMIT 100`))[0]
      : db().prepare('SELECT * FROM customer_requests ORDER BY created_at DESC LIMIT 100').all();
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
  const storage = useMysql() ? await mysql() : db();
  const duplicate = useMysql()
    ? (await storage.execute(`SELECT reference FROM customer_requests WHERE customer_phone=? AND service=? AND preferred_date=? AND created_at>=? LIMIT 1`,
        [phone, service, date, cutoff]))[0][0]
    : storage.prepare(`SELECT reference FROM customer_requests WHERE customer_phone=? AND service=? AND preferred_date=? AND created_at>=? LIMIT 1`)
      .get(phone, service, date, cutoff.toISOString());
  if (duplicate) return json({ reference: duplicate.reference, status: 'request_received' });
  const values = [reference, name, phone, service, area, date, time, notes, new Date()];
  if (useMysql()) {
    await storage.execute(`INSERT INTO customer_requests(reference,customer_name,customer_phone,service,area,preferred_date,preferred_time,notes,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`, values);
  } else {
    storage.prepare(`INSERT INTO customer_requests(reference,customer_name,customer_phone,service,area,preferred_date,preferred_time,notes,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(reference, name, phone, service, area, date, time, notes, values[8].toISOString());
  }
  return json({ reference, status: 'request_received' }, 201);
}
