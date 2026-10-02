import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { manualConfirmationDeadline } from '../lib/manual-booking-window.mjs';

const databaseFile = join(tmpdir(), `sahaan-payment-test-${randomUUID()}.sqlite`);
process.env.NODE_ENV = 'test';
Object.assign(process.env, {
  SAHAAN_PAYMENTS_ENABLED: '1', SAHAAN_POLICY_APPROVED: '1',
  SAHAAN_DATA_FILE: databaseFile, SAHAAN_ADMIN_TOKEN: 'test_admin_token_longer_than_32_characters',
  RAZORPAY_KEY_ID: 'rzp_test_example', RAZORPAY_KEY_SECRET: 'test_razorpay_secret',
  RAZORPAY_LIVE_KEY_ID: 'rzp_live_example', RAZORPAY_LIVE_KEY_SECRET: 'live_razorpay_secret',
  RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
  RAZORPAY_LIVE_WEBHOOK_SECRET: 'live_webhook_secret_longer_than_32_chars',
  META_WHATSAPP_TOKEN: 'test_meta_token', META_WHATSAPP_PHONE_NUMBER_ID: '123456789',
  META_GRAPH_VERSION: 'v99.0', META_TEMPLATE_PAYMENT: 'payment_test',
  META_TEMPLATE_CUSTOMER_ASSIGNED: 'customer_test', META_TEMPLATE_ARTIST_ASSIGNED: 'artist_test',
});

const { handleManagedBooking, closeManagedBookingStorage, enableSqliteBookingStorageForTests } = await import('../server/managed-bookings.mjs');
enableSqliteBookingStorageForTests();
const originalFetch = globalThis.fetch;
const messages = [];
let issuedOrder = '';
let issueAmount = 0;

globalThis.fetch = async (url, options = {}) => {
  const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
  if (target.endsWith('/v1/orders') && options.method === 'POST') {
    assert.equal(options.headers.authorization,
      `Basic ${Buffer.from('rzp_live_example:live_razorpay_secret').toString('base64')}`);
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
      appointmentWindow: '1 October, 2–4 pm', servicePaise: 49900, travelPaise: 10000,
      extrasPaise: 0, taxPaise: 0,
    };
    assert.equal((await call('/admin/quotes', 'POST', details, true)).code, 400);
    assert.equal((await call('/admin/quotes', 'POST', { ...details, coverageConfirmed: true, travelPaise: 20000 }, true)).code, 400);
    const created = await call('/admin/quotes', 'POST', { ...details, coverageConfirmed: true }, true);
    assert.equal(created.code, 201);
    const token = new URL(created.data.checkoutUrl).pathname.split('/').pop();
    const quote = await call(`/quote?token=${token}`);
    assert.equal(quote.data.totalPaise, 59900);
    assert.equal(quote.data.status, 'quoted');
    assert.equal((await call('/order', 'POST', { token, consent: false })).code, 400);
    const order = await call('/order', 'POST', { token, consent: true });
    assert.equal(order.data.amount, 59900);
    assert.equal(order.data.keyId, process.env.RAZORPAY_LIVE_KEY_ID);
    assert.equal(order.data.orderId, issuedOrder);
    assert.equal((await call('/verify', 'POST', { token, orderId: issuedOrder,
      paymentId: 'pay_test123', signature: 'wrong' })).code, 400);
    const signature = createHmac('sha256', process.env.RAZORPAY_LIVE_KEY_SECRET)
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
      id: 'pay_test123', status: 'captured', order_id: issuedOrder, amount: 59900, currency: 'INR',
    } } } };
    const raw = JSON.stringify(webhook);
    const webhookSignature = createHmac('sha256', process.env.RAZORPAY_LIVE_WEBHOOK_SECRET).update(raw).digest('hex');
    const testWebhookSignature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    assert.equal((await call('/webhook', 'POST', webhook, false, 'wrong')).code, 401);
    assert.equal((await call('/webhook', 'POST', webhook, false, testWebhookSignature)).code, 401);
    assert.equal((await call('/webhook', 'POST', webhook, false, webhookSignature)).code, 200);
    assert.equal(messages.length, 3);
    const refund = { event: 'refund.processed', payload: { refund: { entity: {
      payment_id: 'pay_test123', status: 'processed', amount: 59900,
    } } } };
    const refundSignature = createHmac('sha256', process.env.RAZORPAY_LIVE_WEBHOOK_SECRET)
      .update(JSON.stringify(refund)).digest('hex');
    assert.equal((await call('/webhook', 'POST', refund, false, refundSignature)).code, 200);
    assert.equal((await call(`/quote?token=${token}`)).data.status, 'refunded');
  } finally {
    closeManagedBookingStorage();
    globalThis.fetch = originalFetch;
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
  }
});

test('test mode accepts only fictional bookings and sends no WhatsApp messages', async () => {
  const testFile = join(tmpdir(), `sahaan-payment-simulation-${randomUUID()}.sqlite`);
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, {
    SAHAAN_PAYMENT_TEST_MODE: '1', SAHAAN_DATA_FILE: testFile,
    RAZORPAY_KEY_ID: 'rzp_test_example',
  });
  delete process.env.META_WHATSAPP_TOKEN;
  delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  let amount = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    if (target.endsWith('/v1/orders')) {
      amount = JSON.parse(options.body).amount;
      return new Response(JSON.stringify({ id: 'order_sim123' }), { status: 200 });
    }
    if (target.endsWith('/v1/payments/pay_sim123')) {
      return new Response(JSON.stringify({ id: 'pay_sim123', status: 'captured',
        order_id: 'order_sim123', amount, currency: 'INR' }), { status: 200 });
    }
    throw new Error(`Test mode must not call ${target}`);
  };
  try {
    assert.deepEqual((await call('/health')).data, { enabled: true, testMode: true, manualPilot: false, paymentsOpen: true });
    const standby = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_live_unmatched' } } } };
    const standbySignature = createHmac('sha256', process.env.RAZORPAY_LIVE_WEBHOOK_SECRET)
      .update(JSON.stringify(standby)).digest('hex');
    assert.deepEqual((await call('/webhook', 'POST', standby, false, standbySignature)).data,
      { ok: true, standby: true });
    const details = {
      customerName: 'TEST Customer', customerPhone: '919999999999', service: 'Gel polish',
      scope: 'Synthetic test', serviceAddress: 'TEST address, Hyderabad',
      appointmentWindow: 'Test date', servicePaise: 49900, travelPaise: 0,
      extrasPaise: 0, taxPaise: 0, coverageConfirmed: true,
    };
    assert.equal((await call('/admin/quotes', 'POST', { ...details, customerPhone: '919876543210' }, true)).code, 400);
    const created = await call('/admin/quotes', 'POST', details, true);
    assert.equal(created.code, 201);
    const quoteToken = new URL(created.data.checkoutUrl).pathname.split('/').pop();
    assert.equal((await call(`/quote?token=${quoteToken}`)).data.testMode, true);
    const order = await call('/order', 'POST', { token: quoteToken, consent: true });
    assert.equal(order.code, 200);
    const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update('order_sim123|pay_sim123').digest('hex');
    const verified = await call('/verify', 'POST', { token: quoteToken, orderId: 'order_sim123',
      paymentId: 'pay_sim123', signature });
    assert.equal(verified.data.status, 'paid_unassigned');
    assert.equal((await call('/admin/assign', 'POST', { reference: created.data.reference,
      artistName: 'TEST Artist', artistPhone: '919876543210', artistConsented: true }, true)).code, 400);
    assert.equal((await call('/admin/assign', 'POST', { reference: created.data.reference,
      artistName: 'TEST Artist', artistPhone: '919999999998', artistConsented: true }, true)).code, 200);
    const admin = await call('/admin/quotes', 'GET', undefined, true);
    assert.equal(admin.data.notifications.length, 0);
  } finally {
    closeManagedBookingStorage();
    globalThis.fetch = previousFetch;
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${testFile}${suffix}`, { force: true });
  }
});

test('manual pilot tracks human WhatsApp confirmations without calling Meta', async () => {
  const manualFile = join(tmpdir(), `sahaan-manual-pilot-${randomUUID()}.sqlite`);
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, {
    SAHAAN_PAYMENT_TEST_MODE: '0', SAHAAN_NOTIFICATION_MODE: 'manual', SAHAAN_MANUAL_PILOT_END: '2099-12-31',
    SAHAAN_DATA_FILE: manualFile, RAZORPAY_KEY_ID: 'rzp_test_example',
  });
  let amount = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    if (target.endsWith('/v1/orders')) {
      amount = JSON.parse(options.body).amount;
      return new Response(JSON.stringify({ id: 'order_manual123' }), { status: 200 });
    }
    if (target.endsWith('/v1/payments/pay_manual123')) {
      return new Response(JSON.stringify({ id: 'pay_manual123', status: 'captured',
        order_id: 'order_manual123', amount, currency: 'INR' }), { status: 200 });
    }
    throw new Error(`Manual pilot must not call ${target}`);
  };
  try {
    const health = await call('/health');
    assert.equal(health.data.manualPilot, true);
    assert.equal(health.data.paymentsOpen, true);
    const details = {
      customerName: 'Pilot Customer', customerPhone: '919876543210', service: 'Gel polish',
      scope: 'Gel polish on natural nails', serviceAddress: 'Hyderabad appointment address',
      appointmentWindow: '2 October, 2–4 pm', servicePaise: 49900, travelPaise: 10000,
      extrasPaise: 0, taxPaise: 0, coverageConfirmed: true,
    };
    const created = await call('/admin/quotes', 'POST', details, true);
    assert.equal(created.code, 201);
    const token = new URL(created.data.checkoutUrl).pathname.split('/').pop();
    const quote = await call(`/quote?token=${token}`);
    assert.equal(quote.data.manualPilot, true);
    const order = await call('/order', 'POST', { token, consent: true });
    assert.equal(order.code, 200);
    assert.equal(order.data.keyId, process.env.RAZORPAY_LIVE_KEY_ID);
    const signature = createHmac('sha256', process.env.RAZORPAY_LIVE_KEY_SECRET)
      .update('order_manual123|pay_manual123').digest('hex');
    const verified = await call('/verify', 'POST', { token, orderId: 'order_manual123',
      paymentId: 'pay_manual123', signature });
    assert.equal(verified.data.status, 'paid_unassigned');
    assert.ok(verified.data.confirmationBy);
    assert.equal((await call('/admin/quotes', 'GET', undefined, true)).data.notifications.length, 0);
    const assignment = await call('/admin/assign', 'POST', { reference: created.data.reference,
      artistName: 'Pilot Artist', artistPhone: '919876543211', artistConsented: true }, true);
    assert.equal(assignment.data.status, 'assigned');
    let admin = await call('/admin/quotes', 'GET', undefined, true);
    assert.equal(admin.data.notifications.length, 2);
    assert.ok(admin.data.notifications.every((notice) => notice.state === 'manual_pending'));
    assert.equal((await call('/admin/notifications/manual-sent', 'POST', {
      reference: created.data.reference, kind: 'assigned_customer', sentConfirmed: false,
    }, true)).code, 400);
    assert.equal((await call('/admin/notifications/manual-sent', 'POST', {
      reference: created.data.reference, kind: 'assigned_customer', sentConfirmed: true,
    }, true)).code, 200);
    assert.equal((await call('/admin/notifications/manual-sent', 'POST', {
      reference: created.data.reference, kind: 'assigned_customer', sentConfirmed: true,
    }, true)).code, 409);
    admin = await call('/admin/quotes', 'GET', undefined, true);
    assert.equal(admin.data.notifications.find((notice) => notice.kind === 'assigned_customer').state, 'manual_sent');
    assert.ok(admin.data.notifications.find((notice) => notice.kind === 'assigned_customer').sent_at);
    process.env.SAHAAN_MANUAL_PILOT_END = '2020-01-01';
    assert.equal((await call('/health')).data.paymentsOpen, false);
    assert.equal((await call('/admin/quotes', 'POST', details, true)).code, 409);
    assert.equal((await call('/order', 'POST', { token, consent: true })).code, 409);
    assert.equal((await call('/admin/quotes', 'GET', undefined, true)).code, 200);
  } finally {
    closeManagedBookingStorage();
    globalThis.fetch = previousFetch;
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${manualFile}${suffix}`, { force: true });
  }
});

test('two staffed hours pause at 11 pm IST and resume at 10 am', () => {
  assert.equal(manualConfirmationDeadline('2026-10-01T15:00:00.000Z'), '2026-10-01T17:00:00.000Z');
  assert.equal(manualConfirmationDeadline('2026-10-01T17:00:00.000Z'), '2026-10-02T06:00:00.000Z');
  assert.equal(manualConfirmationDeadline('2026-10-01T19:00:00.000Z'), '2026-10-02T06:30:00.000Z');
});

test('live mode fails closed when the separate live key pair is incomplete', async () => {
  const liveSecret = process.env.RAZORPAY_LIVE_KEY_SECRET;
  try {
    process.env.SAHAAN_PAYMENT_TEST_MODE = '0';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_legacy_key_must_not_be_used';
    delete process.env.RAZORPAY_LIVE_KEY_SECRET;
    assert.deepEqual((await call('/health')).data, { enabled: false, testMode: false });
  } finally {
    process.env.RAZORPAY_LIVE_KEY_SECRET = liveSecret;
  }
});
