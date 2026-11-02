import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consentRequired } from '../lib/consent.js';
import { GET } from '../api/geo.js';

test('the banner is needed in the UK, EU/EEA and Switzerland', () => {
  for (const c of ['GB', 'gb', 'IE', 'DE', 'FR', 'NO', 'CH', 'JE']) assert.equal(consentRequired(c), true, c);
});

test('the banner is not needed elsewhere', () => {
  for (const c of ['US', 'CA', 'AU', 'NZ', 'IN', 'BR']) assert.equal(consentRequired(c), false, c);
});

test('an unknown country asks, to be safe', () => {
  assert.equal(consentRequired(null), true);
  assert.equal(consentRequired(''), true);
});

test('/api/geo reports currency and consent together', async () => {
  const geo = (country) => GET(new Request('https://x/api/geo', { headers: country ? { 'x-vercel-ip-country': country } : {} })).json();
  assert.deepEqual(await geo('US'), { currency: 'usd', consent: false });
  assert.deepEqual(await geo('GB'), { currency: 'gbp', consent: true });
  assert.deepEqual(await geo('DE'), { currency: 'usd', consent: true });
});
