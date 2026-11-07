/**
 * Pediatric Septic Shock, Vasoactive-Inotropic Score (VIS) & Fluid-Refractory Resuscitation Engine
 *
 * References:
 * - Surviving Sepsis Campaign International Guidelines for the Management of Septic Shock
 *   and Sepsis-Associated Organ Dysfunction in Children (Pediatr Crit Care Med 2020)
 * - Pediatric Advanced Life Support (PALS 2025 Guidelines)
 * - Gaies MG et al. Vasoactive-Inotropic Score (VIS) and Pediatric Outcomes (Crit Care Med)
 */

export interface PediatricShockPhenotypeInput {
  capillaryRefillSeconds: number;
  pulseQuality: 'normal' | 'bounding' | 'weak_thready' | 'absent';
  extremityTemperature: 'warm' | 'cool_mottled';
  sbp: number;
  dbp: number;
}

export interface PediatricShockPhenotypeResult {
  phenotype: 'cold_shock' | 'warm_shock' | 'indeterminate';
  phenotypeLabel: string;
  recommendedFirstLineVasoactive: 'epinephrine' | 'norepinephrine' | 'dobutamine';
  pulsePressure: number;
  isWidePulsePressure: boolean;
  isNarrowPulsePressure: boolean;
  hemodynamicDescription: string;
}

export interface FluidResuscitationSafetyInput {
  weightKg: number;
  cumulativeFluidMl: number;
  proposedBolusMl?: number;
  hepatomegalyPresent: boolean;
  pulmonaryCracklesPresent: boolean;
}

export interface FluidResuscitationSafetyResult {
  cumulativeFluidMlKg: number;
  isFluidOverload: boolean;
  isFluidRefractory: boolean;
  bolusPermitted: boolean;
  maxRecommendedBolusMl: number;
  overloadWarning?: string;
  recommendedNextAction: string;
}

export interface VisScoreInput {
  dopamineMcgKgMin?: number;
  dobutamineMcgKgMin?: number;
  epinephrineMcgKgMin?: number;
  norepinephrineMcgKgMin?: number;
  milrinoneMcgKgMin?: number;
  vasopressinUnitsKgMin?: number;
}

export interface VisScoreResult {
  visScore: number;
  severityTier: 'minimal' | 'low' | 'moderate' | 'severe_critical';
  tierLabel: string;
  picuEscalationRequired: boolean;
  ecmoStandbyAdvised: boolean;
  clinicalInterpretation: string;
}

/**
 * Classifies Pediatric Septic Shock Phenotype (Cold vs. Warm Shock)
 */
export function classifyPediatricShockPhenotype(input: PediatricShockPhenotypeInput): PediatricShockPhenotypeResult {
  const pulsePressure = input.sbp - input.dbp;
  const isWidePulsePressure = pulsePressure > 45;
  const isNarrowPulsePressure = pulsePressure < 25;

  let phenotype: 'cold_shock' | 'warm_shock' | 'indeterminate';
  let phenotypeLabel: string;
  let recommendedFirstLineVasoactive: 'epinephrine' | 'norepinephrine' | 'dobutamine';
  let hemodynamicDescription: string;

  if (
    input.capillaryRefillSeconds > 2 ||
    input.extremityTemperature === 'cool_mottled' ||
    input.pulseQuality === 'weak_thready' ||
    input.pulseQuality === 'absent'
  ) {
    phenotype = 'cold_shock';
    phenotypeLabel = 'Cold Shock (Hypodynamic / High SVR / Low Cardiac Output)';
    recommendedFirstLineVasoactive = 'epinephrine';
    hemodynamicDescription =
      'Characterized by poor peripheral perfusion, vasoconstriction, and myocardial dysfunction. First-line vasoactive is Epinephrine infusion (0.05–0.3 mcg/kg/min).';
  } else if (
    (input.capillaryRefillSeconds < 1 || isWidePulsePressure || input.pulseQuality === 'bounding') &&
    input.extremityTemperature === 'warm'
  ) {
    phenotype = 'warm_shock';
    phenotypeLabel = 'Warm Shock (Hyperdynamic / Low SVR / Vasodilatory)';
    recommendedFirstLineVasoactive = 'norepinephrine';
    hemodynamicDescription =
      'Characterized by distributive vasodilation and wide pulse pressure. First-line vasoactive is Norepinephrine infusion (0.05–0.3 mcg/kg/min) to restore vascular tone.';
  } else {
    phenotype = 'indeterminate';
    phenotypeLabel = 'Undifferentiated Septic Shock';
    recommendedFirstLineVasoactive = 'epinephrine';
    hemodynamicDescription =
      'Mixed or transitional presentation. Continuous serial bedside reassessment warranted with central/arterial monitoring.';
  }

  return {
    phenotype,
    phenotypeLabel,
    recommendedFirstLineVasoactive,
    pulsePressure,
    isWidePulsePressure,
    isNarrowPulsePressure,
    hemodynamicDescription
  };
}

/**
 * Validates Fluid Bolus Safety and Detects Fluid Overload / Fluid-Refractory Shock
 */
export function evaluateFluidResuscitationSafety(
  input: FluidResuscitationSafetyInput
): FluidResuscitationSafetyResult {
  const weight = Math.max(input.weightKg, 1.0);
  const cumulativeFluidMlKg = Math.round((input.cumulativeFluidMl / weight) * 10) / 10;
  const maxRecommendedBolusMl = Math.round(weight * 20); // standard 20 mL/kg bolus

  const isFluidOverload = input.hepatomegalyPresent || input.pulmonaryCracklesPresent;
  const isFluidRefractory = cumulativeFluidMlKg >= 40 || (cumulativeFluidMlKg >= 20 && isFluidOverload);

  let bolusPermitted = true;
  let overloadWarning: string | undefined;
  let recommendedNextAction: string;

  if (isFluidOverload) {
    bolusPermitted = false;
    overloadWarning = `CRITICAL ALERT: Overt signs of fluid overload detected (${[
      input.hepatomegalyPresent ? 'Hepatomegaly (>2cm descent)' : '',
      input.pulmonaryCracklesPresent ? 'Pulmonary rales / crackles' : ''
    ]
      .filter(Boolean)
      .join(', ')}). HOLD FURTHER FLUID BOLUSES!`;
    recommendedNextAction =
      'Immediate inotrope/vasopressor initiation. Avoid pulmonary edema and worsening hypoxemia. Prepare for respiratory support.';
  } else if (cumulativeFluidMlKg >= 60) {
    bolusPermitted = false;
    overloadWarning = `Maximum initial resuscitation threshold reached (${cumulativeFluidMlKg} mL/kg >= 60 mL/kg). Shock is fluid-refractory.`;
    recommendedNextAction =
      'Initiate central vasoactive support immediately (Epinephrine or Norepinephrine). Do not administer further unguided boluses.';
  } else if (cumulativeFluidMlKg >= 40) {
    bolusPermitted = true;
    recommendedNextAction = `Administered ${cumulativeFluidMlKg} mL/kg crystalloid. Reassess perfusion and vitals immediately. Prepare vasoactive infusion lines.`;
  } else {
    bolusPermitted = true;
    recommendedNextAction = `Safe to administer balanced crystalloid bolus (10–20 mL/kg = up to ${maxRecommendedBolusMl} mL over 10–20 min). Re-evaluate liver edge and lungs post-bolus.`;
  }

  return {
    cumulativeFluidMlKg,
    isFluidOverload,
    isFluidRefractory,
    bolusPermitted,
    maxRecommendedBolusMl,
    overloadWarning,
    recommendedNextAction
  };
}

/**
 * Calculates Vasoactive-Inotropic Score (VIS)
 * Formula: Dopamine + Dobutamine + (100 * Epi) + (100 * Norepi) + (10 * Milrinone) + (10000 * Vasopressin)
 */
export function calculateVisScore(input: VisScoreInput): VisScoreResult {
  const dopamine = input.dopamineMcgKgMin || 0;
  const dobutamine = input.dobutamineMcgKgMin || 0;
  const epinephrine = input.epinephrineMcgKgMin || 0;
  const norepinephrine = input.norepinephrineMcgKgMin || 0;
  const milrinone = input.milrinoneMcgKgMin || 0;
  const vasopressin = input.vasopressinUnitsKgMin || 0;

  const rawScore =
    dopamine +
    dobutamine +
    100 * epinephrine +
    100 * norepinephrine +
    10 * milrinone +
    10000 * vasopressin;

  const visScore = Math.round(rawScore * 10) / 10;

  let severityTier: 'minimal' | 'low' | 'moderate' | 'severe_critical';
  let tierLabel: string;
  let picuEscalationRequired = false;
  let ecmoStandbyAdvised = false;
  let clinicalInterpretation: string;

  if (visScore >= 20) {
    severityTier = 'severe_critical';
    tierLabel = 'Severe / Extreme Inotropic Support (VIS >= 20)';
    picuEscalationRequired = true;
    ecmoStandbyAdvised = true;
    clinicalInterpretation =
      'Markedly elevated VIS (>= 20) is strongly correlated with multi-organ dysfunction syndrome (MODS) and prolonged mechanical ventilation. Senior PICU consultant at bedside. Consider ECMO standby and stress-dose hydrocortisone.';
  } else if (visScore >= 10) {
    severityTier = 'moderate';
    tierLabel = 'Moderate Inotropic Support (VIS 10-19.9)';
    picuEscalationRequired = true;
    clinicalInterpretation =
      'Moderate vasoactive requirement. Requires continuous invasive arterial blood pressure monitoring and serial lactate clearance tracking.';
  } else if (visScore > 0) {
    severityTier = 'low';
    tierLabel = 'Low Inotropic Support (VIS 0.1-9.9)';
    picuEscalationRequired = false;
    clinicalInterpretation =
      'Mild inotrope requirement. Continue titration to target mean arterial pressure and adequate urine output (> 1 mL/kg/hr).';
  } else {
    severityTier = 'minimal';
    tierLabel = 'No Inotropic Support (VIS 0)';
    picuEscalationRequired = false;
    clinicalInterpretation = 'Patient is not currently receiving continuous vasoactive infusions.';
  }

  return {
    visScore,
    severityTier,
    tierLabel,
    picuEscalationRequired,
    ecmoStandbyAdvised,
    clinicalInterpretation
  };
}
