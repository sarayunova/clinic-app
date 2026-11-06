export interface LabParamMeta {
  key: string;
  name: string;
  unit: string;
  defaultCategory: 'hematology' | 'thyroid' | 'iron' | 'glucose' | 'renal_pre_eclampsia';
  trimesterRanges: {
    t1: { min: number; max: number; label: string };
    t2: { min: number; max: number; label: string };
    t3: { min: number; max: number; label: string };
  };
}

export const ANTENATAL_LAB_PARAMS: Record<string, LabParamMeta> = {
  hb: {
    key: 'hb',
    name: 'Hemoglobin (Hb)',
    unit: 'g/dL',
    defaultCategory: 'hematology',
    trimesterRanges: {
      t1: { min: 11.0, max: 15.0, label: '≥ 11.0 g/dL' },
      t2: { min: 10.5, max: 14.5, label: '≥ 10.5 g/dL (Physiologic Hemodilution)' },
      t3: { min: 11.0, max: 15.0, label: '≥ 11.0 g/dL' },
    },
  },
  platelets: {
    key: 'platelets',
    name: 'Platelet Count',
    unit: '×10³/µL',
    defaultCategory: 'hematology',
    trimesterRanges: {
      t1: { min: 150, max: 450, label: '150 – 450 ×10³/µL' },
      t2: { min: 150, max: 450, label: '150 – 450 ×10³/µL' },
      t3: { min: 150, max: 450, label: '150 – 450 ×10³/µL (≥100k Mild Gestational)' },
    },
  },
  tsh: {
    key: 'tsh',
    name: 'TSH (Thyroid Stimulating Hormone)',
    unit: 'mIU/L',
    defaultCategory: 'thyroid',
    trimesterRanges: {
      t1: { min: 0.1, max: 2.5, label: '0.1 – 2.5 mIU/L' },
      t2: { min: 0.2, max: 3.0, label: '0.2 – 3.0 mIU/L' },
      t3: { min: 0.3, max: 3.0, label: '0.3 – 3.0 mIU/L' },
    },
  },
  ft4: {
    key: 'ft4',
    name: 'Free T4 (FT4)',
    unit: 'ng/dL',
    defaultCategory: 'thyroid',
    trimesterRanges: {
      t1: { min: 0.8, max: 1.5, label: '0.8 – 1.5 ng/dL' },
      t2: { min: 0.7, max: 1.3, label: '0.7 – 1.3 ng/dL' },
      t3: { min: 0.6, max: 1.2, label: '0.6 – 1.2 ng/dL' },
    },
  },
  ferritin: {
    key: 'ferritin',
    name: 'Serum Ferritin',
    unit: 'ng/mL',
    defaultCategory: 'iron',
    trimesterRanges: {
      t1: { min: 30, max: 200, label: '30 – 200 ng/mL (<30 Iron Deficiency)' },
      t2: { min: 30, max: 200, label: '30 – 200 ng/mL (<15 Depleted Stores)' },
      t3: { min: 30, max: 200, label: '30 – 200 ng/mL' },
    },
  },
  ogtt_fasting: {
    key: 'ogtt_fasting',
    name: '75g OGTT — Fasting Glucose',
    unit: 'mg/dL',
    defaultCategory: 'glucose',
    trimesterRanges: {
      t1: { min: 70, max: 91, label: '< 92 mg/dL (DIPSI / IADPSG)' },
      t2: { min: 70, max: 91, label: '< 92 mg/dL (Normal Fasting)' },
      t3: { min: 70, max: 91, label: '< 92 mg/dL' },
    },
  },
  ogtt_1hr: {
    key: 'ogtt_1hr',
    name: '75g OGTT — 1 Hour Glucose',
    unit: 'mg/dL',
    defaultCategory: 'glucose',
    trimesterRanges: {
      t1: { min: 70, max: 179, label: '< 180 mg/dL' },
      t2: { min: 70, max: 179, label: '< 180 mg/dL' },
      t3: { min: 70, max: 179, label: '< 180 mg/dL' },
    },
  },
  ogtt_2hr: {
    key: 'ogtt_2hr',
    name: '75g OGTT — 2 Hour Glucose',
    unit: 'mg/dL',
    defaultCategory: 'glucose',
    trimesterRanges: {
      t1: { min: 70, max: 139, label: '< 140 mg/dL (≥140 diagnostic of GDM)' },
      t2: { min: 70, max: 139, label: '< 140 mg/dL (Diagnostic Cutoff)' },
      t3: { min: 70, max: 139, label: '< 140 mg/dL' },
    },
  },
  hba1c: {
    key: 'hba1c',
    name: 'HbA1c (Glycated Hemoglobin)',
    unit: '%',
    defaultCategory: 'glucose',
    trimesterRanges: {
      t1: { min: 4.0, max: 5.9, label: '< 6.0% (Target in Pregnancy)' },
      t2: { min: 4.0, max: 5.9, label: '< 6.0%' },
      t3: { min: 4.0, max: 5.9, label: '< 6.0%' },
    },
  },
  uric_acid: {
    key: 'uric_acid',
    name: 'Serum Uric Acid',
    unit: 'mg/dL',
    defaultCategory: 'renal_pre_eclampsia',
    trimesterRanges: {
      t1: { min: 2.0, max: 4.5, label: '< 4.5 mg/dL' },
      t2: { min: 2.0, max: 5.0, label: '< 5.0 mg/dL' },
      t3: { min: 2.5, max: 5.5, label: '< 5.5 mg/dL (≥5.5 Pre-eclampsia Marker)' },
    },
  },
  serum_creatinine: {
    key: 'serum_creatinine',
    name: 'Serum Creatinine',
    unit: 'mg/dL',
    defaultCategory: 'renal_pre_eclampsia',
    trimesterRanges: {
      t1: { min: 0.4, max: 0.8, label: '0.4 – 0.8 mg/dL (Pregnancy GFR elevated)' },
      t2: { min: 0.4, max: 0.8, label: '0.4 – 0.8 mg/dL' },
      t3: { min: 0.4, max: 0.9, label: '0.4 – 0.9 mg/dL' },
    },
  },
  upcr: {
    key: 'upcr',
    name: 'Urine Protein-to-Creatinine Ratio (UPCR)',
    unit: 'mg/mg',
    defaultCategory: 'renal_pre_eclampsia',
    trimesterRanges: {
      t1: { min: 0, max: 0.29, label: '< 0.30 mg/mg (≥0.30 Significant Proteinuria)' },
      t2: { min: 0, max: 0.29, label: '< 0.30 mg/mg' },
      t3: { min: 0, max: 0.29, label: '< 0.30 mg/mg' },
    },
  },
};

export type TrimesterKey = 't1' | 't2' | 't3';

export function getTrimesterFromWeeks(weeks?: number | null): TrimesterKey {
  if (!weeks || weeks < 13) return 't1';
  if (weeks < 28) return 't2';
  return 't3';
}

/** Automatically evaluates abnormal flag based on trimester-specific reference range */
export function evaluateLabFlag(
  paramKey: string,
  value: number,
  trimester: TrimesterKey = 't1'
): 'normal' | 'low' | 'high' | 'critical' {
  const meta = ANTENATAL_LAB_PARAMS[paramKey];
  if (!meta) return 'normal';

  const range = meta.trimesterRanges[trimester] || meta.trimesterRanges.t1;

  if (paramKey === 'hb') {
    if (value < 7.0) return 'critical'; // Severe anemia
    if (value < range.min) return 'low';
    return 'normal';
  }

  if (paramKey === 'platelets') {
    if (value < 50) return 'critical'; // Severe thrombocytopenia
    if (value < 100) return 'low';
    if (value < 150) return 'low';
    if (value > range.max) return 'high';
    return 'normal';
  }

  if (paramKey === 'tsh') {
    if (value > 10.0) return 'critical';
    if (value > range.max) return 'high';
    if (value < range.min) return 'low';
    return 'normal';
  }

  if (paramKey.startsWith('ogtt_') || paramKey === 'ppbs') {
    if (value >= range.max + 50) return 'critical';
    if (value > range.max) return 'high';
    return 'normal';
  }

  if (paramKey === 'ferritin') {
    if (value < 15) return 'critical'; // Depleted stores
    if (value < range.min) return 'low';
    return 'normal';
  }

  if (paramKey === 'upcr' || paramKey === 'uric_acid') {
    if (value > range.max) return 'high';
    return 'normal';
  }

  if (value < range.min) return 'low';
  if (value > range.max) return 'high';
  return 'normal';
}

/** Severity analysis for maternal anemia */
export function classifyAnemia(hb: number, trimester: TrimesterKey = 't1'): string | null {
  const threshold = trimester === 't2' ? 10.5 : 11.0;
  if (hb >= threshold) return null;
  if (hb < 7.0) return 'Severe Anemia (Hb < 7.0 g/dL) — Urgent Blood / Parenteral Iron FCM Indicated';
  if (hb < 10.0) return 'Moderate Anemia (Hb 7.0 – 9.9 g/dL) — IV FCM or High-Dose Oral Iron';
  return 'Mild Anemia (Hb 10.0 – 10.9 g/dL) — Oral Iron Prophylaxis / Therapy';
}

/** Severity analysis for thrombocytopenia */
export function classifyThrombocytopenia(platelets: number): string | null {
  if (platelets >= 150) return null;
  if (platelets < 50) return 'Severe Thrombocytopenia (< 50k) — High bleeding risk, avoid regional anesthesia';
  if (platelets < 100) return 'Moderate Thrombocytopenia (50k – 99k) — Work up for Pre-eclampsia / ITP';
  return 'Mild / Gestational Thrombocytopenia (100k – 149k) — Benign surveillance';
}

/** Milestone screening reminders by gestational age */
export interface MilestoneReminder {
  key: string;
  title: string;
  dueWeeks: string;
  minWeeks: number;
  maxWeeks: number;
  rationale: string;
  isDue: boolean;
  isOverdue: boolean;
}

export function evaluateAntenatalReminders(currentWeeks?: number | null): MilestoneReminder[] {
  const w = currentWeeks || 0;

  return [
    {
      key: 'booking_serology',
      title: 'Booking Infectious Disease & Blood Group Panel',
      dueWeeks: '≤ 12 Weeks (Booking Visit)',
      minWeeks: 6,
      maxWeeks: 14,
      rationale: 'Blood group & Rh, ICT antibody screen, HIV, HBsAg, VDRL, Rubella IgG, Hb HPLC, TSH',
      isDue: w >= 6 && w <= 14,
      isOverdue: w > 14,
    },
    {
      key: 'ogtt_screening',
      title: '75g Oral Glucose Tolerance Test (OGTT / DIPSI)',
      dueWeeks: '24 – 28 Weeks',
      minWeeks: 24,
      maxWeeks: 28,
      rationale: 'Universal gestational diabetes (GDM) screening with 75g glucose load',
      isDue: w >= 24 && w <= 28,
      isOverdue: w > 28,
    },
    {
      key: 'repeat_hb_ict_28w',
      title: '28-Week Repeat CBC & Indirect Coombs Test (ICT)',
      dueWeeks: '28 Weeks',
      minWeeks: 27,
      maxWeeks: 30,
      rationale: 'Repeat Hemoglobin to assess hemodilution nadir; repeat ICT + Anti-D 300mcg for Rh- mothers',
      isDue: w >= 27 && w <= 30,
      isOverdue: w > 30,
    },
    {
      key: 'gbs_screening',
      title: 'Group B Streptococcus (GBS) Screening Swab',
      dueWeeks: '35 – 37 Weeks',
      minWeeks: 35,
      maxWeeks: 37,
      rationale: 'Recto-vaginal culture to determine intrapartum IV antibiotic prophylaxis requirements',
      isDue: w >= 35 && w <= 37,
      isOverdue: w > 37,
    },
    {
      key: 'term_hb_platelets',
      title: 'Pre-Delivery Term CBC & Coagulation Check',
      dueWeeks: '36 – 38 Weeks',
      minWeeks: 36,
      maxWeeks: 40,
      rationale: 'Ensure adequate Hemoglobin (≥11) and Platelets (≥100k) prior to labor and regional anesthesia',
      isDue: w >= 36 && w <= 40,
      isOverdue: false,
    },
  ];
}
