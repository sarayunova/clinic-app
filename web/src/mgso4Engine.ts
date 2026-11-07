// Magnesium Sulfate (MgSO4) Resuscitation & Obstetric HDU Safety Engine
// Reference: ACOG Practice Bulletin #222 (Gestational Hypertension & Preeclampsia),
// Zuspan & Pritchard Resuscitation Regimens, and FOGSI Obstetric Critical Care Guidelines.

export type PatellarReflexGrade =
  | 'absent_0'
  | 'sluggish_1_plus'
  | 'normal_2_plus'
  | 'brisk_3_plus'
  | 'hyperactive_clonus_4_plus';

export interface MgToxicityEvaluation {
  isSafeToContinue: boolean;
  toxicitySeverity: 'normal_therapeutic' | 'warning_hold_recheck' | 'critical_antidote_indicated';
  reflexInterpretation: string;
  respiratoryInterpretation: string;
  renalOutputInterpretation: string;
  magnesiumLevelInterpretation?: string;
  emergencyActionRequired: boolean;
  recommendedActions: string[];
}

export interface HypertensiveCrisisStep {
  agent: string;
  doseRoute: string;
  administrationNotes: string;
  recheckIntervalMinutes: number;
  maxDoseLimit: string;
}

export function evaluateMgso4Safety(params: {
  patellarReflex: PatellarReflexGrade;
  respiratoryRateBpm: number;
  urineOutputLastHourMl: number;
  serumMagnesiumMgDl?: number;
}): MgToxicityEvaluation {
  const { patellarReflex, respiratoryRateBpm, urineOutputLastHourMl, serumMagnesiumMgDl } = params;

  const isReflexAbsent = patellarReflex === 'absent_0';
  const isRespiratoryDepressed = respiratoryRateBpm < 16;
  const isSevereBradypnea = respiratoryRateBpm < 12;
  const isOliguric = urineOutputLastHourMl < 30;
  const isCriticalHypermagnesemia = serumMagnesiumMgDl !== undefined && serumMagnesiumMgDl > 9.6;

  let toxicitySeverity: MgToxicityEvaluation['toxicitySeverity'] = 'normal_therapeutic';
  let isSafeToContinue = true;
  let emergencyActionRequired = false;
  const recommendedActions: string[] = [];

  // Reflex Interpretation
  let reflexInterpretation = 'Normal patellar deep tendon reflex (+2). Neuromuscular transmission intact.';
  if (isReflexAbsent) {
    reflexInterpretation = 'LOSS OF PATELLAR KNEE JERK (Grade 0). Earliest and most sensitive clinical marker of Magnesium toxicity (serum Mg ~8-10 mg/dL).';
  } else if (patellarReflex === 'sluggish_1_plus') {
    reflexInterpretation = 'Sluggish patellar reflex (+1). Monitor closely q30m.';
  } else if (patellarReflex === 'brisk_3_plus' || patellarReflex === 'hyperactive_clonus_4_plus') {
    reflexInterpretation = 'Hyperreflexia / Clonus present. Persistent CNS irritability, inadequate seizure prophylaxis.';
  }

  // Respiratory Interpretation
  let respiratoryInterpretation = `Respiratory rate ${respiratoryRateBpm} bpm is adequate (≥ 16 bpm).`;
  if (isSevereBradypnea) {
    respiratoryInterpretation = `CRITICAL RESPIRATORY DEPRESSION (${respiratoryRateBpm} bpm < 12). Severe neuromuscular blockade and impending respiratory arrest hazard!`;
  } else if (isRespiratoryDepressed) {
    respiratoryInterpretation = `Respiratory rate ${respiratoryRateBpm} bpm is below safety limit (< 16 bpm). High risk of hypoventilation.`;
  }

  // Renal Output Interpretation
  let renalOutputInterpretation = `Urine output ${urineOutputLastHourMl} mL/h is adequate (≥ 30 mL/h). Renal magnesium clearance preserved.`;
  if (isOliguric) {
    renalOutputInterpretation = `OLIGURIA DETECTED (${urineOutputLastHourMl} mL/h < 30 mL/h). Magnesium is excreted 90%+ renally. Rapid accumulation toxicity hazard!`;
  }

  // Magnesium Level Interpretation
  let magnesiumLevelInterpretation: string | undefined;
  if (serumMagnesiumMgDl !== undefined) {
    if (serumMagnesiumMgDl < 4.8) {
      magnesiumLevelInterpretation = `Serum Mg ${serumMagnesiumMgDl} mg/dL is subtherapeutic (Target: 4.8 - 8.4 mg/dL).`;
    } else if (serumMagnesiumMgDl <= 8.4) {
      magnesiumLevelInterpretation = `Serum Mg ${serumMagnesiumMgDl} mg/dL is in optimal therapeutic range (4.8 - 8.4 mg/dL / 2.0 - 3.5 mmol/L).`;
    } else if (serumMagnesiumMgDl <= 12.0) {
      magnesiumLevelInterpretation = `ELEVATED SERUM MG (${serumMagnesiumMgDl} mg/dL): Loss of reflexes expected; hold infusion.`;
    } else {
      magnesiumLevelInterpretation = `CRITICAL HYPERMAGNESEMIA (${serumMagnesiumMgDl} mg/dL > 12): Respiratory paralysis and cardiac conduction hazard!`;
    }
  }

  // Triage Overall Severity
  if (isReflexAbsent || isSevereBradypnea || isCriticalHypermagnesemia) {
    toxicitySeverity = 'critical_antidote_indicated';
    isSafeToContinue = false;
    emergencyActionRequired = true;
    recommendedActions.push(
      'STOP MAGNESIUM SULFATE INFUSION IMMEDIATELY.',
      'ADMINISTER ANTIDOTE: 10% Calcium Gluconate 10 mL (1 gram) IV slowly over 10 minutes.',
      'Administer high-flow 100% Oxygen via Non-Rebreather Mask (10-15 L/min). Prepare Bag-Valve-Mask (BVM) and endotracheal intubation equipment.',
      'Alert Attending Obstetrician and HDU / ICU Intensivist stat.',
      'Send urgent STAT stat serum electrolytes, magnesium, calcium, and arterial blood gas (ABG).'
    );
  } else if (isRespiratoryDepressed || isOliguric || patellarReflex === 'sluggish_1_plus') {
    toxicitySeverity = 'warning_hold_recheck';
    isSafeToContinue = false;
    emergencyActionRequired = false;
    recommendedActions.push(
      'HOLD next IM dose or pause IV infusion for 1 hour.',
      'Repeat clinical assessment (Reflex, RR, UOP) in 30 minutes.',
      'Assess intravascular fluid status; if oliguric with clear chest, consider cautious 250 mL crystalloid challenge.',
      'Check catheter tubing for kinks or obstruction; measure strict hourly urine output via urometer.'
    );
  } else {
    recommendedActions.push(
      'All safety parameters verified within normal therapeutic limits.',
      'Continue maintenance infusion at prescribed rate (1 g/h IV).',
      'Perform mandatory repeat clinical checks every 60 minutes.'
    );
  }

  return {
    isSafeToContinue,
    toxicitySeverity,
    reflexInterpretation,
    respiratoryInterpretation,
    renalOutputInterpretation,
    magnesiumLevelInterpretation,
    emergencyActionRequired,
    recommendedActions,
  };
}

/**
 * Acute Severe Hypertension Protocol (BP >= 160/110 mmHg)
 */
export function getHypertensiveCrisisLadder(): HypertensiveCrisisStep[] {
  return [
    {
      agent: 'IV Labetalol',
      doseRoute: '20 mg IV bolus over 2 minutes',
      administrationNotes: 'Recheck BP every 10-15 minutes. If BP persists ≥ 160/110, escalate to 40 mg IV, then 80 mg IV q10-15 min. Contraindicated in asthma and heart block.',
      recheckIntervalMinutes: 10,
      maxDoseLimit: 'Maximum cumulative IV dose 220 mg',
    },
    {
      agent: 'Oral Nifedipine',
      doseRoute: '10 mg immediate-release capsule (swallow with water)',
      administrationNotes: 'Do NOT puncture or bite capsule (risk of precipitous hypotension). If BP persists ≥ 160/110 after 20-30 min, administer 20 mg PO.',
      recheckIntervalMinutes: 20,
      maxDoseLimit: 'Maximum initial sequence 30 mg',
    },
    {
      agent: 'IV Hydralazine',
      doseRoute: '5 mg to 10 mg IV slowly over 2 minutes',
      administrationNotes: 'Recheck BP in 20 minutes. If persistent, administer 10 mg IV. Causes maternal tachycardia and headache.',
      recheckIntervalMinutes: 20,
      maxDoseLimit: 'Maximum cumulative dose 20 mg',
    },
  ];
}
