// Pure TypeScript calculation engine for Pediatric Acute Hematogenous Osteomyelitis (AHO) & Subperiosteal Abscess Protocol
// Guidelines: AAP / PIDS / IDSA / ESPID Clinical Practice Guidelines

export type BoneInvolved =
  | 'distal_femur'
  | 'proximal_tibia'
  | 'distal_tibia'
  | 'proximal_humerus'
  | 'fibula'
  | 'radius_ulna'
  | 'pelvis'
  | 'other_bone';

export type Laterality = 'right' | 'left' | 'bilateral';

export type ImagingModalityConfirmatory =
  | 'ultrasound_subperiosteal_fluid'
  | 'mri_with_contrast'
  | 'plain_radiograph_lytic_changes'
  | 'ct_scan';

export type SurgicalProcedure =
  | 'none_medical_management'
  | 'percutaneous_needle_aspiration'
  | 'cortical_fenestration_and_drainage'
  | 'extensive_debridement_sequestrectomy';

export type IsolatedPathogen =
  | 'staphylococcus_aureus_mssa'
  | 'staphylococcus_aureus_mrsa'
  | 'streptococcus_pyogenes_group_a'
  | 'kingella_kingae'
  | 'pseudomonas_aeruginosa'
  | 'culture_negative_clinical_aho';

export type CurrentAntibioticRegimen =
  | 'iv_cefazolin'
  | 'iv_vancomycin'
  | 'iv_clindamycin'
  | 'iv_ceftriaxone'
  | 'oral_cephalexin'
  | 'oral_clindamycin'
  | 'oral_amoxicillin_clavulanate';

export interface PediatricOsteomyelitisParams {
  ageYears: number;
  weightKg: number;
  boneInvolved: BoneInvolved;
  laterality: Laterality;
  kocherFeverGt385: boolean;
  kocherNonWeightBearing: boolean;
  kocherEsrGt40: boolean;
  kocherWbcGt12k: boolean;
  crpAdmissionMgL: number;
  crpPeakMgL: number;
  subperiostealAbscessPresent: boolean;
  abscessSizeDepthMm: number;
  imagingModalityConfirmatory: ImagingModalityConfirmatory;
  surgicalDecompressionPerformed: boolean;
  surgicalProcedure: SurgicalProcedure;
  isolatedPathogen: IsolatedPathogen;
  currentAntibioticRegimen: CurrentAntibioticRegimen;
  oralSwitchCriteriaMet: boolean;
  currentCrpMgL?: number;
  currentTemperatureCelsius?: number;
}

export interface PediatricOsteomyelitisResult {
  kocherScore: number;
  kocherRiskCategory: string;
  septicArthritisCoexistenceProbability: string;
  isSurgicalDecompressionIndicated: boolean;
  subperiostealAbscessSeverity: 'none' | 'small_drainable_borderline' | 'large_surgical_abscess';
  subperiostealAbscessSeverityLabel: string;
  crpDeclinePercent: number | null;
  isOralSwitchEligible: boolean;
  oralSwitchEvaluation: string;
  targetedAntibioticRecommendation: string;
  surgicalDirectives: string[];
  monitoringDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_surgical_decompression' | 'urgent_inpatient_parenteral_therapy' | 'step_down_oral_recovery';
  urgencyTierLabel: string;
}

export type PediatricOsteomyelitisEvaluationResult = PediatricOsteomyelitisResult;

export function evaluatePediatricOsteomyelitis(
  params: PediatricOsteomyelitisParams
): PediatricOsteomyelitisResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const surgicalDirectives: string[] = [];
  const monitoringDirectives: string[] = [];

  // 1. Kocher Criteria Scoring (0 to 4)
  let kocherScore = 0;
  if (params.kocherFeverGt385) kocherScore++;
  if (params.kocherNonWeightBearing) kocherScore++;
  if (params.kocherEsrGt40) kocherScore++;
  if (params.kocherWbcGt12k) kocherScore++;

  let kocherRiskCategory = '';
  let septicArthritisCoexistenceProbability = '';

  if (kocherScore === 4) {
    kocherRiskCategory = 'High Risk (Score 4/4)';
    septicArthritisCoexistenceProbability = '~99% probability of concurrent septic arthritis if joint is effused';
    alerts.push('Kocher Score 4/4: Extremely high probability of septic arthritis. Examine adjacent joint closely (hip/knee) and consider emergency joint arthrocentesis.');
  } else if (kocherScore === 3) {
    kocherRiskCategory = 'Moderate-High Risk (Score 3/4)';
    septicArthritisCoexistenceProbability = '~93% probability of concurrent septic arthritis';
    alerts.push('Kocher Score 3/4: High risk of contiguous joint infection. Obtain ultrasound of adjacent joint.');
  } else if (kocherScore === 2) {
    kocherRiskCategory = 'Moderate Risk (Score 2/4)';
    septicArthritisCoexistenceProbability = '~40% probability of septic arthritis';
    recommendations.push('Kocher Score 2/4: Moderate risk of septic arthritis. Monitor joint effusion closely.');
  } else if (kocherScore === 1) {
    kocherRiskCategory = 'Low Risk (Score 1/4)';
    septicArthritisCoexistenceProbability = '~3% probability of septic arthritis';
  } else {
    kocherRiskCategory = 'Very Low Risk (Score 0/4)';
    septicArthritisCoexistenceProbability = '< 0.2% probability of septic arthritis';
  }

  // 2. Subperiosteal Abscess & Surgical Indications
  let subperiostealAbscessSeverity: 'none' | 'small_drainable_borderline' | 'large_surgical_abscess' = 'none';
  let subperiostealAbscessSeverityLabel = 'No Subperiosteal Abscess';
  let isSurgicalDecompressionIndicated = false;

  if (params.subperiostealAbscessPresent) {
    if (params.abscessSizeDepthMm >= 3.0) {
      subperiostealAbscessSeverity = 'large_surgical_abscess';
      subperiostealAbscessSeverityLabel = `Significant Subperiosteal Abscess (${params.abscessSizeDepthMm} mm >= 3 mm threshold)`;
      isSurgicalDecompressionIndicated = true;
      alerts.push(`URGENT SURGICAL INDICATION: Subperiosteal fluid depth ${params.abscessSizeDepthMm} mm exceeds 3 mm threshold. Cortical fenestration and I&D indicated.`);
      surgicalDirectives.push('Orthopedic surgery consult for urgent subperiosteal drainage and cortical bone fenestration.');
      surgicalDirectives.push('Send subperiosteal pus and bone marrow aspirate for Gram stain, aerobic/anaerobic cultures, and universal 16S PCR.');
    } else {
      subperiostealAbscessSeverity = 'small_drainable_borderline';
      subperiostealAbscessSeverityLabel = `Borderline Fluid Layer (${params.abscessSizeDepthMm} mm < 3 mm)`;
      recommendations.push('Small subperiosteal fluid layer (< 3 mm): Can attempt 24-48h trial of tailored IV antibiotics with close serial ultrasound.');
    }
  }

  // 3. CRP Kinetics & Oral Step-Down Switch Eligibility
  let crpDeclinePercent: number | null = null;
  const currentCrp = params.currentCrpMgL ?? params.crpAdmissionMgL;
  if (params.crpPeakMgL > 0 && currentCrp !== undefined) {
    crpDeclinePercent = Math.max(0, Math.round(((params.crpPeakMgL - currentCrp) / params.crpPeakMgL) * 100));
  }

  const isAfebrile = params.currentTemperatureCelsius !== undefined ? params.currentTemperatureCelsius < 38.0 : !params.kocherFeverGt385;
  const isCrpLysisSufficient = crpDeclinePercent !== null && crpDeclinePercent >= 30;
  const isOralSwitchEligible =
    isAfebrile &&
    isCrpLysisSufficient &&
    !params.subperiostealAbscessPresent &&
    params.isolatedPathogen !== 'culture_negative_clinical_aho' &&
    params.oralSwitchCriteriaMet;

  let oralSwitchEvaluation = '';
  if (isOralSwitchEligible) {
    oralSwitchEvaluation = `Eligible for Oral Step-Down: Patient is afebrile with ${crpDeclinePercent}% CRP reduction from peak and resolving clinical signs.`;
    recommendations.push('Meets evidence-based criteria for transition from IV to high-dose oral antistaphylococcal therapy.');
  } else {
    const reasons: string[] = [];
    if (!isAfebrile) reasons.push('persistent fever');
    if (!isCrpLysisSufficient) reasons.push(`insufficient CRP decline (${crpDeclinePercent ?? 0}% vs >= 30% target)`);
    if (params.subperiostealAbscessPresent && !params.surgicalDecompressionPerformed) reasons.push('un-drained subperiosteal collection');
    oralSwitchEvaluation = `Not yet eligible for oral step-down due to: ${reasons.join(', ') || 'ongoing initial parenteral phase'}.`;
  }

  // 4. Targeted Antimicrobial Recommendations
  let targetedAntibioticRecommendation = '';
  if (params.isolatedPathogen === 'staphylococcus_aureus_mssa') {
    targetedAntibioticRecommendation = 'MSSA: IV Cefazolin (100-150 mg/kg/day q8h) -> Step-down to Oral Cephalexin (100-150 mg/kg/day divided q6-8h, max 4g/day).';
  } else if (params.isolatedPathogen === 'staphylococcus_aureus_mrsa') {
    targetedAntibioticRecommendation = 'CA-MRSA: IV Vancomycin (targeted trough 10-15 mcg/mL) or IV Clindamycin (40 mg/kg/day) -> Step-down to Oral Clindamycin (30-40 mg/kg/day q8h if D-test negative).';
  } else if (params.isolatedPathogen === 'kingella_kingae') {
    targetedAntibioticRecommendation = 'Kingella kingae (common in < 4yo): IV Ceftriaxone (50 mg/kg/day) or Ampicillin -> Step-down to Oral Amoxicillin-Clavulanate (80-90 mg/kg/day amox component).';
  } else if (params.isolatedPathogen === 'streptococcus_pyogenes_group_a') {
    targetedAntibioticRecommendation = 'GAS (S. pyogenes): IV Cefazolin or Ampicillin -> Step-down to Oral Amoxicillin (50-75 mg/kg/day) or Cephalexin.';
  } else {
    targetedAntibioticRecommendation = 'Empiric Coverage: IV Cefazolin 100-150 mg/kg/day (add Vancomycin or Clindamycin if local MRSA prevalence exceeds 10-15%).';
  }

  // 5. Monitoring Directives
  monitoringDirectives.push('Obtain baseline CRP and ESR; follow CRP every 48-72 hours until sustained downtrend confirmed.');
  monitoringDirectives.push('Limb immobilization with splint in position of comfort during acute painful phase.');
  monitoringDirectives.push('Total duration of therapy: Minimum 3 to 4 weeks for uncomplicated AHO; extend to 6 weeks if significant subperiosteal abscess or MRSA.');

  // 6. Urgency Tier
  let urgencyTier: 'emergency_surgical_decompression' | 'urgent_inpatient_parenteral_therapy' | 'step_down_oral_recovery' =
    'urgent_inpatient_parenteral_therapy';
  let urgencyTierLabel = 'Urgent Inpatient Parenteral Therapy';

  if (isSurgicalDecompressionIndicated && !params.surgicalDecompressionPerformed) {
    urgencyTier = 'emergency_surgical_decompression';
    urgencyTierLabel = 'EMERGENCY: Surgical Bone Fenestration / Drainage Indicated';
  } else if (isOralSwitchEligible) {
    urgencyTier = 'step_down_oral_recovery';
    urgencyTierLabel = 'Step-Down Oral Antimicrobial Recovery';
  }

  return {
    kocherScore,
    kocherRiskCategory,
    septicArthritisCoexistenceProbability,
    isSurgicalDecompressionIndicated,
    subperiostealAbscessSeverity,
    subperiostealAbscessSeverityLabel,
    crpDeclinePercent,
    isOralSwitchEligible,
    oralSwitchEvaluation,
    targetedAntibioticRecommendation,
    surgicalDirectives,
    monitoringDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
