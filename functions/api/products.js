// GET /api/products — live catalog from Lightspeed (cached briefly), grouped into departments.
import { getCatalog, isConnected } from '../_lib/lightspeed.js';
import { demoCatalog } from '../_lib/demo.js';
import { DEPARTMENTS, classify } from '../_lib/departments.js';

export async function onRequestGet({ env }) {
  const demo = !(await isConnected(env));
  try {
    const raw = demo ? demoCatalog : await getCatalog(env);
    const products = raw.map(p => ({ ...p, ...classify(p.category) }));
    return json({ demo, departments: DEPARTMENTS, products }, demo ? {} : { 'Cache-Control': 'public, max-age=60' });
  } catch (err) {
    console.error(err);
    return json({ error: 'Our online menu is temporarily unavailable. Call us at (816) 326-8122.' }, {}, 502);
  }
}

function json(body, headers = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
