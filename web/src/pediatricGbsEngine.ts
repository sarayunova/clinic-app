// Pure TypeScript calculation engine for Pediatric Guillain-Barré Syndrome (GBS) & Brighton Diagnostic Criteria Protocol
// Guidelines: Brighton Collaboration GBS Criteria / AAP / Peripheral Nerve Society / Hughes Disability Scale

export type GbsAntecedentInfection =
  | 'campylobacter_gastroenteritis'
  | 'upper_respiratory_viral'
  | 'ebv_cmv_infection'
  | 'none_identified';

export type GbsBrightonLevel =
  | 'level_1_highest_certainty_csf_ncs'
  | 'level_2_csf_or_ncs'
  | 'level_3_clinical_only'
  | 'level_4_unclassifiable';

export type GbsImmunotherapyRegimen =
  | 'ivig_2g_kg_over_2_days'
  | 'ivig_2g_kg_over_5_days'
  | 'plasma_exchange_tpe'
  | 'supportive_care_only';

export interface PediatricGbsParams {
  ageYears: number;
  weightKg: number;
  antecedentInfectionType: GbsAntecedentInfection;
  brightonCriteriaLevel: GbsBrightonLevel;
  hughesDisabilityScore: number; // 0 to 6
  ascendingSymmetricWeakness: boolean;
  areflexiaOrHyporeflexia: boolean;
  csfProteinMgDl: number;
  csfWbcCountPerUl: number;
  vitalCapacityMlKg: number;
  negativeInspiratoryForceCmh2o: number; // e.g. -45 is good, -20 is weak
  peakExpiratoryPressureCmh2o: number;
  dysautonomiaSignsPresent: boolean;
  immunotherapyRegimen: GbsImmunotherapyRegimen;
  corticosteroidsAvoided: boolean;
}

export interface PediatricGbsResult {
  hasAlbuminocytologicalDissociation: boolean;
  isImpendingRespiratoryFailure: boolean;
  respiratoryFailureRuleLabel: string;
  hughesDisabilityLabel: string;
  ivigDoseGramsTotal: number;
  immunotherapyDirectives: string[];
  respiratoryMonitoringDirectives: string[];
  autonomicDysreflexiaDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_impending_respiratory_arrest' | 'urgent_inpatient_ivig_telemetry' | 'subacute_rehabilitation_maintenance';
  urgencyTierLabel: string;
}

export type PediatricGbsEvaluationResult = PediatricGbsResult;

export function evaluatePediatricGbs(params: PediatricGbsParams): PediatricGbsResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const immunotherapyDirectives: string[] = [];
  const respiratoryMonitoringDirectives: string[] = [];
  const autonomicDysreflexiaDirectives: string[] = [];

  // 1. CSF Albuminocytological Dissociation Check
  const hasAlbuminocytologicalDissociation =
    params.csfProteinMgDl > 45.0 && params.csfWbcCountPerUl < 10;

  if (hasAlbuminocytologicalDissociation) {
    recommendations.push(`CSF Albuminocytological Dissociation confirmed (Protein ${params.csfProteinMgDl} mg/dL, WBC ${params.csfWbcCountPerUl}/uL): Strongly supports Brighton Level 1/2 diagnostic certainty.`);
  } else if (params.csfWbcCountPerUl >= 50) {
    alerts.push(`CSF PLEOCYTOSIS (${params.csfWbcCountPerUl} WBCs/uL): Rare in classical GBS; raises suspicion for infectious radiculitis, HIV, Lyme neuroborreliosis, cytomegalovirus, or transverse myelitis.`);
  }

  // 2. Impending Respiratory Failure: The "20/30/40 Rule"
  // VC < 20 mL/kg, NIF magnitude < 30 cmH2O (i.e. > -30), PEP < 40 cmH2O
  const isVcDepressed = params.vitalCapacityMlKg < 20.0;
  const isNifWeak = params.negativeInspiratoryForceCmh2o > -30.0; // e.g. -20 cmH2O fails threshold
  const isPepDepressed = params.peakExpiratoryPressureCmh2o < 40.0;

  const isImpendingRespiratoryFailure = isVcDepressed || isNifWeak || isPepDepressed;
  let respiratoryFailureRuleLabel = '';

  if (isImpendingRespiratoryFailure) {
    respiratoryFailureRuleLabel = 'CRITICAL: 20/30/40 Rule Positive (Impending Respiratory Arrest)';
    alerts.push(`IMPENDING NEUROMUSCULAR RESPIRATORY FAILURE: 20/30/40 criteria breached (VC ${params.vitalCapacityMlKg} mL/kg [target ≥20], NIF ${params.negativeInspiratoryForceCmh2o} cmH2O [target ≤-30], PEP ${params.peakExpiratoryPressureCmh2o} cmH2O [target ≥40]). Elective PICU intubation indicated before emergency asphyxia!`);
  } else {
    respiratoryFailureRuleLabel = 'Respiratory Mechanics Stable (20/30/40 Negative)';
    recommendations.push(`Respiratory mechanics currently stable (VC ${params.vitalCapacityMlKg} mL/kg, NIF ${params.negativeInspiratoryForceCmh2o} cmH2O). Perform serial spirometry / NIF checks every 4–6 hours.`);
  }

  respiratoryMonitoringDirectives.push('Serial Pulmonary Function Testing (PFT): Measure Vital Capacity (VC) and Negative Inspiratory Force (NIF) q4h during progressive phase.');
  respiratoryMonitoringDirectives.push('Watch for single breath count < 15, staccato speech, paradoxical abdominal movement, or tachypnea which precede hypercapnic respiratory arrest.');
  respiratoryMonitoringDirectives.push('Elective endotracheal intubation preferred: Avoid depolarizing muscle relaxants (Succinylcholine is strictly contraindicated due to lethal hyperkalemia risk).');

  // 3. Hughes Functional Disability Scale Stratification
  let hughesDisabilityLabel = '';
  switch (params.hughesDisabilityScore) {
    case 0:
      hughesDisabilityLabel = 'Hughes 0: Healthy / Normal';
      break;
    case 1:
      hughesDisabilityLabel = 'Hughes 1: Minor symptoms, capable of running';
      break;
    case 2:
      hughesDisabilityLabel = 'Hughes 2: Able to walk 10m independently without support';
      break;
    case 3:
      hughesDisabilityLabel = 'Hughes 3: Able to walk 10m only with aid / walker';
      recommendations.push('Hughes Score 3: Significant motor impairment; high risk of progression to non-ambulatory status. Immunotherapy indicated.');
      break;
    case 4:
      hughesDisabilityLabel = 'Hughes 4: Bedbound / chairbound (unable to walk)';
      alerts.push('HUGHES SCORE 4: Patient is non-ambulatory and bedbound. Prompt initiation of IVIG or Plasma Exchange (TPE) mandatory to hasten recovery.');
      break;
    case 5:
      hughesDisabilityLabel = 'Hughes 5: Requiring mechanical ventilation for at least part of day';
      alerts.push('HUGHES SCORE 5: Invasive mechanical ventilatory support required. Full PICU intensive care management active.');
      break;
    case 6:
      hughesDisabilityLabel = 'Hughes 6: Demise';
      break;
  }

  // 4. Immunotherapy & Corticosteroid Contraindication
  const ivigDoseGramsTotal = Math.round(params.weightKg * 2.0 * 10) / 10;

  if (!params.corticosteroidsAvoided) {
    alerts.push('CORTICOSTEROID CONTRAINDICATION: Corticosteroids (Prednisone / Methylprednisolone) are strictly ineffective in acute GBS and clinical trials demonstrate they may delay motor nerve remyelination. Discontinue steroids.');
  }

  if (params.immunotherapyRegimen.startsWith('ivig')) {
    immunotherapyDirectives.push(`Intravenous Immunoglobulin (IVIG) Total Dose: ${ivigDoseGramsTotal} grams (2 g/kg). Administer as ${params.immunotherapyRegimen === 'ivig_2g_kg_over_2_days' ? '1 g/kg/day over 2 consecutive days' : '0.4 g/kg/day over 5 consecutive days'}.`);
    immunotherapyDirectives.push('Screen for selective IgA deficiency prior to first dose if feasible (high risk of severe anaphylaxis; use IgA-depleted IVIG formulation if deficient).');
    immunotherapyDirectives.push('Premedicate with oral acetaminophen and diphenhydramine 30 minutes prior to infusion to prevent aseptic meningitis and fever.');
  } else if (params.immunotherapyRegimen === 'plasma_exchange_tpe') {
    immunotherapyDirectives.push('Therapeutic Plasma Exchange (TPE): 4 to 5 sessions (exchange 200–250 mL/kg plasma volume over 7–14 days) using 5% albumin replacement.');
    immunotherapyDirectives.push('Ensure central venous access, monitor ionized calcium for citrate toxicity, and watch for hemodynamic instability.');
  }

  // 5. Autonomic Dysreflexia Surveillance
  if (params.dysautonomiaSignsPresent) {
    alerts.push('ACTIVE AUTONOMIC DYSAUTONOMIA: Cardiovascular lability (sinus tachycardia, paroxysmal bradycardia, orthostatic hypotension, or hypertension) detected. Continuous cardiac telemetry indicated.');
    autonomicDysreflexiaDirectives.push('Continuous Cardiac & Arterial Line Telemetry and hemodynamic monitoring in pediatric ICU.');
    autonomicDysreflexiaDirectives.push('Avoid rapid position changes or aggressive tracheal suctioning which can trigger severe bradycardia or asystole.');
    autonomicDysreflexiaDirectives.push('Use short-acting, titratable agents only (e.g. Esmolol, Nitroprusside, or low-dose Phenylephrine); avoid long-acting antihypertensives.');
    autonomicDysreflexiaDirectives.push('Monitor for paralytic ileus and acute neurogenic urinary retention (place indwelling Foley catheter).');
  } else {
    autonomicDysreflexiaDirectives.push('Monitor vital signs for wide fluctuations in heart rate and blood pressure characteristic of autonomic instability.');
  }

  // 6. Urgency Tier
  let urgencyTier: 'emergency_impending_respiratory_arrest' | 'urgent_inpatient_ivig_telemetry' | 'subacute_rehabilitation_maintenance' =
    'urgent_inpatient_ivig_telemetry';
  let urgencyTierLabel = 'Urgent Inpatient Immunotherapy & Cardiac Telemetry';

  if (isImpendingRespiratoryFailure || params.hughesDisabilityScore >= 5) {
    urgencyTier = 'emergency_impending_respiratory_arrest';
    urgencyTierLabel = 'EMERGENCY: Impending Respiratory Arrest / PICU Intubation';
  } else if (params.hughesDisabilityScore <= 2 && !params.dysautonomiaSignsPresent) {
    urgencyTier = 'subacute_rehabilitation_maintenance';
    urgencyTierLabel = 'Subacute Neurological Rehabilitation & Surveillance';
  }

  return {
    hasAlbuminocytologicalDissociation,
    isImpendingRespiratoryFailure,
    respiratoryFailureRuleLabel,
    hughesDisabilityLabel,
    ivigDoseGramsTotal,
    immunotherapyDirectives,
    respiratoryMonitoringDirectives,
    autonomicDysreflexiaDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
