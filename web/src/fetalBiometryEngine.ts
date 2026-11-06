/**
 * Antenatal Ultrasound Fetal Biometry, Doppler Velocimetry & Biophysical Profile (BPP)
 * Comprehensive obstetrical calculations engine following ISUOG, ACOG, and SMFM guidelines.
 */

export interface BiometryDetailedInputs {
  bpdMm?: number | null;
  ofdMm?: number | null;
  hcMm?: number | null;
  acMm?: number | null;
  flMm?: number | null;
  gaWeeks?: number | null;
  clinicalLmp?: string | null;
  scanDate?: string | null;
}

export interface CephalicIndexResult {
  index: number;
  shape: 'dolichocephaly' | 'mesocephaly' | 'brachycephaly';
  label: string;
  reliabilityNote: string;
}

export function calculateCephalicIndex(bpdMm: number, ofdMm: number): CephalicIndexResult | null {
  if (!bpdMm || !ofdMm || bpdMm <= 0 || ofdMm <= 0) return null;
  const index = Math.round((bpdMm / ofdMm) * 1000) / 10;

  if (index < 70.0) {
    return {
      index,
      shape: 'dolichocephaly',
      label: `Dolichocephaly (${index}%)`,
      reliabilityNote: 'Elongated cranial shape (CI < 70%). BPD may underestimate gestational age; use HC for dating.',
    };
  } else if (index > 86.0) {
    return {
      index,
      shape: 'brachycephaly',
      label: `Brachycephaly (${index}%)`,
      reliabilityNote: 'Round cranial shape (CI > 86%). BPD may overestimate gestational age; use HC for dating.',
    };
  } else {
    return {
      index,
      shape: 'mesocephaly',
      label: `Mesocephaly / Normal (${index}%)`,
      reliabilityNote: 'Normal head shape (70.0 - 86.0%). BPD and HC are both reliable.',
    };
  }
}

export interface AnatomicalRatiosResult {
  hcAcRatio: number | null;
  flAcRatio: number | null;
  asymmetryFlag: boolean;
  interpretation: string;
}

export function calculateAnatomicalRatios(hcMm: number | null | undefined, acMm: number | null | undefined, flMm: number | null | undefined, gaWeeks?: number | null): AnatomicalRatiosResult {
  let hcAc: number | null = null;
  let flAc: number | null = null;

  if (hcMm && acMm && acMm > 0) {
    hcAc = Math.round((hcMm / acMm) * 100) / 100;
  }

  if (flMm && acMm && acMm > 0) {
    flAc = Math.round((flMm / acMm) * 1000) / 10; // As percentage
  }

  let asymmetryFlag = false;
  let interpretation = 'Anatomical ratios within normal proportions.';

  if (hcAc != null && gaWeeks && gaWeeks >= 34) {
    if (hcAc > 1.05) {
      asymmetryFlag = true;
      interpretation = `Elevated HC/AC ratio (${hcAc} at ${gaWeeks}w). Suggests asymmetric fetal growth restriction with head-sparing redistribution.`;
    }
  }

  if (flAc != null && flAc > 24.0) {
    asymmetryFlag = true;
    interpretation += ` FL/AC ratio elevated (${flAc}%).`;
  }

  return {
    hcAcRatio: hcAc,
    flAcRatio: flAc,
    asymmetryFlag,
    interpretation,
  };
}

export interface FgrClassification {
  category: 'severe_fgr' | 'moderate_fgr' | 'aga' | 'lga' | 'macrosomia';
  label: string;
  badgeClass: string;
  clinicalGuidance: string;
}

export function classifyFetalGrowth(efwGrams: number, gaWeeks: number): FgrClassification {
  if (efwGrams >= 4000) {
    return {
      category: 'macrosomia',
      label: `Fetal Macrosomia (EFW ${efwGrams}g >= 4000g)`,
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
      clinicalGuidance: 'High risk for shoulder dystocia, perineal trauma, and neonatal hypoglycemia. Assess maternal glycemic control and discuss delivery timing/mode if EFW >= 4500g (or >= 4000g in GDM).',
    };
  }

  // Reference percentiles from Hadlock EFW distribution
  // Median values roughly: 24w: 670, 28w: 1210, 32w: 1960, 36w: 2860, 40w: 3600
  const ref = HADLOCK_EXTENDED_PERCENTILES[gaWeeks] || { p3: 2000, p10: 2400, p50: 3000, p90: 3600 };

  if (efwGrams < ref.p3) {
    return {
      category: 'severe_fgr',
      label: `Severe FGR (< 3rd percentile, < ${ref.p3}g)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-400 font-bold animate-pulse',
      clinicalGuidance: 'Severe early or late FGR. High perinatal morbidity/mortality risk. Immediate Umbilical Artery & MCA Doppler, AFI assessment, CTG monitoring, and specialist MFM referral.',
    };
  } else if (efwGrams < ref.p10) {
    return {
      category: 'moderate_fgr',
      label: `Moderate FGR / SGA (3rd - 9th percentile, < ${ref.p10}g)`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
      clinicalGuidance: 'Fetal growth restriction / Small for Gestational Age. Perform Doppler velocimetry (UA & MCA), repeat scan in 14 days, and monitor fetal movements.',
    };
  } else if (efwGrams > ref.p90) {
    return {
      category: 'lga',
      label: `Large for Gestational Age (> 90th percentile, > ${ref.p90}g)`,
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      clinicalGuidance: 'Accelerated fetal growth. Screen for gestational diabetes (OGTT), re-evaluate maternal BMI, and monitor amniotic fluid.',
    };
  } else {
    return {
      category: 'aga',
      label: `Appropriate for Gestational Age (10th - 90th percentile)`,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      clinicalGuidance: 'Normal intrauterine fetal growth trajectory. Continue standard antenatal care.',
    };
  }
}

export const HADLOCK_EXTENDED_PERCENTILES: Record<
  number,
  { p3: number; p10: number; p50: number; p90: number }
> = {
  20: { p3: 250, p10: 280, p50: 330, p90: 390 },
  21: { p3: 300, p10: 340, p50: 400, p90: 470 },
  22: { p3: 360, p10: 410, p50: 480, p90: 560 },
  23: { p3: 430, p10: 490, p50: 570, p90: 670 },
  24: { p3: 500, p10: 570, p50: 670, p90: 780 },
  25: { p3: 590, p10: 670, p50: 790, p90: 920 },
  26: { p3: 690, p10: 780, p50: 910, p90: 1060 },
  27: { p3: 800, p10: 900, p50: 1050, p90: 1230 },
  28: { p3: 920, p10: 1030, p50: 1210, p90: 1410 },
  29: { p3: 1050, p10: 1170, p50: 1380, p90: 1610 },
  30: { p3: 1190, p10: 1330, p50: 1560, p90: 1820 },
  31: { p3: 1340, p10: 1500, p50: 1750, p90: 2040 },
  32: { p3: 1500, p10: 1670, p50: 1960, p90: 2280 },
  33: { p3: 1660, p10: 1850, p50: 2180, p90: 2530 },
  34: { p3: 1830, p10: 2040, p50: 2400, p90: 2790 },
  35: { p3: 2000, p10: 2230, p50: 2630, p90: 3050 },
  36: { p3: 2180, p10: 2430, p50: 2860, p90: 3320 },
  37: { p3: 2350, p10: 2620, p50: 3080, p90: 3580 },
  38: { p3: 2520, p10: 2810, p50: 3300, p90: 3840 },
  39: { p3: 2670, p10: 2980, p50: 3500, p90: 4070 },
  40: { p3: 2740, p10: 3060, p50: 3600, p90: 4190 },
  41: { p3: 2780, p10: 3100, p50: 3650, p90: 4250 },
};

export interface DopplerEvaluation {
  cprRatio: number | null;
  cprAssessment: 'normal' | 'brain_sparing_redistribution' | 'not_applicable';
  uaStatus: string;
  uaAlertClass: string;
  mcaAnemiaAlert: boolean;
  guidance: string;
}

export function evaluateFetalDoppler(params: {
  uaPi?: number | null;
  uaRi?: number | null;
  uaEndDiastolicFlow?: 'normal_positive' | 'reduced' | 'aedf_absent' | 'redf_reversed' | 'not_performed';
  mcaPi?: number | null;
  mcaPsvCmS?: number | null;
  gaWeeks?: number | null;
  utaMeanPi?: number | null;
  utaBilateralNotch?: boolean;
}): DopplerEvaluation {
  let cprRatio: number | null = null;
  let cprAssessment: 'normal' | 'brain_sparing_redistribution' | 'not_applicable' = 'not_applicable';

  if (params.mcaPi && params.uaPi && params.uaPi > 0) {
    cprRatio = Math.round((params.mcaPi / params.uaPi) * 100) / 100;
    if (cprRatio < 1.08) {
      cprAssessment = 'brain_sparing_redistribution';
    } else {
      cprAssessment = 'normal';
    }
  }

  let uaStatus = 'Normal positive end-diastolic flow';
  let uaAlertClass = 'text-emerald-700 font-semibold';
  let guidance = 'Normal fetoplacental Doppler impedance.';

  if (params.uaEndDiastolicFlow === 'redf_reversed') {
    uaStatus = 'CRITICAL: Reversed End-Diastolic Flow (REDF)';
    uaAlertClass = 'text-rose-700 font-bold animate-pulse';
    guidance = 'EMERGENCY: Reversed diastolic flow reflects > 70% placental vascular bed obliteration. Immediate hospital admission, antenatal corticosteroids, continuous CTG, and urgent delivery preparation.';
  } else if (params.uaEndDiastolicFlow === 'aedf_absent') {
    uaStatus = 'HIGH RISK: Absent End-Diastolic Flow (AEDF)';
    uaAlertClass = 'text-rose-600 font-bold';
    guidance = 'CRITICAL PLACENTAL INSUFFICIENCY: Absent end-diastolic flow. Inpatient admission, fetal surveillance, steroids; delivery strongly indicated >= 32-34 weeks.';
  } else if (params.uaEndDiastolicFlow === 'reduced' || (params.uaPi && params.uaPi > 1.45)) {
    uaStatus = 'Increased Placental Resistance (Elevated UA-PI)';
    uaAlertClass = 'text-amber-700 font-semibold';
    guidance = 'Elevated umbilical artery resistance. Repeat Doppler in 3-7 days with growth & fluid assessment.';
  }

  if (cprAssessment === 'brain_sparing_redistribution') {
    guidance += ' Cerebral redistribution / brain-sparing (CPR < 1.08) detected: Fetus is prioritizing blood flow to brain in response to hypoxia.';
  }

  let mcaAnemiaAlert = false;
  if (params.mcaPsvCmS && params.gaWeeks) {
    // Median MCA-PSV approx = exp(2.31 + 0.046 * GA)
    const expectedMedianPsv = Math.exp(2.31 + 0.046 * params.gaWeeks);
    const mom = params.mcaPsvCmS / expectedMedianPsv;
    if (mom >= 1.5) {
      mcaAnemiaAlert = true;
      guidance += ` WARNING: Elevated MCA Peak Systolic Velocity (${params.mcaPsvCmS} cm/s, ${Math.round(mom * 100) / 100} MoM >= 1.5 MoM). High suspicion of moderate-to-severe fetal anemia!`;
    }
  }

  return {
    cprRatio,
    cprAssessment,
    uaStatus,
    uaAlertClass,
    mcaAnemiaAlert,
    guidance,
  };
}

export interface BppResult {
  totalScore: number;
  maxScore: number;
  interpretation: 'reassuring' | 'equivocal' | 'abnormal_asphyxia_risk';
  badgeClass: string;
  recommendation: string;
}

export function calculateBpp(params: {
  breathing: number; // 0 or 2
  movement: number;  // 0 or 2
  tone: number;      // 0 or 2
  fluid: number;     // 0 or 2
  nstReactive?: number | null; // 0 or 2, optional
}): BppResult {
  const hasNst = params.nstReactive != null;
  const maxScore = hasNst ? 10 : 8;
  const totalScore = (params.breathing || 0) +
    (params.movement || 0) +
    (params.tone || 0) +
    (params.fluid || 0) +
    (params.nstReactive || 0);

  if (totalScore === maxScore || (maxScore === 10 && totalScore === 8 && params.fluid === 2)) {
    return {
      totalScore,
      maxScore,
      interpretation: 'reassuring',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
      recommendation: 'Normal Biophysical Profile. Low risk of acute or chronic fetal asphyxia. Repeat as clinically indicated.',
    };
  } else if (totalScore === 6 && params.fluid === 2) {
    return {
      totalScore,
      maxScore,
      interpretation: 'equivocal',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
      recommendation: 'Equivocal test: Repeat BPP within 12–24 hours. If patient is at or near term, or if oligohydramnios is present, consider delivery.',
    };
  } else {
    return {
      totalScore,
      maxScore,
      interpretation: 'abnormal_asphyxia_risk',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse',
      recommendation: 'Abnormal BPP: High probability of fetal asphyxia. Immediate obstetric review; hospital admission and delivery strongly indicated.',
    };
  }
}

export interface GrowthVelocityResult {
  intervalDays: number;
  weightDeltaGrams: number;
  gramsPerDay: number;
  gramsPerWeek: number;
  velocityStatus: 'normal' | 'slow' | 'stagnant' | 'negative';
  label: string;
  badgeClass: string;
}

export function calculateGrowthVelocity(
  scan1: { date: string; efwGrams: number },
  scan2: { date: string; efwGrams: number }
): GrowthVelocityResult | null {
  if (!scan1.date || !scan2.date || !scan1.efwGrams || !scan2.efwGrams) return null;

  const d1 = new Date(`${scan1.date}T00:00:00Z`).getTime();
  const d2 = new Date(`${scan2.date}T00:00:00Z`).getTime();
  const intervalDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

  if (intervalDays <= 0) return null;

  const weightDeltaGrams = scan2.efwGrams - scan1.efwGrams;
  const gramsPerDay = Math.round((weightDeltaGrams / intervalDays) * 10) / 10;
  const gramsPerWeek = Math.round(gramsPerDay * 7);

  if (gramsPerDay < 0) {
    return {
      intervalDays,
      weightDeltaGrams,
      gramsPerDay,
      gramsPerWeek,
      velocityStatus: 'negative',
      label: `Negative Growth (${gramsPerDay} g/day)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    };
  } else if (gramsPerDay < 10) {
    return {
      intervalDays,
      weightDeltaGrams,
      gramsPerDay,
      gramsPerWeek,
      velocityStatus: 'stagnant',
      label: `Stagnant Growth (${gramsPerDay} g/day, ${gramsPerWeek} g/wk)`,
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 font-semibold',
    };
  } else if (gramsPerDay < 20) {
    return {
      intervalDays,
      weightDeltaGrams,
      gramsPerDay,
      gramsPerWeek,
      velocityStatus: 'slow',
      label: `Slow Growth (${gramsPerDay} g/day, ${gramsPerWeek} g/wk)`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  } else {
    return {
      intervalDays,
      weightDeltaGrams,
      gramsPerDay,
      gramsPerWeek,
      velocityStatus: 'normal',
      label: `Normal Growth Velocity (${gramsPerDay} g/day, ${gramsPerWeek} g/wk)`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }
}
