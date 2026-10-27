// Cloudflare Worker entry: routes /api/* to the handlers in functions/api,
// and serves the static site (index.html, assets/) for everything else.
import * as products from './functions/api/products.js';
import * as orders from './functions/api/orders.js';
import * as connect from './functions/api/lightspeed/connect.js';
import * as callback from './functions/api/lightspeed/callback.js';
import * as status from './functions/api/lightspeed/status.js';
import { isConnected, refreshSalesRanking } from './functions/_lib/lightspeed.js';

const routes = {
  '/api/products': products,
  '/api/orders': orders,
  '/api/lightspeed/connect': connect,
  '/api/lightspeed/callback': callback,
  '/api/lightspeed/status': status,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const mod = routes[pathname.replace(/\/$/, '')];
    if (!mod) return env.ASSETS.fetch(request);

    const method = request.method.charAt(0) + request.method.slice(1).toLowerCase();
    const handler = mod[`onRequest${method}`];
    if (!handler) return new Response('Method not allowed', { status: 405 });

    return handler({ request, env, waitUntil: p => ctx.waitUntil(p) });
  },

  // Cron (wrangler.jsonc): re-rank best sellers from recent sales about once a day.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      if (await isConnected(env)) await refreshSalesRanking(env);
    })().catch(err => console.error('sales ranking failed', err)));
  },
};
