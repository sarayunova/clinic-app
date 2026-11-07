/**
 * Neonatal Necrotizing Enterocolitis (NEC) Clinical Engine
 * Modified Bell's Staging & Surgical Decompression Protocol
 *
 * References:
 * - Walsh MC, Kliegman RM. Necrotizing enterocolitis: treatment based on staging criteria. Pediatr Clin North Am 1986
 * - British Association of Perinatal Medicine (BAPM) Framework for Practice: NEC Management (2020)
 * - American Academy of Pediatrics (AAP) Neonatal Resuscitation & Gut Injury Guidance
 */

export type BellStage =
  | 'stage_1a_suspected'
  | 'stage_1b_suspected'
  | 'stage_2a_definite_mild'
  | 'stage_2b_definite_moderate'
  | 'stage_3a_advanced_intact'
  | 'stage_3b_advanced_perforated';

export interface NecEvaluationInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  currentWeightGrams: number;
  // Systemic signs
  temperatureInstability?: boolean;
  apneaBradycardia?: boolean;
  lethargyHypotonia?: boolean;
  hypotensionShock?: boolean;
  // Intestinal signs
  gastricResidualsPercent?: number; // % of previous feed
  abdominalDistension?: boolean;
  biliousEmesisOrAspirate?: boolean;
  hemePositiveStool?: boolean;
  grossHematochezia?: boolean;
  absentBowelSounds?: boolean;
  abdominalWallErythemaOrInduration?: boolean;
  // Radiological signs
  radiographicPneumatosis?: boolean;
  radiographicPortalVenousGas?: boolean;
  radiographicAscites?: boolean;
  radiographicPneumoperitoneum?: boolean;
  // Laboratory
  abgPh?: number;
  baseExcess?: number;
  plateletCount?: number; // /uL
  serumLactate?: number; // mmol/L
}

export interface NecEvaluationResult {
  bellStage: BellStage;
  bellStageTitle: string;
  severityTier: 'suspected' | 'definite' | 'advanced_critical';
  surgicalInterventionIndicated: boolean;
  surgicalUrgency: 'routine_monitoring' | 'urgent_surgical_consult' | 'emergency_surgical_intervention';
  recommendedNpoDaysMin: number;
  recommendedNpoDaysMax: number;
  recommendedAntibiotics: string[];
  fluidAndTpnPlan: string;
  decompressionPlan: string;
  radiologySurveillancePlan: string;
  clinicalAlerts: string[];
}

/**
 * Classifies Neonatal NEC into Modified Bell's Stage based on multi-system criteria
 */
export function classifyBellStage(input: NecEvaluationInput): BellStage {
  if (input.radiographicPneumoperitoneum) {
    return 'stage_3b_advanced_perforated';
  }

  const isSevereSystemic = Boolean(
    input.hypotensionShock ||
      (input.abgPh !== undefined && input.abgPh < 7.20) ||
      (input.plateletCount !== undefined && input.plateletCount < 50000) ||
      (input.serumLactate !== undefined && input.serumLactate >= 4.0),
  );

  if (isSevereSystemic || (input.radiographicAscites && input.absentBowelSounds)) {
    return 'stage_3a_advanced_intact';
  }

  if (
    input.radiographicPortalVenousGas ||
    input.abdominalWallErythemaOrInduration ||
    (input.abgPh !== undefined && input.abgPh < 7.30) ||
    (input.plateletCount !== undefined && input.plateletCount < 100000)
  ) {
    return 'stage_2b_definite_moderate';
  }

  if (input.radiographicPneumatosis) {
    return 'stage_2a_definite_mild';
  }

  if (input.grossHematochezia) {
    return 'stage_1b_suspected';
  }

  return 'stage_1a_suspected';
}

/**
 * Evaluates comprehensive Neonatal NEC staging, NPO stewardship, antimicrobial choices,
 * and pediatric surgical escalation criteria
 */
export function evaluateNeonatalNec(input: NecEvaluationInput): NecEvaluationResult {
  const stage = classifyBellStage(input);

  let stageTitle = 'Stage I-A: Suspected NEC (Mild systemic and intestinal symptoms)';
  let severityTier: 'suspected' | 'definite' | 'advanced_critical' = 'suspected';
  let surgicalUrgency: 'routine_monitoring' | 'urgent_surgical_consult' | 'emergency_surgical_intervention' =
    'routine_monitoring';
  let surgicalIndicated = false;
  let npoMin = 3;
  let npoMax = 5;

  const alerts: string[] = [];

  switch (stage) {
    case 'stage_3b_advanced_perforated':
      stageTitle = 'Stage III-B: Advanced NEC with Perforation (Pneumoperitoneum / Free Air)';
      severityTier = 'advanced_critical';
      surgicalUrgency = 'emergency_surgical_intervention';
      surgicalIndicated = true;
      npoMin = 10;
      npoMax = 14;
      alerts.push('EMERGENCY: Gastrointestinal perforation confirmed (pneumoperitoneum). Immediate pediatric surgical consultation required for bedside peritoneal drainage (BPD) vs. urgent exploratory laparotomy.');
      alerts.push('Intractable septic shock and peritonitis risk: Support perfusion with fluid boluses (Normal Saline 10-20 mL/kg) and inotropes (Dopamine/Epinephrine).');
      break;

    case 'stage_3a_advanced_intact':
      stageTitle = 'Stage III-A: Advanced NEC (Intact bowel with severe metabolic decompensation and peritonitis)';
      severityTier = 'advanced_critical';
      surgicalUrgency = 'urgent_surgical_consult';
      surgicalIndicated = true;
      npoMin = 10;
      npoMax = 14;
      alerts.push('CRITICAL: Intact bowel with multi-organ failure, severe acidosis, and marked ascites. Frequent surgical re-assessment; prepare for rapid intervention if deterioration occurs.');
      break;

    case 'stage_2b_definite_moderate':
      stageTitle = 'Stage II-B: Definite Moderate NEC (Pneumatosis + Portal Venous Gas / Peritonitis)';
      severityTier = 'definite';
      surgicalUrgency = 'urgent_surgical_consult';
      surgicalIndicated = false;
      npoMin = 7;
      npoMax = 10;
      alerts.push('Definite moderate NEC with portal venous gas or abdominal wall erythema. Notify pediatric surgery team for joint surveillance.');
      break;

    case 'stage_2a_definite_mild':
      stageTitle = 'Stage II-A: Definite Mild NEC (Pneumatosis Intestinalis without portal gas)';
      severityTier = 'definite';
      surgicalUrgency = 'urgent_surgical_consult';
      surgicalIndicated = false;
      npoMin = 7;
      npoMax = 10;
      alerts.push('Diagnostic pneumatosis intestinalis present. Discontinue enteral feeds immediately; maintain strict NPO for 7-10 days.');
      break;

    case 'stage_1b_suspected':
      stageTitle = 'Stage I-B: Suspected NEC with Gross Hematochezia';
      severityTier = 'suspected';
      surgicalUrgency = 'routine_monitoring';
      surgicalIndicated = false;
      npoMin = 3;
      npoMax = 5;
      alerts.push('Gross rectal bleeding noted. Enteral feeding held for 3-5 days while cultures and serial abdominal radiographs are obtained.');
      break;

    case 'stage_1a_suspected':
    default:
      stageTitle = 'Stage I-A: Suspected NEC (Nonspecific gastric residuals and distension)';
      severityTier = 'suspected';
      surgicalUrgency = 'routine_monitoring';
      surgicalIndicated = false;
      npoMin = 3;
      npoMax = 5;
      break;
  }

  // Antimicrobial selection based on severity
  let antibiotics: string[] = ['Ampicillin IV (100 mg/kg/day divided q12h)', 'Gentamicin IV (4-5 mg/kg single daily dose)'];
  if (stage === 'stage_2b_definite_moderate' || stage === 'stage_3a_advanced_intact' || stage === 'stage_3b_advanced_perforated') {
    antibiotics = [
      'Ampicillin IV (150-200 mg/kg/day)',
      'Gentamicin IV (or Cefotaxime 100-150 mg/kg/day if renal impairment)',
      'Metronidazole IV (15 mg/kg loading then 7.5 mg/kg q12h for anaerobic coverage of ischemic bowel)',
    ];
  }

  const fluidPlan = `Total parenteral nutrition (TPN) with GIR 6-8 mg/kg/min, amino acids 3.0-3.5 g/kg/day, and lipids. Maintain total fluid intake 120-150 mL/kg/day; account for NG drainage volume replace with 0.45% Saline + 20 mEq/L KCl mL-for-mL if loss exceeds 20 mL/kg/day.`;
  const decompPlan = `Place 8-10 Fr replogle or sump nasogastric tube to low continuous wall suction (30-40 mmHg) or gravity drainage to minimize intraluminal distension and bowel wall ischemia.`;
  const radPlan = `Serial 2-view abdominal radiographs (AP supine and left lateral decubitus) every 6-8 hours during acute phase (Stages II & III) to rule out interval pneumoperitoneum or fixed loop.`;

  return {
    bellStage: stage,
    bellStageTitle: stageTitle,
    severityTier,
    surgicalInterventionIndicated: surgicalIndicated,
    surgicalUrgency,
    recommendedNpoDaysMin: npoMin,
    recommendedNpoDaysMax: npoMax,
    recommendedAntibiotics: antibiotics,
    fluidAndTpnPlan: fluidPlan,
    decompressionPlan: decompPlan,
    radiologySurveillancePlan: radPlan,
    clinicalAlerts: alerts,
  };
}
