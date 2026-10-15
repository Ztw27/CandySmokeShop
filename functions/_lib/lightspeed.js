// Lightspeed Retail (X-Series) client.
// Docs: https://x-series-api.lightspeedhq.com
// Auth: a personal access token created in Lightspeed under Setup → Personal tokens.
// Never expose these values to the browser — they only live in Cloudflare environment variables.

export function isConfigured(env) {
  return Boolean(env.LS_DOMAIN_PREFIX && env.LS_TOKEN);
}

function baseUrl(env) {
  return `https://${env.LS_DOMAIN_PREFIX}.retail.lightspeed.app/api`;
}

async function lsFetch(env, path, init = {}) {
  const res = await fetch(baseUrl(env) + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.LS_TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Lightspeed ${init.method || 'GET'} ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Walks a 2.0 collection endpoint using version-based pagination.
async function listAll(env, path) {
  const out = [];
  let after = 0;
  for (let i = 0; i < 50; i++) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await lsFetch(env, `${path}${sep}page_size=1000&after=${after}`);
    const rows = page.data || [];
    out.push(...rows);
    const max = page.version && page.version.max;
    if (!rows.length || !max || max === after) break;
    after = max;
  }
  return out;
}

function csvSet(value) {
  return new Set((value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}

function categoryOf(p) {
  if (p.product_category && p.product_category.name) return p.product_category.name;
  if (p.product_type && p.product_type.name) return p.product_type.name;
  if (Array.isArray(p.categories) && p.categories[0]) return p.categories[0].name;
  return 'Other';
}

// Products that are active, in stock at the shop's outlet, and not in a hidden category.
export async function getCatalog(env) {
  const [products, inventory] = await Promise.all([
    listAll(env, '/2.0/products'),
    listAll(env, '/2.0/inventory'),
  ]);

  const stock = new Map();
  for (const row of inventory) {
    if (env.LS_OUTLET_ID && row.outlet_id !== env.LS_OUTLET_ID) continue;
    const qty = Number(row.inventory_level ?? row.current_amount ?? 0);
    stock.set(row.product_id, (stock.get(row.product_id) || 0) + qty);
  }

  const hidden = csvSet(env.SHOP_HIDDEN_CATEGORIES);
  const minStock = Number(env.SHOP_MIN_STOCK || 1);

  return products
    .filter(p => p.is_active !== false && !p.deleted_at)
    .filter(p => !p.has_variants || p.variant_parent_id) // list sellable variants, not the parent shell
    .map(p => ({
      id: p.id,
      name: p.variant_name || p.name,
      sku: p.sku || '',
      category: categoryOf(p),
      price: Number(p.price_including_tax ?? p.price_excluding_tax ?? 0),
      priceExTax: Number(p.price_excluding_tax ?? 0),
      image: p.image_url && !/no-image/i.test(p.image_url) ? p.image_url : null,
      stock: stock.get(p.id) || 0,
    }))
    .filter(p => p.stock >= minStock && p.price > 0)
    .filter(p => !hidden.has(p.category.toLowerCase()))
    .map(({ stock, ...p }) => ({ ...p, lowStock: stock <= 3 }));
}

async function getTaxRate(env) {
  if (!env.LS_TAX_ID) return 0;
  const taxes = await lsFetch(env, '/2.0/taxes');
  const tax = (taxes.data || []).find(t => t.id === env.LS_TAX_ID);
  return tax ? Number(tax.rate) : 0;
}

// Creates a parked ("SAVED") sale tagged as a pickup. Staff open it on the register,
// check ID, take payment and complete it — so inventory, KPIs and compliance records stay in Lightspeed.
export async function createPickupSale(env, { lines, customer }) {
  const ids = new Set(lines.map(l => l.id));
  const catalog = (await getCatalog(env)).filter(p => ids.has(p.id));
  const byId = new Map(catalog.map(p => [p.id, p]));
  const taxRate = await getTaxRate(env);

  const saleLines = [];
  for (const line of lines) {
    const p = byId.get(line.id);
    if (!p) throw new UserError(`An item in your cart is no longer available. Please refresh and try again.`);
    const price = p.priceExTax || p.price / (1 + taxRate);
    saleLines.push({
      product_id: p.id,
      quantity: line.qty,
      price: round(price),
      tax: round(price * taxRate),
      ...(env.LS_TAX_ID ? { tax_id: env.LS_TAX_ID } : {}),
    });
  }

  const note = [
    `WEBSITE CURBSIDE ORDER — pay at pickup, CHECK ID (21+)`,
    `Name: ${customer.name}`,
    `Phone: ${customer.phone}`,
    customer.vehicle && `Vehicle: ${customer.vehicle}`,
    customer.eta && `ETA: ${customer.eta}`,
    customer.notes && `Notes: ${customer.notes}`,
  ].filter(Boolean).join('\n');

  const sale = await lsFetch(env, '/register_sales', {
    method: 'POST',
    body: JSON.stringify({
      register_id: env.LS_REGISTER_ID,
      user_id: env.LS_USER_ID,
      status: 'SAVED',
      state: 'parked',
      register_sale_attributes: ['pickup'],
      note,
      register_sale_products: saleLines,
    }),
  });

  const s = sale.register_sale || sale.data || sale;
  return { id: s.id, number: s.invoice_number || null };
}

export class UserError extends Error {}

const round = n => Math.round(n * 100) / 100;
