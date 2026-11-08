/**
 * Pure calculation engine for Pediatric Refractory Status Asthmaticus Resuscitation (PICU Rescue) Protocol
 * References: British Thoracic Society (BTS) / SIGN Guideline 158 / PALS / GINA Refractory Pediatric Asthma
 */

export type VentilatorySupportMode =
  | 'high_flow_nasal_cannula'
  | 'bipap_noninvasive_positive_pressure'
  | 'invasive_mechanical_ventilation_permissive_hypercapnia'
  | 'standard_low_flow_oxygen';

export type HelioxMixtureRatio =
  | 'none'
  | 'heliox_80_20'
  | 'heliox_70_30';

export type PediatricRefractoryAsthmaStatus =
  | 'impending_respiratory_failure'
  | 'second_line_iv_bronchodilator_infusion'
  | 'bipap_noninvasive_support'
  | 'invasive_mechanical_ventilation_picu'
  | 'bronchospasm_relieving_weaning'
  | 'extubated_convalescent_stepdown'
  | 'resolved_transferred_to_ward';

export interface PediatricRefractoryAsthmaParams {
  ageYears: number;
  weightKg: number;
  initialPediatricAsthmaScore: number;
  respiratoryRate: number;
  heartRateBpm: number;
  spo2Percent: number;
  pco2Mmhg: number;
  phValue: number;
  silentChestOrExhaustion: boolean;
  refractoryToFirstLine: boolean;
  continuousIvTerbutalineActive: boolean;
  terbutalineDoseMcgKgMin: number;
  ivKetamineInfusionActive: boolean;
  ketamineDoseMgKgHr: number;
  helioxInhalationActive: boolean;
  helioxMixtureRatio: HelioxMixtureRatio;
  ivTheophyllineAminophyllineActive: boolean;
  ventilatorySupportMode: VentilatorySupportMode;
  status?: string;
}

export interface PediatricRefractoryAsthmaEvaluation {
  isImpendingRespiratoryArrest: boolean;
  isRefractoryToStandardTherapy: boolean;
  severityCategory: 'imminent_arrest_extremis' | 'critical_refractory' | 'severe_acute_asthma' | 'stable_weaning';
  terbutalineIndicated: boolean;
  terbutalineDosingDirectives: {
    initialBolusMcgKg: number;
    initialBolusTotalMcg: number;
    maintenanceMcgKgMin: number;
    maxRateMcgKgMin: number;
  };
  ketamineIndicated: boolean;
  ketamineDosingDirectives: {
    bolusDoseMgKg: number;
    bolusTotalMg: number;
    infusionRateMgKgHr: number;
    maxRateMgKgHr: number;
  };
  aminophyllineLoadingDoseMg: number;
  helioxRecommendation: string;
  ventilatoryStrategyDirectives: {
    targetTidalVolumeMlKg: string;
    targetIeRatio: string;
    permissiveHypercapniaTarget: string;
  };
  resuscitationActionChecklist: string[];
  advancedPharmacotherapyDirectives: string[];
  ventilatoryManagementDirectives: string[];
  cardiorespiratoryMonitoringDirectives: string[];
  recommendations: string[];
  alerts: string[];
  clinicalAlerts: string[];
  urgencyTier: 'emergency_respiratory_arrest_picu' | 'urgent_second_line_iv_bronchodilators' | 'picu_stepdown_monitoring';
  urgencyTierLabel: string;
}

export function evaluatePediatricRefractoryAsthma(params: PediatricRefractoryAsthmaParams): PediatricRefractoryAsthmaEvaluation {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const advancedPharmacotherapyDirectives: string[] = [];
  const ventilatoryManagementDirectives: string[] = [];
  const cardiorespiratoryMonitoringDirectives: string[] = [];

  // 1. Respiratory Arrest & Acid-Base Failure Criteria
  // Normal/Elevated pCO2 (> 40–42 mmHg) during severe tachypneic asthma indicates diaphragmatic exhaustion!
  const isHypercapnicExhaustion = params.pco2Mmhg >= 42.0 || params.phValue <= 7.28;
  const isImpendingRespiratoryArrest =
    params.silentChestOrExhaustion ||
    isHypercapnicExhaustion ||
    params.spo2Percent < 90.0 ||
    params.initialPediatricAsthmaScore >= 10;

  if (isImpendingRespiratoryArrest) {
    alerts.push(`IMPENDING RESPIRATORY ARREST (ASPHYXIC): Severe bronchospasm refractory to first-line nebulizers. pCO2 is ${params.pco2Mmhg} mmHg (exhaustion threshold >= 42 mmHg), pH is ${params.phValue}, SpO2 ${params.spo2Percent}%. PICU intubation team on immediate standby; initiate aggressive second-line bronchodilator infusions!`);
  }

  // 2. Continuous IV Terbutaline Dosing
  // Load 2–10 mcg/kg over 10 min, then continuous infusion 0.4–10 mcg/kg/min
  const terbutalineLoadingDoseMcg = Math.round(params.weightKg * 5.0); // 5 mcg/kg loading
  const terbutalineInfusionRange = '0.4 to 6.0 mcg/kg/min (titrate q15-30m)';

  if (params.continuousIvTerbutalineActive || params.refractoryToFirstLine) {
    advancedPharmacotherapyDirectives.push(`IV Terbutaline Protocol: Bolus ${terbutalineLoadingDoseMcg} mcg (${Math.round((params.weightKg * 5.0) / 1000 * 100) / 100} mg, 5 mcg/kg) over 10 minutes, followed by continuous infusion at ${terbutalineInfusionRange}.`);
    cardiorespiratoryMonitoringDirectives.push('Terbutaline Cardiotoxicity Vigilance: Continuous ECG telemetry mandatory. Monitor for refractory sinus tachycardia, ST-depression/myocardial ischemia, and hypokalemia (drive potassium intracellulary).');
  }

  // 3. IV Ketamine Bronchodilator Infusion
  // Dissociative NMDA-receptor antagonist with sympathomimetic catecholamine release causing potent smooth muscle relaxation
  const ketamineLoadingDoseMg = Math.round(params.weightKg * 1.5 * 10) / 10; // 1.5 mg/kg load
  const ketamineInfusionDoseMgHr = Math.round(params.weightKg * 1.0 * 10) / 10; // 1.0 mg/kg/hr infusion

  if (params.ivKetamineInfusionActive || isImpendingRespiratoryArrest) {
    advancedPharmacotherapyDirectives.push(`IV Ketamine Infusion: Loading dose ${ketamineLoadingDoseMg} mg (1.5 mg/kg IV over 2–5 min), then continuous infusion at ${ketamineInfusionDoseMgHr} mg/hr (1.0 mg/kg/hr, range 0.5–2.0 mg/kg/hr) for profound bronchodilation without loss of airway reflexes.`);
  }

  // 4. Heliox Therapy (Helium-Oxygen Mixture)
  if (params.helioxInhalationActive && params.helioxMixtureRatio !== 'none') {
    advancedPharmacotherapyDirectives.push(`Heliox Inhalation (${params.helioxMixtureRatio}): Low-density gas converts turbulent flow to laminar flow across critically narrowed bronchioles, reducing work of breathing and enhancing aerosol drug deposition.`);
    if (params.helioxMixtureRatio === 'heliox_70_30') {
      recommendations.push('Heliox 70:30 delivers 30% FiO2. Ensure patient does not require FiO2 > 40% before maintaining Heliox.');
    }
  }

  // 5. IV Aminophylline / Theophylline
  const aminophyllineLoadingDoseMg = Math.round(params.weightKg * 5.5 * 10) / 10;
  if (params.ivTheophyllineAminophyllineActive) {
    advancedPharmacotherapyDirectives.push(`IV Aminophylline: Loading dose ${aminophyllineLoadingDoseMg} mg (5.5 mg/kg IV over 20–30 min if not on maintenance theophylline), then continuous infusion 0.9 mg/kg/hr.`);
    advancedPharmacotherapyDirectives.push('Therapeutic Drug Monitoring: Check serum theophylline level at 12–24h (target 10–20 mcg/mL). Toxic arrhythmias and vomiting occur > 20 mcg/mL.');
  }

  // 6. Ventilatory Management (BiPAP & Permissive Hypercapnia)
  if (params.ventilatorySupportMode === 'bipap_noninvasive_positive_pressure') {
    ventilatoryManagementDirectives.push('Non-Invasive Positive Pressure (BiPAP): Start IPAP 12–14 cmH2O, EPAP 4–6 cmH2O. Offloads diaphragmatic fatigue and staves off endotracheal intubation.');
  } else if (params.ventilatorySupportMode === 'invasive_mechanical_ventilation_permissive_hypercapnia') {
    ventilatoryManagementDirectives.push('Invasive Mechanical Ventilation (Permissive Hypercapnia): High risk of barotrauma, pneumothorax, and cardiovascular collapse from gas-trapping / auto-PEEP.');
    ventilatoryManagementDirectives.push('Ventilator Settings: Low respiratory rate (10–14 bpm), low tidal volume (5–7 mL/kg), high inspiratory flow rate with prolonged expiration (I:E ratio 1:3 to 1:4), PEEP 4–5 cmH2O, peak inspiratory pressure < 35 cmH2O, accepting pH >= 7.20.');
  }

  // 7. Urgency Tier & Structured Directives
  let urgencyTier: 'emergency_respiratory_arrest_picu' | 'urgent_second_line_iv_bronchodilators' | 'picu_stepdown_monitoring' =
    'picu_stepdown_monitoring';
  let urgencyTierLabel = 'PICU Step-Down Monitoring & Aerosol Weaning';

  if (isImpendingRespiratoryArrest || params.ventilatorySupportMode === 'invasive_mechanical_ventilation_permissive_hypercapnia') {
    urgencyTier = 'emergency_respiratory_arrest_picu';
    urgencyTierLabel = 'EMERGENCY: Asphyxic Respiratory Arrest / Ketamine & Ventilator Rescue';
  } else if (params.continuousIvTerbutalineActive || params.ventilatorySupportMode === 'bipap_noninvasive_positive_pressure') {
    urgencyTier = 'urgent_second_line_iv_bronchodilators';
    urgencyTierLabel = 'Urgent PICU Second-Line IV Bronchodilators & BiPAP';
  }

  const isRefractoryToStandardTherapy = Boolean(params.refractoryToFirstLine);
  let severityCategory: 'imminent_arrest_extremis' | 'critical_refractory' | 'severe_acute_asthma' | 'stable_weaning' = 'severe_acute_asthma';

  if (params.silentChestOrExhaustion || (isHypercapnicExhaustion && params.initialPediatricAsthmaScore >= 10)) {
    severityCategory = 'imminent_arrest_extremis';
  } else if (isImpendingRespiratoryArrest || params.continuousIvTerbutalineActive || params.ivKetamineInfusionActive) {
    severityCategory = 'critical_refractory';
  } else if (
    params.status === 'bronchospasm_relieving_weaning' ||
    params.status === 'extubated_convalescent_stepdown' ||
    params.status === 'resolved_transferred_to_ward'
  ) {
    severityCategory = 'stable_weaning';
  } else {
    severityCategory = 'severe_acute_asthma';
  }

  const terbutalineIndicated = Boolean(params.continuousIvTerbutalineActive || params.refractoryToFirstLine || isImpendingRespiratoryArrest);
  const terbutalineDosingDirectives = {
    initialBolusMcgKg: 2.0,
    initialBolusTotalMcg: Math.round(params.weightKg * 2.0),
    maintenanceMcgKgMin: params.terbutalineDoseMcgKgMin || 1.5,
    maxRateMcgKgMin: 6.0,
  };

  const ketamineIndicated = Boolean(params.ivKetamineInfusionActive || isImpendingRespiratoryArrest);
  const ketamineDosingDirectives = {
    bolusDoseMgKg: 1.0,
    bolusTotalMg: Math.round(params.weightKg * 1.0 * 10) / 10,
    infusionRateMgKgHr: params.ketamineDoseMgKgHr || 1.0,
    maxRateMgKgHr: 2.0,
  };

  const helioxRecommendation = params.helioxInhalationActive && params.helioxMixtureRatio !== 'none'
    ? `Inhaled ${params.helioxMixtureRatio.replace(/_/g, ' ')} running to reduce turbulent airflow.`
    : 'Consider Heliox 70:30 or 80:20 if FiO2 requirement is <= 40% and airway resistance is high.';

  const ventilatoryStrategyDirectives = {
    targetTidalVolumeMlKg: '5 - 7 mL/kg (Lung-protective low volume)',
    targetIeRatio: '1:3 to 1:5 (Prolonged expiration to prevent breath stacking & auto-PEEP)',
    permissiveHypercapniaTarget: 'Accept permissive hypercapnia as long as pH >= 7.20',
  };

  const resuscitationActionChecklist = [
    'Senior airway lead & pediatric intensivist present at bedside',
    'Prepare IV Ketamine 1–2 mg/kg for dissociation / bronchodilation prior to airway instrumentation',
    'Permissive hypercapnia: do NOT hyperventilate; prevent dynamic hyperinflation and pneumothorax',
    'Continuous telemetry for terbutaline/aminophylline induced arrhythmias and hypokalemia',
    'Serial blood gases q1-2h until hypercapnic acidosis resolving',
  ];

  return {
    isImpendingRespiratoryArrest,
    isRefractoryToStandardTherapy,
    severityCategory,
    terbutalineIndicated,
    terbutalineDosingDirectives,
    ketamineIndicated,
    ketamineDosingDirectives,
    terbutalineLoadingDoseMcg,
    terbutalineInfusionRange,
    ketamineLoadingDoseMg,
    ketamineInfusionDoseMgHr,
    aminophyllineLoadingDoseMg,
    helioxRecommendation,
    ventilatoryStrategyDirectives,
    resuscitationActionChecklist,
    advancedPharmacotherapyDirectives,
    ventilatoryManagementDirectives,
    cardiorespiratoryMonitoringDirectives,
    recommendations,
    alerts,
    clinicalAlerts: alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
