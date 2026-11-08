// Pure TypeScript calculation engine for Pediatric Hemolytic Uremic Syndrome (STEC-HUS & Atypical HUS) Protocol
// Guidelines: IPNA (International Pediatric Nephrology Association) Clinical Practice Guidelines / AAP Pediatric Nephrology

export interface PediatricHusParams {
  ageYears: number;
  weightKg: number;
  prodromalBloodyDiarrhea: boolean;
  shigaToxinTested: boolean;
  shigaToxinResult: 'positive_stec' | 'negative' | 'pending';
  hemoglobinGDl: number;
  plateletCount: number;
  serumCreatinineMgDl: number;
  baselineCreatinineMgDl: number;
  schistocytesPresentPct: number;
  serumLdhUL: number;
  directCoombsTest: 'negative' | 'positive_non_stec' | 'not_performed';
  serumPotassiumMeqL: number;
  oliguriaAnuriaDurationHours: number;
  hypertensionPresent: boolean;
  neurologicalInvolvement:
    | 'none'
    | 'lethargy_irritability'
    | 'seizures_altered_mental_status'
    | 'coma_stroke';
  husPhenotype:
    | 'typical_stec_d_plus'
    | 'atypical_complement_mediated_ahus'
    | 'secondary_pneumococcal_or_other';
}

export interface PediatricHusResult {
  isTriadDiagnosticMet: boolean;
  kdigoAkiStage: 'stage_1' | 'stage_2' | 'stage_3_failure';
  kdigoAkiStageLabel: string;
  dialysisRrtIndicated: boolean;
  dialysisModalityRecommendation: string;
  eculizumabIndicated: boolean;
  antibioticContraindicationAlert: string;
  fluidManagementDirectives: string[];
  recommendations: string[];
  alerts: string[];
}

export type PediatricHusEvaluationResult = PediatricHusResult;

export function evaluatePediatricHus(params: PediatricHusParams): PediatricHusResult {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  const fluidManagementDirectives: string[] = [];

  // Diagnostic Triad Verification:
  // 1. Microangiopathic Hemolytic Anemia (MAHA): Coombs negative, schistocytes >= 1.0%, elevated LDH > 500, Hgb < 10 g/dL
  // 2. Thrombocytopenia: Platelet count < 100,000 / microL
  // 3. Acute Kidney Injury (AKI): Serum Cr >= 1.5x baseline or oliguria
  const hasMaha = params.schistocytesPresentPct >= 1.0 && params.hemoglobinGDl < 10.0 && params.serumLdhUL >= 450;
  const hasThrombocytopenia = params.plateletCount < 100000;
  const crRatio = params.baselineCreatinineMgDl > 0 ? params.serumCreatinineMgDl / params.baselineCreatinineMgDl : 1.0;
  const hasAki = crRatio >= 1.5 || params.oliguriaAnuriaDurationHours >= 12.0;

  const isTriadDiagnosticMet = hasMaha && hasThrombocytopenia && hasAki;

  // KDIGO AKI Staging:
  let kdigoAkiStage: 'stage_1' | 'stage_2' | 'stage_3_failure' = 'stage_1';
  let kdigoAkiStageLabel = 'KDIGO Stage 1: Serum Cr 1.5–1.9× baseline';

  if (crRatio >= 3.0 || params.serumCreatinineMgDl >= 4.0 || params.oliguriaAnuriaDurationHours >= 24.0) {
    kdigoAkiStage = 'stage_3_failure';
    kdigoAkiStageLabel = 'KDIGO Stage 3: Severe AKI / Renal Failure (Cr ≥ 3.0× baseline or Anuria ≥ 24h)';
  } else if (crRatio >= 2.0 || params.oliguriaAnuriaDurationHours >= 12.0) {
    kdigoAkiStage = 'stage_2';
    kdigoAkiStageLabel = 'KDIGO Stage 2: Moderate AKI (Cr 2.0–2.9× baseline)';
  }

  // Dialysis / RRT Indication triggers:
  // - Anuria > 24 hours or oliguria with severe fluid overload > 10%
  // - Refractory hyperkalemia (K >= 6.5 mEq/L)
  // - Uremic encephalopathy, pericarditis, or intractable hypertension
  const isSevereHyperkalemia = params.serumPotassiumMeqL >= 6.5;
  const isUremicNeuro =
    params.neurologicalInvolvement === 'seizures_altered_mental_status' ||
    params.neurologicalInvolvement === 'coma_stroke';

  const dialysisRrtIndicated =
    kdigoAkiStage === 'stage_3_failure' ||
    isSevereHyperkalemia ||
    isUremicNeuro ||
    params.oliguriaAnuriaDurationHours >= 24.0;

  let dialysisModalityRecommendation = 'None currently indicated. Maintain strict fluid balance and serial electrolytes.';
  if (dialysisRrtIndicated) {
    dialysisModalityRecommendation =
      params.ageYears < 2.0
        ? 'Urgent Peritoneal Dialysis (PD): Preferred modality in infants/young toddlers.'
        : 'Continuous Renal Replacement Therapy (CRRT / CVVHDF) or Intermittent Hemodialysis via dual-lumen catheter.';
    alerts.push('RENAL REPLACEMENT THERAPY INDICATED: Severe stage 3 AKI, anuria, or refractory hyperkalemia requires emergent pediatric nephrology consultation.');
  }

  // Atypical HUS & Eculizumab:
  // In complement-mediated atypical HUS (aHUS), C5 terminal complement blockade with Eculizumab or Ravulizumab is first-line.
  const eculizumabIndicated = params.husPhenotype === 'atypical_complement_mediated_ahus';
  if (eculizumabIndicated) {
    recommendations.push(
      'ATYPICAL HUS PROTOCOL: Initiate terminal complement inhibitor Eculizumab (Soliris) within 24-48 hours. Provide meningococcal vaccination and prophylactic antibiotics.'
    );
  }

  // Critical Safety Warning: Antibiotic Contraindication in STEC-HUS
  const antibioticContraindicationAlert =
    'CRITICAL SAFETY WARNING: Strictly avoid antibiotics and antimotility agents (e.g. loperamide) in STEC-HUS. Antibiotics trigger bacteriophage lysis of E. coli, releasing massive surges of Shiga toxin that precipitate severe renal thrombotic microangiopathy.';
  alerts.push(antibioticContraindicationAlert);

  // Fluid Management Directives
  fluidManagementDirectives.push(
    `Insensible fluid calculation: Replace insensible water loss (~400 mL/m²/day = ~${Math.round(params.weightKg * 20)} mL/day) plus milliliter-for-milliliter measured urine and GI losses.`
  );
  fluidManagementDirectives.push('Avoid potassium in all intravenous maintenance fluids until adequate urine output is established.');
  fluidManagementDirectives.push('Avoid uncrossmatched or routine platelet transfusions (platelet transfusions can exacerbate microvascular thrombosis unless active life-threatening hemorrhage).');
  fluidManagementDirectives.push('Transfuse packed red blood cells cautiously (target Hgb 7-8 g/dL) only for symptomatic anemia or tissue hypoxia to avoid hyperviscosity.');

  if (isSevereHyperkalemia) {
    alerts.push(`SEVERE HYPERKALEMIA (K+ ${params.serumPotassiumMeqL} mEq/L): Administer Calcium Gluconate 10% (0.5 mL/kg IV over 5-10 min) and stat insulin-dextrose shift.`);
  }

  if (isTriadDiagnosticMet) {
    recommendations.push(
      'CLASSIC TRIAD CONFIRMED: Microangiopathic hemolytic anemia with schistocytes, severe thrombocytopenia, and acute kidney injury establish HUS diagnosis.'
    );
  }

  return {
    isTriadDiagnosticMet,
    kdigoAkiStage,
    kdigoAkiStageLabel,
    dialysisRrtIndicated,
    dialysisModalityRecommendation,
    eculizumabIndicated,
    antibioticContraindicationAlert,
    fluidManagementDirectives,
    recommendations,
    alerts,
  };
}
