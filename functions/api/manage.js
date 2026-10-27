// Sends members to Stripe's customer portal, where they can update their
// card or cancel. STRIPE_PORTAL_URL is the portal's login link from the
// Stripe dashboard (Settings > Billing > Customer portal).

export const onRequestGet = ({ env }) => {
  if (!env.STRIPE_PORTAL_URL) {
    return new Response('Membership management is not configured yet. Email hello@societyofdaves.com to cancel.', { status: 503 });
  }
  return Response.redirect(env.STRIPE_PORTAL_URL, 302);
};
