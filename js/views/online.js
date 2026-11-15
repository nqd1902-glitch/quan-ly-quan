'use strict';
/* Màn hình bản online: đăng nhập, tạo cửa hàng hoặc vào bằng mã, người dùng, trạng thái đồng bộ */
const Online = {
  busy(el, on) { el.disabled = on; el.style.opacity = on ? '.6' : ''; },
  async run(el, fn, okMsg) {
    Online.busy(el, true);
    try { await fn(); if (okMsg) UI.toast(okMsg); } catch (e) { UI.toast(e.message || 'Có lỗi, thử lại sau'); }
    Online.busy(el, false);
    if (location.hash.startsWith('#/online')) render(); else App.enter();
  },
  statusText() {
    const s = Sync.state;
    if (!navigator.onLine) return 'Đang mất mạng – vẫn dùng được, có mạng sẽ tự đồng bộ';
    if (s.state === 'err') return 'Chưa đồng bộ được: ' + s.error;
    if (Sync.pending()) return `Đang chờ đưa ${Sync.pending()} thay đổi lên mạng`;
    return s.lastSync ? 'Đã đồng bộ lúc ' + hm(s.lastSync) : 'Đang đồng bộ…';
  },
};

Views.online = () => {
  const s = Sync.state, base = { title: 'Bản online', back: '#/them', tab: 'them' };
  // 1. chưa đăng nhập
  if (!s.session) return { ...base, html: `<div class="card"><h3>Dùng chung dữ liệu trên nhiều máy</h3>
      <div class="muted small">Chủ xem doanh thu từ xa, nhân viên bán trên máy riêng, số liệu tự lưu lên mạng. Mất mạng vẫn bán được.</div>
      <label>Số điện thoại<input id="on-id" inputmode="tel" autocomplete="username" placeholder="Ví dụ: 0901234567"></label>
      <label>Mật khẩu (từ 6 ký tự)<input id="on-pass" type="password" autocomplete="current-password"></label>
      <button class="btn" data-act="on-login">Đăng nhập</button>
      <button class="btn soft" data-act="on-signup">Tạo tài khoản mới</button>
      <p class="muted small">Quên mật khẩu thì liên hệ người bán qua Zalo ${SELLER_ZALO}.</p></div>` };
  // 2. đã đăng nhập nhưng chưa thuộc cửa hàng nào
  if (!s.shop) return { ...base, html: `<div class="card"><h3>Bạn là chủ ${APP.word}?</h3>
      <div class="muted small">Tạo ${APP.word} trên mạng và đưa toàn bộ dữ liệu đang có trên máy này lên. Được dùng thử 14 ngày.</div>
      <label>Tên của bạn<input id="on-name" placeholder="Ví dụ: Chị Nhung" maxlength="40"></label>
      <button class="btn" data-act="on-create">Tạo ${APP.word} và đưa dữ liệu lên</button></div>
    <div class="card"><h3>Bạn là nhân viên?</h3>
      <div class="muted small">Nhập mã tham gia chủ ${APP.word} đưa cho bạn. Dữ liệu đang có trên máy này sẽ được thay bằng dữ liệu của ${APP.word}.</div>
      <div class="row2"><label>Mã tham gia<input id="on-code" maxlength="6" style="text-transform:uppercase" placeholder="6 ký tự"></label>
      <label>Tên của bạn<input id="on-name2" maxlength="40"></label></div>
      <button class="btn" data-act="on-join">Vào ${APP.word}</button></div>
    <button class="btn ghost" data-act="on-logout" data-clear="0">Đăng xuất</button>` };
  // 3. đang trong một cửa hàng
  const sh = s.shop, owner = s.role === 'owner', ok = Sync.paid();
  return { ...base, html: `<div class="hero ${ok ? '' : 'neg'}"><div class="lb">${esc(sh.name)} · ${ROLE[s.role] || ''}</div>
      <div class="v" style="font-size:22px">${ok ? 'Hạn dùng đến ' + dmy(sh.paid_until) : 'Gói online đã hết hạn ' + dmy(sh.paid_until)}</div>
      <div class="ft"><span>Gói ${sh.max_users} người dùng</span><span>Đang có ${s.members.length} người</span></div></div>
    ${ok ? '' : `<div class="note">Hết hạn thì máy này vẫn xem được dữ liệu nhưng không lưu được lên mạng. Liên hệ Zalo ${SELLER_ZALO} để gia hạn.</div>`}
    <div class="card"><div class="row"><span class="grow small">${esc(Online.statusText())}</span><button class="btn sm soft" data-act="on-sync">Đồng bộ ngay</button></div></div>
    ${owner ? `<div class="card"><h3>Mã tham gia cho nhân viên</h3><div class="code">${esc(sh.join_code)}</div>
      <div class="muted small" style="margin-top:6px">Nhân viên mở app trên máy của họ, vào Thêm → Bản online, tạo tài khoản rồi nhập mã này.</div>
      <button class="btn ghost" data-act="on-newcode">Đổi mã khác</button></div>` : ''}
    <div class="sub">Người dùng</div>
    <div class="list">${s.members.map(m => `<div class="item"><span class="grow"><span class="t">${esc(m.name || '(chưa đặt tên)')}${m.user_id === s.session.user.id ? ' <span class="badge gray">Bạn</span>' : ''}</span></span>
      ${owner && m.role !== 'owner' ? `<select style="width:auto;margin:0;padding:8px 30px 8px 10px;font-size:14px" data-in="on-role" data-u="${m.user_id}">${['manager', 'cashier', 'staff'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${ROLE[r]}</option>`).join('')}</select>
        <button class="btn sm danger" data-act="on-kick" data-u="${m.user_id}">Xóa</button>` : `<span class="badge ok">${ROLE[m.role] || m.role}</span>`}</div>`).join('')}</div>
    <button class="btn ghost" data-act="on-logout" data-clear="1">Đăng xuất khỏi máy này</button>` };
};

Actions['on-login'] = el => { const id = $('#on-id').value.trim(), p = $('#on-pass').value; if (!id || !p) return UI.toast('Nhập số điện thoại và mật khẩu'); Online.run(el, () => Sync.signIn(id, p)); };
Actions['on-signup'] = el => { const id = $('#on-id').value.trim(), p = $('#on-pass').value; if (!id) return UI.toast('Nhập số điện thoại'); if (p.length < 6) return UI.toast('Mật khẩu phải từ 6 ký tự'); Online.run(el, () => Sync.signUp(id, p), 'Đã tạo tài khoản'); };
Actions['on-create'] = el => { const n = $('#on-name').value.trim(); if (!n) return UI.toast('Nhập tên của bạn'); Online.run(el, () => Sync.createShop(n), 'Đã đưa dữ liệu lên mạng'); };
Actions['on-join'] = el => { const c = $('#on-code').value.trim(), n = $('#on-name2').value.trim(); if (c.length < 4 || !n) return UI.toast('Nhập mã tham gia và tên của bạn'); Online.run(el, () => Sync.joinShop(c, n), 'Đã vào ' + APP.word); };
Actions['on-sync'] = el => Online.run(el, () => Sync.reload());
Actions['on-newcode'] = el => UI.confirm('Đổi mã tham gia? Mã cũ sẽ không dùng được nữa. Người đã vào rồi không bị ảnh hưởng.', 'Đổi mã', () => Online.run(el, () => Sync.newCode()));
Inputs['on-role'] = el => Online.run(el, () => Sync.setRole(el.dataset.u, el.value), 'Đã đổi vai trò');
Actions['on-kick'] = el => UI.confirm('Xóa người này khỏi cửa hàng? Họ sẽ không xem và không bán được nữa.', 'Xóa', () => Online.run(el, () => Sync.removeMember(el.dataset.u)));
Actions['on-logout'] = el => {
  if (el.dataset.clear !== '1') return Online.run(el, () => Sync.signOut(false));
  UI.confirm(Sync.pending() ? `Còn ${Sync.pending()} thay đổi chưa đưa lên mạng, đăng xuất sẽ mất. Vẫn đăng xuất?` : 'Đăng xuất và xóa dữ liệu của cửa hàng khỏi máy này? Dữ liệu vẫn còn trên mạng, đăng nhập lại là có.', 'Đăng xuất', () => Online.run(el, () => Sync.signOut(true)));
};
