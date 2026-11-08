// Pure TypeScript Clinical Calculation Engine: Pediatric Anaphylaxis Emergency Resuscitation & Refractory Shock
// References: World Allergy Organization (WAO 2020); EAACI Anaphylaxis Guidelines; AAP Clinical Guidance on Pediatric Anaphylaxis

export type AnaphylaxisTriggerType =
  | 'food_peanut_nut_milk_egg'
  | 'insect_venom_bee_wasp'
  | 'medication_antibiotic_nsaid'
  | 'vaccine_biologic'
  | 'latex'
  | 'exercise_or_cold'
  | 'idiopathic';

export type AnaphylaxisSeverityTier = 'mild_moderate' | 'severe_life_threatening' | 'refractory_shock';
export type AutoinjectorType = 'syringe_drawn' | 'epipen_jr_0_15mg' | 'epipen_adult_0_30mg';

export interface PediatricAnaphylaxisInput {
  ageMonths: number;
  weightKg: number;
  triggerType: AnaphylaxisTriggerType;
  triggerDetails?: string;

  // WAO multi-system manifestations
  skinMucosalInvolvement: boolean;
  respiratoryCompromise: boolean;
  cardiovascularHypotension: boolean;
  persistentGastrointestinal: boolean;

  // Vitals & prior response
  systolicBp?: number;
  heartRateBpm?: number;
  respiratoryRate?: number;
  spo2Percent?: number;
  stridorPresent?: boolean;
  priorImEpinephrineDosesGiven?: number;
  onBetaBlockerTherapy?: boolean;
}

export interface PediatricAnaphylaxisEvaluation {
  anaphylaxisCriteriaMet: boolean;
  criteriaExplanation: string;
  severityTier: AnaphylaxisSeverityTier;
  severityLabel: string;
  summary: string;

  // IM Epinephrine
  epinephrineImDoseMg: number;
  epinephrineImVolumeMl: number; // 1:1,000 concentration (1 mg/mL)
  recommendedAutoinjector: AutoinjectorType;
  autoinjectorLabel: string;
  injectionSite: string;
  repeatDoseIntervalMinutes: string;

  // Refractory Shock & Advanced Protocol
  refractoryShockDeclared: boolean;
  ivEpinephrineInfusionRecommended: boolean;
  startingIvEpinephrineRateMcgKgMin: number;
  maxIvEpinephrineRateMcgKgMin: number;
  fluidBolusVolumeMl: number; // 20 mL/kg
  h1AntihistamineDoseMg: number;
  h2AntagonistDoseMg: number;
  methylprednisoloneDoseMg: number;
  glucagonDoseMg: number;
  glucagonIndicated: boolean;

  // Surveillance
  biphasicSurveillanceHours: number;
  criticalResuscitationSteps: string[];
}

/**
 * Evaluates WAO 2020 Multi-System Diagnostic Criteria for Anaphylaxis.
 */
export function evaluateWaoCriteria(input: PediatricAnaphylaxisInput): { met: boolean; reason: string } {
  const { skinMucosalInvolvement, respiratoryCompromise, cardiovascularHypotension, persistentGastrointestinal } = input;

  // Criterion 1: Skin/mucosal involvement AND (respiratory OR cardiovascular)
  if (skinMucosalInvolvement && (respiratoryCompromise || cardiovascularHypotension)) {
    return {
      met: true,
      reason: 'WAO Criterion 1 Met: Acute mucocutaneous signs with respiratory compromise or hypotension/collapse.',
    };
  }

  // Criterion 2: >= 2 systems (skin, respiratory, cardiovascular, GI) following potential allergen
  const systemsInvolved = [skinMucosalInvolvement, respiratoryCompromise, cardiovascularHypotension, persistentGastrointestinal].filter(Boolean).length;
  if (systemsInvolved >= 2) {
    return {
      met: true,
      reason: `WAO Criterion 2 Met: Multi-system involvement (${systemsInvolved} of 4 organ systems) following allergen exposure.`,
    };
  }

  // Criterion 3: Isolated cardiovascular collapse/hypotension after known allergen
  if (cardiovascularHypotension && input.triggerType !== 'idiopathic') {
    return {
      met: true,
      reason: 'WAO Criterion 3 Met: Acute hypotension / circulatory collapse following exposure to known allergen.',
    };
  }

  return {
    met: false,
    reason: 'Anaphylaxis criteria not met: Isolated localized cutaneo-mucosal or single non-hypotensive symptom without systemic progression.',
  };
}

/**
 * Calculates weight-adjusted IM Epinephrine (1:1,000, 1 mg/mL): 0.01 mg/kg.
 * Minimum dose: 0.05 mg, Maximum dose: 0.50 mg.
 */
export function calculateEpinephrineImDose(weightKg: number): { doseMg: number; volumeMl: number } {
  const calculated = weightKg * 0.01;
  const doseMg = Math.min(0.50, Math.max(0.05, Math.round(calculated * 100) / 100));
  const volumeMl = doseMg; // Since 1:1,000 is 1 mg/mL
  return { doseMg, volumeMl };
}

/**
 * Recommends autoinjector or syringe delivery based on weight thresholds.
 */
export function recommendAutoinjector(weightKg: number): { type: AutoinjectorType; label: string } {
  if (weightKg < 7.5) {
    return {
      type: 'syringe_drawn',
      label: 'Syringe-Drawn 1:1,000 Epinephrine (Weight < 7.5 kg: autoinjector delivers excessive dose)',
    };
  }
  if (weightKg <= 25.0) {
    return {
      type: 'epipen_jr_0_15mg',
      label: 'EpiPen Jr / Junior Autoinjector (0.15 mg IM for weight 7.5 - 25 kg)',
    };
  }
  return {
    type: 'epipen_adult_0_30mg',
    label: 'EpiPen Adult / Standard Autoinjector (0.30 mg IM for weight > 25 kg)',
  };
}

/**
 * Evaluates comprehensive pediatric anaphylaxis resuscitation, IM epinephrine, refractory IV infusion, and biphasic surveillance.
 */
export function evaluatePediatricAnaphylaxis(input: PediatricAnaphylaxisInput): PediatricAnaphylaxisEvaluation {
  const wao = evaluateWaoCriteria(input);
  const { doseMg, volumeMl } = calculateEpinephrineImDose(input.weightKg);
  const autoinjector = recommendAutoinjector(input.weightKg);

  const priorDoses = input.priorImEpinephrineDosesGiven ?? 1;

  // Refractory shock: Persistent hypotension or severe bronchospasm after >= 2 IM doses
  const refractoryShockDeclared = priorDoses >= 2 && (input.cardiovascularHypotension || Boolean(input.stridorPresent));

  let severityTier: AnaphylaxisSeverityTier = 'mild_moderate';
  let severityLabel = 'Mild to Moderate Anaphylaxis';

  if (refractoryShockDeclared) {
    severityTier = 'refractory_shock';
    severityLabel = 'REFRACTORY ANAPHYLACTIC SHOCK';
  } else if (input.cardiovascularHypotension || input.stridorPresent || (input.spo2Percent !== undefined && input.spo2Percent < 92)) {
    severityTier = 'severe_life_threatening';
    severityLabel = 'Severe / Life-Threatening Anaphylaxis';
  } else {
    severityTier = 'mild_moderate';
    severityLabel = 'Mild to Moderate Anaphylaxis';
  }

  // Weight-based dosing for resuscitation adjuncts
  const fluidBolusVolumeMl = Math.round(input.weightKg * 20); // 20 mL/kg
  const h1AntihistamineDoseMg = Math.min(50, Math.round(input.weightKg * 1.0 * 10) / 10); // Diphenhydramine 1 mg/kg (max 50)
  const h2AntagonistDoseMg = Math.min(20, Math.round(input.weightKg * 0.5 * 10) / 10); // Famotidine 0.5 mg/kg (max 20)
  const methylprednisoloneDoseMg = Math.min(80, Math.round(input.weightKg * 1.5 * 10) / 10); // 1.5 mg/kg (max 80)
  const glucagonDoseMg = Math.min(1.0, Math.round(input.weightKg * 0.03 * 100) / 100); // 20-30 mcg/kg (max 1mg)
  const glucagonIndicated = Boolean(input.onBetaBlockerTherapy) && (input.cardiovascularHypotension || refractoryShockDeclared);

  // Surveillance duration
  const biphasicSurveillanceHours = severityTier === 'refractory_shock' ? 24 : severityTier === 'severe_life_threatening' ? 12 : 6;

  const criticalResuscitationSteps: string[] = [
    `IMMEDIATE INTRAMUSCULAR EPINEPHRINE: Inject ${doseMg} mg (${volumeMl} mL of 1:1,000) into anterolateral mid-thigh (vastus lateralis)`,
    'Position child supine with legs elevated (trendelenburg position). DO NOT allow patient to sit upright or stand suddenly',
    'High-flow oxygen via non-rebreather mask (10-15 L/min)',
    'Repeat IM Epinephrine dose every 5 to 15 minutes if symptoms persist (up to 3 total doses)',
  ];

  if (refractoryShockDeclared || input.cardiovascularHypotension) {
    criticalResuscitationSteps.push(`Vascular Access & Rapid Fluid Resuscitation: Infuse ${fluidBolusVolumeMl} mL Plasmalyte or Normal Saline over 5-10 min; repeat up to 40-60 mL/kg if hypotensive`);
    criticalResuscitationSteps.push('Initiate continuous IV Epinephrine infusion at 0.05-0.1 mcg/kg/min, titrating up to 1.0 mcg/kg/min for target SBP');
  }

  if (glucagonIndicated) {
    criticalResuscitationSteps.push(`Beta-blocker refractory alert: Administer IV Glucagon ${glucagonDoseMg} mg (30 mcg/kg, max 1 mg) over 5 minutes, followed by 5-15 mcg/min infusion`);
  }

  criticalResuscitationSteps.push(`Administer second-line adjuncts: Diphenhydramine ${h1AntihistamineDoseMg} mg IV + Famotidine ${h2AntagonistDoseMg} mg IV + Methylprednisolone ${methylprednisoloneDoseMg} mg IV`);
  criticalResuscitationSteps.push(`Mandatory biphasic reaction surveillance in monitored bay/PICU for ${biphasicSurveillanceHours} hours post-stabilization`);

  return {
    anaphylaxisCriteriaMet: wao.met,
    criteriaExplanation: wao.reason,
    severityTier,
    severityLabel,
    summary: wao.met
      ? `Anaphylaxis Diagnosis Confirmed: ${severityLabel}. Initial IM Epinephrine dose: ${doseMg} mg.`
      : 'Clinical manifestations do not meet strict criteria for acute anaphylaxis.',
    epinephrineImDoseMg: doseMg,
    epinephrineImVolumeMl: volumeMl,
    recommendedAutoinjector: autoinjector.type,
    autoinjectorLabel: autoinjector.label,
    injectionSite: 'Anterolateral middle third of the thigh (vastus lateralis)',
    repeatDoseIntervalMinutes: '5 to 15 minutes',
    refractoryShockDeclared,
    ivEpinephrineInfusionRecommended: refractoryShockDeclared,
    startingIvEpinephrineRateMcgKgMin: 0.1,
    maxIvEpinephrineRateMcgKgMin: 1.0,
    fluidBolusVolumeMl,
    h1AntihistamineDoseMg,
    h2AntagonistDoseMg,
    methylprednisoloneDoseMg,
    glucagonDoseMg,
    glucagonIndicated,
    biphasicSurveillanceHours,
    criticalResuscitationSteps,
  };
}
