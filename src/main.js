import './style.css';

import { debounce, DEFAULTS, CABLE_K_LABELS, CABLE_SIZES, MCB_RATINGS } from './constants.js';
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
  buildLegend(state.relays, state.overlays);
  updateResults(state.relays, state.tx, state.faultPct);
  updateTable(state.relays, state.tx, state.faultPct);
  lastCTIPairs = computeCTIPairs(state.relays, state.tx, state.faultPct);
  updateCTISummary(lastCTIPairs, state.relays);
  drawChart(canvas, state.relays, state.tx, state.faultPct, lastCTIPairs, state.overlays);
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
const debouncedDrawChart = debounce(() => drawChart(canvas, state.relays, state.tx, state.faultPct, lastCTIPairs, state.overlays), 100);

// ---- Initialize state ----

let _savedRemarks = null;
const urlState = getURLState();

if (urlState) {
  // URL state takes precedence
  state.tx = urlState.tx;
  state.faultPct = urlState.faultPct;
  state.relays = urlState.relays;
  if (urlState.overlays) state.overlays = urlState.overlays;
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
    populateOverlayInputs();
    rebuildAndRefresh();
  }
});

// ---- Export button ----

document.getElementById('exportBtn').addEventListener('click', () => {
  exportPDF(state.tx, state.faultPct, state.relays, lastCTIPairs, state.reportSettings, state.overlays);
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
      if (data.overlays) state.overlays = data.overlays;
      populateTxInputs();
      populateOverlayInputs();
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

// ---- Tab switching ----

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
    // Lazy-render studies list when Export tab is opened
    if (btn.dataset.tab === 'export') renderStudiesList();
  });
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

// ---- Overlays panel ----

function populateOverlayInputs() {
  const ov = state.overlays;
  // Cable material select
  const matSel = document.getElementById('ovCableMat');
  matSel.innerHTML = Object.entries(CABLE_K_LABELS).map(([k, v]) =>
    `<option value="${k}"${k === ov.cable.material ? ' selected' : ''}>${v}</option>`
  ).join('');
  // Cable size select
  const sizeSel = document.getElementById('ovCableSize');
  sizeSel.innerHTML = CABLE_SIZES.map(s =>
    `<option value="${s}"${s === ov.cable.size ? ' selected' : ''}>${s}</option>`
  ).join('');
  // MCB rating select
  const ratSel = document.getElementById('ovMcbRating');
  ratSel.innerHTML = MCB_RATINGS.map(r =>
    `<option value="${r}"${r === ov.mcb.rating ? ' selected' : ''}>${r}A</option>`
  ).join('');
  // Checkboxes
  document.getElementById('ovCableEn').checked = ov.cable.enabled;
  document.getElementById('ovInrushEn').checked = ov.txInrush.enabled;
  document.getElementById('ovWithstandEn').checked = ov.txWithstand.enabled;
  document.getElementById('ovMcbEn').checked = ov.mcb.enabled;
  // Show/hide fields
  document.getElementById('ovCableFields').style.display = ov.cable.enabled ? 'grid' : 'none';
  document.getElementById('ovInrushFields').style.display = ov.txInrush.enabled ? 'block' : 'none';
  document.getElementById('ovWithstandFields').style.display = ov.txWithstand.enabled ? 'grid' : 'none';
  document.getElementById('ovMcbFields').style.display = ov.mcb.enabled ? 'grid' : 'none';
  // Select values
  document.getElementById('ovCableSide').value = ov.cable.side;
  document.getElementById('ovWithstandCat').value = ov.txWithstand.category;
  document.getElementById('ovMcbType').value = ov.mcb.type;
  document.getElementById('ovMcbSide').value = ov.mcb.side;
}

populateOverlayInputs();

// (Overlays panel is now a tab pane — no toggle needed)

// Enable toggles
const ovEnMap = {
  ovCableEn:     { key: 'cable',      fieldsId: 'ovCableFields',     display: 'grid' },
  ovInrushEn:    { key: 'txInrush',   fieldsId: 'ovInrushFields',    display: 'block' },
  ovWithstandEn: { key: 'txWithstand', fieldsId: 'ovWithstandFields', display: 'grid' },
  ovMcbEn:       { key: 'mcb',        fieldsId: 'ovMcbFields',       display: 'grid' },
};
Object.entries(ovEnMap).forEach(([elId, cfg]) => {
  document.getElementById(elId).addEventListener('change', e => {
    state.overlays[cfg.key].enabled = e.target.checked;
    document.getElementById(cfg.fieldsId).style.display = e.target.checked ? cfg.display : 'none';
    refresh();
  });
});

// Parameter selects
document.getElementById('ovCableMat').addEventListener('change', e => { state.overlays.cable.material = e.target.value; refresh(); });
document.getElementById('ovCableSize').addEventListener('change', e => { state.overlays.cable.size = parseFloat(e.target.value); refresh(); });
document.getElementById('ovCableSide').addEventListener('change', e => { state.overlays.cable.side = e.target.value; refresh(); });
document.getElementById('ovWithstandCat').addEventListener('change', e => { state.overlays.txWithstand.category = e.target.value; refresh(); });
document.getElementById('ovMcbType').addEventListener('change', e => { state.overlays.mcb.type = e.target.value; refresh(); });
document.getElementById('ovMcbRating').addEventListener('change', e => { state.overlays.mcb.rating = parseInt(e.target.value); refresh(); });
document.getElementById('ovMcbSide').addEventListener('change', e => { state.overlays.mcb.side = e.target.value; refresh(); });

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
