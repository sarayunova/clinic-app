/**
 * Standard Clinical Laboratory Investigation Catalog & Evaluator
 * Covers hematology, biochemistry, serology, urine analysis, and specialized
 * antenatal/obstetric screening panels with automatic abnormal value flagging.
 */

export type LabCategory =
  | 'hematology'
  | 'biochemistry'
  | 'serology'
  | 'urine'
  | 'microbiology'
  | 'hormones'
  | 'general';

export type LabPriority = 'routine' | 'urgent' | 'stat';

export type LabOrderStatus =
  | 'ordered'
  | 'sample_collected'
  | 'sent_to_lab'
  | 'completed'
  | 'cancelled';

export type LabResultFlag = 'normal' | 'low' | 'high' | 'critical' | 'abnormal' | 'pending';

export interface LabTestDef {
  testName: string;
  category: LabCategory;
  unit: string;
  referenceRange: string;
  defaultSpecimen: string;
  hint?: string;
}

export interface LabPanelDef {
  id: string;
  title: string;
  category: string;
  description: string;
  tests: LabTestDef[];
}

export const LAB_PANELS: LabPanelDef[] = [
  {
    id: 'antenatal_first_trimester',
    title: '🤰 Antenatal 1st Trimester Booking Panel',
    category: 'Obstetrics & Maternity',
    description: 'Comprehensive baseline screening for newly registered pregnant mothers.',
    tests: [
      {
        testName: 'Complete Blood Count (Hemoglobin & Platelets)',
        category: 'hematology',
        unit: 'g/dL',
        referenceRange: '11.0 - 14.0 (Pregnancy)',
        defaultSpecimen: 'EDTA Whole Blood (2 ml, Lavender top)',
      },
      {
        testName: 'Blood Grouping & Rh Factor',
        category: 'hematology',
        unit: '',
        referenceRange: 'ABO / Rh Positive or Negative',
        defaultSpecimen: 'EDTA Whole Blood',
      },
      {
        testName: 'Fasting Plasma Glucose (FPG)',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '70 - 92 (Normal pregnancy)',
        defaultSpecimen: 'Sodium Fluoride Plasma (Grey top)',
      },
      {
        testName: 'HIV I & II Antibody Rapid / CLIA',
        category: 'serology',
        unit: '',
        referenceRange: 'Non-Reactive',
        defaultSpecimen: 'Serum / Plain (Red top)',
      },
      {
        testName: 'Hepatitis B Surface Antigen (HBsAg)',
        category: 'serology',
        unit: '',
        referenceRange: 'Non-Reactive',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'HCV Antibody (Anti-HCV)',
        category: 'serology',
        unit: '',
        referenceRange: 'Non-Reactive',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Syphilis Serology (VDRL / RPR)',
        category: 'serology',
        unit: '',
        referenceRange: 'Non-Reactive',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Serum TSH (Thyroid Stimulating Hormone)',
        category: 'hormones',
        unit: 'mIU/L',
        referenceRange: '0.2 - 2.5 (1st Trimester)',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Urine Routine & Microscopic Examination',
        category: 'urine',
        unit: '',
        referenceRange: 'Protein: Nil, Sugar: Nil, Pus cells: 0-5/hpf',
        defaultSpecimen: 'Clean-catch Midstream Urine (Sterile cup)',
      },
      {
        testName: 'Rubella IgG Antibody',
        category: 'serology',
        unit: 'IU/mL',
        referenceRange: '> 10.0 (Immune)',
        defaultSpecimen: 'Serum / Plain',
      },
    ],
  },
  {
    id: 'gdm_screening',
    title: '🍬 Gestational Diabetes (DIPSI / GTT 75g)',
    category: 'Obstetrics & Maternity',
    description: '75g Oral Glucose Tolerance Test for screening gestational diabetes.',
    tests: [
      {
        testName: 'Fasting Plasma Glucose',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '< 92 mg/dL',
        defaultSpecimen: 'Sodium Fluoride Plasma (Fasting 8-10h)',
      },
      {
        testName: '1-Hour Post-Glucose (75g)',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '< 180 mg/dL',
        defaultSpecimen: 'Sodium Fluoride Plasma',
      },
      {
        testName: '2-Hour Post-Glucose (75g)',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '< 153 mg/dL',
        defaultSpecimen: 'Sodium Fluoride Plasma',
      },
      {
        testName: 'Glycated Hemoglobin (HbA1c)',
        category: 'biochemistry',
        unit: '%',
        referenceRange: '4.0 - 5.6% (Non-diabetic)',
        defaultSpecimen: 'EDTA Whole Blood',
      },
    ],
  },
  {
    id: 'preeclampsia_panel',
    title: '⚠️ Pre-Eclampsia & PIH Workup Panel',
    category: 'Obstetrics & Maternity',
    description: 'Investigates pregnancy-induced hypertension and rule out HELLP syndrome.',
    tests: [
      {
        testName: 'Platelet Count (CBC)',
        category: 'hematology',
        unit: '/uL',
        referenceRange: '150,000 - 450,000',
        defaultSpecimen: 'EDTA Whole Blood',
      },
      {
        testName: 'Serum Creatinine',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '0.4 - 0.8 (Pregnancy)',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Serum Uric Acid',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '2.5 - 5.5 (Pregnancy)',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Liver Transaminases (SGOT / AST)',
        category: 'biochemistry',
        unit: 'U/L',
        referenceRange: '10 - 35',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Liver Transaminases (SGPT / ALT)',
        category: 'biochemistry',
        unit: 'U/L',
        referenceRange: '10 - 35',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Lactate Dehydrogenase (Serum LDH)',
        category: 'biochemistry',
        unit: 'U/L',
        referenceRange: '140 - 280',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Spot Urine Protein-to-Creatinine Ratio (UPCR)',
        category: 'urine',
        unit: 'mg/mg',
        referenceRange: '< 0.3 (Non-significant proteinuria)',
        defaultSpecimen: 'Spot Random Urine',
      },
    ],
  },
  {
    id: 'preop_panel',
    title: '🏥 Pre-Operative / LSCS Workup Panel',
    category: 'General & Surgical',
    description: 'Surgical fitness and coagulation profile prior to cesarean section or surgery.',
    tests: [
      {
        testName: 'Complete Blood Count (Hb, WBC, Platelets)',
        category: 'hematology',
        unit: 'g/dL',
        referenceRange: 'Hb: 11.5 - 15.0',
        defaultSpecimen: 'EDTA Whole Blood',
      },
      {
        testName: 'Prothrombin Time (PT) & INR',
        category: 'hematology',
        unit: 'seconds',
        referenceRange: 'Control ± 2s, INR: 0.8 - 1.2',
        defaultSpecimen: 'Sodium Citrate (Blue top)',
      },
      {
        testName: 'Activated Partial Thromboplastin Time (aPTT)',
        category: 'hematology',
        unit: 'seconds',
        referenceRange: '25.0 - 35.0',
        defaultSpecimen: 'Sodium Citrate',
      },
      {
        testName: 'Random Blood Glucose',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '70 - 140',
        defaultSpecimen: 'Fluoride / Serum',
      },
      {
        testName: 'Serum Urea & Creatinine',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: 'Urea: 15-40, Creat: 0.6-1.1',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Serum Electrolytes (Sodium & Potassium)',
        category: 'biochemistry',
        unit: 'mEq/L',
        referenceRange: 'Na: 135-145, K: 3.5-5.0',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Pre-op Viral Markers (HIV, HBsAg, HCV)',
        category: 'serology',
        unit: '',
        referenceRange: 'All Non-Reactive',
        defaultSpecimen: 'Serum / Plain',
      },
    ],
  },
  {
    id: 'cbc_panel',
    title: '🩸 Complete Hemogram (CBC / ESR)',
    category: 'Hematology',
    description: 'Comprehensive red cells, white cells, differential count, and platelets.',
    tests: [
      {
        testName: 'Hemoglobin (Hb)',
        category: 'hematology',
        unit: 'g/dL',
        referenceRange: '12.0 - 15.5',
        defaultSpecimen: 'EDTA Whole Blood',
      },
      {
        testName: 'Total Leukocyte Count (WBC)',
        category: 'hematology',
        unit: '/uL',
        referenceRange: '4,000 - 11,000',
        defaultSpecimen: 'EDTA Whole Blood',
      },
      {
        testName: 'Platelet Count',
        category: 'hematology',
        unit: '/uL',
        referenceRange: '150,000 - 450,000',
        defaultSpecimen: 'EDTA Whole Blood',
      },
      {
        testName: 'Hematocrit (PCV)',
        category: 'hematology',
        unit: '%',
        referenceRange: '36.0 - 46.0',
        defaultSpecimen: 'EDTA Whole Blood',
      },
      {
        testName: 'Erythrocyte Sedimentation Rate (ESR)',
        category: 'hematology',
        unit: 'mm/1st hr',
        referenceRange: '0 - 20',
        defaultSpecimen: 'EDTA / Citrate',
      },
    ],
  },
  {
    id: 'lft_panel',
    title: '🧪 Liver Function Test (LFT Profile)',
    category: 'Biochemistry',
    description: 'Total bilirubin, liver transaminases, alkaline phosphatase and proteins.',
    tests: [
      {
        testName: 'Total Bilirubin',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '0.2 - 1.2',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Direct Bilirubin',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '0.0 - 0.3',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'SGOT / AST',
        category: 'biochemistry',
        unit: 'U/L',
        referenceRange: '10 - 40',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'SGPT / ALT',
        category: 'biochemistry',
        unit: 'U/L',
        referenceRange: '10 - 40',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Serum Alkaline Phosphatase (ALP)',
        category: 'biochemistry',
        unit: 'U/L',
        referenceRange: '30 - 120',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Total Serum Protein & Albumin',
        category: 'biochemistry',
        unit: 'g/dL',
        referenceRange: 'Protein: 6.0-8.3, Alb: 3.5-5.0',
        defaultSpecimen: 'Serum / Plain',
      },
    ],
  },
  {
    id: 'kft_panel',
    title: '💧 Renal Function Test (KFT Profile)',
    category: 'Biochemistry',
    description: 'Renal parameters: Urea, Creatinine, Uric acid, and Serum Electrolytes.',
    tests: [
      {
        testName: 'Blood Urea Nitrogen (BUN)',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '7.0 - 20.0',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Serum Creatinine',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '0.6 - 1.2',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Serum Uric Acid',
        category: 'biochemistry',
        unit: 'mg/dL',
        referenceRange: '3.5 - 7.2',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Serum Sodium (Na+)',
        category: 'biochemistry',
        unit: 'mEq/L',
        referenceRange: '136 - 145',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Serum Potassium (K+)',
        category: 'biochemistry',
        unit: 'mEq/L',
        referenceRange: '3.5 - 5.1',
        defaultSpecimen: 'Serum / Plain',
      },
    ],
  },
  {
    id: 'thyroid_panel',
    title: '🦋 Thyroid Profile (TSH / Free T3 / Free T4)',
    category: 'Hormones',
    description: 'Assess thyroid gland function and monitor levothyroxine dosing.',
    tests: [
      {
        testName: 'Serum TSH (Ultrasensitive)',
        category: 'hormones',
        unit: 'mIU/L',
        referenceRange: '0.4 - 4.2',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Free T3',
        category: 'hormones',
        unit: 'pg/mL',
        referenceRange: '2.3 - 4.2',
        defaultSpecimen: 'Serum / Plain',
      },
      {
        testName: 'Free T4',
        category: 'hormones',
        unit: 'ng/dL',
        referenceRange: '0.8 - 1.8',
        defaultSpecimen: 'Serum / Plain',
      },
    ],
  },
];

/**
 * Intelligent abnormal flag evaluator for common clinical tests.
 */
export function evaluateLabResultFlag(
  testName: string,
  resultValue: string,
  numericValue?: number | null
): LabResultFlag {
  if (!resultValue || resultValue.trim() === '') return 'pending';
  const valLower = resultValue.toLowerCase().trim();
  const nameLower = testName.toLowerCase();

  // Serology & qualitative markers
  if (
    nameLower.includes('hiv') ||
    nameLower.includes('hbsag') ||
    nameLower.includes('hcv') ||
    nameLower.includes('vdrl') ||
    nameLower.includes('rpr') ||
    nameLower.includes('viral')
  ) {
    if (valLower.includes('non-reactive') || valLower.includes('nonreactive') || valLower.includes('negative')) {
      return 'normal';
    }
    if (valLower.includes('reactive') || valLower.includes('positive')) {
      return 'abnormal';
    }
  }

  // Urine protein / albumin
  if (nameLower.includes('urine') && (nameLower.includes('protein') || nameLower.includes('albumin'))) {
    if (valLower.includes('3+') || valLower.includes('4+')) return 'critical';
    if (valLower.includes('1+') || valLower.includes('2+') || valLower.includes('positive')) return 'high';
    if (valLower.includes('nil') || valLower.includes('negative') || valLower.includes('trace')) return 'normal';
  }

  // Parse numeric if available
  const num = numericValue ?? parseFloat(resultValue.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return 'normal';

  // Hemoglobin (Hb in g/dL)
  if (nameLower.includes('hemoglobin') || nameLower === 'hb') {
    if (num < 7.0) return 'critical';
    if (num < 11.0) return 'low';
    if (num > 17.5) return 'high';
    return 'normal';
  }

  // Platelet count (/uL)
  if (nameLower.includes('platelet')) {
    if (num < 50000) return 'critical';
    if (num < 150000) return 'low';
    if (num > 500000) return 'high';
    return 'normal';
  }

  // Blood Sugar / Glucose (mg/dL)
  if (nameLower.includes('glucose') || nameLower.includes('sugar') || nameLower.includes('fpg')) {
    if (num < 55 || num > 350) return 'critical';
    if (num < 70) return 'low';
    if (nameLower.includes('fasting') || nameLower.includes('fpg')) {
      if (num > 95) return 'high';
    } else if (num > 140) {
      return 'high';
    }
    return 'normal';
  }

  // Serum Potassium (mEq/L)
  if (nameLower.includes('potassium') || nameLower === 'k+' || nameLower === 'k') {
    if (num < 2.8 || num > 6.2) return 'critical';
    if (num < 3.5) return 'low';
    if (num > 5.1) return 'high';
    return 'normal';
  }

  // Serum Creatinine (mg/dL)
  if (nameLower.includes('creatinine')) {
    if (num > 3.0) return 'critical';
    if (num > 1.3) return 'high';
    if (num < 0.4) return 'low';
    return 'normal';
  }

  // Serum TSH (mIU/L)
  if (nameLower.includes('tsh')) {
    if (num > 10.0) return 'critical';
    if (num > 4.5) return 'high';
    if (num < 0.2) return 'low';
    return 'normal';
  }

  // SGOT / SGPT (U/L)
  if (nameLower.includes('sgpt') || nameLower.includes('sgot') || nameLower.includes('alt') || nameLower.includes('ast')) {
    if (num > 300) return 'critical';
    if (num > 40) return 'high';
    return 'normal';
  }

  return 'normal';
}
