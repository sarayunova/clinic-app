// Pure TypeScript calculation engine for Pediatric Kawasaki Disease (KD) & Coronary Aneurysm Prevention Protocol
// Guidelines: AHA 2017 Guidelines / Kobayashi Score for IVIG Resistance

export interface PediatricKawasakiParams {
  ageMonths: number;
  weightKg: number;
  feverDurationDays: number;
  conjunctivitisBilateralBulbar: boolean;
  oralMucosalChanges: boolean;
  polymorphousExanthemRash: boolean;
  peripheralExtremityChanges: boolean;
  cervicalLymphadenopathyGe15cm: boolean;
  bcgScarErythema?: boolean;
  perinealErythemaDesquamation?: boolean;
  crpMgL: number;
  esrMmHr: number;
  serumAlbuminGDl?: number;
  serumSodiumMeqL?: number;
  plateletCount?: number;
  wbcCount?: number;
  altUL?: number;
  neutrophilPct?: number;
  sterilePyuriaPresent?: boolean;
  echoPerformed: boolean;
  ladZScore?: number;
  rcaZScore?: number;
}

export interface PediatricKawasakiResult {
  principalCriteriaCount: number;
  diagnosisClassification: 'classic_complete_kd' | 'incomplete_atypical_kd' | 'suspected_kd_evaluating';
  diagnosisClassificationLabel: string;
  kobayashiScore: number;
  ivigResistanceRisk: 'low_risk' | 'high_risk';
  ivigResistanceRiskLabel: string;
  coronaryAneurysmClassification: 'normal_z_lt_2' | 'dilation_z_2_to_2_5' | 'small_aneurysm_z_2_5_to_5' | 'medium_aneurysm_z_5_to_10' | 'giant_aneurysm_ge_10_or_ge_8mm';
  coronaryAneurysmClassificationLabel: string;
  maxCoronaryZScore: number;
  treatmentRegimen: {
    ivigDoseGrams: number;
    ivigInfusionInstructions: string;
    aspirinAcuteDoseMgDay: number;
    aspirinMaintenanceDoseMgDay: number;
  };
  recommendations: string[];
  alerts: string[];
}

export function evaluatePediatricKawasaki(params: PediatricKawasakiParams): PediatricKawasakiResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];

  // 1. Principal Clinical Criteria Count (0 to 5)
  const criteria = [
    params.conjunctivitisBilateralBulbar,
    params.oralMucosalChanges,
    params.polymorphousExanthemRash,
    params.peripheralExtremityChanges,
    params.cervicalLymphadenopathyGe15cm,
  ];
  const principalCriteriaCount = criteria.filter(Boolean).length;

  // 2. Supplemental Laboratory Criteria for Incomplete KD
  const hasSystemicInflammation = params.crpMgL >= 30.0 || params.esrMmHr >= 40.0;
  const supplementalCriteria: boolean[] = [
    Boolean(params.serumAlbuminGDl !== undefined && params.serumAlbuminGDl <= 3.0),
    Boolean(params.altUL !== undefined && params.altUL > 50.0),
    Boolean(params.plateletCount !== undefined && params.plateletCount >= 450000 && params.feverDurationDays >= 7),
    Boolean(params.wbcCount !== undefined && params.wbcCount >= 15000),
    Boolean(params.sterilePyuriaPresent),
  ];
  const supplementalCount = supplementalCriteria.filter(Boolean).length;

  // 3. Coronary Artery Z-Score Quantification (AHA 2017)
  const ladZ = params.ladZScore ?? 0;
  const rcaZ = params.rcaZScore ?? 0;
  const maxZ = Math.max(ladZ, rcaZ);

  let coronaryAneurysmClassification: 'normal_z_lt_2' | 'dilation_z_2_to_2_5' | 'small_aneurysm_z_2_5_to_5' | 'medium_aneurysm_z_5_to_10' | 'giant_aneurysm_ge_10_or_ge_8mm' = 'normal_z_lt_2';
  let coronaryAneurysmClassificationLabel = 'Normal Coronary Dimensions (Z < 2.0)';

  if (maxZ >= 10.0) {
    coronaryAneurysmClassification = 'giant_aneurysm_ge_10_or_ge_8mm';
    coronaryAneurysmClassificationLabel = 'Giant Coronary Aneurysm (Z ≥ 10.0 or lumen ≥ 8.0 mm)';
    alerts.push('CRITICAL CARDIAC ALERT: Giant coronary artery aneurysm identified. High risk of thrombosis and myocardial infarction. Anticoagulation (LMWH or Warfarin) required in addition to antiplatelet therapy.');
  } else if (maxZ >= 5.0) {
    coronaryAneurysmClassification = 'medium_aneurysm_z_5_to_10';
    coronaryAneurysmClassificationLabel = 'Medium Coronary Aneurysm (5.0 ≤ Z < 10.0)';
    alerts.push('CARDIAC WARNING: Medium coronary artery aneurysm. Dual antiplatelet or systemic anticoagulation recommended.');
  } else if (maxZ >= 2.5) {
    coronaryAneurysmClassification = 'small_aneurysm_z_2_5_to_5';
    coronaryAneurysmClassificationLabel = 'Small Coronary Aneurysm (2.5 ≤ Z < 5.0)';
  } else if (maxZ >= 2.0) {
    coronaryAneurysmClassification = 'dilation_z_2_to_2_5';
    coronaryAneurysmClassificationLabel = 'Coronary Artery Dilation Only (2.0 ≤ Z < 2.5)';
  }

  // 4. Diagnostic Classification: Classic vs Incomplete
  let diagnosisClassification: 'classic_complete_kd' | 'incomplete_atypical_kd' | 'suspected_kd_evaluating' = 'suspected_kd_evaluating';
  let diagnosisClassificationLabel = 'Suspected Kawasaki Disease (Evaluating)';

  const isEchoPositive = maxZ >= 2.5;

  if (params.feverDurationDays >= 5 && principalCriteriaCount >= 4) {
    diagnosisClassification = 'classic_complete_kd';
    diagnosisClassificationLabel = 'Classic (Complete) Kawasaki Disease (Fever ≥5d + ≥4 Criteria)';
  } else if (params.feverDurationDays >= 5 && (principalCriteriaCount === 2 || principalCriteriaCount === 3)) {
    if (hasSystemicInflammation && (supplementalCount >= 3 || isEchoPositive)) {
      diagnosisClassification = 'incomplete_atypical_kd';
      diagnosisClassificationLabel = 'Incomplete (Atypical) Kawasaki Disease (AHA Diagnostic Pathway)';
    } else {
      diagnosisClassification = 'suspected_kd_evaluating';
      diagnosisClassificationLabel = 'Incomplete Presentation (Pending Supplemental Workup)';
    }
  }

  // 5. Kobayashi Score for IVIG Resistance (0 to 11 points)
  let kobayashi = 0;
  if (params.serumSodiumMeqL !== undefined && params.serumSodiumMeqL <= 133) kobayashi += 2;
  if (params.feverDurationDays <= 4) kobayashi += 2;
  if (params.altUL !== undefined && params.altUL >= 100) kobayashi += 2;
  if (params.neutrophilPct !== undefined && params.neutrophilPct >= 80) kobayashi += 2;
  if (params.crpMgL >= 100) kobayashi += 1;
  if (params.ageMonths <= 6) kobayashi += 1;
  if (params.plateletCount !== undefined && params.plateletCount <= 300000) kobayashi += 1;

  const isHighRisk = kobayashi >= 5;
  const ivigResistanceRisk: 'low_risk' | 'high_risk' = isHighRisk ? 'high_risk' : 'low_risk';
  const ivigResistanceRiskLabel = isHighRisk
    ? `High Risk for IVIG Resistance (Kobayashi Score ${kobayashi} ≥ 5)`
    : `Standard / Low Risk for IVIG Resistance (Kobayashi Score ${kobayashi} < 5)`;

  if (isHighRisk) {
    alerts.push(`HIGH RISK IVIG RESISTANCE: Kobayashi score ${kobayashi} (≥5). Higher incidence of coronary lesions. Consider primary adjunct therapy (IV Methylprednisolone or Infliximab with IVIG).`);
  }

  // 6. Pharmacotherapy Dosing Calculations
  // IVIG: 2.0 g/kg as a single infusion over 10-12 hours
  const ivigDoseGrams = Number((params.weightKg * 2.0).toFixed(1));
  const ivigInfusionInstructions = `Administer IVIG ${ivigDoseGrams} g (2.0 g/kg) as a single continuous intravenous infusion over 10 to 12 hours. Premedicate with antihistamine/antipyretic.`;

  // High-dose Aspirin: 30-50 mg/kg/day (use 40 mg/kg/day)
  const aspirinAcuteDoseMgDay = Math.round(params.weightKg * 40.0);
  // Low-dose antiplatelet Aspirin: 3-5 mg/kg/day (use 4 mg/kg/day)
  const aspirinMaintenanceDoseMgDay = Math.round(params.weightKg * 4.0);

  recommendations.push(ivigInfusionInstructions);
  recommendations.push(`Aspirin Anti-inflammatory: ${aspirinAcuteDoseMgDay} mg/day divided QID (40 mg/kg/day) until afebrile for 48-72 hours.`);
  recommendations.push(`Aspirin Antiplatelet: Follow with low-dose ${aspirinMaintenanceDoseMgDay} mg/day once daily for 6-8 weeks until repeat echo confirms normal coronaries.`);

  if (params.ageMonths <= 6) {
    alerts.push('INFANT ≤ 6 MONTHS: Highest risk group for incomplete presentation and severe coronary artery aneurysms. Maintain low threshold for full treatment.');
  }

  if (params.bcgScarErythema) {
    recommendations.push('BCG scar erythema observed: highly characteristic feature supporting early Kawasaki disease recognition in endemic/vaccinated populations.');
  }

  return {
    principalCriteriaCount,
    diagnosisClassification,
    diagnosisClassificationLabel,
    kobayashiScore: kobayashi,
    ivigResistanceRisk,
    ivigResistanceRiskLabel,
    coronaryAneurysmClassification,
    coronaryAneurysmClassificationLabel,
    maxCoronaryZScore: maxZ,
    treatmentRegimen: {
      ivigDoseGrams,
      ivigInfusionInstructions,
      aspirinAcuteDoseMgDay,
      aspirinMaintenanceDoseMgDay,
    },
    recommendations,
    alerts,
  };
}
