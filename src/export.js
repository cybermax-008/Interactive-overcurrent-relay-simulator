import { escapeHTML, CURVES, BW_DASH_NAMES, EXPORT_CHART_W, EXPORT_CHART_H, CABLE_K_LABELS } from './constants.js';
import { getIset, getRelayFault, tripTime, getPriFault100, getSecFault100, getPriFault, getSecFault, getDTPickup, effectiveTripTime } from './math.js';
import { renderBWChart } from './chart.js';

export function exportPDF(tx, faultPct, relays, ctiPairs, reportSettings, overlays) {
  const now = new Date();
  const rs = reportSettings || {};
  const active = relays.map((r, i) => ({ r, i })).filter(x => x.r.enabled);
  const priFault100 = getPriFault100(tx);
  const secFault100 = getSecFault100(tx);
  const priFault = getPriFault(tx, faultPct);
  const secFault = getSecFault(tx, faultPct);
  const pcts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const remarks = document.getElementById('remarksField').value.trim();

  // Render B&W chart on a high-res offscreen canvas
  const chartImg = renderBWChart(EXPORT_CHART_W, EXPORT_CHART_H, relays, tx, faultPct, ctiPairs, overlays);

  // Relay settings rows
  const settingsRows = active.map(({ r, i }) => {
    const iset = getIset(r);
    const If = getRelayFault(r, tx, faultPct);
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;
    const t = effectiveTripTime(If, r, curve);
    const tStr = isFinite(t) && t >= 0 ? t.toFixed(3) + ' s' : 'No trip';
    const ratio = iset > 0 ? (If / iset).toFixed(2) + 'x' : '\u2014';
    const dtInfo = r.dtEnabled ? getDTPickup(r).toFixed(0) + 'A @ ' + r.dtDelay.toFixed(2) + 's' : '\u2014';
    return `<tr>
      <td style="font-weight:700">${escapeHTML(r.label || 'R' + (i+1))}</td>
      <td>${BW_DASH_NAMES[i] || 'Solid'}</td>
      <td>${curve.label}</td>
      <td>${r.side === 'pri' ? 'Primary' : 'Secondary'}</td>
      <td>${r.ctPri}</td>
      <td>${r.pickupMul.toFixed(2)}</td>
      <td>${iset.toFixed(1)}</td>
      <td>${r.tms.toFixed(2)}</td>
      <td>${dtInfo}</td>
      <td>${If.toFixed(1)}</td>
      <td>${tStr}</td>
      <td>${ratio}</td>
    </tr>`;
  }).join('');

  // Fault % table rows
  const faultRows = pcts.map(pct => {
    const priF = priFault100 * (pct / 100);
    const secF = secFault100 * (pct / 100);
    const isCurrent = pct === faultPct;
    const cells = active.map(({ r, i }) => {
      const iset = getIset(r);
      const If = r.side === 'pri' ? priF : secF;
      const curve = CURVES[r.curveType] || CURVES.IEC_SI;
      const t = effectiveTripTime(If, r, curve);
      let val;
      if (isFinite(t) && t >= 0) val = t.toFixed(3) + 's @ ' + If.toFixed(0) + 'A';
      else if (If <= iset) val = 'No trip @ ' + If.toFixed(0) + 'A';
      else val = '\u221e';
      return `<td>${val}</td>`;
    }).join('');
    return `<tr style="${isCurrent ? 'font-weight:700;background:#eee;' : ''}">
      <td>${pct}%${isCurrent ? ' \u25c0' : ''}</td>${cells}</tr>`;
  }).join('');

  const faultThCells = active.map(({ r, i }) => {
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;
    return `<th>${escapeHTML(r.label || 'R' + (i+1))} [${curve.short}]</th>`;
  }).join('');

  const printWin = window.open('', '_blank');
  printWin.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Inverse Time Overcurrent Relay \u2014 Multi-Curve</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; font-size: 10px; line-height: 1.4; padding: 16px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  .sub { color: #555; font-size: 9px; margin-bottom: 10px; }
  h2 { font-size: 11px; margin: 10px 0 4px; border-bottom: 1.5px solid #333; padding-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .params { font-size: 10px; margin-bottom: 3px; }
  table { border-collapse: collapse; width: 100%; font-size: 9px; margin-bottom: 8px; }
  th, td { border: 1px solid #aaa; padding: 4px 7px; text-align: left; }
  th { background: #f0f0f0; font-weight: 700; }
  .chart-img { width: 100%; margin: 6px 0; }
  .formula { font-size: 8px; color: #666; text-align: right; margin-top: 6px; }
  .remarks { font-size: 10px; line-height: 1.5; padding: 6px 0; border-left: 3px solid #999; padding-left: 10px; margin: 4px 0; color: #333; white-space: pre-wrap; }
  .report-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  .report-header .company { font-size: 14px; font-weight: 700; }
  .report-header .refs { font-size: 9px; color: #555; text-align: right; }
  .page-footer { margin-top: 10px; font-size: 8px; color: #888; text-align: center; border-top: 1px solid #ccc; padding-top: 4px; }
  @media print {
    body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  ${rs && (rs.companyName || rs.projectRef) ? `<div class="report-header">
    <span class="company">${escapeHTML(rs.companyName || '')}</span>
    <span class="refs">${[rs.projectRef && 'Project: ' + escapeHTML(rs.projectRef), rs.docRef && 'Doc: ' + escapeHTML(rs.docRef), rs.revision && 'Rev: ' + escapeHTML(rs.revision)].filter(Boolean).join(' &nbsp;|&nbsp; ')}</span>
  </div>` : ''}
  <h1>\u26a1 Inverse Time Overcurrent Relay \u2014 Multi-Curve</h1>
  <div class="sub">IEC 60255 / IEEE C37.112 IDMT Curves &nbsp;|&nbsp; Created: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</div>

  <h2>Transformer Parameters</h2>
  <div class="params">
    MVA: <b>${tx.mva}</b> &nbsp;|&nbsp;
    Primary: <b>${tx.priKV} kV</b> &nbsp;|&nbsp;
    Secondary: <b>${tx.secKV} kV</b> &nbsp;|&nbsp;
    Z: <b>${tx.zPct}%</b> &nbsp;|&nbsp;
    Fault Level: <b>${faultPct}%</b>
  </div>
  <div class="params">
    Primary I<sub>fault</sub>: <b>${priFault.toFixed(1)} A</b> (100%: ${priFault100.toFixed(1)} A) &nbsp;|&nbsp;
    Secondary I<sub>fault</sub>: <b>${secFault.toFixed(1)} A</b> (100%: ${secFault100.toFixed(1)} A)
  </div>

  <h2>Relay Settings</h2>
  <table>
    <thead><tr>
      <th>Relay</th><th>Line Style</th><th>Curve Type</th><th>Side</th><th>CT Pri (A)</th><th>Pickup Mul</th>
      <th>I<sub>set</sub> (A)</th><th>TMS</th><th>High-Set DT</th><th>I<sub>fault</sub> (A)</th><th>Trip Time</th><th>Multiple</th>
    </tr></thead>
    <tbody>${settingsRows}</tbody>
  </table>

  <h2>Trip Time Curves</h2>
  <img class="chart-img" src="${chartImg}" />

  <h2>Trip Time by Fault Level</h2>
  <table>
    <thead><tr><th>Fault %</th>${faultThCells}</tr></thead>
    <tbody>${faultRows}</tbody>
  </table>

  ${ctiPairs && ctiPairs.length ? `<h2>Coordination Margins (CTI)</h2>
  <table>
    <thead><tr><th>Primary Relay</th><th>Backup Relay</th><th>Side</th><th>Primary Trip</th><th>Backup Trip</th><th>CTI</th><th>Status</th></tr></thead>
    <tbody>${ctiPairs.map(p => {
      const priName = escapeHTML(relays[p.primaryIdx].label || 'R' + (p.primaryIdx + 1));
      const bkpName = escapeHTML(relays[p.backupIdx].label || 'R' + (p.backupIdx + 1));
      const statusLabel = p.status === 'good' ? 'OK' : p.status === 'warning' ? 'MARGINAL' : 'FAIL';
      return `<tr><td>${priName}</td><td>${bkpName}</td><td>${p.side === 'pri' ? 'Primary' : 'Secondary'}</td><td>${p.primaryTime.toFixed(3)}s</td><td>${p.backupTime.toFixed(3)}s</td><td style="font-weight:700">${p.cti.toFixed(3)}s</td><td style="font-weight:700;${p.status === 'danger' ? 'color:red' : ''}">${statusLabel}</td></tr>`;
    }).join('')}</tbody>
  </table>` : ''}

  ${(() => {
    const rows = [];
    if (overlays?.cable?.enabled) rows.push(`<tr><td>Cable Damage</td><td>${CABLE_K_LABELS[overlays.cable.material] || overlays.cable.material}</td><td>${overlays.cable.size} mm\u00b2</td><td>t = (kS/I)\u00b2</td></tr>`);
    if (overlays?.txInrush?.enabled) rows.push(`<tr><td>TX Inrush</td><td colspan="2">12\u00d7 FLC, \u03c4=0.2s</td><td>Decaying envelope</td></tr>`);
    if (overlays?.txWithstand?.enabled) rows.push(`<tr><td>TX Withstand</td><td colspan="2">${overlays.txWithstand.category} (t<sub>base</sub>=${overlays.txWithstand.category === 'frequent' ? '1' : '2'}s)</td><td>t = t<sub>base</sub> \u00d7 (I<sub>max</sub>/I)\u00b2</td></tr>`);
    if (overlays?.mcb?.enabled) rows.push(`<tr><td>MCB</td><td>Type ${overlays.mcb.type}</td><td>${overlays.mcb.rating}A</td><td>Thermal + Magnetic</td></tr>`);
    return rows.length ? `<h2>Overlay Curves</h2><table><thead><tr><th>Type</th><th>Parameters</th><th>Rating</th><th>Formula</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '';
  })()}

  ${remarks ? `<h2>Remarks</h2><div class="remarks">${escapeHTML(remarks).replace(/\n/g, '<br>')}</div>` : ''}

  <div class="formula">t = (k / ((I<sub>fault</sub> / I<sub>set</sub>)<sup>\u03b1</sup> \u2212 1) + \u03b2) \u00d7 TMS &nbsp;|\u00a0IEC: \u03b2=0 &nbsp;|\u00a0IEEE: \u03b2>0</div>
  <div class="page-footer">IDMT Relay Simulator &nbsp;|&nbsp; ${now.toLocaleDateString()} &nbsp;|&nbsp; Page 1 of 1</div>

  <script>setTimeout(() => { window.print(); }, 400);<\/script>
</body>
</html>`);
  printWin.document.close();
}

// ---- CSV Export ----

export function exportCSV(tx, faultPct, relays) {
  const active = relays.map((r, i) => ({ r, i })).filter(x => x.r.enabled);
  const priFault100 = getPriFault100(tx);
  const secFault100 = getSecFault100(tx);
  const pcts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  // Header
  const headers = ['Fault %', 'Pri Fault (A)', 'Sec Fault (A)'];
  active.forEach(({ r, i }) => {
    const name = r.label || `R${i + 1}`;
    headers.push(`${name} Trip (s)`, `${name} Fault (A)`);
  });

  const rows = [headers.join(',')];

  pcts.forEach(pct => {
    const priF = priFault100 * (pct / 100);
    const secF = secFault100 * (pct / 100);
    const cols = [pct, priF.toFixed(1), secF.toFixed(1)];

    active.forEach(({ r }) => {
      const iset = getIset(r);
      const If = r.side === 'pri' ? priF : secF;
      const curve = CURVES[r.curveType] || CURVES.IEC_SI;
      const t = effectiveTripTime(If, r, curve);
      cols.push(isFinite(t) && t >= 0 ? t.toFixed(3) : 'N/A');
      cols.push(If.toFixed(1));
    });

    rows.push(cols.join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relay_coordination_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
