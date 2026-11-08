// Pure TypeScript Clinical Calculation Engine: Neonatal Chylothorax & Pleural Effusion Octreotide Protocol
// References: AAP Pediatric Pulmonology; BTS Pediatric Pleural Disease Guidelines; NeoReviews; Gomella's Neonatology (8th Ed)

export type EffusionLaterality =
  | 'unilateral_right'
  | 'unilateral_left'
  | 'bilateral';

export type ChylothoraxEtiology =
  | 'congenital_idiopathic'
  | 'post_cardiothoracic_surgery'
  | 'genetic_turner_noonan_trisomy21'
  | 'central_venous_thrombosis'
  | 'congenital_lymphangiomatosis';

export type DietaryRegimen =
  | 'nil_by_mouth_tpn'
  | 'exclusive_mct_formula'
  | 'mct_supplemented_breast_milk'
  | 'unrestricted_breast_milk_formula';

export type ChylothoraxStatus =
  | 'acute_chest_tube_drainage'
  | 'octreotide_titration'
  | 'dietary_mct_transition'
  | 'resolved_tube_removed'
  | 'refractory_surgical_referral';

export interface NeonatalChylothoraxInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  chronologicalAgeDays: number;
  currentWeightKg: number;
  effusionLaterality: EffusionLaterality;
  etiology: ChylothoraxEtiology;

  pleuralTriglyceridesMgDl?: number;
  pleuralTotalCellsPerMicroliter?: number;
  pleuralLymphocytePercent?: number;
  pleuralCholesterolMgDl?: number;
  chylomicronPresence: boolean;

  chestTubeInserted: boolean;
  initial24hDrainageMl: number;
  dietaryRegimen: DietaryRegimen;
  octreotidePrescribed: boolean;
  octreotideCurrentDoseMcgKgHr: number;
  chemicalPleurodesisPerformed: boolean;
  surgicalLigationIndicated: boolean;
}

export interface NeonatalChylothoraxEvaluation {
  drainageRateMlKgDay: number;
  drainageSeverityTier: 'low_output_lt_10' | 'moderate_output_10_to_20' | 'high_output_gt_20';
  drainageSeverityLabel: string;

  chylothoraxConfirmed: boolean;
  diagnosticCriteriaMet: string[];

  octreotideIndicated: boolean;
  recommendedOctreotideStartingDoseMcgKgHr: number;
  dietaryRecommendation: string;
  surgicalRefractoryRisk: boolean;

  clinicalSafetyDirectives: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Calculates 24-hour chest tube drainage rate per kilogram: mL / kg / day
 */
export function calculateDrainageRateMlKgDay(
  drainageMl24h: number,
  weightKg: number,
): number {
  if (!weightKg || weightKg <= 0) return 0;
  return Math.round((drainageMl24h / weightKg) * 10) / 10;
}

/**
 * Evaluates chylothorax diagnostic biochemistry, drainage severity,
 * octreotide infusion parameters, dietary MCT restrictions, and surgical triggers.
 */
export function evaluateNeonatalChylothorax(
  input: NeonatalChylothoraxInput,
): NeonatalChylothoraxEvaluation {
  const drainageRateMlKgDay = calculateDrainageRateMlKgDay(
    input.initial24hDrainageMl,
    input.currentWeightKg,
  );

  let drainageSeverityTier: NeonatalChylothoraxEvaluation['drainageSeverityTier'] = 'low_output_lt_10';
  let drainageSeverityLabel = `Low-Output Effusion (${drainageRateMlKgDay} mL/kg/day < 10)`;

  if (drainageRateMlKgDay > 20.0) {
    drainageSeverityTier = 'high_output_gt_20';
    drainageSeverityLabel = `High-Output Chylothorax (${drainageRateMlKgDay} mL/kg/day > 20 - High Nutritional & Immunologic Risk)`;
  } else if (drainageRateMlKgDay >= 10.0) {
    drainageSeverityTier = 'moderate_output_10_to_20';
    drainageSeverityLabel = `Moderate-Output Chylothorax (${drainageRateMlKgDay} mL/kg/day, 10-20)`;
  }

  // Diagnostic criteria evaluation
  const diagnosticCriteriaMet: string[] = [];
  let chylothoraxConfirmed = false;

  if (input.pleuralTriglyceridesMgDl !== undefined && input.pleuralTriglyceridesMgDl > 110.0) {
    diagnosticCriteriaMet.push(`Pleural fluid triglycerides > 110 mg/dL (${input.pleuralTriglyceridesMgDl} mg/dL) [Diagnostic in enterally fed neonate]`);
    chylothoraxConfirmed = true;
  }

  if (input.pleuralLymphocytePercent !== undefined && input.pleuralLymphocytePercent > 80.0) {
    diagnosticCriteriaMet.push(`Pleural lymphocytosis > 80% (${input.pleuralLymphocytePercent}%) [Diagnostic in non-fed or TPN neonate]`);
    chylothoraxConfirmed = true;
  }

  if (input.chylomicronPresence) {
    diagnosticCriteriaMet.push('Chylomicrons identified by lipoprotein electrophoresis [Gold Standard]');
    chylothoraxConfirmed = true;
  }

  if (
    input.pleuralTotalCellsPerMicroliter !== undefined &&
    input.pleuralTotalCellsPerMicroliter > 1000 &&
    input.pleuralLymphocytePercent !== undefined &&
    input.pleuralLymphocytePercent > 70.0
  ) {
    diagnosticCriteriaMet.push(`Absolute lymphocyte count > 1000/uL with ${input.pleuralLymphocytePercent}% lymphocytic predominance`);
    chylothoraxConfirmed = true;
  }

  // Octreotide indication: Moderate to high-output chylothorax, or refractory to dietary MCT
  const octreotideIndicated =
    drainageSeverityTier === 'high_output_gt_20' ||
    drainageSeverityTier === 'moderate_output_10_to_20' ||
    (input.dietaryRegimen !== 'unrestricted_breast_milk_formula' && drainageRateMlKgDay >= 10.0);

  const recommendedOctreotideStartingDoseMcgKgHr = octreotideIndicated ? 2.0 : 0.0;

  let dietaryRecommendation = '';
  switch (input.dietaryRegimen) {
    case 'nil_by_mouth_tpn':
      dietaryRecommendation = 'NPO with Total Parenteral Nutrition (TPN) with fat restriction. Indicated for high-output (> 20 mL/kg/d) or unreduced drainage.';
      break;
    case 'exclusive_mct_formula':
      dietaryRecommendation = 'Exclusive Medium-Chain Triglyceride (MCT) formula (e.g. Monogen/Portagen). MCTs bypass intestinal lymphatic lacteals into portal circulation.';
      break;
    case 'mct_supplemented_breast_milk':
      dietaryRecommendation = 'Skimmed breast milk supplemented with MCT oil. Monitor output daily to verify response.';
      break;
    case 'unrestricted_breast_milk_formula':
    default:
      dietaryRecommendation = 'CONTRAINDICATED: Unrestricted standard breast milk or infant formula contains long-chain triglycerides (LCTs) which provoke massive lymphatic chyle flow!';
      break;
  }

  const surgicalRefractoryRisk =
    drainageSeverityTier === 'high_output_gt_20' ||
    input.surgicalLigationIndicated;

  const clinicalSafetyDirectives: string[] = [
    'NUTRITIONAL & IMMUNOLOGIC DEPLETION: Massive chylothorax drains lymphocytes, immunoglobulins (IgG), fat-soluble vitamins (A, D, E, K), and albumin. Monitor weekly IgG levels and serum albumin; consider prophylactic IVIG replacement if IgG < 300 mg/dL.',
    'OCTREOTIDE METABOLIC SURVEILLANCE: Continuous IV octreotide can cause transient hyperglycemia, hypoglycemia, necrotizing enterocolitis (NEC-like splanchnic vasoconstriction), and hypothyroidism. Monitor blood glucose every 6 hours and thyroid profile weekly.',
    'OCTREOTIDE TITRATION & WEANING: Start at 1-2 mcg/kg/hr. Increase daily by 1 mcg/kg/hr up to maximum 10 mcg/kg/hr. Once drainage < 10 mL/kg/day for 48 hours, wean gradually by 1 mcg/kg/hr every 24-48 hours before removing tube.',
    'SURGICAL THRESHOLD: Persistent high output (> 20 mL/kg/d) for > 14 days or > 10 mL/kg/d for > 3 weeks despite maximal NPO/TPN + Octreotide is an indication for chemical pleurodesis or thoracic duct ligation.',
  ];

  const criticalActionPlan: string[] = [];
  criticalActionPlan.push(`24-Hour Drainage: ${input.initial24hDrainageMl} mL (${drainageRateMlKgDay} mL/kg/day) - ${drainageSeverityLabel}`);

  if (chylothoraxConfirmed) {
    criticalActionPlan.push(`Diagnosis Confirmed: ${diagnosticCriteriaMet.join('; ')}`);
  } else {
    criticalActionPlan.push('Pleural biochemistry pending or equivocal. Verify fasting status and obtain pleural fluid triglyceride / lymphocyte count.');
  }

  if (input.dietaryRegimen === 'unrestricted_breast_milk_formula') {
    criticalActionPlan.push('CRITICAL ACTION: Immediately halt unrestricted feeding. Transition to exclusive MCT-based formula or NPO with TPN.');
  }

  if (octreotideIndicated) {
    if (!input.octreotidePrescribed) {
      criticalActionPlan.push(`Initiate Octreotide continuous IV infusion at ${recommendedOctreotideStartingDoseMcgKgHr} mcg/kg/hr.`);
    } else {
      criticalActionPlan.push(`Octreotide active at ${input.octreotideCurrentDoseMcgKgHr} mcg/kg/hr. Target drainage < 10 mL/kg/day.`);
    }
  }

  if (surgicalRefractoryRisk) {
    criticalActionPlan.push('REFRACTORY ALERT: High drainage rate exceeds medical targets. Pediatric surgical consultation for thoracic duct ligation / pleuroperitoneal shunt.');
  }

  const summary = `Neonatal Chylothorax (${drainageSeverityLabel}): ${chylothoraxConfirmed ? 'Confirmed chylous effusion.' : 'Suspected chyle leak.'} ${input.octreotidePrescribed ? `Octreotide active (${input.octreotideCurrentDoseMcgKgHr} mcg/kg/hr).` : (octreotideIndicated ? 'Octreotide indicated.' : 'Medical dietary management.')} ${surgicalRefractoryRisk ? 'Surgical consult advised.' : 'Medical management ongoing.'}`;

  return {
    drainageRateMlKgDay,
    drainageSeverityTier,
    drainageSeverityLabel,
    chylothoraxConfirmed,
    diagnosticCriteriaMet,
    octreotideIndicated,
    recommendedOctreotideStartingDoseMcgKgHr,
    dietaryRecommendation,
    surgicalRefractoryRisk,
    clinicalSafetyDirectives,
    summary,
    criticalActionPlan,
  };
}
