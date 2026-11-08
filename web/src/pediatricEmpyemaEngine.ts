// Pure TypeScript calculation engine for Pediatric Empyema & Complicated Parapneumonic Effusion Protocol
// Guidelines: BTS Pediatric Pleural Infection Guidelines / AAP Section on Pediatric Pulmonology

export type PediatricEmpyemaStaging =
  | 'stage_1_exudative_simple'
  | 'stage_2_fibrinopurulent_complicated'
  | 'stage_3_organizing_pleural_peel';

export type UltrasoundFindings =
  | 'free_flowing_anechoic'
  | 'fibrinous_strands_early_septation'
  | 'dense_multiloculated_honeycomb'
  | 'thickened_visceral_pleura_trapped_lung';

export type PleuralFluidAppearance =
  | 'clear_serous'
  | 'turbid_cloudy'
  | 'frank_pus_purulent';

export type IntrapleuralFibrinolyticTherapy =
  | 'not_indicated_antibiotics_only'
  | 'tpa_plus_dornase_alfa_twice_daily'
  | 'single_agent_tpa'
  | 'saline_flush_control';

export interface PediatricEmpyemaParams {
  ageYears: number;
  weightKg: number;
  stagingPhase: PediatricEmpyemaStaging;
  ultrasoundFindings: UltrasoundFindings;
  pleuralFluidPh?: number;
  pleuralFluidGlucoseMgDl?: number;
  pleuralFluidLdhUL?: number;
  pleuralFluidAppearance: PleuralFluidAppearance;
  gramStainCultureIsolated?: string;
  chestTubePlaced: boolean;
  chestTubeSizeFr?: number;
  intrapleuralFibrinolyticTherapy: IntrapleuralFibrinolyticTherapy;
  dosesCompleted: number;
  vatsDecorticationIndicated: boolean;
}

export interface FibrinolyticDosing {
  tpaDoseMg: number;
  dornaseAlfaDoseMg: number;
  flushVolumeMl: number;
  dwellTimeHours: number;
  frequency: string;
  maxDoses: number;
}

export interface PediatricEmpyemaResult {
  isComplicatedEmpyema: boolean;
  pleuralBiomarkersAbnormal: boolean;
  calculatedRecommendedStage: PediatricEmpyemaStaging;
  recommendedChestTubeSizeFr: string;
  fibrinolyticDosing: FibrinolyticDosing;
  fibrinolyticProtocolDirectives: string[];
  vatsCriteriaMet: boolean;
  urgencyTier: 'vats_thoracoscopy_surgical' | 'intrapleural_fibrinolysis_active' | 'chest_drain_antibiotic_medical';
  urgencyTierLabel: string;
  recommendations: string[];
  alerts: string[];
}

export type PediatricEmpyemaEvaluationResult = PediatricEmpyemaResult;

export function evaluatePediatricEmpyema(
  params: PediatricEmpyemaParams
): PediatricEmpyemaResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const fibrinolyticProtocolDirectives: string[] = [];

  // Biochemical criteria for complicated parapneumonic effusion / empyema:
  // pH < 7.20, Glucose < 40 mg/dL, LDH > 1000 U/L, or frank pus
  const isPhAcidic = params.pleuralFluidPh !== undefined && params.pleuralFluidPh < 7.20;
  const isGlucoseLow = params.pleuralFluidGlucoseMgDl !== undefined && params.pleuralFluidGlucoseMgDl < 40;
  const isLdhHigh = params.pleuralFluidLdhUL !== undefined && params.pleuralFluidLdhUL > 1000;
  const isFrankPus = params.pleuralFluidAppearance === 'frank_pus_purulent';

  const pleuralBiomarkersAbnormal = isPhAcidic || isGlucoseLow || isLdhHigh || isFrankPus;

  // Ultrasound staging correlation
  const hasSeptations =
    params.ultrasoundFindings === 'fibrinous_strands_early_septation' ||
    params.ultrasoundFindings === 'dense_multiloculated_honeycomb';
  const hasTrappedLung = params.ultrasoundFindings === 'thickened_visceral_pleura_trapped_lung';

  let calculatedRecommendedStage: PediatricEmpyemaStaging = 'stage_1_exudative_simple';
  if (hasTrappedLung || params.stagingPhase === 'stage_3_organizing_pleural_peel') {
    calculatedRecommendedStage = 'stage_3_organizing_pleural_peel';
  } else if (hasSeptations || pleuralBiomarkersAbnormal || params.stagingPhase === 'stage_2_fibrinopurulent_complicated') {
    calculatedRecommendedStage = 'stage_2_fibrinopurulent_complicated';
  }

  const isComplicatedEmpyema = calculatedRecommendedStage !== 'stage_1_exudative_simple';

  // Chest tube sizing: BTS guidelines emphasize small bore (8-12 Fr)
  let recommendedChestTubeSizeFr = '8 - 12 Fr (Pigtail catheter)';
  if (params.ageYears >= 12 || params.weightKg >= 40) {
    recommendedChestTubeSizeFr = '12 - 14 Fr (Small bore chest drain)';
  }

  if (params.chestTubeSizeFr !== undefined && params.chestTubeSizeFr > 16) {
    alerts.push(
      `NOTE: Chest tube size (${params.chestTubeSizeFr} Fr) is large-bore. BTS guidelines favor small-bore (8-12 Fr) catheters for pediatric empyema to minimize insertion trauma and pain without sacrificing drainage efficacy.`
    );
  }

  // Fibrinolytic dosing:
  // tPA (Alteplase): 0.1 mg/kg (capped at 4 mg)
  // Dornase alfa: 5 mg fixed dose (or 0.2 mg/kg for < 10kg, standard is 5 mg in BTS/MIST-2 pediatric adaptations)
  const rawTpa = Math.round(params.weightKg * 0.1 * 10) / 10;
  const tpaDoseMg = Math.min(4.0, Math.max(1.0, rawTpa));
  const dornaseAlfaDoseMg = params.weightKg < 10 ? 2.5 : 5.0;
  const flushVolumeMl = params.weightKg < 15 ? 10 : 20;

  const fibrinolyticDosing: FibrinolyticDosing = {
    tpaDoseMg,
    dornaseAlfaDoseMg,
    flushVolumeMl,
    dwellTimeHours: 2,
    frequency: 'Twice daily (q12h) for up to 3 days',
    maxDoses: 6,
  };

  // VATS Criteria:
  // 1. Explicit clinician indication
  // 2. Stage 3 organizing pleural peel with trapped lung
  // 3. Persistent sepsis/failure after >= 4 doses of fibrinolytics
  const vatsCriteriaMet =
    params.vatsDecorticationIndicated ||
    calculatedRecommendedStage === 'stage_3_organizing_pleural_peel' ||
    (params.dosesCompleted >= 4 && params.ultrasoundFindings === 'dense_multiloculated_honeycomb');

  // Directives for fibrinolytics
  if (isComplicatedEmpyema) {
    fibrinolyticProtocolDirectives.push(
      `Intrapleural Alteplase (tPA) ${tpaDoseMg} mg + Dornase alfa (DNase) ${dornaseAlfaDoseMg} mg instilled sequentially via chest tube.`
    );
    fibrinolyticProtocolDirectives.push(
      `Flush with ${flushVolumeMl} mL sterile 0.9% normal saline and clamp chest tube for 2 hours dwell time.`
    );
    fibrinolyticProtocolDirectives.push(
      'Unclamp chest tube to continuous low negative suction (-10 to -20 cmH2O) after 2-hour dwell.'
    );
    fibrinolyticProtocolDirectives.push('Administer twice daily for maximum of 6 doses (3 days).');
  }

  // Biomarker alerts
  if (isPhAcidic) {
    alerts.push(`ACIDIC PLEURAL FLUID: Pleural fluid pH is ${params.pleuralFluidPh} (< 7.20), signifying anaerobic bacterial metabolism and complicated infection.`);
  }
  if (isGlucoseLow) {
    alerts.push(`HYPOGLUCOPLEURIA: Pleural fluid glucose is ${params.pleuralFluidGlucoseMgDl} mg/dL (< 40 mg/dL), confirming high bacterial and leukocyte consumption.`);
  }
  if (isLdhHigh) {
    alerts.push(`ELEVATED PLEURAL LDH: Pleural fluid LDH is ${params.pleuralFluidLdhUL} U/L (> 1000 U/L), indicating intense pleural inflammation.`);
  }

  // Urgency tier
  let urgencyTier: 'vats_thoracoscopy_surgical' | 'intrapleural_fibrinolysis_active' | 'chest_drain_antibiotic_medical' =
    'chest_drain_antibiotic_medical';
  let urgencyTierLabel = 'Small-Bore Chest Drainage & Medical IV Antibiotic Therapy';

  if (vatsCriteriaMet) {
    urgencyTier = 'vats_thoracoscopy_surgical';
    urgencyTierLabel = 'SURGICAL DECORTICATION: VATS Video-Assisted Thoracoscopy Indicated';
    alerts.push(
      'SURGICAL INDICATION: Thick organizing peel / trapped lung or failure of intrapleural fibrinolytics. Consult Pediatric Surgery for VATS decortication and mechanical debridement.'
    );
    recommendations.push('Proceed with emergent or scheduled VATS decortication to peel thick fibrothorax and achieve complete lung re-expansion.');
  } else if (isComplicatedEmpyema) {
    urgencyTier = 'intrapleural_fibrinolysis_active';
    urgencyTierLabel = 'Stage 2 Complicated Empyema: Intrapleural tPA + DNase Fibrinolytic Protocol';
    recommendations.push('Initiate twice-daily intrapleural tPA + Dornase alfa therapy via small-bore chest tube.');
    recommendations.push('Broad-spectrum intravenous antibiotics covering S. pneumoniae, S. pyogenes, and S. aureus (e.g. Cefotaxime/Ceftriaxone + Clindamycin/Vancomycin).');
  } else {
    recommendations.push('Simple exudative effusion: Chest tube drainage and IV antibiotics; monitor clinical trajectory and repeat ultrasound in 48 hours if fever persists.');
  }

  if (!params.chestTubePlaced && isComplicatedEmpyema) {
    alerts.push('INTERVENTION MANDATORY: Chest tube placement required for drainage and intrapleural fibrinolysis in complicated empyema.');
  }

  return {
    isComplicatedEmpyema,
    pleuralBiomarkersAbnormal,
    calculatedRecommendedStage,
    recommendedChestTubeSizeFr,
    fibrinolyticDosing,
    fibrinolyticProtocolDirectives,
    vatsCriteriaMet,
    urgencyTier,
    urgencyTierLabel,
    recommendations,
    alerts,
  };
}
