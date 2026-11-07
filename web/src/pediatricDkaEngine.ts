// Pediatric Diabetic Ketoacidosis (DKA) Resuscitation & Two-Bag Protocol Engine
// Reference: ISPAD Clinical Practice Consensus Guidelines 2022,
// PECARN Fluid Trial, and BSPED Pediatric DKA Calculator Standards.

export interface PediatricDkaInput {
  childWeightKg: number;
  initialBloodGlucoseMgDl: number;
  venousPh: number;
  serumBicarbonateMmolL: number;
  measuredSodiumMeqL?: number;
  measuredPotassiumMeqL?: number;
  measuredChlorideMeqL?: number;
  serumBetaHydroxybutyrateMmolL?: number;
}

export interface PediatricDkaAssessmentResult {
  dkaSeverity: 'mild_ph_7_20_7_29' | 'moderate_ph_7_10_7_19' | 'severe_ph_lt_7_10';
  dkaSeverityLabel: string;
  estimatedDehydrationPercent: number;
  totalFluidDeficitMl: number;
  initialBolusVolumeMl: number;
  remainingDeficitMl: number;
  hourlyMaintenanceMlHr: number;
  maintenanceFluidMlDay: number;
  hourlyDeficitRateMlHr: number;
  totalHourlyRehydrationRateMlHr: number; // Maintenance + Deficit over 48 hours
  recommendedInsulinInfusionUnitsHr: number; // 0.05 to 0.10 U/kg/hr
  correctedSodiumMeqL?: number;
  anionGapMmolL?: number;
  effectiveOsmolalityMosmKg?: number;
  twoBagTitrationGuidelines: {
    bloodGlucoseThresholdMgDl: number;
    bag1Composition: string;
    bag2Composition: string;
    actionRule: string;
  };
  cerebralEdemaAlerts: string[];
  clinicalDirectives: string[];
}

export function calculatePediatricDka(input: PediatricDkaInput): PediatricDkaAssessmentResult {
  const {
    childWeightKg,
    initialBloodGlucoseMgDl: bg,
    venousPh: ph,
    serumBicarbonateMmolL: hco3,
    measuredSodiumMeqL: na,
    measuredPotassiumMeqL: k,
    measuredChlorideMeqL: cl,
  } = input;

  const w = Math.max(3, childWeightKg);

  // 1. Severity Classification
  let dkaSeverity: 'mild_ph_7_20_7_29' | 'moderate_ph_7_10_7_19' | 'severe_ph_lt_7_10';
  let dkaSeverityLabel: string;
  let estimatedDehydrationPercent: number;

  if (ph < 7.10 || hco3 < 5.0) {
    dkaSeverity = 'severe_ph_lt_7_10';
    dkaSeverityLabel = 'Severe DKA (pH < 7.10 or HCO3 < 5 mmol/L) - PICU Standby';
    estimatedDehydrationPercent = 7.0; // 7% standard
  } else if (ph < 7.20 || hco3 < 10.0) {
    dkaSeverity = 'moderate_ph_7_10_7_19';
    dkaSeverityLabel = 'Moderate DKA (pH 7.10 - 7.19 or HCO3 5 - 9 mmol/L)';
    estimatedDehydrationPercent = 5.0;
  } else {
    dkaSeverity = 'mild_ph_7_20_7_29';
    dkaSeverityLabel = 'Mild DKA (pH 7.20 - 7.29 or HCO3 10 - 14 mmol/L)';
    estimatedDehydrationPercent = 5.0;
  }

  // 2. Fluid Calculations
  // Total Deficit (mL) = Dehydration % * weight (kg) * 10
  const totalFluidDeficitMl = Math.round(estimatedDehydrationPercent * w * 10);

  // Initial 0.9% Saline Bolus (10 mL/kg, max 20 mL/kg in hypovolemic shock)
  const initialBolusVolumeMl = Math.min(1000, Math.round(10 * w));
  const remainingDeficitMl = Math.max(0, totalFluidDeficitMl - initialBolusVolumeMl);

  // Deficit is replaced evenly over 48 hours to minimize cerebral edema risk
  const hourlyDeficitRateMlHr = Number((remainingDeficitMl / 48).toFixed(1));

  // Holliday-Segar Maintenance Fluid
  let maintenanceMlDay = 0;
  if (w <= 10) {
    maintenanceMlDay = w * 100;
  } else if (w <= 20) {
    maintenanceMlDay = 1000 + (w - 10) * 50;
  } else {
    maintenanceMlDay = 1500 + (w - 20) * 20;
  }
  const hourlyMaintenanceMlHr = Number((maintenanceMlDay / 24).toFixed(1));

  // Total Hourly Rate = Hourly Maintenance + Hourly Deficit
  const totalHourlyRehydrationRateMlHr = Number((hourlyMaintenanceMlHr + hourlyDeficitRateMlHr).toFixed(1));

  // 3. Regular Insulin Infusion: 0.05 units/kg/hr for mild/moderate, 0.05 - 0.10 for severe
  const insulinPerKg = dkaSeverity === 'severe_ph_lt_7_10' ? 0.08 : 0.05;
  const recommendedInsulinInfusionUnitsHr = Number((w * insulinPerKg).toFixed(2));

  // 4. Corrected Sodium & Anion Gap
  let correctedSodiumMeqL: number | undefined;
  let anionGapMmolL: number | undefined;
  let effectiveOsmolalityMosmKg: number | undefined;

  if (na !== undefined) {
    // Corrected Na = Na + 1.6 * ((BG - 100) / 100)
    correctedSodiumMeqL = Number((na + 1.6 * ((bg - 100) / 100)).toFixed(1));

    if (cl !== undefined) {
      anionGapMmolL = Number((na - (cl + hco3)).toFixed(1));
    }

    effectiveOsmolalityMosmKg = Number((2 * na + bg / 18).toFixed(1));
  }

  const twoBagTitrationGuidelines = {
    bloodGlucoseThresholdMgDl: 250,
    bag1Composition: 'Bag 1: 0.9% Normal Saline + 20-40 mEq/L KCl (NO Dextrose)',
    bag2Composition: 'Bag 2: 10% Dextrose in 0.9% Normal Saline + 20-40 mEq/L KCl',
    actionRule: `Keep sum of Bag 1 + Bag 2 = ${totalHourlyRehydrationRateMlHr} mL/hr. When BG > 250 mg/dL, run 100% Bag 1. When BG drops < 250 mg/dL, titrate in Bag 2 (e.g. 50/50) to prevent hypoglycemia while continuing insulin at ${recommendedInsulinInfusionUnitsHr} U/hr to close ketoacidosis.`,
  };

  const cerebralEdemaAlerts: string[] = [
    'Hourly Neurological Checks: Monitor Glasgow Coma Scale (GCS), pupil symmetry & reactivity, headache, and persistent vomiting.',
    'Cushing Triad Alert: Development of bradycardia, systemic hypertension, and respiratory depression indicates impending brainstem herniation.',
    'Emergency Standby: Keep 3% Hypertonic Saline (5 mL/kg over 10-15 min) or 20% Mannitol (0.5 - 1.0 g/kg over 20 min) at bedside ready for immediate infusion.',
  ];

  const clinicalDirectives: string[] = [
    'NO IV INSULIN BOLUS: Administering an insulin bolus increases cerebral edema and mortality without faster acidosis clearance.',
    'Delay insulin start by 1 hour: Ensure initial volume resuscitation is running before initiating regular insulin infusion.',
    'Potassium Replacement: Add 20 - 40 mEq/L KCl to IV fluids once urine output is established and serum K < 5.5 mEq/L.',
    'Do NOT give IV Sodium Bicarbonate: Paradoxically worsens central nervous system acidosis and triggers tissue hypoperfusion.',
  ];

  return {
    dkaSeverity,
    dkaSeverityLabel,
    estimatedDehydrationPercent,
    totalFluidDeficitMl,
    initialBolusVolumeMl,
    remainingDeficitMl,
    hourlyMaintenanceMlHr,
    maintenanceFluidMlDay: maintenanceMlDay,
    hourlyDeficitRateMlHr,
    totalHourlyRehydrationRateMlHr,
    recommendedInsulinInfusionUnitsHr,
    correctedSodiumMeqL,
    anionGapMmolL,
    effectiveOsmolalityMosmKg,
    twoBagTitrationGuidelines,
    cerebralEdemaAlerts,
    clinicalDirectives,
  };
}
