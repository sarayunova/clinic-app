// Pure TypeScript calculation engine for Neonatal Congenital Diaphragmatic Hernia (CDH) & Gentle Ventilation Protocol
// Guidelines: AAP / CDH EURO Consortium Consensus Guidelines

export type CdhDefectSide =
  | 'left_bochdalek'
  | 'right_bochdalek'
  | 'bilateral_bochdalek'
  | 'anterior_morgagni';

export type HypoplasiaSeverity =
  | 'extreme_severe'
  | 'moderate'
  | 'mild';

export type CdhSurgicalRepairStatus =
  | 'preop_physiological_stabilization'
  | 'ready_for_repair_criteria_met'
  | 'primary_repair_performed'
  | 'prosthetic_patch_repair_performed'
  | 'ecmo_cannulated_bridge';

export interface NeonatalCdhParams {
  defectSide: CdhDefectSide;
  liverHerniationUp: boolean;
  observedExpectedLhrPercent: number;
  bagMaskAvoidedInDeliveryRoom: boolean;
  replogleSumpDecompressionActive: boolean;
  preductalSpo2Percent: number;
  postductalSpo2Percent: number;
  peakInspiratoryPressureCmh2o: number;
  peepCmh2o: number;
  paco2Mmhg: number;
  inhaledNitricOxideActive: boolean;
  sildenafilInfusionActive: boolean;
  surgicalRepairStatus: CdhSurgicalRepairStatus;
}

export interface NeonatalCdhResult {
  hypoplasiaSeverity: HypoplasiaSeverity;
  hypoplasiaSeverityLabel: string;
  isLiverUp: boolean;
  ductalGradientPercent: number;
  hasSignificantPphnShunt: boolean;
  isGentleVentilationCompliant: boolean;
  isPermissiveHypercapniaAchieved: boolean;
  isPhysiologicallyReadyForSurgery: boolean;
  readinessCriteriaStatus: string;
  deliveryRoomDirectives: string[];
  gentleVentilationDirectives: string[];
  pulmonaryHypertensionDirectives: string[];
  surgicalRepairDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_pulmonary_hypertension_or_barotrauma' | 'urgent_stabilization_gentle_ventilation' | 'postop_ventilatory_weaning';
  urgencyTierLabel: string;
}

export type NeonatalCdhEvaluationResult = NeonatalCdhResult;

export function evaluateNeonatalCdh(params: NeonatalCdhParams): NeonatalCdhResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const deliveryRoomDirectives: string[] = [];
  const gentleVentilationDirectives: string[] = [];
  const pulmonaryHypertensionDirectives: string[] = [];
  const surgicalRepairDirectives: string[] = [];

  // 1. Pulmonary Hypoplasia Stratification (Observed-to-Expected LHR %)
  let hypoplasiaSeverity: HypoplasiaSeverity = 'mild';
  let hypoplasiaSeverityLabel = 'Mild Hypoplasia (o/e LHR > 35%)';

  const lhr = params.observedExpectedLhrPercent;
  if (lhr < 25.0) {
    hypoplasiaSeverity = 'extreme_severe';
    hypoplasiaSeverityLabel = `Extreme/Severe Hypoplasia (o/e LHR ${lhr}% < 25%)`;
    alerts.push(`CRITICAL PULMONARY HYPOPLASIA: o/e LHR is ${lhr}%. Predicted survival < 30–50% without ECMO/advanced respiratory support. Significant bronchial branching arrest.`);
  } else if (lhr <= 35.0) {
    hypoplasiaSeverity = 'moderate';
    hypoplasiaSeverityLabel = `Moderate Hypoplasia (o/e LHR ${lhr}%: 25–35%)`;
    recommendations.push(`Moderate pulmonary hypoplasia (o/e LHR ${lhr}%): High likelihood of prolonged mechanical ventilation and pulmonary hypertension.`);
  } else {
    hypoplasiaSeverityLabel = `Mild Hypoplasia (o/e LHR ${lhr}% > 35%)`;
  }

  // 2. Liver Herniation ("Liver-Up") Assessment
  const isLiverUp = params.liverHerniationUp;
  if (isLiverUp) {
    alerts.push('INTRATHORACIC LIVER HERNIATION (Liver-Up): Associated with severe pulmonary vascular remodeling, decreased lung volume, and 75%+ likelihood of prosthetic Gore-Tex patch closure.');
  }

  // 3. Ductal Saturation Gradient & PPHN Shunting
  const ductalGradientPercent = Math.max(0, params.preductalSpo2Percent - params.postductalSpo2Percent);
  const hasSignificantPphnShunt = ductalGradientPercent >= 10;
  if (hasSignificantPphnShunt) {
    alerts.push(`SEVERE RIGHT-TO-LEFT DUCTAL SHUNT: Pre/post-ductal SpO2 gradient of ${ductalGradientPercent}% (pre: ${params.preductalSpo2Percent}%, post: ${params.postductalSpo2Percent}%) demonstrates suprasystemic pulmonary artery pressure.`);
  }

  // 4. Delivery Room Airway Directives
  if (!params.bagMaskAvoidedInDeliveryRoom) {
    alerts.push('CATASTROPHIC VIOLATION: Bag-mask ventilation is strictly contraindicated in CDH! Acute gastric distension rapidly causes contralateral tension lung collapse and cardiac arrest.');
  } else {
    deliveryRoomDirectives.push('Immediate endotracheal intubation at birth without prior bag-valve-mask ventilation.');
  }

  if (params.replogleSumpDecompressionActive) {
    deliveryRoomDirectives.push('Replogle 10 Fr double-lumen orogastric tube placed on continuous low suction (-20 to -30 mmHg) to decompress herniated bowel and stomach.');
  } else {
    alerts.push('URGENT: Insert Replogle 10 Fr continuous low-suction sump tube immediately to prevent visceral distension.');
  }

  // 5. Gentle Ventilation Compliance
  const isGentleVentilationCompliant = params.peakInspiratoryPressureCmh2o < 25.0;
  if (!isGentleVentilationCompliant) {
    alerts.push(`BAROTRAUMA ALERT: Peak Inspiratory Pressure (PIP) is ${params.peakInspiratoryPressureCmh2o} cmH2O (target < 25 cmH2O). High risk of contralateral lung volutrauma/pneumothorax!`);
  }

  const isPermissiveHypercapniaAchieved = params.paco2Mmhg >= 50.0 && params.paco2Mmhg <= 70.0;

  gentleVentilationDirectives.push('Gentle ventilation strategy: Pressure-limited ventilation targeting PIP < 25 cmH2O, PEEP 4–5 cmH2O, and ventilator rate 40–60 breaths/min.');
  gentleVentilationDirectives.push('Target preductal SpO2 85%–95% (avoid hyperoxia FiO2 1.0 which causes free radical injury; keep postductal SpO2 > 80%).');
  gentleVentilationDirectives.push('Permissive hypercapnia: Tolerate PaCO2 50–70 mmHg provided arterial pH remains ≥ 7.20.');
  gentleVentilationDirectives.push('If PIP > 25 cmH2O required to maintain pH > 7.20, switch promptly to High-Frequency Oscillatory Ventilation (HFOV) with MAP 12–15 cmH2O.');

  // 6. Pulmonary Hypertension & Hemodynamic Support Directives
  if (params.inhaledNitricOxideActive) {
    pulmonaryHypertensionDirectives.push('Inhaled Nitric Oxide (iNO) initiated at 10–20 ppm: Monitor for selective pulmonary vasodilation without systemic hypotension.');
    pulmonaryHypertensionDirectives.push('Perform bedside echocardiography to assess left ventricular function (iNO is contraindicated if severe LV hypoplasia / systolic dysfunction).');
  } else if (hasSignificantPphnShunt) {
    pulmonaryHypertensionDirectives.push('Consider trial of inhaled Nitric Oxide (iNO 10–20 ppm) if documented suprasystemic pulmonary pressures and adequate LV function on ECHO.');
  }

  if (params.sildenafilInfusionActive) {
    pulmonaryHypertensionDirectives.push('Continuous IV Sildenafil infusion titrated to decrease pulmonary vascular resistance and support weaning from iNO.');
  }

  pulmonaryHypertensionDirectives.push('Maintain systemic blood pressure: Mean Arterial Pressure (MAP) target ≥ normal for gestational age (Milrinone for RV afterload reduction + Dobutamine/Norepinephrine for inotropic support).');

  // 7. Physiological Criteria for Delayed Surgical Repair
  const readyMap = true; // Assumed monitored
  const readyLactate = true; // Monitored in flowsheet
  const readySpO2 = params.postductalSpo2Percent >= 85;
  const readyPip = params.peakInspiratoryPressureCmh2o < 25.0;
  const readyGradient = ductalGradientPercent < 10;

  const isPhysiologicallyReadyForSurgery = readySpO2 && readyPip && readyGradient;
  let readinessCriteriaStatus = '';

  if (isPhysiologicallyReadyForSurgery) {
    readinessCriteriaStatus = 'CRITERIA MET: Patient is hemodynamically stable, pulmonary pressures are sub-systemic, and gentle ventilation is maintained. Eligible for surgical repair.';
    recommendations.push('Physiological criteria for surgical repair achieved: Plan laparotomy/thoracoscopy under pediatric surgical team.');
  } else {
    readinessCriteriaStatus = 'NOT READY: Active pulmonary hypertension crisis or high ventilatory pressures. Delay surgical repair until PVR declines (surgery during pulmonary crisis markedly increases mortality).';
  }

  // Surgical Technique Directives
  surgicalRepairDirectives.push('Delayed surgical repair is mandatory: Stabilize for 24–48 hours until pulmonary vascular resistance falls; emergency repair in the first 24h is contraindicated.');
  surgicalRepairDirectives.push('Primary closure of diaphragmatic defect if tension-free approximation is achievable without compromising vena cava / thoracic cavity.');
  surgicalRepairDirectives.push('Prosthetic dual-layer Gore-Tex / Dacron cone patch closure indicated if defect > 30% or tension on inferior vena cava occurs.');
  surgicalRepairDirectives.push('Strictly avoid chest tube on herniated side unless tension pneumothorax develops; underwater seal can cause rapid mediastinal shift.');

  // 8. Urgency Tier
  let urgencyTier: 'emergency_pulmonary_hypertension_or_barotrauma' | 'urgent_stabilization_gentle_ventilation' | 'postop_ventilatory_weaning' =
    'urgent_stabilization_gentle_ventilation';
  let urgencyTierLabel = 'Urgent Stabilization & Gentle Ventilation';

  if (!isGentleVentilationCompliant || hasSignificantPphnShunt || !params.bagMaskAvoidedInDeliveryRoom) {
    urgencyTier = 'emergency_pulmonary_hypertension_or_barotrauma';
    urgencyTierLabel = 'EMERGENCY: Pulmonary Hypertension Crisis / Barotrauma Risk';
  } else if (
    params.surgicalRepairStatus === 'primary_repair_performed' ||
    params.surgicalRepairStatus === 'prosthetic_patch_repair_performed'
  ) {
    urgencyTier = 'postop_ventilatory_weaning';
    urgencyTierLabel = 'Postoperative Ventilatory & Cardiorespiratory Weaning';
  }

  return {
    hypoplasiaSeverity,
    hypoplasiaSeverityLabel,
    isLiverUp,
    ductalGradientPercent,
    hasSignificantPphnShunt,
    isGentleVentilationCompliant,
    isPermissiveHypercapniaAchieved,
    isPhysiologicallyReadyForSurgery,
    readinessCriteriaStatus,
    deliveryRoomDirectives,
    gentleVentilationDirectives,
    pulmonaryHypertensionDirectives,
    surgicalRepairDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
