// NICU (Level-3) Total Parenteral Nutrition (TPN) & Electrolyte Compounding Engine
// Reference: ESPGHAN/ESPEN/ESPR/CSPN Guidelines on Pediatric Parenteral Nutrition,
// NNF Neonatal Resuscitation & Nutrition Standards, and ASPEN Compounding Safety Guidelines.

export interface NicuTpnCalculationInput {
  currentWeightKg: number;
  birthWeightKg: number;
  dayOfLife: number;
  gestationalAgeWeeks?: number;
  targetTotalFluidMlPerKgDay: number;
  enteralIntakeMlDay?: number;
  dextrosePercent: number; // e.g. 10%, 12.5%, 15%
  aminoAcidGPerKgDay: number; // e.g. 1.5 to 3.5 g/kg/d
  aminoAcidSolutionType: 'trophamine_6' | 'trophamine_10' | 'primene_10' | 'aminoven_infant_10';
  lipidGPerKgDay: number; // e.g. 1.0 to 3.0 g/kg/d
  lipidEmulsionType: 'intralipid_20' | 'smoflipid_20' | 'lipofundin_20';
  sodiumMeqPerKgDay?: number; // e.g. 2-4 mEq/kg/d
  potassiumMeqPerKgDay?: number; // e.g. 1-2 mEq/kg/d
  calciumGluconateMlPerKgDay?: number; // 10% solution (1 mL = ~0.45 mEq Ca)
  magnesiumSulfateMlDay?: number; // 50% solution
  phosphateMmolPerKgDay?: number; // 1-2 mmol/kg/d
  heparinUnitsPerMl?: number; // 0.5 - 1.0 U/mL for central line thrombosis prophylaxis
  multivitaminMviMlDay?: number; // 1.5 - 3.0 mL/day
}

export interface NicuTpnCalculationResult {
  parenteralFluidMlDay: number;
  infusionRateMlHr: number;
  dextroseGramsDay: number;
  glucoseInfusionRateGir: number; // mg/kg/min
  dextroseVolumeMl: number;
  aminoAcidGramsDay: number;
  aminoAcidVolumeMl: number;
  lipidGramsDay: number;
  lipidVolumeMl: number;
  lipidInfusionRateMlHr: number;
  sodiumMeqTotal: number;
  potassiumMeqTotal: number;
  calciumGluconateTotalMl: number;
  totalCaloriesKcalDay: number;
  caloriesPerKgDay: number;
  dextroseCaloriesKcal: number;
  aminoAcidCaloriesKcal: number;
  lipidCaloriesKcal: number;
  nitrogenGramsDay: number;
  nonProteinCaloriesKcal: number;
  nonProteinCalorieToNitrogenRatio: number;
  totalOsmolarityMOsmL: number;
  recommendedRouteCategory: 'peripheral' | 'central_line_uvc_picc';
  isCentralLineMandatory: boolean;
  osmolarityAlert: string;
  girAlert?: string;
  caloricAdequacyAlert: string;
  safetyRecommendations: string[];
}

export function calculateNicuTpn(input: NicuTpnCalculationInput): NicuTpnCalculationResult {
  const {
    currentWeightKg,
    targetTotalFluidMlPerKgDay,
    enteralIntakeMlDay = 0,
    dextrosePercent,
    aminoAcidGPerKgDay,
    aminoAcidSolutionType,
    lipidGPerKgDay,
    sodiumMeqPerKgDay = 0,
    potassiumMeqPerKgDay = 0,
    calciumGluconateMlPerKgDay = 0,
  } = input;

  const w = Math.max(0.3, currentWeightKg);

  // 1. Fluid Volumes
  const targetTotalFluidMl = targetTotalFluidMlPerKgDay * w;
  const parenteralFluidMlDay = Math.max(0, targetTotalFluidMl - enteralIntakeMlDay);
  const infusionRateMlHr = Number((parenteralFluidMlDay / 24).toFixed(2));

  // 2. Lipids (20% emulsion = 0.2 g/mL or 2 kcal/mL)
  const lipidGramsDay = lipidGPerKgDay * w;
  const lipidVolumeMl = Number((lipidGramsDay / 0.2).toFixed(1)); // 1g = 5 mL of 20%
  const lipidInfusionRateMlHr = Number((lipidVolumeMl / 24).toFixed(2));

  // 3. Amino Acids
  // Concentrations: trophamine_6 is 6% (0.06 g/mL), others are 10% (0.10 g/mL)
  const aaConcentration = aminoAcidSolutionType === 'trophamine_6' ? 0.06 : 0.10;
  const aminoAcidGramsDay = aminoAcidGPerKgDay * w;
  const aminoAcidVolumeMl = Number((aminoAcidGramsDay / aaConcentration).toFixed(1));

  // 4. Aqueous TPN Fluid (excluding lipid syringe which is infused separately via piggyback)
  const aqueousFluidMl = Math.max(10, parenteralFluidMlDay - lipidVolumeMl);

  // 5. Dextrose & Glucose Infusion Rate (GIR)
  // Aqueous fluid is predominantly dextrose solution
  const dextroseVolumeMl = Math.max(0, aqueousFluidMl - aminoAcidVolumeMl - (calciumGluconateMlPerKgDay * w));
  const dextroseGramsDay = (dextrosePercent / 100) * dextroseVolumeMl;

  // GIR formula: (Dextrose % * aqueous infusion rate in mL/h) / (6 * weight in kg)
  const aqueousRateMlHr = aqueousFluidMl / 24;
  const glucoseInfusionRateGir = Number(((dextrosePercent * aqueousRateMlHr) / (6 * w)).toFixed(2));

  // 6. Electrolytes
  const sodiumMeqTotal = Number((sodiumMeqPerKgDay * w).toFixed(2));
  const potassiumMeqTotal = Number((potassiumMeqPerKgDay * w).toFixed(2));
  const calciumGluconateTotalMl = Number((calciumGluconateMlPerKgDay * w).toFixed(1));

  // 7. Caloric Balance
  // Dextrose: 3.4 kcal/g monohydrate
  // Amino Acids: 4.0 kcal/g
  // 20% Lipids: 2.0 kcal/mL (10 kcal/g)
  const dextroseCaloriesKcal = Number((dextroseGramsDay * 3.4).toFixed(1));
  const aminoAcidCaloriesKcal = Number((aminoAcidGramsDay * 4.0).toFixed(1));
  const lipidCaloriesKcal = Number((lipidVolumeMl * 2.0).toFixed(1));

  const totalCaloriesKcalDay = Number((dextroseCaloriesKcal + aminoAcidCaloriesKcal + lipidCaloriesKcal).toFixed(1));
  const caloriesPerKgDay = Number((totalCaloriesKcalDay / w).toFixed(1));

  // Nitrogen Balance: 1 g Nitrogen = 6.25 g Amino Acid
  const nitrogenGramsDay = Number((aminoAcidGramsDay / 6.25).toFixed(3));
  const nonProteinCaloriesKcal = dextroseCaloriesKcal + lipidCaloriesKcal;
  const nonProteinCalorieToNitrogenRatio =
    nitrogenGramsDay > 0 ? Number((nonProteinCaloriesKcal / nitrogenGramsDay).toFixed(1)) : 0;

  // 8. Total Osmolarity Calculation (mOsm/L of aqueous base)
  // Dextrose: ~50 mOsm per 1% per 1000 mL = dextrosePercent * 50 mOsm/L
  // Amino acid: ~10 mOsm per g/L = (aminoAcidGramsDay / (aqueousFluidMl / 1000)) * 10
  // Electrolytes: Na (2 mOsm/mEq), K (2 mOsm/mEq)
  const dextroseOsmContribution = dextrosePercent * 50;
  const aaGramsPerLiter = (aminoAcidGramsDay / (aqueousFluidMl / 1000));
  const aaOsmContribution = aaGramsPerLiter * 10;
  const electrolytesOsmContribution = ((sodiumMeqTotal + potassiumMeqTotal) * 2 / (aqueousFluidMl / 1000));

  const totalOsmolarityMOsmL = Math.round(dextroseOsmContribution + aaOsmContribution + electrolytesOsmContribution);

  const isCentralLineMandatory = totalOsmolarityMOsmL > 900 || dextrosePercent > 12.5;
  const recommendedRouteCategory = isCentralLineMandatory ? 'central_line_uvc_picc' : 'peripheral';

  let osmolarityAlert = `Calculated Osmolarity: ${totalOsmolarityMOsmL} mOsm/L. Safe for Peripheral IV (≤ 900 mOsm/L).`;
  if (isCentralLineMandatory) {
    osmolarityAlert = `HIGH OSMOLARITY (${totalOsmolarityMOsmL} mOsm/L > 900 mOsm/L or Dextrose > 12.5%): MANDATORY CENTRAL VASCULAR ACCESS (UVC or PICC) REQUIRED! Peripheral administration causes venous sclerosis and tissue extravasation necrosis.`;
  }

  let girAlert: string | undefined;
  if (glucoseInfusionRateGir < 4.0) {
    girAlert = `LOW GIR (${glucoseInfusionRateGir} mg/kg/min): Risk of neonatal hypoglycemia (Target: 4 - 8 mg/kg/min).`;
  } else if (glucoseInfusionRateGir > 12.0) {
    girAlert = `EXCESSIVE GIR (${glucoseInfusionRateGir} mg/kg/min > 12): Severe risk of osmotic diuresis, hyperglycemia, and hepatic steatosis.`;
  }

  let caloricAdequacyAlert = `Adequate nutrition: ${caloriesPerKgDay} kcal/kg/day (Target: 90 - 120 kcal/kg/day for ELBW/VLBW).`;
  if (caloriesPerKgDay < 60) {
    caloricAdequacyAlert = `Sub-caloric starter nutrition: ${caloriesPerKgDay} kcal/kg/day. Advance lipids and amino acids as tolerated.`;
  }

  const safetyRecommendations: string[] = [];
  if (isCentralLineMandatory) {
    safetyRecommendations.push('Verify UVC / PICC tip position on chest radiograph (T8-T9 / IVC junction) prior to initiating infusion.');
  }
  safetyRecommendations.push('Add 0.5 Units/mL Heparin to aqueous solution to maintain catheter patency.');
  safetyRecommendations.push('Protect lipid syringe and line from ambient phototherapy light using amber tubing/covers to prevent lipid hydroperoxides.');
  safetyRecommendations.push('Check bedside blood glucose at 2 hours and 4 hours post-commencement; maintain glucose between 50 - 150 mg/dL.');

  return {
    parenteralFluidMlDay: Number(parenteralFluidMlDay.toFixed(1)),
    infusionRateMlHr,
    dextroseGramsDay: Number(dextroseGramsDay.toFixed(1)),
    glucoseInfusionRateGir,
    dextroseVolumeMl: Number(dextroseVolumeMl.toFixed(1)),
    aminoAcidGramsDay: Number(aminoAcidGramsDay.toFixed(1)),
    aminoAcidVolumeMl,
    lipidGramsDay: Number(lipidGramsDay.toFixed(1)),
    lipidVolumeMl,
    lipidInfusionRateMlHr,
    sodiumMeqTotal,
    potassiumMeqTotal,
    calciumGluconateTotalMl,
    totalCaloriesKcalDay,
    caloriesPerKgDay,
    dextroseCaloriesKcal,
    aminoAcidCaloriesKcal,
    lipidCaloriesKcal,
    nitrogenGramsDay,
    nonProteinCaloriesKcal: Number(nonProteinCaloriesKcal.toFixed(1)),
    nonProteinCalorieToNitrogenRatio,
    totalOsmolarityMOsmL,
    recommendedRouteCategory,
    isCentralLineMandatory,
    osmolarityAlert,
    girAlert,
    caloricAdequacyAlert,
    safetyRecommendations,
  };
}
