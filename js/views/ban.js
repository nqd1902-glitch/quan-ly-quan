'use strict';
/* Bán hàng: lưới món, chọn size + món bán kèm, giỏ, khuyến mãi, chốt đơn, danh sách đơn, bill */
const PAY = { cash: 'Tiền mặt', bank: 'Chuyển khoản', debt: 'Ghi nợ' };

const Cart = {
  key(c) { return c.pid + '|' + c.vid + '|' + (c.tops || []).join(','); },
  lines() { return Cart.linesOf(S.cart); },
  linesOf(cart) {
    return cart.map(c => {
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
    const pro = License.can(); // khuyến mãi và giảm thêm chỉ có ở bản nâng cấp
    if (pro && S.promoId === 'auto') promo = Calc.bestPromo(lines, today);
    else if (pro && S.promoId !== 'none') promo = Store.get('promos', S.promoId);
    const promoDisc = promo ? Calc.promoDiscount(promo, lines, today) : 0;
    if (!promoDisc) promo = null;
    const discount = Math.min(subtotal, promoDisc + (pro && Perm.can('discount') ? S.manualDisc || 0 : 0));
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
    const custs = Store.all('customers').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const tab = S.tabId && Store.get('tabs', S.tabId);
    UI.sheet(`<h2>${tab ? esc(tab.name) : 'Đơn hàng'}</h2>
      ${s.lines.map(l => `<div class="row" style="padding:8px 0">
        <div class="grow"><div class="bold">${esc(l.p.name)}</div><div class="muted small">${esc([l.v.name, ...l.tops.map(t => t.name)].filter(Boolean).join(' + '))} · ${money(l.price)}</div></div>
        <button class="qtybtn" data-act="cart-qty" data-k="${esc(l.key)}" data-d="-1">−</button>
        <b class="num" style="min-width:22px;text-align:center">${l.qty}</b>
        <button class="qtybtn" data-act="cart-qty" data-k="${esc(l.key)}" data-d="1">＋</button>
      </div>`).join('')}
      <label ${License.can() && Perm.can('debt') ? '' : 'hidden'}>Khách hàng
        <select data-in="cart-cust"><option value="">Khách lẻ</option>${custs.map(c => `<option value="${c.id}" ${S.custId === c.id ? 'selected' : ''}>${esc(c.name)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}<option value="__new">＋ Thêm khách mới…</option></select></label>
      <label ${License.can() ? '' : 'hidden'}>Khuyến mãi
        <select data-in="cart-promo">
          <option value="auto" ${S.promoId === 'auto' ? 'selected' : ''}>Tự chọn mức giảm tốt nhất</option>
          <option value="none" ${S.promoId === 'none' ? 'selected' : ''}>Không áp dụng</option>
          ${promos.map(pr => `<option value="${pr.id}" ${S.promoId === pr.id ? 'selected' : ''}>${esc(pr.name)} (−${money(Calc.promoDiscount(pr, s.lines, today))})</option>`).join('')}
        </select></label>
      <label ${License.can() && Perm.can('discount') ? '' : 'hidden'}>Giảm thêm (đ)<input class="money" inputmode="numeric" data-in="cart-disc" value="${moneyVal(S.manualDisc)}" placeholder="0"></label>
      <label>Thanh toán</label>
      <div class="seg">${Object.keys(PAY).filter(k => k !== 'debt' || (License.can() && Perm.can('debt'))).map(k => `<button class="${S.pay === k ? 'on' : ''}" data-act="cart-pay" data-v="${k}">${PAY[k]}</button>`).join('')}</div>
      <div id="cart-sum">${Cart.sumHtml(s)}</div>
      <button class="btn" data-act="cart-checkout">Chốt đơn</button>
      <div class="btns">${APP.has('tabs') && License.can() ? '<button class="btn soft" data-act="cart-hold">Lưu tạm</button>' : ''}<button class="btn ghost" data-act="cart-clear">Xóa đơn</button></div>`);
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
    const cust = S.custId && Store.get('customers', S.custId);
    if (S.pay === 'debt' && !cust) return UI.toast('Chọn khách hàng trước khi ghi nợ');
    const order = {
      date: ymd(), time: Date.now(), pay: S.pay, by: Sync.active() ? Sync.myName() : '', custId: cust ? cust.id : '', custName: cust ? cust.name : '',
      items: s.lines.map(l => {
        const rec = (l.v.recipe || []).filter(r => r.qty > 0 && Store.get('ingredients', r.ingId))
          .map(r => ({ ingId: r.ingId, raw: Calc.rawQty(Store.get('ingredients', r.ingId), r.qty) }));
        l.tops.forEach(t => { const ing = t.ingId && Store.get('ingredients', t.ingId); if (ing && t.qty > 0) rec.push({ ingId: ing.id, raw: Calc.rawQty(ing, t.qty) }); });
        return {
          pid: l.p.id, vid: l.v.id, name: l.p.name, vname: [l.v.name, ...l.tops.map(t => t.name)].filter(Boolean).join(' + '),
          price: l.price, qty: l.qty, direct: l.v.direct ? true : undefined,
          cost: Math.round(Calc.variantCost(l.v) + l.tops.reduce((a, t) => a + Calc.toppingCost(t), 0)), recipe: rec,
        };
      }),
      subtotal: s.subtotal, discount: s.discount, promoName: s.promo ? s.promo.name : '', total: s.total,
    };
    order.cost = order.items.reduce((a, it) => a + it.cost * it.qty, 0);
    const neg = Calc.applyOrderStock(order, -1);
    Store.put('orders', order);
    if (Station.on()) Station.push([order.id]);
    S.cart = []; S.manualDisc = 0; S.promoId = 'auto'; S.custId = '';
    if (S.tabId) { Store.remove('tabs', S.tabId); S.tabId = null; }
    if (S.pay === 'debt') S.pay = 'cash';
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
  topsFor(p) { if (!APP.has('topping') || !License.can()) return []; return Store.all('toppings').filter(t => t.active !== false && t.name && (!t.cats || !t.cats.length || t.cats.includes(p.category || 'Khác'))); },
  gridHtml() {
    const q = S.q.trim().toLowerCase();
    const list = Ban.prods().filter(p => (S.cat === 'Tất cả' || (p.category || 'Khác') === S.cat) && (!q || p.name.toLowerCase().includes(q)));
    if (!list.length) return emptyBox('', q ? 'Không tìm thấy món nào khớp.' : `Chưa có gì đang bán.<br>Vào mục <b>${APP.has('recipe') ? 'Món' : 'Hàng hóa'}</b> để thêm.`);
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
    titleHtml: (logo ? `<img class="logo-sm" src="${logo}" alt="">` : '') + `<span>${esc(Store.setting('shopName', 'Bán hàng'))}</span>${License.badgeHtml()}`,
    right: `${Store.all('tabs').length ? `<button class="hbtn" data-act="tabs-open">Đơn tạm · ${Store.all('tabs').length}</button>` : ''}<a class="hbtn" href="#/don">Đơn hôm nay</a>`,
    html: `${License.noticeHtml()}
      ${cover ? `<div class="cover"><img src="${cover}" alt=""><div class="cv-t"><b>${esc(Store.setting('shopName', ''))}</b><span>${esc(Store.setting('slogan', ''))}</span></div></div>` : ''}
      <div class="search">${icon('search')}<input type="search" placeholder="Tìm ${APP.has('recipe') ? 'món' : 'hàng'}" value="${esc(S.q)}" data-in="ban-q"></div>
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
Actions['cart-clear'] = () => { S.cart = []; S.manualDisc = 0; S.custId = ''; if (S.tabId) { Store.remove('tabs', S.tabId); S.tabId = null; } UI.closeSheet(); render(); };
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
        <div class="row"><b class="grow">${hm(o.time)} · ${PAY[o.pay] || ''}${o.custName ? ' · ' + esc(o.custName) : ''}${o.by ? ' · bán: ' + esc(o.by) : ''}</b><b class="num">${money(o.total)}</b></div>
        ${o.items.map(it => `<div class="line small"><span>${it.qty} × ${esc(it.name)} <span class="muted">${esc(it.vname)}</span></span><span class="num">${money(it.price * it.qty)}</span></div>`).join('')}
        ${o.discount ? `<div class="line small muted"><span>${esc(o.promoName || 'Giảm giá')}</span><span class="num">−${money(o.discount)}</span></div>` : ''}
        ${o.cancelled ? `<span class="badge bad">Đã hủy${o.cancelBy ? ' bởi ' + esc(o.cancelBy) : ''}</span>` : `<div class="row" style="margin-top:8px"><button class="btn sm soft" data-act="bill-print" data-id="${o.id}">In bill</button>${Perm.can('cancel') ? `<button class="btn sm danger" data-act="don-cancel" data-id="${o.id}">Hủy đơn</button>` : ''}</div>`}
      </div>`).join('') : emptyBox('', 'Chưa có đơn nào trong ngày này.')}`,
  };
};
Inputs['don-day'] = el => { if (el.value) { S.day = el.value; render(); } };
Actions['don-cancel'] = el => UI.confirm('Hủy đơn này? Nguyên liệu sẽ được cộng lại vào kho.', 'Hủy đơn', () => {
  const o = Store.get('orders', el.dataset.id);
  if (!o || o.cancelled || !Perm.can('cancel')) return;
  o.cancelled = true; if (Sync.active()) o.cancelBy = Sync.myName(); Calc.applyOrderStock(o, 1); Store.put('orders', o);
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
      ${o.custName ? row('Khách', esc(o.custName)) : ''}
      <div class="b-hr"></div>
      ${o.items.map(it => `<div>${esc(it.name)}${it.vname ? ' (' + esc(it.vname) + ')' : ''}</div>${row(`${it.qty} x ${n(it.price)}`, n(it.price * it.qty))}`).join('')}
      <div class="b-hr"></div>
      ${o.discount ? row('Tạm tính', n(o.subtotal)) + row(esc(o.promoName || 'Giảm giá'), '-' + n(o.discount)) : ''}
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

/* Khách hàng trong đơn */
Inputs['cart-cust'] = el => { if (el.value === '__new') { S.custFromCart = true; Khach.form(null); return; } S.custId = el.value; };

/* Đơn tạm: lưu đơn đang bấm dở theo tên bàn, mở lại để bấm thêm hoặc chốt. Kho chỉ trừ khi chốt. */
Actions['cart-hold'] = () => {
  if (!S.cart.length) return;
  const t = S.tabId && Store.get('tabs', S.tabId);
  UI.sheet(`<h2>Lưu đơn tạm</h2><p class="muted">Đặt tên bàn hoặc tên khách để mở lại sau. Kho chỉ trừ khi chốt đơn.</p>
    <label>Tên bàn / tên đơn<input id="hold-name" value="${esc(t ? t.name : '')}" placeholder="Ví dụ: Bàn 3"></label>
    <div class="chips" style="padding-top:8px">${Array.from({ length: 12 }, (_, i) => `<button class="chip" data-act="hold-pick" data-v="Bàn ${i + 1}">Bàn ${i + 1}</button>`).join('')}</div>
    <button class="btn" data-act="hold-save">Lưu tạm</button>`);
};
Actions['hold-pick'] = el => { $('#hold-name').value = el.dataset.v; };
Actions['hold-save'] = () => {
  const name = $('#hold-name').value.trim();
  if (!name) return UI.toast('Đặt tên bàn hoặc tên đơn nhé');
  const t = (S.tabId && Store.get('tabs', S.tabId)) || {};
  Store.put('tabs', Object.assign(t, { name, cart: S.cart, custId: S.custId || '', time: t.time || Date.now() }));
  S.cart = []; S.custId = ''; S.tabId = null; S.manualDisc = 0;
  UI.closeSheet(); render(); UI.toast('Đã lưu tạm ' + name);
};
Actions['tabs-open'] = () => {
  const tabs = Store.all('tabs').sort((a, b) => a.time - b.time);
  UI.sheet(`<h2>Đơn tạm</h2>${tabs.length ? tabs.map(t => {
    const ls = Cart.linesOf(t.cart || []);
    return `<div class="row" style="margin-top:8px"><button class="opt grow" style="margin:0" data-act="tab-load" data-id="${t.id}"><span class="grow">${esc(t.name)}<span class="muted small" style="display:block;font-weight:400">${ls.reduce((a, l) => a + l.qty, 0)} món · từ ${hm(t.time)}</span></span><b class="num">${money(ls.reduce((a, l) => a + l.price * l.qty, 0))}</b></button>
      <button class="btn sm danger" data-act="tab-del" data-id="${t.id}">Xóa</button></div>`;
  }).join('') : '<p class="muted">Chưa có đơn tạm nào.</p>'}`);
};
Actions['tab-load'] = el => {
  if (S.cart.length && S.tabId !== el.dataset.id) return UI.toast('Đang có đơn chưa xong. Chốt hoặc lưu tạm đơn đó trước');
  const t = Store.get('tabs', el.dataset.id); if (!t) return;
  S.cart = (t.cart || []).map(c => ({ ...c, tops: [...(c.tops || [])] })); S.custId = t.custId || ''; S.tabId = t.id;
  render(); Cart.open();
};
Actions['tab-del'] = el => { Store.remove('tabs', el.dataset.id); if (S.tabId === el.dataset.id) { S.tabId = null; S.cart = []; } render(); Actions['tabs-open'](); };
