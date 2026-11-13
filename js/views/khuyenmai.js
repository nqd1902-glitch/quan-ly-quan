'use strict';
/* Chương trình khuyến mãi: giảm % hoặc giảm tiền, cho cả đơn / một nhóm / một món */
const KM = {
  desc(pr) {
    const v = pr.type === 'percent' ? `Giảm ${qty(pr.value)}%` : `Giảm ${money(pr.value)}`;
    let s = 'toàn đơn';
    if (pr.scope === 'category') s = 'nhóm ' + pr.target;
    if (pr.scope === 'product') { const p = Store.get('products', pr.target); s = p ? p.name : '(món đã xóa)'; }
    return `${v} · ${s}${pr.minTotal ? ' · đơn từ ' + money(pr.minTotal) : ''}`;
  },
  status(pr) {
    const t = ymd();
    if (pr.active === false) return ['gray', 'Đang tắt'];
    if (pr.from && t < pr.from) return ['warn', 'Chưa tới ngày'];
    if (pr.to && t > pr.to) return ['bad', 'Hết hạn'];
    return ['ok', 'Đang chạy'];
  },
  targetHtml(scope, target) {
    if (scope === 'category') return `<label>Nhóm món<select name="target">${Mon.cats().map(c => `<option ${c === target ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`;
    if (scope === 'product') return `<label>Món<select name="target">${Store.all('products').filter(p => p.name).map(p => `<option value="${p.id}" ${p.id === target ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
    return '';
  },
  form(pr) {
    const n = !pr; pr = pr || { name: '', type: 'percent', value: 10, scope: 'order', target: '', minTotal: 0, from: '', to: '', active: true };
    UI.sheet(`<h2>${n ? 'Thêm khuyến mãi' : 'Sửa khuyến mãi'}</h2>
      <label>Tên chương trình<input name="name" value="${esc(pr.name)}" placeholder="Ví dụ: Khai trương giảm 10%"></label>
      <div class="row2"><label>Kiểu giảm<select name="type"><option value="percent" ${pr.type === 'percent' ? 'selected' : ''}>Giảm %</option><option value="amount" ${pr.type === 'amount' ? 'selected' : ''}>Giảm tiền (đ)</option></select></label>
      <label>Mức giảm<input name="value" type="number" inputmode="decimal" step="any" min="0" value="${pr.value || ''}"></label></div>
      <label>Áp dụng cho<select name="scope" data-in="km-scope"><option value="order" ${pr.scope === 'order' ? 'selected' : ''}>Toàn đơn hàng</option><option value="category" ${pr.scope === 'category' ? 'selected' : ''}>Một nhóm món</option><option value="product" ${pr.scope === 'product' ? 'selected' : ''}>Một món</option></select></label>
      <div id="km-target">${KM.targetHtml(pr.scope, pr.target)}</div>
      <label>Đơn tối thiểu (đ) – bỏ trống nếu không cần<input name="minTotal" class="money" inputmode="numeric" value="${moneyVal(pr.minTotal)}" placeholder="0"></label>
      <div class="row2"><label>Từ ngày<input name="from" type="date" value="${pr.from || ''}"></label><label>Đến ngày<input name="to" type="date" value="${pr.to || ''}"></label></div>
      <div class="muted small" style="margin-top:4px">Bỏ trống ngày nếu chương trình chạy không thời hạn.</div>
      <label class="check"><input type="checkbox" name="active" ${pr.active !== false ? 'checked' : ''}> Đang bật</label>
      <button class="btn" data-act="km-save" data-id="${pr.id || ''}">Lưu</button>
      ${n ? '' : `<button class="btn danger" data-act="km-del" data-id="${pr.id}">Xóa chương trình</button>`}`);
  },
};

Views.km = () => {
  const list = Store.all('promos');
  return {
    title: 'Khuyến mãi', back: '#/them', tab: 'them',
    html: `<p class="muted small">Khi chốt đơn, app tự chọn chương trình đang chạy có mức giảm tốt nhất. Bạn vẫn đổi hoặc bỏ được ngay trong đơn.</p>
      ${list.length ? `<div class="list">${list.map(pr => { const [c, t] = KM.status(pr); return `<button class="item" data-act="km-open" data-id="${pr.id}"><span class="ico">${icon('tag')}</span>
        <span class="grow"><span class="t">${esc(pr.name)}</span><div class="d">${esc(KM.desc(pr))}</div>
        ${pr.from || pr.to ? `<div class="d">${pr.from ? dmy(pr.from) : '…'} → ${pr.to ? dmy(pr.to) : '…'}</div>` : ''}</span>
        <span class="badge ${c}">${t}</span></button>`; }).join('')}</div>` : emptyBox('', 'Chưa có chương trình khuyến mãi nào.<br>Bấm nút ＋ để tạo.')}
      <button class="fab" data-act="km-new" aria-label="Thêm khuyến mãi">＋</button>`,
  };
};
Actions['km-new'] = () => KM.form(null);
Actions['km-open'] = el => KM.form(Store.get('promos', el.dataset.id));
Inputs['km-scope'] = el => { $('#km-target').innerHTML = KM.targetHtml(el.value, ''); };
Actions['km-save'] = el => {
  const f = UI.form();
  if (!f.name) return UI.toast('Bạn đặt tên chương trình nhé');
  if (!(f.value > 0)) return UI.toast('Mức giảm phải lớn hơn 0');
  if (f.type === 'percent' && f.value > 100) return UI.toast('Giảm % tối đa là 100');
  if (f.scope !== 'order' && !f.target) return UI.toast('Chưa có nhóm/món để áp dụng');
  if (f.from && f.to && f.from > f.to) return UI.toast('Ngày kết thúc phải sau ngày bắt đầu');
  if (f.scope === 'order') f.target = '';
  Store.put('promos', Object.assign(el.dataset.id ? Store.get('promos', el.dataset.id) : {}, f));
  UI.closeSheet(); render(); UI.toast('Đã lưu khuyến mãi');
};
Actions['km-del'] = el => { Store.remove('promos', el.dataset.id); UI.closeSheet(); render(); UI.toast('Đã xóa'); };
