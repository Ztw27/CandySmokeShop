// GET /api/products — live catalog from Lightspeed (cached briefly), grouped into departments.
import { getCatalog, getSalesRanking, isConnected } from '../_lib/lightspeed.js';
import { demoCatalog } from '../_lib/demo.js';
import { DEPARTMENTS, classify } from '../_lib/departments.js';

export async function onRequestGet({ env, waitUntil }) {
  const demo = !(await isConnected(env));
  try {
    const [raw, ranking] = demo ? [demoCatalog, null] : await Promise.all([getCatalog(env, { waitUntil }), getSalesRanking(env)]);
    const products = raw.map(p => ({ ...p, ...classify(p.category) }));
    const departments = ranking ? rankBySales(products, ranking.units) : DEPARTMENTS;
    return json({ demo, ranked: !!ranking, departments, products }, demo ? {} : { 'Cache-Control': 'public, max-age=60' });
  } catch (err) {
    console.error(err);
    return json({ error: 'Our online menu is temporarily unavailable. Call us at (816) 326-8122.' }, {}, 502);
  }
}

// Like a planogram: best sellers at eye level. Items get a sales rank (1 = top seller) rather than
// raw unit counts, and departments are ordered by units sold, with "More" always last.
function rankBySales(products, units) {
  products.filter(p => units[p.id]).sort((a, b) => units[b.id] - units[a.id]).forEach((p, i) => { p.rank = i + 1; });
  const sold = {};
  for (const p of products) sold[p.dept] = (sold[p.dept] || 0) + (units[p.id] || 0);
  return [...DEPARTMENTS].sort((a, b) => (a.id === 'more') - (b.id === 'more') || (sold[b.id] || 0) - (sold[a.id] || 0));
}

function json(body, headers = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
