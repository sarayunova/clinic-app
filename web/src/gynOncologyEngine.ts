/**
 * Gynecological Oncology & Malignancy Risk Stratification Engine
 *
 * References:
 * - Jacobs I et al. A risk of malignancy index incorporating CA 125, ultrasound and menopausal status. Br J Obstet Gynaecol 1990.
 * - Timmerman D et al. Simple ultrasound-based rules for the diagnosis of ovarian cancer. Ultrasound Obstet Gynecol 2008.
 * - Van Calster B et al. Evaluating the risk of ovarian cancer before surgery using the ADNEX model. BMJ 2014.
 * - RCOG Green-top Guideline No. 34: Management of Suspected Ovarian Masses in Premenopausal/Postmenopausal Women.
 * - ACOG Committee Opinion No. 734: The Role of the Obstetrician-Gynecologist in the Assessment of Adnexal Masses.
 */

export type RmiRiskTier = 'low_risk_le_25' | 'intermediate_risk_26_200' | 'high_risk_gt_200';
export type IotaCategory = 'benign' | 'malignant' | 'inconclusive';

export interface RmiCalculationInput {
  ca125LevelUml: number;
  isPostmenopausal: boolean;
  multilocularCysts: boolean;
  solidAreasPresent: boolean;
  bilateralLesions: boolean;
  ascitesPresent: boolean;
  metastasesPresent: boolean;
}

export interface IotaRulesInput {
  // B-features
  b1Unilocular: boolean;
  b2SolidLargestLt7mm: boolean;
  b3AcousticShadows: boolean;
  b4SmoothMultilocularLt100mm: boolean;
  b5NoBloodFlowScore1: boolean;

  // M-features
  m1IrregularSolid: boolean;
  m2Ascites: boolean;
  m3AtLeast4PapillaryStructures: boolean;
  m4IrregularMultilocularSolidGe100mm: boolean;
  m5VeryStrongBloodFlowScore4: boolean;
}

export interface PmbTriageInput {
  isPostmenopausal: boolean;
  hasPostmenopausalBleeding: boolean;
  endometrialThicknessMm: number;
  onTamoxifen?: boolean;
}

export function calculateRmi1(input: RmiCalculationInput): {
  rmiScore: number;
  ultrasoundScoreU: 0 | 1 | 3;
  menopausalScoreM: 1 | 3;
  riskTier: RmiRiskTier;
  riskSummary: string;
  recommendation: string;
} {
  const { ca125LevelUml, isPostmenopausal } = input;

  let usCount = 0;
  if (input.multilocularCysts) usCount++;
  if (input.solidAreasPresent) usCount++;
  if (input.bilateralLesions) usCount++;
  if (input.ascitesPresent) usCount++;
  if (input.metastasesPresent) usCount++;

  let u: 0 | 1 | 3 = 0;
  if (usCount === 1) u = 1;
  else if (usCount >= 2) u = 3;

  const m: 1 | 3 = isPostmenopausal ? 3 : 1;
  const ca125 = Math.max(0, ca125LevelUml || 0);

  const rmiScore = Math.round(u * m * ca125 * 10) / 10;

  let riskTier: RmiRiskTier = 'low_risk_le_25';
  let riskSummary = '';
  let recommendation = '';

  if (rmiScore > 200) {
    riskTier = 'high_risk_gt_200';
    riskSummary = `High Malignancy Risk (RMI = ${rmiScore} > 200). Sensitivity ~75%, specificity ~90% for ovarian malignancy.`;
    recommendation =
      'Urgent Gynecological Oncologist referral and tertiary Multidisciplinary Tumor Board (MDT) presentation. Contrast-enhanced CT abdomen/pelvis for formal surgical staging.';
  } else if (rmiScore >= 26) {
    riskTier = 'intermediate_risk_26_200';
    riskSummary = `Intermediate Malignancy Risk (RMI = ${rmiScore}, range 26–200). Risk of malignancy approximately 20%.`;
    recommendation =
      'Expert Level-3 transvaginal Doppler ultrasound or Pelvic MRI with DWI/contrast. Consider laparoscopic evaluation by experienced gynecological surgeon.';
  } else {
    riskTier = 'low_risk_le_25';
    riskSummary = `Low Malignancy Risk (RMI = ${rmiScore} <= 25). Risk of malignancy < 3%.`;
    recommendation =
      'Conservative surveillance with repeat TVS in 3–4 months or elective laparoscopic cystectomy for persistent/symptomatic benign cysts.';
  }

  return {
    rmiScore,
    ultrasoundScoreU: u,
    menopausalScoreM: m,
    riskTier,
    riskSummary,
    recommendation,
  };
}

export function evaluateIotaSimpleRules(input: IotaRulesInput): {
  bFeatureCount: number;
  mFeatureCount: number;
  category: IotaCategory;
  summary: string;
} {
  const bCount =
    (input.b1Unilocular ? 1 : 0) +
    (input.b2SolidLargestLt7mm ? 1 : 0) +
    (input.b3AcousticShadows ? 1 : 0) +
    (input.b4SmoothMultilocularLt100mm ? 1 : 0) +
    (input.b5NoBloodFlowScore1 ? 1 : 0);

  const mCount =
    (input.m1IrregularSolid ? 1 : 0) +
    (input.m2Ascites ? 1 : 0) +
    (input.m3AtLeast4PapillaryStructures ? 1 : 0) +
    (input.m4IrregularMultilocularSolidGe100mm ? 1 : 0) +
    (input.m5VeryStrongBloodFlowScore4 ? 1 : 0);

  let category: IotaCategory = 'inconclusive';
  let summary = '';

  if (bCount >= 1 && mCount === 0) {
    category = 'benign';
    summary = `IOTA Simple Rules: BENIGN mass (${bCount} B-features present, 0 M-features). Negative predictive value ~95%.`;
  } else if (mCount >= 1 && bCount === 0) {
    category = 'malignant';
    summary = `IOTA Simple Rules: MALIGNANT mass (${mCount} M-features present, 0 B-features). Positive predictive value ~90%.`;
  } else {
    category = 'inconclusive';
    summary = `IOTA Simple Rules: INCONCLUSIVE (${bCount} B-features and ${mCount} M-features). Requires second-opinion expert ultrasound or ADNEX mathematical model.`;
  }

  return {
    bFeatureCount: bCount,
    mFeatureCount: mCount,
    category,
    summary,
  };
}

export function evaluatePmbEndometrialThickness(input: PmbTriageInput): {
  biopsyIndicated: boolean;
  cutoffMm: number;
  rationale: string;
} {
  const { isPostmenopausal, hasPostmenopausalBleeding, endometrialThicknessMm, onTamoxifen } = input;

  if (!isPostmenopausal || !hasPostmenopausalBleeding) {
    return {
      biopsyIndicated: false,
      cutoffMm: 4.0,
      rationale: 'Patient is not postmenopausal or has no postmenopausal bleeding. Standard routine evaluation applies.',
    };
  }

  const cutoff = onTamoxifen ? 3.0 : 4.0;
  const indicated = endometrialThicknessMm > cutoff;

  return {
    biopsyIndicated: indicated,
    cutoffMm: cutoff,
    rationale: indicated
      ? `Endometrial thickness is ${endometrialThicknessMm} mm (threshold > ${cutoff} mm in PMB). Urgent endometrial tissue sampling (Pipelle / hysteroscopic targeted biopsy) is mandatory to rule out Endometrial Intraepithelial Neoplasia (EIN) and adenocarcinoma.`
      : `Endometrial thickness is ${endometrialThicknessMm} mm (<= ${cutoff} mm threshold). Risk of endometrial carcinoma is < 1%. Reassurance and return if recurrent bleeding.`,
  };
}
