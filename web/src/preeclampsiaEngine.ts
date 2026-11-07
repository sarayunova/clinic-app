/**
 * Pre-eclampsia First-Trimester Screening (FMF Triad) & Aspirin Prophylaxis Engine
 *
 * References:
 * - Fetal Medicine Foundation (FMF) First-Trimester Screening for Pre-eclampsia
 *   (Akolekar et al., Ultrasound Obstet Gynecol 2013; Wright et al., 2015; Poon et al., 2009)
 * - ASPRE Trial: Aspirin for Evidence-Based Preeclampsia Prevention (Rolnik et al., NEJM 2017)
 * - FIGO Guidelines: First-trimester screening and prevention of pre-eclampsia (Poon et al., IJGO 2019)
 * - NICE Guideline [NG133]: Hypertension in pregnancy: diagnosis and management
 * - ACOG Practice Advisory: Low-Dose Aspirin for Prevention of Preeclampsia
 */

export type Ethnicity = 'south_asian' | 'caucasian' | 'afro_caribbean' | 'east_asian' | 'other';
export type ParityStatus = 'nulliparous' | 'multiparous_no_pe' | 'multiparous_prior_pe';
export type PriorPeOnset = 'early_lt_34' | 'preterm_34_37' | 'term_gt_37';
export type ConceptionMethod = 'spontaneous' | 'ivf_art' | 'ovulation_induction';
export type SmokingStatus = 'non_smoker' | 'smoker' | 'cessation_early_pregnancy';

export interface PreeclampsiaScreeningInput {
  gestationalAgeWeeks: number; // 11 to 14
  gestationalAgeDays?: number; // 0 to 6
  crlMm?: number; // 45 to 84 mm

  // Maternal characteristics & history
  maternalAge: number;
  maternalWeightKg?: number;
  maternalHeightCm?: number;
  bmi?: number;
  ethnicity?: Ethnicity;
  parity?: ParityStatus;
  priorPeOnsetGestation?: PriorPeOnset | null;
  conceptionMethod?: ConceptionMethod;
  smokingStatus?: SmokingStatus;
  familyHistoryPe?: boolean;
  chronicHypertension?: boolean;
  pregestationalDiabetes?: boolean;
  systemicLupusOrAps?: boolean;
  chronicKidneyDisease?: boolean;
  interpregnancyIntervalYears?: number;

  // Mean Arterial Pressure (MAP)
  sbpRight?: number;
  dbpRight?: number;
  sbpLeft?: number;
  dbpLeft?: number;
  meanArterialPressure?: number; // direct override or calculated

  // Uterine Artery Pulsatility Index (UtA PI)
  utaPiLeft?: number;
  utaPiRight?: number;
  utaPiMean?: number; // direct override or calculated
  utaBilateralNotching?: boolean;

  // Serum Biomarkers (optional)
  serumPlgfPgMl?: number;
  plgfMom?: number;
  serumPappaIuL?: number;
  pappaMom?: number;
}

export interface PreeclampsiaScreeningResult {
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  crlMm?: number;
  bmi: number;

  // Calculated Biophysical
  meanArterialPressure: number;
  mapMom: number;
  utaPiMean: number;
  utaPiMom: number;
  utaBilateralNotching: boolean;

  // Calculated Biochemical
  plgfMom?: number;
  pappaMom?: number;

  // Risk Scores & Ratios
  backgroundRiskRatio: string;
  backgroundRiskNumeric: number;
  fmfRiskRatio: string;
  fmfRiskNumeric: number;
  fmfRiskCategory: 'high_risk' | 'low_risk';
  clinicalRiskCategory: 'high_risk' | 'moderate_risk' | 'low_risk';
  clinicalRiskFlags: string[];
  overallRiskTier: 'high_risk' | 'low_risk';

  // Prophylaxis Plan
  aspirinIndicated: boolean;
  aspirinDoseMg: number;
  aspirinTimingRationale: string;
  calciumIndicated: boolean;
  calciumDoseMg: number;
  surveillanceInterval: string;
  repeatScanWeeks: string;
  warningSignsEducation: string[];
}

export function calculateMap(
  sbpRight?: number,
  dbpRight?: number,
  sbpLeft?: number,
  dbpLeft?: number,
): number {
  const mapRight =
    sbpRight && dbpRight ? dbpRight + (sbpRight - dbpRight) / 3.0 : undefined;
  const mapLeft =
    sbpLeft && dbpLeft ? dbpLeft + (sbpLeft - dbpLeft) / 3.0 : undefined;

  if (mapRight !== undefined && mapLeft !== undefined) {
    return Math.round(((mapRight + mapLeft) / 2.0) * 10) / 10;
  }
  if (mapRight !== undefined) return Math.round(mapRight * 10) / 10;
  if (mapLeft !== undefined) return Math.round(mapLeft * 10) / 10;
  return 85.0; // fallback standard adult MAP
}

export function calculateExpectedMap(
  gaWeeks: number,
  gaDays: number,
  maternalAge: number,
  bmi: number,
): number {
  // Baseline MAP at 12 weeks for 30yo BMI 23 is ~84.0 mmHg
  const ageFactor = 1.0 + 0.004 * (maternalAge - 30);
  const bmiFactor = Math.pow(Math.max(16, Math.min(50, bmi)) / 23.0, 0.18);
  const gaFactor = 1.0 - 0.002 * (gaWeeks + gaDays / 7.0 - 12);
  const expected = 84.0 * ageFactor * bmiFactor * gaFactor;
  return Math.round(expected * 10) / 10;
}

export function calculateExpectedUtAPi(gaWeeks: number, gaDays: number): number {
  // Expected mean UtA PI decreases smoothly between 11w0d and 13w6d:
  // At 11 weeks: ~1.72
  // At 12 weeks: ~1.63
  // At 13 weeks: ~1.55
  // At 14 weeks: ~1.48
  const exactGa = gaWeeks + (gaDays || 0) / 7.0;
  const expected = 1.63 - 0.08 * (exactGa - 12.0);
  return Math.round(Math.max(1.2, expected) * 100) / 100;
}

export function calculateExpectedPlgf(gaWeeks: number, gaDays: number): number {
  // Expected PlGF increases rapidly in late 1st trimester:
  // At 11 weeks: ~26 pg/mL
  // At 12 weeks: ~38 pg/mL
  // At 13 weeks: ~54 pg/mL
  const exactGa = gaWeeks + (gaDays || 0) / 7.0;
  const expected = 38.0 + 15.0 * (exactGa - 12.0);
  return Math.round(Math.max(15, expected) * 10) / 10;
}

export function calculatePreeclampsiaScreening(
  input: PreeclampsiaScreeningInput,
): PreeclampsiaScreeningResult {
  const gaWeeks = input.gestationalAgeWeeks;
  const gaDays = input.gestationalAgeDays || 0;
  const maternalAge = input.maternalAge;

  // BMI Calculation
  let bmi = input.bmi;
  if (!bmi && input.maternalWeightKg && input.maternalHeightCm) {
    const heightM = input.maternalHeightCm / 100.0;
    bmi = Math.round((input.maternalWeightKg / (heightM * heightM)) * 10) / 10;
  }
  if (!bmi) bmi = 23.5;

  // Mean Arterial Pressure
  let map = input.meanArterialPressure;
  if (!map || map <= 0) {
    map = calculateMap(input.sbpRight, input.dbpRight, input.sbpLeft, input.dbpLeft);
  }
  const expectedMap = calculateExpectedMap(gaWeeks, gaDays, maternalAge, bmi);
  const mapMom = Math.round((map / expectedMap) * 100) / 100;

  // Mean Uterine Artery PI
  let utaPiMean = input.utaPiMean;
  if (!utaPiMean || utaPiMean <= 0) {
    if (input.utaPiLeft && input.utaPiRight) {
      utaPiMean = Math.round(((input.utaPiLeft + input.utaPiRight) / 2.0) * 100) / 100;
    } else if (input.utaPiLeft) {
      utaPiMean = input.utaPiLeft;
    } else if (input.utaPiRight) {
      utaPiMean = input.utaPiRight;
    } else {
      utaPiMean = 1.63; // normal median
    }
  }
  const expectedUtAPi = calculateExpectedUtAPi(gaWeeks, gaDays);
  const utaPiMom = Math.round((utaPiMean / expectedUtAPi) * 100) / 100;
  const utaBilateralNotching = Boolean(input.utaBilateralNotching);

  // Serum Biomarkers MoM
  let plgfMom: number | undefined = input.plgfMom;
  if (plgfMom === undefined && input.serumPlgfPgMl !== undefined) {
    const expPlgf = calculateExpectedPlgf(gaWeeks, gaDays);
    plgfMom = Math.round((input.serumPlgfPgMl / expPlgf) * 100) / 100;
  }

  const pappaMom: number | undefined = input.pappaMom;

  // 1. Clinical Risk Factor Assessment (NICE / ACOG guidelines)
  const clinicalFlags: string[] = [];
  let majorCount = 0;
  let moderateCount = 0;

  if (input.chronicHypertension) {
    majorCount++;
    clinicalFlags.push('Pre-existing chronic hypertension');
  }
  if (input.chronicKidneyDisease) {
    majorCount++;
    clinicalFlags.push('Pre-existing chronic kidney disease');
  }
  if (input.systemicLupusOrAps) {
    majorCount++;
    clinicalFlags.push('Autoimmune disease (SLE or Antiphospholipid Syndrome)');
  }
  if (input.pregestationalDiabetes) {
    majorCount++;
    clinicalFlags.push('Pre-gestational diabetes mellitus (Type 1 or 2)');
  }
  if (input.parity === 'multiparous_prior_pe') {
    majorCount++;
    clinicalFlags.push(
      `Previous hypertensive disease in pregnancy (${input.priorPeOnsetGestation || 'prior PE'})`,
    );
  }

  // Moderate risk factors
  if (input.parity === 'nulliparous') {
    moderateCount++;
    clinicalFlags.push('Nulliparity (first pregnancy)');
  }
  if (maternalAge >= 35) {
    moderateCount++;
    clinicalFlags.push(`Advanced maternal age (${maternalAge} years)`);
  }
  if (bmi >= 30) {
    moderateCount++;
    clinicalFlags.push(`Maternal obesity (BMI ${bmi.toFixed(1)} kg/m²)`);
  }
  if (input.familyHistoryPe) {
    moderateCount++;
    clinicalFlags.push('Family history of pre-eclampsia (mother/sister)');
  }
  if (
    input.interpregnancyIntervalYears !== undefined &&
    input.interpregnancyIntervalYears > 10
  ) {
    moderateCount++;
    clinicalFlags.push(
      `Interpregnancy interval > 10 years (${input.interpregnancyIntervalYears} yrs)`,
    );
  }
  if (input.conceptionMethod === 'ivf_art') {
    moderateCount++;
    clinicalFlags.push('Conception via IVF / Assisted Reproductive Technology');
  }

  let clinicalRiskCategory: 'high_risk' | 'moderate_risk' | 'low_risk' = 'low_risk';
  if (majorCount >= 1) {
    clinicalRiskCategory = 'high_risk';
  } else if (moderateCount >= 2) {
    clinicalRiskCategory = 'high_risk'; // >=2 moderate factors warrants Aspirin prophylaxis per NICE/ACOG
  } else if (moderateCount === 1) {
    clinicalRiskCategory = 'moderate_risk';
  }

  // 2. FMF Multi-Marker Combined Mathematical Algorithm
  // Baseline population risk for preterm PE (< 37 weeks) is approximately 1 in 130 (~0.0077)
  const baselineOdds = 0.0077;
  let maternalMultiplier = 1.0;

  // Parity / history multiplier
  if (input.parity === 'nulliparous') {
    maternalMultiplier *= 1.7;
  } else if (input.parity === 'multiparous_prior_pe') {
    if (input.priorPeOnsetGestation === 'early_lt_34') maternalMultiplier *= 8.0;
    else if (input.priorPeOnsetGestation === 'preterm_34_37') maternalMultiplier *= 5.0;
    else maternalMultiplier *= 3.5;
  } else {
    maternalMultiplier *= 0.6; // multiparous with no prior PE
  }

  // Comorbidities
  if (input.chronicHypertension) maternalMultiplier *= 5.2;
  if (input.chronicKidneyDisease) maternalMultiplier *= 6.5;
  if (input.systemicLupusOrAps) maternalMultiplier *= 8.0;
  if (input.pregestationalDiabetes) maternalMultiplier *= 3.4;
  if (input.familyHistoryPe) maternalMultiplier *= 2.6;
  if (input.conceptionMethod === 'ivf_art') maternalMultiplier *= 1.6;

  // Age multiplier
  if (maternalAge >= 40) maternalMultiplier *= 2.1;
  else if (maternalAge >= 35) maternalMultiplier *= 1.45;

  // BMI multiplier
  if (bmi >= 35) maternalMultiplier *= 3.2;
  else if (bmi >= 30) maternalMultiplier *= 2.1;
  else if (bmi >= 25) maternalMultiplier *= 1.35;

  // Ethnicity
  if (input.ethnicity === 'afro_caribbean') maternalMultiplier *= 1.7;
  else if (input.ethnicity === 'south_asian') maternalMultiplier *= 1.25;
  else if (input.ethnicity === 'east_asian') maternalMultiplier *= 0.85;

  // Smoking
  if (input.smokingStatus === 'smoker') maternalMultiplier *= 0.75;

  const backgroundOdds = baselineOdds * maternalMultiplier;
  const backgroundRiskNumeric = backgroundOdds / (1.0 + backgroundOdds);
  const backgroundDenom = Math.max(2, Math.round(1.0 / backgroundRiskNumeric));
  const backgroundRiskRatio = `1:${backgroundDenom}`;

  // Biophysical Likelihood Ratios
  // MAP LR
  let lrMap = 1.0;
  if (mapMom > 1.0) {
    lrMap = Math.pow(mapMom, 4.2);
  } else {
    lrMap = Math.pow(Math.max(0.6, mapMom), 2.0);
  }

  // UtA PI LR
  let lrUtA = 1.0;
  if (utaPiMom > 1.0) {
    lrUtA = Math.pow(utaPiMom, 3.6);
  } else {
    lrUtA = Math.pow(Math.max(0.5, utaPiMom), 1.6);
  }
  if (utaBilateralNotching) {
    lrUtA *= 1.65;
  }

  // Biochemical Likelihood Ratios
  let lrBiochem = 1.0;
  if (plgfMom !== undefined) {
    if (plgfMom < 1.0) {
      lrBiochem *= Math.pow(Math.max(0.15, plgfMom), -2.2);
    } else {
      lrBiochem *= Math.pow(plgfMom, -1.0);
    }
  }
  if (pappaMom !== undefined && pappaMom < 0.5) {
    lrBiochem *= 1.8;
  }

  // Posterior Combined Risk
  const posteriorOdds = backgroundOdds * lrMap * lrUtA * lrBiochem;
  const fmfRiskNumeric = posteriorOdds / (1.0 + posteriorOdds);
  const fmfDenom = Math.max(2, Math.round(1.0 / fmfRiskNumeric));
  const fmfRiskRatio = `1:${fmfDenom}`;

  const fmfRiskCategory: 'high_risk' | 'low_risk' =
    fmfDenom <= 100 || fmfRiskNumeric >= 0.01 ? 'high_risk' : 'low_risk';

  const overallRiskTier: 'high_risk' | 'low_risk' =
    fmfRiskCategory === 'high_risk' || clinicalRiskCategory === 'high_risk'
      ? 'high_risk'
      : 'low_risk';

  // 3. ASPRE Prophylaxis Protocol & Clinical Action Plan
  const aspirinIndicated = overallRiskTier === 'high_risk';
  const aspirinDoseMg = 150;
  const aspirinTimingRationale = aspirinIndicated
    ? 'Start Aspirin 150 mg PO once daily at bedtime immediately (ideally 11–14 weeks, strictly before 16+0 weeks). Continue uninterrupted until 36+0 weeks gestation.'
    : 'Routine low-dose Aspirin not indicated based on current first-trimester screening.';

  const calciumIndicated = aspirinIndicated;
  const calciumDoseMg = 1500;

  const surveillanceInterval = aspirinIndicated
    ? 'Enhanced antenatal visits: Every 2 weeks until 28 weeks, then weekly until delivery. Test urine for proteinuria & review blood pressure at every visit.'
    : 'Standard antenatal care schedule (every 4 weeks until 28 weeks, fortnightly until 36 weeks, weekly thereafter).';

  const repeatScanWeeks = aspirinIndicated
    ? 'Repeat Uterine Artery Doppler at 20–24 weeks anomaly scan. Serial fetal biometry scans at 28, 32, and 36 weeks to screen for secondary FGR.'
    : 'Routine fetal anomaly scan at 18–20 weeks.';

  const warningSignsEducation = [
    'Persistent, severe frontal or occipital headache unresponsive to paracetamol',
    'Visual disturbances: blurred vision, flashing lights (scotomata), or loss of vision',
    'Severe epigastric or right upper quadrant abdominal pain / nausea',
    'Sudden, marked swelling of face, hands, or feet',
    'Shortness of breath or sudden difficulty breathing',
    'Decreased fetal movements after 24–28 weeks',
  ];

  return {
    gestationalAgeWeeks: gaWeeks,
    gestationalAgeDays: gaDays,
    crlMm: input.crlMm,
    bmi: Math.round(bmi * 10) / 10,
    meanArterialPressure: map,
    mapMom,
    utaPiMean,
    utaPiMom,
    utaBilateralNotching,
    plgfMom,
    pappaMom,
    backgroundRiskRatio,
    backgroundRiskNumeric: Math.round(backgroundRiskNumeric * 100000) / 100000,
    fmfRiskRatio,
    fmfRiskNumeric: Math.round(fmfRiskNumeric * 100000) / 100000,
    fmfRiskCategory,
    clinicalRiskCategory,
    clinicalRiskFlags: clinicalFlags,
    overallRiskTier,
    aspirinIndicated,
    aspirinDoseMg,
    aspirinTimingRationale,
    calciumIndicated,
    calciumDoseMg,
    surveillanceInterval,
    repeatScanWeeks,
    warningSignsEducation,
  };
}
