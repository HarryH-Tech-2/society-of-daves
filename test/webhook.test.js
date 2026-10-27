import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { verifyStripeEvent, signStripePayload, toFormBody } from '../lib/stripe.js';
import { handleStripeWebhook } from '../lib/webhook.js';
import { handleCheckout } from '../lib/checkout.js';
import { welcomeEmail, isDave } from '../lib/welcome-email.js';

const SECRET = 'whsec_test';
const env = {
  STRIPE_WEBHOOK_SECRET: SECRET,
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_PRICE_ID: 'price_123',
  RESEND_API_KEY: 're_test',
  RESEND_SEGMENT_ID: 'seg_1',
  SITE_URL: 'https://societyofdaves.com',
};

let calls;
let responder;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  responder = () => ({ status: 200, body: {} });
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const { status, body } = responder(url, init);
    return new Response(JSON.stringify(body), { status });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

async function signedRequest(event) {
  const raw = JSON.stringify(event);
  const sig = await signStripePayload(raw, SECRET, Math.floor(Date.now() / 1000));
  return new Request('https://x/api/stripe-webhook', { method: 'POST', body: raw, headers: { 'stripe-signature': sig } });
}

test('verifyStripeEvent accepts a valid signature and rejects tampering', async () => {
  const raw = '{"id":"evt_1"}';
  const header = await signStripePayload(raw, SECRET, 1000);
  assert.equal((await verifyStripeEvent(raw, header, SECRET, 1000)).id, 'evt_1');
  await assert.rejects(verifyStripeEvent('{"id":"evt_2"}', header, SECRET, 1000), /mismatch/);
  await assert.rejects(verifyStripeEvent(raw, header, SECRET, 2000), /tolerance/);
  await assert.rejects(verifyStripeEvent(raw, null, SECRET, 1000), /Missing/);
});

test('toFormBody flattens nested params the way Stripe expects', () => {
  const body = toFormBody({ line_items: [{ price: 'p', quantity: 1 }], metadata: {}, skip: undefined });
  assert.equal(body.toString(), 'line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1');
});

test('webhook rejects unsigned requests', async () => {
  const res = await handleStripeWebhook(new Request('https://x', { method: 'POST', body: '{}' }), env);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('completed checkout adds the member to Resend and sends a welcome email', async () => {
  const req = await signedRequest({
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_1', mode: 'subscription',
      customer_details: { email: 'dave@example.com', name: 'Dave Smith' },
      custom_fields: [{ key: 'first_name', text: { value: 'Dave' } }],
    } },
  });
  const res = await handleStripeWebhook(req, env);
  assert.equal(res.status, 200);

  const contact = calls.find((c) => c.url.endsWith('/contacts'));
  assert.deepEqual(JSON.parse(contact.body), {
    email: 'dave@example.com', first_name: 'Dave', unsubscribed: false, segments: [{ id: 'seg_1' }],
  });
  const email = calls.find((c) => c.url.endsWith('/emails'));
  assert.equal(JSON.parse(email.body).to, 'dave@example.com');
  assert.equal(email.headers['Idempotency-Key'], 'welcome-cs_1');
});

test('a returning member who is already a contact gets re-subscribed', async () => {
  responder = (url, init) => (url.endsWith('/contacts') && init.method === 'POST'
    ? { status: 422, body: { message: 'exists' } }
    : { status: 200, body: {} });
  const req = await signedRequest({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_2', mode: 'subscription', customer_details: { email: 'dave@example.com' } } },
  });
  assert.equal((await handleStripeWebhook(req, env)).status, 200);
  const patch = calls.find((c) => c.method === 'PATCH');
  assert.match(patch.url, /\/contacts\/dave%40example\.com$/);
  assert.equal(JSON.parse(patch.body).unsubscribed, false);
});

test('cancelled subscription unsubscribes the member', async () => {
  responder = (url) => (url.includes('api.stripe.com')
    ? { status: 200, body: { email: 'dave@example.com', data: [] } }
    : { status: 200, body: {} });
  const req = await signedRequest({ type: 'customer.subscription.deleted', data: { object: { customer: 'cus_1' } } });
  assert.equal((await handleStripeWebhook(req, env)).status, 200);
  assert.match(calls[0].url, /\/v1\/customers\/cus_1$/);
  assert.match(calls[1].url, /\/payment_intents\/search/);
  assert.equal(JSON.parse(calls[2].body).unsubscribed, true);
});

test('cancelled member with an active gift membership stays on the list', async () => {
  responder = (url) => (url.includes('api.stripe.com')
    ? { status: 200, body: { email: 'dave@example.com', data: [{ metadata: { gift_delivered: 'yes' } }] } }
    : { status: 200, body: {} });
  const req = await signedRequest({ type: 'customer.subscription.deleted', data: { object: { customer: 'cus_1' } } });
  assert.equal((await handleStripeWebhook(req, env)).status, 200);
  assert.equal(calls.some((c) => c.url.includes('resend')), false);
});

test('completed gift checkout is routed to gift handling, not the subscription welcome', async () => {
  responder = (url) => (url.includes('/payment_intents/')
    ? { status: 200, body: { id: 'pi_1', metadata: { recipient_email: 'd@example.com', recipient_name: 'Dave', plan_months: '12', deliver_on: '2099-12-25', gift_delivered: 'no' } } }
    : { status: 200, body: {} });
  const req = await signedRequest({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_g', mode: 'payment', metadata: { kind: 'gift' }, payment_intent: 'pi_1', customer_details: { email: 'buyer@example.com' } } },
  });
  assert.equal((await handleStripeWebhook(req, env)).status, 200);
  const emails = calls.filter((c) => c.url.endsWith('/emails'));
  assert.equal(emails.length, 1);
  assert.equal(JSON.parse(emails[0].body).to, 'buyer@example.com');
  assert.match(JSON.parse(emails[0].body).subject, /gift/);
});

test('Resend failure returns an error so Stripe retries', async () => {
  responder = (url) => (url.includes('resend') ? { status: 500, body: {} } : { status: 200, body: {} });
  const req = await signedRequest({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_3', mode: 'subscription', customer_details: { email: 'd@example.com' } } },
  });
  await assert.rejects(handleStripeWebhook(req, env));
});

test('checkout creates a subscription session and passes ad tracking through', async () => {
  responder = () => ({ status: 200, body: { url: 'https://checkout.stripe.com/c/pay/cs_1' } });
  const form = new FormData();
  form.set('gclid', 'abc123');
  const res = await handleCheckout(new Request('https://societyofdaves.com/api/checkout', { method: 'POST', body: form }), env);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), 'https://checkout.stripe.com/c/pay/cs_1');
  const sent = new URLSearchParams(calls[0].body.toString());
  assert.equal(sent.get('mode'), 'subscription');
  assert.equal(sent.get('line_items[0][price]'), 'price_123');
  assert.equal(sent.get('metadata[gclid]'), 'abc123');
  assert.equal(sent.get('subscription_data[metadata][gclid]'), 'abc123');
});

test('checkout failure sends the visitor back with an error flag', async () => {
  responder = () => ({ status: 400, body: { error: { message: 'No such price' } } });
  const orig = console.error; console.error = () => {};
  const res = await handleCheckout(new Request('https://x/api/checkout', { method: 'POST' }), env);
  console.error = orig;
  assert.equal(res.headers.get('location'), 'https://societyofdaves.com/?checkout=error#join');
});

test('welcome email greets non-Daves as honorary Daves and escapes names', () => {
  assert.ok(isDave('David') && isDave(' dave ') && !isDave('Steve'));
  assert.match(welcomeEmail({ firstName: '', manageUrl: 'u' }).text, /^Welcome, Dave\./);
  assert.match(welcomeEmail({ firstName: 'Steve', manageUrl: 'u' }).text, /you are now Dave/);
  assert.doesNotMatch(welcomeEmail({ firstName: '<b>x</b>', manageUrl: 'u' }).html, /<b>x<\/b>/);
});
