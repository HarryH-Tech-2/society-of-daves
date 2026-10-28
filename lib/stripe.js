// Minimal Stripe helpers using fetch + Web Crypto, so they run on
// Vercel Functions without the Node SDK.

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 300;
// Pinned so a version upgrade in the Stripe dashboard can't change the
// shape of responses under us. Webhook payloads use the endpoint's version.
export const STRIPE_API_VERSION = '2026-09-30.endive';

// Flattens nested objects/arrays into Stripe's form encoding:
// { line_items: [{ price: 'p' }] } -> line_items[0][price]=p
export function toFormBody(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') toFormBody(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

export async function stripeRequest(secretKey, method, path, params) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: params ? toFormBody(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${data?.error?.message ?? res.status}`);
  }
  return data;
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verifies a Stripe-Signature header against the raw request body.
// Returns the parsed event, or throws.
export async function verifyStripeEvent(rawBody, header, secret, nowSeconds = Date.now() / 1000) {
  if (!header) throw new Error('Missing Stripe-Signature header');
  const parts = header.split(',').map((p) => p.split('='));
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || signatures.length === 0) throw new Error('Malformed Stripe-Signature header');
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error('Stripe signature timestamp outside tolerance');
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  if (!signatures.some((s) => timingSafeEqual(s, expected))) {
    throw new Error('Stripe signature mismatch');
  }
  return JSON.parse(rawBody);
}

// Exposed for tests: builds a valid header for a payload.
export async function signStripePayload(rawBody, secret, timestamp) {
  return `t=${timestamp},v1=${await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)}`;
}
