// Pure TypeScript calculation engine for Neonatal Apnea of Prematurity (AOP) & Methylxanthine (Caffeine Citrate) Therapy Protocol
// Guidelines: AAP Clinical Report / Cochrane Neonatal AOP Review / CAP Trial

export interface NeonatalAopEvaluationParams {
  gestationalAgeWeeks: number;
  chronologicalAgeDays: number;
  postConceptionalAgeWeeks?: number;
  currentWeightKg: number;
  apneaSubtype: 'mixed' | 'central' | 'obstructive';
  apneaFrequencyPer24h: number;
  lowestHeartRateBpm?: number;
  lowestSpo2Percent?: number;
  stimulationRequired: 'self_resolved' | 'tactile_gentle' | 'vigorous_stimulation' | 'bag_mask_positive_pressure';
  caffeineCitrateActive: boolean;
  caffeineLoadingDoseMgKg?: number;
  caffeineMaintenanceDoseMgKgDay?: number;
  serumCaffeineLevelMcgMl?: number;
  secondaryCausesExcluded?: boolean;
  respiratorySupportMode: 'room_air' | 'low_flow_nasal_cannula' | 'high_flow_hfnc' | 'bubble_cpap' | 'niv_nava' | 'invasive_mechanical_ventilation';
  cpapPeepCmh2o?: number;
  apneaFreeDaysCount: number;
}

export interface NeonatalAopEvaluationResult {
  postConceptionalAgeWeeks: number;
  apneaSeverityTier: 'mild' | 'moderate' | 'severe_refractory';
  apneaSeverityTierLabel: string;
  apneaSeverityLabel: string;
  caffeineDosing: {
    loadingDoseMg: number;
    recommendedLoadingDoseMg: number;
    maintenanceDailyDoseMg: number;
    recommendedDailyMaintenanceMg: number;
    loadingDoseMgKg: number;
    maintenanceDoseMgKgDay: number;
    therapeuticRange: string;
    levelStatus: 'subtherapeutic' | 'target_therapeutic' | 'supratherapeutic' | 'toxic' | 'not_tested';
  };
  therapeuticDrugMonitoring?: {
    status: 'subtherapeutic' | 'target_therapeutic' | 'supratherapeutic' | 'toxic';
    interpretation: string;
  };
  weaningEligibility: {
    eligible: boolean;
    rationale: string;
    reason: string;
  };
  respiratorySupportGuidance: string;
  airwaySupportGuidance: string;
  recommendations: string[];
  alerts: string[];
}

export function calculatePostConceptionalAge(gestationalAgeWeeks: number, chronologicalAgeDays: number): number {
  return Number((gestationalAgeWeeks + chronologicalAgeDays / 7).toFixed(1));
}

export function evaluateNeonatalAop(params: NeonatalAopEvaluationParams): NeonatalAopEvaluationResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];

  // 1. Post-Conceptional Age (PCA) calculation
  const computedPca = params.postConceptionalAgeWeeks ??
    calculatePostConceptionalAge(params.gestationalAgeWeeks, params.chronologicalAgeDays);

  // 2. Apnea Severity Tiering
  let apneaSeverityTier: 'mild' | 'moderate' | 'severe_refractory' = 'mild';
  let apneaSeverityTierLabel = 'Mild AOP (Isolated events, self-limiting or gentle stimulation)';

  const isSevere =
    params.apneaFrequencyPer24h >= 6 ||
    params.stimulationRequired === 'bag_mask_positive_pressure' ||
    (params.lowestHeartRateBpm !== undefined && params.lowestHeartRateBpm < 60) ||
    (params.lowestSpo2Percent !== undefined && params.lowestSpo2Percent < 70);

  const isModerate =
    params.apneaFrequencyPer24h >= 3 ||
    params.stimulationRequired === 'vigorous_stimulation' ||
    (params.lowestHeartRateBpm !== undefined && params.lowestHeartRateBpm < 80) ||
    (params.lowestSpo2Percent !== undefined && params.lowestSpo2Percent < 80);

  if (isSevere) {
    apneaSeverityTier = 'severe_refractory';
    apneaSeverityTierLabel = 'Severe / Refractory AOP (Frequent episodes, severe bradycardia or bag-mask rescue)';
    alerts.push('CRITICAL: High-frequency or severe desaturation/bradycardia requiring positive-pressure ventilation or vigorous stimulation.');
  } else if (isModerate) {
    apneaSeverityTier = 'moderate';
    apneaSeverityTierLabel = 'Moderate AOP (Multiple daily events requiring active intervention)';
  }

  // 3. Weight-based Caffeine Citrate calculations
  const weight = Math.max(0.4, params.currentWeightKg || 1.0);
  const loadingDosePerKg = params.caffeineLoadingDoseMgKg ?? 20.0;
  const maintenancePerKg = params.caffeineMaintenanceDoseMgKgDay ?? 7.5;

  const loadingDoseMg = Number((weight * loadingDosePerKg).toFixed(1));
  const maintenanceDailyDoseMg = Number((weight * maintenancePerKg).toFixed(1));

  let levelStatus: 'subtherapeutic' | 'target_therapeutic' | 'supratherapeutic' | 'toxic' | 'not_tested' = 'not_tested';
  let therapeuticDrugMonitoring: NeonatalAopEvaluationResult['therapeuticDrugMonitoring'] = undefined;

  if (params.serumCaffeineLevelMcgMl !== undefined) {
    if (params.serumCaffeineLevelMcgMl < 8.0) {
      levelStatus = 'subtherapeutic';
      therapeuticDrugMonitoring = {
        status: 'subtherapeutic',
        interpretation: `Subtherapeutic (${params.serumCaffeineLevelMcgMl} mcg/mL < 8.0). Consider re-loading 5-10 mg/kg or escalating maintenance.`,
      };
      alerts.push(`Serum caffeine concentration is subtherapeutic (${params.serumCaffeineLevelMcgMl} mcg/mL, target 8-20 mcg/mL). Consider dose titration.`);
    } else if (params.serumCaffeineLevelMcgMl > 30.0) {
      levelStatus = 'toxic';
      therapeuticDrugMonitoring = {
        status: 'toxic',
        interpretation: `Toxic Range (${params.serumCaffeineLevelMcgMl} mcg/mL > 30.0). Hold dose; monitor for tachycardia, jitteriness, and seizures.`,
      };
      alerts.push(`TOXICITY RISK: Serum caffeine level in toxic range (${params.serumCaffeineLevelMcgMl} mcg/mL > 30 mcg/mL). Hold dose and monitor for tachycardia/seizures.`);
    } else if (params.serumCaffeineLevelMcgMl > 20.0) {
      levelStatus = 'supratherapeutic';
      therapeuticDrugMonitoring = {
        status: 'supratherapeutic',
        interpretation: `Supratherapeutic (${params.serumCaffeineLevelMcgMl} mcg/mL > 20.0). Reduce daily maintenance dose by 20-30%.`,
      };
      alerts.push(`Caffeine level supratherapeutic (${params.serumCaffeineLevelMcgMl} mcg/mL). Titrate dose downwards.`);
    } else {
      levelStatus = 'target_therapeutic';
      therapeuticDrugMonitoring = {
        status: 'target_therapeutic',
        interpretation: `Optimal Therapeutic (${params.serumCaffeineLevelMcgMl} mcg/mL, target 8.0 - 20.0 mcg/mL).`,
      };
    }
  }

  // 4. Weaning Eligibility: PCA >= 33.5 weeks AND >= 5 consecutive apnea-free days
  let weaningEligible = false;
  let weaningRationale = '';

  if (computedPca >= 33.5 && params.apneaFreeDaysCount >= 5) {
    weaningEligible = true;
    weaningRationale = `Eligible for caffeine citrate discontinuation: PCA ${computedPca} weeks (≥33.5 wks) and ${params.apneaFreeDaysCount} consecutive apnea-free days. Observe off caffeine for 5-7 days before discharge.`;
    recommendations.push(weaningRationale);
  } else {
    weaningEligible = false;
    weaningRationale = `Continue treatment: PCA ${computedPca} wks (target ≥33.5 wks) or apnea-free days ${params.apneaFreeDaysCount}/5.`;
  }

  // 5. Respiratory Support Directives
  let respiratorySupportGuidance = '';
  if (params.apneaSubtype === 'obstructive' || params.apneaSubtype === 'mixed') {
    respiratorySupportGuidance = 'Nasal CPAP (5-6 cmH2O) or High Flow Nasal Cannula (HFNC 3-5 L/min) recommended to maintain pharyngeal airway patency.';
    recommendations.push('Apply continuous positive distending pressure (CPAP or HFNC) to overcome upper airway collapse in mixed/obstructive AOP.');
  } else {
    respiratorySupportGuidance = 'Central AOP responsive to methylxanthine respiratory drive stimulation. Maintain neutral neck position.';
  }

  // 6. Secondary etiologies alert
  if (params.secondaryCausesExcluded === false) {
    alerts.push('Rule out secondary causes of acute apnea: Late-onset neonatal sepsis, NEC, hypoglycemia, intracranial hemorrhage (IVH), or PDA.');
  }

  // General recommendations
  if (params.caffeineCitrateActive) {
    recommendations.push(`Caffeine Citrate Maintenance: ${maintenanceDailyDoseMg} mg IV/PO once daily (equivalent to ${maintenancePerKg} mg/kg/day).`);
  } else {
    recommendations.push(`Initiate Caffeine Citrate Loading Dose: ${loadingDoseMg} mg IV/PO once (${loadingDosePerKg} mg/kg), followed in 24 hours by daily maintenance.`);
  }

  return {
    postConceptionalAgeWeeks: computedPca,
    apneaSeverityTier,
    apneaSeverityTierLabel,
    apneaSeverityLabel: apneaSeverityTierLabel,
    caffeineDosing: {
      loadingDoseMg,
      recommendedLoadingDoseMg: loadingDoseMg,
      maintenanceDailyDoseMg,
      recommendedDailyMaintenanceMg: maintenanceDailyDoseMg,
      loadingDoseMgKg: loadingDosePerKg,
      maintenanceDoseMgKgDay: maintenancePerKg,
      therapeuticRange: '8.0 - 20.0 mcg/mL',
      levelStatus,
    },
    therapeuticDrugMonitoring,
    weaningEligibility: {
      eligible: weaningEligible,
      rationale: weaningRationale,
      reason: weaningRationale,
    },
    respiratorySupportGuidance,
    airwaySupportGuidance: respiratorySupportGuidance,
    recommendations,
    alerts,
  };
}
