'use strict';
/* Bản online: đăng nhập, cửa hàng, đồng bộ dữ liệu giữa nhiều máy qua máy chủ Supabase.
   - Mỗi bản ghi trong Store là một dòng trên máy chủ (bảng records). Bản ghi sửa sau cùng thắng.
   - Máy mất mạng vẫn dùng bình thường; có mạng lại thì đẩy phần đã sửa lên và kéo phần của máy khác về.
   - Tồn kho KHÔNG đồng bộ bằng con số: mỗi máy tự tính lại từ mốc kiểm kê + phiếu nhập/hủy − đơn đã bán,
     nên hai máy bán cùng lúc không ghi đè số tồn của nhau. */
const SUPA = {
  url: 'https://hlqgitvpokrfmyidsqxi.supabase.co',
  key: 'sb_publishable_W5Q5ApDqsohFe2D-vJrCow_qtaywya_', // khóa công khai, được phép nằm trong app
  mailDomain: 'khach.quanlyquan.app',                    // đăng nhập bằng số điện thoại: sđt@tên miền này
};
const ROLE = { owner: 'Chủ', manager: 'Quản lý', cashier: 'Thu ngân', staff: 'Nhân viên' };

const Sync = (() => {
  const COLLS = ['ingredients', 'products', 'orders', 'moves', 'staff', 'attendance', 'payadj', 'expenses', 'promos', 'toppings', 'customers', 'debtpay', 'tabs', 'settings'];
  const LOCAL_SETTINGS = ['theme', 'lastBackup']; // cài đặt riêng từng máy, không đồng bộ
  const st = { session: null, shop: null, role: '', members: [], state: 'off', lastSync: 0, error: '', live: false };
  const dirty = new Set(), fresh = []; // fresh: mã các đơn mới vừa nhận từ máy khác
  let pushT = 0, pollT = 0, busy = false, again = false, started = false, shopAt = Date.now();

  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const active = () => !!(st.session && st.shop);
  const paid = () => !!(st.session && st.shop && st.shop.paid_until >= today());
  const mark = (c, id) => { dirty.add(c + ':' + id); Store.setSys('dirty', [...dirty]); };
  const toEmail = id => { id = String(id).trim(); return id.includes('@') ? id.toLowerCase() : id.replace(/\D/g, '') + '@' + SUPA.mailDomain; };
  const VI = [[/Invalid login credentials/i, 'Sai số điện thoại hoặc mật khẩu'], [/already registered|already been registered/i, 'Số này đã có tài khoản, hãy bấm Đăng nhập'],
    [/Password should be at least/i, 'Mật khẩu phải từ 6 ký tự'], [/Failed to fetch|NetworkError|Load failed/i, 'Không có mạng'], [/row-level security/i, 'Gói online đã hết hạn hoặc bạn không còn trong cửa hàng']];
  const viError = m => { const x = VI.find(v => v[0].test(m)); return x ? x[1] : m; };

  async function api(path, opt = {}) {
    if (opt.auth !== false) await ensureToken();
    const h = { apikey: SUPA.key, 'Content-Type': 'application/json', ...(opt.headers || {}) };
    if (opt.auth !== false && st.session) h.Authorization = 'Bearer ' + st.session.access_token;
    let r, text;
    try { r = await fetch(SUPA.url + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }); text = await r.text(); }
    catch (e) { throw new Error(viError(String(e.message || e))); }
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!r.ok) { const e = new Error(viError((data && (data.msg || data.message || data.error_description || data.error)) || 'Lỗi máy chủ ' + r.status)); e.status = r.status; throw e; }
    return data;
  }
  function saveSession(s) {
    st.session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user.id, email: s.user.email } };
    Store.setSys('session', st.session);
  }
  async function ensureToken() {
    if (!st.session || st.session.expires_at * 1000 - 90000 > Date.now()) return;
    const s = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: st.session.refresh_token } });
    saveSession(s);
  }

  /* Lấy thông tin cửa hàng, vai trò, danh sách người dùng */
  async function loadShop() {
    const mine = await api(`/rest/v1/members?select=shop_id,role&user_id=eq.${st.session.user.id}&order=joined_at.asc&limit=1`);
    if (!mine.length) { st.shop = null; st.role = ''; st.members = []; Store.setSys('shop', null); return; }
    const shops = await api(`/rest/v1/shops?select=id,name,app,max_users,paid_until,join_code&id=eq.${mine[0].shop_id}`);
    st.shop = shops[0] || null; st.role = mine[0].role;
    st.members = st.shop ? await api(`/rest/v1/members?select=user_id,role,name&shop_id=eq.${st.shop.id}&order=joined_at.asc`) : [];
    Store.setSys('shop', st.shop ? { ...st.shop, role: st.role, members: st.members } : null);
  }

  /* Tính lại tồn kho từ mốc kiểm kê + phiếu nhập/hủy − đơn đã bán (xem ghi chú đầu file) */
  function recompute() {
    const now = Date.now(), I = {}, V = {}, r4 = n => +n.toFixed(4);
    Store.all('ingredients').forEach(i => {
      if (i.baseAt == null) { i.base = +i.stock || 0; i.baseAt = now; Store.putQuiet('ingredients', i); mark('ingredients', i.id); }
      I[i.id] = { o: i, at: i.baseAt, sum: 0 };
    });
    const prods = Store.all('products').filter(p => p.direct);
    prods.forEach(p => {
      let ch = false;
      p.variants.forEach(v => { if (v.baseAt == null) { v.base = +v.stock || 0; v.baseAt = now; ch = true; } V[v.id] = { v, at: v.baseAt, sum: 0 }; });
      if (ch) { Store.putQuiet('products', p); mark('products', p.id); }
    });
    Store.all('orders').forEach(o => {
      if (o.cancelled) return;
      o.items.forEach(it => {
        (it.recipe || []).forEach(r => { const x = I[r.ingId]; if (x && o.time > x.at) x.sum -= r.raw * it.qty; });
        if (it.direct) { const x = V[it.vid]; if (x && o.time > x.at) x.sum -= it.qty; }
      });
    });
    Store.all('moves').forEach(m => {
      if (m.type !== 'in' && m.type !== 'waste') return; // kiểm kê đã nằm trong mốc base
      const x = m.ingId ? I[m.ingId] : V[m.vid];
      if (x && m.time > x.at) x.sum += m.qty;
    });
    Object.values(I).forEach(x => { const s = r4((+x.o.base || 0) + x.sum); if (s !== x.o.stock) { x.o.stock = s; Store.putQuiet('ingredients', x.o); } });
    prods.forEach(p => {
      let ch = false;
      p.variants.forEach(v => { const x = V[v.id], s = r4((+v.base || 0) + x.sum); if (s !== v.stock) { v.stock = s; ch = true; } });
      if (ch) Store.putQuiet('products', p);
    });
  }

  async function push() {
    while (dirty.size) {
      const keys = [...dirty].slice(0, 200), snap = {};
      const rows = keys.map(k => {
        const i = k.indexOf(':'), c = k.slice(0, i), id = k.slice(i + 1), o = Store.raw(c, id);
        if (!o) return null;
        snap[k] = o.updatedAt;
        return { shop_id: st.shop.id, coll: c, id, data: o, deleted: !!o.deleted };
      }).filter(Boolean);
      if (rows.length) await api('/rest/v1/records?on_conflict=shop_id,coll,id', { method: 'POST', body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      if (rows.some(r => r.coll === 'orders')) notify();
      keys.forEach(k => { const i = k.indexOf(':'), o = Store.raw(k.slice(0, i), k.slice(i + 1)); if (!o || o.updatedAt === snap[k]) dirty.delete(k); }); // sửa tiếp trong lúc đẩy thì giữ lại để đẩy lần sau
      Store.setSys('dirty', [...dirty]);
    }
  }
  async function pull() {
    const LIMIT = 1000; let changed = false;
    for (;;) {
      const since = Store.sys('lastPull') || '1970-01-01T00:00:00Z';
      let rows = await api(`/rest/v1/records?select=coll,id,data,deleted,updated_at&shop_id=eq.${st.shop.id}&updated_at=gt.${encodeURIComponent(since)}&order=updated_at.asc,coll.asc,id.asc&limit=${LIMIT}`);
      if (!rows.length) break;
      const full = rows.length === LIMIT;
      if (full) { const last = rows[rows.length - 1].updated_at, keep = rows.filter(r => r.updated_at !== last); if (keep.length) rows = keep; } // không cắt giữa một nhóm cùng giờ
      rows.forEach(r => {
        if (dirty.has(r.coll + ':' + r.id) || !COLLS.includes(r.coll) || (r.coll === 'settings' && LOCAL_SETTINGS.includes(r.id))) return;
        const o = r.data; o.id = r.id; if (r.deleted) o.deleted = true;
        if (r.coll === 'orders' && !Store.raw('orders', r.id) && !o.deleted && !o.cancelled) fresh.push(o.id);
        Store.putQuiet(r.coll, o); changed = true;
      });
      Store.setSys('lastPull', rows[rows.length - 1].updated_at);
      if (!full) break;
    }
    return changed;
  }

  /* Kênh báo tin tức thời (Supabase Realtime). Máy bán vừa đẩy đơn lên thì báo "có đơn mới";
     máy trạm in giữ sẵn một đường nối với máy chủ nên nhận tin ngay và đồng bộ, không phải hỏi liên tục. */
  let ws = null, wsRef = 0, wsBeat = 0, wsRetry = 0;
  const topic = () => 'shop-' + st.shop.id;
  function listen() {
    if (ws || !active() || !Station.on() || !navigator.onLine) return;
    try { ws = new WebSocket(SUPA.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + SUPA.key + '&vsn=1.0.0'); } catch (_) { ws = null; return; }
    const sock = ws;
    const send = (t, ev, payload) => { if (sock.readyState === 1) sock.send(JSON.stringify({ topic: t, event: ev, payload, ref: String(++wsRef) })); };
    sock.onopen = () => {
      send('realtime:' + topic(), 'phx_join', { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [] }, access_token: st.session.access_token });
      clearInterval(wsBeat); wsBeat = setInterval(() => send('phoenix', 'heartbeat', {}), 25000);
    };
    sock.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.event === 'phx_reply' && m.topic === 'realtime:' + topic()) st.live = !!(m.payload && m.payload.status === 'ok');
      if (m.event === 'broadcast') sync();
    };
    sock.onclose = sock.onerror = () => { if (ws !== sock) return; clearInterval(wsBeat); ws = null; st.live = false; clearTimeout(wsRetry); wsRetry = setTimeout(listen, 5000); };
  }
  function unlisten() { clearTimeout(wsRetry); clearInterval(wsBeat); st.live = false; if (ws) { const s0 = ws; ws = null; try { s0.close(); } catch (_) {} } }
  function notify() {
    if (!active()) return;
    fetch(SUPA.url + '/realtime/v1/api/broadcast', { method: 'POST', headers: { apikey: SUPA.key, Authorization: 'Bearer ' + st.session.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: topic(), event: 'order', payload: {} }] }) }).catch(() => {});
  }

  /* Một lượt đồng bộ: đẩy lên rồi kéo về */
  async function sync() {
    if (!active()) return;
    if (busy) { again = true; return; }
    busy = true; st.state = 'sync';
    try {
      // mỗi phút xem lại hạn dùng, vai trò, danh sách người dùng (chủ có thể vừa đổi)
      if (Date.now() - shopAt > 60000) { shopAt = Date.now(); await loadShop(); if (!st.shop) { st.state = 'off'; busy = false; return; } }
      recompute();
      await push();
      const changed = await pull();
      if (changed) { recompute(); applyTheme(); refreshView(); }
      if (fresh.length) Station.onNew(fresh.splice(0));
      st.state = 'ok'; st.error = ''; st.lastSync = Date.now();
    } catch (e) { st.state = 'err'; st.error = e.message || String(e); }
    busy = false;
    if (again) { again = false; sync(); }
    if (location.hash.startsWith('#/online') && !document.activeElement.matches('input,textarea,select')) render();
  }
  /* Vẽ lại màn hình khi có dữ liệu mới, trừ lúc người dùng đang gõ hoặc đang mở bảng */
  function refreshView() {
    if (!$('#sheet-wrap').classList.contains('hidden') || !$('#overlay').classList.contains('hidden')) return;
    if (document.activeElement && document.activeElement.matches('input,textarea,select')) return;
    render();
  }
  function start() {
    if (started) return; started = true;
    Store.onChange = (c, obj) => {
      if (!active() || !COLLS.includes(c) || (c === 'settings' && LOCAL_SETTINGS.includes(obj.id))) return;
      mark(c, obj.id);
      clearTimeout(pushT); pushT = setTimeout(sync, 300); // đẩy lên gần như ngay để trạm in nhận sớm
    };
    // Mọi máy: 10 giây hỏi máy chủ một lần. Máy trạm in nhận tin tức thời qua đường nối riêng (xem listen).
    let lastPoll = 0;
    clearInterval(pollT); pollT = setInterval(() => {
      if (!navigator.onLine) return;
      const station = Station.on();
      if (station) listen(); else if (ws) unlisten();
      const fast = station && !st.live; // đường nối tức thời rớt thì tạm hỏi 2 giây một lần
      if (!fast && ((!station && document.visibilityState !== 'visible') || Date.now() - lastPoll < 10000)) return;
      lastPoll = Date.now(); sync();
    }, 2000);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
  }

  return {
    state: st, active, paid, sync, recompute,
    /* Mở app: dùng thông tin đã lưu để chạy ngay cả khi mất mạng, rồi làm mới ở nền */
    async init() {
      st.session = Store.sys('session') || null;
      const cached = Store.sys('shop');
      if (st.session && cached) { st.shop = cached; st.role = cached.role || ''; st.members = cached.members || []; }
      (Store.sys('dirty') || []).forEach(k => dirty.add(k));
      if (!st.session) return;
      start();
      loadShop().then(sync).catch(e => { st.state = 'err'; st.error = e.message; });
    },
    async signUp(id, pass) { saveSession(await api('/auth/v1/signup', { method: 'POST', auth: false, body: { email: toEmail(id), password: pass } })); await loadShop(); start(); },
    async signIn(id, pass) { saveSession(await api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email: toEmail(id), password: pass } })); await loadShop(); start(); },
    /* Chủ quán: tạo cửa hàng trên mạng và đưa toàn bộ dữ liệu của máy này lên */
    async createShop(myName) {
      await api('/rest/v1/rpc/create_shop', { method: 'POST', body: { shop_name: Store.setting('shopName', APP.name), shop_app: APP.mode, my_name: myName } });
      await loadShop();
      Store.setSys('lastPull', '');
      COLLS.forEach(c => Store.allRaw(c).forEach(o => { if (!(c === 'settings' && LOCAL_SETTINGS.includes(o.id))) dirty.add(c + ':' + o.id); }));
      Store.setSys('dirty', [...dirty]);
      await sync();
    },
    /* Nhân viên: vào cửa hàng bằng mã. Dữ liệu trên máy này được thay bằng dữ liệu của cửa hàng. */
    async joinShop(code, myName) {
      await api('/rest/v1/rpc/join_shop', { method: 'POST', body: { code, my_name: myName } });
      await loadShop();
      await Store.clearData(); dirty.clear(); Store.setSys('dirty', []); Store.setSys('lastPull', '');
      await sync();
      applyTheme();
    },
    async reload() { await loadShop(); await sync(); },
    async setRole(uid, role) { await api('/rest/v1/rpc/set_role', { method: 'POST', body: { shop: st.shop.id, target: uid, new_role: role } }); await loadShop(); },
    async removeMember(uid) { await api('/rest/v1/rpc/remove_member', { method: 'POST', body: { shop: st.shop.id, target: uid } }); await loadShop(); },
    async newCode() { await api('/rest/v1/rpc/new_join_code', { method: 'POST', body: { shop: st.shop.id } }); await loadShop(); },
    pending() { return dirty.size; },
    myName() { const m = st.session && st.members.find(x => x.user_id === st.session.user.id); return m ? m.name : ''; },
    /* Đăng xuất. clear = xóa dữ liệu của cửa hàng khỏi máy này (dữ liệu vẫn còn trên mạng) */
    async signOut(clear) {
      unlisten();
      st.session = null; st.shop = null; st.role = ''; st.members = []; st.state = 'off';
      Store.setSys('session', null); Store.setSys('shop', null); Store.setSys('lastPull', ''); dirty.clear(); Store.setSys('dirty', []);
      if (clear) { const name = Store.setting('shopName', ''); await Store.clearData(); if (name) Store.setSetting('shopName', name); }
    },
  };
})();

/* Phân quyền theo vai trò (chỉ áp dụng khi đang dùng bản online; bản offline một người dùng thì được làm hết).
   Chủ có mọi quyền. Lưu ý: việc ẩn này làm ở phía app, máy chủ chỉ chặn giữa các cửa hàng với nhau. */
const Perm = {
  // quyền mặc định của từng vị trí; chủ sửa được ở mục Bản online (lưu trong cài đặt 'perms', đồng bộ cho mọi máy)
  DEF: {
    manager: ['sell', 'cancel', 'discount', 'debt', 'menu', 'stock', 'report', 'cash', 'promo'],
    cashier: ['sell', 'cancel', 'discount', 'debt'],
    staff: ['sell'],
  },
  ROLES: ['manager', 'cashier', 'staff'],
  // các quyền chủ bật tắt được, theo thứ tự hiện trên bảng
  list() {
    const quan = APP.mode === 'quan';
    return [['cancel', 'Hủy đơn'], ['discount', 'Giảm giá thêm trên đơn'], ['debt', 'Khách hàng, ghi nợ'],
      ['menu', quan ? 'Sửa món, công thức, giá' : 'Sửa mặt hàng, giá'], ['stock', 'Kho, nhập hàng'],
      ['report', 'Xem báo cáo, doanh thu'], ['cash', 'Thu chi, sổ quỹ'], ['promo', 'Khuyến mãi']];
  },
  of(role) {
    const saved = Store.setting('perms', null), a = saved && Array.isArray(saved[role]) ? saved[role] : Perm.DEF[role] || [];
    return a.includes('sell') ? a : ['sell', ...a];
  },
  custom() { return !!Store.setting('perms', null); },
  set(role, key, on) {
    const m = {}; Perm.ROLES.forEach(r => { m[r] = Perm.of(r).filter(k => !(r === role && k === key)); });
    if (on) m[role].push(key);
    Store.setSetting('perms', m);
  },
  reset() { Store.setSetting('perms', null); },
  // màn hình -> quyền cần có. Màn hình không có trong bảng thì ai cũng vào được.
  ROUTE: { mon: 'menu', topping: 'menu', kho: 'stock', baocao: 'report', thuchi: 'cash', chiphi: 'cash', km: 'promo', khach: 'debt', luong: 'owner', caidat: 'owner' },
  can(k) { if (!Sync.active()) return true; const r = Sync.state.role; return r === 'owner' || Perm.of(r).includes(k); },
  route(name) { const k = Perm.ROUTE[name]; return !k || Perm.can(k); },
};
