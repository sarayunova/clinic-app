// Pure TypeScript calculation engine for Pediatric Slipped Capital Femoral Epiphysis (SCFE) & Loder Instability Protocol
// Guidelines: POSNA (Pediatric Orthopaedic Society of North America) / AAOS Clinical Practice Guidelines

export type LoderStability =
  | 'stable_able_to_ambulate'
  | 'unstable_cannot_bear_weight';

export type SouthwickSeverity =
  | 'mild_less_30_deg'
  | 'moderate_30_to_50_deg'
  | 'severe_greater_50_deg';

export type AffectedHip = 'right' | 'left' | 'bilateral';

export type ScfeSurgicalProcedure =
  | 'none_preoperative_traction'
  | 'in_situ_single_cannulated_screw'
  | 'two_screw_fixation'
  | 'open_modified_dunn_procedure'
  | 'contralateral_prophylactic_pinning_only';

export interface PediatricScfeParams {
  ageYears: number;
  weightKg: number;
  bmiPercentile: number;
  affectedHip: AffectedHip;
  loderStability: LoderStability;
  symptomDurationDays: number;
  southwickSlipAngleDegrees: number;
  kleinLineTrethowanAbnormal: boolean;
  referredKneeThighPain: boolean;
  endocrineDisorderSuspected: boolean;
  strictNonWeightBearingEnforced: boolean;
  surgicalProcedurePerformed: ScfeSurgicalProcedure;
  contralateralHipProphylacticPinning: boolean;
}

export interface PediatricScfeResult {
  loderClassificationLabel: string;
  isUnstableScfe: boolean;
  avascularNecrosisRiskPct: string;
  southwickSeverity: SouthwickSeverity;
  southwickSeverityLabel: string;
  isContralateralProphylacticPinningIndicated: boolean;
  contralateralPinningRationale: string;
  diagnosticKneePainPitfallAlert: boolean;
  preoperativeDirectives: string[];
  surgicalDirectives: string[];
  postoperativeMobilityDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_unstable_scfe' | 'urgent_stable_in_situ_fixation' | 'postop_non_weight_bearing_recovery';
  urgencyTierLabel: string;
}

export type PediatricScfeEvaluationResult = PediatricScfeResult;

export function evaluatePediatricScfe(params: PediatricScfeParams): PediatricScfeResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const preoperativeDirectives: string[] = [];
  const surgicalDirectives: string[] = [];
  const postoperativeMobilityDirectives: string[] = [];

  const isUnstableScfe = params.loderStability === 'unstable_cannot_bear_weight';

  // 1. Loder Classification & AVN Risk
  let loderClassificationLabel = '';
  let avascularNecrosisRiskPct = '';

  if (isUnstableScfe) {
    loderClassificationLabel = 'Unstable SCFE (Inability to Bear Weight Even with Crutches)';
    avascularNecrosisRiskPct = '40% – 50% Risk of Osteonecrosis / AVN';
    alerts.push('CRITICAL EMERGENCY: Unstable SCFE carries 40–50% risk of osteonecrosis of the femoral head. Immediate emergency orthopedic admission and strict bed rest.');
    alerts.push('DO NOT ATTEMPT CLOSED REDUCTION: Forced manipulative reduction causes severe kinking/shearing of the posterior-superior retinacular blood vessels supplying the epiphysis.');
  } else {
    loderClassificationLabel = 'Stable SCFE (Able to Ambulate / Bear Weight)';
    avascularNecrosisRiskPct = '< 2% Risk of Osteonecrosis / AVN';
    recommendations.push('Stable SCFE has excellent vascular preservation (< 2% AVN risk). Strict non-weight bearing until urgent in-situ fixation.');
  }

  // 2. Southwick Slip Angle Severity (Frog-Leg Lateral X-ray)
  let southwickSeverity: SouthwickSeverity = 'mild_less_30_deg';
  let southwickSeverityLabel = 'Mild Slip (< 30°)';

  const angle = params.southwickSlipAngleDegrees;
  if (angle > 50.0) {
    southwickSeverity = 'severe_greater_50_deg';
    southwickSeverityLabel = `Severe Slip (${angle}° > 50°)`;
    alerts.push(`Severe Southwick slip angle (${angle}°): High risk of femoroacetabular impingement (FAI) and premature osteoarthritis. In-situ single screw preferred over open correction unless specialized center.`);
  } else if (angle >= 30.0) {
    southwickSeverity = 'moderate_30_to_50_deg';
    southwickSeverityLabel = `Moderate Slip (${angle}°: 30°–50°)`;
    recommendations.push(`Moderate Southwick slip angle (${angle}°). In-situ single cannulated screw fixation indicated.`);
  } else {
    southwickSeverity = 'mild_less_30_deg';
    southwickSeverityLabel = `Mild Slip (${angle}° < 30°)`;
  }

  // 3. Trethowan Sign & Klein's Line
  if (params.kleinLineTrethowanAbnormal) {
    recommendations.push('Klein Line abnormality (Trethowan sign positive): Superior femoral neck line fails to intersect lateral femoral head epiphysis, confirming posteroinferior epiphyseal displacement.');
  }

  // 4. Referred Knee/Thigh Pain Pitfall
  let diagnosticKneePainPitfallAlert = false;
  if (params.referredKneeThighPain) {
    diagnosticKneePainPitfallAlert = true;
    alerts.push('DIAGNOSTIC PITFALL: Referred pain to distal thigh or knee (via obturator nerve) occurs in 25–50% of SCFE cases. Do not overlook the hip joint in any limping adolescent with knee complaints.');
  }

  // 5. Contralateral Prophylactic Pinning Evaluation
  let isContralateralProphylacticPinningIndicated = false;
  let contralateralPinningRationale = '';

  const isAtypicalAge = params.ageYears < 10.0 || params.ageYears > 15.0;
  if (params.endocrineDisorderSuspected || isAtypicalAge || params.affectedHip === 'bilateral') {
    isContralateralProphylacticPinningIndicated = true;
    contralateralPinningRationale = 'Strongly Indicated: Patient has atypical age (<10 or >15) or suspected endocrine disorder (hypothyroidism, GH deficiency, renal osteodystrophy) with up to 60-100% bilateral slip risk.';
    alerts.push('High risk for sequential bilateral slip: Prophylactic in-situ screw fixation of contralateral asymptomatic hip strongly recommended during same operative session.');
  } else {
    contralateralPinningRationale = 'Selective / Clinical Monitoring: Routine unilateral slip with normal endocrine profile. Regular radiographic follow-up of contralateral hip Q3-6 months until physeal closure.';
  }

  // 6. Preop, Surgical & Postop Directives
  if (!params.strictNonWeightBearingEnforced) {
    alerts.push('EMERGENCY VIOLATION: Patient is not currently on strict non-weight bearing. Immediate transfer to stretcher/wheelchair. Ambulation can convert stable to unstable slip or cause sudden displacement!');
  }

  preoperativeDirectives.push('Strict non-weight bearing with wheelchair or gurney transfers only. No weight bearing allowed on affected lower extremity.');
  preoperativeDirectives.push('Obtain AP pelvis and bilateral frog-leg lateral radiographs (or cross-table lateral if acute unstable slip to prevent epiphyseal displacement).');
  preoperativeDirectives.push('Screen for underlying endocrinopathy (serum TSH, free T4, calcium, phosphate, alkaline phosphatase, BUN/Creatinine) if age < 10 or BMI > 95th percentile.');

  surgicalDirectives.push('Treatment of choice: Emergent/urgent in-situ single central cannulated screw fixation (6.5–7.3 mm).');
  surgicalDirectives.push('Position screw perpendicular to the physis, entering the anterior-inferior femoral neck and terminating in the center of the femoral head.');
  surgicalDirectives.push('Ensure at least 4 to 5 threads engage across the physis with a 5 mm subchondral safety clearance (avoid chondrolysis / joint penetration).');

  postoperativeMobilityDirectives.push('Non-weight bearing or partial touch-down weight bearing with bilateral axillary crutches for 4 to 6 weeks postoperatively.');
  postoperativeMobilityDirectives.push('Serial AP pelvis radiographs at 6 weeks, 3 months, 6 months, and 12 months until documented complete physeal fusion.');

  // 7. Urgency Tier
  let urgencyTier: 'emergency_unstable_scfe' | 'urgent_stable_in_situ_fixation' | 'postop_non_weight_bearing_recovery' =
    'urgent_stable_in_situ_fixation';
  let urgencyTierLabel = 'Urgent In-Situ Screw Fixation';

  if (isUnstableScfe) {
    urgencyTier = 'emergency_unstable_scfe';
    urgencyTierLabel = 'EMERGENCY: Unstable SCFE (Urgent Operative Stabilization)';
  } else if (params.surgicalProcedurePerformed !== 'none_preoperative_traction') {
    urgencyTier = 'postop_non_weight_bearing_recovery';
    urgencyTierLabel = 'Postoperative Non-Weight Bearing Recovery';
  }

  return {
    loderClassificationLabel,
    isUnstableScfe,
    avascularNecrosisRiskPct,
    southwickSeverity,
    southwickSeverityLabel,
    isContralateralProphylacticPinningIndicated,
    contralateralPinningRationale,
    diagnosticKneePainPitfallAlert,
    preoperativeDirectives,
    surgicalDirectives,
    postoperativeMobilityDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
