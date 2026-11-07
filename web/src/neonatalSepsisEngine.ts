/**
 * Neonatal Early-Onset Sepsis (Kaiser EOS), Late-Onset Sepsis (I/T Ratio)
 * & Targeted Hemodynamic Inotrope Stewardship Clinical Decision Engine
 *
 * References:
 * - Kaiser Permanente Neonatal Sepsis Calculator (Puopolo KM, Draper D, Sengupta S, et al.)
 * - AAP Committee on Fetus and Newborn: Management of Neonates Born at >= 35 Weeks with Suspected or Proven Sepsis (Pediatrics 2018)
 * - Neonatal Hemodynamics & Targeted Neonatal Echocardiography (TnECHO) Consensus
 */

export interface KaiserEosInput {
  gestationalAgeWeeks: number;
  gestationalAgeDays?: number;
  birthWeightGrams: number;
  maternalTempCelsius: number; // e.g. 38.0
  romHours: number; // Duration of rupture of membranes in hours
  maternalGbsStatus: 'positive' | 'negative' | 'unknown';
  maternalIapStatus: 'adequate' | 'inadequate' | 'none'; // adequate = GBS-active IV >= 4h prior to delivery
  clinicalPresentation: 'well_appearing' | 'equivocal' | 'clinical_illness';
}

export interface KaiserEosResult {
  eosRiskPer1000: number; // e.g. 0.42 per 1000
  priorRiskPer1000: number;
  recommendation: 'routine_care' | 'serial_physical_exams' | 'blood_culture_empiric_antibiotics';
  recommendationLabel: string;
  actionGuidance: string;
  antibioticIndicated: boolean;
  bloodCultureIndicated: boolean;
  vitalSignFrequencyHours: number;
}

export interface ItRatioInput {
  bandsPercent: number;
  metamyelocytesPercent?: number;
  segmentedNeutrophilsPercent: number;
}

export interface ItRatioResult {
  itRatio: number;
  isElevated: boolean; // >= 0.20
  interpretation: string;
  severityGrade: 'normal' | 'borderline' | 'abnormal_sepsis_alert';
}

export interface NeonatalEmpiricAntibioticDosing {
  ampicillinDoseMg: number;
  ampicillinIntervalHours: number;
  ampicillinRoute: string;
  gentamicinDoseMg: number;
  gentamicinIntervalHours: number;
  gentamicinRoute: string;
  clinicalNotes: string;
}

export interface InotropeDosingInput {
  weightKg: number;
  dopamineMcgKgMin?: number;
  dobutamineMcgKgMin?: number;
  epinephrineMcgKgMin?: number;
  milrinoneMcgKgMin?: number;
}

export interface InotropeDosingResult {
  dopamineRateMlHr: number;
  dobutamineRateMlHr: number;
  epinephrineRateMlHr: number;
  milrinoneRateMlHr: number;
  hemodynamicAlert?: string;
}

/**
 * Calculates Kaiser Permanente Early-Onset Sepsis (EOS) Risk per 1000 live births
 */
export function calculateKaiserEosRisk(input: KaiserEosInput): KaiserEosResult {
  const gaTotalWeeks = input.gestationalAgeWeeks + (input.gestationalAgeDays || 0) / 7;

  // Baseline incidence prior in population ~ 0.5 per 1,000 live births
  let logOdds = Math.log(0.0005 / (1 - 0.0005));

  // 1. Gestational Age adjustment (lower GA increases vulnerability)
  if (gaTotalWeeks < 37) {
    logOdds += 0.8 * (37 - gaTotalWeeks);
  }

  // 2. Maternal Intrapartum Temperature
  // Normal baseline 37.0°C; fever > 37.8°C substantially raises risk
  if (input.maternalTempCelsius > 37.5) {
    const excessTemp = input.maternalTempCelsius - 37.5;
    logOdds += 1.3 * excessTemp;
  }

  // 3. Duration of Rupture of Membranes (ROM)
  if (input.romHours > 18) {
    const excessRomHours = Math.min(input.romHours - 18, 48);
    logOdds += 0.04 * excessRomHours;
  }

  // 4. Maternal GBS and Intrapartum Antibiotic Prophylaxis (IAP)
  if (input.maternalGbsStatus === 'positive') {
    if (input.maternalIapStatus === 'adequate') {
      logOdds -= 1.1; // Broad-spectrum/penicillin >= 4h protects substantially
    } else {
      logOdds += 0.9;
    }
  } else if (input.maternalGbsStatus === 'unknown') {
    if (input.maternalIapStatus === 'adequate') {
      logOdds -= 0.6;
    } else {
      logOdds += 0.2;
    }
  }

  // Convert prior log-odds to prior probability per 1,000
  const priorProb = Math.exp(logOdds) / (1 + Math.exp(logOdds));
  const priorRiskPer1000 = Math.round(priorProb * 1000 * 100) / 100;

  // 5. Clinical Presentation Likelihood Ratio
  // Well-appearing: LR ~ 0.5; Equivocal: LR ~ 4.2; Clinical Illness: LR ~ 24
  let lr = 0.5;
  if (input.clinicalPresentation === 'equivocal') {
    lr = 4.2;
  } else if (input.clinicalPresentation === 'clinical_illness') {
    lr = 24.0;
  }

  const posteriorOdds = (priorProb / (1 - priorProb)) * lr;
  const posteriorProb = posteriorOdds / (1 + posteriorOdds);
  const eosRiskPer1000 = Math.round(posteriorProb * 1000 * 100) / 100;

  // Stratify recommendations according to CDC / AAP / Kaiser algorithms
  let recommendation: 'routine_care' | 'serial_physical_exams' | 'blood_culture_empiric_antibiotics';
  let recommendationLabel: string;
  let actionGuidance: string;
  let antibioticIndicated = false;
  let bloodCultureIndicated = false;
  let vitalSignFrequencyHours = 4;

  if (input.clinicalPresentation === 'clinical_illness' || eosRiskPer1000 >= 3.0) {
    recommendation = 'blood_culture_empiric_antibiotics';
    recommendationLabel = 'Blood Culture & Empiric IV Antibiotics';
    actionGuidance = 'Immediate blood culture prior to starting IV Ampicillin + Gentamicin. Admit to NICU/SNCU for continuous vital monitoring.';
    antibioticIndicated = true;
    bloodCultureIndicated = true;
    vitalSignFrequencyHours = 2;
  } else if (input.clinicalPresentation === 'equivocal' || eosRiskPer1000 >= 0.7) {
    recommendation = 'serial_physical_exams';
    recommendationLabel = 'Serial Physical Examinations (q4h x 24h)';
    actionGuidance = 'Perform structured vital signs and respiratory physical examinations every 4 hours for 24-48 hours. Escalate to blood culture if clinical signs emerge.';
    vitalSignFrequencyHours = 4;
  } else {
    recommendation = 'routine_care';
    recommendationLabel = 'Routine Newborn Clinical Care';
    actionGuidance = 'Low risk of early-onset sepsis. Continue standard rooming-in newborn care and maternal breastfeeding.';
    vitalSignFrequencyHours = 8;
  }

  return {
    eosRiskPer1000,
    priorRiskPer1000,
    recommendation,
    recommendationLabel,
    actionGuidance,
    antibioticIndicated,
    bloodCultureIndicated,
    vitalSignFrequencyHours
  };
}

/**
 * Calculates Immature to Total Neutrophil (I/T) Ratio for Sepsis Screening
 * Formula: (Bands + Metamyelocytes) / (Segmented Neutrophils + Bands + Metamyelocytes)
 * Threshold: >= 0.20 is diagnostic/supportive of neonatal sepsis
 */
export function calculateItRatio(input: ItRatioInput): ItRatioResult {
  const immature = input.bandsPercent + (input.metamyelocytesPercent || 0);
  const total = input.segmentedNeutrophilsPercent + immature;

  if (total <= 0) {
    return {
      itRatio: 0,
      isElevated: false,
      interpretation: 'Insufficient white cell count parameters to compute I/T ratio.',
      severityGrade: 'normal'
    };
  }

  const itRatio = Math.round((immature / total) * 100) / 100;
  const isElevated = itRatio >= 0.20;

  let interpretation: string;
  let severityGrade: 'normal' | 'borderline' | 'abnormal_sepsis_alert';

  if (itRatio >= 0.25) {
    severityGrade = 'abnormal_sepsis_alert';
    interpretation = `Markedly elevated I/T ratio (${itRatio} >= 0.25). Severe left shift indicates significant bacterial mobilization and active septicemia.`;
  } else if (itRatio >= 0.20) {
    severityGrade = 'abnormal_sepsis_alert';
    interpretation = `Elevated I/T ratio (${itRatio} >= 0.20). Positive screen for neonatal sepsis. Warranting blood culture and empiric coverage.`;
  } else if (itRatio >= 0.16) {
    severityGrade = 'borderline';
    interpretation = `Borderline I/T ratio (${itRatio}). Repeat hematology and serial inflammatory markers in 12-24 hours.`;
  } else {
    severityGrade = 'normal';
    interpretation = `Normal I/T ratio (${itRatio} < 0.20). Low likelihood of acute bacterial sepsis in absence of clinical illness.`;
  }

  return {
    itRatio,
    isElevated,
    interpretation,
    severityGrade
  };
}

/**
 * Calculates neonatal empiric antibiotic dosing (Ampicillin + Gentamicin)
 */
export function calculateNeonatalAntibioticDosing(
  weightGrams: number,
  gestationalAgeWeeks: number
): NeonatalEmpiricAntibioticDosing {
  const weightKg = Math.max(weightGrams / 1000, 0.4);

  // Ampicillin: 50 mg/kg/dose IV Q12H for standard bacteremia/sepsis
  const ampicillinDoseMg = Math.round(weightKg * 50 * 10) / 10;
  const ampicillinIntervalHours = 12;

  // Gentamicin: 4-5 mg/kg IV single dose
  // Extremely preterm (<30 weeks) interval is 36-48h; >=30 weeks is 24h
  const gentamicinDoseMg = Math.round(weightKg * 4.5 * 10) / 10;
  const gentamicinIntervalHours = gestationalAgeWeeks < 30 ? 36 : 24;

  const clinicalNotes = `Ampicillin ${ampicillinDoseMg} mg IV q${ampicillinIntervalHours}h + Gentamicin ${gentamicinDoseMg} mg IV q${gentamicinIntervalHours}h. Draw trough level prior to 2nd dose if continuing beyond 48 hours.`;

  return {
    ampicillinDoseMg,
    ampicillinIntervalHours,
    ampicillinRoute: 'IV',
    gentamicinDoseMg,
    gentamicinIntervalHours,
    gentamicinRoute: 'IV',
    clinicalNotes
  };
}

/**
 * Standard neonatal inotrope infusion rate calculator:
 * Standard concentration recipe: (weightKg * 30 mg in 50 mL saline) -> 1 mL/hr = 10 mcg/kg/min
 * Dobutamine/Dopamine: rate (mL/hr) = (dose mcg/kg/min * weightKg * 60) / concentration (mcg/mL)
 */
export function calculateInotropeInfusionRates(input: InotropeDosingInput): InotropeDosingResult {
  const weight = Math.max(input.weightKg, 0.4);

  // Standard syringe: 30 mg/kg in 50 mL D5W/Saline => 600 mcg/mL per kg factor => 1 mL/hr = 10 mcg/kg/min
  // Thus rate = dose / 10
  const dopamineRateMlHr = input.dopamineMcgKgMin ? Math.round((input.dopamineMcgKgMin / 10) * 100) / 100 : 0;
  const dobutamineRateMlHr = input.dobutamineMcgKgMin ? Math.round((input.dobutamineMcgKgMin / 10) * 100) / 100 : 0;

  // Epinephrine: standard 0.6 mg/kg in 50 mL => 1 mL/hr = 0.2 mcg/kg/min => rate = dose / 0.2
  const epinephrineRateMlHr = input.epinephrineMcgKgMin ? Math.round((input.epinephrineMcgKgMin / 0.2) * 100) / 100 : 0;

  // Milrinone: 1.5 mg/kg in 50 mL => 1 mL/hr = 0.5 mcg/kg/min => rate = dose / 0.5
  const milrinoneRateMlHr = input.milrinoneMcgKgMin ? Math.round((input.milrinoneMcgKgMin / 0.5) * 100) / 100 : 0;

  let hemodynamicAlert: string | undefined;
  if ((input.dopamineMcgKgMin || 0) > 15 || (input.epinephrineMcgKgMin || 0) > 0.3) {
    hemodynamicAlert = 'High-dose vasopressor support active: Risk of peripheral ischemia and tachycardia. Evaluate for refractory septic shock and consider stress-dose hydrocortisone.';
  }

  return {
    dopamineRateMlHr,
    dobutamineRateMlHr,
    epinephrineRateMlHr,
    milrinoneRateMlHr,
    hemodynamicAlert
  };
}
