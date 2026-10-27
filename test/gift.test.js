import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGiftForm, nextChristmas, addMonths, handleGiftCheckout, handleGiftPaid, runDailyGiftJob, handleDailyCron,
} from '../lib/gift.js';
import { giftEmail } from '../lib/gift-emails.js';

const env = {
  STRIPE_SECRET_KEY: 'sk_test_x', RESEND_API_KEY: 're_test', SITE_URL: 'https://societyofdaves.com', CRON_SECRET: 's3cret',
};
const NOW = new Date('2026-10-26T10:00:00Z');

let calls;
let responder;
const realFetch = globalThis.fetch;
beforeEach(() => {
  calls = [];
  responder = () => ({ status: 200, body: {} });
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', headers: init.headers, body: init.body });
    const { status, body } = responder(url, init);
    return new Response(JSON.stringify(body), { status });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

const form = (fields) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const validGift = {
  plan: '12', recipient_email: 'Dave@Example.com', recipient_name: 'Dave', sender_name: 'Sam',
  message: 'Happy Christmas', deliver: 'christmas',
};

test('dates: next Christmas rolls over after the 25th, months add correctly', () => {
  assert.equal(nextChristmas(new Date('2026-10-26T00:00:00Z')), '2026-12-25');
  assert.equal(nextChristmas(new Date('2026-12-25T09:00:00Z')), '2026-12-25');
  assert.equal(nextChristmas(new Date('2026-12-26T00:00:00Z')), '2027-12-25');
  assert.equal(addMonths('2026-12-25', 12), '2027-12-25');
  assert.equal(addMonths('2026-12-25', 6), '2027-06-25');
});

test('parseGiftForm accepts a Christmas gift and normalises the email', () => {
  const { gift, error } = parseGiftForm(form(validGift), NOW);
  assert.equal(error, undefined);
  assert.equal(gift.recipientEmail, 'dave@example.com');
  assert.equal(gift.deliverOn, '2026-12-25');
  assert.equal(gift.endsOn, '2027-12-25');
  assert.equal(gift.plan.amount, 1200);
});

test('parseGiftForm rejects bad input with a useful message', () => {
  assert.equal(parseGiftForm(form({ ...validGift, plan: '99' }), NOW).error, 'plan');
  assert.equal(parseGiftForm(form({ ...validGift, recipient_email: 'nope' }), NOW).error, 'recipient_email');
  assert.equal(parseGiftForm(form({ ...validGift, sender_name: '' }), NOW).error, 'sender_name');
  assert.equal(parseGiftForm(form({ ...validGift, deliver: 'date', deliver_date: '2026-01-01' }), NOW).error, 'deliver_date');
  assert.equal(parseGiftForm(form({ ...validGift, deliver: 'date', deliver_date: '2026-11-05' }), NOW).gift.deliverOn, '2026-11-05');
});

test('gift checkout creates a one-off payment with the gift in PaymentIntent metadata', async () => {
  responder = () => ({ status: 200, body: { url: 'https://checkout.stripe.com/c/pay/cs_g' } });
  const req = new Request('https://x/api/gift-checkout', { method: 'POST', body: form({ ...validGift, gclid: 'g1' }) });
  const res = await handleGiftCheckout(req, env, NOW);
  assert.equal(res.headers.get('location'), 'https://checkout.stripe.com/c/pay/cs_g');
  const sent = new URLSearchParams(calls[0].body.toString());
  assert.equal(sent.get('mode'), 'payment');
  assert.equal(sent.get('line_items[0][price_data][unit_amount]'), '1200');
  assert.equal(sent.get('metadata[kind]'), 'gift');
  assert.equal(sent.get('payment_intent_data[metadata][recipient_email]'), 'dave@example.com');
  assert.equal(sent.get('payment_intent_data[metadata][deliver_on]'), '2026-12-25');
  assert.equal(sent.get('payment_intent_data[metadata][gift_delivered]'), 'no');
  assert.equal(sent.get('payment_intent_data[metadata][gclid]'), 'g1');
});

test('gift checkout uses the configured Stripe price when there is one', async () => {
  responder = () => ({ status: 200, body: { url: 'https://checkout.stripe.com/c/pay/cs_g' } });
  const req = new Request('https://x/api/gift-checkout', { method: 'POST', body: form({ ...validGift, plan: '6' }) });
  await handleGiftCheckout(req, { ...env, STRIPE_GIFT_PRICE_6: 'price_gift6' }, NOW);
  const sent = new URLSearchParams(calls[0].body.toString());
  assert.equal(sent.get('line_items[0][price]'), 'price_gift6');
  assert.equal(sent.get('line_items[0][price_data][unit_amount]'), null);
});

test('invalid gift form goes back to the form with the error, without calling Stripe', async () => {
  const req = new Request('https://x/api/gift-checkout', { method: 'POST', body: form({ ...validGift, recipient_email: 'x' }) });
  const res = await handleGiftCheckout(req, env, NOW);
  assert.match(res.headers.get('location'), /\/gift\?error=.*#gift-form$/);
  assert.equal(calls.length, 0);
});

const pi = (meta) => ({
  id: 'pi_1',
  metadata: {
    kind: 'gift', plan_months: '12', recipient_email: 'dave@example.com', recipient_name: 'Dave',
    sender_name: 'Sam', message: 'Hi', gift_delivered: 'no', gift_expired: 'no',
    deliver_on: '2026-12-25', gift_ends: '2027-12-25', ...meta,
  },
});

test('a Christmas gift paid in October only sends the buyer confirmation', async () => {
  responder = (url) => (url.includes('/payment_intents/pi_1') ? { status: 200, body: pi() } : { status: 200, body: {} });
  await handleGiftPaid(env, { id: 'cs_1', payment_intent: 'pi_1', customer_details: { email: 'sam@example.com' } }, NOW);
  const emails = calls.filter((c) => c.url.endsWith('/emails'));
  assert.equal(emails.length, 1);
  assert.equal(JSON.parse(emails[0].body).to, 'sam@example.com');
  assert.match(JSON.parse(emails[0].body).text, /25 December 2026/);
  assert.equal(calls.some((c) => c.url.endsWith('/contacts')), false);
});

test('a "send now" gift is delivered straight away and marked delivered', async () => {
  responder = (url) => (url.includes('/payment_intents/pi_1')
    ? { status: 200, body: pi({ deliver_on: '2026-10-26' }) } : { status: 200, body: {} });
  await handleGiftPaid(env, { id: 'cs_1', payment_intent: 'pi_1', customer_details: { email: 'sam@example.com' } }, NOW);
  assert.ok(calls.some((c) => c.url.endsWith('/contacts')));
  const giftSend = calls.find((c) => c.url.endsWith('/emails') && JSON.parse(c.body).to === 'dave@example.com');
  assert.equal(giftSend.headers['Idempotency-Key'], 'gift-pi_1');
  const mark = calls.find((c) => c.method === 'POST' && c.url.endsWith('/payment_intents/pi_1'));
  assert.equal(new URLSearchParams(mark.body.toString()).get('metadata[gift_delivered]'), 'yes');
});

test('daily job delivers due gifts, skips future ones, and ends expired ones', async () => {
  const XMAS = new Date('2026-12-25T07:00:00Z');
  responder = (url, init) => {
    const u = decodeURIComponent(url);
    if (u.includes('/payment_intents/search') && u.includes('gift_delivered"]:"no"')) {
      return { status: 200, body: { data: [pi({ deliver_on: '2026-12-25' }), { ...pi({ deliver_on: '2027-01-10' }), id: 'pi_future' }] } };
    }
    if (u.includes('/payment_intents/search')) {
      return { status: 200, body: { data: [{ ...pi({ gift_delivered: 'yes', gift_ends: '2026-12-01' }), id: 'pi_old' }] } };
    }
    if (u.includes('/payment_intents/pi_old') && (init.method || 'GET') === 'GET') {
      return { status: 200, body: { ...pi({ gift_delivered: 'yes', gift_ends: '2026-12-01' }), id: 'pi_old' } };
    }
    if (u.includes('/payment_intents/pi_1')) return { status: 200, body: pi() };
    if (u.includes('/customers/search')) return { status: 200, body: { data: [] } };
    return { status: 200, body: {} };
  };
  const result = await runDailyGiftJob(env, XMAS);
  assert.deepEqual(result, { delivered: 1, expired: 1, remaining: 0 });
  assert.equal(calls.some((c) => c.url.includes('pi_future') && c.method === 'POST'), false);
  const unsub = calls.find((c) => c.method === 'PATCH');
  assert.equal(JSON.parse(unsub.body).unsubscribed, true);
});

test('daily job keeps a gift recipient who has since become a paying member', async () => {
  responder = (url) => {
    const u = decodeURIComponent(url);
    if (u.includes('gift_delivered"]:"no"')) return { status: 200, body: { data: [] } };
    if (u.includes('/payment_intents/search')) return { status: 200, body: { data: [pi({ gift_delivered: 'yes', gift_ends: '2026-01-01' })] } };
    if (u.includes('/payment_intents/pi_1')) return { status: 200, body: pi({ gift_delivered: 'yes', gift_ends: '2026-01-01' }) };
    if (u.includes('/customers/search')) return { status: 200, body: { data: [{ id: 'cus_1' }] } };
    if (u.includes('/subscriptions')) return { status: 200, body: { data: [{ id: 'sub_1' }] } };
    return { status: 200, body: {} };
  };
  const result = await runDailyGiftJob(env, NOW);
  assert.equal(result.expired, 1);
  assert.equal(calls.some((c) => c.method === 'PATCH'), false);
});

test('daily cron endpoint requires the secret', async () => {
  const res = await handleDailyCron(new Request('https://x/api/cron/daily', { method: 'POST' }), env);
  assert.equal(res.status, 401);
});

test('gift email escapes the personal message and only says Merry Christmas in December', () => {
  const base = { recipientName: 'Steve', senderName: 'Sam', message: '<script>x</script>', months: 12, endsOn: '2027-12-25', siteUrl: 'https://s' };
  const xmas = giftEmail({ ...base, festive: true });
  assert.doesNotMatch(xmas.html, /<script>x/);
  assert.match(xmas.html, /HO HO HO/);
  assert.match(xmas.text, /you are now Dave/);
  assert.doesNotMatch(giftEmail(base).text, /Merry Christmas/);
});
