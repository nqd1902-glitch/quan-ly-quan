'use strict';
/* Bản quyền bản offline:
   - Dùng thử TRIAL_DAYS ngày, đủ tính năng như bản nâng cấp.
   - Sau đó cần mã kích hoạt gắn với mã máy. Mã có HẠN DÙNG (thường 30 ngày), hết hạn phải xin mã mới.
   - Có 2 bậc: bản thường và bản nâng cấp.
   Mã kích hoạt có dạng  NNNNNNNN.chữ-ký  trong đó NNNNNNNN là ngày hết hạn (năm tháng ngày).
   Chữ ký số ECDSA ký trên 'QLQ1|mã máy|ngày hết hạn' (bản thường) hoặc 'QLQ2|…' (bản nâng cấp);
   app chỉ giữ khóa công khai nên không tự tạo hay sửa ngày của mã được. */
const SELLER_ZALO = '0859 400 192'; // số Zalo người bán, hiện ở màn hình kích hoạt
const License = (() => {
  const TRIAL_DAYS = 14, DAY = 86400000;
  const st = { deviceId: '', activated: false, tier: '', daysLeft: TRIAL_DAYS, canVerify: true, expires: '', keyDays: 0, hadKey: false };
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} } };
  let seen = Date.now(); // mốc thời gian lớn nhất từng thấy (chống chỉnh lùi đồng hồ)

  function newId() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(12);
    crypto.getRandomValues(b);
    return [...b].map(x => A[x % A.length]).join('').replace(/(.{4})(?=.)/g, '$1-');
  }
  function b64u(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }
  const ymdNum = t => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  /* Kiểm tra mã. Trả về { tier: 'pro' | 'basic', exp: 'NNNNNNNN' } hoặc null nếu mã sai */
  async function verify(key) {
    if (!(window.crypto && crypto.subtle)) { st.canVerify = false; return null; }
    const m = /^(\d{8})\.([A-Za-z0-9_-]+)$/.exec(String(key).replace(/\s/g, ''));
    if (!m) return null;
    try {
      const k = await crypto.subtle.importKey('jwk', LICENSE_PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const sig = b64u(m[2]);
      const ok = pre => crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, sig, new TextEncoder().encode(`${pre}|${st.deviceId}|${m[1]}`));
      if (await ok('QLQ2')) return { tier: 'pro', exp: m[1] };
      if (await ok('QLQ1')) return { tier: 'basic', exp: m[1] };
    } catch (_) {}
    return null;
  }
  /* Áp mã đã kiểm tra vào trạng thái; mã quá hạn thì coi như chưa kích hoạt */
  function apply(v) {
    st.hadKey = !!v;
    const live = v && +v.exp >= ymdNum(seen);
    st.tier = live ? v.tier : ''; st.activated = !!live;
    st.expires = v ? v.exp : '';
    st.keyDays = live ? Math.round((new Date(+v.exp.slice(0, 4), +v.exp.slice(4, 6) - 1, +v.exp.slice(6, 8)) - new Date(new Date(seen).setHours(0, 0, 0, 0))) / DAY) + 1 : 0;
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
      seen = Math.max(now, Store.sys('lastSeen') || 0, +ls.get(APP.ls + 'seen') || 0);
      Store.setSys('lastSeen', seen); ls.set(APP.ls + 'seen', String(seen));
      st.daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - (seen - first) / DAY));
      const key = Store.sys('licenseKey');
      apply(key ? await verify(key) : null);
    },
    locked() { return !st.activated && st.daysLeft <= 0 && !(typeof Sync !== 'undefined' && Sync.paid()); },
    /* Tính năng của bản nâng cấp: dùng được khi mã bản nâng cấp còn hạn, đang dùng thử, hoặc gói online còn hạn */
    can() { return st.tier === 'pro' || (!st.activated && st.daysLeft > 0) || (typeof Sync !== 'undefined' && Sync.paid()); },
    tierName() { return st.tier === 'pro' ? 'Bản nâng cấp' : st.tier === 'basic' ? 'Bản thường' : 'Dùng thử'; },
    expiresText() { const e = st.expires; return e ? `${e.slice(6, 8)}/${e.slice(4, 6)}/${e.slice(0, 4)}` : ''; },
    async activate(key) {
      const v = await verify(key);
      if (!v) return 'bad';
      if (+v.exp < ymdNum(seen)) return 'old'; // mã đúng nhưng đã quá hạn
      Store.setSys('licenseKey', String(key).replace(/\s/g, '')); apply(v); return 'ok';
    },
    boxHtml() {
      return `<label style="margin-top:0">Mã máy của bạn</label><div class="code" id="lic-id">${st.deviceId}</div>
        <button class="btn soft" data-act="lic-copy">Sao chép mã máy</button>
        <label>Mã kích hoạt<textarea id="lic-key" rows="3" placeholder="Dán mã kích hoạt người bán gửi cho bạn"></textarea></label>
        ${st.canVerify ? '' : '<div class="note">Trình duyệt đang mở app qua địa chỉ không bảo mật nên chưa kiểm tra được mã. Hãy mở app bằng link https.</div>'}
        <button class="btn" data-act="lic-activate">Kích hoạt</button>
        <p class="muted small" style="text-align:center;margin-bottom:0">Mua hoặc gia hạn: gửi mã máy qua Zalo <b>${SELLER_ZALO}</b></p>`;
    },
    lockHtml() {
      return `<div class="in"><div class="logo">${icon('lock')}</div><h1>${st.hadKey ? 'Đã hết hạn sử dụng' : 'Hết thời gian dùng thử'}</h1>
        <p class="muted">${st.hadKey ? `Mã kích hoạt đã hết hạn ngày ${License.expiresText()}.` : ''} Dữ liệu của ${APP.word} vẫn còn nguyên. Gửi mã máy bên dưới cho người bán để nhận mã kích hoạt mới (bản thường hoặc bản nâng cấp).</p>
        <div class="card">${License.boxHtml()}</div></div>`;
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
        'Sao lưu và khôi phục dữ liệu',
        'Đổi màu, logo, ảnh bìa, ảnh nền',
      ].filter(Boolean);
      return `<div class="card"><h3>Bản nâng cấp có thêm</h3>
          ${list.map(t => `<div class="line" style="justify-content:flex-start;gap:10px"><span style="color:var(--acc);font-weight:700">✓</span><span>${t}</span></div>`).join('')}
          <p class="muted small">Bạn đang dùng ${License.tierName().toLowerCase()}. Dữ liệu đã nhập vẫn giữ nguyên khi nâng cấp.</p></div>
        <div class="card">${License.boxHtml()}</div>`;
    },
  };
})();
