// ---- Utility functions ----

export function escapeHTML(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ---- Color palette ----

export const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e'];

// ---- Default state ----

export const DEFAULTS = {
  tx: { mva: 10, priKV: 33, secKV: 11, zPct: 8 },
  faultPct: 100,
  relays: [
    { ctPri: 200, pickupMul: 0.50, tms: 0.50, enabled: true, label: 'Primary OC1', side: 'pri' },
    { ctPri: 200, pickupMul: 0.80, tms: 0.30, enabled: true, label: 'Primary OC2', side: 'pri' },
    { ctPri: 600, pickupMul: 0.50, tms: 0.20, enabled: true, label: 'Secondary OC1', side: 'sec' },
    { ctPri: 600, pickupMul: 0.80, tms: 0.10, enabled: true, label: 'Secondary OC2', side: 'sec' },
  ]
};

// ---- Persistence ----

export const STORAGE_KEY = 'idmt_relay_sim_v2';

// ---- IEC 60255 Standard Inverse curve constants ----

export const IEC_SI_K = 0.14;
export const IEC_SI_ALPHA = 0.02;

// ---- Chart rendering constants ----

export const CURVE_SAMPLE_STEP = 1.008;
export const CURVE_START_FACTOR = 1.01;
export const LOG_PAD_X = 0.15;
export const LOG_PAD_Y = 0.25;
export const DEFAULT_X_RANGE = [50, 25000];
export const DEFAULT_Y_RANGE = [0.1, 100];
export const MAX_SAMPLE_MUL = 30;
export const SAMPLE_MUL_STEP = 1.5;
export const EXPORT_CHART_W = 2400;
export const EXPORT_CHART_H = 1500;

// ---- B&W dash patterns for PDF export ----

export const BW_DASH = [[], [20, 10], [8, 8], [24, 8, 6, 8]];
export const BW_DASH_NAMES = ['Solid ———', 'Dashed – – –', 'Dotted · · · ·', 'Dash-dot –·–·'];
