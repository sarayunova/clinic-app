// Pure TypeScript calculation engine for Neonatal Abdominal Wall Defects (Gastroschisis vs Omphalocele) & Staged Silo Reduction Protocol
// Guidelines: APSA (American Pediatric Surgical Association) / AAP Section on Surgery / BAPS Consensus Guidelines

export type AbdominalDefectType =
  | 'gastroschisis'
  | 'omphalocele_intact'
  | 'omphalocele_ruptured';

export type CordInsertionSite =
  | 'normal_left_of_defect'
  | 'sac_apex'
  | 'disrupted';

export type EvisceratedOrgans =
  | 'small_and_large_bowel'
  | 'bowel_and_liver'
  | 'bowel_liver_spleen_gonads';

export type BowelCondition =
  | 'healthy_normal_peristalsis'
  | 'edematous_fibrin_peel'
  | 'ischemic_gangrenous'
  | 'perforated_atresia';

export type ClosureApproach =
  | 'primary_bedside_sutureless'
  | 'primary_operative_closure'
  | 'staged_silo_reduction'
  | 'delayed_escharotic_paint_and_wait';

export type SiloType =
  | 'none'
  | 'preformed_spring_loaded_bedside'
  | 'surgically_fashioned_dacron_silo';

export type LowerExtremityPerfusion =
  | 'warm_pink_pulses_brisk'
  | 'sluggish_cap_refill_delayed'
  | 'pale_cool_pulses_diminished';

export type BowelVisceralColor =
  | 'pink_viable'
  | 'hyperemic_mild_edema'
  | 'dusky_venous_congestion'
  | 'ischemic_black';

export interface NeonatalAbdominalDefectsParams {
  defectType: AbdominalDefectType;
  defectDiameterCm: number;
  cordInsertionSite: CordInsertionSite;
  membraneSacPresent: boolean;
  evisceratedOrgans: EvisceratedOrgans;
  bowelCondition: BowelCondition;
  closureApproach: ClosureApproach;
  siloType: SiloType;
  siloHeightCm?: number | null;
  currentBladderPressureMmHg: number;
  peakInspiratoryPressureCmH2O: number;
  beckwithWiedemannSuspected: boolean;
  cardiacEchoCompleted: boolean;
  associatedAnomaliesNote?: string | null;
}

export type IahGrade =
  | 'normal'
  | 'grade_1_mild'
  | 'grade_2_moderate'
  | 'grade_3_severe'
  | 'grade_4_compartment_syndrome';

export interface NeonatalAbdominalDefectsResult {
  defectClassification: 'gastroschisis' | 'omphalocele_intact' | 'omphalocele_ruptured';
  defectClassificationLabel: string;
  isGiantDefect: boolean;
  hasLiverEvisceration: boolean;
  iahGrade: IahGrade;
  iahGradeLabel: string;
  isCompartmentSyndromeRisk: boolean;
  fluidManagementDirectives: string[];
  bedsideSiloDirectives: string[];
  anomaliesScreeningDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_acs_or_compromise' | 'urgent_staged_reduction' | 'stable_serial_reduction';
  urgencyTierLabel: string;
}

export type NeonatalAbdominalDefectsEvaluationResult = NeonatalAbdominalDefectsResult;

export function evaluateNeonatalAbdominalDefects(
  params: NeonatalAbdominalDefectsParams
): NeonatalAbdominalDefectsResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const fluidManagementDirectives: string[] = [];
  const bedsideSiloDirectives: string[] = [];
  const anomaliesScreeningDirectives: string[] = [];

  const isGiantDefect = params.defectDiameterCm >= 5.0;
  const hasLiverEvisceration =
    params.evisceratedOrgans === 'bowel_and_liver' ||
    params.evisceratedOrgans === 'bowel_liver_spleen_gonads';

  // 1. Defect Classification & Sac Integrity
  let defectClassificationLabel = '';
  if (params.defectType === 'gastroschisis') {
    defectClassificationLabel = 'Gastroschisis (Paraumbilical, No Amniotic Sac)';
  } else if (params.defectType === 'omphalocele_intact') {
    defectClassificationLabel = 'Omphalocele (Midline, Intact Covering Sac)';
  } else {
    defectClassificationLabel = 'Ruptured Omphalocele (Midline, Sac Disrupted)';
  }

  // 2. Intra-Abdominal Hypertension (IAH) Staging
  const bp = params.currentBladderPressureMmHg;
  let iahGrade: IahGrade = 'normal';
  let iahGradeLabel = 'Normal (< 10 mmHg)';

  if (bp >= 20.0) {
    iahGrade = 'grade_4_compartment_syndrome';
    iahGradeLabel = 'Grade IV IAH / Abdominal Compartment Syndrome (>= 20 mmHg)';
    alerts.push('CRITICAL ALERT: Bladder pressure >= 20 mmHg indicative of Abdominal Compartment Syndrome (ACS). Immediately suspend reduction and loosen/enlarge silo!');
  } else if (bp >= 15.0) {
    iahGrade = 'grade_3_severe';
    iahGradeLabel = 'Grade III IAH (15-19 mmHg)';
    alerts.push('WARNING: Severe Intra-Abdominal Hypertension (15-19 mmHg). High risk of renal/visceral ischemia. Stop reduction and monitor ventilation.');
  } else if (bp >= 12.0) {
    iahGrade = 'grade_2_moderate';
    iahGradeLabel = 'Grade II IAH (12-14 mmHg)';
    recommendations.push('Moderate Intra-Abdominal Hypertension (12-14 mmHg). Slow rate of daily bowel reduction.');
  } else if (bp >= 10.0) {
    iahGrade = 'grade_1_mild';
    iahGradeLabel = 'Grade I IAH (10-11 mmHg)';
    recommendations.push('Mild IAH present. Continue serial bladder pressure monitoring after each reduction step.');
  }

  // Peak Inspiratory Pressure (PIP) check
  if (params.peakInspiratoryPressureCmH2O >= 22.0) {
    alerts.push(`Elevated Peak Inspiratory Pressure (${params.peakInspiratoryPressureCmH2O} cmH2O) suggests diaphragmatic splinting and decreased thoracic compliance.`);
  }

  // 3. Bowel Condition Analysis
  if (params.bowelCondition === 'ischemic_gangrenous') {
    alerts.push('EMERGENCY: Visceral ischemia/gangrene detected. Requires urgent pediatric surgical exploration!');
  } else if (params.bowelCondition === 'perforated_atresia') {
    alerts.push('URGENT: Perforation or co-existing intestinal atresia detected. Surgical repair/diversion needed.');
  } else if (params.bowelCondition === 'edematous_fibrin_peel') {
    recommendations.push('Bowel thickened with fibrinous peel from amniotic fluid exposure. Staged reduction preferred over forced primary closure.');
  }

  // 4. Compartment Syndrome Risk Synthesis
  const isCompartmentSyndromeRisk =
    iahGrade === 'grade_3_severe' ||
    iahGrade === 'grade_4_compartment_syndrome' ||
    params.peakInspiratoryPressureCmH2O >= 25.0;

  // 5. Defect-Specific Protocols
  if (params.defectType === 'gastroschisis') {
    fluidManagementDirectives.push('Gastroschisis high evaporative fluid loss: Start IV maintenance fluids at 150-175 mL/kg/day (10% Dextrose with electrolytes).');
    fluidManagementDirectives.push('Replogle or sump orogastric tube on continuous low suction (-20 to -30 mmHg) to decompress bowel and prevent aspiration.');
    fluidManagementDirectives.push('Place neonate up to axillae in sterile bowel bag with warm saline; position on right side to optimize mesenteric vascular perfusion.');

    if (params.closureApproach === 'staged_silo_reduction') {
      bedsideSiloDirectives.push('Spring-loaded preformed silo placed at bedside without general anesthesia.');
      bedsideSiloDirectives.push('Serial gentle reduction of 1-2 cm silo height every 24 hours under sterile technique.');
      bedsideSiloDirectives.push('Monitor intra-abdominal pressure (bladder manometry) and lower extremity perfusion during each reduction push.');
    } else if (params.closureApproach === 'primary_bedside_sutureless') {
      bedsideSiloDirectives.push('Bedside sutureless umbilical cord flap closure selected. Ensure no tension on mesentery and bladder pressure remains < 12 mmHg.');
    }
  } else {
    // Omphalocele
    fluidManagementDirectives.push('Standard neonatal fluid maintenance (60-80 mL/kg/day Day 1) unless sac ruptured or massive third-spacing.');
    fluidManagementDirectives.push('Keep omphalocele sac intact with moist warm sterile saline gauze followed by dry plastic wrap to prevent hypothermia.');

    if (params.defectType === 'omphalocele_ruptured') {
      alerts.push('Omphalocele sac ruptured: Treat as open evisceration similar to gastroschisis with urgent sterile coverage and broad-spectrum IV antibiotics.');
    }

    if (hasLiverEvisceration) {
      alerts.push('Extracorporeal liver: Forced reduction poses high risk of hepatic venous kinking, inferior vena cava obstruction, and parenchymal rupture.');
    }

    if (params.closureApproach === 'delayed_escharotic_paint_and_wait') {
      bedsideSiloDirectives.push('Conservative "paint-and-wait" escharotic therapy with topical silver sulfadiazine / povidone-iodine to promote epithelization for giant omphalocele.');
    }
  }

  // 6. Anomalies Screening (Beckwith-Wiedemann & Syndromic)
  if (params.defectType !== 'gastroschisis') {
    anomaliesScreeningDirectives.push('Echocardiogram is mandatory: Congenital heart defects occur in 35-50% of omphalocele cases (ASD, VSD, Tetralogy).');
    anomaliesScreeningDirectives.push('Beckwith-Wiedemann Syndrome (BWS) workup: Screen for macroglossia, organomegaly, hemihypertrophy, and renal anomalies.');
    anomaliesScreeningDirectives.push('Serial blood glucose monitoring every 1-2 hours: High risk of persistent hyperinsulinemic hypoglycemia in BWS.');
    anomaliesScreeningDirectives.push('Genetic karyotyping / chromosomal microarray (Trisomy 13, 18, 21, Cantrell pentalogy evaluation).');

    if (params.beckwithWiedemannSuspected) {
      alerts.push('Beckwith-Wiedemann Syndrome suspected: Maintain IV glucose infusion rate (GIR 8-12 mg/kg/min) and obtain urgent pediatric endocrinology consult.');
    }
    if (!params.cardiacEchoCompleted) {
      recommendations.push('Echocardiogram pending: Obtain urgent neonatal echocardiogram prior to operative closure under general anesthesia.');
    }
  }

  // 7. General Recommendations
  if (isGiantDefect) {
    recommendations.push('Giant abdominal wall defect (>= 5 cm): High risk of loss of abdominal domain. Staged silo or delayed closure indicated.');
  }
  recommendations.push('Maintain broad-spectrum IV antibiotics (Ampicillin + Gentamicin +/- Metronidazole if contaminated).');
  recommendations.push('Total parenteral nutrition (TPN) via PICC line should be initiated early due to prolonged post-reduction intestinal dysmotility.');

  // 8. Urgency Tier
  let urgencyTier: 'emergency_acs_or_compromise' | 'urgent_staged_reduction' | 'stable_serial_reduction' =
    'stable_serial_reduction';
  let urgencyTierLabel = 'Stable Serial Silo Reduction';

  if (
    iahGrade === 'grade_4_compartment_syndrome' ||
    params.bowelCondition === 'ischemic_gangrenous' ||
    params.bowelCondition === 'perforated_atresia' ||
    params.defectType === 'omphalocele_ruptured'
  ) {
    urgencyTier = 'emergency_acs_or_compromise';
    urgencyTierLabel = 'EMERGENCY: Visceral Compromise / Compartment Syndrome';
  } else if (
    iahGrade === 'grade_3_severe' ||
    params.currentBladderPressureMmHg >= 15.0 ||
    params.closureApproach === 'staged_silo_reduction'
  ) {
    urgencyTier = 'urgent_staged_reduction';
    urgencyTierLabel = 'Urgent Staged Reduction & Pressure Monitoring';
  }

  return {
    defectClassification: params.defectType,
    defectClassificationLabel,
    isGiantDefect,
    hasLiverEvisceration,
    iahGrade,
    iahGradeLabel,
    isCompartmentSyndromeRisk,
    fluidManagementDirectives,
    bedsideSiloDirectives,
    anomaliesScreeningDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
