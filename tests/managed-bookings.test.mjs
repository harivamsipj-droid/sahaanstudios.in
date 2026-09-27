import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const databaseFile = join(tmpdir(), `sahaan-payment-test-${randomUUID()}.sqlite`);
Object.assign(process.env, {
  SAHAAN_PAYMENTS_ENABLED: '1', SAHAAN_POLICY_APPROVED: '1',
  SAHAAN_DATA_FILE: databaseFile, SAHAAN_ADMIN_TOKEN: 'test_admin_token_longer_than_32_characters',
  RAZORPAY_KEY_ID: 'rzp_test_example', RAZORPAY_KEY_SECRET: 'test_razorpay_secret',
  RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
  META_WHATSAPP_TOKEN: 'test_meta_token', META_WHATSAPP_PHONE_NUMBER_ID: '123456789',
  META_GRAPH_VERSION: 'v99.0', META_TEMPLATE_PAYMENT: 'payment_test',
  META_TEMPLATE_CUSTOMER_ASSIGNED: 'customer_test', META_TEMPLATE_ARTIST_ASSIGNED: 'artist_test',
});

const { handleManagedBooking, closeManagedBookingStorage } = await import('../server/managed-bookings.mjs');
const originalFetch = globalThis.fetch;
const messages = [];
let issuedOrder = '';
let issueAmount = 0;

globalThis.fetch = async (url, options = {}) => {
  const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
  if (target.endsWith('/v1/orders') && options.method === 'POST') {
    const order = JSON.parse(options.body);
    issueAmount = order.amount;
    issuedOrder = 'order_test123';
    return new Response(JSON.stringify({ id: issuedOrder }), { status: 200 });
  }
  if (target.endsWith('/v1/payments/pay_test123')) {
    return new Response(JSON.stringify({ id: 'pay_test123', status: 'captured',
      order_id: issuedOrder, amount: issueAmount, currency: 'INR' }), { status: 200 });
  }
  if (target.includes('graph.facebook.com')) {
    messages.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ messages: [{ id: `wamid.${messages.length}` }] }), { status: 200 });
  }
  throw new Error(`Unexpected outbound request: ${target}`);
};

function request(path, method = 'GET', value, admin = false, signature) {
  const headers = { 'content-type': 'application/json' };
  if (admin) headers.authorization = `Bearer ${process.env.SAHAAN_ADMIN_TOKEN}`;
  if (signature) headers['x-razorpay-signature'] = signature;
  const options = { method, headers };
  if (value !== undefined) options.body = JSON.stringify(value);
  return new Request(`https://sahaanstudios.in/api/managed-bookings${path}`, options);
}

async function call(path, method = 'GET', value, admin = false, signature) {
  const response = await handleManagedBooking(request(path, method, value, admin, signature));
  return { code: response.status, data: await response.json() };
}

test('managed payment is captured before artist assignment and handles duplicate webhooks', async () => {
  try {
    assert.equal((await call('/health')).data.enabled, true);
    assert.equal((await call('/admin/quotes')).code, 401);
    const details = {
      customerName: 'Test Client', customerPhone: '919876543210', service: 'Gel polish',
      scope: 'Gel polish on natural nails', serviceAddress: 'Test address, Hyderabad',
      appointmentWindow: '1 October, 2–4 pm', servicePaise: 59900, travelPaise: 10000,
      extrasPaise: 0, taxPaise: 0,
    };
    assert.equal((await call('/admin/quotes', 'POST', details, true)).code, 400);
    const created = await call('/admin/quotes', 'POST', { ...details, coverageConfirmed: true }, true);
    assert.equal(created.code, 201);
    const token = new URL(created.data.checkoutUrl).pathname.split('/').pop();
    const quote = await call(`/quote?token=${token}`);
    assert.equal(quote.data.totalPaise, 69900);
    assert.equal(quote.data.status, 'quoted');
    assert.equal((await call('/order', 'POST', { token, consent: false })).code, 400);
    const order = await call('/order', 'POST', { token, consent: true });
    assert.equal(order.data.amount, 69900);
    assert.equal(order.data.orderId, issuedOrder);
    assert.equal((await call('/verify', 'POST', { token, orderId: issuedOrder,
      paymentId: 'pay_test123', signature: 'wrong' })).code, 400);
    const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${issuedOrder}|pay_test123`).digest('hex');
    const verified = await call('/verify', 'POST', { token, orderId: issuedOrder,
      paymentId: 'pay_test123', signature });
    assert.equal(verified.data.status, 'paid_unassigned');
    assert.equal(messages.length, 1);
    assert.equal((await call('/admin/assign', 'POST', { reference: created.data.reference,
      artistName: 'Test Artist', artistPhone: '919876543211' }, true)).code, 400);
    const assignment = await call('/admin/assign', 'POST', { reference: created.data.reference,
      artistName: 'Test Artist', artistPhone: '919876543211', artistConsented: true }, true);
    assert.equal(assignment.data.status, 'assigned');
    assert.equal(messages.length, 3);
    const webhook = { event: 'payment.captured', payload: { payment: { entity: {
      id: 'pay_test123', status: 'captured', order_id: issuedOrder, amount: 69900, currency: 'INR',
    } } } };
    const raw = JSON.stringify(webhook);
    const webhookSignature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    assert.equal((await call('/webhook', 'POST', webhook, false, 'wrong')).code, 401);
    assert.equal((await call('/webhook', 'POST', webhook, false, webhookSignature)).code, 200);
    assert.equal(messages.length, 3);
    const refund = { event: 'refund.processed', payload: { refund: { entity: {
      payment_id: 'pay_test123', status: 'processed', amount: 69900,
    } } } };
    const refundSignature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(refund)).digest('hex');
    assert.equal((await call('/webhook', 'POST', refund, false, refundSignature)).code, 200);
    assert.equal((await call(`/quote?token=${token}`)).data.status, 'refunded');
  } finally {
    closeManagedBookingStorage();
    globalThis.fetch = originalFetch;
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
  }
});
