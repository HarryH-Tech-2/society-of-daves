// Minimal Resend helpers: contacts (the newsletter list) and transactional email.

const RESEND_API = 'https://api.resend.com';

async function resendRequest(apiKey, method, path, body, extraHeaders = {}) {
  const res = await fetch(`${RESEND_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Adds a member to the list, or re-subscribes them if they were already on it
// (e.g. a Dave who cancelled and came back).
export async function subscribeContact(apiKey, { email, firstName, segmentId }) {
  const created = await resendRequest(apiKey, 'POST', '/contacts', {
    email,
    first_name: firstName || undefined,
    unsubscribed: false,
    segments: segmentId ? [{ id: segmentId }] : undefined,
  });
  if (created.ok) return created.data;

  const updated = await resendRequest(apiKey, 'PATCH', `/contacts/${encodeURIComponent(email)}`, {
    first_name: firstName || undefined,
    unsubscribed: false,
  });
  if (!updated.ok) {
    throw new Error(`Resend subscribe failed (${created.status}/${updated.status}): ${JSON.stringify(updated.data)}`);
  }
  return updated.data;
}

export async function unsubscribeContact(apiKey, email) {
  const res = await resendRequest(apiKey, 'PATCH', `/contacts/${encodeURIComponent(email)}`, {
    unsubscribed: true,
  });
  // A contact that was never added is already "unsubscribed" as far as we care.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Resend unsubscribe failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
}

export async function sendEmail(apiKey, { from, to, subject, html, text, idempotencyKey }) {
  const res = await resendRequest(
    apiKey, 'POST', '/emails', { from, to, subject, html, text },
    idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  );
  if (!res.ok) throw new Error(`Resend send failed (${res.status}): ${JSON.stringify(res.data)}`);
  return res.data;
}
