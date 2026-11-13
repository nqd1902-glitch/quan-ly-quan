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
        <p class="muted small">Lãi ròng = Doanh thu − Giá vốn − Lương − Chi phí − Hủy & lệch kho. Tiền nhập hàng không trừ trực tiếp vì đã tính vào giá vốn khi bán.</p></div>`,
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
