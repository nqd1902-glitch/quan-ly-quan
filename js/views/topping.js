'use strict';
/* Món bán kèm (topping, thêm sữa, thêm đá…): có giá riêng, tùy chọn trừ kho 1 nguyên liệu */
const Top = {
  form(t) {
    const n = !t; t = t || { name: '', price: 0, ingId: '', qty: 0, cats: [], active: true };
    const ings = Store.all('ingredients').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const cats = Mon.cats();
    UI.sheet(`<h2>${n ? 'Thêm món bán kèm' : 'Sửa món bán kèm'}</h2>
      <div class="row2"><label>Tên<input name="name" value="${esc(t.name)}" placeholder="Ví dụ: Trân châu"></label>
      <label>Giá cộng thêm (đ)<input name="price" class="money" inputmode="numeric" value="${moneyVal(t.price)}" placeholder="0"></label></div>
      <div class="row2"><label>Nguyên liệu trừ kho<select name="ingId"><option value="">Không trừ kho</option>${ings.map(i => `<option value="${i.id}" ${i.id === t.ingId ? 'selected' : ''}>${esc(i.name)} (${esc(i.useUnit)})</option>`).join('')}</select></label>
      <label>Lượng dùng<input name="qty" type="number" inputmode="decimal" step="any" min="0" value="${t.qty || ''}" placeholder="0"></label></div>
      <div class="muted small" style="margin-top:4px">Chọn nguyên liệu và lượng dùng thì app tính được giá cost và trừ kho khi bán.</div>
      ${cats.length ? `<label>Áp dụng cho nhóm món (không chọn = tất cả)</label>
      ${cats.map(c => `<label class="check"><input type="checkbox" data-cat="${esc(c)}" ${(t.cats || []).includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}` : ''}
      <label class="check"><input type="checkbox" name="active" ${t.active !== false ? 'checked' : ''}> Đang bán</label>
      <button class="btn" data-act="top-save" data-id="${t.id || ''}">Lưu</button>
      ${n ? '' : `<button class="btn danger" data-act="top-del" data-id="${t.id}">Xóa</button>`}`);
  },
};

Views.topping = () => {
  const list = Store.all('toppings');
  return {
    title: 'Món bán kèm', back: '#/mon', tab: 'mon',
    html: `<p class="muted small">Khi bấm một món ở màn hình bán hàng, app hỏi thêm các món bán kèm áp dụng cho nhóm món đó.</p>
      ${list.length ? `<div class="list">${list.map(t => `<button class="item" data-act="top-open" data-id="${t.id}">
        <span class="grow"><span class="t">${esc(t.name)} ${t.active === false ? '<span class="badge gray">Ngừng bán</span>' : ''}</span>
        <div class="d num">+${money(t.price)} · cost ${money(Calc.toppingCost(t))} · ${t.cats && t.cats.length ? esc(t.cats.join(', ')) : 'mọi nhóm món'}</div></span><span class="chev">›</span></button>`).join('')}</div>`
        : emptyBox('', 'Chưa có món bán kèm nào.<br>Bấm nút ＋ để thêm (trân châu, thêm sữa, thêm đá…).')}
      <button class="fab" data-act="top-new" aria-label="Thêm món bán kèm">＋</button>`,
  };
};
Actions['top-new'] = () => Top.form(null);
Actions['top-open'] = el => Top.form(Store.get('toppings', el.dataset.id));
Actions['top-save'] = el => {
  const f = UI.form();
  if (!f.name) return UI.toast('Bạn nhập tên món bán kèm nhé');
  f.cats = $$('#sheet [data-cat]').filter(c => c.checked).map(c => c.dataset.cat);
  if (!f.ingId) f.qty = 0;
  Store.put('toppings', Object.assign(el.dataset.id ? Store.get('toppings', el.dataset.id) : {}, f));
  UI.closeSheet(); render(); UI.toast('Đã lưu');
};
Actions['top-del'] = el => { Store.remove('toppings', el.dataset.id); UI.closeSheet(); render(); UI.toast('Đã xóa'); };
