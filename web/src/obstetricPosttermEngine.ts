// Pure TypeScript Clinical Calculation Engine: Obstetric Post-Term Pregnancy, Oligohydramnios & Bishop Cervical Ripening Protocol
// References: ACOG Practice Bulletin No. 146 (2021); SMFM Guidelines; SWEPIS Trial (BMJ 2019); WHO Induction Guidelines

export type PosttermClassification = 'late_term_41_0_to_41_6' | 'post_term_ge_42_0';

export type DatingMethod =
  | 'first_trimester_ultrasound_crl'
  | 'early_second_trimester_bpd_fl'
  | 'reliable_lmp_concordant'
  | 'uncertain_dating';

export type CervicalConsistency = 'firm' | 'medium' | 'soft';
export type CervicalPosition = 'posterior' | 'midposition' | 'anterior';

export type RecommendedRipeningMethod =
  | 'mechanical_foley_balloon'
  | 'dinoprostone_pge2_insert'
  | 'misoprostol_pge1_oral_vaginal'
  | 'oxytocin_direct_infusion'
  | 'cesarean_delivery_indicated';

export interface ObstetricPosttermInput {
  gestationalAgeWeeks: number; // e.g. 41.3 or 42.1
  datingMethod: DatingMethod;

  // Amniotic Fluid & Fetal Wellbeing
  amnioticFluidIndexCm: number; // threshold <= 5.0 cm indicates oligohydramnios
  singleDeepestPocketCm: number; // threshold < 2.0 cm indicates oligohydramnios
  nonStressTestResult: 'reactive' | 'non_reactive';
  biophysicalProfileScore?: number; // 0 to 10
  estimatedFetalWeightGrams?: number;

  // Modified Bishop Score Examination
  cervicalDilationCm: number; // 0 to 10 cm
  cervicalEffacementPct: number; // 0 to 100%
  fetalStation: number; // -3 to +3
  cervicalConsistency: CervicalConsistency;
  cervicalPosition: CervicalPosition;

  priorCesareanSection?: boolean;
}

export interface BishopScoreBreakdown {
  dilationPoints: number;
  effacementPoints: number;
  stationPoints: number;
  consistencyPoints: number;
  positionPoints: number;
  totalScore: number;
  isFavorable: boolean;
}

export interface ObstetricPosttermEvaluation {
  posttermClassification: PosttermClassification;
  classificationLabel: string;
  oligohydramniosPresent: boolean;
  fetalDistressSuspected: boolean;

  // Bishop Score
  bishop: BishopScoreBreakdown;

  // Recommended Induction / Ripening Pathway
  immediateInductionIndicated: boolean;
  recommendedRipeningMethod: RecommendedRipeningMethod;
  ripeningGuidance: string;
  contraindicationsNote?: string;

  summary: string;
  clinicalActionPlan: string[];
}

/**
 * Calculates modified Bishop Score (0 - 13 points) and determines cervical favorability (score > 6).
 */
export function calculateBishopScore(
  dilationCm: number,
  effacementPct: number,
  station: number,
  consistency: CervicalConsistency,
  position: CervicalPosition,
): BishopScoreBreakdown {
  // 1. Dilation
  let dilationPoints = 0;
  if (dilationCm >= 5) dilationPoints = 3;
  else if (dilationCm >= 3) dilationPoints = 2;
  else if (dilationCm >= 1) dilationPoints = 1;

  // 2. Effacement
  let effacementPoints = 0;
  if (effacementPct >= 80) effacementPoints = 3;
  else if (effacementPct >= 60) effacementPoints = 2;
  else if (effacementPct >= 40) effacementPoints = 1;

  // 3. Station (-3 to +3)
  let stationPoints = 0;
  if (station >= 1) stationPoints = 3;
  else if (station >= -1) stationPoints = 2;
  else if (station >= -2) stationPoints = 1;

  // 4. Consistency
  let consistencyPoints = 0;
  if (consistency === 'soft') consistencyPoints = 2;
  else if (consistency === 'medium') consistencyPoints = 1;

  // 5. Position
  let positionPoints = 0;
  if (position === 'anterior') positionPoints = 2;
  else if (position === 'midposition') positionPoints = 1;

  const totalScore = dilationPoints + effacementPoints + stationPoints + consistencyPoints + positionPoints;
  const isFavorable = totalScore > 6;

  return {
    dilationPoints,
    effacementPoints,
    stationPoints,
    consistencyPoints,
    positionPoints,
    totalScore,
    isFavorable,
  };
}

/**
 * Evaluates Post-Term / Late-Term pregnancy, oligohydramnios criteria, Bishop score favorability, and safe cervical ripening.
 */
export function evaluateObstetricPostterm(input: ObstetricPosttermInput): ObstetricPosttermEvaluation {
  const isPostTerm = input.gestationalAgeWeeks >= 42.0;
  const posttermClassification: PosttermClassification = isPostTerm
    ? 'post_term_ge_42_0'
    : 'late_term_41_0_to_41_6';

  const classificationLabel = isPostTerm
    ? 'Post-Term Pregnancy (≥ 42+0 Weeks)'
    : 'Late-Term Pregnancy (41+0 to 41+6 Weeks)';

  const oligohydramniosPresent =
    input.amnioticFluidIndexCm <= 5.0 || input.singleDeepestPocketCm < 2.0;

  const fetalDistressSuspected =
    input.nonStressTestResult === 'non_reactive' &&
    input.biophysicalProfileScore !== undefined &&
    input.biophysicalProfileScore <= 4;

  const bishop = calculateBishopScore(
    input.cervicalDilationCm,
    input.cervicalEffacementPct,
    input.fetalStation,
    input.cervicalConsistency,
    input.cervicalPosition,
  );

  const immediateInductionIndicated = isPostTerm || oligohydramniosPresent || fetalDistressSuspected;

  let recommendedRipeningMethod: RecommendedRipeningMethod = 'dinoprostone_pge2_insert';
  let ripeningGuidance = '';
  let contraindicationsNote: string | undefined;

  if (fetalDistressSuspected) {
    recommendedRipeningMethod = 'cesarean_delivery_indicated';
    ripeningGuidance =
      'Non-reassuring fetal status: Non-reactive NST with low Biophysical Profile score (<= 4/10). Proceed with urgent Cesarean delivery. Induction of labor is contraindicated.';
  } else if (bishop.isFavorable) {
    recommendedRipeningMethod = 'oxytocin_direct_infusion';
    ripeningGuidance =
      `Favorable Cervix (Bishop Score ${bishop.totalScore} > 6): Cervical ripening agents are not required. Proceed directly to low-dose IV Oxytocin labor induction and artificial rupture of membranes (amniotomy) once in active labor.`;
  } else if (input.priorCesareanSection) {
    // STRICT CONTRAINDICATION: Prostaglandins with prior uterine scar
    recommendedRipeningMethod = 'mechanical_foley_balloon';
    contraindicationsNote =
      'WARNING: Patient has a history of prior Cesarean section. Prostaglandins (Misoprostol PGE1 and Dinoprostone PGE2) are STRICTLY CONTRAINDICATED due to significant risk of uterine rupture (ACOG PB 146).';
    ripeningGuidance =
      `Mechanical Ripening Indicated: Insert a 16-18 Fr Foley catheter with 30-60 mL sterile saline balloon (or double-balloon Cook catheter) through internal os. Safe mechanical dilation without uterine hyperstimulation or rupture risk.`;
  } else {
    // Unfavorable cervix in unscarred uterus
    recommendedRipeningMethod = 'dinoprostone_pge2_insert';
    ripeningGuidance =
      `Pharmacological Cervical Ripening (Unfavorable Bishop ${bishop.totalScore} <= 6): Administer Dinoprostone 10 mg slow-release vaginal insert (Cervidil) for up to 24 hours, or oral Misoprostol 25 mcg q2h (max 12 doses). Continuous FHR and tocodynamometry monitoring. Remove insert if active labor starts or tachysystole occurs.`;
  }

  const clinicalActionPlan: string[] = [];
  if (immediateInductionIndicated) {
    clinicalActionPlan.push(`Initiate immediate delivery pathway (${isPostTerm ? 'Post-term >=42w' : oligohydramniosPresent ? 'Oligohydramnios (AFI <= 5 cm)' : 'Fetal compromise'})`);
  } else {
    clinicalActionPlan.push('Schedule labor induction prior to 42w 0d (SWEPIS / ARRIVE trial evidence)');
  }

  clinicalActionPlan.push(`Bishop Score: ${bishop.totalScore}/13 (${bishop.isFavorable ? 'Favorable >6' : 'Unfavorable <=6'}) - Method: ${recommendedRipeningMethod.replace(/_/g, ' ')}`);
  if (input.priorCesareanSection) {
    clinicalActionPlan.push('Prior Cesarean: Avoid all prostaglandin analogs; use Foley balloon mechanical ripening');
  }
  clinicalActionPlan.push('Continuous cardiotocography (CTG) to rule out uterine tachysystole and cord compression decelerations');

  const summary = `Post-Term/Late-Term Evaluation (${classificationLabel}): AFI ${input.amnioticFluidIndexCm} cm (${oligohydramniosPresent ? 'Oligohydramnios' : 'Normal fluid'}). Bishop Score ${bishop.totalScore}/13 (${bishop.isFavorable ? 'Favorable' : 'Unfavorable'}). Recommendation: ${recommendedRipeningMethod.replace(/_/g, ' ').toUpperCase()}.`;

  return {
    posttermClassification,
    classificationLabel,
    oligohydramniosPresent,
    fetalDistressSuspected,
    bishop,
    immediateInductionIndicated,
    recommendedRipeningMethod,
    ripeningGuidance,
    contraindicationsNote,
    summary,
    clinicalActionPlan,
  };
}
