// Lightspeed Retail (R-Series) client.
// Docs: https://developers.lightspeedhq.com/retail/
//
// Auth is OAuth: the shop owner approves the website once (/api/lightspeed/connect),
// and we keep the tokens in the LS_KV namespace. Access tokens last ~1 hour; refresh
// tokens rotate on every use and expire after 30 days unused, so the latest pair must
// always be saved back to KV.

const AUTH = 'https://cloud.lightspeedapp.com/auth/oauth';
const API = 'https://api.lightspeedapp.com/API/V3';
// The narrower pair (employee:inventory_read + employee:register) was rejected with
// invalid_scope for this account; employee:all is limited to the approving user's own rights.
export const SCOPES = 'employee:all';

const TOKENS_KEY = 'ls:tokens';
const ACCOUNT_KEY = 'ls:account';
const CATALOG_KEY = 'ls:catalog';
const CATALOG_TTL = 180; // seconds before a cached catalog is refreshed in the background
const CATALOG_KEEP = 7 * 24 * 3600; // a stale copy is still served while the refresh runs
const REFRESH_LOCK_KEY = 'ls:catalog:refreshing';
const SALES_KEY = 'ls:sales';
const SALES_DAYS = 45; // window of completed sales used to rank best sellers
const SALES_MAX_AGE = 20 * 3600 * 1000; // re-rank roughly once a day

export function hasClient(env) {
  return Boolean(env.LS_CLIENT_ID && env.LS_CLIENT_SECRET && env.LS_KV);
}

export async function isConnected(env) {
  return hasClient(env) && Boolean(await env.LS_KV.get(TOKENS_KEY));
}

export function authorizeUrl(env, state) {
  const q = new URLSearchParams({ response_type: 'code', client_id: env.LS_CLIENT_ID, scope: SCOPES, state });
  return `${AUTH}/authorize?${q}`;
}

async function tokenRequest(env, body) {
  const res = await fetch(`${AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.LS_CLIENT_ID, client_secret: env.LS_CLIENT_SECRET, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Lightspeed token request failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  const tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  await env.LS_KV.put(TOKENS_KEY, JSON.stringify(tokens));
  return tokens;
}

// Called once from the OAuth callback.
export async function exchangeCode(env, code) {
  await tokenRequest(env, { grant_type: 'authorization_code', code });
  const acct = await api(env, '/Account.json');
  const account = one(acct.Account);
  await env.LS_KV.put(ACCOUNT_KEY, JSON.stringify({ id: account.accountID, name: account.name }));
  await env.LS_KV.delete(CATALOG_KEY);
  return account;
}

let refreshing = null; // de-dupes refreshes within one worker instance

async function accessToken(env) {
  const tokens = JSON.parse((await env.LS_KV.get(TOKENS_KEY)) || 'null');
  if (!tokens) throw new Error('Lightspeed is not connected. Visit /api/lightspeed/connect.');
  if (tokens.expires_at - Date.now() > 5 * 60 * 1000) return tokens.access_token;
  refreshing ||= tokenRequest(env, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token })
    .finally(() => { refreshing = null; });
  return (await refreshing).access_token;
}

async function accountId(env) {
  if (env.LS_ACCOUNT_ID) return env.LS_ACCOUNT_ID;
  const acct = JSON.parse((await env.LS_KV.get(ACCOUNT_KEY)) || 'null');
  if (!acct) throw new Error('Lightspeed account ID unknown. Reconnect at /api/lightspeed/connect.');
  return acct.id;
}

// path is either absolute (a pagination "next" URL) or relative to /API/V3.
async function api(env, path, init = {}, retry = true) {
  const url = path.startsWith('http') ? path : API + path;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken(env)}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (res.status === 429 && retry) { // leaky-bucket rate limit
    await new Promise(r => setTimeout(r, 1500));
    return api(env, path, init, false);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Lightspeed ${init.method || 'GET'} ${url} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export async function accountApi(env, path, init) {
  return api(env, `/Account/${await accountId(env)}${path}`, init);
}

// Follows the cursor-based "next" links until every page is read.
async function listAll(env, path, key) {
  const out = [];
  let page = await accountApi(env, path);
  for (let i = 0; i < 200; i++) {
    out.push(...many(page[key]));
    const next = page['@attributes'] && page['@attributes'].next;
    if (!next) break;
    page = await api(env, next);
  }
  return out;
}

// Single related records come back as an object, multiple as an array.
function many(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }
function one(v) { return Array.isArray(v) ? v[0] : v; }

function csvSet(value) {
  return new Set((value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}

function imageUrl(item) {
  const img = many(item.Images && item.Images.Image)[0];
  if (!img || !img.baseImageURL || !img.publicID) return null;
  return `${img.baseImageURL}w_500,c_limit/${img.publicID}.jpg`;
}

function defaultPrice(item) {
  const prices = many(item.Prices && item.Prices.ItemPrice);
  const p = prices.find(x => x.useType === 'Default') || prices[0];
  return p ? Number(p.amount) : 0;
}

async function fetchCatalog(env) {
  const rel = encodeURIComponent(JSON.stringify(['ItemShops', 'Category', 'Images']));
  const items = await listAll(env, `/Item.json?archived=false&limit=100&load_relations=${rel}`, 'Item');

  const hidden = csvSet(env.SHOP_HIDDEN_CATEGORIES);
  const minStock = Number(env.SHOP_MIN_STOCK || 1);
  const ecomOnly = env.SHOP_ECOM_ONLY === 'true';

  return items
    .filter(it => !ecomOnly || it.publishToEcom === 'true')
    .map(it => {
      const shops = many(it.ItemShops && it.ItemShops.ItemShop);
      // shopID "0" is the all-locations total; prefer the configured shop.
      const shop = shops.find(s => s.shopID === String(env.LS_SHOP_ID)) || shops.find(s => s.shopID === '0');
      const category = (it.Category && it.Category.name) || 'Other';
      return {
        id: it.itemID,
        name: it.description,
        sku: it.customSku || it.systemSku || '',
        category,
        price: defaultPrice(it),
        image: imageUrl(it),
        stock: shop ? Number(shop.qoh) : 0,
      };
    })
    .filter(p => p.stock >= minStock && p.price > 0)
    .filter(p => !hidden.has(p.category.toLowerCase()))
    .map(({ stock, ...p }) => ({ ...p, lowStock: stock === 1 }));
}

// Items in stock at the shop, cached in KV so we stay well under Lightspeed's rate limit.
// Reading every item takes ~30s, so visitors always get the cached copy right away; once it is
// older than CATALOG_TTL, a refresh runs in the background (waitUntil) for the next visitor.
export async function getCatalog(env, { fresh = false, waitUntil } = {}) {
  if (!fresh) {
    const cached = await env.LS_KV.get(CATALOG_KEY, 'json');
    if (cached && Array.isArray(cached.products)) {
      if (waitUntil && Date.now() - cached.at > CATALOG_TTL * 1000) waitUntil(refreshInBackground(env));
      return cached.products;
    }
  }
  return refreshCatalog(env);
}

let refreshingCatalog = null; // de-dupes refreshes within one worker instance

function refreshCatalog(env) {
  refreshingCatalog ||= fetchCatalog(env)
    .then(async products => {
      await env.LS_KV.put(CATALOG_KEY, JSON.stringify({ at: Date.now(), products }), { expirationTtl: CATALOG_KEEP });
      return products;
    })
    .finally(() => { refreshingCatalog = null; });
  return refreshingCatalog;
}

// A short KV lock keeps other worker instances from starting the same refresh.
async function refreshInBackground(env) {
  if (refreshingCatalog || await env.LS_KV.get(REFRESH_LOCK_KEY)) return;
  await env.LS_KV.put(REFRESH_LOCK_KEY, '1', { expirationTtl: 60 });
  try { await refreshCatalog(env); } catch (err) { console.error(err); }
  finally { await env.LS_KV.delete(REFRESH_LOCK_KEY); }
}

// Units sold per item over the last SALES_DAYS of completed, non-voided sales.
// The website uses it to put what customers actually buy first.
export async function getSalesRanking(env) {
  return env.LS_KV.get(SALES_KEY, 'json');
}

// Runs from the cron trigger (worker.js), where a long, rate-limited read is fine.
export async function refreshSalesRanking(env, { force = false } = {}) {
  const current = await getSalesRanking(env);
  if (!force && current && Date.now() - current.at < SALES_MAX_AGE) return current;
  const since = new Date(Date.now() - SALES_DAYS * 864e5).toISOString();
  const rel = encodeURIComponent(JSON.stringify(['SaleLines']));
  const units = {};
  let sales = 0;
  let page = await accountApi(env, `/Sale.json?completed=true&voided=false&completeTime=${encodeURIComponent('>,' + since)}&limit=100&load_relations=${rel}`);
  for (let i = 0; i < 400; i++) {
    for (const sale of many(page.Sale)) {
      sales++;
      for (const line of many(sale.SaleLines && sale.SaleLines.SaleLine)) {
        const qty = Number(line.unitQuantity) || 0;
        if (line.itemID && line.itemID !== '0' && qty > 0) units[line.itemID] = (units[line.itemID] || 0) + qty;
      }
    }
    const next = page['@attributes'] && page['@attributes'].next;
    if (!next) break;
    await new Promise(r => setTimeout(r, 1000)); // stay under the API's one-request-per-second drip rate
    page = await api(env, next);
  }
  const ranking = { at: Date.now(), days: SALES_DAYS, sales, units };
  await env.LS_KV.put(SALES_KEY, JSON.stringify(ranking));
  return ranking;
}

// Creates an open (not completed) sale for the website order. Staff find it in Lightspeed,
// check ID, take payment and complete it — inventory comes off the shelf only then.
export async function createPickupSale(env, { lines, customer, ref }) {
  if (!env.LS_SHOP_ID || !env.LS_REGISTER_ID || !env.LS_EMPLOYEE_ID) {
    throw new Error('LS_SHOP_ID, LS_REGISTER_ID and LS_EMPLOYEE_ID must be set before orders can be placed.');
  }
  const catalog = await getCatalog(env, { fresh: true });
  const byId = new Map(catalog.map(p => [p.id, p]));
  for (const line of lines) {
    if (!byId.has(line.id)) throw new UserError('An item in your cart just sold out. Please refresh and try again.');
  }

  const digits = customer.phone.replace(/\D/g, '');
  const sale = await accountApi(env, '/Sale.json', {
    method: 'POST',
    body: JSON.stringify({
      employeeID: env.LS_EMPLOYEE_ID,
      registerID: env.LS_REGISTER_ID,
      shopID: env.LS_SHOP_ID,
      completed: false,
      referenceNumber: `${ref} ${customer.name} ${digits}`.slice(0, 64),
      referenceNumberSource: 'Website curbside',
      SaleLines: { SaleLine: lines.map(l => ({ itemID: l.id, unitQuantity: l.qty })) },
    }),
  });

  const s = one(sale.Sale) || {};
  return { id: s.saleID, total: s.calcTotal != null ? Number(s.calcTotal) : null };
}

// For the setup page: the IDs the owner needs to copy into settings.
export async function describeAccount(env) {
  const out = {};
  for (const [label, path, key, fmt] of [
    ['Shops (LS_SHOP_ID)', '/Shop.json', 'Shop', r => `${r.shopID} — ${r.name}`],
    ['Registers (LS_REGISTER_ID)', '/Register.json', 'Register', r => `${r.registerID} — ${r.name} (shop ${r.shopID})`],
    ['Employees (LS_EMPLOYEE_ID)', '/Employee.json?archived=false', 'Employee', r => `${r.employeeID} — ${r.firstName} ${r.lastName}`],
  ]) {
    try {
      out[label] = (await listAll(env, path, key)).map(fmt);
    } catch (err) {
      out[label] = [`Couldn't read this list (${err.message.slice(0, 80)}). Look it up in Lightspeed settings instead.`];
    }
  }
  return out;
}

export class UserError extends Error {}
