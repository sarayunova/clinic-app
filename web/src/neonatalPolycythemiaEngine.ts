// Pure TypeScript Clinical Calculation Engine: Neonatal Polycythemia, Hyperviscosity & Partial Exchange Transfusion (PET)
// References: AAP Guidelines; Gomella's Neonatology (8th Ed); UpToDate Neonatal Polycythemia Management

export type NeonatalSamplingSite = 'peripheral_venous' | 'umbilical_venous' | 'capillary_unconfirmed';

export type PolycythemiaSymptomDetails =
  | 'asymptomatic'
  | 'plethora_ruddy_appearance'
  | 'poor_feeding_lethargy'
  | 'jitteriness_tremors'
  | 'tachypnea_respiratory_distress'
  | 'hypoglycemia'
  | 'cyanosis_peripheral'
  | 'priapism_or_oliguria';

export interface NeonatalPolycythemiaInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  chronologicalAgeHours: number;
  currentWeightKg: number;

  samplingSite: NeonatalSamplingSite;
  venousHematocritPct: number; // Diagnostic cutoff >= 65% (venous sample)
  hemoglobinGDl?: number;
  bloodVolumeMlKg?: number; // default: 80 mL/kg term, 90 mL/kg preterm
  targetHematocritPct?: number; // standard default: 55.0%

  symptomsPresent: boolean;
  symptomDetails: PolycythemiaSymptomDetails;
  serumGlucoseMgDl?: number;
  plateletCount?: number;
  serumBilirubinMgDl?: number;
}

export interface NeonatalPolycythemiaEvaluation {
  polycythemiaConfirmed: boolean;
  isVenousSampleConfirmed: boolean;
  isPreterm: boolean;
  bloodVolumeMlKg: number;
  targetHematocritPct: number;

  partialExchangeIndicated: boolean;
  exchangeVolumeMl: number;
  recommendedAliquotSizeMl: number;
  numberOfAliquots: number;
  replacementFluid: string;
  hyperviscosityRiskTier: 'mild_asymptomatic' | 'moderate_symptomatic' | 'critical_extreme_polycythemia';
  riskDescription: string;

  safetyDirectives: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Calculates Partial Exchange Transfusion (PET) volume in mL:
 * Volume (mL) = [Weight (kg) * Blood Volume (mL/kg) * (Observed Hct - Desired Hct)] / Observed Hct
 */
export function calculatePetVolume(
  weightKg: number,
  observedHct: number,
  desiredHct = 55.0,
  bloodVolumeMlKg = 80.0,
): number {
  if (observedHct <= desiredHct) return 0;
  const totalBloodVolume = weightKg * bloodVolumeMlKg;
  const rawVolume = (totalBloodVolume * (observedHct - desiredHct)) / observedHct;
  return Math.round(rawVolume * 10) / 10;
}

/**
 * Calculates safe aliquot size for exchange (typically 5 mL/kg, max 20 mL per pass).
 */
export function calculateAliquotSize(weightKg: number): number {
  const aliquot = weightKg * 5.0;
  return Math.min(20.0, Math.max(5.0, Math.round(aliquot)));
}

/**
 * Evaluates neonatal polycythemia severity, hyperviscosity risks, and PET indication.
 */
export function evaluateNeonatalPolycythemia(
  input: NeonatalPolycythemiaInput,
): NeonatalPolycythemiaEvaluation {
  const isPreterm = input.gestationalAgeWeeks < 37.0;
  const defaultBv = isPreterm ? 90.0 : 80.0;
  const bloodVolumeMlKg = input.bloodVolumeMlKg ?? defaultBv;
  const targetHematocritPct = input.targetHematocritPct ?? 55.0;

  const isVenousSampleConfirmed = input.samplingSite !== 'capillary_unconfirmed';
  const polycythemiaConfirmed = input.venousHematocritPct >= 65.0;

  // Criteria for PET:
  // 1. Venous Hct > 70% even if asymptomatic (microvascular thrombosis risk)
  // 2. Venous Hct >= 65% with symptoms of hyperviscosity (plethora, lethargy, hypoglycemia, respiratory distress)
  let partialExchangeIndicated = false;
  let hyperviscosityRiskTier: 'mild_asymptomatic' | 'moderate_symptomatic' | 'critical_extreme_polycythemia' = 'mild_asymptomatic';
  let riskDescription = '';

  if (input.venousHematocritPct >= 70.0) {
    partialExchangeIndicated = true;
    hyperviscosityRiskTier = 'critical_extreme_polycythemia';
    riskDescription = 'Extreme Polycythemia (Venous Hct >= 70%): Critical hyperviscosity with exponential increase in blood viscosity. Partial exchange transfusion indicated regardless of symptoms to prevent cerebral infarction, renal vein thrombosis, and necrotizing enterocolitis.';
  } else if (polycythemiaConfirmed && input.symptomsPresent) {
    partialExchangeIndicated = true;
    hyperviscosityRiskTier = 'moderate_symptomatic';
    riskDescription = `Symptomatic Polycythemia (Venous Hct ${input.venousHematocritPct}% with ${input.symptomDetails.replace(/_/g, ' ')}): Hyperviscosity causing organ hypoperfusion. Partial exchange transfusion indicated.`;
  } else if (polycythemiaConfirmed) {
    partialExchangeIndicated = false;
    hyperviscosityRiskTier = 'mild_asymptomatic';
    riskDescription = `Asymptomatic Polycythemia (Venous Hct ${input.venousHematocritPct}%): Hyperviscosity risk present but microcirculation compensated. Partial exchange transfusion not immediately indicated; initiate IV hydration and monitor Hct q6-12h.`;
  } else {
    hyperviscosityRiskTier = 'mild_asymptomatic';
    riskDescription = `Venous Hematocrit ${input.venousHematocritPct}% is below the 65% diagnostic threshold for polycythemia.`;
  }

  const exchangeVolumeMl = partialExchangeIndicated
    ? calculatePetVolume(input.currentWeightKg, input.venousHematocritPct, targetHematocritPct, bloodVolumeMlKg)
    : 0;

  const recommendedAliquotSizeMl = calculateAliquotSize(input.currentWeightKg);
  const numberOfAliquots = exchangeVolumeMl > 0 ? Math.ceil(exchangeVolumeMl / recommendedAliquotSizeMl) : 0;
  const replacementFluid = '0.9% Normal Saline (Crystalloid)';

  const safetyDirectives: string[] = [
    'Use Normal Saline 0.9% for exchange; 5% Albumin offers no added benefit, increases cost and infection risk.',
    'Execute exchange via peripheral arterial/venous line or umbilical venous catheter (UVC). Never use umbilical artery catheter for infusion.',
    'Withdraw and infuse in small aliquots (5 mL/kg, ~10-20 mL per cycle) over 2-4 minutes each to maintain isovolemia and prevent hemodynamic swings.',
    'Monitor blood glucose closely before and after exchange: polycythemic neonates have higher rates of hypoglycemia due to increased red cell glucose consumption.',
    'Withhold enteral feeds for 4-6 hours post-PET to decrease risk of necrotizing enterocolitis (NEC).',
  ];

  if (!isVenousSampleConfirmed) {
    safetyDirectives.unshift('WARNING: Capillary hematocrit can be 5-15% higher than central venous hematocrit. MUST verify with free-flowing peripheral venous sample before initiating PET.');
  }

  const criticalActionPlan: string[] = [];
  if (partialExchangeIndicated) {
    criticalActionPlan.push(`Initiate Partial Exchange Transfusion (PET): Target Hct ${targetHematocritPct}%. Calculated exchange volume: ${exchangeVolumeMl} mL Normal Saline 0.9%.`);
    criticalActionPlan.push(`Execute in ${numberOfAliquots} aliquots of ~${recommendedAliquotSizeMl} mL each over 2-4 minutes per pass under continuous cardiopulmonary monitoring.`);
    criticalActionPlan.push('Check post-exchange venous hematocrit and blood glucose 2-4 hours after procedure.');
  } else if (polycythemiaConfirmed) {
    criticalActionPlan.push('Increase fluid intake by 20-30 mL/kg/day (IV hydration or oral feeds) to promote hemodilution.');
    criticalActionPlan.push('Re-check venous hematocrit in 6-8 hours and monitor for emerging hyperviscosity symptoms.');
  } else {
    criticalActionPlan.push('Routine neonatal care and observation; normopolycythemic.');
  }

  const summary = `Neonatal Polycythemia Evaluation: Venous Hct ${input.venousHematocritPct}% (${polycythemiaConfirmed ? 'Polycythemia Present' : 'Normal'}). ${partialExchangeIndicated ? `PET INDICATED: Exchange ${exchangeVolumeMl} mL with Normal Saline across ~${numberOfAliquots} aliquots.` : 'Conservative hydration and monitoring indicated.'}`;

  return {
    polycythemiaConfirmed,
    isVenousSampleConfirmed,
    isPreterm,
    bloodVolumeMlKg,
    targetHematocritPct,
    partialExchangeIndicated,
    exchangeVolumeMl,
    recommendedAliquotSizeMl,
    numberOfAliquots,
    replacementFluid,
    hyperviscosityRiskTier,
    riskDescription,
    safetyDirectives,
    summary,
    criticalActionPlan,
  };
}
