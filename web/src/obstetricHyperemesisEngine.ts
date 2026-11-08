// Pure TypeScript calculation engine for Obstetric Hyperemesis Gravidarum (HG) & PUQE-24 Protocol
// Guidelines: ACOG Practice Bulletin No. 189 / RCOG Green-top Guideline No. 69

export type PuqeSeverity =
  | 'mild'
  | 'moderate'
  | 'severe';

export type KetonuriaDipstick =
  | 'negative'
  | 'trace'
  | 'one_plus'
  | 'two_plus'
  | 'three_plus'
  | 'four_plus';

export type AntiemeticTier =
  | 'tier_1_doxylamine_pyridoxine'
  | 'tier_2_dimenhydrinate_or_metoclopramide'
  | 'tier_3_ondansetron_5ht3_antagonist'
  | 'tier_4_corticosteroid_methylprednisolone_pulse'
  | 'refractory_enteral_jejunostomy_tpn';

export interface ObstetricHyperemesisParams {
  gestationalAgeWeeks: number;
  puqeNauseaHours: number;
  puqeVomitingEpisodes: number;
  puqeRetchingEpisodes: number;
  weightLossPercent: number;
  ketonuriaLevel: KetonuriaDipstick;
  serumPotassiumMmolL: number;
  serumSodiumMmolL: number;
  serumChlorideMmolL: number;
  bicarbonateMmolL: number;
  parenteralThiamineGivenBeforeDextrose: boolean;
  wernickeTriadSymptomsPresent: boolean;
  currentAntiemeticTier: AntiemeticTier;
  thromboprophylaxisLmwhPrescribed: boolean;
}

export interface ObstetricHyperemesisResult {
  puqeScoreTotal: number;
  puqeSeverityCategory: PuqeSeverity;
  puqeSeverityLabel: string;
  isSevereWeightLoss: boolean;
  hasElectrolyteDerangement: boolean;
  isHypokalemicAlkalosis: boolean;
  wernickeRiskTier: 'emergency_active_symptoms' | 'high_risk_thiamine_required' | 'low_protected';
  wernickeRiskLabel: string;
  thiamineDirectives: string[];
  hydrationDirectives: string[];
  antiemeticEscalationDirectives: string[];
  thromboprophylaxisDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_wernicke_or_severe_derangement' | 'urgent_inpatient_iv_hydration' | 'outpatient_maintenance_stepdown';
  urgencyTierLabel: string;
}

export type ObstetricHyperemesisEvaluationResult = ObstetricHyperemesisResult;

export function evaluateObstetricHyperemesis(params: ObstetricHyperemesisParams): ObstetricHyperemesisResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const thiamineDirectives: string[] = [];
  const hydrationDirectives: string[] = [];
  const antiemeticEscalationDirectives: string[] = [];
  const thromboprophylaxisDirectives: string[] = [];

  // 1. PUQE-24 Total Score Calculation (3 to 15)
  const puqeScoreTotal =
    Math.min(5, Math.max(1, params.puqeNauseaHours)) +
    Math.min(5, Math.max(1, params.puqeVomitingEpisodes)) +
    Math.min(5, Math.max(1, params.puqeRetchingEpisodes));

  let puqeSeverityCategory: PuqeSeverity = 'mild';
  let puqeSeverityLabel = `Mild NVP (PUQE-24 Score: ${puqeScoreTotal}/15)`;

  if (puqeScoreTotal >= 13) {
    puqeSeverityCategory = 'severe';
    puqeSeverityLabel = `Severe Hyperemesis Gravidarum (PUQE-24 Score: ${puqeScoreTotal}/15)`;
    alerts.push(`SEVERE PUQE-24 SCORE (${puqeScoreTotal}/15): Intractable nausea and vomiting. Inpatient hospitalization and continuous IV fluid/electrolyte therapy indicated.`);
  } else if (puqeScoreTotal >= 7) {
    puqeSeverityCategory = 'moderate';
    puqeSeverityLabel = `Moderate Hyperemesis (PUQE-24 Score: ${puqeScoreTotal}/15)`;
    recommendations.push(`Moderate PUQE-24 Score (${puqeScoreTotal}/15): Initiate combination antiemetic therapy and monitor outpatient fluid intake and urine ketones.`);
  }

  // 2. Weight Loss & Nutritional Depletion
  const isSevereWeightLoss = params.weightLossPercent >= 5.0;
  if (isSevereWeightLoss) {
    alerts.push(`SEVERE MATERNAL WEIGHT LOSS (${params.weightLossPercent}%): Weight loss > 5% of pre-pregnancy weight defines clinically significant hyperemesis with catabolic starvation.`);
  }

  // 3. Electrolytes & Acid-Base
  const isHypokalemicAlkalosis = params.serumPotassiumMmolL < 3.5 || (params.bicarbonateMmolL > 28.0 && params.serumChlorideMmolL < 96.0);
  const hasElectrolyteDerangement = isHypokalemicAlkalosis || params.serumSodiumMmolL < 135.0;

  if (params.serumPotassiumMmolL < 3.0) {
    alerts.push(`SEVERE HYPOKALEMIA (${params.serumPotassiumMmolL} mmol/L): High risk of cardiac arrhythmias, muscle weakness, and ileus. Rapid telemetry and IV potassium chloride piggyback required.`);
  } else if (params.serumPotassiumMmolL < 3.5) {
    recommendations.push(`Hypokalemia (K+ ${params.serumPotassiumMmolL} mmol/L): Supplement IV fluids with 20–40 mEq KCl per liter.`);
  }

  if (params.ketonuriaLevel === 'three_plus' || params.ketonuriaLevel === 'four_plus') {
    alerts.push(`HEAVY KETONURIA (${params.ketonuriaLevel.replace(/_/g, ' ')}): Indicates active fatty acid oxidation and prolonged starvation state.`);
  }

  // 4. Wernicke Encephalopathy Vigilance & Thiamine Prophylaxis
  let wernickeRiskTier: 'emergency_active_symptoms' | 'high_risk_thiamine_required' | 'low_protected' = 'high_risk_thiamine_required';
  let wernickeRiskLabel = 'High Risk: Parenteral Thiamine Mandatory';

  if (params.wernickeTriadSymptomsPresent) {
    wernickeRiskTier = 'emergency_active_symptoms';
    wernickeRiskLabel = 'EMERGENCY: Suspected Wernicke Encephalopathy';
    alerts.push('CRITICAL WERNICKE EMERGENCY: Neurological signs (nystagmus/ophthalmoplegia, ataxia, or encephalopathy/confusion) present. Administer Thiamine 500 mg IV TID immediately before any carbohydrate load!');
  } else if (!params.parenteralThiamineGivenBeforeDextrose) {
    alerts.push('CATASTROPHIC RISK: Intravenous dextrose infusion without prior parenteral Thiamine can trigger acute brainstem Wernicke necrosis. Give Thiamine 100 mg IV/IM before dextrose.');
  } else {
    wernickeRiskTier = 'low_protected';
    wernickeRiskLabel = 'Protected: Thiamine Administered';
  }

  thiamineDirectives.push('Thiamine Prophylaxis: 100 mg IV daily (diluted in 100 mL normal saline over 30 min) for all patients requiring IV fluids for > 24 hours.');
  thiamineDirectives.push('STRICT RULE: Always give Thiamine prior to starting dextrose-containing fluids to avoid precipitating acute lactic acidosis and Wernicke encephalopathy.');
  thiamineDirectives.push('Multivitamin supplementation: Add Pyridoxine (B6) 50 mg/day, Riboflavin (B2), and Folic acid 5 mg daily.');

  // 5. Hydration & Electrolyte Directives
  hydrationDirectives.push('Initial fluid resuscitation: 0.9% Normal Saline or Ringer Lactate 1000 mL bolus over 2 hours, then maintain at 125–150 mL/hr.');
  hydrationDirectives.push('Avoid Dextrose solutions initially until rehydration is established and thiamine has been administered.');
  hydrationDirectives.push('Add Potassium Chloride (KCl) 20–40 mEq/L once urine output is confirmed > 30 mL/hr to correct hypokalemic metabolic alkalosis.');

  // 6. Tiered Antiemetic Escalation Directives
  antiemeticEscalationDirectives.push('Tier 1: Doxylamine succinate (10–20 mg) + Pyridoxine (10–20 mg) orally TID/QHS (first-line ACOG recommendation).');
  antiemeticEscalationDirectives.push('Tier 2: Dimenhydrinate 50 mg IV/oral q4-6h, Promethazine 12.5–25 mg IV/oral q4-6h, or Metoclopramide 5–10 mg IV q8h (monitor for extrapyramidal symptoms).');
  antiemeticEscalationDirectives.push('Tier 3: Ondansetron 4–8 mg IV/oral q8h (reserve for after 10 weeks gestation; check baseline QTc interval).');
  antiemeticEscalationDirectives.push('Tier 4 (Refractory): Methylprednisolone 16 mg IV q8h for 3 days, followed by oral taper over 2 weeks (indicated only if refractory to Tiers 1–3).');

  // 7. Thromboprophylaxis Directives
  if (puqeScoreTotal >= 13 || isSevereWeightLoss || !params.thromboprophylaxisLmwhPrescribed) {
    thromboprophylaxisDirectives.push('LMWH thromboprophylaxis (Enoxaparin 40 mg SC daily) strongly recommended due to combination of hemoconcentration, bedrest, and pregnancy-induced hypercoagulability.');
  } else {
    thromboprophylaxisDirectives.push('LMWH thromboprophylaxis active: Continue until patient is fully mobilized and oral intake is restored.');
  }

  // 8. Urgency Tier
  let urgencyTier: 'emergency_wernicke_or_severe_derangement' | 'urgent_inpatient_iv_hydration' | 'outpatient_maintenance_stepdown' =
    'urgent_inpatient_iv_hydration';
  let urgencyTierLabel = 'Urgent Inpatient IV Hydration & Antiemetics';

  if (params.wernickeTriadSymptomsPresent || params.serumPotassiumMmolL < 2.8 || !params.parenteralThiamineGivenBeforeDextrose) {
    urgencyTier = 'emergency_wernicke_or_severe_derangement';
    urgencyTierLabel = 'EMERGENCY: Wernicke Risk or Critical Electrolyte Collapse';
  } else if (puqeScoreTotal <= 6 && !hasElectrolyteDerangement && !isSevereWeightLoss) {
    urgencyTier = 'outpatient_maintenance_stepdown';
    urgencyTierLabel = 'Outpatient Maintenance & Dietary Step-Down';
  }

  return {
    puqeScoreTotal,
    puqeSeverityCategory,
    puqeSeverityLabel,
    isSevereWeightLoss,
    hasElectrolyteDerangement,
    isHypokalemicAlkalosis,
    wernickeRiskTier,
    wernickeRiskLabel,
    thiamineDirectives,
    hydrationDirectives,
    antiemeticEscalationDirectives,
    thromboprophylaxisDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
