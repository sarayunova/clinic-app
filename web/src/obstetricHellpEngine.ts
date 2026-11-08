// Pure TypeScript calculation engine for Obstetric HELLP Syndrome & Mississippi Triple-Class Protocol
// Guidelines: ACOG Practice Bulletin No. 222 / SMFM / Mississippi & Tennessee Classification Systems

export type MississippiClass =
  | 'class_1_severe_thrombocytopenia'
  | 'class_2_moderate_thrombocytopenia'
  | 'class_3_mild_thrombocytopenia'
  | 'unclassified_normal_platelets';

export type TennesseeClassification =
  | 'complete_hellp_syndrome'
  | 'partial_hellp_ellp'
  | 'partial_hellp_hel'
  | 'no_hellp_syndrome';

export type HepaticImagingFinding =
  | 'none'
  | 'ultrasound_capsule_intact'
  | 'subcapsular_hematoma_contained'
  | 'hepatic_rupture_hemoperitoneum';

export type DeliveryTimingPlan =
  | 'immediate_crash_delivery_under_2h'
  | 'planned_stabilization_and_delivery'
  | 'steroid_window_24_to_48h_if_stable';

export interface ObstetricHellpParams {
  gestationalAgeWeeks: number;
  plateletCountPerUl: number;
  astUL: number;
  altUL: number;
  ldhUL: number;
  totalBilirubinMgDl: number;
  schistocytesPresent: boolean;
  systolicBp: number;
  diastolicBp: number;
  epigastricRuqPain: boolean;
  hepaticSubcapsularHematomaSuspected: boolean;
  hepaticImagingPerformed: HepaticImagingFinding;
  dexamethasonePulseInitiated: boolean;
  magnesiumSulfateSeizureProphylaxis: boolean;
  plateletTransfusionAdministered: boolean;
  deliveryTimingPlan: DeliveryTimingPlan;
}

export interface ObstetricHellpResult {
  mississippiClass: MississippiClass;
  mississippiClassLabel: string;
  tennesseeClassification: TennesseeClassification;
  tennesseeClassificationLabel: string;
  isCompleteHellp: boolean;
  isSevereHemolysis: boolean;
  isSevereTransaminitis: boolean;
  isPlateletTransfusionIndicated: boolean;
  plateletTransfusionThresholdMessage: string;
  hepaticComplicationRisk: 'emergency_rupture' | 'high_contained_hematoma' | 'moderate_hepatic_capsular_distension' | 'low';
  hepaticComplicationLabel: string;
  dexamethasoneDirectives: string[];
  magnesiumSulfateDirectives: string[];
  deliveryDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_crash_delivery_or_rupture' | 'urgent_inpatient_icu_stabilization' | 'surveillance_and_recovery';
  urgencyTierLabel: string;
}

export type ObstetricHellpEvaluationResult = ObstetricHellpResult;

export function evaluateObstetricHellp(params: ObstetricHellpParams): ObstetricHellpResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const dexamethasoneDirectives: string[] = [];
  const magnesiumSulfateDirectives: string[] = [];
  const deliveryDirectives: string[] = [];

  const isSevereHemolysis = params.ldhUL >= 600 || params.totalBilirubinMgDl >= 1.2 || params.schistocytesPresent;
  const isSevereTransaminitis = params.astUL >= 70 || params.altUL >= 70;

  // 1. Mississippi Triple-Class Staging
  let mississippiClass: MississippiClass = 'unclassified_normal_platelets';
  let mississippiClassLabel = 'Unclassified (Platelets > 150,000 /µL)';

  if (params.plateletCountPerUl < 50000 && (params.astUL >= 70 || params.altUL >= 70) && params.ldhUL >= 600) {
    mississippiClass = 'class_1_severe_thrombocytopenia';
    mississippiClassLabel = 'Mississippi Class 1 (Severe: Platelets < 50,000 /µL)';
    alerts.push('CRITICAL ALERT: Mississippi Class 1 HELLP. Extreme maternal risk for DIC, hepatic infarction, and intracranial hemorrhage.');
  } else if (
    params.plateletCountPerUl >= 50000 &&
    params.plateletCountPerUl < 100000 &&
    (params.astUL >= 70 || params.altUL >= 70) &&
    params.ldhUL >= 600
  ) {
    mississippiClass = 'class_2_moderate_thrombocytopenia';
    mississippiClassLabel = 'Mississippi Class 2 (Moderate: Platelets 50,000 - 99,000 /µL)';
    alerts.push('WARNING: Mississippi Class 2 HELLP. High risk of rapid progression to Class 1. Intensive ICU monitoring mandatory.');
  } else if (
    params.plateletCountPerUl >= 100000 &&
    params.plateletCountPerUl < 150000 &&
    (params.astUL >= 40 || params.altUL >= 40) &&
    params.ldhUL >= 600
  ) {
    mississippiClass = 'class_3_mild_thrombocytopenia';
    mississippiClassLabel = 'Mississippi Class 3 (Mild: Platelets 100,000 - 149,000 /µL)';
    recommendations.push('Mississippi Class 3 HELLP: Follow laboratory values Q6-8h to catch downward platelet kinetic velocity.');
  }

  // 2. Tennessee Criteria Classification
  let tennesseeClassification: TennesseeClassification = 'no_hellp_syndrome';
  let tennesseeClassificationLabel = 'No Diagnostic HELLP Syndrome';
  let isCompleteHellp = false;

  const hasThrombocytopenia = params.plateletCountPerUl < 100000;
  if (isSevereHemolysis && isSevereTransaminitis && hasThrombocytopenia) {
    tennesseeClassification = 'complete_hellp_syndrome';
    tennesseeClassificationLabel = 'Complete HELLP Syndrome (Tennessee Criteria)';
    isCompleteHellp = true;
  } else if (!hasThrombocytopenia && isSevereTransaminitis && isSevereHemolysis) {
    tennesseeClassification = 'partial_hellp_hel';
    tennesseeClassificationLabel = 'Partial HELLP (Hemolysis + Elevated Liver Enzymes)';
  } else if (hasThrombocytopenia && isSevereTransaminitis && !isSevereHemolysis) {
    tennesseeClassification = 'partial_hellp_ellp';
    tennesseeClassificationLabel = 'Partial HELLP (Elevated Liver Enzymes + Low Platelets)';
  }

  // 3. Platelet Transfusion Criteria
  let isPlateletTransfusionIndicated = false;
  let plateletTransfusionThresholdMessage = '';

  if (params.plateletCountPerUl < 20000) {
    isPlateletTransfusionIndicated = true;
    plateletTransfusionThresholdMessage = 'Platelets < 20,000 /µL: Transfuse 1-2 adult apheresis units immediately regardless of delivery route due to spontaneous hemorrhage risk.';
    alerts.push('EMERGENCY: Platelet count < 20,000 /µL carries spontaneous intracranial/visceral bleeding risk. Immediate transfusion indicated.');
  } else if (params.plateletCountPerUl < 50000) {
    isPlateletTransfusionIndicated = true;
    plateletTransfusionThresholdMessage = 'Platelets 20,000 - 49,000 /µL: Transfuse immediately prior to Cesarean section or operative delivery (target > 50,000 /µL for surgical hemostasis).';
    recommendations.push('Platelets < 50,000 /µL: General anesthesia mandated for Cesarean delivery. Neuraxial anesthesia contraindicated.');
  } else {
    plateletTransfusionThresholdMessage = 'Platelet count ≥ 50,000 /µL: Routine platelet transfusion not indicated for Cesarean unless active microvascular surgical oozing.';
  }

  // 4. Hepatic Complication Staging
  let hepaticComplicationRisk: 'emergency_rupture' | 'high_contained_hematoma' | 'moderate_hepatic_capsular_distension' | 'low' = 'low';
  let hepaticComplicationLabel = 'Low Hepatic Complication Risk';

  if (params.hepaticImagingPerformed === 'hepatic_rupture_hemoperitoneum') {
    hepaticComplicationRisk = 'emergency_rupture';
    hepaticComplicationLabel = 'EMERGENCY: Hepatic Rupture with Hemoperitoneum';
    alerts.push('CATASTROPHIC ALERT: Hepatic rupture with active hemoperitoneum. Immediate surgical laparotomy, hepatic packing, Massive Transfusion Protocol (MTP), and vascular surgery consult.');
  } else if (
    params.hepaticImagingPerformed === 'subcapsular_hematoma_contained' ||
    params.hepaticSubcapsularHematomaSuspected
  ) {
    hepaticComplicationRisk = 'high_contained_hematoma';
    hepaticComplicationLabel = 'High Risk: Subcapsular Hepatic Hematoma';
    alerts.push('WARNING: Subcapsular hepatic hematoma identified/suspected. Strictly avoid abdominal palpation or fundal pressure. Perform serial ultrasound/CT.');
  } else if (params.epigastricRuqPain) {
    hepaticComplicationRisk = 'moderate_hepatic_capsular_distension';
    hepaticComplicationLabel = 'Moderate Risk: Hepatic Capsular Distension / Ischemia';
    recommendations.push('Epigastric or RUQ pain indicates Glisson capsule distension or hepatic sinusoid fibrin microthrombosis. Obtain urgent hepatic ultrasound.');
  }

  // 5. Directives
  // Dexamethasone pulse
  if (mississippiClass === 'class_1_severe_thrombocytopenia' || params.dexamethasonePulseInitiated) {
    dexamethasoneDirectives.push('High-dose Dexamethasone pulse therapy: Dexamethasone 10 mg IV every 12 hours for 2 doses, then 5 mg IV every 12 hours for 2 doses.');
    dexamethasoneDirectives.push('Accelerates platelet recovery, shortens ICU stay, and improves hepatic transaminase kinetics in Mississippi Class 1.');
  }

  // Magnesium sulfate
  magnesiumSulfateDirectives.push('IV Magnesium Sulfate loading dose: 4 to 6 g IV over 20 minutes, followed by 1 to 2 g/hr continuous infusion for eclampsia seizure prophylaxis.');
  magnesiumSulfateDirectives.push('Continue MgSO4 infusion throughout labor and for at least 24 to 48 hours postpartum until clear clinical improvement and diuresis established.');

  // Delivery directives
  if (params.gestationalAgeWeeks >= 34.0 || isCompleteHellp || hepaticComplicationRisk !== 'low') {
    deliveryDirectives.push(`Gestational age ${params.gestationalAgeWeeks}w or severe HELLP: Prompt delivery is definitive therapy. Prolonged expectant management contraindicated.`);
  } else {
    deliveryDirectives.push('Gestational age < 34 weeks with stable maternal status: 24-48h steroid window with Betamethasone 12 mg IM Q24h x 2 for fetal lung maturity under ICU monitoring.');
  }

  // 6. Urgency Tier
  let urgencyTier: 'emergency_crash_delivery_or_rupture' | 'urgent_inpatient_icu_stabilization' | 'surveillance_and_recovery' =
    'urgent_inpatient_icu_stabilization';
  let urgencyTierLabel = 'Urgent Inpatient ICU Stabilization';

  if (
    hepaticComplicationRisk === 'emergency_rupture' ||
    params.deliveryTimingPlan === 'immediate_crash_delivery_under_2h' ||
    params.plateletCountPerUl < 20000
  ) {
    urgencyTier = 'emergency_crash_delivery_or_rupture';
    urgencyTierLabel = 'EMERGENCY: Immediate Crash Delivery / Hemostatic Rescue';
  } else if (params.plateletCountPerUl >= 100000 && !isCompleteHellp) {
    urgencyTier = 'surveillance_and_recovery';
    urgencyTierLabel = 'Surveillance & Postpartum Recovery Phase';
  }

  return {
    mississippiClass,
    mississippiClassLabel,
    tennesseeClassification,
    tennesseeClassificationLabel,
    isCompleteHellp,
    isSevereHemolysis,
    isSevereTransaminitis,
    isPlateletTransfusionIndicated,
    plateletTransfusionThresholdMessage,
    hepaticComplicationRisk,
    hepaticComplicationLabel,
    dexamethasoneDirectives,
    magnesiumSulfateDirectives,
    deliveryDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
