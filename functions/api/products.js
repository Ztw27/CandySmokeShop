// GET /api/products — live catalog from Lightspeed (cached briefly).
import { getCatalog, isConnected } from '../_lib/lightspeed.js';
import { demoCatalog } from '../_lib/demo.js';

export async function onRequestGet({ env }) {
  if (!(await isConnected(env))) {
    return json({ demo: true, products: demoCatalog });
  }
  try {
    return json({ demo: false, products: await getCatalog(env) }, { 'Cache-Control': 'public, max-age=60' });
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
