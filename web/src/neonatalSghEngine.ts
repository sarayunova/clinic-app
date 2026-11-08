// Pure TypeScript calculation engine for Neonatal Subgaleal Hemorrhage (SGH) & Emergent Resuscitation Protocol
// Guidelines: AAP / British Association of Perinatal Medicine (BAPM) Framework on SGH Management

export interface NeonatalSghParams {
  birthWeightKg: number;
  initialHeadCircumferenceCm: number;
  currentHeadCircumferenceCm: number;
  heartRateBpm: number;
  bloodPressureSys?: number;
  capillaryRefillSeconds?: number;
  swellingCrossesSutures: boolean;
  swellingFluctuantPitting: boolean;
  periorbitalEcchymosis?: boolean;
  earDisplacement?: boolean;
  pallorSevere: boolean;
  vacuumCupPopoffs?: number;
  hematocritInitialPct?: number;
  hematocritLowestPct?: number;
  fibrinogenMgDl?: number;
  plateletCount?: number;
}

export interface NeonatalSghResult {
  hcIncreaseCm: number;
  estimatedOccultBloodLossMl: number;
  totalCirculatingVolumeMl: number;
  estimatedTotalBloodVolumeMl: number;
  circulatingVolumeLossPct: number;
  shockIndex?: number;
  shockSeverityTier: 'compensated_tachycardia' | 'uncompensated_hypotensive_shock' | 'life_threatening_circulatory_collapse';
  shockState: 'compensated_tachycardia' | 'uncompensated_hypotensive_shock' | 'life_threatening_circulatory_collapse';
  shockSeverityTierLabel: string;
  isHighRiskSgh: boolean;
  isSghConfirmed: boolean;
  mtpGuidance: {
    mtpIndicated: boolean;
    prbcDoseMl: number;
    prbcVolumeMl: number;
    ffpDoseMl: number;
    ffpVolumeMl: number;
    cryoprecipitateDoseMl: number;
    cryoprecipitateVolumeMl: number;
    plateletDoseMl: number;
    plateletVolumeMl: number;
  };
  recommendations: string[];
  alerts: string[];
}

export type NeonatalSghEvaluationResult = NeonatalSghResult;

export function evaluateNeonatalSgh(params: NeonatalSghParams): NeonatalSghResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];

  // 1. Head Circumference Expansion & Occult Blood Loss
  // Clinical validation: Each 1 cm increase in head circumference represents ~38 to 40 mL of blood in the loose subaponeurotic space.
  const hcIncrease = Math.max(0, Number((params.currentHeadCircumferenceCm - params.initialHeadCircumferenceCm).toFixed(1)));
  const occultBloodLossMl = Math.round(hcIncrease * 38.0);

  // Normal neonatal circulating blood volume: ~80 mL/kg
  const totalVolume = Math.round(params.birthWeightKg * 80.0);
  const volumeLossPct = totalVolume > 0 ? Number(((occultBloodLossMl / totalVolume) * 100).toFixed(1)) : 0;

  // 2. Shock Index & Hemodynamic Stratification
  let shockIndex: number | undefined = undefined;
  if (params.bloodPressureSys && params.bloodPressureSys > 0) {
    shockIndex = Number((params.heartRateBpm / params.bloodPressureSys).toFixed(2));
  }

  let shockSeverityTier: 'compensated_tachycardia' | 'uncompensated_hypotensive_shock' | 'life_threatening_circulatory_collapse' = 'compensated_tachycardia';
  let shockSeverityTierLabel = 'Compensated Tachycardia / Early SGH Suspicion';

  const isCollapse =
    volumeLossPct >= 40.0 ||
    (params.bloodPressureSys !== undefined && params.bloodPressureSys < 40) ||
    (params.capillaryRefillSeconds !== undefined && params.capillaryRefillSeconds > 5.0) ||
    (params.hematocritLowestPct !== undefined && params.hematocritLowestPct < 20.0);

  const isUncompensated =
    volumeLossPct >= 20.0 ||
    (params.bloodPressureSys !== undefined && params.bloodPressureSys < 55) ||
    (params.capillaryRefillSeconds !== undefined && params.capillaryRefillSeconds >= 3.0) ||
    params.heartRateBpm > 175 ||
    params.pallorSevere;

  if (isCollapse) {
    shockSeverityTier = 'life_threatening_circulatory_collapse';
    shockSeverityTierLabel = 'Life-Threatening Circulatory Collapse (Exsanguinating SGH)';
    alerts.push('CRITICAL EMERGENCY: Subgaleal hemorrhage with CIRCULATORY COLLAPSE and catastrophic blood volume loss (>40%). Immediate MTP activation mandatory.');
  } else if (isUncompensated) {
    shockSeverityTier = 'uncompensated_hypotensive_shock';
    shockSeverityTierLabel = 'Uncompensated Hypotensive Shock (Significant Subaponeurotic Bleeding)';
    alerts.push('CRITICAL OCCULT BLOOD LOSS: Hypotension, marked pallor, or volume loss ≥20%. Rapid fluid resuscitation and blood crossmatching required.');
  }

  // 3. Physical Exam Validation for Subgaleal vs Cephalohematoma
  const isCrossSuture = params.swellingCrossesSutures;
  const isFluctuant = params.swellingFluctuantPitting;
  const isHighRiskSgh = isCrossSuture && isFluctuant;

  if (!isCrossSuture) {
    alerts.push('DIFFERENTIAL NOTE: Swelling bounded by suture lines is more suggestive of cephalohematoma than subgaleal hemorrhage. Monitor closely for extension.');
  } else {
    recommendations.push('Fluid wave crosses cranial suture lines into neck/orbit, confirming subgaleal anatomical space involvement.');
  }

  if (params.earDisplacement || params.periorbitalEcchymosis) {
    alerts.push('Subaponeurotic blood tracking noted into facial tissue (orbital ecchymosis / ear displacement). High risk of massive expansion.');
  }

  // 4. Massive Transfusion Protocol (MTP) & Coagulopathy Correction
  const mtpIndicated = isCollapse || isUncompensated || volumeLossPct >= 25.0;

  // Doses: PRBC 15 mL/kg, FFP 10 mL/kg, Cryo 5-10 mL/kg, Platelets 10 mL/kg
  const prbcDoseMl = Math.round(params.birthWeightKg * 15.0);
  const ffpDoseMl = Math.round(params.birthWeightKg * 10.0);
  const cryoprecipitateDoseMl = Math.round(params.birthWeightKg * 8.0);
  const plateletDoseMl = Math.round(params.birthWeightKg * 10.0);

  if (mtpIndicated) {
    recommendations.push(`Activate Neonatal MASSIVE TRANSFUSION PROTOCOL (MTP): Infuse Emergency O-negative / Type-specific PRBCs ${prbcDoseMl} mL (${15} mL/kg) stat.`);
    recommendations.push(`Coagulopathy prevention: Administer FFP ${ffpDoseMl} mL and Cryoprecipitate ${cryoprecipitateDoseMl} mL early to reverse consumptive coagulopathy.`);
  }

  if (params.fibrinogenMgDl !== undefined && params.fibrinogenMgDl < 150) {
    alerts.push(`HYPOFIBRINOGENEMIA: Serum fibrinogen ${params.fibrinogenMgDl} mg/dL (<150 mg/dL). Infuse Cryoprecipitate ${cryoprecipitateDoseMl} mL stat.`);
  }

  // 5. Monitoring Directives
  recommendations.push('Measure Head Circumference (HC) every 1 to 2 hours using the same non-elastic measuring tape. Each +1 cm = ~38 mL blood loss.');
  recommendations.push('Avoid direct scalp pressure or compression dressings as they can displace blood into intracranial or periorbital tissue.');

  const isSghConfirmed = params.swellingCrossesSutures && params.swellingFluctuantPitting;
  if (!isSghConfirmed) {
    recommendations.push('Re-examine mass: Swelling limited by sutures suggests Cephalohematoma or Caput Succedaneum rather than true Subgaleal Hemorrhage.');
  }

  return {
    hcIncreaseCm: hcIncrease,
    estimatedOccultBloodLossMl: occultBloodLossMl,
    totalCirculatingVolumeMl: totalVolume,
    estimatedTotalBloodVolumeMl: totalVolume,
    circulatingVolumeLossPct: volumeLossPct,
    shockIndex,
    shockSeverityTier,
    shockState: shockSeverityTier,
    shockSeverityTierLabel,
    isHighRiskSgh,
    isSghConfirmed,
    mtpGuidance: {
      mtpIndicated,
      prbcDoseMl,
      prbcVolumeMl: prbcDoseMl,
      ffpDoseMl,
      ffpVolumeMl: ffpDoseMl,
      cryoprecipitateDoseMl,
      cryoprecipitateVolumeMl: cryoprecipitateDoseMl,
      plateletDoseMl,
      plateletVolumeMl: plateletDoseMl,
    },
    recommendations,
    alerts,
  };
}
