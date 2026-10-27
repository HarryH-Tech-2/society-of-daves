// The shareable name badge: a 1200x630 image of the homepage badge with the
// visitor's name crossed out and corrected to Dave. Used as the preview image
// for /badge/<name> share links and as the "Download" file.

import { isDave } from './welcome-email.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Same limit as the homepage input. Control characters and stray spaces go.
export function cleanName(raw) {
  return String(raw ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
}

export const badgeImageUrl = (siteUrl, name) => `${siteUrl}/api/badge?name=${encodeURIComponent(name)}`;
export const shareUrl = (siteUrl, name) => `${siteUrl}/badge/${encodeURIComponent(name)}`;

export function badgeHeadline(name) {
  if (!name) return 'Hello, my name is Dave';
  return isDave(name) ? `${name} is already a Dave` : `${name} is now a Dave`;
}

// Satori takes React-like element objects; this saves pulling in React.
const h = (type, style, ...children) => ({
  type, props: { style, children: children.length === 1 ? children[0] : children },
});

const RED = '#D9232D';

export function badgeElement(name) {
  const corrected = name && !isDave(name);
  const shownName = name && isDave(name) ? name : 'Dave';

  const nameArea = corrected
    ? h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center' },
      h('div', {
        fontFamily: 'Archivo', fontWeight: 700, fontSize: 48, color: '#6B7280',
        textDecoration: 'line-through', textDecorationColor: RED, maxWidth: 500, textAlign: 'center',
      }, name),
      h('div', { fontFamily: 'Marker', fontSize: 132, lineHeight: 1, transform: 'rotate(-3deg)', marginTop: -6 }, 'Dave'))
    : h('div', { fontFamily: 'Marker', fontSize: 150, lineHeight: 1 }, shownName);

  const badge = h('div', {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    width: 560, background: RED, borderRadius: 34, padding: '26px 22px 26px',
    transform: 'rotate(-3deg)', boxShadow: '0 24px 40px rgba(40, 10, 10, 0.35)', color: '#fff',
  },
  h('div', { fontFamily: 'Archivo', fontWeight: 900, fontSize: 104, lineHeight: 1, letterSpacing: 4 }, 'HELLO'),
  h('div', { fontFamily: 'Archivo', fontWeight: 700, fontSize: 34, marginBottom: 18 }, 'my name is'),
  h('div', {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: 250, background: '#fff', borderRadius: 14, color: '#000',
  }, nameArea));

  const words = h('div', { display: 'flex', flexDirection: 'column', width: 400, marginLeft: 40, color: '#000' },
    h('div', { fontFamily: 'Archivo', fontWeight: 900, fontSize: 56, lineHeight: 1.02 },
      corrected ? 'Close enough. Welcome, Dave.' : 'There are a lot of us.'),
    h('div', { fontFamily: 'Archivo', fontWeight: 400, fontSize: 28, lineHeight: 1.3, marginTop: 22, color: '#4A5260' },
      "The Society of Daves: the world's most exclusive club that nearly anyone can join."),
    h('div', {
      display: 'flex', marginTop: 30, alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 999,
      background: '#000', color: '#fff', fontFamily: 'Archivo', fontWeight: 800, fontSize: 28,
    }, 'societyofdaves.com'));

  return h('div', {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 1200, height: 630, background: '#EEF0F3', padding: '0 60px',
  }, badge, words);
}

// The page a share link points at. Social sites read its preview tags; people
// are sent straight on to the homepage with the badge filled in.
export function sharePage(siteUrl, name) {
  const title = `${badgeHeadline(name)} | The Society of Daves`;
  const description = "Write your name on the badge. The Society of Daves: the world's most exclusive club that nearly anyone can join.";
  const image = badgeImageUrl(siteUrl, name);
  const target = `/?badge=${encodeURIComponent(name)}#badge`;
  const e = escapeHtml;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(title)}</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${e(siteUrl)}/">
  <meta name="description" content="${e(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="The Society of Daves">
  <meta property="og:url" content="${e(shareUrl(siteUrl, name))}">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:image" content="${e(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${e(`A red name badge: ${badgeHeadline(name)}`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0; url=${e(target)}">
</head>
<body>
  <p><a href="${e(target)}">Continue to the Society of Daves</a></p>
  <script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')});</script>
</body>
</html>`;
}
