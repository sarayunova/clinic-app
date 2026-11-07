// Pure TypeScript Clinical Calculation Engine: Pediatric Polytrauma, Pediatric Trauma Score (PTS) & Damage Control Resuscitation
// References: American College of Surgeons Committee on Trauma (ACS-COT); ATLS 10th Ed Pediatric Trauma; Tepas et al. J Trauma 1987

export type PtsMortalityTier =
  | 'critical_high_mortality_le_8'
  | 'moderate_potential_lethal_9_10'
  | 'minor_low_mortality_11_12';

export interface PediatricPolytraumaInput {
  weightKg: number;
  airwayStatus: 'normal' | 'maintainable' | 'unmaintainable_or_intubated';
  systolicBp: number;
  cnsStatus: 'awake' | 'obtunded_loc' | 'coma_decerebrate';
  skeletalInjury: 'none' | 'closed_fracture' | 'open_or_multiple_fractures';
  cutaneousInjury: 'none' | 'contusion_abrasion' | 'tissue_loss_or_penetrating';
  initialGcs?: number;
  fastExamPositive?: boolean;
}

export interface PediatricPolytraumaEvaluation {
  weightScore: number;
  airwayScore: number;
  systolicBpScore: number;
  cnsScore: number;
  skeletalScore: number;
  cutaneousScore: number;
  totalPtsScore: number;
  ptsMortalityTier: PtsMortalityTier;
  tierLabel: string;
  mortalityEstimate: string;
  traumaCenterLevel1Mandatory: boolean;
  initialCrystalloidBolusMl: number; // 20 mL/kg
  pediatricMtpBolusPrbcMl: number; // 10-20 mL/kg (10 mL/kg)
  pediatricMtpBolusFfpMl: number; // 10 mL/kg
  pediatricMtpBolusPlateletsMl: number; // 10 mL/kg
  txaLoadingDoseMg: number; // 15-30 mg/kg (20 mg/kg, max 1000mg)
  txaMaintenanceDoseMgHr: number; // 2 mg/kg/hr
  hypothermiaPreventionAlert: string;
  criticalResuscitationActions: string[];
}

/**
 * Calculates component scores for the Pediatric Trauma Score (PTS):
 * Each component scores +2, +1, or -1. Total range: -6 to +12.
 */
export function calculatePtsComponentScores(input: PediatricPolytraumaInput) {
  // 1. Weight Score: > 20 kg (+2), 10-20 kg (+1), < 10 kg (-1)
  let weightScore = 2;
  if (input.weightKg < 10) weightScore = -1;
  else if (input.weightKg <= 20) weightScore = 1;

  // 2. Airway Score: Normal (+2), Maintainable (+1), Unmaintainable/Intubated (-1)
  let airwayScore = 2;
  if (input.airwayStatus === 'unmaintainable_or_intubated') airwayScore = -1;
  else if (input.airwayStatus === 'maintainable') airwayScore = 1;

  // 3. Systolic BP Score: > 90 mmHg (+2), 50-90 mmHg (+1), < 50 mmHg (-1)
  let systolicBpScore = 2;
  if (input.systolicBp < 50) systolicBpScore = -1;
  else if (input.systolicBp <= 90) systolicBpScore = 1;

  // 4. CNS Score: Awake (+2), Obtunded/LOC (+1), Coma/Decerebrate (-1)
  let cnsScore = 2;
  if (input.cnsStatus === 'coma_decerebrate' || (input.initialGcs !== undefined && input.initialGcs <= 8)) {
    cnsScore = -1;
  } else if (input.cnsStatus === 'obtunded_loc' || (input.initialGcs !== undefined && input.initialGcs <= 13)) {
    cnsScore = 1;
  }

  // 5. Skeletal Score: None (+2), Closed fracture (+1), Open/Multiple (-1)
  let skeletalScore = 2;
  if (input.skeletalInjury === 'open_or_multiple_fractures') skeletalScore = -1;
  else if (input.skeletalInjury === 'closed_fracture') skeletalScore = 1;

  // 6. Cutaneous Score: None (+2), Contusion/Abrasion (+1), Tissue loss/Penetrating (-1)
  let cutaneousScore = 2;
  if (input.cutaneousInjury === 'tissue_loss_or_penetrating') cutaneousScore = -1;
  else if (input.cutaneousInjury === 'contusion_abrasion') cutaneousScore = 1;

  const totalPtsScore = weightScore + airwayScore + systolicBpScore + cnsScore + skeletalScore + cutaneousScore;

  return {
    weightScore,
    airwayScore,
    systolicBpScore,
    cnsScore,
    skeletalScore,
    cutaneousScore,
    totalPtsScore,
  };
}

/**
 * Evaluates comprehensive Pediatric Polytrauma status, trauma center triage, MTP doses, and TXA protocol.
 */
export function evaluatePediatricPolytrauma(input: PediatricPolytraumaInput): PediatricPolytraumaEvaluation {
  const scores = calculatePtsComponentScores(input);
  const total = scores.totalPtsScore;

  let ptsMortalityTier: PtsMortalityTier = 'minor_low_mortality_11_12';
  let tierLabel = 'Minor Trauma (PTS 11-12)';
  let mortalityEstimate = 'Low predicted mortality (< 1%). Routine pediatric trauma evaluation.';
  let traumaCenterLevel1Mandatory = false;

  if (total <= 8) {
    ptsMortalityTier = 'critical_high_mortality_le_8';
    tierLabel = 'Critical Polytrauma (PTS <= 8)';
    mortalityEstimate = 'Significantly elevated mortality (> 15-25% based on Tepas validation). Urgent Level 1 Pediatric Trauma Center and pediatric surgical team mandatory.';
    traumaCenterLevel1Mandatory = true;
  } else if (total <= 10) {
    ptsMortalityTier = 'moderate_potential_lethal_9_10';
    tierLabel = 'Moderate / Potentially Lethal Trauma (PTS 9-10)';
    mortalityEstimate = 'Intermediate risk (mortality ~2-5%). Comprehensive multi-specialty trauma bay resuscitation indicated.';
    traumaCenterLevel1Mandatory = false;
  }

  // Weight-based resuscitation calculations
  const w = Math.max(3, input.weightKg);
  const initialCrystalloidBolusMl = Math.min(1000, Math.round(w * 20)); // 20 mL/kg max 1000
  const pediatricMtpBolusPrbcMl = Math.round(w * 10); // 10 mL/kg
  const pediatricMtpBolusFfpMl = Math.round(w * 10); // 10 mL/kg
  const pediatricMtpBolusPlateletsMl = Math.round(w * 10); // 10 mL/kg

  // Tranexamic Acid (TXA) Pediatric Trauma: 20 mg/kg loading (max 1000 mg), 2 mg/kg/hr infusion over 8 hours
  const txaLoadingDoseMg = Math.min(1000, Math.round(w * 20));
  const txaMaintenanceDoseMgHr = Math.round(w * 2 * 10) / 10;

  const hypothermiaPreventionAlert =
    'MANDATORY NORMOTHERMIA SURVEILLANCE: Pediatric hypothermia worsens trauma-induced coagulopathy and mortality. Use fluid warmers (39°C), forced-air warming blankets, and overhead radiant heaters.';

  const criticalResuscitationActions: string[] = [
    'Primary Survey (ABCDE) with strict cervical spine in-line stabilization.',
    `Initial fluid challenge: ${initialCrystalloidBolusMl} mL (${w * 20} mL/kg) warmed balanced crystalloid over 10-20 minutes.`,
    'If signs of hemorrhagic shock persist after 20-40 mL/kg crystalloid, immediately initiate Pediatric MTP: 1:1:1 balanced ratio (PRBC 10-20 mL/kg, FFP 10-20 mL/kg, Platelets 10 mL/kg).',
    `Tranexamic Acid (TXA) indicated if within 3 hours of injury with hemorrhagic shock: give loading dose ${txaLoadingDoseMg} mg IV over 10 min, followed by ${txaMaintenanceDoseMgHr} mg/hr IV for 8 hours.`,
  ];

  if (input.fastExamPositive) {
    criticalResuscitationActions.push('Positive eFAST / abdominal free fluid in a hemodynamically unstable child warrants immediate pediatric surgical exploration / exploratory laparotomy.');
  }

  if (scores.skeletalScore === -1) {
    criticalResuscitationActions.push('Apply pediatric pelvic binder or sheet wrap for suspected unstable pelvic fractures; reduce and splint major open/deformed long-bone fractures.');
  }

  return {
    ...scores,
    ptsMortalityTier,
    tierLabel,
    mortalityEstimate,
    traumaCenterLevel1Mandatory,
    initialCrystalloidBolusMl,
    pediatricMtpBolusPrbcMl,
    pediatricMtpBolusFfpMl,
    pediatricMtpBolusPlateletsMl,
    txaLoadingDoseMg,
    txaMaintenanceDoseMgHr,
    hypothermiaPreventionAlert,
    criticalResuscitationActions,
  };
}
