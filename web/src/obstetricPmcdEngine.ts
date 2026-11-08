// Pure TypeScript calculation engine for Obstetric Perimortem Cesarean Delivery (PMCD) / Resuscitative Hysterotomy Protocol
// Guidelines: AHA CPR in Pregnancy Guidelines / SOAP / RCOG Green-top Guideline No. 56

export type PmcdArrestRhythm =
  | 'asystole'
  | 'pea'
  | 'ventricular_fibrillation'
  | 'pulseless_vt';

export type PmcdBeauChopsEtiology =
  | 'bleeding_dic'
  | 'embolism_afe_pte'
  | 'anesthetic_complication_last'
  | 'uterine_atony'
  | 'cardiac_underlying'
  | 'hypertension_preeclampsia'
  | 'other_toxic_metabolic'
  | 'placenta_abruption_accreta'
  | 'sepsis_shock';

export type PmcdUterineClosureMethod =
  | 'rapid_single_layer_in_situ'
  | 'hemostatic_packing_temporary_closure'
  | 'emergent_hysterectomy';

export interface ObstetricPmcdParams {
  gestationalAgeWeeks: number;
  initialArrestRhythm: PmcdArrestRhythm;
  continuousLeftUterineDisplacement: boolean;
  pmcdDecisionMinute: number;
  elapsedArrestToDeliveryMinutes: number | null;
  roscAchievedPostDelivery: boolean;
  primaryEtiologyBeauChops: PmcdBeauChopsEtiology;
  uterineClosureMethod: PmcdUterineClosureMethod;
}

export interface ObstetricPmcdResult {
  isAortocavalCompressionSignificant: boolean;
  isFourMinuteRuleCompliant: boolean;
  timeComplianceLabel: string;
  etiologySpecificDirectives: string[];
  operativeHysterotomyDirectives: string[];
  postRoscCareDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_active_hysterotomy_resuscitation' | 'post_rosc_intensive_care' | 'case_debrief_and_review';
  urgencyTierLabel: string;
}

export type ObstetricPmcdEvaluationResult = ObstetricPmcdResult;

export function evaluateObstetricPmcd(params: ObstetricPmcdParams): ObstetricPmcdResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const etiologySpecificDirectives: string[] = [];
  const operativeHysterotomyDirectives: string[] = [];
  const postRoscCareDirectives: string[] = [];

  // 1. Aortocaval Compression Threshold (>= 20 weeks)
  const isAortocavalCompressionSignificant = params.gestationalAgeWeeks >= 20.0;
  if (isAortocavalCompressionSignificant) {
    alerts.push(`SEVERE AORTOCAVAL COMPRESSION (${params.gestationalAgeWeeks} wks): The gravid uterus compresses the inferior vena cava and aorta, reducing venous return by 60–80% and rendering standard chest compressions largely ineffective.`);
  }

  // 2. Left Uterine Displacement (LUD)
  if (!params.continuousLeftUterineDisplacement && isAortocavalCompressionSignificant) {
    alerts.push('CRITICAL CPR VIOLATION: Continuous manual Left Uterine Displacement (LUD ≥ 30° left lateral tilt or two-handed leftward cupping) must be maintained during all chest compressions!');
  } else if (isAortocavalCompressionSignificant) {
    recommendations.push('Manual Left Uterine Displacement active: Continue uninterrupted manual leftward displacement to optimize right atrial preload during CPR.');
  }

  // 3. The 4-to-5 Minute Rule Evaluation
  const isFourMinuteRuleCompliant = params.pmcdDecisionMinute <= 4.0;
  let timeComplianceLabel = '';

  if (isFourMinuteRuleCompliant) {
    timeComplianceLabel = `Target Met (Decision/Incision at ${params.pmcdDecisionMinute} min ≤ 4 min)`;
    recommendations.push('Compliant with AHA/SOAP 4-minute rule: Resuscitative hysterotomy initiated within 4 minutes of arrest to achieve delivery by 5 minutes.');
  } else {
    timeComplianceLabel = `Delayed Decision (${params.pmcdDecisionMinute} min > 4 min target)`;
    alerts.push(`TIME COMPLIANCE BREACH: Incision decision made at ${params.pmcdDecisionMinute} minutes post-arrest. Delayed hysterotomy drastically reduces maternal ROSC and increases neonatal anoxic encephalopathy.`);
  }

  if (params.elapsedArrestToDeliveryMinutes !== null) {
    if (params.elapsedArrestToDeliveryMinutes <= 5.0) {
      recommendations.push(`Delivery achieved in ${params.elapsedArrestToDeliveryMinutes} minutes: Optimal hemodynamic decompression achieved within 5-minute golden window.`);
    } else {
      alerts.push(`Total arrest-to-delivery time of ${params.elapsedArrestToDeliveryMinutes} minutes exceeded the 5-minute delivery goal.`);
    }
  }

  // 4. Operative Bedside Resuscitative Hysterotomy Directives
  operativeHysterotomyDirectives.push('ZERO TRANSPORT DELAY: Never move the patient to the operating theatre. Perform hysterotomy immediately at the location of arrest (ED/ICU/L&D triage).');
  operativeHysterotomyDirectives.push('Do NOT wait for surgical prep, full sterile draping, anesthesia, or confirmation of fetal heart tones.');
  operativeHysterotomyDirectives.push('Incision: Rapid midline vertical abdominal skin incision from umbilicus to pubic symphysis using a scalpel.');
  operativeHysterotomyDirectives.push('Uterine entry: Lower uterine segment transverse or vertical incision; bluntly extend, rupture membranes, and swiftly deliver neonate.');
  operativeHysterotomyDirectives.push('Immediate cord clamping and handoff to awaiting neonatal resuscitation team.');
  operativeHysterotomyDirectives.push('Manual placental extraction and rapid temporary closure (running single-layer suture or hemostatic packing) to minimize ongoing maternal blood loss.');

  // 5. BEAU-CHOPS Etiology Directives
  switch (params.primaryEtiologyBeauChops) {
    case 'anesthetic_complication_last':
      etiologySpecificDirectives.push('Local Anesthetic Systemic Toxicity (LAST): Administer 20% Lipid Emulsion (Intralipid) 1.5 mL/kg IV bolus over 1 min, followed by 0.25 mL/kg/min infusion. Avoid vasopressin, beta-blockers, and calcium channel blockers.');
      break;
    case 'bleeding_dic':
      etiologySpecificDirectives.push('Obstetric Hemorrhage & Coagulopathy: Activate Massive Transfusion Protocol (MTP 1:1:1 PRBC:FFP:Platelets). Administer Tranexamic Acid 1g IV over 10 min, Calcium chloride 1g IV for hypocalcemia, and warm fluids.');
      break;
    case 'embolism_afe_pte':
      etiologySpecificDirectives.push('Amniotic Fluid Embolism (AFE) / PTE: Administer A-OK regimen (Atropine 1 mg, Ondansetron 8 mg, Ketorolac 30 mg IV). Initiate high-dose inotropic support (Norepinephrine + Epinephrine) and manage severe pulmonary hypertension / RV failure.');
      break;
    case 'hypertension_preeclampsia':
      etiologySpecificDirectives.push('Severe Preeclampsia / Eclampsia: If hypermagnesemia / Magnesium toxicity suspected (absent reflexes, respiratory arrest), immediately give 10% Calcium Gluconate 10 mL IV over 3 minutes.');
      break;
    case 'uterine_atony':
      etiologySpecificDirectives.push('Refractory Uterine Atony: Administer uterotonics (Oxytocin infusion, Carboprost/PGF2a 250 mcg IM, Methylergonovine 0.2 mg IM, Misoprostol 800 mcg sublingual/PR); prepare for uterine balloon tamponade, B-Lynch compression sutures, or emergency peripartum hysterectomy.');
      break;
    case 'sepsis_shock':
      etiologySpecificDirectives.push('Septic Shock / Chorioamnionitis: Blood cultures, urgent broad-spectrum beta-lactam + aminoglycoside coverage, rapid balanced crystalloid loading (30 mL/kg), and early Norepinephrine vasopressor support.');
      break;
    default:
      etiologySpecificDirectives.push('Systematically investigate and treat BEAU-CHOPS reversible causes while maintaining high-quality chest compressions and targeted ventilation.');
      break;
  }

  // 6. Post-ROSC Critical Care Directives
  if (params.roscAchievedPostDelivery) {
    recommendations.push('Return of Spontaneous Circulation (ROSC) achieved following uterine evacuation: Promptly transfer to Intensive Care Unit (ICU) for targeted temperature management and invasive hemodynamic monitoring.');
    postRoscCareDirectives.push('Targeted Temperature Management (TTM): Maintain normothermia (36.0°C–37.5°C); prevent post-arrest fever strictly.');
    postRoscCareDirectives.push('Optimize ventilation: Avoid hyperventilation (target PaCO2 35–45 mmHg, SpO2 94–98%).');
    postRoscCareDirectives.push('Maintain mean arterial pressure (MAP ≥ 65–70 mmHg) with titrated vasopressors; monitor for reperfusion coagulopathy and secondary DIC.');
  }

  // 7. Urgency Tier
  let urgencyTier: 'emergency_active_hysterotomy_resuscitation' | 'post_rosc_intensive_care' | 'case_debrief_and_review' =
    'post_rosc_intensive_care';
  let urgencyTierLabel = 'Post-ROSC Intensive Care & Hemostatic Stabilization';

  if (!params.roscAchievedPostDelivery) {
    urgencyTier = 'emergency_active_hysterotomy_resuscitation';
    urgencyTierLabel = 'EMERGENCY: Active Cardiac Arrest & Resuscitative Hysterotomy';
  } else if (params.elapsedArrestToDeliveryMinutes !== null && params.elapsedArrestToDeliveryMinutes > 0) {
    urgencyTier = 'post_rosc_intensive_care';
    urgencyTierLabel = 'Post-ROSC ICU Targeted Management';
  }

  return {
    isAortocavalCompressionSignificant,
    isFourMinuteRuleCompliant,
    timeComplianceLabel,
    etiologySpecificDirectives,
    operativeHysterotomyDirectives,
    postRoscCareDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
