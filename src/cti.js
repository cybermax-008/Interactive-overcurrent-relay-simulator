import { CURVES } from './constants.js';
import { getIset, getRelayFault, effectiveTripTime } from './math.js';

export const CTI_GOOD = 0.3;
export const CTI_WARNING = 0.2;

export function computeCTIPairs(relays, tx, faultPct) {
  const pairs = [];

  for (const side of ['pri', 'sec']) {
    // Get enabled relays on this side with valid trip times
    const entries = [];
    relays.forEach((r, i) => {
      if (!r.enabled || r.side !== side) return;
      const iset = getIset(r);
      if (iset <= 0) return;
      const If = getRelayFault(r, tx, faultPct);
      const curve = CURVES[r.curveType] || CURVES.IEC_SI;
      const t = effectiveTripTime(If, r, curve);
      if (!isFinite(t) || t < 0) return;
      entries.push({ idx: i, time: t, relay: r });
    });

    // Sort by trip time ascending (primary = fastest, backup = slower)
    entries.sort((a, b) => a.time - b.time);

    // Compute CTI between consecutive pairs
    for (let j = 0; j < entries.length - 1; j++) {
      const primary = entries[j];
      const backup = entries[j + 1];
      const cti = backup.time - primary.time;
      let status;
      if (cti >= CTI_GOOD) status = 'good';
      else if (cti >= CTI_WARNING) status = 'warning';
      else status = 'danger';

      pairs.push({
        primaryIdx: primary.idx,
        backupIdx: backup.idx,
        primaryTime: primary.time,
        backupTime: backup.time,
        cti,
        side,
        status,
      });
    }
  }

  return pairs;
}
