// Tells the page which currency to show: pounds in the UK, dollars elsewhere.
// Vercel adds the visitor's country to every request.

import { currencyForCountry } from '../lib/price.js';

export const GET = (request) => Response.json(
  { currency: currencyForCountry(request.headers.get('x-vercel-ip-country')) },
  { headers: { 'Cache-Control': 'private, no-store' } },
);
