// Pediatric Respiratory Severity (PRAM) & Anaphylaxis Emergency Action Plan Engine
// Reference: Pediatric Respiratory Assessment Measure (PRAM), GINA Acute Asthma Pathway,
// and World Allergy Organization (WAO) Pediatric Anaphylaxis Protocols.

export interface PramAssessmentInput {
  oxygenSaturationPct: number;
  o2Score?: 0 | 1 | 2;
  suprasternalRetractionsScore: 0 | 2;
  scaleneMuscleContractionScore: 0 | 2;
  airEntryScore: 0 | 1 | 2 | 3;
  wheezingScore: 0 | 1 | 2 | 3;
  responseToBurstSaba?: 'good_response' | 'partial_response' | 'poor_deteriorating';
}

export interface PramAssessmentResult {
  o2Score: 0 | 1 | 2;
  totalPramScore: number; // 0 to 12
  severityTier: 'mild_0_3' | 'moderate_4_7' | 'impending_respiratory_failure_8_12';
  severityLabel: string;
  recommendedPathway: string;
  clinicalActions: string[];
  medicationsSummary: string[];
  dispositionRecommendation: string;
}

export function calculatePramScore(input: PramAssessmentInput): PramAssessmentResult {
  // Derive o2Score if not explicitly provided
  let o2Score: 0 | 1 | 2;
  if (input.o2Score !== undefined) {
    o2Score = input.o2Score;
  } else {
    if (input.oxygenSaturationPct >= 95) o2Score = 0;
    else if (input.oxygenSaturationPct >= 92) o2Score = 1;
    else o2Score = 2;
  }

  const totalPramScore =
    o2Score +
    input.suprasternalRetractionsScore +
    input.scaleneMuscleContractionScore +
    input.airEntryScore +
    input.wheezingScore;

  let severityTier: 'mild_0_3' | 'moderate_4_7' | 'impending_respiratory_failure_8_12';
  let severityLabel: string;
  let recommendedPathway: string;
  let dispositionRecommendation: string;
  const clinicalActions: string[] = [];
  const medicationsSummary: string[] = [];

  if (totalPramScore <= 3) {
    severityTier = 'mild_0_3';
    severityLabel = 'Mild Asthma Exacerbation (PRAM 0 - 3)';
    recommendedPathway = 'Step 1: Inhaled SABA (Salbutamol) via MDI with spacer (4-6 puffs every 20-30 mins as needed).';
    clinicalActions.push('Monitor SpO2 and reassess clinical PRAM score after 60 minutes.');
    clinicalActions.push('Educate family on inhaler technique and trigger avoidance.');
    medicationsSummary.push('Salbutamol MDI 100 mcg: 4 to 6 puffs via spacer.');
    dispositionRecommendation = 'Discharge home if stable at 1 hour post-bronchodilator with home asthma action plan.';
  } else if (totalPramScore <= 7) {
    severityTier = 'moderate_4_7';
    severityLabel = 'Moderate Asthma Exacerbation (PRAM 4 - 7)';
    recommendedPathway = 'Step 2: Burst SABA + Ipratropium Bromide + Early Systemic Corticosteroids.';
    clinicalActions.push('Administer burst bronchodilator therapy: 3 doses of Salbutamol + Ipratropium spaced 20 mins apart.');
    clinicalActions.push('Administer early oral systemic corticosteroid (within 1 hour of triage).');
    clinicalActions.push('Maintain oxygen saturation ≥ 94% with nasal cannula / face mask.');
    clinicalActions.push('Serial PRAM assessment at 60 and 120 minutes.');
    medicationsSummary.push('Salbutamol 2.5 - 5 mg nebulized OR 6 - 8 puffs MDI Q20min x 3 doses.');
    medicationsSummary.push('Ipratropium Bromide 250 mcg nebulized with Salbutamol Q20min x 3 doses.');
    medicationsSummary.push('Oral Dexamethasone 0.6 mg/kg (max 16 mg) OR Oral Prednisolone 1 - 2 mg/kg (max 50 mg).');
    dispositionRecommendation = 'Observation in pediatric emergency / step-down bed; hospital admission if PRAM remains ≥ 4 after 2 hours.';
  } else {
    severityTier = 'impending_respiratory_failure_8_12';
    severityLabel = 'Severe Exacerbation / Impending Respiratory Failure (PRAM 8 - 12) - EMERGENCY';
    recommendedPathway = 'Step 3: Continuous Inhaled Bronchodilators + Systemic Corticosteroids + IV Magnesium Sulfate + PICU Alert.';
    clinicalActions.push('IMMEDIATE PICU / High-Dependency Unit notification and standby.');
    clinicalActions.push('High-flow humidified oxygen targeting SpO2 94 - 98%.');
    clinicalActions.push('Establish urgent peripheral IV access for IV steroids and IV Magnesium Sulfate infusion.');
    clinicalActions.push('Prepare for non-invasive ventilation (BiPAP/CPAP) or endotracheal intubation if silent chest persists.');
    medicationsSummary.push('Continuous Salbutamol nebulization (0.5 mg/kg/hr, max 15 mg/hr) with continuous cardiac monitoring.');
    medicationsSummary.push('Ipratropium Bromide 250 - 500 mcg nebulized Q20min.');
    medicationsSummary.push('IV Methylprednisolone 1 - 2 mg/kg OR IV Hydrocortisone 4 mg/kg stat.');
    medicationsSummary.push('IV Magnesium Sulfate 50 mg/kg (max 2.0 g) infused over 20 - 30 minutes in 100 mL Normal Saline.');
    dispositionRecommendation = 'Immediate admission to Pediatric Intensive Care Unit (PICU).';
  }

  return {
    o2Score,
    totalPramScore,
    severityTier,
    severityLabel,
    recommendedPathway,
    clinicalActions,
    medicationsSummary,
    dispositionRecommendation,
  };
}

// Pediatric Anaphylaxis Action Plan Engine
export interface PediatricAnaphylaxisInput {
  childWeightKg: number;
  knownAllergens: string[];
}

export interface PediatricAnaphylaxisPlanResult {
  epinephrineImDoseMg: number;
  epinephrineImVolumeMl: number; // 1:1,000 solution (1 mg/mL)
  recommendedAutoinjectorType: 'epipen_jr_0_15mg' | 'epipen_adult_0_30mg' | 'ampoule_syringe_drawn';
  autoinjectorLabel: string;
  injectionSite: string;
  repeatWindowMinutes: string;
  emergencyStepByStep: string[];
  postEpisodeObservationHours: number;
}

export function calculatePediatricAnaphylaxisPlan(input: PediatricAnaphylaxisInput): PediatricAnaphylaxisPlanResult {
  const { childWeightKg } = input;
  const w = Math.max(3, childWeightKg);

  // Dose: 0.01 mg/kg of 1:1000 epinephrine (1 mg/mL)
  // Max dose: 0.3 mg for pre-pubertal, 0.5 mg for adult/adolescent
  const rawDose = w * 0.01;
  const epinephrineImDoseMg = Number(Math.min(0.5, Math.max(0.05, rawDose)).toFixed(2));
  const epinephrineImVolumeMl = epinephrineImDoseMg; // Because 1:1000 is 1 mg / 1 mL

  let recommendedAutoinjectorType: 'epipen_jr_0_15mg' | 'epipen_adult_0_30mg' | 'ampoule_syringe_drawn';
  let autoinjectorLabel: string;

  if (w < 7.5) {
    recommendedAutoinjectorType = 'ampoule_syringe_drawn';
    autoinjectorLabel = `Ampoule & Syringe Drawn (Weight < 7.5 kg): Exact dose ${epinephrineImVolumeMl} mL of 1:1,000 using 1 mL insulin syringe.`;
  } else if (w < 25) {
    recommendedAutoinjectorType = 'epipen_jr_0_15mg';
    autoinjectorLabel = 'EpiPen Jr® / Generic Autoinjector (0.15 mg) for weight 7.5 - 25 kg.';
  } else {
    recommendedAutoinjectorType = 'epipen_adult_0_30mg';
    autoinjectorLabel = 'EpiPen® Adult / Generic Autoinjector (0.30 mg) for weight ≥ 25 kg.';
  }

  const injectionSite = 'Anterolateral aspect of middle third of thigh (Vastus Lateralis muscle).';
  const repeatWindowMinutes = 'Repeat dose in 5 to 15 minutes if symptoms fail to improve or worsen.';

  const emergencyStepByStep: string[] = [
    '1. INJECT IMMEDIATELY: Administer Epinephrine IM into the outer mid-thigh. Note injection time.',
    '2. POSITION: Lay child flat with legs elevated. DO NOT allow child to stand or walk suddenly (prevents empty ventricle syndrome). If breathing is difficult, permit sitting up slightly.',
    '3. CALL FOR HELP: Dial Emergency Medical Services (Ambulance) immediately stating "Severe Anaphylaxis".',
    '4. REPEAT IF NEEDED: If no improvement within 5 to 10 minutes, inject a second dose of Epinephrine using a second device.',
    '5. ADJUNCTS ONLY AFTER EPINEPHRINE: Oral antihistamines or inhaled salbutamol may be given for hives or wheeze ONLY after Epinephrine is in place.',
  ];

  return {
    epinephrineImDoseMg,
    epinephrineImVolumeMl,
    recommendedAutoinjectorType,
    autoinjectorLabel,
    injectionSite,
    repeatWindowMinutes,
    emergencyStepByStep,
    postEpisodeObservationHours: 6, // 4-6 hours to monitor for biphasic anaphylaxis
  };
}
