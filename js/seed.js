'use strict';
/* Dữ liệu mẫu (quán nước ép – trái cây). Giá bán theo thực đơn mẫu;
   giá mua, % hao hụt và định lượng là SỐ ƯỚC LƯỢNG để minh họa, cần sửa theo thực tế của quán. */
const Seed = {
  /* Ảnh thật của từng món mẫu (img/sp-N.jpg), theo thứ tự danh sách món bên dưới. 0 = chưa có ảnh */
  IMG: [1, 4, 5, 7, 8, 9, 10, 11, 12, 18, 20, 6, 19, 17, 15, 15, 13, 13, 3, 16, 0],
  /* Gắn ảnh cho món mẫu đã nạp từ bản cũ (chưa có trường img) */
  applyImages() {
    Store.all('products').forEach(p => {
      const m = /^s_p(\d+)$/.exec(p.id);
      if (m && p.img === undefined) { p.img = Seed.IMG[+m[1]] ? `img/sp-${Seed.IMG[+m[1]]}.jpg` : ''; Store.put('products', p); }
    });
  },
  load() {
    // [id, tên, nhóm, đv mua, đv dùng, quy đổi, giá mua, % dùng được, tồn (đv mua), báo hết (đv mua)]
    const ING = [
      ['nho', 'Nho xanh', 'Trái cây', 'kg', 'g', 1000, 50000, 95, 6, 2],
      ['man', 'Mận', 'Trái cây', 'kg', 'g', 1000, 35000, 85, 4, 1],
      ['thom', 'Thơm', 'Trái cây', 'kg', 'g', 1000, 15000, 55, 8, 2],
      ['hong', 'Hồng mật', 'Trái cây', 'kg', 'g', 1000, 45000, 85, 4, 1],
      ['xoai', 'Xoài', 'Trái cây', 'kg', 'g', 1000, 30000, 70, 8, 2],
      ['xoaikeo', 'Xoài keo', 'Trái cây', 'kg', 'g', 1000, 22000, 70, 5, 1],
      ['buoi', 'Bưởi', 'Trái cây', 'kg', 'g', 1000, 35000, 50, 6, 2],
      ['coc', 'Cóc', 'Trái cây', 'kg', 'g', 1000, 20000, 70, 5, 1],
      ['dualuoi', 'Dưa lưới', 'Trái cây', 'kg', 'g', 1000, 40000, 60, 6, 2],
      ['luu', 'Lựu', 'Trái cây', 'kg', 'g', 1000, 60000, 50, 3, 1],
      ['mit', 'Mít (múi)', 'Trái cây', 'kg', 'g', 1000, 45000, 80, 3, 1],
      ['tao', 'Táo', 'Trái cây', 'kg', 'g', 1000, 40000, 85, 6, 2],
      ['duahau', 'Dưa hấu', 'Trái cây', 'kg', 'g', 1000, 12000, 60, 8, 2],
      ['le', 'Lê', 'Trái cây', 'kg', 'g', 1000, 40000, 85, 3, 1],
      ['dau', 'Dâu tây', 'Trái cây', 'kg', 'g', 1000, 110000, 90, 2, 0.5],
      ['chanhday', 'Chanh dây', 'Trái cây', 'kg', 'g', 1000, 30000, 40, 2, 0.5],
      ['rauma', 'Rau má', 'Trái cây', 'kg', 'g', 1000, 30000, 90, 3, 1],
      ['nuocdua', 'Dừa tươi', 'Trái cây', 'trái', 'ml', 350, 12000, 100, 20, 5],
      ['suadac', 'Sữa đặc', 'Pha chế', 'lon', 'g', 380, 24000, 100, 10, 3],
      ['suatuoi', 'Sữa tươi', 'Pha chế', 'lít', 'ml', 1000, 34000, 100, 6, 2],
      ['suachua', 'Sữa chua', 'Pha chế', 'hộp', 'g', 100, 6000, 100, 24, 6],
      ['cotdua', 'Nước cốt dừa', 'Pha chế', 'lon', 'ml', 400, 28000, 100, 6, 2],
      ['matcha', 'Bột matcha', 'Pha chế', 'gói 100g', 'g', 100, 90000, 100, 3, 1],
      ['caphe', 'Cà phê pha sẵn', 'Pha chế', 'lít', 'ml', 1000, 60000, 100, 3, 1],
      ['kemmuoi', 'Kem muối', 'Pha chế', 'hộp', 'muỗng', 40, 80000, 100, 2, 0.5],
      ['tra', 'Trà', 'Pha chế', 'kg', 'g', 1000, 200000, 100, 1, 0.2],
      ['duong', 'Đường', 'Pha chế', 'kg', 'g', 1000, 24000, 100, 5, 1],
      ['duasay', 'Dừa sấy', 'Pha chế', 'kg', 'g', 1000, 180000, 100, 1, 0.2],
      ['muoi', 'Muối tôm chấm', 'Pha chế', 'kg', 'g', 1000, 70000, 100, 2, 0.5],
      ['mamruoc', 'Mắm ruốc', 'Pha chế', 'kg', 'g', 1000, 90000, 100, 1, 0.3],
      ['da', 'Đá viên', 'Pha chế', 'kg', 'g', 1000, 2000, 100, 40, 10],
      ['hop', 'Hộp đen + nắp', 'Bao bì', 'cái', 'cái', 1, 2000, 100, 300, 50],
      ['chen', 'Chén chấm', 'Bao bì', 'cái', 'cái', 1, 300, 100, 300, 50],
      ['to', 'Tô giấy + nắp', 'Bao bì', 'cái', 'cái', 1, 1500, 100, 100, 20],
      ['ly700', 'Ly 700ml + nắp', 'Bao bì', 'cái', 'cái', 1, 1200, 100, 300, 50],
      ['ly1l', 'Ly 1 lít + nắp', 'Bao bì', 'cái', 'cái', 1, 1500, 100, 300, 50],
      ['chai', 'Chai 330ml', 'Bao bì', 'cái', 'cái', 1, 2500, 100, 100, 20],
      ['tem', 'Tem nhãn', 'Bao bì', 'cái', 'cái', 1, 200, 100, 500, 100],
      ['onghut', 'Ống hút', 'Bao bì', 'cái', 'cái', 1, 150, 100, 500, 100],
    ];
    ING.forEach(([id, name, group, buyUnit, useUnit, factor, price, y, stock, min]) =>
      Store.put('ingredients', { id: 's_' + id, name, group, buyUnit, useUnit, factor, price, yield: y, stock: stock * factor, minStock: min * factor }));

    const box = { hop: 1, tem: 1, chen: 1, muoi: 15 };
    // [tên, nhóm, biểu tượng, [[size, giá, {nguyên liệu: lượng}], ...]]
    const PROD = [
      ['Mix Mận - Thơm - Hồng mật - Xoài', 'Trái cây gọt sẵn', '🍑', [['Hộp', 50000, { man: 150, thom: 120, hong: 120, xoai: 150, hop: 2, tem: 1, chen: 1, muoi: 15 }]]],
      ['Mix Nho Xanh Ngọt - Bưởi', 'Trái cây gọt sẵn', '🍇', [['Hộp', 40000, { nho: 180, buoi: 220, ...box }]]],
      ['Mix Xoài - Thơm', 'Trái cây gọt sẵn', '🥭', [['Hộp', 40000, { xoai: 250, thom: 250, ...box }]]],
      ['Set mix', 'Trái cây gọt sẵn', '🍉', [['Hộp', 40000, { thom: 100, hong: 100, duahau: 120, dualuoi: 80, le: 80, hop: 1, tem: 1 }]]],
      ['Nho Xanh - Cóc - Xoài', 'Trái cây gọt sẵn', '🍏', [['Hộp', 40000, { nho: 150, coc: 150, xoai: 180, ...box }]]],
      ['Mix Xoài Keo - Cóc Chua', 'Trái cây gọt sẵn', '🥭', [['Hộp', 35000, { xoaikeo: 250, coc: 220, mamruoc: 30, hop: 1, tem: 1, chen: 1 }]]],
      ['Nho Xanh Ngọt - Dưa Lưới', 'Trái cây gọt sẵn', '🍈', [['Hộp', 40000, { nho: 180, dualuoi: 250, hop: 1, tem: 1 }]]],
      ['Lựu - Mít - Dưa Lưới', 'Trái cây gọt sẵn', '🍈', [['Hộp', 35000, { luu: 100, mit: 120, dualuoi: 200, hop: 1, tem: 1 }]]],
      ['Nho - Lựu - Cóc - Xoài', 'Trái cây gọt sẵn', '🍇', [['Hộp', 40000, { nho: 120, luu: 80, coc: 120, xoai: 150, hop: 1, tem: 1 }]]],
      ['Set mix chấm muối', 'Trái cây gọt sẵn', '🥗', [['Hộp lớn', 70000, { tao: 150, hong: 120, le: 150, dualuoi: 150, nho: 150, hop: 1, tem: 1, chen: 1, muoi: 20 }]]],
      ['Mix Thơm - Táo Đỏ', 'Trái cây gọt sẵn', '🍍', [['Hộp', 35000, { thom: 280, tao: 180, ...box }]]],
      ['Sữa Chua Mix Trái Cây Tươi', 'Trái cây gọt sẵn', '🥣', [['Phần', 35000, { suachua: 100, mit: 40, dau: 30, nho: 30, tao: 60, xoai: 50, duasay: 10, to: 1 }]]],
      ['Ép Nho Xanh Nguyên Chất', 'Nước ép', '🍇', [['Ly 700ml', 30000, { nho: 250, da: 200, ly700: 1, onghut: 1 }], ['Chai 330ml', 50000, { nho: 450, chai: 1, tem: 1 }]]],
      ['Ép Táo Nguyên Chất', 'Nước ép', '🍎', [['Ly 700ml', 25000, { tao: 250, da: 200, ly700: 1, onghut: 1 }], ['Ly 1 lít', 30000, { tao: 320, da: 280, ly1l: 1, onghut: 1 }]]],
      ['Rau Má Sữa', 'Nước ép', '🥬', [['Ly 1 lít', 25000, { rauma: 150, suadac: 40, duong: 20, da: 300, ly1l: 1, onghut: 1 }]]],
      ['Rau Má Dừa Tươi', 'Nước ép', '🌿', [['Ly 1 lít', 20000, { rauma: 150, nuocdua: 200, duong: 20, da: 300, ly1l: 1, onghut: 1 }]]],
      ['Sinh Tố Dừa', 'Sinh tố', '🥥', [['Ly 700ml', 25000, { cotdua: 60, suadac: 40, suatuoi: 80, duasay: 8, da: 200, ly700: 1, onghut: 1 }]]],
      ['Sinh Tố Dâu', 'Sinh tố', '🍓', [['Ly 700ml', 28000, { dau: 100, suadac: 40, suatuoi: 80, duasay: 5, da: 200, ly700: 1, onghut: 1 }]]],
      ['Dừa Tươi Matcha', 'Trà & cà phê', '🍵', [['Ly 1 lít', 30000, { nuocdua: 350, matcha: 5, suadac: 30, suatuoi: 50, da: 250, ly1l: 1, onghut: 1 }]]],
      ['Trà Xoài Chanh Dây', 'Trà & cà phê', '🧋', [['Ly 700ml', 30000, { tra: 5, xoai: 100, chanhday: 60, duong: 30, da: 250, ly700: 1, onghut: 1 }]]],
      ['Cà Phê Muối', 'Trà & cà phê', '☕', [['Ly 700ml', 25000, { suadac: 30, caphe: 30, kemmuoi: 2.5, da: 250, ly700: 1, onghut: 1 }], ['Ly 1 lít', 30000, { suadac: 40, caphe: 40, kemmuoi: 3.5, da: 350, ly1l: 1, onghut: 1 }]]],
    ];
    PROD.forEach(([name, category, , vs], i) => Store.put('products', {
      id: 's_p' + i, name, category, img: Seed.IMG[i] ? `img/sp-${Seed.IMG[i]}.jpg` : '', active: true,
      variants: vs.map(([vn, price, rec], j) => ({ id: 's_p' + i + 'v' + j, name: vn, price, recipe: Object.keys(rec).map(k => ({ ingId: 's_' + k, qty: rec[k] })) })),
    }));

    Store.put('staff', { id: 's_nv1', name: 'Nhân viên 1', type: 'hour', rate: 22000, active: true });
    Store.put('staff', { id: 's_nv2', name: 'Nhân viên 2', type: 'month', rate: 6000000, active: true });
    const m = new Date(); const first = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`;
    Store.put('expenses', { id: 's_e1', category: 'Mặt bằng', amount: 3000000, date: first, note: '', recurring: true });
    Store.put('expenses', { id: 's_e2', category: 'Internet', amount: 220000, date: first, note: '', recurring: true });
    Store.put('promos', { id: 's_k1', name: 'Đơn từ 100K giảm 10%', type: 'percent', value: 10, scope: 'order', target: '', minTotal: 100000, from: '', to: '', active: true });
  },
};
