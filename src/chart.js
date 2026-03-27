import {
  COLORS, CURVES, BW_DASH,
  CURVE_SAMPLE_STEP, CURVE_START_FACTOR,
  LOG_PAD_X, LOG_PAD_Y,
  DEFAULT_X_RANGE, DEFAULT_Y_RANGE,
  MAX_SAMPLE_MUL, SAMPLE_MUL_STEP,
} from './constants.js';
import { getIset, getRelayFault, tripTime, getPriFault, getSecFault, getDTPickup, effectiveTripTime } from './math.js';

// ---- Theme definitions ----

export const SCREEN_THEME = {
  mode: 'screen',
  bg: null,       // transparent (CSS handles it)
  gridColor: 'rgba(148,163,184,0.07)',
  borderColor: 'rgba(148,163,184,0.15)',
  axisLabelColor: '#64748b',
  axisTitleColor: '#94a3b8',
  axisLabelFont: '10px JetBrains Mono',
  axisTitleFont: '11px DM Sans',
  curveWidth: 2.5,
  curveShadow: true,
  curveColor: null,    // uses COLORS[i] per relay
  dashPatterns: null,   // no dashes (solid colored)
  faultLineColors: { pri: '#c4b5fd', sec: '#f9a8d4' },
  labelFont: 'bold 10px JetBrains Mono',
  opPointRadius: [8, 3.5],
  timeLabelFont: 'bold 10px JetBrains Mono',
  pad: { top: 28, right: 40, bottom: 52, left: 68 },
};

export const PRINT_THEME = {
  mode: 'print',
  bg: '#fff',
  gridColor: '#ddd',
  borderColor: '#666',
  axisLabelColor: '#333',
  axisTitleColor: '#000',
  axisLabelFont: '24px sans-serif',
  axisTitleFont: '26px sans-serif',
  curveWidth: 4,
  curveShadow: false,
  curveColor: '#000',  // single color for all curves in B&W mode
  dashPatterns: BW_DASH,
  faultLineColors: { pri: '#888', sec: '#888' },
  labelFont: 'bold 24px sans-serif',
  opPointRadius: [9, 4.5],
  timeLabelFont: 'bold 22px sans-serif',
  pad: { top: 50, right: 80, bottom: 80, left: 100 },
};

// ---- Shared axis-range computation ----

export function computeAxisRanges(relays, tx, faultPct) {
  let dataXMin = Infinity, dataXMax = 0, dataYMin = Infinity, dataYMax = 0;

  relays.forEach((r, i) => {
    if (!r.enabled) return;
    const iset = getIset(r);
    if (iset <= 0) return;
    const If = getRelayFault(r, tx, faultPct);
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;

    // Curve starts just above iset
    if (iset * CURVE_START_FACTOR < dataXMin) dataXMin = iset * CURVE_START_FACTOR;

    // Check operating point
    if (If > 0) {
      if (If > dataXMax) dataXMax = If;
      const t = effectiveTripTime(If, r, curve);
      if (isFinite(t) && t > 0) {
        if (t < dataYMin) dataYMin = t;
        if (t > dataYMax) dataYMax = t;
      }
    }

    // DT element: include DT pickup in X range and delay in Y range
    if (r.dtEnabled) {
      const dtPickup = getDTPickup(r);
      if (dtPickup > dataXMax) dataXMax = dtPickup;
      const dtDelay = r.dtDelay;
      if (dtDelay > 0 && dtDelay < dataYMin) dataYMin = dtDelay;
      if (dtDelay > 0 && dtDelay > dataYMax) dataYMax = dtDelay;
    }

    // Sample some points along the curve for Y range
    for (let m = SAMPLE_MUL_STEP; m <= MAX_SAMPLE_MUL; m *= SAMPLE_MUL_STEP) {
      const I = iset * m;
      if (I > dataXMax) dataXMax = I;
      const t = tripTime(I, iset, r.tms, curve);
      if (isFinite(t) && t > 0) {
        if (t < dataYMin) dataYMin = t;
        if (t > dataYMax) dataYMax = t;
      }
    }
  });

  // Fallback defaults if no active curves
  if (!isFinite(dataXMin) || dataXMin <= 0) dataXMin = DEFAULT_X_RANGE[0];
  if (!isFinite(dataXMax) || dataXMax <= 0) dataXMax = DEFAULT_X_RANGE[1];
  if (!isFinite(dataYMin) || dataYMin <= 0) dataYMin = DEFAULT_Y_RANGE[0];
  if (!isFinite(dataYMax) || dataYMax <= 0) dataYMax = DEFAULT_Y_RANGE[1];

  // Add padding (in log space) so curves don't touch edges
  const xMin = Math.pow(10, Math.log10(dataXMin) - LOG_PAD_X);
  const xMax = Math.pow(10, Math.log10(dataXMax) + LOG_PAD_X);
  const yMin = Math.pow(10, Math.log10(dataYMin) - LOG_PAD_Y);
  const yMax = Math.pow(10, Math.log10(dataYMax) + LOG_PAD_Y);

  return { xMin, xMax, yMin, yMax };
}

// ---- Shared tick generation ----

export function logTicks(min, max) {
  const ticks = [];
  const steps = [1, 2, 5];
  const startExp = Math.floor(Math.log10(min));
  const endExp = Math.ceil(Math.log10(max));
  for (let exp = startExp; exp <= endExp; exp++) {
    for (const s of steps) {
      const val = s * Math.pow(10, exp);
      if (val >= min * 0.9 && val <= max * 1.1) ticks.push(val);
    }
  }
  return ticks;
}

// ---- Unified chart renderer ----

const CTI_COLORS = { good: '#10b981', warning: '#f59e0b', danger: '#ef4444' };

export function renderChart(canvas, { relays, tx, faultPct, theme, ctiPairs }) {
  const isScreen = theme.mode === 'screen';
  const pad = theme.pad;
  let W, H, c;

  if (isScreen) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    W = rect.width;
    H = rect.height;
  } else {
    // Print mode: canvas size is passed as canvas.width / canvas.height (already set by caller)
    W = canvas.width;
    H = canvas.height;
    c = canvas.getContext('2d');
  }

  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  // Clear / fill background
  if (theme.bg) {
    c.fillStyle = theme.bg;
    c.fillRect(0, 0, W, H);
  } else {
    c.clearRect(0, 0, W, H);
  }

  // Compute axis ranges
  const { xMin, xMax, yMin, yMax } = computeAxisRanges(relays, tx, faultPct);

  // Mapping functions
  const lx = v => Math.log10(v);
  const mapX = v => pad.left + ((lx(v) - lx(xMin)) / (lx(xMax) - lx(xMin))) * cw;
  const mapY = v => pad.top + ch - ((lx(v) - lx(yMin)) / (lx(yMax) - lx(yMin))) * ch;

  // Ticks
  const xTicks = logTicks(xMin, xMax);
  const yTicks = logTicks(yMin, yMax);

  // Grid
  c.strokeStyle = theme.gridColor;
  c.lineWidth = isScreen ? 1 : 1.5;
  xTicks.forEach(v => { c.beginPath(); c.moveTo(mapX(v), pad.top); c.lineTo(mapX(v), pad.top + ch); c.stroke(); });
  yTicks.forEach(v => { c.beginPath(); c.moveTo(pad.left, mapY(v)); c.lineTo(pad.left + cw, mapY(v)); c.stroke(); });

  // Border
  c.strokeStyle = theme.borderColor;
  c.lineWidth = isScreen ? 1 : 2.5;
  c.strokeRect(pad.left, pad.top, cw, ch);

  // Axis labels - X
  c.fillStyle = theme.axisLabelColor;
  c.font = theme.axisLabelFont;
  c.textAlign = 'center';
  xTicks.forEach(v => {
    let label;
    if (v >= 1000) label = (v / 1000) + 'k';
    else if (v >= 1) label = v.toFixed(0);
    else label = v.toString();
    c.fillText(label, mapX(v), pad.top + ch + (isScreen ? 18 : 35));
  });

  // Axis labels - Y
  c.textAlign = 'right';
  yTicks.forEach(v => {
    let label;
    if (v >= 100) label = v.toFixed(0);
    else if (v >= 1) label = v.toFixed(0);
    else if (v >= 0.1) label = v.toFixed(1);
    else label = v.toFixed(2);
    c.fillText(label, pad.left - (isScreen ? 8 : 14), mapY(v) + (isScreen ? 4 : 8));
  });

  // Axis titles
  c.fillStyle = theme.axisTitleColor;
  c.font = theme.axisTitleFont;
  c.textAlign = 'center';
  c.fillText('Fault Current — I_fault (A)', pad.left + cw / 2, H - (isScreen ? 6 : 16));
  c.save();
  c.translate(isScreen ? 14 : 28, pad.top + ch / 2);
  c.rotate(-Math.PI / 2);
  c.fillText('Trip Time (seconds)', 0, 0);
  c.restore();

  // Draw curves
  relays.forEach((r, i) => {
    if (!r.enabled) return;
    const iset = getIset(r);
    if (iset <= 0) return;
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;

    const curveColor = theme.curveColor || COLORS[i];
    c.strokeStyle = curveColor;
    c.lineWidth = theme.curveWidth;

    if (theme.dashPatterns) {
      c.setLineDash(theme.dashPatterns[i] || []);
    }

    if (theme.curveShadow) {
      c.shadowColor = COLORS[i] + '40';
      c.shadowBlur = 6;
    }

    c.beginPath();
    let first = true;
    for (let I = iset * CURVE_START_FACTOR; I <= xMax; I *= CURVE_SAMPLE_STEP) {
      const t = tripTime(I, iset, r.tms, curve);
      if (!isFinite(t) || t <= 0 || t < yMin || t > yMax || I < xMin) continue;
      const x = mapX(I), y = mapY(t);
      if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y);
    }
    c.stroke();

    if (theme.curveShadow) {
      c.shadowBlur = 0;
    }
    if (theme.dashPatterns) {
      c.setLineDash([]);
    }

    // Curve label — relay label + curve abbreviation, position at 80% of visible x range
    const labelLogX = Math.log10(xMin) + 0.8 * (Math.log10(xMax) - Math.log10(xMin));
    const li = Math.pow(10, labelLogX);
    const lt = tripTime(li, iset, r.tms, curve);
    if (isFinite(lt) && lt >= yMin && lt <= yMax) {
      c.fillStyle = curveColor;
      c.font = theme.labelFont;
      c.textAlign = 'left';
      const label = r.label || `R${i + 1}`;
      const shortLabel = (label.length > 13 ? label.slice(0, 12) + '\u2026' : label) + ' [' + curve.short + ']';
      c.fillText(shortLabel, mapX(li) + (isScreen ? 5 : 10), mapY(lt) - (isScreen ? 8 : 14));
    }
  });

  // DT horizontal lines
  relays.forEach((r, i) => {
    if (!r.enabled || !r.dtEnabled) return;
    const dtPickup = getDTPickup(r);
    const dtDelay = r.dtDelay;
    if (dtPickup <= 0 || dtPickup > xMax) return;

    const curveColor = theme.curveColor || COLORS[i];
    c.strokeStyle = curveColor;
    c.lineWidth = theme.curveWidth * 0.8;
    c.setLineDash(isScreen ? [4, 4] : [8, 8]);

    // Vertical drop from IDMT curve to DT delay at DT pickup current
    const iset = getIset(r);
    const curve = CURVES[r.curveType] || CURVES.IEC_SI;
    const idmtAtDT = tripTime(dtPickup, iset, r.tms, curve);
    const dtX = Math.max(mapX(dtPickup), pad.left);

    // Horizontal line from DT pickup to right edge at dtDelay
    if (dtDelay > 0 && dtDelay >= yMin && dtDelay <= yMax) {
      const dtY = mapY(dtDelay);
      c.beginPath();
      c.moveTo(dtX, dtY);
      c.lineTo(pad.left + cw, dtY);
      c.stroke();

      // Vertical connector from IDMT curve down to DT line
      if (isFinite(idmtAtDT) && idmtAtDT > 0 && idmtAtDT >= yMin && idmtAtDT <= yMax) {
        c.beginPath();
        c.moveTo(dtX, mapY(idmtAtDT));
        c.lineTo(dtX, dtY);
        c.stroke();
      }

      // DT label
      c.fillStyle = curveColor;
      c.font = isScreen ? '8px JetBrains Mono' : '18px sans-serif';
      c.textAlign = 'right';
      c.fillText(`DT ${dtDelay.toFixed(2)}s`, pad.left + cw - (isScreen ? 4 : 8), dtY - (isScreen ? 4 : 8));
    } else if (dtDelay === 0) {
      // Instantaneous: draw at yMin (bottom of log scale)
      const dtY = mapY(yMin);
      c.beginPath();
      c.moveTo(dtX, dtY);
      c.lineTo(pad.left + cw, dtY);
      c.stroke();

      // Vertical connector
      if (isFinite(idmtAtDT) && idmtAtDT > 0 && idmtAtDT >= yMin && idmtAtDT <= yMax) {
        c.beginPath();
        c.moveTo(dtX, mapY(idmtAtDT));
        c.lineTo(dtX, dtY);
        c.stroke();
      }

      c.fillStyle = curveColor;
      c.font = isScreen ? '8px JetBrains Mono' : '18px sans-serif';
      c.textAlign = 'right';
      c.fillText('DT Inst.', pad.left + cw - (isScreen ? 4 : 8), dtY - (isScreen ? 4 : 8));
    }

    c.setLineDash([]);
  });

  // Fault current vertical lines
  const priFault = getPriFault(tx, faultPct);
  const secFault = getSecFault(tx, faultPct);

  const faultLines = [];
  if (priFault > xMin && priFault <= xMax) {
    const priRelays = relays.map((r, i) => r.enabled && r.side === 'pri' ? i : -1).filter(x => x >= 0);
    if (priRelays.length) faultLines.push({ val: priFault, label: 'PRI', color: theme.faultLineColors.pri, relays: priRelays });
  }
  if (secFault > xMin && secFault <= xMax) {
    const secRelays = relays.map((r, i) => r.enabled && r.side === 'sec' ? i : -1).filter(x => x >= 0);
    if (secRelays.length) faultLines.push({ val: secFault, label: 'SEC', color: theme.faultLineColors.sec, relays: secRelays });
  }

  faultLines.forEach(fl => {
    const fx = mapX(fl.val);

    if (isScreen) {
      c.strokeStyle = fl.color + '50';
      c.lineWidth = 1.5;
      c.setLineDash([6, 4]);
    } else {
      c.strokeStyle = fl.color;
      c.lineWidth = 2;
      c.setLineDash([10, 6]);
    }
    c.beginPath(); c.moveTo(fx, pad.top); c.lineTo(fx, pad.top + ch); c.stroke();
    c.setLineDash([]);

    if (isScreen) {
      c.fillStyle = fl.color;
      c.font = theme.timeLabelFont;
      c.textAlign = 'center';
      c.fillText(`${fl.label}: ${fl.val.toFixed(0)}A`, fx, pad.top - 8);
    } else {
      c.fillStyle = theme.axisLabelColor;
      c.font = theme.timeLabelFont;
      c.textAlign = 'center';
      c.fillText(`${fl.label}: ${fl.val.toFixed(0)}A`, fx, pad.top - 14);
    }

    fl.relays.forEach(ri => {
      const r = relays[ri];
      if (!r.enabled) return;
      const iset = getIset(r);
      if (iset <= 0) return;
      const curve = CURVES[r.curveType] || CURVES.IEC_SI;
      const t = effectiveTripTime(fl.val, r, curve);
      if (!isFinite(t) || t < 0 || t < yMin || t > yMax) return;
      const py = mapY(t);

      if (isScreen) {
        // Dashed horizontal line to operating point
        c.strokeStyle = COLORS[ri] + '40';
        c.lineWidth = 1;
        c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(pad.left, py); c.lineTo(fx, py); c.stroke();
        c.setLineDash([]);

        // Outer ring
        c.beginPath(); c.arc(fx, py, theme.opPointRadius[0], 0, Math.PI * 2);
        c.fillStyle = COLORS[ri] + '30'; c.fill();
        c.strokeStyle = COLORS[ri]; c.lineWidth = 2; c.stroke();

        // Inner dot
        c.beginPath(); c.arc(fx, py, theme.opPointRadius[1], 0, Math.PI * 2);
        c.fillStyle = COLORS[ri]; c.fill();

        // Time label
        c.fillStyle = COLORS[ri];
        c.font = theme.timeLabelFont;
        c.textAlign = 'left';
        c.fillText(t.toFixed(2) + 's', fx + 14, py + 4);
      } else {
        // Print mode operating points
        c.strokeStyle = '#666';
        c.lineWidth = 1.5;
        c.setLineDash([5, 5]);
        c.beginPath(); c.moveTo(pad.left, py); c.lineTo(fx, py); c.stroke();
        c.setLineDash([]);

        // Filled black dot with white center
        c.fillStyle = '#000';
        c.beginPath(); c.arc(fx, py, theme.opPointRadius[0], 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(fx, py, theme.opPointRadius[1], 0, Math.PI * 2); c.fill();

        // Time label
        c.fillStyle = '#000';
        c.font = theme.timeLabelFont;
        c.textAlign = 'left';
        c.fillText(t.toFixed(2) + 's', fx + 18, py + 7);
      }
    });
  });

  // CTI brackets
  if (ctiPairs && ctiPairs.length) {
    const bracketOffset = isScreen ? 30 : 50;
    const tickW = isScreen ? 6 : 10;
    const fontSize = isScreen ? '9px JetBrains Mono' : '20px sans-serif';

    ctiPairs.forEach((pair, pi) => {
      const faultVal = pair.side === 'pri' ? priFault : secFault;
      if (faultVal <= xMin || faultVal > xMax) return;
      const y1 = mapY(pair.primaryTime);
      const y2 = mapY(pair.backupTime);
      if (y1 < pad.top || y2 < pad.top || y1 > pad.top + ch || y2 > pad.top + ch) return;

      const bx = mapX(faultVal) + bracketOffset + pi * (isScreen ? 18 : 30);
      if (bx > pad.left + cw) return;
      const color = isScreen ? CTI_COLORS[pair.status] : '#000';

      // Vertical line
      c.strokeStyle = color;
      c.lineWidth = isScreen ? 1.5 : 2.5;
      c.setLineDash([]);
      c.beginPath(); c.moveTo(bx, y1); c.lineTo(bx, y2); c.stroke();

      // Ticks
      c.beginPath(); c.moveTo(bx - tickW, y1); c.lineTo(bx, y1); c.stroke();
      c.beginPath(); c.moveTo(bx - tickW, y2); c.lineTo(bx, y2); c.stroke();

      // Label
      c.fillStyle = color;
      c.font = fontSize;
      c.textAlign = 'left';
      const label = pair.cti.toFixed(2) + 's';
      const midY = (y1 + y2) / 2;
      c.fillText(label, bx + (isScreen ? 3 : 6), midY + (isScreen ? 3 : 6));
    });
  }

  // Store coordinate system on canvas for tooltip use (screen mode only)
  if (isScreen) {
    canvas._cp = { pad, cw, ch, xMin, xMax, yMin, yMax, mapX, mapY };
  }

  // For print mode, return data URL
  if (!isScreen) {
    return canvas.toDataURL('image/png', 1.0);
  }
}

// ---- Convenience wrappers ----

export function drawChart(canvas, relays, tx, faultPct, ctiPairs) {
  renderChart(canvas, { relays, tx, faultPct, theme: SCREEN_THEME, ctiPairs });
}

export function renderBWChart(W, H, relays, tx, faultPct, ctiPairs) {
  const bwc = document.createElement('canvas');
  bwc.width = W;
  bwc.height = H;
  return renderChart(bwc, { relays, tx, faultPct, theme: PRINT_THEME, ctiPairs });
}
