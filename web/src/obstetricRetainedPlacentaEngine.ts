// Pure TypeScript calculation engine for Obstetric Retained Placenta & Emergent Manual Removal (MROP) Protocol
// Guidelines: RCOG Green-top / WHO Guidelines on Prevention and Treatment of Postpartum Haemorrhage

export interface ObstetricRetainedPlacentaParams {
  thirdStageDurationMinutes: number;
  activeManagementThirdStage: boolean;
  estimatedBloodLossMl: number;
  hemodynamicStability: 'stable' | 'borderline_tachycardic' | 'decompensated_hypotensive_shock';
  bladderCatheterized: boolean;
  retainedPlacentaType: 'placenta_adherens' | 'trapped_incarcerated_placenta' | 'partial_accreta_suspected';
  iuvOxytocinAttempted: boolean;
  iuvOxytocinSuccessful: boolean;
  mropPerformed: boolean;
  placentaCompletePostRemoval: boolean;
  prophylacticAntibioticsGiven: boolean;
  postRemovalOxytocinInfusion: boolean;
}

export interface ObstetricRetainedPlacentaResult {
  durationCategory: 'normal' | 'prolonged_retained' | 'critical_hemorrhage_delay';
  durationCategoryLabel: string;
  mropUrgency: 'conservative_iuv_trial' | 'urgent_operating_theatre' | 'immediate_emergent_mrop';
  mropUrgencyLabel: string;
  iuvProtocol: {
    recommended: boolean;
    regimen: string;
  };
  antibioticGuidance: string;
  postRemovalChecklist: string[];
  recommendations: string[];
  alerts: string[];
}

export function evaluateObstetricRetainedPlacenta(
  params: ObstetricRetainedPlacentaParams
): ObstetricRetainedPlacentaResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const postRemovalChecklist: string[] = [];

  // 1. Duration Classification
  // Active management threshold = 30 min; Expectant threshold = 60 min
  const thresholdMinutes = params.activeManagementThirdStage ? 30 : 60;
  let durationCategory: 'normal' | 'prolonged_retained' | 'critical_hemorrhage_delay' = 'normal';
  let durationCategoryLabel = `Normal Third Stage (<${thresholdMinutes} min)`;

  if (params.thirdStageDurationMinutes >= 60 || params.estimatedBloodLossMl >= 1000) {
    durationCategory = 'critical_hemorrhage_delay';
    durationCategoryLabel = 'Critical Delay (≥60 min or Severe PPH)';
    alerts.push('CRITICAL: Third stage markedly prolonged or heavy blood loss. Immediate theater transfer indicated.');
  } else if (params.thirdStageDurationMinutes >= thresholdMinutes || params.estimatedBloodLossMl >= 500) {
    durationCategory = 'prolonged_retained';
    durationCategoryLabel = `Retained Placenta (Exceeded ${thresholdMinutes} min threshold or PPH onset)`;
  }

  // 2. Bladder Catheterization Alert
  if (!params.bladderCatheterized) {
    alerts.push('ACTION REQUIRED: Perform in-and-out urinary catheterization immediately. A full bladder obstructs uterine contraction and placental expulsion.');
    recommendations.push('Catheterize bladder to decompress lower uterine segment.');
  }

  // 3. MROP Urgency & Theater Preparation
  let mropUrgency: 'conservative_iuv_trial' | 'urgent_operating_theatre' | 'immediate_emergent_mrop' = 'conservative_iuv_trial';
  let mropUrgencyLabel = 'Trial Conservative / Intra-Umbilical Vein Oxytocin';

  const isEmergent =
    params.hemodynamicStability === 'decompensated_hypotensive_shock' ||
    params.estimatedBloodLossMl >= 1000 ||
    params.retainedPlacentaType === 'partial_accreta_suspected';

  const isUrgent =
    params.thirdStageDurationMinutes >= 45 ||
    params.hemodynamicStability === 'borderline_tachycardic' ||
    params.estimatedBloodLossMl >= 500 ||
    (params.iuvOxytocinAttempted && !params.iuvOxytocinSuccessful);

  if (isEmergent) {
    mropUrgency = 'immediate_emergent_mrop';
    mropUrgencyLabel = 'Immediate Emergent MROP in Operating Theatre (Severe PPH / Instability)';
    alerts.push('EMERGENCY: Active hemorrhage or shock. Transfer directly to OT under regional or general anesthesia. Activate MTP if indicated.');
  } else if (isUrgent) {
    mropUrgency = 'urgent_operating_theatre';
    mropUrgencyLabel = 'Urgent Operating Theatre Transfer for MROP';
  }

  // 4. Intra-Umbilical Vein (IUV) Oxytocin Protocol
  const iuvRecommended =
    !isEmergent &&
    !params.iuvOxytocinAttempted &&
    params.estimatedBloodLossMl < 500 &&
    params.thirdStageDurationMinutes >= thresholdMinutes;

  const iuvProtocol = {
    recommended: iuvRecommended,
    regimen: '20 IU Oxytocin diluted in 20 mL 0.9% Normal Saline injected into umbilical vein via catheter/feeding tube, clamped for 15-30 min with gentle traction.',
  };

  if (iuvRecommended) {
    recommendations.push(`Trial Intra-Umbilical Vein (IUV) Oxytocin: ${iuvProtocol.regimen}`);
  }

  // 5. Antibiotic Prophylaxis Guidance
  const antibioticGuidance = 'Single-dose IV Ampicillin 2g (or Cefazolin 1-2g) plus IV Metronidazole 500mg prior to manual uterine instrumentation to prevent endometritis.';
  if (!params.prophylacticAntibioticsGiven) {
    recommendations.push(`Administer antibiotic prophylaxis: ${antibioticGuidance}`);
  }

  // 6. Post-Removal Care & Checks
  postRemovalChecklist.push('Carefully inspect maternal surface of placenta to verify all cotyledons and succenturiate lobes are intact.');
  postRemovalChecklist.push('Initiate continuous high-dose IV Oxytocin infusion (20-40 IU in 1000 mL crystalloid at 125-250 mL/hr) for 4-6 hours.');
  postRemovalChecklist.push('Perform bimanual uterine compression until firm sustained uterine fundal tone is achieved.');
  postRemovalChecklist.push('Monitor vital signs, vaginal lochia, and fundal height every 15 minutes for the first 2 hours postpartum.');

  if (params.retainedPlacentaType === 'partial_accreta_suspected') {
    alerts.push('SUSPECTED ACCRETA: If no retroplacental cleavage plane is felt, DO NOT forcefully tear or avulse myometrium. Prepare for Bakri balloon tamponade, uterine artery embolization, or emergency laparotomy.');
  }

  if (params.mropPerformed && !params.placentaCompletePostRemoval) {
    alerts.push('WARNING: Incomplete placental removal reported. Retained cotyledons require ultrasound check or gentle ultrasound-guided curettage.');
  }

  return {
    durationCategory,
    durationCategoryLabel,
    mropUrgency,
    mropUrgencyLabel,
    iuvProtocol,
    antibioticGuidance,
    postRemovalChecklist,
    recommendations,
    alerts,
  };
}
