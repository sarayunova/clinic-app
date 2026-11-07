/**
 * Special Newborn Care Unit (SNCU / Level-2 NICU) Clinical Calculation Engine
 *
 * References:
 * - Silverman WA, Andersen DH. A controlled clinical trial of effects of water mist on respiratory distress. Pediatrics 1956.
 * - Downes JJ et al. Respiratory distress syndrome of newborn infants: evaluation by scoring system. Clin Pediatr 1970.
 * - National Neonatology Forum (NNF) India: Evidence-based Clinical Practice Guidelines for SNCU.
 * - WHO Standards for Improving the Quality of Care for Small and Sick Newborns in Health Facilities.
 * - Cloherty and Stark's Manual of Neonatal Care, 9th Edition.
 */

export interface SilvermanScoreInput {
  upperChestRetraction: 0 | 1 | 2; // 0=synchronized, 1=lag on inspiration, 2=see-saw
  lowerChestRetraction: 0 | 1 | 2; // 0=none, 1=just visible, 2=marked
  xiphoidRetraction: 0 | 1 | 2;    // 0=none, 1=just visible, 2=marked
  naresDilation: 0 | 1 | 2;        // 0=none, 1=minimal, 2=marked
  expiratoryGrunt: 0 | 1 | 2;      // 0=none, 1=stethoscope only, 2=naked ear
}

export interface DownesScoreInput {
  respiratoryRateScore: 0 | 1 | 2; // 0=<60, 1=60-80, 2=>80 or apnea
  cyanosisScore: 0 | 1 | 2;        // 0=none in room air, 1=relieved by O2, 2=persists in O2
  airEntryScore: 0 | 1 | 2;        // 0=normal bilateral, 1=mildly reduced, 2=barely audible
  gruntingScore: 0 | 1 | 2;        // 0=none, 1=audible with stethoscope, 2=naked ear
  retractionsScore: 0 | 1 | 2;     // 0=none, 1=mild, 2=severe/marked
}

export interface SilvermanEvaluation {
  score: number;
  severity: 'none' | 'mild' | 'moderate' | 'severe_impending_failure';
  label: string;
  respiratoryRecommendation: string;
}

export interface DownesEvaluation {
  score: number;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  label: string;
  recommendation: string;
}

export function calculateSilvermanScore(input: SilvermanScoreInput): SilvermanEvaluation {
  const score =
    (input.upperChestRetraction || 0) +
    (input.lowerChestRetraction || 0) +
    (input.xiphoidRetraction || 0) +
    (input.naresDilation || 0) +
    (input.expiratoryGrunt || 0);

  if (score === 0) {
    return {
      score,
      severity: 'none',
      label: 'No Respiratory Distress (Score 0)',
      respiratoryRecommendation: 'Continue supportive nursing in room air with routine thermal care.',
    };
  }

  if (score <= 3) {
    return {
      score,
      severity: 'mild',
      label: `Mild Respiratory Distress (Score ${score})`,
      respiratoryRecommendation:
        'Continuous pulse oximetry. Provide low-flow nasal prong humidified oxygen (0.5–1.0 L/min) to target SpO2 91–95%.',
    };
  }

  if (score <= 6) {
    return {
      score,
      severity: 'moderate',
      label: `Moderate Respiratory Distress (Score ${score})`,
      respiratoryRecommendation:
        'Initiate Bubble CPAP (PEEP 5–6 cm H2O, FiO2 25–30%). Keep NPO, start IV fluids, and obtain urgent chest radiograph and blood gas.',
    };
  }

  return {
    score,
    severity: 'severe_impending_failure',
    label: `Severe Respiratory Failure (Score ${score} > 6)`,
    respiratoryRecommendation:
      'Impending respiratory failure. Prepare for urgent endotracheal intubation, surfactant administration, and invasive mechanical ventilation.',
  };
}

export function calculateDownesScore(input: DownesScoreInput): DownesEvaluation {
  const score =
    (input.respiratoryRateScore || 0) +
    (input.cyanosisScore || 0) +
    (input.airEntryScore || 0) +
    (input.gruntingScore || 0) +
    (input.retractionsScore || 0);

  if (score === 0) {
    return {
      score,
      severity: 'none',
      label: 'Normal / No Distress (Score 0)',
      recommendation: 'Stable room air breathing.',
    };
  }

  if (score <= 3) {
    return {
      score,
      severity: 'mild',
      label: `Mild Distress (Score ${score})`,
      recommendation: 'Oxygen by hood or nasal prongs; monitor vitals hourly.',
    };
  }

  if (score <= 7) {
    return {
      score,
      severity: 'moderate',
      label: `Moderate Distress (Score ${score})`,
      recommendation: 'Continuous positive airway pressure (CPAP) indicated. Check capillary blood gas.',
    };
  }

  return {
    score,
    severity: 'severe',
    label: `Severe Respiratory Distress (Score ${score} > 7)`,
    recommendation: 'Critical respiratory failure. Invasive ventilation & tertiary transport clearance required.',
  };
}

/**
 * Calculates standard neonatal daily fluid requirement (mL/kg/day)
 * according to gestational age, day of life, and phototherapy status.
 */
export function calculateDailyFluidGoal(
  gestationalAgeWeeks: number,
  dayOfLife: number,
  phototherapyActive: boolean,
): {
  recommendedMlKgDay: number;
  scheduleBasis: string;
} {
  const isPreterm = gestationalAgeWeeks < 37;
  const dol = Math.max(1, dayOfLife);

  let baseRate = 60;
  if (isPreterm) {
    if (dol === 1) baseRate = 80;
    else if (dol === 2) baseRate = 95;
    else if (dol === 3) baseRate = 115;
    else if (dol === 4) baseRate = 135;
    else baseRate = 150;
  } else {
    if (dol === 1) baseRate = 60;
    else if (dol === 2) baseRate = 80;
    else if (dol === 3) baseRate = 100;
    else if (dol === 4) baseRate = 120;
    else baseRate = 150;
  }

  const phototherapyAddon = phototherapyActive ? 15 : 0;
  const total = baseRate + phototherapyAddon;

  return {
    recommendedMlKgDay: total,
    scheduleBasis: `${isPreterm ? 'Preterm' : 'Term'} DOL ${dol}: Base ${baseRate} mL/kg/d${
      phototherapyActive ? ' + 15 mL/kg/d (phototherapy water loss)' : ''
    }`,
  };
}

/**
 * Calculates neonatal weight velocity and percentage change from birth weight.
 */
export function calculateWeightVelocity(
  birthWeightG: number,
  currentWeightG: number,
  daysOfLife: number,
): {
  percentageChangeFromBirth: number;
  weightLossExceedsThreshold: boolean;
  velocityGPerDay: number;
  summary: string;
} {
  if (!birthWeightG || birthWeightG <= 0 || !currentWeightG || currentWeightG <= 0) {
    return {
      percentageChangeFromBirth: 0,
      weightLossExceedsThreshold: false,
      velocityGPerDay: 0,
      summary: 'Weights not documented.',
    };
  }

  const weightDiff = currentWeightG - birthWeightG;
  const pctChange = Math.round((weightDiff / birthWeightG) * 1000) / 10;
  const dol = Math.max(1, daysOfLife || 1);
  const velocity = Math.round((weightDiff / dol) * 10) / 10;

  // Excessive early weight loss > 10% in term or > 15% in preterm
  const lossExceeded = pctChange < -10.0;

  let summary = '';
  if (pctChange < 0) {
    summary = `Weight loss of ${Math.abs(pctChange)}% from birth weight (${Math.abs(weightDiff)} g). ${
      lossExceeded ? '⚠️ Excessive physiological loss (>10%). Review feeding volume and hydration.' : 'Within normal early physiological limits.'
    }`;
  } else {
    summary = `Net weight gain of +${pctChange}% (+${weightDiff} g over birth weight, ~${velocity} g/day).`;
  }

  return {
    percentageChangeFromBirth: pctChange,
    weightLossExceedsThreshold: lossExceeded,
    velocityGPerDay: velocity,
    summary,
  };
}
