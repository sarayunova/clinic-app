// Pure TypeScript calculation engine for Obstetric Septic Pelvic Thrombophlebitis (SPT) & Heparin Challenge Protocol
// Guidelines: ACOG Practice Bulletin / SMFM Consults / CDC Postpartum Infection Guidelines

export type SptPhenotype =
  | 'ovarian_vein_thrombosis'
  | 'deep_septic_pelvic_thrombophlebitis'
  | 'undifferentiated_refractory_fever';

export type DeliveryMode =
  | 'cesarean_section'
  | 'operative_vaginal'
  | 'spontaneous_vaginal';

export type AffectedVein =
  | 'right_ovarian_vein'
  | 'left_ovarian_vein'
  | 'bilateral_ovarian_veins'
  | 'internal_iliac_plexus'
  | 'not_visualized_clinical_diagnosis';

export type PelvicImagingFindings =
  | 'thrombus_with_rim_enhancement'
  | 'pelvic_phlebitis_perivascular_stranding'
  | 'negative_no_thrombus_seen'
  | 'imaging_pending';

export type AnticoagulantRegimen =
  | 'iv_unfractionated_heparin_infusion'
  | 'therapeutic_lmwh_weight_based'
  | 'transition_to_oral_anticoagulation';

export type HeparinChallengeResponse =
  | 'pending_under_48h'
  | 'positive_defervescence_within_48_72h'
  | 'refractory_persistent_fever'
  | 'alternative_pathology_identified';

export interface ObstetricSptParams {
  deliveryMode: DeliveryMode;
  postpartumDay: number;
  sptPhenotype: SptPhenotype;
  affectedVein: AffectedVein;
  peakTemperatureCelsius: number;
  hoursRefractoryTripleAntibiotics: number;
  pelvicCtMriFindings: PelvicImagingFindings;
  pelvicAbscessRuledOut: boolean;
  heparinChallengeInitiated: boolean;
  anticoagulantRegimen: AnticoagulantRegimen;
  targetApttSeconds?: string;
  defervescenceHours?: number | null;
  heparinChallengeResponse: HeparinChallengeResponse;
}

export interface ObstetricSptResult {
  phenotypeDescription: string;
  diagnosticLikelihood: 'confirmed_radiographic_ovt' | 'probable_dspt_heparin_responsive' | 'suspected_refractory_spt' | 'unlikely_alternative_source';
  diagnosticLikelihoodLabel: string;
  isFeverRefractoryCriteriaMet: boolean;
  heparinChallengeInterpretation: string;
  recommendedAnticoagulationDuration: string;
  heparinDosingDirectives: string[];
  antimicrobialDirectives: string[];
  imagingDirectives: string[];
  recommendations: string[];
  alerts: string[];
  urgencyTier: 'urgent_heparin_challenge' | 'active_therapeutic_management' | 'resolving_surveillance';
  urgencyTierLabel: string;
}

export type ObstetricSptEvaluationResult = ObstetricSptResult;

export function evaluateObstetricSpt(params: ObstetricSptParams): ObstetricSptResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const heparinDosingDirectives: string[] = [];
  const antimicrobialDirectives: string[] = [];
  const imagingDirectives: string[] = [];

  // 1. Refractory Fever Criteria
  const isFeverRefractoryCriteriaMet = params.hoursRefractoryTripleAntibiotics >= 48;
  if (!isFeverRefractoryCriteriaMet) {
    recommendations.push(`Patient has received ${params.hoursRefractoryTripleAntibiotics}h of broad-spectrum IV antibiotics. Classical SPT diagnostic criteria typically require >= 48 hours of refractory postpartum fever.`);
  } else {
    alerts.push(`Refractory postpartum fever documented (${params.hoursRefractoryTripleAntibiotics}h on broad-spectrum IV coverage, peak temp ${params.peakTemperatureCelsius}°C). Strong clinical suspicion for SPT.`);
  }

  // 2. Phenotype Analysis & Radiographic Correlation
  let phenotypeDescription = '';
  if (params.sptPhenotype === 'ovarian_vein_thrombosis') {
    phenotypeDescription = 'Ovarian Vein Thrombosis (OVT): localized retroperitoneal venous thrombosis (predominantly right-sided in ~80-90% due to dextrorotation and anterograde flow).';
    if (params.affectedVein === 'right_ovarian_vein') {
      recommendations.push('Right ovarian vein thrombosis confirmed/suspected. Correlate with right lower quadrant or flank pain.');
    } else if (params.affectedVein === 'bilateral_ovarian_veins') {
      alerts.push('CRITICAL: Bilateral ovarian vein thrombosis carries increased risk of extension into inferior vena cava and renal veins.');
    }
  } else if (params.sptPhenotype === 'deep_septic_pelvic_thrombophlebitis') {
    phenotypeDescription = 'Deep Septic Pelvic Thrombophlebitis (DSPT): diffuse microvascular thrombosis of pelvic venous plexus, classically presenting with "picket-fence" fevers without palpable mass.';
    recommendations.push('DSPT is frequently below the spatial resolution of conventional CT/MRI. Diagnosis is established by clinical exclusion and heparin challenge response.');
  } else {
    phenotypeDescription = 'Undifferentiated refractory postpartum fever under diagnostic evaluation for SPT.';
  }

  // 3. Pelvic Imaging & Abscess Exclusion
  if (!params.pelvicAbscessRuledOut) {
    alerts.push('CRITICAL: Pelvic abscess / infected hematoma must be rigorously excluded prior to attributing persistent fever solely to SPT. Untreated abscess will not defervesce on heparin alone.');
  }

  if (params.pelvicCtMriFindings === 'imaging_pending') {
    imagingDirectives.push('Contrast-enhanced abdominopelvic CT or MRI with MR venography recommended to evaluate ovarian veins and rule out pelvic fluid collection/abscess.');
  } else if (params.pelvicCtMriFindings === 'thrombus_with_rim_enhancement') {
    imagingDirectives.push('CT/MRI reveals definitive tubular venous enlargement with central hypodensity and rim enhancement pathognomonic of septic thrombophlebitis.');
  } else if (params.pelvicCtMriFindings === 'negative_no_thrombus_seen') {
    imagingDirectives.push('Negative CT does not exclude DSPT (microvascular pelvic venous plexus involvement). Heparin challenge response serves as diagnostic test.');
  }

  // 4. Heparin Challenge Response & Diagnostic Likelihood
  let diagnosticLikelihood: 'confirmed_radiographic_ovt' | 'probable_dspt_heparin_responsive' | 'suspected_refractory_spt' | 'unlikely_alternative_source' = 'suspected_refractory_spt';
  let diagnosticLikelihoodLabel = 'Suspected SPT (Evaluation in Progress)';
  let heparinChallengeInterpretation = '';

  if (params.pelvicCtMriFindings === 'thrombus_with_rim_enhancement') {
    diagnosticLikelihood = 'confirmed_radiographic_ovt';
    diagnosticLikelihoodLabel = 'Confirmed Ovarian Vein Thrombosis (Radiographic)';
  } else if (params.heparinChallengeResponse === 'positive_defervescence_within_48_72h') {
    diagnosticLikelihood = 'probable_dspt_heparin_responsive';
    diagnosticLikelihoodLabel = 'Confirmed DSPT via Positive Heparin Challenge';
    heparinChallengeInterpretation = 'Rapid defervescence within 48-72 hours following therapeutic anticoagulation confirms the diagnosis of Deep Septic Pelvic Thrombophlebitis.';
  } else if (params.heparinChallengeResponse === 'refractory_persistent_fever') {
    diagnosticLikelihood = 'unlikely_alternative_source';
    diagnosticLikelihoodLabel = 'Refractory Fever: Re-evaluate for Hidden Sepsis Source';
    heparinChallengeInterpretation = 'Persistent fever beyond 72 hours of therapeutic heparin strongly suggests an alternative occult source (e.g. drug fever, resistant organism, un-drained pelvic/psoas abscess, C. difficile).';
    alerts.push('HEPARIN CHALLENGE NEGATIVE: Fever refractory > 72h on heparin. Re-evaluate blood cultures, wound, and consider repeating pelvic cross-sectional imaging.');
  } else {
    heparinChallengeInterpretation = 'Heparin challenge currently active; monitor for temperature curve lysis over next 48 to 72 hours.';
  }

  // 5. Anticoagulation Duration
  let recommendedAnticoagulationDuration = '';
  if (params.sptPhenotype === 'ovarian_vein_thrombosis' || params.pelvicCtMriFindings === 'thrombus_with_rim_enhancement') {
    recommendedAnticoagulationDuration = '6 weeks of therapeutic anticoagulation (LMWH or transition to DOAC/Warfarin) with repeat imaging if symptoms recur.';
  } else {
    recommendedAnticoagulationDuration = 'Short-course anticoagulation (1 to 2 weeks, or until afebrile for 48-72 hours with clinical symptom resolution).';
  }

  // 6. Directives for Anticoagulation and Antibiotics
  heparinDosingDirectives.push('IV Unfractionated Heparin: Initial 80 units/kg IV bolus followed by 18 units/kg/h continuous infusion.');
  heparinDosingDirectives.push('Titrate infusion every 6 hours to maintain therapeutic aPTT 1.5 to 2.5 times control (typically 60-85 seconds) or anti-Xa 0.3-0.7 IU/mL.');
  heparinDosingDirectives.push('Alternatively, therapeutic Enoxaparin 1 mg/kg subcutaneously every 12 hours once patient is hemodynamically stable and no imminent surgical re-exploration.');
  heparinDosingDirectives.push('Monitor platelet counts at baseline and days 3, 5, 7 to screen for Heparin-Induced Thrombocytopenia (HIT).');

  antimicrobialDirectives.push('Maintain broad-spectrum parenteral coverage (e.g. Ampicillin + Gentamicin + Clindamycin OR Piperacillin/Tazobactam) covering polymicrobial pelvic pathogens (GBS, enterococci, Enterobacteriaceae, Bacteroides fragilis).');
  antimicrobialDirectives.push('Continue parenteral antibiotics until the patient remains completely afebrile and symptom-free for at least 48 hours.');

  // 7. Urgency Tier
  let urgencyTier: 'urgent_heparin_challenge' | 'active_therapeutic_management' | 'resolving_surveillance' = 'active_therapeutic_management';
  let urgencyTierLabel = 'Active Therapeutic Anticoagulation';

  if (!params.heparinChallengeInitiated || params.heparinChallengeResponse === 'pending_under_48h') {
    urgencyTier = 'urgent_heparin_challenge';
    urgencyTierLabel = 'Urgent Heparin Challenge & Fever Curve Tracking';
  } else if (params.heparinChallengeResponse === 'positive_defervescence_within_48_72h' && params.peakTemperatureCelsius < 38.0) {
    urgencyTier = 'resolving_surveillance';
    urgencyTierLabel = 'Resolving SPT / Defervesced Post-Challenge';
  }

  return {
    phenotypeDescription,
    diagnosticLikelihood,
    diagnosticLikelihoodLabel,
    isFeverRefractoryCriteriaMet,
    heparinChallengeInterpretation,
    recommendedAnticoagulationDuration,
    heparinDosingDirectives,
    antimicrobialDirectives,
    imagingDirectives,
    recommendations,
    alerts,
    urgencyTier,
    urgencyTierLabel,
  };
}
