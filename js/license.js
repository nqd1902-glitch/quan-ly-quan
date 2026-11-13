'use strict';
/* Bản quyền bản offline: dùng thử TRIAL_DAYS ngày, sau đó cần mã kích hoạt gắn với mã máy.
   Mã kích hoạt là chữ ký số ECDSA của mã máy; app chỉ giữ khóa công khai nên không tự tạo mã được. */
const License = (() => {
  const TRIAL_DAYS = 7, DAY = 86400000;
  const st = { deviceId: '', activated: false, daysLeft: TRIAL_DAYS, canVerify: true };
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} } };

  function newId() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(12);
    crypto.getRandomValues(b);
    return [...b].map(x => A[x % A.length]).join('').replace(/(.{4})(?=.)/g, '$1-');
  }
  function b64u(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }
  async function verify(key) {
    if (!(window.crypto && crypto.subtle)) { st.canVerify = false; return false; }
    try {
      const k = await crypto.subtle.importKey('jwk', LICENSE_PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, b64u(String(key).replace(/\s/g, '')), new TextEncoder().encode('QLQ1|' + st.deviceId));
    } catch (_) { return false; }
  }

  return {
    state: st, TRIAL_DAYS,
    async init() {
      st.deviceId = Store.sys('deviceId') || ls.get('qlq_device') || newId();
      Store.setSys('deviceId', st.deviceId); ls.set('qlq_device', st.deviceId);
      const now = Date.now();
      const firsts = [Store.sys('firstRun'), +ls.get('qlq_first')].filter(x => x > 0);
      const first = firsts.length ? Math.min(...firsts) : now;
      Store.setSys('firstRun', first); ls.set('qlq_first', String(first));
      // chống chỉnh lùi đồng hồ: luôn lấy mốc thời gian lớn nhất từng thấy
      const seen = Math.max(now, Store.sys('lastSeen') || 0, +ls.get('qlq_seen') || 0);
      Store.setSys('lastSeen', seen); ls.set('qlq_seen', String(seen));
      st.daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - (seen - first) / DAY));
      const key = Store.sys('licenseKey');
      st.activated = key ? await verify(key) : false;
    },
    locked() { return !st.activated && st.daysLeft <= 0; },
    async activate(key) {
      if (!(await verify(key))) return false;
      Store.setSys('licenseKey', String(key).replace(/\s/g, '')); st.activated = true; return true;
    },
    boxHtml() {
      return `<label style="margin-top:0">Mã máy của bạn</label><div class="code" id="lic-id">${st.deviceId}</div>
        <button class="btn soft" data-act="lic-copy">Sao chép mã máy</button>
        <label>Mã kích hoạt<textarea id="lic-key" rows="3" placeholder="Dán mã kích hoạt người bán gửi cho bạn"></textarea></label>
        ${st.canVerify ? '' : '<div class="note">Trình duyệt đang mở app qua địa chỉ không bảo mật nên chưa kiểm tra được mã. Hãy mở app bằng link https.</div>'}
        <button class="btn" data-act="lic-activate">Kích hoạt</button>`;
    },
    lockHtml() {
      return `<div class="in"><div class="logo">${icon('lock')}</div><h1>Hết thời gian dùng thử</h1>
        <p class="muted">Dữ liệu của quán vẫn còn nguyên. Gửi mã máy bên dưới cho người bán để nhận mã kích hoạt dùng vĩnh viễn.</p>
        <div class="card">${License.boxHtml()}</div>
        <button class="btn ghost" data-act="backup">Sao lưu dữ liệu ra file</button></div>`;
    },
  };
})();
