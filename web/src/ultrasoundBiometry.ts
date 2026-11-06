/**
 * Ultrasound Biometry & Obstetrical Calculation Utilities
 * Implements Hadlock biometry formulas for EFW, Robinson & Fleming CRL dating,
 * AFI/SDP fluid evaluation, and gestational age reference charts.
 */

export interface GestationalAgeResult {
  weeks: number;
  days: number;
  totalDays: number;
  formatted: string;
}

/**
 * Calculates gestational age from Crown-Rump Length (CRL in mm)
 * using the Robinson & Fleming formula:
 * GA (days) = 8.052 * sqrt(CRL_mm) + 23.73
 */
export function calculateGestationalAgeByCrl(crlMm: number): GestationalAgeResult | null {
  if (!crlMm || crlMm <= 0 || crlMm > 150) return null;
  const totalDays = Math.round(8.052 * Math.sqrt(crlMm) + 23.73);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return {
    weeks,
    days,
    totalDays,
    formatted: `${weeks}w ${days}d`,
  };
}

/**
 * Calculates Estimated Due Date (EDD) by Ultrasound Scan
 * based on scan date and gestational age in weeks & days.
 */
export function calculateEddByScan(scanDateStr: string, gaWeeks: number, gaDays: number = 0): string | null {
  if (!scanDateStr || gaWeeks <= 0 || gaWeeks > 44) return null;
  try {
    const scanDate = new Date(`${scanDateStr}T00:00:00Z`);
    if (isNaN(scanDate.getTime())) return null;

    const totalDaysElapsed = gaWeeks * 7 + gaDays;
    const daysRemaining = 280 - totalDaysElapsed;

    const edd = new Date(scanDate.getTime() + daysRemaining * 86_400_000);
    return edd.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

export interface BiometryInputs {
  bpdMm?: number | null;
  hcMm?: number | null;
  acMm?: number | null;
  flMm?: number | null;
}

/**
 * Calculates Estimated Fetal Weight (EFW in grams) using Hadlock's published regression models.
 * Inputs are in millimeters (converted to cm for formula).
 * - Hadlock 4 (BPD, HC, AC, FL): log10(EFW) = 1.3596 - 0.00386(AC*FL) + 0.007(BPD) + 0.0192(HC) + 0.0538(AC) + 0.0348(FL)
 * - Hadlock 3 (BPD, AC, FL):     log10(EFW) = 1.335 - 0.0034(AC*FL) + 0.0316(BPD) + 0.0457(AC) + 0.0162(FL)
 * - Hadlock 2 (AC, FL):          log10(EFW) = 1.304 + 0.05281(AC) + 0.18(FL) - 0.00004(AC*FL)
 */
export function calculateEfwHadlock(inputs: BiometryInputs): number | null {
  const bpd = inputs.bpdMm ? inputs.bpdMm / 10 : null;
  const hc = inputs.hcMm ? inputs.hcMm / 10 : null;
  const ac = inputs.acMm ? inputs.acMm / 10 : null;
  const fl = inputs.flMm ? inputs.flMm / 10 : null;

  if (ac == null || fl == null) return null;

  let logEfw: number | null = null;

  if (bpd != null && hc != null) {
    // Hadlock 4 (BPD, HC, AC, FL):
    // log10(EFW) = 1.3596 + 0.0064(HC) + 0.0424(AC) + 0.174(FL) + 0.00061(BPD*AC) - 0.00386(AC*FL)
    logEfw =
      1.3596 +
      0.0064 * hc +
      0.0424 * ac +
      0.174 * fl +
      0.00061 * (bpd * ac) -
      0.00386 * (ac * fl);
  } else if (bpd != null) {
    // Hadlock 3 (BPD, AC, FL):
    // log10(EFW) = 1.335 - 0.0034(AC*FL) + 0.0316(BPD) + 0.0457(AC) + 0.1623(FL)
    logEfw =
      1.335 -
      0.0034 * (ac * fl) +
      0.0316 * bpd +
      0.0457 * ac +
      0.1623 * fl;
  } else {
    // Hadlock 2 (AC, FL):
    // log10(EFW) = 1.304 + 0.05281(AC) + 0.1938(FL) - 0.004(AC*FL)
    logEfw =
      1.304 +
      0.05281 * ac +
      0.1938 * fl -
      0.004 * (ac * fl);
  }

  if (logEfw == null || isNaN(logEfw)) return null;
  const efw = Math.pow(10, logEfw);
  if (efw < 50 || efw > 6500) return null;
  return Math.round(efw);
}

/** Reference medians and 10th-90th percentile ranges for EFW by gestational age week (Hadlock) */
export const HADLOCK_EFW_PERCENTILE_TABLE: Record<
  number,
  { p10: number; p50: number; p90: number }
> = {
  20: { p10: 280, p50: 330, p90: 390 },
  21: { p10: 340, p50: 400, p90: 470 },
  22: { p10: 410, p50: 480, p90: 560 },
  23: { p10: 490, p50: 570, p90: 670 },
  24: { p10: 570, p50: 670, p90: 780 },
  25: { p10: 670, p50: 790, p90: 920 },
  26: { p10: 780, p50: 910, p90: 1060 },
  27: { p10: 900, p50: 1050, p90: 1230 },
  28: { p10: 1030, p50: 1210, p90: 1410 },
  29: { p10: 1170, p50: 1380, p90: 1610 },
  30: { p10: 1330, p50: 1560, p90: 1820 },
  31: { p10: 1500, p50: 1750, p90: 2040 },
  32: { p10: 1670, p50: 1960, p90: 2280 },
  33: { p10: 1850, p50: 2180, p90: 2530 },
  34: { p10: 2040, p50: 2400, p90: 2790 },
  35: { p10: 2230, p50: 2630, p90: 3050 },
  36: { p10: 2430, p50: 2860, p90: 3320 },
  37: { p10: 2620, p50: 3080, p90: 3580 },
  38: { p10: 2810, p50: 3300, p90: 3840 },
  39: { p10: 2980, p50: 3500, p90: 4070 },
  40: { p10: 3060, p50: 3600, p90: 4190 },
  41: { p10: 3100, p50: 3650, p90: 4250 },
};

export interface EfwEvaluation {
  efwGrams: number;
  category: 'sga' | 'aga' | 'lga';
  label: string;
  expectedMedianGrams?: number;
}

export function evaluateEfwPercentile(efwGrams: number, gaWeeks: number): EfwEvaluation | null {
  if (!efwGrams || gaWeeks < 20 || gaWeeks > 41) return null;
  const ref = HADLOCK_EFW_PERCENTILE_TABLE[gaWeeks];
  if (!ref) return null;

  if (efwGrams < ref.p10) {
    return {
      efwGrams,
      category: 'sga',
      label: `< 10th percentile (Small for Gestational Age / SGA)`,
      expectedMedianGrams: ref.p50,
    };
  }
  if (efwGrams > ref.p90) {
    return {
      efwGrams,
      category: 'lga',
      label: `> 90th percentile (Large for Gestational Age / LGA)`,
      expectedMedianGrams: ref.p50,
    };
  }
  return {
    efwGrams,
    category: 'aga',
    label: `Appropriate for Gestational Age (AGA, ~${ref.p50}g median)`,
    expectedMedianGrams: ref.p50,
  };
}

/**
 * Amniotic Fluid Index (AFI) in cm interpretation
 */
export function interpretAfi(afiCm: number): {
  assessment: 'oligohydramnios' | 'borderline' | 'normal' | 'polyhydramnios';
  label: string;
  alert: boolean;
} {
  if (afiCm < 5.0) {
    return {
      assessment: 'oligohydramnios',
      label: 'Oligohydramnios (< 5.0 cm)',
      alert: true,
    };
  }
  if (afiCm <= 8.0) {
    return {
      assessment: 'borderline',
      label: 'Borderline Low AFI (5.0 - 8.0 cm)',
      alert: true,
    };
  }
  if (afiCm <= 24.0) {
    return {
      assessment: 'normal',
      label: 'Normal / Adequate AFI (8.1 - 24.0 cm)',
      alert: false,
    };
  }
  return {
    assessment: 'polyhydramnios',
    label: 'Polyhydramnios (> 24.0 cm)',
    alert: true,
  };
}

/**
 * Single Deepest Pocket (SDP) in cm interpretation
 */
export function interpretSdp(sdpCm: number): {
  assessment: 'oligohydramnios' | 'normal' | 'polyhydramnios';
  label: string;
  alert: boolean;
} {
  if (sdpCm < 2.0) {
    return {
      assessment: 'oligohydramnios',
      label: 'Oligohydramnios (SDP < 2.0 cm)',
      alert: true,
    };
  }
  if (sdpCm <= 8.0) {
    return {
      assessment: 'normal',
      label: 'Normal SDP (2.0 - 8.0 cm)',
      alert: false,
    };
  }
  return {
    assessment: 'polyhydramnios',
    label: 'Polyhydramnios (SDP > 8.0 cm)',
    alert: true,
  };
}

/** Anatomical survey items for 2nd trimester anomaly (TIFFA) scan */
export const ANATOMICAL_SURVEY_ITEMS = [
  { key: 'cns', label: 'Cerebrum / Ventricles / Posterior Fossa / Cisterna Magna' },
  { key: 'face', label: 'Face / Lips / Orbits / Profile' },
  { key: 'spine', label: 'Spine & Neural Tube (Cervical to Sacral)' },
  { key: 'heart', label: 'Four-Chamber Heart & Outflow Tracts (LVOT / RVOT)' },
  { key: 'thorax', label: 'Thorax & Lungs / Diaphragm' },
  { key: 'abdomen', label: 'Stomach Bubble / Bowel / Abdominal Wall / Umbilicus' },
  { key: 'kidneys', label: 'Kidneys (bilateral) & Urinary Bladder' },
  { key: 'limbs', label: 'Upper & Lower Extremities (3 segments each limb)' },
  { key: 'cord', label: 'Umbilical Cord (3-vessel cord)' },
] as const;

export type AnatomyItemKey = (typeof ANATOMICAL_SURVEY_ITEMS)[number]['key'];
