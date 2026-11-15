'use strict';
/* Kho: nguyên liệu, nhập hàng, xuất hủy, kiểm kê */
const Kho = {
  directHtml() {
    const d = Calc.directItems(); if (!d.length || S.khoFilter !== 'Tất cả') return '';
    return `<div class="sub">${APP.has('ingredients') ? 'Hàng bán thẳng' : 'Hàng trong kho'}</div><div class="list">${d.map(({ p, v }) => `<a class="item" href="#/mon/${p.id}">${thumb(p)}<span class="grow"><span class="t">${esc(p.name)}</span><div class="d num">${esc(v.name)} · giá vốn ${money(v.cost)}</div></span><span class="right"><b class="num">${qty(v.stock)}</b><br>${(+v.stock || 0) <= 0 ? '<span class="badge bad">Hết hàng</span>' : ''}</span><span class="chev">›</span></a>`).join('')}</div>`;
  },
  stockText(ing) { return `${qty((+ing.stock || 0) / (+ing.factor || 1))} ${esc(ing.buyUnit)}`; },
  form(ing) {
    const n = !ing; ing = ing || { name: '', group: '', buyUnit: 'kg', useUnit: 'g', factor: 1000, price: 0, yield: 100, minStock: 0 };
    const groups = [...new Set(Store.all('ingredients').map(i => i.group).filter(Boolean))];
    UI.sheet(`<h2>${n ? 'Thêm nguyên liệu' : 'Sửa nguyên liệu'}</h2>
      <label>Tên<input name="name" value="${esc(ing.name)}" placeholder="Ví dụ: Sữa đặc"></label>
      <label>Nhóm<input name="group" list="grouplist" value="${esc(ing.group || '')}" placeholder="Trái cây, Bao bì…"></label>
      <datalist id="grouplist">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>
      <label>Chọn nhanh đơn vị</label>
      <div class="chips" style="padding-top:2px">${[['kg', 'g', 1000], ['lít', 'ml', 1000], ['cái', 'cái', 1], ['hộp', 'muỗng', 20], ['lon', 'g', 380]].map(u => `<button class="chip" data-act="kho-unit" data-v="${u.join('|')}">${u[0]} → ${u[1]}</button>`).join('')}</div>
      <div class="row3">
        <label>Đơn vị mua<input name="buyUnit" value="${esc(ing.buyUnit)}"></label>
        <label>Đơn vị dùng<input name="useUnit" value="${esc(ing.useUnit)}"></label>
        <label>1 đv mua =<input name="factor" type="number" inputmode="decimal" step="any" value="${ing.factor}"></label>
      </div>
      <div class="muted small" style="margin-top:4px">Ví dụ: mua theo <b>hộp</b>, dùng theo <b>muỗng</b>, 1 hộp = 20 muỗng.</div>
      <div class="row2">
        <label>Giá mua / đv mua<input name="price" class="money" inputmode="numeric" value="${moneyVal(ing.price)}" placeholder="0"></label>
        <label>% dùng được<input name="yield" type="number" inputmode="decimal" step="any" value="${ing.yield || 100}"></label>
      </div>
      <div class="muted small" style="margin-top:4px">% dùng được: phần còn lại sau khi gọt vỏ, bỏ hạt. Không hao hụt thì để 100.</div>
      <div class="row2">
        <label>Báo sắp hết khi còn (đv mua)<input name="minStock" type="number" inputmode="decimal" step="any" value="${(ing.minStock || 0) / (ing.factor || 1) || ''}" placeholder="0"></label>
        ${n ? '<label>Tồn đầu (đv mua)<input name="stock0" type="number" inputmode="decimal" step="any" placeholder="0"></label>' : '<div></div>'}
      </div>
      <button class="btn" data-act="kho-save" data-id="${ing.id || ''}">Lưu</button>`);
  },
  move(ing, type, qtyUse, value, note, date, fund) {
    Store.put('moves', { ingId: ing.id, type, qty: qtyUse, value: Math.round(value), note: note || '', date: date || ymd(), time: Date.now(), fund: fund || 'cash' });
  },
};
const MOVE = { in: 'Nhập hàng', waste: 'Xuất hủy', adjust: 'Kiểm kê' };

Views.kho = id => {
  if (!APP.has('ingredients')) return khoTiem();
  if (id) return khoDetail(id);
  const ings = Store.all('ingredients').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const groups = [...new Set(ings.map(i => i.group || 'Khác'))];
  const filters = ['Tất cả', 'Sắp hết', ...groups];
  if (!filters.includes(S.khoFilter)) S.khoFilter = 'Tất cả';
  const low = ings.filter(Calc.isLow);
  const list = S.khoFilter === 'Tất cả' ? ings : S.khoFilter === 'Sắp hết' ? low : ings.filter(i => (i.group || 'Khác') === S.khoFilter);
  return {
    title: 'Kho',
    html: `<div class="stats">
        <div class="stat"><div class="lb">Giá trị tồn kho</div><div class="v num">${money(ings.reduce((s, i) => s + Calc.stockValue(i), 0) + Calc.directValue())}</div></div>
        <div class="stat"><div class="lb">Sắp hết / hết</div><div class="v num">${low.length} <span class="muted small">/ ${ings.length} loại</span></div></div></div>
      <div class="chips" style="margin-top:8px">${filters.map(c => `<button class="chip ${c === S.khoFilter ? 'on' : ''}" data-act="kho-filter" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${list.length ? `<div class="list">${list.map(i => `<a class="item" href="#/kho/${i.id}">
        <span class="grow"><span class="t">${esc(i.name)}</span><div class="d num">${money(i.price)}/${esc(i.buyUnit)}${(+i.yield || 100) < 100 ? ` · dùng được ${qty(i.yield)}%` : ''}</div></span>
        <span class="right"><b class="num">${Kho.stockText(i)}</b><br>${Calc.isLow(i) ? `<span class="badge ${i.stock <= 0 ? 'bad' : 'warn'}">${i.stock <= 0 ? 'Hết hàng' : 'Sắp hết'}</span>` : ''}</span>
        <span class="chev">›</span></a>`).join('')}</div>`
        : emptyBox('', ings.length ? 'Không có nguyên liệu nào trong mục này.' : 'Kho đang trống.<br>Bấm nút ＋ để thêm nguyên liệu và giá mua.')}
      ${Kho.directHtml()}
      <button class="fab" data-act="kho-new" aria-label="Thêm nguyên liệu">＋</button>`,
  };
};

function khoDetail(id) {
  const ing = Store.get('ingredients', id);
  if (!ing) { go('#/kho'); return null; }
  S.khoId = id;
  const moves = Store.all('moves').filter(m => m.ingId === id).sort((a, b) => b.time - a.time).slice(0, 40);
  const used = Store.all('products').filter(p => p.variants.some(v => v.recipe.some(r => r.ingId === id && r.qty > 0)));
  return {
    title: ing.name, back: '#/kho', tab: 'kho',
    html: `<div class="hero ${ing.stock <= 0 ? 'neg' : ''}"><div class="lb">Tồn kho</div><div class="v num">${Kho.stockText(ing)}</div>
        <div class="ft"><span>${ing.factor != 1 ? `≈ ${qty(ing.stock)} ${esc(ing.useUnit)}` : ''}</span><span>Trị giá ${money(Calc.stockValue(ing))}</span></div></div>
      <div class="btns"><button class="btn" data-act="kho-in">Nhập hàng</button><button class="btn soft" data-act="kho-waste">Xuất hủy</button><button class="btn soft" data-act="kho-adjust">Kiểm kê</button></div>
      <div class="card">
        <div class="line"><span class="muted">Giá vốn bình quân</span><b class="num">${money(ing.price)}/${esc(ing.buyUnit)}</b></div>
        <div class="line"><span class="muted">Quy đổi</span><b class="num">1 ${esc(ing.buyUnit)} = ${qty(ing.factor)} ${esc(ing.useUnit)}</b></div>
        <div class="line"><span class="muted">Dùng được sau sơ chế</span><b class="num">${qty(ing.yield || 100)}%</b></div>
        <div class="line"><span class="muted">Giá cost thực</span><b class="num">${Calc.unitCost(ing) < 100 ? qty(Calc.unitCost(ing)) + 'đ' : money(Calc.unitCost(ing))}/${esc(ing.useUnit)}</b></div>
        <div class="line"><span class="muted">Báo sắp hết khi còn</span><b class="num">${qty((ing.minStock || 0) / (ing.factor || 1))} ${esc(ing.buyUnit)}</b></div>
        <button class="btn soft" data-act="kho-edit">Sửa thông tin</button>
      </div>
      ${used.length ? `<div class="sub">Dùng trong ${used.length} món</div><div class="list">${used.map(p => `<a class="item" href="#/mon/${p.id}">${thumb(p)}<span class="grow t">${esc(p.name)}</span><span class="chev">›</span></a>`).join('')}</div>` : ''}
      <div class="sub">Lịch sử nhập / xuất</div>
      ${moves.length ? `<div class="list">${moves.map(m => `<div class="item"><span class="grow"><span class="t">${MOVE[m.type] || m.type}</span><div class="d">${dmy(m.date)}${m.note ? ' · ' + esc(m.note) : ''}</div></span>
        <span class="right num"><b>${m.qty > 0 ? '+' : ''}${qty(m.qty / (ing.factor || 1))} ${esc(ing.buyUnit)}</b><div class="d">${money(Math.abs(m.value))}</div></span></div>`).join('')}</div>` : '<p class="muted small">Chưa có phiếu nào. Lượng bán ra được trừ tự động theo đơn hàng.</p>'}
      <button class="btn danger" data-act="kho-del">Xóa nguyên liệu này</button>`,
  };
}

Actions['kho-filter'] = el => { S.khoFilter = el.dataset.v; render(); };
Actions['kho-new'] = () => Kho.form(null);
Actions['kho-edit'] = () => Kho.form(Store.get('ingredients', S.khoId));
Actions['kho-unit'] = el => {
  const [b, u, f] = el.dataset.v.split('|');
  $('[name=buyUnit]').value = b; $('[name=useUnit]').value = u; $('[name=factor]').value = f;
};
Actions['kho-save'] = el => {
  const f = UI.form();
  if (!f.name) return UI.toast('Bạn nhập tên nguyên liệu nhé');
  if (!(f.factor > 0)) return UI.toast('Quy đổi phải lớn hơn 0');
  const ing = el.dataset.id ? Store.get('ingredients', el.dataset.id) : { stock: 0 };
  Object.assign(ing, { name: f.name, group: f.group, buyUnit: f.buyUnit || 'cái', useUnit: f.useUnit || f.buyUnit || 'cái', factor: f.factor, price: f.price, yield: Math.min(Math.max(f.yield || 100, 1), 100), minStock: (f.minStock || 0) * f.factor });
  if (!el.dataset.id && f.stock0) ing.stock = f.stock0 * f.factor;
  Store.put('ingredients', ing);
  UI.closeSheet(); render(); UI.toast('Đã lưu');
};
Actions['kho-in'] = () => {
  const ing = Store.get('ingredients', S.khoId);
  UI.sheet(`<h2>Nhập hàng · ${esc(ing.name)}</h2>
    <div class="row2"><label>Số lượng (${esc(ing.buyUnit)})<input name="q" type="number" inputmode="decimal" step="any" placeholder="0"></label>
    <label>Thành tiền (đ)<input name="total" class="money" inputmode="numeric" placeholder="0"></label></div>
    <div class="muted small" style="margin-top:4px">Giá gần nhất: ${money(ing.price)}/${esc(ing.buyUnit)}. Bỏ trống thành tiền thì tính theo giá này.</div>
    <div class="row2"><label>Ngày<input name="date" type="date" value="${ymd()}"></label><label>Ghi chú<input name="note" placeholder="Nơi mua…"></label></div>
    <label>Trả bằng${fundSelect()}</label>
    <button class="btn" data-act="kho-in-ok">Nhập kho</button>`);
};
Actions['kho-in-ok'] = () => {
  const ing = Store.get('ingredients', S.khoId); const f = UI.form();
  if (!(f.q > 0)) return UI.toast('Nhập số lượng lớn hơn 0');
  const total = f.total || f.q * ing.price;
  const have = Math.max(+ing.stock || 0, 0) / ing.factor;
  ing.price = Math.round((have * ing.price + total) / (have + f.q));
  ing.stock = (+ing.stock || 0) + f.q * ing.factor;
  Store.put('ingredients', ing);
  Kho.move(ing, 'in', f.q * ing.factor, total, f.note, f.date, f.fund);
  UI.closeSheet(); render(); UI.toast('Đã nhập kho');
};
Actions['kho-waste'] = () => {
  const ing = Store.get('ingredients', S.khoId);
  UI.sheet(`<h2>Xuất hủy · ${esc(ing.name)}</h2>
    <label>Số lượng hủy (${esc(ing.buyUnit)})<input name="q" type="number" inputmode="decimal" step="any" placeholder="0"></label>
    <label>Lý do<input name="note" placeholder="Hư, dập, hết hạn…"></label>
    <button class="btn danger" data-act="kho-waste-ok">Xuất hủy</button>`);
};
Actions['kho-waste-ok'] = () => {
  const ing = Store.get('ingredients', S.khoId); const f = UI.form();
  if (!(f.q > 0)) return UI.toast('Nhập số lượng lớn hơn 0');
  ing.stock = (+ing.stock || 0) - f.q * ing.factor;
  Store.put('ingredients', ing);
  Kho.move(ing, 'waste', -f.q * ing.factor, -f.q * ing.price, f.note);
  UI.closeSheet(); render(); UI.toast('Đã xuất hủy');
};
Actions['kho-adjust'] = () => {
  const ing = Store.get('ingredients', S.khoId);
  UI.sheet(`<h2>Kiểm kê · ${esc(ing.name)}</h2>
    <p class="muted">Sổ sách đang ghi: <b>${Kho.stockText(ing)}</b></p>
    <label>Tồn thực tế đếm được (${esc(ing.buyUnit)})<input name="real" type="number" inputmode="decimal" step="any" value="${+(Math.max(ing.stock, 0) / ing.factor).toFixed(2)}"></label>
    <button class="btn" data-act="kho-adjust-ok">Cập nhật tồn kho</button>`);
};
Actions['kho-adjust-ok'] = () => {
  const ing = Store.get('ingredients', S.khoId); const f = UI.form();
  if (f.real < 0) return UI.toast('Tồn thực tế không được âm');
  const diff = f.real * ing.factor - (+ing.stock || 0);
  ing.stock = f.real * ing.factor;
  Store.put('ingredients', ing);
  if (diff) Kho.move(ing, 'adjust', diff, diff / ing.factor * ing.price, 'Chênh lệch kiểm kê');
  UI.closeSheet(); render(); UI.toast('Đã cập nhật tồn kho');
};
Actions['kho-del'] = () => {
  const n = Store.all('products').filter(p => p.variants.some(v => v.recipe.some(r => r.ingId === S.khoId))).length;
  UI.confirm(n ? `Nguyên liệu này đang nằm trong công thức của ${n} món. Xóa thì các món đó sẽ mất dòng này trong giá cost.` : 'Xóa nguyên liệu này khỏi kho?', 'Xóa', () => {
    Store.remove('ingredients', S.khoId); go('#/kho'); UI.toast('Đã xóa');
  });
};

/* Kho của app tiệm: chỉ có hàng bán thẳng */
function khoTiem() {
  const d = Calc.directItems(), out = d.filter(x => (+x.v.stock || 0) <= 0).length;
  return {
    title: 'Kho',
    html: `<div class="stats">
        <div class="stat"><div class="lb">Giá trị tồn kho</div><div class="v num">${money(Calc.directValue())}</div></div>
        <div class="stat"><div class="lb">Hết hàng</div><div class="v num">${out} <span class="muted small">/ ${d.length} loại</span></div></div></div>
      ${d.length ? Kho.directHtml() + '<p class="muted small">Bấm vào một mặt hàng để nhập hàng hoặc kiểm kê.</p>' : emptyBox('', 'Chưa có hàng nào.<br>Vào mục <b>Hàng hóa</b> để thêm hàng, giá vốn và nhập kho.')}`,
  };
}
