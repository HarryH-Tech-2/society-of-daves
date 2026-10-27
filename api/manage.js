// Sends members to Stripe's customer portal, where they can update their
// card or cancel. STRIPE_PORTAL_URL is the portal's login link from the
// Stripe dashboard (Settings > Billing > Customer portal).

export const GET = () => {
  const url = process.env.STRIPE_PORTAL_URL;
  if (!url) {
    return new Response('Membership management is not configured yet. Email hello@societyofdaves.com to cancel.', { status: 503 });
  }
  return Response.redirect(url, 302);
};
