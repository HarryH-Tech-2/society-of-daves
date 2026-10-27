// The welcome email every new member receives.

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function isDave(name) {
  return /^(dave|davey|davie|davy|david|dafydd|dai|davide|davi|dawid|dovid)$/i.test(String(name || '').trim());
}

export function welcomeEmail({ firstName, manageUrl }) {
  const name = String(firstName || '').trim();
  const greeting = !name || isDave(name)
    ? `Welcome, ${name ? escapeHtml(name) : 'Dave'}.`
    : `Welcome, ${escapeHtml(name)}. For the purposes of the Society, you are now Dave.`;
  const greetingText = greeting.replace(/&#39;/g, "'").replace(/&amp;/g, '&');

  const subject = 'Your Society of Daves membership is confirmed';

  const text = `${greetingText}

Your membership of the Society of Daves is confirmed. You're paying $1 a month, and you can cancel any time.

What happens now:
- The Dave Dispatch, our monthly newsletter about the name Dave, arrives once a month.
- Your dollar keeps societyofdaves.com running and pays for new Dave research.

Manage or cancel your membership: ${manageUrl}

Yours in Daveness,
The Society of Daves`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F2F4F7;font-family:Arial,Helvetica,sans-serif;color:#000">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border:3px solid #000;border-radius:14px;overflow:hidden">
  <tr><td style="background:#D9232D;color:#fff;text-align:center;padding:18px 16px 10px">
    <div style="font-size:34px;font-weight:900;letter-spacing:2px">HELLO</div>
    <div style="font-size:15px">my name is</div>
  </td></tr>
  <tr><td style="text-align:center;padding:22px 16px;font-size:44px;font-weight:700;font-family:'Comic Sans MS','Marker Felt',cursive">Dave</td></tr>
  <tr><td style="background:#D9232D;height:16px"></td></tr>
  <tr><td style="padding:24px 28px;font-size:16px;line-height:1.55">
    <p style="margin:0 0 14px;font-size:20px;font-weight:700">${greeting}</p>
    <p style="margin:0 0 14px">Your membership of the Society of Daves is confirmed. You're paying $1 a month, and you can cancel any time.</p>
    <p style="margin:0 0 6px;font-weight:700">What happens now</p>
    <ul style="margin:0 0 14px;padding-left:20px">
      <li>The Dave Dispatch, our monthly newsletter about the name Dave, arrives once a month.</li>
      <li>Your dollar keeps societyofdaves.com running and pays for new Dave research.</li>
    </ul>
    <p style="margin:0 0 20px"><a href="${escapeHtml(manageUrl)}" style="color:#000">Manage or cancel your membership</a></p>
    <p style="margin:0">Yours in Daveness,<br>The Society of Daves</p>
  </td></tr>
</table></body></html>`;

  return { subject, html, text };
}
