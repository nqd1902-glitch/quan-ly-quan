'use strict';
/* Hai app dùng chung một bộ mã:
     Quản lý quán  (quán ăn uống)  - mở từ index.html ở thư mục gốc
     Quản lý tiệm  (tạp hóa, bán lẻ) - mở từ tiem/index.html, trang đó đặt window.APP_MODE = 'tiem'
   Mỗi app có kho dữ liệu riêng trong máy, không lẫn vào nhau. */
const APP = (() => {
  const tiem = window.APP_MODE === 'tiem';
  // phần chỉ dành cho quán ăn uống; app tiệm ẩn đi
  const QUAN_ONLY = ['recipe', 'topping', 'tabs', 'ingredients'];
  return {
    mode: tiem ? 'tiem' : 'quan',
    name: tiem ? 'Quản lý tiệm' : 'Quản lý quán',
    word: tiem ? 'tiệm' : 'quán',
    db: tiem ? 'quanlytiem' : 'quanlyquan',
    ls: tiem ? 'qlt_' : 'qlq_',
    base: tiem ? '../' : '',
    icon: tiem ? 'tiem-192.png' : 'icon-192.png',
    accent: tiem ? 'blue' : 'green',
    has: f => !tiem || !QUAN_ONLY.includes(f),
  };
})();
