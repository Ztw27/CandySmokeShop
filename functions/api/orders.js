// POST /api/orders — places a curbside pickup order as an open (unpaid) sale in Lightspeed.
import { createPickupSale, getCatalog, isConnected, UserError } from '../_lib/lightspeed.js';
import { demoCatalog } from '../_lib/demo.js';

const MAX_LINES = 30;
const MAX_QTY = 20;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  // Honeypot: real visitors never fill this hidden field.
  if (body.website) return json({ ok: true, ref: 'OK' });

  const customer = {
    name: clean(body.name, 60),
    phone: clean(body.phone, 30),
    vehicle: clean(body.vehicle, 80),
    eta: clean(body.eta, 40),
    notes: clean(body.notes, 500),
  };
  const lines = (Array.isArray(body.lines) ? body.lines : [])
    .slice(0, MAX_LINES)
    .map(l => ({ id: String(l.id || ''), qty: Math.min(MAX_QTY, Math.max(1, parseInt(l.qty, 10) || 1)) }))
    .filter(l => l.id);

  if (!customer.name || customer.phone.replace(/\D/g, '').length < 10) {
    return json({ error: 'Please enter your name and a 10-digit phone number.' }, 400);
  }
  if (!body.ageConfirmed) {
    return json({ error: 'You must confirm you are 21 or older.' }, 400);
  }
  if (!lines.length && !customer.notes) {
    return json({ error: 'Add something to your cart or tell us what you need.' }, 400);
  }

  const connected = await isConnected(env);
  // A request with no cart items only reaches staff through the order-alert webhook.
  if (connected && !lines.length && !env.ORDER_NOTIFY_WEBHOOK) {
    return json({ error: "Special requests can't be sent online yet. Please call or text (816) 326-8122." }, 400);
  }
  const ref = (connected ? 'WEB-' : 'DEMO-') + Date.now().toString(36).toUpperCase().slice(-6);
  try {
    let saleId = null;
    if (connected && lines.length) {
      saleId = (await createPickupSale(env, { lines, customer, ref })).id;
    }
    // The sale already exists at this point, so a failed name lookup must not report the order as failed.
    const catalog = connected ? await getCatalog(env).catch(() => []) : demoCatalog;
    const names = new Map(catalog.map(p => [p.id, p.name]));
    const items = lines.map(l => `${l.qty} × ${names.get(l.id) || 'item ' + l.id}`);

    await notifyStaff(env, { ref, saleId, customer, items }).catch(err => console.error('notify failed', err));
    return json({ ok: true, ref, demo: !connected });
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 409);
    console.error(err);
    return json({ error: "We couldn't place your order online. Please call (816) 326-8122." }, 502);
  }
}

// Ping a Slack/Discord channel so staff see new orders right away, with the
// vehicle and ETA details that don't fit on the Lightspeed sale.
async function notifyStaff(env, { ref, saleId, customer: c, items }) {
  if (!env.ORDER_NOTIFY_WEBHOOK) return;
  const text = [
    `🍬 New curbside order ${ref}${saleId ? ` (Lightspeed sale #${saleId})` : ''}`,
    `${c.name} · ${c.phone}${c.vehicle ? ' · ' + c.vehicle : ''}${c.eta ? ' · ETA ' + c.eta : ''}`,
    ...(items.length ? items : ['Special request (no cart items)']),
    c.notes && `Notes: ${c.notes}`,
    'Check ID (21+) before handing over.',
  ].filter(Boolean).join('\n');
  await fetch(env.ORDER_NOTIFY_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text }), // Slack uses `text`, Discord uses `content`
  });
}

function clean(v, max) {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
