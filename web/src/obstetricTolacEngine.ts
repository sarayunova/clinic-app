// Pure TypeScript calculation engine for Obstetric Trial of Labor After Cesarean (TOLAC) & Impending Uterine Rupture Protocol
// Guidelines: ACOG Practice Bulletin No. 205 / RCOG Green-top Guideline No. 45

export interface ObstetricTolacParams {
  gestationalAgeWeeks: number;
  maternalAge: number;
  maternalBmi: number;
  priorCesareanCount: number;
  priorUterineIncisionType: 'low_transverse' | 'unknown_low_transverse_presumed' | 'classical_vertical' | 'inverted_t_or_j' | 'prior_transmural_myomectomy';
  priorVaginalDelivery: 'prior_vbac' | 'prior_vaginal_before_cesarean' | 'no_prior_vaginal_delivery';
  indicationForPriorCesarean: string;
  interdeliveryIntervalMonths: number;
  bishopScore: number;
  efmAbnormality: 'normal_category_1' | 'indeterminate_category_2' | 'variable_decelerations_recurrent' | 'prolonged_deceleration' | 'persistent_bradycardia_lt_90';
  iupcLossOfUterineTone: boolean;
  acuteScarTenderness: boolean;
  vaginalBleedingFresh: boolean;
  cessationOfContractions: boolean;
  presentingPartRetraction: boolean;
}

export interface ObstetricTolacResult {
  grobmanVbacSuccessPct: number;
  hasContraindications: boolean;
  contraindicationList: string[];
  ruptureRiskTier: 'standard_tolac_candidate' | 'elevated_rupture_risk' | 'impending_or_active_uterine_rupture';
  ruptureRiskTierLabel: string;
  isCrashCesareanIndicated: boolean;
  monitoringChecklist: string[];
  recommendations: string[];
  alerts: string[];
}

export function evaluateObstetricTolac(params: ObstetricTolacParams): ObstetricTolacResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const contraindicationList: string[] = [];
  const monitoringChecklist: string[] = [];

  // 1. Evaluate Absolute & Relative Contraindications
  if (params.priorUterineIncisionType === 'classical_vertical') {
    contraindicationList.push('Absolute Contraindication: Prior Classical (vertical fundal) uterine incision carries 4-10% rupture risk.');
  }
  if (params.priorUterineIncisionType === 'inverted_t_or_j') {
    contraindicationList.push('Absolute Contraindication: Prior Inverted T or J extension uterine incision.');
  }
  if (params.priorUterineIncisionType === 'prior_transmural_myomectomy') {
    contraindicationList.push('High-risk Contraindication: Prior transmural uterine surgery or extensive myomectomy entering endometrial cavity.');
  }
  if (params.priorCesareanCount >= 3) {
    contraindicationList.push('Caution: Three or more previous cesarean deliveries.');
  }

  const hasContraindications = contraindicationList.length > 0;
  if (hasContraindications) {
    alerts.push(`TOLAC CONTRAINDICATION: ${contraindicationList.join('; ')}. Elective Repeat Cesarean Delivery (ERCD) recommended.`);
  }

  // 2. Grobman VBAC Success Probability Estimation (Validated Multi-variable Model)
  let baseScore = 65.0;

  // Prior vaginal birth / prior VBAC is the single strongest positive predictor (+15-20%)
  if (params.priorVaginalDelivery === 'prior_vbac') {
    baseScore += 18.0;
  } else if (params.priorVaginalDelivery === 'prior_vaginal_before_cesarean') {
    baseScore += 12.0;
  }

  // Indication for prior cesarean
  const priorInd = params.indicationForPriorCesarean.toLowerCase();
  if (priorInd.includes('breech') || priorInd.includes('herpes') || priorInd.includes('placenta') || priorInd.includes('non-recurrent')) {
    baseScore += 8.0; // Non-recurrent indication
  } else if (priorInd.includes('arrest') || priorInd.includes('failure to progress') || priorInd.includes('cpd')) {
    baseScore -= 10.0; // Dystocia / labor arrest carries lower success rate
  }

  // Bishop score at labor admission
  if (params.bishopScore >= 8) baseScore += 8.0;
  else if (params.bishopScore <= 4) baseScore -= 8.0;

  // Maternal BMI
  if (params.maternalBmi >= 35) baseScore -= 10.0;
  else if (params.maternalBmi >= 30) baseScore -= 5.0;

  // Maternal Age
  if (params.maternalAge >= 35) baseScore -= 5.0;

  // Clamp probability between 15% and 95%
  const grobmanVbacSuccessPct = Math.max(15, Math.min(95, Math.round(baseScore)));

  // 3. Impending or Active Uterine Rupture Detection (Pathognomonic Triad)
  const hasSevereBradycardia = params.efmAbnormality === 'persistent_bradycardia_lt_90' || params.efmAbnormality === 'prolonged_deceleration';
  const hasLossOfTone = params.iupcLossOfUterineTone || params.cessationOfContractions;
  const hasScarPain = params.acuteScarTenderness;
  const hasBleeding = params.vaginalBleedingFresh;
  const hasRetraction = params.presentingPartRetraction;

  const ruptureSignsCount = [hasSevereBradycardia, hasLossOfTone, hasScarPain, hasBleeding, hasRetraction].filter(Boolean).length;

  let ruptureRiskTier: 'standard_tolac_candidate' | 'elevated_rupture_risk' | 'impending_or_active_uterine_rupture' = 'standard_tolac_candidate';
  let ruptureRiskTierLabel = 'Eligible for TOLAC with Continuous Fetal & Uterine Monitoring';
  let isCrashCesareanIndicated = false;

  if (ruptureSignsCount >= 2 || hasRetraction || (hasSevereBradycardia && (hasScarPain || hasLossOfTone))) {
    ruptureRiskTier = 'impending_or_active_uterine_rupture';
    ruptureRiskTierLabel = 'EMERGENCY: Impending or Active Uterine Rupture Suspected';
    isCrashCesareanIndicated = true;
    alerts.push('CRITICAL SURGICAL EMERGENCY: Pathognomonic triad of uterine rupture detected (fetal bradycardia, scar tenderness, loss of uterine tone). Mobilize immediate Category-1 Crash Cesarean within 30 minutes.');
  } else if (hasContraindications || params.interdeliveryIntervalMonths < 18 || params.priorCesareanCount >= 2 || params.efmAbnormality === 'variable_decelerations_recurrent') {
    ruptureRiskTier = 'elevated_rupture_risk';
    ruptureRiskTierLabel = 'Elevated Uterine Rupture Risk (Short interval, multiple scars, or category-2 tracing)';
    alerts.push('HIGH-RISK TOLAC: Interdelivery interval <18 months, recurrent cesareans, or EFM abnormality. Continuous intrauterine/electronic monitoring required.');
  }

  // 4. Monitoring Checklist & Recommendations
  monitoringChecklist.push('Continuous Electronic Fetal Monitoring (EFM) throughout active labor (fetal heart rate abnormality is the earliest sign of rupture in >70% of cases).');
  monitoringChecklist.push('Avoid Prostaglandins (Misoprostol / Dinoprostone is ABSOLUTELY CONTRAINDICATED in TOLAC due to high rupture risk).');
  monitoringChecklist.push('Maintain active IV access with 16-18G cannula, type and screen with crossmatch capability.');
  monitoringChecklist.push('Immediate operating theater, obstetrician, anesthesiologist, and pediatric resuscitation team immediately available.');

  if (isCrashCesareanIndicated) {
    recommendations.push('CALL CODE CESAREAN: Immediate transfer to theater; intrauterine resuscitation with maternal left lateral positioning, IV fluid bolus, and stop any oxytocin.');
  } else if (hasContraindications) {
    recommendations.push('Counsel patient on substantial rupture risks and recommend planned scheduled cesarean delivery.');
  } else {
    recommendations.push(`Calculated VBAC success probability: ${grobmanVbacSuccessPct}%. Proceed with closely monitored trial of labor.`);
  }

  return {
    grobmanVbacSuccessPct,
    hasContraindications,
    contraindicationList,
    ruptureRiskTier,
    ruptureRiskTierLabel,
    isCrashCesareanIndicated,
    monitoringChecklist,
    recommendations,
    alerts,
  };
}
