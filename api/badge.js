// GET /api/badge?name=Steve -> the badge as a PNG (1200x630).
// Add &download=1 to save it as a file instead of showing it.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { badgeElement, cleanName } from '../lib/badge.js';

const require = createRequire(import.meta.url);
const font = (file) => readFile(require.resolve(`@fontsource/${file}`));

// Loaded once per warm function instance.
const fonts = Promise.all([
  font('permanent-marker/files/permanent-marker-latin-400-normal.woff'),
  font('archivo/files/archivo-latin-400-normal.woff'),
  font('archivo/files/archivo-latin-700-normal.woff'),
  font('archivo/files/archivo-latin-800-normal.woff'),
  font('archivo/files/archivo-latin-900-normal.woff'),
]).then(([marker, a400, a700, a800, a900]) => [
  { name: 'Marker', data: marker, weight: 400, style: 'normal' },
  { name: 'Archivo', data: a400, weight: 400, style: 'normal' },
  { name: 'Archivo', data: a700, weight: 700, style: 'normal' },
  { name: 'Archivo', data: a800, weight: 800, style: 'normal' },
  { name: 'Archivo', data: a900, weight: 900, style: 'normal' },
]);

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const name = cleanName(params.get('name'));
  const headers = {
    // The same name always makes the same picture, so let Vercel's CDN keep it.
    'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
  };
  if (params.get('download')) {
    headers['Content-Disposition'] = 'attachment; filename="society-of-daves-badge.png"';
  }
  const svg = await satori(badgeElement(name), { width: 1200, height: 630, fonts: await fonts });
  const png = new Resvg(svg).render().asPng();
  return new Response(png, { headers: { 'Content-Type': 'image/png', ...headers } });
}
