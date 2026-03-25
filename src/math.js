import { IEC_SI_K, IEC_SI_ALPHA } from './constants.js';

export function calcFaultCurrent(mva, kv, zPct) {
  if (kv <= 0 || zPct <= 0) return 0;
  return (mva * 1000) / (kv * Math.sqrt(3) * (zPct / 100));
}

export function tripTime(If, iset, tms) {
  const ratio = If / iset;
  if (ratio <= 1) return Infinity;
  return (IEC_SI_K / (Math.pow(ratio, IEC_SI_ALPHA) - 1)) * tms;
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
