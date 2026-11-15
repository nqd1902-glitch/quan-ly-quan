'use strict';
/* Khung app: hàm tiện ích, điều hướng, sheet, toast */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Math.round(n || 0).toLocaleString('vi-VN') + 'đ';
const qty = n => (+(+n || 0).toFixed(2)).toLocaleString('vi-VN');
const parseMoney = s => parseInt(String(s ?? '').replace(/[^\d]/g, ''), 10) || 0;
const parseQty = s => parseFloat(String(s ?? '').replace(',', '.')) || 0;
const moneyVal = n => n ? Math.round(n).toLocaleString('vi-VN') : '';
const pad = n => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ym = (d = new Date()) => ymd(d).slice(0, 7);
const dmy = s => s.split('-').reverse().join('/');
const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return ym(new Date(y, mo - 1 + k, 1)); };
const monthLabel = m => `Tháng ${+m.slice(5)}/${m.slice(0, 4)}`;
const monthNav = m => `<div class="monthnav"><button data-act="month" data-v="-1">‹</button><b>${monthLabel(m)}</b><button data-act="month" data-v="1">›</button></div>`;
const ICONS = {
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01',
  users: 'M16 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1.5a4 4 0 00-3-3.8M15.5 4.2a3.5 3.5 0 010 6.6',
  wallet: 'M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16.5 14h.01',
  gear: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
  box: 'M3 8l9-5 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8',
  lock: 'M6 11h12v9H6zM8.5 11V7.5a3.5 3.5 0 017 0V11',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  inbox: 'M3 13l3-8h12l3 8v6H3v-6zM3 13h5l1 2h6l1-2h5',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2M12 17h.01',
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24"><path d="${ICONS[n] || ''}"/></svg>`;
const emptyBox = (_, text) => `<div class="empty">${icon('inbox')}<div>${text}</div></div>`;
/* Ảnh món: ảnh thật nếu có, không thì ô chữ cái đầu tên món */
const thumb = (p, cls = 'th') => p.img ? `<img class="${cls}" src="${esc(p.img)}" alt="" loading="lazy">` : `<span class="${cls} mono">${esc((p.name || '?').trim().charAt(0).toUpperCase())}</span>`;

const S = { q: '', custId: '', tabId: null, cart: [], cat: 'Tất cả', month: ym(), day: ymd(), khoFilter: 'Tất cả', pay: 'cash', promoId: 'auto', manualDisc: 0, back: null, lastRoute: '' };
const Views = {};
const Actions = {};   // data-act="ten"  -> Actions.ten(el, event) khi bấm
const Inputs = {};    // data-in="ten"   -> Inputs.ten(el, event) khi gõ

const UI = {
  _t: 0, _cb: null,
  toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(UI._t); UI._t = setTimeout(() => t.classList.remove('show'), 2400);
  },
  sheet(html) { $('#sheet').innerHTML = '<div class="grab"></div>' + html; $('#sheet-wrap').classList.remove('hidden'); $('#sheet').scrollTop = 0; },
  closeSheet() { $('#sheet-wrap').classList.add('hidden'); $('#sheet').innerHTML = ''; },
  confirm(msg, okLabel, cb) {
    UI._cb = cb;
    UI.sheet(`<h2>Xác nhận</h2><p>${esc(msg)}</p><div class="btns"><button class="btn soft" data-act="sheet-close">Không</button><button class="btn danger" data-act="confirm-ok">${esc(okLabel)}</button></div>`);
  },
  /* Đọc mọi ô có name trong sheet thành object */
  form(root = $('#sheet')) {
    const o = {};
    $$('[name]', root).forEach(el => {
      o[el.name] = el.type === 'checkbox' ? el.checked : el.classList.contains('money') ? parseMoney(el.value) : el.type === 'number' ? parseQty(el.value) : el.value.trim();
    });
    return o;
  },
};
Actions['sheet-close'] = () => UI.closeSheet();
Actions['confirm-ok'] = () => { const cb = UI._cb; UI._cb = null; UI.closeSheet(); if (cb) cb(); };
Actions.back = () => go(S.back || '#/ban');
Actions.month = el => { S.month = shiftMonth(S.month, +el.dataset.v); render(); };
Actions.go = el => go(el.dataset.v);

/* Đưa file cho người dùng: điện thoại mở bảng chia sẻ (lưu vào Tệp, gửi Zalo…), máy tính tải thẳng về */
async function saveFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  try {
    if (/Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  UI.toast('Đã lưu file ' + name);
  return true;
}

function go(h) { if (location.hash === h) render(); else location.hash = h; }

const GATED = ['km', 'thuchi', 'chiphi', 'khach', 'luong', 'topping'];
function render() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'ban').split('/');
  const name = Views[parts[0]] ? parts[0] : 'ban';
  // màn hình chỉ có ở bản nâng cấp: bản thường mở ra trang giới thiệu nâng cấp
  const out = GATED.includes(name) && !License.can() ? Views.nangcap() : Views[name](...parts.slice(1));
  if (!out) return;
  const same = S.lastRoute === location.hash, y = window.scrollY;
  S.lastRoute = location.hash;
  if (out.titleHtml) $('#title').innerHTML = out.titleHtml; else $('#title').textContent = out.title;
  $('#hdr-right').innerHTML = out.right || '';
  $('#view').innerHTML = out.html;
  S.back = out.back || null;
  $('#back').classList.toggle('hidden', !out.back);
  const tab = out.tab || name;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  window.scrollTo(0, same ? y : 0);
  Cart.bar();
}

/* Màu chủ đạo quán tự chọn: [màu nền sáng, màu nền tối] */
const ACCENTS = { green: ['#0a8f5b', '#3ddc97'], orange: ['#d9630b', '#ff9a4d'], pink: ['#d6336c', '#ff7aa8'], blue: ['#1d6fe0', '#6aa8ff'], purple: ['#7c3aed', '#b094ff'], red: ['#d92d20', '#ff6b61'] };
function applyTheme() {
  const root = document.documentElement, t = Store.setting('theme', 'auto');
  if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const a = (ACCENTS[Store.setting('accent', APP.accent)] || ACCENTS.green)[dark ? 1 : 0];
  root.style.setProperty('--acc', a);
  root.style.setProperty('--acc-soft', `color-mix(in srgb, ${a} 14%, var(--card))`);
  const bg = Store.setting('bgImg', '');
  document.body.classList.toggle('hasbg', !!bg);
  root.style.setProperty('--bgimg', bg ? `url("${bg}")` : 'none');
}
/* Đọc ảnh người dùng chọn, thu nhỏ về tối đa max px, trả về dạng lưu được trong máy */
function pickImage(file, max, cb) {
  if (!file) return;
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    cb(c.toDataURL(file.type === 'image/png' && max <= 320 ? 'image/png' : 'image/jpeg', 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); UI.toast('Không đọc được ảnh này'); };
  img.src = url;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && Actions[el.dataset.act]) Actions[el.dataset.act](el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.classList && el.classList.contains('money')) el.value = moneyVal(parseMoney(el.value));
  const h = el.closest && el.closest('[data-in]');
  if (h && Inputs[h.dataset.in]) Inputs[h.dataset.in](h, e);
});
document.addEventListener('focusin', e => { if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'date' && e.target.type !== 'file') setTimeout(() => { try { e.target.select(); } catch (_) {} }, 0); });

const App = {
  async start() {
    await Store.init();
    await License.init();
    Seed.applyImages();
    applyTheme();
    window.addEventListener('hashchange', render);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register(APP.base + 'sw.js').catch(() => {});
    App.enter();
  },
  enter() {
    const ov = $('#overlay');
    if (!Store.setting('shopName')) { ov.innerHTML = Onboard.html(); ov.classList.remove('hidden'); return; }
    if (License.locked()) { ov.innerHTML = License.lockHtml(); ov.classList.remove('hidden'); return; }
    ov.classList.add('hidden'); ov.innerHTML = '';
    render();
  },
};

/* Màn hình chào lần đầu */
const Onboard = {
  html() {
    const tiem = APP.mode === 'tiem';
    return `<div class="in"><div class="logo"><img src="${APP.base}icons/${APP.icon}" alt=""></div><h1>${APP.name}</h1>
      <p class="muted">${tiem ? 'Bán hàng, hàng hóa và tồn kho, khách nợ, thu chi – tất cả trong điện thoại, không cần mạng.' : 'Công thức và giá cost, kho, bán hàng, khuyến mãi, lương, thu chi – tất cả trong điện thoại, không cần mạng.'}</p>
      <label>Tên ${APP.word} của bạn<input id="ob-name" placeholder="${tiem ? 'Ví dụ: Tạp hóa Cô Ba' : 'Ví dụ: Home Juice'}" maxlength="40"></label>
      <button class="btn" data-act="ob-sample">Xem thử với dữ liệu mẫu</button>
      <button class="btn soft" data-act="ob-blank">Bắt đầu với ${APP.word} trống</button>
      <p class="muted small">${tiem ? 'Dữ liệu mẫu là vài mặt hàng tạp hóa với giá ước lượng để bạn xem cách app hoạt động.' : 'Dữ liệu mẫu là thực đơn một quán nước ép – trái cây để bạn xem cách app hoạt động.'} Xóa được trong Cài đặt.</p></div>`;
  },
  finish(sample) {
    const name = $('#ob-name').value.trim();
    if (!name) { UI.toast(`Bạn nhập tên ${APP.word} trước nhé`); $('#ob-name').focus(); return; }
    Store.setSetting('shopName', name);
    if (sample) Seed.load();
    location.hash = '#/ban';
    App.enter();
  },
};
Actions['ob-sample'] = () => Onboard.finish(true);
Actions['ob-blank'] = () => Onboard.finish(false);
