export const UNITS = {
  g:    { dim: 'weight', factor: 1,     th: 'กรัม',     en: 'g' },
  kg:   { dim: 'weight', factor: 1000,  th: 'กิโลกรัม', en: 'kg' },
  mg:   { dim: 'weight', factor: 0.001, th: 'มิลลิกรัม', en: 'mg' },
  ml:   { dim: 'volume', factor: 1,     th: 'มิลลิลิตร', en: 'ml' },
  cl:   { dim: 'volume', factor: 10,    th: 'เซนติลิตร', en: 'cl' },
  l:    { dim: 'volume', factor: 1000,  th: 'ลิตร',     en: 'L' },
  pcs:  { dim: 'count',  factor: 1,     th: 'ชิ้น',     en: 'pcs' },
  sheet:{ dim: 'count',  factor: 1,     th: 'แผ่น',     en: 'sheet' },
  tab:  { dim: 'count',  factor: 1,     th: 'เม็ด',     en: 'tab' },
  roll: { dim: 'count',  factor: 1,     th: 'ม้วน',     en: 'roll' },
  pair: { dim: 'count',  factor: 2,     th: 'คู่',      en: 'pair' },
  dozen:{ dim: 'count',  factor: 12,    th: 'โหล',      en: 'dozen' }
};

export const DIM_BASE = { weight: 'กรัม', volume: 'มล.', count: 'ชิ้น' };
export const DIM_TH   = { weight: 'น้ำหนัก', volume: 'ปริมาตร', count: 'จำนวน' };

export function cleanNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return NaN;
  return Number(String(val).replace(/,/g, '.').trim());
}

export function analyzeItem(item) {
  const u = UNITS[item.unit];
  if (!u) return { ok: false, err: `หน่วยไม่ถูกต้อง: ${item.unit}` };

  const size   = cleanNumber(item.size);
  const pieces = cleanNumber(item.pieces || 1);
  const disc   = cleanNumber(item.discount || 0);
  const price  = cleanNumber(item.price);

  if (isNaN(size) || size <= 0) return { ok: false, err: 'ขนาดต้องมากกว่า 0' };
  if (isNaN(pieces) || pieces <= 0) return { ok: false, err: 'จำนวนต้องมากกว่า 0' };
  if (isNaN(price) || price <= 0) return { ok: false, err: 'ราคาต้องมากกว่า 0' };
  if (isNaN(disc) || disc < 0 || disc > 100) return { ok: false, err: 'ส่วนลดต้อง 0–100%' };

  const baseQty = size * u.factor * pieces;
  const effPrice = price * (1 - (disc / 100));

  return {
    ok: true,
    dim: u.dim,
    baseQty,
    effPrice,
    unitPrice: effPrice / baseQty,
    unit: u,
    size,
    pieces,
    discount: disc
  };
}

export function compareItems(items) {
  if (!items.length) return { ok: false, err: 'ยังไม่มีรายการสินค้า' };

  const analyzed = items.map((it, idx) => ({
    i: idx,
    name: it.name || `สินค้า ${idx + 1}`,
    ...analyzeItem(it)
  }));

  const failed = analyzed.find(i => !i.ok);
  if (failed) return { ok: false, err: `${failed.name}: ${failed.err}` };

  const dims = new Set(analyzed.map(o => o.dim));
  if (dims.size > 1) {
    const dimList = [...dims].map(d => DIM_TH[d]).join(', ');
    return { ok: false, err: `เปรียบเทียบข้ามหมวดหมู่ไม่ได้ (${dimList})` };
  }

  const sorted = [...analyzed].sort((a, b) => a.unitPrice - b.unitPrice);
  const best = sorted[0].unitPrice;

  sorted.forEach((item, rank) => {
    item.rank = rank + 1;
    item.pctWorse = best > 0 ? ((item.unitPrice / best) - 1) * 100 : 0;
    item.wasteTol = (rank === 0 && sorted[1]) 
      ? (1 - (sorted[0].unitPrice / sorted[1].unitPrice)) * 100 
      : null;
  });

  return { ok: true, results: sorted, dim: sorted[0].dim };
}