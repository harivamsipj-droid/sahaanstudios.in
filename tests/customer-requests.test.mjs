import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const file = join(tmpdir(), `sahaan-customer-request-${randomUUID()}.sqlite`);
process.env.SAHAAN_INQUIRY_DATA_FILE = file;
process.env.SAHAAN_ADMIN_TOKEN = 'test-admin-token-with-at-least-32-characters';
const { handleCustomerRequest, closeCustomerRequestStorage } = await import('../server/customer-requests.mjs');
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
