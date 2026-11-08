// Pure TypeScript Clinical Calculation Engine: Neonatal Hemodynamically Significant Patent Ductus Arteriosus (hsPDA)
// References: McNamara & Sehgal (Semin Perinatol 2007); El-Khuffash et al. (J Pediatr 2015); AAP Ductus Arteriosus Staging Guidelines

export type ShuntDirection = 'left_to_right' | 'bidirectional' | 'right_to_left';
export type AortaDiastolicFlow = 'antegrade_normal' | 'absent_diastolic' | 'retrograde_steal';
export type McnamaraStage = 'stage_1_mild' | 'stage_2_moderate' | 'stage_3_severe';
export type PharmacotherapyOption =
  | 'none_conservative'
  | 'iv_ibuprofen'
  | 'iv_indomethacin'
  | 'iv_paracetamol'
  | 'contraindicated';

export interface NeonatalHspdaInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  chronologicalAgeDays: number;
  currentWeightGrams: number;

  // Echocardiographic markers
  ductalDiameterMm: number;
  ductalVelocityVmaxMs?: number;
  shuntDirection: ShuntDirection;
  laAoRatio: number;
  lpaDiastolicVelocityMs?: number;
  descendingAortaDiastolicFlow: AortaDiastolicFlow;

  // Clinical & hemodynamic markers
  cardiomegalyPresent?: boolean;
  pulmonaryEdemaPresent?: boolean;
  boundingPulses?: boolean;
  hypotensionWidePulsePressure?: boolean;
  metabolicAcidosis?: boolean;
  oliguriaPresent?: boolean;
  respiratorySupportEscalation?: boolean;

  // Safety & Contraindication Parameters
  plateletCount?: number;
  serumCreatinineMgDl?: number;
  urineOutputMlKgHr?: number;
  activeNecOrGiBleed?: boolean;
  priorMedicalCoursesCompleted?: number;
}

export interface NeonatalHspdaEvaluation {
  ductalDiameterMm: number;
  laAoRatio: number;
  mcnamaraEchoStage: McnamaraStage;
  echoStageLabel: string;
  mcnamaraClinicalStage: McnamaraStage;
  clinicalStageLabel: string;
  hspdaConfirmed: boolean;
  summary: string;

  // Pharmacotherapy
  recommendedTherapy: PharmacotherapyOption;
  ibuprofenRegimen: string;
  indomethacinRegimen: string;
  paracetamolRegimen: string;
  nsaidContraindicated: boolean;
  contraindicationReasons: string[];
  paracetamolRecommendedAsAlternative: boolean;

  // Interventional
  surgicalOrCatheterReferralIndicated: boolean;
  interventionalGuidance: string;
  clinicalActionPlan: string[];
}

/**
 * Classifies McNamara & Sehgal 2007 Echocardiographic Staging:
 * - Stage 1 (Mild): Duct < 1.5 mm, LA:Ao < 1.4, normal antegrade flow
 * - Stage 2 (Moderate): Duct 1.5 - 2.0 mm, LA:Ao 1.4 - 1.6, absent diastolic flow
 * - Stage 3 (Severe): Duct > 2.0 mm (or >= 1.4 mm/kg), LA:Ao > 1.6, retrograde diastolic flow (steal)
 */
export function classifyMcnamaraEchoStage(
  diameterMm: number,
  laAoRatio: number,
  flow: AortaDiastolicFlow,
  weightGrams: number,
): McnamaraStage {
  const diameterPerKg = weightGrams > 0 ? (diameterMm / (weightGrams / 1000)) : diameterMm;

  if (diameterMm > 2.0 || diameterPerKg >= 1.4 || laAoRatio > 1.6 || flow === 'retrograde_steal') {
    return 'stage_3_severe';
  }
  if (diameterMm >= 1.5 || laAoRatio >= 1.4 || flow === 'absent_diastolic') {
    return 'stage_2_moderate';
  }
  return 'stage_1_mild';
}

/**
 * Classifies McNamara & Sehgal Clinical Hemodynamic Staging:
 * - Stage 1: 0 - 1 signs
 * - Stage 2: 2 - 3 signs
 * - Stage 3: >= 4 signs or critical compromise (acidosis, oliguria, ventilator escalation)
 */
export function classifyMcnamaraClinicalStage(input: NeonatalHspdaInput): McnamaraStage {
  const signs = [
    Boolean(input.cardiomegalyPresent),
    Boolean(input.pulmonaryEdemaPresent),
    Boolean(input.boundingPulses),
    Boolean(input.hypotensionWidePulsePressure),
    Boolean(input.metabolicAcidosis),
    Boolean(input.oliguriaPresent),
    Boolean(input.respiratorySupportEscalation),
  ];
  const count = signs.filter(Boolean).length;

  if (count >= 4 || input.metabolicAcidosis || input.oliguriaPresent || input.respiratorySupportEscalation) {
    return 'stage_3_severe';
  }
  if (count >= 2) {
    return 'stage_2_moderate';
  }
  return 'stage_1_mild';
}

/**
 * Evaluates comprehensive neonatal hsPDA staging, pharmacotherapy selection, and interventional threshold.
 */
export function evaluateNeonatalHspda(input: NeonatalHspdaInput): NeonatalHspdaEvaluation {
  const echoStage = classifyMcnamaraEchoStage(
    input.ductalDiameterMm,
    input.laAoRatio,
    input.descendingAortaDiastolicFlow,
    input.currentWeightGrams,
  );
  const clinicalStage = classifyMcnamaraClinicalStage(input);

  // hsPDA is confirmed when both echocardiographic and clinical stages indicate moderate or severe compromise
  const hspdaConfirmed =
    (echoStage === 'stage_2_moderate' || echoStage === 'stage_3_severe') &&
    (clinicalStage === 'stage_2_moderate' || clinicalStage === 'stage_3_severe') &&
    input.shuntDirection !== 'right_to_left';

  const contraindications: string[] = [];
  if (input.plateletCount !== undefined && input.plateletCount < 50000) {
    contraindications.push(`Severe thrombocytopenia (Platelets ${input.plateletCount}/uL < 50,000/uL)`);
  }
  if (input.serumCreatinineMgDl !== undefined && input.serumCreatinineMgDl > 1.6) {
    contraindications.push(`Renal impairment (Serum Creatinine ${input.serumCreatinineMgDl} mg/dL > 1.6 mg/dL)`);
  }
  if (input.urineOutputMlKgHr !== undefined && input.urineOutputMlKgHr < 0.6) {
    contraindications.push(`Oliguria (Urine output ${input.urineOutputMlKgHr} mL/kg/hr < 0.6 mL/kg/hr)`);
  }
  if (input.activeNecOrGiBleed) {
    contraindications.push('Active necrotizing enterocolitis (NEC) or significant gastrointestinal hemorrhage');
  }

  const nsaidContraindicated = contraindications.length > 0;
  const paracetamolRecommended = nsaidContraindicated && hspdaConfirmed;

  // Pharmacotherapy recommendation
  let recommendedTherapy: PharmacotherapyOption = 'none_conservative';
  if (hspdaConfirmed) {
    if (nsaidContraindicated) {
      recommendedTherapy = 'iv_paracetamol';
    } else {
      recommendedTherapy = 'iv_ibuprofen';
    }
  }

  const weightKg = input.currentWeightGrams / 1000;
  const ibuprofenDay1 = Math.round(weightKg * 10 * 10) / 10;
  const ibuprofenDay23 = Math.round(weightKg * 5 * 10) / 10;
  const ibuprofenRegimen = `IV Ibuprofen: Day 1: ${ibuprofenDay1} mg (10 mg/kg), Day 2: ${ibuprofenDay23} mg (5 mg/kg), Day 3: ${ibuprofenDay23} mg (5 mg/kg) given every 24 hours.`;

  const indomethacinDose = Math.round(weightKg * 0.2 * 100) / 100;
  const indomethacinRegimen = `IV Indomethacin: ${indomethacinDose} mg (0.2 mg/kg) IV every 12 to 24 hours for 3 doses, with close monitoring of urine output and renal function.`;

  const paracetamolDose = Math.round(weightKg * 15 * 10) / 10;
  const paracetamolRegimen = `IV Paracetamol (Acetaminophen): ${paracetamolDose} mg (15 mg/kg) IV every 6 hours for 3 to 7 days. Preferred alternative when NSAIDs contraindicated (thrombocytopenia/renal impairment).`;

  // Interventional criteria: refractory to >= 2 medical courses with severe hsPDA or persistent ventilator dependence
  const priorCourses = input.priorMedicalCoursesCompleted ?? 0;
  const surgicalOrCatheterReferralIndicated = Boolean(
    (priorCourses >= 2 && echoStage === 'stage_3_severe' && clinicalStage === 'stage_3_severe') ||
    (nsaidContraindicated && echoStage === 'stage_3_severe' && input.respiratorySupportEscalation && priorCourses >= 1)
  );

  let interventionalGuidance = 'Continue medical management and conservative surveillance.';
  if (surgicalOrCatheterReferralIndicated) {
    interventionalGuidance = 'MANDATORY PEDIATRIC CARDIOLOGY / CARDIOVASCULAR SURGERY CONSULTATION: Infant has severe, medically refractory hsPDA. Evaluate for transcatheter device occlusion (e.g. Piccolo device if weight >= 700g) vs. bedside surgical ligation.';
  }

  const echoStageLabels: Record<McnamaraStage, string> = {
    stage_1_mild: 'Stage 1: Mild Echocardiographic Shunt',
    stage_2_moderate: 'Stage 2: Moderate Ductal Shunting',
    stage_3_severe: 'Stage 3: Severe Hemodynamic Ductal Steal',
  };

  const clinicalStageLabels: Record<McnamaraStage, string> = {
    stage_1_mild: 'Stage 1: Mild Clinical Impact',
    stage_2_moderate: 'Stage 2: Moderate Hemodynamic Compromise',
    stage_3_severe: 'Stage 3: Severe / Critical Cardiorespiratory Failure',
  };

  const clinicalActionPlan: string[] = [];
  if (hspdaConfirmed) {
    clinicalActionPlan.push('Restricted fluid intake (maintain at 120-130 mL/kg/day during acute phase)');
    clinicalActionPlan.push('Maintain PEEP >= 5-6 cmH2O to increase intrathoracic pressure and decrease pulmonary blood flow');
    clinicalActionPlan.push(`Initiate ${recommendedTherapy === 'iv_paracetamol' ? 'IV Paracetamol' : 'IV Ibuprofen'} therapy`);
    clinicalActionPlan.push('Repeat focused echocardiogram 24 hours after completion of course');
  } else {
    clinicalActionPlan.push('Conservative management: serial clinical examination for bounding pulses and pulse pressure widening');
    clinicalActionPlan.push('Repeat echocardiogram if respiratory support requirements escalate');
  }

  return {
    ductalDiameterMm: input.ductalDiameterMm,
    laAoRatio: input.laAoRatio,
    mcnamaraEchoStage: echoStage,
    echoStageLabel: echoStageLabels[echoStage],
    mcnamaraClinicalStage: clinicalStage,
    clinicalStageLabel: clinicalStageLabels[clinicalStage],
    hspdaConfirmed,
    summary: hspdaConfirmed
      ? `Hemodynamically Significant PDA (hsPDA) CONFIRMED: ${echoStageLabels[echoStage]} with ${clinicalStageLabels[clinicalStage]}.`
      : 'PDA is not hemodynamically significant at this assessment.',
    recommendedTherapy,
    ibuprofenRegimen,
    indomethacinRegimen,
    paracetamolRegimen,
    nsaidContraindicated,
    contraindicationReasons: contraindications,
    paracetamolRecommendedAsAlternative: paracetamolRecommended,
    surgicalOrCatheterReferralIndicated,
    interventionalGuidance,
    clinicalActionPlan,
  };
}
