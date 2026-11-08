// Pure TypeScript calculation engine for Neonatal Meconium Ileus & Cystic Fibrosis Gastrografin Decompression Protocol
// Guidelines: AAP Section on Surgery / Cystic Fibrosis Foundation Guidelines

export interface NeonatalMeconiumIleusParams {
  ageHours: number;
  weightKg: number;
  meconiumPassedYet: boolean;
  abdominalDistension: 'absent' | 'mild' | 'marked_tense';
  emesisCharacter: 'none' | 'gastric_clear' | 'bilious_green';
  palpableDoughyMasses: boolean;
  familyHistoryCysticFibrosis: boolean;
  plainAbdominalXrayFindings:
    | 'neuhauser_soap_bubble_sign'
    | 'dilated_loops_no_fluid_levels'
    | 'calcifications_meconium_peritonitis'
    | 'pneumoperitoneum_free_air'
    | 'non_specific_distension';
  contrastEnemaPerformed: boolean;
  contrastEnemaType: 'gastrografin_dilute' | 'omnipaque_water_soluble' | 'barium_contraindicated' | 'none';
  microcolonConfirmed: boolean;
  meconiumPelletsVisualized: boolean;
  complicationPresent:
    | 'uncomplicated_simple_ileus'
    | 'volvulus_gangrene'
    | 'atresia_segmental'
    | 'meconium_peritonitis_pseudocyst'
    | 'perforation_free_air';
  enemaAttemptsCount: number;
  enemaSuccessOutcome:
    | 'successful_evacuation_reflux_into_ileum'
    | 'partial_evacuation_repeat_indicated'
    | 'failed_refractory_obstruction'
    | 'procedure_aborted_perforation_risk'
    | 'not_attempted_surgery_first';
}

export interface NeonatalMeconiumIleusResult {
  isCysticFibrosisSuspected: boolean;
  isComplicatedIleus: boolean;
  urgencyTier: 'immediate_laparotomy_crash' | 'gastrografin_fluoroscopic_decompression' | 'stable_monitoring_repeat';
  urgencyTierLabel: string;
  surgeryIndicated: boolean;
  recommendedProcedure: string;
  gastrografinProtocolDirectives: string[];
  cysticFibrosisDirectives: string[];
  recommendations: string[];
  alerts: string[];
}

export type NeonatalMeconiumIleusEvaluationResult = NeonatalMeconiumIleusResult;

export function evaluateNeonatalMeconiumIleus(
  params: NeonatalMeconiumIleusParams
): NeonatalMeconiumIleusResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const gastrografinProtocolDirectives: string[] = [];
  const cysticFibrosisDirectives: string[] = [];

  const isComplicatedIleus =
    params.complicationPresent !== 'uncomplicated_simple_ileus' ||
    params.plainAbdominalXrayFindings === 'pneumoperitoneum_free_air' ||
    params.plainAbdominalXrayFindings === 'calcifications_meconium_peritonitis';

  // CFTR connection: 80-90% of neonates with meconium ileus have Cystic Fibrosis
  const isCysticFibrosisSuspected =
    params.microcolonConfirmed ||
    params.plainAbdominalXrayFindings === 'neuhauser_soap_bubble_sign' ||
    params.familyHistoryCysticFibrosis ||
    !params.meconiumPassedYet;

  let urgencyTier: 'immediate_laparotomy_crash' | 'gastrografin_fluoroscopic_decompression' | 'stable_monitoring_repeat' =
    'gastrografin_fluoroscopic_decompression';
  let urgencyTierLabel = 'Therapeutic Fluoroscopic Contrast Decompression Indicated';
  let surgeryIndicated = false;
  let recommendedProcedure = 'Diagnostic & Therapeutic Water-Soluble Contrast Enema (Dilute Gastrografin / Omnipaque).';

  // 1. Surgical Emergency Triggers:
  // - Perforation (pneumoperitoneum), volvulus with gangrene, intestinal atresia, or giant meconium pseudocyst
  // - Refractory failure after 2-3 enemas
  // - Clinical peritonitis / shock
  if (
    isComplicatedIleus ||
    params.enemaSuccessOutcome === 'procedure_aborted_perforation_risk' ||
    (params.enemaSuccessOutcome === 'failed_refractory_obstruction' && params.enemaAttemptsCount >= 2) ||
    params.enemaSuccessOutcome === 'not_attempted_surgery_first'
  ) {
    urgencyTier = 'immediate_laparotomy_crash';
    urgencyTierLabel = 'SURGICAL EMERGENCY: Laparotomy & Operative Decompression / Enterostomy';
    surgeryIndicated = true;
    recommendedProcedure =
      params.complicationPresent === 'atresia_segmental' || params.complicationPresent === 'volvulus_gangrene'
        ? 'Resection of non-viable bowel with Bishop-Koop or Santulli enterostomy.'
        : 'Enterotomy, warm saline / N-acetylcysteine intraluminal irrigation, and Bishop-Koop T-tube enterostomy.';
    alerts.push(
      'SURGICAL RED ALERT: Complicated meconium ileus (perforation, volvulus, atresia, or pseudocyst) or failed fluoroscopic decompression. Stat pediatric surgical intervention required.'
    );
  } else if (params.enemaSuccessOutcome === 'successful_evacuation_reflux_into_ileum') {
    urgencyTier = 'stable_monitoring_repeat';
    urgencyTierLabel = 'Successful Contrast Decompression: Post-Enema Observation';
    surgeryIndicated = false;
    recommendedProcedure = 'Serial abdominal examinations, IV hydration, and monitoring for progressive stool evacuation.';
    recommendations.push(
      'Contrast reflux into dilated terminal ileum successfully achieved. Continue gastric decompression and IV maintenance until bowel function established.'
    );
  } else if (params.enemaSuccessOutcome === 'partial_evacuation_repeat_indicated') {
    urgencyTier = 'gastrografin_fluoroscopic_decompression';
    urgencyTierLabel = 'Partial Evacuation: Repeat Dilute Contrast Enema in 8–12 Hours';
    surgeryIndicated = false;
    recommendedProcedure = 'Repeat water-soluble contrast enema under fluoroscopy after hydration optimization.';
    recommendations.push(
      'Partial pellet evacuation noted. A repeat dilute Gastrografin enema may be safely attempted within 8-12 hours if abdomen remains soft and non-tender.'
    );
  }

  // 2. Gastrografin Protocol Directives
  gastrografinProtocolDirectives.push('Gastrografin is hyperosmolar (~1900 mOsm/L); always dilute 1:3 or 1:4 with sterile water to reduce osmolar fluid shift risk.');
  gastrografinProtocolDirectives.push(`Pre-hydrate neonate with IV isotonic crystalloid (10-20 mL/kg = ${Math.round(params.weightKg * 10)} to ${Math.round(params.weightKg * 20)} mL) prior to enema infusion.`);
  gastrografinProtocolDirectives.push('Enema must be performed under direct continuous fluoroscopic vision by an experienced pediatric radiologist.');
  gastrografinProtocolDirectives.push('Stop infusion immediately if patient shows respiratory compromise, sudden bradycardia, or extravasation.');

  if (params.contrastEnemaType === 'barium_contraindicated') {
    alerts.push('BARIUM ABSOLUTELY CONTRAINDICATED: Insoluble barium creates inspissated impaction and catastrophic barium peritonitis if perforation occurs.');
  }

  // 3. Cystic Fibrosis Directives
  cysticFibrosisDirectives.push('Send newborn screening blood spot / blood sample for CFTR comprehensive gene panel (delta-F508 and high-frequency mutations).');
  cysticFibrosisDirectives.push('Schedule quantitative pilocarpine iontophoresis sweat chloride test once weight > 2.0 kg and age > 2 weeks.');
  cysticFibrosisDirectives.push('Initiate Pancreatic Enzyme Replacement Therapy (PERT) microtablets/granules with enteral feedings once oral intake tolerated.');

  if (params.plainAbdominalXrayFindings === 'neuhauser_soap_bubble_sign') {
    alerts.push('NEUHAUSER SIGN (Soap-Bubble Effect): Air mixed with thick tenacious meconium in right lower quadrant pathognomonic of meconium ileus.');
  }

  if (params.microcolonConfirmed) {
    recommendations.push('Microcolon of disuse: Unused narrow caliber distal colon confirms prolonged complete distal ileal obstruction.');
  }

  return {
    isCysticFibrosisSuspected,
    isComplicatedIleus,
    urgencyTier,
    urgencyTierLabel,
    surgeryIndicated,
    recommendedProcedure,
    gastrografinProtocolDirectives,
    cysticFibrosisDirectives,
    recommendations,
    alerts,
  };
}
