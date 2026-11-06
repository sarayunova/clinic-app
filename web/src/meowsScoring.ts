/**
 * Maternal Early Obstetric Warning Score (MEOWS) & Sepsis in Obstetrics (SOS)
 * Clinical Rules and Scoring Engine
 * 
 * Implements:
 * 1. RCOG / MBRRACE-UK MEOWS Track-and-Trigger System
 * 2. Obstetric specific parameters: Lochia, Proteinuria, Urine Output, AVPU
 * 3. Sepsis in Obstetrics Score (SOS) by Albright et al.
 * 4. 1-Hour Maternal Sepsis Resuscitation Bundle Evaluation
 */

export type TriggerColor = 'green' | 'yellow' | 'red';

export interface MeowsInput {
  respiratoryRate?: number | null;
  spo2Percent?: number | null;
  supplementalO2?: boolean | number | null;
  o2FlowRateLpm?: number | null;
  temperatureC?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  heartRate?: number | null;
  avpuConsciousness?: 'alert' | 'voice' | 'pain' | 'unresponsive' | 'confused_agitated';
  painScore?: number | null;
  lochiaStatus?: 'normal' | 'scant' | 'heavy_foul_smelling' | 'excessive_clots_hemorrhage';
  urineOutputMlHr?: number | null;
  proteinuria?: 'nil' | 'trace' | '1+' | '2+' | '3+' | '4+';
  whiteCellCountK?: number | null;
  serumLactateMmolL?: number | null;
}

export interface MeowsEvaluation {
  rrTrigger: TriggerColor;
  spo2Trigger: TriggerColor;
  tempTrigger: TriggerColor;
  bpTrigger: TriggerColor;
  hrTrigger: TriggerColor;
  neuroTrigger: TriggerColor;
  lochiaTrigger: TriggerColor;
  urineTrigger: TriggerColor;
  proteinuriaTrigger: TriggerColor;

  yellowCount: number;
  redCount: number;
  alertLevel: 'normal_green' | 'single_yellow' | 'urgent_two_yellow_one_red' | 'critical_multiple_red';
  badgeClass: string;
  alertTitle: string;
  actionRequired: string;

  // Sepsis in Obstetrics Score (SOS)
  sosScore: number;
  sosRiskLevel: 'low' | 'intermediate' | 'high_septic_shock';
  sosBadgeClass: string;
  sosGuidance: string;
}

export function evaluateMeows(input: MeowsInput): MeowsEvaluation {
  // 1. Respiratory Rate
  let rrTrigger: TriggerColor = 'green';
  if (input.respiratoryRate != null) {
    if (input.respiratoryRate < 10 || input.respiratoryRate > 25) {
      rrTrigger = 'red';
    } else if (input.respiratoryRate === 10 || (input.respiratoryRate >= 21 && input.respiratoryRate <= 25)) {
      rrTrigger = 'yellow';
    }
  }

  // 2. Oxygen Saturation (SpO2)
  let spo2Trigger: TriggerColor = 'green';
  if (input.spo2Percent != null) {
    if (input.spo2Percent < 94) {
      spo2Trigger = 'red';
    } else if (input.spo2Percent <= 95 || (Boolean(input.supplementalO2) && (input.o2FlowRateLpm ?? 0) <= 2)) {
      spo2Trigger = 'yellow';
    }
  }
  if (Boolean(input.supplementalO2) && (input.o2FlowRateLpm ?? 0) > 4 && spo2Trigger === 'green') {
    spo2Trigger = 'yellow';
  }

  // 3. Temperature
  let tempTrigger: TriggerColor = 'green';
  if (input.temperatureC != null) {
    if (input.temperatureC < 35.0 || input.temperatureC >= 38.0) {
      tempTrigger = 'red';
    } else if (
      (input.temperatureC >= 35.1 && input.temperatureC <= 35.9) ||
      (input.temperatureC >= 37.5 && input.temperatureC <= 37.9)
    ) {
      tempTrigger = 'yellow';
    }
  }

  // 4. Blood Pressure (Systolic & Diastolic)
  let sysTrigger: TriggerColor = 'green';
  if (input.bpSystolic != null) {
    if (input.bpSystolic < 90 || input.bpSystolic >= 150) {
      sysTrigger = 'red';
    } else if (
      (input.bpSystolic >= 90 && input.bpSystolic <= 99) ||
      (input.bpSystolic >= 140 && input.bpSystolic <= 149)
    ) {
      sysTrigger = 'yellow';
    }
  }

  let diaTrigger: TriggerColor = 'green';
  if (input.bpDiastolic != null) {
    if (input.bpDiastolic < 50 || input.bpDiastolic >= 100) {
      diaTrigger = 'red';
    } else if (input.bpDiastolic >= 90 && input.bpDiastolic <= 99) {
      diaTrigger = 'yellow';
    }
  }

  let bpTrigger: TriggerColor = 'green';
  if (sysTrigger === 'red' || diaTrigger === 'red') {
    bpTrigger = 'red';
  } else if (sysTrigger === 'yellow' || diaTrigger === 'yellow') {
    bpTrigger = 'yellow';
  }

  // 5. Heart Rate
  let hrTrigger: TriggerColor = 'green';
  if (input.heartRate != null) {
    if (input.heartRate < 50 || input.heartRate >= 120) {
      hrTrigger = 'red';
    } else if (
      (input.heartRate >= 50 && input.heartRate <= 59) ||
      (input.heartRate >= 100 && input.heartRate <= 119)
    ) {
      hrTrigger = 'yellow';
    }
  }

  // 6. Neurological / AVPU
  let neuroTrigger: TriggerColor = 'green';
  if (input.avpuConsciousness) {
    if (
      input.avpuConsciousness === 'pain' ||
      input.avpuConsciousness === 'unresponsive' ||
      input.avpuConsciousness === 'confused_agitated'
    ) {
      neuroTrigger = 'red';
    } else if (input.avpuConsciousness === 'voice') {
      neuroTrigger = 'yellow';
    }
  }

  // 7. Lochia
  let lochiaTrigger: TriggerColor = 'green';
  if (input.lochiaStatus === 'excessive_clots_hemorrhage') {
    lochiaTrigger = 'red';
  } else if (input.lochiaStatus === 'heavy_foul_smelling') {
    lochiaTrigger = 'yellow';
  }

  // 8. Urine Output
  let urineTrigger: TriggerColor = 'green';
  if (input.urineOutputMlHr != null) {
    if (input.urineOutputMlHr < 15) {
      urineTrigger = 'red'; // Severe oliguria / anuria
    } else if (input.urineOutputMlHr < 30) {
      urineTrigger = 'yellow'; // Oliguria < 30 mL/hr
    }
  }

  // 9. Proteinuria
  let proteinuriaTrigger: TriggerColor = 'green';
  if (input.proteinuria) {
    if (['2+', '3+', '4+'].includes(input.proteinuria)) {
      proteinuriaTrigger = 'red';
    } else if (input.proteinuria === '1+') {
      proteinuriaTrigger = 'yellow';
    }
  }

  // Count yellow and red triggers
  const triggers = [
    rrTrigger,
    spo2Trigger,
    tempTrigger,
    bpTrigger,
    hrTrigger,
    neuroTrigger,
    lochiaTrigger,
    urineTrigger,
    proteinuriaTrigger,
  ];

  const yellowCount = triggers.filter((t) => t === 'yellow').length;
  const redCount = triggers.filter((t) => t === 'red').length;

  let alertLevel: 'normal_green' | 'single_yellow' | 'urgent_two_yellow_one_red' | 'critical_multiple_red' = 'normal_green';
  let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  let alertTitle = 'Normal Physiological Observations (Green)';
  let actionRequired = 'Routine observations every 4 to 6 hours or as per ward handover protocol.';

  if (redCount >= 2) {
    alertLevel = 'critical_multiple_red';
    badgeClass = 'bg-rose-100 text-rose-800 border-rose-400 animate-pulse';
    alertTitle = `CRITICAL ALERT: ${redCount} Red Triggers (${yellowCount} Yellow)`;
    actionRequired = 'CRITICAL OBSTETRIC EMERGENCY: Immediate bedside obstetric & anesthetic call. Prepare HDU/ICU transfer, continuous invasive monitoring, and resuscitation.';
  } else if (redCount === 1 || yellowCount >= 2) {
    alertLevel = 'urgent_two_yellow_one_red';
    badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    alertTitle = redCount === 1 ? `URGENT ALERT: 1 Red Trigger (${yellowCount} Yellow)` : `URGENT ALERT: ${yellowCount} Yellow Triggers`;
    actionRequired = 'URGENT MEDICAL REVIEW: Obstetric Registrar / Consultant review within 30 minutes. Repeat observations in 30m; send FBC, U&E, LFT, serum lactate.';
  } else if (yellowCount === 1) {
    alertLevel = 'single_yellow';
    badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
    alertTitle = 'EARLY WARNING: 1 Yellow Trigger';
    actionRequired = 'Repeat observations within 1 hour. Incharge midwife / resident review; check fluid intake & output.';
  }

  // Calculate Sepsis in Obstetrics Score (SOS)
  let sosScore = 0;
  if (input.temperatureC != null && (input.temperatureC < 36.0 || input.temperatureC >= 38.0)) sosScore += 1;
  if (input.bpSystolic != null && input.bpSystolic < 90) sosScore += 2;
  if (input.heartRate != null && input.heartRate > 120) sosScore += 1;
  if (input.respiratoryRate != null && input.respiratoryRate > 25) sosScore += 1;
  if (input.spo2Percent != null && input.spo2Percent < 92) sosScore += 2;
  if (input.whiteCellCountK != null && (input.whiteCellCountK > 12 || input.whiteCellCountK < 4)) sosScore += 1;
  if (input.serumLactateMmolL != null) {
    if (input.serumLactateMmolL >= 4.0) sosScore += 2;
    else if (input.serumLactateMmolL >= 2.0) sosScore += 1;
  }

  let sosRiskLevel: 'low' | 'intermediate' | 'high_septic_shock' = 'low';
  let sosBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  let sosGuidance = 'Low suspicion of sepsis. Continue monitoring.';

  if (sosScore >= 6) {
    sosRiskLevel = 'high_septic_shock';
    sosBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    sosGuidance = 'HIGH RISK MATERNAL SEPSIS / SEPTIC SHOCK (SOS >= 6): Activate 1-Hour Sepsis Bundle immediately. Rapid fluid bolus 30 mL/kg, blood cultures, broad-spectrum IV antibiotics, ICU consult.';
  } else if (sosScore >= 4) {
    sosRiskLevel = 'intermediate';
    sosBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    sosGuidance = 'INTERMEDIATE SEPSIS SUSPICION (SOS 4-5): Screen for infection site (chorioamnionitis, endometritis, UTI, wound). Draw lactate & blood cultures; prompt obstetric review.';
  }

  return {
    rrTrigger,
    spo2Trigger,
    tempTrigger,
    bpTrigger,
    hrTrigger,
    neuroTrigger,
    lochiaTrigger,
    urineTrigger,
    proteinuriaTrigger,
    yellowCount,
    redCount,
    alertLevel,
    badgeClass,
    alertTitle,
    actionRequired,
    sosScore,
    sosRiskLevel,
    sosBadgeClass,
    sosGuidance,
  };
}

export interface SepsisBundleChecklist {
  bloodCulturesTaken: boolean;
  lactateDrawn: boolean;
  ivAntibioticsGiven: boolean;
  ivFluidsBolusGiven: boolean;
  oxygenApplied: boolean;
  foleyUrineHourly: boolean;
}

export function evaluateSepsisBundleCompliance(b: Partial<SepsisBundleChecklist>): {
  completedCount: number;
  totalElements: number;
  isFullyCompliant: boolean;
  missingElements: string[];
} {
  const missing: string[] = [];
  if (!b.bloodCulturesTaken) missing.push('Blood cultures prior to antibiotics');
  if (!b.lactateDrawn) missing.push('Serum lactate drawn');
  if (!b.ivAntibioticsGiven) missing.push('Broad-spectrum IV antibiotics within 1h');
  if (!b.ivFluidsBolusGiven) missing.push('IV fluid bolus for hypotension / lactate >= 2');
  if (!b.oxygenApplied) missing.push('Oxygen therapy (target SpO2 >= 95%)');
  if (!b.foleyUrineHourly) missing.push('Indwelling Foley catheter with hourly urometer');

  const completedCount = 6 - missing.length;
  return {
    completedCount,
    totalElements: 6,
    isFullyCompliant: missing.length === 0,
    missingElements: missing,
  };
}
