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
    <div class="card"><h3>Trạm in ${Station.on() ? '<span class="badge ok">Đang bật</span>' : ''}</h3>
      <div class="muted small">Bật trên máy tính đặt ở quầy có nối máy in bill. Mỗi khi máy khác chốt đơn, máy chủ báo ngay cho máy này để in bill. Máy phải mở app suốt giờ bán.</div>
      <label class="check"><input type="checkbox" data-in="st-toggle" ${Station.on() ? 'checked' : ''}> Máy này là trạm in</label>
      ${Station.on() ? `<div class="small" style="margin-top:8px">${Sync.state.live ? 'Đang nối trực tiếp với máy chủ' : 'Đang nối lại, tạm thời hỏi máy chủ 2 giây một lần'} · Đã in ${Station.count()} bill hôm nay${Station.queue.length ? ' · đang chờ in ' + Station.queue.length : ''}</div>
      <button class="btn soft" data-act="st-guide">Cách cài để in thẳng, không hiện hộp thoại</button>` : ''}</div>
    <div class="sub">Người dùng</div>
    <div class="list">${s.members.map(m => `<div class="item"><span class="grow"><span class="t">${esc(m.name || '(chưa đặt tên)')}${m.user_id === s.session.user.id ? ' <span class="badge gray">Bạn</span>' : ''}</span></span>
      ${owner && m.role !== 'owner' ? `<select style="width:auto;margin:0;padding:8px 30px 8px 10px;font-size:14px" data-in="on-role" data-u="${m.user_id}">${['manager', 'cashier', 'staff'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${ROLE[r]}</option>`).join('')}</select>
        <button class="btn sm danger" data-act="on-kick" data-u="${m.user_id}">Xóa</button>` : `<span class="badge ok">${ROLE[m.role] || m.role}</span>`}</div>`).join('')}</div>
    ${owner ? `<div class="card"><h3>Quyền của từng vị trí</h3>
      <div class="muted small">Bấm vào ô để bật hoặc tắt quyền cho cả vị trí đó. Máy nhân viên nhận thay đổi sau khoảng 10 giây.</div>
      <table class="pm"><tr><th></th>${Perm.ROLES.map(r => `<th>${ROLE[r]}</th>`).join('')}</tr>
        <tr><td>Bán hàng, in bill</td>${Perm.ROLES.map(() => '<td><input type="checkbox" checked disabled></td>').join('')}</tr>
        ${Perm.list().map(([k, t]) => `<tr><td>${t}</td>${Perm.ROLES.map(r => `<td><input type="checkbox" data-in="pm-set" data-r="${r}" data-k="${k}" aria-label="${t} – ${ROLE[r]}" ${Perm.of(r).includes(k) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}
        <tr><td>Lương, cài đặt, người dùng, phân quyền</td><td colspan="3" class="muted small">Chỉ chủ</td></tr></table>
      ${Perm.custom() ? '<button class="btn ghost" data-act="pm-reset">Về quyền mặc định</button>' : '<div class="muted small">Đang dùng quyền mặc định.</div>'}</div>`
      : `<div class="card"><h3>Quyền của bạn (${ROLE[s.role] || ''})</h3>
      ${[['sell', 'Bán hàng, in bill'], ...Perm.list()].map(([k, t]) => `<div class="line" style="justify-content:flex-start;gap:10px"><span style="font-weight:700;color:${Perm.can(k) ? 'var(--acc)' : 'var(--muted)'}">${Perm.can(k) ? '✓' : '✕'}</span><span class="${Perm.can(k) ? '' : 'muted'}">${t}</span></div>`).join('')}</div>`}
    <button class="btn ghost" data-act="on-logout" data-clear="1">Đăng xuất khỏi máy này</button>` };
};
Inputs['pm-set'] = el => { if (Sync.state.role !== 'owner') return; Perm.set(el.dataset.r, el.dataset.k, el.checked); render(); UI.toast('Đã lưu quyền'); };
Actions['pm-reset'] = () => UI.confirm('Đưa quyền của cả 3 vị trí về mặc định?', 'Về mặc định', () => { Perm.reset(); render(); UI.toast('Đã về quyền mặc định'); });

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

Views.khongquyen = () => ({
  title: 'Không có quyền', back: '#/ban', tab: 'them',
  html: `<div class="empty">${icon('lock')}<div>Tài khoản của bạn (${ROLE[Sync.state.role] || ''}) không được xem mục này.<br>Cần thì nhờ chủ ${APP.word} đổi vai trò trong mục Bản online.</div></div>`,
});

/* Trạm in: máy ở quầy tự in bill của đơn mới nhận từ máy khác (và đơn chốt ngay trên máy này) */
const Station = {
  queue: [], busy: false,
  on() { return Sync.active() && !!Store.sys('station'); },
  printed() { return Store.sys('printed') || []; },                       // [{id, t}] các bill đã in gần đây
  count() { const d0 = new Date().setHours(0, 0, 0, 0); return Station.printed().filter(x => x.t >= d0).length; },
  /* Đơn mới từ máy khác: bỏ qua đơn đã in và đơn cũ hơn 15 phút (tránh in lại cả lịch sử khi vừa đăng nhập) */
  onNew(ids) {
    if (!Station.on()) return;
    Station.push(ids.filter(id => { const o = Store.get('orders', id); return o && Date.now() - o.time < 15 * 60000; }));
  },
  push(ids) {
    const done = new Set(Station.printed().map(x => x.id));
    ids.forEach(id => { if (!done.has(id) && !Station.queue.includes(id)) Station.queue.push(id); });
    Station.next();
  },
  next() {
    if (Station.busy || !Station.queue.length) return;
    Station.busy = true;
    const id = Station.queue.shift(), o = Store.get('orders', id);
    if (!o || o.cancelled) { Station.busy = false; return Station.next(); }
    $('#print').innerHTML = Bill.html(o);
    setTimeout(() => {
      try { window.print(); } catch (_) {}        // có hộp thoại thì lệnh này chờ tới khi đóng hộp thoại
      Store.setSys('printed', [...Station.printed(), { id, t: Date.now() }].slice(-300));
      Station.busy = false;
      if (location.hash.startsWith('#/online') && $('#sheet-wrap').classList.contains('hidden')) render();
      setTimeout(Station.next, 500);
    }, 150);
  },
  /* Giữ màn hình luôn sáng khi làm trạm in (trình duyệt hỗ trợ thì mới có tác dụng) */
  awake() { if (Station.on() && navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); },
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Station.awake(); });
Inputs['st-toggle'] = el => { Store.setSys('station', el.checked); Station.awake(); render(); UI.toast(el.checked ? 'Máy này đã là trạm in' : 'Đã tắt trạm in'); };
Actions['st-guide'] = () => UI.sheet(`<h2>In thẳng, không hiện hộp thoại</h2>
  <p class="muted small">Làm một lần trên máy tính Windows ở quầy. Nếu không làm, mỗi bill sẽ hiện hộp thoại in và phải bấm In.</p>
  <div class="line" style="justify-content:flex-start;gap:10px"><b>1</b><span>Cài máy in bill vào Windows và đặt làm <b>máy in mặc định</b>.</span></div>
  <div class="line" style="justify-content:flex-start;gap:10px"><b>2</b><span>Bấm chuột phải ngoài màn hình Windows → New → Shortcut, dán dòng dưới vào ô địa chỉ:</span></div>
  <textarea rows="4" readonly style="font-size:12.5px" id="st-cmd">"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="C:\\TramIn" --kiosk-printing --no-first-run --app=${location.origin}${location.pathname}</textarea>
  <button class="btn soft" data-act="st-copy">Sao chép dòng lệnh</button>
  <div class="line" style="justify-content:flex-start;gap:10px"><b>3</b><span>Mở app bằng lối tắt vừa tạo. Đây là một cửa sổ riêng nên phải <b>đăng nhập lại</b> và bật Trạm in trong cửa sổ đó. Mỗi ngày mở trạm in bằng đúng lối tắt này.</span></div>
  <div class="line" style="justify-content:flex-start;gap:10px"><b>4</b><span>Chốt thử một đơn trên điện thoại để xem máy in chạy. Khổ giấy chỉnh ở Cài đặt → In bill.</span></div>
  <button class="btn" data-act="sheet-close">Đóng</button>`);
Actions['st-copy'] = async () => { const t = $('#st-cmd'); try { await navigator.clipboard.writeText(t.value); UI.toast('Đã sao chép'); } catch (_) { t.select(); UI.toast('Hãy nhấn Ctrl+C để sao chép'); } };
