import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const file = join(tmpdir(), `sahaan-customer-request-${randomUUID()}.sqlite`);
process.env.SAHAAN_INQUIRY_DATA_FILE = file;
process.env.SAHAAN_ADMIN_TOKEN = 'test-admin-token-with-at-least-32-characters';
const { handleCustomerRequest, closeCustomerRequestStorage, drainCustomerRequestNotifications } = await import('../server/customer-requests.mjs');
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const details = { name: 'Test Client', phone: '919876543210', service: 'Gel polish', area: 'Hyderabad', date,
  time: '12:00 pm–3:00 pm', notes: 'Solid colour', consent: true };

function request(path, method = 'GET', data, headers = {}) {
  return new Request(`https://sahaanstudios.in/api/customer-requests/${path}`, {
    method, headers: { origin: 'https://sahaanstudios.in', 'content-type': 'application/json', ...headers },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}

test('customer request is saved, deduplicated and private', async () => {
  try {
    assert.equal((await handleCustomerRequest(request('health'))).status, 200);
    assert.equal((await handleCustomerRequest(request('', 'POST', { ...details, consent: false }))).status, 400);
    assert.equal((await handleCustomerRequest(request('', 'POST', details, { origin: 'https://other.example' }))).status, 403);
    const response = await handleCustomerRequest(request('', 'POST', details));
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.match(saved.reference, /^SH-[A-F0-9]{10}$/);
    const repeat = await (await handleCustomerRequest(request('', 'POST', details))).json();
    assert.equal(repeat.reference, saved.reference);
    assert.equal((await handleCustomerRequest(request('admin'))).status, 401);
    const admin = await (await handleCustomerRequest(request('admin', 'GET', undefined,
      { authorization: `Bearer ${process.env.SAHAAN_ADMIN_TOKEN}` }))).json();
    assert.equal(admin.requests.length, 1);
    assert.equal(admin.requests[0].customer_phone, details.phone);
  } finally {
    closeCustomerRequestStorage();
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${file}${suffix}`, { force: true });
  }
});

test('only a separately opted-in enquiry queues one approved WhatsApp template', async () => {
  const previousFetch = globalThis.fetch;
  const sent = [];
  Object.assign(process.env, {
    SAHAAN_WHATSAPP_REQUESTS_ENABLED: '1', META_WHATSAPP_TOKEN: 'test-token',
    META_WHATSAPP_PHONE_NUMBER_ID: '12345', META_GRAPH_VERSION: 'v23.0',
    META_TEMPLATE_REQUEST_RECEIVED: 'sahaan_request_received', META_TEMPLATE_LANGUAGE: 'en_US',
  });
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const health = await (await handleCustomerRequest(request('health'))).json();
    assert.equal(health.whatsappAvailable, true);
    const saved = await (await handleCustomerRequest(request('', 'POST', {
      ...details, name: 'Opted-in test client', whatsappConsent: true,
    }))).json();
    assert.equal(saved.whatsappUpdate, 'queued');
    const withoutOptIn = await (await handleCustomerRequest(request('', 'POST', {
      ...details, phone: '919876543211', whatsappConsent: false,
    }))).json();
    assert.equal(withoutOptIn.whatsappUpdate, 'not_queued');
    await drainCustomerRequestNotifications();
    await drainCustomerRequestNotifications();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, details.phone);
    assert.equal(sent[0].template.name, 'sahaan_request_received');
    assert.deepEqual(sent[0].template.components[0].parameters.map((item) => item.text),
      ['Opted-in test client', saved.reference, details.service, date, details.time]);
    const admin = await (await handleCustomerRequest(request('admin', 'GET', undefined,
      { authorization: `Bearer ${process.env.SAHAAN_ADMIN_TOKEN}` }))).json();
    assert.equal(admin.requests.find((item) => item.reference === saved.reference).whatsapp_status, 'submitted');
    assert.equal(admin.requests.find((item) => item.reference === withoutOptIn.reference).whatsapp_status, null);
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of ['SAHAAN_WHATSAPP_REQUESTS_ENABLED','META_WHATSAPP_TOKEN','META_WHATSAPP_PHONE_NUMBER_ID',
      'META_GRAPH_VERSION','META_TEMPLATE_REQUEST_RECEIVED','META_TEMPLATE_LANGUAGE']) delete process.env[key];
    closeCustomerRequestStorage();
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${file}${suffix}`, { force: true });
  }
});

test('manual pilot never sends an automatic enquiry message', async () => {
  const manualFile = join(tmpdir(), `sahaan-manual-enquiry-${randomUUID()}.sqlite`);
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, {
    SAHAAN_INQUIRY_DATA_FILE: manualFile, SAHAAN_NOTIFICATION_MODE: 'manual',
    SAHAAN_WHATSAPP_REQUESTS_ENABLED: '1', META_WHATSAPP_TOKEN: 'test-token',
    META_WHATSAPP_PHONE_NUMBER_ID: '12345', META_GRAPH_VERSION: 'v23.0',
    META_TEMPLATE_REQUEST_RECEIVED: 'sahaan_request_received',
  });
  globalThis.fetch = async () => { throw new Error('Manual pilot must not send WhatsApp'); };
  try {
    const health = await (await handleCustomerRequest(request('health'))).json();
    assert.equal(health.whatsappAvailable, false);
    const saved = await (await handleCustomerRequest(request('', 'POST', {
      ...details, name: 'Manual pilot client', whatsappConsent: true,
    }))).json();
    assert.equal(saved.whatsappUpdate, 'not_queued');
    await drainCustomerRequestNotifications();
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of ['SAHAAN_NOTIFICATION_MODE', 'SAHAAN_WHATSAPP_REQUESTS_ENABLED',
      'META_WHATSAPP_TOKEN', 'META_WHATSAPP_PHONE_NUMBER_ID', 'META_GRAPH_VERSION',
      'META_TEMPLATE_REQUEST_RECEIVED']) delete process.env[key];
    closeCustomerRequestStorage();
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${manualFile}${suffix}`, { force: true });
  }
});
