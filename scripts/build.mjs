// Generates the blog, sitemap, RSS feed and llms.txt into public/, and
// refreshes the generated regions of public/index.html. Run: npm run build

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { posts } from '../content/posts.mjs';
import { images } from '../content/images.mjs';
import {
  SITE, esc, stripTags, head, header, footer, joinCta, faqList, faqSchema, organization, daveChart,
} from './site.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

const write = async (path, content) => {
  await mkdir(dirname(join(PUBLIC, path)), { recursive: true });
  await writeFile(join(PUBLIC, path), content);
};

const formatDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const readingMinutes = (html) => Math.max(1, Math.round(stripTags(html).split(' ').length / 220));

const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));

function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem', position: i + 1, name, item: `${SITE.url}${path}`,
    })),
  };
}

const coverOf = (p) => `/images/covers/${p.slug}.png`;

function figure(key) {
  const im = images[key];
  if (!im) throw new Error(`Unknown image "${key}" in a post body`);
  const license = im.licenseUrl
    ? `<a href="${im.licenseUrl}" target="_blank" rel="noopener license">${im.license}</a>`
    : im.license;
  return `<figure class="figure${im.portrait ? ' figure-portrait' : ''}">
  <img src="${im.src}" width="${im.width}" height="${im.height}" alt="${esc(im.alt)}" loading="lazy" decoding="async">
  <figcaption>${esc(im.caption)}<span class="credit">Photo: <a href="${im.page}" target="_blank" rel="noopener">${esc(im.artist)}</a>, ${license}, via Wikimedia Commons.</span></figcaption>
</figure>`;
}

// Images, the chart, and new-tab handling for links that leave the site.
function renderBody(html) {
  return html
    .replace(/<!-- figure:(\w+) -->/g, (_, key) => figure(key))
    .replace('<!-- chart -->', daveChart())
    .replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
}

function postCard(p) {
  return `<li class="post-card">
        <a href="/blog/${p.slug}/">
          <span class="thumb"><img src="${coverOf(p)}" width="1200" height="630" alt="" loading="lazy" decoding="async"></span>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description)}</p>
        </a>
      </li>`;
}

function renderPost(post) {
  const path = `/blog/${post.slug}/`;
  const related = sorted.filter((p) => p.slug !== post.slug).slice(0, 3);
  const body = renderBody(post.body);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated || post.date,
      mainEntityOfPage: `${SITE.url}${path}`,
      image: `${SITE.url}${coverOf(post)}`,
      author: { '@id': `${SITE.url}/#org` },
      publisher: { '@id': `${SITE.url}/#org` },
    },
    organization,
    breadcrumbs([['Home', '/'], ['Blog', '/blog/'], [post.title, path]]),
    faqSchema(post.faqs),
  ];

  return `<!doctype html>
<html lang="en">
<head>
  ${head({ title: `${post.title} | The Society of Daves`, description: post.description, path, ogType: 'article', image: coverOf(post), jsonLd })}
</head>
<body>
  ${header()}

  <main id="main">
    <article class="wrap article">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <a href="/blog/">Blog</a></nav>
      <header class="article-head">
        <h1>${esc(post.title)}</h1>
        <p class="dek">${esc(post.dek)}</p>
        <p class="byline">By the Society of Daves. <time datetime="${post.date}">${formatDate(post.date)}</time>. ${readingMinutes(post.body)} minute read.</p>
      </header>

      <figure class="post-cover">
        <img src="${coverOf(post)}" width="1200" height="630" alt="${esc(post.title)}" fetchpriority="high">
      </figure>

      <section class="takeaways" aria-labelledby="takeaways-title">
        <h2 id="takeaways-title">The short version</h2>
        <ul>
${post.takeaways.map((t) => `          <li>${esc(t)}</li>`).join('\n')}
        </ul>
      </section>

      <div class="prose">
${body}
      </div>

      <section class="article-faq" aria-labelledby="post-faq-title">
        <h2 id="post-faq-title">Frequently asked questions</h2>
        ${faqList(post.faqs)}
      </section>

      <section class="sources" aria-labelledby="sources-title">
        <h2 id="sources-title">Sources</h2>
        <ul>
${post.sources.map(([name, url]) => `          <li><a href="${esc(url)}" rel="noopener">${esc(name)}</a></li>`).join('\n')}
        </ul>
        <p>Spotted a mistake? Email <a href="mailto:${SITE.email}">${SITE.email}</a> and we'll fix it.</p>
      </section>
    </article>

    <div class="wrap">${joinCta()}</div>

    <section class="wrap related" aria-labelledby="related-title">
      <h2 id="related-title">More from the Society</h2>
      <ul class="post-list">
      ${related.map(postCard).join('\n      ')}
      </ul>
    </section>
  </main>

  ${footer()}
</body>
</html>
`;
}

function renderIndex() {
  const description = 'Articles about the name Dave: what it means, how popular it is, famous Daves, David in other languages, St David\'s Day and gifts for Daves.';
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'The Society of Daves blog',
      url: `${SITE.url}/blog/`,
      description,
      publisher: { '@id': `${SITE.url}/#org` },
      blogPost: sorted.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE.url}/blog/${p.slug}/`, datePublished: p.date })),
    },
    organization,
    breadcrumbs([['Home', '/'], ['Blog', '/blog/']]),
  ];
  return `<!doctype html>
<html lang="en">
<head>
  ${head({ title: 'The Dave Blog | The Society of Daves', description, path: '/blog/', jsonLd })}
</head>
<body>
  ${header()}

  <main id="main">
    <section class="blog-hero">
      <div class="dave-wall" aria-hidden="true"></div>
      <div class="wrap">
        <h1>The Dave Blog</h1>
        <p>Research, history and gift advice about the name Dave, published by the Society. Members get the best of it in The Dave Dispatch every month.</p>
      </div>
    </section>
    <section class="wrap blog-list" aria-label="All posts">
      <ul class="post-list">
      ${sorted.map(postCard).join('\n      ')}
      </ul>
    </section>
    <div class="wrap">${joinCta()}</div>
  </main>

  ${footer()}
</body>
</html>
`;
}

function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    ['/', today], ['/gift', today], ['/blog/', sorted[0].date],
    ...sorted.map((p) => [`/blog/${p.slug}/`, p.updated || p.date]),
    ['/privacy', '2026-10-26'], ['/terms', '2026-10-26'],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([path, lastmod]) => `  <url><loc>${SITE.url}${path}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
}

function renderRss() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>The Society of Daves blog</title>
  <link>${SITE.url}/blog/</link>
  <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>
  <description>Articles about the name Dave.</description>
  <language>en</language>
${sorted.map((p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${SITE.url}/blog/${p.slug}/</link>
    <guid>${SITE.url}/blog/${p.slug}/</guid>
    <pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate>
    <description>${esc(p.description)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`;
}

// llms.txt: a plain summary of the site for AI assistants and answer engines.
function renderLlms() {
  return `# The Society of Daves

> A parody members' club for people called Dave, with accurate information about the name Dave/David. Membership costs $1 a month and includes The Dave Dispatch, a monthly email newsletter about the name Dave.

Key facts:
- Dave is short for David, from the Hebrew Dawid, usually translated as "beloved".
- David was the most popular US boys' name in 1960 (85,929 births, SSA data). It peaked in the 1950s and ranked 31st in 2024.
- St David's Day, for the patron saint of Wales, is on 1 March.
- Membership: $1/month via Stripe, cancel any time at ${SITE.url}/api/manage. Contact: ${SITE.email}.
- Gift memberships: $6 for 6 months or $12 for 12 months, paid once, delivered by email on Christmas Day or a chosen date: ${SITE.url}/gift

## Pages
- [Home](${SITE.url}/): what the Society is, facts about the name Dave, notable Daves, membership
- [Blog](${SITE.url}/blog/)
- [Gift membership](${SITE.url}/gift): give 6 or 12 months of The Dave Dispatch, delivered on Christmas Day

## Articles
${sorted.map((p) => `- [${p.title}](${SITE.url}/blog/${p.slug}/): ${p.description}`).join('\n')}

## Policies
- [Privacy](${SITE.url}/privacy)
- [Terms](${SITE.url}/terms)
`;
}

// Replaces the content between <!-- build:NAME --> and <!-- /build:NAME -->.
function fillRegion(html, name, content) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`);
  if (!re.test(html)) throw new Error(`index.html is missing the build:${name} markers`);
  return html.replace(re, `$1\n${content}\n$2`);
}

// Refreshes the generated regions of a hand-written page. The FAQ structured
// data is built from the page's visible FAQ, so the two never drift apart.
async function buildPage(file, { ld = [], regions = {} }) {
  const path = join(PUBLIC, file);
  let html = await readFile(path, 'utf8');

  const faqBlock = html.match(/<!-- faq:start -->([\s\S]*?)<!-- faq:end -->/)?.[1] || '';
  const faqs = [...faqBlock.matchAll(/<summary>([\s\S]*?)<\/summary>\s*<div class="faq-body">([\s\S]*?)<\/div>/g)]
    .map(([, q, a]) => ({ q: stripTags(q), a: stripTags(a) }));

  const allLd = [...ld, ...(faqs.length ? [faqSchema(faqs)] : [])];
  html = fillRegion(html, 'jsonld', allLd.map((d) => `  <script type="application/ld+json">${JSON.stringify(d)}</script>`).join('\n'));
  for (const [name, content] of Object.entries(regions)) html = fillRegion(html, name, content);
  await writeFile(path, html);
  return faqs.length;
}

const faqCount = await buildPage('index.html', {
  ld: [
    organization,
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: `${SITE.url}/`, publisher: { '@id': `${SITE.url}/#org` } },
  ],
  regions: {
    chart: daveChart(),
    latest: `<ul class="post-list">\n      ${sorted.slice(0, 3).map(postCard).join('\n      ')}\n      </ul>`,
  },
});
await buildPage('gift.html', { ld: [organization, breadcrumbs([['Home', '/'], ['Give a gift', '/gift']])] });
await write('blog/index.html', renderIndex());
for (const post of posts) await write(`blog/${post.slug}/index.html`, renderPost(post));
await write('sitemap.xml', renderSitemap());
await write('rss.xml', renderRss());
await write('llms.txt', renderLlms());

console.log(`Built ${posts.length} posts, blog index, sitemap, RSS, llms.txt; homepage FAQ schema has ${faqCount} questions.`);
