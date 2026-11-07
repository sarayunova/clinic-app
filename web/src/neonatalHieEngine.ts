// Neonatal Hypoxic-Ischemic Encephalopathy (HIE) & Therapeutic Hypothermia (TTM) Engine
// Reference: Sarnat & Sarnat Staging, TOBY / CoolCap Criteria, and NNF Clinical Practice Guidelines.

export interface NeonatalHieInput {
  gestationalAgeWeeks: number;
  birthWeightKg: number;
  hoursFromBirth: number;
  apgar10m?: number;
  resuscitationDurationMinutes?: number;
  cordOrArterialPh?: number;
  baseDeficitMmolL?: number;
  levelOfConsciousness: 'hyperalert' | 'lethargic_obtunded' | 'stuporous_comatose';
  muscleTone: 'normal' | 'hypotonic' | 'flaccid';
  primitiveReflexesSuckMoro: 'normal_exaggerated' | 'weak_incomplete' | 'absent';
  autonomicFunction: 'normal' | 'sympathetic_parasympathetic_skew' | 'depressed_bradycardia';
  clinicalSeizuresPresent: boolean;
}

export interface NeonatalHieAssessmentResult {
  sarnatStage: 'stage_I_mild' | 'stage_II_moderate' | 'stage_III_severe';
  sarnatStageLabel: string;
  isCoolingEligible: boolean;
  timeWindowStatus: 'optimal_under_6h' | 'caution_borderline_6h' | 'window_closed_over_6h';
  eligibilityReasons: string[];
  contraindicationsOrExclusions: string[];
  coolingProtocolSummary: {
    targetCoreTempCelsius: number;
    coolingDurationHours: number;
    rewarmingRateCelsiusPerHour: number;
    rewarmingDurationHours: number;
  };
  recommendedActions: string[];
  neuroprotectiveCareBundle: string[];
}

export function evaluateNeonatalHie(input: NeonatalHieInput): NeonatalHieAssessmentResult {
  const {
    gestationalAgeWeeks,
    birthWeightKg,
    hoursFromBirth,
    apgar10m,
    resuscitationDurationMinutes = 0,
    cordOrArterialPh,
    baseDeficitMmolL,
    levelOfConsciousness,
    muscleTone,
    primitiveReflexesSuckMoro,
    autonomicFunction,
    clinicalSeizuresPresent,
  } = input;

  // 1. Determine Sarnat Stage
  let sarnatStage: 'stage_I_mild' | 'stage_II_moderate' | 'stage_III_severe';
  let sarnatStageLabel: string;

  if (levelOfConsciousness === 'stuporous_comatose' || muscleTone === 'flaccid' || primitiveReflexesSuckMoro === 'absent') {
    sarnatStage = 'stage_III_severe';
    sarnatStageLabel = 'Sarnat Stage III (Severe Encephalopathy)';
  } else if (
    levelOfConsciousness === 'lethargic_obtunded' ||
    muscleTone === 'hypotonic' ||
    primitiveReflexesSuckMoro === 'weak_incomplete' ||
    clinicalSeizuresPresent
  ) {
    sarnatStage = 'stage_II_moderate';
    sarnatStageLabel = 'Sarnat Stage II (Moderate Encephalopathy)';
  } else {
    sarnatStage = 'stage_I_mild';
    sarnatStageLabel = 'Sarnat Stage I (Mild Encephalopathy)';
  }

  // 2. Assess Physiological Criteria (Criterion A)
  const eligibilityReasons: string[] = [];
  let criterionAMet = false;

  if (cordOrArterialPh !== undefined && cordOrArterialPh <= 7.00) {
    criterionAMet = true;
    eligibilityReasons.push(`Severe cord/blood gas acidemia: pH ${cordOrArterialPh} ≤ 7.00.`);
  } else if (baseDeficitMmolL !== undefined && baseDeficitMmolL >= 16.0) {
    criterionAMet = true;
    eligibilityReasons.push(`Marked base deficit: ${baseDeficitMmolL} mmol/L ≥ 16.0 mmol/L.`);
  } else if (
    (cordOrArterialPh !== undefined && cordOrArterialPh <= 7.15) ||
    (baseDeficitMmolL !== undefined && baseDeficitMmolL >= 10.0)
  ) {
    if ((apgar10m !== undefined && apgar10m <= 5) || resuscitationDurationMinutes >= 10) {
      criterionAMet = true;
      eligibilityReasons.push(`Moderate acidemia with prolonged resuscitation: Apgar 10m ≤ 5 or resuscitation ≥ 10 min.`);
    }
  }

  // 3. Assess Neurological Criteria (Criterion B)
  const criterionBMet = sarnatStage === 'stage_II_moderate' || sarnatStage === 'stage_III_severe' || clinicalSeizuresPresent;
  if (criterionBMet) {
    eligibilityReasons.push(`Neurological signs meet criteria: ${sarnatStageLabel} with seizures or hypotonia/depressed reflexes.`);
  }

  // 4. Time window
  let timeWindowStatus: 'optimal_under_6h' | 'caution_borderline_6h' | 'window_closed_over_6h';
  if (hoursFromBirth <= 5.5) {
    timeWindowStatus = 'optimal_under_6h';
  } else if (hoursFromBirth <= 6.0) {
    timeWindowStatus = 'caution_borderline_6h';
  } else {
    timeWindowStatus = 'window_closed_over_6h';
  }

  // 5. Contraindications / Exclusions
  const contraindicationsOrExclusions: string[] = [];
  if (gestationalAgeWeeks < 35.0) {
    contraindicationsOrExclusions.push(`Gestational age ${gestationalAgeWeeks} wks < 35.0 wks (Preterm cooling safety unproven).`);
  }
  if (birthWeightKg < 1.8) {
    contraindicationsOrExclusions.push(`Birth weight ${birthWeightKg} kg < 1.8 kg.`);
  }
  if (hoursFromBirth > 6.0) {
    contraindicationsOrExclusions.push(`Postnatal age ${hoursFromBirth}h > 6.0 hours (therapeutic window for primary neuronal rescue closed).`);
  }

  const isCoolingEligible =
    criterionAMet &&
    criterionBMet &&
    hoursFromBirth <= 6.0 &&
    gestationalAgeWeeks >= 35.0 &&
    birthWeightKg >= 1.8;

  const coolingProtocolSummary = {
    targetCoreTempCelsius: 33.5,
    coolingDurationHours: 72,
    rewarmingRateCelsiusPerHour: 0.5,
    rewarmingDurationHours: 6,
  };

  const recommendedActions: string[] = [];
  if (isCoolingEligible) {
    recommendedActions.push('URGENT: Initiate servo-controlled whole-body cooling blanket targeting rectal/esophageal temp 33.5°C.');
    recommendedActions.push('Connect continuous amplitude-integrated EEG (aEEG) to monitor for subclinical electrographic seizures.');
    recommendedActions.push('Place indwelling rectal thermistor probe at 3 - 5 cm insertion depth; secure firmly.');
    recommendedActions.push('Maintain strict fluid restriction (40 - 50 mL/kg/day) to prevent cerebral edema and acute tubular necrosis.');
  } else if (hoursFromBirth > 6.0 && (sarnatStage === 'stage_II_moderate' || sarnatStage === 'stage_III_severe')) {
    recommendedActions.push('Window for standard cooling is closed (>6h). Maintain strict normothermia (36.5 - 37.0°C); AVOID HYPERTHERMIA.');
  } else {
    recommendedActions.push('Perform serial neurological examinations every 2-4 hours to monitor for progression of encephalopathy.');
  }

  const neuroprotectiveCareBundle: string[] = [
    'Continuous invasive arterial line and central venous monitoring.',
    'Maintain blood glucose strictly between 50 - 150 mg/dL (avoid neuroglycopenia).',
    'Keep PaCO2 strictly within normal limits (38 - 45 mmHg); avoid hypocarbia which causes cerebral vasoconstriction.',
    'Treat electrographic/clinical seizures immediately with IV Phenobarbital (20 mg/kg loading dose over 20 min).',
  ];

  return {
    sarnatStage,
    sarnatStageLabel,
    isCoolingEligible,
    timeWindowStatus,
    eligibilityReasons,
    contraindicationsOrExclusions,
    coolingProtocolSummary,
    recommendedActions,
    neuroprotectiveCareBundle,
  };
}
