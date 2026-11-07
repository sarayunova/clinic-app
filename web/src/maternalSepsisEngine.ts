// Maternal Critical Care Sepsis (SOS / qSOFA) & Obstetric Shock Index Engine
// Reference: Albright et al. Sepsis in Obstetrics Score (SOS), Surviving Sepsis Campaign / FIGO / ACOG Consensus,
// and Obstetric Shock Index (Nathan et al.).

export interface MaternalSepsisInput {
  temperatureCelsius: number;
  systolicBpMmhg: number;
  diastolicBpMmhg: number;
  heartRateBpm: number;
  respiratoryRateBpm: number;
  spo2Percent: number;
  wbcCountPerUl?: number; // e.g. 16500 (16.5 x 10^3)
  immatureBandsPercent?: number; // e.g. 12%
  serumLactateMmolL?: number; // e.g. 2.4
}

export interface MaternalSepsisAssessmentResult {
  sosScore: number;
  sosRiskLevel: 'low_risk' | 'intermediate_risk' | 'severe_septic_shock';
  sosRiskDescription: string;
  obstetricShockIndex: number;
  shockIndexTier: 'normal_lt_0_9' | 'elevated_warning_0_9_to_1_4' | 'critical_shock_gte_1_4';
  shockIndexLabel: string;
  meanArterialPressureMmhg: number;
  mapTargetMet: boolean;
  icuTransferRecommended: boolean;
  hourOneBundleChecklist: string[];
  fluidResuscitationRecommendations: string[];
  antimicrobialGuidance: string[];
}

export function calculateMaternalSepsis(input: MaternalSepsisInput): MaternalSepsisAssessmentResult {
  const {
    temperatureCelsius: t,
    systolicBpMmhg: sbp,
    diastolicBpMmhg: dbp,
    heartRateBpm: hr,
    respiratoryRateBpm: rr,
    spo2Percent: spo2,
    wbcCountPerUl,
    immatureBandsPercent,
    serumLactateMmolL: lactate,
  } = input;

  let sos = 0;

  // 1. Temperature (°C)
  if (t < 35.0 || t >= 39.0) sos += 3;
  else if ((t >= 35.0 && t <= 35.9) || (t >= 38.5 && t <= 38.9)) sos += 2;
  else if ((t >= 36.0 && t <= 36.4) || (t >= 38.0 && t <= 38.4)) sos += 1;

  // 2. Systolic BP (mmHg)
  if (sbp < 90) sos += 3;
  else if (sbp >= 90 && sbp <= 99) sos += 2;
  else if (sbp >= 100 && sbp <= 109) sos += 1;

  // 3. Heart Rate (bpm)
  if (hr >= 120) sos += 3;
  else if (hr >= 110 && hr <= 119) sos += 2;
  else if (hr >= 90 && hr <= 109) sos += 1;

  // 4. Respiratory Rate (breaths/min)
  if (rr >= 30) sos += 3;
  else if (rr >= 25 && rr <= 29) sos += 2;
  else if (rr >= 20 && rr <= 24) sos += 1;

  // 5. SpO2 (%)
  if (spo2 < 90) sos += 3;
  else if (spo2 >= 90 && spo2 <= 92) sos += 2;
  else if (spo2 >= 93 && spo2 <= 95) sos += 1;

  // 6. WBC Count (converted to x 10^3/uL)
  if (wbcCountPerUl !== undefined && wbcCountPerUl > 0) {
    const wbcK = wbcCountPerUl > 500 ? wbcCountPerUl / 1000 : wbcCountPerUl;
    if (wbcK < 4.0 || wbcK >= 25.0) sos += 3;
    else if (wbcK >= 20.0 && wbcK <= 24.9) sos += 2;
    else if (wbcK >= 15.0 && wbcK <= 19.9) sos += 1;
  }

  // 7. Immature Bands (%)
  if (immatureBandsPercent !== undefined && immatureBandsPercent >= 10) {
    sos += 3;
  }

  // 8. Serum Lactate (mmol/L)
  if (lactate !== undefined) {
    if (lactate >= 4.0) sos += 4;
    else if (lactate >= 2.0) sos += 2;
  }

  // Risk Classification
  let sosRiskLevel: 'low_risk' | 'intermediate_risk' | 'severe_septic_shock';
  let sosRiskDescription: string;
  let icuTransferRecommended = false;

  if (sos < 6) {
    sosRiskLevel = 'low_risk';
    sosRiskDescription = `Low Sepsis Risk (SOS ${sos}): Probability of ICU admission < 1%. Continue standard ward observation.`;
  } else if (sos <= 7) {
    sosRiskLevel = 'intermediate_risk';
    sosRiskDescription = `Intermediate Sepsis Risk (SOS ${sos}): Probability of ICU admission ~10%. Alert Obstetric Senior & initiate Hour-1 Sepsis Bundle.`;
  } else {
    sosRiskLevel = 'severe_septic_shock';
    sosRiskDescription = `High Sepsis Risk / Severe Sepsis (SOS ${sos} ≥ 8): Probability of ICU admission > 40%. Mandatory Maternal ICU / HDU resuscitation protocol!`;
    icuTransferRecommended = true;
  }

  // Shock Index & MAP
  const obstetricShockIndex = Number((hr / Math.max(1, sbp)).toFixed(2));
  let shockIndexTier: 'normal_lt_0_9' | 'elevated_warning_0_9_to_1_4' | 'critical_shock_gte_1_4';
  let shockIndexLabel: string;

  if (obstetricShockIndex < 0.9) {
    shockIndexTier = 'normal_lt_0_9';
    shockIndexLabel = `Normal Shock Index (${obstetricShockIndex} < 0.9)`;
  } else if (obstetricShockIndex < 1.4) {
    shockIndexTier = 'elevated_warning_0_9_to_1_4';
    shockIndexLabel = `Elevated Shock Index (${obstetricShockIndex} between 0.9 and 1.4): Warning for occult hypovolemia or uncompensated septic shock!`;
  } else {
    shockIndexTier = 'critical_shock_gte_1_4';
    shockIndexLabel = `CRITICAL SHOCK INDEX (${obstetricShockIndex} ≥ 1.4): Imminent cardiovascular collapse / massive uncompensated shock!`;
    icuTransferRecommended = true;
  }

  const meanArterialPressureMmhg = Number(((2 * dbp + sbp) / 3).toFixed(1));
  const mapTargetMet = meanArterialPressureMmhg >= 65.0;

  const hourOneBundleChecklist: string[] = [
    '1. Blood Cultures: Draw 2 sets of peripheral blood cultures PRIOR to initiating antibiotics.',
    '2. Empiric IV Antibiotics: Administer broad-spectrum coverage within 60 minutes of triage.',
    '3. Serum Lactate: Measure baseline venous or arterial lactate; repeat at 2-4 hours if elevated (> 2 mmol/L).',
    '4. Crystalloid Resuscitation: Infuse 30 mL/kg balanced crystalloid for hypotension (SBP < 90 or MAP < 65) or lactate ≥ 4 mmol/L.',
    '5. Vasopressors: Initiate Norepinephrine infusion if MAP remains < 65 mmHg despite volume resuscitation.',
  ];

  const fluidResuscitationRecommendations: string[] = [
    'Target MAP ≥ 65 mmHg and urine output ≥ 0.5 mL/kg/hour.',
    'Place Foley catheter with urometer for continuous hourly urine output measurement.',
    'In pregnant patients, maintain continuous left uterine displacement to prevent aortocaval compression.',
  ];

  const antimicrobialGuidance: string[] = [
    'Chorioamnionitis / Endometritis: IV Ampicillin (2g Q6H) + Gentamicin (5 mg/kg Q24H) + Clindamycin (900 mg Q8H) or Metronidazole.',
    'Severe Sepsis / Septic Shock: IV Piperacillin-Tazobactam 4.5g Q6H OR IV Meropenem 1g Q8H + IV Vancomycin (if MRSA suspected).',
  ];

  return {
    sosScore: sos,
    sosRiskLevel,
    sosRiskDescription,
    obstetricShockIndex,
    shockIndexTier,
    shockIndexLabel,
    meanArterialPressureMmhg,
    mapTargetMet,
    icuTransferRecommended,
    hourOneBundleChecklist,
    fluidResuscitationRecommendations,
    antimicrobialGuidance,
  };
}
