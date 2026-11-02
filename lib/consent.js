// Where the law says we must ask before setting analytics/ad cookies: the
// EU/EEA (GDPR + ePrivacy), the UK (PECR), Switzerland, and the Crown
// Dependencies and Gibraltar, which follow UK-style rules. Everywhere else
// Google cookies are on by default and the banner stays hidden, though the
// "Cookie settings" link still lets anyone opt out.
//
// Used in two places that must agree: the Consent Mode defaults in each
// page's <head> (scripts/site.mjs) and /api/geo, which tells the banner
// whether to show.

export const CONSENT_COUNTRIES = [
  // EU
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // Rest of the EEA
  'IS', 'LI', 'NO',
  // UK and friends
  'GB', 'IM', 'JE', 'GG', 'GI', 'CH',
];

const SET = new Set(CONSENT_COUNTRIES);

// Unknown location (local dev, a missing header): ask, to be safe.
export const consentRequired = (country) => {
  const code = String(country || '').toUpperCase();
  return !code || SET.has(code);
};
