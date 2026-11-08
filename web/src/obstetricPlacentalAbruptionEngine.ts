// Pure TypeScript calculation engine for Obstetric Placental Abruption (Abruptio Placentae) & Consumptive Coagulopathy Protocol
// Guidelines: ACOG Practice Bulletin No. 183 / RCOG Green-top Guideline on Antepartum Hemorrhage

export interface ObstetricPlacentalAbruptionParams {
  gestationalAgeWeeks: number;
  maternalParity: number;
  vaginalBleedingSeverity:
    | 'concealed_no_external_bleeding'
    | 'mild_spotting'
    | 'moderate_bleeding'
    | 'severe_massive_hemorrhage';
  abdominalPainCharacter: 'none' | 'mild_cramping' | 'severe_constant_knife_like';
  uterineTonus: 'normal_soft' | 'increased_hypertonic' | 'tetanic_woody_hard';
  fetalHeartRateStatus:
    | 'reassuring_category_1'
    | 'indeterminate_category_2'
    | 'severe_bradycardia_category_3'
    | 'intrauterine_fetal_demise_confirmed';
  maternalSystolicBp: number;
  maternalDiastolicBp: number;
  maternalHeartRate: number;
  serumFibrinogenMgDl: number;
  plateletCount: number;
  hemoglobinGDl: number;
  ptInr?: number;
  ultrasoundRetroplacentalHematoma:
    | 'none_visualized_abruption_not_excluded'
    | 'marginal_collection'
    | 'retroplacental_hematoma_present'
    | 'couvelaire_uterus_suspected';
}

export interface ObstetricPlacentalAbruptionResult {
  pageClassificationGrade:
    | 'grade_0_retrospective_asymptomatic'
    | 'grade_1_mild_no_fetal_compromise'
    | 'grade_2_moderate_fetal_distress_live'
    | 'grade_3_severe_maternal_shock_demise_or_dic';
  pageClassificationGradeLabel: string;
  isConsumptiveCoagulopathyPresent: boolean;
  mtpActivated: boolean;
  shockIndex: number;
  deliveryModeIndicated:
    | 'emergent_crash_cesarean'
    | 'urgent_cesarean_transfer'
    | 'augmented_vaginal_delivery_under_monitoring'
    | 'conservative_surveillance_preterm';
  deliveryModeIndicatedLabel: string;
  bloodProductRequirements: {
    prbcUnits: number;
    ffpUnits: number;
    cryoprecipitatePools: number;
    targetFibrinogenMgDl: number;
  };
  resuscitationDirectives: string[];
  recommendations: string[];
  alerts: string[];
}

export type ObstetricPlacentalAbruptionEvaluationResult = ObstetricPlacentalAbruptionResult;

export function evaluateObstetricPlacentalAbruption(
  params: ObstetricPlacentalAbruptionParams
): ObstetricPlacentalAbruptionResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const resuscitationDirectives: string[] = [];

  // Shock Index = HR / SBP
  const shockIndexRaw = params.maternalSystolicBp > 0 ? params.maternalHeartRate / params.maternalSystolicBp : 1.0;
  const shockIndex = Math.round(shockIndexRaw * 100) / 100;

  // Hypofibrinogenemia assessment (Normal pregnancy fibrinogen is 400-600 mg/dL; < 200 is severe, < 150 is critical)
  const isConsumptiveCoagulopathyPresent =
    params.serumFibrinogenMgDl < 200 ||
    params.plateletCount < 100000 ||
    (params.ptInr !== undefined && params.ptInr >= 1.5);

  const isMaternalShock = shockIndex >= 0.9 || params.maternalSystolicBp < 90 || params.maternalHeartRate > 120;
  const isSevereAbdominalPain = params.abdominalPainCharacter === 'severe_constant_knife_like';
  const isTetanicUterus = params.uterineTonus === 'tetanic_woody_hard';
  const isFetalDistress =
    params.fetalHeartRateStatus === 'severe_bradycardia_category_3' ||
    params.fetalHeartRateStatus === 'indeterminate_category_2';
  const isFetalDemise = params.fetalHeartRateStatus === 'intrauterine_fetal_demise_confirmed';

  // Page Classification
  let pageClassificationGrade:
    | 'grade_0_retrospective_asymptomatic'
    | 'grade_1_mild_no_fetal_compromise'
    | 'grade_2_moderate_fetal_distress_live'
    | 'grade_3_severe_maternal_shock_demise_or_dic' = 'grade_1_mild_no_fetal_compromise';
  let pageClassificationGradeLabel = 'Page Grade 1: Mild Abruption (Minimal vaginal bleeding, normal fetal heart)';

  if (isFetalDemise || isMaternalShock || params.serumFibrinogenMgDl < 150) {
    pageClassificationGrade = 'grade_3_severe_maternal_shock_demise_or_dic';
    pageClassificationGradeLabel = 'Page Grade 3: Severe Abruption with Maternal Shock, Coagulopathy or Fetal Demise';
  } else if (isFetalDistress || isTetanicUterus || params.vaginalBleedingSeverity === 'severe_massive_hemorrhage') {
    pageClassificationGrade = 'grade_2_moderate_fetal_distress_live';
    pageClassificationGradeLabel = 'Page Grade 2: Moderate Abruption with Live Fetus & Acute Fetal Distress';
  } else if (params.vaginalBleedingSeverity === 'mild_spotting' && !isSevereAbdominalPain) {
    pageClassificationGrade = 'grade_1_mild_no_fetal_compromise';
    pageClassificationGradeLabel = 'Page Grade 1: Mild Abruption without Fetal Compromise';
  }

  // Delivery Mode Decision
  let deliveryModeIndicated:
    | 'emergent_crash_cesarean'
    | 'urgent_cesarean_transfer'
    | 'augmented_vaginal_delivery_under_monitoring'
    | 'conservative_surveillance_preterm' = 'urgent_cesarean_transfer';
  let deliveryModeIndicatedLabel = 'Urgent Cesarean Delivery';
  let mtpActivated = false;

  if (isFetalDemise) {
    // In IUFD without active maternal exsanguination, vaginal delivery is preferred to avoid surgical laparotomy during severe coagulopathy
    if (params.vaginalBleedingSeverity === 'severe_massive_hemorrhage' || isMaternalShock) {
      deliveryModeIndicated = 'emergent_crash_cesarean';
      deliveryModeIndicatedLabel = 'Emergent Laparotomy / Cesarean: Refractory Maternal Hemorrhagic Shock';
      mtpActivated = true;
      alerts.push('MATERNAL RESCUE LAPAROTOMY: Catastrophic hemorrhage mandates surgical delivery and uterine compression / hysterectomy despite fetal demise.');
    } else {
      deliveryModeIndicated = 'augmented_vaginal_delivery_under_monitoring';
      deliveryModeIndicatedLabel = 'Guided Vaginal Delivery with Aggressive Coagulopathy Correction';
      recommendations.push(
        'Intrauterine fetal demise confirmed: Avoid operative hysterotomy if hemodynamically stable. Actively correct hypofibrinogenemia and augment vaginal delivery with amniotomy and oxytocin.'
      );
    }
  } else if (params.fetalHeartRateStatus === 'severe_bradycardia_category_3' || isTetanicUterus || isMaternalShock) {
    deliveryModeIndicated = 'emergent_crash_cesarean';
    deliveryModeIndicatedLabel = 'CRASH CESAREAN SECTION: Immediate Operating Room Transfer (Category 1)';
    mtpActivated = isConsumptiveCoagulopathyPresent || isMaternalShock;
    alerts.push('CRASH CESAREAN: Severe fetal bradycardia or maternal circulatory collapse from placental detachment. Mobilize obstetrics, anesthesia, and neonatology stat.');
  } else if (params.gestationalAgeWeeks >= 37.0 || isFetalDistress) {
    deliveryModeIndicated = 'urgent_cesarean_transfer';
    deliveryModeIndicatedLabel = 'Urgent Cesarean Transfer: Term Gestation or Fetal Non-Reassurance';
  } else {
    deliveryModeIndicated = 'conservative_surveillance_preterm';
    deliveryModeIndicatedLabel = 'Inpatient Conservative Surveillance (Preterm, Stable Maternal & Fetal Status)';
    recommendations.push(
      'Preterm abruption: Administer Betamethasone 12 mg IM (2 doses 24h apart), continuous EFM, and maternal HDU observation.'
    );
  }

  // Blood Product Requirements
  let prbcUnits = 0;
  let ffpUnits = 0;
  let cryoprecipitatePools = 0;

  if (mtpActivated || isConsumptiveCoagulopathyPresent || isMaternalShock) {
    prbcUnits = 4;
    ffpUnits = 4;
    cryoprecipitatePools = 2; // 2 pools = 10 units of cryoprecipitate to replenish fibrinogen
  } else if (params.serumFibrinogenMgDl < 250) {
    cryoprecipitatePools = 1;
  }

  // Alerts & Directives
  if (params.serumFibrinogenMgDl < 150) {
    alerts.push(
      `CRITICAL HYPOFIBRINOGENEMIA (${params.serumFibrinogenMgDl} mg/dL): Severe consumptive coagulopathy. Infuse cryoprecipitate stat to target fibrinogen > 200 mg/dL.`
    );
  }

  if (params.vaginalBleedingSeverity === 'concealed_no_external_bleeding') {
    alerts.push('CONCEALED ABRUPTION WARNING: Severe pain and woody uterine rigidity with minimal visible bleeding indicates concealed retroplacental hemorrhage (20% of cases). Do not underestimate maternal blood loss.');
  }

  if (params.ultrasoundRetroplacentalHematoma === 'none_visualized_abruption_not_excluded') {
    recommendations.push(
      'Ultrasound Sensitivity Limit: Normal ultrasound does NOT rule out placental abruption (sensitivity only ~50%). Diagnosis is primarily clinical.'
    );
  }

  resuscitationDirectives.push('Establish two wide-bore (14-16 gauge) IV access lines and draw stat type & crossmatch 4 units PRBC, fibrinogen, CBC, PT/INR.');
  resuscitationDirectives.push('Administer high-flow oxygen (10-15 L/min via non-rebreather mask) and position in left lateral tilt to prevent aortocaval compression.');
  resuscitationDirectives.push('Target serum fibrinogen > 200 mg/dL using Cryoprecipitate (each 10-unit pool raises fibrinogen by ~50-70 mg/dL).');
  resuscitationDirectives.push('Send maternal blood for Kleihauer-Betke test and administer Anti-D immune globulin (300 mcg) if mother is Rh-negative.');

  return {
    pageClassificationGrade,
    pageClassificationGradeLabel,
    isConsumptiveCoagulopathyPresent,
    mtpActivated,
    shockIndex,
    deliveryModeIndicated,
    deliveryModeIndicatedLabel,
    bloodProductRequirements: {
      prbcUnits,
      ffpUnits,
      cryoprecipitatePools,
      targetFibrinogenMgDl: 200,
    },
    resuscitationDirectives,
    recommendations,
    alerts,
  };
}
