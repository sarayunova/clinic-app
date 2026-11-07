/**
 * Intrahepatic Cholestasis of Pregnancy (ICP / Obstetric Cholestasis) Engine
 * Total Serum Bile Acids (TSBA) Risk Stratification, UDCA Dosing & Delivery Timing Protocol
 *
 * Guidelines & References:
 * - SMFM Consult Series #53: Intrahepatic cholestasis of pregnancy (Am J Obstet Gynecol 2021)
 * - RCOG Green-top Guideline No. 43: Obstetric Cholestasis (2022 update)
 * - ACOG Clinical Practice Update: Management of Intrahepatic Cholestasis of Pregnancy (2021)
 * - Ovadia et al. Lancet 2019: Individual patient data meta-analysis on bile acids and stillbirth
 */

export type IcpSeverityTier = 'mild_10_39' | 'moderate_40_99' | 'severe_ge_100';

export interface ObstetricIcpEvalInput {
  gestationWeeks: number;
  peakTsbaUmolL: number;
  baselineAltUL?: number;
  baselineAstUL?: number;
  pruritusSeverityScore: number; // 0 to 10
  pruritusPalmsSoles?: boolean;
  nocturnalWorsening?: boolean;
}

export interface ObstetricIcpEvalResult {
  icpSeverityTier: IcpSeverityTier;
  stillbirthRiskAssessment: string;
  recommendedUdcaDoseMgDay: number;
  udcaDosingRegimen: string;
  recommendedDeliveryTimingWeeksMin: number;
  recommendedDeliveryTimingWeeksMax: number;
  deliveryTimingRationale: string;
  antenatalSurveillancePlan: string;
  clinicalRecommendations: string[];
}

/**
 * Classifies ICP severity based on peak total serum bile acids (TSBA)
 */
export function classifyIcpSeverity(tsbaUmolL: number): IcpSeverityTier {
  if (tsbaUmolL >= 100) {
    return 'severe_ge_100';
  } else if (tsbaUmolL >= 40) {
    return 'moderate_40_99';
  } else {
    return 'mild_10_39';
  }
}

/**
 * Computes recommended delivery timing window in gestational weeks based on SMFM 2021 & ACOG
 */
export function calculateDeliveryTiming(severity: IcpSeverityTier): { minWeeks: number; maxWeeks: number; rationale: string } {
  switch (severity) {
    case 'severe_ge_100':
      return {
        minWeeks: 35.0,
        maxWeeks: 36.0,
        rationale: 'SMFM/ACOG Severe ICP Protocol: TSBA >= 100 umol/L carries a significant 3.4% risk of sudden unexpected intrauterine fetal demise (stillbirth). Delivery is recommended between 35w0d and 36w0d (or at diagnosis if diagnosed >= 36w). Administer antenatal corticosteroids (Betamethasone) for fetal lung maturity if delivery is prior to 37w0d.',
      };
    case 'moderate_40_99':
      return {
        minWeeks: 36.0,
        maxWeeks: 39.0,
        rationale: 'SMFM/ACOG Moderate ICP Protocol: TSBA 40-99 umol/L is associated with increased meconium-stained amniotic fluid and spontaneous preterm delivery, with stillbirth risk ~0.3-0.5%. Delivery recommended between 36w0d and 39w0d based on symptoms and trajectory.',
      };
    case 'mild_10_39':
    default:
      return {
        minWeeks: 37.0,
        maxWeeks: 39.0,
        rationale: 'SMFM/ACOG Mild ICP Protocol: TSBA 10-39 umol/L has a stillbirth risk comparable to general obstetric population (<0.28%). Delivery recommended between 37w0d and 39w0d.',
      };
  }
}

/**
 * Evaluates comprehensive ICP risk, UDCA titration, and fetal surveillance plan
 */
export function evaluateObstetricIcp(input: ObstetricIcpEvalInput): ObstetricIcpEvalResult {
  const severity = classifyIcpSeverity(input.peakTsbaUmolL);
  const timing = calculateDeliveryTiming(severity);

  // UDCA standard dosing: 10-15 mg/kg/day, usually starting at 300mg TID (900mg) or 500mg BID (1000mg)
  // For severe, titrate up to 1500 - 2000 mg/day
  let udcaDose = 900;
  let udcaRegimen = 'Ursodeoxycholic acid (UDCA) 300 mg orally three times daily (TID)';
  if (severity === 'severe_ge_100') {
    udcaDose = 1500;
    udcaRegimen = 'Ursodeoxycholic acid (UDCA) 500 mg orally three times daily (TID) (1500 mg/day, titrate up to 2000 mg/day if pruritus or TSBA refractory)';
  } else if (severity === 'moderate_40_99') {
    udcaDose = 1000;
    udcaRegimen = 'Ursodeoxycholic acid (UDCA) 500 mg orally twice daily (BID) (1000 mg/day)';
  }

  let stillbirthRisk = 'Low risk (< 0.28%, comparable to baseline population).';
  if (severity === 'severe_ge_100') {
    stillbirthRisk = 'HIGH RISK: Sudden unexpected stillbirth risk is ~3.4% when TSBA >= 100 umol/L. Fetal demise is often acute and arrhythmic; routine CTG may not predict sudden death.';
  } else if (severity === 'moderate_40_99') {
    stillbirthRisk = 'Moderate risk (~0.3% - 0.5%). Elevated risk of meconium passage in utero and fetal distress.';
  }

  let surveillance = 'Weekly non-stress test (NST) and amniotic fluid volume starting at 32 weeks.';
  if (severity === 'severe_ge_100') {
    surveillance = 'Twice-weekly or inpatient daily NST + biophysical profile (BPP) starting at diagnosis. Weekly fasting TSBA and liver function panel (ALT/AST). Continuous electronic fetal monitoring in labor.';
  } else if (severity === 'moderate_40_99') {
    surveillance = 'Twice-weekly NST and amniotic fluid assessment starting at 32-34 weeks. Weekly TSBA and transaminases.';
  }

  const recs: string[] = [];
  recs.push(`First-line therapy: ${udcaRegimen}.`);
  if (input.pruritusSeverityScore >= 7 || input.nocturnalWorsening) {
    recs.push('Adjuvant antipruritic therapy: Topical aqueous cream with 1-2% menthol for symptom relief, plus night-time antihistamine (Chlorpheniramine 4mg or Hydroxyzine 25mg) for sleep disruption.');
  }

  if (severity === 'severe_ge_100') {
    recs.push('Administer Course of Antenatal Corticosteroids (Betamethasone 12mg IM 24h apart x 2 doses) prior to planned early term delivery (< 37w0d).');
    recs.push('Postpartum follow-up: Repeat fasting bile acids and liver function panel at 6-8 weeks postpartum to confirm complete resolution and rule out underlying chronic hepatobiliary pathology (e.g. primary biliary cholangitis).');
  }

  if (input.baselineAltUL && input.baselineAltUL > 200) {
    recs.push('Marked transaminitis detected (> 200 U/L): Rule out pre-eclampsia/HELLP syndrome, viral hepatitis (A, B, C, E, EBV, CMV), and autoimmune liver disease with serology and right upper quadrant ultrasound.');
  }

  return {
    icpSeverityTier: severity,
    stillbirthRiskAssessment: stillbirthRisk,
    recommendedUdcaDoseMgDay: udcaDose,
    udcaDosingRegimen: udcaRegimen,
    recommendedDeliveryTimingWeeksMin: timing.minWeeks,
    recommendedDeliveryTimingWeeksMax: timing.maxWeeks,
    deliveryTimingRationale: timing.rationale,
    antenatalSurveillancePlan: surveillance,
    clinicalRecommendations: recs,
  };
}
