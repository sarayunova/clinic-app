/**
 * Gestational Diabetes Mellitus (GDM) & Glycemic Engine
 * Implements DIPSI, IADPSG, Carpenter-Coustan OGTT diagnostic thresholds,
 * White's classification in pregnancy, daily multi-point SMBG target evaluation,
 * glycemic variability / Time in Range (TIR), and fetal macrosomia surveillance.
 */

export type DiagnosticCriteria =
  | 'dipsi'
  | 'iadpsg'
  | 'carpenter_coustan'
  | 'prior_pregestational'
  | 'clinical_hba1c';

export type WhitesClassification =
  | 'a1_diet'
  | 'a2_medication'
  | 'class_b_pregestational'
  | 'class_c'
  | 'class_d';

export type CurrentManagement =
  | 'medical_nutrition_therapy'
  | 'metformin'
  | 'insulin'
  | 'insulin_plus_metformin';

export type PostprandialWindow = '1_hour' | '2_hour';

export type MealSlot =
  | 'fasting'
  | 'post_breakfast'
  | 'pre_lunch'
  | 'post_lunch'
  | 'pre_dinner'
  | 'post_dinner'
  | 'bedtime'
  | '3_am_nocturnal'
  | 'random';

export type TargetStatus =
  | 'severe_hypoglycemia'
  | 'mild_hypoglycemia'
  | 'in_target'
  | 'mild_excursion'
  | 'severe_excursion';

export interface OgttEvaluationResult {
  isGdm: boolean;
  category: 'normal' | 'impaired_glucose_tolerance' | 'gdm';
  criteriaUsed: DiagnosticCriteria;
  abnormalCount: number;
  elevatedPoints: string[];
  clinicalSummary: string;
}

export interface GlucoseClassificationResult {
  status: TargetStatus;
  targetMax: number;
  targetMin: number;
  label: string;
  badgeClass: string;
  isHypo: boolean;
  isExcursion: boolean;
}

export interface GlycemicSummary {
  totalReadings: number;
  meanBloodGlucose: number;
  estimatedHbA1c: number;
  timeInRangePercent: number;
  timeAboveRangePercent: number;
  timeBelowRangePercent: number;
  hypoglycemiaCount: number;
  excursionCount: number;
  inTargetCount: number;
  fastingReadings: number;
  fastingExcursionPercent: number;
  postprandialReadings: number;
  postprandialExcursionPercent: number;
  advisory: string;
}

export interface MacrosomiaRiskResult {
  riskFlag: 'normal' | 'borderline_ac_over_75' | 'macrosomia_suspected' | 'polyhydramnios';
  severityLabel: string;
  colorClass: string;
  details: string;
}

/**
 * DIPSI 75g non-fasting / fasting single 2-hour venous plasma glucose criteria
 * Normal: < 120 mg/dL
 * Impaired Gestational Glucose Tolerance (IGGT): 120 - 139 mg/dL
 * GDM: >= 140 mg/dL
 */
export function evaluateOgttDipsi(twoHourMgDl: number): OgttEvaluationResult {
  if (twoHourMgDl >= 140) {
    return {
      isGdm: true,
      category: 'gdm',
      criteriaUsed: 'dipsi',
      abnormalCount: 1,
      elevatedPoints: ['2-hour (>= 140 mg/dL)'],
      clinicalSummary: `DIPSI 2-hr value is ${twoHourMgDl} mg/dL (>= 140 mg/dL). Diagnostic for Gestational Diabetes Mellitus (GDM). Initiate Medical Nutrition Therapy (MNT).`,
    };
  }
  if (twoHourMgDl >= 120) {
    return {
      isGdm: false,
      category: 'impaired_glucose_tolerance',
      criteriaUsed: 'dipsi',
      abnormalCount: 1,
      elevatedPoints: ['2-hour (120-139 mg/dL)'],
      clinicalSummary: `DIPSI 2-hr value is ${twoHourMgDl} mg/dL (120-139 mg/dL). Indicates Impaired Gestational Glucose Tolerance (IGGT). Dietary advice and re-testing in 2-4 weeks recommended.`,
    };
  }
  return {
    isGdm: false,
    category: 'normal',
    criteriaUsed: 'dipsi',
    abnormalCount: 0,
    elevatedPoints: [],
    clinicalSummary: `DIPSI 2-hr value is ${twoHourMgDl} mg/dL (< 120 mg/dL). Normal glucose tolerance.`,
  };
}

/**
 * IADPSG / WHO 2013 75g 2-hour fasting OGTT criteria
 * Fasting: >= 92 mg/dL
 * 1-Hour: >= 180 mg/dL
 * 2-Hour: >= 153 mg/dL
 * Diagnostic: >= 1 abnormal value
 */
export function evaluateOgttIadpsg(
  fasting?: number | null,
  oneHr?: number | null,
  twoHr?: number | null,
): OgttEvaluationResult {
  const elevated: string[] = [];
  if (fasting != null && fasting >= 92) elevated.push(`Fasting ${fasting} mg/dL (>= 92)`);
  if (oneHr != null && oneHr >= 180) elevated.push(`1-hour ${oneHr} mg/dL (>= 180)`);
  if (twoHr != null && twoHr >= 153) elevated.push(`2-hour ${twoHr} mg/dL (>= 153)`);

  const isGdm = elevated.length >= 1;
  return {
    isGdm,
    category: isGdm ? 'gdm' : 'normal',
    criteriaUsed: 'iadpsg',
    abnormalCount: elevated.length,
    elevatedPoints: elevated,
    clinicalSummary: isGdm
      ? `IADPSG Criteria Met (${elevated.length} threshold(s) exceeded: ${elevated.join(', ')}). Diagnostic for GDM.`
      : 'All IADPSG OGTT values within normal thresholds (< 92 fasting, < 180 1-hr, < 153 2-hr).',
  };
}

/**
 * Carpenter-Coustan 100g 3-hour OGTT criteria
 * Fasting: >= 95 mg/dL
 * 1-Hour: >= 180 mg/dL
 * 2-Hour: >= 155 mg/dL
 * 3-Hour: >= 140 mg/dL
 * Diagnostic: >= 2 abnormal values
 */
export function evaluateOgttCarpenterCoustan(
  fasting?: number | null,
  oneHr?: number | null,
  twoHr?: number | null,
  threeHr?: number | null,
): OgttEvaluationResult {
  const elevated: string[] = [];
  if (fasting != null && fasting >= 95) elevated.push(`Fasting ${fasting} mg/dL (>= 95)`);
  if (oneHr != null && oneHr >= 180) elevated.push(`1-hour ${oneHr} mg/dL (>= 180)`);
  if (twoHr != null && twoHr >= 155) elevated.push(`2-hour ${twoHr} mg/dL (>= 155)`);
  if (threeHr != null && threeHr >= 140) elevated.push(`3-hour ${threeHr} mg/dL (>= 140)`);

  const isGdm = elevated.length >= 2;
  const isImpaired = elevated.length === 1;

  return {
    isGdm,
    category: isGdm ? 'gdm' : isImpaired ? 'impaired_glucose_tolerance' : 'normal',
    criteriaUsed: 'carpenter_coustan',
    abnormalCount: elevated.length,
    elevatedPoints: elevated,
    clinicalSummary: isGdm
      ? `Carpenter-Coustan Criteria Met (${elevated.length} abnormal values: ${elevated.join(', ')}). Diagnostic for GDM.`
      : isImpaired
      ? `1 abnormal value on 100g OGTT (${elevated.join(', ')}). Impaired glucose tolerance in pregnancy; close monitoring indicated.`
      : 'All 100g OGTT points within normal limits.',
  };
}

/**
 * Classifies a blood glucose reading against ACOG / ADA pregnancy targets
 * Target Fasting/Pre-meal: <= 95 mg/dL (or custom)
 * Target 1-hr Postprandial: <= 140 mg/dL
 * Target 2-hr Postprandial: <= 120 mg/dL
 * Hypoglycemia: < 60 severe, 60-69 mild
 */
export function classifyGlucoseReading(
  mealSlot: MealSlot | string,
  valueMgDl: number,
  targetFasting = 95,
  targetPostprandial = 120,
  postprandialWindow: PostprandialWindow = '2_hour',
): GlucoseClassificationResult {
  // Severe hypoglycemia < 60
  if (valueMgDl < 60) {
    return {
      status: 'severe_hypoglycemia',
      targetMin: 70,
      targetMax: 95,
      label: 'Severe Hypo (< 60 mg/dL)',
      badgeClass: 'badge-danger',
      isHypo: true,
      isExcursion: false,
    };
  }

  // Mild hypoglycemia 60-69
  if (valueMgDl < 70) {
    return {
      status: 'mild_hypoglycemia',
      targetMin: 70,
      targetMax: 95,
      label: 'Mild Hypo (60-69 mg/dL)',
      badgeClass: 'badge-warning',
      isHypo: true,
      isExcursion: false,
    };
  }

  const isFastingOrPreMeal =
    mealSlot === 'fasting' ||
    mealSlot === 'pre_lunch' ||
    mealSlot === 'pre_dinner' ||
    mealSlot === '3_am_nocturnal';

  const isPostMeal =
    mealSlot === 'post_breakfast' ||
    mealSlot === 'post_lunch' ||
    mealSlot === 'post_dinner';

  if (isFastingOrPreMeal) {
    const targetMax = targetFasting;
    if (valueMgDl <= targetMax) {
      return {
        status: 'in_target',
        targetMin: 70,
        targetMax,
        label: `In Target (<= ${targetMax})`,
        badgeClass: 'badge-success',
        isHypo: false,
        isExcursion: false,
      };
    }
    if (valueMgDl <= targetMax + 25) {
      return {
        status: 'mild_excursion',
        targetMin: 70,
        targetMax,
        label: `Mild High (${valueMgDl} > ${targetMax})`,
        badgeClass: 'badge-warning',
        isHypo: false,
        isExcursion: true,
      };
    }
    return {
      status: 'severe_excursion',
      targetMin: 70,
      targetMax,
      label: `Marked High (${valueMgDl} mg/dL)`,
      badgeClass: 'badge-danger',
      isHypo: false,
      isExcursion: true,
    };
  }

  if (isPostMeal) {
    const defaultMax = postprandialWindow === '1_hour' ? 140 : 120;
    const targetMax = targetPostprandial || defaultMax;
    if (valueMgDl <= targetMax) {
      return {
        status: 'in_target',
        targetMin: 70,
        targetMax,
        label: `In Target (<= ${targetMax})`,
        badgeClass: 'badge-success',
        isHypo: false,
        isExcursion: false,
      };
    }
    if (valueMgDl <= targetMax + 25) {
      return {
        status: 'mild_excursion',
        targetMin: 70,
        targetMax,
        label: `Mild High (${valueMgDl} > ${targetMax})`,
        badgeClass: 'badge-warning',
        isHypo: false,
        isExcursion: true,
      };
    }
    return {
      status: 'severe_excursion',
      targetMin: 70,
      targetMax,
      label: `Marked High (${valueMgDl} mg/dL)`,
      badgeClass: 'badge-danger',
      isHypo: false,
      isExcursion: true,
    };
  }

  // Bedtime or random
  const bedtimeMax = 120;
  if (valueMgDl <= bedtimeMax) {
    return {
      status: 'in_target',
      targetMin: 70,
      targetMax: bedtimeMax,
      label: 'In Target',
      badgeClass: 'badge-success',
      isHypo: false,
      isExcursion: false,
    };
  }
  return {
    status: valueMgDl <= bedtimeMax + 30 ? 'mild_excursion' : 'severe_excursion',
    targetMin: 70,
    targetMax: bedtimeMax,
    label: `Elevated (${valueMgDl} mg/dL)`,
    badgeClass: valueMgDl <= bedtimeMax + 30 ? 'badge-warning' : 'badge-danger',
    isHypo: false,
    isExcursion: true,
  };
}

/**
 * Calculates glycemic summary statistics:
 * Mean blood glucose, estimated HbA1c, Time-in-Range (TIR %),
 * Fasting vs Postprandial excursion rates, and clinical guidance.
 */
export function calculateGlycemicSummary(
  logs: Array<{
    blood_glucose_mg_dl: number;
    meal_slot: string;
    target_status?: string;
  }>,
): GlycemicSummary {
  if (!logs || logs.length === 0) {
    return {
      totalReadings: 0,
      meanBloodGlucose: 0,
      estimatedHbA1c: 0,
      timeInRangePercent: 0,
      timeAboveRangePercent: 0,
      timeBelowRangePercent: 0,
      hypoglycemiaCount: 0,
      excursionCount: 0,
      inTargetCount: 0,
      fastingReadings: 0,
      fastingExcursionPercent: 0,
      postprandialReadings: 0,
      postprandialExcursionPercent: 0,
      advisory: 'No glucose logs recorded yet. Begin daily 4-point or 6-point SMBG.',
    };
  }

  let totalBg = 0;
  let inTarget = 0;
  let aboveRange = 0;
  let belowRange = 0;
  let fastingCount = 0;
  let fastingExcursions = 0;
  let postCount = 0;
  let postExcursions = 0;

  for (const log of logs) {
    const bg = Number(log.blood_glucose_mg_dl);
    totalBg += bg;
    const isFasting = log.meal_slot === 'fasting' || log.meal_slot === 'pre_lunch' || log.meal_slot === 'pre_dinner';
    const isPost = log.meal_slot === 'post_breakfast' || log.meal_slot === 'post_lunch' || log.meal_slot === 'post_dinner';

    if (isFasting) fastingCount++;
    if (isPost) postCount++;

    const status = log.target_status || classifyGlucoseReading(log.meal_slot, bg).status;
    if (status === 'in_target') {
      inTarget++;
    } else if (status === 'severe_hypoglycemia' || status === 'mild_hypoglycemia') {
      belowRange++;
    } else if (status === 'mild_excursion' || status === 'severe_excursion') {
      aboveRange++;
      if (isFasting) fastingExcursions++;
      if (isPost) postExcursions++;
    }
  }

  const n = logs.length;
  const mbg = Math.round((totalBg / n) * 10) / 10;
  // Estimated HbA1c = (mean blood glucose + 46.7) / 28.7
  const estimatedA1c = Math.round(((mbg + 46.7) / 28.7) * 10) / 10;

  const tir = Math.round((inTarget / n) * 100);
  const tar = Math.round((aboveRange / n) * 100);
  const tbr = Math.round((belowRange / n) * 100);

  const fastingExcursionPct = fastingCount > 0 ? Math.round((fastingExcursions / fastingCount) * 100) : 0;
  const postExcursionPct = postCount > 0 ? Math.round((postExcursions / postCount) * 100) : 0;

  let advisory = '';
  if (belowRange >= 2 || tbr > 5) {
    advisory = `⚠️ Alert: ${belowRange} hypoglycemia episodes detected (${tbr}% TBR). Review meal carbohydrate consistency and consider reducing insulin/medication dose.`;
  } else if (tir >= 80) {
    advisory = `✅ Excellent glycemic control: ${tir}% Time in Range (TIR). Continue current regimen.`;
  } else if (tar > 20) {
    if (fastingExcursionPct > 30 && postExcursionPct > 30) {
      advisory = `⚠️ Elevated Glycemic Excursions: Both fasting (${fastingExcursionPct}%) and postprandial (${postExcursionPct}%) exceed targets. Consider initiating or increasing basal-bolus insulin.`;
    } else if (fastingExcursionPct > 30) {
      advisory = `⚠️ Persistent Fasting Hyperglycemia (${fastingExcursionPct}% fasting excursions). Consider adding or titrating bedtime intermediate/long-acting insulin (e.g. NPH/Glargine).`;
    } else if (postExcursionPct > 30) {
      advisory = `⚠️ Postprandial Excursions (${postExcursionPct}% post-meal spikes). Tighten carbohydrate intake / dietary fiber or consider pre-meal rapid-acting insulin.`;
    } else {
      advisory = `⚠️ Suboptimal control: ${tar}% readings above range. Review diet diary and medication compliance.`;
    }
  } else {
    advisory = `Satisfactory glycemic pattern: ${tir}% in target. Maintain self-monitoring.`;
  }

  return {
    totalReadings: n,
    meanBloodGlucose: mbg,
    estimatedHbA1c: estimatedA1c,
    timeInRangePercent: tir,
    timeAboveRangePercent: tar,
    timeBelowRangePercent: tbr,
    hypoglycemiaCount: belowRange,
    excursionCount: aboveRange,
    inTargetCount: inTarget,
    fastingReadings: fastingCount,
    fastingExcursionPercent: fastingExcursionPct,
    postprandialReadings: postCount,
    postprandialExcursionPercent: postExcursionPct,
    advisory,
  };
}

/**
 * Evaluates risk of fetal macrosomia and polyhydramnios in GDM pregnancies
 */
export function assessMacrosomiaRisk(
  acPercentile?: number | null,
  efwG?: number | null,
  efwPercentile?: number | null,
  afiCm?: number | null,
): MacrosomiaRiskResult {
  const isPolyhydramnios = afiCm != null && afiCm >= 24;
  const isSevereMacrosomia = (efwG != null && efwG >= 4000) || (efwPercentile != null && efwPercentile >= 90);
  const isAcLarge = acPercentile != null && acPercentile >= 75;

  if (isSevereMacrosomia || (isAcLarge && isPolyhydramnios)) {
    return {
      riskFlag: isPolyhydramnios ? 'polyhydramnios' : 'macrosomia_suspected',
      severityLabel: 'High Risk: Fetal Macrosomia / Polyhydramnios',
      colorClass: 'badge-danger',
      details: `EFW ${efwG ? `${efwG}g ` : ''}${efwPercentile ? `(${efwPercentile}th centile) ` : ''}${
        isAcLarge ? `with fetal abdominal circumference ${acPercentile}th centile ` : ''
      }${isPolyhydramnios ? `and Polyhydramnios (AFI ${afiCm} cm). ` : ''}Plan delivery at 37w-39w with shoulder dystocia preparedness. Discuss elective LSCS if EFW >= 4500g in GDM.`,
    };
  }

  if (isAcLarge) {
    return {
      riskFlag: 'borderline_ac_over_75',
      severityLabel: 'Borderline: Asymmetric Fetal Growth (AC >= 75th Centile)',
      colorClass: 'badge-warning',
      details: `Fetal abdominal circumference is elevated at ${acPercentile}th centile, suggesting fetal hyperinsulinemia. Intensify maternal glycemic control and schedule repeat scan in 2-3 weeks.`,
    };
  }

  return {
    riskFlag: 'normal',
    severityLabel: 'Appropriate for Gestational Age (AGA)',
    colorClass: 'badge-success',
    details: 'Fetal biometry and amniotic fluid volume within normal ranges. Continue routine fetal surveillance.',
  };
}

/**
 * Recommended delivery timing advisory for GDM
 */
export function getGdmDeliveryAdvisory(
  whiteClassification: WhitesClassification,
  glycemicControl: 'good' | 'suboptimal',
  efwG?: number | null,
): string {
  if (efwG && efwG >= 4500) {
    return 'EFW >= 4500g in diabetic pregnancy: ACOG recommends offering elective cesarean delivery to avoid shoulder dystocia and brachial plexus injury.';
  }

  if (whiteClassification === 'a1_diet') {
    return glycemicControl === 'good'
      ? 'A1 GDM (well-controlled on diet): Expectant management up to 39w0d - 40w6d. Induction of labor recommended if undelivered by 40w6d.'
      : 'A1 GDM with suboptimal control: Consider delivery between 37w0d and 38w6d with continuous fetal monitoring.';
  }

  // A2 or pregestational
  return glycemicControl === 'good'
    ? 'A2 GDM (medication-controlled with good control): Planned delivery recommended between 39w0d and 39w6d.'
    : 'A2 GDM with suboptimal control or vascular complications: Delivery recommended between 37w0d and 38w6d.';
}
