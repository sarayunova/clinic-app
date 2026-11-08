// Pure TypeScript calculation engine for Neonatal Transient Tachypnea of the Newborn (TTN) & Delayed Lung Fluid Resorption Protocol
// Guidelines: AAP / European Consensus on Neonatal Respiratory Distress / Silverman-Anderson Score

export interface SilvermanAndersonInputs {
  chestRetractionUpper: number; // 0: synchronized, 1: lag on inspiration, 2: see-saw respiration
  chestRetractionLower: number; // 0: none, 1: just visible, 2: marked
  xiphoidRetraction: number;    // 0: none, 1: just visible, 2: marked
  nasalFlaring: number;         // 0: none, 1: minimal, 2: marked
  expiratoryGrunt: number;      // 0: none, 1: audible with stethoscope, 2: audible with unaided ear
}

export interface NeonatalTtnEvaluationParams {
  gestationalAgeWeeks: number;
  birthWeightKg: number;
  deliveryMode: 'elective_cesarean_no_labor' | 'emergency_cesarean_in_labor' | 'vaginal_spontaneous' | 'vaginal_instrumental';
  maternalDiabetes: boolean;
  maternalAsthma: boolean;
  maternalFluidOverload: boolean;
  initialRespiratoryRate: number;
  silvermanAndersonInputs: SilvermanAndersonInputs;
  cxrFindings: 'perihilar_streaking_sunburst' | 'fissural_fluid_line' | 'prominent_vascularity' | 'hyperaeration' | 'normal_or_equivocal' | 'ground_glass_rds_overlap';
  initialFio2Percent: number;
  respiratorySupportInitial: 'room_air' | 'nasal_cannula_low_flow' | 'hfnc' | 'bubble_cpap' | 'mechanical_ventilation';
  cpapPeepCmh2o?: number;
  feedingStatus?: 'npo_iv_fluids' | 'orogastric_gavage' | 'oral_breast_bottle';
  bloodGasPh?: number;
  bloodGasPco2?: number;
  bloodGasPao2?: number;
}

export interface NeonatalTtnEvaluationResult {
  silvermanAndersonScore: number;
  distressSeverity: 'mild_distress' | 'moderate_distress' | 'severe_respiratory_failure';
  distressSeverityLabel: string;
  feedingRecommendation: string;
  respiratorySupportGuidance: string;
  riskFactorSummary: string[];
  cxrInterpretation: string;
  isHighRiskEscalation: boolean;
  recommendations: string[];
  alerts: string[];
}

export function calculateSilvermanAndersonScore(inputs: SilvermanAndersonInputs): number {
  const clamp = (val: number) => Math.max(0, Math.min(2, Math.round(val || 0)));
  return (
    clamp(inputs.chestRetractionUpper) +
    clamp(inputs.chestRetractionLower) +
    clamp(inputs.xiphoidRetraction) +
    clamp(inputs.nasalFlaring) +
    clamp(inputs.expiratoryGrunt)
  );
}

export function evaluateNeonatalTtn(params: NeonatalTtnEvaluationParams): NeonatalTtnEvaluationResult {
  const silvermanScore = calculateSilvermanAndersonScore(params.silvermanAndersonInputs);
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const riskFactorSummary: string[] = [];

  // Severity classification
  let distressSeverity: 'mild_distress' | 'moderate_distress' | 'severe_respiratory_failure' = 'mild_distress';
  let distressSeverityLabel = 'Mild Respiratory Distress (Silverman 0-3)';

  if (silvermanScore >= 7 || params.initialRespiratoryRate >= 100) {
    distressSeverity = 'severe_respiratory_failure';
    distressSeverityLabel = 'Severe Respiratory Distress / Impending Failure (Silverman ≥7 or RR ≥100)';
    alerts.push('CRITICAL: High work of breathing with severe retractions or marked grunting. Risk of exhaustion.');
  } else if (silvermanScore >= 4 || params.initialRespiratoryRate >= 80) {
    distressSeverity = 'moderate_distress';
    distressSeverityLabel = 'Moderate Respiratory Distress (Silverman 4-6 or RR 80-99)';
    alerts.push('Moderate respiratory distress observed. Continuous cardiopulmonary and SpO2 monitoring required.');
  }

  // Risk factors
  if (params.deliveryMode === 'elective_cesarean_no_labor') {
    riskFactorSummary.push('Elective Cesarean delivery without labor (absence of catecholamine-induced ENaC lung fluid clearance)');
  } else if (params.deliveryMode === 'emergency_cesarean_in_labor') {
    riskFactorSummary.push('Emergency Cesarean delivery in labor');
  }

  if (params.maternalDiabetes) {
    riskFactorSummary.push('Maternal diabetes (delayed pulmonary maturation and surfactant delay)');
  }
  if (params.maternalAsthma) {
    riskFactorSummary.push('Maternal asthma history');
  }
  if (params.maternalFluidOverload) {
    riskFactorSummary.push('Maternal peripartum fluid overload');
  }

  if (params.gestationalAgeWeeks < 37) {
    riskFactorSummary.push(`Late preterm (${params.gestationalAgeWeeks} weeks) - heightened vulnerability to delayed fluid resorption`);
  }

  // CXR Interpretation
  let cxrInterpretation = 'Prominent vascularity or mild perihilar markings consistent with transient lung fluid retention.';
  if (params.cxrFindings === 'perihilar_streaking_sunburst') {
    cxrInterpretation = 'Classic perihilar linear streaking ("sunburst pattern") with interstitial fluid retention.';
  } else if (params.cxrFindings === 'fissural_fluid_line') {
    cxrInterpretation = 'Prominent fluid line within the interlobar horizontal fissure, typical of delayed resorption.';
  } else if (params.cxrFindings === 'hyperaeration') {
    cxrInterpretation = 'Hyperaerated lung fields with flat diaphragms (>8 posterior ribs visible).';
  } else if (params.cxrFindings === 'ground_glass_rds_overlap') {
    cxrInterpretation = 'WARNING: Reticulogranular ground-glass appearance with air bronchograms. Suggests RDS overlap rather than pure TTN.';
    alerts.push('CXR shows ground-glass / air bronchograms with RDS overlap. Evaluate for surfactant administration (INSURE/LISA) if FiO2 > 30-40%.');
  }

  // Feeding Recommendation based on RR
  let feedingRecommendation = '';
  if (params.initialRespiratoryRate > 80) {
    feedingRecommendation = 'Strict NPO with IV dextrose/electrolytes (60-80 mL/kg/day). Avoid all oral/gavage feeds to eliminate aspiration risk.';
    recommendations.push('Keep infant NPO while respiratory rate exceeds 80 breaths/min. Start IV maintenance fluid at 60 mL/kg/day D10W.');
  } else if (params.initialRespiratoryRate >= 60) {
    feedingRecommendation = 'Orogastric / nasogastric tube gavage feeding in small divided boluses. Avoid direct nipple/breast feeding.';
    recommendations.push('Gavage feeding indicated for RR 60-80 breaths/min. Pause feed if infant displays increased grunting or desaturation.');
  } else {
    feedingRecommendation = 'Oral feeding trial (breastfeeding or gentle paced bottle feeding) safe as respiratory rate is <60 breaths/min.';
    recommendations.push('Trial oral breast/bottle feeding with close SpO2 and vital signs supervision.');
  }

  // Respiratory Support Guidance
  let respiratorySupportGuidance = '';
  if (params.initialFio2Percent > 40 || params.initialRespiratoryRate >= 80 || silvermanScore >= 5) {
    respiratorySupportGuidance = 'Bubble CPAP 5-6 cmH2O with heated humidification. Titrate FiO2 to maintain pre-ductal SpO2 90-95%.';
    recommendations.push('Apply nasal CPAP 5-6 cmH2O to promote alveolar fluid clearance and functional residual capacity.');
  } else if (params.initialFio2Percent > 21 || silvermanScore >= 3) {
    respiratorySupportGuidance = 'Low-flow nasal cannula (0.5-2 L/min) or humidified high flow (HFNC) titrated to maintain SpO2 91-95%.';
    recommendations.push('Low-flow nasal cannula or HFNC supportive oxygenation with regular weaning trials.');
  } else {
    respiratorySupportGuidance = 'Room air observation in thermal neutral environment with continuous pulse oximetry.';
    recommendations.push('Maintain neutral thermal environment (incubator or radiant warmer). Avoid excessive handling.');
  }

  // Blood gas evaluation
  if (params.bloodGasPco2 && params.bloodGasPco2 > 55) {
    alerts.push(`Hypercapnia detected (pCO2 ${params.bloodGasPco2} mmHg). Assess for respiratory muscle fatigue or hypoventilation.`);
  }
  if (params.bloodGasPh && params.bloodGasPh < 7.25) {
    alerts.push(`Acidemia (pH ${params.bloodGasPh}). Check lactic acid and perfusion; rule out secondary sepsis or worsening distress.`);
  }

  // High risk escalation criteria
  const isHighRiskEscalation =
    params.initialFio2Percent >= 40 ||
    silvermanScore >= 7 ||
    params.cxrFindings === 'ground_glass_rds_overlap' ||
    (params.bloodGasPh !== undefined && params.bloodGasPh < 7.25);

  if (isHighRiskEscalation) {
    recommendations.push('Plan urgent echocardiography to rule out persistent pulmonary hypertension (PPHN) or congenital heart disease if oxygen requirement escalates.');
    recommendations.push('Obtain blood cultures and initiate empiric IV ampicillin + gentamicin if sepsis or congenital pneumonia cannot be excluded.');
  }

  return {
    silvermanAndersonScore: silvermanScore,
    distressSeverity,
    distressSeverityLabel,
    feedingRecommendation,
    respiratorySupportGuidance,
    riskFactorSummary,
    cxrInterpretation,
    isHighRiskEscalation,
    recommendations,
    alerts
  };
}
