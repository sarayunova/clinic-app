// Pure TypeScript Clinical Calculation Engine: Neonatal Hypomagnesemia & Electrolyte Refractory Seizures Protocol
// References: AAP Guidelines; Nelson Textbook of Pediatrics (21st Ed); Gomella's Neonatology (8th Ed)

export type NeuromuscularSymptom =
  | 'none_asymptomatic'
  | 'jitteriness_tremors'
  | 'hyperreflexia_clonus'
  | 'tetany_carpopedal'
  | 'clonic_seizures_refractory'
  | 'apnea_bradycardia';

export type EcgAbnormality =
  | 'none'
  | 'prolonged_pr_interval'
  | 'widened_qrs'
  | 'ventricular_arrhythmias_torsades'
  | 'sinus_bradycardia';

export type HypomagnesemiaSeverity =
  | 'normal_eumagnesemic'
  | 'mild_hypomagnesemia'
  | 'severe_critical_hypomagnesemia';

export interface NeonatalHypomagnesemiaInput {
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  chronologicalAgeHours: number;
  currentWeightKg: number;

  serumMagnesiumMgDl: number; // Cutoff: < 1.5 mg/dL diagnostic; < 1.2 mg/dL critical
  serumCalciumMgDl?: number;
  ionizedCalciumMmolL?: number;
  serumPotassiumMeqL?: number;

  neuromuscularSymptoms: NeuromuscularSymptom;
  seizuresObserved: boolean;
  calciumRefractoryTetany: boolean;
  ecgAbnormalities: EcgAbnormality;
  renalImpairmentPresent: boolean;
}

export interface MagnesiumDoseResult {
  bolusVolume50PctMl: number;
  elementalMgMg: number;
  elementalMgMeq: number;
  maintenanceDailyVolumeMl: number;
  infusionInstructions: string;
}

export interface NeonatalHypomagnesemiaEvaluation {
  isHypomagnesemic: boolean;
  severityTier: HypomagnesemiaSeverity;
  severityLabel: string;
  concurrentHypocalcemia: boolean;
  calciumRefractoryMechanismActive: boolean;

  bolusRequired: boolean;
  doseCalculation: MagnesiumDoseResult;
  toxicityMonitoringAlerts: string[];
  clinicalSafetyDirectives: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Calculates 50% Magnesium Sulfate (MgSO4) bolus and maintenance doses.
 * 50% MgSO4 contains 500 mg/mL (approx 4.06 mEq/mL of Mg).
 * Standard emergency dose: 0.2 mL/kg (100 mg/kg = ~0.8 mEq/kg).
 * If renal impairment: dose is halved to 0.1 mL/kg (50 mg/kg).
 */
export function calculateMagnesiumBolusDose(
  weightKg: number,
  hasRenalImpairment = false,
): MagnesiumDoseResult {
  const doseFactor = hasRenalImpairment ? 0.1 : 0.2;
  const bolusMl = Math.round(weightKg * doseFactor * 100) / 100;
  const mgSo4Mg = bolusMl * 500;
  const elementalMgMeq = Math.round(bolusMl * 4.06 * 100) / 100;
  const maintenanceMl = Math.round(weightKg * 0.1 * 100) / 100; // 0.1 mL/kg/day

  const infusionInstructions = `Dilute ${bolusMl} mL of 50% MgSO4 with 5-10 mL of D5W or 0.9% Normal Saline (minimum 1:4 dilution, target concentration ≤ 1-2%). Infuse IV slowly over 30 to 60 minutes under continuous ECG monitoring. NEVER administer as a rapid IV push (risks acute hypotension, third-degree heart block, and cardiorespiratory arrest).`;

  return {
    bolusVolume50PctMl: bolusMl,
    elementalMgMg: mgSo4Mg,
    elementalMgMeq,
    maintenanceDailyVolumeMl: maintenanceMl,
    infusionInstructions,
  };
}

/**
 * Evaluates neonatal hypomagnesemia, concurrent hypocalcemia refractoriness, and ECG risks.
 */
export function evaluateNeonatalHypomagnesemia(
  input: NeonatalHypomagnesemiaInput,
): NeonatalHypomagnesemiaEvaluation {
  const isHypomagnesemic = input.serumMagnesiumMgDl < 1.5;
  let severityTier: HypomagnesemiaSeverity = 'normal_eumagnesemic';
  let severityLabel = 'Eumagnesemic (Serum Mg ≥ 1.5 mg/dL)';

  if (input.serumMagnesiumMgDl < 1.2) {
    severityTier = 'severe_critical_hypomagnesemia';
    severityLabel = 'Critical Hypomagnesemia (Serum Mg < 1.2 mg/dL)';
  } else if (input.serumMagnesiumMgDl < 1.5) {
    severityTier = 'mild_hypomagnesemia';
    severityLabel = 'Mild to Moderate Hypomagnesemia (Serum Mg 1.2 - 1.49 mg/dL)';
  }

  // Evaluate concurrent hypocalcemia
  const isPreterm = input.gestationalAgeWeeks < 37.0;
  const caCutoff = isPreterm ? 7.0 : 8.0;
  const concurrentHypocalcemia =
    (input.serumCalciumMgDl !== undefined && input.serumCalciumMgDl < caCutoff) ||
    (input.ionizedCalciumMmolL !== undefined && input.ionizedCalciumMmolL < 1.0);

  const calciumRefractoryMechanismActive =
    isHypomagnesemic &&
    (input.calciumRefractoryTetany || concurrentHypocalcemia || input.seizuresObserved);

  const doseCalculation = calculateMagnesiumBolusDose(
    input.currentWeightKg,
    input.renalImpairmentPresent,
  );

  const bolusRequired =
    isHypomagnesemic &&
    (input.seizuresObserved ||
      input.neuromuscularSymptoms !== 'none_asymptomatic' ||
      severityTier === 'severe_critical_hypomagnesemia' ||
      calciumRefractoryMechanismActive ||
      input.ecgAbnormalities !== 'none');

  const toxicityMonitoringAlerts: string[] = [
    'Monitor deep tendon reflexes (patellar/biceps): Loss of reflexes is the earliest clinical herald of hypermagnesemia toxicity (serum Mg > 4-5 mg/dL).',
    'Continuous ECG lead II surveillance: Watch for PR prolongation, QRS widening, or bradyarrhythmias during and after infusion.',
    'Monitor spontaneous respiratory drive: Severe hypermagnesemia causes neuromuscular blockade and curare-like respiratory depression.',
    'ANTIDOTE READINESS: Keep 10% Calcium Gluconate (1.0 mL/kg = 100 mg/kg IV over 5-10 min) immediately accessible at bedside as the specific physiological antidote for acute magnesium intoxication.',
  ];

  const clinicalSafetyDirectives: string[] = [
    'PTH RESISTANCE PHYSIOLOGY: Magnesium is a mandatory cofactor for adenylate cyclase and G-protein coupled parathyroid hormone (PTH) release. Hypocalcemia will remain completely refractory to IV calcium supplementation until hypomagnesemia is corrected.',
    'If seizures occur despite standard anticonvulsants (phenobarbital/levetiracetam), treat immediately as electrolyte-refractory neonatal seizure with 50% MgSO4.',
    input.renalImpairmentPresent
      ? 'CAUTION RENAL IMPAIRMENT: Magnesium is exclusively cleared by the kidneys. Bolus dose has been reduced by 50%, and maintenance infusion should be held until urinary output exceeds 1.0 mL/kg/hr.'
      : 'Renal function adequate: Standard weight-based dosing applied.',
  ];

  const criticalActionPlan: string[] = [];
  if (bolusRequired) {
    criticalActionPlan.push(
      `ADMINISTER 50% MgSO4 BOLUS: ${doseCalculation.bolusVolume50PctMl} mL (${doseCalculation.elementalMgMg} mg) diluted in D5W/NS over 30-60 min via slow IV infusion.`,
    );
  }
  if (calciumRefractoryMechanismActive) {
    criticalActionPlan.push(
      'Manage concurrent hypocalcemia: Give IV Calcium Gluconate 10% (1-2 mL/kg) concurrent with or immediately following magnesium replacement.',
    );
  }
  if (input.seizuresObserved) {
    criticalActionPlan.push(
      'Refractory Neonatal Seizure Protocol: Maintain continuous video-EEG/aEEG monitoring and maintain airway patency.',
    );
  }
  criticalActionPlan.push(
    'Re-check serum magnesium and ionized calcium 2 to 4 hours post-infusion; transition to maintenance (0.1 mL/kg/day) once stabilized.',
  );

  const summary = `Neonatal Hypomagnesemia Evaluation: Serum Mg ${input.serumMagnesiumMgDl} mg/dL (${severityLabel}). ${concurrentHypocalcemia ? 'CONCURRENT HYPOCALCEMIA PRESENT (PTH Refractory).' : 'Normocalcemic.'} ${bolusRequired ? `EMERGENCY 50% MgSO4 BOLUS INDICATED (${doseCalculation.bolusVolume50PctMl} mL).` : 'Surveillance and oral maintenance indicated.'}`;

  return {
    isHypomagnesemic,
    severityTier,
    severityLabel,
    concurrentHypocalcemia,
    calciumRefractoryMechanismActive,
    bolusRequired,
    doseCalculation,
    toxicityMonitoringAlerts,
    clinicalSafetyDirectives,
    summary,
    criticalActionPlan,
  };
}
