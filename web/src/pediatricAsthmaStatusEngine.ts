/**
 * Pediatric Status Asthmaticus & Modified Wood's Clinical Asthma Score (M-WCAS) Clinical Engine
 * Stepwise Pharmacologic & Respiratory Escalation Protocol
 *
 * References:
 * - Global Initiative for Asthma (GINA 2023 Update)
 * - British Thoracic Society / Scottish Intercollegiate Guidelines Network (BTS/SIGN Guideline 158: British guideline on the management of asthma, 2021)
 * - American Academy of Pediatrics (AAP) / Pediatric Emergency Medicine Collaborative: Severe Pediatric Asthma
 */

export type AsthmaSeverityTier =
  | 'mild_1_3'
  | 'moderate_4_6'
  | 'severe_impending_failure_7_10';

export interface MwcasScores {
  spo2Score: number; // 0: >95%, 1: 92-95%, 2: <92% on RA
  wheezingScore: number; // 0: None/mild end-expiratory, 1: Moderate expiratory/inspiratory, 2: Silent chest / marked obstruction
  retractionsScore: number; // 0: None/minimal, 1: Moderate intercostal/subcostal, 2: Severe with tracheosternal / head bobbing
  airEntryScore: number; // 0: Normal, 1: Moderately reduced, 2: Barely audible / silent chest
  mentalStateScore: number; // 0: Alert / smiling, 1: Restless / agitated / anxious, 2: Lethargic / exhausted / confused
}

export interface AsthmaStatusInput {
  ageMonths: number;
  weightKg: number;
  spo2RoomAirPercent: number;
  wheezingScore: number;
  retractionsScore: number;
  airEntryScore: number;
  mentalStateScore: number;
  vbgPh?: number;
  vbgPco2Mmhg?: number;
  currentAlbuterolMgHr?: number;
  currentTerbutalineMcgKgMin?: number;
}

export interface DrugDoseRecommendation {
  agent: string;
  recommendedDose: string;
  route: string;
  instructions: string;
  monitoringCautions: string[];
}

export interface AsthmaStatusEvaluationResult {
  totalMwcasScore: number;
  severityTier: AsthmaSeverityTier;
  severityTitle: string;
  respiratoryExhaustionRisk: boolean;
  vbgInterpretation: string;
  albuterolContinuous: DrugDoseRecommendation;
  ivMagnesiumSulfate: DrugDoseRecommendation;
  ivTerbutaline: DrugDoseRecommendation;
  systemicSteroids: DrugDoseRecommendation;
  respiratorySupportTier: string;
  clinicalActionPlan: string[];
}

/**
 * Calculates Modified Wood's Clinical Asthma Score (M-WCAS) (0 to 10 points)
 */
export function calculateMwcas(scores: {
  spo2Score: number;
  wheezingScore: number;
  retractionsScore: number;
  airEntryScore: number;
  mentalStateScore: number;
}): {
  totalScore: number;
  severityTier: AsthmaSeverityTier;
} {
  const total =
    Math.min(2, Math.max(0, scores.spo2Score)) +
    Math.min(2, Math.max(0, scores.wheezingScore)) +
    Math.min(2, Math.max(0, scores.retractionsScore)) +
    Math.min(2, Math.max(0, scores.airEntryScore)) +
    Math.min(2, Math.max(0, scores.mentalStateScore));

  let tier: AsthmaSeverityTier = 'mild_1_3';
  if (total >= 7) {
    tier = 'severe_impending_failure_7_10';
  } else if (total >= 4) {
    tier = 'moderate_4_6';
  }

  return { totalScore: total, severityTier: tier };
}

/**
 * Evaluates comprehensive Pediatric Status Asthmaticus resuscitation and stepwise drug dosing
 */
export function evaluatePediatricAsthmaStatus(input: AsthmaStatusInput): AsthmaStatusEvaluationResult {
  // SpO2 room air score calculation if not explicitly given
  let spo2Sc = 0;
  if (input.spo2RoomAirPercent < 92) spo2Sc = 2;
  else if (input.spo2RoomAirPercent <= 95) spo2Sc = 1;

  const mwcas = calculateMwcas({
    spo2Score: spo2Sc,
    wheezingScore: input.wheezingScore,
    retractionsScore: input.retractionsScore,
    airEntryScore: input.airEntryScore,
    mentalStateScore: input.mentalStateScore,
  });

  let severityTitle = 'Mild Asthma Exacerbation (M-WCAS 1 - 3): Outpatient / Observation';
  let respExhaustion = false;
  let respSupport = 'Humidified supplemental oxygen via nasal cannula targeting SpO2 94 - 98%.';

  if (mwcas.severityTier === 'severe_impending_failure_7_10') {
    severityTitle = 'SEVERE STATUS ASTHMATICUS / IMPENDING RESPIRATORY FAILURE (M-WCAS 7 - 10)';
    respExhaustion = true;
    respSupport = 'Non-invasive positive pressure ventilation (BiPAP / NIPPV: IPAP 12-16, EPAP 6-8) or High-Flow Nasal Cannula (HFNC 1.5-2.0 L/kg/min). Prepare for intubation with Ketamine dissociation if exhaustion progresses.';
  } else if (mwcas.severityTier === 'moderate_4_6') {
    severityTitle = 'Moderate Status Asthmaticus (M-WCAS 4 - 6): Emergency Department / Inpatient Escalation';
    respSupport = 'High-flow oxygen or heated humidified nasal cannula to keep SpO2 >= 94%.';
  }

  // Venous Blood Gas (VBG) interpretation
  let vbgInterp = 'VBG not yet recorded. Obtain VBG if infant is exhausted or showing signs of respiratory fatigue.';
  if (input.vbgPh !== undefined && input.vbgPco2Mmhg !== undefined) {
    if (input.vbgPco2Mmhg >= 42 || input.vbgPh < 7.30) {
      respExhaustion = true;
      vbgInterp = `CRITICAL RESPIRATORY ARREST WARNING: Venous pCO2 is elevated/normalizing (${input.vbgPco2Mmhg} mmHg, pH ${input.vbgPh}). In a tachypneic child, a normal or high pCO2 is an ominous sign of severe diaphragmatic fatigue and imminent respiratory collapse.`;
    } else {
      vbgInterp = `Expected hyperventilation pattern: pCO2 ${input.vbgPco2Mmhg} mmHg, pH ${input.vbgPh}. Adequate alveolar compensatory ventilation without CO2 retention.`;
    }
  }

  // Weight-based dosing calculations
  const weight = Math.max(3, input.weightKg);

  // 1. Continuous Albuterol: 0.5 mg/kg/hr (max 20 mg/hr)
  const albuterolDoseMg = Math.min(20, Math.round(weight * 0.5 * 10) / 10);
  const albuterolRec: DrugDoseRecommendation = {
    agent: 'Continuous Nebulized Albuterol (Salbutamol)',
    recommendedDose: `${albuterolDoseMg} mg/hour`,
    route: 'Inhalation via large-volume continuous nebulizer',
    instructions: `Nebulize continuously at ${albuterolDoseMg} mg/hr (0.5 mg/kg/hr) with oxygen flow 6-8 L/min. Check serum potassium every 4-6 hours (watch for beta-agonist hypokalemia) and continuous ECG telemetry for tachycardia.`,
    monitoringCautions: ['Monitor for tremor and tachycardia (HR > 180-200 bpm).', 'Check serum potassium: anticipate potassium shift into cells; supplement if K+ < 3.0 mEq/L.'],
  };

  // 2. IV Magnesium Sulfate: 50 mg/kg (max 2000 mg = 2.0 g)
  const magDoseMg = Math.min(2000, Math.round(weight * 50));
  const magRec: DrugDoseRecommendation = {
    agent: 'IV Magnesium Sulfate (50% solution)',
    recommendedDose: `${magDoseMg} mg (${(magDoseMg / 1000).toFixed(1)} g)`,
    route: 'Intravenous infusion',
    instructions: `Dilute in 50-100 mL Normal Saline or D5W and infuse over 20 minutes with continuous non-invasive blood pressure monitoring. Acts as a potent calcium antagonist causing bronchial smooth muscle relaxation.`,
    monitoringCautions: ['Check blood pressure q5min during infusion: rapid infusion can cause transient hypotension.', 'Watch for loss of deep tendon reflexes or respiratory depression if repeated.'],
  };

  // 3. IV Terbutaline: Loading 10 mcg/kg over 10 min, then continuous 0.4 to 10 mcg/kg/min
  const terbLoadMcg = Math.min(500, Math.round(weight * 10));
  const terbInfusionMin = Math.round(weight * 0.4 * 10) / 10;
  const terbInfusionMax = Math.round(weight * 2.0 * 10) / 10;
  const terbRec: DrugDoseRecommendation = {
    agent: 'IV Terbutaline Infusion',
    recommendedDose: `Load: ${terbLoadMcg} mcg over 10 min; Maintenance: ${terbInfusionMin} to ${terbInfusionMax} mcg/min (${0.4} to 2.0 mcg/kg/min)`,
    route: 'Continuous IV infusion via dedicated line',
    instructions: `Administer loading bolus ${terbLoadMcg} mcg (10 mcg/kg) over 10 minutes, then initiate continuous infusion starting at 0.4 mcg/kg/min, titrating by 0.2 mcg/kg/min every 30 minutes up to 2-4 mcg/kg/min based on clinical score.`,
    monitoringCautions: [
      'Strict continuous telemetry: monitor for supraventricular arrhythmias and ischemic ST changes.',
      'Check troponin and 12-lead ECG if heart rate exceeds 200 bpm or perfusion falters.',
      'Anticipate and treat marked hypokalemia and lactic acidosis (type B beta-2 mediated).',
    ],
  };

  // 4. Systemic Corticosteroids: IV Methylprednisolone 2 mg/kg loading, then 1 mg/kg q6h
  const methylpredLoad = Math.min(125, Math.round(weight * 2.0));
  const steroidRec: DrugDoseRecommendation = {
    agent: 'IV Methylprednisolone (Solu-Medrol)',
    recommendedDose: `${methylpredLoad} mg IV loading (2 mg/kg)`,
    route: 'IV push / infusion',
    instructions: `Administer loading dose of 2 mg/kg (${methylpredLoad} mg) immediately upon arrival, followed by 1 mg/kg (${Math.round(weight * 1.0)} mg) IV every 6 hours for 48 hours, transitioning to oral Prednisolone upon stabilization.`,
    monitoringCautions: ['Administer without delay; genomic anti-inflammatory effects require 4 to 6 hours to peak.'],
  };

  // Action plan
  const plan: string[] = [
    `Initiate continuous nebulized Albuterol at ${albuterolDoseMg} mg/hr with high-flow oxygen.`,
    'Administer Ipratropium bromide 250 mcg (or 500 mcg if >= 20 kg) nebulized q20min for 3 doses.',
    `Administer IV Methylprednisolone loading dose ${methylpredLoad} mg stat.`,
  ];

  if (mwcas.severityTier === 'moderate_4_6' || mwcas.severityTier === 'severe_impending_failure_7_10') {
    plan.push(`Administer IV Magnesium Sulfate ${magDoseMg} mg over 20 minutes with continuous BP monitoring.`);
  }

  if (mwcas.severityTier === 'severe_impending_failure_7_10' || respExhaustion) {
    plan.push(`Initiate IV Terbutaline loading dose (${terbLoadMcg} mcg over 10 min) and titrate infusion.`);
    plan.push(respSupport);
    plan.push('Notify Pediatric Intensive Care Unit (PICU) fellow and respiratory therapist for immediate PICU bed transfer.');
  }

  return {
    totalMwcasScore: mwcas.totalScore,
    severityTier: mwcas.severityTier,
    severityTitle,
    respiratoryExhaustionRisk: respExhaustion,
    vbgInterpretation: vbgInterp,
    albuterolContinuous: albuterolRec,
    ivMagnesiumSulfate: magRec,
    ivTerbutaline: terbRec,
    systemicSteroids: steroidRec,
    respiratorySupportTier: respSupport,
    clinicalActionPlan: plan,
  };
}
