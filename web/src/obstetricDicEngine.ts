/**
 * Pure Mathematical and Clinical Evaluation Engine for Obstetric Disseminated Intravascular Coagulation (DIC)
 * & Fibrinogen-Guided Resuscitation
 * References:
 * - Pregnancy-Modified ISTH DIC Scoring System (Erez et al., J Thromb Haemost 2014)
 * - RCOG Green-top Guideline No. 52 (Prevention and Management of Postpartum Haemorrhage)
 * - ACOG Practice Bulletin No. 183: Postpartum Hemorrhage
 * - European Guidelines on Management of Severe Peri-operative Bleeding (ESA 2023)
 */

export type ObstetricDicTrigger =
  | 'placental_abruption'
  | 'severe_pph'
  | 'amniotic_fluid_embolism'
  | 'severe_preeclampsia_hellp'
  | 'septic_abortion_chorioamnionitis'
  | 'retained_dead_fetus'
  | 'acute_fatty_liver';

export type OvertBleedingSites =
  | 'none'
  | 'surgical_site_oozing'
  | 'iv_cannula_sites'
  | 'hematuria_gi'
  | 'catastrophic_generalized';

export interface ObstetricDicEvaluationParams {
  gestationalAgeWeeks?: number | null;
  clinicalTrigger: ObstetricDicTrigger;
  plateletCountKUl: number;
  fibrinogenMgDl: number;
  inr: number;
  prothrombinTimeSec?: number | null;
  controlPtSec?: number | null;
  apttSec?: number | null;
  dDimerUgMl?: number | null;
  estimatedBloodLossMl?: number;
  overtBleedingSites: OvertBleedingSites;
  isMtpActivated?: boolean;
  ionizedCalciumMmolL?: number | null;
  coreTemperatureC?: number | null;
}

export interface FibrinogenResuscitationPlan {
  isCriticalHypofibrinogenemia: boolean;
  currentFibrinogenMgDl: number;
  targetFibrinogenMgDl: number;
  fibrinogenDeficitMgDl: number;
  recommendedCryoprecipitateUnits: number;
  recommendedFibrinogenConcentrateGrams: number;
  urgency: 'immediate_stat' | 'urgent_prepare' | 'monitor_adequate';
  rationale: string;
}

export interface MtpBalancedComponentPlan {
  isMtpIndicated: boolean;
  prbcUnits: number;
  ffpUnits: number;
  plateletPools: number;
  txaDosingDirectives: string;
  calciumRepletionDirectives: string;
  temperatureMaintenanceDirectives: string;
}

export interface ObstetricDicEvaluationResult {
  modifiedIsthDicScore: number;
  isOvertDic: boolean;
  isHighRiskEvolvingDic: boolean;
  severityCategory: 'overt_consumptive_dic' | 'evolving_non_overt_dic' | 'compensated_coagulopathy';
  severityLabel: string;
  fibrinogenPlan: FibrinogenResuscitationPlan;
  mtpPlan: MtpBalancedComponentPlan;
  clinicalAlerts: string[];
  managementDirectives: string[];
}

export function evaluateObstetricDic(
  params: ObstetricDicEvaluationParams
): ObstetricDicEvaluationResult {
  const alerts: string[] = [];
  const directives: string[] = [];

  // 1. Pregnancy-Modified ISTH DIC Scoring
  // In normal pregnancy, Fibrinogen is 400 - 600 mg/dL. Normal hemostatic values do NOT apply!
  let score = 0;

  // Platelets: >= 100k = 0; 50-99k = 1; < 50k = 2
  if (params.plateletCountKUl < 50) score += 2;
  else if (params.plateletCountKUl < 100) score += 1;

  // Fibrinogen: > 400 = 0; 300 - 400 = 1; < 300 = 2; < 200 is severe
  if (params.fibrinogenMgDl < 300) score += 2;
  else if (params.fibrinogenMgDl <= 400) score += 1;

  // INR / PT prolongation: < 1.2 = 0; 1.2 - 1.5 = 1; > 1.5 = 2
  if (params.inr > 1.5) score += 2;
  else if (params.inr >= 1.2) score += 1;

  // D-Dimer / FDP: < 2 = 0; 2 - 5 = 1; > 5 = 2
  const dDimer = params.dDimerUgMl ?? 0;
  if (dDimer > 5) score += 2;
  else if (dDimer >= 2) score += 1;

  const isOvertDic = score >= 5 || (params.fibrinogenMgDl < 200 && params.plateletCountKUl < 100);
  const isHighRiskEvolvingDic = score >= 3 || params.fibrinogenMgDl < 250;

  let severityCategory: 'overt_consumptive_dic' | 'evolving_non_overt_dic' | 'compensated_coagulopathy' =
    'compensated_coagulopathy';
  let severityLabel = 'Compensated Coagulopathy - Close Surveillance';

  if (isOvertDic) {
    severityCategory = 'overt_consumptive_dic';
    severityLabel = 'OVERT OBSTETRIC DIC (Life-Threatening Consumptive Coagulopathy)';
  } else if (isHighRiskEvolvingDic) {
    severityCategory = 'evolving_non_overt_dic';
    severityLabel = 'Evolving / Non-Overt DIC (Impending Microvascular Exhaustion)';
  }

  // 2. Fibrinogen Resuscitation Plan
  // In pregnancy, fibrinogen < 200 mg/dL is an absolute predictor of severe postpartum microvascular hemorrhage!
  const targetFibrinogen = 200;
  const isCriticalHypofibrinogenemia = params.fibrinogenMgDl < targetFibrinogen;
  const deficit = Math.max(0, targetFibrinogen - params.fibrinogenMgDl);

  let cryoUnits = 0;
  let fibConcGrams = 0;
  let fibUrgency: 'immediate_stat' | 'urgent_prepare' | 'monitor_adequate' = 'monitor_adequate';
  let fibRationale = 'Fibrinogen levels are adequate (≥ 200 mg/dL). Maintain surveillance.';

  if (params.fibrinogenMgDl < 150) {
    fibUrgency = 'immediate_stat';
    cryoUnits = 20; // 2 adult pools = 20 units
    fibConcGrams = 4; // 4 grams
    fibRationale =
      'CRITICAL HYPOFIBRINOGENEMIA (< 150 mg/dL): Profound microvascular bleeding risk. Administer Cryoprecipitate 20 units or Fibrinogen Concentrate 4g STAT.';
  } else if (params.fibrinogenMgDl < 200) {
    fibUrgency = 'immediate_stat';
    cryoUnits = 10; // 1 adult pool = 10 units
    fibConcGrams = 2; // 2 grams
    fibRationale =
      'HYPOFIBRINOGENEMIA (< 200 mg/dL): Below the safe obstetric hemostatic threshold. Administer Cryoprecipitate 10 units or Fibrinogen Concentrate 2g STAT.';
  } else if (params.fibrinogenMgDl < 300) {
    fibUrgency = 'urgent_prepare';
    cryoUnits = 10;
    fibConcGrams = 2;
    fibRationale =
      'Suboptimal Fibrinogen for 3rd trimester gestation (200 - 300 mg/dL). Crossmatch and thaw 10 units Cryoprecipitate immediately for rapid bedside availability.';
  }

  const fibrinogenPlan: FibrinogenResuscitationPlan = {
    isCriticalHypofibrinogenemia,
    currentFibrinogenMgDl: params.fibrinogenMgDl,
    targetFibrinogenMgDl: targetFibrinogen,
    fibrinogenDeficitMgDl: deficit,
    recommendedCryoprecipitateUnits: cryoUnits,
    recommendedFibrinogenConcentrateGrams: fibConcGrams,
    urgency: fibUrgency,
    rationale: fibRationale,
  };

  // 3. MTP & Balanced Component Plan
  const ebl = params.estimatedBloodLossMl ?? 0;
  const isMtpIndicated =
    params.isMtpActivated ||
    ebl >= 1500 ||
    isOvertDic ||
    params.overtBleedingSites === 'catastrophic_generalized' ||
    params.overtBleedingSites === 'surgical_site_oozing';

  const mtpPlan: MtpBalancedComponentPlan = {
    isMtpIndicated: Boolean(isMtpIndicated),
    prbcUnits: isMtpIndicated ? 4 : 0,
    ffpUnits: isMtpIndicated ? 4 : 0,
    plateletPools: isMtpIndicated ? 1 : 0,
    txaDosingDirectives:
      'Tranexamic Acid (TXA): 1 g (1000 mg) in 100 mL NS infused IV over 10 minutes STAT (WOMAN Trial). If bleeding persists after 30 minutes, repeat second 1 g dose.',
    calciumRepletionDirectives:
      'Ionized Calcium: Maintain > 1.1 mmol/L. Citrate in transfused blood components chelates calcium; administer 10% Calcium Gluconate 10-20 mL (1-2 g) IV slow for every 4 units of blood products.',
    temperatureMaintenanceDirectives:
      'Core Temperature: Maintain > 36.0°C using active warming blankets and in-line fluid warmers. Hypothermia inhibits coagulation factor enzymatic activity.',
  };

  // Alerts
  if (isOvertDic) {
    alerts.push('OVERT DIC ALERT: Significant consumption of platelets and clotting factors. Immediate source control and multi-component transfusion mandated.');
  }
  if (isCriticalHypofibrinogenemia) {
    alerts.push(`CRITICAL HYPOFIBRINOGENEMIA (${params.fibrinogenMgDl} mg/dL): In pregnancy, fibrinogen < 200 mg/dL causes massive intractable capillary ooze. Replace fibrinogen before attempting surgical re-exploration.`);
  }
  if (params.plateletCountKUl < 50) {
    alerts.push(`SEVERE THROMBOCYTOPENIA (${params.plateletCountKUl} k/µL): Target platelet count ≥ 50,000 for hemostasis; transfuse 1 adult apheresis platelet pool.`);
  }
  if (params.inr > 1.5) {
    alerts.push(`COAGULOPATHY PROLONGATION (INR ${params.inr}): Target INR < 1.5. Transfuse Fresh Frozen Plasma (FFP 15 mL/kg) or Prothrombin Complex Concentrate (PCC).`);
  }
  if (params.ionizedCalciumMmolL != null && params.ionizedCalciumMmolL < 1.1) {
    alerts.push(`HYPOCALCEMIA ALERT (iCa ${params.ionizedCalciumMmolL} mmol/L): Severe hypocalcemia impairs clotting cascade factor complexes and worsens uterine atony. Replete with Calcium Gluconate immediately.`);
  }
  if (params.coreTemperatureC != null && params.coreTemperatureC < 36.0) {
    alerts.push(`HYPOTHERMIA WARNING (${params.coreTemperatureC}°C): Temperature < 36°C severely inhibits thrombin generation and platelet aggregation. Apply forced-air active body warmer.`);
  }

  // Directives
  directives.push('Definitive Obstetric Source Control: Evacuate uterine contents, inspect and repair genital tract lacerations, deliver placenta, and control uterine atony / placental site hemorrhage.');
  directives.push('Maintain 1:1:1 balanced resuscitation ratio (PRBC : FFP : Platelets) to avoid dilutional coagulopathy from crystalloid over-resuscitation.');
  directives.push('Fibrinogen replacement takes clinical precedence: Cryoprecipitate or Fibrinogen Concentrate must be given early alongside red cells.');
  directives.push('Administer Tranexamic Acid (TXA 1g IV) within 3 hours of bleeding onset for maximum mortality reduction (WOMAN Trial).');
  directives.push('Obtain repeat STAT coagulation profile (Fibrinogen, Platelets, PT/INR, aPTT, Blood gas, Calcium) every 30 to 60 minutes until stable.');

  return {
    modifiedIsthDicScore: score,
    isOvertDic,
    isHighRiskEvolvingDic,
    severityCategory,
    severityLabel,
    fibrinogenPlan,
    mtpPlan,
    clinicalAlerts: alerts,
    managementDirectives: directives,
  };
}
