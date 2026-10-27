// Gift memberships: a one-off payment that gives someone The Dave Dispatch
// for 6 or 12 months, delivered on Christmas Day, straight away, or on a
// chosen date.
//
// There's no database. Each gift lives in the metadata of its Stripe
// PaymentIntent, and a daily job (/api/cron/daily) delivers gifts that are
// due and ends gifts that have run out.

import { stripeRequest } from './stripe.js';
import { subscribeContact, unsubscribeContact, sendEmail } from './resend.js';
import { giftEmail, giftConfirmationEmail, giftEndedEmail } from './gift-emails.js';

export const GIFT_PLANS = {
  6: { months: 6, amount: 600, label: '6 months' },
  12: { months: 12, amount: 1200, label: '12 months' },
};

const TRACKING_FIELDS = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDate = (d) => d.toISOString().slice(0, 10);

export function addMonths(isoDay, months) {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoDate(d);
}

// Christmas Day this year, or next year once this year's has passed.
export function nextChristmas(now = new Date()) {
  const year = now.getUTCFullYear();
  const thisYear = `${year}-12-25`;
  return isoDate(now) <= thisYear ? thisYear : `${year + 1}-12-25`;
}

const clean = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

// Checks the gift form and works out the delivery date.
// Returns { gift } or { error } with the name of the field to fix. The gift
// page turns that code into a message, so no text from the URL is shown.
export function parseGiftForm(form, now = new Date()) {
  const plan = GIFT_PLANS[String(form.get('plan'))];
  if (!plan) return { error: 'plan' };

  const recipientEmail = clean(form.get('recipient_email'), 200).toLowerCase();
  if (!EMAIL_RE.test(recipientEmail)) return { error: 'recipient_email' };

  const recipientName = clean(form.get('recipient_name'), 60);
  if (!recipientName) return { error: 'recipient_name' };

  const senderName = clean(form.get('sender_name'), 60);
  if (!senderName) return { error: 'sender_name' };

  // Metadata values are capped at 500 characters; keep well under.
  const message = String(form.get('message') ?? '').trim().slice(0, 300);

  const today = isoDate(now);
  const when = String(form.get('deliver'));
  let deliverOn;
  if (when === 'christmas') deliverOn = nextChristmas(now);
  else if (when === 'now') deliverOn = today;
  else if (when === 'date') {
    deliverOn = String(form.get('deliver_date') || '');
    if (!DATE_RE.test(deliverOn) || deliverOn < today || deliverOn > addMonths(today, 12)) {
      return { error: 'deliver_date' };
    }
  } else return { error: 'deliver' };

  return {
    gift: {
      plan, recipientEmail, recipientName, senderName, message, deliverOn,
      endsOn: addMonths(deliverOn, plan.months),
    },
  };
}

export async function handleGiftCheckout(request, env, now = new Date()) {
  const siteUrl = env.SITE_URL || new URL(request.url).origin;
  const form = await request.formData().catch(() => new FormData());
  const { gift, error } = parseGiftForm(form, now);
  if (error) return Response.redirect(`${siteUrl}/gift?error=${encodeURIComponent(error)}#gift-form`, 303);

  const tracking = {};
  for (const key of TRACKING_FIELDS) {
    const value = String(form.get(key) || '').slice(0, 500);
    if (value) tracking[key] = value;
  }

  const giftMetadata = {
    kind: 'gift',
    plan_months: String(gift.plan.months),
    recipient_email: gift.recipientEmail,
    recipient_name: gift.recipientName,
    sender_name: gift.senderName,
    message: gift.message,
    deliver_on: gift.deliverOn,
    gift_ends: gift.endsOn,
    gift_delivered: 'no',
    gift_expired: 'no',
  };

  try {
    const session = await stripeRequest(env.STRIPE_SECRET_KEY, 'POST', '/checkout/sessions', {
      mode: 'payment',
      submit_type: 'pay',
      // Uses the gift prices created by scripts/stripe-setup.mjs when they're
      // configured, so gifts show up as products in Stripe's reports.
      line_items: [env[`STRIPE_GIFT_PRICE_${gift.plan.months}`] ? {
        quantity: 1,
        price: env[`STRIPE_GIFT_PRICE_${gift.plan.months}`],
      } : {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: gift.plan.amount,
          product_data: {
            name: `Society of Daves gift membership (${gift.plan.label})`,
            description: `The Dave Dispatch for ${gift.recipientName}, starting ${gift.deliverOn}. One payment, no renewal.`,
          },
        },
      }],
      // plan lets gift-sent.html report the sale's value to Google Analytics.
      success_url: `${siteUrl}/gift-sent?plan=${gift.plan.months}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/gift#gift-form`,
      allow_promotion_codes: true,
      metadata: { kind: 'gift', ...tracking },
      payment_intent_data: { metadata: { ...giftMetadata, ...tracking } },
    });
    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error(err);
    return Response.redirect(`${siteUrl}/gift?checkout=error#gift-form`, 303);
  }
}

const from = (env) => env.EMAIL_FROM || 'The Society of Daves <hello@societyofdaves.com>';
const siteUrlOf = (env) => env.SITE_URL || 'https://societyofdaves.com';

// Puts the Dave on the newsletter list and sends them their gift email.
async function deliverGift(env, paymentIntent) {
  const m = paymentIntent.metadata;
  await subscribeContact(env.RESEND_API_KEY, {
    email: m.recipient_email, firstName: m.recipient_name, segmentId: env.RESEND_SEGMENT_ID,
  });
  const email = giftEmail({
    recipientName: m.recipient_name, senderName: m.sender_name, message: m.message,
    months: Number(m.plan_months), endsOn: m.gift_ends, siteUrl: siteUrlOf(env),
    festive: m.deliver_on.slice(5, 7) === '12',
  });
  await sendEmail(env.RESEND_API_KEY, {
    from: from(env), to: m.recipient_email, ...email, idempotencyKey: `gift-${paymentIntent.id}`,
  });
  await stripeRequest(env.STRIPE_SECRET_KEY, 'POST', `/payment_intents/${paymentIntent.id}`, {
    metadata: { gift_delivered: 'yes' },
  });
}

// Called from the Stripe webhook when a gift payment completes.
export async function handleGiftPaid(env, session, now = new Date()) {
  const paymentIntent = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET', `/payment_intents/${session.payment_intent}`);
  const m = paymentIntent.metadata;
  const buyerEmail = session.customer_details?.email;

  if (buyerEmail) {
    const email = giftConfirmationEmail({
      recipientName: m.recipient_name, months: Number(m.plan_months), deliverOn: m.deliver_on,
      today: isoDate(now),
    });
    await sendEmail(env.RESEND_API_KEY, {
      from: from(env), to: buyerEmail, ...email, idempotencyKey: `gift-confirm-${session.id}`,
    });
  }

  if (m.gift_delivered !== 'yes' && m.deliver_on <= isoDate(now)) await deliverGift(env, paymentIntent);
}

async function searchGifts(env, clauses) {
  const query = [`status:"succeeded"`, `metadata["kind"]:"gift"`, ...clauses].join(' AND ');
  const res = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET',
    `/payment_intents/search?limit=100&query=${encodeURIComponent(query)}`);
  return res.data;
}

async function isPayingMember(env, email) {
  const customers = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET',
    `/customers/search?query=${encodeURIComponent(`email:"${email.replace(/"/g, '')}"`)}`);
  for (const customer of customers.data.slice(0, 3)) {
    const subs = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET', `/subscriptions?customer=${customer.id}&status=active&limit=1`);
    if (subs.data.length) return true;
  }
  return false;
}

// True if someone has an active (delivered, not yet ended) gift membership.
export async function hasActiveGift(env, email) {
  const gifts = await searchGifts(env, [
    `metadata["recipient_email"]:"${email.toLowerCase().replace(/"/g, '')}"`,
    `metadata["gift_expired"]:"no"`,
  ]);
  return gifts.some((g) => g.metadata.gift_delivered === 'yes');
}

// Each run is kept short so it finishes well inside the hosting time limit: it
// handles a small batch and reports how many are left. The caller (a GitHub
// Actions schedule, see .github/workflows/daily.yml) repeats until done.
const MAX_DELIVERIES = 6;
const MAX_EXPIRIES = 3;

export async function runDailyGiftJob(env, now = new Date()) {
  const today = isoDate(now);
  const result = { delivered: 0, expired: 0, remaining: 0 };

  const due = (await searchGifts(env, [`metadata["gift_delivered"]:"no"`]))
    .filter((g) => g.metadata.deliver_on <= today);
  for (const candidate of due.slice(0, MAX_DELIVERIES)) {
    // Search results can lag by up to a minute, so re-read before sending.
    const fresh = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET', `/payment_intents/${candidate.id}`);
    if (fresh.metadata.gift_delivered === 'yes') continue;
    await deliverGift(env, fresh);
    result.delivered++;
  }
  result.remaining += Math.max(0, due.length - MAX_DELIVERIES);

  const ending = (await searchGifts(env, [`metadata["gift_delivered"]:"yes"`, `metadata["gift_expired"]:"no"`]))
    .filter((g) => g.metadata.gift_ends <= today);
  for (const candidate of ending.slice(0, MAX_EXPIRIES)) {
    const fresh = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET', `/payment_intents/${candidate.id}`);
    if (fresh.metadata.gift_expired === 'yes') continue;
    const m = fresh.metadata;
    // A Dave who has since joined as a paying member stays on the list.
    if (!(await isPayingMember(env, m.recipient_email))) {
      await unsubscribeContact(env.RESEND_API_KEY, m.recipient_email);
      const email = giftEndedEmail({ recipientName: m.recipient_name, siteUrl: siteUrlOf(env) });
      await sendEmail(env.RESEND_API_KEY, {
        from: from(env), to: m.recipient_email, ...email, idempotencyKey: `gift-ended-${fresh.id}`,
      });
    }
    await stripeRequest(env.STRIPE_SECRET_KEY, 'POST', `/payment_intents/${fresh.id}`, {
      metadata: { gift_expired: 'yes' },
    });
    result.expired++;
  }
  result.remaining += Math.max(0, ending.length - MAX_EXPIRIES);

  return result;
}

export async function handleDailyCron(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const result = await runDailyGiftJob(env);
  return Response.json(result);
}
