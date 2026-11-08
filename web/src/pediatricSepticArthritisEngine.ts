// Pure TypeScript Clinical Calculation Engine: Pediatric Septic Arthritis & Kocher Diagnostic Criteria Protocol
// References: Kocher MS et al. (J Bone Joint Surg Am. 1999; 81:1662-70 & 2004; 86:1629-35); AAP Pediatric Orthopedics

export type AffectedJointLocation =
  | 'right_hip'
  | 'left_hip'
  | 'right_knee'
  | 'left_knee'
  | 'right_ankle'
  | 'left_ankle'
  | 'other_joint';

export type SynovialGramStain =
  | 'pending'
  | 'gram_positive_cocci'
  | 'gram_negative_bacilli'
  | 'no_organisms_seen';

export type SurgicalApproach =
  | 'none'
  | 'arthrotomy_open_capsulotomy'
  | 'arthroscopic_lavage'
  | 'needle_aspiration_serial';

export type EmpiricAntibioticRegimen =
  | 'none'
  | 'cefazolin_iv'
  | 'vancomycin_iv'
  | 'ceftriaxone_plus_vancomycin'
  | 'clindamycin_iv';

export interface PediatricSepticArthritisInput {
  ageMonths: number;
  weightKg: number;
  affectedJoint: AffectedJointLocation;

  // The 4 Kocher Criteria
  nonWeightBearing: boolean; // Criterion 1
  temperatureCelsius: number; // Criterion 2: > 38.5 C
  esrMmHr: number; // Criterion 3: >= 40 mm/hr
  wbcCountPerMicroliter: number; // Criterion 4: > 12,000 /uL
  crpMgL?: number; // Modern predictor (> 20 mg/L)

  ultrasoundEffusionDetected: boolean;
  arthrocentesisPerformed: boolean;
  synovialWbcCount?: number;
  synovialPmnPct?: number;
  synovialGramStain: SynovialGramStain;

  surgicalDrainageRequired: boolean;
  surgicalApproach: SurgicalApproach;
  empiricAntibioticRegimen: EmpiricAntibioticRegimen;
}

export interface KocherCalculationResult {
  criteriaMetCount: number;
  feverCriterionMet: boolean;
  nonWeightBearingCriterionMet: boolean;
  esrCriterionMet: boolean;
  wbcCriterionMet: boolean;
  crpElevated: boolean;
  predictedProbabilityPercent: number;
  probabilityTier: 'minimal_risk_lt_1' | 'low_risk_3_pct' | 'intermediate_risk_40_pct' | 'high_risk_93_pct' | 'critical_certain_99_pct';
  probabilityLabel: string;
}

export interface PediatricSepticArthritisEvaluation {
  kocherResult: KocherCalculationResult;
  isSepticArthritisLikely: boolean;
  urgentArthrocentesisIndicated: boolean;
  surgicalEmergencyIndicated: boolean;

  synovialAnalysisDiagnostic: boolean;
  orthopedicConsultUrgency: 'routine_outpatient' | 'urgent_inpatient_eval' | 'emergent_immediate_operating_room';
  recommendedAntibiotic: EmpiricAntibioticRegimen;
  clinicalSafetyDirectives: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Calculates Kocher score and statistical probability of septic arthritis vs transient synovitis.
 */
export function calculateKocherCriteria(
  nonWeightBearing: boolean,
  temperatureCelsius: number,
  esrMmHr: number,
  wbcCountPerMicroliter: number,
  crpMgL?: number,
): KocherCalculationResult {
  const feverCriterionMet = temperatureCelsius > 38.5;
  const nonWeightBearingCriterionMet = nonWeightBearing;
  const esrCriterionMet = esrMmHr >= 40;
  const wbcCriterionMet = wbcCountPerMicroliter > 12000;
  const crpElevated = crpMgL !== undefined && crpMgL > 20.0;

  let criteriaMetCount = 0;
  if (nonWeightBearingCriterionMet) criteriaMetCount++;
  if (feverCriterionMet) criteriaMetCount++;
  if (esrCriterionMet) criteriaMetCount++;
  if (wbcCriterionMet) criteriaMetCount++;

  let predictedProbabilityPercent = 0.2;
  let probabilityTier: KocherCalculationResult['probabilityTier'] = 'minimal_risk_lt_1';
  let probabilityLabel = 'Score 0/4: < 0.2% Probability (Transient Synovitis Highly Likely)';

  switch (criteriaMetCount) {
    case 1:
      predictedProbabilityPercent = 3.0;
      probabilityTier = 'low_risk_3_pct';
      probabilityLabel = 'Score 1/4: ~3% Probability (Low Risk)';
      break;
    case 2:
      predictedProbabilityPercent = 40.0;
      probabilityTier = 'intermediate_risk_40_pct';
      probabilityLabel = 'Score 2/4: ~40% Probability (Intermediate Risk - Joint Aspiration/US Indicated)';
      break;
    case 3:
      predictedProbabilityPercent = 93.0;
      probabilityTier = 'high_risk_93_pct';
      probabilityLabel = 'Score 3/4: ~93% Probability (High Risk - Joint Aspiration Mandated)';
      break;
    case 4:
      predictedProbabilityPercent = 99.6;
      probabilityTier = 'critical_certain_99_pct';
      probabilityLabel = 'Score 4/4: ≥ 99% Probability (Surgical Emergency - Septic Arthritis Almost Certain)';
      break;
    default:
      predictedProbabilityPercent = 0.2;
      probabilityTier = 'minimal_risk_lt_1';
      probabilityLabel = 'Score 0/4: < 0.2% Probability (Transient Synovitis Highly Likely)';
      break;
  }

  return {
    criteriaMetCount,
    feverCriterionMet,
    nonWeightBearingCriterionMet,
    esrCriterionMet,
    wbcCriterionMet,
    crpElevated,
    predictedProbabilityPercent,
    probabilityTier,
    probabilityLabel,
  };
}

/**
 * Evaluates pediatric septic arthritis presentation, synovial fluid findings, and surgical urgency.
 */
export function evaluatePediatricSepticArthritis(
  input: PediatricSepticArthritisInput,
): PediatricSepticArthritisEvaluation {
  const kocher = calculateKocherCriteria(
    input.nonWeightBearing,
    input.temperatureCelsius,
    input.esrMmHr,
    input.wbcCountPerMicroliter,
    input.crpMgL,
  );

  const isSepticArthritisLikely = kocher.criteriaMetCount >= 3;
  const urgentArthrocentesisIndicated =
    kocher.criteriaMetCount >= 2 || input.ultrasoundEffusionDetected;
  const surgicalEmergencyIndicated = kocher.criteriaMetCount >= 3;

  const synovialAnalysisDiagnostic =
    (input.synovialWbcCount !== undefined && input.synovialWbcCount >= 50000) ||
    (input.synovialPmnPct !== undefined && input.synovialPmnPct >= 75.0) ||
    input.synovialGramStain === 'gram_positive_cocci' ||
    input.synovialGramStain === 'gram_negative_bacilli';

  let orthopedicConsultUrgency: PediatricSepticArthritisEvaluation['orthopedicConsultUrgency'] =
    'routine_outpatient';
  if (surgicalEmergencyIndicated || synovialAnalysisDiagnostic) {
    orthopedicConsultUrgency = 'emergent_immediate_operating_room';
  } else if (urgentArthrocentesisIndicated) {
    orthopedicConsultUrgency = 'urgent_inpatient_eval';
  }

  let recommendedAntibiotic: EmpiricAntibioticRegimen = 'none';
  if (input.ageMonths < 3) {
    recommendedAntibiotic = 'ceftriaxone_plus_vancomycin'; // Coverage for GBS, S. aureus, Gram-negative enterics
  } else {
    recommendedAntibiotic = 'cefazolin_iv'; // First-line for MSSA; switch to Vancomycin if MRSA risk
  }

  const clinicalSafetyDirectives: string[] = [
    'AVASCULAR NECROSIS RISK: Intracapsular joint effusion in the hip creates tamponade of retinacular vessels supplying the femoral head epiphysis. Delayed decompression (> 24-48 hours) leads to irreversible osteonecrosis and chondrolysis.',
    'ULTRASOUND FIRST: Point-of-care or formal hip ultrasound confirms capsule distension (> 2 mm asymmetry compared to contralateral asymptomatic side) and guides safe diagnostic aspiration.',
    'SYNOVIAL FLUID TARGET: Synovial WBC > 50,000/uL with > 75% neutrophils is classic for bacterial septic arthritis.',
    'ANTIBIOTIC TIMING: Obtain blood cultures and synovial fluid BEFORE initiating empiric IV antibiotics whenever possible, unless child is in septic shock.',
  ];

  const criticalActionPlan: string[] = [];
  criticalActionPlan.push(`Kocher Score: ${kocher.criteriaMetCount}/4 (${kocher.probabilityLabel})`);

  if (surgicalEmergencyIndicated || synovialAnalysisDiagnostic) {
    criticalActionPlan.push(
      'EMERGENT PEDIATRIC ORTHOPEDIC CONSULTATION: Immediate joint arthrotomy / arthroscopic decompression & washout in operating room.',
    );
    criticalActionPlan.push(
      `Initiate empiric IV antimicrobial therapy: ${recommendedAntibiotic.replace(/_/g, ' ').toUpperCase()}`,
    );
  } else if (urgentArthrocentesisIndicated) {
    criticalActionPlan.push(
      'Perform urgent ultrasound-guided arthrocentesis for Gram stain, cell count, culture, and crystal analysis.',
    );
    criticalActionPlan.push('Admit to pediatric ward for serial joint exams and repeated inflammatory markers.');
  } else {
    criticalActionPlan.push(
      'Low probability (< 1%). Transient synovitis probable. Provide NSAIDs (ibuprofen), non-weight-bearing rest, and return precautions within 48 hours if fever develops.',
    );
  }

  const summary = `Pediatric Septic Arthritis Evaluation (${input.affectedJoint.replace(/_/g, ' ')}): Kocher Score ${kocher.criteriaMetCount}/4 (${kocher.predictedProbabilityPercent}% risk). ${surgicalEmergencyIndicated || synovialAnalysisDiagnostic ? 'SURGICAL ARTHROTOMY EMERGENCY INDICATED.' : 'Observation / Ultrasound evaluation indicated.'}`;

  return {
    kocherResult: kocher,
    isSepticArthritisLikely,
    urgentArthrocentesisIndicated,
    surgicalEmergencyIndicated,
    synovialAnalysisDiagnostic,
    orthopedicConsultUrgency,
    recommendedAntibiotic,
    clinicalSafetyDirectives,
    summary,
    criticalActionPlan,
  };
}
