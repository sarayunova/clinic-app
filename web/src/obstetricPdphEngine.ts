// Pure TypeScript calculation engine for Obstetric Postdural Puncture Headache (PDPH) & Epidural Blood Patch (EBP) Protocol
// Guidelines: Obstetric Anaesthetists' Association (OAA) / SOAP / ASA Consensus on PDPH & Epidural Blood Patch

export interface ObstetricPdphEvaluationParams {
  procedureType: 'labor_epidural_adp' | 'spinal_anesthesia' | 'combined_spinal_epidural' | 'diagnostic_lumbar_puncture';
  needleGauge: '16G_tuohy' | '17G_tuohy' | '18G_tuohy' | '22G_quincke' | '25G_whitacre' | '27G_whitacre' | 'other';
  initialVasScore: number; // 0 to 10
  posturalComponent: boolean;
  neckStiffness: boolean;
  auditorySymptoms: boolean; // tinnitus, hypoacusia
  visualSymptomsDiplopia: boolean; // CN VI palsy
  conservativeHydrationMl24h?: number;
  caffeineAdministered?: boolean;
  redFlagsPresent?: boolean;
  temperatureCelsius?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
}

export interface ObstetricPdphEvaluationResult {
  vasScore: number;
  severityTier: 'none' | 'mild' | 'moderate' | 'severe';
  severityTierLabel: string;
  isPosturalTypical: boolean;
  ebpIndicated: boolean;
  ebpUrgency: 'none' | 'elective_if_conservative_fails' | 'strongly_indicated_emergent';
  recommendedEbpVolumeMl: string;
  hasRedFlags: boolean;
  redFlagWarnings: string[];
  conservativeRecommendations: string[];
  proceduralRecommendations: string[];
  alerts: string[];
}

export function evaluateObstetricPdph(params: ObstetricPdphEvaluationParams): ObstetricPdphEvaluationResult {
  const vas = Math.max(0, Math.min(10, Math.round(params.initialVasScore || 0)));
  const alerts: string[] = [];
  const redFlagWarnings: string[] = [];
  const conservativeRecommendations: string[] = [];
  const proceduralRecommendations: string[] = [];

  // Severity stratification
  let severityTier: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
  let severityTierLabel = 'No Significant Headache (VAS 0)';

  if (vas >= 7) {
    severityTier = 'severe';
    severityTierLabel = 'Severe Incapacitating PDPH (VAS 7-10)';
    alerts.push('CRITICAL: Patient is severely incapacitated, unable to tolerate upright posture or care for neonate.');
  } else if (vas >= 4) {
    severityTier = 'moderate';
    severityTierLabel = 'Moderate PDPH (VAS 4-6)';
  } else if (vas >= 1) {
    severityTier = 'mild';
    severityTierLabel = 'Mild PDPH (VAS 1-3)';
  }

  // Pathognomonic postural check
  const isPosturalTypical = params.posturalComponent;
  if (!isPosturalTypical) {
    alerts.push('CAUTION: Headache lacks clear postural worsening on upright posture. Thoroughly investigate alternative etiologies (pre-eclampsia, migraine, intracranial pathology).');
  }

  // Red flag assessments
  let hasRedFlags = Boolean(params.redFlagsPresent);

  if (params.temperatureCelsius && params.temperatureCelsius >= 38.0) {
    hasRedFlags = true;
    redFlagWarnings.push(`Fever detected (${params.temperatureCelsius}°C) with headache. Evaluate urgently for bacterial or chemical meningitis; blood cultures and infectious workup mandatory.`);
  }

  if (params.bloodPressureSys && params.bloodPressureSys >= 160) {
    hasRedFlags = true;
    redFlagWarnings.push(`Severe systolic hypertension (${params.bloodPressureSys} mmHg). Screen immediately for postpartum preeclampsia / PRES / eclampsia.`);
  }

  if (params.visualSymptomsDiplopia) {
    redFlagWarnings.push('Diplopia / 6th cranial nerve traction palsy present. Suggests severe CSF hypovolemia or intracranial hypotension traction.');
    alerts.push('Cranial nerve VI traction palsy noted (diplopia). Prompt epidural blood patch indicated to restore intracranial pressure.');
  }

  if (params.auditorySymptoms) {
    alerts.push('Auditory symptoms (tinnitus, hearing dampening) indicative of endolymphatic sac pressure gradient changes.');
  }

  // EBP Indication & Urgency
  let ebpIndicated = false;
  let ebpUrgency: 'none' | 'elective_if_conservative_fails' | 'strongly_indicated_emergent' = 'none';

  if (severityTier === 'severe' || params.visualSymptomsDiplopia) {
    ebpIndicated = true;
    ebpUrgency = 'strongly_indicated_emergent';
    proceduralRecommendations.push('Autologous Epidural Blood Patch (EBP) strongly indicated. Prepare for 2-operator sterile procedure.');
  } else if (severityTier === 'moderate') {
    ebpIndicated = true;
    ebpUrgency = 'elective_if_conservative_fails';
    proceduralRecommendations.push('Trial conservative therapy for 24-48 hours. Offer elective EBP if debilitating symptoms persist or prevent infant care.');
  } else {
    ebpIndicated = false;
    ebpUrgency = 'none';
    proceduralRecommendations.push('Conservative medical management is first-line for mild symptoms. Monitor outpatient/ward for progression.');
  }

  // Recommended Blood Volume
  const recommendedEbpVolumeMl = '15 to 20 mL of autologous blood (halt earlier if significant back/radicular pain develops)';

  // Conservative Management Guidance
  conservativeRecommendations.push('Encourage aggressive oral hydration (2.5 - 3.0 L/day) and/or IV isotonic crystalloids.');
  conservativeRecommendations.push('Prescribe scheduled multimodal analgesia: Paracetamol 1000 mg PO Q6H plus Ibuprofen 400 mg PO Q8H (if no contraindication).');
  conservativeRecommendations.push('Consider Caffeine therapy: Oral caffeine 200-300 mg PO Q8H or IV Caffeine sodium benzoate 500 mg in 500 mL normal saline over 1 hour (max 900 mg/day).');
  conservativeRecommendations.push('Allow comfortable recumbent rest; avoid prolonged forced flat bedrest if patient prefers slight elevation.');

  if (ebpIndicated) {
    proceduralRecommendations.push('Pre-EBP Checklist: Confirm patient consent, absence of coagulopathy, normal platelets (≥80-100k), and absence of systemic infection/fever.');
    proceduralRecommendations.push('Technique: Dual-operator sterile setup. Venipuncture 20 mL sterile peripheral blood; simultaneously locate epidural space at or one level below initial puncture.');
    proceduralRecommendations.push('Post-EBP Protocol: Patient to remain supine for 1-2 hours. Advise avoidance of heavy lifting, Valsalva, straining, or coughing for 48 hours. Prescribe stool softeners.');
  }

  return {
    vasScore: vas,
    severityTier,
    severityTierLabel,
    isPosturalTypical,
    ebpIndicated,
    ebpUrgency,
    recommendedEbpVolumeMl,
    hasRedFlags,
    redFlagWarnings,
    conservativeRecommendations,
    proceduralRecommendations,
    alerts
  };
}
