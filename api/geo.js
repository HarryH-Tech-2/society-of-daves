// Tells the page what the visitor's location means for it: which currency to
// show (pounds in the UK, dollars elsewhere) and whether the cookie banner
// has to ask. Vercel adds the visitor's country to every request.

import { currencyForCountry } from '../lib/price.js';
import { consentRequired } from '../lib/consent.js';

export const GET = (request) => {
  const country = request.headers.get('x-vercel-ip-country');
  return Response.json(
    { currency: currencyForCountry(country), consent: consentRequired(country) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
};
