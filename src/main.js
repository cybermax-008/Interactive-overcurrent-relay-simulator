import './style.css';

import { debounce, DEFAULTS } from './constants.js';
import { state, loadState, saveState, resetToDefaults, populateTxInputs, addRelay, removeRelay } from './state.js';
import { drawChart } from './chart.js';
import { buildCards, buildLegend, updateTxDisplay, updateResults, updateTable, updateCTISummary } from './ui.js';
import { exportPDF, exportCSV } from './export.js';
import { setupTooltip } from './tooltip.js';
import { computeCTIPairs } from './cti.js';
import { getURLState, clearURLState, generateShareURL } from './sharing.js';
import { listStudies, saveStudy, loadStudy, deleteStudy, exportAllStudiesJSON, importStudiesJSON } from './studies.js';

// ---- DOM references ----

const canvas = document.getElementById('chart');
const tooltip = document.getElementById('tooltip');
const container = document.getElementById('cardsContainer');

// ---- Core update loop ----

let lastCTIPairs = [];

function refresh() {
  updateTxDisplay(state.tx, state.faultPct);
  buildLegend(state.relays);
  updateResults(state.relays, state.tx, state.faultPct);
  updateTable(state.relays, state.tx, state.faultPct);
  lastCTIPairs = computeCTIPairs(state.relays, state.tx, state.faultPct);
  updateCTISummary(lastCTIPairs, state.relays);
  drawChart(canvas, state.relays, state.tx, state.faultPct, lastCTIPairs);
  saveState();
}

const debouncedRefresh = debounce(refresh, 150);

function rebuildAndRefresh() {
  buildCards(container, state.relays, refresh, debouncedRefresh, handleAddRelay, handleRemoveRelay);
  refresh();
}

function handleAddRelay() {
  if (addRelay()) rebuildAndRefresh();
}

function handleRemoveRelay(index) {
  if (removeRelay(index)) rebuildAndRefresh();
}
const debouncedDrawChart = debounce(() => drawChart(canvas, state.relays, state.tx, state.faultPct, lastCTIPairs), 100);

// ---- Initialize state ----

let _savedRemarks = null;
const urlState = getURLState();

if (urlState) {
  // URL state takes precedence
  state.tx = urlState.tx;
  state.faultPct = urlState.faultPct;
  state.relays = urlState.relays;
  _savedRemarks = urlState.remarks;
  clearURLState();
} else {
  _savedRemarks = loadState();
  if (_savedRemarks === null) {
    state.tx = JSON.parse(JSON.stringify(DEFAULTS.tx));
    state.faultPct = DEFAULTS.faultPct;
    state.relays = JSON.parse(JSON.stringify(DEFAULTS.relays));
  }
}

// ---- Populate UI ----

populateTxInputs();
buildCards(container, state.relays, refresh, debouncedRefresh, handleAddRelay, handleRemoveRelay);
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
    rebuildAndRefresh();
  }
});

// ---- Export button ----

document.getElementById('exportBtn').addEventListener('click', () => {
  exportPDF(state.tx, state.faultPct, state.relays, lastCTIPairs, state.reportSettings);
});

document.getElementById('csvBtn').addEventListener('click', () => {
  exportCSV(state.tx, state.faultPct, state.relays);
});

// ---- Report settings ----

const rsFields = { rsCompany: 'companyName', rsProject: 'projectRef', rsDocRef: 'docRef', rsRevision: 'revision' };
Object.entries(rsFields).forEach(([elId, key]) => {
  const el = document.getElementById(elId);
  el.value = state.reportSettings[key] || '';
  el.addEventListener('input', () => {
    state.reportSettings[key] = el.value;
    saveState();
  });
});

// ---- Share button ----

document.getElementById('shareBtn').addEventListener('click', async () => {
  const remarks = document.getElementById('remarksField').value;
  const url = generateShareURL(state, remarks);
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard!');
  } catch {
    // Fallback: select a prompt
    prompt('Copy this link:', url);
  }
});

function showToast(msg) {
  let toast = document.getElementById('shareToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shareToast';
    toast.className = 'share-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2000);
}

// ---- Studies ----

function renderStudiesList() {
  const studies = listStudies();
  const countEl = document.getElementById('studiesCount');
  countEl.textContent = studies.length ? `(${studies.length})` : '';
  const listEl = document.getElementById('studiesList');
  if (!studies.length) {
    listEl.innerHTML = '<div style="color:var(--text-dim);font-size:0.6rem;padding:4px;">No saved studies</div>';
    return;
  }
  listEl.innerHTML = studies.map(s => {
    const date = new Date(s.updatedAt || s.createdAt).toLocaleDateString();
    return `<div class="study-item">
      <span class="study-name" data-id="${s.id}" title="Click to load">${s.name}</span>
      <span class="study-date">${date}</span>
      <button type="button" class="study-del" data-id="${s.id}" title="Delete">&times;</button>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.study-name').forEach(el => {
    el.addEventListener('click', () => {
      const data = loadStudy(el.dataset.id);
      if (!data) return;
      state.tx = data.tx;
      state.faultPct = data.faultPct;
      state.relays = data.relays;
      populateTxInputs();
      if (data.remarks) document.getElementById('remarksField').value = data.remarks;
      rebuildAndRefresh();
    });
  });

  listEl.querySelectorAll('.study-del').forEach(el => {
    el.addEventListener('click', () => {
      deleteStudy(el.dataset.id);
      renderStudiesList();
    });
  });
}

document.getElementById('studiesToggle').addEventListener('click', () => {
  const body = document.getElementById('studiesBody');
  const arrow = document.getElementById('studiesArrow');
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  arrow.classList.toggle('open', open);
  if (open) renderStudiesList();
});

document.getElementById('studySaveBtn').addEventListener('click', () => {
  const name = prompt('Study name:');
  if (!name) return;
  const remarks = document.getElementById('remarksField').value;
  saveStudy(name, state, remarks);
  renderStudiesList();
});

document.getElementById('studyExportAllBtn').addEventListener('click', () => exportAllStudiesJSON());

document.getElementById('studyImportBtn').addEventListener('click', () => {
  document.getElementById('studyFileInput').click();
});

document.getElementById('studyFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const count = await importStudiesJSON(file);
    showToast(`Imported ${count} study${count !== 1 ? 's' : ''}`);
    renderStudiesList();
  } catch (err) {
    showToast(err.message);
  }
  e.target.value = '';
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
