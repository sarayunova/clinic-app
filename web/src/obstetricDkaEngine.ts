// Pure TypeScript Clinical Calculation Engine: Obstetric Diabetic Ketoacidosis (DKA) & Euglycemic DKA
// References: ACOG Practice Bulletin; Sibai & Viteri (Am J Obstet Gynecol 2014); Kamalakannan et al. (Obstet Med 2010); Endocrine Society

export type ObstetricDkaSeverityTier = 'mild' | 'moderate' | 'severe_critical';
export type DiabetesType = 'pregestational_type1' | 'pregestational_type2' | 'gestational_gdm' | 'new_onset';
export type EfmCategory = 'category_1_normal' | 'category_2_indeterminate' | 'category_3_abnormal';

export interface ObstetricDkaInput {
  gestationWeeks: number;
  maternalWeightKg: number;
  diabetesType: DiabetesType;
  bloodGlucoseMgDl: number;
  arterialOrVenousPh: number;
  serumBicarbonateMeqL: number;
  serumSodiumMeqL: number;
  serumPotassiumMeqL: number;
  serumChlorideMeqL: number;
  serumKetonesBetaOhbMmolL?: number;
  urineKetones?: 'negative' | 'trace' | '1_plus' | '2_plus' | '3_plus' | '4_plus';

  // Fetal
  fetalHeartRateBaselineBpm?: number;
  fetalVariability?: 'normal_moderate' | 'minimal' | 'absent' | 'marked';
  decelerationsPresent?: 'none' | 'early' | 'variable' | 'late' | 'prolonged';
  efmCategory?: EfmCategory;
}

export interface ObstetricDkaEvaluation {
  calculatedAnionGap: number;
  correctedSodiumMeqL: number;
  effectiveOsmolalityMosmKg: number;
  isEuglycemicDka: boolean;
  dkaSeverityTier: ObstetricDkaSeverityTier;
  severityLabel: string;
  summary: string;

  // Fluid & Insulin Orders
  initialFluidBolusMl: number;
  maintenanceFluidRateMlHr: number;
  regularInsulinInfusionRateUnitsHr: number;
  dextroseThresholdMgDl: number;
  potassiumReplacementAdvice: string;
  holdInsulinForHypokalemia: boolean;

  // Fetal Resuscitation
  fetalResuscitationGuidance: string;
  deliveryContraindicatedDuringAcidosis: boolean;
  resolutionCriteriaMet: boolean;
  clinicalActionProtocol: string[];
}

/**
 * Calculates Serum Anion Gap: Na - (Cl + HCO3)
 * Normal: 8 - 12 mEq/L. High anion gap > 12 mEq/L indicates metabolic acidosis.
 */
export function calculateAnionGap(na: number, cl: number, hco3: number): number {
  const ag = na - (cl + hco3);
  return Math.round(ag * 10) / 10;
}

/**
 * Calculates Corrected Sodium for hyperglycemia: Na + 1.6 * ((Glucose - 100) / 100)
 */
export function calculateCorrectedSodium(na: number, glucose: number): number {
  if (glucose <= 100) return na;
  const corrected = na + 1.6 * ((glucose - 100) / 100);
  return Math.round(corrected * 10) / 10;
}

/**
 * Calculates Effective Serum Osmolality: 2*Na + Glucose/18
 */
export function calculateEffectiveOsmolality(na: number, glucose: number): number {
  const osm = 2 * na + (glucose / 18);
  return Math.round(osm * 10) / 10;
}

/**
 * Evaluates Obstetric DKA severity, detects euglycemic presentation, and calculates resuscitation protocol.
 */
export function evaluateObstetricDka(input: ObstetricDkaInput): ObstetricDkaEvaluation {
  const anionGap = calculateAnionGap(input.serumSodiumMeqL, input.serumChlorideMeqL, input.serumBicarbonateMeqL);
  const correctedNa = calculateCorrectedSodium(input.serumSodiumMeqL, input.bloodGlucoseMgDl);
  const effectiveOsm = calculateEffectiveOsmolality(input.serumSodiumMeqL, input.bloodGlucoseMgDl);

  // Euglycemic DKA: Blood glucose < 200 mg/dL with pH < 7.30 or HCO3 < 15 and anion gap > 12
  const isEuglycemicDka = input.bloodGlucoseMgDl < 200 && (input.arterialOrVenousPh < 7.30 || input.serumBicarbonateMeqL < 15) && anionGap > 12;

  // Severity Tier
  let dkaSeverityTier: ObstetricDkaSeverityTier = 'mild';
  let severityLabel = 'Mild Obstetric DKA';

  if (input.arterialOrVenousPh < 7.00 || input.serumBicarbonateMeqL < 10) {
    dkaSeverityTier = 'severe_critical';
    severityLabel = 'Severe / Critical Obstetric DKA';
  } else if (input.arterialOrVenousPh < 7.25 || input.serumBicarbonateMeqL < 15) {
    dkaSeverityTier = 'moderate';
    severityLabel = 'Moderate Obstetric DKA';
  } else {
    dkaSeverityTier = 'mild';
    severityLabel = 'Mild Obstetric DKA';
  }

  // Fluid Resuscitation: Initial 1000 mL normal saline in 1st hour
  const initialFluidBolusMl = 1000;
  const maintenanceFluidRateMlHr = 250;

  // Weight-based insulin infusion rate:
  // Standard: 0.1 units/kg/hr. Euglycemic DKA: 0.05 units/kg/hr to avoid precipitous hypoglycemia while clearing ketoacids
  const insulinPerKg = isEuglycemicDka ? 0.05 : 0.1;
  const regularInsulinInfusionRateUnitsHr = Math.round(input.maternalWeightKg * insulinPerKg * 10) / 10;

  // Dextrose threshold: When glucose reaches 200 mg/dL (or from start in euglycemic DKA), add 5% or 10% Dextrose
  const dextroseThresholdMgDl = 200;

  // Potassium Replacement Guidance
  let potassiumReplacementAdvice = '';
  let holdInsulinForHypokalemia = false;

  if (input.serumPotassiumMeqL < 3.3) {
    holdInsulinForHypokalemia = true;
    potassiumReplacementAdvice = 'CRITICAL HYPOKALEMIA (K < 3.3 mEq/L): HOLD insulin infusion! Administer IV KCl 20-40 mEq/hr until serum K > 3.3 mEq/L before starting or resuming insulin to prevent fatal arrhythmias.';
  } else if (input.serumPotassiumMeqL <= 5.0) {
    potassiumReplacementAdvice = `Serum K is ${input.serumPotassiumMeqL} mEq/L. Add 20 to 30 mEq KCl per liter of IV fluid to maintain serum potassium between 4.0 and 5.0 mEq/L.`;
  } else {
    potassiumReplacementAdvice = `Serum K is ${input.serumPotassiumMeqL} mEq/L (Hyperkalemic). Do not add potassium to fluids. Re-check potassium hourly as insulin drives K intracellularly.`;
  }

  // Fetal Resuscitation Advice
  let fetalResuscitationGuidance = 'Continuous Electronic Fetal Monitoring (EFM) indicated if viable gestation (>= 24 weeks).';
  const deliveryContraindicatedDuringAcidosis = true;

  if (input.gestationWeeks >= 24) {
    fetalResuscitationGuidance = 'DO NOT PERFORM IMMEDIATE CESAREAN DELIVERY FOR ABNORMAL FHR DURING ACUTE DKA: Fetal decelerations, tachycardia, and loss of variability reflect maternal acidemia and dehydration. Intrauterine resuscitation via maternal hydration, insulin, left lateral decubitus, and oxygen will restore reassuring fetal status. Delivery in uncorrected acidosis carries severe maternal and neonatal mortality.';
  }

  // Resolution Criteria: Glucose < 200 mg/dL, venous pH > 7.30, HCO3 >= 18 mEq/L, Anion gap <= 12
  const resolutionCriteriaMet =
    input.bloodGlucoseMgDl < 200 &&
    input.arterialOrVenousPh >= 7.30 &&
    input.serumBicarbonateMeqL >= 18 &&
    anionGap <= 12;

  const clinicalActionProtocol: string[] = [
    `Start IV Crystalloids: ${initialFluidBolusMl} mL over 1st hour, followed by ${maintenanceFluidRateMlHr} mL/hr`,
    holdInsulinForHypokalemia
      ? 'Hold insulin until potassium > 3.3 mEq/L'
      : `Initiate continuous regular insulin infusion at ${regularInsulinInfusionRateUnitsHr} units/hr IV`,
    isEuglycemicDka
      ? 'Euglycemic DKA detected: Start D5W or D10W infusion simultaneously with insulin to maintain blood glucose 140-180 mg/dL while closing the anion gap'
      : 'When blood glucose drops < 200 mg/dL, add 5% or 10% Dextrose to IV fluids while maintaining insulin infusion',
    'Hourly bedside capillary blood glucose checks; serial VBG and electrolytes every 2 to 4 hours',
    fetalResuscitationGuidance,
  ];

  return {
    calculatedAnionGap: anionGap,
    correctedSodiumMeqL: correctedNa,
    effectiveOsmolalityMosmKg: effectiveOsm,
    isEuglycemicDka,
    dkaSeverityTier,
    severityLabel: isEuglycemicDka ? `${severityLabel} (EUGLYCEMIC DKA)` : severityLabel,
    summary: isEuglycemicDka
      ? `Obstetric Euglycemic DKA: Blood glucose ${input.bloodGlucoseMgDl} mg/dL with metabolic acidosis (pH ${input.arterialOrVenousPh}, HCO3 ${input.serumBicarbonateMeqL} mEq/L, Anion Gap ${anionGap}).`
      : `Obstetric DKA: Blood glucose ${input.bloodGlucoseMgDl} mg/dL, pH ${input.arterialOrVenousPh}, HCO3 ${input.serumBicarbonateMeqL} mEq/L, Anion Gap ${anionGap}.`,
    initialFluidBolusMl,
    maintenanceFluidRateMlHr,
    regularInsulinInfusionRateUnitsHr,
    dextroseThresholdMgDl,
    potassiumReplacementAdvice,
    holdInsulinForHypokalemia,
    fetalResuscitationGuidance,
    deliveryContraindicatedDuringAcidosis,
    resolutionCriteriaMet,
    clinicalActionProtocol,
  };
}
