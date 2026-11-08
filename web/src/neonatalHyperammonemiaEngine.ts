/**
 * Pure calculation engine for Neonatal Inborn Errors of Metabolism (IEM) Hyperammonemic Crisis Protocol
 * References: ACMG / SIMD / BIMDG Guidelines for Neonatal Hyperammonemia
 */

export type BloodGasAcidBasePattern =
  | 'respiratory_alkalosis'
  | 'high_anion_gap_metabolic_acidosis'
  | 'normal_compensated'
  | 'mixed_acid_base';

export type SuspectedDisorderCategory =
  | 'urea_cycle_disorder_ucd'
  | 'organic_acidemia_oa'
  | 'fatty_acid_oxidation_faod'
  | 'undifferentiated_hyperammonemia';

export type NeonatalHyperammonemiaStatus =
  | 'acute_hyperammonemic_crisis'
  | 'medical_scavenger_infusion'
  | 'emergency_crrt_hemodialysis'
  | 'catabolism_reversal_stabilization'
  | 'controlled_protein_reintroduction'
  | 'convalescent_metabolic_maintenance'
  | 'neonatal_demise';

export interface NeonatalHyperammonemiaParams {
  ageHours: number;
  birthWeightGrams: number;
  gestationalAgeWeeks: number;
  plasmaAmmoniaUmolL: number;
  bloodGasAcidBasePattern: BloodGasAcidBasePattern;
  plasmaLactateMmolL: number;
  anionGapMeqL: number;
  urineKetonesPresent: boolean;
  suspectedDisorderCategory: SuspectedDisorderCategory;
  proteinIntakeHalted: boolean;
  highCalorieDextroseActive: boolean;
  girMgKgMin: number;
  nitrogenScavengerAmmonulActive: boolean;
  ivLArginineActive: boolean;
  ivLCarnitineActive: boolean;
  crrtDialysisIndicated: boolean;
  crrtDialysisActive: boolean;
  status?: string;
}

export interface NeonatalHyperammonemiaEvaluation {
  ammoniaCrisisTier: 'mild_elevation' | 'moderate_crisis' | 'severe_neurotoxic_crisis' | 'extreme_hemodialysis_threshold';
  ammoniaCrisisLabel: string;
  isCrrtHemodialysisMandated: boolean;
  ammonulLoadingDoseMg: number;
  arginineLoadingDoseMg: number;
  carnitineDoseMg: number;
  caloricSuppressionDirectives: string[];
  nitrogenScavengerDirectives: string[];
  dialysisDirectives: string[];
  diagnosticDifferentiationNotes: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_crrt_dialysis_and_scavengers' | 'urgent_medical_scavengers_caloric_suppression' | 'inpatient_metabolic_surveillance';
  urgencyTierLabel: string;
}

export function evaluateNeonatalHyperammonemia(params: NeonatalHyperammonemiaParams): NeonatalHyperammonemiaEvaluation {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const caloricSuppressionDirectives: string[] = [];
  const nitrogenScavengerDirectives: string[] = [];
  const dialysisDirectives: string[] = [];
  const diagnosticDifferentiationNotes: string[] = [];

  const weightKg = Math.max(0.4, params.birthWeightGrams / 1000.0);

  // 1. Ammonia Severity Stratification
  let ammoniaCrisisTier: 'mild_elevation' | 'moderate_crisis' | 'severe_neurotoxic_crisis' | 'extreme_hemodialysis_threshold' =
    'mild_elevation';
  let ammoniaCrisisLabel = 'Mild Hyperammonemia (< 150 umol/L)';

  if (params.plasmaAmmoniaUmolL >= 400.0) {
    ammoniaCrisisTier = 'extreme_hemodialysis_threshold';
    ammoniaCrisisLabel = `CRITICAL EXTREME HYPERAMMONEMIA (${params.plasmaAmmoniaUmolL} umol/L) - Hemodialysis Threshold`;
    alerts.push(`EXTREME HYPERAMMONEMIA (Ammonia ${params.plasmaAmmoniaUmolL} umol/L >= 400 umol/L): Severe risk of irreversible cerebral edema, herniation, and severe neurodevelopmental disability. Emergency CRRT/CVVHD hemodiafiltration mandated!`);
  } else if (params.plasmaAmmoniaUmolL >= 250.0) {
    ammoniaCrisisTier = 'severe_neurotoxic_crisis';
    ammoniaCrisisLabel = `Severe Neurotoxic Hyperammonemia (${params.plasmaAmmoniaUmolL} umol/L)`;
    alerts.push(`SEVERE HYPERAMMONEMIC CRISIS (Ammonia ${params.plasmaAmmoniaUmolL} umol/L): Exceeds safe threshold (>= 250 umol/L). Aggressive medical nitrogen scavengers and caloric hyperinfusion indicated immediately.`);
  } else if (params.plasmaAmmoniaUmolL >= 150.0) {
    ammoniaCrisisTier = 'moderate_crisis';
    ammoniaCrisisLabel = `Moderate Hyperammonemic Elevation (${params.plasmaAmmoniaUmolL} umol/L)`;
    recommendations.push(`Moderate hyperammonemia (${params.plasmaAmmoniaUmolL} umol/L). Halt all protein feeds and initiate D10W glucose infusion.`);
  }

  // 2. CRRT Hemodialysis Criteria
  const isCrrtHemodialysisMandated =
    params.plasmaAmmoniaUmolL >= 400.0 ||
    params.crrtDialysisIndicated ||
    (params.plasmaAmmoniaUmolL >= 250.0 && !params.nitrogenScavengerAmmonulActive);

  if (isCrrtHemodialysisMandated) {
    dialysisDirectives.push('EMERGENCY CRRT / CVVHD: Priming and vascular access for Continuous Veno-Venous Hemodiafiltration (CVVHD) with high dialysate flow rates (> 2000–3000 mL/hr/1.73m2).');
    dialysisDirectives.push('Do NOT delay hemodialysis while awaiting response to pharmacotherapy if ammonia > 400 umol/L.');
    dialysisDirectives.push('Avoid peritoneal dialysis: Clearance is inadequate (< 20% of CVVHD clearance) for acute neonatal hyperammonemic surge.');
  } else {
    dialysisDirectives.push('Standby Hemodialysis: Alert pediatric nephrology / CRRT team if ammonia rises > 250 umol/L or fails to decline by 50% within 4–6 hours.');
  }

  // 3. Weight-Based Dosing of Nitrogen Scavengers
  // Sodium Phenylacetate + Sodium Benzoate (Ammonul 10%/10% solution): 250 mg/kg each (total 250 mg/kg component dose)
  const ammonulLoadingDoseMg = Math.round(weightKg * 250.0 * 10) / 10;
  // IV L-Arginine HCl (10%): 200 to 600 mg/kg (standard 250 mg/kg loading, or 600 mg/kg in Citrullinemia/ASL)
  const arginineLoadingDoseMg = Math.round(weightKg * 250.0 * 10) / 10;
  // IV L-Carnitine: 100 mg/kg/day
  const carnitineDoseMg = Math.round(weightKg * 100.0 * 10) / 10;

  // 4. Caloric Suppression Directives
  if (!params.proteinIntakeHalted) {
    alerts.push('CRITICAL CONTRAINDICATION: Protein feeds (breast milk, standard infant formula, amino acid TPN) MUST BE CEASED IMMEDIATELY to prevent further ammonia generation.');
  } else {
    caloricSuppressionDirectives.push('Zero Protein Intake: Complete cessation of protein for 24 to 48 hours until ammonia is < 100 umol/L.');
  }

  caloricSuppressionDirectives.push(`Caloric Hyperinfusion: Deliver Glucose Infusion Rate (GIR) ${params.girMgKgMin} mg/kg/min (target 10–12 mg/kg/min using D10W or D12.5W) to halt catabolism.`);
  caloricSuppressionDirectives.push('Intravenous Lipids: Add 20% lipid emulsion at 1.0–2.0 g/kg/day to maximize non-protein calories (unless fatty acid oxidation disorder is suspected).');
  caloricSuppressionDirectives.push('Insulin Infusion: If hyperglycemia (> 180 mg/dL) develops under high GIR, initiate regular insulin infusion (0.01–0.05 units/kg/hr) rather than reducing dextrose.');

  // 5. Nitrogen Scavenger Pharmacotherapy
  nitrogenScavengerDirectives.push(`Ammonul Loading Dose: ${ammonulLoadingDoseMg} mg (${Math.round((ammonulLoadingDoseMg / 100) * 10) / 10} mL of Ammonul 10%/10%) diluted in D10W (25 mL/kg) infused over 90–120 minutes.`);
  nitrogenScavengerDirectives.push(`Ammonul Maintenance Dose: Follow loading dose immediately with continuous infusion of ${ammonulLoadingDoseMg} mg/day over 24 hours.`);
  nitrogenScavengerDirectives.push(`IV L-Arginine HCl: Infuse ${arginineLoadingDoseMg} mg IV loading dose over 90 minutes, followed by same dose over 24 hours to supply urea cycle intermediates.`);

  if (params.suspectedDisorderCategory === 'organic_acidemia_oa' || params.ivLCarnitineActive) {
    nitrogenScavengerDirectives.push(`IV L-Carnitine: Administer ${carnitineDoseMg} mg IV push q6h (100 mg/kg/day) to facilitate excretion of toxic acyl-CoA conjugates.`);
  }

  // 6. Diagnostic Differentiation
  if (params.bloodGasAcidBasePattern === 'respiratory_alkalosis' && params.anionGapMeqL <= 16) {
    diagnosticDifferentiationNotes.push('Primary Respiratory Alkalosis with Normal Anion Gap: Classical presentation of Urea Cycle Disorder (UCD), such as OTC deficiency or Citrullinemia.');
  } else if (params.bloodGasAcidBasePattern === 'high_anion_gap_metabolic_acidosis' || params.anionGapMeqL > 16) {
    diagnosticDifferentiationNotes.push(`High Anion Gap Metabolic Acidosis (AG ${params.anionGapMeqL} mEq/L): Points strongly toward an Organic Acidemia (e.g. Methylmalonic, Propionic, or Isovaleric Acidemia). Check urine organic acids.`);
  }

  if (params.urineKetonesPresent) {
    diagnosticDifferentiationNotes.push('Ketonuria Present in Neonate: Pathognomonic for Organic Acidemia (MMA / PA) in a newborn infant.');
  }

  // 7. Urgency Tier
  let urgencyTier: 'emergency_crrt_dialysis_and_scavengers' | 'urgent_medical_scavengers_caloric_suppression' | 'inpatient_metabolic_surveillance' =
    'inpatient_metabolic_surveillance';
  let urgencyTierLabel = 'Inpatient Metabolic Diagnostic Surveillance';

  if (isCrrtHemodialysisMandated || ammoniaCrisisTier === 'extreme_hemodialysis_threshold') {
    urgencyTier = 'emergency_crrt_dialysis_and_scavengers';
    urgencyTierLabel = 'EMERGENCY: Urgent CRRT Hemodialysis & Nitrogen Scavenger Rescue';
  } else if (ammoniaCrisisTier === 'severe_neurotoxic_crisis' || ammoniaCrisisTier === 'moderate_crisis') {
    urgencyTier = 'urgent_medical_scavengers_caloric_suppression';
    urgencyTierLabel = 'Urgent Inpatient Nitrogen Scavengers & Caloric Suppression';
  }

  return {
    ammoniaCrisisTier,
    ammoniaCrisisLabel,
    isCrrtHemodialysisMandated,
    ammonulLoadingDoseMg,
    arginineLoadingDoseMg,
    carnitineDoseMg,
    caloricSuppressionDirectives,
    nitrogenScavengerDirectives,
    dialysisDirectives,
    diagnosticDifferentiationNotes,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
