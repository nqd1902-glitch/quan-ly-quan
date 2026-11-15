'use strict';
/* Lương: nhân viên, chấm công, thưởng / phạt / tạm ứng, bảng lương tháng */
const STYPE = { hour: 'Theo giờ', shift: 'Theo ca', month: 'Lương tháng' };
const SUNIT = { hour: 'giờ', shift: 'ca', month: 'ngày nghỉ' };
const ADJ = { bonus: 'Thưởng', fine: 'Phạt', advance: 'Tạm ứng', paid: 'Trả lương' };
const Luong = {
  staffForm(st) {
    const n = !st; st = st || { name: '', type: 'hour', rate: 0, active: true };
    UI.sheet(`<h2>${n ? 'Thêm nhân viên' : 'Sửa nhân viên'}</h2>
      <label>Tên<input name="name" value="${esc(st.name)}"></label>
      <div class="row2"><label>Cách tính lương<select name="type">${Object.keys(STYPE).map(k => `<option value="${k}" ${st.type === k ? 'selected' : ''}>${STYPE[k]}</option>`).join('')}</select></label>
      <label>Mức lương (đ)<input name="rate" class="money" inputmode="numeric" value="${moneyVal(st.rate)}" placeholder="0"></label></div>
      <div class="muted small" style="margin-top:4px">Theo giờ: đ/giờ. Theo ca: đ/ca. Lương tháng: đ/tháng, mỗi ngày nghỉ không lương trừ 1/26.</div>
      <label class="check"><input type="checkbox" name="active" ${st.active !== false ? 'checked' : ''}> Đang làm việc</label>
      <button class="btn" data-act="luong-staff-save" data-id="${st.id || ''}">Lưu</button>`);
  },
  attForm(date) {
    const staff = Store.all('staff').filter(s => s.active !== false);
    UI.sheet(`<h2>Chấm công</h2>
      <label>Ngày<input type="date" id="att-date" value="${date}" data-in="luong-att-date"></label>
      ${staff.map(s => { const a = Store.get('attendance', s.id + '_' + date); return `<div class="row" style="margin-top:10px"><div class="grow"><b>${esc(s.name)}</b><div class="muted small">${STYPE[s.type]}</div></div>
        <input style="width:96px;margin:0;text-align:center" type="number" inputmode="decimal" step="any" min="0" data-staff="${s.id}" value="${a ? a.amount : ''}" placeholder="0"><span class="muted small" style="width:62px">${SUNIT[s.type]}</span></div>`; }).join('')}
      <button class="btn" data-act="luong-att-save">Lưu chấm công</button>`);
  },
};

Views.luong = id => {
  if (id) return luongDetail(id);
  const m = S.month, rows = Calc.payroll(m), has = Store.all('staff').length;
  return {
    title: 'Lương', back: '#/them', tab: 'them',
    html: `${monthNav(m)}
      <div class="hero"><div class="lb">Tổng lương ${monthLabel(m).toLowerCase()}</div><div class="v num">${money(rows.reduce((s, p) => s + p.gross, 0))}</div>
        <div class="ft"><span>Đã ứng, đã trả ${money(rows.reduce((s, p) => s + p.advance + p.paid, 0))}</span><span>Còn phải trả ${money(rows.reduce((s, p) => s + p.remain, 0))}</span></div></div>
      ${has ? `<div class="btns"><button class="btn" data-act="luong-att">Chấm công</button><button class="btn soft" data-act="luong-adj">Thưởng, ứng, trả lương</button></div>` : ''}
      ${rows.length ? rows.map(p => `<a class="card" style="display:block" href="#/luong/${p.st.id}">
        <div class="row"><b class="grow">${esc(p.st.name)} <span class="badge gray">${STYPE[p.st.type]}</span></b><b class="num">${money(p.gross)}</b></div>
        <div class="muted small num">${qty(p.units)} ${SUNIT[p.st.type]} · lương ${money(p.base)}${p.bonus ? ' · thưởng ' + money(p.bonus) : ''}${p.fine ? ' · phạt ' + money(p.fine) : ''}</div>
        ${p.advance || p.paid ? `<div class="small num">Đã ứng, đã trả ${money(p.advance + p.paid)} · <b>còn lĩnh ${money(p.remain)}</b></div>` : ''}</a>`).join('')
        : emptyBox('', 'Chưa có nhân viên.<br>Bấm nút ＋ để thêm.')}
      <button class="fab" data-act="luong-staff-new" aria-label="Thêm nhân viên">＋</button>`,
  };
};

function luongDetail(id) {
  const st = Store.get('staff', id);
  if (!st) { go('#/luong'); return null; }
  S.staffId = id;
  const m = S.month, p = Calc.payrollOf(st, m);
  const att = Store.all('attendance').filter(a => a.staffId === id && a.date.startsWith(m)).sort((a, b) => a.date.localeCompare(b.date));
  const adj = Store.all('payadj').filter(a => a.staffId === id && a.date.startsWith(m)).sort((a, b) => a.date.localeCompare(b.date));
  return {
    title: st.name, back: '#/luong', tab: 'them',
    html: `${monthNav(m)}
      <div class="card">
        <div class="line"><span class="muted">${STYPE[st.type]}</span><b class="num">${money(st.rate)}${st.type === 'month' ? '/tháng' : '/' + SUNIT[st.type]}</b></div>
        <div class="line"><span class="muted">Công trong tháng</span><b class="num">${qty(p.units)} ${SUNIT[st.type]}</b></div>
        <div class="line"><span class="muted">Lương</span><b class="num">${money(p.base)}</b></div>
        <div class="line"><span class="muted">Thưởng</span><b class="num">${money(p.bonus)}</b></div>
        <div class="line"><span class="muted">Phạt</span><b class="num">−${money(p.fine)}</b></div>
        <div class="line"><span class="muted">Đã tạm ứng</span><b class="num">−${money(p.advance)}</b></div>
        <div class="line"><span class="muted">Đã trả lương</span><b class="num">−${money(p.paid)}</b></div>
        <div class="line total"><span>Còn lĩnh</span><span class="num">${money(p.remain)}</span></div>
        <button class="btn soft" data-act="luong-staff-edit">Sửa nhân viên</button>
      </div>
      <div class="sub">Chấm công</div>
      ${att.length ? `<div class="list">${att.map(a => `<div class="item"><span class="grow t">${dmy(a.date)}</span><b class="num">${qty(a.amount)} ${SUNIT[st.type]}</b><button class="btn sm danger" data-act="luong-att-del" data-id="${a.id}">Xóa</button></div>`).join('')}</div>` : '<p class="muted small">Chưa chấm công tháng này.</p>'}
      <div class="sub">Thưởng / Phạt / Tạm ứng</div>
      ${adj.length ? `<div class="list">${adj.map(a => `<div class="item"><span class="grow"><span class="t">${ADJ[a.type]}</span><div class="d">${dmy(a.date)}${a.note ? ' · ' + esc(a.note) : ''}</div></span><b class="num">${money(a.amount)}</b><button class="btn sm danger" data-act="luong-adj-del" data-id="${a.id}">Xóa</button></div>`).join('')}</div>` : '<p class="muted small">Chưa có khoản nào.</p>'}
      <button class="btn danger" data-act="luong-staff-del">Xóa nhân viên</button>`,
  };
}

Actions['luong-staff-new'] = () => Luong.staffForm(null);
Actions['luong-staff-edit'] = () => Luong.staffForm(Store.get('staff', S.staffId));
Actions['luong-staff-save'] = el => {
  const f = UI.form();
  if (!f.name) return UI.toast('Bạn nhập tên nhân viên nhé');
  Store.put('staff', Object.assign(el.dataset.id ? Store.get('staff', el.dataset.id) : {}, f));
  UI.closeSheet(); render(); UI.toast('Đã lưu');
};
Actions['luong-staff-del'] = () => UI.confirm('Xóa nhân viên này? Nên bỏ tích "Đang làm việc" nếu chỉ nghỉ việc, để giữ lại bảng lương cũ.', 'Xóa', () => { Store.remove('staff', S.staffId); go('#/luong'); });
Actions['luong-att'] = () => Luong.attForm(ymd());
Inputs['luong-att-date'] = el => { if (el.value) Luong.attForm(el.value); };
Actions['luong-att-save'] = () => {
  const date = $('#att-date').value;
  $$('#sheet [data-staff]').forEach(el => {
    const id = el.dataset.staff + '_' + date, amount = parseQty(el.value);
    if (amount > 0) Store.put('attendance', { id, staffId: el.dataset.staff, date, amount });
    else if (Store.get('attendance', id)) Store.remove('attendance', id);
  });
  UI.closeSheet(); render(); UI.toast('Đã lưu chấm công ' + dmy(date));
};
Actions['luong-att-del'] = el => { Store.remove('attendance', el.dataset.id); render(); };
Actions['luong-adj'] = () => {
  const staff = Store.all('staff').filter(s => s.active !== false);
  UI.sheet(`<h2>Thưởng / Phạt / Ứng / Trả lương</h2>
    <label>Nhân viên<select name="staffId">${staff.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
    <div class="row2"><label>Loại<select name="type">${Object.keys(ADJ).map(k => `<option value="${k}">${ADJ[k]}</option>`).join('')}</select></label>
    <label>Số tiền (đ)<input name="amount" class="money" inputmode="numeric" placeholder="0"></label></div>
    <div class="row2"><label>Ngày<input name="date" type="date" value="${ymd()}"></label><label>Ghi chú<input name="note"></label></div>
    <label>Lấy tiền từ (khi tạm ứng, trả lương)${fundSelect()}</label>
    <button class="btn" data-act="luong-adj-save">Lưu</button>`);
};
Actions['luong-adj-save'] = () => {
  const f = UI.form();
  if (!f.staffId) return UI.toast('Chưa có nhân viên đang làm việc');
  if (!(f.amount > 0)) return UI.toast('Nhập số tiền lớn hơn 0');
  Store.put('payadj', f); UI.closeSheet(); render(); UI.toast('Đã lưu');
};
Actions['luong-adj-del'] = el => { Store.remove('payadj', el.dataset.id); render(); };
