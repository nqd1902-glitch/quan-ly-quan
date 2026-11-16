/* Chạy offline: lưu sẵn toàn bộ file của app. Đổi số VERSION mỗi lần cập nhật app. */
const VERSION = 'qlq-v17';
const FILES = ['./', 'index.html', 'manifest.json', 'css/app.css', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', ...Array.from({ length: 20 }, (_, i) => `img/sp-${i + 1}.jpg`),
  'js/mode.js', 'js/store.js', 'tiem/', 'tiem/index.html', 'tiem/manifest.json', 'icons/tiem-180.png', 'icons/tiem-192.png', 'icons/tiem-512.png', 'js/calc.js', 'js/xlsx.js', 'js/pubkey.js', 'js/license.js', 'js/sync.js', 'js/views/online.js', 'js/seed.js', 'js/app.js',
  'js/views/ban.js', 'js/views/mon.js', 'js/views/topping.js', 'js/views/kho.js', 'js/views/baocao.js', 'js/views/luong.js', 'js/views/chiphi.js', 'js/views/khach.js', 'js/views/khuyenmai.js', 'js/views/caidat.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
/* Trả file từ bộ nhớ trước cho nhanh, đồng thời tải bản mới về để lần mở sau dùng */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
