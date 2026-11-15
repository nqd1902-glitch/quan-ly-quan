'use strict';
/* Món & công thức: bảng định lượng, hàng = nguyên liệu, cột = size */
const Mon = {
  cur() { return Store.get('products', S.monId); },
  ingIds(p) { const ids = []; p.variants.forEach(v => v.recipe.forEach(r => { if (!ids.includes(r.ingId)) ids.push(r.ingId); })); return ids; },
  qtyOf(v, id) { const r = v.recipe.find(x => x.ingId === id); return r ? r.qty : 0; },
  cats() { return [...new Set(Store.all('products').map(p => p.category).filter(Boolean))]; },
  /* Cập nhật các dòng tính toán mà không vẽ lại ô đang gõ */
  refresh() {
    const p = Mon.cur(); if (!p) return;
    if (p.direct) { p.variants.forEach(v => { const el = $('#dv-' + v.id); if (el) el.innerHTML = `lãi ${money(v.price - (+v.cost || 0))} ${v.price ? `<span class="badge ${Calc.pctClass(Calc.costPct(v))}">${Math.round(Calc.costPct(v))}%</span>` : ''}`; }); return; }
    if (!$('#mon-cost')) return;
    const cell = f => '<td></td>' + p.variants.map(f).join('') + '<td></td>';
    const set = (id, label, f) => { $('#' + id).innerHTML = `<td>${label}</td>` + p.variants.map(v => `<td class="num">${f(v)}</td>`).join('') + '<td></td>'; };
    set('mon-cost', 'Giá cost', v => money(Calc.variantCost(v)));
    set('mon-profit', 'Lãi gộp', v => money(v.price - Calc.variantCost(v)));
    set('mon-pct', '% cost', v => v.price ? `<span class="badge ${Calc.pctClass(Calc.costPct(v))}">${Math.round(Calc.costPct(v))}%</span>` : '–');
    set('mon-sug', '<span class="muted small">Giá gợi ý<br>(cost 35%)</span>', v => `<span class="muted small">${money(Math.ceil(Calc.variantCost(v) / 0.35 / 1000) * 1000)}</span>`);
    const high = p.variants.some(v => v.price && Calc.costPct(v) > 50);
    $('#mon-warn').innerHTML = high ? '<div class="note">Có size đang cost trên 50% giá bán – nên xem lại giá bán hoặc định lượng.</div>' : '';
    void cell;
  },
  save(p) { Store.put('products', p); },
  /* Khối giá và tồn kho cho hàng bán thẳng (mua về bán lại, không pha chế) */
  directCard(p) {
    return `<div class="card"><h3>Giá và tồn kho</h3>
      <div class="muted small">Hàng mua về bán lại, không pha chế. Nhập giá vốn để app tính lãi; tồn kho tự trừ khi bán.</div>
      ${p.variants.map(v => `<div class="dv">
        <div class="row3"><label>Quy cách<input data-in="mon-vname" data-v="${v.id}" value="${esc(v.name)}" placeholder="Lon, chai…"></label>
          <label>Giá bán<input class="money" inputmode="numeric" data-in="mon-price" data-v="${v.id}" value="${moneyVal(v.price)}" placeholder="0"></label>
          <label>Giá vốn<input class="money" inputmode="numeric" data-in="mon-dcost" data-v="${v.id}" value="${moneyVal(v.cost)}" placeholder="0"></label></div>
        <div class="row" style="margin-top:10px"><span class="grow small">Tồn <b class="num">${qty(v.stock)}</b> ${(+v.stock || 0) <= 0 ? '<span class="badge bad">Hết hàng</span>' : ''}<br><span id="dv-${v.id}" class="muted"></span></span>
          <button class="btn sm soft" data-act="mon-din" data-v="${v.id}">Nhập hàng</button><button class="btn sm soft" data-act="mon-dadj" data-v="${v.id}">Kiểm kê</button></div></div>`).join('')}
      <div class="btns"><button class="btn ghost" data-act="mon-addv">＋ Thêm quy cách</button>${p.variants.length > 1 ? '<button class="btn ghost" data-act="mon-delv">Bớt quy cách</button>' : ''}</div></div>`;
  },
  dv(el) { const p = Mon.cur(); return { p, v: p.variants.find(x => x.id === (el ? el.dataset.v : S.dvId)) }; },
};

Views.mon = id => {
  if (id === 'new') {
    const p = Store.put('products', { name: '', category: S.cat !== 'Tất cả' ? S.cat : '', img: '', active: true, variants: [{ id: Store.uid(), name: 'Ly 700ml', price: 0, recipe: [] }] });
    history.replaceState(null, '', '#/mon/' + p.id);
    return Views.mon(p.id);
  }
  if (id) return monEdit(id);
  // dọn món tạo dở chưa đặt tên
  Store.all('products').filter(p => !p.name && !Mon.ingIds(p).length).forEach(p => Store.remove('products', p.id));
  const prods = Store.all('products');
  const cats = [...new Set(prods.map(p => p.category || 'Khác'))];
  return {
    title: 'Món & công thức',
    html: `<div class="list"><a class="item" href="#/topping"><span class="grow"><span class="t">Món bán kèm (topping)</span><div class="d">${Store.all('toppings').length} món · trân châu, thêm sữa, thêm đá…</div></span><span class="chev">›</span></a></div>` + (prods.length ? cats.map(c => `<div class="sub">${esc(c)}</div><div class="list">${prods.filter(p => (p.category || 'Khác') === c).map(p => `
      <a class="item" href="#/mon/${p.id}">${thumb(p)}
        <span class="grow"><span class="t">${esc(p.name || '(chưa đặt tên)')} ${p.active === false ? '<span class="badge gray">Ngừng bán</span>' : ''}</span>
        ${p.variants.map(v => `<div class="d num">${esc(v.name)} · ${money(v.price)} · cost ${money(Calc.variantCost(v))} ${v.price ? `<span class="badge ${Calc.pctClass(Calc.costPct(v))}">${Math.round(Calc.costPct(v))}%</span>` : ''}${v.direct ? ` · tồn ${qty(v.stock)}` : ''}</div>`).join('')}
        </span><span class="chev">›</span></a>`).join('')}</div>`).join('')
      : emptyBox('', 'Chưa có món nào.<br>Bấm nút ＋ để thêm món và nhập công thức.'))
      + `<a class="fab" href="#/mon/new" aria-label="Thêm món">＋</a>`,
  };
};

function monEdit(id) {
  const p = Store.get('products', id);
  if (!p) { go('#/mon'); return null; }
  S.monId = id;
  const ids = Mon.ingIds(p);
  const row = iid => {
    const ing = Store.get('ingredients', iid);
    return `<tr><td><div class="nm">${esc(ing ? ing.name : '(đã xóa khỏi kho)')}</div><div class="u">${ing ? `${esc(ing.useUnit)} · ${money(Calc.unitCost(ing))}/${esc(ing.useUnit)}` : ''}</div></td>
      ${p.variants.map(v => `<td><input type="number" inputmode="decimal" step="any" min="0" data-in="mon-q" data-v="${v.id}" data-i="${iid}" value="${Mon.qtyOf(v, iid) || ''}" placeholder="0"></td>`).join('')}
      <td><button class="x" data-act="mon-delrow" data-i="${iid}" aria-label="Bỏ nguyên liệu">✕</button></td></tr>`;
  };
  setTimeout(Mon.refresh, 0);
  return {
    title: p.name || 'Món mới', back: '#/mon', tab: 'mon',
    html: `<div class="card">
        <div class="photo">${thumb(p)}<div class="grow">
          <label class="btn soft">${p.img ? 'Đổi ảnh' : 'Chụp / chọn ảnh món'}<input type="file" accept="image/*" class="hidden" data-in="mon-img"></label>
          ${p.img ? '<button class="btn ghost" style="margin-top:8px" data-act="mon-img-del">Bỏ ảnh</button>' : '<div class="muted small" style="margin-top:6px">Dùng ảnh thật của món để dễ bấm khi bán.</div>'}</div></div>
        <label>Tên món<input data-in="mon-f" data-f="name" value="${esc(p.name)}" placeholder="Ví dụ: Cà phê muối"></label>
        <label>Nhóm<input data-in="mon-f" data-f="category" list="catlist" value="${esc(p.category || '')}" placeholder="Nước ép, Trà…"></label>
        <datalist id="catlist">${Mon.cats().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <label class="check"><input type="checkbox" data-in="mon-f" data-f="active" ${p.active !== false ? 'checked' : ''}> Đang bán</label>
        <label>Loại</label>
        <div class="seg"><button class="${p.direct ? '' : 'on'}" data-act="mon-kind" data-v="recipe">Pha chế theo công thức</button><button class="${p.direct ? 'on' : ''}" data-act="mon-kind" data-v="direct">Hàng bán thẳng</button></div>
      </div>
      ${p.direct ? Mon.directCard(p) : ''}
      <div class="card" ${p.direct ? 'hidden' : ''}><h3>Công thức & định lượng</h3>
        <div class="muted small">Mỗi cột là một size. Nhập lượng nguyên liệu cho từng size, app tự tính giá cost.</div>
        <div class="mx-wrap"><table class="mx">
          <thead><tr><th class="muted small">Nguyên liệu</th>${p.variants.map(v => `<th><input data-in="mon-vname" data-v="${v.id}" value="${esc(v.name)}" placeholder="Size"></th>`).join('')}<th></th></tr></thead>
          <tbody>${ids.map(row).join('') || `<tr><td colspan="${p.variants.length + 2}" class="muted small" style="padding:10px 0">Chưa có nguyên liệu nào trong công thức.</td></tr>`}</tbody>
          <tfoot>
            <tr class="sep"><td>Giá bán</td>${p.variants.map(v => `<td><input class="money" inputmode="numeric" data-in="mon-price" data-v="${v.id}" value="${moneyVal(v.price)}" placeholder="0"></td>`).join('')}<td></td></tr>
            <tr id="mon-cost"></tr><tr id="mon-profit"></tr><tr id="mon-pct"></tr><tr id="mon-sug"></tr>
          </tfoot></table></div>
        <div id="mon-warn"></div>
        <button class="btn soft" data-act="mon-addrow">＋ Thêm nguyên liệu</button>
        <div class="btns"><button class="btn ghost" data-act="mon-addv">＋ Thêm size</button>
          ${p.variants.length > 1 ? '<button class="btn ghost" data-act="mon-delv">Bớt size</button>' : ''}</div>
      </div>
      <button class="btn danger" data-act="mon-del">Xóa món này</button>`,
  };
}

Inputs['mon-f'] = el => {
  const p = Mon.cur(); const f = el.dataset.f;
  p[f] = el.type === 'checkbox' ? el.checked : el.value.trim();
  Mon.save(p);
  if (f === 'name') $('#title').textContent = p.name || 'Món mới';
};
/* Thu nhỏ ảnh về tối đa 720px rồi lưu ngay trong máy */
Inputs['mon-img'] = el => {
  const file = el.files && el.files[0]; if (!file) return;
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, 720 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const p = Mon.cur(); p.img = c.toDataURL('image/jpeg', 0.8); Mon.save(p); render(); UI.toast('Đã lưu ảnh món');
  };
  img.onerror = () => { URL.revokeObjectURL(url); UI.toast('Không đọc được ảnh này'); };
  img.src = url;
};
Actions['mon-img-del'] = () => { const p = Mon.cur(); p.img = ''; Mon.save(p); render(); };
Inputs['mon-vname'] = el => { const p = Mon.cur(); p.variants.find(v => v.id === el.dataset.v).name = el.value.trim(); Mon.save(p); };
Inputs['mon-price'] = el => { const p = Mon.cur(); p.variants.find(v => v.id === el.dataset.v).price = parseMoney(el.value); Mon.save(p); Mon.refresh(); };
Inputs['mon-q'] = el => {
  const p = Mon.cur(); const v = p.variants.find(x => x.id === el.dataset.v);
  let r = v.recipe.find(x => x.ingId === el.dataset.i);
  if (!r) { r = { ingId: el.dataset.i, qty: 0 }; v.recipe.push(r); }
  r.qty = Math.max(0, parseQty(el.value));
  Mon.save(p); Mon.refresh();
};
Actions['mon-addrow'] = () => {
  const p = Mon.cur(); const used = Mon.ingIds(p);
  const ings = Store.all('ingredients').filter(i => !used.includes(i.id)).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  if (!ings.length) {
    UI.sheet(`<h2>Thêm nguyên liệu</h2><p class="muted">${used.length ? 'Món này đã dùng hết các nguyên liệu trong kho.' : 'Kho chưa có nguyên liệu nào.'} Hãy thêm nguyên liệu (kèm giá mua) trong mục Kho trước.</p><button class="btn" data-act="go" data-v="#/kho">Mở Kho</button>`);
    return;
  }
  const groups = [...new Set(ings.map(i => i.group || 'Khác'))];
  UI.sheet(`<h2>Thêm nguyên liệu vào công thức</h2>
    <label>Nguyên liệu<select name="ingId">${groups.map(g => `<optgroup label="${esc(g)}">${ings.filter(i => (i.group || 'Khác') === g).map(i => `<option value="${i.id}">${esc(i.name)} (${esc(i.useUnit)})</option>`).join('')}</optgroup>`).join('')}</select></label>
    <p class="muted small">Sau khi thêm, nhập định lượng cho từng size ngay trong bảng.</p>
    <button class="btn" data-act="mon-addrow-ok">Thêm</button>`);
};
Actions['mon-addrow-ok'] = () => {
  const p = Mon.cur(); const { ingId } = UI.form();
  p.variants.forEach(v => { if (!v.recipe.find(r => r.ingId === ingId)) v.recipe.push({ ingId, qty: 0 }); });
  Mon.save(p); UI.closeSheet(); render();
};
Actions['mon-delrow'] = el => {
  const p = Mon.cur();
  p.variants.forEach(v => v.recipe = v.recipe.filter(r => r.ingId !== el.dataset.i));
  Mon.save(p); render();
};
Actions['mon-addv'] = () => {
  const p = Mon.cur(); const last = p.variants[p.variants.length - 1];
  if (p.direct) { p.variants.push({ id: Store.uid(), name: 'Loại mới', price: last.price, recipe: [], direct: true, cost: last.cost || 0, stock: 0 }); Mon.save(p); render(); return; }
  p.variants.push({ id: Store.uid(), name: p.variants.length === 1 ? 'Ly 1 lít' : 'Size mới', price: last.price, recipe: last.recipe.map(r => ({ ...r })) });
  Mon.save(p); render(); UI.toast('Đã thêm size, định lượng chép từ size trước');
};
Actions['mon-delv'] = () => {
  const p = Mon.cur();
  UI.sheet(`<h2>Bớt size nào?</h2>${p.variants.map(v => `<button class="btn danger" data-act="mon-delv-ok" data-v="${v.id}">${esc(v.name || 'Size')} · ${money(v.price)}</button>`).join('')}`);
};
Actions['mon-delv-ok'] = el => { const p = Mon.cur(); p.variants = p.variants.filter(v => v.id !== el.dataset.v); Mon.save(p); UI.closeSheet(); render(); };
Actions['mon-del'] = () => UI.confirm('Xóa món này cùng công thức? Đơn đã bán vẫn giữ nguyên.', 'Xóa món', () => {
  Store.remove('products', S.monId); S.cart = S.cart.filter(c => c.pid !== S.monId); go('#/mon'); UI.toast('Đã xóa món');
});

/* Hàng bán thẳng: đổi loại, giá vốn, nhập hàng, kiểm kê */
Actions['mon-kind'] = el => {
  const p = Mon.cur(); p.direct = el.dataset.v === 'direct';
  p.variants.forEach(v => { v.direct = p.direct; if (p.direct) { v.cost = +v.cost || 0; v.stock = +v.stock || 0; } });
  Mon.save(p); render();
};
Inputs['mon-dcost'] = el => { const { p, v } = Mon.dv(el); v.cost = parseMoney(el.value); Mon.save(p); Mon.refresh(); };
Actions['mon-din'] = el => {
  const { p, v } = Mon.dv(el); S.dvId = v.id;
  UI.sheet(`<h2>Nhập hàng · ${esc(p.name)} ${esc(v.name)}</h2>
    <div class="row2"><label>Số lượng<input name="q" type="number" inputmode="decimal" step="any" placeholder="0"></label>
    <label>Thành tiền (đ)<input name="total" class="money" inputmode="numeric" placeholder="0"></label></div>
    <div class="muted small" style="margin-top:4px">Giá vốn hiện tại: ${money(v.cost)}. Bỏ trống thành tiền thì tính theo giá này.</div>
    <div class="row2"><label>Ngày<input name="date" type="date" value="${ymd()}"></label><label>Trả bằng${fundSelect()}</label></div>
    <button class="btn" data-act="mon-din-ok">Nhập kho</button>`);
};
Actions['mon-din-ok'] = () => {
  const { p, v } = Mon.dv(null), f = UI.form();
  if (!(f.q > 0)) return UI.toast('Nhập số lượng lớn hơn 0');
  const total = f.total || f.q * (+v.cost || 0), have = Math.max(+v.stock || 0, 0);
  v.cost = Math.round((have * (+v.cost || 0) + total) / (have + f.q));
  v.stock = (+v.stock || 0) + f.q;
  Mon.save(p);
  Store.put('moves', { pid: p.id, vid: v.id, type: 'in', qty: f.q, value: Math.round(total), note: p.name + ' ' + v.name, date: f.date || ymd(), time: Date.now(), fund: f.fund });
  UI.closeSheet(); render(); UI.toast('Đã nhập kho');
};
Actions['mon-dadj'] = el => {
  const { p, v } = Mon.dv(el); S.dvId = v.id;
  UI.sheet(`<h2>Kiểm kê · ${esc(p.name)} ${esc(v.name)}</h2><p class="muted">Sổ sách đang ghi: <b>${qty(v.stock)}</b></p>
    <label>Tồn thực tế đếm được<input name="real" type="number" inputmode="decimal" step="any" value="${Math.max(+v.stock || 0, 0)}"></label>
    <button class="btn" data-act="mon-dadj-ok">Cập nhật tồn kho</button>`);
};
Actions['mon-dadj-ok'] = () => {
  const { p, v } = Mon.dv(null), f = UI.form();
  if (f.real < 0) return UI.toast('Tồn thực tế không được âm');
  const diff = f.real - (+v.stock || 0);
  v.stock = f.real; Mon.save(p);
  if (diff) Store.put('moves', { pid: p.id, vid: v.id, type: 'adjust', qty: diff, value: Math.round(diff * (+v.cost || 0)), note: 'Chênh lệch kiểm kê ' + p.name, date: ymd(), time: Date.now() });
  UI.closeSheet(); render(); UI.toast('Đã cập nhật tồn kho');
};
