// Pure TypeScript Clinical Calculation Engine: Obstetric Acute Fatty Liver of Pregnancy (AFLP) & Swansea Diagnostic Criteria
// References: Swansea Diagnostic Criteria (Ch'ng et al. Gut 2002; Goel et al. 2011; RCOG Green-top Guideline; EASL Pregnancy Liver)

export interface SwanseaCriteriaInput {
  vomiting: boolean;
  abdominalPain: boolean;
  polydipsiaPolyuria: boolean;
  encephalopathy: boolean;
  elevatedBilirubin: boolean; // Bilirubin > 14 umol/L (> 0.8 mg/dL)
  hypoglycemia: boolean; // Glucose < 4.0 mmol/L (< 72 mg/dL)
  elevatedUrate: boolean; // Uric acid > 340 umol/L (> 5.7 mg/dL)
  leukocytosis: boolean; // WBC > 11 x 10^9/L (> 11,000/uL)
  ascitesOrBrightLiver: boolean; // Ultrasound bright liver or ascites
  elevatedTransaminases: boolean; // AST or ALT > 42 U/L
  elevatedAmmonia: boolean; // Ammonia > 47 umol/L
  renalImpairment: boolean; // Creatinine > 150 umol/L (> 1.7 mg/dL)
  coagulopathy: boolean; // PT > 14s, APTR > 34s, or INR > 1.2
  microvesicularSteatosisBiopsy: boolean; // Liver biopsy finding
  serumGlucoseMgDl?: number;
  serumBilirubinMgDl?: number;
  astUL?: number;
  altUL?: number;
  creatinineMgDl?: number;
  ptSeconds?: number;
  inr?: number;
}

export interface SwanseaEvaluationResult {
  totalCriteriaMet: number;
  aflpConfirmed: boolean;
  criteriaBreakdown: { key: string; label: string; met: boolean }[];
  clinicalSeverity: 'unlikely' | 'probable_aflp' | 'fulminant_aflp';
  deliveryRecommendation: string;
  hypoglycemiaProtocol: string;
  coagulopathyManagement: string;
  lchadScreeningAlert: string;
  icuAdmissionRecommended: boolean;
  criticalActions: string[];
}

/**
 * Evaluates the 14 Swansea criteria for Acute Fatty Liver of Pregnancy (AFLP).
 * AFLP is confirmed when >= 6 criteria are present.
 */
export function evaluateSwanseaCriteria(input: SwanseaCriteriaInput): SwanseaEvaluationResult {
  const criteria = [
    { key: 'vomiting', label: 'Vomiting', met: Boolean(input.vomiting) },
    { key: 'abdominalPain', label: 'Abdominal Pain', met: Boolean(input.abdominalPain) },
    { key: 'polydipsiaPolyuria', label: 'Polydipsia / Polyuria', met: Boolean(input.polydipsiaPolyuria) },
    { key: 'encephalopathy', label: 'Hepatic Encephalopathy (Asterixis / Confusion)', met: Boolean(input.encephalopathy) },
    { key: 'elevatedBilirubin', label: 'Elevated Bilirubin (> 14 umol/L or > 0.8 mg/dL)', met: Boolean(input.elevatedBilirubin || (input.serumBilirubinMgDl !== undefined && input.serumBilirubinMgDl > 0.8)) },
    { key: 'hypoglycemia', label: 'Hypoglycemia (< 4.0 mmol/L or < 72 mg/dL)', met: Boolean(input.hypoglycemia || (input.serumGlucoseMgDl !== undefined && input.serumGlucoseMgDl < 72)) },
    { key: 'elevatedUrate', label: 'Elevated Uric Acid (> 340 umol/L or > 5.7 mg/dL)', met: Boolean(input.elevatedUrate) },
    { key: 'leukocytosis', label: 'Leukocytosis (WBC > 11 x 10^9/L)', met: Boolean(input.leukocytosis) },
    { key: 'ascitesOrBrightLiver', label: 'Ascites or Bright Hyperechoic Liver on Ultrasound', met: Boolean(input.ascitesOrBrightLiver) },
    { key: 'elevatedTransaminases', label: 'Elevated Transaminases (AST or ALT > 42 U/L)', met: Boolean(input.elevatedTransaminases || (input.astUL !== undefined && input.astUL > 42) || (input.altUL !== undefined && input.altUL > 42)) },
    { key: 'elevatedAmmonia', label: 'Elevated Serum Ammonia (> 47 umol/L)', met: Boolean(input.elevatedAmmonia) },
    { key: 'renalImpairment', label: 'Renal Impairment (Creatinine > 150 umol/L or > 1.7 mg/dL)', met: Boolean(input.renalImpairment || (input.creatinineMgDl !== undefined && input.creatinineMgDl > 1.7)) },
    { key: 'coagulopathy', label: 'Coagulopathy (PT > 14s, APTR > 34s, or INR > 1.2)', met: Boolean(input.coagulopathy || (input.ptSeconds !== undefined && input.ptSeconds > 14) || (input.inr !== undefined && input.inr > 1.2)) },
    { key: 'microvesicularSteatosisBiopsy', label: 'Microvesicular Steatosis on Liver Biopsy', met: Boolean(input.microvesicularSteatosisBiopsy) },
  ];

  const totalCriteriaMet = criteria.filter((c) => c.met).length;
  const aflpConfirmed = totalCriteriaMet >= 6;

  let clinicalSeverity: 'unlikely' | 'probable_aflp' | 'fulminant_aflp' = 'unlikely';
  if (aflpConfirmed) {
    clinicalSeverity = (input.encephalopathy || input.renalImpairment || (input.inr && input.inr >= 2.0))
      ? 'fulminant_aflp'
      : 'probable_aflp';
  } else if (totalCriteriaMet >= 4) {
    clinicalSeverity = 'probable_aflp'; // High suspicion warranting serial testing
  }

  // Delivery Recommendation
  let deliveryRecommendation = 'Continue close fetomaternal monitoring; repeat liver panel and coagulation in 24 hours if symptoms persist.';
  if (aflpConfirmed) {
    deliveryRecommendation = 'EMERGENT DELIVERY INDICATED: Delivery is the definitive therapy for AFLP regardless of gestational age. Promptly stabilize maternal hemodynamics, glucose, and coagulopathy, then proceed with expeditious delivery (induction or cesarean based on obstetric factors).';
  }

  // Hypoglycemia Management Protocol
  const hypoglycemiaProtocol = 'Initiate continuous 10% Dextrose infusion (or 20% Dextrose via central line if fluid restricted) maintaining blood glucose >= 4.0 - 7.0 mmol/L (72 - 126 mg/dL). Monitor capillary blood glucose every 1 to 2 hours.';

  // Coagulopathy Management Protocol
  const coagulopathyManagement = 'Target fibrinogen >= 150-200 mg/dL, platelets >= 50,000/uL, and INR < 1.5 prior to delivery or neuraxial anesthesia. Administer Cryoprecipitate (10 units) for low fibrinogen, Fresh Frozen Plasma (15 mL/kg), and Platelets as indicated. Avoid regional anesthesia if coagulopathy is uncorrected.';

  // LCHAD Genetic Alert
  const lchadScreeningAlert = 'MANDATORY NEWBORN GENETIC SCREENING: Maternal AFLP is strongly linked to fetal Long-Chain 3-Hydroxyacyl-CoA Dehydrogenase (LCHAD) deficiency (G1528C mutation). Notify pediatric team to perform immediate neonatal acylcarnitine profile and genetic testing; avoid prolonged fasting in the newborn.';

  const criticalActions: string[] = [];
  if (aflpConfirmed) {
    criticalActions.push('Activate multidisciplinary emergency team: Senior Obstetrician, Maternal-Fetal Medicine, Obstetric Anesthesiologist, Hepatology, Critical Care, and Neonatology.');
    criticalActions.push('Transfer to Obstetric HDU / Intensive Care Unit with invasive arterial line monitoring.');
    criticalActions.push('Continuous D10W infusion to treat or prevent fatal profound hypoglycemia from hepatic glycogen depletion.');
    criticalActions.push('Correct consumptive coagulopathy prior to delivery; reserve 4 units PRBC and 4 units FFP.');
    criticalActions.push('Anticipate postpartum hepatic recovery delay: transaminases and coagulopathy often peak 24-48 hours postpartum before gradual resolution.');
  } else if (totalCriteriaMet >= 4) {
    criticalActions.push('High suspicion for emerging AFLP (meets 4-5 criteria). Repeat complete liver profile, coagulation, urate, ammonia, and ultrasound within 6-12 hours.');
  }

  return {
    totalCriteriaMet,
    aflpConfirmed,
    criteriaBreakdown: criteria,
    clinicalSeverity,
    deliveryRecommendation,
    hypoglycemiaProtocol,
    coagulopathyManagement,
    lchadScreeningAlert,
    icuAdmissionRecommended: aflpConfirmed || clinicalSeverity === 'fulminant_aflp',
    criticalActions,
  };
}
