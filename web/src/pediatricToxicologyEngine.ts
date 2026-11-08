/**
 * Pure calculation engine for Pediatric Acute Ingestion & Toxic Exposure Protocol
 * References: AAP Committee on Drugs / American College of Medical Toxicology (ACMT) / Rumack-Matthew Nomogram
 */

export type ToxicSubstanceCategory =
  | 'acetaminophen_paracetamol'
  | 'iron_elemental_supplement'
  | 'organophosphate_carbamate'
  | 'caustic_alkali_acid_battery'
  | 'hydrocarbon_petroleum'
  | 'other_unidentified_toxin';

export type AntidoteProtocolAdministered =
  | 'iv_n_acetylcysteine_nac_protocol'
  | 'iv_deferoxamine_chelation'
  | 'atropine_pralidoxime_regimen'
  | 'activated_charcoal_single_dose'
  | 'whole_bowel_irrigation_peg'
  | 'supportive_care_only';

export type PediatricToxicologyStatus =
  | 'acute_poisoning_triage'
  | 'antidote_infusion_active'
  | 'picu_organ_support_monitoring'
  | 'toxic_levels_clearing'
  | 'convalescent_hepatic_recovery'
  | 'resolved_discharged_home';

export interface PediatricToxicologyParams {
  ageYears: number;
  weightKg: number;
  substanceCategory: ToxicSubstanceCategory;
  ingestedDoseMgKg: number;
  hoursPostIngestion: number;
  serumLevelValue: number; // APAP in mcg/mL, Iron in mcg/dL
  rumackMatthewLineBreached: boolean;
  altUL: number;
  astUL: number;
  totalBilirubinMgDl: number;
  prothrombinTimeInr: number;
  antidoteIndicated: boolean;
  antidoteAdministered: AntidoteProtocolAdministered;
  gastricDecontaminationContraindicated: boolean;
  status?: string;
}

export interface PediatricToxicologyEvaluation {
  isAntidoteIndicated: boolean;
  antidoteName: string;
  isDecontaminationStrictlyContraindicated: boolean;
  rumackMatthewNomogramBreached: boolean;
  toxicityRiskTier: 'life_threatening_severe' | 'moderate_toxic_risk' | 'low_subtoxic_exposure';
  toxicityRiskLabel: string;
  antidoteDosingDirectives: string[];
  decontaminationDirectives: string[];
  organMonitoringDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_antidote_and_picu' | 'urgent_inpatient_toxicology_monitoring' | 'observation_routine_clearance';
  urgencyTierLabel: string;
}

export function evaluatePediatricToxicology(params: PediatricToxicologyParams): PediatricToxicologyEvaluation {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const antidoteDosingDirectives: string[] = [];
  const decontaminationDirectives: string[] = [];
  const organMonitoringDirectives: string[] = [];

  let isAntidoteIndicated = params.antidoteIndicated;
  let antidoteName = 'None';
  let rumackMatthewNomogramBreached = params.rumackMatthewLineBreached;
  let isDecontaminationStrictlyContraindicated = params.gastricDecontaminationContraindicated;

  // 1. Acetaminophen / Paracetamol Protocol & Rumack-Matthew Nomogram
  if (params.substanceCategory === 'acetaminophen_paracetamol') {
    antidoteName = 'IV N-Acetylcysteine (NAC)';

    // Rumack-Matthew Treatment Line: 150 mcg/mL at 4h, half-life 4h (150 * 0.5^((t - 4)/4))
    if (params.hoursPostIngestion >= 4.0 && params.hoursPostIngestion <= 24.0 && params.serumLevelValue > 0) {
      const treatmentLineThreshold = 150.0 * Math.pow(0.5, (params.hoursPostIngestion - 4.0) / 4.0);
      if (params.serumLevelValue >= treatmentLineThreshold) {
        rumackMatthewNomogramBreached = true;
        isAntidoteIndicated = true;
        alerts.push(`RUMACK-MATTHEW TREATMENT LINE BREACHED: 4-hour APAP level is ${params.serumLevelValue} mcg/mL (threshold ${Math.round(treatmentLineThreshold * 10) / 10} mcg/mL at ${params.hoursPostIngestion}h). High risk of fulminant hepatic necrosis. Start IV N-Acetylcysteine (NAC) immediately!`);
      }
    } else if (params.ingestedDoseMgKg >= 150.0) {
      isAntidoteIndicated = true;
      alerts.push(`POTENTIALLY TOXIC APAP INGESTION: Ingested dose is ${params.ingestedDoseMgKg} mg/kg (toxic threshold &ge; 150–200 mg/kg). If serum APAP cannot be obtained before 8 hours post-ingestion, initiate IV NAC empiric loading dose.`);
    }

    // NAC 3-Bag Dosing Calculation (150 mg/kg, 50 mg/kg, 100 mg/kg)
    const nacLoadMg = Math.round(params.weightKg * 150.0);
    const nacBag2Mg = Math.round(params.weightKg * 50.0);
    const nacBag3Mg = Math.round(params.weightKg * 100.0);

    antidoteDosingDirectives.push(`IV N-Acetylcysteine (NAC) 3-Bag Regimen Total 300 mg/kg over 21 hours:`);
    antidoteDosingDirectives.push(`Bag 1 (Loading): ${nacLoadMg} mg in D5W 200 mL infused over 60 minutes.`);
    antidoteDosingDirectives.push(`Bag 2: ${nacBag2Mg} mg in D5W 500 mL infused over 4 hours.`);
    antidoteDosingDirectives.push(`Bag 3: ${nacBag3Mg} mg in D5W 1000 mL infused over 16 hours.`);
    antidoteDosingDirectives.push('Anaphylactoid Reaction Vigilance: Flushing, rash, or wheezing occur in up to 10%. Slow infusion, administer diphenhydramine, and resume NAC.');

    organMonitoringDirectives.push('Serial Liver Function Tests: Check ALT, AST, Total Bilirubin, and INR q12h. Continue NAC Bag 3 infusion beyond 21h if ALT remains elevated or APAP detectable.');
  }

  // 2. Iron Toxicity Protocol
  else if (params.substanceCategory === 'iron_elemental_supplement') {
    antidoteName = 'IV Deferoxamine Chelation';

    if (params.ingestedDoseMgKg >= 60.0 || params.serumLevelValue >= 500.0) {
      isAntidoteIndicated = true;
      alerts.push(`CRITICAL IRON TOXICITY: Ingested ${params.ingestedDoseMgKg} mg/kg elemental iron or serum level ${params.serumLevelValue} mcg/dL (&ge; 500 mcg/dL). Severe cellular poisoning, mitochondrial uncoupling, and bowel wall necrosis. Initiate IV Deferoxamine chelation immediately!`);
    } else if (params.ingestedDoseMgKg >= 40.0 || params.serumLevelValue >= 350.0) {
      isAntidoteIndicated = true;
      recommendations.push(`Moderate Iron Ingestion (${params.ingestedDoseMgKg} mg/kg): Obtain urgent abdominal radiograph (KUB) for radiopaque iron pills. Start IV Deferoxamine if pills are visible or patient is symptomatic.`);
    }

    antidoteDosingDirectives.push('IV Deferoxamine Infusion: Start at 15 mg/kg/hr continuous IV infusion (max 6 grams/24h).');
    antidoteDosingDirectives.push('Vin-Rosé Urine Surveillance: Urine turns distinct reddish-orange (vin-rosé) as ferrioxamine complex is cleared by kidneys.');
    antidoteDosingDirectives.push('Whole Bowel Irrigation (WBI): If large radiopaque pill clumps are seen in stomach/duodenum, initiate GoLYTELY (PEG-ELS) 250–500 mL/hr via nasogastric tube until rectal effluent is clear.');
    decontaminationDirectives.push('Activated charcoal DOES NOT bind elemental iron and is ineffective.');
  }

  // 3. Organophosphate / Carbamate Toxicity
  else if (params.substanceCategory === 'organophosphate_carbamate') {
    antidoteName = 'Atropine + Pralidoxime (2-PAM)';
    isAntidoteIndicated = true;

    alerts.push('ACUTE CHOLINERGIC CRISIS (SLUDGEM): Anticholinesterase inhibition causes bronchorrhea, bronchospasm, and bradycardia. Give Atropine until bronchial secretions are fully dried!');

    const atropineDoseMg = Math.max(0.1, Math.round(params.weightKg * 0.05 * 100) / 100);
    const pralidoximeDoseMg = Math.round(params.weightKg * 25.0);

    antidoteDosingDirectives.push(`Atropine: Administer ${atropineDoseMg} mg IV (0.05 mg/kg, min 0.1 mg) every 5 minutes, doubling dose until lungs are clear to auscultation and tracheobronchial secretions are dry.`);
    antidoteDosingDirectives.push(`Pralidoxime (2-PAM): Administer ${pralidoximeDoseMg} mg IV (25–50 mg/kg, max 1000 mg) over 30 minutes, followed by continuous infusion 10–20 mg/kg/hr to reactivate acetylcholinesterase before irreversible aging.`);
    decontaminationDirectives.push('Dermal Decontamination: Remove all clothing immediately; double-bag garments. Wash skin thoroughly with soap and copious water using universal PPE.');
  }

  // 4. Caustic (Alkali / Acid / Button Battery) & Hydrocarbon Contraindications
  else if (params.substanceCategory === 'caustic_alkali_acid_battery' || params.substanceCategory === 'hydrocarbon_petroleum') {
    isDecontaminationStrictlyContraindicated = true;
    alerts.push('STRICT GASTRIC DECONTAMINATION CONTRAINDICATION: Emesis, gastric lavage, neutralizing acids/bases, and activated charcoal are STRICTLY CONTRAINDICATED. Retching causes catastrophic esophageal perforation or chemical pneumonitis.');

    if (params.substanceCategory === 'caustic_alkali_acid_battery') {
      recommendations.push('Button Battery or Caustic Ingestion: Keep patient strictly NPO. Obtain emergent chest and abdominal X-rays. Emergent pediatric endoscopy required within 2 hours for esophageal button battery, or 12–24h for caustic liquids.');
    } else {
      recommendations.push('Hydrocarbon Ingestion: Monitor in PICU for chemical aspiration pneumonitis (tachypnea, hypoxia, wheezing). Obtain chest radiograph at 6 hours post-ingestion.');
    }
  }

  // 5. Activated Charcoal Indications
  if (!isDecontaminationStrictlyContraindicated && params.hoursPostIngestion <= 2.0 && params.substanceCategory === 'acetaminophen_paracetamol') {
    decontaminationDirectives.push(`Activated Charcoal: Single dose 1 g/kg (max 50 g) orally or via NG tube if airway is protected and ingestion occurred < 1–2 hours ago.`);
  }

  // 6. Hepatic & Coagulation Derangement
  const isHepaticInjury = params.altUL > 100.0 || params.astUL > 100.0 || params.prothrombinTimeInr >= 1.5;
  if (isHepaticInjury) {
    alerts.push(`ACUTE HEPATOTOXICITY / COAGULOPATHY: ALT is ${params.altUL} U/L, AST is ${params.astUL} U/L, INR is ${params.prothrombinTimeInr}. Intensive hepatology and PICU liver transplant standby indicated.`);
  }

  // 7. Toxicity Risk Tier
  let toxicityRiskTier: 'life_threatening_severe' | 'moderate_toxic_risk' | 'low_subtoxic_exposure' = 'low_subtoxic_exposure';
  let toxicityRiskLabel = 'Low / Subtoxic Exposure';

  if (rumackMatthewNomogramBreached || isHepaticInjury || params.substanceCategory === 'organophosphate_carbamate' || params.serumLevelValue >= 500.0) {
    toxicityRiskTier = 'life_threatening_severe';
    toxicityRiskLabel = 'CRITICAL: Severe Life-Threatening Toxic Exposure';
  } else if (isAntidoteIndicated || params.ingestedDoseMgKg >= 150.0 || params.substanceCategory === 'caustic_alkali_acid_battery') {
    toxicityRiskTier = 'moderate_toxic_risk';
    toxicityRiskLabel = 'Moderate Toxic Risk (Antidote / Endoscopy Indicated)';
  }

  // 8. Urgency Tier
  let urgencyTier: 'emergency_antidote_and_picu' | 'urgent_inpatient_toxicology_monitoring' | 'observation_routine_clearance' =
    'observation_routine_clearance';
  let urgencyTierLabel = 'Routine Floor Observation & Clearance';

  if (toxicityRiskTier === 'life_threatening_severe' || isAntidoteIndicated) {
    urgencyTier = 'emergency_antidote_and_picu';
    urgencyTierLabel = 'EMERGENCY: Urgent Antidote Protocol & PICU Surveillance';
  } else if (toxicityRiskTier === 'moderate_toxic_risk') {
    urgencyTier = 'urgent_inpatient_toxicology_monitoring';
    urgencyTierLabel = 'Urgent Inpatient Toxicology Monitoring';
  }

  return {
    isAntidoteIndicated,
    antidoteName,
    isDecontaminationStrictlyContraindicated,
    rumackMatthewNomogramBreached,
    toxicityRiskTier,
    toxicityRiskLabel,
    antidoteDosingDirectives,
    decontaminationDirectives,
    organMonitoringDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
