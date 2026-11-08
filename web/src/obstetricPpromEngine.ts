// Pure TypeScript Clinical Calculation Engine: Obstetric Preterm Premature Rupture of Membranes (PPROM) & Intra-Amniotic Infection (Triple I)
// References: ACOG Practice Bulletin No. 217 (2020); SMFM Consult Series; NICHD Intrauterine Inflammation or Infection (Triple I) Guidelines

export type RuptureConfirmationMethod =
  | 'pooling_ferning_nitrazine'
  | 'biochemical_amnisure_actim_prom'
  | 'direct_visualization'
  | 'ultrasound_oligohydramnios';

export type TripleICategory =
  | 'no_infection_uncomplicated'
  | 'isolated_maternal_fever'
  | 'suspected_triple_i'
  | 'confirmed_triple_i';

export type LatencyRegimen =
  | 'ampicillin_erythromycin_standard'
  | 'ampicillin_azithromycin_alternative'
  | 'penicillin_allergic_cefazolin_erythro'
  | 'vancomycin_gentamicin_severe_allergy'
  | 'none_not_indicated';

export type AntenatalSteroidStatus =
  | 'not_indicated_ge_34w'
  | 'course_initiated'
  | 'course_completed'
  | 'rescue_course_given';

export type DeliveryTimingPlan =
  | 'expectant_management_to_34w'
  | 'previable_expectant_or_termination'
  | 'immediate_delivery_triple_i'
  | 'immediate_delivery_ge_34w'
  | 'immediate_delivery_non_reassuring_fhr';

export interface ObstetricPpromInput {
  gestationWeeks: number;
  ruptureConfirmationMethod: RuptureConfirmationMethod;
  amnioticFluidIndexCm?: number;
  singleDeepestPocketCm?: number;

  // Triple I / Chorioamnionitis Markers
  maternalTemperatureCelsius: number;
  maternalHeartRateBpm: number;
  fetalHeartRateBpm: number;
  uterineTenderness?: boolean;
  foulCervicalDischarge?: boolean;
  maternalWbcPerUl?: number;
  amniocentesisPositive?: boolean; // Positive Gram stain, glucose < 14 mg/dL, or culture

  // Allergy & GBS
  penicillinAllergyStatus?: 'none' | 'mild_rash' | 'severe_anaphylaxis';
  gbsScreeningStatus?: 'positive' | 'negative' | 'unknown';
}

export interface ObstetricPpromEvaluation {
  tripleICategory: TripleICategory;
  tripleICategoryLabel: string;
  tripleICriteriaDetails: string[];
  immediateDeliveryIndicated: boolean;
  deliveryTimingPlan: DeliveryTimingPlan;
  deliveryTimingGuidance: string;

  // Latency & Pharmacotherapy
  latencyAntibioticsIndicated: boolean;
  recommendedLatencyRegimen: LatencyRegimen;
  latencyRegimenProtocol: string;
  antenatalCorticosteroidsIndicated: boolean;
  antenatalCorticosteroidGuidance: string;
  mgso4NeuroprotectionIndicated: boolean;
  mgso4Guidance: string;

  summary: string;
  clinicalActionPlan: string[];
}

/**
 * Evaluates NICU/ACOG Triple I (Intrauterine Inflammation or Infection / Chorioamnionitis) Criteria.
 */
export function evaluateTripleICriteria(input: ObstetricPpromInput): {
  category: TripleICategory;
  details: string[];
} {
  const isFever = input.maternalTemperatureCelsius >= 38.0;
  const isHighFever = input.maternalTemperatureCelsius >= 39.0;

  const secondaryCriteria: string[] = [];
  if (input.fetalHeartRateBpm > 160) {
    secondaryCriteria.push(`Fetal tachycardia (${input.fetalHeartRateBpm} bpm > 160 bpm)`);
  }
  if (input.maternalWbcPerUl !== undefined && input.maternalWbcPerUl > 15000) {
    secondaryCriteria.push(`Maternal leukocytosis (WBC ${input.maternalWbcPerUl} > 15,000/uL)`);
  }
  if (input.uterineTenderness) {
    secondaryCriteria.push('Uterine fundal tenderness on palpation');
  }
  if (input.foulCervicalDischarge) {
    secondaryCriteria.push('Purulent / malodorous amniotic fluid or cervical discharge');
  }

  if (Boolean(input.amniocentesisPositive)) {
    return {
      category: 'confirmed_triple_i',
      details: ['Confirmed Intra-Amniotic Infection via amniotic fluid Gram stain / glucose / culture.', ...secondaryCriteria],
    };
  }

  if (isHighFever || (isFever && secondaryCriteria.length >= 1)) {
    return {
      category: 'suspected_triple_i',
      details: [`Maternal fever (${input.maternalTemperatureCelsius}°C) with: ${secondaryCriteria.join(', ')}`],
    };
  }

  if (isFever) {
    return {
      category: 'isolated_maternal_fever',
      details: [`Isolated maternal temperature elevation (${input.maternalTemperatureCelsius}°C) without secondary criteria.`],
    };
  }

  return {
    category: 'no_infection_uncomplicated',
    details: ['No maternal fever or clinical signs of intra-amniotic infection.'],
  };
}

/**
 * Evaluates comprehensive PPROM management, latency antimicrobial regimens, steroid/neuroprotection windows, and delivery timing.
 */
export function evaluateObstetricPprom(input: ObstetricPpromInput): ObstetricPpromEvaluation {
  const { category: tripleICategory, details: tripleICriteriaDetails } = evaluateTripleICriteria(input);

  const isPreviable = input.gestationWeeks < 24.0;
  const isLatePretermOrTerm = input.gestationWeeks >= 34.0;
  const isUnder34Weeks = input.gestationWeeks < 34.0;
  const isUnder32Weeks = input.gestationWeeks < 32.0;

  let immediateDeliveryIndicated = false;
  let deliveryTimingPlan: DeliveryTimingPlan = 'expectant_management_to_34w';
  let deliveryTimingGuidance = '';

  if (tripleICategory === 'suspected_triple_i' || tripleICategory === 'confirmed_triple_i') {
    immediateDeliveryIndicated = true;
    deliveryTimingPlan = 'immediate_delivery_triple_i';
    deliveryTimingGuidance = 'MANDATORY PROMPT DELIVERY: Intra-amniotic infection (Triple I / Chorioamnionitis) diagnosed. Initiate immediate broad-spectrum therapeutic IV antibiotics (Ampicillin 2g q6h + Gentamicin 5 mg/kg q24h) and proceed with delivery regardless of gestational age. Expectant latency management is strictly contraindicated.';
  } else if (isLatePretermOrTerm) {
    immediateDeliveryIndicated = true;
    deliveryTimingPlan = 'immediate_delivery_ge_34w';
    deliveryTimingGuidance = 'PLANNED EXPEDITIOUS DELIVERY: Patient at or beyond 34 weeks of gestation. According to ACOG Practice Bulletin 217, the balance of maternal chorioamnionitis risk vs. neonatal respiratory morbidity favors delivery over expectant management.';
  } else if (isPreviable) {
    immediateDeliveryIndicated = false;
    deliveryTimingPlan = 'previable_expectant_or_termination';
    deliveryTimingGuidance = 'PREVIABLE / PERI-VIABLE PPROM (< 24w): Comprehensive multidisciplinary maternal-fetal counseling regarding severe neonatal morbidity (pulmonary hypoplasia, limb contractures, sepsis) vs. pregnancy termination vs. expectant outpatient/inpatient management.';
  } else {
    immediateDeliveryIndicated = false;
    deliveryTimingPlan = 'expectant_management_to_34w';
    deliveryTimingGuidance = 'INPATIENT EXPECTANT LATENCY SURVEILLANCE UNTIL 34+0 WEEKS: Goal is prolongation of latency to allow fetal maturation. Monitor vital signs q4h, daily nonstress test (NST), biophysical profile (BPP), and serial WBC monitoring.';
  }

  // Latency Antibiotics (indicated only for expectant management < 34 weeks without infection)
  const latencyAntibioticsIndicated = isUnder34Weeks && !immediateDeliveryIndicated;
  let recommendedLatencyRegimen: LatencyRegimen = 'none_not_indicated';
  let latencyRegimenProtocol = 'No latency antibiotics indicated at this time.';

  if (latencyAntibioticsIndicated) {
    const allergy = input.penicillinAllergyStatus ?? 'none';
    if (allergy === 'severe_anaphylaxis') {
      recommendedLatencyRegimen = 'vancomycin_gentamicin_severe_allergy';
      latencyRegimenProtocol = 'Severe Penicillin Anaphylaxis: IV Vancomycin (15-20 mg/kg q12h) + IV Gentamicin (5 mg/kg q24h) for 48 hours.';
    } else if (allergy === 'mild_rash') {
      recommendedLatencyRegimen = 'penicillin_allergic_cefazolin_erythro';
      latencyRegimenProtocol = 'Mild Penicillin Allergy: IV Cefazolin (1g q8h) + Oral Azithromycin (1g single dose) for 48 hours, followed by Oral Cephalexin (500mg q6h) for 5 days.';
    } else {
      recommendedLatencyRegimen = 'ampicillin_erythromycin_standard';
      latencyRegimenProtocol = 'Standard ACOG 7-Day Latency Regimen: IV Ampicillin (2g q6h) + Oral Azithromycin (1g single dose or IV Erythromycin 250mg q6h) for 48 hours, followed by Oral Amoxicillin (500mg q8h) for 5 days (7 days total).';
    }
  }

  // Antenatal Corticosteroids (Betamethasone 12mg IM q24h x 2 doses)
  const antenatalCorticosteroidsIndicated = isUnder34Weeks && input.gestationWeeks >= 24.0;
  const antenatalCorticosteroidGuidance = antenatalCorticosteroidsIndicated
    ? 'Betamethasone 12 mg IM every 24 hours for 2 doses indicated for acceleration of fetal lung maturity and reduction of IVH and NEC.'
    : 'Antenatal corticosteroids not routinely indicated beyond 34 weeks in PPROM.';

  // Magnesium Sulfate Neuroprotection (loading 4g IV over 20 min, then 1g/hr)
  const mgso4NeuroprotectionIndicated = isUnder32Weeks && (immediateDeliveryIndicated || deliveryTimingPlan === 'expectant_management_to_34w');
  const mgso4Guidance = mgso4NeuroprotectionIndicated
    ? 'MgSO4 Neuroprotection: Administer 4g IV load over 20-30 min followed by 1g/hr infusion if delivery is anticipated before 32 weeks, to reduce the risk of cerebral palsy.'
    : 'MgSO4 neuroprotection not indicated for gestational age >= 32 weeks.';

  const categoryLabels: Record<TripleICategory, string> = {
    no_infection_uncomplicated: 'No Infection (Uncomplicated PPROM)',
    isolated_maternal_fever: 'Isolated Maternal Fever (Surveillance Active)',
    suspected_triple_i: 'SUSPECTED TRIPLE I (CHORIOAMNIONITIS)',
    confirmed_triple_i: 'CONFIRMED TRIPLE I (CHORIOAMNIONITIS)',
  };

  const clinicalActionPlan: string[] = [];
  if (immediateDeliveryIndicated) {
    clinicalActionPlan.push('Initiate prompt delivery (induction of labor vs. cesarean delivery for obstetric indications)');
    if (tripleICategory === 'suspected_triple_i' || tripleICategory === 'confirmed_triple_i') {
      clinicalActionPlan.push('Start therapeutic IV Ampicillin 2g q6h + Gentamicin 5 mg/kg q24h (+ Clindamycin if cesarean performed)');
    }
  } else {
    clinicalActionPlan.push('Admit to high-risk antepartum unit on modified bed rest');
    clinicalActionPlan.push('Initiate 7-day latency antibiotic regimen');
    clinicalActionPlan.push('Administer Betamethasone 12 mg IM course');
    clinicalActionPlan.push('Continuous or serial electronic fetal monitoring (EFM)');
    clinicalActionPlan.push('Avoid digital cervical examinations unless active labor is present');
  }

  const summary = `PPROM at ${input.gestationWeeks} weeks: ${categoryLabels[tripleICategory]}. ${immediateDeliveryIndicated ? 'IMMEDIATE DELIVERY REQUIRED.' : 'Expectant latency management candidate until 34+0 weeks.'}`;

  return {
    tripleICategory,
    tripleICategoryLabel: categoryLabels[tripleICategory],
    tripleICriteriaDetails,
    immediateDeliveryIndicated,
    deliveryTimingPlan,
    deliveryTimingGuidance,
    latencyAntibioticsIndicated,
    recommendedLatencyRegimen,
    latencyRegimenProtocol,
    antenatalCorticosteroidsIndicated,
    antenatalCorticosteroidGuidance,
    mgso4NeuroprotectionIndicated,
    mgso4Guidance,
    summary,
    clinicalActionPlan,
  };
}
