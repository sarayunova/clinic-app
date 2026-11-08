/**
 * Pure calculation engine for Obstetric Massive Pulmonary Embolism (PE) & Acute Right Heart Failure Protocol
 * References: RCOG Green-top Guideline No. 37b / ESC Guidelines on PE in Pregnancy / AHA Guidelines
 */

export type ClinicalSetting =
  | 'antenatal_antepartum'
  | 'intrapartum_labor'
  | 'immediate_postpartum_puerperium'
  | 'post_cesarean_section';

export type PeRiskStratification =
  | 'high_risk_massive_pe'
  | 'intermediate_high_risk_submassive'
  | 'intermediate_low_risk'
  | 'low_risk_nonmassive';

export type ThrombolyticAgentDose =
  | 'alteplase_100mg_over_2hr'
  | 'alteplase_50mg_rapid_cardiac_arrest'
  | 'alteplase_0_6mg_kg_bolus_15min'
  | 'none_contraindicated_or_surgical';

export type ObstetricMassivePeStatus =
  | 'acute_massive_pe_resuscitation'
  | 'thrombolytic_infusion_icu'
  | 'therapeutic_heparin_titration'
  | 'catheter_embolectomy_surgical'
  | 'subacute_transition_lmwh'
  | 'convalescent_anticoagulation_plan'
  | 'maternal_demise';

export interface ObstetricMassivePeParams {
  gestationalAgeWeeks: number;
  clinicalSetting: ClinicalSetting;
  systolicBpMmhg: number;
  heartRateBpm: number;
  respiratoryRate: number;
  spo2Percent: number;
  hemodynamicInstabilityShock: boolean;
  rvDysfunctionEchoConfirmed: boolean;
  cardiacBiomarkersElevated: boolean;
  peRiskStratification: PeRiskStratification;
  thrombolyticTherapyAdministered: boolean;
  thrombolyticAgentDose: ThrombolyticAgentDose;
  systemicUfhInfusionActive: boolean;
  targetApttSeconds: number;
  catheterDirectedOrSurgicalEmbolectomy: boolean;
  inferiorVenaCavaFilterPlaced: boolean;
  status?: string;
}

export interface ObstetricMassivePeEvaluation {
  isMassiveHighRiskPe: boolean;
  isSubmassiveIntermediateRisk: boolean;
  thrombolysisIndicated: boolean;
  initialUfhBolusUnits: number;
  initialUfhInfusionUnitsHr: number;
  anticoagulationDirectives: string[];
  thrombolysisDirectives: string[];
  hemodynamicSupportDirectives: string[];
  neuraxialContraindicationDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'emergency_massive_pe_thrombolysis' | 'urgent_submassive_icu_ufh' | 'inpatient_therapeutic_anticoagulation';
  urgencyTierLabel: string;
}

export function evaluateObstetricMassivePe(params: ObstetricMassivePeParams): ObstetricMassivePeEvaluation {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const anticoagulationDirectives: string[] = [];
  const thrombolysisDirectives: string[] = [];
  const hemodynamicSupportDirectives: string[] = [];
  const neuraxialContraindicationDirectives: string[] = [];

  // 1. Risk Stratification
  const isHypotensive = params.systolicBpMmhg < 90 || params.hemodynamicInstabilityShock;
  const isMassiveHighRiskPe = isHypotensive || params.peRiskStratification === 'high_risk_massive_pe';
  const isSubmassiveIntermediateRisk =
    !isHypotensive &&
    (params.rvDysfunctionEchoConfirmed || params.cardiacBiomarkersElevated);

  if (isMassiveHighRiskPe) {
    alerts.push(`CRITICAL MASSIVE PULMONARY EMBOLISM: Severe hemodynamic collapse (SBP ${params.systolicBpMmhg} mmHg). High immediate risk of obstructive right ventricular failure and maternal cardiac arrest.`);
  } else if (isSubmassiveIntermediateRisk) {
    alerts.push('SUBMASSIVE (INTERMEDIATE-RISK) PE: Normotensive but verified acute RV dysfunction / myocardial injury. Intensive ICU surveillance required for rapid secondary decompensation.');
  }

  // 2. Thrombolysis Indications & Rescue
  const thrombolysisIndicated = isMassiveHighRiskPe;
  if (thrombolysisIndicated) {
    if (params.thrombolyticTherapyAdministered) {
      thrombolysisDirectives.push(`Thrombolytic Therapy Active: Regimen ${params.thrombolyticAgentDose}. Monitor continuously for intracranial or genital tract hemorrhage.`);
    } else {
      alerts.push('EMERGENT THROMBOLYSIS MANDATED: Systemic thrombolysis with recombinant tissue plasminogen activator (Alteplase 100 mg IV over 2 hours, or 50 mg IV bolus in peri-arrest) is indicated for massive PE despite obstetric bleeding risks.');
      thrombolysisDirectives.push('Alteplase Regimen: 100 mg IV infusion over 2 hours (or 0.6 mg/kg over 15 minutes, max 50 mg). In maternal cardiac arrest, push 50 mg IV bolus immediately and continue CPR for at least 60–90 minutes to allow drug circulation.');
    }
    thrombolysisDirectives.push('Surgical / Catheter Rescue: If systemic thrombolysis is contraindicated or fails to restore perfusion within 60 minutes, mobilize interventional radiology / cardiothoracic surgery for percutaneous catheter-directed embolectomy or surgical pulmonary embolectomy.');
  } else {
    thrombolysisDirectives.push('Systemic thrombolysis is not routinely indicated for hemodynamically stable PE. Reserve as rescue therapy if shock develops.');
  }

  // 3. Systemic Unfractionated Heparin (UFH) Dosing
  // In massive/submassive PE, UFH is strongly preferred over LMWH due to short half-life and complete reversibility with Protamine Sulfate
  const initialUfhBolusUnits = 5000; // 80 units/kg or standard 5000 units IV
  const initialUfhInfusionUnitsHr = 1000; // 18 units/kg/hr or standard 1000–1200 units/hr

  anticoagulationDirectives.push(`Initial Heparin Protocol: IV Unfractionated Heparin (UFH) bolus ${initialUfhBolusUnits} units, followed by continuous infusion starting at ${initialUfhInfusionUnitsHr} units/hr.`);
  anticoagulationDirectives.push(`Serial Monitoring: Check aPTT every 4 to 6 hours. Target therapeutic aPTT ratio 1.5–2.5× control (target aPTT ${params.targetApttSeconds} seconds).`);
  anticoagulationDirectives.push('Reversibility: Protamine Sulfate (1 mg per 100 units of Heparin delivered in past 2–3 hours) immediately neutralizes anticoagulant effect if emergency delivery or massive bleeding occurs.');

  // 4. Hemodynamic Support Directives
  hemodynamicSupportDirectives.push('Right Ventricular Protection: Avoid excessive volume resuscitation. Cautious fluid trial (max 250–500 mL crystalloid); volume overloading causes acute RV overdistension and reduces LV cardiac output.');
  hemodynamicSupportDirectives.push('Inotropic & Vasopressor Support: Norepinephrine is first-line to restore systemic perfusion and RV coronary perfusion pressure. Add Dobutamine (2–20 mcg/kg/min) or Milrinone if RV inotropic failure persists.');

  // 5. Neuraxial Anesthesia Contraindications
  neuraxialContraindicationDirectives.push('STRICT NEURAXIAL CONTRAINDICATION: Spinal or epidural anesthesia is absolutely contraindicated during therapeutic Unfractionated Heparin infusion.');
  neuraxialContraindicationDirectives.push('Discontinue IV UFH for at least 4 to 6 hours and document normal aPTT before any neuraxial puncture or catheter removal to prevent catastrophic spinal epidural hematoma.');

  // 6. Urgency Tier
  let urgencyTier: 'emergency_massive_pe_thrombolysis' | 'urgent_submassive_icu_ufh' | 'inpatient_therapeutic_anticoagulation' =
    'inpatient_therapeutic_anticoagulation';
  let urgencyTierLabel = 'Inpatient Therapeutic Anticoagulation & Fetal Surveillance';

  if (isMassiveHighRiskPe) {
    urgencyTier = 'emergency_massive_pe_thrombolysis';
    urgencyTierLabel = 'EMERGENCY: Massive High-Risk PE / Immediate Thrombolysis';
  } else if (isSubmassiveIntermediateRisk) {
    urgencyTier = 'urgent_submassive_icu_ufh';
    urgencyTierLabel = 'Urgent Submassive PE / Inpatient ICU Heparin Titration';
  }

  return {
    isMassiveHighRiskPe,
    isSubmassiveIntermediateRisk,
    thrombolysisIndicated,
    initialUfhBolusUnits,
    initialUfhInfusionUnitsHr,
    anticoagulationDirectives,
    thrombolysisDirectives,
    hemodynamicSupportDirectives,
    neuraxialContraindicationDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
