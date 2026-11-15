'use strict';
/* Tạo mã QR ngay trong máy (không cần mạng) + nội dung QR chuyển khoản theo chuẩn VietQR */
const QR = (() => {
  // Mức sửa lỗi M, phiên bản 1..10: số byte sửa lỗi mỗi khối, số khối
  const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  const rsDivisor = deg => {
    const res = new Array(deg).fill(0); res[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { res[j] = mul(res[j], root); if (j + 1 < deg) res[j] ^= res[j + 1]; } root = mul(root, 2); }
    return res;
  };
  const rsRemainder = (data, div) => {
    const res = div.map(() => 0);
    for (const b of data) { const f = b ^ res.shift(); res.push(0); div.forEach((c, i) => { res[i] ^= mul(c, f); }); }
    return res;
  };

  function matrix(text) {
    const bytes = [...new TextEncoder().encode(text)];
    let v = 1, cap = 0;
    for (; v <= 10; v++) { cap = (Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v]) * 8; if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= cap) break; }
    if (v > 10) throw new Error('Nội dung QR quá dài');
    // dãy bit dữ liệu
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // chia khối, thêm mã sửa lỗi, xen kẽ
    const raw = Math.floor(rawModules(v) / 8), nb = BLK[v], el = ECC[v], nShort = nb - raw % nb, sl = Math.floor(raw / nb);
    const div = rsDivisor(el), blocks = []; let k = 0;
    for (let i = 0; i < nb; i++) { const dl = sl - el + (i < nShort ? 0 : 1); const dat = data.slice(k, k + dl); k += dl; const ecc = rsRemainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc)); }
    const cw = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - el || j >= nShort) cw.push(b[i]); });

    const size = 17 + 4 * v;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    });
    if (v >= 2) {
      const n = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + n * 2 + 1) / (n * 2 - 2)) * 2, pos = [6];
      for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    const drawFormat = mask => {
      const d = mask; let rem = d; // mức M có mã 0
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412, bit = i => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (v >= 7) {
      let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const b = (v << 12) | rem;
      for (let i = 0; i < 18; i++) { const dark = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, dark); set(c, a, dark); }
    }
    // rải dữ liệu theo đường dích dắc
    let idx = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && idx < cw.length * 8) { m[y][x] = ((cw[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0; idx++; }
      }
    }
    const MASK = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const applyMask = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASK[k](x, y)) m[y][x] = !m[y][x]; };
    const penalty = () => {
      let p = 0, dark = 0;
      for (let y = 0; y < size; y++) {
        let runR = 1, runC = 1;
        for (let x = 0; x < size; x++) {
          if (m[y][x]) dark++;
          if (x > 0) {
            if (m[y][x] === m[y][x - 1]) { runR++; if (runR === 5) p += 3; else if (runR > 5) p++; } else runR = 1;
            if (m[x][y] === m[x - 1][y]) { runC++; if (runC === 5) p += 3; else if (runC > 5) p++; } else runC = 1;
            if (y > 0 && m[y][x] === m[y][x - 1] && m[y][x] === m[y - 1][x] && m[y][x] === m[y - 1][x - 1]) p += 3;
          }
        }
      }
      const total = size * size;
      return p + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    };
    let best = 0, bestP = Infinity;
    for (let k = 0; k < 8; k++) { applyMask(k); drawFormat(k); const p = penalty(); if (p < bestP) { bestP = p; best = k; } applyMask(k); }
    applyMask(best); drawFormat(best);
    return m;
  }

  return {
    matrix,
    svg(text, px = 200) {
      const m = matrix(text), n = m.length + 8; let d = '';
      m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
    },
  };
})();

/* Mã ngân hàng (BIN) dùng trong QR chuyển khoản. Quán PHẢI quét thử 1 lần và xem đúng tên người nhận trước khi dùng. */
const BANKS = [
  ['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'], ['970422', 'MB Bank'],
  ['970407', 'Techcombank'], ['970416', 'ACB'], ['970432', 'VPBank'], ['970423', 'TPBank'], ['970403', 'Sacombank'],
  ['970437', 'HDBank'], ['970441', 'VIB'], ['970443', 'SHB'], ['970431', 'Eximbank'], ['970426', 'MSB'],
  ['970448', 'OCB'], ['970440', 'SeABank'], ['970449', 'LPBank'], ['970428', 'Nam A Bank'], ['970454', 'BVBank (Bản Việt)'],
  ['970452', 'KienlongBank'], ['970425', 'ABBank'], ['970409', 'Bac A Bank'], ['970412', 'PVcomBank'], ['970429', 'SCB'],
];

const QRPay = {
  ready() { return /^\d{6}$/.test(Store.setting('qrBin', '')) && Store.setting('qrAcc', '').length >= 4; },
  crc(s) {
    let c = 0xFFFF;
    for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
    return c.toString(16).toUpperCase().padStart(4, '0');
  },
  /* Chuỗi nội dung QR: chuyển khoản tới tài khoản của quán, kèm số tiền và lời nhắn */
  payload(amount, note) {
    const f = (id, v) => id + String(v.length).padStart(2, '0') + v;
    const acc = Store.setting('qrAcc', '').replace(/\s/g, '');
    const msg = String(note || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 25);
    let s = f('00', '01') + f('01', amount > 0 ? '12' : '11')
      + f('38', f('00', 'A000000727') + f('01', f('00', Store.setting('qrBin', '')) + f('01', acc)) + f('02', 'QRIBFTTA'))
      + f('53', '704') + (amount > 0 ? f('54', String(Math.round(amount))) : '') + f('58', 'VN')
      + (msg ? f('62', f('08', msg)) : '') + '6304';
    return s + QRPay.crc(s);
  },
  bankName() { const b = BANKS.find(x => x[0] === Store.setting('qrBin', '')); return b ? b[1] : 'Mã ' + Store.setting('qrBin', ''); },
  box(amount, px = 190) {
    if (!QRPay.ready()) return '';
    return `<div class="qrbox">${QR.svg(QRPay.payload(amount, Store.setting('qrNote', 'Thanh toan don hang')), px)}
      <div><b>${esc(QRPay.bankName())}</b><div class="num">${esc(Store.setting('qrAcc', ''))}</div><div class="muted small">${esc(Store.setting('qrName', ''))}</div><div class="bold num" style="margin-top:6px">${money(amount)}</div></div></div>`;
  },
};
