// High-Risk Antenatal Maternal Medical Comorbidities Engine
// Reference: European Society of Cardiology (ESC) Guidelines on Cardiovascular Disease during Pregnancy (mWHO & CARPREG-II)
// and RCOG Green-top Guideline No. 43: Intrahepatic Cholestasis of Pregnancy (ICP).

export interface MaternalCardiacInput {
  mwhoClass: 'mwho_I' | 'mwho_II' | 'mwho_II_III' | 'mwho_III' | 'mwho_IV';
  nyhaClassBaseline: 'I' | 'II' | 'III' | 'IV';
  priorCardiacEvent?: boolean; // HF, TIA, stroke, arrhythmia (3 pts)
  baselineNyhaOrCyanosis?: boolean; // NYHA III/IV or cyanosis (3 pts)
  highRiskValveOrAorta?: boolean; // Mechanical valve or aorta disease (2 pts)
  reducedSystemicVentricularFunction?: boolean; // LVEF < 50% (2 pts)
  leftHeartObstruction?: boolean; // Mitral <2cm2, aortic <1.5cm2, LVOT grad >30 (2 pts)
  priorArrhythmia?: boolean; // Sustained atrial or ventricular (1 pt)
  latePregnancyPresentation?: boolean; // Booking after 20 weeks (1 pt)
}

export interface MaternalCardiacAssessmentResult {
  carpregIiScore: number;
  predictedEventRiskPct: number;
  riskTier: 'low' | 'intermediate' | 'high';
  mwhoDescription: string;
  contraindicatedPregnancy: boolean;
  recommendedDeliveryMode: string;
  hemodynamicMonitoringRecommendations: string[];
  anesthesiaAdvice: string[];
  multidisciplinaryTeamAlerts: string[];
}

export function calculateMaternalCardiacRisk(input: MaternalCardiacInput): MaternalCardiacAssessmentResult {
  let score = 0;

  if (input.priorCardiacEvent) score += 3;
  if (input.baselineNyhaOrCyanosis || input.nyhaClassBaseline === 'III' || input.nyhaClassBaseline === 'IV') score += 3;
  if (input.highRiskValveOrAorta) score += 2;
  if (input.reducedSystemicVentricularFunction) score += 2;
  if (input.leftHeartObstruction) score += 2;
  if (input.priorArrhythmia) score += 1;
  if (input.latePregnancyPresentation) score += 1;

  let predictedEventRiskPct: number;
  let riskTier: 'low' | 'intermediate' | 'high';

  if (score <= 1) {
    predictedEventRiskPct = 5.0;
    riskTier = 'low';
  } else if (score <= 4) {
    predictedEventRiskPct = 12.0; // 10-15%
    riskTier = 'intermediate';
  } else {
    predictedEventRiskPct = 41.0;
    riskTier = 'high';
  }

  const isMwhoIV = input.mwhoClass === 'mwho_IV';
  const contraindicatedPregnancy = isMwhoIV;

  let mwhoDescription = '';
  switch (input.mwhoClass) {
    case 'mwho_I':
      mwhoDescription = 'mWHO Class I: No detectable increase in maternal mortality; mild or no morbidity risk. Care at local hospital.';
      break;
    case 'mwho_II':
      mwhoDescription = 'mWHO Class II: Small increase in maternal mortality or moderate morbidity risk. Regular cardiology review recommended.';
      break;
    case 'mwho_II_III':
      mwhoDescription = 'mWHO Class II-III: Intermediate risk depending on individual factors (e.g., mild LV impairment, Marfan non-dilated). Joint cardio-obstetric clinic.';
      break;
    case 'mwho_III':
      mwhoDescription = 'mWHO Class III: Significantly increased risk of maternal mortality or severe morbidity. Monthly tertiary cardio-obstetric specialist team.';
      break;
    case 'mwho_IV':
      mwhoDescription = 'mWHO Class IV: EXTREMELY HIGH maternal mortality risk (40-100%). PREGNANCY CONTRAINDICATED. Tertiary/Quaternary center ICU delivery.';
      break;
  }

  const recommendedDeliveryMode = isMwhoIV || input.mwhoClass === 'mwho_III' || score > 4
    ? 'Planned early delivery in tertiary center; vaginal delivery with instrumental 2nd stage shortening under continuous invasive arterial monitoring, unless severe aortic pathology or acute decompensated heart failure warrants emergency Caesarean.'
    : 'Spontaneous or induced vaginal delivery with early lumbar epidural analgesia and assisted second stage to avoid Valsalva.';

  const hemodynamicMonitoringRecommendations: string[] = [];
  if (riskTier === 'high' || input.mwhoClass === 'mwho_III' || isMwhoIV) {
    hemodynamicMonitoringRecommendations.push('Continuous radial arterial line for beat-to-beat BP monitoring during active labor and 24h postpartum.');
    hemodynamicMonitoringRecommendations.push('Strict fluid balance sheet (limit IV fluids to ≤ 1 mL/kg/h to avoid pulmonary edema).');
    hemodynamicMonitoringRecommendations.push('Mandatory reserved ICU/HDU bed for post-partum monitoring for at least 48 hours (peak autotransfusion window).');
  } else {
    hemodynamicMonitoringRecommendations.push('Non-invasive continuous blood pressure and pulse oximetry monitoring throughout labor.');
    hemodynamicMonitoringRecommendations.push('Maintain left lateral tilt to optimize venous return and cardiac output.');
  }

  const anesthesiaAdvice: string[] = [];
  anesthesiaAdvice.push('Early continuous lumbar epidural analgesia is strongly recommended to attenuate pain-induced catecholamine surges.');
  if (input.leftHeartObstruction || input.mwhoClass === 'mwho_IV') {
    anesthesiaAdvice.push('Avoid single-shot spinal anesthesia; sudden drop in systemic vascular resistance (SVR) can trigger catastrophic cardiac collapse.');
  }

  const multidisciplinaryTeamAlerts: string[] = [];
  if (contraindicatedPregnancy) {
    multidisciplinaryTeamAlerts.push('CRITICAL ALERT: mWHO IV carries substantial maternal mortality risk. Multidisciplinary review (Cardiologist, Obstetrician, Anesthesiologist, Neonatologist) mandatory.');
  }
  if (input.highRiskValveOrAorta) {
    multidisciplinaryTeamAlerts.push('Anticoagulation management: Transition from oral anticoagulants/LMWH to IV unfractionated heparin at 36 weeks or prior to planned delivery.');
  }

  return {
    carpregIiScore: score,
    predictedEventRiskPct,
    riskTier,
    mwhoDescription,
    contraindicatedPregnancy,
    recommendedDeliveryMode,
    hemodynamicMonitoringRecommendations,
    anesthesiaAdvice,
    multidisciplinaryTeamAlerts,
  };
}

// ICP (Intrahepatic Cholestasis of Pregnancy)
export interface MaternalIcpInput {
  totalSerumBileAcidsUmolL: number;
  gestationalAgeWeeks: number;
  patientWeightKg?: number;
  pruritusSeverity?: 'mild_nocturnal_palms_soles' | 'moderate_continuous' | 'severe_intractable_excoriations';
}

export interface MaternalIcpAssessmentResult {
  severityTier: 'mild_10_39' | 'moderate_40_99' | 'severe_100_plus';
  severityLabel: string;
  stillbirthRiskAssessment: string;
  recommendedDeliveryGestationWeeks: number;
  deliveryTimingGuidance: string;
  recommendedUdcaDailyMg: number;
  udcaDoseExplanation: string;
  surveillanceIntervalDays: number;
  clinicalActionItems: string[];
}

export function calculateMaternalIcp(input: MaternalIcpInput): MaternalIcpAssessmentResult {
  const { totalSerumBileAcidsUmolL, gestationalAgeWeeks, patientWeightKg = 60 } = input;

  let severityTier: 'mild_10_39' | 'moderate_40_99' | 'severe_100_plus';
  let severityLabel: string;
  let stillbirthRiskAssessment: string;
  let recommendedDeliveryGestationWeeks: number;
  let deliveryTimingGuidance: string;
  let surveillanceIntervalDays: number;

  if (totalSerumBileAcidsUmolL < 40) {
    severityTier = 'mild_10_39';
    severityLabel = 'Mild ICP (10 - 39 µmol/L)';
    stillbirthRiskAssessment = 'Stillbirth risk is comparable to the baseline pregnant population (< 0.3%).';
    recommendedDeliveryGestationWeeks = 38.5; // 38+0 to 39+0
    deliveryTimingGuidance = 'Planned delivery between 38+0 and 39+0 weeks gestation.';
    surveillanceIntervalDays = 7;
  } else if (totalSerumBileAcidsUmolL < 100) {
    severityTier = 'moderate_40_99';
    severityLabel = 'Moderate ICP (40 - 99 µmol/L)';
    stillbirthRiskAssessment = 'Elevated stillbirth risk (approx. 0.3 - 0.5%); fetal bile-acid cardiotoxicity risk.';
    recommendedDeliveryGestationWeeks = 37.5; // 37+0 to 38+0
    deliveryTimingGuidance = 'Planned delivery between 37+0 and 38+0 weeks gestation.';
    surveillanceIntervalDays = 5;
  } else {
    severityTier = 'severe_100_plus';
    severityLabel = 'Severe ICP (≥ 100 µmol/L) - CRITICAL';
    stillbirthRiskAssessment = 'Significantly elevated stillbirth risk (approx. 3.4%); spontaneous preterm delivery and meconium aspiration risk.';
    recommendedDeliveryGestationWeeks = 35.5; // 35+0 to 36+0
    deliveryTimingGuidance = 'Early planned delivery at 35+0 to 36+0 weeks gestation following antenatal corticosteroid cover for fetal lung maturation.';
    surveillanceIntervalDays = 3;
  }

  // UDCA standard 10 - 15 mg/kg/day rounded to nearest 250/300 mg
  const rawUdca = patientWeightKg * 15;
  const roundedUdca = Math.min(2000, Math.max(600, Math.round(rawUdca / 100) * 100));

  const clinicalActionItems: string[] = [
    `Initiate / Titrate Ursodeoxycholic Acid (UDCA) at ${roundedUdca} mg/day in 2 or 3 divided doses with meals.`,
    `Repeat fasting total serum bile acids & LFTs (ALT, AST, Total Bilirubin) every ${surveillanceIntervalDays} days.`,
    'Administer oral Vitamin K (10 mg/day) if prothrombin time / INR is prolonged or bile acids > 100 µmol/L.',
    'Counsel patient on daily fetal movement monitoring (kick counts) and urgent presentation if movements decline.',
  ];

  if (severityTier === 'severe_100_plus' && gestationalAgeWeeks < 36) {
    clinicalActionItems.unshift('Urgent: Administer Dexamethasone 6 mg IM Q12H x 4 doses or Betamethasone 12 mg IM Q24H x 2 doses for fetal pulmonary maturation.');
  }

  return {
    severityTier,
    severityLabel,
    stillbirthRiskAssessment,
    recommendedDeliveryGestationWeeks,
    deliveryTimingGuidance,
    recommendedUdcaDailyMg: roundedUdca,
    udcaDoseExplanation: `${roundedUdca} mg/day (~10-15 mg/kg/day based on ${patientWeightKg} kg body weight) to reduce maternal pruritus and improve transplacental bile acid clearance.`,
    surveillanceIntervalDays,
    clinicalActionItems,
  };
}
