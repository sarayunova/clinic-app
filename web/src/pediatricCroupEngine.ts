// Pure TypeScript Clinical Calculation Engine: Pediatric Croup (Laryngotracheobronchitis) & Acute Airway Obstruction Protocol
// References: Westley Croup Score (1978); AAP Clinical Guidelines; Canadian Paediatric Society; NICE Croup Guidelines

export type CroupSeverityTier =
  | 'mild_croup_score_le_2'
  | 'moderate_croup_score_3_to_5'
  | 'severe_croup_score_6_to_11'
  | 'impending_respiratory_failure_ge_12';

export type DexamethasoneRoute = 'oral' | 'im' | 'iv';

export interface PediatricCroupInput {
  ageMonths: number;
  weightKg: number;

  // Westley Croup Score (0 to 17 points)
  inspiratoryStridorScore: 0 | 1 | 2; // 0=None, 1=With agitation/crying, 2=At rest
  retractionsScore: 0 | 1 | 2 | 3; // 0=None, 1=Mild, 2=Moderate, 3=Severe
  airEntryScore: 0 | 1 | 2; // 0=Normal, 1=Decreased, 2=Markedly decreased
  cyanosisScore: 0 | 4 | 5; // 0=None, 4=With agitation, 5=At rest
  consciousnessScore: 0 | 5; // 0=Normal/Alert, 5=Disoriented/Restless/Depressed

  // Vital Signs
  heartRateBpm: number;
  respiratoryRate: number;
  spo2Percent: number;

  barkingCoughPresent?: boolean;
  hoarsenessPresent?: boolean;
}

export interface WestleyScoreCalculation {
  stridorScore: number;
  retractionsScore: number;
  airEntryScore: number;
  cyanosisScore: number;
  consciousnessScore: number;
  totalScore: number;
  severityTier: CroupSeverityTier;
  severityLabel: string;
}

export interface PediatricCroupEvaluation {
  westley: WestleyScoreCalculation;

  // Dexamethasone Dosing
  dexamethasoneDoseMg: number;
  dexamethasoneRoute: DexamethasoneRoute;
  dexamethasoneGuidance: string;

  // Nebulized Epinephrine Protocol
  nebulizedEpinephrineIndicated: boolean;
  epinephrineNebulizationDoseMl?: number;
  nebulizationProtocol?: string;
  reboundObservationHoursRequired: number;

  criticalAirwayWarning?: string;
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Calculates Westley Croup Score and stratifies severity tier.
 */
export function calculateWestleyScore(
  stridor: 0 | 1 | 2,
  retractions: 0 | 1 | 2 | 3,
  airEntry: 0 | 1 | 2,
  cyanosis: 0 | 4 | 5,
  consciousness: 0 | 5,
): WestleyScoreCalculation {
  const totalScore = stridor + retractions + airEntry + cyanosis + consciousness;

  let severityTier: CroupSeverityTier = 'mild_croup_score_le_2';
  let severityLabel = 'Mild Croup (Score ≤ 2)';

  if (totalScore >= 12) {
    severityTier = 'impending_respiratory_failure_ge_12';
    severityLabel = 'Impending Respiratory Failure (Score ≥ 12)';
  } else if (totalScore >= 6) {
    severityTier = 'severe_croup_score_6_to_11';
    severityLabel = 'Severe Croup (Score 6 - 11)';
  } else if (totalScore >= 3) {
    severityTier = 'moderate_croup_score_3_to_5';
    severityLabel = 'Moderate Croup (Score 3 - 5)';
  }

  return {
    stridorScore: stridor,
    retractionsScore: retractions,
    airEntryScore: airEntry,
    cyanosisScore: cyanosis,
    consciousnessScore: consciousness,
    totalScore,
    severityTier,
    severityLabel,
  };
}

/**
 * Calculates single-dose Dexamethasone based on weight (0.15 - 0.6 mg/kg, max 16 mg).
 */
export function calculateDexamethasoneDose(
  weightKg: number,
  tier: CroupSeverityTier,
): { doseMg: number; route: DexamethasoneRoute } {
  // 0.15 mg/kg for mild, 0.6 mg/kg for moderate/severe
  const mgPerKg = tier === 'mild_croup_score_le_2' ? 0.15 : 0.6;
  const calculated = weightKg * mgPerKg;
  const doseMg = Math.min(16.0, Math.round(calculated * 100) / 100);

  const route: DexamethasoneRoute =
    tier === 'impending_respiratory_failure_ge_12' ? 'iv' : 'oral';

  return { doseMg, route };
}

/**
 * Calculates L-Epinephrine 1:1000 nebulization dose (0.5 mL/kg, max 5.0 mL).
 */
export function calculateNebulizedEpinephrineDose(weightKg: number): number {
  const calculated = weightKg * 0.5;
  return Math.min(5.0, Math.max(1.0, Math.round(calculated * 10) / 10));
}

/**
 * Evaluates pediatric croup severity, Westley scoring, corticosteroid and nebulized epinephrine regimens.
 */
export function evaluatePediatricCroup(input: PediatricCroupInput): PediatricCroupEvaluation {
  const westley = calculateWestleyScore(
    input.inspiratoryStridorScore,
    input.retractionsScore,
    input.airEntryScore,
    input.cyanosisScore,
    input.consciousnessScore,
  );

  const { doseMg, route } = calculateDexamethasoneDose(input.weightKg, westley.severityTier);

  const nebulizedEpinephrineIndicated =
    westley.totalScore >= 3 || input.inspiratoryStridorScore === 2;

  let epinephrineNebulizationDoseMl: number | undefined;
  let nebulizationProtocol: string | undefined;

  if (nebulizedEpinephrineIndicated) {
    epinephrineNebulizationDoseMl = calculateNebulizedEpinephrineDose(input.weightKg);
    nebulizationProtocol =
      `Nebulized L-Epinephrine 1:1000 Protocol: Administer ${epinephrineNebulizationDoseMl} mL (1 mg/mL) mixed with 3 mL normal saline via nebulizer over 10-15 minutes with high-flow oxygen. Rapid onset within 10-30 minutes with airway mucosal vasoconstriction. May repeat q20min for severe distress under continuous cardiac monitoring.`;
  }

  const dexamethasoneGuidance =
    `Systemic Corticosteroid Therapy: Administer single dose of Dexamethasone ${doseMg} mg (${route.toUpperCase()}). Indicated for all severity tiers of viral croup. Reduces subglottic laryngeal edema, lowers hospital admission rates, and shortens ED length of stay.`;

  let criticalAirwayWarning: string | undefined;
  if (westley.severityTier === 'impending_respiratory_failure_ge_12') {
    criticalAirwayWarning =
      'CRITICAL AIRWAY ALERT: Westley score >= 12 (exhaustion, lethargy, decreased air entry, or cyanosis). Impending complete upper airway obstruction. Call Pediatric Anesthesia and PICU immediately. Prepare for emergency endotracheal intubation with an endotracheal tube 0.5 - 1.0 mm smaller than normal for age. Do NOT agitate child.';
  }

  const reboundObservationHoursRequired = nebulizedEpinephrineIndicated ? 4.0 : 2.0;

  const criticalActionPlan: string[] = [];
  criticalActionPlan.push(`Administer single-dose Dexamethasone: ${doseMg} mg ${route.toUpperCase()}`);

  if (nebulizedEpinephrineIndicated) {
    criticalActionPlan.push(`Nebulized Epinephrine 1:1000: ${epinephrineNebulizationDoseMl} mL in 3 mL NS with blow-by oxygen`);
    criticalActionPlan.push(`Mandatory rebound surveillance: Observe for at least ${reboundObservationHoursRequired} hours post-nebulization before discharge`);
  }

  if (westley.severityTier === 'impending_respiratory_failure_ge_12') {
    criticalActionPlan.push('URGENT: Mobilize difficult airway team; prepare ETT (0.5 mm downsized) and surgical cricothyroidotomy equipment');
  } else {
    criticalActionPlan.push('Minimize distress: keep infant in parent\'s arms, avoid painful invasive procedures that precipitate acute airway spasm');
  }

  const summary = `Pediatric Croup (${westley.severityLabel}): Westley Score ${westley.totalScore}/17. Dexamethasone ${doseMg} mg ${route.toUpperCase()}.${nebulizedEpinephrineIndicated ? ` Nebulized Epinephrine (${epinephrineNebulizationDoseMl} mL) indicated with ${reboundObservationHoursRequired}h observation.` : ' Outpatient recovery anticipated.'}`;

  return {
    westley,
    dexamethasoneDoseMg: doseMg,
    dexamethasoneRoute: route,
    dexamethasoneGuidance,
    nebulizedEpinephrineIndicated,
    epinephrineNebulizationDoseMl,
    nebulizationProtocol,
    reboundObservationHoursRequired,
    criticalAirwayWarning,
    summary,
    criticalActionPlan,
  };
}
