import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { currencyForCountry, chooseCurrency, formatPrice } from '../lib/price.js';
import { cleanName, badgeHeadline, sharePage } from '../lib/badge.js';
import { handleCheckout } from '../lib/checkout.js';
import { handleGiftCheckout, runDailyGiftJob } from '../lib/gift.js';
import { welcomeEmail, referralLinks } from '../lib/welcome-email.js';
import { giftEmail, giftEndedEmail } from '../lib/gift-emails.js';

const env = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_ID: 'price_123', RESEND_API_KEY: 're_test', SITE_URL: 'https://societyofdaves.com' };

let calls;
let responder;
const realFetch = globalThis.fetch;
beforeEach(() => {
  calls = [];
  responder = () => ({ status: 200, body: { url: 'https://checkout.stripe.com/c/pay/cs_1' } });
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    const { status, body } = responder(url, init);
    return new Response(JSON.stringify(body), { status });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

const post = (url, fields = {}, country) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request(url, { method: 'POST', body: form, headers: country ? { 'x-vercel-ip-country': country } : {} });
};
const sentParams = () => new URLSearchParams(calls[0].body.toString());

test('pounds for the UK and Crown Dependencies, dollars elsewhere', () => {
  for (const c of ['GB', 'gb', 'IM', 'JE', 'GG']) assert.equal(currencyForCountry(c), 'gbp');
  for (const c of ['US', 'IE', 'FR', '', undefined]) assert.equal(currencyForCountry(c), 'usd');
  assert.equal(formatPrice(100, 'gbp'), '£1');
  assert.equal(formatPrice(1200, 'usd'), '$12');
});

test('the currency the page showed wins over the visitor location', () => {
  const form = new FormData();
  form.set('currency', 'usd');
  assert.equal(chooseCurrency(new Request('https://x', { headers: { 'x-vercel-ip-country': 'GB' } }), form), 'usd');
  form.set('currency', 'eur'); // not one we sell in: fall back to location
  assert.equal(chooseCurrency(new Request('https://x', { headers: { 'x-vercel-ip-country': 'GB' } }), form), 'gbp');
});

test('UK membership checkout is charged in pounds and tells the welcome page', async () => {
  await handleCheckout(post('https://societyofdaves.com/api/checkout', {}, 'GB'), env);
  const sent = sentParams();
  assert.equal(sent.get('currency'), 'gbp');
  assert.match(sent.get('success_url'), /\/welcome\?cur=gbp&session_id=/);
});

test('US membership checkout stays in dollars', async () => {
  await handleCheckout(post('https://societyofdaves.com/api/checkout', {}, 'US'), env);
  assert.equal(sentParams().get('currency'), 'usd');
});

test('gift checkout charges £12 for a UK 12-month gift', async () => {
  await handleGiftCheckout(post('https://societyofdaves.com/api/gift-checkout', {
    plan: '12', recipient_email: 'dave@example.com', recipient_name: 'Dave', sender_name: 'Sam', deliver: 'now', currency: 'gbp',
  }), env, new Date('2026-10-27T10:00:00Z'));
  const sent = sentParams();
  assert.equal(sent.get('currency'), 'gbp');
  assert.equal(sent.get('line_items[0][price_data][currency]'), 'gbp');
  assert.equal(sent.get('line_items[0][price_data][unit_amount]'), '1200');
  assert.match(sent.get('success_url'), /plan=12&cur=gbp&/);
});

test('emails quote the member’s own currency', () => {
  const gbp = welcomeEmail({ firstName: 'Dave', manageUrl: 'https://x/api/manage', currency: 'gbp' });
  assert.match(gbp.text, /You're paying £1 a month/);
  assert.match(gbp.text, /Your pound keeps/);
  const usd = welcomeEmail({ firstName: 'Dave', manageUrl: 'https://x/api/manage' });
  assert.match(usd.text, /You're paying \$1 a month/);
  assert.match(giftEndedEmail({ recipientName: 'Dave', siteUrl: 'https://x', currency: 'gbp' }).html, /Join for £1 a month/);
});

test('the daily job invites expired UK gift recipients to join in pounds', async () => {
  const gift = {
    id: 'pi_1', currency: 'gbp',
    metadata: { recipient_email: 'dave@example.com', recipient_name: 'Dave', gift_delivered: 'yes', gift_expired: 'no', gift_ends: '2026-10-01' },
  };
  responder = (url, init) => {
    const u = String(url);
    if (u.includes('/payment_intents/search')) {
      return { status: 200, body: { data: u.includes('gift_delivered%22%5D%3A%22no') || u.includes('gift_delivered"]:"no') ? [] : [gift] } };
    }
    if (u.includes('/payment_intents/pi_1')) return { status: 200, body: gift };
    if (u.includes('/customers/search') || u.includes('/customers?')) return { status: 200, body: { data: [] } };
    return { status: 200, body: { id: 'x', data: [] } };
  };
  const result = await runDailyGiftJob(env, new Date('2026-10-27T07:00:00Z'));
  assert.equal(result.expired, 1);
  const email = calls.find((c) => String(c.url).includes('api.resend.com/emails'));
  assert.ok(email, 'sent the gift-ended email');
  assert.match(JSON.parse(email.body).html, /Join for £1 a month/);
});

test('member emails carry tagged referral links', () => {
  const links = referralLinks('https://societyofdaves.com', 'welcome');
  assert.equal(links.joinUrl, 'https://societyofdaves.com/?utm_source=member&utm_medium=email&utm_campaign=welcome&utm_content=forward');
  assert.match(links.mailto, /^mailto:\?subject=You%20should%20join/);
  assert.match(decodeURIComponent(links.mailto), /utm_campaign=welcome&utm_content=forward/);
  assert.match(welcomeEmail({ firstName: 'Dave', manageUrl: 'https://x' }).html, /Know another Dave\?/);
  const gift = giftEmail({ recipientName: 'Dave', senderName: 'Sam', months: 6, endsOn: '2027-04-27', siteUrl: 'https://societyofdaves.com' });
  assert.match(gift.html, /utm_campaign=gift/);
});

test('badge names are tidied, and share pages escape them', () => {
  assert.equal(cleanName('  Steve\n  Smith  '), 'Steve Smith');
  assert.equal(cleanName('x'.repeat(40)).length, 24);
  assert.equal(badgeHeadline('Steve'), 'Steve is now a Dave');
  assert.equal(badgeHeadline('David'), 'David is already a Dave');
  const html = sharePage('https://societyofdaves.com', '<script>"x"');
  assert.doesNotMatch(html, /<script>"x"/);
  assert.match(html, /og:image" content="https:\/\/societyofdaves\.com\/api\/badge\?name=%3Cscript%3E%22x%22"/);
  assert.match(html, /location\.replace\("\/\?badge=%3Cscript%3E%22x%22#badge"\)/);
});
