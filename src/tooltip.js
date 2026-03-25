import { COLORS, escapeHTML } from './constants.js';
import { getIset, tripTime } from './math.js';

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
      const t = tripTime(hI, iset, r.tms);
      const ratio = hI / iset;
      const name = escapeHTML(r.label || `R${i + 1}`);
      if (isFinite(t) && t > 0) {
        lines.push(`<span style="color:${COLORS[i]}">${name}: ${t.toFixed(3)}s (${ratio.toFixed(1)}x)</span>`);
      } else if (hI <= iset) {
        lines.push(`<span style="color:${COLORS[i]}">${name}: Below pickup</span>`);
      }
    });
    tooltip.innerHTML = lines.join('<br>');
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(mx + 15, rect.width - 260) + 'px';
    tooltip.style.top = (my - 10) + 'px';
  }

  function onMouseLeave() {
    tooltip.style.display = 'none';
  }

  function onTouchMove(e) {
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
  canvas.addEventListener('touchmove', onTouchMove);
  canvas.addEventListener('touchend', onTouchEnd);

  // Return cleanup function
  return () => {
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
  };
}
