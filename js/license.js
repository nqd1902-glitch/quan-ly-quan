'use strict';
/* Bản quyền bản offline:
   - 14 ngày đầu: dùng thử đủ tính năng như bản nâng cấp (PRO).
   - 14 ngày tiếp theo: dùng thử ở mức bản thường.
   - Sau 28 ngày: khóa, cần mã kích hoạt gắn với mã máy.
   - Có 2 bậc: bản thường và bản nâng cấp (PRO).
   Mã kích hoạt có 2 kiểu:
     NNNNNNNN.chữ-ký  : có hạn, NNNNNNNN là ngày hết hạn (năm tháng ngày). Ký trên 'QLQ1|mã máy|ngày' hoặc 'QLQ2|…'.
     chữ-ký           : vĩnh viễn. Ký trên 'QLQ1|mã máy' (bản thường) hoặc 'QLQ2|mã máy' (bản nâng cấp).
   Chữ ký số ECDSA; app chỉ giữ khóa công khai nên không tự tạo hay sửa ngày của mã được. */
const SELLER_ZALO = '0859 400 192'; // số Zalo người bán, hiện ở màn hình kích hoạt
const License = (() => {
  const TRIAL_DAYS = 14, FREE_DAYS = 14, DAY = 86400000;
  // daysLeft: số ngày dùng thử PRO còn lại. freeLeft: số ngày còn lại trước khi khóa (gồm cả giai đoạn thử bản thường)
  const st = { deviceId: '', activated: false, tier: '', daysLeft: TRIAL_DAYS, freeLeft: TRIAL_DAYS + FREE_DAYS, canVerify: true, expires: '', keyDays: 0, hadKey: false, forever: false };
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
  /* Kiểm tra mã. Trả về { tier: 'pro' | 'basic', exp: 'NNNNNNNN' hoặc '' nếu vĩnh viễn } hoặc null nếu mã sai */
  async function verify(key) {
    if (!(window.crypto && crypto.subtle)) { st.canVerify = false; return null; }
    const text = String(key).replace(/\s/g, ''), m = /^(\d{8})\.([A-Za-z0-9_-]+)$/.exec(text);
    if (!m && !/^[A-Za-z0-9_-]{40,}$/.test(text)) return null;
    const exp = m ? m[1] : '';
    try {
      const k = await crypto.subtle.importKey('jwk', LICENSE_PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const sig = b64u(m ? m[2] : text);
      const ok = pre => crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, sig, new TextEncoder().encode(pre + '|' + st.deviceId + (exp ? '|' + exp : '')));
      if (await ok('QLQ2')) return { tier: 'pro', exp };
      if (await ok('QLQ1')) return { tier: 'basic', exp };
    } catch (_) {}
    return null;
  }
  /* Áp mã đã kiểm tra vào trạng thái; mã quá hạn thì coi như chưa kích hoạt */
  function apply(v) {
    st.hadKey = !!v;
    const live = v && (!v.exp || +v.exp >= ymdNum(seen));
    st.tier = live ? v.tier : ''; st.activated = !!live;
    st.expires = v ? v.exp : ''; st.forever = !!(live && !v.exp);
    st.keyDays = !live ? 0 : !v.exp ? 99999 : Math.round((new Date(+v.exp.slice(0, 4), +v.exp.slice(4, 6) - 1, +v.exp.slice(6, 8)) - new Date(new Date(seen).setHours(0, 0, 0, 0))) / DAY) + 1;
  }
  const online = () => typeof Sync !== 'undefined' && Sync.paid();

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
      const used = (seen - first) / DAY;
      st.daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - used));
      st.freeLeft = Math.max(0, Math.ceil(TRIAL_DAYS + FREE_DAYS - used));
      const key = Store.sys('licenseKey');
      apply(key ? await verify(key) : null);
    },
    locked() { return !st.activated && st.freeLeft <= 0 && !online(); },
    /* Tính năng của bản nâng cấp: dùng được khi mã bản nâng cấp còn hạn, đang trong 14 ngày thử đầu, hoặc gói online còn hạn */
    can() { return st.tier === 'pro' || (!st.activated && st.daysLeft > 0) || online(); },
    tierName() { return st.tier === 'pro' ? 'Bản nâng cấp' : st.tier === 'basic' ? 'Bản thường' : 'Dùng thử'; },
    /* App đang ở bản nào: mã ngắn để hiện huy hiệu, kèm lời mô tả */
    edition() {
      if (online()) return { code: 'ONLINE', cls: 'online', text: 'Bản online' };
      if (st.tier === 'pro') return { code: 'PRO', cls: 'pro', text: 'Bản nâng cấp (PRO)' };
      if (st.tier === 'basic') return { code: 'THƯỜNG', cls: 'basic', text: 'Bản thường' };
      if (st.daysLeft > 0) return { code: 'THỬ PRO', cls: 'trial', text: `Dùng thử bản PRO, còn ${st.daysLeft} ngày` };
      return { code: 'THỬ', cls: 'basic', text: `Dùng thử bản thường, còn ${st.freeLeft} ngày` };
    },
    badgeHtml() { const e = License.edition(); return `<span class="ed ed-${e.cls}">${e.code}</span>`; },
    expiresText() { const e = st.expires; return e ? `${e.slice(6, 8)}/${e.slice(4, 6)}/${e.slice(0, 4)}` : ''; },
    expiryPhrase() { return st.forever ? 'dùng vĩnh viễn' : 'hạn đến ' + License.expiresText(); },
    /* Dòng nhắc trên màn hình bán hàng khi sắp hết hạn hoặc sắp đổi giai đoạn dùng thử */
    noticeHtml() {
      if (online()) return '';
      const a = t => `<a class="note" style="display:block;margin:0 0 10px" href="#/caidat">${t}</a>`;
      if (st.activated) return !st.forever && st.keyDays <= 3 ? a(`Còn ${st.keyDays} ngày sử dụng (đến ${License.expiresText()}) · Bấm để gia hạn`) : '';
      if (st.daysLeft > 0) return st.daysLeft <= 3 ? a(`Còn ${st.daysLeft} ngày dùng thử bản PRO, sau đó về bản thường · Bấm để kích hoạt`) : '';
      return a(`Đang dùng thử bản thường, còn ${st.freeLeft} ngày · Bấm để kích hoạt`);
    },
    async activate(key) {
      const v = await verify(key);
      if (!v) return 'bad';
      if (v.exp && +v.exp < ymdNum(seen)) return 'old'; // mã đúng nhưng đã quá hạn
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
      return `<div class="card"><h3>Bản nâng cấp (PRO) có thêm</h3>
          ${list.map(t => `<div class="line" style="justify-content:flex-start;gap:10px"><span style="color:var(--acc);font-weight:700">✓</span><span>${t}</span></div>`).join('')}
          <p class="muted small">Bạn đang ở: ${License.edition().text}. Dữ liệu đã nhập vẫn giữ nguyên khi nâng cấp.</p></div>
        <div class="card">${License.boxHtml()}</div>`;
    },
  };
})();
