import { FX_STATE, initRates, convertBetween } from './currency.js';
import { UNITS, DIM_BASE, cleanNumber, compareItems } from './calculator.js';

const itemsContainer = document.getElementById('items');
const resultsContainer = document.getElementById('results');
const fxRateLabel = document.getElementById('fxRateLabel');

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, t => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[t] || t));
}

function formatNumber(n) {
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
  if (abs >= 10) return n.toFixed(2).replace(/\.?0+$/, '');
  if (abs >= 1) return n.toFixed(3).replace(/\.?0+$/, '');
  return n.toFixed(4).replace(/\.?0+$/, '');
}

function renderUnitOptions(selectedKey = 'g') {
  return Object.entries(UNITS).map(([k, v]) =>
    `<option value="${k}" ${k === selectedKey ? 'selected' : ''}>${v.th} (${v.en})</option>`
  ).join('');
}

function updatePriceLabels() {
  document.querySelectorAll('.price-label').forEach(el => {
    el.textContent = `ราคารวมสุทธิ (${FX_STATE.active})`;
  });
}

function updateFxLabel() {
  fxRateLabel.textContent = `1 AUD ≈ ${FX_STATE.rates.AUD.toFixed(2)} THB`;
}

export function addItem(pre = {}) {
  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = `
    <div class="head">
      <span class="idx"></span>
      <input type="text" class="name" placeholder="ชื่อสินค้า (ไม่บังคับ)" value="${escapeHTML(pre.name || '')}">
      <button type="button" class="del" aria-label="ลบ">✕</button>
    </div>
    <div class="row">
      <div>
        <label>ขนาด / ปริมาณ</label>
        <input type="number" class="size" inputmode="decimal" step="any" placeholder="300" value="${pre.size ?? ''}">
      </div>
      <div style="flex:0 0 44%">
        <label>หน่วย</label>
        <select class="unit">${renderUnitOptions(pre.unit || 'g')}</select>
      </div>
    </div>
    <div class="row">
      <div>
        <label>จำนวนรวม (ชิ้น)</label>
        <input type="number" class="pieces" inputmode="numeric" step="any" placeholder="1" value="${pre.pieces ?? '1'}">
      </div>
      <div>
        <label>ส่วนลด (%)</label>
        <input type="number" class="discount" inputmode="decimal" step="any" placeholder="0" value="${pre.discount ?? '0'}">
      </div>
    </div>
    <div>
      <label class="price-label">ราคารวมสุทธิ (${FX_STATE.active})</label>
      <input type="number" class="price" inputmode="decimal" step="any" placeholder="10" value="${pre.price ?? ''}">
    </div>
  `;

  div.querySelector('.del').addEventListener('click', () => {
    div.remove();
    renumber();
  });

  itemsContainer.appendChild(div);
  renumber();
}

function renumber() {
  itemsContainer.querySelectorAll('.item').forEach((el, idx) => {
    el.querySelector('.idx').textContent = idx + 1;
  });
}

function collectData() {
  return [...itemsContainer.querySelectorAll('.item')].map(el => ({
    name: el.querySelector('.name').value.trim(),
    size: el.querySelector('.size').value,
    unit: el.querySelector('.unit').value,
    pieces: el.querySelector('.pieces').value,
    discount: el.querySelector('.discount').value,
    price: el.querySelector('.price').value
  }));
}

function handleCompare() {
  const result = compareItems(collectData());
  resultsContainer.style.display = 'block';

  if (!result.ok) {
    resultsContainer.innerHTML = `<div class="warn">⚠️ ${escapeHTML(result.err)}</div>`;
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  let html = '';
  result.results.forEach(item => {
    const isBest = item.rank === 1;
    html += `
      <div class="res ${isBest ? 'best' : ''}">
        ${isBest ? `<span class="badge">คุ้มสุด 🏆</span>` : `<span class="badge lose">+${formatNumber(item.pctWorse)}%</span>`}
        <div class="name">${escapeHTML(item.name)}</div>
        <div class="unit">${formatNumber(item.unitPrice)} <span style="font-size:14px;color:var(--muted)">${FX_STATE.active}/${DIM_BASE[result.dim]}</span></div>
        <div class="meta">
          ${formatNumber(item.size)} ${item.unit.th} × ${item.pieces} ชิ้น = ${formatNumber(item.baseQty)} ${DIM_BASE[result.dim]}
          ${item.discount > 0 ? `· ลด ${formatNumber(item.discount)}%` : ''} 
          (จ่ายรวม ${formatNumber(item.effPrice)} ${FX_STATE.active})
        </div>
      </div>
    `;
  });

  const best = result.results[0];
  if (best.wasteTol > 0) {
    html = `<div class="note">💡 <b>${escapeHTML(best.name)}</b> ดีที่สุด ต่อให้ทิ้งไปถึง <b>${formatNumber(best.wasteTol)}%</b> ต้นทุนก็ยังถูกกว่าคู่แข่ง</div>` + html;
  }

  resultsContainer.innerHTML = html;
  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// FX UI Switching Event
document.getElementById('fxSwitch').addEventListener('click', (e) => {
  const btn = e.target.closest('.fx-btn');
  if (!btn || btn.classList.contains('active')) return;

  const prev = FX_STATE.active;
  const next = btn.dataset.cur;

  document.querySelectorAll('.fx-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Recalculate input prices instantly
  document.querySelectorAll('.item .price').forEach(input => {
    const val = cleanNumber(input.value);
    if (!isNaN(val) && val > 0) {
      input.value = convertBetween(val, prev, next).toFixed(2);
    }
  });

  FX_STATE.active = next;
  updatePriceLabels();

  if (resultsContainer.style.display === 'block') {
    handleCompare();
  }
});

document.getElementById('addBtn').addEventListener('click', () => addItem());
document.getElementById('goBtn').addEventListener('click', handleCompare);

// Bootstrap
initRates(updateFxLabel);
updateFxLabel();
addItem({ name: 'สินค้า A', size: 300, unit: 'g', pieces: 1, discount: 0, price: 10 });
addItem({ name: 'สินค้า B', size: 500, unit: 'g', pieces: 1, discount: 0, price: 12 });