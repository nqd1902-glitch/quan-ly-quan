'use strict';
/* Cài đặt: tên quán, giao diện, sao lưu / khôi phục, bản quyền, dữ liệu */
Views.caidat = () => {
  const L = License.state, theme = Store.setting('theme', 'auto');
  return {
    title: 'Cài đặt', back: '#/them', tab: 'them',
    html: `<div class="card"><h3>Quán</h3>
        <label style="margin-top:0">Tên quán<input data-in="cd-name" value="${esc(Store.setting('shopName', ''))}" maxlength="40"></label>
        <label>Giao diện</label>
        <div class="seg">${[['auto', 'Theo máy'], ['light', 'Sáng'], ['dark', 'Tối']].map(t => `<button class="${theme === t[0] ? 'on' : ''}" data-act="cd-theme" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>
      </div>
      <div class="card"><h3>Sao lưu dữ liệu</h3>
        <p class="muted small" style="margin-top:0">Dữ liệu chỉ nằm trong điện thoại này. Hãy sao lưu định kỳ và gửi file vào Zalo/Drive của bạn, phòng khi mất máy hoặc xóa trình duyệt.</p>
        ${Store.persistent ? '' : '<div class="note">Trình duyệt đang ở chế độ ẩn danh nên dữ liệu sẽ mất khi đóng. Hãy mở bằng tab thường.</div>'}
        <button class="btn" data-act="backup">Sao lưu ra file</button>
        <label class="btn soft" style="color:var(--pri)">Khôi phục từ file<input type="file" accept=".json,application/json" class="hidden" data-in="cd-restore"></label>
      </div>
      <div class="card"><h3>Bản quyền ${L.activated ? '<span class="badge ok">Đã kích hoạt</span>' : `<span class="badge warn">Dùng thử còn ${L.daysLeft} ngày</span>`}</h3>
        ${L.activated ? `<div class="muted small">Mã máy</div><div class="code">${L.deviceId}</div>` : License.boxHtml()}
      </div>
      <div class="card"><h3>Dữ liệu</h3>
        <button class="btn soft" data-act="cd-seed">Nạp dữ liệu mẫu</button>
        <button class="btn danger" data-act="cd-wipe">Xóa toàn bộ dữ liệu</button>
      </div>
      <p class="muted small" style="text-align:center">Quản lý quán · bản offline 1.0</p>`,
  };
};

Inputs['cd-name'] = el => { if (el.value.trim()) Store.setSetting('shopName', el.value.trim()); };
Actions['cd-theme'] = el => { Store.setSetting('theme', el.dataset.v); applyTheme(); render(); };

Actions.backup = async () => {
  const text = JSON.stringify(Store.exportAll());
  const name = `sao-luu-quan-${ymd()}.json`;
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  UI.toast('Đã lưu file ' + name);
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
  const name = Store.setting('shopName', ''), theme = Store.setting('theme', 'auto');
  await Store.clearData(); Store.setSetting('shopName', name); Store.setSetting('theme', theme);
  S.cart = []; go('#/ban'); UI.toast('Đã xóa toàn bộ dữ liệu');
});

Actions['lic-copy'] = async () => {
  try { await navigator.clipboard.writeText(License.state.deviceId); UI.toast('Đã sao chép mã máy'); }
  catch (_) { UI.toast('Hãy nhấn giữ vào mã máy để sao chép'); }
};
Actions['lic-activate'] = async () => {
  const key = $('#lic-key').value.trim();
  if (!key) return UI.toast('Bạn dán mã kích hoạt vào trước nhé');
  if (await License.activate(key)) { UI.toast('Kích hoạt thành công'); if ($('#overlay').classList.contains('hidden')) render(); else App.enter(); }
  else UI.toast(License.state.canVerify ? 'Mã kích hoạt không đúng với máy này' : 'Chưa kiểm tra được mã, hãy mở app bằng link https');
};
