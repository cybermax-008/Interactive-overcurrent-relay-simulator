import { COLORS, CURVES, escapeHTML } from './constants.js';
import { getIset, getRelayFault, tripTime, getPriFault100, getSecFault100, getPriFault, getSecFault } from './math.js';

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

export function buildCards(container, relays, onRefresh, onDebouncedRefresh) {
  container.innerHTML = relays.map((r, i) => `
    <div class="relay-card ${r.enabled ? '' : 'disabled'}" data-idx="${i}" id="rc${i}" style="margin-bottom:8px;">
      <div class="card-header">
        <span class="title">R${i + 1}</span>
        <input type="text" class="label-input" data-relay="${i}" data-param="label" value="${escapeHTML(r.label)}" placeholder="Label..." maxlength="30">
        <span class="print-label" id="printLabel${i}" style="display:none;font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:600;">${escapeHTML(r.label)}</span>
        <div class="toggle-wrap">
          <span>ON</span>
          <label class="toggle">
            <input type="checkbox" ${r.enabled ? 'checked' : ''} data-relay="${i}" aria-label="Enable relay ${i + 1}">
            <span class="sl"></span>
          </label>
        </div>
      </div>
      <div class="print-params" id="printParams${i}" style="display:none;font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:#666;margin-bottom:4px;">
        CT Primary: ${r.ctPri} A &nbsp;|&nbsp; Pickup Mul: ${r.pickupMul.toFixed(2)} &nbsp;|&nbsp; TMS: ${r.tms.toFixed(2)}
      </div>
      <div class="card-fields">
        <div class="field" style="grid-column:1/-1;">
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
      <div class="calc-row" id="calcRow${i}"></div>
      <div class="card-result">
        <span>Trip Time:</span>
        <span class="tv" id="tr${i}">\u2014</span>
      </div>
    </div>
  `).join('');

  // Wire toggle events
  container.querySelectorAll('.toggle input').forEach(t => {
    t.addEventListener('change', e => {
      relays[parseInt(e.target.dataset.relay)].enabled = e.target.checked;
      onRefresh();
    });
  });

  // Wire curve type select events
  container.querySelectorAll('.curve-select').forEach(sel => {
    sel.addEventListener('change', e => {
      relays[parseInt(e.target.dataset.relay)].curveType = e.target.value;
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
      onDebouncedRefresh();
    });
  });
}

// ---- Legend builder ----

export function buildLegend(relays) {
  document.getElementById('legend').innerHTML = relays.map((r, i) => {
    const name = r.label || `R${i + 1}`;
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;
    return `<span class="leg-item" style="opacity:${r.enabled ? 1 : 0.3}">
      <span class="leg-dot" style="background:${COLORS[i]}"></span>
      ${escapeHTML(name)} [${curve.short}]
    </span>`;
  }).join('');
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

    calcRow.innerHTML = `
      <span>I<sub>set</sub> = ${r.ctPri} \u00d7 ${r.pickupMul.toFixed(2)} = <span class="computed">${iset.toFixed(1)} A</span></span>
      <span>I<sub>fault</sub> (${r.side === 'pri' ? 'Pri' : 'Sec'}) = <span class="computed">${If.toFixed(1)} A</span></span>
    `;

    // Keep print-only params in sync
    const pp = document.getElementById('printParams' + i);
    if (pp) pp.innerHTML = `CT Primary: ${r.ctPri} A &nbsp;|&nbsp; Pickup Mul: ${r.pickupMul.toFixed(2)} &nbsp;|&nbsp; TMS: ${r.tms.toFixed(2)} &nbsp;|&nbsp; Curve: ${curve.short}`;

    if (!r.enabled) { trEl.textContent = 'OFF'; return; }
    if (iset <= 0) { trEl.textContent = 'No pickup'; return; }

    const t = tripTime(If, iset, r.tms, curve);
    const ratio = If / iset;

    if (isFinite(t) && t > 0) {
      trEl.textContent = t.toFixed(3) + ' s  (' + ratio.toFixed(2) + 'x)';
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
      const t = tripTime(If, iset, r.tms, curve);
      let display;
      if (isFinite(t) && t > 0) {
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
