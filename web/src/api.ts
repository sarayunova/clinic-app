export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  /** Field-level messages from server validation, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as { field?: string; message?: string }[]) if (d.field && d.message) out[d.field] = d.message;
    }
    return out;
  }
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the clinic server. Check the connection and try again. Nothing was saved.');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = data?.error ?? {};
    // A wrong password on the login or unlock form is an ordinary error, not "your session ended".
    if (res.status === 401 && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/unlock')) window.dispatchEvent(new Event('clinic:unauthorized'));
    if (res.status === 423) window.dispatchEvent(new Event('clinic:locked'));
    throw new ApiError(res.status, e.code ?? 'error', e.message ?? `Request failed (${res.status})`, e.details);
  }
  return data as T;
}

// ---------- Shared types (mirror the server's camelCase output) ----------

export type Role = 'doctor' | 'nurse' | 'attender';
export type Permission = string;

export interface Me {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
  permissions: Permission[];
  /** The screen is locked on the server (survives a page reload). */
  locked: boolean;
  /** Idle minutes before the screen locks itself; 0 = never. */
  screenLockMinutes: number;
}

export type AppointmentStatus = 'scheduled' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled' | 'absent';

export interface Appointment {
  id: number;
  patientId: number;
  scheduledAt: string;
  scheduledDate: string;
  /** Clinic-local HH:MM from the server (never format scheduledAt in the browser's timezone). */
  scheduledTime: string;
  reason: string;
  status: AppointmentStatus;
  version: number;
  patientNumber: string;
  patientName: string;
  patientPhone: string | null;
  allergyStatus: 'unknown' | 'none' | 'known';
  allergyDetails: string | null;
  /** Present only for roles allowed to read consultations. */
  visitId?: number | null;
  visitStatus?: 'draft' | 'final' | null;
}

export interface FollowUpItem {
  visitId: number;
  patientId: number;
  patientNumber: string;
  patientName: string;
  patientPhone: string | null;
  allergyStatus: 'unknown' | 'none' | 'known';
  allergyDetails: string | null;
  visitDate: string;
  followUpDate: string;
  assessment?: string | null;
  appointmentId: number | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentStatus: AppointmentStatus | null;
  isOverdue: boolean;
}

export interface PatientSummary {
  id: number;
  patientNumber: string;
  fullName: string;
  phone: string | null;
  ageYears: number | null;
  ageIsEstimated: boolean;
  allergyStatus: 'unknown' | 'none' | 'known';
  dateOfBirth?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  address?: string | null;
  isAntenatal?: boolean;
  gestationalAgeFormatted?: string | null;
  edd?: string | null;
  gpal?: string | null;
  isPediatric?: boolean;
  detailedAge?: string | null;
  isInpatient?: boolean;
  inpatientBed?: string | null;
  isHighRisk?: boolean;
  highRiskFlags?: string[];
}

export type Patient = Record<string, unknown> & {
  id: number;
  patientNumber: string;
  fullName: string;
  version: number;
  allergyStatus: 'unknown' | 'none' | 'known';
  allergyDetails: string | null;
  ageYears: number | null;
  ageIsEstimated: boolean;
  lastMenstrualPeriod?: string | null;
  gravida?: number | null;
  para?: number | null;
  abortions?: number | null;
  living?: number | null;
};

export interface UserRow {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
}

// ---------- OPD consultation ----------

export interface PrescriptionItem {
  medicine: string;
  strength: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
}

export interface PrescriptionTemplate {
  id: number;
  name: string;
  category: string;
  items: PrescriptionItem[];
  active: boolean;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VitalsEntry {
  id: number;
  recordedTime: string;
  recordedByName: string;
  systolicMmhg: number | null;
  diastolicMmhg: number | null;
  pulseBpm: number | null;
  temperatureC: number | null;
  weightKg: number | null;
  heightCm: number | null;
  note: string | null;
}

export interface RevisionMeta {
  revisionNo: number;
  kind: 'final' | 'amendment';
  authorName: string;
  atDate: string;
  atTime: string;
  reason: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
}

export interface Visit {
  id: number;
  patientId: number;
  appointmentId: number | null;
  status: 'draft' | 'final';
  version: number;
  visitDate: string;
  visitTime: string;
  patientNumber: string;
  patientName: string;
  patientPhone?: string | null;
  ageYears: number | null;
  ageIsEstimated: boolean;
  allergyStatus: 'unknown' | 'none' | 'known';
  allergyDetails: string | null;
  lastMenstrualPeriod?: string | null;
  gravida?: number | null;
  para?: number | null;
  abortions?: number | null;
  living?: number | null;
  complaints: string | null;
  history: string | null;
  examination: string | null;
  assessment: string | null;
  antenatalNotes: string | null;
  investigations: string | null;
  advice: string | null;
  followUpDate: string | null;
  followUpAppointment?: {
    id: number;
    scheduledDate: string;
    scheduledTime: string;
    status: AppointmentStatus;
  } | null;
  finalisedByName: string | null;
  prescriptionItems: PrescriptionItem[];
  vitals: VitalsEntry[];
  revisions: RevisionMeta[];
}

export interface VisitSummary {
  id: number;
  visitAt: string;
  visitDate: string;
  status: 'draft' | 'final';
  assessment: string | null;
  complaints: string | null;
  examination?: string | null;
  antenatalNotes?: string | null;
  investigations?: string | null;
  advice?: string | null;
  followUpDate?: string | null;
  amendments: number;
  prescriptionCount?: number;
  vitals?: {
    systolicMmhg?: number | null;
    diastolicMmhg?: number | null;
    pulseBpm?: number | null;
    temperatureC?: number | null;
    weightKg?: number | null;
    heightCm?: number | null;
  } | null;
}

// ---------- Inpatient care ----------

export interface Bed {
  id: number;
  room: string;
  label: string;
  active: boolean;
  occupied: boolean;
  admissionId?: number | null;
  admissionNumber?: string | null;
  patientId?: number | null;
  patientName?: string | null;
  patientNumber?: string | null;
  allergyStatus?: 'unknown' | 'none' | 'known' | null;
  allergyDetails?: string | null;
  dayNumber?: number | null;
}

export type EntryType = 'doctor_round' | 'nursing_note' | 'observation' | 'procedure' | 'investigation';

export interface CareEntry {
  id: number;
  entryType: EntryType;
  clinicalDate: string;
  clinicalTime: string;
  createdDate: string;
  createdTime: string;
  authorId: number;
  authorName: string;
  content: string | null;
  systolicMmhg: number | null;
  diastolicMmhg: number | null;
  pulseBpm: number | null;
  temperatureC: number | null;
  spo2Pct: number | null;
  respRate: number | null;
  correctionReason: string | null;
  corrections: CareEntry[];
  canCorrect: boolean;
}

export interface BedTransfer {
  id: number;
  date: string;
  time: string;
  fromRoom: string;
  fromLabel: string;
  toRoom: string;
  toLabel: string;
  reason: string;
  byName: string;
}

export interface Admission {
  id: number;
  admissionNumber: string;
  patientId: number;
  patientNumber: string;
  patientName: string;
  patientPhone?: string | null;
  ageYears: number | null;
  ageIsEstimated: boolean;
  allergyStatus: 'unknown' | 'none' | 'known';
  allergyDetails: string | null;
  lastMenstrualPeriod?: string | null;
  gravida?: number | null;
  para?: number | null;
  abortions?: number | null;
  living?: number | null;
  bedId: number;
  bedRoom: string;
  bedLabel: string;
  admittedDate: string;
  admittedTime: string;
  dayNumber: number | null;
  status: 'admitted' | 'discharged';
  version: number;
  // clinical (absent for reception)
  reason?: string;
  diagnosis?: string | null;
  initialAssessment?: string | null;
  treatmentPlan?: string | null;
  entries?: CareEntry[];
  /** Every move between beds, oldest first (clinical view only). */
  transfers?: BedTransfer[];
  orders?: MedicineOrder[];
  discharge?: { summary: DischargeSummary | null; addenda: DischargeAddendum[] };
  dischargedDate?: string;
  dischargedTime?: string;
}

export interface MedRecord {
  id: number;
  outcome: 'given' | 'withheld' | 'refused';
  givenDate: string;
  givenTime: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  createdDate: string;
  createdTime: string;
  doseGiven: string | null;
  reason: string | null;
  recordedBy: number;
  recordedByName: string;
  correctionReason: string | null;
  corrections: MedRecord[];
  canCorrect: boolean;
}

export interface MedicineOrder {
  id: number;
  medicine: string;
  strength: string | null;
  dose: string;
  route: string | null;
  frequency: string;
  instructions: string | null;
  startDate: string;
  startTime: string;
  orderedByName: string;
  active: boolean;
  stoppedDate: string | null;
  stoppedTime: string | null;
  stopReason: string | null;
  stoppedByName: string | null;
  records: MedRecord[];
}

export interface DischargeSummary {
  finalDiagnosis: string;
  findings: string | null;
  course: string | null;
  procedures: string | null;
  conditionAtDischarge: string;
  dischargeMedicines: string | null;
  instructions: string | null;
  warningSigns: string | null;
  followUp: string | null;
  writtenByName: string;
  finalisedDate: string;
  finalisedTime: string;
}

export interface DischargeAddendum {
  id: number;
  content: string;
  reason: string;
  authorName: string;
  createdDate: string;
  createdTime: string;
}

export type InvoiceCategory = 'consultation' | 'investigation' | 'procedure' | 'room_bed' | 'other';
export type PayMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';

export interface InvoiceLine {
  id?: number;
  category: InvoiceCategory;
  description: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise?: number;
}

export interface InvoicePayment {
  id: number;
  kind: 'payment' | 'refund';
  receiptNumber: string;
  amountPaise: number;
  method: PayMethod;
  reference: string | null;
  reason: string | null;
  paidDate: string;
  paidTime: string;
  receivedByName: string;
}

export interface InvoiceAdjustment {
  id: number;
  amountPaise: number;
  kind: 'discount' | 'write_off' | 'correction';
  reason: string;
  authorisedByName: string;
  createdDate: string;
  createdTime: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string | null;
  patientId: number;
  patientNumber: string;
  patientName: string;
  visitId: number | null;
  admissionId: number | null;
  admissionNumber: string | null;
  visitDate: string | null;
  status: 'draft' | 'issued' | 'cancelled';
  paymentState: 'draft' | 'cancelled' | 'unpaid' | 'part_paid' | 'paid' | 'credit';
  notes: string | null;
  issuedDate: string | null;
  issuedTime: string | null;
  cancelReason: string | null;
  linesPaise: number;
  adjustmentsPaise: number;
  totalPaise: number;
  netPaidPaise: number;
  refundedPaise: number;
  balancePaise: number;
  lines?: InvoiceLine[];
  adjustments?: InvoiceAdjustment[];
  payments?: InvoicePayment[];
}

export interface PriceItem {
  id: number;
  category: InvoiceCategory;
  name: string;
  pricePaise: number;
  active: 0 | 1;
}

interface CollectionBucket {
  count: number;
  paidPaise: number;
  refundedPaise: number;
  netPaise: number;
}

export interface CollectionReport {
  from: string;
  to: string;
  count: number;
  paidPaise: number;
  refundedPaise: number;
  netPaise: number;
  byMethod: (CollectionBucket & { method: PayMethod })[];
  byStaff: (CollectionBucket & { name: string })[];
  byDay: (CollectionBucket & { date: string })[];
  invoicesIssued: { count: number; totalPaise: number };
  transactions: {
    id: number;
    kind: 'payment' | 'refund';
    receiptNumber: string;
    amountPaise: number;
    method: PayMethod;
    reference: string | null;
    date: string;
    time: string;
    receivedByName: string;
    invoiceId: number;
    invoiceNumber: string;
    patientId: number;
    patientNumber: string;
    patientName: string;
  }[];
  truncated: boolean;
}

export interface ClinicSettings {
  clinicName: string;
  address: string;
  phone: string;
  doctorName: string;
  registrationNo: string;
  clinicTagline?: string;
  email?: string;
  website?: string;
  doctorQualifications?: string;
  headerLayout?: 'centered' | 'split' | 'modern';
  footerText?: string;
  showLogoOnPrint?: string;
  showSignatureOnPrint?: string;
  preprintedStationery?: string;
  topMarginMm?: string;
  stampText?: string;
  logoDataUrl?: string;
  signatureDataUrl?: string;
}

export interface BackupStatus {
  configured: boolean;
  dir: string;
  intervalHours: number;
  keep: number;
  lastSuccess: { at: string; file: string; sizeBytes: number } | null;
  lastFailure: { at: string; error: string } | null;
  healthy: boolean;
  warnings: string[];
  files: { name: string; sizeBytes: number; at: string }[];
}

export interface SecurityStatus {
  https: boolean;
  reachableFromNetwork: boolean;
  cert: { names: string[]; notAfter: string; daysLeft: number } | null;
  warnings: string[];
  caAvailable: boolean;
}

export type AntenatalCategory = 'first_trimester' | 'second_trimester' | 'third_trimester';
export type AntenatalTestStatus = 'pending' | 'ordered' | 'completed' | 'not_required';

export interface AntenatalTestItem {
  id: number | null;
  testKey: string;
  category: AntenatalCategory;
  testName: string;
  recommendedWeeks: string;
  description: string;
  isMandatory: boolean;
  flagForRhNegative: boolean;
  status: AntenatalTestStatus;
  resultValue: string | null;
  notes: string | null;
  performedDate: string | null;
  attachmentId: number | null;
  attachmentTitle: string | null;
  attachmentOriginalName: string | null;
  attachmentMime: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface AntenatalChecklistSummary {
  total: number;
  completed: number;
  ordered: number;
  pending: number;
  notRequired: number;
  completionPercentage: number;
}

export interface AntenatalChecklistResponse {
  patientId: number;
  patientName: string;
  tests: AntenatalTestItem[];
  summary: AntenatalChecklistSummary;
}

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

export interface PediatricProfile {
  birthWeightKg: number | null;
  birthLengthCm: number | null;
  birthHeadCircumferenceCm: number | null;
  gestationalAgeWeeks: number | null;
  deliveryType: 'normal_vaginal' | 'cesarean' | 'assisted' | 'other' | null;
  birthHospital: string | null;
  apgar1min: number | null;
  apgar5min: number | null;
  bloodGroup: string | null;
  birthNotes: string | null;
  updatedAt: string | null;
}

export interface VaccineItem {
  id: number | null;
  vaccineKey: string;
  milestone: VaccineMilestone;
  milestoneLabel: string;
  vaccineName: string;
  targetDisease: string;
  recommendedAge: string;
  standardRoute: string;
  standardDose: string;
  isMandatory: boolean;
  dueDate: string | null;
  isOverdue: boolean;
  isDueNow: boolean;
  status: VaccineStatus;
  givenDate: string | null;
  batchNumber: string | null;
  routeSite: string | null;
  administeredBy: string | null;
  notes: string | null;
  attachmentId: number | null;
  attachmentTitle: string | null;
  attachmentOriginalName: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface GrowthHistoryEntry {
  date: string;
  weightKg: number | null;
  heightCm: number | null;
}

export interface PediatricGrowth {
  birthWeightKg: number | null;
  latestWeightKg: number | null;
  totalWeightGainKg: number | null;
  birthLengthCm: number | null;
  latestLengthCm: number | null;
  birthHeadCircumferenceCm: number | null;
  doubledBirthWeight: boolean;
  tripledBirthWeight: boolean;
  history: GrowthHistoryEntry[];
}

export interface PediatricSummary {
  totalVaccines: number;
  givenCount: number;
  pendingCount: number;
  overdueCount: number;
  exemptCount: number;
  completionPercentage: number;
}

export interface PediatricResponse {
  patientId: number;
  patientName: string;
  phone?: string | null;
  parentName?: string | null;
  dateOfBirth: string | null;
  ageFormatted: string;
  profile: PediatricProfile | null;
  vaccinations: VaccineItem[];
  growth: PediatricGrowth;
  summary: PediatricSummary;
}

// ---------- Clinical Summary & Referral Card ----------

export interface ClinicalSummaryPatient {
  id: number;
  patientNumber: string;
  fullName: string;
  dateOfBirth: string | null;
  ageYears: number | null;
  ageIsEstimated: boolean;
  phone: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  allergyStatus: 'unknown' | 'none' | 'known';
  allergyDetails: string | null;
  bloodGroup: string | null;
  medicalHistory: string | null;
  surgicalHistory: string | null;
  familyHistory: string | null;
  menstrualHistory: string | null;
  lastMenstrualPeriod: string | null;
  menopauseStatus: string | null;
  obstetricHistory: string | null;
  gravida: number | null;
  para: number | null;
  abortions: number | null;
  living: number | null;
  ongoingMedicines: string | null;
  clinicalNotes: string | null;
}

export interface ClinicalSummaryPregnancy {
  isMaternity: boolean;
  lmp: string | null;
  edd: string | null;
  gestationalAgeFormatted: string | null;
  gestationalWeeks: number | null;
  gestationalDays: number | null;
  trimester: 'First (1–12w)' | 'Second (13–27w)' | 'Third (28–40w+)' | null;
  gpalFormatted: string | null;
  highRiskFlags: string[];
}

export interface ClinicalSummaryVitals {
  recordedAt: string;
  systolic: number | null;
  diastolic: number | null;
  heartRate: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  weightKg: number | null;
  urineProtein: string | null;
  urineGlucose: string | null;
  source: string;
  meowsScore: number;
  meowsLevel: 'normal' | 'yellow' | 'red';
  meowsTriggers: string[];
}

export interface ClinicalSummaryAntenatalTest {
  testKey: string;
  testName: string;
  category: string;
  recommendedWeeks: string;
  isMandatory: boolean;
  status: string;
  completedDate: string | null;
  resultValue: string | null;
  notes: string | null;
  attachmentTitle: string | null;
}

export interface ClinicalSummaryAntenatalTests {
  total: number;
  done: number;
  pending: number;
  items: ClinicalSummaryAntenatalTest[];
}

export interface ClinicalSummaryVisit {
  id: number;
  visitDate: string;
  status: string;
  assessment: string | null;
  complaints: string | null;
  examination: string | null;
  advice: string | null;
  followUpDate: string | null;
  antenatalNotes: string | null;
  doctorName: string | null;
}

export interface ClinicalSummaryMedicine {
  medicine: string;
  strength: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  prescribedDate: string;
}

export interface ClinicalSummaryAdmission {
  id: number;
  admissionNumber: string;
  admittedDate: string;
  dischargedDate: string | null;
  status: string;
  reason: string | null;
  finalDiagnosis: string | null;
  conditionAtDischarge: string | null;
  dischargeMedicines: string | null;
}

export interface ClinicalSummaryResponse {
  patient: ClinicalSummaryPatient;
  pregnancy: ClinicalSummaryPregnancy;
  latestVitals: ClinicalSummaryVitals | null;
  antenatalTests: ClinicalSummaryAntenatalTests | null;
  recentVisits: ClinicalSummaryVisit[];
  activeMedicines: ClinicalSummaryMedicine[];
  latestAdmission: ClinicalSummaryAdmission | null;
  latestUltrasound?: UltrasoundReport | null;
  recentLabResults?: LabResultItem[];
}

// ---------- Ultrasound / Sonography Reports ----------

export type UltrasoundScanType =
  | 'early_pregnancy'
  | 'nt_first_trimester'
  | 'anomaly_scan'
  | 'growth_wellbeing'
  | 'pelvic_gyn'
  | 'other';

export interface UltrasoundReport {
  id: number;
  patientId: number;
  visitId?: number | null;
  scanDate: string;
  scanType: UltrasoundScanType;
  indication?: string | null;
  clinicalLmp?: string | null;
  eddByLmp?: string | null;
  eddByScan?: string | null;
  gestationalAgeWeeks?: number | null;
  gestationalAgeDays?: number | null;
  fetalNumber: 'single' | 'twins' | 'triplets' | 'none';
  cardiacActivity: 'present' | 'absent' | 'not_applicable';
  fhrBpm?: number | null;
  presentation?: 'cephalic' | 'breech' | 'transverse' | 'oblique' | 'variable' | 'not_applicable' | null;
  placentaLocation?: 'anterior' | 'posterior' | 'fundal' | 'low_lying' | 'previa' | 'not_applicable' | null;
  placentaGrade?: '0' | '1' | '2' | '3' | 'not_applicable' | null;
  amnioticFluidType?: 'afi' | 'sdp' | 'adequate' | 'reduced' | 'increased' | 'not_applicable' | null;
  amnioticFluidCm?: number | null;
  amnioticFluidAssessment?: 'normal' | 'borderline' | 'oligohydramnios' | 'polyhydramnios' | 'not_applicable' | null;
  gsdMm?: number | null;
  crlMm?: number | null;
  ntMm?: number | null;
  nasalBone?: 'present' | 'absent' | 'hypoplastic' | 'not_visualized' | null;
  bpdMm?: number | null;
  hcMm?: number | null;
  acMm?: number | null;
  flMm?: number | null;
  efwGrams?: number | null;
  efwPercentile?: string | null;
  anatomySurvey?: string | null;
  uterusFindings?: string | null;
  endometrialThicknessMm?: number | null;
  rightOvaryFindings?: string | null;
  leftOvaryFindings?: string | null;
  freeFluid?: 'none' | 'minimal' | 'moderate' | 'gross' | null;
  impression: string;
  recommendations?: string | null;
  sonographerName?: string | null;
  attachmentId?: number | null;
  attachmentTitle?: string | null;
  attachmentOriginalName?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  patientNumber?: string;
  patientName?: string;
  dateOfBirth?: string | null;
  patientPhone?: string | null;
}

export interface UltrasoundListResponse {
  patientId: number;
  reports: UltrasoundReport[];
}

// ---------- Laboratory Investigation Orders & Results ----------

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

export interface LabResultItem {
  id: number;
  orderId: number;
  patientId: number;
  testName: string;
  category: LabCategory;
  resultValue?: string | null;
  numericValue?: number | null;
  unit?: string | null;
  referenceRange?: string | null;
  flag: LabResultFlag;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string | null;
  reportedDate?: string | null;
  attachmentId?: number | null;
  attachmentTitle?: string | null;
  attachmentOriginalName?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabOrder {
  id: number;
  patientId: number;
  visitId?: number | null;
  orderNumber: string;
  orderDate: string;
  priority: LabPriority;
  status: LabOrderStatus;
  clinicalNotes?: string | null;
  panelName?: string | null;
  orderedByName?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  patientNumber?: string;
  patientName?: string;
  dateOfBirth?: string | null;
  patientPhone?: string | null;
  items: LabResultItem[];
}

export interface LabOrderListResponse {
  patientId: number;
  orders: LabOrder[];
}
