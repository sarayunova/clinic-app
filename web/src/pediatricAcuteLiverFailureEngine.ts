/**
 * Pure Mathematical and Clinical Evaluation Engine for Pediatric Acute Liver Failure (PALF) & Hepatic Encephalopathy
 * References:
 * - Pediatric Acute Liver Failure (PALF) Study Group Criteria (Narkewicz et al., Hepatology 2009)
 * - ESPGHAN / NASPGHAN Guidelines for Pediatric Acute Liver Failure
 * - AASLD Practice Guideline: Management of Acute Liver Failure
 * - King's College Hospital Prognostic Criteria for Liver Transplantation
 */

export type PalfEtiology =
  | 'acetaminophen_toxicity'
  | 'viral_hepatitis'
  | 'autoimmune_hepatitis'
  | 'metabolic_wilson_galactosemia'
  | 'ischemic_shock'
  | 'drug_induced_dili'
  | 'gestational_neonatal_hemochromatosis'
  | 'indeterminate';

export type HepaticEncephalopathyGrade = 0 | 1 | 2 | 3 | 4;

export interface PediatricAcuteLiverFailureParams {
  ageMonths: number;
  weightKg: number;
  suspectedEtiology: PalfEtiology;
  encephalopathyStage: HepaticEncephalopathyGrade;
  inr: number;
  totalBilirubinMgDl: number;
  directBilirubinMgDl?: number | null;
  altUL: number;
  astUL: number;
  serumAmmoniaUmolL?: number | null;
  bloodGlucoseMgDl: number;
  serumSodiumMeqL?: number | null;
  serumCreatinineMgDl?: number | null;
  hasCerebralEdema?: boolean;
}

export interface KingsCollegePrognosis {
  isCriteriaMet: boolean;
  transplantListingUrgency: 'immediate_emergency_listing' | 'urgent_surveillance' | 'supportive_observation';
  criteriaDetails: string[];
  rationale: string;
}

export interface NeuroprotectionPlan {
  isCerebralEdemaHighRisk: boolean;
  targetSodiumMeqL: string;
  hypertonicSalineDirectives: string;
  mannitolDirectives: string;
  nAcetylcysteineDirectives: string;
  lactuloseDirectives: string;
}

export interface PediatricAcuteLiverFailureResult {
  isPalfConfirmed: boolean;
  palfSeverityCategory: 'fulminant_hepatic_failure' | 'acute_liver_injury_coagulopathy' | 'mild_acute_hepatitis';
  severityLabel: string;
  kingsCollege: KingsCollegePrognosis;
  neuroprotectionPlan: NeuroprotectionPlan;
  clinicalAlerts: string[];
  managementDirectives: string[];
}

export function evaluatePediatricAcuteLiverFailure(
  params: PediatricAcuteLiverFailureParams
): PediatricAcuteLiverFailureResult {
  const alerts: string[] = [];
  const directives: string[] = [];
  const weight = Math.max(2.0, params.weightKg || 10.0);

  // PALF Diagnostic Criteria:
  // 1. Biochemical evidence of acute liver injury (elevated transaminases / bilirubin)
  // 2. Absence of known chronic liver disease
  // 3. Coagulopathy uncorrected by Vitamin K:
  //    - INR >= 1.5 with Hepatic Encephalopathy, OR
  //    - INR >= 2.0 regardless of Encephalopathy
  const isPalfConfirmed =
    (params.inr >= 1.5 && params.encephalopathyStage > 0) || params.inr >= 2.0;

  let palfSeverityCategory: 'fulminant_hepatic_failure' | 'acute_liver_injury_coagulopathy' | 'mild_acute_hepatitis' =
    'mild_acute_hepatitis';
  let severityLabel = 'Acute Hepatitis / Liver Injury (Non-PALF)';

  if (isPalfConfirmed && (params.encephalopathyStage >= 2 || params.inr >= 3.0 || params.hasCerebralEdema)) {
    palfSeverityCategory = 'fulminant_hepatic_failure';
    severityLabel = 'FULMINANT HEPATIC FAILURE (Emergency Multi-Organ PICU Care Mandated)';
  } else if (isPalfConfirmed) {
    palfSeverityCategory = 'acute_liver_injury_coagulopathy';
    severityLabel = 'Pediatric Acute Liver Failure (PALF - Critical Coagulopathy)';
  }

  // King's College Prognostic Evaluation
  const details: string[] = [];
  let isKingsMet = false;

  if (params.suspectedEtiology === 'acetaminophen_toxicity') {
    // APAP Criteria
    if (params.inr > 6.5) {
      isKingsMet = true;
      details.push('INR > 6.5 (Profound hepatic necrosis from APAP toxicity)');
    }
    if (
      params.inr > 3.5 &&
      (params.serumCreatinineMgDl ?? 0) > 3.4 &&
      params.encephalopathyStage >= 3
    ) {
      isKingsMet = true;
      details.push('Severe Triad: INR > 3.5 + Creatinine > 3.4 mg/dL + Encephalopathy Stage 3/4');
    }
  } else {
    // Non-APAP Criteria
    if (params.inr > 4.0) {
      isKingsMet = true;
      details.push('Single major criterion: INR > 4.0 in non-acetaminophen liver failure');
    }
    let nonApapFactors = 0;
    if (['viral_hepatitis', 'indeterminate', 'drug_induced_dili', 'autoimmune_hepatitis'].includes(params.suspectedEtiology)) {
      nonApapFactors++;
      details.push('Unfavorable etiology (Non-A/Non-B / idiosyncratic / indeterminate)');
    }
    if (params.ageMonths < 120) {
      // Age < 10 years
      nonApapFactors++;
      details.push(`Age < 10 years (${Math.round(params.ageMonths / 12)} years)`);
    }
    if (params.inr > 3.5) {
      nonApapFactors++;
      details.push(`INR > 3.5 (${params.inr})`);
    }
    if (params.totalBilirubinMgDl > 17.5) {
      nonApapFactors++;
      details.push(`Total Bilirubin > 17.5 mg/dL (${params.totalBilirubinMgDl} mg/dL)`);
    }
    if (nonApapFactors >= 3) {
      isKingsMet = true;
      details.push(`Meets 3 or more adverse prognostic indicators (${nonApapFactors}/5)`);
    }
  }

  const kingsCollege: KingsCollegePrognosis = {
    isCriteriaMet: isKingsMet,
    transplantListingUrgency: isKingsMet
      ? 'immediate_emergency_listing'
      : isPalfConfirmed
      ? 'urgent_surveillance'
      : 'supportive_observation',
    criteriaDetails: details,
    rationale: isKingsMet
      ? 'King\'s College criteria met: High predicted mortality without emergent pediatric liver transplantation. Contact liver transplant center STAT.'
      : isPalfConfirmed
      ? 'PALF confirmed: Serial INR, ammonia, and encephalopathy monitoring required. Place pediatric liver transplant team on alert.'
      : 'Supportive pediatric liver care indicated; close surveillance for worsening coagulopathy.',
  };

  // Neuroprotection & Cerebral Edema Plan
  const isCerebralEdemaHighRisk =
    params.hasCerebralEdema ||
    params.encephalopathyStage >= 2 ||
    (params.serumAmmoniaUmolL != null && params.serumAmmoniaUmolL >= 100);

  const hypertonicRateMlHr = Math.round(weight * 1.5 * 10) / 10;
  const mannitolDoseG = Math.round(weight * 0.5 * 10) / 10;

  const neuroprotectionPlan: NeuroprotectionPlan = {
    isCerebralEdemaHighRisk: Boolean(isCerebralEdemaHighRisk),
    targetSodiumMeqL: '145 - 150 mEq/L (mild controlled hypernatremia to reduce astrocyte edema)',
    hypertonicSalineDirectives: `3% Hypertonic Saline: Continuous IV infusion at 1 - 2 mL/kg/hr (~${hypertonicRateMlHr} mL/hr) targeting serum sodium 145-150 mEq/L and serum osmolality < 320 mOsm/kg. Check sodium q4-6h.`,
    mannitolDirectives: `20% Mannitol: 0.5 g/kg IV (~${mannitolDoseG} g = ${Math.round(mannitolDoseG * 5)} mL 20% solution) over 15-20 minutes for acute ICP spikes or pupillary sluggishness (avoid if serum osmolality > 320 mOsm/kg).`,
    nAcetylcysteineDirectives:
      'N-Acetylcysteine (NAC) Infusion: 100 mg/kg/day continuous IV infusion. Pediatric trials demonstrate improved transplant-free survival and hemodynamic stability even in non-acetaminophen acute liver failure.',
    lactuloseDirectives:
      'Lactulose: 0.5 - 1 mL/kg oral/NG every 6-8 hours, titrated to achieve 2 - 3 soft acidic bowel movements daily to eliminate colonic ammonia production.',
  };

  // Alerts
  if (isPalfConfirmed) {
    alerts.push(`PALF CONFIRMED: Severe coagulopathy (INR ${params.inr}) indicates acute hepatocellular necrosis. Avoid routine FFP administration unless active severe bleeding, to preserve INR as a dynamic prognostic marker.`);
  }
  if (isKingsMet) {
    alerts.push('EMERGENCY TRANSPLANT CRITERIA MET: Patient meets King\'s College prognostic criteria for high mortality. Immediately initiate emergency pediatric liver transplant center transfer coordination.');
  }
  if (isCerebralEdemaHighRisk) {
    alerts.push(`CEREBRAL EDEMA HIGH RISK: Encephalopathy Stage ${params.encephalopathyStage}${params.serumAmmoniaUmolL ? ` / Ammonia ${params.serumAmmoniaUmolL} µmol/L` : ''}. Hyperammonemic astrocyte swelling causes intracranial hypertension and risk of brain herniation.`);
  }
  if (params.bloodGlucoseMgDl < 70) {
    alerts.push(`CRITICAL HYPOGLYCEMIA (${params.bloodGlucoseMgDl} mg/dL): Failed hepatic gluconeogenesis and glycogenolysis. Infuse 10% Dextrose mini-bolus (2 mL/kg) and increase background D10/D12.5% infusion rate.`);
  }

  // Directives
  directives.push('Maintain strict neuroprotective care: Elevate head of bed 30 degrees in neutral midline position to optimize cerebral venous drainage.');
  directives.push('Provide continuous 10% or 12.5% Dextrose with electrolytes targeting blood glucose 90 - 140 mg/dL; hypoglycemia drastically exacerbates neurological decline.');
  directives.push('Intravenous N-Acetylcysteine (NAC 100 mg/kg/day continuous) recommended for multi-organ antioxidant and microvascular perfusion support.');
  directives.push('Avoid all sedative and hypnotic medications (benzodiazepines, opioids) which precipitate coma and confound serial neurological grading.');
  directives.push('Monitor hourly vital signs, pupillary reactivity, Glasgow Coma Scale / pediatric encephalopathy score, and urine output in PICU.');

  return {
    isPalfConfirmed,
    palfSeverityCategory,
    severityLabel,
    kingsCollege,
    neuroprotectionPlan,
    clinicalAlerts: alerts,
    managementDirectives: directives,
  };
}
