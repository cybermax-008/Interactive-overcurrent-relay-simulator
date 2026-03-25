import { DEFAULTS, STORAGE_KEY, CURVES } from './constants.js';

// Mutable shared state
export const state = {
  tx: null,
  faultPct: 100,
  relays: []
};

export function saveState() {
  try {
    const remarks = document.getElementById('remarksField').value;
    const data = { tx: state.tx, faultPct: state.faultPct, relays: state.relays, remarks };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* silently fail */ }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      state.tx = { ...JSON.parse(JSON.stringify(DEFAULTS.tx)), ...(s.tx || {}) };
      state.faultPct = typeof s.faultPct === 'number' ? s.faultPct : DEFAULTS.faultPct;
      state.relays = s.relays || JSON.parse(JSON.stringify(DEFAULTS.relays));
      // Ensure exactly 4 relays with all fields (migration)
      while (state.relays.length < 4) state.relays.push(JSON.parse(JSON.stringify(DEFAULTS.relays[state.relays.length])));
      if (state.relays.length > 4) state.relays.length = 4;
      state.relays.forEach((r, i) => {
        const d = DEFAULTS.relays[i];
        if (r.label === undefined) r.label = d.label;
        if (r.side === undefined) r.side = d.side;
        if (r.ctPri === undefined) r.ctPri = d.ctPri;
        if (r.pickupMul === undefined) r.pickupMul = d.pickupMul;
        if (r.tms === undefined) r.tms = d.tms;
        if (r.enabled === undefined) r.enabled = d.enabled;
        if (r.curveType === undefined || !CURVES[r.curveType]) r.curveType = d.curveType;
      });
      // Return remarks for synchronous restoration by caller
      return s.remarks || '';
    }
  } catch (e) { /* silently fail */ }
  return null;
}

export function resetToDefaults() {
  state.tx = JSON.parse(JSON.stringify(DEFAULTS.tx));
  state.faultPct = DEFAULTS.faultPct;
  state.relays = JSON.parse(JSON.stringify(DEFAULTS.relays));
  localStorage.removeItem(STORAGE_KEY);
  document.getElementById('remarksField').value = '';
}

export function populateTxInputs() {
  document.getElementById('txMVA').value = state.tx.mva;
  document.getElementById('txPriKV').value = state.tx.priKV;
  document.getElementById('txSecKV').value = state.tx.secKV;
  document.getElementById('txZ').value = state.tx.zPct;
  document.getElementById('faultPctSlider').value = state.faultPct;
}
