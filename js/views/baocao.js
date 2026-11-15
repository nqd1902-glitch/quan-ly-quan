'use strict';
/* Báo cáo tháng + menu Thêm */
Views.baocao = () => {
  const m = S.month, r = Calc.monthReport(m);
  const [y, mo] = m.split('-').map(Number);
  const days = new Date(y, mo, 0).getDate();
  const vals = Array.from({ length: days }, (_, i) => r.byDay[`${m}-${pad(i + 1)}`] || 0);
  const max = Math.max(...vals, 1);
  const today = Store.all('orders').filter(o => !o.cancelled && o.date === ymd());
  const top = Object.values(r.byProd).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const stat = (lb, v, cls = '') => `<div class="stat"><div class="lb">${lb}</div><div class="v num ${cls}">${v}</div></div>`;
  return {
    title: 'Báo cáo',
    html: `${monthNav(m)}
      <div class="hero ${r.net < 0 ? 'neg' : ''}"><div class="lb">Lãi ròng ${monthLabel(m).toLowerCase()}</div><div class="v num">${money(r.net)}</div>
        <div class="ft"><span>${r.count} đơn</span><span>Hôm nay: ${money(today.reduce((s, o) => s + o.total, 0))} · ${today.length} đơn</span></div></div>
      <div class="stats">
        ${stat('Doanh thu', money(r.revenue))}
        ${stat('Giá vốn hàng bán', money(r.cogs))}
        ${stat('Lãi gộp', money(r.gross) + (r.revenue ? ` <span class="badge ok">${Math.round(r.gross / r.revenue * 100)}%</span>` : ''))}
        ${stat('Lương', money(r.salary))}
        ${stat('Chi phí', money(r.expenses))}
        ${stat('Hủy & lệch kho', money(r.waste))}
      </div>
      <div class="card"><h3>Doanh thu theo ngày</h3>
        <div class="bars">${vals.map(v => `<i class="${v ? '' : 'z'}" style="height:${Math.max(2, v / max * 100)}%" title="${money(v)}"></i>`).join('')}</div>
        <div class="axis"><span>1</span><span>${Math.round(days / 2)}</span><span>${days}</span></div></div>
      <div class="card"><h3>Món bán chạy</h3>
        ${top.length ? top.map(t => `<div class="line"><span>${esc(t.name)} <span class="muted small">× ${t.qty}</span></span><b class="num">${money(t.revenue)}</b></div>`).join('') : '<p class="muted small">Chưa có đơn nào trong tháng.</p>'}</div>
      <div class="card"><h3>Thông tin thêm</h3>
        ${Object.keys(r.byPay).map(k => `<div class="line"><span class="muted">Thu ${(PAY[k] || k).toLowerCase()}</span><b class="num">${money(r.byPay[k])}</b></div>`).join('')}
        <div class="line"><span class="muted">Khuyến mãi đã giảm cho khách</span><b class="num">${money(r.discount)}</b></div>
        <div class="line"><span class="muted">Tiền nhập hàng trong tháng</span><b class="num">${money(r.purchases)}</b></div>
        <p class="muted small">Lãi ròng = Doanh thu − Giá vốn − Lương − Chi phí − Hủy & lệch kho. Tiền nhập hàng không trừ trực tiếp vì đã tính vào giá vốn khi bán.</p></div>
      <button class="btn soft" data-act="bc-xlsx">Xuất báo cáo tháng ra Excel</button>`,
  };
};

Views.them = () => {
  const item = (href, emo, t, d) => `<a class="item" href="${href}"><span class="ico">${icon(emo)}</span><span class="grow"><span class="t">${t}</span><div class="d">${d}</div></span><span class="chev">›</span></a>`;
  return {
    title: 'Thêm',
    html: `<div class="list">
      ${item('#/don', 'receipt', 'Đơn hàng', 'Xem lại, hủy đơn theo ngày')}
      ${item('#/km', 'tag', 'Khuyến mãi', 'Giảm %, giảm tiền theo đơn, nhóm, món')}
      ${item('#/luong', 'users', 'Lương', 'Nhân viên, chấm công, thưởng, tạm ứng')}
      ${item('#/chiphi', 'wallet', 'Chi phí', 'Mặt bằng, điện nước, chi khác')}
      ${item('#/caidat', 'gear', 'Cài đặt', 'Tên quán, sao lưu, bản quyền')}
    </div>`,
  };
};

/* Xuất báo cáo tháng ra file Excel: 6 sheet, các dòng cộng dùng công thức */
Actions['bc-xlsx'] = () => {
  const m = S.month, r = Calc.monthReport(m);
  const H = a => a.map(v => ({ v, s: 1 })), M = v => ({ v: Math.round(v || 0), s: 2 });
  const tong = [
    H(['Báo cáo ' + monthLabel(m).toLowerCase(), Store.setting('shopName', '')]),
    H(['Chỉ tiêu', 'Số tiền (đ)']),
    ['Doanh thu', M(r.revenue)], ['Giá vốn hàng bán', M(r.cogs)], [{ v: 'Lãi gộp', s: 1 }, { f: 'B3-B4', s: 3 }],
    ['Lương', M(r.salary)], ['Chi phí', M(r.expenses)], ['Hủy và lệch kho', M(r.waste)], [{ v: 'Lãi ròng', s: 1 }, { f: 'B5-B6-B7-B8', s: 3 }],
    [], ['Số đơn', r.count], ['Khuyến mãi đã giảm cho khách', M(r.discount)], ['Tiền nhập hàng trong tháng', M(r.purchases)],
  ];
  const don = [H(['Ngày', 'Giờ', 'Món', 'Size / bán kèm', 'SL', 'Đơn giá', 'Thành tiền', 'Giảm giá đơn', 'Thanh toán'])];
  Store.all('orders').filter(o => !o.cancelled && o.date.startsWith(m)).sort((a, b) => a.time - b.time).forEach(o => o.items.forEach((it, i) => {
    const n = don.length + 1;
    don.push([dmy(o.date), hm(o.time), it.name, it.vname, it.qty, M(it.price), { f: `E${n}*F${n}`, s: 2 }, i === 0 && o.discount ? M(o.discount) : '', PAY[o.pay] || '']);
  }));
  if (don.length > 1) {
    const last = don.length;
    don.push([{ v: 'Tổng', s: 1 }, '', '', '', { f: `SUM(E2:E${last})`, s: 1 }, '', { f: `SUM(G2:G${last})`, s: 3 }, { f: `SUM(H2:H${last})`, s: 3 }]);
    don.push([{ v: 'Doanh thu (thành tiền − giảm giá)', s: 1 }, '', '', '', '', '', { f: `G${last + 1}-H${last + 1}`, s: 3 }]);
  }
  const mon = [H(['Món', 'Số lượng bán', 'Doanh thu'])];
  Object.values(r.byProd).sort((a, b) => b.revenue - a.revenue).forEach(t => mon.push([t.name, t.qty, M(t.revenue)]));
  if (mon.length > 1) mon.push([{ v: 'Tổng', s: 1 }, { f: `SUM(B2:B${mon.length})`, s: 1 }, { f: `SUM(C2:C${mon.length})`, s: 3 }]);
  const chi = [H(['Ngày', 'Loại', 'Số tiền', 'Ghi chú', 'Hằng tháng'])];
  Calc.expensesOf(m).forEach(e => chi.push([dmy(e.date), e.category, M(e.amount), e.note || '', e.recurring ? 'Có' : '']));
  if (chi.length > 1) chi.push([{ v: 'Tổng', s: 1 }, '', { f: `SUM(C2:C${chi.length})`, s: 3 }]);
  const luong = [H(['Nhân viên', 'Cách tính', 'Công', 'Lương', 'Thưởng', 'Phạt', 'Tổng lương', 'Tạm ứng', 'Còn lĩnh'])];
  Calc.payroll(m).forEach(p => { const n = luong.length + 1; luong.push([p.st.name, STYPE[p.st.type], p.units, M(p.base), M(p.bonus), M(p.fine), { f: `D${n}+E${n}-F${n}`, s: 2 }, M(p.advance), { f: `G${n}-H${n}`, s: 2 }]); });
  if (luong.length > 1) { const l = luong.length; luong.push([{ v: 'Tổng', s: 1 }, '', '', ...'DEFGHI'.split('').map(c => ({ f: `SUM(${c}2:${c}${l})`, s: 3 }))]); }
  const kho = [H(['Nguyên liệu', 'Nhóm', 'Tồn kho', 'Đơn vị', 'Giá vốn / đơn vị', 'Trị giá tồn'])];
  Store.all('ingredients').sort((a, b) => a.name.localeCompare(b.name, 'vi')).forEach(i => { const n = kho.length + 1; kho.push([i.name, i.group || '', +((+i.stock || 0) / (+i.factor || 1)).toFixed(3), i.buyUnit, M(i.price), { f: `MAX(C${n},0)*E${n}`, s: 2 }]); });
  if (kho.length > 1) kho.push([{ v: 'Tổng', s: 1 }, '', '', '', '', { f: `SUM(F2:F${kho.length})`, s: 3 }]);
  const blob = Xlsx.build([
    { name: 'Tổng hợp', rows: tong, widths: [34, 18] },
    { name: 'Đơn hàng', rows: don, widths: [12, 8, 34, 24, 6, 12, 14, 14, 14] },
    { name: 'Món bán', rows: mon, widths: [38, 14, 16] },
    { name: 'Chi phí', rows: chi, widths: [12, 20, 14, 30, 12] },
    { name: 'Lương', rows: luong, widths: [22, 14, 8, 14, 12, 12, 14, 12, 14] },
    { name: 'Kho hiện tại', rows: kho, widths: [28, 14, 10, 10, 16, 16] },
  ]);
  saveFile(blob, `bao-cao-${m}.xlsx`);
};
