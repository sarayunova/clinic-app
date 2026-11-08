// Pure TypeScript Clinical Calculation Engine: Pediatric Supraventricular Tachycardia (SVT) & Emergency Dysrhythmia Protocol
// References: AHA / AAP Pediatric Advanced Life Support (PALS 2020); Pediatric & Congenital Electrophysiology Society (PACES) Guidelines

export type QrsMorphology = 'narrow_complex_le_0_09s' | 'wide_complex_aberrancy_gt_0_09s';
export type HemodynamicStability = 'stable_compensated' | 'unstable_decompensated_shock';
export type VagalManeuverType = 'ice_bag_to_face_infant' | 'modified_valsalva_child' | 'none_unstable';
export type MaintenanceAntiarrhythmic =
  | 'none'
  | 'amiodarone_infusion'
  | 'procainamide_infusion'
  | 'esmolol_infusion'
  | 'oral_propranolol';

export interface PediatricSvtInput {
  ageMonths: number;
  weightKg: number;
  heartRateBpm: number;
  qrsDurationMs: number;
  qrsMorphology: QrsMorphology;
  rhythmRegularity: 'regular' | 'irregular';
  pWavesIdentifiable: boolean;

  // Stability & Perfusion
  hemodynamicStability: HemodynamicStability;
  capillaryRefillSeconds?: number;
  systolicBp?: number;
  alteredMentalStatus?: boolean;
  pulmonaryEdemaOrCrackles?: boolean;

  // Interventions attempted
  vagalAttempted?: VagalManeuverType;
  priorAdenosineDosesGiven?: number; // 0, 1, or 2
}

export interface PediatricSvtEvaluation {
  svtConfirmed: boolean;
  diagnosticExplanation: string;
  isInfant: boolean;
  rateThresholdBpm: number;
  rateExceedsThreshold: boolean;

  // Vagal Maneuver Guidance
  recommendedVagalManeuver: VagalManeuverType;
  vagalGuidance: string;

  // Adenosine Rapid Push Doses
  adenosineDose1Mg: number;
  adenosineDose2Mg: number;
  adenosineAdministrationProtocol: string;

  // Synchronized Electrical Cardioversion
  synchronizedCardioversionIndicated: boolean;
  initialCardioversionJoules: number; // 0.5 - 1.0 J/kg
  secondCardioversionJoules: number; // 2.0 J/kg
  cardioversionGuidance: string;

  // Maintenance & Advanced
  maintenanceAntiarrhythmicOptions: string;
  summary: string;
  criticalResuscitationSteps: string[];
}

/**
 * Calculates weight-based Adenosine rapid push dosing (max 6 mg 1st dose, max 12 mg 2nd dose).
 */
export function calculateAdenosineDoses(weightKg: number): { dose1Mg: number; dose2Mg: number } {
  // Dose 1: 0.1 mg/kg (max 6 mg)
  const calculatedDose1 = weightKg * 0.1;
  const dose1Mg = Math.min(6.0, Math.round(calculatedDose1 * 100) / 100);

  // Dose 2: 0.2 mg/kg (max 12 mg)
  const calculatedDose2 = weightKg * 0.2;
  const dose2Mg = Math.min(12.0, Math.round(calculatedDose2 * 100) / 100);

  return { dose1Mg, dose2Mg };
}

/**
 * Calculates weight-based synchronized electrical cardioversion energy (0.5 - 1.0 J/kg initial, 2.0 J/kg subsequent).
 */
export function calculateCardioversionJoules(weightKg: number): { initialJoules: number; secondJoules: number } {
  const initialJoules = Math.max(1, Math.round(weightKg * 1.0)); // 1.0 J/kg rounded to nearest integer
  const secondJoules = Math.max(2, Math.round(weightKg * 2.0)); // 2.0 J/kg
  return { initialJoules, secondJoules };
}

/**
 * Evaluates pediatric SVT presentation, stability, adenosine weight-adjusted rapid push, and synchronized cardioversion thresholds.
 */
export function evaluatePediatricSvt(input: PediatricSvtInput): PediatricSvtEvaluation {
  const isInfant = input.ageMonths < 12;
  const rateThresholdBpm = isInfant ? 220 : 180;
  const rateExceedsThreshold = input.heartRateBpm >= rateThresholdBpm;

  const isNarrowComplex = input.qrsMorphology === 'narrow_complex_le_0_09s';
  const isRegular = input.rhythmRegularity === 'regular';
  const noPWaves = !input.pWavesIdentifiable;

  // PALS diagnostic criteria: Sudden regular narrow tachycardia without distinct P waves at >= 220 (infant) or >= 180 (child)
  const svtConfirmed = rateExceedsThreshold && isRegular && noPWaves;

  let diagnosticExplanation = 'SVT Confirmed: Extreme narrow regular tachycardia without visible P waves, consistent with AVRT / AVNRT reentry.';
  if (!rateExceedsThreshold) {
    diagnosticExplanation = `Heart rate (${input.heartRateBpm} bpm) is below the classic PALS SVT cutoff (${rateThresholdBpm} bpm). Consider Sinus Tachycardia (secondary to fever, hypovolemia, pain) or accelerated nodal rhythm.`;
  } else if (!isRegular) {
    diagnosticExplanation = 'Irregular rhythm noted: Consider Atrial Fibrillation with rapid conduction or multifocal atrial tachycardia.';
  } else if (!noPWaves) {
    diagnosticExplanation = 'Clear normal P waves preceding each QRS suggest Sinus Tachycardia rather than SVT.';
  }

  const { dose1Mg, dose2Mg } = calculateAdenosineDoses(input.weightKg);
  const { initialJoules, secondJoules } = calculateCardioversionJoules(input.weightKg);

  const isUnstable = input.hemodynamicStability === 'unstable_decompensated_shock';
  const synchronizedCardioversionIndicated = isUnstable || (input.priorAdenosineDosesGiven !== undefined && input.priorAdenosineDosesGiven >= 2);

  // Vagal Maneuver Recommendation
  let recommendedVagalManeuver: VagalManeuverType = 'none_unstable';
  let vagalGuidance = 'Patient in decompensated shock: DO NOT delay cardioversion with vagal maneuvers.';

  if (!isUnstable) {
    if (isInfant) {
      recommendedVagalManeuver = 'ice_bag_to_face_infant';
      vagalGuidance = 'Infant Vagal Technique: Apply crushed ice in a plastic bag with water (slurry) firmly over the forehead and bridge of the nose for 15-20 seconds. Ensure mouth and nostrils are NOT occluded. Do NOT perform ocular pressure or carotid massage.';
    } else {
      recommendedVagalManeuver = 'modified_valsalva_child';
      vagalGuidance = 'Child Modified Valsalva: Have child blow into a 10 mL syringe to move the plunger for 15 seconds, followed immediately by laying supine with legs passively elevated to 45 degrees for 15 seconds.';
    }
  }

  const adenosineAdministrationProtocol =
    `Rapid IV Push Technique: Administer ${dose1Mg} mg (0.1 mg/kg) via large-bore proximal IV (antecubital or central line) using a two-syringe stopcock technique, followed IMMEDIATELY by a rapid 5-10 mL 0.9% normal saline flush. If no conversion within 1-2 minutes, administer 2nd dose of ${dose2Mg} mg (0.2 mg/kg). Continuous ECG recording active.`;

  const cardioversionGuidance =
    `Synchronized Electrical Cardioversion: Set defibrillator to SYNCHRONIZED mode (verify sync flags on every R wave). Deliver initial shock of ${initialJoules} Joules (1.0 J/kg). If SVT persists, escalate to ${secondJoules} Joules (2.0 J/kg). Provide procedural sedation / analgesia if clinical stability allows without delaying life-saving shock.`;

  const maintenanceAntiarrhythmicOptions =
    'Post-Conversion Maintenance: For recurrent SVT or refractory reentry, cardiology consultation for IV Amiodarone (5 mg/kg over 20-60 min) or IV Procainamide (15 mg/kg over 30-60 min). Propranolol (1-4 mg/kg/day divided q8h) for maintenance oral prophylaxis.';

  const criticalResuscitationSteps: string[] = [];
  if (isUnstable) {
    criticalResuscitationSteps.push('Immediate Synchronized Electrical Cardioversion (1 J/kg)');
    criticalResuscitationSteps.push('Attach continuous ECG, pulse oximetry, and defibrillator pads');
    criticalResuscitationSteps.push('High-flow 100% oxygen and secure vascular access');
    criticalResuscitationSteps.push('If vascular access is instantly available while prepping defibrillator, give Adenosine 0.1 mg/kg once without delaying shock');
  } else {
    criticalResuscitationSteps.push(`Attempt ${isInfant ? 'ice bag to face' : 'modified Valsalva'} while establishing proximal vascular access`);
    criticalResuscitationSteps.push(`Prepare Adenosine 1st dose: ${dose1Mg} mg with 10 mL saline flush`);
    criticalResuscitationSteps.push(`If no conversion, prepare Adenosine 2nd dose: ${dose2Mg} mg`);
    criticalResuscitationSteps.push('If refractory to 2 doses of Adenosine, prepare for synchronized cardioversion');
  }

  const summary = `Pediatric SVT (${input.heartRateBpm} bpm, ${isInfant ? 'Infant' : 'Child'}): ${isUnstable ? 'UNSTABLE SHOCK - SYNCHRONIZED CARDIOVERSION INDICATED.' : 'STABLE COMPENSATED - VAGAL MANEUVERS & ADENOSINE PROTOCOL.'}`;

  return {
    svtConfirmed,
    diagnosticExplanation,
    isInfant,
    rateThresholdBpm,
    rateExceedsThreshold,
    recommendedVagalManeuver,
    vagalGuidance,
    adenosineDose1Mg: dose1Mg,
    adenosineDose2Mg: dose2Mg,
    adenosineAdministrationProtocol,
    synchronizedCardioversionIndicated,
    initialCardioversionJoules: initialJoules,
    secondCardioversionJoules: secondJoules,
    cardioversionGuidance,
    maintenanceAntiarrhythmicOptions,
    summary,
    criticalResuscitationSteps,
  };
}
