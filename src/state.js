import { DEFAULTS, STORAGE_KEY, CURVES, MIN_RELAYS, MAX_RELAYS, defaultRelay } from './constants.js';

// Mutable shared state
export const state = {
  tx: null,
  faultPct: 100,
  relays: [],
  reportSettings: { companyName: '', projectRef: '', docRef: '', revision: '' },
};

export function saveState() {
  try {
    const remarks = document.getElementById('remarksField').value;
    const data = { tx: state.tx, faultPct: state.faultPct, relays: state.relays, remarks, reportSettings: state.reportSettings };
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
      // Ensure relay count within bounds (migration)
      while (state.relays.length < MIN_RELAYS) state.relays.push(defaultRelay(state.relays.length));
      if (state.relays.length > MAX_RELAYS) state.relays.length = MAX_RELAYS;
      state.relays.forEach((r, i) => {
        const d = i < DEFAULTS.relays.length ? DEFAULTS.relays[i] : defaultRelay(i);
        if (r.label === undefined) r.label = d.label;
        if (r.side === undefined) r.side = d.side;
        if (r.ctPri === undefined) r.ctPri = d.ctPri;
        if (r.pickupMul === undefined) r.pickupMul = d.pickupMul;
        if (r.tms === undefined) r.tms = d.tms;
        if (r.enabled === undefined) r.enabled = d.enabled;
        if (r.curveType === undefined || !CURVES[r.curveType]) r.curveType = d.curveType;
        if (r.dtEnabled === undefined) r.dtEnabled = false;
        if (r.dtPickupMul === undefined) r.dtPickupMul = 5.0;
        if (r.dtDelay === undefined) r.dtDelay = 0;
      });
      if (s.reportSettings) state.reportSettings = { ...state.reportSettings, ...s.reportSettings };
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

export function addRelay() {
  if (state.relays.length >= MAX_RELAYS) return false;
  state.relays.push(defaultRelay(state.relays.length));
  return true;
}

export function removeRelay(index) {
  if (state.relays.length <= MIN_RELAYS) return false;
  state.relays.splice(index, 1);
  return true;
}

export function populateTxInputs() {
  document.getElementById('txMVA').value = state.tx.mva;
  document.getElementById('txPriKV').value = state.tx.priKV;
  document.getElementById('txSecKV').value = state.tx.secKV;
  document.getElementById('txZ').value = state.tx.zPct;
  document.getElementById('faultPctSlider').value = state.faultPct;
}
