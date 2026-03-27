import { CURVES } from './constants.js';

// Compact keys to keep URLs short
function compressState(state, remarks) {
  return {
    v: 1,
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
}

function expandState(data) {
  if (!data || data.v !== 1) return null;
  try {
    return {
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
