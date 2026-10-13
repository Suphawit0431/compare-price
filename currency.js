const CACHE_KEY = 'koommai_fx_rates';
const TTL_MS = 12 * 60 * 60 * 1000;

export const FX_STATE = {
  active: 'THB',
  rates: { THB: 1.0, AUD: 23.20, USD: 36.10 },
  symbols: { THB: '฿', AUD: 'A$', USD: '$' }
};

export async function initRates(onUpdated) {
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  if (cached && (Date.now() - cached.ts < TTL_MS)) {
    FX_STATE.rates = cached.rates;
    if (onUpdated) onUpdated(FX_STATE);
    return;
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/THB');
    const data = await res.json();
    if (data?.rates) {
      FX_STATE.rates.AUD = 1 / data.rates.AUD;
      FX_STATE.rates.USD = 1 / data.rates.USD;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: FX_STATE.rates, ts: Date.now() }));
      if (onUpdated) onUpdated(FX_STATE);
    }
  } catch (err) {
    console.warn('FX offline. Using fallback rates.', err);
  }
}

export function convertBetween(val, fromCur, toCur) {
  if (fromCur === toCur || !val) return val;
  const inThb = val * FX_STATE.rates[fromCur];
  return inThb / FX_STATE.rates[toCur];
}