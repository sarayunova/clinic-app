// ============================================================================
// Neonatal Meconium Aspiration Syndrome (MAS) & Pulmonary Hypertension Engine
// References:
// 1. AAP Neonatal Resuscitation Program (NRP 8th Ed)
// 2. Cochrane Database of Systematic Reviews: Surfactant for Meconium Aspiration
// 3. NeoReviews: Persistent Pulmonary Hypertension of the Newborn in MAS
// 4. Gomella's Neonatology (8th Ed) - Meconium Aspiration & High-Frequency Ventilation
// ============================================================================

export type MeconiumConsistency =
  | 'thick_particulate_pea_soup'
  | 'moderate_meconium'
  | 'thin_light_meconium';

export type DeliveryRoomVigor =
  | 'non_vigorous_depressed'
  | 'vigorous_active';

export type RespiratorySupportMode =
  | 'room_air_low_flow_o2'
  | 'nasal_cpap_bubble'
  | 'non_invasive_nipv'
  | 'conventional_mechanical_ventilation'
  | 'high_frequency_oscillatory_ventilation'
  | 'ecmo_rescue';

export type PphnSeverity =
  | 'none_or_not_assessed'
  | 'mild_right_ventricular_strain'
  | 'moderate_suprasystemic_shunting'
  | 'severe_refractory_right_to_left';

export type AirLeakType =
  | 'none'
  | 'pneumothorax_tension'
  | 'pneumothorax_simple'
  | 'pneumomediastinum'
  | 'pulmonary_interstitial_emphysema';

export type SurfactantDeliveryMethod =
  | 'none'
  | 'bolus_endotracheal'
  | 'dilute_surfactant_bronchoalveolar_lavage';

export interface NeonatalMasInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  chronologicalAgeHours: number;
  currentWeightKg: number;

  amnioticFluidMeconiumConsistency: MeconiumConsistency;
  deliveryRoomVigor: DeliveryRoomVigor;
  endotrachealSuctioningPerformed: boolean;
  meconiumClearedBelowCords: boolean;
  apgar1min?: number;
  apgar5min?: number;

  respiratorySupportMode: RespiratorySupportMode;
  fio2Percent: number; // 21 - 100
  meanAirwayPressureCmh2o: number; // 4 - 35
  pao2Mmhg?: number;
  paco2Mmhg?: number;
  arterialPh?: number;

  prePostDuctalSpo2DiffPercent?: number;
  echocardiogramPphnConfirmed: boolean;
  pphnSeverity: PphnSeverity;
  pulmonaryAirLeakPresent: boolean;
  airLeakType: AirLeakType;

  surfactantAdministered: boolean;
  surfactantDeliveryMethod: SurfactantDeliveryMethod;
  inhaledNitricOxidePrescribed: boolean;
  inoDosePpm?: number;
}

export interface NeonatalMasEvaluation {
  oxygenationIndex: number | null;
  hypoxemicFailureSeverity: 'mild' | 'moderate' | 'severe' | 'ecmo_eligible';
  hypoxemicFailureLabel: string;

  inoIndicated: boolean;
  inoRecommendedStartingDosePpm: number;
  hfovIndicated: boolean;
  surfactantIndicated: boolean;
  recommendedSurfactantDoseMgKg: number;
  airLeakEmergency: boolean;

  pphnRiskLevel: 'low' | 'moderate' | 'high' | 'critical';
  clinicalAlerts: string[];
  therapeuticActionPlan: string[];
  summary: string;
}

/**
 * Calculates Oxygenation Index (OI) = (MAP cmH2O * FiO2% * 100) / (PaO2 mmHg * 100)
 * which simplifies to (MAP * FiO2) / PaO2
 */
export function calculateOxygenationIndex(
  mapCmh2o: number,
  fio2Percent: number,
  pao2Mmhg?: number,
): number | null {
  if (!pao2Mmhg || pao2Mmhg <= 0) return null;
  const oi = (mapCmh2o * fio2Percent) / pao2Mmhg;
  return Math.round(oi * 10) / 10;
}

export function evaluateNeonatalMas(input: NeonatalMasInput): NeonatalMasEvaluation {
  const oi = calculateOxygenationIndex(
    input.meanAirwayPressureCmh2o,
    input.fio2Percent,
    input.pao2Mmhg,
  );

  let hypoxemicFailureSeverity: NeonatalMasEvaluation['hypoxemicFailureSeverity'] = 'mild';
  let hypoxemicFailureLabel = 'Mild Hypoxemic Respiratory Failure (OI < 15 or FiO2 < 40%)';

  if (oi !== null) {
    if (oi >= 40.0) {
      hypoxemicFailureSeverity = 'ecmo_eligible';
      hypoxemicFailureLabel = `Extreme Hypoxemic Respiratory Failure (OI ${oi} >= 40: High Mortality Risk / ECMO Criteria)`;
    } else if (oi >= 25.0) {
      hypoxemicFailureSeverity = 'severe';
      hypoxemicFailureLabel = `Severe Hypoxemic Respiratory Failure (OI ${oi} [25 - 39]: High-Frequency / iNO Failure Risk)`;
    } else if (oi >= 15.0) {
      hypoxemicFailureSeverity = 'moderate';
      hypoxemicFailureLabel = `Moderate Hypoxemic Respiratory Failure (OI ${oi} [15 - 24]: Surfactant & iNO Indication)`;
    } else {
      hypoxemicFailureSeverity = 'mild';
      hypoxemicFailureLabel = `Mild Hypoxemic Respiratory Failure (OI ${oi} < 15)`;
    }
  } else if (input.fio2Percent >= 60.0) {
    hypoxemicFailureSeverity = 'moderate';
    hypoxemicFailureLabel = `Moderate-to-Severe Respiratory Compromise (FiO2 ${input.fio2Percent}% without Arterial Blood Gas)`;
  }

  // PPHN Risk & Evaluation
  const ductalGradient = input.prePostDuctalSpo2DiffPercent ?? 0;
  const significantDuctalGradient = ductalGradient >= 10.0;
  let pphnRiskLevel: NeonatalMasEvaluation['pphnRiskLevel'] = 'low';

  if (input.pphnSeverity === 'severe_refractory_right_to_left' || (oi !== null && oi >= 30.0)) {
    pphnRiskLevel = 'critical';
  } else if (input.pphnSeverity === 'moderate_suprasystemic_shunting' || significantDuctalGradient || (oi !== null && oi >= 20.0)) {
    pphnRiskLevel = 'high';
  } else if (input.pphnSeverity === 'mild_right_ventricular_strain' || ductalGradient >= 5.0) {
    pphnRiskLevel = 'moderate';
  }

  // iNO Indication: OI >= 20 or echo-confirmed moderate/severe PPHN or ductal gradient >= 10%
  const inoIndicated =
    (oi !== null && oi >= 20.0) ||
    input.pphnSeverity === 'moderate_suprasystemic_shunting' ||
    input.pphnSeverity === 'severe_refractory_right_to_left' ||
    significantDuctalGradient;

  const inoRecommendedStartingDosePpm = inoIndicated ? 20.0 : 0.0;

  // HFOV Indication: High MAP on CMV (>= 14), severe hypercapnia, or air leak
  const hfovIndicated =
    input.meanAirwayPressureCmh2o >= 14.0 ||
    (input.paco2Mmhg !== undefined && input.paco2Mmhg >= 65.0) ||
    input.pulmonaryAirLeakPresent ||
    (oi !== null && oi >= 20.0);

  // Surfactant Indication: Inactivation in MAS with FiO2 >= 50% and MAP >= 10 cmH2O
  const surfactantIndicated =
    input.fio2Percent >= 50.0 &&
    input.meanAirwayPressureCmh2o >= 10.0 &&
    !input.surfactantAdministered;

  const recommendedSurfactantDoseMgKg = surfactantIndicated ? 150.0 : 0.0; // 100 - 200 mg/kg

  // Air Leak Emergency
  const airLeakEmergency =
    input.pulmonaryAirLeakPresent &&
    input.airLeakType === 'pneumothorax_tension';

  // Alerts
  const clinicalAlerts: string[] = [];

  if (airLeakEmergency) {
    clinicalAlerts.push('CRITICAL EMERGENCY: Tension pneumothorax detected! Immediate needle thoracostomy followed by thoracostomy tube placement required.');
  }

  if (hypoxemicFailureSeverity === 'ecmo_eligible') {
    clinicalAlerts.push(`EXTREME OXYGENATION FAILURE (OI ${oi}): Meets standard neonatal ECMO criteria (OI > 40 on optimal ventilator + iNO support). Mobilize ECMO cannulation team immediately.`);
  }

  if (inoIndicated && !input.inhaledNitricOxidePrescribed) {
    clinicalAlerts.push('Persistent Pulmonary Hypertension / Ductal Shunting: Initiate Inhaled Nitric Oxide (iNO) at 20 ppm to reduce pulmonary vascular resistance and reverse right-to-left shunting.');
  }

  if (hfovIndicated && input.respiratorySupportMode !== 'high_frequency_oscillatory_ventilation') {
    clinicalAlerts.push('Severe Ventilation-Perfusion Mismatch / Airway Obstruction: Transition from conventional ventilation to High-Frequency Oscillatory Ventilation (HFOV) to avoid high peak pressures and prevent secondary barotrauma/pneumothorax.');
  }

  if (surfactantIndicated) {
    clinicalAlerts.push('Secondary Surfactant Inactivation: Meconium deactivates endogenous surfactant; administer exogenous bovine or porcine surfactant (150-200 mg/kg) or perform dilute surfactant lavage.');
  }

  if (input.amnioticFluidMeconiumConsistency === 'thick_particulate_pea_soup' && input.deliveryRoomVigor === 'non_vigorous_depressed') {
    clinicalAlerts.push('Depressed Neonate with Thick Meconium: High risk of ball-valve mechanical bronchiolar obstruction and intense chemical pneumonitis.');
  }

  // Action Plan
  const therapeuticActionPlan: string[] = [];
  therapeuticActionPlan.push('Maintain pre-ductal SpO2 92-97% and target pre-ductal PaO2 60-80 mmHg while avoiding hyperoxia-induced reactive pulmonary vasoconstriction.');
  therapeuticActionPlan.push('Maintain adequate systemic blood pressure (mean arterial BP >= gestational age in weeks) using volume expansion and inotropes (Dobutamine / Epinephrine) to prevent suprasystemic pulmonary artery pressure.');
  therapeuticActionPlan.push('Continuous sedation and minimal handling protocol to avoid catastrophic PPHN pulmonary hypertensive crisis.');
  therapeuticActionPlan.push('Serial chest radiographs and point-of-care lung ultrasound every 12-24h to monitor for emerging air-leak syndromes.');
  therapeuticActionPlan.push('Broad-spectrum intravenous antibiotics (Ampicillin + Gentamicin) until blood and tracheal cultures confirm absence of secondary bacterial pneumonitis.');

  // Summary
  const oiStr = oi !== null ? `OI ${oi}` : `FiO2 ${input.fio2Percent}%`;
  const summary = `Meconium Aspiration Syndrome (${input.amnioticFluidMeconiumConsistency.replace(/_/g, ' ')}) in a ${input.gestationalAgeWeeks}-week neonate (${input.currentWeightKg} kg): ${hypoxemicFailureLabel}. PPHN Risk: ${pphnRiskLevel.toUpperCase()}. Support: ${input.respiratorySupportMode.replace(/_/g, ' ')} (${oiStr}).`;

  return {
    oxygenationIndex: oi,
    hypoxemicFailureSeverity,
    hypoxemicFailureLabel,
    inoIndicated,
    inoRecommendedStartingDosePpm,
    hfovIndicated,
    surfactantIndicated,
    recommendedSurfactantDoseMgKg,
    airLeakEmergency,
    pphnRiskLevel,
    clinicalAlerts,
    therapeuticActionPlan,
    summary,
  };
}
