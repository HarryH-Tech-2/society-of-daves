// Prices in two currencies: pounds for UK visitors, dollars for everyone else.
// The amounts are the same number in either currency ($1 or £1 a month).
// Each Stripe price carries a GBP option (see scripts/stripe-setup.mjs), and
// Checkout is told which currency to charge, so the visitor pays in the
// currency the site showed them.

export const CURRENCIES = ['usd', 'gbp'];

// The UK plus the Crown Dependencies, which all use the pound.
const POUND_COUNTRIES = new Set(['GB', 'IM', 'JE', 'GG']);

export const currencyForCountry = (country) => (POUND_COUNTRIES.has(String(country || '').toUpperCase()) ? 'gbp' : 'usd');

// The visitor's country as Vercel sees it (from their IP address), as a
// two-letter code like "CA", or null if it's missing or not a real code.
// Saved on each Stripe checkout so an abandoned checkout still says where
// it came from, even when Google Analytics never saw the visitor.
export function visitorCountry(request) {
  const code = String(request.headers.get('x-vercel-ip-country') || '').toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

// The currency to charge: what the page showed (sent as a hidden form field),
// or failing that, where Vercel says the visitor is.
export function chooseCurrency(request, form) {
  const shown = String(form?.get('currency') || '').toLowerCase();
  if (CURRENCIES.includes(shown)) return shown;
  return currencyForCountry(request.headers.get('x-vercel-ip-country'));
}

// 100 -> "$1", 1200 -> "£12". Whole amounts only, which is all we sell.
export function formatPrice(amountMinor, currency = 'usd') {
  const symbol = String(currency).toLowerCase() === 'gbp' ? '£' : '$';
  return `${symbol}${Math.round(amountMinor / 100)}`;
}

// "dollar" or "pound", for copy like "your dollar keeps the site running".
export const currencyUnit = (currency) => (String(currency).toLowerCase() === 'gbp' ? 'pound' : 'dollar');
