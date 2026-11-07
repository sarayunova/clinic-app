// Cervical Cancer Screening & Colposcopy Decision Engine
// Implements Bethesda System 2014 Cytology reporting,
// Swede Colposcopic Scoring (0-10), Reid Colposcopic Index (0-8),
// high-risk HPV genotyping risk stratification, and ASCCP 2019 / WHO consensus management algorithms.

export type CytologyCategory =
  | 'nilm'
  | 'asc_us'
  | 'asc_h'
  | 'lsil'
  | 'hsil'
  | 'scc'
  | 'agc_nos'
  | 'agc_neoplastic'
  | 'ais'
  | 'adenocarcinoma';

export type CytologyAdequacy =
  | 'satisfactory_with_ec_tz'
  | 'satisfactory_without_ec_tz'
  | 'unsatisfactory_obscured'
  | 'unsatisfactory_scant';

export type HpvOverallStatus = 'negative' | 'positive' | 'invalid_inconclusive';

export interface SwedeScoreInput {
  acetowhitening: number; // 0, 1, 2
  margins: number; // 0, 1, 2
  vessels: number; // 0, 1, 2
  lesionSize: number; // 0, 1, 2
  iodineStaining: number; // 0, 1, 2
}

export interface SwedeScoreResult {
  total: number;
  interpretation: 'normal_benign' | 'low_grade_cin1' | 'suspicious_cin2_3' | 'high_probability_cin2_3_cancer';
  title: string;
  summary: string;
  actionGuidance: string;
  color: string;
}

export interface ReidIndexInput {
  margin: number; // 0, 1, 2
  color: number; // 0, 1, 2
  vessels: number; // 0, 1, 2
  iodine: number; // 0, 1, 2
}

export interface ReidIndexResult {
  total: number;
  title: string;
  summary: string;
  color: string;
}

export interface ManagementGuidelineParams {
  papResult?: string | null;
  papAdequacy?: string | null;
  hpvOverall?: string | null;
  hpv16?: boolean;
  hpv18?: boolean;
  hpv45?: boolean;
  hpvOtherHighRisk?: boolean;
  swedeScore?: number | null;
  biopsyResult?: string | null;
  isPregnant?: boolean;
  ageYears?: number | null;
}

export interface ManagementGuidelineResult {
  recommendation: string;
  recallMonths: number;
  urgency: 'routine' | 'priority' | 'urgent';
  clinicalBasis: string;
  precautions: string[];
}

export const BETHESDA_CYTOLOGY_MAP: Record<
  CytologyCategory,
  { label: string; code: string; severity: 'normal' | 'low_grade' | 'high_grade' | 'malignant'; description: string }
> = {
  nilm: {
    label: 'NILM - Negative for Intraepithelial Lesion or Malignancy',
    code: 'NILM',
    severity: 'normal',
    description: 'No cellular evidence of neoplasia. Normal squamous and glandular elements.',
  },
  asc_us: {
    label: 'ASC-US - Atypical Squamous Cells of Undetermined Significance',
    code: 'ASC-US',
    severity: 'low_grade',
    description: 'Cellular abnormalities more marked than reactive changes, but lacking definitive features of LSIL.',
  },
  asc_h: {
    label: 'ASC-H - Atypical Squamous Cells, Cannot Exclude HSIL',
    code: 'ASC-H',
    severity: 'high_grade',
    description: 'Sparse atypical cells suggestive of high-grade intraepithelial lesion; high positive predictive value for CIN 2/3.',
  },
  lsil: {
    label: 'LSIL - Low-Grade Squamous Intraepithelial Lesion',
    code: 'LSIL',
    severity: 'low_grade',
    description: 'Encompasses HPV cytopathic effect (koilocytosis) and mild dysplasia / cervical intraepithelial neoplasia grade 1 (CIN 1).',
  },
  hsil: {
    label: 'HSIL - High-Grade Squamous Intraepithelial Lesion',
    code: 'HSIL',
    severity: 'high_grade',
    description: 'Encompasses moderate and severe dysplasia, carcinoma in situ (CIS), and CIN 2/3. High risk of progression if untreated.',
  },
  scc: {
    label: 'SCC - Squamous Cell Carcinoma',
    code: 'SCC',
    severity: 'malignant',
    description: 'Invasive squamous cell malignancy with marked nuclear pleomorphism, diathesis, and malignant keratinization.',
  },
  agc_nos: {
    label: 'AGC - Atypical Glandular Cells (NOS)',
    code: 'AGC-NOS',
    severity: 'high_grade',
    description: 'Atypical endocervical or endometrial glandular cells not otherwise specified. Associated with cervical or endometrial pathology.',
  },
  agc_neoplastic: {
    label: 'AGC - Atypical Glandular Cells, Favor Neoplasia',
    code: 'AGC-FN',
    severity: 'high_grade',
    description: 'Atypical glandular cells morphology strongly suggestive of adenocarcinoma or premalignant glandular neoplasia.',
  },
  ais: {
    label: 'AIS - Endocervical Adenocarcinoma In Situ',
    code: 'AIS',
    severity: 'high_grade',
    description: 'Precursor to invasive adenocarcinoma of the endocervix; characterized by nuclear hyperchromasia, crowding, and pseudostratification.',
  },
  adenocarcinoma: {
    label: 'Adenocarcinoma (Invasive)',
    code: 'ECA',
    severity: 'malignant',
    description: 'Invasive malignant neoplasm of glandular origin (endocervical, endometrial, or extrauterine).',
  },
};

export const SWEDE_ACETOWHITENING_OPTIONS = [
  { value: 0, label: '0: None or translucent / faint milky white' },
  { value: 1, label: '1: Milky / cloudy white, intermediate opacity' },
  { value: 2, label: '2: Distinct, opaque, dull / porcelain white' },
];

export const SWEDE_MARGIN_OPTIONS = [
  { value: 0, label: '0: Diffuse, indistinct border, feathery edges' },
  { value: 1, label: '1: Clear-cut, sharp, smooth, regular margins' },
  { value: 2, label: '2: Raised, rolled, peeling edges or internal border ("border within border")' },
];

export const SWEDE_VESSEL_OPTIONS = [
  { value: 0, label: '0: Fine regular punctation or fine mosaic, or normal branching capillary network' },
  { value: 1, label: '1: Uniform punctation or mosaic with regular intercapillary distance' },
  { value: 2, label: '2: Coarse irregular punctation, coarse mosaic, or atypical non-branching vessels' },
];

export const SWEDE_SIZE_OPTIONS = [
  { value: 0, label: '0: Small lesion: < 5 mm or < 1 quadrant (< 25% of cervix)' },
  { value: 1, label: '1: Moderate lesion: 5–15 mm or 1–2 quadrants (25–50% of cervix)' },
  { value: 2, label: '2: Large lesion: > 15 mm or > 2 quadrants (> 50%) or endocervical canal extension' },
];

export const SWEDE_IODINE_OPTIONS = [
  { value: 0, label: '0: Brown / mahogany uptake (Lugol positive, normal glycogenated epithelium)' },
  { value: 1, label: '1: Faint yellow / variegated / partial uptake' },
  { value: 2, label: '2: Bright mustard yellow / completely non-staining (Lugol negative)' },
];

export const TRANSFORMATION_ZONE_TYPES = [
  { value: 'type_1', label: 'Type 1 TZ: Completely ectocervical, fully visualized' },
  { value: 'type_2', label: 'Type 2 TZ: Endocervical component present, but fully visualized' },
  { value: 'type_3', label: 'Type 3 TZ: Endocervical component extends into canal, not fully visualized' },
];

/**
 * Calculates Swede Colposcopy Score (0 to 10 points)
 * Validated sensitivity ~100% and specificity ~90% for high-grade cervical lesions (CIN 2+) at score >= 8.
 */
export function calculateSwedeScore(input: SwedeScoreInput): SwedeScoreResult {
  const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(2, Math.round(v))) : 0);
  const a = clamp(input.acetowhitening);
  const m = clamp(input.margins);
  const v = clamp(input.vessels);
  const s = clamp(input.lesionSize);
  const i = clamp(input.iodineStaining);

  const total = a + m + v + s + i;

  if (total <= 2) {
    return {
      total,
      interpretation: 'normal_benign',
      title: 'Normal / Benign Colposcopic Findings',
      summary: `Swede Score: ${total}/10. Very low risk of high-grade disease.`,
      actionGuidance: 'Routine cytology / HPV follow-up per baseline risk. Targeted biopsy optional if focal query persists.',
      color: '#10b981', // green
    };
  }

  if (total <= 4) {
    return {
      total,
      interpretation: 'low_grade_cin1',
      title: 'Likely Low-Grade Lesion (CIN 1)',
      summary: `Swede Score: ${total}/10. Low risk of high-grade disease (high negative predictive value for CIN 2+).`,
      actionGuidance: 'Targeted punch biopsy at densest area optional or conservative follow-up in 12 months.',
      color: '#3b82f6', // blue
    };
  }

  if (total <= 7) {
    return {
      total,
      interpretation: 'suspicious_cin2_3',
      title: 'Suspicious for High-Grade Lesion (CIN 2/3)',
      summary: `Swede Score: ${total}/10. Intermediate risk; elevated likelihood of CIN 2 or CIN 3.`,
      actionGuidance: 'Colposcopy-directed punch biopsies mandatory at worst areas prior to treatment.',
      color: '#f59e0b', // amber
    };
  }

  return {
    total,
    interpretation: 'high_probability_cin2_3_cancer',
    title: 'High Probability of High-Grade Lesion (CIN 2/3) or Microinvasion',
    summary: `Swede Score: ${total}/10. Strongly predictive of CIN 2+ (specificity ~90%+).`,
    actionGuidance: 'Mandatory directed biopsies or consider immediate excisional treatment ("See-and-Treat" LEEP/LLETZ in non-pregnant patients).',
    color: '#ef4444', // red
  };
}

/**
 * Calculates Reid Colposcopic Index (RCI) (0 to 8 points)
 */
export function calculateReidIndex(input: ReidIndexInput): ReidIndexResult {
  const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(2, Math.round(v))) : 0);
  const m = clamp(input.margin);
  const c = clamp(input.color);
  const v = clamp(input.vessels);
  const i = clamp(input.iodine);

  const total = m + c + v + i;

  if (total <= 2) {
    return {
      total,
      title: 'Likely CIN 1 / HPV Subclinical Infection',
      summary: `Reid Colposcopic Index: ${total}/8. Suggestive of low-grade intraepithelial lesion.`,
      color: '#3b82f6',
    };
  }

  if (total <= 5) {
    return {
      total,
      title: 'Intermediate / Overlapping Lesion (CIN 1 – CIN 2)',
      summary: `Reid Colposcopic Index: ${total}/8. Lesion has intermediate features between low and high grade.`,
      color: '#f59e0b',
    };
  }

  return {
    total,
    title: 'Likely High-Grade Lesion (CIN 2–3)',
    summary: `Reid Colposcopic Index: ${total}/8. High-grade lesion with pronounced vascular, margin and color atypia.`,
    color: '#ef4444',
  };
}

/**
 * Evaluates Bethesda Cytology severity and details
 */
export function determineBethesdaRisk(papResult?: string | null) {
  if (!papResult || !(papResult in BETHESDA_CYTOLOGY_MAP)) {
    return {
      grade: 'unknown' as const,
      title: 'Not Specified / Inconclusive',
      shortCode: '—',
      description: 'No standardized cytology interpretation logged.',
    };
  }
  const meta = BETHESDA_CYTOLOGY_MAP[papResult as CytologyCategory];
  return {
    grade: meta.severity,
    title: meta.label,
    shortCode: meta.code,
    description: meta.description,
  };
}

/**
 * Evidence-based clinical action and recall algorithm
 * Complies with ASCCP 2019 Risk-Based Management Guidelines and WHO Cervical Cancer Screening Standards.
 */
export function generateManagementGuideline(params: ManagementGuidelineParams): ManagementGuidelineResult {
  const precautions: string[] = [];
  const pap = (params.papResult ?? '').toLowerCase();
  const hpvOverall = (params.hpvOverall ?? '').toLowerCase();
  const isHpv16Or18 = Boolean(params.hpv16 || params.hpv18);
  const isHpvPositive = hpvOverall === 'positive' || isHpv16Or18 || Boolean(params.hpv45 || params.hpvOtherHighRisk);
  const biopsy = (params.biopsyResult ?? '').toLowerCase();
  const swede = params.swedeScore ?? null;

  if (params.isPregnant) {
    precautions.push('Patient is pregnant: Endocervical Curettage (ECC) and endometrial sampling are strictly CONTRAINDICATED.');
    precautions.push('Diagnostic cervical conization/LEEP should be avoided during pregnancy unless invasive cancer is suspected.');
  }

  // 1. Biopsy Confirmed Outcomes
  if (biopsy.includes('scc') || biopsy.includes('squamous_cell_carcinoma') || biopsy.includes('adenocarcinoma')) {
    return {
      recommendation: 'Immediate Gynecologic Oncology Referral for Staging and Multidisciplinary Oncology Management',
      recallMonths: 1,
      urgency: 'urgent',
      clinicalBasis: 'Histopathology confirms invasive cervical malignancy.',
      precautions,
    };
  }

  if (biopsy.includes('cin_3') || biopsy.includes('cin_2')) {
    if (params.isPregnant) {
      precautions.push('Pregnancy: Delay therapeutic excisional treatment until 6 weeks postpartum with serial colposcopic surveillance each trimester.');
      return {
        recommendation: 'Antepartum Colposcopic Surveillance Every 12–24 Weeks; Postpartum Excision (LEEP/CKC) at 6–8 Weeks',
        recallMonths: 3,
        urgency: 'priority',
        clinicalBasis: 'Histopathology confirms high-grade cervical dysplasia (CIN 2/3) in pregnancy.',
        precautions,
      };
    }
    return {
      recommendation: 'Cervical Excisional Procedure (LEEP / LLETZ or Cold Knife Conization) Indicated',
      recallMonths: 3,
      urgency: 'priority',
      clinicalBasis: 'Histopathology confirms high-grade precancerous lesion (CIN 2/3). Treatment is necessary to prevent progression to invasive cervical cancer.',
      precautions,
    };
  }

  if (biopsy.includes('cin_1')) {
    return {
      recommendation: 'Conservative Observation with Repeat HPV DNA & Cytology Cotesting in 12 Months',
      recallMonths: 12,
      urgency: 'routine',
      clinicalBasis: 'Histopathology confirms low-grade lesion (CIN 1). Most low-grade lesions regress spontaneously under host immune clearance.',
      precautions,
    };
  }

  // 2. Cytology-specific High-Risk Alerts
  if (pap === 'scc' || pap === 'adenocarcinoma') {
    return {
      recommendation: 'Urgent Colposcopy with Multiple Directed Biopsies & Gynecologic Oncology Consultation',
      recallMonths: 1,
      urgency: 'urgent',
      clinicalBasis: 'Cytology reports frank invasive malignancy (SCC / Adenocarcinoma). Immediate histopathological diagnosis is required.',
      precautions,
    };
  }

  if (pap === 'hsil' || pap === 'ais' || pap === 'agc_neoplastic') {
    if (swede !== null && swede >= 8 && !params.isPregnant) {
      return {
        recommendation: 'Immediate "See-and-Treat" Excisional LEEP or Directed Punch Biopsy',
        recallMonths: 1,
        urgency: 'priority',
        clinicalBasis: `Cytology ${pap.toUpperCase()} accompanied by high Swede Colposcopic Score (${swede}/10) yields >90% predictive value for CIN 2+.`,
        precautions,
      };
    }
    return {
      recommendation: 'Prompt Colposcopy with Directed Cervical Punch Biopsies (and ECC in non-pregnant patients)',
      recallMonths: 1,
      urgency: 'priority',
      clinicalBasis: `High-grade cytology (${pap.toUpperCase()}) carries a 50–70% immediate risk of CIN 2+ and requires thorough colposcopic evaluation.`,
      precautions,
    };
  }

  // 3. High-risk HPV Genotyping Stratification
  if (isHpv16Or18) {
    const genotypes = [params.hpv16 ? 'HPV 16' : null, params.hpv18 ? 'HPV 18' : null].filter(Boolean).join(' and ');
    return {
      recommendation: 'Colposcopy Recommended based on Oncogenic Genotype Risk',
      recallMonths: 3,
      urgency: 'priority',
      clinicalBasis: `High-risk ${genotypes} positive: Genotypes 16 and 18 account for >70% of cervical cancers and warrant colposcopy even with negative cytology.`,
      precautions,
    };
  }

  if (pap === 'asc_h' || pap === 'agc_nos') {
    return {
      recommendation: 'Colposcopy Recommended (with Endocervical Sampling & Endometrial Biopsy if age >= 35 or abnormal bleeding)',
      recallMonths: 3,
      urgency: 'priority',
      clinicalBasis: 'Atypical cytology (ASC-H or AGC) requires colposcopic investigation to rule out occult high-grade squamous or endocervical neoplasia.',
      precautions,
    };
  }

  if (pap === 'lsil' || (pap === 'asc_us' && isHpvPositive)) {
    return {
      recommendation: 'Colposcopy Recommended',
      recallMonths: 3,
      urgency: 'priority',
      clinicalBasis: isHpvPositive
        ? `Co-test positive: ${pap.toUpperCase()} with high-risk HPV detection indicates persistent viral dysplasia.`
        : 'LSIL cytology indicates viral cytopathic effect / CIN 1 needing colposcopic mapping.',
      precautions,
    };
  }

  if (pap === 'asc_us' && hpvOverall === 'negative') {
    return {
      recommendation: 'Repeat HPV and Cytology Cotesting in 3 Years',
      recallMonths: 36,
      urgency: 'routine',
      clinicalBasis: 'ASC-US with high-risk HPV negative confers a very low 5-year risk of CIN 3+ (< 0.5%).',
      precautions,
    };
  }

  if (isHpvPositive && (pap === 'nilm' || !pap)) {
    return {
      recommendation: 'Repeat HPV and Cytology Cotesting in 12 Months',
      recallMonths: 12,
      urgency: 'routine',
      clinicalBasis: 'High-risk HPV positive (non-16/18) with normal cytology: 12-month cotest allows time for spontaneous immune clearance.',
      precautions,
    };
  }

  if (params.papAdequacy === 'unsatisfactory_scant' || params.papAdequacy === 'unsatisfactory_obscured') {
    return {
      recommendation: 'Repeat Pap Cytology Smear in 2 to 4 Months',
      recallMonths: 3,
      urgency: 'routine',
      clinicalBasis: 'Previous specimen was unsatisfactory for cytologic evaluation due to obscuring factors or low cellularity.',
      precautions,
    };
  }

  // 4. Completely Normal / Negative
  if (pap === 'nilm' && (hpvOverall === 'negative' || !hpvOverall)) {
    return {
      recommendation: 'Routine Cervical Cancer Screening (Cotesting in 5 Years or Cytology Smear in 3 Years)',
      recallMonths: 60,
      urgency: 'routine',
      clinicalBasis: 'Normal cytology (NILM) and negative high-risk HPV provide excellent reassurance for 5 years.',
      precautions,
    };
  }

  // Default Fallback
  return {
    recommendation: 'Clinical Review & Follow-up in 12 Months',
    recallMonths: 12,
    urgency: 'routine',
    clinicalBasis: 'Continue individualized cervical screening based on clinical history and symptom progression.',
    precautions,
  };
}

export const CERVICAL_CLOCK_POSITIONS = [
  { clock: 12, angleDeg: 270, label: "12 o'clock (Anterior)" },
  { clock: 1, angleDeg: 300, label: "1 o'clock" },
  { clock: 2, angleDeg: 330, label: "2 o'clock" },
  { clock: 3, angleDeg: 0, label: "3 o'clock (Right Lateral)" },
  { clock: 4, angleDeg: 30, label: "4 o'clock" },
  { clock: 5, angleDeg: 60, label: "5 o'clock" },
  { clock: 6, angleDeg: 90, label: "6 o'clock (Posterior)" },
  { clock: 7, angleDeg: 120, label: "7 o'clock" },
  { clock: 8, angleDeg: 150, label: "8 o'clock" },
  { clock: 9, angleDeg: 180, label: "9 o'clock (Left Lateral)" },
  { clock: 10, angleDeg: 210, label: "10 o'clock" },
  { clock: 11, angleDeg: 240, label: "11 o'clock" },
];
