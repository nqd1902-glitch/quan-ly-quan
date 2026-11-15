'use strict';
/* Bán hàng: lưới món, chọn size + món bán kèm, giỏ, khuyến mãi, QR chuyển khoản, chốt đơn, danh sách đơn, bill */
const PAY = { cash: 'Tiền mặt', bank: 'Chuyển khoản' };

const Cart = {
  key(c) { return c.pid + '|' + c.vid + '|' + (c.tops || []).join(','); },
  lines() {
    return S.cart.map(c => {
      const p = Store.get('products', c.pid); const v = p && p.variants.find(x => x.id === c.vid);
      if (!v) return null;
      const tops = (c.tops || []).map(id => Store.get('toppings', id)).filter(Boolean);
      return { key: Cart.key(c), p, v, qty: c.qty, tops, price: v.price + tops.reduce((s, t) => s + (+t.price || 0), 0) };
    }).filter(Boolean);
  },
  count(pid) { return S.cart.filter(c => !pid || c.pid === pid).reduce((s, c) => s + c.qty, 0); },
  add(pid, vid, d = 1, tops = []) {
    const item = { pid, vid, qty: d, tops: [...tops].sort() };
    const c = S.cart.find(x => Cart.key(x) === Cart.key(item));
    if (c) c.qty += d; else if (d > 0) S.cart.push(item);
    Cart.after(pid);
  },
  bump(key, d) { const c = S.cart.find(x => Cart.key(x) === key); if (c) { c.qty += d; Cart.after(c.pid); } },
  after(pid) {
    S.cart = S.cart.filter(x => x.qty > 0);
    Cart.bar();
    const b = $('#bdg-' + pid);
    if (b) { const n = Cart.count(pid); b.textContent = n; b.classList.toggle('hidden', !n); }
  },
  /* Tính tiền: tạm tính, khuyến mãi, giảm tay, tổng */
  sum() {
    const lines = Cart.lines();
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const today = ymd();
    let promo = null;
    if (S.promoId === 'auto') promo = Calc.bestPromo(lines, today);
    else if (S.promoId !== 'none') promo = Store.get('promos', S.promoId);
    const promoDisc = promo ? Calc.promoDiscount(promo, lines, today) : 0;
    if (!promoDisc) promo = null;
    const discount = Math.min(subtotal, promoDisc + (S.manualDisc || 0));
    return { lines, subtotal, promo, promoDisc, discount, total: subtotal - discount };
  },
  bar() {
    const el = $('#cartbar');
    const onSale = (location.hash.replace(/^#\/?/, '') || 'ban') === 'ban' && $('#overlay').classList.contains('hidden');
    const n = Cart.count();
    if (!onSale || !n) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<button data-act="cart-open"><span class="cnt">${n}</span><span>Xem đơn</span><b class="num">${money(Cart.sum().total)}</b></button>`;
  },
  open() {
    const s = Cart.sum();
    if (!s.lines.length) { UI.closeSheet(); return; }
    const today = ymd();
    const promos = Store.all('promos').filter(pr => Calc.promoDiscount(pr, s.lines, today) > 0);
    UI.sheet(`<h2>Đơn hàng</h2>
      ${s.lines.map(l => `<div class="row" style="padding:8px 0">
        <div class="grow"><div class="bold">${esc(l.p.name)}</div><div class="muted small">${esc([l.v.name, ...l.tops.map(t => t.name)].filter(Boolean).join(' + '))} · ${money(l.price)}</div></div>
        <button class="qtybtn" data-act="cart-qty" data-k="${esc(l.key)}" data-d="-1">−</button>
        <b class="num" style="min-width:22px;text-align:center">${l.qty}</b>
        <button class="qtybtn" data-act="cart-qty" data-k="${esc(l.key)}" data-d="1">＋</button>
      </div>`).join('')}
      <label>Khuyến mãi
        <select data-in="cart-promo">
          <option value="auto" ${S.promoId === 'auto' ? 'selected' : ''}>Tự chọn mức giảm tốt nhất</option>
          <option value="none" ${S.promoId === 'none' ? 'selected' : ''}>Không áp dụng</option>
          ${promos.map(pr => `<option value="${pr.id}" ${S.promoId === pr.id ? 'selected' : ''}>${esc(pr.name)} (−${money(Calc.promoDiscount(pr, s.lines, today))})</option>`).join('')}
        </select></label>
      <label>Giảm thêm (đ)<input class="money" inputmode="numeric" data-in="cart-disc" value="${moneyVal(S.manualDisc)}" placeholder="0"></label>
      <label>Thanh toán</label>
      <div class="seg">${Object.keys(PAY).map(k => `<button class="${S.pay === k ? 'on' : ''}" data-act="cart-pay" data-v="${k}">${PAY[k]}</button>`).join('')}</div>
      <div id="cart-sum">${Cart.sumHtml(s)}</div>
      <button class="btn" data-act="cart-checkout">Chốt đơn</button>
      <button class="btn ghost" data-act="cart-clear">Xóa đơn này</button>`);
  },
  sumHtml(s) {
    return `<div style="margin-top:14px">
      <div class="line"><span class="muted">Tạm tính</span><span class="num">${money(s.subtotal)}</span></div>
      ${s.promo ? `<div class="line"><span class="muted">Khuyến mãi: ${esc(s.promo.name)}</span><span class="num">−${money(s.promoDisc)}</span></div>` : ''}
      ${S.manualDisc ? `<div class="line"><span class="muted">Giảm thêm</span><span class="num">−${money(Math.min(S.manualDisc, s.subtotal - s.promoDisc))}</span></div>` : ''}
      <div class="line total"><span>Tổng thu</span><span class="num">${money(s.total)}</span></div>
      ${S.pay === 'bank' ? (QRPay.ready() ? QRPay.box(s.total) : '<p class="muted small">Muốn hiện mã QR để khách quét: vào Thêm → Cài đặt → Chuyển khoản QR, nhập ngân hàng và số tài khoản.</p>') : ''}</div>`;
  },
  checkout() {
    const s = Cart.sum();
    if (!s.lines.length) return;
    const order = {
      date: ymd(), time: Date.now(), pay: S.pay,
      items: s.lines.map(l => {
        const rec = (l.v.recipe || []).filter(r => r.qty > 0 && Store.get('ingredients', r.ingId))
          .map(r => ({ ingId: r.ingId, raw: Calc.rawQty(Store.get('ingredients', r.ingId), r.qty) }));
        l.tops.forEach(t => { const ing = t.ingId && Store.get('ingredients', t.ingId); if (ing && t.qty > 0) rec.push({ ingId: ing.id, raw: Calc.rawQty(ing, t.qty) }); });
        return {
          pid: l.p.id, vid: l.v.id, name: l.p.name, vname: [l.v.name, ...l.tops.map(t => t.name)].filter(Boolean).join(' + '),
          price: l.price, qty: l.qty,
          cost: Math.round(Calc.variantCost(l.v) + l.tops.reduce((a, t) => a + Calc.toppingCost(t), 0)), recipe: rec,
        };
      }),
      subtotal: s.subtotal, discount: s.discount, promoName: s.promo ? s.promo.name : '', total: s.total,
    };
    order.cost = order.items.reduce((a, it) => a + it.cost * it.qty, 0);
    const neg = Calc.applyOrderStock(order, -1);
    Store.put('orders', order);
    S.cart = []; S.manualDisc = 0; S.promoId = 'auto';
    UI.closeSheet(); render();
    if (Store.setting('billAsk', true)) {
      UI.sheet(`<h2>Đã chốt đơn</h2>
        <div class="line total"><span>Tổng thu</span><span class="num">${money(order.total)}</span></div>
        ${neg.length ? `<div class="note">Kho đang âm: ${esc(neg.slice(0, 3).join(', '))}</div>` : ''}
        <div class="btns"><button class="btn soft" data-act="bill-print" data-id="${order.id}">In bill</button><button class="btn" data-act="sheet-close">Đơn mới</button></div>`);
    } else UI.toast(neg.length ? `Đã chốt ${money(order.total)} · Kho âm: ${neg.slice(0, 3).join(', ')}` : `Đã chốt đơn ${money(order.total)}`);
  },
};

const Ban = {
  prods() { return Store.all('products').filter(p => p.active !== false && p.name && p.variants.length); },
  topsFor(p) { return Store.all('toppings').filter(t => t.active !== false && t.name && (!t.cats || !t.cats.length || t.cats.includes(p.category || 'Khác'))); },
  gridHtml() {
    const q = S.q.trim().toLowerCase();
    const list = Ban.prods().filter(p => (S.cat === 'Tất cả' || (p.category || 'Khác') === S.cat) && (!q || p.name.toLowerCase().includes(q)));
    if (!list.length) return emptyBox('', q ? 'Không tìm thấy món nào khớp.' : 'Chưa có món nào đang bán.<br>Vào mục <b>Món</b> để thêm món và công thức.');
    return `<div class="grid">${list.map(p => {
      const prices = p.variants.map(v => v.price), min = Math.min(...prices), n = Cart.count(p.id);
      return `<button class="pcard" data-act="ban-add" data-id="${p.id}">
        ${thumb(p, 'ph')}<span class="bdg ${n ? '' : 'hidden'}" id="bdg-${p.id}">${n}</span>
        <span class="bd"><span class="nm">${esc(p.name)}</span>
        <span class="ft"><span class="pr num">${prices.length > 1 && Math.max(...prices) !== min ? '<small>từ </small>' : ''}${money(min)}</span><span class="plus">+</span></span></span></button>`;
    }).join('')}</div>`;
  },
  /* Bảng chọn size và món bán kèm trước khi thêm vào đơn */
  pickSheet() {
    const k = S.pick, p = Store.get('products', k.pid), v = p.variants.find(x => x.id === k.vid) || p.variants[0];
    const tops = Ban.topsFor(p);
    const total = v.price + tops.filter(t => k.tops.includes(t.id)).reduce((s, t) => s + (+t.price || 0), 0);
    UI.sheet(`<h2>${esc(p.name)}</h2>
      ${p.variants.length > 1 ? `<div class="sub">Chọn size</div>${p.variants.map(x => `<button class="opt ${x.id === v.id ? 'on' : ''}" data-act="pick-v" data-v="${x.id}"><span class="dot"></span><span class="grow">${esc(x.name)}</span><b class="num">${money(x.price)}</b></button>`).join('')}` : ''}
      ${tops.length ? `<div class="sub">Món bán kèm</div>${tops.map(t => `<button class="opt sq ${k.tops.includes(t.id) ? 'on' : ''}" data-act="pick-t" data-v="${t.id}"><span class="dot"></span><span class="grow">${esc(t.name)}</span><b class="num">+${money(t.price)}</b></button>`).join('')}` : ''}
      <button class="btn" data-act="pick-ok">Thêm vào đơn · ${money(total)}</button>`);
  },
};

Views.ban = () => {
  const cats = ['Tất cả', ...new Set(Ban.prods().map(p => p.category || 'Khác'))];
  if (!cats.includes(S.cat)) S.cat = 'Tất cả';
  const logo = Store.setting('logo', ''), cover = Store.setting('cover', ''), L = License.state;
  return {
    title: Store.setting('shopName', 'Bán hàng'),
    titleHtml: (logo ? `<img class="logo-sm" src="${logo}" alt="">` : '') + `<span>${esc(Store.setting('shopName', 'Bán hàng'))}</span>`,
    right: `<a class="hbtn" href="#/don">Đơn hôm nay</a>`,
    html: `${!L.activated && L.daysLeft <= 3 ? `<a class="note" style="display:block;margin:0 0 10px" href="#/caidat">Còn ${L.daysLeft} ngày dùng thử · Bấm để kích hoạt bản quyền</a>` : ''}
      ${cover ? `<div class="cover"><img src="${cover}" alt=""><div class="cv-t"><b>${esc(Store.setting('shopName', ''))}</b><span>${esc(Store.setting('slogan', ''))}</span></div></div>` : ''}
      <div class="search">${icon('search')}<input type="search" placeholder="Tìm món" value="${esc(S.q)}" data-in="ban-q"></div>
      <div class="chips">${cats.map(c => `<button class="chip ${c === S.cat ? 'on' : ''}" data-act="ban-cat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div id="ban-grid">${Ban.gridHtml()}</div>`,
  };
};
Inputs['ban-q'] = el => { S.q = el.value; $('#ban-grid').innerHTML = Ban.gridHtml(); };
Actions['ban-cat'] = el => { S.cat = el.dataset.v; render(); };
Actions['ban-add'] = el => {
  const p = Store.get('products', el.dataset.id);
  if (p.variants.length === 1 && !Ban.topsFor(p).length) { Cart.add(p.id, p.variants[0].id); return; }
  S.pick = { pid: p.id, vid: p.variants[0].id, tops: [] };
  Ban.pickSheet();
};
Actions['pick-v'] = el => { S.pick.vid = el.dataset.v; Ban.pickSheet(); };
Actions['pick-t'] = el => { const t = S.pick.tops, id = el.dataset.v; S.pick.tops = t.includes(id) ? t.filter(x => x !== id) : [...t, id]; Ban.pickSheet(); };
Actions['pick-ok'] = () => { Cart.add(S.pick.pid, S.pick.vid, 1, S.pick.tops); UI.closeSheet(); };
Actions['cart-open'] = () => Cart.open();
Actions['cart-qty'] = el => { Cart.bump(el.dataset.k, +el.dataset.d); Cart.open(); if (!Cart.count()) render(); };
Actions['cart-pay'] = el => { S.pay = el.dataset.v; Cart.open(); };
Actions['cart-clear'] = () => { S.cart = []; S.manualDisc = 0; UI.closeSheet(); render(); };
Actions['cart-checkout'] = () => Cart.checkout();
Inputs['cart-promo'] = el => { S.promoId = el.value; $('#cart-sum').innerHTML = Cart.sumHtml(Cart.sum()); Cart.bar(); };
Inputs['cart-disc'] = el => { S.manualDisc = parseMoney(el.value); $('#cart-sum').innerHTML = Cart.sumHtml(Cart.sum()); Cart.bar(); };

/* Danh sách đơn theo ngày */
Views.don = () => {
  const orders = Store.all('orders').filter(o => o.date === S.day).sort((a, b) => b.time - a.time);
  const ok = orders.filter(o => !o.cancelled);
  return {
    title: 'Đơn hàng', back: '#/ban', tab: 'ban',
    html: `<label>Ngày<input type="date" value="${S.day}" data-in="don-day"></label>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><div class="lb">Doanh thu</div><div class="v num">${money(ok.reduce((s, o) => s + o.total, 0))}</div></div>
        <div class="stat"><div class="lb">Số đơn</div><div class="v num">${ok.length}</div></div></div>
      ${orders.length ? orders.map(o => `<div class="card ${o.cancelled ? 'strike' : ''}">
        <div class="row"><b class="grow">${hm(o.time)} · ${PAY[o.pay] || ''}</b><b class="num">${money(o.total)}</b></div>
        ${o.items.map(it => `<div class="line small"><span>${it.qty} × ${esc(it.name)} <span class="muted">${esc(it.vname)}</span></span><span class="num">${money(it.price * it.qty)}</span></div>`).join('')}
        ${o.discount ? `<div class="line small muted"><span>${esc(o.promoName || 'Giảm giá')}</span><span class="num">−${money(o.discount)}</span></div>` : ''}
        ${o.cancelled ? '<span class="badge bad">Đã hủy</span>' : `<div class="row" style="margin-top:8px"><button class="btn sm soft" data-act="bill-print" data-id="${o.id}">In bill</button><button class="btn sm danger" data-act="don-cancel" data-id="${o.id}">Hủy đơn</button></div>`}
      </div>`).join('') : emptyBox('', 'Chưa có đơn nào trong ngày này.')}`,
  };
};
Inputs['don-day'] = el => { if (el.value) { S.day = el.value; render(); } };
Actions['don-cancel'] = el => UI.confirm('Hủy đơn này? Nguyên liệu sẽ được cộng lại vào kho.', 'Hủy đơn', () => {
  const o = Store.get('orders', el.dataset.id);
  if (!o || o.cancelled) return;
  o.cancelled = true; Calc.applyOrderStock(o, 1); Store.put('orders', o);
  render(); UI.toast('Đã hủy đơn');
});

/* Bill: dựng nội dung theo khổ giấy 58/80mm rồi gọi hộp thoại in của máy */
const Bill = {
  html(o) {
    const no = Store.all('orders').filter(x => x.date === o.date && x.time <= o.time).length;
    const d = new Date(o.time), n = v => Math.round(v).toLocaleString('vi-VN');
    const row = (a, b, cls = '') => `<div class="b-row ${cls}"><span>${a}</span><span>${b}</span></div>`;
    const addr = Store.setting('billAddr', ''), phone = Store.setting('billPhone', ''), foot = Store.setting('billFoot', 'Cảm ơn quý khách!');
    return `<div class="bill w${Store.setting('billW', '58')}">
      ${Store.setting('logo', '') ? `<img class="b-logo" src="${Store.setting('logo', '')}" alt="">` : ''}
      <div class="b-c b-name">${esc(Store.setting('shopName', ''))}</div>
      ${addr ? `<div class="b-c">${esc(addr)}</div>` : ''}${phone ? `<div class="b-c">ĐT: ${esc(phone)}</div>` : ''}
      <div class="b-hr"></div>
      ${row(`${dmy(o.date)} ${pad(d.getHours())}:${pad(d.getMinutes())}`, 'Số ' + pad(no))}
      <div class="b-hr"></div>
      ${o.items.map(it => `<div>${esc(it.name)}${it.vname ? ' (' + esc(it.vname) + ')' : ''}</div>${row(`${it.qty} x ${n(it.price)}`, n(it.price * it.qty))}`).join('')}
      <div class="b-hr"></div>
      ${o.discount ? row('Tạm tính', n(o.subtotal)) + row(esc(o.promoName || 'Giảm giá'), '-' + n(o.discount)) : ''}
      ${row('TỔNG CỘNG', money(o.total), 'b-total')}
      ${row('Thanh toán', PAY[o.pay] || '')}
      ${QRPay.ready() && Store.setting('billQR', true) ? `<div class="b-hr"></div><div class="b-c">Quét mã để chuyển khoản</div><div class="b-qr">${QR.svg(QRPay.payload(o.total, Store.setting('qrNote', 'Thanh toan don hang')), 132)}</div><div class="b-c">${esc(QRPay.bankName())} · ${esc(Store.setting('qrAcc', ''))}</div>` : ''}
      <div class="b-hr"></div>
      ${foot ? `<div class="b-c">${esc(foot)}</div>` : ''}</div>`;
  },
  print(id) {
    const o = Store.get('orders', id); if (!o) return;
    $('#print').innerHTML = Bill.html(o);
    setTimeout(() => window.print(), 50);
  },
};
Actions['bill-print'] = el => Bill.print(el.dataset.id);
