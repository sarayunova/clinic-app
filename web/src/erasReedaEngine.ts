/**
 * Post-Cesarean Enhanced Recovery (ERAS) & REEDA Wound Healing Engine
 *
 * Implements:
 * - International REEDA scale (Redness, Edema, Ecchymosis, Discharge, Approximation)
 * - Surgical Site Infection (SSI) and wound dehiscence risk stratification
 * - ERAS post-operative milestone adherence and recovery benchmarks
 */

export type ReedaCategory =
  | 'optimal_healing'
  | 'mild_inflammation'
  | 'moderate_impairment_suspected_ssi'
  | 'severe_complication_dehiscence';

export interface ReedaScoreResult {
  totalScore: number;
  category: ReedaCategory;
  categoryLabel: string;
  riskLevel: 'low' | 'moderate' | 'high';
  isDehiscenceRisk: boolean;
  isSsiRisk: boolean;
  recommendations: string[];
}

export interface ErasBenchmark {
  milestone: string;
  targetHours: number;
  actualHours: number | null;
  met: boolean;
  statusLabel: string;
}

export interface ErasAdherenceResult {
  adherencePercentage: number;
  benchmarks: ErasBenchmark[];
  isDischargeReady: boolean;
  recommendations: string[];
}

/**
 * Calculates total REEDA score from individual parameter sub-scores (0-3 each).
 *
 * Parameter definitions:
 * - Redness: 0=None, 1=<0.25cm, 2=0.25-0.5cm, 3=>0.5cm bilaterally
 * - Edema: 0=None, 1=<1cm, 2=1-2cm, 3=>2cm
 * - Ecchymosis: 0=None, 1=within 0.25cm, 2=0.25-1cm, 3=>1cm
 * - Discharge: 0=None, 1=Serous, 2=Serosanguinous, 3=Bloody/Purulent
 * - Approximation: 0=Closed well, 1=Gap <=3mm, 2=Separation >3mm, 3=Complete dehiscence
 */
export function calculateReedaScore(inputs: {
  redness: number;
  edema: number;
  ecchymosis: number;
  discharge: number;
  approximation: number;
}): ReedaScoreResult {
  const r = Math.min(3, Math.max(0, Math.round(inputs.redness || 0)));
  const e = Math.min(3, Math.max(0, Math.round(inputs.edema || 0)));
  const ec = Math.min(3, Math.max(0, Math.round(inputs.ecchymosis || 0)));
  const d = Math.min(3, Math.max(0, Math.round(inputs.discharge || 0)));
  const a = Math.min(3, Math.max(0, Math.round(inputs.approximation || 0)));

  const totalScore = r + e + ec + d + a;
  const recommendations: string[] = [];
  let category: ReedaCategory = 'optimal_healing';
  let categoryLabel = 'Optimal Healing (Clean & Intact)';
  let riskLevel: 'low' | 'moderate' | 'high' = 'low';

  const isDehiscenceRisk = a >= 2;
  const isSsiRisk = totalScore >= 4 || d >= 2 || (r >= 2 && e >= 2);

  if (totalScore === 0) {
    category = 'optimal_healing';
    categoryLabel = 'Optimal Healing (Score 0)';
    riskLevel = 'low';
    recommendations.push('Incision clean, dry, and well-approximated. Keep incision clean and open to air as per protocol.');
  } else if (totalScore <= 3) {
    category = 'mild_inflammation';
    categoryLabel = 'Mild Inflammatory Reaction (Score 1-3)';
    riskLevel = 'low';
    recommendations.push('Normal postoperative physiological inflammation. Routine daily wound inspection and hygiene.');
  } else if (totalScore <= 7) {
    category = 'moderate_impairment_suspected_ssi';
    categoryLabel = 'Moderate Impairment / Early SSI Concern (Score 4-7)';
    riskLevel = 'moderate';
    recommendations.push('Increased wound surveillance every 8-12 hours.');
    recommendations.push('Check maternal vitals (temperature, heart rate) for early sepsis markers.');
    if (d > 0) {
      recommendations.push('Send exudate/swab for Gram stain and culture & sensitivity.');
    }
  } else {
    category = 'severe_complication_dehiscence';
    categoryLabel = 'Severe Wound Complication / Dehiscence (Score >= 8)';
    riskLevel = 'high';
    recommendations.push('URGENT surgical review required by consultant obstetrician.');
    recommendations.push('Initiate empiric broad-spectrum antibiotic therapy for surgical site infection (SSI).');
    if (a >= 2) {
      recommendations.push('Prepare for wound exploration, debridement, and secondary closure if indicated.');
    }
  }

  // Specific red-flag alerts
  if (isDehiscenceRisk && !recommendations.some((x) => x.includes('dehiscence') || x.includes('closure'))) {
    recommendations.push('WARNING: Skin separation > 3mm detected. Inspect fascia and reinforce dressing.');
  }
  if (d === 3) {
    recommendations.push('Purulent or frank bloody discharge present; isolate wound and review hemoglobin.');
  }

  return {
    totalScore,
    category,
    categoryLabel,
    riskLevel,
    isDehiscenceRisk,
    isSsiRisk,
    recommendations,
  };
}

/**
 * Calculates postoperative elapsed hours between surgery and event datetime.
 */
export function calculatePostOpHours(surgeryDatetime: string, eventDatetime: string): number {
  if (!surgeryDatetime || !eventDatetime) return 0;
  const s = new Date(surgeryDatetime);
  const e = new Date(eventDatetime);
  const diffMs = e.getTime() - s.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  return Number(Math.max(0, hours).toFixed(1));
}

/**
 * Evaluates patient progress against core ERAS (Enhanced Recovery After Cesarean) benchmarks:
 * - Oral fluid intake initiated within 2 hours
 * - Regular solid diet resumed within 6 hours
 * - Indwelling urinary catheter removed within 12 hours
 * - Out of bed mobilization within 12 hours
 * - Multimodal opioid-sparing analgesia regimen active
 */
export function evaluateErasMilestoneAdherence(milestones: {
  oralFluidsAchievedHours?: number | null;
  regularDietAchievedHours?: number | null;
  catheterRemovedHours?: number | null;
  firstMobilizationHours?: number | null;
  multimodalAnalgesiaAdherent?: boolean;
}): ErasAdherenceResult {
  const benchmarks: ErasBenchmark[] = [
    {
      milestone: 'Early Oral Hydration (within 2h)',
      targetHours: 2,
      actualHours: milestones.oralFluidsAchievedHours ?? null,
      met: milestones.oralFluidsAchievedHours != null && milestones.oralFluidsAchievedHours <= 2,
      statusLabel:
        milestones.oralFluidsAchievedHours == null
          ? 'Pending'
          : milestones.oralFluidsAchievedHours <= 2
          ? `Achieved at ${milestones.oralFluidsAchievedHours}h`
          : `Delayed (${milestones.oralFluidsAchievedHours}h > 2h)`,
    },
    {
      milestone: 'Early Regular Diet (within 6h)',
      targetHours: 6,
      actualHours: milestones.regularDietAchievedHours ?? null,
      met: milestones.regularDietAchievedHours != null && milestones.regularDietAchievedHours <= 6,
      statusLabel:
        milestones.regularDietAchievedHours == null
          ? 'Pending'
          : milestones.regularDietAchievedHours <= 6
          ? `Achieved at ${milestones.regularDietAchievedHours}h`
          : `Delayed (${milestones.regularDietAchievedHours}h > 6h)`,
    },
    {
      milestone: 'Foley Catheter Removal (within 12h)',
      targetHours: 12,
      actualHours: milestones.catheterRemovedHours ?? null,
      met: milestones.catheterRemovedHours != null && milestones.catheterRemovedHours <= 12,
      statusLabel:
        milestones.catheterRemovedHours == null
          ? 'In Situ'
          : milestones.catheterRemovedHours <= 12
          ? `Removed at ${milestones.catheterRemovedHours}h`
          : `Delayed removal (${milestones.catheterRemovedHours}h > 12h)`,
    },
    {
      milestone: 'Active Mobilization (within 12h)',
      targetHours: 12,
      actualHours: milestones.firstMobilizationHours ?? null,
      met: milestones.firstMobilizationHours != null && milestones.firstMobilizationHours <= 12,
      statusLabel:
        milestones.firstMobilizationHours == null
          ? 'Pending'
          : milestones.firstMobilizationHours <= 12
          ? `Mobilized at ${milestones.firstMobilizationHours}h`
          : `Delayed (${milestones.firstMobilizationHours}h > 12h)`,
    },
  ];

  const metCount = benchmarks.filter((b) => b.met).length + (milestones.multimodalAnalgesiaAdherent ? 1 : 0);
  const totalItems = benchmarks.length + 1; // 5 items total
  const adherencePercentage = Math.round((metCount / totalItems) * 100);

  const recommendations: string[] = [];
  if (milestones.oralFluidsAchievedHours == null) {
    recommendations.push('Offer sips of water / clear oral fluids immediately if nausea-free.');
  }
  if (milestones.catheterRemovedHours == null) {
    recommendations.push('Target Foley catheter removal at 6-8 hours post-op once sensation has returned.');
  }
  if (milestones.firstMobilizationHours == null) {
    recommendations.push('Assist patient to sit upright at bedside and ambulate with support.');
  }
  if (!milestones.multimodalAnalgesiaAdherent) {
    recommendations.push('Ensure scheduled oral/IV paracetamol and NSAID (if not contraindicated) to minimize opioid requirements.');
  }

  const isDischargeReady = adherencePercentage >= 80 && milestones.catheterRemovedHours != null && milestones.firstMobilizationHours != null;

  return {
    adherencePercentage,
    benchmarks,
    isDischargeReady,
    recommendations,
  };
}
