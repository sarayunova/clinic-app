/**
 * Pediatric Status Epilepticus Resuscitation & Refractory Seizure Engine
 * Stepwise Evidence-Based Protocol: Rapid Benzodiazepine -> Non-Sedating Second-Line AED -> Anesthetic Infusion Titration
 *
 * Guidelines & References:
 * - American Epilepsy Society (AES 2016) Convulsive Status Epilepticus Protocol
 * - PALS 2025 Pediatric Advanced Life Support Status Epilepticus Algorithm
 * - Established Status Epilepticus Treatment Trial (ESETT, NEJM 2019)
 * - Neurocritical Care Society Guidelines for Status Epilepticus Management
 */

export interface SeizureMedicationDosing {
  agentName: string;
  doseMg: number;
  route: string;
  infusionInstructions: string;
  safetyCautions: string[];
}

export interface StatusEpilepticusEvalInput {
  ageMonths: number;
  weightKg: number;
  minutesFromOnset: number;
  etiology?: string;
  seizureSemiology?: string;
  phase1BenzoGiven?: boolean;
  phase1DosesCount?: number;
  phase2Given?: boolean;
  seizureOngoing: boolean;
}

export type StatusPhase = 'phase_1_emergent_benzo' | 'phase_2_urgent_control' | 'phase_3_refractory_infusion' | 'seizure_abated_stabilization';

export interface StatusEpilepticusEvalResult {
  currentPhase: StatusPhase;
  phaseDescription: string;
  urgencyLevel: 'critical_emergency' | 'high_priority' | 'post_ictal_surveillance';
  recommendedPhase1Benzo: SeizureMedicationDosing;
  recommendedPhase2Agents: SeizureMedicationDosing[];
  recommendedPhase3Infusions: SeizureMedicationDosing[];
  airwayActionPlan: string;
  clinicalChecklist: string[];
}

/**
 * Calculates weight-based Phase 1 Emergent Benzodiazepine dose (AES 2016 / PALS 2025)
 */
export function calculatePhase1Benzo(weightKg: number, preferredRoute: 'buccal_in' | 'iv' | 'rectal' = 'iv'): SeizureMedicationDosing {
  if (preferredRoute === 'buccal_in') {
    // Intranasal / Buccal Midazolam: 0.2 mg/kg (max 10 mg)
    const dose = Math.min(10.0, Math.round(weightKg * 0.2 * 10) / 10);
    return {
      agentName: 'Midazolam (Intranasal or Buccal)',
      doseMg: dose,
      route: 'Intranasal (IN) using mucosal atomizer (MAD) or Buccal',
      infusionInstructions: `Administer ${dose} mg stat (divide equally between both nares if intranasal). May repeat ONCE after 5-10 minutes if seizure persists.`,
      safetyCautions: ['Monitor respiratory rate and SpO2; have suction and bag-valve-mask ready.', 'Do not give > 2 total benzodiazepine doses.'],
    };
  } else if (preferredRoute === 'rectal') {
    // Rectal Diazepam: 0.2 - 0.5 mg/kg (max 20 mg)
    const dose = Math.min(20.0, Math.round(weightKg * 0.3 * 10) / 10);
    return {
      agentName: 'Diazepam (Rectal Gel)',
      doseMg: dose,
      route: 'Rectal',
      infusionInstructions: `Administer ${dose} mg rectally via applicator. Hold buttocks together for 3 seconds.`,
      safetyCautions: ['Variable bioavailability compared to IV or IN midazolam.', 'Watch for delayed respiratory depression.'],
    };
  } else {
    // IV Lorazepam: 0.1 mg/kg (max 4 mg)
    const dose = Math.min(4.0, Math.round(weightKg * 0.1 * 10) / 10);
    return {
      agentName: 'Lorazepam IV (Preferred first-line IV)',
      doseMg: dose,
      route: 'Slow IV bolus over 2 minutes',
      infusionInstructions: `Administer ${dose} mg slow IV push over 2 minutes. May repeat ONCE after 5-10 minutes if convulsion continues.`,
      safetyCautions: ['Prepare second-line agent immediately if no response within 5 minutes of second dose.', 'Maximum 2 doses total.'],
    };
  }
}

/**
 * Calculates weight-based Phase 2 Urgent Control Non-Sedating Second-Line AEDs (ESETT 2019 / AES)
 */
export function calculatePhase2Agents(weightKg: number): SeizureMedicationDosing[] {
  // 1. Levetiracetam: 60 mg/kg (max 4500 mg)
  const levetiracetamDose = Math.min(4500, Math.round(weightKg * 60));

  // 2. Fosphenytoin: 20 mg PE/kg (max 1500 mg PE)
  const fosphenytoinDose = Math.min(1500, Math.round(weightKg * 20));

  // 3. Valproate Sodium: 40 mg/kg (max 3000 mg)
  const valproateDose = Math.min(3000, Math.round(weightKg * 40));

  return [
    {
      agentName: 'Levetiracetam (Keppra) IV',
      doseMg: levetiracetamDose,
      route: 'IV Infusion over 10 minutes',
      infusionInstructions: `Dilute ${levetiracetamDose} mg in 50-100 mL Normal Saline or D5W. Infuse over 10 minutes (approx. 5 mL/min). ESETT trial demonstrated equal efficacy with lowest cardiovascular toxicity.`,
      safetyCautions: ['Minimal hemodynamic impact; does not cause hypotension or cardiac arrhythmias.'],
    },
    {
      agentName: 'Fosphenytoin IV (Cerebyx)',
      doseMg: fosphenytoinDose,
      route: 'IV Infusion at <= 150 mg PE/min',
      infusionInstructions: `Administer ${fosphenytoinDose} mg PE diluted in Normal Saline. Infuse with continuous ECG and blood pressure monitoring.`,
      safetyCautions: ['Cardiac toxicity warning: Monitor for QTc prolongation, AV block, and severe hypotension.', 'Slow or stop infusion if hypotension occurs.'],
    },
    {
      agentName: 'Valproate Sodium IV (Depacon)',
      doseMg: valproateDose,
      route: 'IV Infusion over 10 minutes',
      infusionInstructions: `Dilute ${valproateDose} mg in 50 mL Normal Saline or D5W. Infuse over 10 minutes.`,
      safetyCautions: [
        'CONTRAINDICATION: Do NOT use in children < 2 years with suspected inborn error of metabolism, mitochondrial disease (POLG mutations), or acute hepatic dysfunction.',
        'Risk of fatal hyperammonemic encephalopathy and acute liver failure.',
      ],
    },
  ];
}

/**
 * Calculates weight-based Phase 3 Refractory Status Anesthetic Infusions
 */
export function calculatePhase3Infusions(weightKg: number): SeizureMedicationDosing[] {
  // Midazolam Infusion: 0.2 mg/kg loading, 0.05 - 2.0 mg/kg/hr (1 - 33 mcg/kg/min)
  const midazolamLoad = Math.min(15, Math.round(weightKg * 0.2 * 10) / 10);
  const midazolamInitRate = Math.round(weightKg * 0.1 * 10) / 10; // 0.1 mg/kg/hr starting rate

  // Ketamine Infusion: 1-2 mg/kg loading, 0.5 - 5 mg/kg/hr
  const ketamineLoad = Math.min(100, Math.round(weightKg * 1.5 * 10) / 10);
  const ketamineInitRate = Math.round(weightKg * 1.0 * 10) / 10; // 1 mg/kg/hr

  // Propofol Infusion (use with caution in pediatrics, < 48h): 1-2 mg/kg loading
  const propofolLoad = Math.min(150, Math.round(weightKg * 1.5 * 10) / 10);

  return [
    {
      agentName: 'Midazolam Continuous Infusion (First-line refractory infusion)',
      doseMg: midazolamLoad,
      route: 'Continuous IV Infusion via dedicated central/peripheral line',
      infusionInstructions: `Administer IV loading bolus ${midazolamLoad} mg over 2 minutes, then start continuous infusion at ${midazolamInitRate} mg/hr (titrate upward by 0.1 mg/kg/hr every 15 minutes to electrographic burst suppression).`,
      safetyCautions: ['Endotracheal intubation and mechanical ventilation mandatory.', 'Watch for hypotension; have Norepinephrine/Epinephrine infusion prepared.'],
    },
    {
      agentName: 'Ketamine Infusion (NMDA Receptor Antagonist)',
      doseMg: ketamineLoad,
      route: 'Continuous IV Infusion',
      infusionInstructions: `Administer loading dose ${ketamineLoad} mg IV over 5 minutes, then continuous infusion at ${ketamineInitRate} mg/hr. Effective in prolonged status due to GABA receptor downregulation and NMDA upregulation.`,
      safetyCautions: ['Maintains hemodynamic stability and airway reflexes; excellent second-line refractory agent.'],
    },
    {
      agentName: 'Propofol Infusion (Short-term bridge in PICU only)',
      doseMg: propofolLoad,
      route: 'IV bolus followed by low-dose infusion',
      infusionInstructions: `Loading dose ${propofolLoad} mg IV over 5 minutes, titrate 2-5 mg/kg/hr for <= 24 hours.`,
      safetyCautions: ['BOXED WARNING in pediatrics: Propofol Infusion Syndrome (PRIS) - refractory metabolic acidosis, rhabdomyolysis, hyperkalemia, hepatomegaly, cardiac failure. Avoid infusions > 4-5 mg/kg/hr or > 24 hours.'],
    },
  ];
}

/**
 * Evaluates comprehensive Pediatric Status Epilepticus staging and resuscitation strategy
 */
export function evaluatePediatricStatusEpilepticus(input: StatusEpilepticusEvalInput): StatusEpilepticusEvalResult {
  let phase: StatusPhase = 'phase_1_emergent_benzo';
  let phaseDesc = 'Phase 1: Emergent First-Line Resuscitation (0-10 min) - Immediate Benzodiazepine therapy.';
  let urgency: 'critical_emergency' | 'high_priority' | 'post_ictal_surveillance' = 'critical_emergency';

  if (!input.seizureOngoing) {
    phase = 'seizure_abated_stabilization';
    phaseDesc = 'Seizure Abated: Post-Ictal Stabilization & Neuro-Monitoring.';
    urgency = 'post_ictal_surveillance';
  } else if (input.minutesFromOnset >= 30 || (input.phase2Given && input.seizureOngoing)) {
    phase = 'phase_3_refractory_infusion';
    phaseDesc = 'Phase 3: Refractory Status Epilepticus (RSE) (> 30 min) - Continuous Anesthetic Infusions & cEEG monitoring.';
    urgency = 'critical_emergency';
  } else if (input.minutesFromOnset >= 10 || (input.phase1BenzoGiven && (input.phase1DosesCount ?? 1) >= 2)) {
    phase = 'phase_2_urgent_control';
    phaseDesc = 'Phase 2: Urgent Control Second-Line Therapy (10-30 min) - Non-sedating IV AED infusion.';
    urgency = 'high_priority';
  }

  const benzo = calculatePhase1Benzo(input.weightKg, 'iv');
  const phase2 = calculatePhase2Agents(input.weightKg);
  const phase3 = calculatePhase3Infusions(input.weightKg);

  let airway = 'Airway patent with high-flow oxygen via non-rebreather mask (10-15 L/min). Place in recovery position after seizure cessation.';
  if (phase === 'phase_3_refractory_infusion') {
    airway = 'CRITICAL: Endotracheal intubation and mechanical ventilation required immediately before initiation of Phase 3 continuous anesthetic infusions.';
  } else if (phase === 'phase_2_urgent_control') {
    airway = 'High-flow oxygen. Bag-valve-mask with PEEP valve at bedside. Prepare RSI medications and video laryngoscope if respiratory effort falters.';
  }

  const checklist: string[] = [
    'Check point-of-care capillary blood glucose immediately (treat hypoglycemia with D10W 2-5 mL/kg IV).',
    'Assess Airway, Breathing, Circulation (PALS ABCDE). High-flow 100% FiO2.',
    'Secure 2x large-bore IV access; if IV unattainable within 3-5 minutes, place intraosseous (IO) needle.',
    'Draw STAT labs: Blood gas, electrolytes, ionized calcium, magnesium, liver panel, toxicology screen, and anti-seizure medication levels.',
  ];

  if (phase === 'phase_2_urgent_control' || phase === 'phase_3_refractory_infusion') {
    checklist.push('Activate Pediatric Intensive Care Unit (PICU) transfer / Neuro-Intensive team.');
    checklist.push('Prepare Continuous Video-EEG (cEEG) neuro-monitoring to confirm cessation of electrographic seizures and rule out non-convulsive status epilepticus (NCSE).');
  }

  if (phase === 'phase_3_refractory_infusion') {
    checklist.push('Place arterial line for continuous arterial pressure monitoring during anesthetic titration.');
    checklist.push('Titrate continuous infusion to electrographic burst suppression (target 10-15 seconds interburst interval) for 24-48 hours before gradual weaning.');
  }

  return {
    currentPhase: phase,
    phaseDescription: phaseDesc,
    urgencyLevel: urgency,
    recommendedPhase1Benzo: benzo,
    recommendedPhase2Agents: phase2,
    recommendedPhase3Infusions: phase3,
    airwayActionPlan: airway,
    clinicalChecklist: checklist,
  };
}
