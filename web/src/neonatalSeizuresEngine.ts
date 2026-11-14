/**
 * Pure Mathematical and Clinical Evaluation Engine for Neonatal Seizures & Status Epilepticus Pathway
 * References:
 * - WHO Guidelines for the Management of Neonatal Seizures (2023)
 * - ILAE Task Force on Neonatal Seizures Classification
 * - Volpe's Neurology of the Newborn (7th Ed.)
 */

export type NeonatalSeizureSemiology =
  | 'clonic'
  | 'tonic'
  | 'myoclonic'
  | 'autonomic'
  | 'subtle'
  | 'electrographic_only';

export type NeonatalSeizureDuration =
  | 'isolated_brief'
  | 'recurrent_cluster'
  | 'status_epilepticus';

export type NeonatalSeizureEtiology =
  | 'hie'
  | 'cns_infection'
  | 'stroke_thrombosis'
  | 'ich'
  | 'inborn_metabolism'
  | 'hypoglycemia'
  | 'hypocalcemia'
  | 'benign_familial'
  | 'unknown';

export interface NeonatalSeizuresEvaluationParams {
  gestationalAgeWeeks: number;
  postnatalAgeDays: number;
  currentWeightKg: number;
  seizureSemiology: NeonatalSeizureSemiology;
  seizureDurationCategory: NeonatalSeizureDuration;
  suspectedEtiology: NeonatalSeizureEtiology;
  bloodGlucoseMgDl?: number | null;
  ionizedCalciumMmolL?: number | null;
  serumMagnesiumMgDl?: number | null;
  sodiumMeqL?: number | null;
  cumulativePhenobarbitalMgKg?: number;
  secondLineGiven?: boolean;
  pyridoxineTrialDone?: boolean;
}

export interface AnticonvulsantDosingRecommendation {
  drug: string;
  indication: string;
  bolusDoseMg: number;
  bolusVolumeMl?: number;
  administrationRate: string;
  maintenanceDailyMg?: number;
  maintenanceSchedule?: string;
  cautions: string[];
}

export interface EmergencyMetabolicDirective {
  condition: string;
  isTriggered: boolean;
  currentValue?: number | null;
  threshold: string;
  intervention: string;
  volumeMl: number;
  route: string;
}

export interface NeonatalSeizuresEvaluationResult {
  urgencyCategory: 'emergency_resuscitation' | 'high_priority_active' | 'stabilized_surveillance';
  urgencyLabel: string;
  isStatusEpilepticus: boolean;
  isRefractorySeizures: boolean;
  phenobarbitalLoading: AnticonvulsantDosingRecommendation;
  phenobarbitalAdditional?: AnticonvulsantDosingRecommendation;
  secondLineRecommendation?: AnticonvulsantDosingRecommendation;
  metabolicDirectives: EmergencyMetabolicDirective[];
  pyridoxineTrialIndicated: boolean;
  clinicalAlerts: string[];
  managementDirectives: string[];
}

export function evaluateNeonatalSeizures(
  params: NeonatalSeizuresEvaluationParams
): NeonatalSeizuresEvaluationResult {
  const alerts: string[] = [];
  const directives: string[] = [];
  const weight = Math.max(0.5, params.currentWeightKg || 3.0);
  const cumulativePb = params.cumulativePhenobarbitalMgKg ?? 0;

  const isStatus = params.seizureDurationCategory === 'status_epilepticus';
  const isRefractory = cumulativePb >= 20 && params.seizureDurationCategory !== 'isolated_brief';

  let urgencyCategory: 'emergency_resuscitation' | 'high_priority_active' | 'stabilized_surveillance' =
    'high_priority_active';
  let urgencyLabel = 'Active Neonatal Seizures - Priority Protocol';

  if (isStatus || isRefractory) {
    urgencyCategory = 'emergency_resuscitation';
    urgencyLabel = isStatus
      ? 'EMERGENCY: Neonatal Status Epilepticus (Immediate Intervention Mandated)'
      : 'EMERGENCY: Refractory Neonatal Seizures (Second-Line Escalation Required)';
  } else if (params.seizureDurationCategory === 'isolated_brief' && cumulativePb > 0) {
    urgencyCategory = 'stabilized_surveillance';
    urgencyLabel = 'Neonatal Seizures Controlled - Ongoing Neuroprotection Surveillance';
  }

  // First-line Phenobarbital loading: 20 mg/kg IV over 20 min
  const pbLoadMg = Math.round(weight * 20 * 10) / 10;
  const phenobarbitalLoading: AnticonvulsantDosingRecommendation = {
    drug: 'Phenobarbital',
    indication: 'First-line anticonvulsant for neonatal seizures (WHO/ILAE 2023)',
    bolusDoseMg: pbLoadMg,
    bolusVolumeMl: Math.round((pbLoadMg / 200) * 100) / 100,
    administrationRate: 'Slow IV infusion over 20 minutes (rate ≤ 1 mg/kg/min)',
    maintenanceDailyMg: Math.round(weight * 4 * 10) / 10,
    maintenanceSchedule: '3 - 5 mg/kg/day divided q12h IV/oral, start 12-24h after load',
    cautions: [
      'Monitor respiratory effort and BP continuous pulse oximetry during infusion.',
      'Have bag-mask ventilation and suction immediately available at radiant warmer / incubator.',
    ],
  };

  let phenobarbitalAdditional: AnticonvulsantDosingRecommendation | undefined;
  if (cumulativePb >= 20 && cumulativePb < 40) {
    const additionalMg = Math.round(weight * 10 * 10) / 10;
    phenobarbitalAdditional = {
      drug: 'Phenobarbital (Additional Dose)',
      indication: `Persistent seizures after initial 20 mg/kg load (cumulative so far: ${cumulativePb} mg/kg; max safe total: 40 mg/kg)`,
      bolusDoseMg: additionalMg,
      bolusVolumeMl: Math.round((additionalMg / 200) * 100) / 100,
      administrationRate: 'Slow IV infusion over 15-20 minutes',
      cautions: [
        `Do not exceed cumulative 40 mg/kg total loading dose (${Math.round(weight * 40)} mg).`,
        'Higher cumulative doses significantly increase sedation and risk of neonatal apnea.',
      ],
    };
  }

  // Second-line recommendation: Levetiracetam vs Midazolam
  let secondLineRecommendation: AnticonvulsantDosingRecommendation | undefined;
  if (isRefractory || cumulativePb >= 30) {
    const levetiracetamMg = Math.round(weight * 50 * 10) / 10;
    secondLineRecommendation = {
      drug: 'Levetiracetam (Keppra)',
      indication: 'Second-line anticonvulsant for phenobarbital-refractory neonatal seizures',
      bolusDoseMg: levetiracetamMg,
      bolusVolumeMl: Math.round((levetiracetamMg / 100) * 100) / 100,
      administrationRate: 'IV infusion over 15 minutes (50 mg/kg loading dose)',
      maintenanceDailyMg: Math.round(weight * 40 * 10) / 10,
      maintenanceSchedule: '30 - 60 mg/kg/day divided q12h IV',
      cautions: [
        'Preferred second-line agent due to minimal cardiorespiratory depressant effects compared to phenytoin/benzodiazepines.',
      ],
    };
  }

  // Metabolic Directives
  const metabolicDirectives: EmergencyMetabolicDirective[] = [];

  // Hypoglycemia check: < 45 mg/dL (2.5 mmol/L)
  const isHypoglycemic = params.bloodGlucoseMgDl != null && params.bloodGlucoseMgDl < 45;
  metabolicDirectives.push({
    condition: 'Acute Hypoglycemia',
    isTriggered: isHypoglycemic,
    currentValue: params.bloodGlucoseMgDl,
    threshold: '< 45 mg/dL (< 2.5 mmol/L)',
    intervention: '10% Dextrose mini-bolus (2 mL/kg) IV slow, followed by increased GIR (6-8 mg/kg/min)',
    volumeMl: Math.round(weight * 2 * 10) / 10,
    route: 'IV bolus over 5-10 min',
  });

  // Hypocalcemia check: Ionized Ca < 1.0 mmol/L or total < 7.5 mg/dL
  const isHypocalcemic = params.ionizedCalciumMmolL != null && params.ionizedCalciumMmolL < 1.0;
  metabolicDirectives.push({
    condition: 'Symptomatic Hypocalcemia',
    isTriggered: isHypocalcemic,
    currentValue: params.ionizedCalciumMmolL,
    threshold: 'Ionized Calcium < 1.0 mmol/L',
    intervention: '10% Calcium Gluconate (1 - 2 mL/kg = 100-200 mg/kg) diluted 1:1 with D5W under cardiac monitoring',
    volumeMl: Math.round(weight * 1.5 * 10) / 10,
    route: 'Slow IV over 15-30 min with continuous ECG (stop if bradycardia occurs)',
  });

  // Hypomagnesemia check: < 1.5 mg/dL
  const isHypomagnesemic = params.serumMagnesiumMgDl != null && params.serumMagnesiumMgDl < 1.5;
  metabolicDirectives.push({
    condition: 'Hypomagnesemia',
    isTriggered: isHypomagnesemic,
    currentValue: params.serumMagnesiumMgDl,
    threshold: 'Serum Magnesium < 1.5 mg/dL',
    intervention: '50% Magnesium Sulfate (0.2 mL/kg = 100 mg/kg) diluted in D5W or sterile water',
    volumeMl: Math.round(weight * 0.2 * 10) / 10,
    route: 'Slow IV infusion over 30 min or deep IM',
  });

  // Pyridoxine trial indication: refractory seizures without clear HIE or structural cause, or onset day 0-3
  const pyridoxineTrialIndicated =
    (isRefractory || params.suspectedEtiology === 'inborn_metabolism' || params.suspectedEtiology === 'unknown') &&
    !params.pyridoxineTrialDone;

  // Alerts
  if (isStatus) {
    alerts.push('STATUS EPILEPTICUS: Continuous or unremitting seizures > 30 minutes cause severe neuronal metabolic crisis. Prepare second-line infusions and secure airway.');
  }
  if (cumulativePb >= 40) {
    alerts.push('MAXIMUM PHENOBARBITAL LIMIT REACHED (40 mg/kg): Do NOT administer further phenobarbital. Advance to second-line Levetiracetam or Midazolam.');
  }
  if (isHypoglycemic) {
    alerts.push(`CRITICAL HYPOGLYCEMIA DETECTED (${params.bloodGlucoseMgDl} mg/dL): Seizure may be metabolically induced. Administer 10% Dextrose immediately.`);
  }
  if (isHypocalcemic) {
    alerts.push(`CRITICAL HYPOCALCEMIA DETECTED (iCa ${params.ionizedCalciumMmolL} mmol/L): Administer 10% Calcium Gluconate under strict cardiac auscultation / ECG.`);
  }
  if (pyridoxineTrialIndicated) {
    alerts.push('PYRIDOXINE-DEPENDENT EPILEPSY TRIAL MANDATED: Neonate refractory to standard antiepileptics. Administer IV Pyridoxine (Vitamin B6 100 mg) under EEG / continuous monitoring.');
  }

  // Directives
  directives.push('Confirm airway patency, provide warmed humidified oxygen, and maintain SpO2 92-96%.');
  directives.push('Maintain normothermia (36.5 - 37.5°C) unless patient is enrolled in Therapeutic Hypothermia protocol for HIE.');
  directives.push('Obtain immediate venous blood gas, electrolytes, blood glucose, calcium, magnesium, sepsis panel, and baseline liver/renal function.');
  if (params.seizureSemiology === 'subtle' || params.seizureSemiology === 'autonomic') {
    directives.push('Subtle/autonomic seizures (cycling, lip smacking, paroxysmal apnea, boxing) require amplitude-integrated EEG (aEEG) or video EEG confirmation to differentiate from non-epileptic jitteriness.');
  }
  directives.push('Document hourly flowsheet checks for seizure count, vital signs, sedation level, and medication doses.');

  return {
    urgencyCategory,
    urgencyLabel,
    isStatusEpilepticus: isStatus,
    isRefractorySeizures: isRefractory,
    phenobarbitalLoading,
    phenobarbitalAdditional,
    secondLineRecommendation,
    metabolicDirectives,
    pyridoxineTrialIndicated,
    clinicalAlerts: alerts,
    managementDirectives: directives,
  };
}
