// ---- Utility functions ----

export function escapeHTML(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ---- Relay limits ----

export const MIN_RELAYS = 1;
export const MAX_RELAYS = 8;

// ---- Color palette (8 high-contrast colors on dark bg) ----

export const COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#f43f5e',
  '#8b5cf6', '#06b6d4', '#d946ef', '#84cc16',
];

// ---- Default state ----

export const DEFAULTS = {
  tx: { mva: 10, priKV: 33, secKV: 11, zPct: 8 },
  faultPct: 100,
  relays: [
    { ctPri: 200, pickupMul: 0.50, tms: 0.50, enabled: true, label: 'Primary OC1', side: 'pri', curveType: 'IEC_SI', dtEnabled: false, dtPickupMul: 5.0, dtDelay: 0 },
    { ctPri: 200, pickupMul: 0.80, tms: 0.30, enabled: true, label: 'Primary OC2', side: 'pri', curveType: 'IEC_SI', dtEnabled: false, dtPickupMul: 5.0, dtDelay: 0 },
    { ctPri: 600, pickupMul: 0.50, tms: 0.20, enabled: true, label: 'Secondary OC1', side: 'sec', curveType: 'IEC_SI', dtEnabled: false, dtPickupMul: 5.0, dtDelay: 0 },
    { ctPri: 600, pickupMul: 0.80, tms: 0.10, enabled: true, label: 'Secondary OC2', side: 'sec', curveType: 'IEC_SI', dtEnabled: false, dtPickupMul: 5.0, dtDelay: 0 },
  ]
};

// ---- Relay factory ----

export function defaultRelay(index) {
  const side = index % 2 === 0 ? 'pri' : 'sec';
  return {
    ctPri: side === 'pri' ? 200 : 600,
    pickupMul: 0.50, tms: 0.30, enabled: true,
    label: `Relay ${index + 1}`, side, curveType: 'IEC_SI',
    dtEnabled: false, dtPickupMul: 5.0, dtDelay: 0,
  };
}

// ---- Persistence ----

export const STORAGE_KEY = 'idmt_relay_sim_v2';

// ---- IEC 60255 Standard Inverse curve constants (legacy, kept for reference) ----

export const IEC_SI_K = 0.14;
export const IEC_SI_ALPHA = 0.02;

// ---- Curve type definitions ----
// IEC 60255: t = (k / (M^alpha - 1)) * TMS
// IEEE C37.112: t = (k / (M^alpha - 1) + beta) * TMS

export const CURVES = {
  IEC_SI:  { k: 0.14,   alpha: 0.02, beta: 0, label: 'IEC Standard Inverse',       short: 'SI',  standard: 'IEC 60255' },
  IEC_VI:  { k: 13.5,   alpha: 1.0,  beta: 0, label: 'IEC Very Inverse',           short: 'VI',  standard: 'IEC 60255' },
  IEC_EI:  { k: 80.0,   alpha: 2.0,  beta: 0, label: 'IEC Extremely Inverse',      short: 'EI',  standard: 'IEC 60255' },
  IEC_LI:  { k: 120.0,  alpha: 1.0,  beta: 0, label: 'IEC Long Time Inverse',      short: 'LI',  standard: 'IEC 60255' },
  IEEE_MI: { k: 0.0515, alpha: 0.02, beta: 0.114,  label: 'IEEE Moderately Inverse', short: 'MI', standard: 'IEEE C37.112' },
  IEEE_VI: { k: 19.61,  alpha: 2.0,  beta: 0.491,  label: 'IEEE Very Inverse',       short: 'VI', standard: 'IEEE C37.112' },
  IEEE_EI: { k: 28.2,   alpha: 2.0,  beta: 0.1217, label: 'IEEE Extremely Inverse',  short: 'EI', standard: 'IEEE C37.112' },
};

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

export const BW_DASH = [
  [], [20, 10], [8, 8], [24, 8, 6, 8],
  [4, 4], [16, 6, 4, 6, 4, 6], [2, 6], [30, 8],
];
export const BW_DASH_NAMES = [
  'Solid ———', 'Dashed – – –', 'Dotted · · · ·', 'Dash-dot –·–·',
  'Short dash ‐ ‐ ‐', 'Dash-dot-dot –··–', 'Spaced dot ·  ·  ·', 'Long dash ——  ——',
];

// ---- Overlay constants ----

// Cable adiabatic damage (BS 7671 / IEC 60364-4-43)
export const CABLE_K = { Cu_PVC: 115, Cu_XLPE: 143, Al_PVC: 76, Al_XLPE: 94 };
export const CABLE_K_LABELS = {
  Cu_PVC:  'Cu / PVC (k=115)',
  Cu_XLPE: 'Cu / XLPE (k=143)',
  Al_PVC:  'Al / PVC (k=76)',
  Al_XLPE: 'Al / XLPE (k=94)',
};
export const CABLE_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];

// Transformer inrush (IEEE C37.91)
export const TX_INRUSH_PEAK = 12;
export const TX_INRUSH_TAU = 0.2;

// Transformer through-fault withstand (ANSI C57.109)
export const TX_WITHSTAND_T_BASE = { infrequent: 2, frequent: 1 };

// MCB curves (IEC 60898)
export const MCB_TYPES = {
  B: { magMin: 3, magMax: 5, label: 'Type B (3\u20135\u00d7)' },
  C: { magMin: 5, magMax: 10, label: 'Type C (5\u201310\u00d7)' },
  D: { magMin: 10, magMax: 20, label: 'Type D (10\u201320\u00d7)' },
};
export const MCB_RATINGS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
export const MCB_THERMAL_K = 3970;

// Overlay visual styles (distinct from relay COLORS)
export const OVERLAY_STYLES = {
  cable:       { color: '#ff6b6b', dash: [12, 4],       bwDash: [14, 6, 4, 6] },
  txInrush:    { color: '#ffd93d', dash: [4, 4, 12, 4], bwDash: [6, 6, 18, 6] },
  txWithstand: { color: '#6bcb77', dash: [8, 4],        bwDash: [10, 6] },
  mcb:         { color: '#4d96ff', dash: [2, 4],        bwDash: [3, 6] },
};

export const DEFAULT_OVERLAYS = {
  cable:       { enabled: false, material: 'Cu_PVC', size: 95, side: 'sec' },
  txInrush:    { enabled: false },
  txWithstand: { enabled: false, category: 'infrequent' },
  mcb:         { enabled: false, type: 'B', rating: 32, side: 'sec' },
};
