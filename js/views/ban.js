'use strict';
/* Bán hàng: lưới món, giỏ, khuyến mãi, chốt đơn, danh sách đơn */
const PAY = { cash: 'Tiền mặt', bank: 'Chuyển khoản' };

const Cart = {
  lines() {
    return S.cart.map(c => {
      const p = Store.get('products', c.pid); const v = p && p.variants.find(x => x.id === c.vid);
      return v ? { p, v, qty: c.qty } : null;
    }).filter(Boolean);
  },
  count(pid) { return S.cart.filter(c => !pid || c.pid === pid).reduce((s, c) => s + c.qty, 0); },
  add(pid, vid, d = 1) {
    const c = S.cart.find(x => x.pid === pid && x.vid === vid);
    if (c) c.qty += d; else if (d > 0) S.cart.push({ pid, vid, qty: d });
    S.cart = S.cart.filter(x => x.qty > 0);
    Cart.bar();
    const b = $('#bdg-' + pid);
    if (b) { const n = Cart.count(pid); b.textContent = n; b.classList.toggle('hidden', !n); }
  },
  /* Tính tiền: tạm tính, khuyến mãi, giảm tay, tổng */
  sum() {
    const lines = Cart.lines();
    const subtotal = lines.reduce((s, l) => s + l.v.price * l.qty, 0);
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
    const s = Cart.sum();
    el.classList.remove('hidden');
    el.innerHTML = `<button data-act="cart-open"><span class="cnt">${n}</span><span>Xem đơn</span><b class="num">${money(s.total)}</b></button>`;
  },
  open() {
    const s = Cart.sum();
    if (!s.lines.length) { UI.closeSheet(); return; }
    const today = ymd();
    const promos = Store.all('promos').filter(pr => Calc.promoDiscount(pr, s.lines, today) > 0);
    UI.sheet(`<h2>Đơn hàng</h2>
      ${s.lines.map(l => `<div class="row" style="padding:8px 0">
        <div class="grow"><div class="bold">${esc(l.p.name)}</div><div class="muted small">${esc(l.v.name)} · ${money(l.v.price)}</div></div>
        <button class="qtybtn" data-act="cart-qty" data-p="${l.p.id}" data-v="${l.v.id}" data-d="-1">−</button>
        <b class="num" style="min-width:22px;text-align:center">${l.qty}</b>
        <button class="qtybtn" data-act="cart-qty" data-p="${l.p.id}" data-v="${l.v.id}" data-d="1">＋</button>
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
      <div class="line total"><span>Tổng thu</span><span class="num">${money(s.total)}</span></div></div>`;
  },
  checkout() {
    const s = Cart.sum();
    if (!s.lines.length) return;
    const order = {
      date: ymd(), time: Date.now(), pay: S.pay,
      items: s.lines.map(l => ({
        pid: l.p.id, vid: l.v.id, name: l.p.name, vname: l.v.name, price: l.v.price, qty: l.qty,
        cost: Math.round(Calc.variantCost(l.v)),
        recipe: (l.v.recipe || []).filter(r => r.qty > 0 && Store.get('ingredients', r.ingId))
          .map(r => ({ ingId: r.ingId, raw: Calc.rawQty(Store.get('ingredients', r.ingId), r.qty) })),
      })),
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
};

Views.ban = () => {
  const cats = ['Tất cả', ...new Set(Ban.prods().map(p => p.category || 'Khác'))];
  if (!cats.includes(S.cat)) S.cat = 'Tất cả';
  return {
    title: Store.setting('shopName', 'Bán hàng'),
    titleHtml: (Store.setting('logo', '') ? `<img class="logo-sm" src="${Store.setting('logo', '')}" alt="">` : '') + `<span>${esc(Store.setting('shopName', 'Bán hàng'))}</span>`,
    right: `<a class="hbtn" href="#/don">Đơn hôm nay</a>`,
    html: `${!License.state.activated && License.state.daysLeft <= 3 ? `<a class="note" style="display:block;margin:0 0 10px" href="#/caidat">Còn ${License.state.daysLeft} ngày dùng thử · Bấm để kích hoạt bản quyền</a>` : ''}
      ${Store.setting('cover', '') ? `<div class="cover"><img src="${Store.setting('cover', '')}" alt=""><div class="cv-t"><b>${esc(Store.setting('shopName', ''))}</b><span>${esc(Store.setting('slogan', ''))}</span></div></div>` : ''}
      <div class="search">${icon('search')}<input type="search" placeholder="Tìm món" value="${esc(S.q)}" data-in="ban-q"></div>
      <div class="chips">${cats.map(c => `<button class="chip ${c === S.cat ? 'on' : ''}" data-act="ban-cat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div id="ban-grid">${Ban.gridHtml()}</div>`,
  };
};
Inputs['ban-q'] = el => { S.q = el.value; $('#ban-grid').innerHTML = Ban.gridHtml(); };

Actions['ban-cat'] = el => { S.cat = el.dataset.v; render(); };
Actions['ban-add'] = el => {
  const p = Store.get('products', el.dataset.id);
  if (p.variants.length === 1) { Cart.add(p.id, p.variants[0].id); return; }
  UI.sheet(`<h2>${esc(p.name)}</h2><p class="muted">Chọn size</p>
    ${p.variants.map(v => `<button class="btn soft" data-act="ban-pick" data-p="${p.id}" data-v="${v.id}">${esc(v.name)} · ${money(v.price)}</button>`).join('')}`);
};
Actions['ban-pick'] = el => { Cart.add(el.dataset.p, el.dataset.v); UI.closeSheet(); };
Actions['cart-open'] = () => Cart.open();
Actions['cart-qty'] = el => { Cart.add(el.dataset.p, el.dataset.v, +el.dataset.d); Cart.open(); if (!Cart.count()) render(); };
Actions['cart-pay'] = el => { S.pay = el.dataset.v; $$('.seg button', $('#sheet')).forEach(b => b.classList.toggle('on', b === el)); };
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
    const d = new Date(o.time);
    const row = (a, b, cls = '') => `<div class="b-row ${cls}"><span>${a}</span><span>${b}</span></div>`;
    const addr = Store.setting('billAddr', ''), phone = Store.setting('billPhone', ''), foot = Store.setting('billFoot', 'Cảm ơn quý khách!');
    return `<div class="bill w${Store.setting('billW', '58')}">
      ${Store.setting('logo', '') ? `<img class="b-logo" src="${Store.setting('logo', '')}" alt="">` : ''}
      <div class="b-c b-name">${esc(Store.setting('shopName', ''))}</div>
      ${addr ? `<div class="b-c">${esc(addr)}</div>` : ''}${phone ? `<div class="b-c">ĐT: ${esc(phone)}</div>` : ''}
      <div class="b-hr"></div>
      ${row(`${dmy(o.date)} ${pad(d.getHours())}:${pad(d.getMinutes())}`, 'Số ' + pad(no))}
      <div class="b-hr"></div>
      ${o.items.map(it => `<div>${esc(it.name)}${it.vname ? ' (' + esc(it.vname) + ')' : ''}</div>${row(`${it.qty} x ${Math.round(it.price).toLocaleString('vi-VN')}`, Math.round(it.price * it.qty).toLocaleString('vi-VN'))}`).join('')}
      <div class="b-hr"></div>
      ${o.discount ? row('Tạm tính', Math.round(o.subtotal).toLocaleString('vi-VN')) + row(esc(o.promoName || 'Giảm giá'), '-' + Math.round(o.discount).toLocaleString('vi-VN')) : ''}
      ${row('TỔNG CỘNG', money(o.total), 'b-total')}
      ${row('Thanh toán', PAY[o.pay] || '')}
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
