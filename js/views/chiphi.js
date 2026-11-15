'use strict';
/* Thu chi & sổ quỹ: khoản thu khác, khoản chi (phát sinh và cố định hằng tháng), tồn quỹ tiền mặt / ngân hàng */
const EXP_CATS = ['Mặt bằng', 'Điện', 'Nước', 'Internet', 'Quảng cáo', 'Dụng cụ', 'Sửa chữa', 'Khác'];
const INC_CATS = ['Bán ve chai, phế liệu', 'Cho thuê', 'Tiền lãi', 'Chủ góp thêm vốn', 'Khác'];
const FUND = { cash: 'Tiền mặt', bank: 'Ngân hàng' };
const fundSelect = (v = 'cash', name = 'fund') => `<select name="${name}">${Object.keys(FUND).map(k => `<option value="${k}" ${k === v ? 'selected' : ''}>${FUND[k]}</option>`).join('')}</select>`;

const ThuChi = {
  form(kind) {
    S.tcKind = kind;
    const thu = kind === 'thu';
    UI.sheet(`<h2>Thêm khoản ${thu ? 'thu' : 'chi'}</h2>
      <div class="seg"><button class="${thu ? 'on' : ''}" data-act="tc-kind" data-v="thu">Thu</button><button class="${thu ? '' : 'on'}" data-act="tc-kind" data-v="chi">Chi</button></div>
      <label>Nội dung<input name="category" list="tclist" placeholder="Chọn hoặc gõ nội dung"></label>
      <datalist id="tclist">${(thu ? INC_CATS : EXP_CATS).map(c => `<option value="${c}">`).join('')}</datalist>
      <div class="row2"><label>Số tiền (đ)<input name="amount" class="money" inputmode="numeric" placeholder="0"></label>
      <label>Ngày<input name="date" type="date" value="${S.month === ym() ? ymd() : S.month + '-01'}"></label></div>
      <div class="row2"><label>${thu ? 'Thu vào' : 'Chi từ'}${fundSelect()}</label><label>Ghi chú<input name="note"></label></div>
      ${thu ? '' : '<label class="check"><input type="checkbox" name="recurring"> Lặp lại hằng tháng (mặt bằng, internet…)</label>'}
      <button class="btn" data-act="tc-save">Lưu</button>`);
  },
};

Views.thuchi = () => {
  const m = S.month, f = Calc.fund(), c = Calc.cashflow(m);
  const list = [...Calc.expensesOf(m), ...Calc.incomesOf(m)].sort((a, b) => (b.recurring ? 1 : 0) - (a.recurring ? 1 : 0) || b.date.localeCompare(a.date));
  const line = (t, v) => `<div class="line"><span class="muted">${t}</span><b class="num">${money(v)}</b></div>`;
  return {
    title: 'Thu chi', back: '#/them', tab: 'them',
    html: `<div class="hero ${f.cash + f.bank < 0 ? 'neg' : ''}"><div class="lb">Tồn quỹ hiện tại</div><div class="v num">${money(f.cash + f.bank)}</div>
        <div class="ft"><span>Tiền mặt ${money(f.cash)}</span><span>Ngân hàng ${money(f.bank)}</span></div></div>
      <button class="btn soft" style="margin-top:0" data-act="tc-check">Kiểm quỹ (nhập số tiền thực có)</button>
      ${monthNav(m)}
      <div class="stats">
        <div class="stat"><div class="lb">Tiền vào trong tháng</div><div class="v num">${money(c.in)}</div></div>
        <div class="stat"><div class="lb">Tiền ra trong tháng</div><div class="v num">${money(c.out)}</div></div></div>
      <div class="card"><h3>Tiền vào</h3>
        ${line('Bán hàng thu tiền mặt', c.saleCash)}${line('Bán hàng thu chuyển khoản', c.saleBank)}${line('Khách trả nợ', c.debtIn)}${line('Thu khác', c.otherIn)}</div>
      <div class="card"><h3>Tiền ra</h3>
        ${line('Khoản chi', c.expOut)}${line('Nhập hàng', c.buyOut)}${line('Trả lương, tạm ứng', c.payOut)}</div>
      <div class="sub">Khoản thu, chi đã ghi trong tháng</div>
      ${list.length ? `<div class="list">${list.map(e => `<button class="item" data-act="tc-open" data-id="${e.id}">
        <span class="grow"><span class="t">${esc(e.category)} ${e.recurring ? '<span class="badge gray">Hằng tháng</span>' : ''}</span><div class="d">${e.recurring ? 'Từ ' + monthLabel(e.date.slice(0, 7)).toLowerCase() : dmy(e.date)} · ${FUND[e.fund] || FUND.cash}${e.note ? ' · ' + esc(e.note) : ''}</div></span>
        <b class="num" style="color:var(--${e.kind === 'thu' ? 'acc' : 'bad'})">${e.kind === 'thu' ? '+' : '−'}${money(e.amount)}</b></button>`).join('')}</div>` : emptyBox('', 'Chưa ghi khoản thu, chi nào trong tháng.')}
      <p class="muted small">Tiền bán hàng, nhập hàng, lương và khách trả nợ được lấy tự động từ các mục khác, không cần ghi lại ở đây.</p>
      <button class="fab" data-act="tc-new" aria-label="Thêm khoản thu chi">＋</button>`,
  };
};
Views.chiphi = Views.thuchi;

Actions['tc-new'] = () => ThuChi.form('chi');
Actions['tc-kind'] = el => ThuChi.form(el.dataset.v);
Actions['tc-save'] = () => {
  const f = UI.form();
  if (!f.category) return UI.toast('Bạn nhập nội dung nhé');
  if (!(f.amount > 0)) return UI.toast('Nhập số tiền lớn hơn 0');
  if (!f.date) f.date = ymd();
  f.kind = S.tcKind === 'thu' ? 'thu' : 'chi';
  if (f.kind === 'thu') f.recurring = false;
  Store.put('expenses', f); UI.closeSheet(); render(); UI.toast('Đã lưu');
};
Actions['tc-open'] = el => {
  const e = Store.get('expenses', el.dataset.id);
  UI.sheet(`<h2>${e.kind === 'thu' ? 'Thu' : 'Chi'} · ${esc(e.category)} · ${money(e.amount)}</h2>
    <p class="muted">${e.recurring ? 'Khoản cố định hằng tháng, bắt đầu ' + monthLabel(e.date.slice(0, 7)).toLowerCase() : dmy(e.date)} · ${FUND[e.fund] || FUND.cash}${e.note ? ' · ' + esc(e.note) : ''}</p>
    ${e.recurring ? `<button class="btn soft" data-act="tc-stop" data-id="${e.id}">Dừng từ sau ${monthLabel(S.month).toLowerCase()}</button>` : ''}
    <button class="btn danger" data-act="tc-del" data-id="${e.id}">Xóa ${e.recurring ? 'khỏi mọi tháng' : 'khoản này'}</button>`);
};
Actions['tc-stop'] = el => { const e = Store.get('expenses', el.dataset.id); e.endMonth = S.month; Store.put('expenses', e); UI.closeSheet(); render(); UI.toast('Đã dừng khoản cố định'); };
Actions['tc-del'] = el => { Store.remove('expenses', el.dataset.id); UI.closeSheet(); render(); UI.toast('Đã xóa'); };

/* Kiểm quỹ: nhập số tiền thực có, app ghi phần chênh lệch để sổ khớp thực tế (không tính vào lãi lỗ) */
Actions['tc-check'] = () => {
  const f = Calc.fund();
  UI.sheet(`<h2>Kiểm quỹ</h2>
    <p class="muted">Sổ đang ghi: tiền mặt <b>${money(f.cash)}</b>, ngân hàng <b>${money(f.bank)}</b>. Nhập số tiền bạn đang thực có.</p>
    <div class="row2"><label>Tiền mặt thực có<input name="cash" class="money" inputmode="numeric" value="${moneyVal(Math.max(f.cash, 0))}" placeholder="0"></label>
    <label>Ngân hàng thực có<input name="bank" class="money" inputmode="numeric" value="${moneyVal(Math.max(f.bank, 0))}" placeholder="0"></label></div>
    <button class="btn" data-act="tc-check-ok">Cập nhật tồn quỹ</button>`);
};
Actions['tc-check-ok'] = () => {
  const v = UI.form(), f = Calc.fund();
  ['cash', 'bank'].forEach(k => {
    const diff = Math.round(v[k] - f[k]);
    if (diff) Store.put('expenses', { kind: diff > 0 ? 'thu' : 'chi', category: 'Chênh lệch kiểm quỹ', amount: Math.abs(diff), date: ymd(), fund: k, note: '', noPL: true });
  });
  UI.closeSheet(); render(); UI.toast('Đã cập nhật tồn quỹ');
};
