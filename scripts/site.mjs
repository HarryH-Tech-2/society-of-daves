// Shared page pieces for generated pages (blog, posts). The homepage and
// legal pages are hand-written HTML in public/ and use the same markup.

export const SITE = {
  name: 'The Society of Daves',
  url: 'https://societyofdaves.com',
  email: 'hello@societyofdaves.com',
  description: 'The members\' club for people called Dave. Learn where your name comes from, meet the notable Daves, and join for $1 a month.',
};

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const stripTags = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Permanent+Marker&display=swap';

export function head({ title, description, path, ogType = 'website', image = '/og.png', jsonLd = [] }) {
  const url = `${SITE.url}${path}`;
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${SITE.name}">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${SITE.url}${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#D9232D">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="The Society of Daves blog" href="/rss.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${FONTS}">
  <link rel="stylesheet" href="/styles.css">
${jsonLd.map((d) => `  <script type="application/ld+json">${JSON.stringify(d)}</script>`).join('\n')}`;
}

export const header = () => `<a class="skip" href="#main">Skip to content</a>
  <header class="wrap masthead">
    <a class="wordmark" href="/">The Society of <span>Daves</span></a>
    <nav aria-label="Main">
      <a class="optional" href="/blog/">Blog</a>
      <a class="optional" href="/gift">Give a gift</a>
      <a href="/#join">Join for $1</a>
    </nav>
  </header>`;

export const footer = () => `<footer class="footer">
    <div class="wrap">
      <nav aria-label="Footer">
        <a href="/blog/">Blog</a>
        <a href="/gift">Give a gift</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/api/manage">Manage membership</a>
        <a href="mailto:${SITE.email}">${SITE.email}</a>
      </nav>
      <p>&copy; 2026 The Society of Daves. A parody, for fun. Not affiliated with any Dave, David, or TV channel mentioned on this site.</p>
    </div>
  </footer>
  <script src="/app.js" defer></script>`;

export const joinCta = () => `<aside class="cta-band" aria-labelledby="cta-title">
  <div class="dave-wall" aria-hidden="true"></div>
  <div class="cta-inner">
    <h2 id="cta-title">Get The Dave Dispatch</h2>
    <p>One email a month about the name Dave: history, notable Daves, Daves in the news, and statistics nobody asked for. $1 a month, cancel any time.</p>
    <form method="post" action="/api/checkout" data-checkout>
      <button class="button" type="submit">Join for $1 a month</button>
    </form>
  </div>
</aside>`;

export function faqList(faqs) {
  return `<div class="faq">
${faqs.map((f) => `    <details>
      <summary>${esc(f.q)}</summary>
      <div class="faq-body"><p>${f.a}</p></div>
    </details>`).join('\n')}
  </div>`;
}

export const faqSchema = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: stripTags(f.q),
    acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) },
  })),
});

export const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE.url}/#org`,
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}/favicon.svg`,
  email: SITE.email,
};

// US births of boys named David, by decade. Social Security Administration
// data, summed by Name Almanac and rounded to the nearest thousand.
export const DAVID_BY_DECADE = [
  ['1910s', 44000], ['1920s', 89000], ['1930s', 165000], ['1940s', 426000],
  ['1950s', 770000], ['1960s', 734000], ['1970s', 446000], ['1980s', 384000],
  ['1990s', 254000], ['2000s', 180000], ['2010s', 117000],
];

export function daveChart() {
  const peakValue = Math.max(...DAVID_BY_DECADE.map(([, n]) => n));
  const scaleMax = 800000;
  const fmt = (n) => n.toLocaleString('en-US');
  const bars = DAVID_BY_DECADE.map(([decade, n], i) => {
    const peak = n === peakValue;
    return `<li class="bar${peak ? ' is-peak' : ''}" style="--h:${((n / scaleMax) * 100).toFixed(1)}%;--i:${i}" tabindex="0" aria-label="${decade}: about ${fmt(n)} Davids born">
        <span class="bar-tip" aria-hidden="true">${decade}<strong>${fmt(n)}</strong></span>
        ${peak ? `<span class="bar-label" aria-hidden="true">Peak Dave</span>` : ''}
        <span class="bar-fill"></span>
        <span class="bar-x" aria-hidden="true">${decade.slice(0, 4).replace(/^19|^20/, "'")}</span>
      </li>`;
  }).join('\n      ');
  return `<figure class="chart">
    <figcaption class="chart-title">Davids born in the United States, per decade</figcaption>
    <div class="chart-plot">
      <div class="chart-grid" aria-hidden="true"><span data-v="800k"></span><span data-v="600k"></span><span data-v="400k"></span><span data-v="200k"></span><span data-v="0"></span></div>
      <ol class="bars">
      ${bars}
      </ol>
    </div>
    <details class="chart-table">
      <summary>See the numbers</summary>
      <div class="faq-body"><table>
        <thead><tr><th scope="col">Decade</th><th scope="col">Davids born (approx.)</th></tr></thead>
        <tbody>${DAVID_BY_DECADE.map(([d, n]) => `<tr><td>${d}</td><td>${fmt(n)}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
    <p class="source">Source: U.S. Social Security Administration baby name data, summed by decade via Name Almanac, rounded to the nearest thousand.</p>
  </figure>`;
}
