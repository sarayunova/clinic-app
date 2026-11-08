// Pure TypeScript Clinical Calculation Engine: Pediatric Intussusception & Pneumatic / Hydrostatic Reduction Protocol
// References: ACR Appropriateness Criteria on Intussusception; AAP Pediatric Surgery; BAPS Guidelines

export type LeadPointType =
  | 'none_idiopathic'
  | 'meckels_diverticulum'
  | 'intestinal_duplication_cyst'
  | 'polyp'
  | 'lymphoma_malignancy';

export type ReductionMethod =
  | 'pneumatic_air_enema'
  | 'hydrostatic_saline_enema'
  | 'none_primary_surgery';

export type IntussusceptionStatus =
  | 'evaluation_ultrasound'
  | 'reduction_in_progress'
  | 'reduction_successful_observation'
  | 'operating_room_exploration'
  | 'resolved_discharged';

export interface PediatricIntussusceptionInput {
  ageMonths: number;
  weightKg: number;
  symptomDurationHours: number;

  intermittentColickyPain: boolean;
  vomitingBilious: boolean;
  redCurrantJellyStool: boolean;
  palpableAbdominalMass: boolean;
  lethargyAlteredSensorium: boolean;

  ultrasoundTargetSignDetected: boolean;
  ultrasoundOuterDiameterMm?: number;
  pseudokidneySignPresent: boolean;
  pathologicLeadPointSuspected: boolean;
  leadPointType: LeadPointType;
  peritonitisSignsPresent: boolean;
  pneumoperitoneumOnXray: boolean;

  reductionAttempted: boolean;
  reductionMethod: ReductionMethod;
  maximumPressureMmhg: number;
  reductionAttemptsCount: number;
  reductionSuccessful: boolean;
  cecalIlealRefluxVisualized: boolean;
  surgicalExplorationRequired: boolean;
  surgicalFindings?: string;
}

export interface PediatricIntussusceptionEvaluation {
  intussusceptionDiagnosed: boolean;
  classicTriadPresent: boolean; // pain + mass + currant jelly stool
  contraindicationToEnemaReduction: boolean;
  contraindicationReasons: string[];

  pressureLimitExceeded: boolean;
  maximumPermissiblePressureMmhg: number;
  reductionAttemptsExceeded: boolean;

  surgicalEmergencyIndicated: boolean;
  leadPointAlert: boolean;

  clinicalSafetyDirectives: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Evaluates pediatric intussusception clinical signs, ultrasound findings,
 * contraindications to air/saline enema reduction, and pneumatic pressure limits.
 */
export function evaluatePediatricIntussusception(
  input: PediatricIntussusceptionInput,
): PediatricIntussusceptionEvaluation {
  const intussusceptionDiagnosed =
    input.ultrasoundTargetSignDetected || input.pseudokidneySignPresent;

  const classicTriadPresent =
    input.intermittentColickyPain &&
    input.palpableAbdominalMass &&
    input.redCurrantJellyStool;

  // Contraindication audit: Peritonitis, free air (pneumoperitoneum), prolonged shock
  const contraindicationReasons: string[] = [];
  if (input.pneumoperitoneumOnXray) {
    contraindicationReasons.push('Pneumoperitoneum (gastrointestinal perforation on radiograph) [Absolute Contraindication]');
  }
  if (input.peritonitisSignsPresent) {
    contraindicationReasons.push('Clinical peritonitis (generalized guarding, rigidity, rebound tenderness) [Absolute Contraindication]');
  }
  if (input.symptomDurationHours > 72.0 && input.vomitingBilious) {
    contraindicationReasons.push('Prolonged presentation (> 72 hours) with bowel ischemia risk');
  }

  const contraindicationToEnemaReduction = contraindicationReasons.length > 0;

  // Maximum permissible pneumatic pressure by age:
  // Infants < 6 months: 80 mmHg max
  // Children >= 6 months: 120 mmHg max
  const maximumPermissiblePressureMmhg = input.ageMonths < 6 ? 80.0 : 120.0;
  const pressureLimitExceeded =
    input.reductionMethod === 'pneumatic_air_enema' &&
    input.maximumPressureMmhg > maximumPermissiblePressureMmhg;

  // Rule of 3s: Maximum 3 attempts
  const reductionAttemptsExceeded = input.reductionAttemptsCount > 3;

  const leadPointAlert =
    input.pathologicLeadPointSuspected ||
    input.leadPointType !== 'none_idiopathic' ||
    input.ageMonths > 36; // Children > 3 years have high frequency of pathologic lead point (lymphoma/Meckel's)

  const surgicalEmergencyIndicated =
    contraindicationToEnemaReduction ||
    input.surgicalExplorationRequired ||
    (input.reductionAttempted && !input.reductionSuccessful && input.reductionAttemptsCount >= 3);

  const clinicalSafetyDirectives: string[] = [
    'RULE OF 3s FOR PNEUMATIC REDUCTION: Maximum 3 attempts, each lasting no more than 3 minutes, with maximum air pressure of 80 mmHg (infants < 6 mo) or 120 mmHg (children ≥ 6 mo). Overpressurization drastically increases tension pneumoperitoneum risk.',
    'ABSOLUTE CONTRAINDICATIONS: Any signs of peritonitis, hemodynamic septic shock, or free intraperitoneal air mandate immediate laparotomy; do NOT attempt non-operative enema.',
    'CONFIRMATION OF SUCCESS: Complete reduction requires free reflux of air or saline across the ileocecal valve into multiple small bowel loops, accompanied by disappearance of the target mass and clinical pain relief.',
    'POST-REDUCTION OBSERVATION: 5-10% of intussusceptions recur, most within the first 24-48 hours. Observe inpatient on IV fluids until soft diet is tolerated without colic.',
    'OLDER CHILD ALERT (> 3 YEARS): Children presenting over 3 years old have an elevated incidence of pathologic lead points (Meckel diverticulum, duplication cyst, polyp, or Burkitt lymphoma). Surgical exploration or diagnostic laparoscopy is strongly advised.',
  ];

  const criticalActionPlan: string[] = [];
  criticalActionPlan.push(`Intussusception Diagnostic Status: ${intussusceptionDiagnosed ? 'CONFIRMED on Ultrasound (Target / Pseudokidney Sign)' : 'Suspected Clinically'}`);

  if (contraindicationToEnemaReduction) {
    criticalActionPlan.push(`CONTRAINDICATION AUDIT FAILED: ${contraindicationReasons.join('; ')}. Enema reduction STRICTLY CONTRAINDICATED. Immediate pediatric surgical exploration.`);
  } else if (!input.reductionAttempted && intussusceptionDiagnosed) {
    criticalActionPlan.push(`Non-operative reduction indicated: Proceed with ${input.reductionMethod.replace(/_/g, ' ')} (Max pressure: ${maximumPermissiblePressureMmhg} mmHg). Pediatric surgical backup on standby.`);
  }

  if (pressureLimitExceeded) {
    criticalActionPlan.push(`CRITICAL SAFETY ERROR: Pressure of ${input.maximumPressureMmhg} mmHg exceeds age-appropriate limit (${maximumPermissiblePressureMmhg} mmHg)! High perforation risk.`);
  }

  if (input.reductionAttempted) {
    if (input.reductionSuccessful && input.cecalIlealRefluxVisualized) {
      criticalActionPlan.push('REDUCTION SUCCESSFUL: Free ileal reflux confirmed. Admit for 24-hour observation, hydration, and gradual oral refeeding.');
    } else if (!input.reductionSuccessful) {
      criticalActionPlan.push(`Reduction incomplete after attempt ${input.reductionAttemptsCount}/3. ${input.reductionAttemptsCount >= 3 ? 'Failed non-operative reduction. Transfer to Operating Room for surgical reduction.' : 'Prepare second attempt if patient remains stable.'}`);
    }
  }

  if (leadPointAlert) {
    criticalActionPlan.push(`PATHOLOGIC LEAD POINT ALERT: ${input.leadPointType !== 'none_idiopathic' ? input.leadPointType.replace(/_/g, ' ') : (input.ageMonths > 36 ? 'Age > 3 years increases risk of lead point' : 'Lead point suspected')}.`);
  }

  const summary = `Pediatric Intussusception (Age ${input.ageMonths}m, ${input.weightKg}kg): ${intussusceptionDiagnosed ? 'Ultrasound confirmed.' : 'Ultrasound pending.'} ${contraindicationToEnemaReduction ? 'CONTRAINDICATED FOR ENEMA.' : (input.reductionSuccessful ? 'Successfully reduced.' : 'Enema reduction candidate.')} ${surgicalEmergencyIndicated ? 'Operating room indicated.' : 'Non-operative protocol.'}`;

  return {
    intussusceptionDiagnosed,
    classicTriadPresent,
    contraindicationToEnemaReduction,
    contraindicationReasons,
    pressureLimitExceeded,
    maximumPermissiblePressureMmhg,
    reductionAttemptsExceeded,
    surgicalEmergencyIndicated,
    leadPointAlert,
    clinicalSafetyDirectives,
    summary,
    criticalActionPlan,
  };
}
