// ============================================================================
// Pediatric Acute Appendicitis & Pediatric Appendicitis Score (PAS / Samuel)
// References:
// 1. Samuel M. Pediatric Appendicitis Score. J Pediatr Surg. 2002;37(6):877-881.
// 2. Alvarado A. A practical score for the early diagnosis of acute appendicitis. Ann Emerg Med.
// 3. American Pediatric Surgical Association (APSA) Evidence-Based Practice Guidelines
// 4. Nelson Textbook of Pediatrics (21st Ed) - Acute Appendicitis in Children
// ============================================================================

export type ManagementPathway =
  | 'urgent_laparoscopic_appendectomy'
  | 'open_appendectomy'
  | 'non_operative_iv_antibiotics'
  | 'percutaneous_abscess_drainage_interval'
  | 'discharge_observation';

export type EmpiricAntibioticRegimen =
  | 'none'
  | 'ceftriaxone_plus_metronidazole'
  | 'piperacillin_tazobactam'
  | 'ampicillin_gentamicin_metronidazole'
  | 'ciprofloxacin_plus_metronidazole';

export type SurgicalFindings =
  | 'uncomplicated_suppurative'
  | 'gangrenous_intact'
  | 'perforated_localized_phlegmon'
  | 'perforated_generalized_peritonitis'
  | 'normal_appendix';

export interface PediatricAppendicitisInput {
  ageYears: number;
  weightKg: number;
  symptomDurationHours: number;

  // Samuel PAS Criteria (0-10)
  coughPercussionHoppingRlqPain: boolean; // 2 pts
  rlqTendernessLightPalpation: boolean;   // 2 pts
  migrationPainToRlq: boolean;           // 1 pt
  feverGt38c: boolean;                   // 1 pt
  nauseaOrVomiting: boolean;             // 1 pt
  anorexia: boolean;                     // 1 pt
  leukocytosisWbcGt10000: boolean;       // 1 pt
  neutrophiliaAncGt7500OrGe75pct: boolean; // 1 pt

  wbcCountPerMicroliter?: number;
  neutrophilPercent?: number;
  crpMgL?: number;

  ultrasoundPerformed: boolean;
  appendixVisualized: boolean;
  outerDiameterMm?: number;
  nonCompressible: boolean;
  hypervascularRingOfFire: boolean;
  appendicolithFecalithPresent: boolean;
  periappendicealFluidOrFatStranding: boolean;
  perforationOrAbscessSuspected: boolean;

  managementPathway: ManagementPathway;
  empiricAntibioticRegimen: EmpiricAntibioticRegimen;
  surgicalFindings?: SurgicalFindings;
}

export interface PediatricAppendicitisEvaluation {
  pasScoreTotal: number;
  riskTier: 'low_risk_le_3' | 'intermediate_equivocal_4_to_6' | 'high_risk_ge_7';
  riskTierLabel: string;
  predictedProbabilityPercent: number;

  ultrasoundDefinitiveForAppendicitis: boolean;
  perforationRiskElevated: boolean;
  urgentSurgeryIndicated: boolean;
  antibioticsRecommended: boolean;

  criteriaMetList: string[];
  clinicalDirectives: string[];
  actionPlan: string[];
  summary: string;
}

export function calculateSamuelPasScore(input: {
  coughPercussionHoppingRlqPain: boolean;
  rlqTendernessLightPalpation: boolean;
  migrationPainToRlq: boolean;
  feverGt38c: boolean;
  nauseaOrVomiting: boolean;
  anorexia: boolean;
  leukocytosisWbcGt10000: boolean;
  neutrophiliaAncGt7500OrGe75pct: boolean;
}): number {
  let score = 0;
  if (input.coughPercussionHoppingRlqPain) score += 2;
  if (input.rlqTendernessLightPalpation) score += 2;
  if (input.migrationPainToRlq) score += 1;
  if (input.feverGt38c) score += 1;
  if (input.nauseaOrVomiting) score += 1;
  if (input.anorexia) score += 1;
  if (input.leukocytosisWbcGt10000) score += 1;
  if (input.neutrophiliaAncGt7500OrGe75pct) score += 1;
  return score;
}

export function evaluatePediatricAppendicitis(
  input: PediatricAppendicitisInput,
): PediatricAppendicitisEvaluation {
  const pasScoreTotal = calculateSamuelPasScore({
    coughPercussionHoppingRlqPain: input.coughPercussionHoppingRlqPain,
    rlqTendernessLightPalpation: input.rlqTendernessLightPalpation,
    migrationPainToRlq: input.migrationPainToRlq,
    feverGt38c: input.feverGt38c,
    nauseaOrVomiting: input.nauseaOrVomiting,
    anorexia: input.anorexia,
    leukocytosisWbcGt10000: input.leukocytosisWbcGt10000,
    neutrophiliaAncGt7500OrGe75pct: input.neutrophiliaAncGt7500OrGe75pct,
  });

  let riskTier: PediatricAppendicitisEvaluation['riskTier'] = 'low_risk_le_3';
  let riskTierLabel = `Low Risk (PAS ${pasScoreTotal}/10 <= 3): Appendicitis Unlikely (<5% probability)`;
  let predictedProbabilityPercent = 4.0;

  if (pasScoreTotal >= 7) {
    riskTier = 'high_risk_ge_7';
    riskTierLabel = `High Risk (PAS ${pasScoreTotal}/10 >= 7): Appendicitis Highly Probable (>90% probability)`;
    predictedProbabilityPercent = 92.0;
  } else if (pasScoreTotal >= 4) {
    riskTier = 'intermediate_equivocal_4_to_6';
    riskTierLabel = `Intermediate / Equivocal Risk (PAS ${pasScoreTotal}/10 [4-6]): Indeterminate (35-50% probability)`;
    predictedProbabilityPercent = 42.0;
  }

  // Ultrasound criteria evaluation: outer diameter >= 6.0 mm, non-compressible, wall hyperemia
  const ultrasoundDefinitiveForAppendicitis =
    input.ultrasoundPerformed &&
    input.appendixVisualized &&
    ((input.outerDiameterMm !== undefined && input.outerDiameterMm >= 6.0) ||
      (input.nonCompressible && input.hypervascularRingOfFire));

  // Perforation risk: Young child (< 4 yo), prolonged symptoms (> 48h), or ultrasound signs of phlegmon/abscess
  const perforationRiskElevated =
    input.perforationOrAbscessSuspected ||
    input.symptomDurationHours >= 48.0 ||
    input.ageYears < 4.0;

  // Urgent surgery indication
  const urgentSurgeryIndicated =
    (pasScoreTotal >= 7 || ultrasoundDefinitiveForAppendicitis) &&
    !input.perforationOrAbscessSuspected; // uncomplicated phlegmon/abscess may undergo interval therapy

  const antibioticsRecommended =
    pasScoreTotal >= 4 ||
    ultrasoundDefinitiveForAppendicitis ||
    input.perforationOrAbscessSuspected;

  // Criteria Met List
  const criteriaMetList: string[] = [];
  if (input.coughPercussionHoppingRlqPain) criteriaMetList.push('Cough / percussion / hopping tenderness in RLQ (+2)');
  if (input.rlqTendernessLightPalpation) criteriaMetList.push('Tenderness in RLQ to light palpation (+2)');
  if (input.migrationPainToRlq) criteriaMetList.push('Migration of abdominal pain to RLQ (+1)');
  if (input.feverGt38c) criteriaMetList.push('Fever > 38.0°C (+1)');
  if (input.nauseaOrVomiting) criteriaMetList.push('Nausea or vomiting (+1)');
  if (input.anorexia) criteriaMetList.push('Anorexia / poor oral intake (+1)');
  if (input.leukocytosisWbcGt10000) criteriaMetList.push('Leukocytosis (WBC > 10,000/μL) (+1)');
  if (input.neutrophiliaAncGt7500OrGe75pct) criteriaMetList.push('Polymorphonuclear neutrophilia (ANC > 7,500 or >= 75%) (+1)');

  // Directives
  const clinicalDirectives: string[] = [];

  if (input.ageYears < 4.0) {
    clinicalDirectives.push('High-Risk Age Group (< 4 years): Infants and toddlers have atypical presentation, poorly localized pain, and a > 50-70% perforation rate due to thin omentum and rapid transmural necrosis.');
  }

  if (input.appendicolithFecalithPresent) {
    clinicalDirectives.push('Appendicolith / Fecalith Present: Associated with higher rates of gangrene, perforation, and non-operative antibiotic failure. Early surgical appendectomy strongly favored.');
  }

  if (ultrasoundDefinitiveForAppendicitis) {
    const diamStr = input.outerDiameterMm ? `${input.outerDiameterMm} mm` : '>= 6 mm';
    clinicalDirectives.push(`Sonographic Confirmation: Dilated, non-compressible appendix (${diamStr}) with hypervascularity confirms acute appendicitis.`);
  }

  if (input.perforationOrAbscessSuspected) {
    clinicalDirectives.push('Complicated Appendicitis (Phlegmon / Abscess): Multidisciplinary evaluation for percutaneous drainage + IV broad-spectrum antibiotics vs interval appendectomy in 6-8 weeks.');
  }

  // Action Plan
  const actionPlan: string[] = [];
  if (riskTier === 'high_risk_ge_7' || ultrasoundDefinitiveForAppendicitis) {
    actionPlan.push('1. Immediate Pediatric Surgical Consultation for emergent laparoscopic appendectomy.');
    actionPlan.push('2. Strict NPO status and isotonic IV fluid resuscitation (e.g., Plasmalyte or Normal Saline bolus 20 mL/kg if dehydrated).');
    actionPlan.push('3. Intravenous broad-spectrum antimicrobial coverage (Ceftriaxone + Metronidazole or Piperacillin-Tazobactam).');
    actionPlan.push('4. Adequate opioid analgesia (IV fentanyl or morphine) - does NOT mask peritoneal signs in pediatric evaluations.');
  } else if (riskTier === 'intermediate_equivocal_4_to_6') {
    actionPlan.push('1. High-resolution graded-compression abdominal ultrasound with Doppler by experienced pediatric sonographer.');
    actionPlan.push('2. If ultrasound is equivocal: Inpatient active observation with serial abdominal exams by the same examiner every 4-6 hours.');
    actionPlan.push('3. Repeat CBC with differential and CRP at 12 hours if pain persists.');
  } else {
    actionPlan.push('1. Appendicitis unlikely: Consider alternate diagnoses (mesenteric adenitis, gastroenteritis, UTI, constipation).');
    actionPlan.push('2. Outpatient safety netting with clear red-flag instructions (return immediately if pain intensifies, vomiting becomes bilious, or fever develops).');
  }

  const summary = `Pediatric Appendicitis Evaluation in a ${input.ageYears}-year-old (${input.weightKg} kg): Samuel Score ${pasScoreTotal}/10 (${riskTierLabel}). Ultrasound: ${input.ultrasoundPerformed ? (ultrasoundDefinitiveForAppendicitis ? 'Positive' : 'Equivocal/Normal') : 'Not Done'}. Pathway: ${input.managementPathway.replace(/_/g, ' ')}.`;

  return {
    pasScoreTotal,
    riskTier,
    riskTierLabel,
    predictedProbabilityPercent,
    ultrasoundDefinitiveForAppendicitis,
    perforationRiskElevated,
    urgentSurgeryIndicated,
    antibioticsRecommended,
    criteriaMetList,
    clinicalDirectives,
    actionPlan,
    summary,
  };
}
