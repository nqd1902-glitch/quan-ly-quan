'use strict';
/* Khách hàng và công nợ: ghi nợ khi bán, thu nợ sau */
const Khach = {
  form(c) {
    const n = !c; c = c || { name: '', phone: '', note: '' };
    UI.sheet(`<h2>${n ? 'Thêm khách hàng' : 'Sửa khách hàng'}</h2>
      <label>Tên<input name="name" value="${esc(c.name)}" placeholder="Ví dụ: Chị Lan bán vải"></label>
      <div class="row2"><label>Số điện thoại<input name="phone" inputmode="tel" value="${esc(c.phone || '')}"></label>
      <label>Ghi chú<input name="note" value="${esc(c.note || '')}"></label></div>
      <button class="btn" data-act="kh-save" data-id="${c.id || ''}">Lưu</button>`);
  },
};

Views.khach = id => {
  if (id) return khachDetail(id);
  const list = Store.all('customers').map(c => ({ c, bal: Calc.custBalance(c.id) })).sort((a, b) => b.bal - a.bal || a.c.name.localeCompare(b.c.name, 'vi'));
  return {
    title: 'Khách hàng', back: '#/them', tab: 'them',
    html: `<div class="hero"><div class="lb">Tổng khách đang nợ</div><div class="v num">${money(Calc.totalDebt())}</div>
        <div class="ft"><span>${list.filter(x => x.bal > 0).length} khách còn nợ</span><span>${list.length} khách</span></div></div>
      ${list.length ? `<div class="list">${list.map(({ c, bal }) => `<a class="item" href="#/khach/${c.id}">
        <span class="grow"><span class="t">${esc(c.name)}</span><div class="d">${esc(c.phone || '')}${c.note ? ' · ' + esc(c.note) : ''}</div></span>
        ${bal > 0 ? `<b class="num" style="color:var(--bad)">${money(bal)}</b>` : '<span class="badge ok">Hết nợ</span>'}<span class="chev">›</span></a>`).join('')}</div>`
        : emptyBox('', 'Chưa có khách hàng nào.<br>Bấm nút ＋ để thêm, hoặc thêm ngay lúc bán hàng.')}
      <button class="fab" data-act="kh-new" aria-label="Thêm khách hàng">＋</button>`,
  };
};

function khachDetail(id) {
  const c = Store.get('customers', id);
  if (!c) { go('#/khach'); return null; }
  S.custView = id;
  const bal = Calc.custBalance(id);
  const orders = Store.all('orders').filter(o => o.custId === id && !o.cancelled).sort((a, b) => b.time - a.time).slice(0, 40);
  const pays = Store.all('debtpay').filter(d => d.custId === id).sort((a, b) => b.date.localeCompare(a.date));
  return {
    title: c.name, back: '#/khach', tab: 'them',
    html: `<div class="hero ${bal > 0 ? 'neg' : ''}"><div class="lb">Còn nợ</div><div class="v num">${money(Math.max(bal, 0))}</div>
        <div class="ft"><span>${esc(c.phone || 'Chưa có số điện thoại')}</span>${bal < 0 ? `<span>Khách trả dư ${money(-bal)}</span>` : ''}</div></div>
      <div class="btns"><button class="btn" data-act="kh-pay">Thu nợ</button><button class="btn soft" data-act="kh-edit">Sửa thông tin</button></div>
      <div class="sub">Đơn đã mua</div>
      ${orders.length ? `<div class="list">${orders.map(o => `<div class="item"><span class="grow"><span class="t">${dmy(o.date)} · ${hm(o.time)}</span><div class="d">${esc(o.items.map(it => it.qty + ' ' + it.name).join(', '))}</div></span>
        <span class="right"><b class="num">${money(o.total)}</b><br><span class="badge ${o.pay === 'debt' ? 'bad' : 'gray'}">${PAY[o.pay] || ''}</span></span></div>`).join('')}</div>` : '<p class="muted small">Chưa có đơn nào.</p>'}
      <div class="sub">Lịch sử trả nợ</div>
      ${pays.length ? `<div class="list">${pays.map(d => `<div class="item"><span class="grow"><span class="t">${dmy(d.date)}</span><div class="d">${FUND[d.fund] || FUND.cash}${d.note ? ' · ' + esc(d.note) : ''}</div></span>
        <b class="num">${money(d.amount)}</b><button class="btn sm danger" data-act="kh-pay-del" data-id="${d.id}">Xóa</button></div>`).join('')}</div>` : '<p class="muted small">Chưa có lần trả nợ nào.</p>'}
      <button class="btn danger" data-act="kh-del">Xóa khách hàng</button>`,
  };
}

Actions['kh-new'] = () => { S.custFromCart = false; Khach.form(null); };
Actions['kh-edit'] = () => { S.custFromCart = false; Khach.form(Store.get('customers', S.custView)); };
Actions['kh-save'] = el => {
  const f = UI.form();
  if (!f.name) return UI.toast('Bạn nhập tên khách nhé');
  const c = Store.put('customers', Object.assign(el.dataset.id ? Store.get('customers', el.dataset.id) : {}, f));
  if (S.custFromCart) { S.custFromCart = false; S.custId = c.id; Cart.open(); return; } // thêm khách ngay lúc bán
  UI.closeSheet(); render(); UI.toast('Đã lưu');
};
Actions['kh-del'] = () => {
  const bal = Calc.custBalance(S.custView);
  UI.confirm(bal > 0 ? `Khách này còn nợ ${money(bal)}. Xóa thì khoản nợ không còn được theo dõi.` : 'Xóa khách hàng này? Các đơn đã bán vẫn giữ nguyên.', 'Xóa', () => { Store.remove('customers', S.custView); go('#/khach'); });
};
Actions['kh-pay'] = () => {
  const bal = Calc.custBalance(S.custView);
  UI.sheet(`<h2>Thu nợ</h2><p class="muted">Đang nợ <b>${money(Math.max(bal, 0))}</b></p>
    <div class="row2"><label>Số tiền thu (đ)<input name="amount" class="money" inputmode="numeric" value="${moneyVal(Math.max(bal, 0))}" placeholder="0"></label>
    <label>Ngày<input name="date" type="date" value="${ymd()}"></label></div>
    <div class="row2"><label>Thu vào${fundSelect()}</label><label>Ghi chú<input name="note"></label></div>
    <button class="btn" data-act="kh-pay-ok">Ghi đã thu</button>`);
};
Actions['kh-pay-ok'] = () => {
  const f = UI.form();
  if (!(f.amount > 0)) return UI.toast('Nhập số tiền lớn hơn 0');
  if (!f.date) f.date = ymd();
  f.custId = S.custView;
  Store.put('debtpay', f); UI.closeSheet(); render(); UI.toast('Đã ghi thu nợ');
};
Actions['kh-pay-del'] = el => { Store.remove('debtpay', el.dataset.id); render(); };
