/**
 * Pediatric Acute Respiratory Distress Syndrome (PARDS) & PALICC-2 Ventilation Engine
 * Reference: PALICC-2 Guidelines (Pediatric Critical Care Medicine, 2023) and PALS 2025.
 */

export interface PardsEvaluationInput {
  ageMonths: number;
  weightKg: number;
  predictedBodyWeightKg?: number;
  ventilationMode: 'invasive_mechanical' | 'non_invasive_cpap_bipap' | 'high_frequency_oscillation';
  mapCmh2o: number;
  peepCmh2o: number;
  plateauPressureCmh2o?: number;
  fio2Percent: number; // 21 to 100
  pao2Mmhg?: number;
  spo2Percent: number;
  measuredTidalVolumeMl?: number;
  abgPh?: number;
}

export interface PardsEvaluationResult {
  oxygenationIndex: number | null;
  oxygenSaturationIndex: number | null;
  pardsSeverity: 'none_at_risk' | 'mild' | 'moderate' | 'severe';
  drivingPressureCmh2o: number | null;
  isDrivingPressureSafe: boolean;
  isPlateauPressureSafe: boolean;
  targetTidalVolumeMinMl: number;
  targetTidalVolumeMaxMl: number;
  tidalVolumePerKg: number | null;
  pronePositioningIndicated: boolean;
  neuromuscularBlockadeIndicated: boolean;
  permissiveHypercapniaAdvice: string;
}

/**
 * Calculates Oxygenation Index (OI)
 * Formula: OI = (Mean Airway Pressure [cmH2O] * FiO2 [%]) / PaO2 [mmHg]
 */
export function calculateOxygenationIndex(mapCmh2o: number, fio2Percent: number, pao2Mmhg?: number): number | null {
  if (!pao2Mmhg || pao2Mmhg <= 0 || mapCmh2o <= 0 || fio2Percent <= 0) {
    return null;
  }
  const oi = (mapCmh2o * fio2Percent) / pao2Mmhg;
  return Math.round(oi * 10) / 10;
}

/**
 * Calculates Oxygen Saturation Index (OSI)
 * Formula: OSI = (Mean Airway Pressure [cmH2O] * FiO2 [%]) / SpO2 [%]
 * Used when arterial blood gas PaO2 is not available and SpO2 <= 97%
 */
export function calculateOxygenSaturationIndex(mapCmh2o: number, fio2Percent: number, spo2Percent: number): number | null {
  if (spo2Percent <= 0 || mapCmh2o <= 0 || fio2Percent <= 0) {
    return null;
  }
  // PALICC-2 specifies OSI is reliable when SpO2 <= 97%
  const clampedSpo2 = Math.min(spo2Percent, 100);
  const osi = (mapCmh2o * fio2Percent) / clampedSpo2;
  return Math.round(osi * 10) / 10;
}

/**
 * Calculates driving pressure (Delta P = Pplat - PEEP)
 */
export function calculateDrivingPressure(plateauPressureCmh2o?: number, peepCmh2o = 5.0): number | null {
  if (plateauPressureCmh2o === undefined || plateauPressureCmh2o === null || plateauPressureCmh2o <= 0) {
    return null;
  }
  return Math.round((plateauPressureCmh2o - peepCmh2o) * 10) / 10;
}

/**
 * Evaluates PARDS severity and ventilation lung-protective stewardship per PALICC-2
 */
export function evaluatePediatricPards(input: PardsEvaluationInput): PardsEvaluationResult {
  const weight = input.predictedBodyWeightKg && input.predictedBodyWeightKg > 0 ? input.predictedBodyWeightKg : input.weightKg;
  const oi = calculateOxygenationIndex(input.mapCmh2o, input.fio2Percent, input.pao2Mmhg);
  const osi = calculateOxygenSaturationIndex(input.mapCmh2o, input.fio2Percent, input.spo2Percent);
  const drivingPressure = calculateDrivingPressure(input.plateauPressureCmh2o, input.peepCmh2o);

  let pardsSeverity: PardsEvaluationResult['pardsSeverity'] = 'none_at_risk';

  if (oi !== null) {
    if (oi >= 16.0) {
      pardsSeverity = 'severe';
    } else if (oi >= 8.0) {
      pardsSeverity = 'moderate';
    } else if (oi >= 4.0) {
      pardsSeverity = 'mild';
    } else {
      pardsSeverity = 'none_at_risk';
    }
  } else if (osi !== null) {
    if (osi >= 12.3) {
      pardsSeverity = 'severe';
    } else if (osi >= 7.5) {
      pardsSeverity = 'moderate';
    } else if (osi >= 5.0) {
      pardsSeverity = 'mild';
    } else {
      pardsSeverity = 'none_at_risk';
    }
  }

  // PALICC-2 targets: 3 - 6 mL/kg for poor respiratory compliance (moderate/severe), 5 - 8 mL/kg for preserved/mild
  const isSevereOrMod = pardsSeverity === 'moderate' || pardsSeverity === 'severe';
  const minMlPerKg = isSevereOrMod ? 3.0 : 5.0;
  const maxMlPerKg = isSevereOrMod ? 6.0 : 8.0;

  const targetMin = Math.round(minMlPerKg * weight * 10) / 10;
  const targetMax = Math.round(maxMlPerKg * weight * 10) / 10;

  const vtPerKg = input.measuredTidalVolumeMl && weight > 0 ? Math.round((input.measuredTidalVolumeMl / weight) * 10) / 10 : null;

  const isDrivingPressureSafe = drivingPressure !== null ? drivingPressure < 15.0 : true;
  const isPlateauPressureSafe = input.plateauPressureCmh2o !== undefined && input.plateauPressureCmh2o > 0 ? input.plateauPressureCmh2o <= 28.0 : true;

  const pronePositioningIndicated = pardsSeverity === 'moderate' || pardsSeverity === 'severe';
  const neuromuscularBlockadeIndicated = pardsSeverity === 'severe';

  let permissiveHypercapniaAdvice = 'Maintain normal arterial blood gas pH 7.35 - 7.45.';
  if (isSevereOrMod) {
    permissiveHypercapniaAdvice = 'Permissive hypercapnia accepted: Target pH 7.20 - 7.30 to avoid high tidal volume and barotrauma (unless intracranial hypertension or severe pulmonary hypertension).';
  }

  return {
    oxygenationIndex: oi,
    oxygenSaturationIndex: osi,
    pardsSeverity,
    drivingPressureCmh2o: drivingPressure,
    isDrivingPressureSafe,
    isPlateauPressureSafe,
    targetTidalVolumeMinMl: targetMin,
    targetTidalVolumeMaxMl: targetMax,
    tidalVolumePerKg: vtPerKg,
    pronePositioningIndicated,
    neuromuscularBlockadeIndicated,
    permissiveHypercapniaAdvice,
  };
}
