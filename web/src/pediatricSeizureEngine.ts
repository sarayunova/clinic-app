/**
 * Pediatric Status Epilepticus Resuscitation & Refractory Seizure Engine
 * References:
 * - American Epilepsy Society (AES) Guideline: Treatment of Status Epilepticus in Children and Adults
 * - Pediatric Advanced Life Support (PALS) Resuscitation Guidelines
 * - Established Status Epilepticus Treatment Trial (ESETT) Dosing Standards
 */

export type BroselowZone = 'grey' | 'pink' | 'red' | 'purple' | 'yellow' | 'white' | 'blue' | 'orange' | 'green' | 'not_applicable';

export interface PediatricSeizureParams {
  weightKg: number;
  ageMonths: number;
  seizureDurationMinutes: number;
  bloodGlucoseMgDl?: number;
  ivIoAccessEstablished: boolean;
  benzodiazepineDosesGiven: number; // 0, 1, or 2
  secondLineAsmGiven?: boolean;
}

export interface DrugDoseRecommendation {
  drugName: string;
  category: 'hypoglycemia' | 'first_line_bzd' | 'second_line_asm' | 'refractory_infusion';
  route: string;
  standardDosePerKg: string;
  calculatedDoseMgOrMl: string;
  maxDose: string;
  adminInstructions: string;
  warnings?: string;
}

export interface SeizureAlgorithmPhaseResult {
  phase: 'phase_1_stabilization_0_5m' | 'phase_2_first_line_bzd_5_20m' | 'phase_3_second_line_asm_20_40m' | 'phase_4_refractory_rsi_picu_gt_40m';
  phaseName: string;
  timeWindow: string;
  priorityActions: string[];
  medicationOptions: DrugDoseRecommendation[];
  glucoseEmergency: boolean;
  d10wBolusMl?: number;
  broselowZone: BroselowZone;
  escalationWarning?: string;
}

/**
 * Returns Broselow Color Zone based on child weight
 */
export function getBroselowZone(weightKg: number): BroselowZone {
  if (weightKg < 6) return 'grey';
  if (weightKg < 8) return 'pink';
  if (weightKg < 10) return 'red';
  if (weightKg < 12) return 'purple';
  if (weightKg < 15) return 'yellow';
  if (weightKg < 19) return 'white';
  if (weightKg < 23) return 'blue';
  if (weightKg < 30) return 'orange';
  if (weightKg <= 36) return 'green';
  return 'not_applicable';
}

/**
 * Evaluates current Status Epilepticus algorithm phase and calculates emergency drug dosages
 */
export function evaluatePediatricSeizureProtocol(params: PediatricSeizureParams): SeizureAlgorithmPhaseResult {
  const { weightKg, seizureDurationMinutes, bloodGlucoseMgDl, ivIoAccessEstablished, benzodiazepineDosesGiven, secondLineAsmGiven } = params;
  const broselowZone = getBroselowZone(weightKg);
  const medications: DrugDoseRecommendation[] = [];

  // 1. Hypoglycemia check: D10W bolus 2 mL/kg (0.2 g/kg) if blood glucose < 60 mg/dL
  let glucoseEmergency = false;
  let d10wBolusMl: number | undefined;

  if (bloodGlucoseMgDl !== undefined && bloodGlucoseMgDl < 60) {
    glucoseEmergency = true;
    d10wBolusMl = Math.round(weightKg * 2 * 10) / 10;
    medications.push({
      drugName: '10% Dextrose (D10W)',
      category: 'hypoglycemia',
      route: 'IV / IO bolus',
      standardDosePerKg: '2 mL/kg (0.2 g/kg)',
      calculatedDoseMgOrMl: `${d10wBolusMl} mL`,
      maxDose: '50 mL single bolus',
      adminInstructions: 'Administer slow IV/IO push immediately. Recheck blood glucose in 10-15 minutes.',
      warnings: 'CRITICAL: Severe hypoglycemia can provoke refractory convulsions and permanent neurological injury.'
    });
  }

  // Determine Algorithm Phase
  let phase: 'phase_1_stabilization_0_5m' | 'phase_2_first_line_bzd_5_20m' | 'phase_3_second_line_asm_20_40m' | 'phase_4_refractory_rsi_picu_gt_40m';
  let phaseName = '';
  let timeWindow = '';
  const priorityActions: string[] = [];
  let escalationWarning: string | undefined;

  if (seizureDurationMinutes < 5) {
    phase = 'phase_1_stabilization_0_5m';
    phaseName = 'Phase 1: Stabilization & Airway Management';
    timeWindow = '0 - 5 minutes';
    priorityActions.push('Assess Airway, Breathing, and Circulation (ABCs); maintain lateral decubitus position.');
    priorityActions.push('Administer high-flow 100% oxygen via non-rebreather mask; suction secretions gently.');
    priorityActions.push('Check bedside blood glucose immediately.');
    priorityActions.push('Obtain IV or IO access if readily available (do not delay first-line treatment if difficult).');
    priorityActions.push('Prepare first-line benzodiazepine dose.');
  } else if (seizureDurationMinutes < 20 && benzodiazepineDosesGiven < 2) {
    phase = 'phase_2_first_line_bzd_5_20m';
    phaseName = 'Phase 2: First-line Benzodiazepine Therapy';
    timeWindow = '5 - 20 minutes';
    priorityActions.push(`Administer initial or second benzodiazepine dose (${benzodiazepineDosesGiven}/2 given).`);
    priorityActions.push('Monitor SpO2, heart rate, and respiratory drive closely.');
    priorityActions.push('If seizure continues 5 minutes after first dose, administer ONE repeat dose.');
    priorityActions.push('Alert PICU and prepare second-line Antiseizure Medications (ASM).');
  } else if (seizureDurationMinutes < 40 && !secondLineAsmGiven) {
    phase = 'phase_3_second_line_asm_20_40m';
    phaseName = 'Phase 3: Second-line Antiseizure Medications (ASM)';
    timeWindow = '20 - 40 minutes';
    priorityActions.push('Seizure duration > 20 minutes: Established Status Epilepticus (ESETT protocol).');
    priorityActions.push('Initiate rapid infusion of chosen second-line ASM (Levetiracetam, Fosphenytoin, or Valproate).');
    priorityActions.push('Prepare pediatric endotracheal intubation equipment and RSI drugs.');
    priorityActions.push('Notify PICU team for immediate bedside arrival.');
    escalationWarning = 'Seizure lasting > 20 minutes carries increased risk of neuronal excitotoxicity and pharmacoresistance.';
  } else {
    phase = 'phase_4_refractory_rsi_picu_gt_40m';
    phaseName = 'Phase 4: Refractory Status Epilepticus (RSE)';
    timeWindow = '> 40 minutes';
    priorityActions.push('URGENT: Refractory Status Epilepticus. Patient requires emergency Rapid Sequence Intubation.');
    priorityActions.push('Transfer immediately to Pediatric Intensive Care Unit (PICU).');
    priorityActions.push('Commence continuous IV anesthetic infusion (Midazolam, Propofol, or Ketamine).');
    priorityActions.push('Initiate continuous electroencephalography (cEEG) to titrate to electrographic burst suppression.');
    escalationWarning = 'CRITICAL CODE SEIZURE: Refractory status epilepticus requires general anesthesia and invasive mechanical ventilation.';
  }

  // Calculate First-line Benzodiazepine Dosing
  const midazolamInDose = Math.min(10, Math.round(weightKg * 0.2 * 10) / 10);
  const midazolamInVolume = Math.round((midazolamInDose / 5) * 10) / 10; // 5 mg/mL intranasal / buccal
  const lorazepamIvDose = Math.min(4, Math.round(weightKg * 0.1 * 10) / 10);
  const diazepamIvDose = Math.min(10, Math.round(weightKg * 0.2 * 10) / 10);
  const diazepamPrDose = Math.min(20, Math.round(weightKg * 0.3 * 10) / 10);

  if (phase === 'phase_1_stabilization_0_5m' || phase === 'phase_2_first_line_bzd_5_20m') {
    if (!ivIoAccessEstablished) {
      medications.push({
        drugName: 'Midazolam (Intranasal / Buccal) - PREFERRED Non-IV',
        category: 'first_line_bzd',
        route: 'Intranasal (IN) using mucosal atomizer (MAD) or Buccal',
        standardDosePerKg: '0.2 mg/kg',
        calculatedDoseMgOrMl: `${midazolamInDose} mg (${midazolamInVolume} mL of 5 mg/mL solution)`,
        maxDose: '10 mg single dose',
        adminInstructions: 'Administer half dose in each nostril with MAD device, or into buccal pouch. Rapid absorption within 2-3 minutes.',
        warnings: 'Maximum 2 doses total across all benzodiazepines. Watch for airway compromise.'
      });
      medications.push({
        drugName: 'Diazepam (Rectal Gel)',
        category: 'first_line_bzd',
        route: 'Rectal (PR)',
        standardDosePerKg: '0.2 - 0.5 mg/kg',
        calculatedDoseMgOrMl: `${diazepamPrDose} mg`,
        maxDose: '20 mg single dose',
        adminInstructions: 'Lubricate applicator and deliver into rectum. Hold buttocks together for 3 seconds.'
      });
    } else {
      medications.push({
        drugName: 'Lorazepam IV (Ativan®) - PREFERRED IV',
        category: 'first_line_bzd',
        route: 'Intravenous (IV) / Intraosseous (IO)',
        standardDosePerKg: '0.1 mg/kg',
        calculatedDoseMgOrMl: `${lorazepamIvDose} mg`,
        maxDose: '4 mg single dose',
        adminInstructions: 'Slow IV push over 1 to 2 minutes. Onset within 2-5 minutes; sustained anticonvulsant effect.'
      });
      medications.push({
        drugName: 'Midazolam IV',
        category: 'first_line_bzd',
        route: 'Intravenous (IV) / Intraosseous (IO)',
        standardDosePerKg: '0.15 - 0.2 mg/kg',
        calculatedDoseMgOrMl: `${midazolamInDose} mg`,
        maxDose: '10 mg single dose',
        adminInstructions: 'Slow IV push over 2 minutes.'
      });
      medications.push({
        drugName: 'Diazepam IV',
        category: 'first_line_bzd',
        route: 'Intravenous (IV) / Intraosseous (IO)',
        standardDosePerKg: '0.2 mg/kg',
        calculatedDoseMgOrMl: `${diazepamIvDose} mg`,
        maxDose: '10 mg single dose',
        adminInstructions: 'Slow IV push over 2 minutes. High risk of seizure recurrence within 20 mins due to rapid redistribution.'
      });
    }
  }

  // Calculate Second-line ASM Dosing (ESETT trial dosing)
  const levetiracetamDose = Math.min(4500, Math.round(weightKg * 60));
  const fosphenytoinDose = Math.min(1500, Math.round(weightKg * 20));
  const valproateDose = Math.min(3000, Math.round(weightKg * 40));

  if (phase === 'phase_2_first_line_bzd_5_20m' || phase === 'phase_3_second_line_asm_20_40m' || phase === 'phase_4_refractory_rsi_picu_gt_40m') {
    medications.push({
      drugName: 'Levetiracetam IV (Keppra®) - First-Choice ASM',
      category: 'second_line_asm',
      route: 'IV / IO infusion',
      standardDosePerKg: '60 mg/kg',
      calculatedDoseMgOrMl: `${levetiracetamDose} mg`,
      maxDose: '4,500 mg',
      adminInstructions: 'Dilute in Normal Saline and infuse over 10 to 15 minutes. High efficacy with no respiratory or cardiac depression.',
      warnings: 'Safest hemodynamic profile among second-line agents.'
    });
    medications.push({
      drugName: 'Fosphenytoin IV (Cerebyx®)',
      category: 'second_line_asm',
      route: 'IV / IO infusion',
      standardDosePerKg: '20 mg PE/kg (Phenytoin Equivalents)',
      calculatedDoseMgOrMl: `${fosphenytoinDose} mg PE`,
      maxDose: '1,500 mg PE',
      adminInstructions: 'Infuse at maximum rate of 150 mg PE/minute. Requires continuous ECG and blood pressure monitoring.',
      warnings: 'Risk of hypotension, AV heart block, and cardiac arrhythmias.'
    });
    medications.push({
      drugName: 'Sodium Valproate IV',
      category: 'second_line_asm',
      route: 'IV / IO infusion',
      standardDosePerKg: '40 mg/kg',
      calculatedDoseMgOrMl: `${valproateDose} mg`,
      maxDose: '3,000 mg',
      adminInstructions: 'Infuse over 10 minutes.',
      warnings: 'CONTRAINDICATED if suspected mitochondrial disease (POLG mutations), severe hepatic dysfunction, or urea cycle disorder.'
    });
  }

  // Calculate Refractory Phase continuous infusion guidance
  if (phase === 'phase_4_refractory_rsi_picu_gt_40m') {
    const midazLoadDose = Math.round(weightKg * 0.2 * 10) / 10;
    const midazInfusionMin = Math.round(weightKg * 0.1 * 10) / 10;
    const midazInfusionMax = Math.round(weightKg * 2.0 * 10) / 10;

    medications.push({
      drugName: 'Midazolam Continuous Infusion (PICU Sedation)',
      category: 'refractory_infusion',
      route: 'Continuous IV Infusion',
      standardDosePerKg: 'Loading 0.2 mg/kg, then 0.1 - 2.0 mg/kg/hr',
      calculatedDoseMgOrMl: `Load: ${midazLoadDose} mg | Infuse: ${midazInfusionMin} - ${midazInfusionMax} mg/hr`,
      maxDose: '2.0 mg/kg/hr',
      adminInstructions: 'Titrate infusion every 15-30 minutes against continuous EEG until burst suppression is attained.',
      warnings: 'Mandatory mechanical ventilation. Anticipate hypotension; prepare vasopressors (norepinephrine/epinephrine).'
    });
  }

  return {
    phase,
    phaseName,
    timeWindow,
    priorityActions,
    medicationOptions: medications,
    glucoseEmergency,
    d10wBolusMl,
    broselowZone,
    escalationWarning
  };
}
