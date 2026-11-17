import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gaCookieHeader } from '../lib/analytics-geo.js';
import middleware from '../middleware.js';
import { GOOGLE_TAG, GA_ID } from '../scripts/site.mjs';

test('visitors from China and Singapore get the analytics-off cookie', () => {
  assert.match(gaCookieHeader('CN'), /^dave-ga=off;/);
  assert.match(gaCookieHeader('sg'), /^dave-ga=off;/);
});

test('everyone else gets no cookie', () => {
  for (const c of ['US', 'GB', 'HK', '', null, undefined]) assert.equal(gaCookieHeader(c), null);
});

test('a stale cookie is cleared outside the skipped countries', () => {
  assert.match(gaCookieHeader('US', 'x=1; dave-ga=off'), /^dave-ga=; .*Max-Age=0/);
  assert.equal(gaCookieHeader('US', 'not-dave-ga=off'), null);
});

test('middleware passes the request on, setting the cookie when needed', () => {
  const req = (country) => new Request('https://societyofdaves.com/', { headers: { 'x-vercel-ip-country': country } });
  const cn = middleware(req('CN'));
  assert.equal(cn.headers.get('x-middleware-next'), '1');
  assert.match(cn.headers.get('set-cookie'), /^dave-ga=off;/);
  const us = middleware(req('US'));
  assert.equal(us.headers.get('x-middleware-next'), '1');
  assert.equal(us.headers.get('set-cookie'), null);
});

test('the Google tag switches itself off when the cookie is present', () => {
  assert.ok(GOOGLE_TAG.includes(`window['ga-disable-${GA_ID}'] = true`));
  assert.ok(GOOGLE_TAG.indexOf('ga-disable') < GOOGLE_TAG.indexOf("gtag('config'"));
});
