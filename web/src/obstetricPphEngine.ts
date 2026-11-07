/**
 * Obstetric Postpartum Hemorrhage (PPH), Gravimetric QBL & WHO E-MOTIVE Decision Engine
 * Reference: WHO Recommendations on E-MOTIVE Package (2023), FIGO PPH Guidelines (2022),
 * ACOG Practice Bulletin No. 183, and WOMAN Trial.
 */

export interface PphScreenInput {
  deliveryMode: 'vaginal' | 'cesarean';
  drapeBloodVolumeMl: number;
  swabSpongeWeightNetG: number;
  sbp: number;
  dbp: number;
  heartRate: number;
  maternalHypertensionHistory?: boolean;
  maternalAsthmaHistory?: boolean;
}

export interface PphEvaluationResult {
  cumulativeQblMl: number;
  shockIndex: number;
  isPphConfirmed: boolean;
  severityTier: 'normal_physiologic' | 'minor_pph' | 'major_pph' | 'severe_pph' | 'massive_pph';
  shockIndexInterpretation: string;
  contraindicatedDrugs: string[];
  safeUterotonicRecommendations: string[];
  emotiveBundleRequired: boolean;
  bakriTamponadeRecommended: boolean;
  mtpActivationAdvised: boolean;
}

/**
 * Calculates Quantitative Blood Loss (QBL) combining calibrated drape and gravimetric sponge weight.
 * In obstetrics, 1 gram of weighed gauze/sponge is equivalent to 1 mL of blood.
 */
export function calculateGravimetricQbl(drapeBloodVolumeMl: number, swabSpongeWeightNetG: number): number {
  const drape = drapeBloodVolumeMl > 0 ? drapeBloodVolumeMl : 0;
  const sponges = swabSpongeWeightNetG > 0 ? swabSpongeWeightNetG : 0;
  return Math.round((drape + sponges) * 10) / 10;
}

/**
 * Calculates Obstetric Shock Index (SI = Heart Rate / Systolic BP)
 */
export function calculateShockIndex(heartRate: number, sbp: number): number {
  if (sbp <= 0 || heartRate <= 0) {
    return 0;
  }
  return Math.round((heartRate / sbp) * 100) / 100;
}

/**
 * Validates uterotonic drug against maternal comorbidities (Hypertension, Asthma)
 */
export function checkUterotonicContraindications(
  maternalHypertension: boolean,
  maternalAsthma: boolean,
): { contraindicated: string[]; safe: string[] } {
  const contraindicated: string[] = [];
  const safe: string[] = ['Oxytocin (20-40 IU in 1000 mL RL @ 250 mL/hr)', 'Misoprostol 800 mcg sublingual/rectal'];

  if (maternalHypertension) {
    contraindicated.push('Methylergonovine / Ergometrine 0.2 mg IM (Contraindicated: Causes severe acute vasoconstriction & hypertensive crisis)');
  } else {
    safe.push('Methylergonovine 0.2 mg IM stat');
  }

  if (maternalAsthma) {
    contraindicated.push('Carboprost Tromethamine (15-methyl PGF2a) 250 mcg IM (Contraindicated: Causes bronchospasm & asthma exacerbation)');
  } else {
    safe.push('Carboprost (PGF2a) 250 mcg IM q15m (up to 8 doses)');
  }

  return { contraindicated, safe };
}

/**
 * Evaluates Postpartum Hemorrhage and generates WHO E-MOTIVE treatment bundle
 */
export function evaluateObstetricPph(input: PphScreenInput): PphEvaluationResult {
  const qbl = calculateGravimetricQbl(input.drapeBloodVolumeMl, input.swabSpongeWeightNetG);
  const si = calculateShockIndex(input.heartRate, input.sbp);

  const threshold = input.deliveryMode === 'cesarean' ? 1000.0 : 500.0;
  const isPphConfirmed = qbl >= threshold || si >= 0.9;

  let severityTier: PphEvaluationResult['severityTier'] = 'normal_physiologic';
  let shockIndexInterpretation = 'Normal obstetric hemodynamic ratio (SI < 0.9).';
  let emotiveBundleRequired = false;
  let bakriTamponadeRecommended = false;
  let mtpActivationAdvised = false;

  if (si >= 1.4) {
    shockIndexInterpretation = 'Critical hemodynamic collapse (SI >= 1.4). Severe decompensated hemorrhagic shock.';
  } else if (si >= 1.0) {
    shockIndexInterpretation = 'Severe shock (SI >= 1.0). High probability of blood transfusion requirement.';
  } else if (si >= 0.9) {
    shockIndexInterpretation = 'Abnormal obstetric shock index (SI >= 0.9). Early sign of uncompensated hypovolemia.';
  }

  if (qbl >= 2000 || si >= 1.4) {
    severityTier = 'massive_pph';
    emotiveBundleRequired = true;
    bakriTamponadeRecommended = true;
    mtpActivationAdvised = true;
  } else if (qbl >= 1500 || si >= 1.0) {
    severityTier = 'severe_pph';
    emotiveBundleRequired = true;
    bakriTamponadeRecommended = true;
    mtpActivationAdvised = true;
  } else if (qbl >= 1000) {
    severityTier = 'major_pph';
    emotiveBundleRequired = true;
    bakriTamponadeRecommended = true;
  } else if (isPphConfirmed) {
    severityTier = 'minor_pph';
    emotiveBundleRequired = true;
  }

  const { contraindicated, safe } = checkUterotonicContraindications(
    !!input.maternalHypertensionHistory,
    !!input.maternalAsthmaHistory,
  );

  return {
    cumulativeQblMl: qbl,
    shockIndex: si,
    isPphConfirmed,
    severityTier,
    shockIndexInterpretation,
    contraindicatedDrugs: contraindicated,
    safeUterotonicRecommendations: safe,
    emotiveBundleRequired,
    bakriTamponadeRecommended,
    mtpActivationAdvised,
  };
}
