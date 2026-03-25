import './style.css';

import { debounce, DEFAULTS } from './constants.js';
import { state, loadState, saveState, resetToDefaults, populateTxInputs } from './state.js';
import { drawChart } from './chart.js';
import { buildCards, buildLegend, updateTxDisplay, updateResults, updateTable } from './ui.js';
import { exportPDF } from './export.js';
import { setupTooltip } from './tooltip.js';

// ---- DOM references ----

const canvas = document.getElementById('chart');
const tooltip = document.getElementById('tooltip');
const container = document.getElementById('cardsContainer');

// ---- Core update loop ----

function refresh() {
  updateTxDisplay(state.tx, state.faultPct);
  buildLegend(state.relays);
  updateResults(state.relays, state.tx, state.faultPct);
  updateTable(state.relays, state.tx, state.faultPct);
  drawChart(canvas, state.relays, state.tx, state.faultPct);
  saveState();
}

const debouncedRefresh = debounce(refresh, 150);
const debouncedDrawChart = debounce(() => drawChart(canvas, state.relays, state.tx, state.faultPct), 100);

// ---- Initialize state ----

const _savedRemarks = loadState();
if (_savedRemarks === null) {
  state.tx = JSON.parse(JSON.stringify(DEFAULTS.tx));
  state.faultPct = DEFAULTS.faultPct;
  state.relays = JSON.parse(JSON.stringify(DEFAULTS.relays));
}

// ---- Populate UI ----

populateTxInputs();
buildCards(container, state.relays, refresh, debouncedRefresh);
if (_savedRemarks) document.getElementById('remarksField').value = _savedRemarks;
refresh();

// ---- Transformer input events ----

['txMVA', 'txPriKV', 'txSecKV', 'txZ'].forEach(id => {
  document.getElementById(id).addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (isNaN(v) || v <= 0) return;
    if (id === 'txMVA') state.tx.mva = v;
    if (id === 'txPriKV') state.tx.priKV = v;
    if (id === 'txSecKV') state.tx.secKV = v;
    if (id === 'txZ') state.tx.zPct = v;
    debouncedRefresh();
  });
});

// ---- Fault % multiplier slider ----

document.getElementById('faultPctSlider').addEventListener('input', e => {
  state.faultPct = parseInt(e.target.value);
  refresh();
});

// ---- Remarks auto-save ----

document.getElementById('remarksField').addEventListener('input', () => saveState());

// ---- Reset button ----

document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Reset all values to defaults?')) {
    resetToDefaults();
    populateTxInputs();
    buildCards(container, state.relays, refresh, debouncedRefresh);
    refresh();
  }
});

// ---- Export button ----

document.getElementById('exportBtn').addEventListener('click', () => {
  exportPDF(state.tx, state.faultPct, state.relays);
});

// ---- Resize handler ----

window.addEventListener('resize', () => debouncedDrawChart());

// ---- Tooltip ----

setupTooltip(canvas, tooltip, () => ({
  relays: state.relays,
  tx: state.tx,
  faultPct: state.faultPct
}));

// ---- PWA Install Prompt ----

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Don't show if user previously dismissed
  if (localStorage.getItem('pwa-install-dismissed')) return;

  showInstallBanner();
});

function showInstallBanner() {
  // Don't duplicate
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <span class="pwa-install-text">Install <strong>Relay Sim</strong> for offline use</span>
    <button type="button" class="pwa-install-btn" id="pwaInstallBtn">Install</button>
    <button type="button" class="pwa-dismiss-btn" id="pwaDismissBtn" aria-label="Dismiss install banner">&times;</button>
  `;
  document.body.appendChild(banner);

  // Animate in
  requestAnimationFrame(() => banner.classList.add('visible'));

  document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 300);
    }
    deferredPrompt = null;
  });

  document.getElementById('pwaDismissBtn').addEventListener('click', () => {
    localStorage.setItem('pwa-install-dismissed', '1');
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 300);
  });
}
