/**
 * Pure calculation engine for Obstetric Cerebral Venous Sinus Thrombosis (CVST) & Puerperal Encephalopathy Protocol
 * References: European Stroke Organisation (ESO) Guidelines on CVST / AHA/ASA Stroke in Pregnancy & Postpartum
 */

export type ClinicalTiming =
  | 'antepartum_first_trimester'
  | 'antepartum_second_trimester'
  | 'antepartum_third_trimester'
  | 'early_postpartum_puerperium'
  | 'late_postpartum';

export type HeadacheType =
  | 'thunderclap_sudden_severe'
  | 'progressive_unremitting_subacute'
  | 'postural_headache_mimicking_pdph'
  | 'mild_intermittent';

export type AnticoagulantAgent =
  | 'therapeutic_lmwh_enoxaparin_1mg_kg_q12h'
  | 'therapeutic_ufh_continuous_infusion'
  | 'withheld_severe_mass_effect_neurosurgery'
  | 'other';

export type IntracranialHypertensionManagement =
  | 'elevate_head_bed_and_osmotherapy'
  | 'mannitol_or_hypertonic_saline_infusion'
  | 'decompressive_hemicraniectomy_eval'
  | 'conservative_monitoring';

export type ObstetricCvstStatus =
  | 'acute_cvst_inpatient_resuscitation'
  | 'therapeutic_anticoagulation_active'
  | 'elevated_icp_critical_monitoring'
  | 'endovascular_or_surgical_intervention'
  | 'subacute_neurological_rehabilitation'
  | 'convalescent_long_term_anticoagulation'
  | 'maternal_demise';

export interface ObstetricCvstParams {
  gestationalAgeWeeks: number;
  clinicalTiming: ClinicalTiming;
  presentingHeadacheType: HeadacheType;
  seizuresPresent: boolean;
  papilledemaPresent: boolean;
  focalNeurologicalDeficit: boolean;
  alteredMentalStatusComa: boolean;
  thrombosedSinusLocations: string[];
  intracranialHemorrhagicVenousInfarct: boolean;
  therapeuticAnticoagulationActive: boolean;
  anticoagulantAgent: AnticoagulantAgent;
  intracranialHypertensionManagement: IntracranialHypertensionManagement;
  antiepilepticTherapyActive: boolean;
  status?: string;
}

export interface ObstetricCvstEvaluation {
  isHighRiskCvst: boolean;
  isAnticoagulationIndicated: boolean;
  isHemorrhagicInfarctAnticoagulationSafe: boolean;
  anticoagulationSafeDespiteHemorrhage: boolean;
  antiepilepticIndicated: boolean;
  intracranialHypertensionUrgent: boolean;
  anticoagulationDirectives: string[];
  elevatedIcpDirectives: string[];
  seizureManagementDirectives: string[];
  antiepilepticDirectives: string[];
  recommendations: string[];
  alerts: string[];
  clinicalAlerts: string[];
  urgencyTier: 'emergency_neurovascular_icu' | 'urgent_inpatient_cvst_anticoagulation' | 'neurology_consultation_surveillance';
  urgencyTierLabel: string;
  urgencyCategory: 'emergency_neurovascular_icu' | 'urgent_therapeutic_anticoagulation' | 'neurology_consultation_surveillance';
}

export function evaluateObstetricCvst(params: ObstetricCvstParams): ObstetricCvstEvaluation {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const anticoagulationDirectives: string[] = [];
  const elevatedIcpDirectives: string[] = [];
  const seizureManagementDirectives: string[] = [];

  // 1. High Risk Stratification
  const isHighRiskCvst =
    params.alteredMentalStatusComa ||
    params.seizuresPresent ||
    params.focalNeurologicalDeficit ||
    params.intracranialHemorrhagicVenousInfarct ||
    params.thrombosedSinusLocations.length >= 2;

  if (isHighRiskCvst) {
    alerts.push('CRITICAL OBSTETRIC CVST: Severe presentation with encephalopathy, seizures, focal neurological deficits, or hemorrhagic venous infarction. Intensive Neuro-ICU surveillance indicated.');
  }

  // 2. Hemorrhagic Venous Infarct & Anticoagulation Safety Rule
  // ESSENTIAL CLINICAL PRINCIPLE: Venous hemorrhage is caused by retrograde venous hypertension;
  // therapeutic anticoagulation prevents further propagation and reduces hemorrhagic worsening.
  const isHemorrhagicInfarctAnticoagulationSafe = true;

  if (params.intracranialHemorrhagicVenousInfarct) {
    alerts.push('CRITICAL CVST GUIDELINE RULE: Intracranial hemorrhagic venous infarction is present. Per ESO and AHA/ASA guidelines, therapeutic anticoagulation with LMWH or UFH is indicated, safe, and effective. DO NOT withhold therapeutic anticoagulation on account of baseline hemorrhagic venous infarct unless immediate neurosurgical decompressive craniectomy is required.');
    anticoagulationDirectives.push('DO NOT withhold therapeutic anticoagulation due to intracranial venous hemorrhagic infarction.');
  }

  if (params.therapeuticAnticoagulationActive) {
    anticoagulationDirectives.push(`Therapeutic Anticoagulation Active (${params.anticoagulantAgent}): Preferred agent is subcutaneous Low Molecular Weight Heparin (Enoxaparin 1 mg/kg q12h, adjusted for renal function) or IV Unfractionated Heparin continuous infusion.`);
    anticoagulationDirectives.push('Target Anti-Xa: If using LMWH in high-risk pregnancy, check peak anti-Xa level at 4 hours post-dose (target 0.6–1.0 IU/mL). If using IV UFH, maintain aPTT 1.5–2.5× control.');
  } else {
    alerts.push('URGENT THERAPEUTIC ANTICOAGULATION MANDATE: Patient is not currently receiving therapeutic anticoagulation. Unless imminent surgical evacuation of a space-occupying hematoma is planned, initiate therapeutic LMWH or UFH immediately!');
  }

  // 3. Elevated Intracranial Pressure (ICP) Management
  if (params.papilledemaPresent || params.alteredMentalStatusComa || params.intracranialHypertensionManagement !== 'conservative_monitoring') {
    elevatedIcpDirectives.push('Intracranial Hypertension Management: Elevate head of bed to 30 degrees to optimize jugular venous outflow. Maintain neutral neck alignment.');
    elevatedIcpDirectives.push('Avoid Hypotonic Fluids: Use 0.9% Normal Saline; strictly avoid D5W or hypotonic solutions which exacerbate cerebral edema.');
    elevatedIcpDirectives.push('Osmotherapy: Consider IV Mannitol 20% (0.5–1.0 g/kg) or 3% Hypertonic Saline boluses (250 mL over 15 min) for worsening somnolence, pupil asymmetry, or Cushing response.');
    if (params.intracranialHemorrhagicVenousInfarct && (params.alteredMentalStatusComa || params.focalNeurologicalDeficit)) {
      elevatedIcpDirectives.push('Neurosurgical Standby: Prompt consult for decompressive hemicraniectomy if mass effect with midline shift or impending uncal herniation occurs.');
    }
  }

  // 4. Seizure Prophylaxis & Management
  if (params.seizuresPresent || params.antiepilepticTherapyActive) {
    seizureManagementDirectives.push('Antiseizure Medication (ASM): Levetiracetam (Keppra) 1000–1500 mg IV load followed by 500–1000 mg IV/oral q12h is preferred due to low drug interactions with anticoagulation and high fetal/neonatal safety profile.');
    seizureManagementDirectives.push('Continuous EEG: Recommend continuous video-EEG monitoring in ICU for non-convulsive status epilepticus in altered puerperal patients.');
  } else if (params.intracranialHemorrhagicVenousInfarct || params.focalNeurologicalDeficit) {
    recommendations.push('High Seizure Risk: Parenchymal lesion and focal signs confer > 50% seizure risk in acute CVST. Consider prophylactic Levetiracetam during the acute phase.');
  }

  // 5. Urgency Tier
  let urgencyTier: 'emergency_neurovascular_icu' | 'urgent_inpatient_cvst_anticoagulation' | 'neurology_consultation_surveillance' =
    'neurology_consultation_surveillance';
  let urgencyTierLabel = 'Neurology Consultation & Venous Imaging Surveillance';

  if (isHighRiskCvst || params.alteredMentalStatusComa) {
    urgencyTier = 'emergency_neurovascular_icu';
    urgencyTierLabel = 'EMERGENCY: Neuro-ICU Resuscitation / Elevated ICP & Anticoagulation';
  } else if (params.presentingHeadacheType === 'thunderclap_sudden_severe' || params.therapeuticAnticoagulationActive) {
    urgencyTier = 'urgent_inpatient_cvst_anticoagulation';
    urgencyTierLabel = 'Urgent Inpatient CVST Anticoagulation & Serial Neuro Checks';
  }

  const isAnticoagulationIndicated = true;
  const antiepilepticIndicated = Boolean(params.seizuresPresent || params.antiepilepticTherapyActive);
  const intracranialHypertensionUrgent = Boolean(
    params.papilledemaPresent ||
    params.alteredMentalStatusComa ||
    params.intracranialHypertensionManagement !== 'conservative_monitoring'
  );

  const urgencyCategory: 'emergency_neurovascular_icu' | 'urgent_therapeutic_anticoagulation' | 'neurology_consultation_surveillance' =
    urgencyTier === 'emergency_neurovascular_icu'
      ? 'emergency_neurovascular_icu'
      : urgencyTier === 'urgent_inpatient_cvst_anticoagulation'
      ? 'urgent_therapeutic_anticoagulation'
      : 'neurology_consultation_surveillance';

  return {
    isHighRiskCvst,
    isAnticoagulationIndicated,
    isHemorrhagicInfarctAnticoagulationSafe,
    anticoagulationSafeDespiteHemorrhage: isHemorrhagicInfarctAnticoagulationSafe,
    antiepilepticIndicated,
    intracranialHypertensionUrgent,
    anticoagulationDirectives,
    elevatedIcpDirectives,
    seizureManagementDirectives,
    antiepilepticDirectives: seizureManagementDirectives,
    recommendations,
    alerts,
    clinicalAlerts: alerts,
    urgencyTier,
    urgencyTierLabel,
    urgencyCategory,
  };
}
