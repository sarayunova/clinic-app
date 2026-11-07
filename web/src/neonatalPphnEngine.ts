/**
 * Neonatal Persistent Pulmonary Hypertension of the Newborn (PPHN) Clinical Engine
 * Oxygenation Index (OI), Inhaled Nitric Oxide (iNO) Stewardship & Echocardiographic Staging
 *
 * References:
 * - AAP / AHA Pediatric Pulmonary Hypertension Guidelines (Circulation 2015; 132: 2037-2099)
 * - European Consensus on Inhaled Nitric Oxide in Neonates (Neonatology 2015; 107: 153-162)
 * - Cochrane Review: Inhaled nitric oxide for respiratory failure in preterm and term infants (2017)
 */

export type PphnSeverityTier =
  | 'mild_oi_under_15'
  | 'moderate_oi_15_24'
  | 'severe_oi_25_39'
  | 'critical_ecmo_oi_40_plus';

export interface PphnEvaluationInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  primaryEtiology:
    | 'idiopathic'
    | 'meconium_aspiration_syndrome'
    | 'respiratory_distress_syndrome'
    | 'congenital_diaphragmatic_hernia'
    | 'neonatal_pneumonia_sepsis'
    | 'pulmonary_hypoplasia'
    | 'other';
  preductalSpo2: number; // % (right upper extremity)
  postductalSpo2: number; // % (lower extremity)
  meanAirwayPressureCmh2o: number; // MAP (cmH2O)
  fio2Percent: number; // % (21 - 100)
  pao2Mmhg: number; // PaO2 from arterial blood gas (mmHg)
  echoTrJetVelocityMs?: number; // Tricuspid regurgitation jet velocity (m/s)
  echoEstimatedRvspMmhg?: number; // Estimated RV systolic pressure (mmHg)
  echoShuntDirection?: 'right_to_left' | 'bidirectional' | 'left_to_right';
  currentInoDosePpm?: number;
  methemoglobinPercent?: number; // % (MetHb)
}

export interface PphnEvaluationResult {
  spo2Gradient: number;
  calculatedOi: number;
  severityTier: PphnSeverityTier;
  severityTitle: string;
  ductalShuntInterpretation: string;
  inoRecommended: boolean;
  recommendedInoDosePpm: number;
  secondLineVasodilators: string[];
  weaningGuidance: string[];
  methemoglobinStatus: 'normal' | 'caution' | 'toxic';
  methemoglobinAdvice: string;
  ecmoReferralIndicated: boolean;
  clinicalActionPlan: string[];
}

/**
 * Calculates Oxygenation Index (OI):
 * OI = (MAP [cmH2O] * FiO2 [%] * 100) / PaO2 [mmHg]
 * (When FiO2 is given as percentage e.g. 100, OI = (MAP * FiO2) / PaO2)
 */
export function calculateOxygenationIndex(mapCmh2o: number, fio2Percent: number, pao2Mmhg: number): number {
  if (pao2Mmhg <= 0) return 0;
  const rawOi = (mapCmh2o * fio2Percent) / pao2Mmhg;
  return Math.round(rawOi * 10) / 10;
}

/**
 * Calculates Pre-ductal vs Post-ductal SpO2 gradient
 */
export function calculateSpo2Gradient(preductalSpo2: number, postductalSpo2: number): number {
  return Math.max(0, Math.round((preductalSpo2 - postductalSpo2) * 10) / 10);
}

/**
 * Classifies PPHN Severity Tier based on Oxygenation Index (OI)
 */
export function classifyPphnSeverity(oi: number): PphnSeverityTier {
  if (oi >= 40) return 'critical_ecmo_oi_40_plus';
  if (oi >= 25) return 'severe_oi_25_39';
  if (oi >= 15) return 'moderate_oi_15_24';
  return 'mild_oi_under_15';
}

/**
 * Evaluates comprehensive PPHN management, iNO dosing, MetHb surveillance, and ECMO triggers
 */
export function evaluateNeonatalPphn(input: PphnEvaluationInput): PphnEvaluationResult {
  const gradient = calculateSpo2Gradient(input.preductalSpo2, input.postductalSpo2);
  const oi = calculateOxygenationIndex(input.meanAirwayPressureCmh2o, input.fio2Percent, input.pao2Mmhg);
  const tier = classifyPphnSeverity(oi);

  let severityTitle = 'Mild PPHN (OI < 15): Conservative Ventilation & Sedation';
  let inoRec = false;
  let recommendedDose = 0;
  let ecmoIndicated = false;

  const actions: string[] = [];
  const secondLine: string[] = [];
  const weaning: string[] = [];

  // Ductal shunting evaluation
  let shuntInterp = 'No significant ductal gradient (< 10%). Balanced or left-to-right shunting.';
  if (gradient >= 10 || input.echoShuntDirection === 'right_to_left') {
    shuntInterp = `Significant pre/post-ductal SpO2 gradient (${gradient}% >= 10%) indicating severe suprasystemic right-to-left ductal shunting across PDA/PFO.`;
  }

  // Tier classification & recommendations
  switch (tier) {
    case 'critical_ecmo_oi_40_plus':
      severityTitle = 'CRITICAL PPHN (OI >= 40): Intractable Hypoxemia / ECMO Referral Criteria';
      inoRec = true;
      recommendedDose = 20;
      ecmoIndicated = true;
      actions.push('CRITICAL: Oxygenation Index >= 40 indicates >80% mortality without advanced rescue therapy.');
      actions.push('Immediately contact Regional Neonatal Extracorporeal Membrane Oxygenation (ECMO) Center for emergency cannulation retrieval.');
      actions.push('Continue Inhaled Nitric Oxide (iNO) at 20 ppm; optimize high-frequency oscillatory ventilation (HFOV) lung recruitment.');
      break;

    case 'severe_oi_25_39':
      severityTitle = 'Severe PPHN (OI 25 - 39): Inhaled Nitric Oxide & Secondary Vasodilators';
      inoRec = true;
      recommendedDose = 20;
      actions.push('Severe PPHN with severe refractory hypoxemia. Initiate Inhaled Nitric Oxide (iNO) at 20 ppm without delay.');
      actions.push('Switch to High-Frequency Oscillatory Ventilation (HFOV) to recruit atelectatic lung and optimize iNO delivery.');
      actions.push('Target systemic blood pressure higher than pulmonary arterial pressure: initiate Dopamine/Epinephrine infusion if hypotensive.');
      secondLine.push('IV Sildenafil loading 0.4 mg/kg over 3 hours followed by 1.6 mg/kg/day continuous infusion.');
      secondLine.push('IV Milrinone 0.33 to 0.99 mcg/kg/min (omit loading dose to prevent systemic hypotension) for RV afterload reduction.');
      break;

    case 'moderate_oi_15_24':
      severityTitle = 'Moderate PPHN (OI 15 - 24): Inhaled Nitric Oxide Indicated';
      inoRec = true;
      recommendedDose = 20;
      actions.push('Oxygenation Index >= 15 with persistent hypoxemia meets evidence-based threshold for Inhaled Nitric Oxide (iNO) initiation.');
      actions.push('Start iNO at 20 ppm. Assess response within 30-60 minutes: positive response is defined as PaO2 increase >= 20 mmHg or SpO2 increase >= 5%.');
      actions.push('Avoid hyperventilation and profound alkalosis; maintain arterial pH 7.35 - 7.45 and PaCO2 40 - 50 mmHg.');
      break;

    case 'mild_oi_under_15':
    default:
      severityTitle = 'Mild PPHN (OI < 15): Conservative Cardiorespiratory Support';
      inoRec = gradient >= 10 && input.fio2Percent >= 60;
      recommendedDose = inoRec ? 20 : 0;
      actions.push('Optimize lung volume with gentle conventional ventilation or CPAP. Avoid overinflation which increases pulmonary vascular resistance.');
      actions.push('Ensure adequate sedation (Morphine / Fentanyl infusion) and minimize environmental stimulation.');
      actions.push('Maintain normothermia, normal hematocrit (40-45%), and adequate systemic perfusion.');
      break;
  }

  // Weaning protocol
  weaning.push('Once infant is stabilized with PaO2 >= 60 mmHg on FiO2 <= 60% for 12-24 hours, initiate step-wise iNO weaning.');
  weaning.push('Reduce iNO from 20 ppm -> 10 ppm -> 5 ppm in 4-hour decrements while observing pre-ductal SpO2.');
  weaning.push('Wean slowly from 5 ppm -> 2 ppm -> 1 ppm by 1 ppm every 2-4 hours to prevent rebound pulmonary vasoconstriction.');
  weaning.push('Discontinue iNO only after 1 ppm is tolerated without desaturation or worsening OI.');

  // Methemoglobin surveillance
  const metHb = input.methemoglobinPercent ?? 0;
  let metStatus: 'normal' | 'caution' | 'toxic' = 'normal';
  let metAdvice = 'Methemoglobin level within safe physiological limits (< 2.5%). Check MetHb levels at 4 hours post-initiation and daily.';

  if (metHb >= 5.0) {
    metStatus = 'toxic';
    metAdvice = `EMERGENCY: Methemoglobin elevated at ${metHb}% (toxic threshold >= 5.0%). Halve iNO dose immediately or discontinue. Administer Methylene Blue 1 to 2 mg/kg IV over 5 minutes if tissue hypoxia occurs.`;
  } else if (metHb >= 2.5) {
    metStatus = 'caution';
    metAdvice = `Caution: Methemoglobin elevated at ${metHb}% (caution threshold >= 2.5%). Repeat measurement in 2 hours and reduce iNO dose by 50% if level continues rising.`;
  }

  return {
    spo2Gradient: gradient,
    calculatedOi: oi,
    severityTier: tier,
    severityTitle,
    ductalShuntInterpretation: shuntInterp,
    inoRecommended: inoRec,
    recommendedInoDosePpm: recommendedDose,
    secondLineVasodilators: secondLine,
    weaningGuidance: weaning,
    methemoglobinStatus: metStatus,
    methemoglobinAdvice: metAdvice,
    ecmoReferralIndicated: ecmoIndicated,
    clinicalActionPlan: actions,
  };
}
