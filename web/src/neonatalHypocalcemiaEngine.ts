// Pure TypeScript Clinical Calculation Engine: Neonatal Hypocalcemia, Hypomagnesemia & Electrolyte Emergencies Protocol
// References: AAP / NICE Neonatal Guidelines; Gomella's Neonatology (8th Ed); Pediatric Endocrine Society Guidelines

export type HypocalcemiaOnsetTiming = 'early_onset_le_72h' | 'late_onset_gt_72h';

export type HypocalcemiaEtiology =
  | 'prematurity_respiratory_distress'
  | 'infant_of_diabetic_mother_idm'
  | 'birth_asphyxia_hie'
  | 'maternal_hyperparathyroidism'
  | 'hypoparathyroidism_digeorge'
  | 'high_phosphate_formula'
  | 'hypomagnesemia_induced'
  | 'idiopathic_other';

export type NeonatalSymptomDetails =
  | 'asymptomatic'
  | 'jitteriness_hyperreflexia'
  | 'tetany_carpopedal_spasm'
  | 'hypocalcemic_seizures'
  | 'apnea_cyanosis'
  | 'lethargy_poor_feeding';

export interface NeonatalHypocalcemiaInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  chronologicalAgeHours: number;
  currentWeightKg: number;
  etiologyCategory: HypocalcemiaEtiology;

  // Laboratory Biomarkers
  ionizedCalciumMmolL: number; // reference normal: 1.10 - 1.35 mmol/L (hypo: < 1.0 mmol/L)
  totalCalciumMgDl: number; // normal: 8.5 - 10.5 mg/dL (hypo: term < 8.0, preterm < 7.0)
  serumMagnesiumMgDl: number; // normal: 1.6 - 2.6 mg/dL (hypo: < 1.5 mg/dL / 0.6 mmol/L)
  serumPhosphorusMgDl?: number;
  serumAlbuminGDl?: number;
  alkalinePhosphataseUL?: number;

  // Neuromuscular & ECG Features
  symptomsPresent: boolean;
  symptomDetails: NeonatalSymptomDetails;
  ecgQtcSeconds?: number; // QTc > 0.44s suggests hypocalcemic prolongation
}

export interface NeonatalHypocalcemiaEvaluation {
  hypocalcemiaConfirmed: boolean;
  isPreterm: boolean;
  onsetTiming: HypocalcemiaOnsetTiming;
  totalCalciumThresholdMgDl: number;
  ionizedCalciumThresholdMmolL: number;
  correctedTotalCalciumMgDl?: number;

  // Emergency Bolus & Maintenance Calculations
  emergencyBolusIndicated: boolean;
  calciumGluconate10pctBolusMl: number;
  calciumGluconateMaintenanceMgKgDay: number;
  calciumGluconateMaintenanceMlPerDay: number;
  administrationProtocol: string;
  bradycardiaWarning: string;

  // Concurrent Hypomagnesemia
  concurrentHypomagnesemia: boolean;
  magnesiumSulfate50pctDoseMl?: number;
  magnesiumReplacementProtocol?: string;

  summary: string;
  criticalActionPlan: string[];
}

/**
 * Calculates 10% Calcium Gluconate IV bolus volume (100 - 200 mg/kg = 1.0 - 2.0 mL/kg, max 10 mL).
 */
export function calculateCalciumGluconateBolus(weightKg: number): number {
  const calculated = weightKg * 2.0; // 2.0 mL/kg of 10% Calcium Gluconate (200 mg/kg = 18 mg elemental Ca/kg)
  return Math.min(10.0, Math.round(calculated * 10) / 10);
}

/**
 * Calculates 10% Calcium Gluconate maintenance (200 - 800 mg/kg/day = 2.0 - 8.0 mL/kg/day).
 */
export function calculateCalciumMaintenance(weightKg: number, mgKgDay = 400): {
  doseMgPerDay: number;
  volumeMlPerDay: number;
} {
  const doseMgPerDay = Math.round(weightKg * mgKgDay);
  const volumeMlPerDay = Math.round((doseMgPerDay / 100) * 10) / 10; // 10% solution = 100 mg/mL
  return { doseMgPerDay, volumeMlPerDay };
}

/**
 * Calculates 50% Magnesium Sulfate dose for concurrent hypomagnesemia (0.1 - 0.2 mL/kg = 50 - 100 mg/kg).
 */
export function calculateMagnesiumBolus(weightKg: number): number {
  const calculated = weightKg * 0.2; // 0.2 mL/kg of 50% MgSO4 (100 mg/kg = 0.8 mEq/kg)
  return Math.round(calculated * 100) / 100;
}

/**
 * Evaluates neonatal hypocalcemia severity, onset timing, emergent IV bolus requirements, and concurrent hypomagnesemia.
 */
export function evaluateNeonatalHypocalcemia(input: NeonatalHypocalcemiaInput): NeonatalHypocalcemiaEvaluation {
  const isPreterm = input.gestationalAgeWeeks < 37.0;
  const totalCalciumThresholdMgDl = isPreterm ? 7.0 : 8.0;
  const ionizedCalciumThresholdMmolL = 1.0;

  const onsetTiming: HypocalcemiaOnsetTiming =
    input.chronologicalAgeHours <= 72 ? 'early_onset_le_72h' : 'late_onset_gt_72h';

  const hypocalcemiaConfirmed =
    input.ionizedCalciumMmolL < ionizedCalciumThresholdMmolL ||
    input.totalCalciumMgDl < totalCalciumThresholdMgDl;

  let correctedTotalCalciumMgDl: number | undefined;
  if (input.serumAlbuminGDl !== undefined && input.serumAlbuminGDl > 0) {
    correctedTotalCalciumMgDl =
      Math.round((input.totalCalciumMgDl + 0.8 * (4.0 - input.serumAlbuminGDl)) * 10) / 10;
  }

  const ecgProlonged = input.ecgQtcSeconds !== undefined && input.ecgQtcSeconds > 0.44;

  const severeSymptom =
    input.symptomDetails === 'hypocalcemic_seizures' ||
    input.symptomDetails === 'apnea_cyanosis' ||
    input.symptomDetails === 'tetany_carpopedal_spasm' ||
    input.symptomDetails === 'jitteriness_hyperreflexia';

  const emergencyBolusIndicated =
    (hypocalcemiaConfirmed && (input.symptomsPresent || severeSymptom || ecgProlonged)) ||
    input.ionizedCalciumMmolL < 0.8 ||
    input.totalCalciumMgDl < 6.0;

  const calciumGluconate10pctBolusMl = calculateCalciumGluconateBolus(input.currentWeightKg);
  const maintenance = calculateCalciumMaintenance(input.currentWeightKg, 400);

  const administrationProtocol =
    `Acute IV Bolus Protocol: Administer ${calciumGluconate10pctBolusMl} mL of 10% Calcium Gluconate (200 mg/kg) diluted 1:1 with 5% Dextrose (total volume ${Math.round(calciumGluconate10pctBolusMl * 2 * 10) / 10} mL). Infuse SLOWLY over 10-30 minutes via a confirmed patent peripheral venous line. Continuous cardiorespiratory and ECG monitoring active during entire infusion.`;

  const bradycardiaWarning =
    'CRITICAL SAFETY WARNING: Monitor heart rate continuously during infusion. STOP INFUSION IMMEDIATELY if heart rate drops < 100 bpm, severe bradycardia, or dysrhythmia occurs. NEVER administer via umbilical arterial catheter (aortic thrombosis risk) or umbilical venous line in portal vein. Extravasation causes severe tissue necrosis and calcinosis cutis.';

  const concurrentHypomagnesemia = input.serumMagnesiumMgDl < 1.5;
  let magnesiumSulfate50pctDoseMl: number | undefined;
  let magnesiumReplacementProtocol: string | undefined;

  if (concurrentHypomagnesemia) {
    magnesiumSulfate50pctDoseMl = calculateMagnesiumBolus(input.currentWeightKg);
    magnesiumReplacementProtocol =
      `Concurrent Hypomagnesemia Management: Serum Magnesium (${input.serumMagnesiumMgDl} mg/dL < 1.5 mg/dL) impairs parathyroid hormone release and end-organ response, causing refractory hypocalcemia. Administer ${magnesiumSulfate50pctDoseMl} mL of 50% Magnesium Sulfate (100 mg/kg = 0.2 mL/kg) IM or diluted in D5W infused IV over 1-2 hours. Calcium correction will remain refractory until magnesium is replenished.`;
  }

  const criticalActionPlan: string[] = [];
  if (emergencyBolusIndicated) {
    criticalActionPlan.push(`Deliver 10% Calcium Gluconate IV bolus: ${calciumGluconate10pctBolusMl} mL diluted 1:1 with D5W over 10-30 min`);
    criticalActionPlan.push('Continuous ECG monitor: immediately pause infusion if bradycardia (HR < 100 bpm) occurs');
    criticalActionPlan.push(`Initiate continuous IV maintenance infusion: ${maintenance.volumeMlPerDay} mL/day (400 mg/kg/day)`);
  } else if (hypocalcemiaConfirmed) {
    criticalActionPlan.push(`Initiate IV maintenance calcium infusion: ${maintenance.volumeMlPerDay} mL/day or oral calcium supplements (45-75 mg/kg/day elemental Ca)`);
    criticalActionPlan.push('Serial ionized calcium checks q12h until stable within normal range');
  }

  if (concurrentHypomagnesemia) {
    criticalActionPlan.push(`Replenish Magnesium: 50% MgSO4 ${magnesiumSulfate50pctDoseMl} mL slow IV / deep IM`);
  }

  criticalActionPlan.push('Verify peripheral IV patency q1h: avoid extravasation injury; never co-infuse with Ceftriaxone or Bicarbonate');

  const summary = `Neonatal Hypocalcemia (${onsetTiming === 'early_onset_le_72h' ? 'Early Onset ≤72h' : 'Late Onset >72h'}): iCa ${input.ionizedCalciumMmolL} mmol/L, Total Ca ${input.totalCalciumMgDl} mg/dL. ${emergencyBolusIndicated ? 'EMERGENCY IV CALCIUM GLUCONATE BOLUS INDICATED.' : 'STABLE SURVEILLANCE / MAINTENANCE THERAPY.'}${concurrentHypomagnesemia ? ' CONCURRENT HYPOMAGNESEMIA NOTED.' : ''}`;

  return {
    hypocalcemiaConfirmed,
    isPreterm,
    onsetTiming,
    totalCalciumThresholdMgDl,
    ionizedCalciumThresholdMmolL,
    correctedTotalCalciumMgDl,
    emergencyBolusIndicated,
    calciumGluconate10pctBolusMl,
    calciumGluconateMaintenanceMgKgDay: 400,
    calciumGluconateMaintenanceMlPerDay: maintenance.volumeMlPerDay,
    administrationProtocol,
    bradycardiaWarning,
    concurrentHypomagnesemia,
    magnesiumSulfate50pctDoseMl,
    magnesiumReplacementProtocol,
    summary,
    criticalActionPlan,
  };
}
