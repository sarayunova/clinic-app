/**
 * Obstetric Amniotic Fluid Embolism (AFE) Clinical Engine
 * Clark Diagnostic Criteria Validation, A-OK Pharmacologic Resuscitation & Multidisciplinary Critical Care
 *
 * References:
 * - SMFM Consult Series #38: Amniotic Fluid Embolism: diagnosis and management (Am J Obstet Gynecol 2016; 215: B16-B24)
 * - Clark SL et al. Proposed diagnostic criteria for the case definition of amniotic fluid embolism in pregnancy (Am J Obstet Gynecol 2016)
 * - Society for Obstetric Anesthesia and Perinatology (SOAP) Consensus Statement on AFE Resuscitation
 */

export interface AfeEvaluationInput {
  gestationWeeks: number;
  timingRelation:
    | 'during_labor'
    | 'cesarean_delivery'
    | 'postpartum_under_30min'
    | 'post_dilatation_evacuation'
    | 'other';
  cardiorespiratoryCollapse: boolean;
  overtDicPresent: boolean;
  absenceOfFever: boolean; // Fever >= 38 C prior to collapse excludes AFE (points to sepsis)
  fibrinogenMgDl?: number; // mg/dL
  plateletCount?: number; // /uL
  ptInr?: number;
  atropineGiven?: boolean;
  ondansetronGiven?: boolean;
  ketorolacGiven?: boolean;
  fetusInUtero?: boolean;
}

export interface AokDose {
  drug: string;
  dose: string;
  route: string;
  mechanism: string;
  given: boolean;
}

export interface AfeEvaluationResult {
  clarkCriteriaMet: boolean;
  criteriaMetCount: number;
  missingCriteria: string[];
  diagnosisConfidence: 'confirmed_afe' | 'highly_suspected' | 'atypical_alternative_diagnosis';
  aokRegimenComplete: boolean;
  aokChecklist: AokDose[];
  coagulopathyRisk: 'severe_consumptive_dic' | 'moderate_coagulopathy' | 'mild_or_pending';
  cryoprecipitateIndicated: boolean;
  recommendedCryoUnits: number;
  pmcdIndicated: boolean;
  pmcdTimerMinutesMax: number;
  pmcdRationale: string;
  hemodynamicGuidance: string[];
  clinicalActionPlan: string[];
}

/**
 * Validates Clark 4-Criteria for Amniotic Fluid Embolism (AFE)
 */
export function checkClarkCriteria(input: AfeEvaluationInput): {
  clarkCriteriaMet: boolean;
  criteriaMetCount: number;
  missingCriteria: string[];
} {
  const missing: string[] = [];
  let count = 0;

  // 1. Sudden cardiorespiratory arrest or profound hypotension (SBP < 90) + respiratory compromise (cyanosis/dyspnea)
  if (input.cardiorespiratoryCollapse) {
    count++;
  } else {
    missing.push('Profound cardiorespiratory collapse / cardiac arrest (SBP < 90 mmHg or apnea/severe cyanosis).');
  }

  // 2. Overt DIC based on laboratory markers (fibrinogen < 200, platelets < 100k, prolonged PT/INR)
  if (input.overtDicPresent || (input.fibrinogenMgDl !== undefined && input.fibrinogenMgDl < 200)) {
    count++;
  } else {
    missing.push('Overt consumptive Disseminated Intravascular Coagulation (DIC) or acute coagulopathic hemorrhage.');
  }

  // 3. Clinical onset during labor, cesarean delivery, or <= 30 minutes of delivery
  if (
    input.timingRelation === 'during_labor' ||
    input.timingRelation === 'cesarean_delivery' ||
    input.timingRelation === 'postpartum_under_30min' ||
    input.timingRelation === 'post_dilatation_evacuation'
  ) {
    count++;
  } else {
    missing.push('Onset temporally linked to labor, delivery, or <= 30 minutes postpartum.');
  }

  // 4. Absence of fever (>= 38.0 C) prior to collapse
  if (input.absenceOfFever) {
    count++;
  } else {
    missing.push('Absence of fever (>= 38 C prior to collapse) to exclude septic shock.');
  }

  return {
    clarkCriteriaMet: count === 4,
    criteriaMetCount: count,
    missingCriteria: missing,
  };
}

/**
 * Evaluates comprehensive AFE management, A-OK pharmacologic intervention, and MTP/PMCD protocols
 */
export function evaluateObstetricAfe(input: AfeEvaluationInput): AfeEvaluationResult {
  const clark = checkClarkCriteria(input);

  let confidence: 'confirmed_afe' | 'highly_suspected' | 'atypical_alternative_diagnosis' =
    'atypical_alternative_diagnosis';
  if (clark.clarkCriteriaMet) {
    confidence = 'confirmed_afe';
  } else if (clark.criteriaMetCount >= 3) {
    confidence = 'highly_suspected';
  }

  // A-OK Regimen status & components
  const atropineGiven = Boolean(input.atropineGiven);
  const ondansetronGiven = Boolean(input.ondansetronGiven);
  const ketorolacGiven = Boolean(input.ketorolacGiven);
  const aokComplete = atropineGiven && ondansetronGiven && ketorolacGiven;

  const aokList: AokDose[] = [
    {
      drug: 'Atropine',
      dose: '0.8 to 1.0 mg',
      route: 'IV Push',
      mechanism: 'Counteracts massive vagally-mediated pulmonary vasospasm and severe bradycardia/asystole.',
      given: atropineGiven,
    },
    {
      drug: 'Ondansetron',
      dose: '8 mg',
      route: 'IV Push over 2-3 minutes',
      mechanism: 'Selective 5-HT3 antagonist blocking serotonin-induced pulmonary hypertension and bronchial constriction.',
      given: ondansetronGiven,
    },
    {
      drug: 'Ketorolac',
      dose: '30 mg (or 15 mg if renal compromise)',
      route: 'IV Push',
      mechanism: 'Cyclooxygenase/thromboxane inhibitor preventing secondary platelet aggregation and pulmonary vascular microthrombosis.',
      given: ketorolacGiven,
    },
  ];

  // Coagulopathy & MTP
  let coagRisk: 'severe_consumptive_dic' | 'moderate_coagulopathy' | 'mild_or_pending' = 'mild_or_pending';
  let cryoIndicated = false;
  let cryoUnits = 0;

  const fib = input.fibrinogenMgDl;
  if (fib !== undefined && fib < 150) {
    coagRisk = 'severe_consumptive_dic';
    cryoIndicated = true;
    cryoUnits = 10;
  } else if (fib !== undefined && fib < 200) {
    coagRisk = 'moderate_coagulopathy';
    cryoIndicated = true;
    cryoUnits = 10;
  } else if (input.overtDicPresent) {
    coagRisk = 'severe_consumptive_dic';
    cryoIndicated = true;
    cryoUnits = 10;
  }

  // Perimortem Cesarean Delivery (PMCD)
  const isPregnant = Boolean(input.fetusInUtero && input.gestationWeeks >= 20);
  const pmcdRationale = isPregnant
    ? 'Immediate Perimortem Cesarean Delivery (PMCD) within 4-5 minutes of cardiac arrest: relieves inferior vena cava aortocaval compression, increases maternal venous return by 30-60%, and drastically improves maternal CPR efficacy.'
    : 'Not applicable (fetus already delivered or gestation < 20 weeks without aortocaval compression).';

  // Hemodynamic guidance (RV Failure focus)
  const hemodynamics: string[] = [
    'Right Ventricular (RV) Failure is the primary cause of death in acute AFE Phase 1: Avoid excessive crystalloid fluids (which cause lethal acute cor pulmonale / RV overload).',
    'Preferred inotropic/vasopressor support: Norepinephrine (0.05-0.5 mcg/kg/min) + Vasopressin (0.03-0.04 units/min) to restore coronary perfusion without increasing pulmonary vascular resistance.',
    'AVOID high-dose pure alpha-1 agonists (e.g. Phenylephrine boluses) which drastically increase pulmonary vascular resistance and precipitate acute right heart arrest.',
    'Consider Inhaled Epoprostenol (Flolan) or Inhaled Nitric Oxide (iNO) to selectively dilate the pulmonary arterial tree without systemic hypotension.',
  ];

  // Global action plan
  const plan: string[] = [];
  plan.push('CALL CODE BLUE / MATERNAL CARDIAC ARREST TEAM: Notify Senior Obstetrician, Anesthesiologist, Neonatologist, Blood Bank, and ICU.');
  if (!aokComplete) {
    plan.push('ADMINISTER IMMEDIATE A-OK REGIMEN: Atropine 1.0 mg IV + Ondansetron 8 mg IV + Ketorolac 30 mg IV as rapid push.');
  }
  if (isPregnant) {
    plan.push('CRITICAL PMCD TRIGGER: If no ROSC achieved within 4 minutes of cardiac arrest, begin Perimortem Cesarean Delivery at bedside in situ. DO NOT transport to operating theatre.');
  }
  plan.push('ACTIVATE MASSIVE TRANSFUSION PROTOCOL (MTP 1:1:1): PRBC + FFP + Platelets. Administer Tranexamic Acid (TXA) 1 g IV over 10 min.');
  if (cryoIndicated) {
    plan.push(`CRITICAL HYPOFIBRINOGENEMIA (Fibrinogen ${fib ?? '<200'} mg/dL): Transfuse 10 units Cryoprecipitate stat (target fibrinogen >= 200 mg/dL).`);
  }
  plan.push('Prepare for Emergency Veno-Arterial Extracorporeal Membrane Oxygenation (VA-ECMO) standby if RV failure is refractory to maximal vasopressors.');

  return {
    clarkCriteriaMet: clark.clarkCriteriaMet,
    criteriaMetCount: clark.criteriaMetCount,
    missingCriteria: clark.missingCriteria,
    diagnosisConfidence: confidence,
    aokRegimenComplete: aokComplete,
    aokChecklist: aokList,
    coagulopathyRisk: coagRisk,
    cryoprecipitateIndicated: cryoIndicated,
    recommendedCryoUnits: cryoUnits,
    pmcdIndicated: isPregnant,
    pmcdTimerMinutesMax: 4,
    pmcdRationale,
    hemodynamicGuidance: hemodynamics,
    clinicalActionPlan: plan,
  };
}
