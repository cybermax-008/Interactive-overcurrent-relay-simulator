import { COLORS, CURVES, escapeHTML, OVERLAY_STYLES, CABLE_K, MCB_TYPES, MCB_THERMAL_K, TX_INRUSH_PEAK, TX_INRUSH_TAU } from './constants.js';
import { getIset, effectiveTripTime, calcFaultCurrent } from './math.js';

export function setupTooltip(canvas, tooltip, getState) {
  function onMouseMove(e) {
    const p = canvas._cp;
    if (!p) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const rx = (mx - p.pad.left) / p.cw;
    if (rx < 0 || rx > 1 || my < p.pad.top || my > p.pad.top + p.ch) {
      tooltip.style.display = 'none';
      return;
    }

    const { relays } = getState();
    const hI = Math.pow(10, Math.log10(p.xMin) + rx * (Math.log10(p.xMax) - Math.log10(p.xMin)));
    let lines = [`<b style="color:var(--accent)">I<sub>fault</sub> = ${Math.round(hI).toLocaleString()} A</b>`];
    relays.forEach((r, i) => {
      if (!r.enabled) return;
      const iset = getIset(r);
      if (iset <= 0) return;
      const curve = CURVES[r.curveType] || CURVES.IEC_SI;
      const t = effectiveTripTime(hI, r, curve);
      const ratio = hI / iset;
      const name = escapeHTML(r.label || `R${i + 1}`);
      if (isFinite(t) && t >= 0) {
        const dtTag = r.dtEnabled && hI >= r.ctPri * r.dtPickupMul ? ' DT' : '';
        lines.push(`<span style="color:${COLORS[i]}">${name}: ${t.toFixed(3)}s (${ratio.toFixed(1)}x)${dtTag}</span>`);
      } else if (hI <= iset) {
        lines.push(`<span style="color:${COLORS[i]}">${name}: Below pickup</span>`);
      }
    });
    // Overlay values
    const overlays = p.overlays;
    if (overlays) {
      if (overlays.cable?.enabled) {
        const k = CABLE_K[overlays.cable.material] || 115;
        const t = Math.pow((k * overlays.cable.size) / hI, 2);
        if (isFinite(t) && t > 0 && t < 1e6) lines.push(`<span style="color:${OVERLAY_STYLES.cable.color}">Cable: ${t.toFixed(3)}s</span>`);
      }
      if (overlays.txInrush?.enabled) {
        const { relays: _r, tx } = getState();
        const flc = (tx.mva * 1000) / (tx.secKV * Math.sqrt(3));
        const ratio = (hI / flc - 1) / (TX_INRUSH_PEAK - 1);
        if (ratio > 0 && ratio < 1) {
          const t = -TX_INRUSH_TAU * Math.log(ratio);
          if (t > 0) lines.push(`<span style="color:${OVERLAY_STYLES.txInrush.color}">Inrush: ${t.toFixed(3)}s</span>`);
        }
      }
      if (overlays.txWithstand?.enabled) {
        const { relays: _r, tx } = getState();
        const Imax = calcFaultCurrent(tx.mva, tx.secKV, tx.zPct);
        if (hI <= Imax && hI > 0) {
          const tBase = overlays.txWithstand.category === 'frequent' ? 1 : 2;
          const t = tBase * Math.pow(Imax / hI, 2);
          if (isFinite(t) && t > 0 && t < 1e6) lines.push(`<span style="color:${OVERLAY_STYLES.txWithstand.color}">Withstand: ${t.toFixed(3)}s</span>`);
        }
      }
      if (overlays.mcb?.enabled) {
        const mcb = MCB_TYPES[overlays.mcb.type];
        const In = overlays.mcb.rating;
        const mul = hI / In;
        if (mul >= mcb.magMax) {
          lines.push(`<span style="color:${OVERLAY_STYLES.mcb.color}">MCB: Instant</span>`);
        } else if (mul >= mcb.magMin) {
          lines.push(`<span style="color:${OVERLAY_STYLES.mcb.color}">MCB: \u22640.1s</span>`);
        } else if (mul > 1.13) {
          const t = MCB_THERMAL_K / (mul * mul);
          lines.push(`<span style="color:${OVERLAY_STYLES.mcb.color}">MCB: ${t.toFixed(1)}s</span>`);
        }
      }
    }

    tooltip.innerHTML = lines.join('<br>');
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(mx + 15, rect.width - 260) + 'px';
    tooltip.style.top = Math.max(0, Math.min(my - 10, rect.height - tooltip.offsetHeight)) + 'px';
  }

  function onMouseLeave() {
    tooltip.style.display = 'none';
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }

  function onTouchEnd() {
    tooltip.style.display = 'none';
  }

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  // Return cleanup function
  return () => {
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
  };
}
