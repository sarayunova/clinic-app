/**
 * Fetal Doppler Velocimetry & Cerebroplacental Ratio (CPR) Mathematical Engine
 *
 * References:
 * - ISUOG Practice Guidelines: Use of Doppler ultrasonography in obstetrics (2013, 2021 update)
 * - FIGO Consensus Guidelines on Fetal Growth Restriction (2020)
 * - Barcelona FGR Staging and Management System (Gratacós et al., Fetal Diagn Ther 2014)
 * - Arduini & Rizzo / Baschat & Gembruch: Umbilical Artery and CPR Reference Nomograms
 * - Ciobanu et al.: Reference intervals for MCA PI and CPR (Fetal Diagn Ther 2019)
 * - Mari et al.: Noninvasive diagnosis by Doppler ultrasonography of fetal anemia (NEJM 2000)
 * - Gómez et al.: Reference ranges for uterine artery mean pulsatility index (Ultrasound Obstet Gynecol 2008)
 */

export interface DopplerCalculationInput {
  gestationalAgeWeeks: number;
  gestationalAgeDays?: number;
  estimatedFetalWeightG?: number;
  efwPercentile?: number;
  abdominalCircumferenceMm?: number;
  acPercentile?: number;

  // Umbilical Artery
  uaPi: number;
  uaRi?: number;
  uaSdRatio?: number;
  uaEndDiastolicFlow?: 'normal_positive' | 'reduced' | 'aedf_absent' | 'redf_reversed';

  // Middle Cerebral Artery
  mcaPi: number;
  mcaRi?: number;
  mcaPsvCmS?: number;

  // Uterine Artery
  utaLeftPi?: number;
  utaRightPi?: number;
  utaMeanPi?: number;
  utaNotching?: 'none' | 'unilateral' | 'bilateral';

  // Ductus Venosus
  dvPiv?: number;
  dvAWave?: 'positive' | 'absent' | 'reversed' | 'not_performed';
}

export interface DopplerCalculationResult {
  gestationalAgeFormatted: string;

  // UA
  uaPi: number;
  uaPiCentile: number;
  uaPiMedian: number;
  uaPiP95: number;
  uaPiStatus: 'normal' | 'elevated_above_95th';
  uaEndDiastolicFlow: 'normal_positive' | 'reduced' | 'aedf_absent' | 'redf_reversed';

  // MCA
  mcaPi: number;
  mcaPiCentile: number;
  mcaPiMedian: number;
  mcaPiP5: number;
  mcaBrainSparing: 'none' | 'vasodilation_below_5th';
  mcaPsvMom?: number;
  fetalAnemiaRisk: 'none' | 'mild' | 'moderate_to_severe';

  // CPR
  cprRatio: number;
  cprCentile: number;
  cprMedian: number;
  cprP5: number;
  cprStatus: 'normal' | 'brain_sparing_redistribution';

  // UtA
  utaMeanPi?: number;
  utaMeanPiCentile?: number;
  utaMeanPiP95?: number;
  utaMeanPiStatus?: 'normal' | 'elevated_above_95th';
  utaNotching: 'none' | 'unilateral' | 'bilateral';

  // DV
  dvPiv?: number;
  dvPivCentile?: number;
  dvPivP95?: number;
  dvAWave: 'positive' | 'absent' | 'reversed' | 'not_performed';
  dvStatus: 'normal' | 'elevated_above_95th' | 'reversed_a_wave' | 'not_performed';

  // Clinical Classification & Staging
  fgrClassification: 'aga' | 'sga' | 'early_fgr' | 'late_fgr';
  barcelonaStage: 'stage_0' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4';
  stageTitle: string;
  monitoringFrequencyRecommendation: string;
  deliveryTimingRecommendation: string;
  steroidsIndicated: boolean;
  mgso4NeuroprotectionIndicated: boolean;
  clinicalSummary: string;
}

// ---------------------------------------------------------------------------
// Normative Reference Anchor Tables (GA 20 to 42 weeks)
// ---------------------------------------------------------------------------

// Umbilical Artery PI: [GA weeks, 5th, 50th, 95th] (Arduini & Rizzo / Baschat)
const UA_PI_ANCHORS: [number, number, number, number][] = [
  [20, 0.95, 1.30, 1.65],
  [22, 0.92, 1.25, 1.58],
  [24, 0.90, 1.20, 1.50],
  [26, 0.86, 1.14, 1.42],
  [28, 0.82, 1.08, 1.34],
  [30, 0.78, 1.02, 1.26],
  [32, 0.74, 0.96, 1.18],
  [34, 0.70, 0.91, 1.12],
  [36, 0.66, 0.86, 1.06],
  [38, 0.62, 0.81, 1.00],
  [40, 0.58, 0.76, 0.94],
  [42, 0.55, 0.72, 0.90],
];

// Middle Cerebral Artery PI: [GA weeks, 5th, 50th, 95th] (Ciobanu et al. 2019)
const MCA_PI_ANCHORS: [number, number, number, number][] = [
  [20, 1.25, 1.60, 2.00],
  [22, 1.35, 1.72, 2.15],
  [24, 1.45, 1.85, 2.30],
  [26, 1.55, 1.95, 2.42],
  [28, 1.60, 2.05, 2.50],
  [30, 1.58, 2.03, 2.48],
  [32, 1.55, 2.00, 2.45],
  [34, 1.45, 1.88, 2.35],
  [36, 1.30, 1.72, 2.15],
  [38, 1.15, 1.55, 1.95],
  [40, 1.00, 1.38, 1.75],
  [42, 0.85, 1.22, 1.55],
];

// Cerebroplacental Ratio (CPR = MCA PI / UA PI): [GA weeks, 5th, 50th, 95th] (Baschat / Ciobanu)
const CPR_ANCHORS: [number, number, number, number][] = [
  [20, 1.10, 1.40, 1.90],
  [22, 1.12, 1.46, 2.00],
  [24, 1.15, 1.54, 2.10],
  [26, 1.22, 1.70, 2.35],
  [28, 1.30, 1.90, 2.60],
  [30, 1.34, 2.00, 2.75],
  [32, 1.35, 2.08, 2.85],
  [34, 1.30, 2.06, 2.80],
  [36, 1.20, 2.00, 2.70],
  [38, 1.10, 1.91, 2.60],
  [40, 1.05, 1.82, 2.50],
  [42, 0.98, 1.70, 2.35],
];

// Uterine Artery Mean PI: [GA weeks, 50th, 95th] (Gómez et al. 2008)
const UTA_PI_ANCHORS: [number, number, number][] = [
  [20, 1.02, 1.45],
  [22, 0.92, 1.28],
  [24, 0.85, 1.15],
  [26, 0.80, 1.10],
  [28, 0.76, 1.05],
  [30, 0.73, 1.01],
  [32, 0.70, 0.98],
  [34, 0.68, 0.95],
  [36, 0.65, 0.92],
  [38, 0.62, 0.90],
  [40, 0.60, 0.88],
  [42, 0.58, 0.86],
];

// Ductus Venosus PIV: [GA weeks, 50th, 95th] (Baschat / Hecher)
const DV_PIV_ANCHORS: [number, number, number][] = [
  [20, 0.55, 0.78],
  [24, 0.54, 0.77],
  [28, 0.53, 0.76],
  [32, 0.51, 0.75],
  [36, 0.48, 0.72],
  [40, 0.45, 0.70],
  [42, 0.43, 0.68],
];

/** Generic 1D linear interpolator for 3-tuple [p5, p50, p95] */
function interpolatePercentiles(
  table: [number, number, number, number][],
  ga: number,
): { p5: number; p50: number; p95: number } {
  const clampedGa = Math.min(42, Math.max(20, ga));
  const first = table[0] ?? [20, 1.0, 1.5, 2.0];
  const last = table[table.length - 1] ?? [42, 0.5, 1.0, 1.5];

  if (clampedGa <= first[0]) {
    return { p5: first[1], p50: first[2], p95: first[3] };
  }
  if (clampedGa >= last[0]) {
    return { p5: last[1], p50: last[2], p95: last[3] };
  }

  for (let i = 0; i < table.length - 1; i++) {
    const cur = table[i];
    const next = table[i + 1];
    if (cur && next && clampedGa >= cur[0] && clampedGa <= next[0]) {
      const t = (clampedGa - cur[0]) / (next[0] - cur[0]);
      return {
        p5: Number((cur[1] + t * (next[1] - cur[1])).toFixed(2)),
        p50: Number((cur[2] + t * (next[2] - cur[2])).toFixed(2)),
        p95: Number((cur[3] + t * (next[3] - cur[3])).toFixed(2)),
      };
    }
  }

  return { p5: first[1], p50: first[2], p95: first[3] };
}

/** Generic 1D linear interpolator for 2-tuple [p50, p95] */
function interpolateTwoPercentiles(
  table: [number, number, number][],
  ga: number,
): { p50: number; p95: number } {
  const clampedGa = Math.min(42, Math.max(20, ga));
  const first = table[0] ?? [20, 1.0, 1.5];
  const last = table[table.length - 1] ?? [42, 0.5, 1.0];

  if (clampedGa <= first[0]) {
    return { p50: first[1], p95: first[2] };
  }
  if (clampedGa >= last[0]) {
    return { p50: last[1], p95: last[2] };
  }

  for (let i = 0; i < table.length - 1; i++) {
    const cur = table[i];
    const next = table[i + 1];
    if (cur && next && clampedGa >= cur[0] && clampedGa <= next[0]) {
      const t = (clampedGa - cur[0]) / (next[0] - cur[0]);
      return {
        p50: Number((cur[1] + t * (next[1] - cur[1])).toFixed(2)),
        p95: Number((cur[2] + t * (next[2] - cur[2])).toFixed(2)),
      };
    }
  }

  return { p50: first[1], p95: first[2] };
}

/** Calculates an approximate standard percentile from 5th, 50th, 95th */
function estimatePercentile(val: number, p5: number, p50: number, p95: number): number {
  if (val <= 0) return 1;
  if (val <= p5) {
    const ratio = Math.max(0.1, val / p5);
    return Math.max(1, Math.round(5 * ratio));
  }
  if (val === p50) return 50;
  if (val < p50) {
    return Math.round(5 + 45 * ((val - p5) / (p50 - p5)));
  }
  if (val <= p95) {
    return Math.round(50 + 45 * ((val - p50) / (p95 - p50)));
  }
  // Above 95th
  const delta = (val - p95) / (p95 * 0.25 || 0.25);
  return Math.min(99, Math.round(95 + 4 * Math.min(1, delta)));
}

/** Calculates Mari et al. (NEJM 2000) median MCA Peak Systolic Velocity (PSV in cm/s) */
export function calculateExpectedMcaPsvMedian(gaWeeks: number): number {
  const ga = Math.min(42, Math.max(15, gaWeeks));
  // Mari formula: exp(2.31 + 0.046 * GA)
  const median = Math.exp(2.31 + 0.046 * ga);
  return Number(median.toFixed(1));
}

/**
 * Main Clinical Doppler Velocimetry and FGR Staging Calculation Function
 */
export function calculateFetalDoppler(input: DopplerCalculationInput): DopplerCalculationResult {
  const gaExact = input.gestationalAgeWeeks + (input.gestationalAgeDays || 0) / 7;
  const gaWeeks = input.gestationalAgeWeeks;

  // 1. Umbilical Artery (UA)
  const uaNorm = interpolatePercentiles(UA_PI_ANCHORS, gaExact);
  const uaPi = Number(input.uaPi.toFixed(2));
  const uaPiCentile = estimatePercentile(uaPi, uaNorm.p5, uaNorm.p50, uaNorm.p95);
  const uaFlow = input.uaEndDiastolicFlow || 'normal_positive';
  const uaElevated = uaPi > uaNorm.p95 || uaFlow === 'aedf_absent' || uaFlow === 'redf_reversed';
  const uaPiStatus: 'normal' | 'elevated_above_95th' = uaElevated ? 'elevated_above_95th' : 'normal';

  // 2. Middle Cerebral Artery (MCA)
  const mcaNorm = interpolatePercentiles(MCA_PI_ANCHORS, gaExact);
  const mcaPi = Number(input.mcaPi.toFixed(2));
  const mcaPiCentile = estimatePercentile(mcaPi, mcaNorm.p5, mcaNorm.p50, mcaNorm.p95);
  const mcaBrainSparing: 'none' | 'vasodilation_below_5th' =
    mcaPi < mcaNorm.p5 || mcaPiCentile < 5 ? 'vasodilation_below_5th' : 'none';

  // MCA PSV MoM & Anemia Risk (Mari et al.)
  let mcaPsvMom: number | undefined;
  let fetalAnemiaRisk: 'none' | 'mild' | 'moderate_to_severe' = 'none';
  if (input.mcaPsvCmS && input.mcaPsvCmS > 0) {
    const expectedPsv = calculateExpectedMcaPsvMedian(gaWeeks);
    mcaPsvMom = Number((input.mcaPsvCmS / expectedPsv).toFixed(2));
    if (mcaPsvMom >= 1.50) {
      fetalAnemiaRisk = 'moderate_to_severe';
    } else if (mcaPsvMom >= 1.29) {
      fetalAnemiaRisk = 'mild';
    }
  }

  // 3. Cerebroplacental Ratio (CPR = MCA PI / UA PI)
  const cprNorm = interpolatePercentiles(CPR_ANCHORS, gaExact);
  const rawCpr = uaPi > 0 ? mcaPi / uaPi : 1.0;
  const cprRatio = Number(rawCpr.toFixed(2));
  const cprCentile = estimatePercentile(cprRatio, cprNorm.p5, cprNorm.p50, cprNorm.p95);
  // Brain sparing if CPR < 5th centile OR CPR < 1.05 (or strict < 1.0)
  const cprBrainSparing = cprRatio < cprNorm.p5 || cprCentile < 5 || cprRatio < 1.05;
  const cprStatus: 'normal' | 'brain_sparing_redistribution' = cprBrainSparing
    ? 'brain_sparing_redistribution'
    : 'normal';

  // 4. Uterine Artery (UtA)
  let utaMeanPi: number | undefined = input.utaMeanPi;
  if (utaMeanPi == null && input.utaLeftPi && input.utaRightPi) {
    utaMeanPi = Number(((input.utaLeftPi + input.utaRightPi) / 2).toFixed(2));
  }
  let utaMeanPiCentile: number | undefined;
  let utaMeanPiP95: number | undefined;
  let utaMeanPiStatus: 'normal' | 'elevated_above_95th' | undefined;
  if (utaMeanPi != null) {
    const utaNorm = interpolateTwoPercentiles(UTA_PI_ANCHORS, gaExact);
    utaMeanPiP95 = utaNorm.p95;
    utaMeanPiCentile = estimatePercentile(utaMeanPi, utaNorm.p50 * 0.7, utaNorm.p50, utaNorm.p95);
    utaMeanPiStatus = utaMeanPi > utaNorm.p95 ? 'elevated_above_95th' : 'normal';
  }
  const utaNotching = input.utaNotching || 'none';

  // 5. Ductus Venosus (DV)
  let dvPivCentile: number | undefined;
  let dvPivP95: number | undefined;
  const dvAWave = input.dvAWave || 'positive';
  let dvStatus: 'normal' | 'elevated_above_95th' | 'reversed_a_wave' | 'not_performed' = 'normal';

  if (dvAWave === 'reversed') {
    dvStatus = 'reversed_a_wave';
  } else if (input.dvPiv != null && input.dvPiv > 0) {
    const dvNorm = interpolateTwoPercentiles(DV_PIV_ANCHORS, gaExact);
    dvPivP95 = dvNorm.p95;
    dvPivCentile = estimatePercentile(input.dvPiv, dvNorm.p50 * 0.7, dvNorm.p50, dvNorm.p95);
    if (input.dvPiv > dvNorm.p95 || dvAWave === 'absent') {
      dvStatus = 'elevated_above_95th';
    } else {
      dvStatus = 'normal';
    }
  } else if (dvAWave === 'not_performed') {
    dvStatus = 'not_performed';
  }

  // 6. Barcelona Staging System (Gratacós et al. 2014)
  // Stage IV: DV reversed A-wave
  // Stage III: UA REDV OR DV PIV > 95th centile
  // Stage II: UA AEDV
  // Stage I: EFW < 3rd centile OR CPR < 5th centile OR UA PI > 95th centile OR UtA PI > 95th centile
  // Stage 0: Normal or uncomplicated constitutional SGA
  let barcelonaStage: 'stage_0' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' = 'stage_0';
  let stageTitle = 'Stage 0: Normal Hemodynamics / Appropriate Growth';
  let monitoringFrequencyRecommendation = 'Routine antenatal surveillance every 2–3 weeks.';
  let deliveryTimingRecommendation = 'Expectant management; deliver at 39–40 weeks.';
  let steroidsIndicated = false;
  let mgso4NeuroprotectionIndicated = false;

  const efwCentile = input.efwPercentile;
  const isEfwSeverelySmall = efwCentile != null && efwCentile < 3.0;

  if (dvStatus === 'reversed_a_wave') {
    barcelonaStage = 'stage_4';
    stageTitle = 'Stage IV: Critical Acidemia & Cardiac Decompensation';
    monitoringFrequencyRecommendation = 'Continuous electronic fetal monitoring / immediate obstetric intervention.';
    deliveryTimingRecommendation =
      gaWeeks >= 26
        ? 'EMERGENCY DELIVERY within 12–24 hours via Cesarean Section.'
        : 'Periviable critical acidemia: Multidisciplinary counseling regarding extreme prematurity vs stillbirth. Emergency delivery within 12–24 hours if viable.';
    steroidsIndicated = gaWeeks < 34;
    mgso4NeuroprotectionIndicated = gaWeeks < 32;
  } else if (uaFlow === 'redf_reversed' || dvStatus === 'elevated_above_95th') {
    barcelonaStage = 'stage_3';
    stageTitle = 'Stage III: Advanced Placental Breakdown & Low-Risk Acidemia';
    monitoringFrequencyRecommendation = 'Inpatient admission; Doppler velocimetry every 24–48 hours, CTG twice daily.';
    deliveryTimingRecommendation =
      gaWeeks >= 30
        ? 'Elective Cesarean delivery at 30–32 weeks after complete steroid course.'
        : 'Inpatient stabilization with steroids & MgSO4, plan Cesarean delivery at 30–32 weeks (or earlier if non-reassuring CTG / Stage IV).';
    steroidsIndicated = gaWeeks < 34;
    mgso4NeuroprotectionIndicated = gaWeeks < 32;
  } else if (uaFlow === 'aedf_absent') {
    barcelonaStage = 'stage_2';
    stageTitle = 'Stage II: Severe Placental Insufficiency (Absent End-Diastolic Flow)';
    monitoringFrequencyRecommendation = 'Doppler twice weekly; computerized CTG / Non-Stress Test daily.';
    deliveryTimingRecommendation =
      gaWeeks >= 34
        ? 'Deliver at 34 weeks via Cesarean section.'
        : 'Inpatient / close outpatient surveillance until 34 weeks (or steroids if early delivery triggered). Plan Cesarean delivery at 34 weeks.';
    steroidsIndicated = gaWeeks < 34;
  } else if (isEfwSeverelySmall || cprStatus === 'brain_sparing_redistribution' || uaElevated || utaMeanPiStatus === 'elevated_above_95th') {
    barcelonaStage = 'stage_1';
    stageTitle = 'Stage I: Mild Placental Insufficiency / Brain-Sparing Redistribution';
    monitoringFrequencyRecommendation = 'Weekly Doppler velocimetry (UA PI, MCA PI, CPR) and Biophysical Profile (BPP).';
    deliveryTimingRecommendation = 'Induction of labor at 37 weeks (trial of vaginal delivery with continuous intrapartum CTG).';
  }

  // 7. FIGO / ISUOG 2020 Consensus FGR Classification
  let fgrClassification: 'aga' | 'sga' | 'early_fgr' | 'late_fgr' = 'aga';
  const isSmall = efwCentile != null && efwCentile < 10.0;
  const isAcSmall = input.acPercentile != null && input.acPercentile < 10.0;

  if (gaWeeks < 32) {
    // Early FGR Criteria
    if (isEfwSeverelySmall || uaFlow === 'aedf_absent' || uaFlow === 'redf_reversed') {
      fgrClassification = 'early_fgr';
    } else if (isSmall && (uaElevated || utaMeanPiStatus === 'elevated_above_95th')) {
      fgrClassification = 'early_fgr';
    } else if (isSmall) {
      fgrClassification = 'sga'; // Normal Dopplers, small fetus
    }
  } else {
    // Late FGR Criteria (>= 32 weeks)
    if (isEfwSeverelySmall || (input.acPercentile != null && input.acPercentile < 3.0)) {
      fgrClassification = 'late_fgr';
    } else {
      let lateFlags = 0;
      if (isSmall) lateFlags++;
      if (isAcSmall) lateFlags++;
      if (cprBrainSparing) lateFlags++;
      if (uaElevated) lateFlags++;
      if (lateFlags >= 2) {
        fgrClassification = 'late_fgr';
      } else if (isSmall) {
        fgrClassification = 'sga';
      }
    }
  }

  // 8. Clinical Summary text
  let clinicalSummary = '';
  if (barcelonaStage === 'stage_4') {
    clinicalSummary = `CRITICAL FETAL DECOMPENSATION (Stage IV): Ductus Venosus reversed A-wave indicates acute myocardial dysfunction and imminent stillbirth. Urgent delivery indicated within 12–24h by Cesarean section. Administer Betamethasone (if < 34w) and MgSO4 (if < 32w).`;
  } else if (barcelonaStage === 'stage_3') {
    clinicalSummary = `ADVANCED PLACENTAL BREAKDOWN (Stage III): ${uaFlow === 'redf_reversed' ? 'Reversed end-diastolic flow in Umbilical Artery' : 'Ductus Venosus PIV > 95th centile'}. High risk of fetal acidemia. Admit to high-risk obstetric unit. Deliver at 30–32 weeks after maternal corticosteroids.`;
  } else if (barcelonaStage === 'stage_2') {
    clinicalSummary = `SEVERE PLACENTAL INSUFFICIENCY (Stage II): Absent end-diastolic flow in Umbilical Artery (AEDV). Perform daily fetal heart rate monitoring and bi-weekly Doppler. Deliver at 34 weeks by Cesarean section.`;
  } else if (barcelonaStage === 'stage_1') {
    clinicalSummary = `MILD PLACENTAL INSUFFICIENCY / BRAIN SPARING (Stage I): ${cprBrainSparing ? 'Cerebroplacental ratio (CPR) reflects cerebral vasodilation (brain-sparing reflex)' : 'Abnormal Doppler resistance'}. Weekly Doppler and BPP monitoring. Plan delivery at 37 weeks.`;
  } else if (fgrClassification === 'sga') {
    clinicalSummary = `CONSTITUTIONAL SMALL FOR GESTATIONAL AGE (SGA): Estimated fetal weight < 10th centile with normal Doppler indices (UA PI, MCA PI, CPR normal). No evidence of hemodynamic redistribution. Continue close bi-weekly growth surveillance.`;
  } else {
    clinicalSummary = `NORMAL FETAL DOPPLER HEMODYNAMICS: Umbilical artery impedance is appropriate for gestational age. No cerebral vasodilation (CPR normal). Low risk of placental insufficiency.`;
  }

  return {
    gestationalAgeFormatted: `${gaWeeks}w ${input.gestationalAgeDays || 0}d`,
    uaPi,
    uaPiCentile,
    uaPiMedian: uaNorm.p50,
    uaPiP95: uaNorm.p95,
    uaPiStatus,
    uaEndDiastolicFlow: uaFlow,
    mcaPi,
    mcaPiCentile,
    mcaPiMedian: mcaNorm.p50,
    mcaPiP5: mcaNorm.p5,
    mcaBrainSparing,
    mcaPsvMom,
    fetalAnemiaRisk,
    cprRatio,
    cprCentile,
    cprMedian: cprNorm.p50,
    cprP5: cprNorm.p5,
    cprStatus,
    utaMeanPi,
    utaMeanPiCentile,
    utaMeanPiP95,
    utaMeanPiStatus,
    utaNotching,
    dvPiv: input.dvPiv,
    dvPivCentile,
    dvPivP95,
    dvAWave,
    dvStatus,
    fgrClassification,
    barcelonaStage,
    stageTitle,
    monitoringFrequencyRecommendation,
    deliveryTimingRecommendation,
    steroidsIndicated,
    mgso4NeuroprotectionIndicated,
    clinicalSummary,
  };
}
