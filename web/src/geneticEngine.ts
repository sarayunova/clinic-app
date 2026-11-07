/**
 * Antenatal Genetic Screening & Aneuploidy Risk Calculation Engine
 * References:
 * - Fetal Medicine Foundation (FMF) First Trimester Combined Screening
 * - ACOG Practice Bulletin No. 226: Screening for Fetal Chromosomal Abnormalities
 * - Society for Maternal-Fetal Medicine (SMFM) Consult Series #57
 * - Nicolaides KH et al., Screening for fetal aneuploidies at 11 to 13 weeks.
 */

export interface MaternalBackgroundRisk {
  maternalAge: number;
  t21Ratio: string;
  t21Odds: number; // e.g. 1/900 = 0.00111
  t18Ratio: string;
  t18Odds: number;
  t13Ratio: string;
  t13Odds: number;
}

export interface FirstTrimesterScreeningInput {
  maternalAge: number;
  gestationalAgeWeeks: number;
  gestationalAgeDays?: number;
  crlMm: number; // 45 to 84 mm
  ntMeasuredMm: number;
  nasalBone?: 'present' | 'absent' | 'hypoplastic' | 'not_visualized';
  tricuspidRegurgitation?: 'normal' | 'regurgitant' | 'not_performed';
  ductusVenosus?: 'positive' | 'reversed' | 'not_performed';
  freeBetaHcgMom?: number; // MoM, median 1.0
  pappAMom?: number; // MoM, median 1.0
  maternalWeightKg?: number;
  diabetesStatus?: boolean;
  smoker?: boolean;
  ivfPregnancy?: boolean;
}

export interface QuadrupleScreeningInput {
  maternalAge: number;
  gestationalAgeWeeks: number;
  gestationalAgeDays?: number;
  afpMom: number;
  totalHcgMom: number;
  ue3Mom: number;
  inhibinAMom: number;
}

export interface GeneticRiskResult {
  screeningType: 'first_trimester_combined' | 'quadruple_marker' | 'nipt_cfdna' | 'invasive_diagnostic';
  backgroundT21Ratio: string;
  backgroundT21Numeric: number;
  adjustedT21Ratio: string;
  adjustedT21Numeric: number;
  adjustedT18Ratio: string;
  adjustedT18Numeric: number;
  adjustedT13Ratio: string;
  adjustedT13Numeric: number;
  ontdRiskStatus?: 'low_risk' | 'high_risk' | 'not_applicable';
  overallRiskTier: 'low_risk' | 'intermediate_risk' | 'high_risk' | 'inconclusive';
  ntExpectedMedianMm?: number;
  ntDeltaMm?: number;
  likelihoodRatios?: {
    nt: number;
    nasalBone: number;
    tricuspidRegurgitation: number;
    ductusVenosus: number;
    serumCombined: number;
    totalCombinedLr: number;
  };
  clinicalRecommendation: string;
}

/** Formats a decimal risk into conventional ratio notation: e.g. 1:450 */
export function formatOddsRatio(probability: number): string {
  if (probability <= 0) return '1:>50000';
  if (probability >= 1) return '1:1';
  const denominator = Math.round(1 / probability);
  if (denominator >= 50000) return '1:>50000';
  return `1:${denominator}`;
}

const FMF_AGE_ANCHORS: [number, number][] = [
  [15, 1600],
  [20, 1527],
  [25, 1352],
  [30, 895],
  [35, 356],
  [38, 167],
  [40, 97],
  [42, 55],
  [45, 23],
  [50, 6],
];

/** Computes maternal age-specific baseline background risk for Trisomy 21, 18, and 13 */
export function calculateMaternalBackgroundRisk(maternalAge: number): MaternalBackgroundRisk {
  const age = Math.min(50, Math.max(15, maternalAge));

  let denominator = 1527;
  const first = FMF_AGE_ANCHORS[0] ?? [15, 1600];
  const last = FMF_AGE_ANCHORS[FMF_AGE_ANCHORS.length - 1] ?? [50, 6];

  if (age <= first[0]) {
    denominator = first[1];
  } else if (age >= last[0]) {
    denominator = last[1];
  } else {
    for (let i = 0; i < FMF_AGE_ANCHORS.length - 1; i++) {
      const cur = FMF_AGE_ANCHORS[i];
      const next = FMF_AGE_ANCHORS[i + 1];
      if (cur && next) {
        const [a1, d1] = cur;
        const [a2, d2] = next;
        if (age >= a1 && age <= a2) {
          const factor = (age - a1) / (a2 - a1);
          denominator = Math.round(d1 + factor * (d2 - d1));
          break;
        }
      }
    }
  }

  const t21Odds = 1 / denominator;
  // Trisomy 18 is approximately 1/3.3 of T21 incidence
  const t18Odds = t21Odds / 3.3;
  // Trisomy 13 is approximately 1/8.5 of T21 incidence
  const t13Odds = t21Odds / 8.5;

  return {
    maternalAge: age,
    t21Ratio: formatOddsRatio(t21Odds),
    t21Odds,
    t18Ratio: formatOddsRatio(t18Odds),
    t18Odds,
    t13Ratio: formatOddsRatio(t13Odds),
    t13Odds,
  };
}

/** Calculates expected median NT (in mm) for fetal CRL between 45 and 84 mm (Robinson/Nicolaides BMJ/Lancet model) */
export function calculateExpectedMedianNt(crlMm: number): number {
  const crl = Math.min(84, Math.max(45, crlMm));
  // log10(median NT) = -0.3599 + 0.0127 * CRL - 0.000058 * (CRL^2)
  const log10Median = -0.3599 + 0.0127 * crl - 0.000058 * crl * crl;
  const median = Math.pow(10, log10Median);
  return Number(Math.max(1.0, median).toFixed(2));
}

/** Evaluates First Trimester Combined Screening Risk (NT + Nasal Bone + TR + DV + Free beta-hCG + PAPP-A) */
export function calculateFirstTrimesterCombinedRisk(input: FirstTrimesterScreeningInput): GeneticRiskResult {
  const background = calculateMaternalBackgroundRisk(input.maternalAge);
  const expectedNt = calculateExpectedMedianNt(input.crlMm);
  const deltaNt = Number((input.ntMeasuredMm - expectedNt).toFixed(2));

  // 1. NT Likelihood Ratio (LR)
  let ntLr = 1.0;
  if (input.ntMeasuredMm >= 3.5) {
    ntLr = 26.0; // Markedly elevated NT is an ominous independent marker
  } else if (input.ntMeasuredMm >= 3.0) {
    ntLr = 8.5;
  } else if (input.ntMeasuredMm >= 2.5) {
    ntLr = 3.2;
  } else if (input.ntMeasuredMm >= 2.0) {
    ntLr = 1.4;
  } else if (deltaNt < -0.2) {
    ntLr = 0.55; // Thin NT is reassuring
  } else {
    ntLr = 0.85;
  }

  // 2. Nasal Bone Likelihood Ratio
  let nbLr = 1.0;
  if (input.nasalBone === 'absent' || input.nasalBone === 'hypoplastic') {
    nbLr = 25.0; // Absent nasal bone gives ~25-fold risk increase for T21
  } else if (input.nasalBone === 'present') {
    nbLr = 0.34; // Present nasal bone reduces T21 risk by ~3-fold
  }

  // 3. Tricuspid Regurgitation LR
  let trLr = 1.0;
  if (input.tricuspidRegurgitation === 'regurgitant') {
    trLr = 14.0;
  } else if (input.tricuspidRegurgitation === 'normal') {
    trLr = 0.65;
  }

  // 4. Ductus Venosus LR
  let dvLr = 1.0;
  if (input.ductusVenosus === 'reversed') {
    trLr = 12.0;
  } else if (input.ductusVenosus === 'positive') {
    dvLr = 0.70;
  }

  // 5. Serum Biochemistry LR (Free beta-hCG and PAPP-A MoMs)
  // In T21: high Free beta-hCG (median ~2.0 MoM) and low PAPP-A (median ~0.5 MoM)
  // In T18/T13: markedly reduced Free beta-hCG (<0.3 MoM) and PAPP-A (<0.3 MoM)
  let serumT21Lr = 1.0;
  let serumT18Lr = 1.0;
  let serumT13Lr = 1.0;

  const hcgMom = input.freeBetaHcgMom ?? 1.0;
  const pappaMom = input.pappAMom ?? 1.0;

  if (input.freeBetaHcgMom != null || input.pappAMom != null) {
    // T21 serum multiplier
    let hcgFactorT21 = 1.0;
    if (hcgMom >= 2.0) hcgFactorT21 = 1.8 + (hcgMom - 2.0) * 0.5;
    else if (hcgMom <= 0.6) hcgFactorT21 = 0.45;

    let pappaFactorT21 = 1.0;
    if (pappaMom <= 0.4) pappaFactorT21 = 3.2;
    else if (pappaMom <= 0.6) pappaFactorT21 = 1.9;
    else if (pappaMom >= 1.5) pappaFactorT21 = 0.4;

    serumT21Lr = hcgFactorT21 * pappaFactorT21;

    // T18 & T13: both markers are severely depressed
    if (hcgMom <= 0.4 && pappaMom <= 0.4) {
      serumT18Lr = 18.0;
      serumT13Lr = 12.0;
    } else if (hcgMom <= 0.6 && pappaMom <= 0.6) {
      serumT18Lr = 5.0;
      serumT13Lr = 4.0;
    } else {
      serumT18Lr = 0.8;
      serumT13Lr = 0.8;
    }
  }

  const ultrasoundLr = ntLr * nbLr * trLr * dvLr;
  const totalCombinedT21Lr = ultrasoundLr * serumT21Lr;

  // Calculate adjusted risks
  const adjustedT21Numeric = Math.min(0.99, background.t21Odds * totalCombinedT21Lr);
  const adjustedT18Numeric = Math.min(0.99, background.t18Odds * (ntLr * 0.8) * serumT18Lr);
  const adjustedT13Numeric = Math.min(0.99, background.t13Odds * (ntLr * 0.8) * serumT13Lr);

  // Overall Risk Classification
  // Cutoffs: High Risk >= 1:250 (0.004) OR NT >= 3.5 mm
  // Intermediate Risk: 1:251 to 1:1000 (0.001 to 0.00399)
  // Low Risk: < 1:1000 (< 0.001)
  let overallRiskTier: 'low_risk' | 'intermediate_risk' | 'high_risk' = 'low_risk';

  if (input.ntMeasuredMm >= 3.5 || adjustedT21Numeric >= 0.004 || adjustedT18Numeric >= 0.01 || adjustedT13Numeric >= 0.01) {
    overallRiskTier = 'high_risk';
  } else if (adjustedT21Numeric >= 0.001 || adjustedT18Numeric >= 0.001 || adjustedT13Numeric >= 0.001) {
    overallRiskTier = 'intermediate_risk';
  } else {
    overallRiskTier = 'low_risk';
  }

  // Clinical Recommendations based on ACOG / SMFM / FMF standards
  let clinicalRecommendation = '';
  if (overallRiskTier === 'high_risk') {
    if (input.ntMeasuredMm >= 3.5) {
      clinicalRecommendation =
        'HIGH RISK: Markedly enlarged nuchal translucency (≥ 3.5 mm). Offer urgent pre-test genetic counseling and diagnostic invasive testing (CVS or Amniocentesis with Chromosomal Microarray & QF-PCR). Regardless of genetic outcome, arrange specialized fetal echocardiography at 20–22 weeks and genetic workup for Noonan syndrome.';
    } else {
      clinicalRecommendation =
        `HIGH RISK (Adjusted Down syndrome risk ${formatOddsRatio(adjustedT21Numeric)}): Pre-test genetic counseling strongly advised. Offer diagnostic prenatal testing via Chorionic Villus Sampling (11–14w) or Amniocentesis (15–20w) with Chromosomal Microarray (CMA) and rapid QF-PCR. Cell-free DNA (NIPT) is an alternative secondary option if patient declines invasive testing.`;
    }
  } else if (overallRiskTier === 'intermediate_risk') {
    clinicalRecommendation =
      `INTERMEDIATE RISK (Adjusted risk ${formatOddsRatio(adjustedT21Numeric)}): Provide pre-test counseling. Recommend Cell-Free Fetal DNA (cfDNA / NIPT) as a highly sensitive secondary screening modality, or detailed second-trimester targeted genetic sonogram (Level-II) at 18–20 weeks.`;
  } else {
    clinicalRecommendation =
      `LOW RISK (Adjusted Down syndrome risk ${formatOddsRatio(adjustedT21Numeric)}): Reassuring first trimester screening. Reassure the patient and proceed with routine antenatal care. Schedule Level-II targeted anomaly ultrasound scan (TIFFA) at 18–20 weeks.`;
  }

  return {
    screeningType: 'first_trimester_combined',
    backgroundT21Ratio: background.t21Ratio,
    backgroundT21Numeric: background.t21Odds,
    adjustedT21Ratio: formatOddsRatio(adjustedT21Numeric),
    adjustedT21Numeric,
    adjustedT18Ratio: formatOddsRatio(adjustedT18Numeric),
    adjustedT18Numeric,
    adjustedT13Ratio: formatOddsRatio(adjustedT13Numeric),
    adjustedT13Numeric,
    ontdRiskStatus: 'not_applicable',
    overallRiskTier,
    ntExpectedMedianMm: expectedNt,
    ntDeltaMm: deltaNt,
    likelihoodRatios: {
      nt: Number(ntLr.toFixed(2)),
      nasalBone: Number(nbLr.toFixed(2)),
      tricuspidRegurgitation: Number(trLr.toFixed(2)),
      ductusVenosus: Number(dvLr.toFixed(2)),
      serumCombined: Number(serumT21Lr.toFixed(2)),
      totalCombinedLr: Number(totalCombinedT21Lr.toFixed(2)),
    },
    clinicalRecommendation,
  };
}

/** Evaluates Second Trimester Quadruple Marker Risk (AFP + Total hCG + uE3 + Inhibin-A) */
export function calculateQuadrupleRisk(input: QuadrupleScreeningInput): GeneticRiskResult {
  const background = calculateMaternalBackgroundRisk(input.maternalAge);

  // Neural Tube Defect Risk: AFP >= 2.5 MoM is the standard threshold
  const ontdHighRisk = input.afpMom >= 2.5;
  const ontdRiskStatus = ontdHighRisk ? 'high_risk' : 'low_risk';

  // Trisomy 21 Quad Pattern: Low AFP, High hCG, Low uE3, High Inhibin-A
  let t21Multiplier = 1.0;
  if (input.afpMom <= 0.6) t21Multiplier *= 1.8;
  if (input.totalHcgMom >= 2.0) t21Multiplier *= 2.2;
  if (input.ue3Mom <= 0.6) t21Multiplier *= 1.9;
  if (input.inhibinAMom >= 2.0) t21Multiplier *= 2.1;

  if (input.afpMom >= 1.2 && input.totalHcgMom <= 0.8 && input.ue3Mom >= 1.0 && input.inhibinAMom <= 0.8) {
    t21Multiplier = 0.35; // All markers normal / protective
  }

  // Trisomy 18 Quad Pattern: Low AFP, Low hCG, Low uE3
  let t18Multiplier = 1.0;
  if (input.afpMom <= 0.5 && input.totalHcgMom <= 0.5 && input.ue3Mom <= 0.5) {
    t18Multiplier = 15.0;
  } else {
    t18Multiplier = 0.7;
  }

  const adjustedT21Numeric = Math.min(0.99, background.t21Odds * t21Multiplier);
  const adjustedT18Numeric = Math.min(0.99, background.t18Odds * t18Multiplier);
  const adjustedT13Numeric = Math.min(0.99, background.t13Odds * 0.9);

  let overallRiskTier: 'low_risk' | 'intermediate_risk' | 'high_risk' = 'low_risk';
  if (ontdHighRisk || adjustedT21Numeric >= 0.004 || adjustedT18Numeric >= 0.01) {
    overallRiskTier = 'high_risk';
  } else if (adjustedT21Numeric >= 0.001) {
    overallRiskTier = 'intermediate_risk';
  } else {
    overallRiskTier = 'low_risk';
  }

  let clinicalRecommendation = '';
  if (ontdHighRisk) {
    clinicalRecommendation =
      `HIGH RISK FOR OPEN NEURAL TUBE DEFECT (Maternal AFP ${input.afpMom.toFixed(2)} MoM ≥ 2.5 MoM cut-off): Perform urgent targeted ultrasound to evaluate fetal spine (open spina bifida / myelomeningocele), cranial signs (lemon sign, banana sign, ventriculomegaly), and abdominal wall integrity (omphalocele/gastroschisis).`;
  } else if (overallRiskTier === 'high_risk') {
    clinicalRecommendation =
      `HIGH RISK (Adjusted Down syndrome risk ${formatOddsRatio(adjustedT21Numeric)}): Offer pre-test genetic counseling and diagnostic amniocentesis (with Chromosomal Microarray & QF-PCR) for definitive fetal karyotyping. Cell-free DNA (NIPT) is an alternative option if invasive testing is declined.`;
  } else if (overallRiskTier === 'intermediate_risk') {
    clinicalRecommendation =
      `INTERMEDIATE RISK (${formatOddsRatio(adjustedT21Numeric)}): Provide genetic counseling. Recommend secondary screening with Cell-Free DNA (NIPT) and a comprehensive Level-II targeted anomaly ultrasound scan at 18–20 weeks.`;
  } else {
    clinicalRecommendation =
      `LOW RISK (Adjusted Down syndrome risk ${formatOddsRatio(adjustedT21Numeric)}, ONTD Low Risk): Reassuring quadruple marker profile. Proceed with routine antenatal care and comprehensive Level-II anomaly ultrasound scan at 18–20 weeks.`;
  }

  return {
    screeningType: 'quadruple_marker',
    backgroundT21Ratio: background.t21Ratio,
    backgroundT21Numeric: background.t21Odds,
    adjustedT21Ratio: formatOddsRatio(adjustedT21Numeric),
    adjustedT21Numeric,
    adjustedT18Ratio: formatOddsRatio(adjustedT18Numeric),
    adjustedT18Numeric,
    adjustedT13Ratio: formatOddsRatio(adjustedT13Numeric),
    adjustedT13Numeric,
    ontdRiskStatus,
    overallRiskTier,
    clinicalRecommendation,
  };
}

/** Evaluates Cell-Free Fetal DNA (cfDNA / NIPT) quality and result implications */
export function evaluateNiptResult(params: {
  fetalFractionPercent: number;
  t21Result?: 'low_risk' | 'high_risk' | 'inconclusive';
  t18Result?: 'low_risk' | 'high_risk' | 'inconclusive';
  t13Result?: 'low_risk' | 'high_risk' | 'inconclusive';
}): {
  isAdequate: boolean;
  qualityWarning: string | null;
  overallTier: 'low_risk' | 'high_risk' | 'inconclusive';
  recommendation: string;
} {
  const isAdequate = params.fetalFractionPercent >= 4.0;
  const hasHighRisk =
    params.t21Result === 'high_risk' ||
    params.t18Result === 'high_risk' ||
    params.t13Result === 'high_risk';

  const hasInconclusive =
    !isAdequate ||
    params.t21Result === 'inconclusive' ||
    params.t18Result === 'inconclusive' ||
    params.t13Result === 'inconclusive';

  let qualityWarning: string | null = null;
  if (!isAdequate) {
    qualityWarning = `Low Fetal Fraction (${params.fetalFractionPercent}% < 4.0% threshold). Increased risk of test failure or false negative. Consider patient BMI, maternal heparin therapy, or redrawing after 1-2 weeks.`;
  }

  if (hasHighRisk) {
    return {
      isAdequate,
      qualityWarning,
      overallTier: 'high_risk',
      recommendation:
        'HIGH-RISK NIPT RESULT: NIPT is a screening test with high positive predictive value but is NOT diagnostic. ACOG and SMFM guidelines require definitive confirmation via diagnostic Amniocentesis or CVS with Chromosomal Microarray (CMA) before any irreversible pregnancy management decision.',
    };
  }

  if (hasInconclusive) {
    return {
      isAdequate,
      qualityWarning,
      overallTier: 'inconclusive',
      recommendation:
        'INCONCLUSIVE / NO-CALL NIPT RESULT: Test failed due to low fetal fraction or assay limitation. Offer genetic counseling, evaluate maternal BMI/medications, and consider redraw, combined screening, or diagnostic amniocentesis.',
    };
  }

  return {
    isAdequate,
    qualityWarning,
    overallTier: 'low_risk',
    recommendation:
      'LOW-RISK NIPT RESULT: Reassuring cell-free DNA result with detection rate > 99% for Trisomy 21 and > 98% for Trisomy 18. Fetal fraction adequate. Continue routine antenatal care and Level-II ultrasound scan at 18–20 weeks.',
  };
}
