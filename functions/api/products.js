// GET /api/products — live catalog from Lightspeed (cached briefly at the edge).
import { getCatalog, isConfigured } from '../_lib/lightspeed.js';
import { demoCatalog } from '../_lib/demo.js';

const CACHE_SECONDS = 120;

export async function onRequestGet({ request, env, waitUntil }) {
  if (!isConfigured(env)) {
    return json({ demo: true, products: demoCatalog });
  }

  const cache = caches.default;
  const key = new Request(new URL('/api/products', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const products = await getCatalog(env);
    const res = json({ demo: false, products }, { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (err) {
    console.error(err);
    return json({ error: 'Our menu is temporarily unavailable. Call us at (816) 326-8122.' }, {}, 502);
  }
}

function json(body, headers = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
