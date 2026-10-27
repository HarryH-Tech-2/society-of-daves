// Sets up a Stripe account for the Society of Daves:
//   - $1/month membership price
//   - $6 and $12 one-off gift membership prices
//   - customer portal (cancel, update card, see invoices) with a login link
//   - webhook endpoint for /api/stripe-webhook (only with --webhook)
//
// Safe to run more than once: prices are found by lookup key, and the
// portal/webhook are only created if missing.
//
// Usage:
//   node scripts/stripe-setup.mjs              (uses STRIPE_SECRET_KEY from .dev.vars)
//   node scripts/stripe-setup.mjs --webhook    (also creates the webhook for SITE_URL)

import { readFile } from 'node:fs/promises';
import { stripeRequest } from '../lib/stripe.js';

async function loadDevVars() {
  try {
    const text = await readFile(new URL('../.dev.vars', import.meta.url), 'utf8');
    return Object.fromEntries(text.split('\n')
      .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  } catch { return {}; }
}

const vars = { ...(await loadDevVars()), ...process.env };
const key = vars.STRIPE_SECRET_KEY;
if (!key || !key.startsWith('sk_')) {
  console.error('Put your Stripe secret key in .dev.vars as STRIPE_SECRET_KEY=sk_test_... and run again.');
  process.exit(1);
}
const live = key.startsWith('sk_live_');
const siteUrl = (vars.SITE_URL && !vars.SITE_URL.includes('localhost')) ? vars.SITE_URL : 'https://societyofdaves.com';
const stripe = (method, path, params) => stripeRequest(key, method, path, params);

const PRICES = [
  {
    lookup_key: 'sod_membership_monthly', env: 'STRIPE_PRICE_ID',
    product: { name: 'Society of Daves membership', description: 'The Dave Dispatch, a monthly newsletter about the name Dave. Cancel any time.' },
    price: { unit_amount: 100, currency: 'usd', recurring: { interval: 'month' } },
  },
  {
    lookup_key: 'sod_gift_6_months', env: 'STRIPE_GIFT_PRICE_6',
    product: { name: 'Society of Daves gift membership (6 months)', description: 'Six months of The Dave Dispatch, given as a gift. One payment, no renewal.' },
    price: { unit_amount: 600, currency: 'usd' },
  },
  {
    lookup_key: 'sod_gift_12_months', env: 'STRIPE_GIFT_PRICE_12',
    product: { name: 'Society of Daves gift membership (12 months)', description: 'A year of The Dave Dispatch, given as a gift. One payment, no renewal.' },
    price: { unit_amount: 1200, currency: 'usd' },
  },
];

const account = await stripe('GET', '/account');
console.log(`Stripe account: ${account.settings?.dashboard?.display_name || account.id} (${live ? 'LIVE mode' : 'test mode'})\n`);

const output = {};

for (const p of PRICES) {
  const existing = await stripe('GET', `/prices?active=true&lookup_keys[]=${p.lookup_key}`);
  if (existing.data.length) {
    output[p.env] = existing.data[0].id;
    console.log(`Found   ${p.product.name}: ${existing.data[0].id}`);
    continue;
  }
  const product = await stripe('POST', '/products', { ...p.product, metadata: { app: 'society-of-daves' } });
  const price = await stripe('POST', '/prices', { ...p.price, product: product.id, lookup_key: p.lookup_key });
  output[p.env] = price.id;
  console.log(`Created ${p.product.name}: ${price.id}`);
}

// Customer portal: members can cancel, update their card and see invoices.
const portals = await stripe('GET', '/billing_portal/configurations?active=true&limit=10');
let portal = portals.data.find((c) => c.metadata?.app === 'society-of-daves');
if (!portal) {
  portal = await stripe('POST', '/billing_portal/configurations', {
    business_profile: {
      headline: 'Manage your Society of Daves membership',
      privacy_policy_url: `${siteUrl}/privacy`,
      terms_of_service_url: `${siteUrl}/terms`,
    },
    features: {
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email'] },
    },
    login_page: { enabled: true },
    default_return_url: siteUrl,
    metadata: { app: 'society-of-daves' },
  });
  console.log('Created customer portal');
} else {
  console.log('Found   customer portal');
}
output.STRIPE_PORTAL_URL = portal.login_page?.url;

if (process.argv.includes('--webhook')) {
  const url = `${siteUrl}/api/stripe-webhook`;
  const hooks = await stripe('GET', '/webhook_endpoints?limit=100');
  const hook = hooks.data.find((h) => h.url === url);
  if (hook) {
    console.log(`Found   webhook for ${url} (its signing secret is in the Stripe dashboard)`);
  } else {
    const created = await stripe('POST', '/webhook_endpoints', {
      url,
      enabled_events: ['checkout.session.completed', 'customer.subscription.deleted'],
      description: 'Society of Daves: memberships and gifts',
    });
    output.STRIPE_WEBHOOK_SECRET = created.secret;
    console.log(`Created webhook for ${url}`);
  }
}

console.log('\nAdd these to Cloudflare (Settings > Variables and Secrets) and to .dev.vars:\n');
for (const [k, v] of Object.entries(output)) if (v) console.log(`${k}=${v}`);
