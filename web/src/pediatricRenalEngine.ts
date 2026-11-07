// Pediatric & Neonatal Renal Surveillance, Peritoneal Dialysis & KDIGO AKI Staging Engine
// Reference: Modified Neonatal KDIGO (Jetton & Askenazi AWAKEN study), Bedside Schwartz eGFR (2009 update),
// Pediatric Fluid Overload (%FO) consensus, and Acute Peritoneal Dialysis ISPD Pediatric Guidelines.

export type PatientCategory =
  | 'preterm_infant'
  | 'term_infant'
  | 'child'
  | 'adolescent_female'
  | 'adolescent_male';

export interface SchwartzEgfrResult {
  egfr: number;
  kFactor: number;
  ckdStageDescription: string;
}

export interface FluidOverloadResult {
  fluidOverloadPct: number;
  severity: 'normal' | 'mild' | 'moderate_warning' | 'severe_critical';
  alertMessage: string;
  rrtIndicationSuggested: boolean;
}

export interface UrinaryIndicesResult {
  fenaPct?: number;
  feureaPct?: number;
  etiology: 'prerenal' | 'intrinsic_atn' | 'indeterminate';
  explanation: string;
}

export interface KdigoAkiResult {
  scrStage: 0 | 1 | 2 | 3;
  uopStage: 0 | 1 | 2 | 3;
  overallStage: 0 | 1 | 2 | 3;
  stageName: string;
  stageBadgeColor: 'green' | 'yellow' | 'orange' | 'red';
  stageDescription: string;
  clinicalActions: string[];
}

export interface PdCycleBalanceSummary {
  totalInflowMl: number;
  totalOutflowMl: number;
  netUfMl: number;
  averageNetUfPerCycleMl: number;
  cyclesCount: number;
  fluidRetentionAlert: boolean;
}

export interface PeritonitisSurveillanceResult {
  isPeritonitisSuspected: boolean;
  isPeritonitisConfirmed: boolean;
  severity: 'none' | 'warning' | 'critical';
  recommendations: string[];
}

export interface NephrotoxicAlert {
  drug: string;
  category: 'high_risk' | 'moderate_risk';
  warning: string;
  dosageGuidance: string;
}

/**
 * 1. Bedside Schwartz Formula for Pediatric & Neonatal eGFR
 * eGFR (mL/min/1.73m^2) = (k * Height in cm) / Serum Creatinine (mg/dL)
 */
export function calculateBedsideSchwartzEgfr(params: {
  heightCm: number;
  scrMgDl: number;
  patientCategory: PatientCategory;
}): SchwartzEgfrResult {
  const { heightCm, scrMgDl, patientCategory } = params;

  if (scrMgDl <= 0 || heightCm <= 0) {
    return { egfr: 0, kFactor: 0.413, ckdStageDescription: 'Invalid inputs' };
  }

  let k = 0.413; // Bedside Schwartz for children 1-16 years
  if (patientCategory === 'preterm_infant') {
    k = 0.33;
  } else if (patientCategory === 'term_infant') {
    k = 0.45;
  } else if (patientCategory === 'adolescent_female') {
    k = 0.55;
  } else if (patientCategory === 'adolescent_male') {
    k = 0.70;
  }

  const egfr = Math.round(((k * heightCm) / scrMgDl) * 10) / 10;

  let ckdStageDescription = 'Normal or high eGFR (≥ 90 mL/min/1.73m²)';
  if (egfr < 15) {
    ckdStageDescription = 'Kidney failure / Severe reduction (< 15 mL/min/1.73m²)';
  } else if (egfr < 30) {
    ckdStageDescription = 'Severe reduction (15 - 29 mL/min/1.73m²)';
  } else if (egfr < 60) {
    ckdStageDescription = 'Moderate reduction (30 - 59 mL/min/1.73m²)';
  } else if (egfr < 90) {
    ckdStageDescription = 'Mild reduction (60 - 89 mL/min/1.73m²)';
  }

  return { egfr, kFactor: k, ckdStageDescription };
}

/**
 * 2. Fluid Overload Percentage (%FO)
 * %FO = ((Current Weight - Dry/Admission Weight) / Dry Weight) * 100%
 */
export function calculateFluidOverload(params: {
  dryWeightKg: number;
  currentWeightKg: number;
}): FluidOverloadResult {
  const { dryWeightKg, currentWeightKg } = params;

  if (dryWeightKg <= 0) {
    return {
      fluidOverloadPct: 0,
      severity: 'normal',
      alertMessage: 'Invalid baseline dry weight',
      rrtIndicationSuggested: false,
    };
  }

  const foPct = Math.round((((currentWeightKg - dryWeightKg) / dryWeightKg) * 100) * 10) / 10;

  if (foPct >= 20.0) {
    return {
      fluidOverloadPct: foPct,
      severity: 'severe_critical',
      alertMessage: 'CRITICAL FLUID OVERLOAD (≥ 20%): Substantially elevated pediatric mortality hazard. Immediate RRT / Peritoneal Dialysis indicated.',
      rrtIndicationSuggested: true,
    };
  } else if (foPct >= 10.0) {
    return {
      fluidOverloadPct: foPct,
      severity: 'moderate_warning',
      alertMessage: 'SIGNIFICANT FLUID OVERLOAD (10 - 19.9%): Restrict fluids, challenge diuretics, and prepare for renal replacement therapy if refractory.',
      rrtIndicationSuggested: false,
    };
  } else if (foPct >= 5.0) {
    return {
      fluidOverloadPct: foPct,
      severity: 'mild',
      alertMessage: 'Mild fluid retention (5 - 9.9%): Maintain strict hourly fluid balance charting.',
      rrtIndicationSuggested: false,
    };
  } else {
    return {
      fluidOverloadPct: Math.max(0, foPct),
      severity: 'normal',
      alertMessage: 'Normal fluid homeostasis (< 5% fluid gain).',
      rrtIndicationSuggested: false,
    };
  }
}

/**
 * 3. Urinary Indices (FENa & FEUrea) for Prerenal vs Intrinsic Renal (ATN) Triage
 */
export function calculateUrinaryIndices(params: {
  serumNaMeqL?: number;
  urineNaMeqL?: number;
  serumCrMgDl?: number;
  urineCrMgDl?: number;
  serumBunMgDl?: number;
  urineUreaMgDl?: number;
  isNeonate: boolean;
}): UrinaryIndicesResult {
  const {
    serumNaMeqL,
    urineNaMeqL,
    serumCrMgDl,
    urineCrMgDl,
    serumBunMgDl,
    urineUreaMgDl,
    isNeonate,
  } = params;

  let fenaPct: number | undefined;
  let feureaPct: number | undefined;

  // FENa = (U_Na * S_Cr) / (S_Na * U_Cr) * 100
  if (
    serumNaMeqL &&
    urineNaMeqL !== undefined &&
    serumCrMgDl &&
    urineCrMgDl &&
    serumNaMeqL > 0 &&
    urineCrMgDl > 0
  ) {
    fenaPct = Math.round(((urineNaMeqL * serumCrMgDl) / (serumNaMeqL * urineCrMgDl)) * 1000) / 10;
  }

  // FEUrea = (U_Urea * S_Cr) / (S_BUN * U_Cr) * 100
  if (
    serumBunMgDl &&
    urineUreaMgDl !== undefined &&
    serumCrMgDl &&
    urineCrMgDl &&
    serumBunMgDl > 0 &&
    urineCrMgDl > 0
  ) {
    feureaPct = Math.round(((urineUreaMgDl * serumCrMgDl) / (serumBunMgDl * urineCrMgDl)) * 1000) / 10;
  }

  if (fenaPct === undefined && feureaPct === undefined) {
    return {
      etiology: 'indeterminate',
      explanation: 'Insufficient urinary or serum chemistry data provided for FENa / FEUrea calculation.',
    };
  }

  // Neonatal FENa threshold is higher (~2.5%) due to immature tubular sodium reabsorption.
  // Older pediatric cutoff is ~1.0%.
  const fenaThreshold = isNeonate ? 2.5 : 1.0;

  if (fenaPct !== undefined) {
    if (fenaPct < fenaThreshold) {
      return {
        fenaPct,
        feureaPct,
        etiology: 'prerenal',
        explanation: `FENa is ${fenaPct}% (< ${fenaThreshold}%), indicating preserved tubular reabsorption typical of Prerenal Azotemia / Dehydration. Fluid volume repletion recommended.`,
      };
    } else {
      return {
        fenaPct,
        feureaPct,
        etiology: 'intrinsic_atn',
        explanation: `FENa is ${fenaPct}% (≥ ${fenaThreshold}%), indicating impaired tubular sodium conservation diagnostic of Intrinsic Acute Tubular Necrosis (ATN). Avoid fluid overload.`,
      };
    }
  }

  if (feureaPct !== undefined) {
    if (feureaPct < 35.0) {
      return {
        feureaPct,
        etiology: 'prerenal',
        explanation: `FEUrea is ${feureaPct}% (< 35%), suggesting Prerenal etiology (unaffected by diuretic therapy).`,
      };
    } else {
      return {
        feureaPct,
        etiology: 'intrinsic_atn',
        explanation: `FEUrea is ${feureaPct}% (≥ 35%), pointing to Intrinsic Renal injury / ATN.`,
      };
    }
  }

  return {
    fenaPct,
    feureaPct,
    etiology: 'indeterminate',
    explanation: 'Urinary indices are borderline or discordant.',
  };
}

/**
 * 4. Modified Neonatal / Pediatric KDIGO AKI Staging (AWAKEN Consensus)
 */
export function determineKdigoAkiStage(params: {
  baselineScr: number;
  currentScr: number;
  uopMlKgH?: number;
  uopDurationHours?: number;
  onRrt?: boolean;
  isNeonate: boolean;
}): KdigoAkiResult {
  const { baselineScr, currentScr, uopMlKgH, uopDurationHours = 6, onRrt = false, isNeonate } = params;

  // Creatinine Staging
  let scrStage: 0 | 1 | 2 | 3 = 0;
  const scrRatio = baselineScr > 0 ? currentScr / baselineScr : 1.0;
  const scrDelta = currentScr - baselineScr;

  if (onRrt || (isNeonate && currentScr >= 2.5) || scrRatio >= 3.0) {
    scrStage = 3;
  } else if (scrRatio >= 2.0) {
    scrStage = 2;
  } else if (scrDelta >= 0.3 || scrRatio >= 1.5) {
    scrStage = 1;
  }

  // Urine Output Staging
  let uopStage: 0 | 1 | 2 | 3 = 0;
  if (uopMlKgH !== undefined) {
    // Neonatal vs Pediatric UOP cutoffs
    if (uopMlKgH < 0.3 && uopDurationHours >= 24) {
      uopStage = 3;
    } else if (uopMlKgH === 0 && uopDurationHours >= 12) {
      uopStage = 3; // Anuria for >= 12 hours
    } else if (uopMlKgH < 0.5 && uopDurationHours >= 12) {
      uopStage = 2;
    } else if (isNeonate ? (uopMlKgH < 1.0 && uopDurationHours >= 6) : (uopMlKgH < 0.5 && uopDurationHours >= 6)) {
      uopStage = 1;
    }
  }

  const overallStage = Math.max(scrStage, uopStage, onRrt ? 3 : 0) as 0 | 1 | 2 | 3;

  let stageName = 'No AKI (Stage 0)';
  let stageBadgeColor: 'green' | 'yellow' | 'orange' | 'red' = 'green';
  let stageDescription = 'Serum creatinine and urine output within expected baseline limits.';
  const clinicalActions: string[] = [];

  switch (overallStage) {
    case 1:
      stageName = 'KDIGO Stage 1 AKI (Mild)';
      stageBadgeColor = 'yellow';
      stageDescription = `SCr elevation ≥ 0.3 mg/dL or 1.5-1.9x baseline; UOP < ${isNeonate ? '1.0' : '0.5'} mL/kg/h for >6h.`;
      clinicalActions.push(
        'Discontinue non-essential nephrotoxic medications (NSAIDs, aminoglycosides, ACEi).',
        'Review intravascular fluid status; optimize renal perfusion.',
        'Obtain baseline electrolytes, urea, creatinine, and urine chemistry (FENa/FEUrea).',
        'Place urinary catheter or weigh diapers hourly for strict UOP surveillance.'
      );
      break;
    case 2:
      stageName = 'KDIGO Stage 2 AKI (Moderate)';
      stageBadgeColor = 'orange';
      stageDescription = 'SCr 2.0-2.9x baseline; UOP < 0.5 mL/kg/h for ≥ 12h.';
      clinicalActions.push(
        'Adjust all antimicrobial dosages to calculated Bedside Schwartz eGFR.',
        'Restrict maintenance fluids to insensible losses + urine output to prevent %FO.',
        'Continuous cardiac monitoring for hyperkalemic changes (peaked T waves, QRS widening).',
        'Alert Pediatric Nephrology / SNCU Consultant for Peritoneal Dialysis standby.'
      );
      break;
    case 3:
      stageName = 'KDIGO Stage 3 AKI (Severe / Failure)';
      stageBadgeColor = 'red';
      stageDescription = `SCr ≥ 3.0x baseline, SCr ≥ 2.5 mg/dL, anuria ≥ 12h, or initiation of Renal Replacement Therapy.`;
      clinicalActions.push(
        'IMMEDIATE RENAL REPLACEMENT THERAPY EVALUATION: Prepare for Acute Peritoneal Dialysis.',
        'Treat life-threatening hyperkalemia (Calcium Gluconate 10%, Insulin-Dextrose, Salbutamol nebulization).',
        'Strict fluid restriction to insensible water losses only (300-400 mL/m²/day).',
        'Insert acute PD catheter with surgical / pediatric aseptic technique.'
      );
      break;
    default:
      clinicalActions.push(
        'Maintain routine pediatric fluid balance and surveillance.',
        'Monitor serial creatinine if receiving known nephrotoxic pharmacotherapy.'
      );
  }

  return {
    scrStage,
    uopStage,
    overallStage,
    stageName,
    stageBadgeColor,
    stageDescription,
    clinicalActions,
  };
}

/**
 * 5. Acute Peritoneal Dialysis (PD) Serial Cycle Flowsheet Balance Tracker
 */
export function calculatePdCycleBalance(
  cycles: Array<{ inflowMl: number; outflowMl: number }>
): PdCycleBalanceSummary {
  let totalInflowMl = 0;
  let totalOutflowMl = 0;

  for (const c of cycles) {
    totalInflowMl += Number(c.inflowMl || 0);
    totalOutflowMl += Number(c.outflowMl || 0);
  }

  const netUfMl = totalOutflowMl - totalInflowMl;
  const cyclesCount = cycles.length;
  const averageNetUfPerCycleMl =
    cyclesCount > 0 ? Math.round((netUfMl / cyclesCount) * 10) / 10 : 0;

  // Fluid retention alert if cumulative net UF is negative and total cycles >= 3
  const fluidRetentionAlert = cyclesCount >= 3 && netUfMl < 0;

  return {
    totalInflowMl,
    totalOutflowMl,
    netUfMl,
    averageNetUfPerCycleMl,
    cyclesCount,
    fluidRetentionAlert,
  };
}

/**
 * 6. Peritoneal Effluent & Peritonitis Surveillance
 * Criteria: Cloudy effluent AND (PD fluid WBC > 100/mcL with > 50% PMN/Neutrophils)
 */
export function evaluatePeritonitisRisk(effluent: {
  appearance: string;
  wbcCountPerMcl?: number;
  neutrophilsPercent?: number;
}): PeritonitisSurveillanceResult {
  const { appearance, wbcCountPerMcl = 0, neutrophilsPercent = 0 } = effluent;

  const isCloudy = appearance === 'cloudy_turbid' || appearance === 'fibrin_clots';
  const isCellCountDiagnostic = wbcCountPerMcl > 100 && neutrophilsPercent > 50;

  if (isCellCountDiagnostic) {
    return {
      isPeritonitisSuspected: true,
      isPeritonitisConfirmed: true,
      severity: 'critical',
      recommendations: [
        'PERITONITIS CONFIRMED: Effluent WBC > 100/µL with > 50% neutrophils.',
        'Send PD effluent immediately for urgent Gram stain, bacterial culture, and fungal smear.',
        'Initiate empiric intraperitoneal (IP) dual-coverage antibiotic therapy (e.g. Cefazolin/Vancomycin + Ceftazidime/Amikacin).',
        'Add Heparin 500 U/L to each PD exchange to prevent catheter occlusion by fibrin.',
        'Re-evaluate effluent cell count at 48-72 hours to ensure therapeutic response.'
      ],
    };
  } else if (isCloudy) {
    return {
      isPeritonitisSuspected: true,
      isPeritonitisConfirmed: false,
      severity: 'warning',
      recommendations: [
        'PERITONITIS SUSPECTED: Cloudy/turbid dialysate effluent observed.',
        'Collect 50 mL effluent for urgent cell count, differential, and microbiological culture before starting antibiotics.',
        'Inspect abdominal wall and exit site for erythema, tunnel swelling, or discharge.',
        'Consider empiric intraperitoneal antibiotics if clinical signs of acute peritonitis are present.'
      ],
    };
  }

  return {
    isPeritonitisSuspected: false,
    isPeritonitisConfirmed: false,
    severity: 'none',
    recommendations: [
      'Dialysate effluent is clear. Continue routine aseptic exchange protocols.',
      'Maintain standard catheter exit site dressing changes.'
    ],
  };
}

/**
 * 7. Nephrotoxic Drug Exposure Surveillance (NINJA Protocol)
 */
const HIGH_RISK_NEPHROTOXICS: Record<string, { category: 'high_risk' | 'moderate_risk'; warning: string; dosageGuidance: string }> = {
  Amikacin: {
    category: 'high_risk',
    warning: 'Aminoglycoside: High risk of proximal tubular necrosis and ototoxicity.',
    dosageGuidance: 'Adjust dose interval based on eGFR; monitor trough concentration prior to 3rd dose.',
  },
  Gentamicin: {
    category: 'high_risk',
    warning: 'Aminoglycoside: Concentrates in renal cortex, direct tubular toxicity.',
    dosageGuidance: 'Extend dosing interval (e.g. q36h or q48h if eGFR < 50); target trough < 1.0 mcg/mL.',
  },
  Vancomycin: {
    category: 'high_risk',
    warning: 'Glycopeptide: Synergistic nephrotoxicity when combined with aminoglycosides.',
    dosageGuidance: 'Reduce maintenance dose by 50% for Stage 2-3 AKI; maintain AUC/MIC 400-600.',
  },
  Indomethacin: {
    category: 'high_risk',
    warning: 'Potent non-selective NSAID (used for PDA): Severe afferent arteriolar vasoconstriction and oliguria.',
    dosageGuidance: 'Hold indomethacin if UOP < 0.6 mL/kg/h or SCr > 1.8 mg/dL; consider oral Ibuprofen alternative.',
  },
  Ibuprofen: {
    category: 'moderate_risk',
    warning: 'NSAID: Reduces renal blood flow by inhibiting renal prostaglandin synthesis.',
    dosageGuidance: 'Hold during acute dehydration or KDIGO Stage 2-3 AKI.',
  },
  Colistin: {
    category: 'high_risk',
    warning: 'Polymyxin: Direct dose-dependent membrane disruption of tubular epithelium.',
    dosageGuidance: 'Renally adjust loading and maintenance dose according to Schwartz eGFR.',
  },
  AmphotericinB: {
    category: 'high_risk',
    warning: 'Polyene antifungal: Renal vasoconstriction, tubular acidosis, and severe hypokalemia.',
    dosageGuidance: 'Hydrate with normal saline pre-infusion; substitute Liposomal Amphotericin B.',
  },
};

export function evaluateNephrotoxicMedications(
  medications: string[],
  kdigoStage: number,
  egfr: number
): NephrotoxicAlert[] {
  const alerts: NephrotoxicAlert[] = [];

  for (const med of medications) {
    const matched = Object.keys(HIGH_RISK_NEPHROTOXICS).find(
      k => k.toLowerCase() === med.trim().toLowerCase()
    );
    if (matched) {
      const info = HIGH_RISK_NEPHROTOXICS[matched];
      if (info) {
        alerts.push({
          drug: matched,
          category: info.category,
          warning: info.warning,
          dosageGuidance: info.dosageGuidance,
        });
      }
    }
  }

  return alerts;
}
