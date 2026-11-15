'use strict';
/* Lớp lưu trữ duy nhất của app. Mọi màn hình đọc/ghi qua đây.
   Mỗi bản ghi có id, updatedAt, deleted -> bản online sau này chỉ cần nghe Store.onChange để đồng bộ. */
const Store = (() => {
  const COLLS = ['ingredients', 'products', 'orders', 'moves', 'staff', 'attendance', 'payadj', 'expenses', 'promos', 'toppings', 'customers', 'debtpay', 'tabs', 'settings'];
  const ALL = [...COLLS, 'sys']; // 'sys' (mã máy, bản quyền) không nằm trong file sao lưu
  const mem = {};
  let idb = null;

  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(APP.db, 3);
    r.onupgradeneeded = () => ALL.forEach(c => { if (!r.result.objectStoreNames.contains(c)) r.result.createObjectStore(c, { keyPath: 'id' }); });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const loadAll = c => new Promise((res, rej) => {
    const r = idb.transaction(c).objectStore(c).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const write = (c, obj) => { if (idb) try { idb.transaction(c, 'readwrite').objectStore(c).put(obj); } catch (e) { console.error(e); } };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const api = {
    persistent: true,
    onChange: null,
    uid,
    async init() {
      ALL.forEach(c => mem[c] = new Map());
      try {
        idb = await open();
        for (const c of ALL) mem[c] = new Map((await loadAll(c)).map(x => [x.id, x]));
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      } catch (e) { console.error(e); idb = null; api.persistent = false; }
    },
    all(c) { return [...mem[c].values()].filter(x => !x.deleted); },
    get(c, id) { const x = mem[c].get(id); return x && !x.deleted ? x : null; },
    put(c, obj) {
      if (!obj.id) obj.id = uid();
      obj.updatedAt = Date.now();
      mem[c].set(obj.id, obj);
      write(c, obj);
      if (api.onChange && c !== 'sys') api.onChange(c, obj);
      return obj;
    },
    remove(c, id) { const x = mem[c].get(id); if (x) { x.deleted = true; api.put(c, x); } },
    /* Dùng cho đồng bộ: ghi dữ liệu từ máy chủ về, hoặc số liệu tính lại, mà KHÔNG báo onChange (không đẩy ngược lên mạng) */
    putQuiet(c, obj) { mem[c].set(obj.id, obj); write(c, obj); },
    raw(c, id) { return mem[c].get(id) || null; },          // kể cả bản ghi đã xóa
    allRaw(c) { return [...mem[c].values()]; },
    setting(key, def) { const x = mem.settings.get(key); return x ? x.value : def; },
    setSetting(key, value) { api.put('settings', { id: key, value }); },
    sys(key) { const x = mem.sys.get(key); return x ? x.value : undefined; },
    setSys(key, value) { api.put('sys', { id: key, value }); },
    exportAll() {
      const out = { app: 'quanlyquan', version: 1, exportedAt: new Date().toISOString(), data: {} };
      COLLS.forEach(c => out.data[c] = [...mem[c].values()]);
      return out;
    },
    async importAll(json) {
      if (!json || json.app !== 'quanlyquan' || !json.data) throw new Error('File không đúng định dạng');
      await api.clearData();
      COLLS.forEach(c => (json.data[c] || []).forEach(x => { if (x && x.id) { mem[c].set(x.id, x); write(c, x); } }));
    },
    clearData() {
      COLLS.forEach(c => mem[c] = new Map());
      if (!idb) return Promise.resolve();
      return new Promise(res => {
        const tx = idb.transaction(COLLS, 'readwrite');
        COLLS.forEach(c => tx.objectStore(c).clear());
        tx.oncomplete = tx.onerror = () => res();
      });
    },
  };
  return api;
})();
