// Countries whose visits we keep out of Google Analytics. Almost all of this
// traffic so far has been bots and crawlers, and it muddies the reports.
// middleware.js marks these visitors with a cookie, and the Google tag in
// scripts/site.mjs switches itself off when it sees it.

export const GA_SKIP_COUNTRIES = ['CN', 'SG'];
export const GA_SKIP_COOKIE = 'dave-ga';

const SKIP = new Set(GA_SKIP_COUNTRIES);

// The Set-Cookie header to send, or null for none. Visitors from a skipped
// country get "off"; anyone else still carrying the cookie (say, after a
// trip) has it cleared.
export function gaCookieHeader(country, cookieHeader = '') {
  const skip = SKIP.has(String(country || '').toUpperCase());
  const has = new RegExp(`(?:^|;\\s*)${GA_SKIP_COOKIE}=off(?:;|$)`).test(cookieHeader || '');
  if (skip) return `${GA_SKIP_COOKIE}=off; Path=/; Max-Age=86400; SameSite=Lax; Secure`;
  if (has) return `${GA_SKIP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  return null;
}
