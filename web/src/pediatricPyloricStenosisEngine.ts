// Pure TypeScript calculation engine for Pediatric Infantile Hypertrophic Pyloric Stenosis (IHPS) Resuscitation Protocol
// Guidelines: APSA / BAPS Guidelines on IHPS Fluid and Electrolyte Optimization

export interface PediatricPyloricStenosisParams {
  ageWeeks: number;
  weightKg: number;
  birthWeightKg: number;
  vomitingProjectileNonBilious: boolean;
  hungryVomiterBehavior: boolean;
  palpableOliveMass: boolean;
  visibleGastricPeristalsis: boolean;
  dehydrationPercentage: number; // e.g. 5.0, 10.0
  ultrasoundPerformed: boolean;
  pyloricMuscleThicknessMm?: number;
  pyloricChannelLengthMm?: number;
  pyloricTransverseDiameterMm?: number;
  ultrasoundDiagnosticTargetSign: boolean;
  serumSodiumMeqL: number;
  serumPotassiumMeqL: number;
  serumChlorideMeqL: number;
  serumBicarbonateMeqL: number;
  bloodPh: number;
  urineOutputMlKgHr: number;
  potassiumSupplementationStarted: boolean;
  surgeryPerformed?: boolean;
}

export interface PyloricPreOpClearance {
  chlorideAdequate: boolean;
  bicarbonateAdequate: boolean;
  potassiumAdequate: boolean;
  urineOutputAdequate: boolean;
  allClearedForOr: boolean;
  clearanceSummary: string;
}

export interface PediatricPyloricStenosisResult {
  ultrasoundDiagnostic: boolean;
  ultrasoundDetails: string;
  metabolicDerangementTier: 'normal_or_mild' | 'moderate_hypochloremic_alkalosis' | 'severe_paradoxical_aciduria_risk';
  metabolicDerangementTierLabel: string;
  preOpClearance: PyloricPreOpClearance;
  fluidGuidance: string;
  recommendations: string[];
  alerts: string[];
}

export function evaluatePediatricPyloricStenosis(
  params: PediatricPyloricStenosisParams
): PediatricPyloricStenosisResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];

  // 1. Ultrasound Diagnostic Validation
  // Diagnostic threshold: Muscle thickness >= 3.0 mm (or 3.5), Length >= 14 mm
  const thickness = params.pyloricMuscleThicknessMm ?? 0;
  const length = params.pyloricChannelLengthMm ?? 0;
  const ultrasoundDiagnostic =
    params.ultrasoundPerformed &&
    (params.ultrasoundDiagnosticTargetSign || (thickness >= 3.0 && length >= 14.0));

  let ultrasoundDetails = 'Ultrasound not diagnostic or measurements pending.';
  if (ultrasoundDiagnostic) {
    ultrasoundDetails = `Diagnostic for IHPS: Pyloric thickness ${thickness} mm (≥3.0 mm) and length ${length} mm (≥14.0 mm). Target/doughnut sign confirmed.`;
  }

  // 2. Metabolic Derangement Stratification
  // Hypochloremic, Hypokalemic, Metabolic Alkalosis
  let metabolicDerangementTier: 'normal_or_mild' | 'moderate_hypochloremic_alkalosis' | 'severe_paradoxical_aciduria_risk' = 'normal_or_mild';
  let metabolicDerangementTierLabel = 'Mild / Controlled Electrolyte Profile';

  const isSevereAlkalosis =
    params.serumChlorideMeqL < 90.0 ||
    params.serumBicarbonateMeqL > 32.0 ||
    params.bloodPh > 7.55 ||
    params.serumPotassiumMeqL < 3.2;

  const isModerateAlkalosis =
    params.serumChlorideMeqL < 98.0 ||
    params.serumBicarbonateMeqL >= 28.0 ||
    params.bloodPh >= 7.46 ||
    params.serumPotassiumMeqL < 3.5;

  if (isSevereAlkalosis) {
    metabolicDerangementTier = 'severe_paradoxical_aciduria_risk';
    metabolicDerangementTierLabel = 'Severe Hypochloremic Alkalosis with Paradoxical Aciduria Risk (Cl <90, HCO3 >32)';
    alerts.push('CRITICAL CONTRAINDICATION: Severe alkalemia present. General anesthesia is ABSOLUTELY CONTRAINDICATED due to high risk of intraoperative apnea and cardiac depression.');
  } else if (isModerateAlkalosis) {
    metabolicDerangementTier = 'moderate_hypochloremic_alkalosis';
    metabolicDerangementTierLabel = 'Moderate Hypochloremic Hypokalemic Metabolic Alkalosis';
    alerts.push('Electrolyte derangement requires ongoing active fluid correction prior to surgical scheduling.');
  }

  // 3. Pre-Op Clearance Criteria
  // Cl > 100, HCO3 < 28 (or <30), K >= 3.5, UOP >= 1.0 mL/kg/h
  const chlorideAdequate = params.serumChlorideMeqL >= 100.0;
  const bicarbonateAdequate = params.serumBicarbonateMeqL <= 28.0;
  const potassiumAdequate = params.serumPotassiumMeqL >= 3.5;
  const urineOutputAdequate = params.urineOutputMlKgHr >= 1.0;

  const allClearedForOr =
    chlorideAdequate &&
    bicarbonateAdequate &&
    potassiumAdequate &&
    urineOutputAdequate;

  let clearanceSummary = '';
  if (allClearedForOr) {
    clearanceSummary = 'SURGICALLY CLEARED: Electrolytes normalized (Cl ≥100, HCO3 ≤28, K ≥3.5) with adequate urine output (≥1.0 mL/kg/h). Safe for Ramstedt pyloromyotomy.';
    recommendations.push('Schedule Ramstedt pyloromyotomy (laparoscopic or open). Maintain maintenance IV fluids until induction.');
  } else {
    clearanceSummary = 'NOT CLEARED FOR OR: Continue medical resuscitation. Premature surgical intervention carries severe anesthetic risk.';
    const deficientList: string[] = [];
    if (!chlorideAdequate) deficientList.push(`Chloride ${params.serumChlorideMeqL} < 100 mEq/L`);
    if (!bicarbonateAdequate) deficientList.push(`Bicarbonate ${params.serumBicarbonateMeqL} > 28 mEq/L`);
    if (!potassiumAdequate) deficientList.push(`Potassium ${params.serumPotassiumMeqL} < 3.5 mEq/L`);
    if (!urineOutputAdequate) deficientList.push(`Urine output ${params.urineOutputMlKgHr} < 1.0 mL/kg/h`);
    recommendations.push(`Pre-op criteria not met: ${deficientList.join(', ')}.`);
  }

  // 4. Fluid Resuscitation Regimen Guidance
  let fluidGuidance = '';
  if (params.dehydrationPercentage >= 10 || params.serumChlorideMeqL < 90) {
    fluidGuidance = 'Administer 0.9% Normal Saline 20 mL/kg IV bolus over 1 hour. Then infuse D5 0.45% or 0.9% NaCl with 20 mEq/L KCl at 1.5x maintenance once urine output is confirmed.';
    recommendations.push('High-rate fluid rehydration: Normal Saline bolus followed by D5 0.45% NaCl + KCl 20 mEq/L at 1.5x maintenance.');
  } else {
    fluidGuidance = 'Infuse D5 0.45% NaCl with 20 mEq/L KCl at 1.25x maintenance. Monitor serial electrolytes every 6-8 hours.';
    recommendations.push('Standard rehydration: D5 0.45% NaCl with 20 mEq/L KCl at 1.25x maintenance rate.');
  }

  // 5. Potassium alert rule
  if (!params.potassiumSupplementationStarted && urineOutputAdequate) {
    recommendations.push('Urine output confirmed (≥1.0 mL/kg/h). Add Potassium Chloride (KCl) 20 mEq/L to IV fluids to replenish intracellular potassium stores and reverse paradoxical aciduria.');
  } else if (!urineOutputAdequate) {
    alerts.push('CAUTION: Do NOT add IV potassium until adequate urine output (≥1.0 mL/kg/h) is documented.');
  }

  // 6. Clinical Presentation Alerts
  if (params.vomitingProjectileNonBilious && params.hungryVomiterBehavior) {
    recommendations.push('Classic IHPS presentation: Place baby NPO, insert and decompress stomach with 8-10 Fr orogastric/nasogastric tube.');
  }

  return {
    ultrasoundDiagnostic,
    ultrasoundDetails,
    metabolicDerangementTier,
    metabolicDerangementTierLabel,
    preOpClearance: {
      chlorideAdequate,
      bicarbonateAdequate,
      potassiumAdequate,
      urineOutputAdequate,
      allClearedForOr,
      clearanceSummary,
    },
    fluidGuidance,
    recommendations,
    alerts,
  };
}
