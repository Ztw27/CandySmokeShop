// GET /api/lightspeed/callback — Lightspeed redirects here after the owner approves.
// Must match the Redirect URI registered for the API client.
import { exchangeCode, describeAccount } from '../../_lib/lightspeed.js';
import { page, list, esc } from '../../_lib/setup-page.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)ls_state=([^;]+)/);

  if (!code || !state || !cookie || cookie[1] !== state) {
    return page('Connection failed', `<h1>Connection failed</h1>
      <p class="bad">This link expired or didn't come from the connect page. Start again from <code>/api/lightspeed/connect?key=…</code>.</p>`, 400);
  }

  try {
    const account = await exchangeCode(env, code); // the code is only valid for 60 seconds
    const ids = await describeAccount(env);
    return new Response((await page('Lightspeed connected', `
      <h1>✅ Lightspeed connected</h1>
      <p>Account: <b>${esc(account.name)}</b> (ID <code>${esc(account.accountID)}</code>)</p>
      <p>Copy the right numbers below into Cloudflare → Settings → Variables, then redeploy:</p>
      ${list(ids)}
      <p>After that, the shop on your website shows live inventory, and orders go into Lightspeed.</p>`)).body, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': 'ls_state=; Path=/api/lightspeed; Max-Age=0',
      },
    });
  } catch (err) {
    console.error(err);
    return page('Connection failed', `<h1>Connection failed</h1><p class="bad">${esc(err.message)}</p>
      <p>Try again from the connect page. If it keeps failing, double-check LS_CLIENT_ID and LS_CLIENT_SECRET.</p>`, 502);
  }
}
