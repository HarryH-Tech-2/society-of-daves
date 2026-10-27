// Emails for gift memberships: the gift itself, the buyer's confirmation,
// and the note when a gift runs out.

import { isDave, referralBlock } from './welcome-email.js';
import { formatPrice } from './price.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function formatDay(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function badgeLayout({ topLine, name, bodyHtml }) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F2F4F7;font-family:Arial,Helvetica,sans-serif;color:#000">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border:3px solid #000;border-radius:14px;overflow:hidden">
  <tr><td style="background:#D9232D;color:#fff;text-align:center;padding:18px 16px 10px">
    <div style="font-size:34px;font-weight:900;letter-spacing:2px">${topLine}</div>
    <div style="font-size:15px">my name is</div>
  </td></tr>
  <tr><td style="text-align:center;padding:22px 16px;font-size:44px;font-weight:700;font-family:'Comic Sans MS','Marker Felt',cursive">${escapeHtml(name)}</td></tr>
  <tr><td style="background:#D9232D;height:16px"></td></tr>
  <tr><td style="padding:24px 28px;font-size:16px;line-height:1.55">${bodyHtml}</td></tr>
</table></body></html>`;
}

export function giftEmail({ recipientName, senderName, message, months, endsOn, siteUrl, festive = false }) {
  const name = recipientName || 'Dave';
  const badgeName = isDave(name) ? name : 'Dave';
  const honorary = isDave(name) ? '' : ` For the purposes of the Society, you are now Dave.`;
  const subject = `${senderName} has given you ${months} months of the Society of Daves`;

  const messageHtml = message
    ? `<p style="margin:0 0 6px;font-weight:700">${escapeHtml(senderName)} says:</p>
       <p style="margin:0 0 18px;padding:12px 14px;background:#FFF9C4;border-left:4px solid #D9232D;white-space:pre-wrap">${escapeHtml(message)}</p>`
    : '';

  const html = badgeLayout({
    topLine: festive ? 'HO HO HO' : 'HELLO',
    name: badgeName,
    bodyHtml: `
    <p style="margin:0 0 14px;font-size:20px;font-weight:700">${escapeHtml(name)}, you've been given a gift.</p>
    <p style="margin:0 0 14px">${escapeHtml(senderName)} has made you a member of the Society of Daves for ${months} months.${honorary}</p>
    ${messageHtml}
    <p style="margin:0 0 6px;font-weight:700">What you get</p>
    <ul style="margin:0 0 14px;padding-left:20px">
      <li>The Dave Dispatch, our monthly newsletter about the name Dave, until ${formatDay(endsOn)}.</li>
      <li>Full membership of the world's most exclusive club that nearly anyone can join.</li>
    </ul>
    <p style="margin:0 0 14px">It's all paid for. You won't be charged anything, and it ends on its own.</p>
    <p style="margin:0 0 20px"><a href="${escapeHtml(siteUrl)}" style="color:#000">Visit the Society</a></p>
    ${referralBlock(siteUrl, 'gift').html}
    <p style="margin:0">${festive ? 'Merry Christmas, and yours' : 'Yours'} in Daveness,<br>The Society of Daves</p>`,
  });

  const text = `${name}, you've been given a gift.

${senderName} has made you a member of the Society of Daves for ${months} months.${honorary}
${message ? `\n${senderName} says:\n${message}\n` : ''}
What you get:
- The Dave Dispatch, our monthly newsletter about the name Dave, until ${formatDay(endsOn)}.
- Full membership of the world's most exclusive club that nearly anyone can join.

It's all paid for. You won't be charged anything, and it ends on its own.

${siteUrl}

${referralBlock(siteUrl, 'gift').text}

${festive ? 'Merry Christmas, and yours' : 'Yours'} in Daveness,
The Society of Daves`;

  return { subject, html, text };
}

export function giftConfirmationEmail({ recipientName, months, deliverOn, today }) {
  const when = deliverOn <= today ? 'It has been sent to them now.' : `We'll email it to them on ${formatDay(deliverOn)}.`;
  const subject = `Your gift for ${recipientName} is booked`;
  const html = badgeLayout({
    topLine: 'THANK YOU',
    name: 'Dave',
    bodyHtml: `
    <p style="margin:0 0 14px;font-size:20px;font-weight:700">Your gift is booked.</p>
    <p style="margin:0 0 14px">You've given ${escapeHtml(recipientName)} ${months} months of the Society of Daves. ${when}</p>
    <p style="margin:0 0 14px">It was a one-off payment. Nothing renews, and neither of you will be charged again.</p>
    <p style="margin:0 0 14px">Wrong email address, or want to change the date? Reply to this email and we'll sort it out.</p>
    <p style="margin:0">Yours in Daveness,<br>The Society of Daves</p>`,
  });
  const text = `Your gift is booked.

You've given ${recipientName} ${months} months of the Society of Daves. ${when}

It was a one-off payment. Nothing renews, and neither of you will be charged again.

Wrong email address, or want to change the date? Reply to this email and we'll sort it out.

Yours in Daveness,
The Society of Daves`;
  return { subject, html, text };
}

export function giftEndedEmail({ recipientName, siteUrl, currency = 'usd' }) {
  const price = formatPrice(100, currency);
  const subject = 'Your Society of Daves gift membership has ended';
  const joinUrl = `${siteUrl}/#join`;
  const html = badgeLayout({
    topLine: 'GOODBYE',
    name: 'Dave?',
    bodyHtml: `
    <p style="margin:0 0 14px;font-size:20px;font-weight:700">${escapeHtml(recipientName || 'Dave')}, your gift membership has ended.</p>
    <p style="margin:0 0 14px">We hope you enjoyed The Dave Dispatch. We've taken you off the mailing list, so you won't receive any more issues.</p>
    <p style="margin:0 0 20px">To keep getting it, you can join for ${price} a month and cancel any time.</p>
    <p style="margin:0 0 20px"><a href="${escapeHtml(joinUrl)}" style="display:inline-block;background:#D9232D;color:#fff;font-weight:700;padding:12px 20px;border-radius:999px;text-decoration:none">Join for ${price} a month</a></p>
    <p style="margin:0">Yours in Daveness,<br>The Society of Daves</p>`,
  });
  const text = `${recipientName || 'Dave'}, your gift membership has ended.

We hope you enjoyed The Dave Dispatch. We've taken you off the mailing list, so you won't receive any more issues.

To keep getting it, you can join for ${price} a month and cancel any time: ${joinUrl}

Yours in Daveness,
The Society of Daves`;
  return { subject, html, text };
}
