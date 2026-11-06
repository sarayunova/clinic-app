/**
 * Cardiotocography (CTG) & Non-Stress Test (NST) Clinical Engine
 * Implements:
 * - FIGO 2015 Consensus Guidelines (Normal, Suspicious, Pathological)
 * - ACOG / NICHD 3-Tier Fetal Heart Rate Classification (Category I, II, III)
 * - Antenatal NST Reactivity Analysis (15x15 / 10x10 criteria)
 * - Uterine Contraction & Tachysystole Detection (> 5 contractions / 10 min)
 * - Intrauterine Resuscitation Action Plan Generator
 * - Realistic Synthetic Trace Point Generator for SVG Strip Rendering
 */

export type CtgTestType =
  | 'antenatal_nst'
  | 'intrapartum_continuous'
  | 'intrapartum_intermittent'
  | 'oxytocin_challenge_test';

export type FhrVariabilityCategory =
  | 'absent'
  | 'minimal'
  | 'moderate'
  | 'marked'
  | 'sinusoidal';

export type DecelerationType =
  | 'none'
  | 'early'
  | 'variable_uncomplicated'
  | 'variable_complicated'
  | 'late'
  | 'prolonged';

export type NstClassification =
  | 'reactive'
  | 'non_reactive'
  | 'equivocal_unsatisfactory';

export type FigoClassification =
  | 'normal'
  | 'suspicious'
  | 'pathological';

export type NichdCategory =
  | 'category_1_normal'
  | 'category_2_indeterminate'
  | 'category_3_abnormal';

export interface CtgInputParams {
  gestationalAgeWeeks?: number | null;
  durationMinutes: number;
  baselineFhrBpm: number;
  variabilityCategory: FhrVariabilityCategory;
  variabilityAmplitudeBpm?: number | null;
  accelerationsCount: number;
  accelerationsCriteria?: '15x15' | '10x10';
  decelerationsType: DecelerationType;
  decelerationsRecurrent: boolean;
  uterineContractionsPer10min: number;
  fetalMovementFelt?: boolean;
}

export interface CtgEvaluationResult {
  figoClassification: FigoClassification;
  figoLabel: string;
  figoColorClass: string;
  nichdCategory: NichdCategory;
  nichdLabel: string;
  nichdColorClass: string;
  nstClassification: NstClassification;
  nstLabel: string;
  nstColorClass: string;
  tachysystolePresent: boolean;
  abnormalFeatures: string[];
  clinicalSummary: string;
  resuscitationRequired: boolean;
  recommendedActions: string[];
}

export interface CtgTracePoint {
  timeMinute: number;
  fhrBpm: number;
  tocoMmHg: number;
  isAcceleration?: boolean;
  isDeceleration?: boolean;
  isContractionPeak?: boolean;
}

/**
 * Evaluates CTG parameters against FIGO 2015 and ACOG/NICHD criteria
 */
export function evaluateCtgParams(p: CtgInputParams): CtgEvaluationResult {
  const abnormalFeatures: string[] = [];
  const recommendedActions: string[] = [];

  const baseline = p.baselineFhrBpm;
  const isTachycardia = baseline > 160;
  const isSevereBradycardia = baseline < 100;
  const isMildBradycardia = baseline >= 100 && baseline < 110;

  if (isTachycardia) {
    abnormalFeatures.push(`FHR Tachycardia (${baseline} bpm > 160 bpm)`);
  } else if (isSevereBradycardia) {
    abnormalFeatures.push(`Pathological FHR Bradycardia (${baseline} bpm < 100 bpm)`);
  } else if (isMildBradycardia) {
    abnormalFeatures.push(`Mild FHR Bradycardia (${baseline} bpm, 100-110 bpm)`);
  }

  // Variability evaluation
  const isAbsentVar = p.variabilityCategory === 'absent';
  const isMinimalVar = p.variabilityCategory === 'minimal';
  const isModerateVar = p.variabilityCategory === 'moderate';
  const isMarkedVar = p.variabilityCategory === 'marked';
  const isSinusoidal = p.variabilityCategory === 'sinusoidal';

  if (isSinusoidal) {
    abnormalFeatures.push('Sinusoidal FHR pattern (ominous for severe fetal anemia or acidosis)');
  } else if (isAbsentVar) {
    abnormalFeatures.push('Absent FHR baseline variability (0-2 bpm amplitude)');
  } else if (isMinimalVar) {
    abnormalFeatures.push('Minimal FHR baseline variability (3-5 bpm amplitude)');
  } else if (isMarkedVar) {
    abnormalFeatures.push('Marked/Saltatory FHR variability (> 25 bpm amplitude)');
  }

  // Decelerations evaluation
  const decel = p.decelerationsType;
  const isLate = decel === 'late';
  const isComplicatedVar = decel === 'variable_complicated';
  const isUncomplicatedVar = decel === 'variable_uncomplicated';
  const isProlonged = decel === 'prolonged';
  const isEarly = decel === 'early';
  const isRecurrent = p.decelerationsRecurrent;

  if (isLate) {
    abnormalFeatures.push(`Late Decelerations ${isRecurrent ? '(Recurrent with >50% contractions)' : '(Occasional)'}`);
  } else if (isComplicatedVar) {
    abnormalFeatures.push(`Complicated / Atypical Variable Decelerations ${isRecurrent ? '(Recurrent)' : ''}`);
  } else if (isProlonged) {
    abnormalFeatures.push('Prolonged Deceleration (lasting >= 2 minutes)');
  } else if (isUncomplicatedVar) {
    abnormalFeatures.push(`Variable Decelerations ${isRecurrent ? '(Recurrent)' : ''}`);
  }

  // Contractions & Tachysystole
  const contractions = p.uterineContractionsPer10min;
  const tachysystolePresent = contractions > 5;
  if (tachysystolePresent) {
    abnormalFeatures.push(`Uterine Tachysystole (${contractions} contractions per 10 minutes)`);
  }

  // --- FIGO 2015 Classification ---
  let figoClassification: FigoClassification = 'normal';
  const hasPathologicalFeatures =
    isSevereBradycardia ||
    isSinusoidal ||
    (isAbsentVar && (isLate || isComplicatedVar || isRecurrent)) ||
    (isLate && isRecurrent) ||
    (isComplicatedVar && isRecurrent) ||
    isProlonged;

  const hasSuspiciousFeatures =
    isTachycardia ||
    isMildBradycardia ||
    isMinimalVar ||
    isMarkedVar ||
    (isUncomplicatedVar && isRecurrent) ||
    (isLate && !isRecurrent) ||
    tachysystolePresent;

  if (hasPathologicalFeatures) {
    figoClassification = 'pathological';
  } else if (hasSuspiciousFeatures) {
    figoClassification = 'suspicious';
  } else {
    figoClassification = 'normal';
  }

  // --- ACOG / NICHD 3-Tier Classification ---
  let nichdCategory: NichdCategory = 'category_1_normal';
  const isCategory3 =
    isSinusoidal ||
    (isAbsentVar && (isRecurrent || isLate || isComplicatedVar || isSevereBradycardia));

  const isCategory1 =
    baseline >= 110 &&
    baseline <= 160 &&
    isModerateVar &&
    (decel === 'none' || isEarly) &&
    !isRecurrent;

  if (isCategory3) {
    nichdCategory = 'category_3_abnormal';
  } else if (isCategory1) {
    nichdCategory = 'category_1_normal';
  } else {
    nichdCategory = 'category_2_indeterminate';
  }

  // --- Antenatal NST Reactivity ---
  let nstClassification: NstClassification = 'reactive';
  if (p.accelerationsCount >= 2 && baseline >= 110 && baseline <= 160 && (isModerateVar || isMinimalVar) && decel === 'none') {
    nstClassification = 'reactive';
  } else if (p.durationMinutes >= 40 && p.accelerationsCount < 2) {
    nstClassification = 'non_reactive';
  } else if (hasPathologicalFeatures) {
    nstClassification = 'non_reactive';
  } else if (p.durationMinutes < 40 && p.accelerationsCount < 2) {
    nstClassification = 'equivocal_unsatisfactory';
  }

  // Resuscitation & Clinical Guidance
  const resuscitationRequired =
    figoClassification === 'pathological' ||
    nichdCategory === 'category_3_abnormal' ||
    tachysystolePresent ||
    (isLate && isRecurrent) ||
    (isComplicatedVar && isRecurrent);

  if (tachysystolePresent) {
    recommendedActions.push('Immediately discontinue or pause Oxytocin infusion.');
    recommendedActions.push('Turn mother to left lateral position to optimize uterine perfusion.');
    recommendedActions.push('Administer IV fluid bolus (500 mL Ringer Lactate).');
    recommendedActions.push('Consider tocolysis (Terbutaline 0.25 mg SC) if tachysystole persists with decelerations.');
  }

  if (nichdCategory === 'category_3_abnormal' || figoClassification === 'pathological') {
    recommendedActions.push('🚨 URGENT OBSTETRICIAN REVIEW: Category III / Pathological CTG.');
    recommendedActions.push('Prepare for immediate emergency operative delivery (Crash LSCS / instrumental delivery) if not resolving within 15-30 minutes.');
    recommendedActions.push('Intrauterine resuscitation: Left lateral position, 100% O2 by face mask, IV crystalloid bolus.');
    recommendedActions.push('Perform digital vaginal examination to exclude umbilical cord prolapse or rapid cervical progression.');
  } else if (nichdCategory === 'category_2_indeterminate' || figoClassification === 'suspicious') {
    recommendedActions.push('Continuous electronic fetal monitoring (EFM); reassess within 20-30 minutes.');
    recommendedActions.push('Encourage maternal position change (lateral decubitus) to alleviate potential cord compression.');
    recommendedActions.push('Check maternal vitals (rule out fever, chorioamnionitis, or hypotension).');
    recommendedActions.push('Perform fetal acoustic / scalp stimulation to assess acceleration response.');
  } else {
    recommendedActions.push('Reassuring fetal status. Continue routine intermittent or standard labor monitoring.');
  }

  let clinicalSummary = '';
  if (figoClassification === 'pathological') {
    clinicalSummary = `FIGO Pathological / NICHD Category III Fetal Heart Rate Tracing. Abnormal features: ${abnormalFeatures.join('; ')}. Immediate intrauterine resuscitation and obstetric escalation required.`;
  } else if (figoClassification === 'suspicious') {
    clinicalSummary = `FIGO Suspicious / NICHD Category II Fetal Heart Rate Tracing. Identified features: ${abnormalFeatures.join('; ')}. Requires ongoing surveillance and corrective measures.`;
  } else {
    clinicalSummary = `FIGO Normal / NICHD Category I Fetal Heart Rate Tracing. Baseline ${baseline} bpm, moderate variability, reassuring reactivity. Low risk of intrapartum acidemia.`;
  }

  return {
    figoClassification,
    figoLabel: figoClassification === 'normal' ? 'FIGO Normal' : figoClassification === 'suspicious' ? 'FIGO Suspicious' : 'FIGO Pathological',
    figoColorClass: figoClassification === 'normal' ? 'badge-success' : figoClassification === 'suspicious' ? 'badge-warning' : 'badge-danger',
    nichdCategory,
    nichdLabel: nichdCategory === 'category_1_normal' ? 'Category I (Normal)' : nichdCategory === 'category_2_indeterminate' ? 'Category II (Indeterminate)' : 'Category III (Abnormal)',
    nichdColorClass: nichdCategory === 'category_1_normal' ? 'badge-success' : nichdCategory === 'category_2_indeterminate' ? 'badge-warning' : 'badge-danger',
    nstClassification,
    nstLabel: nstClassification === 'reactive' ? 'NST Reactive' : nstClassification === 'non_reactive' ? 'NST Non-Reactive' : 'NST Equivocal / Unsatisfactory',
    nstColorClass: nstClassification === 'reactive' ? 'badge-success' : nstClassification === 'non_reactive' ? 'badge-danger' : 'badge-warning',
    tachysystolePresent,
    abnormalFeatures,
    clinicalSummary,
    resuscitationRequired,
    recommendedActions,
  };
}

/**
 * Generates continuous synthetic CTG sampled data points (every 10 seconds)
 * for rendering high-fidelity interactive SVG CTG strips.
 */
export function generateSyntheticCtgTrace(
  baselineFhr: number,
  variabilityCategory: FhrVariabilityCategory,
  durationMinutes = 20,
  accelerationsCount = 2,
  decelerationsType: DecelerationType = 'none',
  contractionsPer10min = 3,
): CtgTracePoint[] {
  const points: CtgTracePoint[] = [];
  const totalSeconds = durationMinutes * 60;
  const stepSeconds = 10;

  // Determine variability amplitude
  let varAmp = 10;
  if (variabilityCategory === 'absent') varAmp = 1.5;
  else if (variabilityCategory === 'minimal') varAmp = 4;
  else if (variabilityCategory === 'moderate') varAmp = 12;
  else if (variabilityCategory === 'marked') varAmp = 28;
  else if (variabilityCategory === 'sinusoidal') varAmp = 10;

  // Plan acceleration times (e.g. at 5m and 14m)
  const accelTimes: number[] = [];
  if (accelerationsCount >= 1) accelTimes.push(4.5 * 60);
  if (accelerationsCount >= 2) accelTimes.push(13.5 * 60);
  if (accelerationsCount >= 3) accelTimes.push(18.0 * 60);

  // Plan contraction peaks (e.g. spaced evenly)
  const contractionIntervalSec = contractionsPer10min > 0 ? (10 * 60) / contractionsPer10min : 9999;
  const contractionTimes: number[] = [];
  if (contractionsPer10min > 0) {
    for (let t = 2 * 60; t < totalSeconds; t += contractionIntervalSec) {
      contractionTimes.push(t);
    }
  }

  // Plan deceleration peaks (correlated with contractions or cord compression)
  const decelTimes: number[] = [];
  if (decelerationsType !== 'none') {
    if (decelerationsType === 'early') {
      // Coincident with contraction
      if (contractionTimes[0]) decelTimes.push(contractionTimes[0]);
      if (contractionTimes[1]) decelTimes.push(contractionTimes[1]);
    } else if (decelerationsType === 'late') {
      // Lagging 30 seconds after contraction peak
      if (contractionTimes[0]) decelTimes.push(contractionTimes[0] + 30);
      if (contractionTimes[1]) decelTimes.push(contractionTimes[1] + 30);
    } else if (decelerationsType.includes('variable')) {
      // Abrupt drop
      decelTimes.push(8 * 60);
      decelTimes.push(16 * 60);
    } else if (decelerationsType === 'prolonged') {
      decelTimes.push(10 * 60);
    }
  }

  for (let sec = 0; sec <= totalSeconds; sec += stepSeconds) {
    const minute = Math.round((sec / 60) * 10) / 10;

    // 1. Toco calculation (baseline 10-15 mmHg; contraction peak 50-70 mmHg, duration ~60 sec)
    let toco = 12 + Math.sin(sec / 15) * 2;
    let isPeak = false;
    for (const cTime of contractionTimes) {
      const diff = Math.abs(sec - cTime);
      if (diff <= 35) {
        const peakHeight = 55;
        toco += peakHeight * Math.cos((diff / 35) * (Math.PI / 2));
        if (diff <= 10) isPeak = true;
      }
    }
    toco = Math.min(Math.max(Math.round(toco), 5), 100);

    // 2. FHR calculation
    let fhr = baselineFhr;

    // Apply baseline variability
    if (variabilityCategory === 'sinusoidal') {
      // Smooth oscillation: 3-5 cycles per min
      fhr += Math.sin((sec / 60) * 4 * 2 * Math.PI) * (varAmp / 2);
    } else {
      // High-frequency autonomic fluctuation
      const noise = (Math.sin(sec * 1.3) + Math.cos(sec * 0.7) + Math.sin(sec * 3.1)) / 3;
      fhr += noise * (varAmp / 2);
    }

    // Check accelerations
    let isAccel = false;
    for (const aTime of accelTimes) {
      const diff = Math.abs(sec - aTime);
      if (diff <= 25) {
        // Bell curve spike +20 bpm
        fhr += 22 * Math.cos((diff / 25) * (Math.PI / 2));
        isAccel = true;
      }
    }

    // Check decelerations
    let isDecel = false;
    for (const dTime of decelTimes) {
      const diff = Math.abs(sec - dTime);
      const decelDuration = decelerationsType === 'prolonged' ? 120 : 35;
      if (diff <= decelDuration) {
        const decelDepth = decelerationsType === 'prolonged' ? 40 : decelerationsType.includes('variable') ? 35 : 25;
        fhr -= decelDepth * Math.cos((diff / decelDuration) * (Math.PI / 2));
        isDecel = true;
      }
    }

    fhr = Math.min(Math.max(Math.round(fhr), 50), 210);

    points.push({
      timeMinute: minute,
      fhrBpm: fhr,
      tocoMmHg: toco,
      isAcceleration: isAccel,
      isDeceleration: isDecel,
      isContractionPeak: isPeak,
    });
  }

  return points;
}
