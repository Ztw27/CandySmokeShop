// Tiny HTML pages for the one-time Lightspeed setup screens.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function page(title, bodyHtml, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#1a0f10;color:#fbf4ee;margin:0;padding:32px 16px;line-height:1.6}
  main{max-width:720px;margin:0 auto}
  h1{color:#ffe600;font-size:1.6rem}
  h2{font-size:1.05rem;margin-top:28px;color:#b98cff}
  code,li{font-family:ui-monospace,Consolas,monospace;font-size:.92rem}
  .ok{color:#3cae49;font-weight:700}.bad{color:#ff6b70;font-weight:700}
  a{color:#ffe600}
  .btn{display:inline-block;margin-top:12px;padding:12px 22px;border-radius:999px;background:#e3242b;color:#fff;text-decoration:none;font-weight:700}
</style></head><body><main>${bodyHtml}</main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function list(sections) {
  return Object.entries(sections).map(([label, rows]) =>
    `<h2>${esc(label)}</h2><ul>${rows.map(r => `<li>${esc(r)}</li>`).join('') || '<li>(none)</li>'}</ul>`).join('');
}

export function keyOk(env, request) {
  const key = new URL(request.url).searchParams.get('key');
  return Boolean(env.SETUP_KEY && key && key === env.SETUP_KEY);
}

export { esc };
