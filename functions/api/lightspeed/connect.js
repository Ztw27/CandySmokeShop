// GET /api/lightspeed/connect?key=SETUP_KEY — sends the owner to Lightspeed to approve the website.
import { authorizeUrl, hasClient } from '../../_lib/lightspeed.js';
import { page, keyOk } from '../../_lib/setup-page.js';

export async function onRequestGet({ request, env }) {
  if (!keyOk(env, request)) return page('Not allowed', '<h1>Not allowed</h1><p>Add <code>?key=</code> with your SETUP_KEY.</p>', 403);
  if (!hasClient(env)) {
    return page('Setup incomplete', `<h1>Almost there</h1>
      <p class="bad">LS_CLIENT_ID, LS_CLIENT_SECRET and the LS_KV binding must all be set in Cloudflare before connecting.</p>`, 500);
  }
  const state = crypto.randomUUID();
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl(env, state),
      'Set-Cookie': `ls_state=${state}; Path=/api/lightspeed; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
