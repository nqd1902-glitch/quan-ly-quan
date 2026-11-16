'use strict';
/* Máy in bill.
   1. In qua Bluetooth thẳng từ trình duyệt (Web Bluetooth): Chrome trên Android, Chrome/Edge trên máy tính. iPhone KHÔNG có.
      Bill được vẽ thành hình rồi gửi bằng lệnh ESC/POS, nên chữ tiếng Việt có dấu không phụ thuộc bộ chữ của máy in.
      Máy in phải là loại Bluetooth năng lượng thấp (BLE).
   2. Màn hình "Máy in bill": nói rõ từng loại máy in được bằng cách nào và giới hạn của iPhone. */
const Dev = {
  ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  android: /Android/i.test(navigator.userAgent),
  bt: !!(navigator.bluetooth && navigator.bluetooth.requestDevice),
};

/* Vẽ bill thành hình đen trắng và đổi sang lệnh máy in */
const BillImg = {
  loadImg: src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; }),
  /* Trả về { w, h, rows, canvas }: rows[y] là các byte của dòng điểm y, bit 1 = điểm đen */
  async render(o) {
    const wide = Store.setting('billW', '58') === '80', W = wide ? 576 : 384, F = wide ? 26 : 24, PX = 4;
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    const font = (size, bold) => `${bold ? 700 : 500} ${size}px Arial, Helvetica, sans-serif`;
    const n = v => Math.round(v).toLocaleString('vi-VN');
    const L = []; // các dòng: { t, r, size, bold, align } | { hr } | { img, w, h }
    const wrap = (text, size, bold, maxW) => {
      cx.font = font(size, bold);
      const out = []; let cur = '';
      String(text).split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (!cur || cx.measureText(t).width <= maxW) cur = t; else { out.push(cur); cur = w; } });
      if (cur) out.push(cur);
      return out.length ? out : [''];
    };
    const text = (t, align, size = F, bold = false) => wrap(t, size, bold, W - 2 * PX).forEach(x => L.push({ t: x, size, bold, align }));
    const row = (a, b, size = F, bold = false) => {
      cx.font = font(size, bold);
      wrap(a, size, bold, Math.max(90, W - 2 * PX - cx.measureText(b).width - 12)).forEach((x, i) => L.push({ t: x, r: i ? '' : b, size, bold }));
    };
    const hr = () => L.push({ hr: true });

    // nội dung giống bill in qua hộp thoại (Bill.html)
    const no = Store.all('orders').filter(x => x.date === o.date && x.time <= o.time).length, d = new Date(o.time);
    const addr = Store.setting('billAddr', ''), phone = Store.setting('billPhone', ''), foot = Store.setting('billFoot', 'Cảm ơn quý khách!'), logo = Store.setting('logo', '');
    if (logo) { try { const im = await BillImg.loadImg(logo), s = Math.min(1, 180 / im.width, 180 / im.height); L.push({ img: im, w: Math.round(im.width * s), h: Math.round(im.height * s) }); } catch (_) {} }
    text(Store.setting('shopName', ''), 'c', F + 8, true);
    if (addr) text(addr, 'c');
    if (phone) text('ĐT: ' + phone, 'c');
    hr();
    row(`${dmy(o.date)} ${pad(d.getHours())}:${pad(d.getMinutes())}`, 'Số ' + pad(no));
    if (o.custName) text('Khách: ' + o.custName);
    hr();
    o.items.forEach(it => { text(it.name + (it.vname ? ' (' + it.vname + ')' : '')); row(`${it.qty} x ${n(it.price)}`, n(it.price * it.qty)); });
    hr();
    if (o.discount) { row('Tạm tính', n(o.subtotal)); row(o.promoName || 'Giảm giá', '-' + n(o.discount)); }
    row('TỔNG CỘNG', money(o.total), F + 6, true);
    row('Thanh toán', PAY[o.pay] || '');
    hr();
    if (foot) text(foot, 'c');

    const lh = l => l.hr ? 14 : l.img ? l.h + 10 : Math.round(l.size * 1.32);
    const H = L.reduce((a, l) => a + lh(l), 0) + 8;
    cv.width = W; cv.height = H;
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#000'; cx.textBaseline = 'middle';
    let y = 4;
    L.forEach(l => {
      const h = lh(l);
      if (l.hr) { for (let x = PX; x < W - PX; x += 10) cx.fillRect(x, y + 6, 6, 2); }
      else if (l.img) cx.drawImage(l.img, Math.round((W - l.w) / 2), y, l.w, l.h);
      else {
        cx.font = font(l.size, l.bold);
        if (l.align === 'c') { cx.textAlign = 'center'; cx.fillText(l.t, W / 2, y + h / 2); }
        else { cx.textAlign = 'left'; cx.fillText(l.t, PX, y + h / 2); if (l.r) { cx.textAlign = 'right'; cx.fillText(l.r, W - PX, y + h / 2); } }
      }
      y += h;
    });
    const px = cx.getImageData(0, 0, W, H).data, bw = W >> 3, rows = [];
    for (let yy = 0; yy < H; yy++) {
      const r = new Uint8Array(bw);
      for (let x = 0; x < W; x++) { const i = (yy * W + x) * 4; if (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114 < 150) r[x >> 3] |= 0x80 >> (x & 7); }
      rows.push(r);
    }
    return { w: W, h: H, rows, canvas: cv };
  },
  /* Lệnh ESC/POS: in hình theo từng dải (GS v 0). Dải trắng chỉ gửi 1 byte mỗi dòng, dải có chữ cắt bớt phần trắng bên phải cho nhẹ. */
  escpos(img) {
    const out = [0x1b, 0x40], R = img.rows; // ESC @: đưa máy in về trạng thái đầu
    const blank = r => r.every(b => !b);
    const band = (rows, width) => { out.push(0x1d, 0x76, 0x30, 0, width & 255, width >> 8, rows.length & 255, rows.length >> 8); rows.forEach(r => { for (let i = 0; i < width; i++) out.push(r[i]); }); };
    let y = 0;
    while (y < R.length) {
      const b0 = blank(R[y]); let e = y + 1;
      while (e < R.length && blank(R[e]) === b0 && e - y < (b0 ? 255 : 96)) e++;
      const part = R.slice(y, e); let width = 1;
      if (!b0) part.forEach(r => { for (let i = r.length - 1; i >= width; i--) if (r[i]) { width = i + 1; break; } });
      band(part, width);
      y = e;
    }
    out.push(0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0); // đẩy giấy 4 dòng rồi cắt (máy không có dao cắt thì bỏ qua lệnh cắt)
    return new Uint8Array(out);
  },
};

const BtPrint = (() => {
  // Các cổng BLE thường gặp ở máy in bill. Phải khai báo trước thì trình duyệt mới cho dùng.
  const SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fff0-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb'];
  const st = { device: null, ch: null, chunk: 180, err: '', q: Promise.resolve(), rt: 0 };
  const saved = () => Store.sys('btPrinter') || null;
  const allowed = () => Sync.paid(); // in Bluetooth thẳng từ điện thoại là quyền lợi của bản online
  const connected = () => !!(st.device && st.device.gatt && st.device.gatt.connected && st.ch);
  const refresh = () => { if (location.hash.startsWith('#/mayin') && $('#sheet-wrap').classList.contains('hidden')) render(); };
  const vi = e => {
    const m = String((e && e.message) || e);
    if (/adapter not available/i.test(m)) return 'Máy này chưa bật Bluetooth';
    if (/cancelled|canceled/i.test(m)) return 'Chưa chọn máy in';
    if (/user gesture/i.test(m)) return 'Không nối được máy in. Bật máy in rồi bấm lại';
    if (/GATT|NetworkError|disconnected|out of range|no longer in range|Connection/i.test(m)) return 'Không nối được máy in. Kiểm tra máy in đã bật và để gần';
    return m;
  };
  function retry(device, delay) {
    clearTimeout(st.rt);
    st.rt = setTimeout(() => { if (!saved() || st.device !== device || connected()) return; attach(device).catch(() => retry(device, 10000)); }, delay);
  }
  /* Nối với máy in và tìm cổng ghi dữ liệu */
  async function attach(device) {
    st.device = device; st.ch = null;
    if (!device._qlq) {
      device._qlq = true;
      device.addEventListener('gattserverdisconnected', () => { if (st.device !== device) return; st.ch = null; refresh(); retry(device, 3000); }); // rớt nối thì tự nối lại
    }
    const server = await device.gatt.connect();
    let services = []; try { services = await server.getPrimaryServices(); } catch (_) {}
    let found = null;
    for (const s of services) {
      let chars = []; try { chars = await s.getCharacteristics(); } catch (_) {}
      found = chars.find(c => c.properties.write) || chars.find(c => c.properties.writeWithoutResponse);
      if (found) break;
    }
    if (!found) { try { device.gatt.disconnect(); } catch (_) {} throw new Error('Thiết bị này không nhận lệnh in. Hãy chọn đúng tên máy in bill (loại Bluetooth BLE)'); }
    st.ch = found; st.chunk = 180; st.err = ''; refresh();
    if (typeof Station !== 'undefined') Station.next(); // trạm in có bill đang chờ thì in tiếp
  }
  /* Mở bảng chọn thiết bị của trình duyệt (phải gọi ngay trong lúc người dùng bấm nút) */
  async function pick() {
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
    const old = st.device;
    await attach(device);
    if (old && old !== device) { try { old.gatt.disconnect(); } catch (_) {} }
    Store.setSys('btPrinter', { id: device.id, name: device.name || 'Máy in Bluetooth' });
  }
  /* gesture = đang trong lúc người dùng bấm nút (được phép mở bảng chọn thiết bị) */
  async function ensure(gesture) {
    if (!Dev.bt) throw new Error('Máy này không in qua Bluetooth được');
    if (connected()) return;
    if (st.device) { try { await attach(st.device); return; } catch (e) { if (!gesture) throw e; } }
    if (!gesture) throw new Error('Máy in Bluetooth chưa nối. Vào Thêm → Máy in bill để nối lại');
    await pick();
  }
  /* Gửi dữ liệu theo từng gói nhỏ. Máy in không nhận gói lớn thì tự giảm cỡ gói rồi gửi lại gói đó. */
  async function send(bytes) {
    let i = 0;
    while (i < bytes.length) {
      const ch = st.ch; if (!ch || !connected()) throw new Error('Mất kết nối máy in');
      const resp = ch.properties.write, part = bytes.slice(i, i + (resp ? st.chunk : 20));
      try {
        if (!resp) await ch.writeValueWithoutResponse(part);
        else if (ch.writeValueWithResponse) await ch.writeValueWithResponse(part);
        else await ch.writeValue(part);
        i += part.length;
      } catch (e) {
        if (!connected()) throw new Error('Mất kết nối máy in');
        if (resp && st.chunk > 20) { st.chunk = st.chunk > 100 ? 100 : 20; continue; }
        throw e;
      }
    }
  }
  const job = fn => { const p = st.q.then(fn); st.q = p.catch(() => {}); return p; }; // mỗi lúc chỉ gửi một bill
  async function printOrder(o, auto) {
    try { await ensure(!auto); const img = await BillImg.render(o); await job(() => send(BillImg.escpos(img))); st.err = ''; }
    catch (e) { st.err = vi(e); refresh(); throw new Error(st.err); }
  }

  return {
    state: st, saved, allowed, connected, vi, pick, ensure, send, printOrder,
    on: () => Dev.bt && allowed() && !!saved(), // máy này đang chọn in qua Bluetooth
    /* Mở app: trình duyệt còn nhớ máy in thì tự nối lại, không thì chờ người dùng bấm nối */
    async restore() {
      const s = saved();
      if (!s || !Dev.bt || !allowed() || !navigator.bluetooth.getDevices) return;
      try { const d = (await navigator.bluetooth.getDevices()).find(x => x.id === s.id); if (d) attach(d).catch(() => retry(d, 10000)); } catch (_) {}
    },
    test() {
      return printOrder({ id: 'in-thu', date: ymd(), time: Date.now(), pay: 'cash', subtotal: 85000, discount: 0, total: 85000,
        items: [{ name: 'In thử: Cà phê sữa đá', vname: 'Ly 700ml', qty: 1, price: 25000 }, { name: 'Nước ép ổi', vname: '', qty: 2, price: 30000 }] });
    },
    forget() {
      clearTimeout(st.rt); Store.setSys('btPrinter', null);
      const d = st.device; st.device = null; st.ch = null; st.err = '';
      if (d) { try { d.gatt.disconnect(); } catch (_) {} }
    },
  };
})();

const Mayin = {
  async run(el, fn, ok) {
    el.disabled = true; el.style.opacity = '.6';
    try { await fn(); if (ok) UI.toast(ok); } catch (e) { UI.toast(BtPrint.vi(e)); }
    el.disabled = false; el.style.opacity = '';
    if (location.hash.startsWith('#/mayin')) render();
  },
  /* Dòng mô tả ở menu Thêm */
  hint() {
    if (Dev.ios) return 'iPhone cần trạm in · xem cách in';
    if (BtPrint.on()) return BtPrint.connected() ? 'Đã nối máy in Bluetooth' : 'Máy in Bluetooth chưa nối';
    return 'Nối máy in, cách in theo từng loại máy';
  },
};

Views.mayin = () => {
  const sv = BtPrint.saved(), con = BtPrint.connected(), err = BtPrint.state.err;
  const here = Dev.ios ? ['iPhone / iPad', `Máy này <b>không nối thẳng</b> được máy in bill thông thường. Đây là giới hạn của iPhone, không phải lỗi của app.<br><br>Cách dùng: đặt một máy tính Windows hoặc một điện thoại Android ở quầy làm <b>trạm in</b>. Bạn bán trên iPhone, bill tự in ở quầy.`]
    : Dev.android ? ['Điện thoại Android', Dev.bt ? 'Máy này in thẳng được ra máy in bill Bluetooth, không cần máy tính.' : 'Hãy mở app bằng trình duyệt <b>Chrome</b> thì mới in được qua Bluetooth.']
    : ['Máy tính', 'Cắm máy in bill vào máy tính, cài phần mềm điều khiển đi kèm máy in, rồi trong app bấm <b>In bill</b> và chọn máy in đó. In được mọi loại máy in bill.'];
  const kind = (t, d) => `<div style="padding:10px 0;border-top:1px solid var(--line)"><b>${t}</b><div class="muted small">${d}</div></div>`;
  return {
    title: 'Máy in bill', back: '#/them', tab: 'them',
    html: `<div class="card"><h3>Máy này: ${here[0]}</h3><div class="small">${here[1]}</div>
        ${Dev.ios ? `<a class="btn soft" href="#/online">${Sync.active() ? 'Mở mục Bản online để xem trạm in' : 'Xem bản online'}</a>` : ''}</div>
      ${Dev.bt ? `<div class="card"><h3>Máy in Bluetooth ${con ? '<span class="badge ok">Đã nối</span>' : sv && BtPrint.allowed() ? '<span class="badge warn">Chưa nối</span>' : ''}</h3>
        ${BtPrint.allowed() ? `
          ${sv ? `<div class="small">Máy in đã chọn: <b>${esc(sv.name)}</b></div>` : '<div class="muted small">Bật máy in, bật Bluetooth trên máy này, rồi bấm nút dưới và chọn tên máy in.</div>'}
          ${err ? `<div class="note" style="margin-top:8px">${esc(err)}</div>` : ''}
          <button class="btn" data-act="bt-pick">${!sv ? 'Chọn máy in Bluetooth' : con ? 'Đổi máy in khác' : 'Nối lại máy in'}</button>
          ${sv ? '<button class="btn soft" data-act="bt-test">In thử</button><button class="btn ghost" data-act="bt-forget">Bỏ máy in này</button>' : ''}
          <p class="muted small" style="margin-bottom:0">Máy in phải là loại Bluetooth BLE (loại có ghi in được với iPhone). Không cần ghép đôi trong phần Cài đặt của điện thoại. Mỗi lần mở lại app có thể phải bấm nối lại một lần. Khổ giấy 58 hoặc 80 mm chỉnh ở Cài đặt → In bill.</p>`
        : `<div class="muted small">In thẳng ra máy in Bluetooth là quyền lợi của bản online.</div><a class="btn soft" href="#/online">Xem bản online</a>`}</div>` : ''}
      <div class="card"><h3>Mỗi loại máy in bill thế nào</h3>
        ${kind('Máy tính Windows', 'In thẳng ra máy in đã cài vào Windows. Dùng được mọi loại máy in bill.')}
        ${kind('Điện thoại Android', 'In thẳng qua Bluetooth, mở app bằng Chrome. Cần máy in bill Bluetooth loại BLE và bản online.')}
        ${kind('iPhone, iPad', 'Không in thẳng được máy in bill thông thường. Cần một máy tính Windows hoặc một điện thoại Android đặt ở quầy làm trạm in. Riêng máy in có AirPrint thì bấm In bill là in được.')}
      </div>
      <div class="card"><h3>Trạm in là gì</h3>
        <div class="small">Là một máy đặt ở quầy, nối với máy in bill. Máy khác chốt đơn thì trạm in tự in, không ai phải bấm. Cần bản online.</div>
        ${kind('Trạm in bằng máy tính Windows', 'Cài máy in vào Windows, mở app trên máy tính đó, vào Thêm → Bản online, tích “Máy này là trạm in”, rồi làm theo nút “Cách cài để in thẳng”.')}
        ${kind('Trạm in bằng điện thoại Android', 'Nối máy in Bluetooth ở màn hình này trước, rồi vào Thêm → Bản online, tích “Máy này là trạm in”. Cắm sạc và để app mở trên màn hình suốt giờ bán.')}
      </div>`,
  };
};

Actions['bt-pick'] = el => Mayin.run(el, () => BtPrint.connected() ? BtPrint.pick() : BtPrint.ensure(true), 'Đã nối máy in');
Actions['bt-test'] = el => Mayin.run(el, () => BtPrint.test(), 'Đã gửi bill in thử ra máy in');
Actions['bt-forget'] = () => { BtPrint.forget(); render(); UI.toast('Đã bỏ máy in'); };
Actions['mayin-open'] = () => { UI.closeSheet(); go('#/mayin'); };
