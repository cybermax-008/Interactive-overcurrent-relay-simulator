import { CURVES } from './constants.js';

export function calcFaultCurrent(mva, kv, zPct) {
  if (kv <= 0 || zPct <= 0) return 0;
  return (mva * 1000) / (kv * Math.sqrt(3) * (zPct / 100));
}

export function tripTime(If, iset, tms, curve = CURVES.IEC_SI) {
  const ratio = If / iset;
  if (ratio <= 1) return Infinity;
  return (curve.k / (Math.pow(ratio, curve.alpha) - 1) + (curve.beta || 0)) * tms;
}

export function getIset(r) {
  return r.ctPri * r.pickupMul;
}

export function getPriFault100(tx) {
  return calcFaultCurrent(tx.mva, tx.priKV, tx.zPct);
}

export function getSecFault100(tx) {
  return calcFaultCurrent(tx.mva, tx.secKV, tx.zPct);
}

export function getPriFault(tx, faultPct) {
  return getPriFault100(tx) * (faultPct / 100);
}

export function getSecFault(tx, faultPct) {
  return getSecFault100(tx) * (faultPct / 100);
}

export function getRelayFault(relay, tx, faultPct) {
  return relay.side === 'pri' ? getPriFault(tx, faultPct) : getSecFault(tx, faultPct);
}
