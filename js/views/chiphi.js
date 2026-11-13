'use strict';
/* Chi phí: khoản phát sinh và khoản cố định hằng tháng */
const EXP_CATS = ['Mặt bằng', 'Điện', 'Nước', 'Internet', 'Quảng cáo', 'Dụng cụ', 'Sửa chữa', 'Khác'];

Views.chiphi = () => {
  const m = S.month, list = Calc.expensesOf(m).sort((a, b) => (b.recurring ? 1 : 0) - (a.recurring ? 1 : 0) || b.date.localeCompare(a.date));
  return {
    title: 'Chi phí', back: '#/them', tab: 'them',
    html: `${monthNav(m)}
      <div class="hero"><div class="lb">Tổng chi phí ${monthLabel(m).toLowerCase()}</div><div class="v num">${money(list.reduce((s, e) => s + e.amount, 0))}</div>
        <div class="ft"><span>Cố định ${money(list.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0))}</span><span>Phát sinh ${money(list.filter(e => !e.recurring).reduce((s, e) => s + e.amount, 0))}</span></div></div>
      ${list.length ? `<div class="list">${list.map(e => `<button class="item" data-act="chiphi-open" data-id="${e.id}">
        <span class="grow"><span class="t">${esc(e.category)} ${e.recurring ? '<span class="badge ok">Hằng tháng</span>' : ''}</span><div class="d">${e.recurring ? 'Từ ' + monthLabel(e.date.slice(0, 7)).toLowerCase() : dmy(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</div></span>
        <b class="num">${money(e.amount)}</b></button>`).join('')}</div>` : emptyBox('', 'Chưa có khoản chi nào trong tháng.')}
      <p class="muted small">Tiền mua nguyên liệu nhập ở mục Kho, lương nhập ở mục Lương – không ghi lại ở đây để khỏi tính hai lần.</p>
      <button class="fab" data-act="chiphi-new" aria-label="Thêm khoản chi">＋</button>`,
  };
};
Actions['chiphi-new'] = () => UI.sheet(`<h2>Thêm khoản chi</h2>
  <label>Loại<input name="category" list="explist" placeholder="Chọn hoặc gõ loại chi"></label>
  <datalist id="explist">${EXP_CATS.map(c => `<option value="${c}">`).join('')}</datalist>
  <div class="row2"><label>Số tiền (đ)<input name="amount" class="money" inputmode="numeric" placeholder="0"></label>
  <label>Ngày<input name="date" type="date" value="${S.month === ym() ? ymd() : S.month + '-01'}"></label></div>
  <label>Ghi chú<input name="note"></label>
  <label class="check"><input type="checkbox" name="recurring"> Lặp lại hằng tháng (mặt bằng, internet…)</label>
  <button class="btn" data-act="chiphi-save">Lưu</button>`);
Actions['chiphi-save'] = () => {
  const f = UI.form();
  if (!f.category) return UI.toast('Bạn nhập loại chi nhé');
  if (!(f.amount > 0)) return UI.toast('Nhập số tiền lớn hơn 0');
  if (!f.date) f.date = ymd();
  Store.put('expenses', f); UI.closeSheet(); render(); UI.toast('Đã lưu');
};
Actions['chiphi-open'] = el => {
  const e = Store.get('expenses', el.dataset.id);
  UI.sheet(`<h2>${esc(e.category)} · ${money(e.amount)}</h2><p class="muted">${e.recurring ? 'Khoản cố định hằng tháng, bắt đầu ' + monthLabel(e.date.slice(0, 7)).toLowerCase() : dmy(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</p>
    ${e.recurring ? `<button class="btn soft" data-act="chiphi-stop" data-id="${e.id}">Dừng từ sau ${monthLabel(S.month).toLowerCase()}</button>` : ''}
    <button class="btn danger" data-act="chiphi-del" data-id="${e.id}">Xóa ${e.recurring ? 'khỏi mọi tháng' : 'khoản này'}</button>`);
};
Actions['chiphi-stop'] = el => { const e = Store.get('expenses', el.dataset.id); e.endMonth = S.month; Store.put('expenses', e); UI.closeSheet(); render(); UI.toast('Đã dừng khoản cố định'); };
Actions['chiphi-del'] = el => { Store.remove('expenses', el.dataset.id); UI.closeSheet(); render(); UI.toast('Đã xóa'); };
