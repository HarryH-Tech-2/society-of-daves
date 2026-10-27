// GET /badge/<name> (rewritten to /api/share?name=<name> in vercel.json).
// Serves the preview tags for a shared badge, then forwards to the homepage.

import { cleanName, sharePage } from '../lib/badge.js';

export function GET(request) {
  const name = cleanName(new URL(request.url).searchParams.get('name'));
  const siteUrl = process.env.SITE_URL || new URL(request.url).origin;
  return new Response(sharePage(siteUrl, name), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
