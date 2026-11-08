// Pure TypeScript calculation engine for Neonatal Intestinal Atresia (Duodenal & Jejunoileal) Protocol
// Guidelines: AAP / APSA (American Pediatric Surgical Association) / BAPS Consensus Guidelines

export type AtresiaLevel =
  | 'duodenal_atresia_complete'
  | 'duodenal_web_stenosis'
  | 'jejunoileal_atresia_type_1_membrane'
  | 'jejunoileal_atresia_type_2_cord'
  | 'jejunoileal_atresia_type_3a_gap'
  | 'jejunoileal_atresia_type_3b_apple_peel'
  | 'jejunoileal_atresia_type_4_multiple';

export type AbdominalDistensionPattern =
  | 'scaphoid_epigastric_fullness_only'
  | 'generalized_distension_visible_loops'
  | 'soft_non_distended';

export type RadiographicGasPattern =
  | 'double_bubble_sign_gasless_distal'
  | 'triple_bubble_sign'
  | 'multiple_dilated_loops_air_fluid_levels'
  | 'microcolon_on_contrast_enema';

export type SurgicalProcedurePlanned =
  | 'duodenoduodenostomy_diamond_anastomosis'
  | 'duodenojejunostomy'
  | 'primary_end_to_oblique_anastomosis'
  | 'tapering_enteroplasty_anastomosis'
  | 'temporary_enterostomy_stoma';

export interface NeonatalIntestinalAtresiaParams {
  ageHours: number;
  weightKg: number;
  atresiaLevel: AtresiaLevel;
  polyhydramniosAntenatal: boolean;
  biliousEmesisPresent: boolean;
  abdominalDistensionPattern: AbdominalDistensionPattern;
  radiographicGasPattern: RadiographicGasPattern;
  downSyndromeFeaturesPresent: boolean;
  karyotypeTrisomy21Confirmed: boolean;
  echocardiogramCardiacDefect: boolean;
  replogleDecompressionActive: boolean;
  surgicalProcedurePlanned: SurgicalProcedurePlanned;
  transanastomoticTubePlaced: boolean;
  tpnCentralLineInSitu: boolean;
}

export interface NeonatalIntestinalAtresiaResult {
  isDuodenalAtresia: boolean;
  isApplePeelAtresia: boolean;
  atresiaClassificationLabel: string;
  syndromicTrisomy21Risk: 'high_confirmed' | 'suspected_features' | 'low_non_syndromic';
  syndromicTrisomy21Label: string;
  shortBowelSyndromeRisk: 'extreme_apple_peel' | 'moderate_type_4_multiple' | 'low_isolated_atresia';
  shortBowelSyndromeRiskLabel: string;
  decompressionDirectives: string[];
  surgicalDirectives: string[];
  nutritionalDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_obstruction_or_volvulus' | 'urgent_surgical_stabilization' | 'postop_nutritional_recovery';
  urgencyTierLabel: string;
}

export type NeonatalIntestinalAtresiaEvaluationResult = NeonatalIntestinalAtresiaResult;

export function evaluateNeonatalIntestinalAtresia(
  params: NeonatalIntestinalAtresiaParams
): NeonatalIntestinalAtresiaResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const decompressionDirectives: string[] = [];
  const surgicalDirectives: string[] = [];
  const nutritionalDirectives: string[] = [];

  const isDuodenalAtresia =
    params.atresiaLevel === 'duodenal_atresia_complete' ||
    params.atresiaLevel === 'duodenal_web_stenosis';

  const isApplePeelAtresia = params.atresiaLevel === 'jejunoileal_atresia_type_3b_apple_peel';

  // 1. Classification & Label
  let atresiaClassificationLabel = '';
  if (params.atresiaLevel === 'duodenal_atresia_complete') {
    atresiaClassificationLabel = 'Complete Duodenal Atresia (Double-Bubble)';
  } else if (params.atresiaLevel === 'duodenal_web_stenosis') {
    atresiaClassificationLabel = 'Duodenal Web / Stenosis (Windsock Deformity)';
  } else if (params.atresiaLevel === 'jejunoileal_atresia_type_1_membrane') {
    atresiaClassificationLabel = 'Jejunoileal Atresia Type I (Intraluminal Mucosal Web)';
  } else if (params.atresiaLevel === 'jejunoileal_atresia_type_2_cord') {
    atresiaClassificationLabel = 'Jejunoileal Atresia Type II (Fibrous Cord Separation)';
  } else if (params.atresiaLevel === 'jejunoileal_atresia_type_3a_gap') {
    atresiaClassificationLabel = 'Jejunoileal Atresia Type IIIa (Complete V-Mesenteric Gap)';
  } else if (params.atresiaLevel === 'jejunoileal_atresia_type_3b_apple_peel') {
    atresiaClassificationLabel = 'Jejunoileal Atresia Type IIIb (Apple-Peel / Christmas Tree)';
  } else {
    atresiaClassificationLabel = 'Jejunoileal Atresia Type IV (Multiple Segmental Atresias)';
  }

  // 2. Syndromic Trisomy 21 / Down Syndrome Risk
  let syndromicTrisomy21Risk: 'high_confirmed' | 'suspected_features' | 'low_non_syndromic' = 'low_non_syndromic';
  let syndromicTrisomy21Label = 'Low Syndromic Risk (Non-Syndromic)';

  if (params.karyotypeTrisomy21Confirmed) {
    syndromicTrisomy21Risk = 'high_confirmed';
    syndromicTrisomy21Label = 'Confirmed Trisomy 21 (Down Syndrome)';
    alerts.push('Confirmed Trisomy 21: High incidence of complete atrioventricular septal defect (AVSD) and thyroid dysfunction. Preoperative pediatric cardiology clearance required.');
  } else if (params.downSyndromeFeaturesPresent || (isDuodenalAtresia && params.polyhydramniosAntenatal)) {
    syndromicTrisomy21Risk = 'suspected_features';
    syndromicTrisomy21Label = 'Suspected Trisomy 21 (Duodenal Phenotype)';
    recommendations.push('Duodenal atresia occurs with Trisomy 21 in ~30% of cases. Send chromosomal microarray / rapid FISH and obtain urgent echocardiogram.');
  }

  // 3. Short Bowel Syndrome (SBS) Risk
  let shortBowelSyndromeRisk: 'extreme_apple_peel' | 'moderate_type_4_multiple' | 'low_isolated_atresia' = 'low_isolated_atresia';
  let shortBowelSyndromeRiskLabel = 'Low SBS Risk (Adequate Bowel Length)';

  if (isApplePeelAtresia) {
    shortBowelSyndromeRisk = 'extreme_apple_peel';
    shortBowelSyndromeRiskLabel = 'Extreme Short Bowel Risk (Apple-Peel Deformity)';
    alerts.push('CRITICAL: Type IIIb Apple-Peel atresia carries severe intestinal foreshortening and single retrograde mesenteric perfusion. High risk of intestinal failure and volvulus.');
  } else if (params.atresiaLevel === 'jejunoileal_atresia_type_4_multiple') {
    shortBowelSyndromeRisk = 'moderate_type_4_multiple';
    shortBowelSyndromeRiskLabel = 'Moderate-High SBS Risk (Multiple Atresias)';
    recommendations.push('Multiple segmental atresias (string-of-sausages): Measure total residual small bowel length during laparotomy.');
  }

  // 4. Decompression & Fluid Directives
  if (params.biliousEmesisPresent) {
    alerts.push('Bilious vomiting in neonate represents surgical mechanical bowel obstruction until proven otherwise.');
  }

  decompressionDirectives.push('Replogle 8–10 Fr double-lumen orogastric sump tube placed and connected to continuous low suction (-20 to -30 mmHg).');
  decompressionDirectives.push('Flush Replogle sump lumen with 0.5–1.0 mL sterile saline every 2–4 hours to maintain suction patency.');
  decompressionDirectives.push('Aggressive fluid resuscitation with isotonic crystalloid to replace gastric losses mL-for-mL with 0.45% NS + 20 mEq/L KCl.');

  // 5. Surgical Directives
  if (isDuodenalAtresia) {
    surgicalDirectives.push('Diamond-shaped duodenoduodenostomy (Kimura technique) is standard: transverse incision on proximal dilated duodenum anastomosed to longitudinal incision on distal duodenum.');
    surgicalDirectives.push('If annular pancreas present, do NOT divide or excise pancreatic tissue; bypass the obstruction with duodenoduodenostomy over the ring.');
    surgicalDirectives.push('Verify distal patency by passing catheter or injecting warm saline through distal duodenum to exclude second web/atresia.');
  } else {
    surgicalDirectives.push('Laparotomy with resection of bulbous adynamic proximal blind pouch to prevent postop functional stasis.');
    surgicalDirectives.push('End-to-oblique or tapering enteroplasty to correct caliber mismatch between dilated proximal pouch and small distal bowel.');
    surgicalDirectives.push('Contrast retrograde irrigation through cecum to rule out associated colonic atresia.');
  }

  // 6. Nutritional Directives
  nutritionalDirectives.push('Total Parenteral Nutrition (TPN) via central venous catheter (PICC or Broviac) indicated due to prolonged dysmotility of proximal dilated bowel.');
  nutritionalDirectives.push('Transanastomotic tube (TAT) allows early enteral nutrition (starting 0.5–1 mL/hr maternal colostrum or donor milk) while waiting for gastric emptying.');
  nutritionalDirectives.push('Track stool passage (transition from pale mucus plug to normal yellow stool) as hallmark of anastomotic transit.');

  // 7. Urgency Tier
  let urgencyTier: 'emergency_obstruction_or_volvulus' | 'urgent_surgical_stabilization' | 'postop_nutritional_recovery' =
    'urgent_surgical_stabilization';
  let urgencyTierLabel = 'Urgent Surgical Stabilization';

  if (isApplePeelAtresia || params.radiographicGasPattern === 'multiple_dilated_loops_air_fluid_levels') {
    urgencyTier = 'emergency_obstruction_or_volvulus';
    urgencyTierLabel = 'EMERGENCY: Complete Mechanical Obstruction / Vascular Risk';
  } else if (params.transanastomoticTubePlaced || params.tpnCentralLineInSitu) {
    urgencyTier = 'postop_nutritional_recovery';
    urgencyTierLabel = 'Postoperative Nutritional & Motility Recovery';
  }

  return {
    isDuodenalAtresia,
    isApplePeelAtresia,
    atresiaClassificationLabel,
    syndromicTrisomy21Risk,
    syndromicTrisomy21Label,
    shortBowelSyndromeRisk,
    shortBowelSyndromeRiskLabel,
    decompressionDirectives,
    surgicalDirectives,
    nutritionalDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
