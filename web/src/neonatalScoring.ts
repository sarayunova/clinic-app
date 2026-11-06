/**
 * Neonatal Scoring & Resuscitation Rules Engine
 * Implements:
 * 1. 1, 5, 10-Minute APGAR Scoring & Clinical Stratification
 * 2. Silverman-Anderson Retraction Score (SAS) for Respiratory Distress
 * 3. Newborn Early Warning Score (NEWS / NEWTT) Track-and-Trigger System
 * 4. Postnatal Age-Specific Blood Glucose Hypoglycemia Evaluation (AAP / BAPM guidelines)
 * 5. NRP 8th Edition "The Golden Minute" & Resuscitation Guidance
 */

export interface ApgarComponents {
  heartRate: number;         // 0: Absent, 1: <100 bpm, 2: >=100 bpm
  respiratoryEffort: number; // 0: Absent, 1: Slow/irregular, 2: Good/strong cry
  muscleTone: number;        // 0: Flaccid/limp, 1: Some flexion, 2: Active motion
  reflexIrritability: number;// 0: None, 1: Grimace, 2: Cry/cough/sneeze
  color: number;             // 0: Blue/pale, 1: Pink body, blue extremities, 2: All pink
}

export interface ApgarResult {
  total: number;
  interpretation: 'reassuring' | 'moderately_depressed' | 'severely_depressed';
  label: string;
  badgeClass: string;
  recommendation: string;
}

export function calculateApgarScore(c: Partial<ApgarComponents>): ApgarResult {
  const hr = c.heartRate ?? 0;
  const rr = c.respiratoryEffort ?? 0;
  const tone = c.muscleTone ?? 0;
  const reflex = c.reflexIrritability ?? 0;
  const col = c.color ?? 0;

  const total = Math.max(0, Math.min(10, hr + rr + tone + reflex + col));

  if (total >= 7) {
    return {
      total,
      interpretation: 'reassuring',
      label: 'Normal / Reassuring (7–10)',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      recommendation: 'Normal physiological transition. Routine post-delivery care, skin-to-skin contact, early breastfeeding initiation.',
    };
  } else if (total >= 4) {
    return {
      total,
      interpretation: 'moderately_depressed',
      label: 'Moderately Depressed (4–6)',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      recommendation: 'Moderate physiological depression. Maintain thermal care, clear airway, stimulate; provide positive pressure ventilation (PPV) if HR < 100 or apneic. Repeat APGAR at 5 & 10 mins.',
    };
  } else {
    return {
      total,
      interpretation: 'severely_depressed',
      label: 'Severely Depressed / Asphyxia (0–3)',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      recommendation: 'Critical depression. Initiate immediate advanced neonatal resuscitation (NRP algorithm): PPV with 100% O2, consider chest compressions if HR < 60 bpm, IV access, cord blood gas.',
    };
  }
}

export interface SilvermanComponents {
  thoracoabdominalMovement: number; // 0: Synchronized, 1: Lag on inspiration, 2: See-saw
  intercostalRetraction: number;    // 0: None, 1: Mild, 2: Marked
  xiphoidRetraction: number;        // 0: None, 1: Mild, 2: Marked
  naresDilation: number;            // 0: None, 1: Mild/slight, 2: Marked
  expiratoryGrunt: number;          // 0: None, 1: Audible with stethoscope, 2: Audible with naked ear
}

export interface SilvermanResult {
  total: number;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  label: string;
  badgeClass: string;
  guidance: string;
}

export function calculateSilvermanScore(c: Partial<SilvermanComponents>): SilvermanResult {
  const ta = c.thoracoabdominalMovement ?? 0;
  const ic = c.intercostalRetraction ?? 0;
  const xr = c.xiphoidRetraction ?? 0;
  const nd = c.naresDilation ?? 0;
  const eg = c.expiratoryGrunt ?? 0;

  const total = Math.max(0, Math.min(10, ta + ic + xr + nd + eg));

  if (total === 0) {
    return {
      total,
      severity: 'none',
      label: 'No Respiratory Distress (0)',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      guidance: 'Comfortable breathing. Normal chest wall dynamics.',
    };
  } else if (total <= 3) {
    return {
      total,
      severity: 'mild',
      label: 'Mild Respiratory Distress (1–3)',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      guidance: 'Mild respiratory effort. Monitor SpO2 and temperature; consider warm humidified oxygen / high-flow nasal cannula if hypoxemic.',
    };
  } else if (total <= 6) {
    return {
      total,
      severity: 'moderate',
      label: 'Moderate Respiratory Distress (4–6)',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      guidance: 'Moderate respiratory distress. Start early bubble CPAP (PEEP 5-6 cmH2O), obtain chest X-ray and blood gas; urgent pediatrician evaluation.',
    };
  } else {
    return {
      total,
      severity: 'severe',
      label: 'Severe Respiratory Distress / Failure Impending (7–10)',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      guidance: 'Critical distress. Impending respiratory exhaustion. Prepare for immediate endotracheal intubation, surfactant therapy, and Level 3 NICU admission.',
    };
  }
}

export interface NewsInput {
  heartRate?: number | null;
  respiratoryRate?: number | null;
  temperatureC?: number | null;
  spo2Percent?: number | null;
  supplementalOxygen?: boolean | number | null;
  color?: 'pink' | 'acrocyanosis' | 'pallor' | 'central_cyanosis' | 'jaundice_early';
  toneNeurology?: 'normal_active' | 'mildly_floppy_jittery' | 'lethargic_poor_suck' | 'severely_hypotonic_seizures';
  gruntingStridor?: 'none' | 'intermittent_audible_stethoscope' | 'persistent_audible_naked_ear';
}

export interface NewsScoreBreakdown {
  hrScore: number;
  rrScore: number;
  tempScore: number;
  spo2Score: number;
  oxygenScore: number;
  colorScore: number;
  toneScore: number;
  gruntingScore: number;
  totalScore: number;
  alertSeverity: 'green_low' | 'yellow_medium' | 'red_high';
  badgeClass: string;
  clinicalAction: string;
}

export function calculateNeonatalNews(input: NewsInput): NewsScoreBreakdown {
  let hrScore = 0;
  if (input.heartRate != null) {
    if (input.heartRate < 100 || input.heartRate > 180) hrScore = 3;
    else if (input.heartRate <= 109 || input.heartRate >= 161) hrScore = 1;
    else hrScore = 0; // 110-160
  }

  let rrScore = 0;
  if (input.respiratoryRate != null) {
    if (input.respiratoryRate < 30 || input.respiratoryRate > 80) rrScore = 3;
    else if (input.respiratoryRate <= 39 || input.respiratoryRate >= 61) rrScore = 1;
    else rrScore = 0; // 40-60
  }

  let tempScore = 0;
  if (input.temperatureC != null) {
    if (input.temperatureC < 36.0 || input.temperatureC >= 38.0) tempScore = 3;
    else if (input.temperatureC <= 36.4 || input.temperatureC >= 37.6) tempScore = 1;
    else tempScore = 0; // 36.5-37.5
  }

  let spo2Score = 0;
  if (input.spo2Percent != null) {
    if (input.spo2Percent < 90) spo2Score = 3;
    else if (input.spo2Percent <= 94) spo2Score = 1;
    else spo2Score = 0; // >= 95
  }

  const oxygenScore = Boolean(input.supplementalOxygen) ? 3 : 0;

  let colorScore = 0;
  if (input.color === 'acrocyanosis') colorScore = 1;
  else if (input.color === 'pallor' || input.color === 'central_cyanosis' || input.color === 'jaundice_early') colorScore = 3;

  let toneScore = 0;
  if (input.toneNeurology === 'mildly_floppy_jittery') toneScore = 1;
  else if (input.toneNeurology === 'lethargic_poor_suck') toneScore = 2;
  else if (input.toneNeurology === 'severely_hypotonic_seizures') toneScore = 3;

  let gruntingScore = 0;
  if (input.gruntingStridor === 'intermittent_audible_stethoscope') gruntingScore = 1;
  else if (input.gruntingStridor === 'persistent_audible_naked_ear') gruntingScore = 3;

  const totalScore = hrScore + rrScore + tempScore + spo2Score + oxygenScore + colorScore + toneScore + gruntingScore;

  const hasScore3 = [hrScore, rrScore, tempScore, spo2Score, oxygenScore, colorScore, toneScore, gruntingScore].some(s => s >= 3);

  let alertSeverity: 'green_low' | 'yellow_medium' | 'red_high' = 'green_low';
  let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  let clinicalAction = 'Routine neonatal observations every 4 to 6 hours. Continue supportive care.';

  if (totalScore >= 4 || hasScore3) {
    alertSeverity = 'red_high';
    badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
    clinicalAction = 'RED ALERT: Urgent bedside review by Pediatrician / Neonatologist within 15 minutes. Prepare for SNCU / Level 2/3 NICU transfer.';
  } else if (totalScore >= 2) {
    alertSeverity = 'yellow_medium';
    badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    clinicalAction = 'YELLOW ALERT: Repeat observations within 1 hour. Notify senior neonatal nurse and resident pediatrician.';
  }

  return {
    hrScore,
    rrScore,
    tempScore,
    spo2Score,
    oxygenScore,
    colorScore,
    toneScore,
    gruntingScore,
    totalScore,
    alertSeverity,
    badgeClass,
    clinicalAction,
  };
}

export interface GlucoseEvalResult {
  status: 'normal' | 'borderline_low' | 'hypoglycemia' | 'critical_hypoglycemia';
  label: string;
  badgeClass: string;
  thresholdMgDl: number;
  actionGuidance: string;
}

export function evaluateNeonatalGlucose(postnatalAgeHours: number, glucoseMgDl: number): GlucoseEvalResult {
  if (postnatalAgeHours < 4) {
    // 0 - 4 hours of life: Target >= 40 mg/dL
    if (glucoseMgDl < 25) {
      return {
        status: 'critical_hypoglycemia',
        label: 'Critical Hypoglycemia (< 25 mg/dL)',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        thresholdMgDl: 40,
        actionGuidance: 'Emergency IV 10% Dextrose bolus (2 mL/kg over 5-10 min) followed by maintenance glucose infusion rate (GIR 6-8 mg/kg/min). Urgent pediatric call.',
      };
    } else if (glucoseMgDl < 40) {
      return {
        status: 'hypoglycemia',
        label: 'Neonatal Hypoglycemia (< 40 mg/dL)',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        thresholdMgDl: 40,
        actionGuidance: 'Feed immediately (breast milk or formula 5-10 mL/kg). Recheck blood glucose 30-60 minutes after feed. If still < 40 mg/dL, initiate IV 10% Dextrose.',
      };
    } else {
      return {
        status: 'normal',
        label: 'Normal Blood Glucose (>= 40 mg/dL)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        thresholdMgDl: 40,
        actionGuidance: 'Adequate glycemic transition. Continue pre-feed monitoring every 3-4 hours if risk factors persist.',
      };
    }
  } else if (postnatalAgeHours <= 24) {
    // 4 - 24 hours of life: Target >= 45 mg/dL
    if (glucoseMgDl < 30) {
      return {
        status: 'critical_hypoglycemia',
        label: 'Critical Hypoglycemia (< 30 mg/dL)',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        thresholdMgDl: 45,
        actionGuidance: 'Emergency IV 10% Dextrose bolus (2 mL/kg) and continuous infusion (GIR 6-8 mg/kg/min). Transfer to neonatal unit.',
      };
    } else if (glucoseMgDl < 45) {
      return {
        status: 'hypoglycemia',
        label: 'Neonatal Hypoglycemia (< 45 mg/dL)',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        thresholdMgDl: 45,
        actionGuidance: 'Immediate feed. Recheck in 30-60 mins. If second value is < 45 mg/dL, begin IV dextrose infusion.',
      };
    } else {
      return {
        status: 'normal',
        label: 'Normal Blood Glucose (>= 45 mg/dL)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        thresholdMgDl: 45,
        actionGuidance: 'Normal for 4-24h post-delivery. Continue regular feeding schedule.',
      };
    }
  } else {
    // > 24 hours of life: Target >= 50 mg/dL
    if (glucoseMgDl < 35) {
      return {
        status: 'critical_hypoglycemia',
        label: 'Critical Hypoglycemia (< 35 mg/dL)',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        thresholdMgDl: 50,
        actionGuidance: 'Immediate IV Dextrose bolus + infusion. Investigate underlying hyperinsulinism or metabolic error.',
      };
    } else if (glucoseMgDl < 50) {
      return {
        status: 'hypoglycemia',
        label: 'Neonatal Hypoglycemia (< 50 mg/dL)',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        thresholdMgDl: 50,
        actionGuidance: 'Feed immediately and recheck. Ensure maternal lactation support or supplementation.',
      };
    } else {
      return {
        status: 'normal',
        label: 'Normal Blood Glucose (>= 50 mg/dL)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        thresholdMgDl: 50,
        actionGuidance: 'Adequate blood glucose level maintained.',
      };
    }
  }
}

export interface NrpAssessment {
  ppvNeeded: boolean;
  goldenMinuteAchieved: boolean;
  mrSopaIndicated: boolean;
  chestCompressionsIndicated: boolean;
  epinephrineIndicated: boolean;
  algorithmSummary: string;
}

export function evaluateNrpChecklist(params: {
  apgar1mTotal: number;
  initialStepsDone: boolean;
  heartRateUnder100: boolean;
  apneicOrGasping: boolean;
  ppvInitiated: boolean;
  ppvStartSeconds?: number | null;
  chestNotMovingOrHrUnder100AfterPpv: boolean;
  hrUnder60AfterEffectivePpv: boolean;
}): NrpAssessment {
  const ppvNeeded = params.heartRateUnder100 || params.apneicOrGasping || params.apgar1mTotal <= 6;
  const goldenMinuteAchieved = params.initialStepsDone && (!ppvNeeded || (params.ppvInitiated && (params.ppvStartSeconds == null || params.ppvStartSeconds <= 60)));
  const mrSopaIndicated = params.ppvInitiated && params.chestNotMovingOrHrUnder100AfterPpv;
  const chestCompressionsIndicated = params.hrUnder60AfterEffectivePpv;
  const epinephrineIndicated = params.hrUnder60AfterEffectivePpv;

  let algorithmSummary = 'Initial Steps (0-60s): Warm, dry, stimulate, clear airway if needed.';
  if (chestCompressionsIndicated) {
    algorithmSummary = 'CRITICAL NRP STAGE: HR < 60 bpm despite effective PPV. Initiate synchronized Chest Compressions (3:1 ratio, 90 compressions + 30 breaths/min) with 100% FiO2. Prepare Epinephrine IV/IO (0.02 mg/kg).';
  } else if (mrSopaIndicated) {
    algorithmSummary = 'VENTILATION CORRECTIVE STEPS (MR. SOPA): Mask adjust, Reposition airway, Suction mouth/nose, Open mouth, Pressure increase, Alternative airway (LMA/ETT).';
  } else if (ppvNeeded) {
    algorithmSummary = 'GOLDEN MINUTE PPV: Infant apneic/gasping or HR < 100. Initiate Positive Pressure Ventilation (40-60 breaths/min, PIP 20-25 cmH2O) with pulse oximeter.';
  } else {
    algorithmSummary = 'ROUTINE TRANSITION: Vigorous infant, normal breathing, HR >= 100 bpm. Provide routine thermal care and initiate early breastfeeding.';
  }

  return {
    ppvNeeded,
    goldenMinuteAchieved,
    mrSopaIndicated,
    chestCompressionsIndicated,
    epinephrineIndicated,
    algorithmSummary,
  };
}
