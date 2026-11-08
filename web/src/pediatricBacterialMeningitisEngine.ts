// Pure TypeScript calculation engine for Pediatric Bacterial Meningitis & Nigrovic Bacterial Meningitis Score (BMS) Protocol
// Guidelines: Nigrovic et al. (JAMA / Pediatrics), IDSA / AAP Meningitis Guidance

export interface PediatricBacterialMeningitisEvaluationParams {
  ageMonths: number;
  weightKg: number;
  priorAntibioticExposure72h: boolean;
  seizureAtPresentation: boolean;
  gcsScore: number;
  kernigBrudzinskiSign: boolean;
  fontanelleBulging: boolean;
  purpuricRash: boolean;
  csfWbcCount: number; // cells/mm3
  csfNeutrophilPercent: number; // 0 to 100
  csfProteinMgDl: number; // mg/dL
  csfGlucoseMgDl: number; // mg/dL
  bloodGlucoseMgDl: number; // mg/dL
  csfGramStainPositive: boolean;
  csfGramStainOrganism: 'none_seen' | 'gram_positive_cocci_pairs' | 'gram_negative_diplococci' | 'gram_negative_bacilli' | 'other';
  peripheralWbc: number; // x 10^3/uL or /mm3
  peripheralAnc: number; // cells/mm3
}

export interface NigrovicBmsBreakdown {
  positiveGramStainScore: number; // 0 or 2
  csfProteinScore: number; // 0 or 1 (if >= 80 mg/dL)
  peripheralAncScore: number; // 0 or 1 (if >= 10,000 cells/mm3)
  seizureScore: number; // 0 or 1
  csfAncScore: number; // 0 or 1 (if >= 1000 cells/mm3)
  totalBmsScore: number; // 0 to 6
}

export interface PediatricBacterialMeningitisEvaluationResult {
  csfAncCalculated: number;
  csfToBloodGlucoseRatio: number;
  bmsBreakdown: NigrovicBmsBreakdown;
  riskTier: 'very_low_risk' | 'high_risk';
  riskTierLabel: string;
  isPriorAntibioticsConfounder: boolean;
  antibioticRecommendations: {
    ceftriaxoneDoseMg: number;
    vancomycinDoseMg: number;
    ampicillinDoseMg?: number;
    dexamethasoneDoseMg: number;
    guidelines: string[];
  };
  raisedIcpAlert: boolean;
  dropletIsolationRequired: boolean;
  recommendations: string[];
  alerts: string[];
}

export function calculateNigrovicBmsScore(params: {
  csfGramStainPositive: boolean;
  csfProteinMgDl: number;
  peripheralAnc: number;
  seizureAtPresentation: boolean;
  csfAncCalculated: number;
}): NigrovicBmsBreakdown {
  const positiveGramStainScore = params.csfGramStainPositive ? 2 : 0;
  const csfProteinScore = params.csfProteinMgDl >= 80 ? 1 : 0;
  const peripheralAncScore = params.peripheralAnc >= 10000 ? 1 : 0;
  const seizureScore = params.seizureAtPresentation ? 1 : 0;
  const csfAncScore = params.csfAncCalculated >= 1000 ? 1 : 0;

  const totalBmsScore =
    positiveGramStainScore +
    csfProteinScore +
    peripheralAncScore +
    seizureScore +
    csfAncScore;

  return {
    positiveGramStainScore,
    csfProteinScore,
    peripheralAncScore,
    seizureScore,
    csfAncScore,
    totalBmsScore
  };
}

export function evaluatePediatricBacterialMeningitis(
  params: PediatricBacterialMeningitisEvaluationParams
): PediatricBacterialMeningitisEvaluationResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];

  // Calculate CSF ANC: (CSF WBC * % Neutrophils) / 100
  const csfAncCalculated = Math.round((params.csfWbcCount * (params.csfNeutrophilPercent || 0)) / 100);

  // Calculate CSF to Blood Glucose Ratio
  const csfToBloodGlucoseRatio =
    params.bloodGlucoseMgDl > 0
      ? Number((params.csfGlucoseMgDl / params.bloodGlucoseMgDl).toFixed(2))
      : 0;

  // Calculate Nigrovic BMS Score
  const bmsBreakdown = calculateNigrovicBmsScore({
    csfGramStainPositive: params.csfGramStainPositive,
    csfProteinMgDl: params.csfProteinMgDl,
    peripheralAnc: params.peripheralAnc,
    seizureAtPresentation: params.seizureAtPresentation,
    csfAncCalculated
  });

  const isPriorAntibioticsConfounder = Boolean(params.priorAntibioticExposure72h);

  // Risk stratification
  let riskTier: 'very_low_risk' | 'high_risk' = 'very_low_risk';
  let riskTierLabel = 'Very Low Risk for Bacterial Meningitis (BMS = 0)';

  if (bmsBreakdown.totalBmsScore >= 1 || isPriorAntibioticsConfounder) {
    riskTier = 'high_risk';
    riskTierLabel = isPriorAntibioticsConfounder && bmsBreakdown.totalBmsScore === 0
      ? 'High Clinical Suspicion (BMS 0 but Prior Antibiotic Pretreatment Confounder)'
      : `High Risk for Bacterial Meningitis (Nigrovic BMS = ${bmsBreakdown.totalBmsScore}/6)`;
  }

  // Weight-based dosing calculations
  const weight = Math.max(1, params.weightKg || 10);
  // Ceftriaxone 100 mg/kg/day divided Q12H (max 4000 mg/day)
  const ceftriaxoneDaily = Math.min(4000, Math.round(weight * 100));
  const ceftriaxoneDoseMg = Math.round(ceftriaxoneDaily / 2); // per dose Q12H

  // Vancomycin 60 mg/kg/day divided Q6H (max 2000 mg/day)
  const vancomycinDaily = Math.min(2000, Math.round(weight * 60));
  const vancomycinDoseMg = Math.round(vancomycinDaily / 4); // per dose Q6H

  // Dexamethasone 0.15 mg/kg IV Q6H (max 10 mg/dose)
  const dexamethasoneDoseMg = Number(Math.min(10, weight * 0.15).toFixed(2));

  // Ampicillin for < 3 months or immunocompromised (200-300 mg/kg/day Q6H)
  let ampicillinDoseMg: number | undefined;
  if (params.ageMonths < 3) {
    const ampicillinDaily = Math.min(12000, Math.round(weight * 300));
    ampicillinDoseMg = Math.round(ampicillinDaily / 4);
  }

  // Raised ICP & meningeal checks
  const raisedIcpAlert =
    params.gcsScore <= 12 ||
    params.fontanelleBulging ||
    params.seizureAtPresentation;

  if (raisedIcpAlert) {
    alerts.push('CRITICAL: Signs of raised intracranial pressure / depressed sensorium (GCS ≤12, bulging fontanelle, or seizure). Postpone lumbar puncture if neuro-instability present; initiate antibiotics immediately.');
  }

  if (params.purpuricRash) {
    alerts.push('EMERGENCY: Purpuric / petechial rash identified. High suspicion for invasive meningococcemia (Neisseria meningitidis). Immediate droplet isolation and resuscitation.');
  }

  if (csfToBloodGlucoseRatio < 0.40) {
    alerts.push(`Marked hypoglycorrhachia (CSF:Blood Glucose ratio ${csfToBloodGlucoseRatio} < 0.40). Strongly pathognomonic for bacterial or fungal utilization.`);
  }

  if (isPriorAntibioticsConfounder) {
    alerts.push('CAUTION: Systemic antibiotics within prior 72 hours. BMS score cannot safely rule out bacterial meningitis due to partial sterilization.');
  }

  const dropletIsolationRequired =
    params.csfGramStainOrganism === 'gram_negative_diplococci' ||
    params.purpuricRash ||
    riskTier === 'high_risk';

  // Recommendations formulation
  const antibioticGuidelines: string[] = [];

  if (riskTier === 'high_risk') {
    recommendations.push(`Initiate empiric IV Ceftriaxone ${ceftriaxoneDoseMg} mg IV Q12H without delay.`);
    recommendations.push(`Initiate empiric IV Vancomycin ${vancomycinDoseMg} mg IV Q6H (target trough 15-20 mcg/mL).`);
    antibioticGuidelines.push(`Ceftriaxone: ${ceftriaxoneDoseMg} mg IV every 12 hours (total ${ceftriaxoneDaily} mg/day).`);
    antibioticGuidelines.push(`Vancomycin: ${vancomycinDoseMg} mg IV every 6 hours (total ${vancomycinDaily} mg/day).`);

    if (ampicillinDoseMg) {
      recommendations.push(`Add Ampicillin ${ampicillinDoseMg} mg IV Q6H to cover Listeria monocytogenes in infant under 3 months.`);
      antibioticGuidelines.push(`Ampicillin: ${ampicillinDoseMg} mg IV every 6 hours for age < 3 months.`);
    }

    recommendations.push(`Administer IV Dexamethasone ${dexamethasoneDoseMg} mg (0.15 mg/kg) prior to or with the first dose of antibiotics to mitigate neuro-inflammatory sequelae.`);
    antibioticGuidelines.push(`Dexamethasone: ${dexamethasoneDoseMg} mg IV Q6H for 2-4 days (administer 10-20 min before or with first antibiotic dose).`);

    if (dropletIsolationRequired) {
      recommendations.push('Maintain strict Droplet Precautions until patient has received 24 hours of effective antimicrobial therapy.');
    }
  } else {
    recommendations.push('Nigrovic BMS = 0: Patient meets criteria for very low risk (<0.1%) of bacterial meningitis.');
    recommendations.push('Consider aseptic / enteroviral meningitis or viral syndrome. Avoid unnecessary prolonged broad-spectrum antibiotics if clinically improving.');
    recommendations.push('Send CSF enterovirus / HSV multiplex PCR and monitor clinically on short-stay unit.');
  }

  return {
    csfAncCalculated,
    csfToBloodGlucoseRatio,
    bmsBreakdown,
    riskTier,
    riskTierLabel,
    isPriorAntibioticsConfounder,
    antibioticRecommendations: {
      ceftriaxoneDoseMg,
      vancomycinDoseMg,
      ampicillinDoseMg,
      dexamethasoneDoseMg,
      guidelines: antibioticGuidelines
    },
    raisedIcpAlert,
    dropletIsolationRequired,
    recommendations,
    alerts
  };
}
