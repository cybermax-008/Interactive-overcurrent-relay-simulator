import {
  CABLE_K, TX_INRUSH_PEAK, TX_INRUSH_TAU,
  TX_WITHSTAND_T_BASE, MCB_TYPES, MCB_THERMAL_K,
  CURVE_SAMPLE_STEP,
} from './constants.js';
import { calcFaultCurrent } from './math.js';

// Cable adiabatic damage: t = (kS/I)^2
export function cableDamageTime(I, k, sizeMM2) {
  return Math.pow((k * sizeMM2) / I, 2);
}

export function computeCableDamageCurve(material, sizeMM2, xMin, xMax) {
  const k = CABLE_K[material] || CABLE_K.Cu_PVC;
  const kS = k * sizeMM2;
  const points = [];
  for (let I = xMin; I <= xMax; I *= CURVE_SAMPLE_STEP) {
    const t = Math.pow(kS / I, 2);
    if (t > 0) points.push({ I, t });
  }
  return points;
}

// TX inrush: inverted decay I(t) = FLC*(1+(K-1)*e^(-t/tau))
// Solve for t: t = -tau * ln((I/FLC - 1) / (K - 1))
export function computeTxInrushCurve(tx, xMin, xMax) {
  const flc = (tx.mva * 1000) / (tx.secKV * Math.sqrt(3));
  if (flc <= 0) return [];
  const K = TX_INRUSH_PEAK;
  const tau = TX_INRUSH_TAU;
  const Imin = flc * 1.01;
  const Imax = flc * K;
  const points = [];
  for (let I = Math.max(Imin, xMin); I <= Math.min(Imax, xMax); I *= CURVE_SAMPLE_STEP) {
    const ratio = (I / flc - 1) / (K - 1);
    if (ratio <= 0 || ratio >= 1) continue;
    const t = -tau * Math.log(ratio);
    if (t > 0) points.push({ I, t });
  }
  return points;
}

// TX through-fault withstand: t = tBase * (Imax/I)^2
export function computeTxWithstandCurve(tx, category, xMin, xMax) {
  const tBase = TX_WITHSTAND_T_BASE[category] || 2;
  const Imax = calcFaultCurrent(tx.mva, tx.secKV, tx.zPct);
  if (Imax <= 0) return [];
  const points = [];
  for (let I = Math.max(Imax * 0.1, xMin); I <= Math.min(Imax, xMax); I *= CURVE_SAMPLE_STEP) {
    const t = tBase * Math.pow(Imax / I, 2);
    if (t > 0) points.push({ I, t });
  }
  return points;
}

// MCB curve: thermal + magnetic regions
export function computeMCBCurve(type, rating, xMin, xMax) {
  const mcb = MCB_TYPES[type] || MCB_TYPES.B;
  const In = rating;
  const k = MCB_THERMAL_K;

  // Thermal region: 1.13*In to magMin*In
  const thermalPoints = [];
  const thermalStart = In * 1.13;
  const thermalEnd = In * mcb.magMin;
  for (let I = Math.max(thermalStart, xMin); I <= Math.min(thermalEnd, xMax); I *= CURVE_SAMPLE_STEP) {
    const mul = I / In;
    const t = k / (mul * mul);
    thermalPoints.push({ I, t });
  }

  // Magnetic region: vertical drop at magMin, horizontal to magMax
  const magneticPoints = [];
  const magMinI = In * mcb.magMin;
  const magMaxI = In * mcb.magMax;
  if (magMinI >= xMin && magMinI <= xMax) {
    const tAtMagMin = k / (mcb.magMin * mcb.magMin);
    magneticPoints.push({ I: magMinI, t: tAtMagMin });
    magneticPoints.push({ I: magMinI, t: 0.01 });
  }
  if (magMaxI >= xMin && magMaxI <= xMax) {
    magneticPoints.push({ I: magMaxI, t: 0.01 });
  }

  return { thermalPoints, magneticPoints };
}

// Compute axis range contributions from enabled overlays
export function computeOverlayAxisContributions(overlays, tx) {
  let xMin = Infinity, xMax = 0, yMin = Infinity, yMax = 0;

  if (overlays.cable?.enabled) {
    const k = CABLE_K[overlays.cable.material] || CABLE_K.Cu_PVC;
    const kS = k * overlays.cable.size;
    // At t=0.01s: I = kS/sqrt(0.01), at t=100s: I = kS/sqrt(100)
    xMin = Math.min(xMin, kS / Math.sqrt(100));
    xMax = Math.max(xMax, kS / Math.sqrt(0.01));
    yMin = Math.min(yMin, 0.01);
    yMax = Math.max(yMax, 100);
  }

  if (overlays.txInrush?.enabled) {
    const flc = (tx.mva * 1000) / (tx.secKV * Math.sqrt(3));
    if (flc > 0) {
      xMin = Math.min(xMin, flc);
      xMax = Math.max(xMax, flc * TX_INRUSH_PEAK);
      yMin = Math.min(yMin, 0.01);
      yMax = Math.max(yMax, 1);
    }
  }

  if (overlays.txWithstand?.enabled) {
    const Imax = calcFaultCurrent(tx.mva, tx.secKV, tx.zPct);
    if (Imax > 0) {
      const tBase = TX_WITHSTAND_T_BASE[overlays.txWithstand.category] || 2;
      xMin = Math.min(xMin, Imax * 0.1);
      xMax = Math.max(xMax, Imax);
      yMin = Math.min(yMin, tBase);
      yMax = Math.max(yMax, tBase * 100);
    }
  }

  if (overlays.mcb?.enabled) {
    const In = overlays.mcb.rating;
    const mcb = MCB_TYPES[overlays.mcb.type] || MCB_TYPES.B;
    xMin = Math.min(xMin, In);
    xMax = Math.max(xMax, In * mcb.magMax);
    yMin = Math.min(yMin, 0.01);
    yMax = Math.max(yMax, MCB_THERMAL_K / (1.13 * 1.13));
  }

  return { xMin, xMax, yMin, yMax };
}
