// Pure TypeScript calculation engine for Neonatal Esophageal Atresia (EA) & Tracheoesophageal Fistula (TEF) Protocol
// Guidelines: AAP Section on Surgery / BAPS / ESPGHAN-NASPGHAN Consensus Guidelines

export type GrossClassificationType =
  | 'type_a_isolated_ea_no_fistula'
  | 'type_b_ea_with_proximal_tef'
  | 'type_c_ea_with_distal_tef'
  | 'type_d_ea_with_both_fistulas'
  | 'type_e_isolated_h_type_tef';

export type AbdominalGasPattern =
  | 'gasless_abdomen_no_distal_fistula'
  | 'aerated_gastrointestinal_tract'
  | 'massive_gastric_distension';

export type GapLengthClassification =
  | 'short_gap_primary_anastomosis'
  | 'intermediate_gap_1_to_3_cm'
  | 'long_gap_greater_3_cm_or_vertebrae';

export type SurgicalProcedurePlanned =
  | 'primary_extrapleural_repair_fistula_ligation'
  | 'thoracoscopic_repair_fistula_ligation'
  | 'staged_gastrostomy_delayed_anastomosis'
  | 'cervical_esophagostomy';

export interface NeonatalEaTefParams {
  ageHours: number;
  weightKg: number;
  frothyOralSecretions: boolean;
  chokingCyanosisWithFeed: boolean;
  ogTubeCoilingDistanceCm: number;
  grossClassificationType: GrossClassificationType;
  abdominalGasPattern: AbdominalGasPattern;
  replogleTubeInSitu: boolean;
  replogleSuctionPressureMmHg: number;
  gapLengthClassification: GapLengthClassification;
  vacterlVertebralAnomaly: boolean;
  vacterlAnorectalMalformation: boolean;
  vacterlCardiacAnomaly: boolean;
  vacterlRightAorticArch: boolean;
  vacterlRenalUltrasoundAbnormal: boolean;
  vacterlLimbRadialAnomaly: boolean;
  headOfBedElevated30deg: boolean;
  surgicalProcedurePlanned: SurgicalProcedurePlanned;
}

export interface NeonatalEaTefResult {
  isVacterlSyndromeSuspected: boolean;
  vacterlFeatureCount: number;
  vacterlDefectsIdentified: string[];
  surgicalThoracotomySide: 'right_thoracotomy_standard' | 'left_thoracotomy_right_arch';
  surgicalThoracotomySideLabel: string;
  grossTypeDescription: string;
  hasDistalFistula: boolean;
  isLongGap: boolean;
  replogleProtocolDirectives: string[];
  preoperativeAirwayDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_surgical_repair' | 'urgent_preop_decompression' | 'staged_long_gap_management';
  urgencyTierLabel: string;
}

export type NeonatalEaTefEvaluationResult = NeonatalEaTefResult;

export function evaluateNeonatalEaTef(params: NeonatalEaTefParams): NeonatalEaTefResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const replogleProtocolDirectives: string[] = [];
  const preoperativeAirwayDirectives: string[] = [];
  const vacterlDefectsIdentified: string[] = [];

  // VACTERL scoring (Vertebral, Anal, Cardiac, TEF/EA, Renal, Limb)
  // EA/TEF is inherently present (+1)
  let vacterlCount = 1;
  vacterlDefectsIdentified.push('Esophageal Atresia / Tracheoesophageal Fistula (Index Diagnosis)');

  if (params.vacterlVertebralAnomaly) {
    vacterlCount++;
    vacterlDefectsIdentified.push('Vertebral defect (hemivertebrae / spinal dysraphism)');
  }
  if (params.vacterlAnorectalMalformation) {
    vacterlCount++;
    vacterlDefectsIdentified.push('Anorectal malformation (imperforate anus / cloaca)');
  }
  if (params.vacterlCardiacAnomaly) {
    vacterlCount++;
    vacterlDefectsIdentified.push('Congenital cardiac anomaly (VSD/ASD/Tetralogy/Coarctation)');
  }
  if (params.vacterlRenalUltrasoundAbnormal) {
    vacterlCount++;
    vacterlDefectsIdentified.push('Renal/urological anomaly (renal agenesis/dysplasia/hydronephrosis)');
  }
  if (params.vacterlLimbRadialAnomaly) {
    vacterlCount++;
    vacterlDefectsIdentified.push('Limb/radial ray anomaly (radial aplasia/hypoplasia, thumb anomaly)');
  }

  const isVacterlSyndromeSuspected = vacterlCount >= 3;

  // Distal fistula detection
  const hasDistalFistula =
    params.grossClassificationType === 'type_c_ea_with_distal_tef' ||
    params.grossClassificationType === 'type_d_ea_with_both_fistulas' ||
    params.grossClassificationType === 'type_e_isolated_h_type_tef';

  const isLongGap = params.gapLengthClassification === 'long_gap_greater_3_cm_or_vertebrae';

  // Gross Classification description
  let grossTypeDescription = '';
  switch (params.grossClassificationType) {
    case 'type_a_isolated_ea_no_fistula':
      grossTypeDescription = 'Gross Type A: Pure Esophageal Atresia without TEF (~8%). Gasless abdomen, frequently long-gap.';
      break;
    case 'type_b_ea_with_proximal_tef':
      grossTypeDescription = 'Gross Type B: EA with Proximal TEF (<1%). Upper pouch fistula into trachea; gasless abdomen.';
      break;
    case 'type_c_ea_with_distal_tef':
      grossTypeDescription = 'Gross Type C: EA with Distal TEF (~85-86%). Classic presentation with aerated distal bowel.';
      break;
    case 'type_d_ea_with_both_fistulas':
      grossTypeDescription = 'Gross Type D: EA with both Proximal and Distal TEF (<1%). Complex dual fistula anatomy.';
      break;
    case 'type_e_isolated_h_type_tef':
      grossTypeDescription = 'Gross Type E: Isolated H-type / N-type TEF (~4%). Esophagus patent; choking during feeds.';
      break;
  }

  // Surgical thoracotomy lateralization: standard is RIGHT thoracotomy.
  // CRITICAL SURGICAL PEARL: If patient has a RIGHT-SIDED AORTIC ARCH, thoracotomy MUST be performed on the LEFT side!
  let surgicalThoracotomySide: 'right_thoracotomy_standard' | 'left_thoracotomy_right_arch' =
    'right_thoracotomy_standard';
  let surgicalThoracotomySideLabel = 'Standard Right Extrapleural Thoracotomy / Thoracoscopy (Left Aortic Arch)';

  if (params.vacterlRightAorticArch) {
    surgicalThoracotomySide = 'left_thoracotomy_right_arch';
    surgicalThoracotomySideLabel = 'CRITICAL LATERALIZATION: Left Thoracotomy Required (Right Aortic Arch Overlying Fistula)';
    alerts.push(
      'SURGICAL ANATOMICAL ALERT: Right-sided aortic arch confirmed on echocardiogram. Repair requires a LEFT thoracotomy to avoid dissection through an aberrant aortic arch.'
    );
  }

  // Replogle sump protocol directives
  if (!params.replogleTubeInSitu) {
    alerts.push('CRITICAL AIRWAY RISK: Replogle double-lumen sump tube is NOT in situ. Place 8 Fr or 10 Fr Replogle immediately to prevent pulmonary aspiration of secretions.');
  } else {
    replogleProtocolDirectives.push('Replogle sump tube (8 Fr or 10 Fr) seated in blind proximal esophageal pouch.');
    if (params.replogleSuctionPressureMmHg < 20 || params.replogleSuctionPressureMmHg > 30) {
      alerts.push(
        `WARNING: Replogle suction pressure (${params.replogleSuctionPressureMmHg} mmHg) out of recommended target range (20-30 mmHg). Low suction fails to clear secretions; excessive suction causes mucosal ulceration.`
      );
    } else {
      replogleProtocolDirectives.push(`Suction set to continuous low vacuum (${params.replogleSuctionPressureMmHg} mmHg target: 20-30 mmHg).`);
    }
    replogleProtocolDirectives.push('Flush Replogle sump lumen with 0.5 - 1.0 mL sterile normal saline q15-30min to ensure continuous air sump and patency.');
  }

  if (!params.headOfBedElevated30deg) {
    alerts.push('REFLUX WARNING: Keep Head of Bed elevated 30 to 45 degrees to prevent distal acid and enteric reflux across distal tracheoesophageal fistula into the bronchial tree.');
  } else {
    replogleProtocolDirectives.push('Head of bed maintained in 30° - 45° reverse Trendelenburg positioning.');
  }

  // Abdominal gas mismatch check
  if (!hasDistalFistula && params.abdominalGasPattern !== 'gasless_abdomen_no_distal_fistula') {
    alerts.push(
      'DIAGNOSTIC DISCREPANCY: Gross Type A or B specified, but gas is noted in the gastrointestinal tract. Re-evaluate for occult distal tracheoesophageal fistula.'
    );
  }
  if (hasDistalFistula && params.abdominalGasPattern === 'gasless_abdomen_no_distal_fistula') {
    alerts.push(
      'ANATOMICAL WARNING: Gasless abdomen in suspected distal TEF suggests plugged fistula, carinal atresia, or misclassified pure EA (Type A).'
    );
  }
  if (params.abdominalGasPattern === 'massive_gastric_distension') {
    alerts.push(
      'CRITICAL BAROTRAUMA ALERT: Massive gastric distension with distal TEF creates low-resistance pulmonary bypass. If positive pressure ventilation is used, air flows into stomach causing diaphragmatic splinting or gastric rupture. Emergency gastrostomy decompression or immediate fistula ligation required.'
    );
  }

  // Preoperative Airway & Ventilation Directives
  preoperativeAirwayDirectives.push('Maintain spontaneous respiration whenever possible prior to fistula ligation.');
  preoperativeAirwayDirectives.push('Avoid vigorous bag-valve-mask ventilation (forces gas down fistula into stomach causing gastric distension and rupture).');
  preoperativeAirwayDirectives.push('If intubation is required, place endotracheal tube with bevel positioned distal to fistula orifice near the carina to selectively ventilate lungs without inflating stomach.');

  // Long gap vs short gap urgency tier
  let urgencyTier: 'emergency_surgical_repair' | 'urgent_preop_decompression' | 'staged_long_gap_management' =
    'urgent_preop_decompression';
  let urgencyTierLabel = 'Urgent Preoperative Sump Decompression & VACTERL Staging';

  if (params.abdominalGasPattern === 'massive_gastric_distension' || params.chokingCyanosisWithFeed) {
    urgencyTier = 'emergency_surgical_repair';
    urgencyTierLabel = 'EMERGENT SURGICAL REPAIR: Impending Pulmonary Decompensation';
  } else if (isLongGap) {
    urgencyTier = 'staged_long_gap_management';
    urgencyTierLabel = 'STAGED LONG-GAP MANAGEMENT: Gastrostomy & Delayed Anastomosis Protocol';
    recommendations.push(
      'Long-gap esophageal atresia (> 3 cm or > 2-3 vertebral bodies): primary anastomosis has prohibitive tension. Plan gastrostomy tube placement, continuous Replogle pouch suction, and delayed primary anastomosis (or Foker traction technique) at 8-12 weeks.'
    );
  } else {
    urgencyTier = 'urgent_preop_decompression';
    urgencyTierLabel = 'Surgical Anastomosis & Fistula Ligation Candidate (Short Gap)';
    recommendations.push(
      'Perform primary extrapleural thoracotomy or thoracoscopy: ligate distal fistula with hemoclips/suture and achieve tension-free end-to-end esophageal anastomosis over transanastomotic tube.'
    );
  }

  if (isVacterlSyndromeSuspected) {
    alerts.push(
      `VACTERL ASSOCIATION CONFIRMED (${vacterlCount}/6 features): Preoperative echocardiogram, spinal ultrasound, and renal ultrasound mandatory prior to general anesthesia.`
    );
  }

  // Postoperative contrast study directive
  recommendations.push('Keep transanastomotic silastic tube on free drainage. Maintain NPO with total parenteral nutrition (TPN) until Day 5-7 postoperative water-soluble contrast esophagram confirms no anastomotic leak.');

  return {
    isVacterlSyndromeSuspected,
    vacterlFeatureCount: vacterlCount,
    vacterlDefectsIdentified,
    surgicalThoracotomySide,
    surgicalThoracotomySideLabel,
    grossTypeDescription,
    hasDistalFistula,
    isLongGap,
    replogleProtocolDirectives,
    preoperativeAirwayDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
