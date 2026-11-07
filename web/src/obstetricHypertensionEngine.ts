/**
 * Acute Severe Obstetric Hypertensive Crisis & Peripartum Cardiomyopathy (PPCM) Clinical Engine
 *
 * References:
 * - ACOG Practice Bulletin No. 222: Gestational Hypertension and Preeclampsia (2020)
 * - SMFM Consult Series #58: Management of Pre-eclampsia and Eclampsia
 * - ESC Guidelines for the Management of Cardiovascular Diseases during Pregnancy (2018)
 * - Heart Failure Association of the ESC: Peripartum Cardiomyopathy BOARD Consensus
 */

export interface SevereHypertensionScreenInput {
  sbp: number;
  dbp: number;
  onsetPhase?: 'antepartum' | 'intrapartum' | 'postpartum';
  asthmaHistory?: boolean;
  bradycardiaHistory?: boolean; // HR < 60 bpm
}

export interface SevereHypertensionScreenResult {
  isSevereCrisis: boolean;
  mapMmhg: number;
  crisisSeverity: 'normal' | 'mild_moderate' | 'acute_severe_crisis';
  urgencyLevel: 'routine' | 'urgent' | 'immediate_emergent';
  recommendedFirstLine: 'labetalol' | 'hydralazine' | 'nifedipine';
  contraindicatedAgents: string[];
  clinicalGuidance: string;
}

export interface HypertensiveStepRecommendationInput {
  agent: 'labetalol' | 'hydralazine' | 'nifedipine';
  currentStep: number; // 1, 2, 3
  currentSbp: number;
  currentDbp: number;
  initialMap: number;
  cumulativeLabetalolMg: number;
  cumulativeHydralazineMg: number;
  cumulativeNifedipineMg: number;
}

export interface HypertensiveStepRecommendationResult {
  nextMedication: string;
  nextDoseValue: number;
  nextDoseUnit: string;
  route: string;
  recheckIntervalMinutes: number;
  isControlled: boolean;
  currentMap: number;
  mapDropPercent: number;
  placentalHypoperfusionRisk: boolean;
  switchAgentRecommended?: string;
  advisory: string;
}

export interface PpcmBoardEvaluationInput {
  lvefPercent?: number; // e.g. 38%
  ntProBnpPgMl?: number; // e.g. 1450 pg/mL
  troponinINgMl?: number; // e.g. 0.08 ng/mL
  dyspneaOrOrthopnea: boolean;
  peripheralEdema: boolean;
  pulmonaryCrackles: boolean;
  onsetWeeksPostpartumOrGestation: number;
  isPostpartum: boolean;
}

export interface PpcmBoardEvaluationResult {
  isPpcmSuspected: boolean;
  ppcmRiskTier: 'unlikely' | 'possible' | 'confirmed_severe_ppcm';
  boardBromocriptineIndicated: boolean;
  boardOralHfTherapy: string;
  boardAnticoagulationIndicated: boolean;
  boardDiureticsIndicated: boolean;
  rationale: string[];
}

/**
 * Calculates Mean Arterial Pressure (MAP)
 * MAP = DBP + (SBP - DBP) / 3
 */
export function calculateMap(sbp: number, dbp: number): number {
  return Math.round((dbp + (sbp - dbp) / 3) * 10) / 10;
}

/**
 * Evaluates whether patient meets ACOG Criteria for Acute Severe Obstetric Hypertensive Crisis
 * Threshold: SBP >= 160 mmHg or DBP >= 110 mmHg
 */
export function evaluateSevereHypertension(input: SevereHypertensionScreenInput): SevereHypertensionScreenResult {
  const mapMmhg = calculateMap(input.sbp, input.dbp);
  const isSevereCrisis = input.sbp >= 160 || input.dbp >= 110;

  const contraindicatedAgents: string[] = [];
  if (input.asthmaHistory) {
    contraindicatedAgents.push('Labetalol (asthma history / bronchospasm risk)');
  }
  if (input.bradycardiaHistory) {
    contraindicatedAgents.push('Labetalol (maternal bradycardia < 60 bpm)');
  }

  let recommendedFirstLine: 'labetalol' | 'hydralazine' | 'nifedipine' = 'labetalol';
  if (contraindicatedAgents.length > 0) {
    recommendedFirstLine = 'hydralazine';
  }

  let crisisSeverity: 'normal' | 'mild_moderate' | 'acute_severe_crisis';
  let urgencyLevel: 'routine' | 'urgent' | 'immediate_emergent';
  let clinicalGuidance: string;

  if (isSevereCrisis) {
    crisisSeverity = 'acute_severe_crisis';
    urgencyLevel = 'immediate_emergent';
    clinicalGuidance = `EMERGENCY: Confirmed severe obstetric hypertension (SBP ${input.sbp} >= 160 or DBP ${input.dbp} >= 110). Initiate first-line IV antihypertensive protocol within 15-30 minutes to reduce stroke and eclampsia risk.`;
  } else if (input.sbp >= 140 || input.dbp >= 90) {
    crisisSeverity = 'mild_moderate';
    urgencyLevel = 'urgent';
    clinicalGuidance = `Mild-moderate gestational hypertension (SBP ${input.sbp} / DBP ${input.dbp}). Initiate or titrate oral outpatient/inpatient therapy. Monitor for escalation to severe range.`;
  } else {
    crisisSeverity = 'normal';
    urgencyLevel = 'routine';
    clinicalGuidance = `Blood pressure is within acceptable non-severe parameters (SBP ${input.sbp} / DBP ${input.dbp}).`;
  }

  return {
    isSevereCrisis,
    mapMmhg,
    crisisSeverity,
    urgencyLevel,
    recommendedFirstLine,
    contraindicatedAgents,
    clinicalGuidance
  };
}

/**
 * ACOG Practice Bulletin No. 222 Sequential Step-by-Step Medication Recommendation
 */
export function getNextHypertensiveStep(
  input: HypertensiveStepRecommendationInput
): HypertensiveStepRecommendationResult {
  const currentMap = calculateMap(input.currentSbp, input.currentDbp);
  const mapDropPercent = input.initialMap > 0 ? Math.round(((input.initialMap - currentMap) / input.initialMap) * 100) : 0;
  const isControlled = input.currentSbp < 160 && input.currentDbp < 110;
  const placentalHypoperfusionRisk = mapDropPercent > 25 || input.currentSbp < 120 || input.currentDbp < 80;

  if (isControlled) {
    return {
      nextMedication: 'None - BP Controlled',
      nextDoseValue: 0,
      nextDoseUnit: 'mg',
      route: 'N/A',
      recheckIntervalMinutes: 30,
      isControlled: true,
      currentMap,
      mapDropPercent,
      placentalHypoperfusionRisk,
      advisory: `Blood pressure successfully controlled (< 160/110 mmHg). Maintain surveillance every 10 min for 1st hour, then every 15 min for 1 hr, then every 30 min for 2 hr, then hourly.`
    };
  }

  let nextMedication = '';
  let nextDoseValue = 0;
  let nextDoseUnit = 'mg';
  let route = 'IV';
  let recheckIntervalMinutes = 20;
  let switchAgentRecommended: string | undefined;
  let advisory = '';

  if (input.agent === 'labetalol') {
    route = 'IV';
    recheckIntervalMinutes = input.currentStep === 1 ? 10 : 20;
    if (input.currentStep === 1) {
      nextMedication = 'Labetalol IV';
      nextDoseValue = 20;
      advisory = 'Administer Labetalol 20 mg IV over 2 min. Recheck blood pressure in 10-20 minutes.';
    } else if (input.currentStep === 2) {
      nextMedication = 'Labetalol IV';
      nextDoseValue = 40;
      advisory = 'Persistent severe hypertension: Escalate to Labetalol 40 mg IV over 2 min. Recheck in 10-20 min.';
    } else if (input.currentStep === 3) {
      nextMedication = 'Labetalol IV';
      nextDoseValue = 80;
      advisory = 'Persistent severe hypertension: Escalate to Labetalol 80 mg IV over 2 min. Recheck in 10-20 min.';
    } else {
      switchAgentRecommended = 'Hydralazine IV';
      nextMedication = 'Hydralazine IV';
      nextDoseValue = 10;
      advisory = 'Maximum Labetalol single-dose escalation reached (cumulative > 140-300 mg). Switch to Hydralazine 10 mg IV or Nifedipine 20 mg PO.';
    }
  } else if (input.agent === 'hydralazine') {
    route = 'IV';
    recheckIntervalMinutes = 20;
    if (input.currentStep === 1) {
      nextMedication = 'Hydralazine IV';
      nextDoseValue = 5; // Or 10 mg
      advisory = 'Administer Hydralazine 5 mg or 10 mg IV over 2 min. Recheck blood pressure in 20 minutes.';
    } else if (input.currentStep === 2) {
      nextMedication = 'Hydralazine IV';
      nextDoseValue = 10;
      advisory = 'Persistent severe hypertension: Administer Hydralazine 10 mg IV over 2 min. Recheck in 20 min.';
    } else {
      switchAgentRecommended = 'Labetalol IV or Nifedipine PO';
      nextMedication = 'Labetalol IV';
      nextDoseValue = 20;
      advisory = 'Maximum Hydralazine doses reached (cumulative >= 20 mg). Switch to Labetalol 20 mg IV or Nifedipine 20 mg PO.';
    }
  } else {
    // Nifedipine oral immediate release
    route = 'PO';
    recheckIntervalMinutes = 20;
    if (input.currentStep === 1) {
      nextMedication = 'Nifedipine PO Immediate-Release';
      nextDoseValue = 10;
      advisory = 'Administer Nifedipine 10 mg PO (capsule swallowed with water). Recheck blood pressure in 20 minutes.';
    } else if (input.currentStep === 2) {
      nextMedication = 'Nifedipine PO Immediate-Release';
      nextDoseValue = 20;
      advisory = 'Persistent severe hypertension: Administer Nifedipine 20 mg PO. Recheck in 20 min.';
    } else if (input.currentStep === 3) {
      nextMedication = 'Nifedipine PO Immediate-Release';
      nextDoseValue = 20;
      advisory = 'Persistent severe hypertension: Repeat Nifedipine 20 mg PO. Recheck in 20 min.';
    } else {
      switchAgentRecommended = 'Labetalol IV';
      nextMedication = 'Labetalol IV';
      nextDoseValue = 20;
      advisory = 'Max oral Nifedipine initial escalation completed. Switch to IV Labetalol 20 mg or obtain emergent anesthesia consult.';
    }
  }

  return {
    nextMedication,
    nextDoseValue,
    nextDoseUnit,
    route,
    recheckIntervalMinutes,
    isControlled: false,
    currentMap,
    mapDropPercent,
    placentalHypoperfusionRisk,
    switchAgentRecommended,
    advisory
  };
}

/**
 * Evaluates Peripartum Cardiomyopathy (PPCM) and BOARD Protocol Adherence
 */
export function evaluatePpcmBoardCriteria(input: PpcmBoardEvaluationInput): PpcmBoardEvaluationResult {
  const rationale: string[] = [];
  let isPpcmSuspected = false;
  let ppcmRiskTier: 'unlikely' | 'possible' | 'confirmed_severe_ppcm' = 'unlikely';

  const hasSigns = input.dyspneaOrOrthopnea || input.pulmonaryCrackles || input.peripheralEdema;
  const lvefDepressed = input.lvefPercent !== undefined && input.lvefPercent < 45;
  const bnpElevated = input.ntProBnpPgMl !== undefined && input.ntProBnpPgMl > 1000;
  const troponinElevated = input.troponinINgMl !== undefined && input.troponinINgMl > 0.04;

  if (lvefDepressed && hasSigns) {
    isPpcmSuspected = true;
    ppcmRiskTier = 'confirmed_severe_ppcm';
    rationale.push(`Confirmed Left Ventricular Systolic Dysfunction (LVEF ${input.lvefPercent}% < 45%) with overt heart failure signs.`);
  } else if ((bnpElevated || troponinElevated) && hasSigns) {
    isPpcmSuspected = true;
    ppcmRiskTier = 'possible';
    rationale.push(`Elevated cardiac biomarkers (NT-proBNP ${input.ntProBnpPgMl ?? 'N/A'} pg/mL, Troponin-I ${input.troponinINgMl ?? 'N/A'}) with clinical pulmonary congestion. Prompt echocardiography indicated.`);
  } else if (hasSigns) {
    ppcmRiskTier = 'possible';
    rationale.push('Clinical respiratory/fluid overload symptoms present. Differentiate from severe preeclampsia vs. acute cardiomyopathy.');
  }

  // BOARD Protocol Components
  // B: Bromocriptine (indicated in confirmed PPCM with depressed LVEF)
  const boardBromocriptineIndicated = isPpcmSuspected && (input.lvefPercent ?? 50) < 45;

  // O: Oral HF Therapy
  let boardOralHfTherapy = 'Metoprolol Succinate + Hydralazine/Nitrates (safe in pregnancy)';
  if (input.isPostpartum) {
    boardOralHfTherapy = 'Enalapril or Sacubitril/Valsartan (postpartum only) + Metoprolol Succinate';
  }

  // A: Anticoagulation (high thromboembolic risk if LVEF <= 35%)
  const boardAnticoagulationIndicated = (input.lvefPercent ?? 50) <= 35 || (isPpcmSuspected && (input.lvefPercent ?? 50) < 40);

  // D: Diuretics (IV Furosemide indicated if pulmonary crackles or orthopnea present)
  const boardDiureticsIndicated = input.pulmonaryCrackles || input.dyspneaOrOrthopnea;

  return {
    isPpcmSuspected,
    ppcmRiskTier,
    boardBromocriptineIndicated,
    boardOralHfTherapy,
    boardAnticoagulationIndicated,
    boardDiureticsIndicated,
    rationale
  };
}
