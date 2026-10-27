// Turns Stripe events into newsletter-list changes.
//   checkout.session.completed     -> add to Resend list + welcome email
//   checkout.session.completed (gift) -> confirmation email, and the gift itself if due today
//   customer.subscription.deleted  -> unsubscribe from Resend list

import { stripeRequest, verifyStripeEvent } from './stripe.js';
import { subscribeContact, unsubscribeContact, sendEmail } from './resend.js';
import { welcomeEmail } from './welcome-email.js';
import { handleGiftPaid, hasActiveGift } from './gift.js';

function firstNameFromSession(session) {
  const field = (session.custom_fields || []).find((f) => f.key === 'first_name');
  return field?.text?.value || session.customer_details?.name?.split(' ')[0] || '';
}

export async function handleStripeWebhook(request, env) {
  const rawBody = await request.text();
  let event;
  try {
    event = await verifyStripeEvent(rawBody, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook rejected: ${err.message}`, { status: 400 });
  }

  const siteUrl = env.SITE_URL || 'https://societyofdaves.com';

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'payment' && session.metadata?.kind === 'gift') {
      await handleGiftPaid(env, session);
      return new Response('OK', { status: 200 });
    }
    if (session.mode !== 'subscription') return new Response('Ignored', { status: 200 });
    const email = session.customer_details?.email || session.customer_email;
    if (!email) return new Response('No email on session', { status: 200 });
    const firstName = firstNameFromSession(session);

    await subscribeContact(env.RESEND_API_KEY, { email, firstName, segmentId: env.RESEND_SEGMENT_ID });
    const { subject, html, text } = welcomeEmail({ firstName, manageUrl: `${siteUrl}/api/manage` });
    await sendEmail(env.RESEND_API_KEY, {
      from: env.EMAIL_FROM || 'The Society of Daves <hello@societyofdaves.com>',
      to: email,
      subject,
      html,
      text,
      idempotencyKey: `welcome-${session.id}`,
    });
  } else if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customer = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET', `/customers/${subscription.customer}`);
    // Someone who cancels but still has a gift membership running stays on the list.
    if (customer.email && !(await hasActiveGift(env, customer.email))) {
      await unsubscribeContact(env.RESEND_API_KEY, customer.email);
    }
  }

  return new Response('OK', { status: 200 });
}
