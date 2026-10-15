// Prints the outlet, register, user and tax IDs needed for the website's Lightspeed settings.
// Usage:  LS_DOMAIN_PREFIX=candysmokeshop LS_TOKEN=xxxx node scripts/lightspeed-ids.mjs
const { LS_DOMAIN_PREFIX: prefix, LS_TOKEN: token } = process.env;
if (!prefix || !token) {
  console.error('Set LS_DOMAIN_PREFIX and LS_TOKEN first (see README).');
  process.exit(1);
}

async function get(path) {
  const res = await fetch(`https://${prefix}.retail.lightspeed.app/api${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return (await res.json()).data || [];
}

const sections = [
  ['Outlets (LS_OUTLET_ID)', '/2.0/outlets', r => r.name],
  ['Registers (LS_REGISTER_ID)', '/2.0/registers', r => `${r.name}  outlet=${r.outlet_id}`],
  ['Users (LS_USER_ID — the staff account web orders are filed under)', '/2.0/users', r => `${r.display_name || r.username}  ${r.account_type || ''}`],
  ['Taxes (LS_TAX_ID)', '/2.0/taxes', r => `${r.name}  rate=${r.rate}`],
];

for (const [title, path, label] of sections) {
  console.log(`\n${title}`);
  for (const row of await get(path)) console.log(`  ${row.id}  ${label(row)}`);
}
