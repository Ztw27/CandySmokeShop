(() => {
  const $ = id => document.getElementById(id);
  const money = n => '$' + Number(n).toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ─── Age gate (remembered for 30 days) ───
  const gate = $('ageGate');
  const verified = store.get('ageOk', 0);
  if (verified && Date.now() - verified < 30 * 864e5) gate.classList.add('gone');
  $('agYes').addEventListener('click', () => { store.set('ageOk', Date.now()); gate.classList.add('gone'); });

  // ─── Nav + reveal ───
  const nav = $('mainNav');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });
  const obs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('show'); obs.unobserve(e.target); }
  }), { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

  // ─── Ticker ───
  const tick = ['Glass Pipes', 'Vapes', 'Papers & Wraps', 'Hookahs', 'Concentrates', 'Kratom', '904 W 39th St KC', '4.9★ Rated', 'Curbside Pickup', 'Special Orders'];
  $('tickerTrack').innerHTML = [...tick, ...tick].map(t => `<span class="ticker-item">${t} ✦</span>`).join('');

  // ─── Hours ───
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  const hours = [
    ['Monday', '10:00 AM', '10:00 PM'], ['Tuesday', '10:00 AM', '10:00 PM'], ['Wednesday', '10:00 AM', '10:00 PM'],
    ['Thursday', '10:00 AM', '10:00 PM'], ['Friday', '10:00 AM', '11:00 PM', true], ['Saturday', '10:00 AM', '11:00 PM', true],
    ['Sunday', '11:00 AM', '9:00 PM'],
  ];
  $('hoursList').innerHTML = hours.map(([d, o, c, late]) => `
    <div class="hours-row${d === today ? ' today' : ''}">
      <span class="hours-day">${d}</span><span class="hours-time">${o} — ${c}</span>
      ${late ? '<span class="pill pill-late">Late</span>' : ''}${d === today ? '<span class="pill pill-today">Today</span>' : ''}
    </div>`).join('');

  // ─── Catalog ───
  const PAGE = 24;
  let products = [];
  let byId = new Map();
  let category = 'All';
  let query = '';
  let shown = PAGE;

  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      products = data.products || [];
      byId = new Map(products.map(p => [p.id, p]));
      $('demoNote').classList.toggle('show', !!data.demo);
      pruneCart();
      renderChips();
      renderGrid();
    } catch (err) {
      $('grid').innerHTML = `<div class="shop-status">${esc(err.message || "Our online menu isn't available right now.")} You can still place a request below or call (816) 326-8122.</div>`;
    }
  }

  function renderChips() {
    const cats = ['All', ...[...new Set(products.map(p => p.category))].sort()];
    $('chips').innerHTML = cats.map(c => `<button class="chip${c === category ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  }

  function filtered() {
    const q = query.toLowerCase();
    return products.filter(p =>
      (category === 'All' || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  }

  function renderGrid() {
    const list = filtered();
    const grid = $('grid');
    if (!list.length) {
      grid.innerHTML = `<div class="shop-status">Nothing matches that. Tell us what you need in the curbside form — we'll get it.</div>`;
      $('moreBtn').hidden = true;
      return;
    }
    grid.innerHTML = list.slice(0, shown).map(p => `
      <article class="product">
        <div class="product-img">
          ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" />` : `<img class="ph" src="assets/candy-mark.png" alt="" loading="lazy" />`}
          ${p.lowStock ? '<span class="low">Only a few left</span>' : ''}
        </div>
        <div class="product-body">
          <span class="product-cat">${esc(p.category)}</span>
          <div class="product-name">${esc(p.name)}</div>
          <div class="product-foot">
            <span class="price">${money(p.price)}</span>
            <button class="btn btn-green add-btn" data-add="${esc(p.id)}">Add</button>
          </div>
        </div>
      </article>`).join('');
    $('moreBtn').hidden = list.length <= shown;
  }

  $('chips').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    category = b.dataset.cat; shown = PAGE;
    renderChips(); renderGrid();
  });
  let t;
  $('search').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => { query = e.target.value.trim(); shown = PAGE; renderGrid(); }, 150);
  });
  $('moreBtn').addEventListener('click', () => { shown += PAGE; renderGrid(); });
  $('grid').addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    addToCart(b.dataset.add);
    b.textContent = 'Added ✓';
    setTimeout(() => { b.textContent = 'Add'; }, 1000);
  });

  // ─── Cart ───
  let cart = store.get('cart', {}); // { productId: qty }

  function pruneCart() {
    for (const id of Object.keys(cart)) if (!byId.has(id)) delete cart[id];
    saveCart();
  }
  function saveCart() { store.set('cart', cart); renderCart(); }
  function addToCart(id) { cart[id] = Math.min(20, (cart[id] || 0) + 1); saveCart(); }
  function cartLines() { return Object.entries(cart).filter(([id]) => byId.has(id)).map(([id, qty]) => ({ p: byId.get(id), qty })); }

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const total = lines.reduce((n, l) => n + l.qty * l.p.price, 0);
    const badge = $('cartCount');
    badge.textContent = count;
    badge.classList.toggle('show', count > 0);
    $('cartTotal').textContent = money(total);
    $('cartLines').innerHTML = lines.length ? lines.map(({ p, qty }) => `
      <div class="line">
        <div class="line-name">${esc(p.name)}<small>${money(p.price)} each</small></div>
        <div class="qty">
          <button data-dec="${esc(p.id)}" aria-label="Remove one">−</button><span>${qty}</span><button data-inc="${esc(p.id)}" aria-label="Add one">+</button>
        </div>
      </div>`).join('') : '<p class="shop-status">Your cart is empty.</p>';
    $('coSummary').innerHTML = lines.length
      ? lines.map(({ p, qty }) => `<div class="row"><span>${qty} × ${esc(p.name)}</span><span>${money(qty * p.price)}</span></div>`).join('') +
        `<div class="row total"><span>Subtotal (plus tax, pay at pickup)</span><span>${money(total)}</span></div>`
      : `<div class="empty">Your cart is empty — <a href="#shop">browse the shop</a>, or just tell us what you need below.</div>`;
  }

  $('cartLines').addEventListener('click', e => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (inc) cart[inc.dataset.inc] = Math.min(20, cart[inc.dataset.inc] + 1);
    if (dec && --cart[dec.dataset.dec] <= 0) delete cart[dec.dataset.dec];
    if (inc || dec) saveCart();
  });

  const drawer = $('drawer'), scrim = $('scrim');
  const openCart = open => {
    drawer.classList.toggle('open', open); scrim.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
  };
  $('cartOpen').addEventListener('click', () => openCart(true));
  $('cartClose').addEventListener('click', () => openCart(false));
  scrim.addEventListener('click', () => openCart(false));
  addEventListener('keydown', e => { if (e.key === 'Escape') openCart(false); });
  $('toCheckout').addEventListener('click', () => { openCart(false); $('curbside').scrollIntoView(); setTimeout(() => $('fName').focus(), 400); });

  // ─── Checkout ───
  $('orderForm').addEventListener('submit', async e => {
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
    ['fName', 'fPhone', 'fEta'].forEach(id => $(id).classList.toggle('bad', bad.includes(id)));
    if (bad.length) { err.textContent = 'Please fill in your name, a 10-digit phone number, and arrival time.'; return; }
    if (!lines.length && !f.notes) { err.textContent = 'Add something to your cart or tell us what you need.'; return; }
    if (!f.ageConfirmed) { err.textContent = 'Please confirm you are 21 or older.'; return; }

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
      $('coForm').hidden = true;
      $('coConfirm').classList.add('show');
      $('coRef').textContent = `Order ${data.ref}${data.demo ? ' (preview — not sent to store)' : ''} · ETA ${f.eta}`;
    } catch (ex) {
      err.textContent = ex.message + ' You can also call (816) 326-8122.';
      btn.disabled = false; btn.textContent = 'Place Curbside Order →';
    }
  });

  renderCart();
  loadProducts();
})();
