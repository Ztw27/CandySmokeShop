// GET /api/lightspeed/status?key=SETUP_KEY — checks the connection and shows the configured IDs.
import { isConnected, hasClient, getCatalog, describeAccount } from '../../_lib/lightspeed.js';
import { page, list, keyOk, esc } from '../../_lib/setup-page.js';

export async function onRequestGet({ request, env }) {
  if (!keyOk(env, request)) return page('Not allowed', '<h1>Not allowed</h1>', 403);

  const missing = ['LS_CLIENT_ID', 'LS_CLIENT_SECRET', 'LS_SHOP_ID', 'LS_REGISTER_ID', 'LS_EMPLOYEE_ID']
    .filter(k => !env[k]);
  if (!env.LS_KV) missing.push('LS_KV (KV namespace binding)');
  const connectLink = `/api/lightspeed/connect?key=${encodeURIComponent(new URL(request.url).searchParams.get('key'))}`;

  if (!hasClient(env) || !(await isConnected(env))) {
    return page('Lightspeed status', `<h1>Lightspeed: <span class="bad">not connected</span></h1>
      ${missing.length ? `<p>Missing settings: <code>${missing.map(esc).join(', ')}</code></p>` : ''}
      ${hasClient(env) ? `<a class="btn" href="${esc(connectLink)}">Connect Lightspeed</a>` : ''}`);
  }

  try {
    const catalog = await getCatalog(env, { fresh: true });
    const ids = await describeAccount(env);
    return page('Lightspeed status', `<h1>Lightspeed: <span class="ok">connected</span></h1>
      <p><b>${catalog.length}</b> products are in stock and showing on the website.</p>
      ${missing.length ? `<p class="bad">Still missing: <code>${missing.map(esc).join(', ')}</code> — orders can't be placed until these are set.</p>` : '<p class="ok">All order settings are filled in.</p>'}
      <p>Current: shop <code>${esc(env.LS_SHOP_ID || '—')}</code>, register <code>${esc(env.LS_REGISTER_ID || '—')}</code>, employee <code>${esc(env.LS_EMPLOYEE_ID || '—')}</code></p>
      ${list(ids)}
      <p><a href="${esc(connectLink)}">Reconnect Lightspeed</a></p>`);
  } catch (err) {
    return page('Lightspeed status', `<h1>Lightspeed: <span class="bad">error</span></h1><p>${esc(err.message)}</p>
      <a class="btn" href="${esc(connectLink)}">Reconnect Lightspeed</a>`, 502);
  }
}
