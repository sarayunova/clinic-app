/**
 * Pediatric Traumatic Brain Injury (TBI) & PECARN Decision Engine
 * Age-Stratified Head Injury Neuro-Imaging Rules & Tiered Raised ICP Management
 *
 * References:
 * - Kuppermann N et al. Identification of children at very low risk of clinically-important brain injuries
 *   after head trauma: a prospective cohort study (PECARN). Lancet 2009; 374: 1160-70.
 * - Kochanek PM et al. Brain Trauma Foundation Guidelines for the Management of Pediatric Severe TBI.
 *   Pediatr Crit Care Med 2019; 20: S1-S82.
 */

export interface PecarnEvaluationInput {
  ageMonths: number;
  weightKg: number;
  gcsScore: number; // 3 to 15
  alteredMentalStatus?: boolean; // Agitation, somnolence, repetitive questions, slow response
  // < 2 years specific
  palpableSkullFracture?: boolean;
  nonFrontalScalpHematoma?: boolean; // Occipital, parietal, or temporal
  lossOfConsciousnessSeconds?: number;
  actingAbnormalParent?: boolean;
  // >= 2 years specific
  signsOfBasilarFracture?: boolean; // Raccoon eyes, Battle sign, CSF leak, hemotympanum
  vomitingEpisodesCount?: number;
  severeHeadache?: boolean;
  // Common
  severeMechanism?: boolean; // MVC with ejection/death/rollover, pedestrian vs car, fall > 3ft (<2y) or > 5ft (>=2y), bike without helmet
  // Vital signs / ICP monitoring
  intubated?: boolean;
  icpMmhg?: number;
  meanArterialPressureMmhg?: number;
  serumSodiumMeqL?: number;
}

export type PecarnRiskTier = 'high_risk_ct_indicated' | 'intermediate_risk_observation_vs_ct' | 'low_risk_no_ct';

export interface HyperosmolarDose {
  agent: string;
  doseVolumeMl: number;
  instructions: string;
  targetMonitoring: string;
  safetyCautions: string[];
}

export interface PecarnEvaluationResult {
  ageBracket: 'under_2_years' | '2_years_and_older';
  pecarnRiskTier: PecarnRiskTier;
  pecarnRiskTitle: string;
  ciTbiRiskPercent: string;
  ctRecommendation: string;
  gcsSeverity: 'mild_13_15' | 'moderate_9_12' | 'severe_3_8';
  icpTierRecommended: 'tier_0_observation' | 'tier_1_neuroprotective' | 'tier_2_hyperosmolar_therapy' | 'tier_3_refractory_decompression';
  calculatedCppMmhg: number | null;
  recommendedHypertonicSaline3Pct: HyperosmolarDose;
  recommendedMannitol20Pct: HyperosmolarDose;
  clinicalActionPlan: string[];
}

/**
 * Calculates Pediatric GCS severity tier
 */
export function classifyGcsSeverity(gcs: number): 'mild_13_15' | 'moderate_9_12' | 'severe_3_8' {
  if (gcs <= 8) return 'severe_3_8';
  if (gcs <= 12) return 'moderate_9_12';
  return 'mild_13_15';
}

/**
 * Evaluates PECARN Head Injury Rule for children < 2 years and >= 2 years
 */
export function evaluatePecarn(input: PecarnEvaluationInput): PecarnEvaluationResult {
  const isUnder2 = input.ageMonths < 24;
  const ageBracket: 'under_2_years' | '2_years_and_older' = isUnder2 ? 'under_2_years' : '2_years_and_older';

  let riskTier: PecarnRiskTier = 'low_risk_no_ct';
  let riskTitle = 'PECARN Low Risk (< 0.05% risk of Clinically-Important Brain Injury)';
  let ciTbiRisk = '< 0.05% (ciTBI extremely unlikely)';
  let ctRec = 'CT scan is NOT recommended. Radiation risks outweigh potential benefits. Clinical observation with head injury return instructions.';

  if (isUnder2) {
    // PECARN < 2 years:
    // High risk: GCS < 15, altered mental status, or palpable skull fracture
    if (input.gcsScore < 15 || input.alteredMentalStatus || input.palpableSkullFracture) {
      riskTier = 'high_risk_ct_indicated';
      riskTitle = 'PECARN High Risk: Immediate Non-Contrast Head CT Indicated (Risk ~4.4%)';
      ciTbiRisk = '~4.4% risk of ciTBI';
      ctRec = 'Immediate Non-Contrast Head CT Scan recommended. High risk of intracranial hemorrhage, skull fracture, or need for neurosurgical intervention.';
    } else if (
      input.nonFrontalScalpHematoma ||
      (input.lossOfConsciousnessSeconds ?? 0) >= 5 ||
      input.severeMechanism ||
      input.actingAbnormalParent
    ) {
      riskTier = 'intermediate_risk_observation_vs_ct';
      riskTitle = 'PECARN Intermediate Risk: Observation vs. CT Decision (Risk ~0.9%)';
      ciTbiRisk = '~0.9% risk of ciTBI';
      ctRec = 'Observation for 4-6 hours in ED vs. Head CT scan based on physician experience, multiple vs. isolated findings, worsening symptoms, or parental preference.';
    }
  } else {
    // PECARN >= 2 years:
    // High risk: GCS < 15, altered mental status, or signs of basilar skull fracture
    if (input.gcsScore < 15 || input.alteredMentalStatus || input.signsOfBasilarFracture) {
      riskTier = 'high_risk_ct_indicated';
      riskTitle = 'PECARN High Risk: Immediate Non-Contrast Head CT Indicated (Risk ~4.3%)';
      ciTbiRisk = '~4.3% risk of ciTBI';
      ctRec = 'Immediate Non-Contrast Head CT Scan recommended. High risk of clinically important traumatic brain injury.';
    } else if (
      (input.lossOfConsciousnessSeconds ?? 0) > 0 ||
      (input.vomitingEpisodesCount ?? 0) > 0 ||
      input.severeMechanism ||
      input.severeHeadache
    ) {
      riskTier = 'intermediate_risk_observation_vs_ct';
      riskTitle = 'PECARN Intermediate Risk: Observation vs. CT Decision (Risk ~0.9%)';
      ciTbiRisk = '~0.9% risk of ciTBI';
      ctRec = 'Observation for 4-6 hours in ED vs. Head CT scan. CT preferred if multiple risk factors present, worsening headache/vomiting, or dangerous mechanism.';
    }
  }

  const gcsSeverity = classifyGcsSeverity(input.gcsScore);

  // Cerebral Perfusion Pressure (CPP) = MAP - ICP
  let cpp: number | null = null;
  if (input.meanArterialPressureMmhg !== undefined && input.icpMmhg !== undefined) {
    cpp = Math.round(input.meanArterialPressureMmhg - input.icpMmhg);
  }

  // Tiered Raised ICP Management
  let icpTier: 'tier_0_observation' | 'tier_1_neuroprotective' | 'tier_2_hyperosmolar_therapy' | 'tier_3_refractory_decompression' =
    'tier_0_observation';

  if (input.icpMmhg !== undefined && input.icpMmhg > 20) {
    if (cpp !== null && cpp < 40) {
      icpTier = 'tier_3_refractory_decompression';
    } else {
      icpTier = 'tier_2_hyperosmolar_therapy';
    }
  } else if (gcsSeverity === 'severe_3_8') {
    icpTier = 'tier_1_neuroprotective';
  }

  // Weight-based Hyperosmolar therapy doses
  // 1. 3% Hypertonic Saline: 2 to 5 mL/kg (use 3 mL/kg typical)
  const htVolume = Math.min(250, Math.round(input.weightKg * 3.0 * 10) / 10);
  const hypertonicSaline: HyperosmolarDose = {
    agent: '3% Sodium Chloride (Hypertonic Saline)',
    doseVolumeMl: htVolume,
    instructions: `Administer ${htVolume} mL (3 mL/kg) IV push over 10-15 minutes via central line (or large peripheral line in emergency). Preferred in pediatrics and hypovolemic/hypotensive patients.`,
    targetMonitoring: 'Monitor serum sodium q2h (target 145-155 mEq/L) and serum osmolarity (target < 360 mOsm/kg).',
    safetyCautions: ['Avoid serum sodium > 160 mEq/L to prevent pontine myelinolysis.', 'Do not use as a continuous drip without central access.'],
  };

  // 2. 20% Mannitol: 0.5 to 1.0 g/kg (2.5 to 5.0 mL/kg of 20% solution, use 0.5 g/kg = 2.5 mL/kg)
  const manVolume = Math.min(250, Math.round(input.weightKg * 2.5 * 10) / 10);
  const mannitol: HyperosmolarDose = {
    agent: '20% Mannitol IV',
    doseVolumeMl: manVolume,
    instructions: `Administer ${manVolume} mL (0.5 g/kg = 2.5 mL/kg) IV infusion over 20-30 minutes through an in-line filter.`,
    targetMonitoring: 'Serum osmolarity q4h (hold if serum osmolarity >= 320 mOsm/kg). Place Foley catheter to monitor osmotic diuresis.',
    safetyCautions: [
      'CONTRAINDICATED in hypotension or hypovolemic shock (osmotic diuresis causes profound secondary brain ischemia).',
      'Requires adequate intravascular volume and MAP.',
    ],
  };

  const actionPlan: string[] = [];

  if (gcsSeverity === 'severe_3_8' || input.intubated) {
    actionPlan.push('CRITICAL: Severe TBI (GCS <= 8). Immediate endotracheal intubation (RSI) using neuroprotective agents (Etomidate/Ketamine + Rocuronium).');
    actionPlan.push('Maintain PaCO2 in strict physiological range (35-40 mmHg). Avoid prophylactic hyperventilation (causes cerebral vasoconstriction and secondary ischemia).');
    actionPlan.push('Place invasive ICP monitor (external ventricular drain or parenchymal probe) and arterial line. Target ICP < 20 mmHg and CPP >= 40-50 mmHg.');
  }

  if (icpTier === 'tier_1_neuroprotective' || icpTier === 'tier_2_hyperosmolar_therapy' || icpTier === 'tier_3_refractory_decompression') {
    actionPlan.push('Head of bed elevated to 30 degrees with neck in neutral midline position to maximize cerebral venous drainage.');
    actionPlan.push('Maintain strict normothermia (target 36.0 - 37.5 C); treat fever aggressively with antipyretics and surface cooling.');
    actionPlan.push('Administer Levetiracetam 20-30 mg/kg IV loading for post-traumatic seizure prophylaxis for 7 days.');
  }

  if (icpTier === 'tier_2_hyperosmolar_therapy') {
    actionPlan.push(`Tier 2 ICP Crisis (ICP > 20 mmHg): Administer 3% Hypertonic Saline bolus (${htVolume} mL) IV over 10 minutes.`);
  }

  if (icpTier === 'tier_3_refractory_decompression') {
    actionPlan.push('Tier 3 Refractory ICP / Compromised CPP (< 40 mmHg): Emergency Neurosurgical Consultation for decompressive craniectomy or CSF drainage.');
    actionPlan.push('Mild therapeutic hyperventilation (PaCO2 30-35 mmHg) permitted strictly as a temporary bridge to operating room.');
  }

  return {
    ageBracket,
    pecarnRiskTier: riskTier,
    pecarnRiskTitle: riskTitle,
    ciTbiRiskPercent: ciTbiRisk,
    ctRecommendation: ctRec,
    gcsSeverity,
    icpTierRecommended: icpTier,
    calculatedCppMmhg: cpp,
    recommendedHypertonicSaline3Pct: hypertonicSaline,
    recommendedMannitol20Pct: mannitol,
    clinicalActionPlan: actionPlan,
  };
}
