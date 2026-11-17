// Vercel Routing Middleware: runs before every page (not API calls or files)
// and marks visitors from countries we keep out of Google Analytics.
// See lib/analytics-geo.js.

import { next } from '@vercel/functions';
import { gaCookieHeader } from './lib/analytics-geo.js';

export const config = {
  matcher: ['/((?!api/|images/|.*\\.).*)'],
};

export default function middleware(request) {
  const cookie = gaCookieHeader(request.headers.get('x-vercel-ip-country'), request.headers.get('cookie'));
  return cookie ? next({ headers: { 'set-cookie': cookie } }) : next();
}
