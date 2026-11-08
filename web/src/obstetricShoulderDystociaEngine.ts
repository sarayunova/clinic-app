// Pure TypeScript Clinical Calculation Engine: Obstetric Shoulder Dystocia & HELPERR Emergency Maneuvers Protocol
// References: RCOG Greentop Guideline No. 42 (2020); ACOG Practice Bulletin No. 178; ALSO Advanced Life Support in Obstetrics

export type OperativeVaginalMode = 'spontaneous_vaginal' | 'vacuum_assisted' | 'forceps_assisted';

export type InternalRotationalManeuver = 'none' | 'rubin_ii' | 'woods_screw' | 'reverse_woods_screw';

export type AdvancedDystociaManeuver =
  | 'none'
  | 'intentional_clavicle_fracture_cleidotomy'
  | 'zavanelli_cephalic_replacement'
  | 'symphysiotomy';

export type NeonatalInjuryType =
  | 'none'
  | 'brachial_plexus_erb_palsy'
  | 'brachial_plexus_klumpke'
  | 'clavicular_fracture'
  | 'humeral_fracture'
  | 'hypoxic_ischemic_encephalopathy';

export interface ObstetricShoulderDystociaInput {
  maternalAge?: number;
  gestationalAgeWeeks: number;
  estimatedFetalWeightGrams?: number;
  actualBirthWeightGrams: number;
  gestationalDiabetes: boolean;
  operativeVaginalDelivery: OperativeVaginalMode;

  turtleSignObserved: boolean;
  headToBodyIntervalSeconds: number;

  helpCalled: boolean;
  episiotomyPerformed: boolean;
  mcrobertsManeuverSuccess: boolean;
  suprapubicPressureSuccess: boolean;
  internalRotationalManeuver: InternalRotationalManeuver;
  internalRotationalSuccess: boolean;
  posteriorArmDeliverySuccess: boolean;
  gaskinAllFoursSuccess: boolean;
  advancedManeuversRequired: AdvancedDystociaManeuver;
  fundalPressureAvoided: boolean;

  apgar1min?: number;
  apgar5min?: number;
  umbilicalArterialPh?: number;
  neonatalInjury?: NeonatalInjuryType;
}

export interface ShoulderDystociaEvaluation {
  dystociaConfirmed: boolean;
  intervalSeverityTier: 'normal_interval' | 'mild_dystocia_1_to_3min' | 'severe_dystocia_3_to_5min' | 'critical_anoxia_gt_5min';
  intervalSeverityLabel: string;
  macrosomiaPresent: boolean;

  successfulManeuver: string;
  totalManeuversAttempted: number;
  fundalPressureViolation: boolean;
  hypoxiaRiskLevel: 'low' | 'moderate' | 'high' | 'critical_extreme';

  clinicalGuidance: string;
  maneuverSequenceAudit: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Evaluates head-to-body interval duration and stratifies hypoxic risk.
 */
export function evaluateHeadToBodyInterval(seconds: number): {
  tier: 'normal_interval' | 'mild_dystocia_1_to_3min' | 'severe_dystocia_3_to_5min' | 'critical_anoxia_gt_5min';
  label: string;
  risk: 'low' | 'moderate' | 'high' | 'critical_extreme';
} {
  if (seconds > 300) {
    return {
      tier: 'critical_anoxia_gt_5min',
      label: 'Critical Anoxia Interval (> 5 minutes)',
      risk: 'critical_extreme',
    };
  }
  if (seconds >= 180) {
    return {
      tier: 'severe_dystocia_3_to_5min',
      label: 'Severe Dystocia (3 - 5 minutes)',
      risk: 'high',
    };
  }
  if (seconds >= 60) {
    return {
      tier: 'mild_dystocia_1_to_3min',
      label: 'Moderate Dystocia (60 - 180 seconds)',
      risk: 'moderate',
    };
  }
  return {
    tier: 'normal_interval',
    label: 'Normal Interval (< 60 seconds)',
    risk: 'low',
  };
}

/**
 * Evaluates shoulder dystocia execution, HELPERR algorithm compliance, and neonatal risk.
 */
export function evaluateShoulderDystocia(
  input: ObstetricShoulderDystociaInput,
): ShoulderDystociaEvaluation {
  const dystociaConfirmed = input.headToBodyIntervalSeconds >= 60 || input.turtleSignObserved;
  const interval = evaluateHeadToBodyInterval(input.headToBodyIntervalSeconds);
  const macrosomiaPresent = input.actualBirthWeightGrams >= 4000;
  const fundalPressureViolation = !input.fundalPressureAvoided;

  let totalManeuversAttempted = 0;
  if (input.mcrobertsManeuverSuccess || input.headToBodyIntervalSeconds >= 60) totalManeuversAttempted++;
  if (input.suprapubicPressureSuccess) totalManeuversAttempted++;
  if (input.internalRotationalManeuver !== 'none') totalManeuversAttempted++;
  if (input.posteriorArmDeliverySuccess) totalManeuversAttempted++;
  if (input.gaskinAllFoursSuccess) totalManeuversAttempted++;
  if (input.advancedManeuversRequired !== 'none') totalManeuversAttempted++;

  let successfulManeuver = 'Unresolved / Advanced Maneuvers';
  if (input.mcrobertsManeuverSuccess) successfulManeuver = 'McRoberts Maneuver';
  else if (input.suprapubicPressureSuccess) successfulManeuver = 'Suprapubic Pressure (Rubin I)';
  else if (input.internalRotationalSuccess) successfulManeuver = `Internal Rotation (${input.internalRotationalManeuver.replace(/_/g, ' ').toUpperCase()})`;
  else if (input.posteriorArmDeliverySuccess) successfulManeuver = 'Delivery of Posterior Arm';
  else if (input.gaskinAllFoursSuccess) successfulManeuver = 'All-Fours (Gaskin Maneuver)';
  else if (input.advancedManeuversRequired !== 'none') successfulManeuver = input.advancedManeuversRequired.replace(/_/g, ' ').toUpperCase();

  const maneuverSequenceAudit: string[] = [];
  if (input.helpCalled) maneuverSequenceAudit.push('✅ H: Help called (Obstetrician, Neonatology, Anesthesia)');
  else maneuverSequenceAudit.push('⚠️ H: Help not immediately documented');

  if (input.episiotomyPerformed) maneuverSequenceAudit.push('ℹ️ E: Episiotomy performed for internal maneuver access');

  if (input.mcrobertsManeuverSuccess) {
    maneuverSequenceAudit.push('✅ L: McRoberts maneuver succeeded (hyperflexion of maternal hips)');
  } else {
    maneuverSequenceAudit.push('ℹ️ L: McRoberts maneuver attempted');
  }

  if (input.suprapubicPressureSuccess) {
    maneuverSequenceAudit.push('✅ P: Suprapubic pressure succeeded (Rubin I adduction of anterior shoulder)');
  }

  if (input.internalRotationalSuccess) {
    maneuverSequenceAudit.push(`✅ E: ${input.internalRotationalManeuver.replace(/_/g, ' ')} internal rotation succeeded`);
  }

  if (input.posteriorArmDeliverySuccess) {
    maneuverSequenceAudit.push('✅ R: Posterior arm delivery succeeded');
  }

  if (input.gaskinAllFoursSuccess) {
    maneuverSequenceAudit.push('✅ R: Roll onto all-fours (Gaskin maneuver) succeeded');
  }

  if (input.advancedManeuversRequired !== 'none') {
    maneuverSequenceAudit.push(`🚨 Advanced Maneuver: ${input.advancedManeuversRequired.replace(/_/g, ' ')}`);
  }

  let clinicalGuidance = '';
  if (interval.tier === 'critical_anoxia_gt_5min') {
    clinicalGuidance = 'CRITICAL POST-RESUSCITATION ALERT: Head-to-body delivery interval exceeded 5 minutes. High risk of severe fetal acidemia, hypoxic ischemic encephalopathy (HIE), and permanent brachial plexus injury. Send paired umbilical cord blood gases (arterial and venous). Immediate NICU admission for therapeutic hypothermia eligibility assessment.';
  } else if (interval.tier === 'severe_dystocia_3_to_5min') {
    clinicalGuidance = 'SEVERE DYSTOCIA RECOVERY: Delivery required between 3 to 5 minutes. Neonatal resuscitation team must examine for clavicle/humeral fractures and brachial plexus stretch (Erb/Klumpke palsy). Obtain cord blood arterial pH.';
  } else {
    clinicalGuidance = 'RESOLVED SHOULDER DYSTOCIA: Standard neonatal surveillance and postpartum hemorrhage monitoring. Inspect genital tract for maternal third- or fourth-degree tears.';
  }

  const criticalActionPlan: string[] = [];
  criticalActionPlan.push(`Head-to-body interval: ${input.headToBodyIntervalSeconds}s (${interval.label})`);
  criticalActionPlan.push(`Resolving maneuver: ${successfulManeuver}`);

  if (fundalPressureViolation) {
    criticalActionPlan.push('CRITICAL AUDIT DEFICIENCY: Fundal pressure was NOT avoided. Fundal pressure is strictly contraindicated (RCOG / ACOG) as it impacts shoulders further and increases uterine rupture and neonatal paralysis risks.');
  } else {
    criticalActionPlan.push('Audit check passed: Fundal pressure was strictly avoided and gentle axial traction maintained.');
  }

  criticalActionPlan.push('Check bilateral neonatal Moro reflex, arm movement, and clavicle integrity.');
  criticalActionPlan.push('Monitor maternal blood loss closely: shoulder dystocia carries high risk of uterine atony and postpartum hemorrhage.');

  const summary = `Shoulder Dystocia (${interval.label}): Resolved via ${successfulManeuver} in ${input.headToBodyIntervalSeconds} seconds. Birth Weight: ${input.actualBirthWeightGrams} g (${macrosomiaPresent ? 'Macrosomic' : 'Appropriate for GA'}). ${fundalPressureViolation ? 'WARNING: FUNDAL PRESSURE CONTRAINDICATION VIOLATED.' : 'HELPERR protocol followed.'}`;

  return {
    dystociaConfirmed,
    intervalSeverityTier: interval.tier,
    intervalSeverityLabel: interval.label,
    macrosomiaPresent,
    successfulManeuver,
    totalManeuversAttempted,
    fundalPressureViolation,
    hypoxiaRiskLevel: interval.risk,
    clinicalGuidance,
    maneuverSequenceAudit,
    summary,
    criticalActionPlan,
  };
}
