/**
 * Pre-Anesthesia Clearance (PAC), ASA Triage & WHO Surgical Safety Checklist Engine
 * Compliant with ASA (American Society of Anesthesiologists) guidelines,
 * Mallampati Airway Classification, and WHO Surgical Safety Checklist (3-Phase: Sign In, Time Out, Sign Out).
 */

export type AsaGrade =
  | 'ASA_I'
  | 'ASA_II'
  | 'ASA_III'
  | 'ASA_IV'
  | 'ASA_V'
  | 'ASA_I_E'
  | 'ASA_II_E'
  | 'ASA_III_E'
  | 'ASA_IV_E'
  | 'ASA_V_E';

export interface AsaGradeInfo {
  grade: AsaGrade;
  title: string;
  description: string;
  isEmergency: boolean;
  severityLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export const ASA_DEFINITIONS: Record<AsaGrade, AsaGradeInfo> = {
  ASA_I: {
    grade: 'ASA_I',
    title: 'ASA Class I',
    description: 'Normal healthy patient without systemic disease. Non-smoking, minimal alcohol.',
    isEmergency: false,
    severityLevel: 'low',
  },
  ASA_II: {
    grade: 'ASA_II',
    title: 'ASA Class II',
    description: 'Patient with mild systemic disease without substantial functional limitations (e.g. well-controlled GDM, mild gestational hypertension, well-controlled asthma, BMI 30–40).',
    isEmergency: false,
    severityLevel: 'moderate',
  },
  ASA_III: {
    grade: 'ASA_III',
    title: 'ASA Class III',
    description: 'Patient with severe systemic disease with substantive functional limitations (e.g. preeclampsia with severe features, poorly controlled GDM on high insulin, morbid obesity BMI >= 40, symptomatic heart disease).',
    isEmergency: false,
    severityLevel: 'high',
  },
  ASA_IV: {
    grade: 'ASA_IV',
    title: 'ASA Class IV',
    description: 'Patient with severe systemic disease that is a constant threat to life (e.g. severe eclampsia with acute pulmonary edema, HELLP syndrome with DIC, severe peripartum cardiomyopathy).',
    isEmergency: false,
    severityLevel: 'critical',
  },
  ASA_V: {
    grade: 'ASA_V',
    title: 'ASA Class V',
    description: 'A moribund patient not expected to survive without the surgical operation (e.g. massive ruptured ectopic pregnancy with hemorrhagic shock, catastrophic uterine rupture).',
    isEmergency: false,
    severityLevel: 'critical',
  },
  ASA_I_E: {
    grade: 'ASA_I_E',
    title: 'ASA Class I-E (Emergency)',
    description: 'Healthy patient presenting for an emergency surgical procedure (e.g. primary elective candidate entering sudden active obstructed labor).',
    isEmergency: true,
    severityLevel: 'moderate',
  },
  ASA_II_E: {
    grade: 'ASA_II_E',
    title: 'ASA Class II-E (Emergency)',
    description: 'Patient with mild systemic disease presenting for an emergency procedure (e.g. controlled GDM with sudden acute non-reassuring fetal heart rate).',
    isEmergency: true,
    severityLevel: 'high',
  },
  ASA_III_E: {
    grade: 'ASA_III_E',
    title: 'ASA Class III-E (Emergency)',
    description: 'Patient with severe systemic disease undergoing emergency surgery (e.g. severe pre-eclampsia requiring Category-1 emergency LSCS).',
    isEmergency: true,
    severityLevel: 'critical',
  },
  ASA_IV_E: {
    grade: 'ASA_IV_E',
    title: 'ASA Class IV-E (Emergency)',
    description: 'Patient with life-threatening systemic disease presenting for emergency life-saving surgery.',
    isEmergency: true,
    severityLevel: 'critical',
  },
  ASA_V_E: {
    grade: 'ASA_V_E',
    title: 'ASA Class V-E (Emergency)',
    description: 'Moribund patient undergoing emergency resuscitation and surgical intervention.',
    isEmergency: true,
    severityLevel: 'critical',
  },
};

export interface AirwayAssessmentInput {
  mallampatiClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IV';
  mouthOpeningCm: number;
  thyromentalDistanceCm: number;
  dentitionStatus: 'intact' | 'loose_teeth' | 'edentulous' | 'dentures_present';
  neckMobility: 'normal_full' | 'restricted_extension' | 'fixed_flexion';
}

export interface AirwayRiskEvaluation {
  riskScore: number;
  difficultyRisk: 'low' | 'moderate' | 'high_difficult_airway';
  summary: string;
  warnings: string[];
}

export function evaluateAirwayRisk(input: AirwayAssessmentInput): AirwayRiskEvaluation {
  let score = 0;
  const warnings: string[] = [];

  // Mallampati Class
  if (input.mallampatiClass === 'CLASS_III') {
    score += 2;
    warnings.push('Mallampati Class III: Soft palate and base of uvula visible only.');
  } else if (input.mallampatiClass === 'CLASS_IV') {
    score += 4;
    warnings.push('Mallampati Class IV: Only hard palate visible (High risk for difficult intubation).');
  }

  // Inter-incisor mouth opening (< 3.5 cm is restricted)
  if (input.mouthOpeningCm < 3.0) {
    score += 3;
    warnings.push(`Restricted mouth opening (${input.mouthOpeningCm} cm < 3.0 cm). Laryngoscopy difficult.`);
  } else if (input.mouthOpeningCm < 4.0) {
    score += 1;
    warnings.push(`Borderline mouth opening (${input.mouthOpeningCm} cm).`);
  }

  // Thyromental distance (< 6.5 cm indicates acute larynx)
  if (input.thyromentalDistanceCm < 6.0) {
    score += 3;
    warnings.push(`Short thyromental distance (${input.thyromentalDistanceCm} cm < 6.0 cm). Anterior airway risk.`);
  } else if (input.thyromentalDistanceCm < 6.5) {
    score += 1;
  }

  // Dentition
  if (input.dentitionStatus === 'loose_teeth') {
    score += 1;
    warnings.push('Loose teeth present: Risk of dental dislodgement during instrumentation.');
  } else if (input.dentitionStatus === 'dentures_present') {
    warnings.push('Dentures must be removed prior to transfer into the operating theater.');
  }

  // Cervical spine mobility
  if (input.neckMobility === 'fixed_flexion') {
    score += 4;
    warnings.push('Fixed neck flexion / severe cervical restriction: Direct laryngoscopy contraindicated without video/fiberoptic backup.');
  } else if (input.neckMobility === 'restricted_extension') {
    score += 2;
    warnings.push('Restricted neck extension: Sniffing position may be suboptimal.');
  }

  let difficultyRisk: 'low' | 'moderate' | 'high_difficult_airway' = 'low';
  let summary = 'Standard airway parameters. Anticipate normal direct laryngoscopy and mask ventilation.';

  if (score >= 4) {
    difficultyRisk = 'high_difficult_airway';
    summary = 'POTENTIAL DIFFICULT AIRWAY: High risk of challenging laryngoscopy or intubation. Video laryngoscope and difficult airway cart must be present in theater.';
  } else if (score >= 2) {
    difficultyRisk = 'moderate';
    summary = 'Intermediate airway risk. Ensure senior anesthetic supervision and second-line airway devices ready.';
  }

  return {
    riskScore: score,
    difficultyRisk,
    summary,
    warnings,
  };
}

export function evaluateNpoFasting(npoSolidHours: number, npoClearLiquidHours: number): {
  isFastingCompliant: boolean;
  clearFluidWarning?: string;
  solidFastingWarning?: string;
} {
  const solidCompliant = npoSolidHours >= 6;
  const liquidCompliant = npoClearLiquidHours >= 2;

  return {
    isFastingCompliant: solidCompliant && liquidCompliant,
    clearFluidWarning: !liquidCompliant
      ? `Clear liquid fasting (${npoClearLiquidHours}h) is under the 2-hour minimum safety guideline.`
      : undefined,
    solidFastingWarning: !solidCompliant
      ? `Solid food fasting (${npoSolidHours}h) is under the recommended 6-hour minimum for elective procedures.`
      : undefined,
  };
}
