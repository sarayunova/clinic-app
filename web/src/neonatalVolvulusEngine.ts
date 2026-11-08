// Pure TypeScript calculation engine for Neonatal Bilious Emesis & Malrotation with Midgut Volvulus Protocol
// Guidelines: AAP Section on Surgery / Pediatric Surgical Guidelines on Emergent Ladd Procedure

export interface NeonatalVolvulusParams {
  ageDays: number;
  weightKg: number;
  emesisColor: 'bilious_dark_green' | 'bilious_light_green_yellow' | 'non_bilious_gastric';
  abdominalDistension: 'absent_scaphoid' | 'mild_epigastric' | 'marked_generalized';
  abdominalTenderness: boolean;
  rectalBleedingMelena: boolean;
  peritonitisSigns: boolean;
  hemodynamicShock: boolean;
  serumLactateMmolL: number;
  bloodPh?: number;
  baseExcessMeqL?: number;
  plainRadiographFinding: 'normal_gas_pattern' | 'gasless_abdomen' | 'double_bubble' | 'distended_stomach_scant_distal_gas' | 'pneumoperitoneum_free_air';
  upperGiContrastDone: boolean;
  upperGiFinding?: 'corkscrew_duodenum_positive' | 'ligament_of_treitz_right_sided' | 'duodenal_beaking_complete_obstruction' | 'normal_c_loop_treitz_left' | 'deferred_emergency_laparotomy';
  dopplerUsWhirlpoolSign?: boolean;
  dopplerSmaSmvInversion?: boolean;
}

export interface NeonatalVolvulusResult {
  isBiliousEmesis: boolean;
  isBowelIschemiaSuspected: boolean;
  urgencyTier: 'immediate_operating_room_crash' | 'emergent_imaging_workup' | 'stable_observation';
  urgencyTierLabel: string;
  laddProcedureIndicated: boolean;
  imagingRecommendation: string;
  resuscitationDirectives: string[];
  recommendations: string[];
  alerts: string[];
}

export type NeonatalVolvulusEvaluationResult = NeonatalVolvulusResult;

export function evaluateNeonatalVolvulus(params: NeonatalVolvulusParams): NeonatalVolvulusResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const resuscitationDirectives: string[] = [];

  const isBiliousEmesis = params.emesisColor === 'bilious_dark_green' || params.emesisColor === 'bilious_light_green_yellow';
  const isHighLactate = params.serumLactateMmolL >= 3.0;
  const isCriticalLactate = params.serumLactateMmolL >= 4.5;
  const isAcidemic = params.bloodPh !== undefined && params.bloodPh < 7.30;

  const hasPeritonitisOrShock = params.peritonitisSigns || params.hemodynamicShock || params.rectalBleedingMelena;
  const isPneumoperitoneum = params.plainRadiographFinding === 'pneumoperitoneum_free_air';

  const isPositiveUpperGi =
    params.upperGiFinding === 'corkscrew_duodenum_positive' ||
    params.upperGiFinding === 'ligament_of_treitz_right_sided' ||
    params.upperGiFinding === 'duodenal_beaking_complete_obstruction';

  const isPositiveDoppler = Boolean(params.dopplerUsWhirlpoolSign || params.dopplerSmaSmvInversion);

  // Bowel ischemia assessment
  const isBowelIschemiaSuspected =
    hasPeritonitisOrShock || isCriticalLactate || (isHighLactate && isAcidemic) || params.rectalBleedingMelena;

  let urgencyTier: 'immediate_operating_room_crash' | 'emergent_imaging_workup' | 'stable_observation' = 'stable_observation';
  let urgencyTierLabel = 'Low Suspicion / Stable Clinical Observation';
  let laddProcedureIndicated = false;
  let imagingRecommendation = 'Plain abdominal radiograph (AP and left lateral decubitus).';

  if (isPneumoperitoneum || (isBiliousEmesis && (hasPeritonitisOrShock || isCriticalLactate))) {
    urgencyTier = 'immediate_operating_room_crash';
    urgencyTierLabel = 'CRITICAL SURGICAL EMERGENCY: Immediate Operating Room Transfer for Emergent Laparotomy / Ladd Procedure';
    laddProcedureIndicated = true;
    imagingRecommendation = 'BYPASS CONTRAST IMAGING: Immediate laparotomy indicated due to bowel ischemia, perforation, or refractory shock.';
    alerts.push('SURGICAL RED ALERT: Midgut volvulus with impending or frank bowel gangrene. Do not delay operative intervention for upper GI contrast series.');
  } else if (isPositiveUpperGi || isPositiveDoppler) {
    urgencyTier = 'immediate_operating_room_crash';
    urgencyTierLabel = 'CONFIRMED MALROTATION WITH VOLVULUS: Urgent Operating Room Transfer for Ladd Procedure';
    laddProcedureIndicated = true;
    imagingRecommendation = 'Diagnostic upper GI series or Doppler ultrasound confirms intestinal malrotation and midgut volvulus.';
    alerts.push('CONFIRMED VOLVULUS: Pathognomonic corkscrew appearance or whirlpool sign identified. Mobilize pediatric surgical team immediately.');
  } else if (isBiliousEmesis) {
    urgencyTier = 'emergent_imaging_workup';
    urgencyTierLabel = 'EMERGENT SURGICAL WORKUP: Bilious Vomiting in Neonate Requires Urgent Upper GI Series';
    laddProcedureIndicated = false;
    imagingRecommendation = 'Stat Upper Gastrointestinal (UGI) Contrast Fluoroscopy is the gold standard diagnostic modality. Bedside ultrasound with color Doppler while awaiting UGI.';
    alerts.push('CARDINAL SURGICAL SIGN: Bilious emesis in a newborn is a surgical emergency until intestinal malrotation with midgut volvulus is definitively excluded.');
  }

  // Pre-operative resuscitation directives
  resuscitationDirectives.push('Immediate NPO status and placement of wide-bore (8-10 Fr) Replogle / orogastric tube to low continuous suction for gastric decompression.');
  resuscitationDirectives.push(`Rapid IV fluid resuscitation: Infuse 0.9% Normal Saline or Ringer's Lactate bolus 10 to 20 mL/kg (${Math.round(params.weightKg * 10)} to ${Math.round(params.weightKg * 20)} mL) over 30-60 min.`);
  resuscitationDirectives.push('Broad-spectrum intravenous antibiotics covering enteric flora (Ampicillin + Gentamicin + Metronidazole).');
  resuscitationDirectives.push('Blood type & crossmatch for 2 units packed red blood cells on immediate standby in the operating theater.');

  if (isBowelIschemiaSuspected) {
    alerts.push(`BOWEL ISCHEMIA WARNING: Serum lactate ${params.serumLactateMmolL} mmol/L, metabolic acidosis, or melena indicates compromising mesenteric arterial perfusion.`);
  }

  recommendations.push(
    laddProcedureIndicated
      ? 'Perform emergent Ladd procedure: counterclockwise detorsion of midgut, division of congenital peritoneal Ladd bands, widening of mesenteric base, appendectomy, and bowel viability assessment.'
      : 'Maintain close clinical surveillance: serial abdominal examinations and hourly gastric aspirate monitoring.'
  );

  return {
    isBiliousEmesis,
    isBowelIschemiaSuspected,
    urgencyTier,
    urgencyTierLabel,
    laddProcedureIndicated,
    imagingRecommendation,
    resuscitationDirectives,
    recommendations,
    alerts,
  };
}
