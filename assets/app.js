(() => {
  const $ = id => document.getElementById(id);
  const money = n => '$' + Number(n).toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const page = $('page');
  const finePointer = matchMedia('(hover: hover)').matches;
  const goShop = () => $('shop').scrollIntoView({ behavior: 'smooth' });

  // ─── Age gate (remembered for 30 days); the page behind it is inert until confirmed ───
  const gate = $('ageGate');
  const verified = store.get('ageOk', 0);
  if (verified && Date.now() - verified < 30 * 864e5) gate.classList.add('gone');
  else { page.inert = true; $('agYes').focus(); }
  $('agYes').addEventListener('click', () => { store.set('ageOk', Date.now()); gate.classList.add('gone'); page.inert = false; });

  // ─── Nav ───
  const nav = $('mainNav');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });
  const menuBtn = $('menuBtn');
  const openMenu = open => { nav.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.innerHTML = `<svg class="i"><use href="#i-${open ? 'x' : 'menu'}"/></svg>`; };
  menuBtn.addEventListener('click', () => openMenu(!nav.classList.contains('menu-open')));
  $('navLinks').addEventListener('click', e => { if (e.target.closest('a')) openMenu(false); });

  // ─── Hours ───
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // The shop's local time, whatever time zone the visitor is in.
  const kc = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const today = days[kc.getDay()];
  const hours = [
    ['Monday', '10:00 AM', '10:00 PM'], ['Tuesday', '10:00 AM', '10:00 PM'], ['Wednesday', '10:00 AM', '10:00 PM'],
    ['Thursday', '10:00 AM', '10:00 PM'], ['Friday', '10:00 AM', '11:00 PM', true], ['Saturday', '10:00 AM', '11:00 PM', true],
    ['Sunday', '11:00 AM', '9:00 PM'],
  ];
  const short = t => t.replace(':00', '');
  $('hoursList').innerHTML = hours.map(([d, o, c, late]) => `
    <div class="hours-row${d === today ? ' today' : ''}">
      <span class="hours-day">${d}</span><span class="hours-time">${short(o)} – ${short(c)}</span>
      ${late ? '<span class="pill pill-late">Late</span>' : ''}${d === today ? '<span class="pill pill-today">Today</span>' : ''}
    </div>`).join('');

  // "Open now" pill in the hero
  const mins = t => { const [, h, m, ap] = t.match(/(\d+):(\d+) (AM|PM)/); return (h % 12 + (ap === 'PM' ? 12 : 0)) * 60 + +m; };
  const hoursFor = d => hours.find(h => h[0] === d);
  const [, openT, closeT] = hoursFor(today);
  const nowMins = kc.getHours() * 60 + kc.getMinutes();
  const pill = $('openStatus');
  if (nowMins >= mins(openT) && nowMins < mins(closeT)) {
    pill.classList.add('open');
    pill.innerHTML = `<span class="status-dot"></span><span><b>Open now</b> · until ${short(closeT)}</span>`;
  } else {
    const opensToday = nowMins < mins(openT);
    const next = opensToday ? openT : hoursFor(days[(kc.getDay() + 1) % 7])[1];
    pill.classList.add('closed');
    pill.innerHTML = `<span class="status-dot"></span><span><b>Closed</b> · opens ${short(next)}${opensToday ? '' : ' tomorrow'}</span>`;
  }

  // ─── Catalog ───
  const PAGE = 24;
  const BEST = 40; // the top sellers by recent sales get a "Best seller" badge
  let products = [];
  let byId = new Map();
  let departments = [];
  let dept = 'all';
  let sub = 'all';
  let query = '';
  let sort = 'featured';
  let shown = PAGE;

  // Placeholder cards hold the grid's shape while the live inventory loads.
  $('grid').innerHTML = Array.from({ length: 8 }, () =>
    '<div class="product skel" aria-hidden="true"><div class="product-img"></div><div class="skel-line" style="width:40%"></div><div class="skel-line" style="width:85%"></div></div>').join('');

  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      products = (data.products || []).map(p => ({ ...p, sub: p.sub || p.category, dept: p.dept || 'more' }));
      byId = new Map(products.map(p => [p.id, p]));
      const deptNames = new Map((data.departments || []).map(d => [d.id, d.name]));
      for (const p of products) p.haystack = `${p.name} ${p.sku} ${p.sub} ${deptNames.get(p.dept) || ''}`.toLowerCase();
      departments = (data.departments || []).filter(d => products.some(p => p.dept === d.id));
      $('demoNote').classList.toggle('show', !!data.demo);
      if (data.ranked) $('sort').options[0].text = 'Sort: Best sellers';
      if (!data.demo) {
        // Departments arrive ordered by demand (sales, or stock depth until sales are readable); the hero's quick picks follow.
        $('quick').innerHTML = '<span class="quick-label">Popular:</span>' + departments.filter(d => d.id !== 'more').slice(0, 4)
          .map(d => `<button class="chip" data-dept="${esc(d.id)}">${esc(d.name)}</button>`).join('');
      }
      if (products.length >= 100) {
        const n = `${(Math.floor(products.length / 100) * 100).toLocaleString()}+`;
        $('statItems').textContent = n;
        $('heroQ').placeholder = `Search ${n} items in stock`;
      }
      pruneCart();
      render();
    } catch (err) {
      $('grid').innerHTML = `<div class="shop-status">${esc(err.message || "Our online menu isn't available right now.")} You can still call us at (816) 326-8122.</div>`;
    }
    $('grid').removeAttribute('aria-busy');
  }

  const countBy = (list, key) => list.reduce((m, p) => m.set(p[key], (m.get(p[key]) || 0) + 1), new Map());

  function renderDepts() {
    const counts = countBy(products, 'dept');
    const tiles = [{ id: 'all', name: 'Everything', count: products.length },
      ...departments.map(d => ({ ...d, count: counts.get(d.id) || 0 }))];
    $('depts').innerHTML = tiles.map(d => `
      <button class="dept${d.id === dept ? ' active' : ''}" aria-pressed="${d.id === dept}" data-dept="${esc(d.id)}">
        <span class="dept-name">${esc(d.name)}</span>
        <span class="dept-count">${d.count.toLocaleString()}</span>
      </button>`).join('');
    // Keep the chosen department in view (e.g. after picking it from the hero).
    const active = deptRow.querySelector('.active');
    if (active) deptRow.scrollLeft = Math.max(0, active.offsetLeft - deptRow.offsetLeft - 40);
    updateDeptArrows();
  }

  // Arrow buttons show only when there's more of the department row to scroll to.
  const deptRow = $('depts');
  function updateDeptArrows() {
    $('deptPrev').hidden = deptRow.scrollLeft < 4;
    $('deptNext').hidden = deptRow.scrollLeft + deptRow.clientWidth >= deptRow.scrollWidth - 4;
  }
  const scrollDepts = dir => deptRow.scrollBy({ left: dir * deptRow.clientWidth * 0.8, behavior: 'smooth' });
  $('deptPrev').addEventListener('click', () => scrollDepts(-1));
  $('deptNext').addEventListener('click', () => scrollDepts(1));
  deptRow.addEventListener('scroll', updateDeptArrows, { passive: true });
  addEventListener('resize', updateDeptArrows);

  function renderChips() {
    const chips = $('chips');
    if (dept === 'all') { chips.innerHTML = ''; return; }
    const inDept = products.filter(p => p.dept === dept);
    const subs = [...countBy(inDept, 'sub')].sort((a, b) => b[1] - a[1]);
    if (subs.length < 2) { chips.innerHTML = ''; return; }
    chips.innerHTML = [['all', inDept.length], ...subs].map(([s, n]) =>
      `<button class="chip${s === sub ? ' active' : ''}" aria-pressed="${s === sub}" data-sub="${esc(s)}">${s === 'all' ? 'All' : esc(s)}<small>${n}</small></button>`).join('');
  }

  function filtered() {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = products.filter(p =>
      (dept === 'all' || p.dept === dept) &&
      (sub === 'all' || p.sub === sub) &&
      words.every(w => p.haystack.includes(w)));
    const byName = (a, b) => a.name.localeCompare(b.name);
    const sorters = {
      featured: (a, b) => ((a.rank || 1e9) - (b.rank || 1e9)) || (!!b.image - !!a.image) || byName(a, b),
      'price-asc': (a, b) => a.price - b.price || byName(a, b),
      'price-desc': (a, b) => b.price - a.price || byName(a, b),
      name: byName,
    };
    return list.sort(sorters[sort] || sorters.featured);
  }

  function renderGrid() {
    const list = filtered();
    const grid = $('grid');
    const more = $('moreBtn');
    $('resultCount').innerHTML = list.length
      ? `Showing <b>${Math.min(shown, list.length).toLocaleString()}</b> of <b>${list.length.toLocaleString()}</b>`
      : '';
    if (!list.length) {
      // Never a dead end: widen the search, or point to someone who can help.
      const narrowed = query && (dept !== 'all' || sub !== 'all');
      grid.innerHTML = narrowed
        ? `<div class="shop-status">No results for “${esc(query)}” in this department.<br/><button class="btn btn-line" data-all>Search all departments</button></div>`
        : `<div class="shop-status">Nothing matches${query ? ` “${esc(query)}”` : ''}. Try a brand or product type, or call or text (816) 326-8122, and we'll try to get it for you.</div>`;
      more.hidden = true;
      return;
    }
    grid.innerHTML = list.slice(0, shown).map(p => `
      <article class="product">
        <div class="product-img">
          ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" />` : `<img class="ph" src="assets/candy-mark.png" alt="" loading="lazy" />`}
          ${p.rank <= BEST || p.lowStock ? `<div class="badges">${p.rank <= BEST ? '<span class="badge badge-hot">Best seller</span>' : ''}${p.lowStock ? '<span class="badge badge-low">Last one!</span>' : ''}</div>` : ''}
        </div>
        <div class="product-body">
          <span class="product-cat">${esc(p.sub)}</span>
          <div class="product-name">${esc(p.name)}</div>
          <div class="product-foot">
            <span class="price">${money(p.price)}</span>
            <button class="btn add-btn" data-add="${esc(p.id)}" aria-label="Add ${esc(p.name)} to cart">Add</button>
          </div>
        </div>
      </article>`).join('');
    more.hidden = list.length <= shown;
    more.textContent = `Show more (${(list.length - shown).toLocaleString()} left)`;
  }

  function render() { if (products.length) { renderDepts(); renderChips(); renderGrid(); } }

  $('depts').addEventListener('click', e => {
    const b = e.target.closest('[data-dept]');
    if (!b) return;
    dept = b.dataset.dept; sub = 'all'; shown = PAGE;
    render();
  });
  $('chips').addEventListener('click', e => {
    const b = e.target.closest('[data-sub]');
    if (!b) return;
    sub = b.dataset.sub; shown = PAGE;
    renderChips(); renderGrid();
  });
  $('sort').addEventListener('change', e => { sort = e.target.value; shown = PAGE; renderGrid(); });
  let t;
  $('search').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); }); // hides the phone keyboard
  $('search').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => { query = e.target.value.trim(); shown = PAGE; if (products.length) renderGrid(); }, 150);
  });
  $('moreBtn').addEventListener('click', () => { shown += PAGE; renderGrid(); });
  $('grid').addEventListener('click', e => {
    if (e.target.closest('[data-all]')) { dept = 'all'; sub = 'all'; shown = PAGE; render(); return; }
    const b = e.target.closest('[data-add]');
    if (!b) return;
    addToCart(b.dataset.add);
    b.textContent = 'Added ✓'; b.classList.add('added');
    setTimeout(() => { b.textContent = 'Add'; b.classList.remove('added'); }, 1200);
  });

  // Hero search and popular departments jump straight into the shop.
  $('heroSearch').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('heroQ').value.trim();
    $('heroQ').blur();
    $('search').value = q; query = q; dept = 'all'; sub = 'all'; shown = PAGE;
    render(); goShop();
  });
  $('quick').addEventListener('click', e => {
    const b = e.target.closest('[data-dept]');
    if (!b) return;
    dept = b.dataset.dept; sub = 'all'; query = ''; $('search').value = ''; shown = PAGE;
    render(); goShop();
  });

  // ─── Cart ───
  let cart = store.get('cart', {}); // { productId: qty }

  function pruneCart() {
    for (const id of Object.keys(cart)) if (!byId.has(id)) delete cart[id];
    saveCart();
  }
  function saveCart() { store.set('cart', cart); renderCart(); }
  function addToCart(id) {
    cart[id] = Math.min(20, (cart[id] || 0) + 1);
    saveCart();
    confirmAdd(byId.get(id));
  }
  function cartLines() { return Object.entries(cart).filter(([id]) => byId.has(id)).map(([id, qty]) => ({ p: byId.get(id), qty })); }

  // Feedback for "Add": the cart badge and phone cart bar pulse, plus a toast on desktop.
  let toastT;
  const bump = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  function confirmAdd(p) {
    bump($('cartCount')); bump($('cartBar'));
    $('toastText').textContent = `Added ${p.name}`;
    $('toast').classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => $('toast').classList.remove('show'), 3500);
  }
  $('toastView').addEventListener('click', () => openCart(true));

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const total = lines.reduce((n, l) => n + l.qty * l.p.price, 0);
    const badge = $('cartCount');
    badge.textContent = count;
    badge.classList.toggle('show', count > 0);
    $('cartTotal').textContent = money(total);
    $('toCheckout').disabled = !count;
    $('cartBar').hidden = !count;
    document.body.classList.toggle('has-bar', count > 0);
    $('cbCount').textContent = `${count} item${count === 1 ? '' : 's'}`;
    $('cbTotal').textContent = money(total);
    $('cartLines').innerHTML = lines.length ? lines.map(({ p, qty }) => `
      <div class="line">
        <div class="line-name">${esc(p.name)}<small>${money(p.price)} each</small></div>
        <div class="qty">
          <button data-dec="${esc(p.id)}" aria-label="Remove one ${esc(p.name)}">−</button><span>${qty}</span><button data-inc="${esc(p.id)}" aria-label="Add one ${esc(p.name)}">+</button>
        </div>
      </div>`).join('') : `
      <div class="cart-empty">
        <p>Your cart is empty.</p>
        <button class="btn btn-line" data-browse>Browse the shop</button>
        <small>Looking for something we don't list? Call or text <a href="tel:8163268122">(816) 326-8122</a>.</small>
      </div>`;
    $('coSummary').innerHTML = lines.map(({ p, qty }) => `<div class="row"><span>${qty} × ${esc(p.name)}</span><span>${money(qty * p.price)}</span></div>`).join('') +
      `<div class="row total"><span>Subtotal (plus tax; pay at pickup)</span><span>${money(total)}</span></div>`;
  }

  $('cartLines').addEventListener('click', e => {
    if (e.target.closest('[data-browse]')) { openCart(false); goShop(); return; }
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (inc) cart[inc.dataset.inc] = Math.min(20, cart[inc.dataset.inc] + 1);
    if (dec && --cart[dec.dataset.dec] <= 0) delete cart[dec.dataset.dec];
    if (inc || dec) saveCart();
  });

  // ─── Drawer: the cart, then curbside details, without leaving the page ───
  const drawer = $('drawer'), scrim = $('scrim');
  let lastFocus = null;
  function showView(view) {
    const co = view === 'checkout';
    $('cartLines').hidden = co; $('cartFoot').hidden = co;
    $('coView').hidden = !co; $('coBack').hidden = !co;
    $('drawerTitle').textContent = co ? 'Curbside details' : 'Your cart';
    $('coView').scrollTop = 0;
    // On phones, focusing a field would pop the keyboard over the summary, so focus the heading instead.
    const target = co && finePointer ? $('fName') : $('drawerTitle');
    setTimeout(() => target.focus(), 60); // after the drawer becomes visible
  }
  const openCart = (open, view) => {
    if (open === drawer.classList.contains('open')) { if (open) showView(view || 'cart'); return; }
    if (open) lastFocus = document.activeElement;
    drawer.classList.toggle('open', open); scrim.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('locked', open);
    page.inert = open;
    if (open) {
      openMenu(false); $('toast').classList.remove('show');
      if ($('coConfirm').classList.contains('show')) { $('coConfirm').classList.remove('show'); $('coForm').hidden = false; }
      showView(view || 'cart');
    } else if (lastFocus && lastFocus.focus) {
      lastFocus.focus();
    }
  };
  $('cartOpen').addEventListener('click', () => openCart(true));
  $('cartBar').addEventListener('click', () => openCart(true));
  $('cartClose').addEventListener('click', () => openCart(false));
  $('coDone').addEventListener('click', () => openCart(false));
  scrim.addEventListener('click', () => openCart(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) openCart(false); });
  $('toCheckout').addEventListener('click', () => showView('checkout'));
  $('coBack').addEventListener('click', () => showView('cart'));
  $('startOrder').addEventListener('click', () => { if (cartLines().length) openCart(true, 'checkout'); else goShop(); });

  // ─── Checkout ───
  const form = $('orderForm');
  $('fPhone').addEventListener('blur', e => {
    const d = e.target.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (d.length === 10) e.target.value = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  });
  const markBad = (el, bad) => { el.classList.toggle('bad', bad); if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); };
  const clearBad = e => { if (e.target.classList.contains('bad')) markBad(e.target, false); };
  form.addEventListener('input', clearBad);
  form.addEventListener('change', clearBad);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('coError');
    const f = {
      name: $('fName').value.trim(), phone: $('fPhone').value.trim(),
      vehicle: $('fVehicle').value.trim(), eta: $('fEta').value,
      notes: $('fNotes').value.trim(), website: $('fWebsite').value,
      ageConfirmed: $('fAge').checked,
    };
    const lines = cartLines().map(l => ({ id: l.p.id, qty: l.qty }));

    const bad = [];
    if (!f.name) bad.push('fName');
    if (f.phone.replace(/\D/g, '').length < 10) bad.push('fPhone');
    if (!f.eta) bad.push('fEta');
    ['fName', 'fPhone', 'fEta'].forEach(id => markBad($(id), bad.includes(id)));
    if (bad.length) { err.textContent = 'Please enter your name, a 10-digit phone number, and your arrival time.'; $(bad[0]).focus(); return; }
    if (!lines.length) { err.textContent = 'Your cart is empty. Add an item first.'; return; }
    if (!f.ageConfirmed) { err.textContent = 'Please confirm you are 21 or older.'; $('fAge').focus(); return; }

    err.textContent = '';
    const btn = $('coSubmit');
    btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, lines }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      cart = {}; saveCart();
      form.reset();
      $('coForm').hidden = true; $('coBack').hidden = true;
      $('drawerTitle').textContent = 'Curbside pickup';
      $('coConfirm').classList.add('show');
      $('coRef').textContent = `Order ${data.ref}${data.demo ? ' (preview, not sent to the store)' : ''} · ETA ${f.eta}`;
      $('coDone').focus();
    } catch (ex) {
      err.textContent = ex.message + ' You can also call (816) 326-8122.';
    }
    btn.disabled = false; btn.textContent = 'Place curbside order';
  });

  renderCart();
  loadProducts();
})();
