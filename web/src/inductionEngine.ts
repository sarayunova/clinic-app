/**
 * Labor Induction & Modified Bishop Score Engine
 *
 * References:
 * - Bishop EH. Pelvic scoring for elective induction. Obstet Gynecol 1964.
 * - Laughon SK et al. Using a simplified Bishop score to predict vaginal delivery. Obstet Gynecol 2011.
 * - ACOG Practice Bulletin No. 107: Induction of Labor.
 * - NICE Clinical Guideline [CG70]: Inducing labour.
 * - WHO recommendations for induction of labour.
 */

export type CervicalConsistency = 'firm' | 'medium' | 'soft';
export type CervicalPosition = 'posterior' | 'mid' | 'anterior';
export type CervicalFavorability = 'unfavorable_le_5' | 'intermediate_6_7' | 'favorable_ge_8';
export type RipeningMethod =
  | 'foley_bulb_mechanical'
  | 'cook_double_balloon'
  | 'dinoprostone_pge2_tape'
  | 'dinoprostone_pge2_gel'
  | 'misoprostol_pge1_oral'
  | 'misoprostol_pge1_vaginal'
  | 'direct_arm_oxytocin'
  | 'none';

export interface BishopScoreInput {
  dilationCm: number; // 0 to 10
  effacementPercent: number; // 0 to 100
  fetalStation: number; // -3 to +3
  consistency: CervicalConsistency;
  position: CervicalPosition;
  previousCesarean?: boolean;
  gestationalAgeWeeks?: number;
  parity?: 'nulliparous' | 'multiparous';
}

export interface BishopScoreComponents {
  dilationPoints: number; // 0 to 3
  effacementPoints: number; // 0 to 3
  stationPoints: number; // 0 to 3
  consistencyPoints: number; // 0 to 2
  positionPoints: number; // 0 to 2
  totalScore: number; // 0 to 13
}

export interface InductionRecommendationResult {
  components: BishopScoreComponents;
  totalScore: number;
  favorability: CervicalFavorability;
  recommendedRipening: RipeningMethod;
  ripeningRationale: string;
  contraindicationWarnings: string[];
  oxytocinProtocol: {
    startingRateMUPerMin: number;
    escalationStepMUPerMin: number;
    escalationIntervalMinutes: number;
    maximumRateMUPerMin: number;
    targetContractionsPer10Min: string;
    hyperstimulationAction: string;
  };
  clinicalDirectives: string[];
}

export function calculateBishopComponents(input: BishopScoreInput): BishopScoreComponents {
  // 1. Dilation Points (0 to 3)
  let dilationPoints = 0;
  if (input.dilationCm >= 5) dilationPoints = 3;
  else if (input.dilationCm >= 3) dilationPoints = 2;
  else if (input.dilationCm >= 1) dilationPoints = 1;
  else dilationPoints = 0;

  // 2. Effacement Points (0 to 3)
  let effacementPoints = 0;
  if (input.effacementPercent >= 80) effacementPoints = 3;
  else if (input.effacementPercent >= 60) effacementPoints = 2;
  else if (input.effacementPercent >= 40) effacementPoints = 1;
  else effacementPoints = 0;

  // 3. Fetal Station Points (0 to 3)
  let stationPoints = 0;
  if (input.fetalStation >= 1) stationPoints = 3;
  else if (input.fetalStation >= -1) stationPoints = 2; // -1, 0
  else if (input.fetalStation >= -2) stationPoints = 1;
  else stationPoints = 0; // -3

  // 4. Consistency Points (0 to 2)
  let consistencyPoints = 0;
  if (input.consistency === 'soft') consistencyPoints = 2;
  else if (input.consistency === 'medium') consistencyPoints = 1;
  else consistencyPoints = 0; // firm

  // 5. Position Points (0 to 2)
  let positionPoints = 0;
  if (input.position === 'anterior') positionPoints = 2;
  else if (input.position === 'mid') positionPoints = 1;
  else positionPoints = 0; // posterior

  const totalScore =
    dilationPoints + effacementPoints + stationPoints + consistencyPoints + positionPoints;

  return {
    dilationPoints,
    effacementPoints,
    stationPoints,
    consistencyPoints,
    positionPoints,
    totalScore,
  };
}

export function calculateLaborInduction(
  input: BishopScoreInput,
): InductionRecommendationResult {
  const components = calculateBishopComponents(input);
  const totalScore = components.totalScore;
  const contraindications: string[] = [];

  let favorability: CervicalFavorability = 'unfavorable_le_5';
  if (totalScore >= 8) favorability = 'favorable_ge_8';
  else if (totalScore >= 6) favorability = 'intermediate_6_7';
  else favorability = 'unfavorable_le_5';

  const hasScar = Boolean(input.previousCesarean);
  let recommendedRipening: RipeningMethod = 'none';
  let ripeningRationale = '';

  if (hasScar) {
    contraindications.push(
      'CONTRAINDICATION: Prostaglandins (Dinoprostone & Misoprostol) are strictly contraindicated in women with a previous uterine scar / Cesarean due to high risk of uterine rupture.',
    );
  }

  if (favorability === 'favorable_ge_8') {
    recommendedRipening = 'direct_arm_oxytocin';
    ripeningRationale =
      'Cervix is favorable (Modified Bishop score >= 8). Pre-induction cervical ripening is unnecessary. Proceed directly to Artificial Rupture of Membranes (ARM) when vertex engaged, followed by titrated Oxytocin infusion.';
  } else if (hasScar) {
    recommendedRipening = 'foley_bulb_mechanical';
    ripeningRationale =
      'Previous Cesarean with unfavorable cervix. Mechanical cervical ripening with transcervical Foley catheter (16–18 Fr inflated with 30–60 mL sterile saline) or Cook double-balloon catheter is recommended as the safest evidence-based method.';
  } else {
    // Unscarred uterus with unfavorable or intermediate cervix
    if (favorability === 'unfavorable_le_5') {
      recommendedRipening = 'dinoprostone_pge2_tape';
      ripeningRationale =
        'Unfavorable cervix (Bishop <= 5) in unscarred uterus. Controlled-release Dinoprostone 10 mg vaginal insert (over 24 hours) or mechanical Foley bulb is first-line for cervical priming.';
    } else {
      recommendedRipening = 'dinoprostone_pge2_gel';
      ripeningRationale =
        'Intermediate cervical score (6–7). Prostaglandin E2 gel (1–2 mg) or mechanical catheter for 6–12 hours to achieve Bishop >= 8 before ARM.';
    }
  }

  const oxytocinProtocol = {
    startingRateMUPerMin: 1.0, // 1 to 2 mU/min
    escalationStepMUPerMin: 1.5,
    escalationIntervalMinutes: 30,
    maximumRateMUPerMin: 20.0,
    targetContractionsPer10Min: '3 to 4 regular contractions per 10 minutes lasting 45–60 seconds',
    hyperstimulationAction:
      'If tachysystole (>5 contractions in 10 min) or fetal deceleration: Immediately stop/halve oxytocin, place patient in left lateral position, administer IV crystalloid bolus (500 mL), administer oxygen 10 L/min, consider SC Terbutaline 0.25 mg if persistent.',
  };

  const clinicalDirectives: string[] = [
    `Cervical Score: ${totalScore}/13 (${favorability.replace(/_/g, ' ').toUpperCase()})`,
    `Recommended Method: ${recommendedRipening.replace(/_/g, ' ').toUpperCase()}`,
    hasScar ? 'VBAC Candidate: Maintain continuous electronic fetal monitoring (CTG).' : 'Standard continuous or intermittent CTG surveillance.',
    'Wait at least 30 minutes after Dinoprostone tape removal or 4 hours after oral/vaginal Misoprostol before starting Oxytocin infusion.',
  ];

  return {
    components,
    totalScore,
    favorability,
    recommendedRipening,
    ripeningRationale,
    contraindicationWarnings: contraindications,
    oxytocinProtocol,
    clinicalDirectives,
  };
}
