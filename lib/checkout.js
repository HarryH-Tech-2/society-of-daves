// Creates a Stripe Checkout session for the $1/month membership and
// redirects the visitor to Stripe's hosted payment page.

import { stripeRequest } from './stripe.js';

// Ad-tracking fields we pass through to Stripe so a paid member can be
// traced back to the campaign that brought them in.
const TRACKING_FIELDS = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export async function handleCheckout(request, env) {
  const siteUrl = env.SITE_URL || new URL(request.url).origin;
  const form = await request.formData().catch(() => new FormData());

  const metadata = {};
  for (const key of TRACKING_FIELDS) {
    const value = String(form.get(key) || '').slice(0, 500);
    if (value) metadata[key] = value;
  }

  try {
    const session = await stripeRequest(env.STRIPE_SECRET_KEY, 'POST', '/checkout/sessions', {
      mode: 'subscription',
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${siteUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#join`,
      allow_promotion_codes: true,
      custom_fields: [{
        key: 'first_name',
        label: { type: 'custom', custom: "First name (we're assuming Dave)" },
        type: 'text',
        optional: true,
      }],
      metadata,
      subscription_data: { metadata },
    });
    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error(err);
    return Response.redirect(`${siteUrl}/?checkout=error#join`, 303);
  }
}
