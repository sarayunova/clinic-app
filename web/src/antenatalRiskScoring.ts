/**
 * Antenatal High-Risk Assessment & Scoring Engine
 * Implements:
 * - NICE NG133 & ACOG Practice Bulletin Pre-eclampsia Risk Stratification & Aspirin Prophylaxis
 * - RCOG Green-top Guideline No. 37a Obstetric VTE Risk Scoring & Thromboprophylaxis
 * - DIPSI / FIGO / ADA Gestational Diabetes Mellitus (GDM) Risk & Plasma Glucose Cutoffs
 * - Preterm Birth (PTB) & Cervical Insufficiency Risk Protocols
 */

// ==========================================
// 1. Pre-eclampsia (PE) Risk Factors & Logic
// ==========================================

export interface PreEclampsiaFactor {
  key: string;
  category: 'high' | 'moderate';
  label: string;
  description: string;
}

export const PE_FACTORS: PreEclampsiaFactor[] = [
  // High-Risk Factors (NICE / ACOG) - 1 factor triggers Aspirin
  {
    key: 'prior_pe',
    category: 'high',
    label: 'Prior Hypertensive Disease in Pregnancy',
    description: 'Pre-eclampsia, eclampsia, or gestational hypertension in a prior pregnancy',
  },
  {
    key: 'chronic_htn',
    category: 'high',
    label: 'Chronic / Pre-existing Hypertension',
    description: 'Hypertension diagnosed prior to pregnancy or before 20 weeks gestation',
  },
  {
    key: 'chronic_kidney',
    category: 'high',
    label: 'Chronic Kidney Disease (CKD)',
    description: 'Pre-existing renal disease or proteinuria',
  },
  {
    key: 'autoimmune_sle_aps',
    category: 'high',
    label: 'Autoimmune Disease (SLE / APS)',
    description: 'Systemic Lupus Erythematosus or Antiphospholipid Syndrome',
  },
  {
    key: 'diabetes_pregestational',
    category: 'high',
    label: 'Pre-gestational Diabetes Mellitus',
    description: 'Type 1 or Type 2 Diabetes diagnosed prior to conception',
  },

  // Moderate-Risk Factors (NICE / ACOG) - 2 factors trigger Aspirin
  {
    key: 'nulliparity',
    category: 'moderate',
    label: 'Nulliparity (First Pregnancy)',
    description: 'Primigravida / first ongoing gestation',
  },
  {
    key: 'age_ge_35',
    category: 'moderate',
    label: 'Maternal Age ≥ 35 Years',
    description: 'Advanced maternal age at booking / conception',
  },
  {
    key: 'pregnancy_interval_gt_10',
    category: 'moderate',
    label: 'Interpregnancy Interval > 10 Years',
    description: 'More than 10 years elapsed since previous delivery',
  },
  {
    key: 'bmi_ge_35',
    category: 'moderate',
    label: 'Booking BMI ≥ 35 kg/m²',
    description: 'Class II or III maternal obesity at first antenatal visit',
  },
  {
    key: 'family_history_pe',
    category: 'moderate',
    label: 'Family History of Pre-eclampsia',
    description: 'First-degree relative (mother or sister) had pre-eclampsia',
  },
  {
    key: 'multiple_pregnancy_pe',
    category: 'moderate',
    label: 'Multiple Gestation (Twins / Triplets)',
    description: 'Multi-fetal intrauterine pregnancy',
  },
];

export interface PeRiskEvaluation {
  level: 'low' | 'moderate' | 'high';
  aspirinIndicated: boolean;
  calciumIndicated: boolean;
  highCount: number;
  moderateCount: number;
  dosageAdvice: string;
  rationale: string;
}

export function evaluatePreEclampsiaRisk(selectedKeys: string[]): PeRiskEvaluation {
  const selectedSet = new Set(selectedKeys);
  const highFactors = PE_FACTORS.filter((f) => f.category === 'high' && selectedSet.has(f.key));
  const moderateFactors = PE_FACTORS.filter((f) => f.category === 'moderate' && selectedSet.has(f.key));

  const highCount = highFactors.length;
  const moderateCount = moderateFactors.length;

  if (highCount >= 1 || moderateCount >= 2) {
    return {
      level: 'high',
      aspirinIndicated: true,
      calciumIndicated: true,
      highCount,
      moderateCount,
      dosageAdvice: 'Aspirin 150 mg PO nightly from 12 weeks until 36 weeks gestation',
      rationale:
        highCount >= 1
          ? `High Risk: ${highCount} major factor(s) present (${highFactors.map((f) => f.label).join(', ')})`
          : `High Risk: ${moderateCount} moderate factors present (${moderateFactors.map((f) => f.label).join(', ')})`,
    };
  }

  if (moderateCount === 1) {
    return {
      level: 'moderate',
      aspirinIndicated: false,
      calciumIndicated: true,
      highCount: 0,
      moderateCount: 1,
      dosageAdvice: 'Aspirin not strictly indicated unless additional risk factor emerges',
      rationale: `Moderate Risk: Single moderate factor (${moderateFactors[0]?.label || ''}). Regular BP and urinalysis surveillance advised.`,
    };
  }

  return {
    level: 'low',
    aspirinIndicated: false,
    calciumIndicated: false,
    highCount: 0,
    moderateCount: 0,
    dosageAdvice: 'Routine antenatal blood pressure monitoring',
    rationale: 'Low Risk: No major or moderate pre-eclampsia risk factors identified.',
  };
}

// ==========================================
// 2. VTE Thromboprophylaxis Risk (RCOG 37a)
// ==========================================

export interface VteFactor {
  key: string;
  points: number;
  label: string;
  category: 'pre_existing' | 'obstetric' | 'transient';
}

export const VTE_FACTORS: VteFactor[] = [
  // High-Risk Pre-existing (3–4 points)
  {
    key: 'prev_vte_unprovoked',
    points: 4,
    label: 'Previous VTE (Unprovoked or Estrogen-related)',
    category: 'pre_existing',
  },
  {
    key: 'prev_vte_provoked',
    points: 3,
    label: 'Previous VTE (Provoked by non-estrogen transient factor)',
    category: 'pre_existing',
  },
  {
    key: 'high_risk_thrombophilia',
    points: 3,
    label: 'Known High-Risk Thrombophilia (AT-III, Protein C/S, Compound FVL)',
    category: 'pre_existing',
  },
  {
    key: 'medical_comorbidity',
    points: 3,
    label: 'Medical Comorbidity (Active Cancer, Heart Failure, Active SLE, Sickle Cell)',
    category: 'pre_existing',
  },
  {
    key: 'surgical_procedure',
    points: 3,
    label: 'Surgical Procedure during Pregnancy (e.g. Laparotomy, Appendectomy)',
    category: 'transient',
  },

  // Moderate & Obstetric Factors (1–2 points)
  {
    key: 'obesity_bmi_ge_40',
    points: 2,
    label: 'Severe Obesity (Booking BMI ≥ 40 kg/m²)',
    category: 'pre_existing',
  },
  {
    key: 'obesity_bmi_30_39',
    points: 1,
    label: 'Obesity (Booking BMI 30–39.9 kg/m²)',
    category: 'pre_existing',
  },
  {
    key: 'age_gt_35',
    points: 1,
    label: 'Age > 35 Years',
    category: 'pre_existing',
  },
  {
    key: 'parity_ge_3',
    points: 1,
    label: 'Parity ≥ 3 (Grand Multipara)',
    category: 'obstetric',
  },
  {
    key: 'smoking',
    points: 1,
    label: 'Active Smoker (> 10 cigarettes/day)',
    category: 'transient',
  },
  {
    key: 'gross_varicose_veins',
    points: 1,
    label: 'Gross or Symptomatic Varicose Veins',
    category: 'pre_existing',
  },
  {
    key: 'multiple_pregnancy_vte',
    points: 1,
    label: 'Multiple Pregnancy (Twins / Higher order)',
    category: 'obstetric',
  },
  {
    key: 'pre_eclampsia_vte',
    points: 1,
    label: 'Pre-eclampsia in Current Pregnancy',
    category: 'obstetric',
  },
  {
    key: 'art_ivf',
    points: 1,
    label: 'Assisted Reproductive Technology (IVF / ICSI)',
    category: 'obstetric',
  },
  {
    key: 'immobility_travel',
    points: 1,
    label: 'Immobility (Bed rest > 3 days or Long-haul travel > 4 hrs)',
    category: 'transient',
  },
  {
    key: 'hyperemesis_dehydration',
    points: 1,
    label: 'Hyperemesis Gravidarum / Severe Dehydration',
    category: 'transient',
  },
];

export interface VteRiskEvaluation {
  score: number;
  level: 'low' | 'low_moderate' | 'intermediate' | 'high';
  recommendation: string;
  lmwhTiming: string;
}

export function evaluateVteRisk(selectedKeys: string[]): VteRiskEvaluation {
  const selectedSet = new Set(selectedKeys);
  let totalScore = 0;

  for (const factor of VTE_FACTORS) {
    if (selectedSet.has(factor.key)) {
      totalScore += factor.points;
    }
  }

  if (totalScore >= 4) {
    return {
      score: totalScore,
      level: 'high',
      recommendation:
        'High Risk (Score ≥ 4): Antenatal LMWH thromboprophylaxis indicated from 1st trimester throughout pregnancy and for at least 6 weeks postpartum.',
      lmwhTiming: 'Antenatal from 1st trimester + 6 weeks postpartum LMWH',
    };
  }

  if (totalScore === 3) {
    return {
      score: totalScore,
      level: 'intermediate',
      recommendation:
        'Intermediate Risk (Score = 3): Antenatal LMWH thromboprophylaxis indicated starting from 28 weeks gestation until delivery, and for at least 10 days postpartum.',
      lmwhTiming: 'Antenatal from 28 weeks + 10 days postpartum LMWH',
    };
  }

  if (totalScore === 2) {
    return {
      score: totalScore,
      level: 'low_moderate',
      recommendation:
        'Low-Moderate Risk (Score = 2): Antenatal LMWH not routinely indicated unless admitted. Postpartum LMWH thromboprophylaxis recommended for 10 days.',
      lmwhTiming: 'Postpartum LMWH for 10 days',
    };
  }

  return {
    score: totalScore,
    level: 'low',
    recommendation:
      'Low Risk (Score < 2): Routine mobilization, avoid dehydration, re-assess if admitted or complications arise.',
    lmwhTiming: 'None (Mobilization & Hydration)',
  };
}

// ==========================================
// 3. Gestational Diabetes Mellitus (GDM)
// ==========================================

export interface GdmFactor {
  key: string;
  label: string;
  highRisk: boolean;
}

export const GDM_FACTORS: GdmFactor[] = [
  { key: 'prior_gdm', label: 'Previous Gestational Diabetes (Prior GDM)', highRisk: true },
  { key: 'prior_macrosomia', label: 'Previous Macrosomic Infant (Birth weight ≥ 4.0 kg)', highRisk: true },
  { key: 'family_history_dm', label: 'First-degree Relative with Diabetes (Parent/Sibling)', highRisk: true },
  { key: 'bmi_ge_30', label: 'Pre-pregnancy or Booking BMI ≥ 30 kg/m² (≥ 25 in Asian women)', highRisk: true },
  { key: 'pcos', label: 'Polycystic Ovarian Syndrome (PCOS)', highRisk: true },
  { key: 'unexplained_stillbirth_loss', label: 'History of Unexplained Stillbirth or Recurrent Loss', highRisk: true },
  { key: 'maternal_age_ge_25', label: 'Maternal Age ≥ 25 Years (High-prevalence population)', highRisk: false },
];

export interface GdmRiskEvaluation {
  riskLevel: 'standard' | 'high';
  screeningAdvice: string;
  diagnosisStatus: 'not_tested' | 'pending' | 'normal' | 'gdm_confirmed';
  diagnosisDetail?: string;
}

export function evaluateGdmRisk(
  selectedKeys: string[],
  testValues?: {
    fasting?: number | null;
    oneHour?: number | null;
    twoHour?: number | null;
  }
): GdmRiskEvaluation {
  const selectedSet = new Set(selectedKeys);
  const hasHighRiskFactor = GDM_FACTORS.some((f) => f.highRisk && selectedSet.has(f.key));
  const riskLevel = hasHighRiskFactor ? 'high' : 'standard';

  const screeningAdvice =
    riskLevel === 'high'
      ? 'High Risk: Early 75g 2-hour OGTT / DIPSI recommended at 12–16 weeks. If normal, repeat routine testing at 24–28 weeks.'
      : 'Standard Risk: Universal 75g 2-hour OGTT / DIPSI screening recommended at 24–28 weeks gestation.';

  // If plasma glucose values entered:
  if (testValues) {
    const f = testValues.fasting;
    const h1 = testValues.oneHour;
    const h2 = testValues.twoHour;

    if (f != null || h1 != null || h2 != null) {
      // Diagnostic cutoffs (IADPSG / WHO / DIPSI):
      // Fasting >= 92 mg/dL, 1-hour >= 180 mg/dL, 2-hour >= 140 mg/dL (or DIPSI non-fasting 2h >= 140 mg/dL)
      const fAbnormal = f != null && f >= 92;
      const h1Abnormal = h1 != null && h1 >= 180;
      const h2Abnormal = h2 != null && h2 >= 140;

      if (fAbnormal || h1Abnormal || h2Abnormal) {
        const triggers: string[] = [];
        if (fAbnormal) triggers.push(`Fasting: ${f} mg/dL (≥92)`);
        if (h1Abnormal) triggers.push(`1-Hour: ${h1} mg/dL (≥180)`);
        if (h2Abnormal) triggers.push(`2-Hour: ${h2} mg/dL (≥140)`);

        return {
          riskLevel,
          screeningAdvice,
          diagnosisStatus: 'gdm_confirmed',
          diagnosisDetail: `Gestational Diabetes Mellitus Confirmed: ${triggers.join(', ')}. Initiate Medical Nutrition Therapy (MNT) and self-monitoring of blood glucose.`,
        };
      }

      return {
        riskLevel,
        screeningAdvice,
        diagnosisStatus: 'normal',
        diagnosisDetail: `Euglycemic / Normal OGTT (Fasting < 92, 1h < 180, 2h < 140 mg/dL). Repeat at 24–28 weeks if tested early.`,
      };
    }
  }

  return {
    riskLevel,
    screeningAdvice,
    diagnosisStatus: 'not_tested',
  };
}

// ==========================================
// 4. Preterm Birth & Cervical Risk
// ==========================================

export interface PtbFactor {
  key: string;
  label: string;
  highRisk: boolean;
}

export const PTB_FACTORS: PtbFactor[] = [
  { key: 'prior_spontaneous_ptb', label: 'Previous Spontaneous Preterm Birth (< 37 weeks)', highRisk: true },
  { key: 'prior_cervical_loss', label: 'Prior 2nd Trimester Painless Pregnancy Loss (16–24 weeks)', highRisk: true },
  { key: 'cervical_excision', label: 'Previous Cervical Cone Biopsy, LEEP, or Trachelectomy', highRisk: true },
  { key: 'uterine_malformation', label: 'Uterine Anomaly (Bicornuate, Septate, or Didelphic Uterus)', highRisk: true },
  { key: 'multiple_gestation_ptb', label: 'Multiple Pregnancy (Twin or Triplet Gestation)', highRisk: true },
  { key: 'cervical_length_lt_25', label: 'Current Ultrasound Cervical Length < 25 mm on TVS', highRisk: true },
];

export interface PtbRiskEvaluation {
  riskLevel: 'low' | 'high';
  progesteroneIndicated: boolean;
  cerclageEvaluation: boolean;
  surveillancePlan: string;
}

export function evaluatePtbRisk(selectedKeys: string[]): PtbRiskEvaluation {
  const selectedSet = new Set(selectedKeys);
  const matched = PTB_FACTORS.filter((f) => selectedSet.has(f.key));

  if (matched.length > 0) {
    return {
      riskLevel: 'high',
      progesteroneIndicated: true,
      cerclageEvaluation: selectedSet.has('prior_cervical_loss') || selectedSet.has('cervical_length_lt_25'),
      surveillancePlan:
        'High Preterm Birth Risk: Micronized Vaginal Progesterone 200 mg nightly from 16 to 36 weeks. Serial Transvaginal Cervical Length scans every 2 weeks from 16 to 24 weeks.',
    };
  }

  return {
    riskLevel: 'low',
    progesteroneIndicated: false,
    cerclageEvaluation: false,
    surveillancePlan: 'Low Risk: Routine anatomical survey and cervical assessment at 18–22 weeks.',
  };
}

// ==========================================
// 5. Overall Risk Aggregator
// ==========================================

export function evaluateOverallRisk(
  pe: PeRiskEvaluation,
  vte: VteRiskEvaluation,
  gdm: GdmRiskEvaluation,
  ptb: PtbRiskEvaluation
): {
  overallLevel: 'low_risk' | 'moderate_risk' | 'high_risk';
  reasons: string[];
  prophylaxisSummary: string[];
} {
  const reasons: string[] = [];
  const prophylaxisSummary: string[] = [];

  let isHigh = false;
  let isModerate = false;

  if (pe.level === 'high') {
    isHigh = true;
    reasons.push(pe.rationale);
    prophylaxisSummary.push('Aspirin 150 mg nightly (12–36w)');
    if (pe.calciumIndicated) prophylaxisSummary.push('Elemental Calcium 1.0–1.5 g daily');
  } else if (pe.level === 'moderate') {
    isModerate = true;
    reasons.push(pe.rationale);
  }

  if (vte.level === 'high' || vte.level === 'intermediate') {
    isHigh = true;
    reasons.push(`VTE Score ${vte.score} (${vte.lmwhTiming})`);
    prophylaxisSummary.push(vte.lmwhTiming);
  } else if (vte.level === 'low_moderate') {
    isModerate = true;
    reasons.push(`VTE Score ${vte.score} (Postpartum LMWH indicated)`);
  }

  if (gdm.diagnosisStatus === 'gdm_confirmed') {
    isHigh = true;
    reasons.push('Gestational Diabetes Mellitus Confirmed');
    prophylaxisSummary.push('GDM Protocol: Medical Nutrition Therapy ± Metformin/Insulin');
  } else if (gdm.riskLevel === 'high') {
    isModerate = true;
    reasons.push('High Risk for GDM (Early OGTT indicated)');
  }

  if (ptb.riskLevel === 'high') {
    isHigh = true;
    reasons.push('High Risk for Spontaneous Preterm Birth / Cervical Insufficiency');
    prophylaxisSummary.push('Vaginal Progesterone 200 mg nightly + Serial CL Scans');
  }

  const overallLevel = isHigh ? 'high_risk' : isModerate ? 'moderate_risk' : 'low_risk';

  return {
    overallLevel,
    reasons,
    prophylaxisSummary,
  };
}
