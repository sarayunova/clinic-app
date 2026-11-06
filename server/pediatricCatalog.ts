export type VaccineMilestone =
  | 'birth'
  | '6_weeks'
  | '10_weeks'
  | '14_weeks'
  | '9_12_months'
  | '16_24_months'
  | '5_6_years'
  | '10_16_years';

export type VaccineStatus = 'pending' | 'given' | 'scheduled' | 'exempt' | 'delayed';

export interface VaccineDef {
  key: string;
  milestone: VaccineMilestone;
  milestoneLabel: string;
  name: string;
  targetDisease: string;
  recommendedAge: string;
  daysOffset: number;
  standardRoute: string;
  standardDose: string;
  isMandatory?: boolean;
}

export const PEDIATRIC_VACCINE_CATALOG: readonly VaccineDef[] = [
  // --- At Birth ---
  {
    key: 'bcg',
    milestone: 'birth',
    milestoneLabel: 'At Birth',
    name: 'BCG (Bacillus Calmette-Guérin)',
    targetDisease: 'Tuberculosis',
    recommendedAge: 'At birth (up to 1 year)',
    daysOffset: 0,
    standardRoute: 'Intradermal, Left Upper Arm',
    standardDose: '0.1 mL (0.05 mL if < 1 month)',
    isMandatory: true,
  },
  {
    key: 'opv_0',
    milestone: 'birth',
    milestoneLabel: 'At Birth',
    name: 'OPV-0 (Oral Polio Zero Dose)',
    targetDisease: 'Poliomyelitis',
    recommendedAge: 'At birth (within 15 days)',
    daysOffset: 0,
    standardRoute: 'Oral',
    standardDose: '2 drops',
    isMandatory: true,
  },
  {
    key: 'hepb_0',
    milestone: 'birth',
    milestoneLabel: 'At Birth',
    name: 'Hepatitis B Birth Dose',
    targetDisease: 'Hepatitis B',
    recommendedAge: 'Within 24 hours of birth',
    daysOffset: 0,
    standardRoute: 'Intramuscular, Anterolateral Thigh',
    standardDose: '0.5 mL',
    isMandatory: true,
  },

  // --- 6 Weeks ---
  {
    key: 'penta_1',
    milestone: '6_weeks',
    milestoneLabel: '6 Weeks',
    name: 'Pentavalent-1 (DTP-HepB-Hib)',
    targetDisease: 'Diphtheria, Pertussis, Tetanus, Hep B, Hib',
    recommendedAge: '6 weeks',
    daysOffset: 42,
    standardRoute: 'Intramuscular, Anterolateral Thigh',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
  {
    key: 'opv_1',
    milestone: '6_weeks',
    milestoneLabel: '6 Weeks',
    name: 'OPV-1',
    targetDisease: 'Poliomyelitis',
    recommendedAge: '6 weeks',
    daysOffset: 42,
    standardRoute: 'Oral',
    standardDose: '2 drops',
    isMandatory: true,
  },
  {
    key: 'rvv_1',
    milestone: '6_weeks',
    milestoneLabel: '6 Weeks',
    name: 'Rotavirus Vaccine-1 (RVV)',
    targetDisease: 'Rotavirus Diarrhea',
    recommendedAge: '6 weeks',
    daysOffset: 42,
    standardRoute: 'Oral',
    standardDose: '5 drops (or 2.5 mL liquid)',
    isMandatory: true,
  },
  {
    key: 'fipv_1',
    milestone: '6_weeks',
    milestoneLabel: '6 Weeks',
    name: 'Fractional IPV-1 (fIPV)',
    targetDisease: 'Poliomyelitis',
    recommendedAge: '6 weeks',
    daysOffset: 42,
    standardRoute: 'Intradermal, Right Upper Arm',
    standardDose: '0.1 mL',
    isMandatory: true,
  },
  {
    key: 'pcv_1',
    milestone: '6_weeks',
    milestoneLabel: '6 Weeks',
    name: 'PCV-1 (Pneumococcal Conjugate)',
    targetDisease: 'Pneumococcal Pneumonia & Meningitis',
    recommendedAge: '6 weeks',
    daysOffset: 42,
    standardRoute: 'Intramuscular, Anterolateral Thigh',
    standardDose: '0.5 mL',
    isMandatory: true,
  },

  // --- 10 Weeks ---
  {
    key: 'penta_2',
    milestone: '10_weeks',
    milestoneLabel: '10 Weeks',
    name: 'Pentavalent-2 (DTP-HepB-Hib)',
    targetDisease: 'Diphtheria, Pertussis, Tetanus, Hep B, Hib',
    recommendedAge: '10 weeks',
    daysOffset: 70,
    standardRoute: 'Intramuscular, Anterolateral Thigh',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
  {
    key: 'opv_2',
    milestone: '10_weeks',
    milestoneLabel: '10 Weeks',
    name: 'OPV-2',
    targetDisease: 'Poliomyelitis',
    recommendedAge: '10 weeks',
    daysOffset: 70,
    standardRoute: 'Oral',
    standardDose: '2 drops',
    isMandatory: true,
  },
  {
    key: 'rvv_2',
    milestone: '10_weeks',
    milestoneLabel: '10 Weeks',
    name: 'Rotavirus Vaccine-2 (RVV)',
    targetDisease: 'Rotavirus Diarrhea',
    recommendedAge: '10 weeks',
    daysOffset: 70,
    standardRoute: 'Oral',
    standardDose: '5 drops',
    isMandatory: true,
  },

  // --- 14 Weeks ---
  {
    key: 'penta_3',
    milestone: '14_weeks',
    milestoneLabel: '14 Weeks',
    name: 'Pentavalent-3 (DTP-HepB-Hib)',
    targetDisease: 'Diphtheria, Pertussis, Tetanus, Hep B, Hib',
    recommendedAge: '14 weeks',
    daysOffset: 98,
    standardRoute: 'Intramuscular, Anterolateral Thigh',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
  {
    key: 'opv_3',
    milestone: '14_weeks',
    milestoneLabel: '14 Weeks',
    name: 'OPV-3',
    targetDisease: 'Poliomyelitis',
    recommendedAge: '14 weeks',
    daysOffset: 98,
    standardRoute: 'Oral',
    standardDose: '2 drops',
    isMandatory: true,
  },
  {
    key: 'rvv_3',
    milestone: '14_weeks',
    milestoneLabel: '14 Weeks',
    name: 'Rotavirus Vaccine-3 (RVV)',
    targetDisease: 'Rotavirus Diarrhea',
    recommendedAge: '14 weeks',
    daysOffset: 98,
    standardRoute: 'Oral',
    standardDose: '5 drops',
    isMandatory: true,
  },
  {
    key: 'fipv_2',
    milestone: '14_weeks',
    milestoneLabel: '14 Weeks',
    name: 'Fractional IPV-2 (fIPV)',
    targetDisease: 'Poliomyelitis',
    recommendedAge: '14 weeks',
    daysOffset: 98,
    standardRoute: 'Intradermal, Right Upper Arm',
    standardDose: '0.1 mL',
    isMandatory: true,
  },
  {
    key: 'pcv_2',
    milestone: '14_weeks',
    milestoneLabel: '14 Weeks',
    name: 'PCV-2',
    targetDisease: 'Pneumococcal Pneumonia & Meningitis',
    recommendedAge: '14 weeks',
    daysOffset: 98,
    standardRoute: 'Intramuscular, Anterolateral Thigh',
    standardDose: '0.5 mL',
    isMandatory: true,
  },

  // --- 9 - 12 Months ---
  {
    key: 'mr_1',
    milestone: '9_12_months',
    milestoneLabel: '9 - 12 Months',
    name: 'MR-1 / MMR-1 (Measles & Rubella)',
    targetDisease: 'Measles, Rubella',
    recommendedAge: '9 - 12 months',
    daysOffset: 270,
    standardRoute: 'Subcutaneous, Right Upper Arm',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
  {
    key: 'pcv_booster',
    milestone: '9_12_months',
    milestoneLabel: '9 - 12 Months',
    name: 'PCV Booster',
    targetDisease: 'Pneumococcal Disease',
    recommendedAge: '9 months',
    daysOffset: 270,
    standardRoute: 'Intramuscular, Anterolateral Thigh',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
  {
    key: 'vit_a_1',
    milestone: '9_12_months',
    milestoneLabel: '9 - 12 Months',
    name: 'Vitamin A (1st Dose)',
    targetDisease: 'Vitamin A Deficiency & Xerophthalmia',
    recommendedAge: '9 months (with MR-1)',
    daysOffset: 270,
    standardRoute: 'Oral',
    standardDose: '1 mL (1 lakh IU)',
    isMandatory: true,
  },

  // --- 16 - 24 Months ---
  {
    key: 'mr_2',
    milestone: '16_24_months',
    milestoneLabel: '16 - 24 Months',
    name: 'MR-2 / MMR-2 (2nd Dose)',
    targetDisease: 'Measles, Rubella',
    recommendedAge: '16 - 24 months',
    daysOffset: 480,
    standardRoute: 'Subcutaneous, Right Upper Arm',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
  {
    key: 'dtp_b1',
    milestone: '16_24_months',
    milestoneLabel: '16 - 24 Months',
    name: 'DTP Booster-1',
    targetDisease: 'Diphtheria, Pertussis, Tetanus',
    recommendedAge: '16 - 24 months',
    daysOffset: 480,
    standardRoute: 'Intramuscular, Anterolateral Mid-thigh',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
  {
    key: 'opv_booster',
    milestone: '16_24_months',
    milestoneLabel: '16 - 24 Months',
    name: 'OPV Booster',
    targetDisease: 'Poliomyelitis',
    recommendedAge: '16 - 24 months',
    daysOffset: 480,
    standardRoute: 'Oral',
    standardDose: '2 drops',
    isMandatory: true,
  },

  // --- 5 - 6 Years ---
  {
    key: 'dtp_b2',
    milestone: '5_6_years',
    milestoneLabel: '5 - 6 Years',
    name: 'DTP Booster-2',
    targetDisease: 'Diphtheria, Pertussis, Tetanus',
    recommendedAge: '5 - 6 years',
    daysOffset: 1825,
    standardRoute: 'Intramuscular, Upper Arm (Deltoid)',
    standardDose: '0.5 mL',
    isMandatory: true,
  },

  // --- 10 & 16 Years ---
  {
    key: 'td_10',
    milestone: '10_16_years',
    milestoneLabel: '10 & 16 Years',
    name: 'Td (Tetanus & adult Diphtheria) - 10y',
    targetDisease: 'Tetanus, Diphtheria',
    recommendedAge: '10 years',
    daysOffset: 3650,
    standardRoute: 'Intramuscular, Upper Arm (Deltoid)',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
  {
    key: 'td_16',
    milestone: '10_16_years',
    milestoneLabel: '10 & 16 Years',
    name: 'Td (Tetanus & adult Diphtheria) - 16y',
    targetDisease: 'Tetanus, Diphtheria',
    recommendedAge: '16 years',
    daysOffset: 5840,
    standardRoute: 'Intramuscular, Upper Arm (Deltoid)',
    standardDose: '0.5 mL',
    isMandatory: true,
  },
];

export const PEDIATRIC_VACCINE_MAP: Record<string, VaccineDef> = Object.fromEntries(
  PEDIATRIC_VACCINE_CATALOG.map((v) => [v.key, v])
);

/**
 * Calculates expected due date for a vaccine based on child's Date of Birth.
 */
export function calculateVaccineDueDate(
  dateOfBirth: string | null | undefined,
  daysOffset: number
): string | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const d = new Date(dateOfBirth + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

/**
 * Formats pediatric age accurately in days, weeks, months, or years.
 */
export function formatDetailedPediatricAge(
  dateOfBirth: string | null | undefined,
  referenceDateStr?: string
): string {
  if (!dateOfBirth) return 'Age unknown';
  const dob = new Date(dateOfBirth + 'T00:00:00Z');
  if (isNaN(dob.getTime())) return 'Invalid DOB';

  const ref = referenceDateStr ? new Date(referenceDateStr + 'T00:00:00Z') : new Date();
  const diffMs = ref.getTime() - dob.getTime();
  if (diffMs < 0) return 'Newborn (future DOB)';

  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  if (days === 0) return 'Birth (Day 1)';
  if (days < 28) return `${days} days`;

  const weeks = Math.floor(days / 7);
  if (weeks < 14) return `${weeks} weeks (${days} d)`;

  const months = Math.floor(days / 30.4375);
  if (months < 24) return `${months} months`;

  const years = Math.floor(days / 365.25);
  const remMonths = Math.floor((days % 365.25) / 30.4375);
  return remMonths > 0 ? `${years} yrs ${remMonths} mo` : `${years} years`;
}
