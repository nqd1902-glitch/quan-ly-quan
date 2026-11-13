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
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24"><path d="${ICONS[n] || ''}"/></svg>`;
const emptyBox = (_, text) => `<div class="empty">${icon('inbox')}<div>${text}</div></div>`;
/* Ảnh món: ảnh thật nếu có, không thì ô chữ cái đầu tên món */
const thumb = (p, cls = 'th') => p.img ? `<img class="${cls}" src="${esc(p.img)}" alt="" loading="lazy">` : `<span class="${cls} mono">${esc((p.name || '?').trim().charAt(0).toUpperCase())}</span>`;

const S = { q: '', cart: [], cat: 'Tất cả', month: ym(), day: ymd(), khoFilter: 'Tất cả', pay: 'cash', promoId: 'auto', manualDisc: 0, back: null, lastRoute: '' };
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

function go(h) { if (location.hash === h) render(); else location.hash = h; }

function render() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'ban').split('/');
  const name = Views[parts[0]] ? parts[0] : 'ban';
  const out = Views[name](...parts.slice(1));
  if (!out) return;
  const same = S.lastRoute === location.hash, y = window.scrollY;
  S.lastRoute = location.hash;
  $('#title').textContent = out.title;
  $('#hdr-right').innerHTML = out.right || '';
  $('#view').innerHTML = out.html;
  S.back = out.back || null;
  $('#back').classList.toggle('hidden', !out.back);
  const tab = out.tab || name;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  window.scrollTo(0, same ? y : 0);
  Cart.bar();
}

function applyTheme() {
  const t = Store.setting('theme', 'auto');
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
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
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
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
    return `<div class="in"><div class="logo"><img src="icons/icon-192.png" alt=""></div><h1>Quản lý quán</h1>
      <p class="muted">Công thức và giá cost, kho, bán hàng, khuyến mãi, lương, chi phí – tất cả trong điện thoại, không cần mạng.</p>
      <label>Tên quán của bạn<input id="ob-name" placeholder="Ví dụ: Home Juice" maxlength="40"></label>
      <button class="btn" data-act="ob-sample">Xem thử với dữ liệu mẫu</button>
      <button class="btn soft" data-act="ob-blank">Bắt đầu với quán trống</button>
      <p class="muted small">Dữ liệu mẫu là thực đơn một quán nước ép – trái cây để bạn xem cách app hoạt động. Xóa được trong Cài đặt.</p></div>`;
  },
  finish(sample) {
    const name = $('#ob-name').value.trim();
    if (!name) { UI.toast('Bạn nhập tên quán trước nhé'); $('#ob-name').focus(); return; }
    Store.setSetting('shopName', name);
    if (sample) Seed.load();
    location.hash = '#/ban';
    App.enter();
  },
};
Actions['ob-sample'] = () => Onboard.finish(true);
Actions['ob-blank'] = () => Onboard.finish(false);
