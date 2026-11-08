// Pure TypeScript Clinical Calculation Engine: Obstetric Umbilical Cord Prolapse & Emergent Decompression Protocol
// References: RCOG Green-top Guideline No. 50; ACOG Practice Bulletin; SOGC Clinical Practice Guidelines

export type MembraneStatus =
  | 'ruptured_artificial'
  | 'ruptured_spontaneous'
  | 'intact_funicular_presentation';

export type FetalPresentation =
  | 'cephalic_vertex'
  | 'breech_frank'
  | 'breech_complete_footling'
  | 'transverse_shoulder'
  | 'compound';

export type ProlapseType =
  | 'overt_cord_visible_or_in_vagina'
  | 'occult_cord_adjacent_to_head';

export type FhrDecelerationType =
  | 'prolonged_bradycardia'
  | 'severe_variable_decelerations'
  | 'normal_fhr_reassuring';

export type MaternalPositioning =
  | 'knee_chest_genupectoral'
  | 'exaggerated_trendelenburg'
  | 'left_lateral_with_pillow'
  | 'supine_unfavorable';

export type TocolysisAgent =
  | 'none'
  | 'terbutaline_sc'
  | 'salbutamol_iv'
  | 'nitroglycerin_sublingual';

export type DeliveryMode =
  | 'category_1_emergency_cesarean'
  | 'assisted_operative_vaginal_vacuum'
  | 'assisted_operative_vaginal_forceps'
  | 'spontaneous_vaginal_imminent';

export type CordProlapseStatus =
  | 'emergent_decompression_active'
  | 'operating_room_in_transit'
  | 'delivered_neonatal_resuscitation'
  | 'postpartum_surveillance_stable';

export interface ObstetricCordProlapseInput {
  maternalAge?: number;
  gestationalAgeWeeks: number;
  cervicalDilationCm: number;
  membraneStatus: MembraneStatus;
  fetalPresentation: FetalPresentation;
  prolapseType: ProlapseType;
  cordPulsationPresent: boolean;
  baselineFhrBpm: number;
  fhrDecelerationType: FhrDecelerationType;

  manualElevationPerformed: boolean;
  maternalPositioning: MaternalPositioning;
  bladderFillingPerformed: boolean;
  bladderSalineVolumeMl: number;
  tocolysisAdministered: boolean;
  tocolysisAgent: TocolysisAgent;
  cordManipulationAvoided: boolean;
  cordWrappedWarmSaline: boolean;

  deliveryMode: DeliveryMode;
  decisionToDeliveryMinutes?: number;
  apgar1min?: number;
  apgar5min?: number;
  umbilicalArterialPh?: number;
}

export interface ObstetricCordProlapseEvaluation {
  isObstetricEmergency: boolean;
  fetalHypoxiaRiskTier: 'critical_terminal_bradycardia' | 'severe_intermittent_hypoxia' | 'moderate_reassuring_fhr';
  fetalHypoxiaRiskLabel: string;

  decompressionQualityScore: number; // 0 to 5 score
  decompressionDeficiencies: string[];

  category1CesareanMandated: boolean;
  ddiTargetExceeded: boolean;

  clinicalSafetyDirectives: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Evaluates Cord Prolapse emergent decompression adequacy, fetal hypoxia risk,
 * tocolysis indication, and decision-to-delivery interval compliance.
 */
export function evaluateObstetricCordProlapse(
  input: ObstetricCordProlapseInput,
): ObstetricCordProlapseEvaluation {
  const isObstetricEmergency = true;

  let fetalHypoxiaRiskTier: ObstetricCordProlapseEvaluation['fetalHypoxiaRiskTier'] =
    'moderate_reassuring_fhr';
  let fetalHypoxiaRiskLabel = 'Moderate Risk: Reassuring Baseline FHR';

  if (input.baselineFhrBpm < 100 || !input.cordPulsationPresent || input.fhrDecelerationType === 'prolonged_bradycardia') {
    fetalHypoxiaRiskTier = 'critical_terminal_bradycardia';
    fetalHypoxiaRiskLabel = `CRITICAL FETAL DISTRESS (FHR ${input.baselineFhrBpm} bpm / Absent or Weak Cord Pulsation)`;
  } else if (input.fhrDecelerationType === 'severe_variable_decelerations' || input.baselineFhrBpm < 110) {
    fetalHypoxiaRiskTier = 'severe_intermittent_hypoxia';
    fetalHypoxiaRiskLabel = `Severe Intermittent Cord Compression (FHR ${input.baselineFhrBpm} bpm with Variable Decelerations)`;
  }

  // Quality of decompression assessment (5 items):
  // 1. Manual elevation performed
  // 2. Favorable positioning (knee-chest or trendelenburg)
  // 3. Tocolysis administered (if contractions active)
  // 4. Bladder filling or gentle continuous elevation
  // 5. Minimal cord handling & warm saline wrapping (prevents vasospasm)
  let decompressionQualityScore = 0;
  const decompressionDeficiencies: string[] = [];

  if (input.manualElevationPerformed) {
    decompressionQualityScore++;
  } else {
    decompressionDeficiencies.push('Manual elevation of the presenting part is NOT currently maintained');
  }

  if (input.maternalPositioning === 'knee_chest_genupectoral' || input.maternalPositioning === 'exaggerated_trendelenburg') {
    decompressionQualityScore++;
  } else {
    decompressionDeficiencies.push(`Suboptimal positioning (${input.maternalPositioning.replace(/_/g, ' ')}). Place in Knee-Chest or Exaggerated Trendelenburg immediately.`);
  }

  if (input.cordManipulationAvoided && input.cordWrappedWarmSaline) {
    decompressionQualityScore++;
  } else {
    decompressionDeficiencies.push('Avoid manual manipulation of externalized cord; wrap loosely in warm saline-soaked swabs to prevent spasm.');
  }

  if (input.tocolysisAdministered && input.tocolysisAgent !== 'none') {
    decompressionQualityScore++;
  } else {
    decompressionDeficiencies.push('Acute tocolytic (Terbutaline 0.25 mg SC) recommended to stop uterine contractions and relieve cord pressure.');
  }

  if (input.bladderFillingPerformed && input.bladderSalineVolumeMl >= 400) {
    decompressionQualityScore++;
  } else if (input.manualElevationPerformed) {
    // If continuous manual elevation is maintained, partial credit
    decompressionQualityScore += 0.5;
  }

  const category1CesareanMandated =
    input.cervicalDilationCm < 10.0 ||
    input.deliveryMode === 'category_1_emergency_cesarean';

  const ddiTargetExceeded =
    input.decisionToDeliveryMinutes !== undefined &&
    input.decisionToDeliveryMinutes > 30;

  const clinicalSafetyDirectives: string[] = [
    'CONTINUOUS MANUAL ELEVATION: The clinician must insert a gloved hand into the vagina and push the presenting fetal part upward, away from the prolapsed cord, until the surgeon delivers the head through the uterine incision.',
    'AVOID CORD HANDLING: Do NOT attempt to replace the prolapsed cord into the uterus. Handling induces severe reflex vasospasm of the umbilical arteries, leading to profound fetal acidosis and brain injury.',
    'BLADDER FILLING (VAGO PROTOCOL): Instill 500 mL warm sterile normal saline into the bladder via a Foley catheter, then clamp the catheter. This elevates the presenting part and buys vital time during transfer to the operating theater.',
    'ACUTE TOCOLYSIS: Administer Terbutaline 0.25 mg subcutaneous immediately to abolish uterine contractions while surgical preparations are underway.',
    'DECISION-TO-DELIVERY INTERVAL: Category-1 Cesarean delivery target is ≤ 30 minutes from prolapse recognition to incision.',
  ];

  const criticalActionPlan: string[] = [];
  criticalActionPlan.push(`EMERGENCY: Umbilical Cord Prolapse (${input.prolapseType.replace(/_/g, ' ')}). FHR: ${input.baselineFhrBpm} bpm.`);

  if (!input.manualElevationPerformed) {
    criticalActionPlan.push('STAT: Immediately elevate the presenting fetal part off the pelvic brim by vaginal digital examination!');
  } else {
    criticalActionPlan.push('Manual elevation of fetal head active. Maintain constant upward pressure until delivery.');
  }

  if (input.maternalPositioning === 'supine_unfavorable') {
    criticalActionPlan.push('Shift patient immediately into Knee-Chest (genupectoral) or Trendelenburg position.');
  }

  if (!input.tocolysisAdministered) {
    criticalActionPlan.push('Administer Terbutaline 0.25 mg SC stat to relax myometrium and cease contractions.');
  }

  if (category1CesareanMandated) {
    criticalActionPlan.push('ACTIVATE CODE CRIMSON / CATEGORY 1 CESAREAN: Transfer to Operating Room stat under continuous digital elevation.');
  }

  if (ddiTargetExceeded) {
    criticalActionPlan.push(`AUDIT WARNING: Decision-to-Delivery Interval ${input.decisionToDeliveryMinutes} min exceeds 30-minute target.`);
  }

  const summary = `Obstetric Cord Prolapse: ${fetalHypoxiaRiskLabel}. Decompression quality: ${decompressionQualityScore}/5. ${input.manualElevationPerformed ? 'Manual elevation active.' : 'ELEVATION REQUIRED.'} ${category1CesareanMandated ? 'Category-1 Cesarean Section underway.' : 'Operative delivery planned.'}`;

  return {
    isObstetricEmergency,
    fetalHypoxiaRiskTier,
    fetalHypoxiaRiskLabel,
    decompressionQualityScore,
    decompressionDeficiencies,
    category1CesareanMandated,
    ddiTargetExceeded,
    clinicalSafetyDirectives,
    summary,
    criticalActionPlan,
  };
}
