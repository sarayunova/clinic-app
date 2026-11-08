// Pure TypeScript calculation engine for Pediatric DKA Cerebral Edema & Emergent Hyperosmolar Rescue Protocol
// Guidelines: ISPAD 2022 Guidelines / Muir Diagnostic Criteria for DKA Cerebral Edema

export interface PediatricDkaCerebralEdemaParams {
  ageYears: number;
  weightKg: number;
  gcsScore: number;
  headacheSevereSudden: boolean;
  lethargyOrConfusion: boolean;
  recurrentEmesisPostHydration: boolean;
  bradycardiaCushingTriad: boolean;
  hypertensionDiastolicGe90: boolean;
  cranialNervePalsy: boolean;
  pupillaryAbnormality: 'normal_reactive' | 'sluggish' | 'unequal_anisocoria' | 'dilated_fixed';
  decorticateDecerebratePosturing: boolean;
  bloodGlucoseMgDl: number;
  serumSodiumMeasuredMeqL: number;
  serumPotassiumMeqL: number;
  bloodPh: number;
  serumBicarbonateMeqL: number;
}

export interface PediatricDkaCerebralEdemaResult {
  serumSodiumCorrectedMeqL: number;
  effectiveSerumOsmolalityMosmKg: number;
  muirMajorCount: number;
  muirMinorCount: number;
  muirCriteriaCategory: 'diagnostic_cerebral_edema' | 'impending_warning_signs' | 'standard_dka_no_edema';
  muirCriteriaCategoryLabel: string;
  hyperosmolarRescueIndicated: boolean;
  primaryHyperosmolarAgent: 'hypertonic_saline_3pct' | 'mannitol_20pct' | 'dual_hyperosmolar_rescue';
  hyperosmolarSaline3PctDoseMl: number;
  mannitol20PctDoseMl: number;
  fluidRateReductionPercent: number;
  fluidManagementDirectives: string[];
  neuroprotectiveDirectives: string[];
  recommendations: string[];
  alerts: string[];
}

export type PediatricDkaCerebralEdemaEvaluationResult = PediatricDkaCerebralEdemaResult;

export function evaluatePediatricDkaCerebralEdema(
  params: PediatricDkaCerebralEdemaParams
): PediatricDkaCerebralEdemaResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const fluidManagementDirectives: string[] = [];
  const neuroprotectiveDirectives: string[] = [];

  // 1. Corrected Sodium: [Na]corr = [Na]measured + 1.6 * ((Glucose - 100) / 100)
  const glucoseExcess = Math.max(0, params.bloodGlucoseMgDl - 100);
  const correctedSodiumRaw = params.serumSodiumMeasuredMeqL + 1.6 * (glucoseExcess / 100);
  const serumSodiumCorrectedMeqL = Math.round(correctedSodiumRaw * 10) / 10;

  // 2. Effective Serum Osmolality: 2 * [Na]measured + (Glucose / 18)
  const effectiveOsmRaw = 2 * params.serumSodiumMeasuredMeqL + params.bloodGlucoseMgDl / 18;
  const effectiveSerumOsmolalityMosmKg = Math.round(effectiveOsmRaw * 10) / 10;

  // 3. Muir Criteria Count
  // Major Criteria:
  // - Decorticate/decerebrate posturing
  // - Cranial nerve palsy (e.g., III, IV, VI)
  // - Abnormal pupillary response (sluggish, anisocoria, dilated/fixed)
  // - Depressed sensorium / progressive GCS drop (GCS <= 12)
  let majorCount = 0;
  if (params.decorticateDecerebratePosturing) majorCount++;
  if (params.cranialNervePalsy) majorCount++;
  if (params.pupillaryAbnormality !== 'normal_reactive') majorCount++;
  if (params.gcsScore <= 12) majorCount++;

  // Minor Criteria:
  // - Recurrent emesis post-hydration
  // - Severe sudden headache
  // - Lethargy or confusion
  // - Diastolic BP >= 90 mmHg
  // - Age < 5 years
  // - Cushing's bradycardia
  let minorCount = 0;
  if (params.recurrentEmesisPostHydration) minorCount++;
  if (params.headacheSevereSudden) minorCount++;
  if (params.lethargyOrConfusion) minorCount++;
  if (params.hypertensionDiastolicGe90) minorCount++;
  if (params.ageYears < 5.0) minorCount++;
  if (params.bradycardiaCushingTriad) minorCount++;

  // Classification:
  // Diagnostic Cerebral Edema: 2 major, OR 1 major + 2 minor, OR posturing / pupillary compromise
  // Impending Warning Signs: 1 major OR >= 2 minor
  // Standard DKA No Edema: 0 major and < 2 minor
  let muirCriteriaCategory: 'diagnostic_cerebral_edema' | 'impending_warning_signs' | 'standard_dka_no_edema' =
    'standard_dka_no_edema';
  let muirCriteriaCategoryLabel = 'Standard DKA: No Clinical Evidence of Cerebral Edema';
  let hyperosmolarRescueIndicated = false;

  if (
    majorCount >= 2 ||
    (majorCount >= 1 && minorCount >= 2) ||
    params.decorticateDecerebratePosturing ||
    params.pupillaryAbnormality === 'dilated_fixed' ||
    params.pupillaryAbnormality === 'unequal_anisocoria' ||
    params.gcsScore <= 11
  ) {
    muirCriteriaCategory = 'diagnostic_cerebral_edema';
    muirCriteriaCategoryLabel = 'CRITICAL: Diagnostic Cerebral Edema (ISPAD / Muir Criteria Met)';
    hyperosmolarRescueIndicated = true;
    alerts.push(
      'RED ALERT: DIAGNOSTIC CEREBRAL EDEMA. High risk of transtentorial/tonsillar herniation. Administer stat hyperosmolar rescue therapy immediately without waiting for neuroimaging.'
    );
  } else if (majorCount === 1 || minorCount >= 2 || params.gcsScore <= 13) {
    muirCriteriaCategory = 'impending_warning_signs';
    muirCriteriaCategoryLabel = 'HIGH WARNING: Impending Cerebral Edema / Neurological Deterioration';
    hyperosmolarRescueIndicated = true;
    alerts.push(
      'NEUROLOGICAL WARNING: Multiple minor or 1 major Muir criteria observed. Prepare stat bedside hyperosmolar rescue agent and reduce fluid rates.'
    );
  }

  // Hyperosmolar dosing (3% Hypertonic Saline @ 5 mL/kg, 20% Mannitol @ 0.5-1.0 g/kg = 2.5-5 mL/kg)
  const hyperosmolarSaline3PctDoseMl = Math.round(params.weightKg * 5.0 * 10) / 10;
  const mannitol20PctDoseMl = Math.round(params.weightKg * 2.5 * 10) / 10; // 0.5 g/kg = 2.5 mL/kg of 20% solution

  // Primary agent selection: 3% Hypertonic Saline is preferred especially when hypotension or hyponatremia is present
  const primaryHyperosmolarAgent: 'hypertonic_saline_3pct' | 'mannitol_20pct' | 'dual_hyperosmolar_rescue' =
    params.serumSodiumMeasuredMeqL < 135 ? 'hypertonic_saline_3pct' : 'mannitol_20pct';

  // Directives
  fluidManagementDirectives.push('Immediately reduce intravenous fluid infusion rate by 30% to restrict free water entry into brain parenchyma.');
  fluidManagementDirectives.push(`Maintain target glucose between 150-250 mg/dL (current: ${params.bloodGlucoseMgDl} mg/dL) using dextrose-containing solutions once glucose < 250-300 mg/dL.`);
  fluidManagementDirectives.push(`Corrected Sodium is ${serumSodiumCorrectedMeqL} mEq/L (measured ${params.serumSodiumMeasuredMeqL} mEq/L). Measured sodium must rise as glucose drops; a failing or stagnant sodium warrants immediate sodium supplementation.`);

  neuroprotectiveDirectives.push('Elevate head of bed to 30 degrees in neutral midline orientation; avoid internal jugular compression.');
  neuroprotectiveDirectives.push('Administer oxygen to maintain SpO2 >= 95%; avoid aggressive hyperventilation unless active herniation is imminent (target PaCO2 30-35 mmHg).');
  neuroprotectiveDirectives.push('Perform hourly GCS and pupillary assessments. If signs worsen after initial osmolar dose, repeat dose or switch agent.');
  neuroprotectiveDirectives.push('PICU admission and stat urgent pediatric neurology/neurosurgery consultation.');

  if (hyperosmolarRescueIndicated) {
    recommendations.push(
      `STAT Hyperosmolar Rescue: Administer 3% Hypertonic Saline ${hyperosmolarSaline3PctDoseMl} mL (5 mL/kg) IV over 10-15 minutes OR 20% Mannitol ${mannitol20PctDoseMl} mL (0.5 g/kg = 2.5 mL/kg) IV over 15-20 minutes.`
    );
  } else {
    recommendations.push('Continue standard DKA fluid and insulin protocol with close serial neurological checks every 1 hour.');
  }

  if (params.bradycardiaCushingTriad && params.hypertensionDiastolicGe90) {
    alerts.push('CUSHING TRIAD DETECTED: Concomitant bradycardia and severe hypertension signify dangerously elevated intracranial pressure (ICP).');
  }

  if (params.pupillaryAbnormality === 'dilated_fixed' || params.pupillaryAbnormality === 'unequal_anisocoria') {
    alerts.push('PUPILLARY COMPROMISE: Anisocoria or fixed dilated pupil indicates impending uncal herniation with oculomotor nerve compression.');
  }

  return {
    serumSodiumCorrectedMeqL,
    effectiveSerumOsmolalityMosmKg,
    muirMajorCount: majorCount,
    muirMinorCount: minorCount,
    muirCriteriaCategory,
    muirCriteriaCategoryLabel,
    hyperosmolarRescueIndicated,
    primaryHyperosmolarAgent,
    hyperosmolarSaline3PctDoseMl,
    mannitol20PctDoseMl,
    fluidRateReductionPercent: 30,
    fluidManagementDirectives,
    neuroprotectiveDirectives,
    recommendations,
    alerts,
  };
}
