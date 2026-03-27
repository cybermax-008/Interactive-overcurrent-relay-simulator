import { COLORS, CURVES, MAX_RELAYS, MIN_RELAYS, escapeHTML, OVERLAY_STYLES } from './constants.js';
import { getIset, getRelayFault, tripTime, getPriFault100, getSecFault100, getPriFault, getSecFault, getDTPickup, effectiveTripTime } from './math.js';

function curveOptions(selected) {
  const groups = {};
  for (const [key, c] of Object.entries(CURVES)) {
    if (!groups[c.standard]) groups[c.standard] = [];
    groups[c.standard].push({ key, label: c.label });
  }
  return Object.entries(groups).map(([std, opts]) =>
    `<optgroup label="${std}">${opts.map(o =>
      `<option value="${o.key}"${o.key === selected ? ' selected' : ''}>${o.label}</option>`
    ).join('')}</optgroup>`
  ).join('');
}

// ---- Relay card builder ----

export function buildCards(container, relays, onRefresh, onDebouncedRefresh, onAddRelay, onRemoveRelay) {
  const canRemove = relays.length > MIN_RELAYS;
  const canAdd = relays.length < MAX_RELAYS;

  container.innerHTML = relays.map((r, i) => `
    <div class="relay-card ${r.enabled ? '' : 'disabled'}" data-idx="${i}" id="rc${i}" style="margin-bottom:8px;border-left-color:${COLORS[i]};">
      <div class="card-header">
        <span class="title" style="color:${COLORS[i]};">R${i + 1}</span>
        <input type="text" class="label-input" data-relay="${i}" data-param="label" value="${escapeHTML(r.label)}" placeholder="Label..." maxlength="30">
        <span class="print-label" id="printLabel${i}" style="display:none;font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:600;">${escapeHTML(r.label)}</span>
        <div class="toggle-wrap">
          <span>ON</span>
          <label class="toggle">
            <input type="checkbox" ${r.enabled ? 'checked' : ''} data-relay="${i}" aria-label="Enable relay ${i + 1}">
            <span class="sl"></span>
          </label>
          ${canRemove ? `<button type="button" class="remove-relay-btn" data-relay="${i}" aria-label="Remove relay ${i + 1}" title="Remove relay">&times;</button>` : ''}
        </div>
      </div>
      <div class="print-params" id="printParams${i}" style="display:none;font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:#666;margin-bottom:4px;">
        CT Primary: ${r.ctPri} A &nbsp;|&nbsp; Pickup Mul: ${r.pickupMul.toFixed(2)} &nbsp;|&nbsp; TMS: ${r.tms.toFixed(2)}
      </div>
      <div class="card-fields">
        <div class="field">
          <label for="r${i}side">Side</label>
          <select class="curve-select" id="r${i}side" data-relay="${i}" data-param="side">
            <option value="pri"${r.side === 'pri' ? ' selected' : ''}>Primary</option>
            <option value="sec"${r.side === 'sec' ? ' selected' : ''}>Secondary</option>
          </select>
        </div>
        <div class="field" style="grid-column:span 2;">
          <label for="r${i}curveType">Curve Type</label>
          <select class="curve-select" id="r${i}curveType" data-relay="${i}" data-param="curveType">
            ${curveOptions(r.curveType)}
          </select>
        </div>
        <div class="field">
          <label for="r${i}ctPri">CT Primary (A)</label>
          <input type="number" class="num-input" id="r${i}ctPri" data-relay="${i}" data-param="ctPri" value="${r.ctPri}" min="1" max="50000" step="1">
        </div>
        <div class="field">
          <label for="r${i}pickupMul">Pickup Mul (0\u20132)</label>
          <input type="number" class="num-input" id="r${i}pickupMul" data-relay="${i}" data-param="pickupMul" value="${r.pickupMul.toFixed(2)}" min="0.01" max="2" step="0.01">
        </div>
        <div class="field">
          <label for="r${i}tms">TMS (0.10\u20131.00)</label>
          <input type="number" class="num-input" id="r${i}tms" data-relay="${i}" data-param="tms" value="${r.tms.toFixed(2)}" min="0.10" max="1.00" step="0.01">
        </div>
      </div>
      <div class="dt-section">
        <label class="dt-toggle-label">
          <input type="checkbox" class="dt-toggle" data-relay="${i}" ${r.dtEnabled ? 'checked' : ''} aria-label="Enable high-set DT for relay ${i + 1}">
          <span class="dt-label-text">High-Set DT</span>
        </label>
        <div class="dt-fields" style="display:${r.dtEnabled ? 'grid' : 'none'};" id="dtFields${i}">
          <div class="field">
            <label for="r${i}dtPickupMul">DT Pickup Mul</label>
            <input type="number" class="num-input" id="r${i}dtPickupMul" data-relay="${i}" data-param="dtPickupMul" value="${r.dtPickupMul.toFixed(1)}" min="1.0" max="50" step="0.1">
          </div>
          <div class="field">
            <label for="r${i}dtDelay">DT Delay (s)</label>
            <input type="number" class="num-input" id="r${i}dtDelay" data-relay="${i}" data-param="dtDelay" value="${r.dtDelay.toFixed(2)}" min="0" max="1.0" step="0.01">
          </div>
        </div>
      </div>
      <div class="calc-row" id="calcRow${i}"></div>
      <div class="card-result">
        <span>Trip Time:</span>
        <span class="tv" id="tr${i}">\u2014</span>
      </div>
    </div>
  `).join('') + (canAdd ? `<button type="button" class="add-relay-btn" id="addRelayBtn">+ Add Relay</button>` : '');

  // Wire toggle events
  container.querySelectorAll('.toggle input').forEach(t => {
    t.addEventListener('change', e => {
      relays[parseInt(e.target.dataset.relay)].enabled = e.target.checked;
      onRefresh();
    });
  });

  // Wire curve type and side select events
  container.querySelectorAll('.curve-select').forEach(sel => {
    sel.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.relay);
      const p = e.target.dataset.param;
      if (p === 'curveType') relays[idx].curveType = e.target.value;
      if (p === 'side') relays[idx].side = e.target.value;
      onRefresh();
    });
  });

  // Wire remove relay buttons
  container.querySelectorAll('.remove-relay-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      onRemoveRelay(parseInt(e.target.dataset.relay));
    });
  });

  // Wire add relay button
  const addBtn = container.querySelector('#addRelayBtn');
  if (addBtn) addBtn.addEventListener('click', onAddRelay);

  // Wire DT toggle events
  container.querySelectorAll('.dt-toggle').forEach(t => {
    t.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.relay);
      relays[idx].dtEnabled = e.target.checked;
      const dtFields = document.getElementById('dtFields' + idx);
      if (dtFields) dtFields.style.display = e.target.checked ? 'grid' : 'none';
      onRefresh();
    });
  });

  // Wire parameter input events
  container.querySelectorAll('input[data-param]').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.relay);
      const p = e.target.dataset.param;
      if (p === 'label') {
        relays[idx].label = e.target.value;
        document.getElementById('printLabel' + idx).textContent = e.target.value;
        onDebouncedRefresh();
        return;
      }
      const val = parseFloat(e.target.value);
      if (isNaN(val)) return;
      if (p === 'ctPri') relays[idx].ctPri = Math.max(1, Math.round(val));
      if (p === 'pickupMul') relays[idx].pickupMul = Math.max(0.01, Math.min(2, val));
      if (p === 'tms') relays[idx].tms = Math.max(0.05, Math.min(1.0, val));
      if (p === 'dtPickupMul') relays[idx].dtPickupMul = Math.max(1.0, Math.min(50, val));
      if (p === 'dtDelay') relays[idx].dtDelay = Math.max(0, Math.min(1.0, val));
      onDebouncedRefresh();
    });
  });
}

// ---- Legend builder ----

export function buildLegend(relays, overlays) {
  let html = relays.map((r, i) => {
    const name = r.label || `R${i + 1}`;
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;
    return `<span class="leg-item" style="opacity:${r.enabled ? 1 : 0.3}">
      <span class="leg-dot" style="background:${COLORS[i]}"></span>
      ${escapeHTML(name)} [${curve.short}]
    </span>`;
  }).join('');

  if (overlays) {
    const items = [];
    if (overlays.cable?.enabled)       items.push({ color: OVERLAY_STYLES.cable.color,       label: `Cable ${overlays.cable.size}mm\u00b2` });
    if (overlays.txInrush?.enabled)    items.push({ color: OVERLAY_STYLES.txInrush.color,    label: 'TX Inrush' });
    if (overlays.txWithstand?.enabled) items.push({ color: OVERLAY_STYLES.txWithstand.color, label: 'TX Withstand' });
    if (overlays.mcb?.enabled)         items.push({ color: OVERLAY_STYLES.mcb.color,         label: `MCB ${overlays.mcb.type}${overlays.mcb.rating}` });
    html += items.map(it =>
      `<span class="leg-item"><span class="leg-dot" style="background:${it.color};border-radius:0;height:2px;"></span>${escapeHTML(it.label)}</span>`
    ).join('');
  }

  document.getElementById('legend').innerHTML = html;
}

// ---- Transformer display update ----

export function updateTxDisplay(tx, faultPct) {
  const priFault100 = getPriFault100(tx);
  const secFault100 = getSecFault100(tx);
  const priFault = getPriFault(tx, faultPct);
  const secFault = getSecFault(tx, faultPct);
  document.getElementById('txPriFault100').textContent = priFault100.toFixed(1) + ' A';
  document.getElementById('txSecFault100').textContent = secFault100.toFixed(1) + ' A';
  document.getElementById('txPriFault').textContent = priFault.toFixed(1) + ' A';
  document.getElementById('txSecFault').textContent = secFault.toFixed(1) + ' A';
  document.getElementById('fsPri').textContent = priFault.toFixed(1) + ' A (' + faultPct + '%)';
  document.getElementById('fsSec').textContent = secFault.toFixed(1) + ' A (' + faultPct + '%)';
  document.getElementById('faultPctDisplay').textContent = faultPct + '%';
  document.getElementById('kvWarning').style.display = tx.priKV <= tx.secKV ? 'block' : 'none';
}

// ---- Relay results update ----

export function updateResults(relays, tx, faultPct) {
  relays.forEach((r, i) => {
    const card = document.getElementById('rc' + i);
    card.classList.toggle('disabled', !r.enabled);

    const iset = getIset(r);
    const If = getRelayFault(r, tx, faultPct);
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;
    const calcRow = document.getElementById('calcRow' + i);
    const trEl = document.getElementById('tr' + i);

    const dtPickup = r.dtEnabled ? getDTPickup(r) : null;
    let calcLines = `
      <span>I<sub>set</sub> = ${r.ctPri} \u00d7 ${r.pickupMul.toFixed(2)} = <span class="computed">${iset.toFixed(1)} A</span></span>
      <span>I<sub>fault</sub> (${r.side === 'pri' ? 'Pri' : 'Sec'}) = <span class="computed">${If.toFixed(1)} A</span></span>
    `;
    if (r.dtEnabled) {
      calcLines += `<span>DT Pickup = ${r.ctPri} \u00d7 ${r.dtPickupMul.toFixed(1)} = <span class="computed">${dtPickup.toFixed(1)} A</span> @ ${r.dtDelay.toFixed(2)}s</span>`;
    }
    calcRow.innerHTML = calcLines;

    // Keep print-only params in sync
    const pp = document.getElementById('printParams' + i);
    if (pp) pp.innerHTML = `CT Primary: ${r.ctPri} A &nbsp;|&nbsp; Pickup Mul: ${r.pickupMul.toFixed(2)} &nbsp;|&nbsp; TMS: ${r.tms.toFixed(2)} &nbsp;|&nbsp; Curve: ${curve.short}${r.dtEnabled ? ' &nbsp;|&nbsp; DT: ' + dtPickup.toFixed(0) + 'A @ ' + r.dtDelay.toFixed(2) + 's' : ''}`;

    if (!r.enabled) { trEl.textContent = 'OFF'; return; }
    if (iset <= 0) { trEl.textContent = 'No pickup'; return; }

    const t = effectiveTripTime(If, r, curve);
    const ratio = If / iset;
    const isDT = r.dtEnabled && dtPickup && If >= dtPickup && r.dtDelay <= tripTime(If, iset, r.tms, curve);

    if (isFinite(t) && t >= 0) {
      trEl.textContent = t.toFixed(3) + ' s  (' + ratio.toFixed(2) + 'x)' + (isDT ? ' DT' : '');
    } else {
      trEl.textContent = If <= iset ? 'No trip (' + ratio.toFixed(2) + 'x)' : '\u221e';
    }
  });
}

// ---- Results table update ----

export function updateTable(relays, tx, faultPct) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  const priFault100 = getPriFault100(tx);
  const secFault100 = getSecFault100(tx);
  const pcts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  // Only include enabled relays
  const active = relays.map((r, i) => ({ r, i })).filter(x => x.r.enabled);

  if (active.length === 0) {
    thead.innerHTML = '<tr><th>Fault %</th></tr>';
    tbody.innerHTML = '<tr><td style="color:var(--text-dim)">No relays enabled</td></tr>';
    return;
  }

  // Build header
  const headerCells = active.map(({ r, i }) => {
    const name = r.label || `R${i + 1}`;
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;
    return `<th style="color:${COLORS[i]}">${escapeHTML(name)} [${curve.short}]</th>`;
  }).join('');
  thead.innerHTML = `<tr><th>Fault %</th>${headerCells}</tr>`;

  // Build rows
  tbody.innerHTML = pcts.map(pct => {
    const priFault = priFault100 * (pct / 100);
    const secFault = secFault100 * (pct / 100);
    const isCurrent = pct === faultPct;

    const cells = active.map(({ r, i }) => {
      const iset = getIset(r);
      if (iset <= 0) return `<td style="color:var(--text-dim)">\u2014</td>`;
      const If = r.side === 'pri' ? priFault : secFault;
      const curve = CURVES[r.curveType] || CURVES.IEC_SI;
      const t = effectiveTripTime(If, r, curve);
      let display;
      if (isFinite(t) && t >= 0) {
        display = `${t.toFixed(3)}s @ ${If.toFixed(0)}A`;
      } else if (If <= iset) {
        display = `No trip @ ${If.toFixed(0)}A`;
      } else {
        display = '\u221e';
      }
      return `<td style="color:${COLORS[i]};${isCurrent ? 'font-weight:700;' : ''}font-size:0.6rem;">${display}</td>`;
    }).join('');

    return `<tr style="${isCurrent ? 'background:rgba(139,92,246,0.1)' : ''}">
      <td style="white-space:nowrap;${isCurrent ? 'color:#c4b5fd;font-weight:700' : ''}">${pct}%${isCurrent ? ' \u25c0' : ''}</td>${cells}</tr>`;
  }).join('');
}

// ---- CTI summary display ----

export function updateCTISummary(ctiPairs, relays) {
  const el = document.getElementById('ctiSummary');
  if (!ctiPairs || !ctiPairs.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = ctiPairs.map(p => {
    const priName = escapeHTML(relays[p.primaryIdx].label || `R${p.primaryIdx + 1}`);
    const bkpName = escapeHTML(relays[p.backupIdx].label || `R${p.backupIdx + 1}`);
    const cls = `cti-${p.status}`;
    return `<span class="cti-pair">${priName} \u2192 ${bkpName}: <span class="cti-badge ${cls}">${p.cti.toFixed(2)}s</span></span>`;
  }).join('');
}
