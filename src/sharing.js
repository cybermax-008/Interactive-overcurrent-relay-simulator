import { CURVES, DEFAULT_OVERLAYS } from './constants.js';

// Compact keys to keep URLs short
function compressState(state, remarks) {
  const data = {
    v: 2,
    t: state.tx,
    f: state.faultPct,
    r: state.relays.map(r => ({
      c: r.ctPri, p: r.pickupMul, m: r.tms,
      e: r.enabled ? 1 : 0, l: r.label,
      s: r.side, k: r.curveType,
      de: r.dtEnabled ? 1 : 0, dp: r.dtPickupMul, dd: r.dtDelay,
    })),
    n: remarks || '',
  };
  // Only include overlays if any enabled
  const ov = state.overlays;
  if (ov && (ov.cable?.enabled || ov.txInrush?.enabled || ov.txWithstand?.enabled || ov.mcb?.enabled)) {
    data.o = {};
    if (ov.cable?.enabled) data.o.c = { m: ov.cable.material, z: ov.cable.size, s: ov.cable.side };
    if (ov.txInrush?.enabled) data.o.i = 1;
    if (ov.txWithstand?.enabled) data.o.w = { c: ov.txWithstand.category };
    if (ov.mcb?.enabled) data.o.b = { t: ov.mcb.type, r: ov.mcb.rating, s: ov.mcb.side };
  }
  return data;
}

function expandState(data) {
  if (!data || (data.v !== 1 && data.v !== 2)) return null;
  try {
    const result = {
      tx: data.t,
      faultPct: data.f,
      relays: data.r.map(r => ({
        ctPri: r.c, pickupMul: r.p, tms: r.m,
        enabled: !!r.e, label: r.l,
        side: r.s, curveType: CURVES[r.k] ? r.k : 'IEC_SI',
        dtEnabled: !!r.de, dtPickupMul: r.dp || 5.0, dtDelay: r.dd || 0,
      })),
      remarks: data.n || '',
    };
    if (data.v >= 2 && data.o) {
      result.overlays = JSON.parse(JSON.stringify(DEFAULT_OVERLAYS));
      if (data.o.c) result.overlays.cable = { enabled: true, material: data.o.c.m, size: data.o.c.z, side: data.o.c.s };
      if (data.o.i) result.overlays.txInrush = { enabled: true };
      if (data.o.w) result.overlays.txWithstand = { enabled: true, category: data.o.w.c };
      if (data.o.b) result.overlays.mcb = { enabled: true, type: data.o.b.t, rating: data.o.b.r, side: data.o.b.s };
    }
    return result;
  } catch { return null; }
}

export function encodeState(state, remarks) {
  const json = JSON.stringify(compressState(state, remarks));
  return btoa(encodeURIComponent(json));
}

export function decodeState(encoded) {
  try {
    const json = decodeURIComponent(atob(encoded));
    return expandState(JSON.parse(json));
  } catch { return null; }
}

export function generateShareURL(state, remarks) {
  const encoded = encodeState(state, remarks);
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('s', encoded);
  return url.toString();
}

export function getURLState() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('s');
  if (!encoded) return null;
  return decodeState(encoded);
}

export function clearURLState() {
  const url = new URL(window.location.href);
  url.search = '';
  history.replaceState(null, '', url.toString());
}
