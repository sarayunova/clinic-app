export type AntenatalCategory = 'first_trimester' | 'second_trimester' | 'third_trimester';
export type AntenatalTestStatus = 'pending' | 'ordered' | 'completed' | 'not_required';

export interface AntenatalTestDef {
  key: string;
  category: AntenatalCategory;
  name: string;
  recommendedWeeks: string;
  description: string;
  isMandatory?: boolean;
  flagForRhNegative?: boolean;
}

export const ANTENATAL_TEST_CATALOG: readonly AntenatalTestDef[] = [
  // --- First Trimester (Booking - 13w) ---
  {
    key: 'blood_group',
    category: 'first_trimester',
    name: 'Blood Group & Rh Type',
    recommendedWeeks: 'Booking / ≤ 10w',
    description: 'ABO and Rh(D) status; crucial for detecting Rh-negative mothers',
    isMandatory: true,
  },
  {
    key: 'cbc_1',
    category: 'first_trimester',
    name: 'Complete Blood Count (CBC) / Hb #1',
    recommendedWeeks: 'Booking',
    description: 'Baseline hemoglobin and platelet count; detect baseline anemia (< 11 g/dL)',
    isMandatory: true,
  },
  {
    key: 'tsh_1',
    category: 'first_trimester',
    name: 'Thyroid Stimulating Hormone (TSH)',
    recommendedWeeks: 'Booking / ≤ 12w',
    description: 'Maternal thyroid status; 1st trimester reference target < 2.5 mIU/L',
    isMandatory: true,
  },
  {
    key: 'fbs_1',
    category: 'first_trimester',
    name: 'Fasting Blood Sugar / HbA1c',
    recommendedWeeks: 'Booking',
    description: 'Overt pre-gestational diabetes detection',
    isMandatory: true,
  },
  {
    key: 'viral_hiv',
    category: 'first_trimester',
    name: 'HIV 1 & 2 Serology',
    recommendedWeeks: 'Booking',
    description: 'Universal prenatal screening to prevent vertical transmission',
    isMandatory: true,
  },
  {
    key: 'viral_hbsag',
    category: 'first_trimester',
    name: 'Hepatitis B Surface Antigen (HBsAg)',
    recommendedWeeks: 'Booking',
    description: 'Perinatal transmission screening and neonatal immunoglobulin planning',
    isMandatory: true,
  },
  {
    key: 'viral_vdrl',
    category: 'first_trimester',
    name: 'VDRL / Syphilis Serology',
    recommendedWeeks: 'Booking',
    description: 'Screening to prevent congenital syphilis and neonatal complications',
    isMandatory: true,
  },
  {
    key: 'urine_rm_1',
    category: 'first_trimester',
    name: 'Urine Routine & Micro (R/M) #1',
    recommendedWeeks: 'Booking',
    description: 'Screen for asymptomatic bacteriuria, glycosuria, baseline protein',
    isMandatory: true,
  },
  {
    key: 'rubella_igg',
    category: 'first_trimester',
    name: 'Rubella IgG Antibody',
    recommendedWeeks: 'Booking',
    description: 'Assess maternal immunity against congenital rubella syndrome',
  },
  {
    key: 'scan_nt',
    category: 'first_trimester',
    name: 'First Trimester NT / NB Scan & Dual Marker',
    recommendedWeeks: '11w0d - 13w6d',
    description: 'Nuchal translucency, nasal bone evaluation, and aneuploidy risk screening',
    isMandatory: true,
  },

  // --- Second Trimester (14w - 27w) ---
  {
    key: 'scan_anomaly',
    category: 'second_trimester',
    name: 'Level II / TIFFA Anomaly Ultrasound',
    recommendedWeeks: '18w - 20w',
    description: 'Detailed structural fetal anomaly scan, placental localization, cervical length',
    isMandatory: true,
  },
  {
    key: 'ogtt',
    category: 'second_trimester',
    name: '75g Oral Glucose Tolerance Test (OGTT / DIPSI)',
    recommendedWeeks: '24w - 28w',
    description: 'Universal gestational diabetes (GDM) screening',
    isMandatory: true,
  },
  {
    key: 'cbc_2',
    category: 'second_trimester',
    name: 'Repeat Hemoglobin / CBC #2',
    recommendedWeeks: '24w - 28w',
    description: 'Assess physiological hemodilution and second-trimester iron deficiency anemia',
    isMandatory: true,
  },
  {
    key: 'urine_rm_2',
    category: 'second_trimester',
    name: 'Urine Routine & Micro #2 (Proteinuria)',
    recommendedWeeks: '24w - 28w',
    description: 'Screen for gestational hypertension / early preeclampsia',
    isMandatory: true,
  },

  // --- Third Trimester (28w - Term) ---
  {
    key: 'rh_ict',
    category: 'third_trimester',
    name: 'Indirect Coombs Test (ICT / Antibody Screen)',
    recommendedWeeks: '28w',
    description: 'For Rh-negative mothers; check for maternal isoimmunization prior to Anti-D',
    flagForRhNegative: true,
  },
  {
    key: 'anti_d',
    category: 'third_trimester',
    name: 'Anti-D Immunoglobulin Prophylaxis (300 mcg)',
    recommendedWeeks: '28w',
    description: 'Routine antenatal Anti-D prophylaxis for unsensitized Rh-negative women',
    flagForRhNegative: true,
  },
  {
    key: 'scan_growth',
    category: 'third_trimester',
    name: 'Growth Ultrasound & Obstetric Doppler',
    recommendedWeeks: '32w - 36w',
    description: 'Assess fetal growth trajectory, estimated fetal weight (EFW), liquor AFI, Doppler',
    isMandatory: true,
  },
  {
    key: 'cbc_3',
    category: 'third_trimester',
    name: 'Pre-delivery Complete Hemogram / Hb #3',
    recommendedWeeks: '36w',
    description: 'Pre-delivery maternal hemoglobin optimization and blood readiness',
    isMandatory: true,
  },
  {
    key: 'urine_rm_3',
    category: 'third_trimester',
    name: 'Urine Albumin / Protein #3',
    recommendedWeeks: '36w - Term',
    description: 'Term preeclampsia and hypertensive disorder surveillance',
    isMandatory: true,
  },
];

export const ANTENATAL_TEST_MAP: Record<string, AntenatalTestDef> = Object.fromEntries(
  ANTENATAL_TEST_CATALOG.map((t) => [t.key, t])
);
