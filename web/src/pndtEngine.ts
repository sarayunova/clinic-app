/**
 * Statutory Indian PC-PNDT Act Form 'F' Calculation & Compliance Engine
 * References:
 * - Pre-Conception and Pre-Natal Diagnostic Techniques (Prohibition of Sex Selection) Act, 1994 (Act No. 54 of 1994)
 * - PC-PNDT Rules, 1996: Rule 9(5) and Rule 10(1A) - Form F Maintenance of Record
 * - Ministry of Health & Family Welfare (MoHFW), Government of India
 */

export interface PndtIndicationDef {
  code: string;
  label: string;
  category: 'dating_viability' | 'anomaly_screening' | 'growth_doppler' | 'maternal_placental' | 'high_risk' | 'other';
  description: string;
  ruleCitation?: string;
}

/** Statutory indications specified under Rule 9(5) of PC-PNDT Rules, 1996 */
export const PNDT_STATUTORY_INDICATIONS: PndtIndicationDef[] = [
  {
    code: 'GA_ESTIMATION',
    label: 'Estimation of Gestational Age & Viability',
    category: 'dating_viability',
    description: 'Diagnosis of intrauterine pregnancy, cardiac activity, and accurate gestational age dating scan.',
    ruleCitation: 'Rule 9(5)(i)',
  },
  {
    code: 'FIRST_TRIMESTER_NT',
    label: 'First Trimester Aneuploidy / NT & NB Screening',
    category: 'anomaly_screening',
    description: 'Nuchal translucency (NT), nasal bone (NB) and tricuspid regurgitation screening for chromosomal aneuploidies (11–13+6 weeks).',
    ruleCitation: 'Rule 9(5)(ii)',
  },
  {
    code: 'ANOMALY_DETECTION',
    label: 'Detection of Structural Congenital Anomalies (Level-II / TIFFA)',
    category: 'anomaly_screening',
    description: 'Comprehensive mid-trimester target scan for structural fetal malformations (18–22 weeks).',
    ruleCitation: 'Rule 9(5)(iii)',
  },
  {
    code: 'MULTIPLE_PREGNANCY',
    label: 'Multiple Gestation & Chorionicity Assessment',
    category: 'dating_viability',
    description: 'Determination of number of fetuses, chorionicity, amnionicity, and twin discordance monitoring.',
    ruleCitation: 'Rule 9(5)(iv)',
  },
  {
    code: 'FETAL_GROWTH_FGR',
    label: 'Fetal Growth Restriction (FGR) or Macrosomia',
    category: 'growth_doppler',
    description: 'Evaluation of estimated fetal weight, asymmetric/symmetric growth restriction, or suspected macrosomia.',
    ruleCitation: 'Rule 9(5)(v)',
  },
  {
    code: 'AMNIOTIC_FLUID_LIQUOR',
    label: 'Amniotic Fluid Volume Assessment (Oligo / Polyhydramnios)',
    category: 'growth_doppler',
    description: 'Evaluation of Amniotic Fluid Index (AFI) or Single Deepest Pocket (SDP) for oligohydramnios or polyhydramnios.',
    ruleCitation: 'Rule 9(5)(vi)',
  },
  {
    code: 'PLACENTAL_LOCALIZATION',
    label: 'Placental Localization & Bleeding in Pregnancy',
    category: 'maternal_placental',
    description: 'Evaluation of suspected low-lying placenta, placenta previa, morbid adherence, or retroplacental hematoma.',
    ruleCitation: 'Rule 9(5)(vii)',
  },
  {
    code: 'CERVICAL_INCOMPETENCE',
    label: 'Cervical Length / Incompetence Surveillance',
    category: 'maternal_placental',
    description: 'Transvaginal sonography for cervical shortening, funneling, or post-cerclage assessment in preterm labor risk.',
    ruleCitation: 'Rule 9(5)(viii)',
  },
  {
    code: 'FETAL_DOPPLER',
    label: 'Fetal Doppler Surveillance (PIH / IUGR / High-Risk)',
    category: 'growth_doppler',
    description: 'Umbilical artery, middle cerebral artery (MCA), CPR, and uterine artery Doppler velocimetry.',
    ruleCitation: 'Rule 9(5)(ix)',
  },
  {
    code: 'SUSPECTED_DEMISE',
    label: 'Suspected Fetal Demise / Absent Cardiac Activity',
    category: 'dating_viability',
    description: 'Assessment for intra-uterine fetal death, missed abortion, or cessation of fetal movements.',
    ruleCitation: 'Rule 9(5)(x)',
  },
  {
    code: 'ADVANCED_MATERNAL_AGE',
    label: 'Advanced Maternal Age (35 years or older)',
    category: 'high_risk',
    description: 'Prenatal diagnostic ultrasound indicated on grounds of maternal age >= 35 years at expected date of delivery.',
    ruleCitation: 'Rule 9(5)(xi)',
  },
  {
    code: 'PREVIOUS_ANOMALY',
    label: 'Previous History of Congenital Malformation / Genetic Disorder',
    category: 'high_risk',
    description: 'Previous pregnancy with neural tube defect, cardiac defect, chromosomal anomaly, or mental retardation.',
    ruleCitation: 'Rule 9(5)(xii)',
  },
  {
    code: 'ABNORMAL_BIOCHEMISTRY',
    label: 'Abnormal Maternal Serum Screening Follow-up',
    category: 'high_risk',
    description: 'Follow-up for elevated/decreased dual, triple, or quadruple marker screening, or high-risk NIPT result.',
    ruleCitation: 'Rule 9(5)(xiii)',
  },
  {
    code: 'VAGINAL_BLEEDING',
    label: 'Vaginal Bleeding / Threatened Miscarriage / Suspected Ectopic',
    category: 'dating_viability',
    description: 'Evaluation of acute first/second trimester bleeding, pelvic pain, or subchorionic hemorrhage.',
    ruleCitation: 'Rule 9(5)(xiv)',
  },
  {
    code: 'FOLLOW_UP_SCAN',
    label: 'Follow-up of Previously Observed Ultrasound Finding',
    category: 'maternal_placental',
    description: 'Interval monitoring of previously documented fetal, placental, or amniotic fluid abnormality.',
    ruleCitation: 'Rule 9(5)(xv)',
  },
  {
    code: 'OTHER_INDICATION',
    label: 'Other Specific Clinical Medical Indication',
    category: 'other',
    description: 'Other medical grounds documented with specific clinical notes.',
    ruleCitation: 'Rule 9(5)(xvi)',
  },
];

export interface PndtFormFRecord {
  id: number;
  formFNumber: string;
  patientId: number;
  ultrasoundReportId: number | null;
  visitId: number | null;
  scanDate: string; // YYYY-MM-DD
  scanTime: string | null; // HH:MM
  clinicPndtRegNo: string;
  doctorId: number | null;
  doctorName: string;
  doctorRegNo: string;
  machineModelSerial: string;

  // Section A
  patientName: string;
  patientAge: number;
  husbandOrFatherName: string;
  fullAddress: string;
  contactPhone: string | null;
  numLivingMaleChildren: number;
  maleChildrenAges: string | null;
  numLivingFemaleChildren: number;
  femaleChildrenAges: string | null;
  totalLivingChildren: number;
  lmp: string | null;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;

  // Section B
  referralType: 'self_referred' | 'doctor_referred';
  referringDoctorName: string | null;
  referringDoctorRegNo: string | null;
  referringClinicAddress: string | null;
  referralSlipDate: string | null;
  selfReferralReason: string | null;

  // Section C
  indicationCodes: string[];
  otherIndicationDetail: string | null;
  invasiveProcedureDone: boolean;
  invasiveProcedureDetails: string | null;

  // Section D & E
  pregnantWomanDeclarationSigned: boolean;
  pregnantWomanDeclarationTime: string;
  pregnantWomanSignatureName: string;
  doctorDeclarationSigned: boolean;
  doctorDeclarationTime: string;
  doctorDeclarationName: string;

  // Findings
  fetalNumber: 'single' | 'twins' | 'triplets' | 'multiple';
  cardiacActivity: 'present' | 'absent' | 'not_applicable';
  congenitalAnomalyDetected: boolean;
  congenitalAnomalyDetails: string | null;
  scanResultSummary: string | null;

  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

/** Formats sequential counter into standard PC-PNDT Form F Number: e.g. PNDT-YYYYMM-0001 */
export function formatPndtFormNumber(seq: number, dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  const month = String((isNaN(d.getMonth()) ? new Date().getMonth() : d.getMonth()) + 1).padStart(2, '0');
  const numStr = String(Math.max(1, seq)).padStart(4, '0');
  return `PNDT-${year}${month}-${numStr}`;
}

/** Analyzes ultrasound scan metadata to automatically suggest PC-PNDT indication codes */
export function inferIndicationsFromUltrasound(
  scanType?: string | null,
  indicationText?: string | null,
  maternalAge?: number | null,
  fetalNumber?: string | null,
): string[] {
  const codes: Set<string> = new Set();
  const st = (scanType || '').toLowerCase();
  const it = (indicationText || '').toLowerCase();

  if (st.includes('early') || it.includes('dating') || it.includes('viability') || it.includes('confirm')) {
    codes.add('GA_ESTIMATION');
  }
  if (st.includes('nt') || st.includes('first_trimester') || it.includes('nuchal') || it.includes('aneuploidy')) {
    codes.add('FIRST_TRIMESTER_NT');
    codes.add('GA_ESTIMATION');
  }
  if (st.includes('anomaly') || it.includes('anomaly') || it.includes('tiffa') || it.includes('malformation') || it.includes('level-2') || it.includes('level 2')) {
    codes.add('ANOMALY_DETECTION');
  }
  if (st.includes('growth') || it.includes('growth') || it.includes('fgr') || it.includes('iugr') || it.includes('macrosomia')) {
    codes.add('FETAL_GROWTH_FGR');
    codes.add('AMNIOTIC_FLUID_LIQUOR');
  }
  if (it.includes('fluid') || it.includes('afi') || it.includes('oligo') || it.includes('polyhydramnios')) {
    codes.add('AMNIOTIC_FLUID_LIQUOR');
  }
  if (it.includes('placenta') || it.includes('bleeding') || it.includes('previa') || it.includes('spotting')) {
    codes.add('PLACENTAL_LOCALIZATION');
  }
  if (it.includes('cervix') || it.includes('cervical') || it.includes('cerclage') || it.includes('incompetence')) {
    codes.add('CERVICAL_INCOMPETENCE');
  }
  if (it.includes('doppler') || it.includes('pih') || it.includes('preeclampsia') || it.includes('resistance')) {
    codes.add('FETAL_DOPPLER');
  }
  if (fetalNumber === 'twins' || fetalNumber === 'triplets' || it.includes('twin') || it.includes('multiple')) {
    codes.add('MULTIPLE_PREGNANCY');
  }
  if (maternalAge != null && maternalAge >= 35) {
    codes.add('ADVANCED_MATERNAL_AGE');
  }

  if (codes.size === 0) {
    codes.add('GA_ESTIMATION');
  }

  return Array.from(codes);
}

/** Formats a clean text representation of living children */
export function formatLivingChildrenSummary(numMale: number, numFemale: number, maleAges?: string | null, femaleAges?: string | null): string {
  const total = numMale + numFemale;
  if (total === 0) {
    return '0 (Nulliparous / No living children)';
  }
  const parts: string[] = [];
  if (numMale > 0) {
    parts.push(`${numMale} Male${numMale > 1 ? 's' : ''}${maleAges ? ` (Age${numMale > 1 ? 's' : ''}: ${maleAges})` : ''}`);
  }
  if (numFemale > 0) {
    parts.push(`${numFemale} Female${numFemale > 1 ? 's' : ''}${femaleAges ? ` (Age${numFemale > 1 ? 's' : ''}: ${femaleAges})` : ''}`);
  }
  return `${total} total [${parts.join(', ')}]`;
}

/** Evaluates whether Form F satisfies statutory completeness under PC-PNDT rules */
export function validatePndtFormCompleteness(form: Partial<PndtFormFRecord>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!form.patientName || !form.patientName.trim()) {
    errors.push("Patient name is required (Section A)");
  }
  if (form.patientAge == null || form.patientAge < 10 || form.patientAge > 70) {
    errors.push("Valid patient age in years is required (Section A)");
  }
  if (!form.husbandOrFatherName || !form.husbandOrFatherName.trim()) {
    errors.push("Husband or Father's name is required (Section A)");
  }
  if (!form.fullAddress || !form.fullAddress.trim()) {
    errors.push("Full residential address is required by PC-PNDT Act (Section A)");
  }
  if (form.gestationalAgeWeeks == null || form.gestationalAgeWeeks < 1 || form.gestationalAgeWeeks > 44) {
    errors.push("Valid gestational age (1 to 44 weeks) is required (Section A)");
  }
  if (!form.clinicPndtRegNo || !form.clinicPndtRegNo.trim()) {
    errors.push("Clinic PC-PNDT Registration Number is required (Section A)");
  }
  if (!form.doctorName || !form.doctorName.trim()) {
    errors.push("Name of Sonologist / Doctor conducting scan is required (Section A)");
  }
  if (!form.doctorRegNo || !form.doctorRegNo.trim()) {
    errors.push("Doctor's Medical Council Registration Number is required (Section A)");
  }
  if (!form.machineModelSerial || !form.machineModelSerial.trim()) {
    errors.push("Ultrasound Machine Make/Model/Serial number is required (Section A)");
  }

  // Section B
  if (form.referralType === 'doctor_referred') {
    if (!form.referringDoctorName || !form.referringDoctorName.trim()) {
      errors.push("Referring doctor's name is required for referred cases (Section B)");
    }
  } else if (form.referralType === 'self_referred') {
    if (!form.selfReferralReason || !form.selfReferralReason.trim()) {
      errors.push("Reason for self-referral is required (Section B)");
    }
  }

  // Section C
  if (!form.indicationCodes || form.indicationCodes.length === 0) {
    errors.push("At least one statutory indication must be specified under Rule 9(5) (Section C)");
  }

  // Section D & E declarations
  if (!form.pregnantWomanDeclarationSigned) {
    errors.push("Mandatory Declaration of Pregnant Woman must be signed/accepted (Section D)");
  }
  if (!form.doctorDeclarationSigned) {
    errors.push("Mandatory Declaration of Doctor / Sonologist must be signed/certified (Section E)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface MonthlyPndtReturnSummary {
  month: string; // YYYY-MM
  totalScans: number;
  referralBreakdown: {
    selfReferred: number;
    doctorReferred: number;
  };
  parityDistribution: {
    zeroChildren: number;
    oneChildMale: number;
    oneChildFemale: number;
    twoChildrenTwoMales: number;
    twoChildrenTwoFemales: number;
    twoChildrenOneMaleOneFemale: number;
    threeOrMoreChildren: number;
  };
  anomalyCount: number;
  invasiveProceduresCount: number;
  indicationBreakdown: { code: string; label: string; count: number }[];
}

/** Aggregates records into a statutory Monthly Return conforming to CMO submission format */
export function aggregateMonthlyPndtReturn(records: PndtFormFRecord[], monthStr: string): MonthlyPndtReturnSummary {
  let selfReferred = 0;
  let doctorReferred = 0;
  let zeroChildren = 0;
  let oneChildMale = 0;
  let oneChildFemale = 0;
  let twoChildrenTwoMales = 0;
  let twoChildrenTwoFemales = 0;
  let twoChildrenOneMaleOneFemale = 0;
  let threeOrMoreChildren = 0;
  let anomalyCount = 0;
  let invasiveProceduresCount = 0;

  const indicationTally: Record<string, number> = {};

  for (const r of records) {
    if (r.referralType === 'doctor_referred') doctorReferred++;
    else selfReferred++;

    const males = r.numLivingMaleChildren || 0;
    const females = r.numLivingFemaleChildren || 0;
    const total = males + females;

    if (total === 0) {
      zeroChildren++;
    } else if (total === 1) {
      if (males === 1) oneChildMale++;
      else oneChildFemale++;
    } else if (total === 2) {
      if (males === 2) twoChildrenTwoMales++;
      else if (females === 2) twoChildrenTwoFemales++;
      else twoChildrenOneMaleOneFemale++;
    } else {
      threeOrMoreChildren++;
    }

    if (r.congenitalAnomalyDetected) anomalyCount++;
    if (r.invasiveProcedureDone) invasiveProceduresCount++;

    for (const code of r.indicationCodes || []) {
      indicationTally[code] = (indicationTally[code] || 0) + 1;
    }
  }

  const indicationBreakdown = PNDT_STATUTORY_INDICATIONS.map((ind) => ({
    code: ind.code,
    label: ind.label,
    count: indicationTally[ind.code] || 0,
  })).filter((x) => x.count > 0);

  return {
    month: monthStr,
    totalScans: records.length,
    referralBreakdown: {
      selfReferred,
      doctorReferred,
    },
    parityDistribution: {
      zeroChildren,
      oneChildMale,
      oneChildFemale,
      twoChildrenTwoMales,
      twoChildrenTwoFemales,
      twoChildrenOneMaleOneFemale,
      threeOrMoreChildren,
    },
    anomalyCount,
    invasiveProceduresCount,
    indicationBreakdown,
  };
}

/** Formats statutory CSV string ready for download & CMO submission */
export function generatePndtMonthlyCsv(records: PndtFormFRecord[], clinicName?: string, regNo?: string): string {
  const headers = [
    'Sr No',
    'Form F Number',
    'Scan Date',
    'Patient Name',
    'Age',
    'Husband / Father Name',
    'Full Residential Address',
    'Contact Phone',
    'Male Children (Ages)',
    'Female Children (Ages)',
    'LMP',
    'GA (Weeks)',
    'Referral Type',
    'Referring Doctor & Reg No',
    'Statutory Indications',
    'Invasive Procedure',
    'Congenital Anomaly',
    'Sonologist Name',
    'Doctor Reg No',
  ];

  const escapeCsv = (str: string | null | undefined): string => {
    if (str == null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows: string[] = [];
  rows.push(`# CLINIC: ${clinicName || 'Clinic'} | PC-PNDT REG NO: ${regNo || 'N/A'}`);
  rows.push(headers.join(','));

  records.forEach((r, idx) => {
    const indicationNames = r.indicationCodes
      .map((c) => PNDT_STATUTORY_INDICATIONS.find((i) => i.code === c)?.label || c)
      .join('; ');

    const refInfo = r.referralType === 'doctor_referred'
      ? `${r.referringDoctorName || ''} (${r.referringDoctorRegNo || ''})`
      : `Self: ${r.selfReferralReason || 'Routine'}`;

    const line = [
      idx + 1,
      escapeCsv(r.formFNumber),
      escapeCsv(r.scanDate),
      escapeCsv(r.patientName),
      r.patientAge,
      escapeCsv(r.husbandOrFatherName),
      escapeCsv(r.fullAddress),
      escapeCsv(r.contactPhone),
      escapeCsv(r.numLivingMaleChildren > 0 ? `${r.numLivingMaleChildren} (${r.maleChildrenAges || 'N/A'})` : '0'),
      escapeCsv(r.numLivingFemaleChildren > 0 ? `${r.numLivingFemaleChildren} (${r.femaleChildrenAges || 'N/A'})` : '0'),
      escapeCsv(r.lmp),
      r.gestationalAgeWeeks,
      escapeCsv(r.referralType),
      escapeCsv(refInfo),
      escapeCsv(indicationNames),
      escapeCsv(r.invasiveProcedureDone ? `Yes: ${r.invasiveProcedureDetails || ''}` : 'No'),
      escapeCsv(r.congenitalAnomalyDetected ? `Yes: ${r.congenitalAnomalyDetails || ''}` : 'No Anomaly Detected'),
      escapeCsv(r.doctorName),
      escapeCsv(r.doctorRegNo),
    ];
    rows.push(line.join(','));
  });

  return rows.join('\r\n');
}
