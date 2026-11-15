'use strict';
/* Các phép tính: giá cost, trừ kho, khuyến mãi, lương, báo cáo.
   Quy ước nguyên liệu:
     price  = giá mua cho 1 đơn vị mua (vd 50.000đ/kg)
     factor = 1 đơn vị mua bằng bao nhiêu đơn vị dùng (kg -> g: 1000)
     yield  = % dùng được sau sơ chế (gọt vỏ, bỏ hạt). 100 = không hao hụt
     stock  = tồn kho, tính theo đơn vị dùng, là hàng thô chưa sơ chế
   Định lượng trong công thức là lượng thành phẩm (đã sơ chế). */
const Calc = {
  yieldOf(ing) { const y = +ing.yield || 100; return Math.min(Math.max(y, 1), 100) / 100; },
  unitCost(ing) { return (+ing.price || 0) / (+ing.factor || 1) / Calc.yieldOf(ing); }, // đ / 1 đơn vị dùng thành phẩm
  rawQty(ing, qty) { return qty / Calc.yieldOf(ing); },
  lineCost(r) { const ing = Store.get('ingredients', r.ingId); return ing ? Calc.unitCost(ing) * (+r.qty || 0) : 0; },
  variantCost(v) { return (v.recipe || []).reduce((s, r) => s + Calc.lineCost(r), 0); },
  toppingCost(t) { const ing = t.ingId && Store.get('ingredients', t.ingId); return ing ? Calc.unitCost(ing) * (+t.qty || 0) : 0; },
  costPct(v) { return v.price > 0 ? Calc.variantCost(v) / v.price * 100 : 0; },
  pctClass(p) { return p > 50 ? 'bad' : p > 35 ? 'warn' : 'ok'; },

  stockValue(ing) { return Math.max(+ing.stock || 0, 0) / (+ing.factor || 1) * (+ing.price || 0); },
  isLow(ing) { const s = +ing.stock || 0; return s <= 0 || (ing.minStock > 0 && s <= ing.minStock); },

  /* sign = -1 khi bán, +1 khi hủy đơn */
  applyOrderStock(order, sign) {
    const delta = {};
    order.items.forEach(it => (it.recipe || []).forEach(r => { delta[r.ingId] = (delta[r.ingId] || 0) + r.raw * it.qty; }));
    const negative = [];
    Object.keys(delta).forEach(id => {
      const ing = Store.get('ingredients', id);
      if (!ing) return;
      ing.stock = +((+ing.stock || 0) + sign * delta[id]).toFixed(4);
      if (ing.stock < 0) negative.push(ing.name);
      Store.put('ingredients', ing);
    });
    return negative;
  },

  /* Khuyến mãi. lines = [{p, v, qty}] */
  promoValid(pr, subtotal, day) {
    if (pr.active === false) return false;
    if (pr.from && day < pr.from) return false;
    if (pr.to && day > pr.to) return false;
    if (pr.minTotal && subtotal < pr.minTotal) return false;
    return true;
  },
  promoDiscount(pr, lines, day) {
    const subtotal = lines.reduce((s, l) => s + (l.price ?? l.v.price) * l.qty, 0);
    if (!Calc.promoValid(pr, subtotal, day)) return 0;
    let base = subtotal;
    if (pr.scope === 'category') base = lines.filter(l => (l.p.category || 'Khác') === pr.target).reduce((s, l) => s + (l.price ?? l.v.price) * l.qty, 0);
    if (pr.scope === 'product') base = lines.filter(l => l.p.id === pr.target).reduce((s, l) => s + (l.price ?? l.v.price) * l.qty, 0);
    if (base <= 0) return 0;
    const d = pr.type === 'percent' ? base * (+pr.value || 0) / 100 : Math.min(+pr.value || 0, base);
    return Math.round(Math.min(d, base));
  },
  bestPromo(lines, day) {
    let best = null, bestD = 0;
    Store.all('promos').forEach(pr => { const d = Calc.promoDiscount(pr, lines, day); if (d > bestD) { best = pr; bestD = d; } });
    return best;
  },

  /* Lương 1 nhân viên trong tháng 'YYYY-MM' */
  payrollOf(st, m) {
    const units = Store.all('attendance').filter(a => a.staffId === st.id && a.date.startsWith(m)).reduce((s, a) => s + (+a.amount || 0), 0);
    const adj = Store.all('payadj').filter(a => a.staffId === st.id && a.date.startsWith(m));
    const sum = t => adj.filter(a => a.type === t).reduce((s, a) => s + (+a.amount || 0), 0);
    const rate = +st.rate || 0;
    const base = st.type === 'month' ? Math.max(0, rate - units * rate / 26) : units * rate;
    const bonus = sum('bonus'), fine = sum('fine'), advance = sum('advance');
    const gross = Math.round(base + bonus - fine);
    return { st, units, base: Math.round(base), bonus, fine, advance, gross, remain: gross - advance };
  },
  payroll(m) {
    return Store.all('staff').map(st => Calc.payrollOf(st, m))
      .filter(p => p.st.active !== false || p.units || p.bonus || p.fine || p.advance);
  },

  expensesOf(m) {
    return Store.all('expenses').filter(e => {
      const em = e.date.slice(0, 7);
      if (e.recurring) return em <= m && (!e.endMonth || e.endMonth >= m);
      return em === m;
    });
  },

  monthReport(m) {
    const orders = Store.all('orders').filter(o => !o.cancelled && o.date.startsWith(m));
    const r = { revenue: 0, cogs: 0, discount: 0, count: orders.length, days: {}, byDay: {}, byProd: {}, byPay: {} };
    orders.forEach(o => {
      r.revenue += o.total; r.cogs += o.cost; r.discount += o.discount || 0;
      r.byDay[o.date] = (r.byDay[o.date] || 0) + o.total;
      const dd = r.days[o.date] || (r.days[o.date] = { count: 0, revenue: 0, cogs: 0 });
      dd.count++; dd.revenue += o.total; dd.cogs += o.cost;
      r.byPay[o.pay] = (r.byPay[o.pay] || 0) + o.total;
      o.items.forEach(it => {
        const k = it.name;
        const x = r.byProd[k] || (r.byProd[k] = { name: k, qty: 0, revenue: 0 });
        x.qty += it.qty; x.revenue += it.price * it.qty;
      });
    });
    const moves = Store.all('moves').filter(x => x.date.startsWith(m));
    r.purchases = moves.filter(x => x.type === 'in').reduce((s, x) => s + (x.value || 0), 0);
    r.waste = -moves.filter(x => x.type === 'waste' || x.type === 'adjust').reduce((s, x) => s + (x.value || 0), 0);
    r.salary = Calc.payroll(m).reduce((s, p) => s + p.gross, 0);
    r.expenses = Calc.expensesOf(m).reduce((s, e) => s + (+e.amount || 0), 0);
    r.gross = r.revenue - r.cogs;
    r.net = r.gross - r.salary - r.expenses - r.waste;
    return r;
  },
};
