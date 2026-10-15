// POST /api/orders — places a curbside pickup order as a parked sale in Lightspeed.
import { createPickupSale, isConfigured, UserError } from '../_lib/lightspeed.js';

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

  try {
    let ref;
    if (!isConfigured(env)) {
      ref = 'DEMO-' + Date.now().toString(36).toUpperCase();
    } else if (lines.length) {
      const sale = await createPickupSale(env, { lines, customer });
      ref = sale.number || sale.id.slice(0, 8).toUpperCase();
    } else {
      ref = 'REQ-' + Date.now().toString(36).toUpperCase(); // special request only, nothing to ring up yet
    }

    await notifyStaff(env, ref, customer, lines).catch(err => console.error('notify failed', err));
    return json({ ok: true, ref, demo: !isConfigured(env) });
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 409);
    console.error(err);
    return json({ error: "We couldn't place your order online. Please call (816) 326-8122." }, 502);
  }
}

// Optional ping to a Slack/Discord channel so staff notice new orders immediately.
async function notifyStaff(env, ref, c, lines) {
  if (!env.ORDER_NOTIFY_WEBHOOK) return;
  const text = [
    `🍬 New curbside order ${ref}`,
    `${c.name} · ${c.phone}${c.vehicle ? ' · ' + c.vehicle : ''}${c.eta ? ' · ETA ' + c.eta : ''}`,
    lines.length ? `${lines.reduce((n, l) => n + l.qty, 0)} item(s) — parked sale in Lightspeed` : 'Special request (no cart items)',
    c.notes && `Notes: ${c.notes}`,
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
