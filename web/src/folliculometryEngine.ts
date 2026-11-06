/**
 * Gynecological Infertility & Serial Folliculometry Cycle Monitor Engine
 *
 * Implements:
 * - Cycle Day (CD) calculation relative to Last Menstrual Period (LMP)
 * - Leading/dominant follicle sizing and bilateral ovary tracking
 * - Follicular growth rate velocity (expected ~1.5 - 2.0 mm/day in stimulated cycles)
 * - Endometrial receptivity staging (thickness mm & trilaminar Pattern A vs B/C)
 * - Ovulation induction readiness assessment & Multiple Gestation / OHSS protection flags
 * - Semen Analysis interpretation per WHO 6th edition reference lower limits (2021)
 */

export type EndometrialPattern = 'trilaminar_a' | 'isogenous_b' | 'hyperechoic_c' | 'irregular';

export type FollicularStage =
  | 'baseline'
  | 'early_follicular'
  | 'mid_follicular'
  | 'mature_ready_to_trigger'
  | 'ovulated_corpus_luteum'
  | 'hyperstimulation_risk';

export interface LeadingFollicleResult {
  leadingSizeMm: number;
  leadingOvary: 'right' | 'left' | 'bilateral' | 'none';
  dominantCountGe16mm: number;
  dominantCountGe18mm: number;
  totalFolliclesCount: number;
}

export interface EndometrialReceptivityResult {
  status: 'optimal' | 'adequate' | 'thin' | 'hyperplastic' | 'indeterminate';
  label: string;
  isTrilaminar: boolean;
  scoreText: string;
  clinicalComment: string;
}

export interface FollicularReadinessResult {
  stage: FollicularStage;
  triggerEligible: boolean;
  ohssRisk: boolean;
  recommendations: string[];
  summary: string;
}

export interface SemenAnalysisInterpretation {
  who6Compliant: boolean;
  classification: string;
  isNormal: boolean;
  findings: string[];
}

/**
 * Calculates the cycle day (CD) given LMP date and scan date/time.
 * LMP date is Cycle Day 1.
 */
export function calculateCycleDay(lmpDate: string, scanDatetime: string): number {
  if (!lmpDate || !scanDatetime) return 1;
  const lmp = new Date(lmpDate.slice(0, 10) + 'T00:00:00Z');
  const scan = new Date(scanDatetime.slice(0, 10) + 'T00:00:00Z');
  const diffTime = scan.getTime() - lmp.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Evaluates right and left ovary follicle arrays (diameters in mm).
 * Returns the dominant leading follicle and counts of follicles >= 16mm and >= 18mm.
 */
export function determineLeadingFollicle(
  rightFollicles: number[] = [],
  leftFollicles: number[] = []
): LeadingFollicleResult {
  const cleanRight = (rightFollicles || []).filter((f) => typeof f === 'number' && f > 0);
  const cleanLeft = (leftFollicles || []).filter((f) => typeof f === 'number' && f > 0);

  const maxR = cleanRight.length > 0 ? Math.max(...cleanRight) : 0;
  const maxL = cleanLeft.length > 0 ? Math.max(...cleanLeft) : 0;

  let leadingSizeMm = 0;
  let leadingOvary: 'right' | 'left' | 'bilateral' | 'none' = 'none';

  if (maxR > 0 || maxL > 0) {
    if (maxR > maxL) {
      leadingSizeMm = maxR;
      leadingOvary = 'right';
    } else if (maxL > maxR) {
      leadingSizeMm = maxL;
      leadingOvary = 'left';
    } else {
      leadingSizeMm = maxR;
      leadingOvary = 'bilateral';
    }
  }

  const all = [...cleanRight, ...cleanLeft];
  const dominantCountGe16mm = all.filter((s) => s >= 16).length;
  const dominantCountGe18mm = all.filter((s) => s >= 18).length;

  return {
    leadingSizeMm: Number(leadingSizeMm.toFixed(1)),
    leadingOvary,
    dominantCountGe16mm,
    dominantCountGe18mm,
    totalFolliclesCount: all.length,
  };
}

/**
 * Calculates daily growth rate between consecutive scans in mm/day.
 */
export function calculateFollicleGrowthRate(
  prev: { cycleDay: number; sizeMm: number },
  curr: { cycleDay: number; sizeMm: number }
): number | null {
  if (!prev || !curr) return null;
  const dayDelta = curr.cycleDay - prev.cycleDay;
  if (dayDelta <= 0) return null;
  const growth = curr.sizeMm - prev.sizeMm;
  return Number((growth / dayDelta).toFixed(2));
}

/**
 * Evaluates endometrial thickness and pattern for implantation receptivity.
 * - Optimal: >= 8mm with trilaminar (multilayered) pattern A
 * - Adequate: 7.0 - 7.9mm or >= 8mm pattern B
 * - Thin: < 7.0mm (unfavorable implantation window)
 * - Hyperplastic: > 14mm
 */
export function evaluateEndometrialReceptivity(
  etMm: number | null | undefined,
  pattern: string | null | undefined
): EndometrialReceptivityResult {
  if (etMm == null || etMm <= 0) {
    return {
      status: 'indeterminate',
      label: 'Not Evaluated',
      isTrilaminar: false,
      scoreText: 'No measurement recorded',
      clinicalComment: 'Measure endometrial double-layer thickness on TVS sagittal plane.',
    };
  }

  const isTrilaminar = pattern === 'trilaminar_a';

  if (etMm > 14) {
    return {
      status: 'hyperplastic',
      label: 'Hyperplastic (> 14 mm)',
      isTrilaminar,
      scoreText: `${etMm.toFixed(1)} mm, ${pattern ?? 'unspecified'}`,
      clinicalComment: 'Endometrium is abnormally thick (>14 mm); exclude polyp or hyperplasia.',
    };
  }

  if (etMm < 7.0) {
    return {
      status: 'thin',
      label: 'Thin Suboptimal (< 7.0 mm)',
      isTrilaminar,
      scoreText: `${etMm.toFixed(1)} mm, ${pattern ?? 'unspecified'}`,
      clinicalComment: 'Suboptimal thickness for embryo implantation (<7 mm). Consider oral/vaginal estradiol priming.',
    };
  }

  if (etMm >= 8.0 && isTrilaminar) {
    return {
      status: 'optimal',
      label: 'Optimal Receptive (>= 8 mm Trilaminar)',
      isTrilaminar: true,
      scoreText: `${etMm.toFixed(1)} mm, Pattern A`,
      clinicalComment: 'Excellent trilaminar endometrial architecture indicating peak estrogenic priming.',
    };
  }

  return {
    status: 'adequate',
    label: 'Adequate Receptive (7.0 - 7.9 mm)',
    isTrilaminar,
    scoreText: `${etMm.toFixed(1)} mm, ${pattern ?? 'unspecified'}`,
    clinicalComment: 'Endometrium is receptive for implantation.',
  };
}

/**
 * Evaluates follicle readiness for hCG / GnRH-agonist trigger,
 * enforces safety rules against Multiple Gestation and Ovarian Hyperstimulation Syndrome (OHSS).
 */
export function evaluateFollicularReadiness(input: {
  leadingSizeMm: number;
  etMm?: number | null;
  pattern?: string | null;
  dominantCountGe16mm: number;
  ruptureObserved?: boolean;
  protocolType?: string;
}): FollicularReadinessResult {
  const { leadingSizeMm, etMm, dominantCountGe16mm, ruptureObserved, protocolType } = input;
  const recommendations: string[] = [];

  // Check 1: Has ovulation/rupture already occurred?
  if (ruptureObserved) {
    recommendations.push('Ovulation confirmed: Dominant follicle collapsed with internal echoes (corpus luteum).');
    recommendations.push('Initiate luteal phase support (Progesterone 200mg-400mg daily) and schedule pregnancy test 14 days post-ovulation.');
    return {
      stage: 'ovulated_corpus_luteum',
      triggerEligible: false,
      ohssRisk: false,
      recommendations,
      summary: 'Ovulation confirmed. Initiate luteal support.',
    };
  }

  // Check 2: High risk of multiple pregnancy or hyperstimulation (>3 dominant follicles >= 16mm in non-IVF)
  if (dominantCountGe16mm >= 3) {
    recommendations.push('ALERT: >= 3 dominant follicles >= 16 mm detected.');
    recommendations.push('Severe risk of high-order multiple gestation (triplets/quadruplets) and OHSS.');
    recommendations.push('Clinical recommendation: CANCEL cycle (withhold hCG trigger) OR convert to IVF with emergency follicle aspiration.');
    return {
      stage: 'hyperstimulation_risk',
      triggerEligible: false,
      ohssRisk: true,
      recommendations,
      summary: 'High risk of multiple gestation / OHSS. Withhold trigger.',
    };
  }

  // Baseline / Small follicles (< 12 mm)
  if (leadingSizeMm < 12) {
    recommendations.push('Follicles in early follicular phase (< 12 mm).');
    recommendations.push('Schedule repeat scan in 3 to 4 days.');
    return {
      stage: 'early_follicular',
      triggerEligible: false,
      ohssRisk: false,
      recommendations,
      summary: 'Early follicular growth. Re-scan in 3-4 days.',
    };
  }

  // Intermediate follicles (12 - 17.9 mm)
  if (leadingSizeMm < 18) {
    // For letrozole/natural, trigger threshold is >= 18mm; for clomiphene typically >= 20mm
    const daysToMature = Math.max(1, Math.round((18 - leadingSizeMm) / 1.8));
    recommendations.push(`Dominant follicle at ${leadingSizeMm} mm. Growing at ~1.5 - 2.0 mm/day.`);
    recommendations.push(`Schedule repeat ultrasound in ${daysToMature} to ${daysToMature + 1} day(s).`);
    return {
      stage: 'mid_follicular',
      triggerEligible: false,
      ohssRisk: false,
      recommendations,
      summary: `Mid-follicular stage (${leadingSizeMm} mm). Repeat scan in ${daysToMature} day(s).`,
    };
  }

  // Mature follicle (>= 18 mm, or >= 20 mm if Clomiphene)
  const threshold = protocolType === 'clomiphene' ? 20 : 18;
  const isMature = leadingSizeMm >= threshold;

  if (isMature) {
    recommendations.push(`Dominant follicle mature at ${leadingSizeMm} mm (>= ${threshold} mm).`);
    if (etMm != null && etMm < 7.0) {
      recommendations.push('Caution: Endometrium is < 7 mm; consider estrogen support alongside trigger.');
    } else {
      recommendations.push('Endometrial lining is primed and receptive.');
    }
    recommendations.push('Eligible for Ovulation Trigger (recombinant hCG 250 mcg / u-hCG 10,000 IU).');
    recommendations.push('Schedule Timed Intercourse (TIC) at 24 & 36 hours post-trigger, or IUI at 36-40 hours post-trigger.');

    return {
      stage: 'mature_ready_to_trigger',
      triggerEligible: true,
      ohssRisk: false,
      recommendations,
      summary: `Mature follicle (${leadingSizeMm} mm). Ready for hCG trigger.`,
    };
  }

  // Borderline 18-19.9 mm on Clomiphene
  recommendations.push(`Dominant follicle at ${leadingSizeMm} mm. In Clomiphene cycles, trigger is preferred at >= 20 mm.`);
  recommendations.push('Schedule scan in 24 hours for trigger decision.');
  return {
    stage: 'mid_follicular',
    triggerEligible: false,
    ohssRisk: false,
    recommendations,
    summary: 'Approaching maturity. Re-scan in 24 hours.',
  };
}

/**
 * Evaluates semen parameters based on WHO 6th Edition Reference Values (2021):
 * - Ejaculate volume: >= 1.4 mL
 * - Sperm concentration: >= 16 million/mL (or 15 M/mL in WHO 5th)
 * - Progressive motility (PR): >= 30%
 * - Total motility (PR + NP): >= 42% (or 40% in WHO 5th)
 * - Normal morphology: >= 4.0%
 */
export function interpretSemenAnalysis(analysis: {
  volumeMl?: number | null;
  concentrationMilMl?: number | null;
  progressiveMotilityPct?: number | null;
  totalMotilityPct?: number | null;
  normalMorphologyPct?: number | null;
}): SemenAnalysisInterpretation {
  const findings: string[] = [];
  const abnormalTerms: string[] = [];

  const vol = analysis.volumeMl;
  const conc = analysis.concentrationMilMl;
  const prog = analysis.progressiveMotilityPct;
  const tot = analysis.totalMotilityPct;
  const morph = analysis.normalMorphologyPct;

  if (vol != null) {
    if (vol < 1.4) {
      abnormalTerms.push('Hypospermia');
      findings.push(`Low semen volume (${vol} mL, WHO-6 lower ref >= 1.4 mL)`);
    } else {
      findings.push(`Semen volume normal (${vol} mL)`);
    }
  }

  if (conc != null) {
    if (conc === 0) {
      abnormalTerms.push('Azoospermia');
      findings.push('Zero sperm count detected in ejaculate (Azoospermia)');
    } else if (conc < 16) {
      abnormalTerms.push('Oligozoospermia');
      findings.push(`Low sperm concentration (${conc} M/mL, WHO-6 lower ref >= 16 M/mL)`);
    } else {
      findings.push(`Sperm concentration normal (${conc} M/mL)`);
    }
  }

  if (prog != null) {
    if (prog < 30) {
      abnormalTerms.push('Asthenozoospermia');
      findings.push(`Low progressive motility (${prog}%, WHO-6 lower ref >= 30%)`);
    } else {
      findings.push(`Progressive motility normal (${prog}%)`);
    }
  } else if (tot != null && tot < 42) {
    abnormalTerms.push('Asthenozoospermia');
    findings.push(`Low total motility (${tot}%, WHO-6 lower ref >= 42%)`);
  }

  if (morph != null) {
    if (morph < 4) {
      abnormalTerms.push('Teratozoospermia');
      findings.push(`Low normal morphology (${morph}%, WHO-6 lower ref >= 4%)`);
    } else {
      findings.push(`Sperm morphology normal (${morph}% strict Kruger)`);
    }
  }

  let classification = 'Normozoospermia';
  if (abnormalTerms.includes('Azoospermia')) {
    classification = 'Azoospermia';
  } else if (abnormalTerms.length > 0) {
    // Unique list
    classification = Array.from(new Set(abnormalTerms)).join(' + ');
  }

  const isNormal = classification === 'Normozoospermia';

  return {
    who6Compliant: true,
    classification,
    isNormal,
    findings,
  };
}
