// ============================================================================
// Obstetric Uterine Inversion & Emergent Reduction Protocol Engine
// References:
// 1. RCOG Green-top Guidelines: Management of Uterine Inversion
// 2. ACOG Practice Bulletin No. 183: Postpartum Hemorrhage & Inversion
// 3. WHO Guidelines for the Management of Postpartum Emergencies
// 4. Williams Obstetrics (26th Ed) - Uterine Inversion & Johnson Technique
// ============================================================================

export type InversionDegree =
  | 'first_degree_incomplete_intrauterine'
  | 'second_degree_complete_through_cervix'
  | 'third_degree_prolapsed_outside_introitus'
  | 'fourth_degree_total_inversion_with_vagina';

export type PlacentalStatus =
  | 'attached_undelivered'
  | 'partially_separated'
  | 'completely_separated';

export type ReductionTechnique =
  | 'johnson_manual_maneuver'
  | 'osullivan_hydrostatic_technique'
  | 'laparotomy_huntington_procedure'
  | 'laparotomy_haultain_procedure';

export type UterineRelaxantAgent =
  | 'none'
  | 'terbutaline_sc'
  | 'nitroglycerin_iv'
  | 'magnesium_sulfate'
  | 'general_halogenated_anesthesia';

export interface ObstetricUterineInversionInput {
  maternalAge?: number;
  parity: number;
  deliveryMode: string;
  placentalStatusAtInversion: PlacentalStatus;
  umbilicalCordTractionApplied: boolean;
  fundalPressureApplied: boolean;
  inversionDegree: InversionDegree;

  neurogenicShockPresent: boolean;
  systolicBpAtPresentation: number;
  diastolicBpAtPresentation: number;
  heartRateAtPresentation: number;
  estimatedBloodLossMl: number;

  reductionAttemptedImmediate: boolean;
  reductionTechniquePrimary: ReductionTechnique;
  uterineRelaxantAdministered: boolean;
  uterineRelaxantAgent: UterineRelaxantAgent;
  uterotonicGivenBeforeReplacement: boolean;
  placentaRemovedBeforeReinversion: boolean;

  reinversionSuccessful: boolean;
  timeToReinversionMinutes?: number;
  postReplacementUterotonicsStarted: boolean;
  bimanualUterineCompressionMaintained: boolean;
  bloodProductsTransfusedUnits: number;
}

export interface ObstetricUterineInversionEvaluation {
  shockIndex: number;
  shockSeverity: 'normal' | 'mild' | 'moderate' | 'severe_critical';
  shockSeverityLabel: string;
  neurogenicShockDominant: boolean;

  criticalSafetyViolations: string[];
  surgicalInterventionIndicated: boolean;
  urgencyLevel: 'code_red_immediate' | 'urgent_in_progress' | 'stabilized_post_reduction';

  clinicalGuidelineAlerts: string[];
  stepByStepProtocolPlan: string[];
  summary: string;
}

export function calculateObstetricShockIndex(heartRateBpm: number, systolicBp: number): number {
  if (systolicBp <= 0) return 2.0;
  return Math.round((heartRateBpm / systolicBp) * 100) / 100;
}

export function evaluateObstetricUterineInversion(
  input: ObstetricUterineInversionInput,
): ObstetricUterineInversionEvaluation {
  const shockIndex = calculateObstetricShockIndex(
    input.heartRateAtPresentation,
    input.systolicBpAtPresentation,
  );

  let shockSeverity: ObstetricUterineInversionEvaluation['shockSeverity'] = 'normal';
  let shockSeverityLabel = `Normal Hemodynamics (SI ${shockIndex} < 0.9)`;

  if (shockIndex >= 1.4 || input.systolicBpAtPresentation < 80) {
    shockSeverity = 'severe_critical';
    shockSeverityLabel = `Severe Hemodynamic Collapse (SI ${shockIndex} >= 1.4, SBP ${input.systolicBpAtPresentation} mmHg: Urgent Blood & Vasopressor Resuscitation)`;
  } else if (shockIndex >= 1.0 || input.systolicBpAtPresentation < 90) {
    shockSeverity = 'moderate';
    shockSeverityLabel = `Moderate Shock (SI ${shockIndex} >= 1.0, SBP ${input.systolicBpAtPresentation} mmHg)`;
  } else if (shockIndex >= 0.9) {
    shockSeverity = 'mild';
    shockSeverityLabel = `Mild Compensated Shock (SI ${shockIndex} >= 0.9)`;
  }

  // Neurogenic Shock: Hypotension disproportionate to external blood loss or bradycardia
  const neurogenicShockDominant =
    input.neurogenicShockPresent ||
    (input.systolicBpAtPresentation < 90 && input.estimatedBloodLossMl < 1000);

  // Critical Safety Violations
  const criticalSafetyViolations: string[] = [];

  if (input.uterotonicGivenBeforeReplacement) {
    criticalSafetyViolations.push(
      'LETHAL CONTRAINDICATION: Uterotonics (Oxytocin / Carboprost / Ergometrine) given before reinversion! This severely contracts the cervical ring, trapping the inverted fundus and preventing manual repositioning. Stop uterotonics immediately and administer a uterine tocolytic.',
    );
  }

  if (input.placentaRemovedBeforeReinversion && input.placentalStatusAtInversion !== 'completely_separated') {
    criticalSafetyViolations.push(
      'CRITICAL PROTOCOL BREACH: Attempted manual placental separation before reinversion! Premature placental detachment creates catastrophic torrential hemorrhage from denuded placental bed. Reinvert the uterus WITH placenta in situ first.',
    );
  }

  // Surgical Laparotomy Indication: If non-operative maneuvers fail or 3rd/4th degree complicated
  const surgicalInterventionIndicated =
    !input.reinversionSuccessful ||
    input.reductionTechniquePrimary === 'laparotomy_huntington_procedure' ||
    input.reductionTechniquePrimary === 'laparotomy_haultain_procedure';

  // Urgency Level
  let urgencyLevel: ObstetricUterineInversionEvaluation['urgencyLevel'] = 'code_red_immediate';
  if (input.reinversionSuccessful && input.bimanualUterineCompressionMaintained) {
    urgencyLevel = 'stabilized_post_reduction';
  } else if (input.reductionAttemptedImmediate) {
    urgencyLevel = 'urgent_in_progress';
  }

  // Clinical Alerts
  const clinicalGuidelineAlerts: string[] = [];

  if (input.inversionDegree === 'third_degree_prolapsed_outside_introitus' || input.inversionDegree === 'fourth_degree_total_inversion_with_vagina') {
    clinicalGuidelineAlerts.push(
      `Extreme Prolapse (${input.inversionDegree.replace(/_/g, ' ')}): High risk of infundibulopelvic ligament strangulation and uterine necrosis. Immediate Johnson maneuver under general or tocolytic relaxation indicated.`,
    );
  }

  if (neurogenicShockDominant) {
    clinicalGuidelineAlerts.push(
      'Neurogenic Shock Alert: Profound vasovagal hypotension triggered by peritoneal and ovarian traction. Administer IV atropine 0.5-1 mg if vagal bradycardia is present; rapid crystalloid boluses via two 14G/16G IV cannulae.',
    );
  }

  if (input.uterineRelaxantAdministered && input.reinversionSuccessful && !input.postReplacementUterotonicsStarted) {
    clinicalGuidelineAlerts.push(
      'Post-Reduction Atony Risk: Uterine tocolytics must be immediately countered with high-dose intravenous Oxytocin and bimanual uterine compression to prevent re-inversion and massive atonic PPH.',
    );
  }

  // Step-by-Step Protocol Plan
  const stepByStepProtocolPlan: string[] = [];
  stepByStepProtocolPlan.push('1. Call Obstetric Code Red / Massive Hemorrhage protocol; assemble senior obstetrician, anesthesiologist, and blood bank.');
  stepByStepProtocolPlan.push('2. DO NOT detach placenta; DO NOT give uterotonics until the uterus is completely reinverted.');
  stepByStepProtocolPlan.push('3. Perform immediate Johnson manual maneuver: Grasp the inverted fundus in palm with fingers extending toward the posterior fornix; apply upward pressure along the axis of the pelvic inlet toward the umbilicus.');
  stepByStepProtocolPlan.push('4. If cervical ring is tightly contracted: Administer rapid tocolysis (Terbutaline 0.25 mg SC, Nitroglycerin 100-200 mcg IV, or halogenated inhalational anesthesia) to relax the constriction ring.');
  stepByStepProtocolPlan.push('5. If manual reduction fails: Attempt O\'Sullivan hydrostatic pressure technique (instill 1-2 L warm sterile saline via silicone tubing into the vagina while occluding the labia to elevate the fundus).');
  stepByStepProtocolPlan.push('6. If non-operative methods fail: Immediate emergency laparotomy for operative Huntington traction (Allis forceps on round ligaments) or Haultain procedure (posterior vertical incision of constriction ring).');
  stepByStepProtocolPlan.push('7. Once reinverted: Cease tocolytics; infuse high-dose Oxytocin (40 IU in 500 mL saline), Tranexamic acid 1 g IV, and maintain internal bimanual uterine compression until firm myometrial tone is established.');

  const degreeStr = input.inversionDegree.replace(/_/g, ' ');
  const summary = `Acute Uterine Inversion (${degreeStr}) with ${shockSeverityLabel}. Primary Approach: ${input.reductionTechniquePrimary.replace(/_/g, ' ')}. Status: ${urgencyLevel.replace(/_/g, ' ').toUpperCase()}.`;

  return {
    shockIndex,
    shockSeverity,
    shockSeverityLabel,
    neurogenicShockDominant,
    criticalSafetyViolations,
    surgicalInterventionIndicated,
    urgencyLevel,
    clinicalGuidelineAlerts,
    stepByStepProtocolPlan,
    summary,
  };
}
