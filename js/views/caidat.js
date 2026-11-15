'use strict';
/* Cài đặt: tên quán, giao diện, sao lưu / khôi phục, bản quyền, dữ liệu */
Views.caidat = () => {
  const L = License.state, theme = Store.setting('theme', 'auto');
  return {
    title: 'Cài đặt', back: '#/them', tab: 'them',
    html: `<div class="card"><h3>Quán</h3>
        <label style="margin-top:0">Tên ${APP.word}<input data-in="cd-name" value="${esc(Store.setting('shopName', ''))}" maxlength="40"></label>
        <label>Giao diện</label>
        <div class="seg">${[['auto', 'Theo máy'], ['light', 'Sáng'], ['dark', 'Tối']].map(t => `<button class="${theme === t[0] ? 'on' : ''}" data-act="cd-theme" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>
      </div>
      <div class="card" ${License.can() ? '' : 'hidden'}><h3>Hình ảnh của quán</h3>
        <label style="margin-top:0">Màu chủ đạo</label>
        <div class="swatches">${Object.keys(ACCENTS).map(k => `<button class="${Store.setting('accent', APP.accent) === k ? 'on' : ''}" style="background:${ACCENTS[k][0]}" data-act="cd-accent" data-v="${k}" aria-label="${k}"></button>`).join('')}</div>
        ${[['logo', 'Logo quán', 'Hiện cạnh tên quán và trên bill', 320], ['cover', 'Ảnh bìa', 'Ảnh lớn đầu màn hình bán hàng', 1200], ['bgImg', 'Ảnh nền app', 'Phủ mờ phía sau toàn bộ app', 1200]].map(([k, t, d, max]) => { const v = Store.setting(k, ''); return `
        <div class="row imgrow">${v ? `<img class="th" src="${v}" alt="">` : '<span class="th mono">+</span>'}
          <span class="grow"><b>${t}</b><div class="muted small">${d}</div></span>
          <label class="btn sm soft">${v ? 'Đổi' : 'Chọn ảnh'}<input type="file" accept="image/*" class="hidden" data-in="cd-img" data-k="${k}" data-max="${max}"></label>
          ${v ? `<button class="btn sm ghost" data-act="cd-img-del" data-k="${k}">Bỏ</button>` : ''}</div>`; }).join('')}
        <label>Khẩu hiệu trên ảnh bìa<input data-in="cd-text" data-k="slogan" value="${esc(Store.setting('slogan', ''))}" placeholder="Ví dụ: Chạm vị tươi mát" maxlength="60"></label>
      </div>
      <div class="card"><h3>In bill</h3>
        <label style="margin-top:0">Địa chỉ in trên bill<input data-in="cd-text" data-k="billAddr" value="${esc(Store.setting('billAddr', ''))}" maxlength="80"></label>
        <div class="row2"><label>Số điện thoại<input data-in="cd-text" data-k="billPhone" inputmode="tel" value="${esc(Store.setting('billPhone', ''))}" maxlength="20"></label>
          <label>Dòng cuối bill<input data-in="cd-text" data-k="billFoot" value="${esc(Store.setting('billFoot', 'Cảm ơn quý khách!'))}" maxlength="60"></label></div>
        <label>Khổ giấy máy in</label>
        <div class="seg">${[['58', '58 mm'], ['80', '80 mm']].map(t => `<button class="${Store.setting('billW', '58') === t[0] ? 'on' : ''}" data-act="cd-billw" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>
        <label class="check"><input type="checkbox" data-in="cd-billask" ${Store.setting('billAsk', true) ? 'checked' : ''}> Hiện nút In bill sau khi chốt đơn</label>
        <p class="muted small">Bấm In bill, điện thoại sẽ mở hộp thoại in và in ra máy in đã cài trên máy. In lại bill cũ ở mục Đơn hàng.</p>
      </div>
      <div class="card"><h3>Sao lưu dữ liệu</h3>
        <p class="muted small" style="margin-top:0">Dữ liệu chỉ nằm trong điện thoại này. Hãy sao lưu định kỳ và gửi file vào Zalo/Drive của bạn, phòng khi mất máy hoặc xóa trình duyệt.</p>
        ${Store.persistent ? '' : '<div class="note">Trình duyệt đang ở chế độ ẩn danh nên dữ liệu sẽ mất khi đóng. Hãy mở bằng tab thường.</div>'}
        <button class="btn" data-act="backup">Sao lưu ra file</button>
        <label class="btn soft" style="color:var(--pri)">Khôi phục từ file<input type="file" accept=".json,application/json" class="hidden" data-in="cd-restore"></label>
      </div>
      <div class="card"><h3>Bản quyền ${L.tier ? `<span class="badge ok">${License.tierName()}</span>` : `<span class="badge warn">Dùng thử còn ${L.daysLeft} ngày</span>`}</h3>
        ${L.tier === 'pro' ? `<div class="muted small">Mã máy</div><div class="code">${L.deviceId}</div>` : (L.tier === 'basic' ? '<p class="muted small" style="margin-top:0">Đang dùng bản thường. Nhập mã của bản nâng cấp để mở thêm tính năng.</p>' : '') + License.boxHtml() + '<a class="btn soft" href="#/nangcap">Xem tính năng bản nâng cấp</a>'}
      </div>
      <div class="card"><h3>Dữ liệu</h3>
        <button class="btn soft" data-act="cd-seed">Nạp dữ liệu mẫu</button>
        <button class="btn danger" data-act="cd-wipe">Xóa toàn bộ dữ liệu</button>
      </div>
      <p class="muted small" style="text-align:center">${APP.name} · bản offline 1.1</p>`,
  };
};

Actions['cd-accent'] = el => { Store.setSetting('accent', el.dataset.v); applyTheme(); render(); };
Inputs['cd-img'] = el => pickImage(el.files && el.files[0], +el.dataset.max, data => { Store.setSetting(el.dataset.k, data); applyTheme(); render(); UI.toast('Đã lưu ảnh'); });
Actions['cd-img-del'] = el => { Store.setSetting(el.dataset.k, ''); applyTheme(); render(); };
Inputs['cd-text'] = el => Store.setSetting(el.dataset.k, el.value.trim());
Actions['cd-billw'] = el => { Store.setSetting('billW', el.dataset.v); render(); };
Inputs['cd-check'] = el => Store.setSetting(el.dataset.k, el.checked);
Inputs['cd-billask'] = el => Store.setSetting('billAsk', el.checked);
Inputs['cd-name'] = el => { if (el.value.trim()) Store.setSetting('shopName', el.value.trim()); };
Actions['cd-theme'] = el => { Store.setSetting('theme', el.dataset.v); applyTheme(); render(); };

Actions.backup = async () => {
  const blob = new Blob([JSON.stringify(Store.exportAll())], { type: 'application/json' });
  if (await saveFile(blob, `sao-luu-quan-${ymd()}.json`)) Store.setSetting('lastBackup', ymd());
};
Inputs['cd-restore'] = el => {
  const file = el.files && el.files[0]; if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    let json; try { json = JSON.parse(rd.result); } catch (_) { return UI.toast('File không đọc được'); }
    if (!json || json.app !== 'quanlyquan') return UI.toast('Đây không phải file sao lưu của app');
    UI.confirm(`Khôi phục bản sao lưu ngày ${String(json.exportedAt || '').slice(0, 10)}? Dữ liệu hiện tại trên máy sẽ bị thay thế.`, 'Khôi phục', async () => {
      await Store.importAll(json); applyTheme(); S.cart = []; go('#/ban'); UI.toast('Đã khôi phục dữ liệu');
    });
  };
  rd.readAsText(file); el.value = '';
};
Actions['cd-seed'] = () => UI.confirm('Nạp thực đơn và kho mẫu? Dữ liệu mẫu được thêm vào, không xóa dữ liệu đang có.', 'Nạp mẫu', () => { Seed.load(); render(); UI.toast('Đã nạp dữ liệu mẫu'); });
Actions['cd-wipe'] = () => UI.confirm('Xóa toàn bộ món, kho, đơn hàng, lương, chi phí? Không khôi phục được nếu chưa sao lưu.', 'Xóa hết', async () => {
  // giữ lại tên quán, hình ảnh, cài đặt in bill; chỉ xóa số liệu
  const keep = ['shopName', 'theme', 'accent', 'logo', 'cover', 'bgImg', 'slogan', 'billAddr', 'billPhone', 'billFoot', 'billW', 'billAsk', 'lastBackup'].map(k => [k, Store.setting(k)]);
  await Store.clearData(); keep.forEach(([k, v]) => { if (v !== undefined) Store.setSetting(k, v); });
  S.cart = []; go('#/ban'); UI.toast('Đã xóa toàn bộ dữ liệu');
});

Actions['lic-copy'] = async () => {
  try { await navigator.clipboard.writeText(License.state.deviceId); UI.toast('Đã sao chép mã máy'); }
  catch (_) { UI.toast('Hãy nhấn giữ vào mã máy để sao chép'); }
};
Actions['lic-activate'] = async () => {
  const key = $('#lic-key').value.trim();
  if (!key) return UI.toast('Bạn dán mã kích hoạt vào trước nhé');
  if (await License.activate(key)) { UI.toast('Đã kích hoạt ' + License.tierName().toLowerCase()); if ($('#overlay').classList.contains('hidden')) render(); else App.enter(); }
  else UI.toast(License.state.canVerify ? 'Mã kích hoạt không đúng với máy này' : 'Chưa kiểm tra được mã, hãy mở app bằng link https');
};

Views.nangcap = () => ({ title: 'Bản nâng cấp', back: '#/them', tab: 'them', html: License.upgradeHtml() });
