/**
 * Neonatal Hypoglycemia, GIR & aEEG Seizure Stewardship Decision Engine
 * Reference: AAP Clinical Report (2011) "Postnatal Glucose Homeostasis in Late-Preterm and Term Infants",
 * WHO/ILAE (2021) "Classification and Management of Neonatal Seizures", and Neonatal Neuro-Critical Care.
 */

export interface HypoglycemiaScreenInput {
  ageHours: number;
  bloodGlucoseMgDl: number;
  birthWeightKg: number;
  currentWeightKg: number;
  symptomsPresent: boolean;
  riskFactors?: string[];
}

export interface HypoglycemiaEvaluationResult {
  targetGlucoseMgDl: number;
  isHypoglycemic: boolean;
  severityTier: 'normoglycemic' | 'mild_asymptomatic' | 'moderate_asymptomatic' | 'severe_or_symptomatic';
  miniBolusIndicated: boolean;
  recommendedD10wBolusMl: number;
  recommendedGirMgKgMin: number;
  actionRecommendation: string;
  centralLineRecommended: boolean;
}

export interface GirCalculationInput {
  dextrosePercent: number;
  rateMlHr: number;
  weightKg: number;
}

export interface SeizureMedicationDosing {
  phenobarbitalInitialDoseMg: number;
  phenobarbitalRepeatDoseMg: number;
  levetiracetamInitialDoseMg: number;
  maintenancePhenobarbitalMgPerDay: number;
}

/**
 * Returns AAP age-specific blood glucose cut-off (mg/dL)
 */
export function calculateNeonatalGlucoseTarget(ageHours: number): number {
  if (ageHours < 4) {
    return 40.0;
  }
  if (ageHours < 24) {
    return 45.0;
  }
  return 50.0;
}

/**
 * Calculates Glucose Infusion Rate (GIR) in mg/kg/min
 * Formula: GIR = (% Dextrose * Fluid Rate in mL/hr) / (6 * Weight in kg)
 */
export function calculateGir(input: GirCalculationInput): number {
  if (input.weightKg <= 0 || input.dextrosePercent <= 0 || input.rateMlHr <= 0) {
    return 0;
  }
  const gir = (input.dextrosePercent * input.rateMlHr) / (6 * input.weightKg);
  return Math.round(gir * 100) / 100;
}

/**
 * Calculates IV infusion rate (mL/hr) required to deliver a desired GIR
 * Rate = (desiredGir * 6 * weightKg) / dextrosePercent
 */
export function calculateInfusionRateForGir(desiredGir: number, dextrosePercent: number, weightKg: number): number {
  if (desiredGir <= 0 || dextrosePercent <= 0 || weightKg <= 0) {
    return 0;
  }
  const rate = (desiredGir * 6 * weightKg) / dextrosePercent;
  return Math.round(rate * 10) / 10;
}

/**
 * Calculates 10% Dextrose (D10W) mini-bolus volume: 2 mL/kg IV over 5-10 minutes
 */
export function calculateD10wBolus(weightKg: number): number {
  if (weightKg <= 0) return 0;
  return Math.round(2.0 * weightKg * 10) / 10;
}

/**
 * Evaluates neonatal blood glucose against AAP guidelines and generates resuscitation plan
 */
export function evaluateNeonatalHypoglycemia(input: HypoglycemiaScreenInput): HypoglycemiaEvaluationResult {
  const target = calculateNeonatalGlucoseTarget(input.ageHours);
  const isHypoglycemic = input.bloodGlucoseMgDl < target;
  const weight = input.currentWeightKg > 0 ? input.currentWeightKg : input.birthWeightKg;
  const bolusMl = calculateD10wBolus(weight);

  let severityTier: HypoglycemiaEvaluationResult['severityTier'] = 'normoglycemic';
  let miniBolusIndicated = false;
  let recommendedGir = 0;
  let actionRecommendation = 'Continue routine feeding and observation.';
  let centralLineRecommended = false;

  if (isHypoglycemic) {
    if (input.symptomsPresent || input.bloodGlucoseMgDl < 25) {
      severityTier = 'severe_or_symptomatic';
      miniBolusIndicated = true;
      recommendedGir = 6.0;
      actionRecommendation = `STAT IV D10W mini-bolus of ${bolusMl} mL (2 mL/kg) over 5-10 min, followed immediately by continuous IV D10W infusion at GIR 6-8 mg/kg/min. Recheck blood glucose in 30 minutes.`;
    } else if (input.bloodGlucoseMgDl < 35) {
      severityTier = 'moderate_asymptomatic';
      miniBolusIndicated = false;
      recommendedGir = 6.0;
      actionRecommendation = `Initiate immediate supplementary feeding (breast milk or formula). If repeat glucose in 1 hour remains < ${target} mg/dL, start IV D10W at GIR 6 mg/kg/min.`;
    } else {
      severityTier = 'mild_asymptomatic';
      miniBolusIndicated = false;
      recommendedGir = 4.0;
      actionRecommendation = `Provide prompt breast feed or donor milk. Recheck blood glucose 1 hour post-feed.`;
    }
  }

  return {
    targetGlucoseMgDl: target,
    isHypoglycemic,
    severityTier,
    miniBolusIndicated,
    recommendedD10wBolusMl: bolusMl,
    recommendedGirMgKgMin: recommendedGir,
    actionRecommendation,
    centralLineRecommended,
  };
}

/**
 * Calculates neonatal anti-seizure medication doses (WHO/ILAE 2021)
 */
export function calculateNeonatalSeizureMedication(weightKg: number): SeizureMedicationDosing {
  const wt = weightKg > 0 ? weightKg : 3.0;
  return {
    phenobarbitalInitialDoseMg: Math.round(20.0 * wt * 10) / 10,
    phenobarbitalRepeatDoseMg: Math.round(10.0 * wt * 10) / 10,
    levetiracetamInitialDoseMg: Math.round(40.0 * wt * 10) / 10,
    maintenancePhenobarbitalMgPerDay: Math.round(3.5 * wt * 10) / 10,
  };
}

/**
 * Interprets aEEG background pattern per Hellström-Westas classification
 */
export function interpretAeegPattern(pattern: string): {
  category: 'normal' | 'mildly_abnormal' | 'severely_abnormal';
  clinicalMeaning: string;
  isHighSeizureRisk: boolean;
} {
  switch (pattern) {
    case 'continuous_normal_voltage':
      return {
        category: 'normal',
        clinicalMeaning: 'Continuous baseline with lower amplitude > 5 uV and upper amplitude > 10 uV. Reassuring electrocerebral activity.',
        isHighSeizureRisk: false,
      };
    case 'discontinuous_normal_voltage':
      return {
        category: 'mildly_abnormal',
        clinicalMeaning: 'Discontinuous background with minimum amplitude < 5 uV and maximum amplitude > 10 uV. Mild cortical depression or sedative effect.',
        isHighSeizureRisk: false,
      };
    case 'continuous_low_voltage':
      return {
        category: 'severely_abnormal',
        clinicalMeaning: 'Continuous low-voltage background with upper amplitude <= 10 uV. Moderate-to-severe cerebral compromise.',
        isHighSeizureRisk: true,
      };
    case 'burst_suppression':
      return {
        category: 'severely_abnormal',
        clinicalMeaning: 'Inactivated background (< 2 uV) with periodic high-amplitude paroxysmal bursts (> 25 uV). Severe encephalopathy / high seizure susceptibility.',
        isHighSeizureRisk: true,
      };
    case 'flat_trace':
      return {
        category: 'severely_abnormal',
        clinicalMeaning: 'Isoelectric background (< 5 uV throughout). Profound asphyxia, severe depression or brain death.',
        isHighSeizureRisk: true,
      };
    default:
      return {
        category: 'normal',
        clinicalMeaning: 'Standard continuous background activity.',
        isHighSeizureRisk: false,
      };
  }
}
