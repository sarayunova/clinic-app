// Pure TypeScript Clinical Calculation Engine: Pediatric Foreign Body Airway Obstruction (FBAO) & Choking Emergency
// References: AAP / AHA PALS Guidelines for Foreign Body Airway Obstruction; ILCOR Pediatric Resuscitation

export type ForeignBodyNature =
  | 'organic_food_nut_seed'
  | 'small_toy_plastic_bead'
  | 'coin_metallic_battery'
  | 'balloon_latex'
  | 'unknown_material';

export type ObstructionSeverity =
  | 'mild_incomplete_effective_cough'
  | 'severe_complete_ineffective_cough'
  | 'unconscious_cardiorespiratory_arrest';

export type FBAOIntervention =
  | 'encouraged_spontaneous_coughing'
  | 'back_blows_and_chest_thrusts_infant'
  | 'subdiaphragmatic_heimlich_child'
  | 'cpr_chest_compressions_ventilations'
  | 'rigid_bronchoscopy_or_surgical_airway';

export type BronchoscopyLocation =
  | 'none'
  | 'trachea_carina'
  | 'right_main_bronchus'
  | 'left_main_bronchus'
  | 'segmental_bronchi';

export interface PediatricForeignBodyInput {
  ageMonths: number;
  weightKg: number;
  witnessedChokingEpisode: boolean;
  suspectedForeignBodyNature: ForeignBodyNature;
  obstructionSeverity: ObstructionSeverity;

  stridorOrAphonia: boolean;
  cyanosisPresent: boolean;
  silentChestNoted: boolean;

  heartRateBpm: number;
  respiratoryRate: number;
  spo2Percent: number;

  interventionApplied: FBAOIntervention;
  blindFingerSweepAvoided: boolean;
  foreignBodyExpelled: boolean;
  spontaneousRespirationRestored: boolean;
  rigidBronchoscopyRequired: boolean;
  bronchoscopyLocation?: BronchoscopyLocation;
}

export interface PediatricForeignBodyEvaluation {
  isInfantUnder1Year: boolean;
  isCompleteObstruction: boolean;
  recommendedResuscitationManeuver: FBAOIntervention;
  maneuverDescription: string;
  blindFingerSweepViolation: boolean;

  airwayCompromiseTier: 'mild_effective_cough' | 'severe_emergency_airway' | 'critical_cardiac_arrest';
  airwayUrgencyLabel: string;
  bronchoscopyUrgency: 'elective_observation' | 'urgent_operating_room' | 'stat_emergency_ent_bronchoscopy';

  clinicalSafetyDirectives: string[];
  summary: string;
  criticalActionPlan: string[];
}

/**
 * Classifies age-appropriate airway clearance maneuvers.
 */
export function classifyAgeAppropriateManeuver(
  ageMonths: number,
  severity: ObstructionSeverity,
): { recommendedManeuver: FBAOIntervention; description: string } {
  if (severity === 'unconscious_cardiorespiratory_arrest') {
    return {
      recommendedManeuver: 'cpr_chest_compressions_ventilations',
      description: 'Patient unresponsive: Call Code Blue / EMS. Immediately begin PALS CPR (30:2 or 15:2). Each time airway is opened, look inside mouth for foreign object; remove ONLY if clearly visualized. NEVER perform blind sweeps.',
    };
  }

  if (severity === 'mild_incomplete_effective_cough') {
    return {
      recommendedManeuver: 'encouraged_spontaneous_coughing',
      description: 'Mild Obstruction (Effective Cough): Child can vocalize and cough forcefully. DO NOT interfere with spontaneous efforts. Do NOT slap back or perform Heimlich thrusts. Position upright, reassure, and monitor.',
    };
  }

  // Severe obstruction in conscious child
  if (ageMonths < 12) {
    return {
      recommendedManeuver: 'back_blows_and_chest_thrusts_infant',
      description: 'Severe Infant Obstruction (< 1 year): Alternate 5 Back Slaps (prone along forearm, head down, heel of hand between scapulae) and 5 Chest Thrusts (supine, 2 fingers on lower sternum). Repeat cycle until object expelled or infant becomes unresponsive.',
    };
  }

  return {
    recommendedManeuver: 'subdiaphragmatic_heimlich_child',
    description: 'Severe Child Obstruction (≥ 1 year): Stand/kneel behind child. Make a fist just above navel and below xiphoid. Perform inward and upward subdiaphragmatic abdominal thrusts (Heimlich Maneuver) in rapid succession until dislodged.',
  };
}

/**
 * Evaluates pediatric foreign body airway obstruction protocol compliance and clinical directives.
 */
export function evaluatePediatricForeignBody(
  input: PediatricForeignBodyInput,
): PediatricForeignBodyEvaluation {
  const isInfantUnder1Year = input.ageMonths < 12;
  const isCompleteObstruction = input.obstructionSeverity !== 'mild_incomplete_effective_cough';
  const blindFingerSweepViolation = !input.blindFingerSweepAvoided;

  const { recommendedManeuver, description } = classifyAgeAppropriateManeuver(
    input.ageMonths,
    input.obstructionSeverity,
  );

  let airwayCompromiseTier: 'mild_effective_cough' | 'severe_emergency_airway' | 'critical_cardiac_arrest' = 'mild_effective_cough';
  let airwayUrgencyLabel = 'Mild / Partial Airway Obstruction';
  if (input.obstructionSeverity === 'unconscious_cardiorespiratory_arrest') {
    airwayCompromiseTier = 'critical_cardiac_arrest';
    airwayUrgencyLabel = 'CRITICAL: Unresponsive / Cardiac Arrest';
  } else if (input.obstructionSeverity === 'severe_complete_ineffective_cough') {
    airwayCompromiseTier = 'severe_emergency_airway';
    airwayUrgencyLabel = 'EMERGENCY: Complete Ineffective Airway Obstruction';
  }

  let bronchoscopyUrgency: 'elective_observation' | 'urgent_operating_room' | 'stat_emergency_ent_bronchoscopy' = 'elective_observation';
  if (input.rigidBronchoscopyRequired || input.silentChestNoted || (!input.foreignBodyExpelled && input.obstructionSeverity !== 'mild_incomplete_effective_cough')) {
    bronchoscopyUrgency = 'stat_emergency_ent_bronchoscopy';
  } else if (!input.foreignBodyExpelled) {
    bronchoscopyUrgency = 'urgent_operating_room';
  }

  const clinicalSafetyDirectives: string[] = [
    'BLIND FINGER SWEEPS ARE STRICTLY PROHIBITED: Blind sweeps risk pushing an supraglottic or laryngeal object into the subglottis or carina, or causing pharyngeal perforation.',
    'For infants < 1 year: Abdominal thrusts (Heimlich) are strictly contraindicated due to risk of liver or splenic rupture; use back blows and chest thrusts only.',
    'For conscious choking with effective cough: Do NOT deliver back blows or thrusts, as external force can convert a partial obstruction into a fatal complete impaction.',
    'If patient loses consciousness: Ease to the floor, activate emergency code, begin CPR starting with compressions. Look in oropharynx before breaths; remove object ONLY if directly visualized with McGill forceps or gentle suction.',
  ];

  const criticalActionPlan: string[] = [];
  criticalActionPlan.push(`Patient: ${input.ageMonths}m (${isInfantUnder1Year ? 'Infant <1y' : 'Child ≥1y'}) - Severity: ${airwayUrgencyLabel}`);
  criticalActionPlan.push(`Protocol Maneuver: ${description}`);

  if (blindFingerSweepViolation) {
    criticalActionPlan.push('CRITICAL SAFETY AUDIT ERROR: Blind finger sweep was attempted. Must be eliminated from practice per AAP/PALS standards.');
  }

  if (input.foreignBodyExpelled) {
    criticalActionPlan.push('Foreign body successfully expelled. Monitor post-choking airway for 2-4 hours to rule out mucosal edema, secondary bronchospasm, or fragmentation.');
  } else if (bronchoscopyUrgency === 'stat_emergency_ent_bronchoscopy') {
    criticalActionPlan.push('EMERGENCY: Mobilize Pediatric ENT and Anesthesia for immediate Rigid Bronchoscopy under general anesthesia in the operating room.');
  }

  const summary = `Pediatric FBAO (${airwayUrgencyLabel}): ${isInfantUnder1Year ? 'Infant' : 'Child'} presenting with ${input.suspectedForeignBodyNature.replace(/_/g, ' ')}. ${input.foreignBodyExpelled ? 'FOREIGN BODY EXPELLED - Respiration Restored.' : `ONGOING OBSTRUCTION: ${recommendedManeuver.replace(/_/g, ' ').toUpperCase()} INDICATED.`}`;

  return {
    isInfantUnder1Year,
    isCompleteObstruction,
    recommendedResuscitationManeuver: recommendedManeuver,
    maneuverDescription: description,
    blindFingerSweepViolation,
    airwayCompromiseTier,
    airwayUrgencyLabel,
    bronchoscopyUrgency,
    clinicalSafetyDirectives,
    summary,
    criticalActionPlan,
  };
}
