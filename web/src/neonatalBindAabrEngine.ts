/**
 * Neonatal Hyperbilirubinemia BIND Scoring (Bilirubin-Induced Neurologic Dysfunction)
 * & Automated Auditory Brainstem Response (AABR) Hearing Screening
 *
 * Guidelines & References:
 * - AAP 2022 Management of Hyperbilirubinemia in the Newborn Infant >= 35 Weeks' Gestation
 * - NICE Clinical Guideline CG98: Jaundice in newborn babies under 28 days
 * - Joint Committee on Infant Hearing (JCIH 2019 Year Position Statement)
 * - Radmacher et al. BIND Score validation for Acute Bilirubin Encephalopathy (ABE)
 */

export interface BindScoreInput {
  mentalStatusScore: number; // 0: Normal/Sleepy, 1: Sleepy/Poor feeding, 2: Lethargic/Irritable, 3: Semicoma/Coma/Seizures
  muscleToneScore: number;   // 0: Normal, 1: Mild hypotonia, 2: Hypertonia alternating with hypotonia, 3: Retrocollis/Opisthotonos
  cryScore: number;          // 0: Normal, 1: High pitched, 2: Shrill/Inconsolable, 3: Weak/Absent/Silent
}

export interface NeonatalBindAabrEvalInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  peakTsbMgDl: number;
  albuminGDl?: number;
  mentalStatusScore: number;
  muscleToneScore: number;
  cryScore: number;
  aabrRightEar: 'not_tested' | 'pass' | 'refer';
  aabrLeftEar: 'not_tested' | 'pass' | 'refer';
  exchangeTransfusionPerformed?: boolean;
  ivigGiven?: boolean;
}

export type BindSeverityTier = 'normal' | 'mild_abe' | 'moderate_abe' | 'severe_abe';

export interface NeonatalBindAabrEvalResult {
  totalBindScore: number;
  bindSeverity: BindSeverityTier;
  calculatedBARatio: number | null;
  bARatioThreshold: number;
  bARatioExchangeRisk: boolean;
  aabrOverallResult: 'not_tested' | 'pass' | 'refer' | 'unilateral_refer';
  urgentExchangeIndicated: boolean;
  phototherapyRecommendation: string;
  neuroAuditoryRecommendations: string[];
  followUpPlan: string;
}

/**
 * Calculates total BIND score (0 to 9) and classifies acute encephalopathy stage
 */
export function calculateBindScore(input: BindScoreInput): { totalScore: number; severity: BindSeverityTier } {
  const m = Math.max(0, Math.min(3, Math.round(input.mentalStatusScore)));
  const t = Math.max(0, Math.min(3, Math.round(input.muscleToneScore)));
  const c = Math.max(0, Math.min(3, Math.round(input.cryScore)));
  const total = m + t + c;

  let severity: BindSeverityTier = 'normal';
  if (total >= 7) {
    severity = 'severe_abe';
  } else if (total >= 4) {
    severity = 'moderate_abe';
  } else if (total >= 1) {
    severity = 'mild_abe';
  }

  return { totalScore: total, severity };
}

/**
 * Calculates Bilirubin-to-Albumin (B/A) ratio in mg/g
 * B/A ratio = TSB (mg/dL) / Albumin (g/dL)
 */
export function calculateBARatio(tsbMgDl: number, albuminGDl?: number): number | null {
  if (!albuminGDl || albuminGDl <= 0) return null;
  const ratio = tsbMgDl / albuminGDl;
  return Math.round(ratio * 10) / 10;
}

/**
 * Determines AAP 2022 / NICE B/A exchange transfusion threshold based on gestational age
 */
export function getBARatioThreshold(gestationalAgeWeeks: number, hasRiskFactors = false): number {
  if (gestationalAgeWeeks >= 38) {
    return hasRiskFactors ? 7.2 : 8.0;
  } else if (gestationalAgeWeeks >= 35) {
    return hasRiskFactors ? 6.8 : 7.2;
  } else {
    return 6.0; // Preterm < 35 weeks
  }
}

/**
 * Interprets bilateral AABR screening results
 */
export function interpretAabr(
  right: 'not_tested' | 'pass' | 'refer',
  left: 'not_tested' | 'pass' | 'refer'
): 'not_tested' | 'pass' | 'refer' | 'unilateral_refer' {
  if (right === 'not_tested' && left === 'not_tested') return 'not_tested';
  if (right === 'pass' && left === 'pass') return 'pass';
  if (right === 'refer' && left === 'refer') return 'refer';
  if (right === 'refer' || left === 'refer') return 'unilateral_refer';
  return 'not_tested';
}

/**
 * Evaluates comprehensive neonatal BIND, B/A ratio, and neuro-auditory toxicity risks
 */
export function evaluateNeonatalBindAabr(input: NeonatalBindAabrEvalInput): NeonatalBindAabrEvalResult {
  const { totalScore, severity } = calculateBindScore({
    mentalStatusScore: input.mentalStatusScore,
    muscleToneScore: input.muscleToneScore,
    cryScore: input.cryScore,
  });

  const bARatio = calculateBARatio(input.peakTsbMgDl, input.albuminGDl);
  const hasNeuroSigns = totalScore > 0;
  const bAThreshold = getBARatioThreshold(input.gestationalAgeWeeks, hasNeuroSigns);
  const bARisk = bARatio !== null && bARatio >= bAThreshold;

  const aabrResult = interpretAabr(input.aabrRightEar, input.aabrLeftEar);

  // Urgent exchange transfusion is indicated if moderate/severe ABE or B/A ratio exceeds cutoff
  const urgentExchangeIndicated = severity === 'moderate_abe' || severity === 'severe_abe' || bARisk;

  let phototherapyRecommendation = 'Standard overhead LED phototherapy with continuous irradiance >= 30 uW/cm2/nm.';
  if (urgentExchangeIndicated) {
    phototherapyRecommendation = 'URGENT: Multiple-surface intensive phototherapy bank with fiberoptic biliblanket while preparing for immediate Double-Volume Exchange Transfusion (DVET).';
  } else if (severity === 'mild_abe') {
    phototherapyRecommendation = 'Intensive phototherapy with 2-hourly hydration and feeding monitoring; repeat TSB in 4 hours.';
  }

  const recs: string[] = [];
  if (urgentExchangeIndicated) {
    recs.push('EMERGENCY: Immediate double-volume exchange transfusion (160-180 mL/kg reconstituted whole blood) to prevent permanent kernicterus / choreoathetoid cerebral palsy.');
    recs.push('Administer IVIG 0.5-1.0 g/kg over 2 hours if isoimmune hemolytic jaundice (Rh or ABO incompatibility).');
  }

  if (aabrResult === 'refer' || aabrResult === 'unilateral_refer') {
    recs.push('AUDITORY REFERRAL: Auditory Neuropathy Spectrum Disorder (ANSD) risk high due to unconjugated bilirubin toxicity on cochlear nuclei and auditory nerve.');
    recs.push('Urgent Diagnostic Auditory Brainstem Response (ABR) with cochlear microphonic evaluation recommended within 1 month.');
  }

  if (totalScore >= 1) {
    recs.push('Serial BIND flowsheet monitoring every 2-4 hours until TSB is below phototherapy threshold and neurologic tone is fully normalized.');
    recs.push('Schedule brain MRI (T1 hyperintensity in globus pallidus and subthalamic nuclei) prior to discharge or at 3 months corrected age.');
  }

  let followUpPlan = 'Routine newborn hearing re-screening at 1 month.';
  if (urgentExchangeIndicated || aabrResult !== 'pass') {
    followUpPlan = 'High-Risk Neonatal Neurodevelopmental Follow-Up: Diagnostic ABR at 1 and 3 months, serial Bayley-III neurodevelopmental assessments at 6, 12, and 24 months, and pediatric neurology consult.';
  } else if (severity === 'mild_abe') {
    followUpPlan = 'Repeat pediatric clinical and tone assessment in 72 hours; ensure complete audiology follow-up within 1 month.';
  }

  return {
    totalBindScore: totalScore,
    bindSeverity: severity,
    calculatedBARatio: bARatio,
    bARatioThreshold: bAThreshold,
    bARatioExchangeRisk: bARisk,
    aabrOverallResult: aabrResult,
    urgentExchangeIndicated,
    phototherapyRecommendation,
    neuroAuditoryRecommendations: recs,
    followUpPlan,
  };
}
