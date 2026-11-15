'use strict';
/* Bản quyền bản offline: dùng thử TRIAL_DAYS ngày (đủ tính năng), sau đó cần mã kích hoạt gắn với mã máy.
   Có 2 bậc: bản thường (mã ký trên 'QLQ1|mã máy') và bản nâng cấp (mã ký trên 'QLQ2|mã máy').
   Mã kích hoạt là chữ ký số ECDSA; app chỉ giữ khóa công khai nên không tự tạo mã được. */
const SELLER_ZALO = '0859 400 192'; // số Zalo người bán, hiện ở màn hình kích hoạt
const License = (() => {
  const TRIAL_DAYS = 14, DAY = 86400000;
  const st = { deviceId: '', activated: false, tier: '', daysLeft: TRIAL_DAYS, canVerify: true };
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
  /* Trả về 'pro', 'basic' hoặc '' (mã không đúng) */
  async function verify(key) {
    if (!(window.crypto && crypto.subtle)) { st.canVerify = false; return ''; }
    try {
      const k = await crypto.subtle.importKey('jwk', LICENSE_PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const sig = b64u(String(key).replace(/\s/g, ''));
      const ok = pre => crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, sig, new TextEncoder().encode(pre + '|' + st.deviceId));
      if (await ok('QLQ2')) return 'pro';
      if (await ok('QLQ1')) return 'basic';
    } catch (_) {}
    return '';
  }

  return {
    state: st, TRIAL_DAYS,
    async init() {
      st.deviceId = Store.sys('deviceId') || ls.get(APP.ls + 'device') || newId();
      Store.setSys('deviceId', st.deviceId); ls.set(APP.ls + 'device', st.deviceId);
      const now = Date.now();
      const firsts = [Store.sys('firstRun'), +ls.get(APP.ls + 'first')].filter(x => x > 0);
      const first = firsts.length ? Math.min(...firsts) : now;
      Store.setSys('firstRun', first); ls.set(APP.ls + 'first', String(first));
      // chống chỉnh lùi đồng hồ: luôn lấy mốc thời gian lớn nhất từng thấy
      const seen = Math.max(now, Store.sys('lastSeen') || 0, +ls.get(APP.ls + 'seen') || 0);
      Store.setSys('lastSeen', seen); ls.set(APP.ls + 'seen', String(seen));
      st.daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - (seen - first) / DAY));
      const key = Store.sys('licenseKey');
      st.tier = key ? await verify(key) : '';
      st.activated = !!st.tier;
    },
    locked() { return !st.activated && st.daysLeft <= 0; },
    /* Tính năng của bản nâng cấp: dùng được khi đã mua bản nâng cấp, hoặc đang trong thời gian dùng thử */
    can() { return st.tier === 'pro' || (!st.activated && st.daysLeft > 0); },
    tierName() { return st.tier === 'pro' ? 'Bản nâng cấp' : st.tier === 'basic' ? 'Bản thường' : 'Dùng thử'; },
    async activate(key) {
      const tier = await verify(key);
      if (!tier) return false;
      if (st.tier === 'pro' && tier === 'basic') return true; // đang ở bản cao hơn thì giữ nguyên
      Store.setSys('licenseKey', String(key).replace(/\s/g, '')); st.tier = tier; st.activated = true; return true;
    },
    boxHtml() {
      return `<label style="margin-top:0">Mã máy của bạn</label><div class="code" id="lic-id">${st.deviceId}</div>
        <button class="btn soft" data-act="lic-copy">Sao chép mã máy</button>
        <label>Mã kích hoạt<textarea id="lic-key" rows="3" placeholder="Dán mã kích hoạt người bán gửi cho bạn"></textarea></label>
        ${st.canVerify ? '' : '<div class="note">Trình duyệt đang mở app qua địa chỉ không bảo mật nên chưa kiểm tra được mã. Hãy mở app bằng link https.</div>'}
        <button class="btn" data-act="lic-activate">Kích hoạt</button>
        <p class="muted small" style="text-align:center;margin-bottom:0">Mua bản quyền: gửi mã máy qua Zalo <b>${SELLER_ZALO}</b></p>`;
    },
    lockHtml() {
      return `<div class="in"><div class="logo">${icon('lock')}</div><h1>Hết thời gian dùng thử</h1>
        <p class="muted">Dữ liệu của ${APP.word} vẫn còn nguyên. Gửi mã máy bên dưới cho người bán để nhận mã kích hoạt dùng vĩnh viễn (bản thường hoặc bản nâng cấp).</p>
        <div class="card">${License.boxHtml()}</div>
        <button class="btn ghost" data-act="backup">Sao lưu dữ liệu ra file</button></div>`;
    },
    /* Trang giới thiệu bản nâng cấp, hiện khi bấm vào tính năng đang khóa */
    upgradeHtml() {
      const quan = APP.mode === 'quan';
      const list = [
        quan && 'Công thức, định lượng và giá cost từng size',
        'Lãi ròng, báo cáo đầy đủ, xuất Excel',
        'Thu chi và sổ quỹ tiền mặt, ngân hàng',
        'Khách hàng, ghi nợ, thu nợ',
        quan ? 'Khuyến mãi, món bán kèm, lưu đơn tạm theo bàn' : 'Khuyến mãi',
        'Lương, chấm công nhân viên',
        'Đổi màu, logo, ảnh bìa, ảnh nền',
      ].filter(Boolean);
      return `<div class="card"><h3>Bản nâng cấp có thêm</h3>
          ${list.map(t => `<div class="line" style="justify-content:flex-start;gap:10px"><span style="color:var(--acc);font-weight:700">✓</span><span>${t}</span></div>`).join('')}
          <p class="muted small">Bạn đang dùng ${License.tierName().toLowerCase()}. Dữ liệu đã nhập vẫn giữ nguyên khi nâng cấp.</p></div>
        <div class="card">${License.boxHtml()}</div>`;
    },
  };
})();
