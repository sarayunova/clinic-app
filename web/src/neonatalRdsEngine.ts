/**
 * Neonatal Respiratory Distress Syndrome (RDS), Surfactant Replacement & Bubble CPAP Engine
 * References:
 * - European Consensus Guidelines on the Management of Respiratory Distress Syndrome (2022/2023 Update)
 * - American Academy of Pediatrics (AAP) Clinical Report: Surfactant Replacement Therapy for Preterm and Term Neonates
 * - WHO Guidelines on Interventions to Improve Preterm Birth Outcomes (CPAP & Surfactant)
 */

export interface SilvermanAndersonInput {
  upperChest: number; // 0 = synchronized, 1 = lag on inspiration, 2 = see-saw
  lowerChest: number; // 0 = none, 1 = just visible, 2 = marked
  xiphoidRetractions: number; // 0 = none, 1 = just visible, 2 = marked
  naresDilation: number; // 0 = none, 1 = minimal, 2 = marked
  expiratoryGrunt: number; // 0 = none, 1 = audible with stethoscope, 2 = audible with naked ear
}

export interface DownesInput {
  cyanosis: number; // 0 = none in room air, 1 = in room air relieved by FiO2 <40%, 2 = requiring FiO2 >=40%
  retractions: number; // 0 = none, 1 = mild, 2 = moderate/severe
  grunting: number; // 0 = none, 1 = audible with stethoscope, 2 = audible with naked ear
  airEntry: number; // 0 = bilateral clear, 1 = mildly reduced, 2 = barely audible
  respiratoryRate: number; // 0 = <60 bpm, 1 = 60-80 bpm, 2 = >80 bpm or apnea
}

export interface SurfactantCalcInput {
  brand: 'curosurf_poractant_alfa' | 'survanta_beractant' | 'infasurf_calfactant';
  weightKg: number;
  gestationalAgeWeeks: number;
  currentFiO2Percent: number; // e.g. 35%
  peepCmh2o: number; // e.g. 6.0
  isFirstDose?: boolean;
}

export interface SurfactantDosageResult {
  brand: string;
  brandNameFormatted: string;
  doseMgPerKg: number;
  totalDoseMg: number;
  concentrationMgPerMl: number;
  totalVolumeMl: number;
  recommendedMethod: 'lisa_mist_thin_catheter' | 'insure_intubate_surfactant_extubate' | 'endotracheal_invasive';
  repeatWindowHours: number;
  maxDoses: number;
  indicationAlert: boolean;
  indicationReason: string;
}

export interface AaRatioResult {
  pao2: number;
  fio2: number;
  paco2: number;
  calculatedPAO2: number;
  aaRatio: number;
  interpretation: 'normal' | 'mild_v_q_mismatch' | 'severe_surfactant_deficiency';
  summary: string;
}

export interface OxygenationIndexResult {
  meanAirwayPressure: number;
  fio2Percent: number;
  pao2Mmhg: number;
  oi: number;
  severity: 'mild' | 'moderate' | 'severe' | 'ecmo_threshold';
  recommendations: string[];
}

export interface CpapFailureAssessment {
  isFailing: boolean;
  failureCriteriaMet: string[];
  recommendedAction: string;
}

/**
 * Calculates Silverman-Anderson Retraction Score (0-10)
 */
export function calculateSilvermanScore(input: SilvermanAndersonInput): {
  score: number;
  severity: 'mild' | 'moderate' | 'severe_impending_failure';
  description: string;
} {
  const score = Math.max(0, Math.min(10,
    (input.upperChest || 0) +
    (input.lowerChest || 0) +
    (input.xiphoidRetractions || 0) +
    (input.naresDilation || 0) +
    (input.expiratoryGrunt || 0)
  ));

  if (score <= 3) {
    return { score, severity: 'mild', description: 'Mild respiratory distress. Continue non-invasive monitoring.' };
  } else if (score <= 6) {
    return { score, severity: 'moderate', description: 'Moderate respiratory distress. Optimize CPAP PEEP and evaluate for early surfactant.' };
  } else {
    return { score, severity: 'severe_impending_failure', description: 'Severe distress / impending respiratory failure. Prepare immediate surfactant & escalate respiratory support.' };
  }
}

/**
 * Calculates Downes' Respiratory Distress Score (0-10)
 */
export function calculateDownesScore(input: DownesInput): {
  score: number;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
} {
  const score = Math.max(0, Math.min(10,
    (input.cyanosis || 0) +
    (input.retractions || 0) +
    (input.grunting || 0) +
    (input.airEntry || 0) +
    (input.respiratoryRate || 0)
  ));

  if (score <= 3) {
    return { score, severity: 'mild', description: 'Mild distress. Maintain bubble CPAP at 5-6 cm H2O.' };
  } else if (score <= 7) {
    return { score, severity: 'moderate', description: 'Significant clinical respiratory distress. Verify interface fit and evaluate surfactant.' };
  } else {
    return { score, severity: 'severe', description: 'Severe respiratory distress. Urgent neonatologist intervention required.' };
  }
}

/**
 * Calculates Alveolar-arterial Oxygen Ratio (a/A ratio)
 * Alveolar Gas Equation at sea level: PAO2 = (FiO2/100 * (760 - 47)) - (PaCO2 / 0.8)
 * a/A ratio = PaO2 / PAO2
 */
export function calculateAaRatio(pao2Mmhg: number, fio2Percent: number, paco2Mmhg: number): AaRatioResult {
  const fio2Fraction = Math.max(0.21, Math.min(1.0, fio2Percent / 100));
  const atmosphericPressure = 760;
  const waterVaporPressure = 47;
  const respiratoryQuotient = 0.8;

  const calculatedPAO2 = Math.round(((fio2Fraction * (atmosphericPressure - waterVaporPressure)) - (paco2Mmhg / respiratoryQuotient)) * 10) / 10;
  const aaRatio = calculatedPAO2 > 0 ? Math.round((pao2Mmhg / calculatedPAO2) * 100) / 100 : 0;

  let interpretation: 'normal' | 'mild_v_q_mismatch' | 'severe_surfactant_deficiency' = 'normal';
  let summary = 'Normal alveolar-arterial gas exchange (a/A > 0.75).';

  if (aaRatio < 0.22) {
    interpretation = 'severe_surfactant_deficiency';
    summary = 'Severe alveolar collapse & right-to-left shunting (a/A < 0.22). Strong indicator for surfactant administration.';
  } else if (aaRatio < 0.75) {
    interpretation = 'mild_v_q_mismatch';
    summary = 'Moderate V/Q mismatch (a/A 0.22 - 0.74). Close CPAP and oxygen titration indicated.';
  }

  return {
    pao2: pao2Mmhg,
    fio2: fio2Percent,
    paco2: paco2Mmhg,
    calculatedPAO2,
    aaRatio,
    interpretation,
    summary
  };
}

/**
 * Calculates Oxygenation Index (OI)
 * OI = (Mean Airway Pressure [cm H2O] * FiO2 [%]) / PaO2 [mmHg]
 */
export function calculateOxygenationIndex(meanAirwayPressure: number, fio2Percent: number, pao2Mmhg: number): OxygenationIndexResult {
  const oi = pao2Mmhg > 0 ? Math.round(((meanAirwayPressure * fio2Percent) / pao2Mmhg) * 10) / 10 : 0;

  let severity: 'mild' | 'moderate' | 'severe' | 'ecmo_threshold' = 'mild';
  const recommendations: string[] = [];

  if (oi < 5) {
    severity = 'mild';
    recommendations.push('Adequate oxygenation on current non-invasive ventilation settings.');
    recommendations.push('Maintain target SpO2 91-95% (88-92% for < 28 weeks).');
  } else if (oi <= 15) {
    severity = 'moderate';
    recommendations.push('Moderate hypoxic respiratory failure.');
    recommendations.push('Titrate PEEP (6-8 cm H2O), optimize lung volume, consider early surfactant replacement.');
  } else if (oi <= 25) {
    severity = 'severe';
    recommendations.push('Severe respiratory failure with significant intrapulmonary shunting.');
    recommendations.push('Surfactant replacement indicated if not already given. Consider Inhaled Nitric Oxide (iNO) if PPHN confirmed.');
  } else {
    severity = 'ecmo_threshold';
    recommendations.push('Critical respiratory failure reaching ECMO eligibility threshold (OI > 25).');
    recommendations.push('Urgent tertiary neonatal intensive care consultation and rescue high-frequency oscillatory ventilation (HFOV).');
  }

  return {
    meanAirwayPressure,
    fio2Percent,
    pao2Mmhg,
    oi,
    severity,
    recommendations
  };
}

/**
 * Calculates Surfactant dose, volume, and LISA eligibility according to European Consensus Guidelines
 */
export function calculateSurfactantDosing(input: SurfactantCalcInput): SurfactantDosageResult {
  const isFirstDose = input.isFirstDose ?? true;
  let brandNameFormatted = '';
  let doseMgPerKg = 0;
  let concentrationMgPerMl = 80;
  let repeatWindowHours = 12;
  let maxDoses = 3;

  switch (input.brand) {
    case 'curosurf_poractant_alfa':
      brandNameFormatted = 'Poractant alfa (Curosurf®)';
      concentrationMgPerMl = 80; // 80 mg/mL
      doseMgPerKg = isFirstDose ? 200 : 100; // 200 mg/kg initial, 100 mg/kg repeat
      repeatWindowHours = 12;
      maxDoses = 3;
      break;

    case 'survanta_beractant':
      brandNameFormatted = 'Beractant (Survanta®)';
      concentrationMgPerMl = 25; // 25 mg/mL
      doseMgPerKg = 100; // 100 mg/kg for all doses
      repeatWindowHours = 6;
      maxDoses = 4;
      break;

    case 'infasurf_calfactant':
      brandNameFormatted = 'Calfactant (Infasurf®)';
      concentrationMgPerMl = 35; // 35 mg/mL
      doseMgPerKg = 105; // 105 mg/kg (3 mL/kg)
      repeatWindowHours = 12;
      maxDoses = 3;
      break;
  }

  const totalDoseMg = Math.round(doseMgPerKg * input.weightKg * 10) / 10;
  const totalVolumeMl = Math.round((totalDoseMg / concentrationMgPerMl) * 100) / 100;

  // Indication based on European Consensus (2022/2023 update):
  // Gestational age < 30 weeks on CPAP PEEP >= 6 with FiO2 >= 30%
  // Gestational age >= 30 weeks on CPAP PEEP >= 6 with FiO2 >= 40%
  let indicationAlert = false;
  let indicationReason = 'FiO2 and CPAP requirements within acceptable non-invasive range.';

  if (input.gestationalAgeWeeks < 30 && input.currentFiO2Percent >= 30 && input.peepCmh2o >= 5.5) {
    indicationAlert = true;
    indicationReason = `Preterm < 30w requiring FiO2 ${input.currentFiO2Percent}% (>= 30%) on CPAP PEEP ${input.peepCmh2o} cm H2O. Surfactant strongly indicated early to prevent chronic lung disease.`;
  } else if (input.gestationalAgeWeeks >= 30 && input.currentFiO2Percent >= 40 && input.peepCmh2o >= 5.5) {
    indicationAlert = true;
    indicationReason = `Preterm >= 30w requiring FiO2 ${input.currentFiO2Percent}% (>= 40%) on CPAP PEEP ${input.peepCmh2o} cm H2O. Surfactant indicated.`;
  } else if (input.currentFiO2Percent >= 50) {
    indicationAlert = true;
    indicationReason = `Urgent surfactant indicated: High oxygen demand FiO2 ${input.currentFiO2Percent}% regardless of gestational age.`;
  }

  // Recommended method:
  // If spontaneously breathing on CPAP and hemodynamically stable -> LISA / MIST
  // European guidelines prioritize LISA / MIST over InSurE
  const recommendedMethod: 'lisa_mist_thin_catheter' | 'insure_intubate_surfactant_extubate' | 'endotracheal_invasive' = 'lisa_mist_thin_catheter';

  return {
    brand: input.brand,
    brandNameFormatted,
    doseMgPerKg,
    totalDoseMg,
    concentrationMgPerMl,
    totalVolumeMl,
    recommendedMethod,
    repeatWindowHours,
    maxDoses,
    indicationAlert,
    indicationReason
  };
}

/**
 * Assesses Bubble CPAP failure criteria
 */
export function assessCpapFailure(params: {
  peepCmh2o: number;
  fio2Percent: number;
  silvermanScore: number;
  abgPh?: number;
  abgPco2Mmhg?: number;
  frequentApneasCount?: number;
}): CpapFailureAssessment {
  const criteria: string[] = [];

  if (params.peepCmh2o >= 7.5 && params.fio2Percent >= 40) {
    criteria.push(`High FiO2 requirement (${params.fio2Percent}%) despite maximal CPAP PEEP (${params.peepCmh2o} cm H2O)`);
  }
  if (params.silvermanScore >= 7) {
    criteria.push(`Severe chest retractions & grunting (Silverman-Anderson score ${params.silvermanScore} >= 7)`);
  }
  if (params.abgPh !== undefined && params.abgPh < 7.20) {
    criteria.push(`Uncompensated respiratory acidosis (pH ${params.abgPh} < 7.20)`);
  }
  if (params.abgPco2Mmhg !== undefined && params.abgPco2Mmhg > 65) {
    criteria.push(`Severe hypercapnia (PaCO2 ${params.abgPco2Mmhg} > 65 mmHg)`);
  }
  if (params.frequentApneasCount !== undefined && params.frequentApneasCount >= 3) {
    criteria.push(`Recurrent apneas (${params.frequentApneasCount} episodes/hr) requiring positive pressure mask bagging`);
  }

  const isFailing = criteria.length >= 1;
  const recommendedAction = isFailing
    ? 'CPAP Failure Alert: Escalate to invasive endotracheal mechanical ventilation (Synchronized Intermittent Mandatory Ventilation or High Frequency Oscillatory Ventilation).'
    : 'CPAP Support Adequate: Continue non-invasive bubble CPAP monitoring and regular columella integrity checks.';

  return {
    isFailing,
    failureCriteriaMet: criteria,
    recommendedAction
  };
}
