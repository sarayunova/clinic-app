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

export interface BedObservation {
  systolicMmhg?: number | null;
  diastolicMmhg?: number | null;
  pulseBpm?: number | null;
  temperatureC?: number | null;
  spo2Pct?: number | null;
  respRate?: number | null;
  clinicalAt?: string | null;
  date?: string | null;
  time?: string | null;
}

export interface BedActiveLaborPartograph {
  id: number;
  partographNumber: string;
  status: 'active' | 'completed' | 'discontinued';
  startTime: string;
}

export interface Bed {
  id: number;
  room: string;
  label: string;
  active: boolean;
  occupied: boolean;
  admissionId?: number | null;
  admissionNumber?: string | null;
  admissionVersion?: number | null;
  admissionReason?: string | null;
  admissionDiagnosis?: string | null;
  expectedDischargeDate?: string | null;
  patientId?: number | null;
  patientName?: string | null;
  patientNumber?: string | null;
  patientAgeYears?: number | null;
  allergyStatus?: 'unknown' | 'none' | 'known' | null;
  allergyDetails?: string | null;
  dayNumber?: number | null;
  admittedAt?: string | null;
  admittedDate?: string | null;
  admittedTime?: string | null;
  lastObservation?: BedObservation | null;
  activeLaborPartograph?: BedActiveLaborPartograph | null;
  mayBeDueCount?: number;
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
  expectedDischargeDate?: string | null;
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

export type BiometricTag =
  | 'bpd'
  | 'hc'
  | 'ac'
  | 'fl'
  | 'crl'
  | 'nt'
  | 'cardiac'
  | 'doppler'
  | 'placenta'
  | '3d_face'
  | 'general';

export interface UltrasoundImage {
  id: number;
  reportId: number;
  patientId: number;
  attachmentId: number;
  imageLabel: string | null;
  biometricTag: BiometricTag;
  measurementValue: string | null;
  includeInPrint: boolean;
  displayOrder: number;
  originalName: string;
  mime: string;
  sizeBytes: number;
  attachmentTitle: string | null;
  createdAt: string;
}

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
  ofdMm?: number | null;
  cephalicIndex?: number | null;
  cephalicShape?: 'dolichocephaly' | 'mesocephaly' | 'brachycephaly' | null;
  hcMm?: number | null;
  acMm?: number | null;
  flMm?: number | null;
  hcAcRatio?: number | null;
  flAcRatio?: number | null;
  gaDiscordanceDays?: number | null;
  efwGrams?: number | null;
  efwPercentile?: string | null;
  growthCategory?: 'severe_fgr' | 'moderate_fgr' | 'aga' | 'lga' | 'macrosomia' | null;

  // Doppler Velocimetry
  uaPi?: number | null;
  uaRi?: number | null;
  uaSdRatio?: number | null;
  uaEndDiastolicFlow?: 'normal_positive' | 'reduced' | 'aedf_absent' | 'redf_reversed' | 'not_performed' | null;
  mcaPi?: number | null;
  mcaRi?: number | null;
  mcaPsvCmS?: number | null;
  mcaMom?: number | null;
  cprRatio?: number | null;
  cprAssessment?: 'normal' | 'brain_sparing_redistribution' | 'not_applicable' | null;
  utaMeanPi?: number | null;
  utaBilateralNotching?: boolean | null;
  dvAWave?: 'positive' | 'absent' | 'reversed' | 'not_performed' | null;

  // Manning Biophysical Profile (BPP)
  bppBreathing?: number | null;
  bppMovement?: number | null;
  bppTone?: number | null;
  bppAmnioticFluid?: number | null;
  bppNstReactive?: number | null;
  bppTotalScore?: number | null;
  bppInterpretation?: 'reassuring' | 'equivocal' | 'abnormal_asphyxia_risk' | 'not_performed' | null;
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
  images?: UltrasoundImage[];
}

export interface UltrasoundListResponse {
  patientId: number;
  reports: UltrasoundReport[];
}

export interface UltrasoundGrowthInterval {
  fromScanId: number;
  fromDate: string;
  fromEfwGrams: number;
  fromGaWeeks: number | null;
  toScanId: number;
  toDate: string;
  toEfwGrams: number;
  toGaWeeks: number | null;
  intervalDays: number;
  weightDeltaGrams: number;
  gramsPerDay: number;
  gramsPerWeek: number;
  velocityStatus: 'normal' | 'slow' | 'stagnant' | 'negative';
}

export interface UltrasoundGrowthVelocityResponse {
  patientId: number;
  scansCount: number;
  scans: Array<{
    id: number;
    scanDate: string;
    gaWeeks: number | null;
    gaDays: number | null;
    efwGrams: number;
    efwPercentile: string | null;
    growthCategory: string | null;
  }>;
  intervals: UltrasoundGrowthInterval[];
  latestInterval: UltrasoundGrowthInterval | null;
}

export interface UltrasoundBiometryScan {
  id: number;
  scanDate: string;
  scanType: UltrasoundScanType;
  gestationalAgeWeeks: number | null;
  gestationalAgeDays: number | null;
  clinicalLmp: string | null;
  eddByLmp: string | null;
  eddByScan: string | null;
  lmpGaDays: number | null;
  lmpGaFormatted: string | null;
  scanGaDays: number | null;
  scanGaFormatted: string | null;
  deltaDays: number | null;
  growthStatus: string;
  bpdMm: number | null;
  hcMm: number | null;
  acMm: number | null;
  flMm: number | null;
  crlMm: number | null;
  ntMm: number | null;
  efwGrams: number | null;
  efwPercentile: string | null;
  amnioticFluidCm: number | null;
  amnioticFluidAssessment: string | null;
  fhrBpm: number | null;
  imagesCount: number;
}

export interface UltrasoundBiometryResponse {
  patientId: number;
  scans: UltrasoundBiometryScan[];
  summary: {
    totalScans: number;
    hasGrowthRestrictionAlert: boolean;
    hasMacrosomiaAlert: boolean;
    latestEfwGrams: number | null;
    latestAfiCm: number | null;
    latestDiscrepancyDays: number | null;
  };
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

// ---------- WHO Partograph / Labor Progress Monitor ----------

export type {
  LiquorState,
  MoldingDegree,
  StationDescent,
  ContractionIntensity,
  LaborOutcome,
  PartographStatus,
  PartographEntry,
  Partograph,
} from './partographLogic';

export interface PartographListResponse {
  patientId?: number;
  admissionId?: number;
  partographs: (import('./partographLogic').Partograph & {
    entryCount?: number;
    latestDilatation?: number | null;
    latestRecordedAt?: string | null;
  })[];
}

export interface OperativeNote {
  id: number;
  operativeNumber: string;
  patientId: number;
  patientName?: string;
  patientNumber?: string;
  patientPhone?: string | null;
  dateOfBirth?: string | null;
  allergyStatus?: 'unknown' | 'none' | 'known';
  allergyDetails?: string | null;
  bloodGroup?: string | null;
  admissionId?: number | null;
  admissionNumber?: string | null;
  bedRoom?: string | null;
  bedLabel?: string | null;
  surgeonId: number;
  surgeonName: string;
  assistantName?: string | null;
  anesthetistName?: string | null;
  pediatricianName?: string | null;
  scrubNurseName?: string | null;
  surgeryDate: string;
  startTime: string;
  endTime?: string | null;
  procedureName: string;
  procedureCategory: 'lscs' | 'operative_vaginal' | 'laparotomy' | 'cervical_encirclage' | 'other';
  indication: string;
  urgency: 'elective' | 'emergency';
  anesthesiaType: 'spinal' | 'general' | 'epidural' | 'cse' | 'local';

  // WHO Safety Checklist
  preopIdentityConsentVerified: boolean;
  preopSiteMarked: boolean;
  preopAnesthesiaSafetyChecked: boolean;
  preopPulseOximeterFunctioning: boolean;
  preopAllergiesReviewed: boolean;
  preopDifficultAirwayAssessed: boolean;
  preopBloodAvailabilityUnits?: string | null;
  preopAntibioticProphylaxis?: string | null;

  // Operative technique & findings
  incisionType?: 'pfannenstiel' | 'joel_cohen' | 'subumbilical_midline' | 'other';
  presentation?: 'cephalic' | 'breech' | 'transverse' | 'compound' | 'other';
  liquorCharacteristics?: 'clear' | 'meconium_thin' | 'meconium_thick' | 'blood_stained' | 'oligohydramnios';
  extractionDetails?: string | null;
  babyDeliveryTime?: string | null;
  placentaDelivery?: 'spontaneous_cct' | 'manual_removal';
  placentaCompleteness?: 'complete_intact' | 'incomplete_explored' | 'morbidly_adherent';
  uterineClosure?: string | null;
  tubalLigationPerformed: boolean;
  tubalLigationNotes?: string | null;
  estimatedBloodLossMl: number;
  findingsNotes?: string | null;

  // Newborn summary
  babyGender?: 'male' | 'female' | 'ambiguous' | null;
  babyWeightGrams?: number | null;
  apgar1min?: number | null;
  apgar5min?: number | null;
  babyResuscitationDetails?: string | null;

  // Safety count
  spongeCountVerified: boolean;
  instrumentCountVerified: boolean;
  needleCountVerified: boolean;
  drainPlaced: boolean;
  drainType?: string | null;
  closureDetails?: string | null;

  // Post-op orders
  postopVitalsMonitoring?: string | null;
  postopIvFluids?: string | null;
  postopAnalgesia?: string | null;
  postopAntibiotics?: string | null;
  postopThromboprophylaxis?: string | null;
  postopDiet?: string | null;
  postopCatheterInstructions?: string | null;
  specialInstructions?: string | null;

  status: 'draft' | 'completed' | 'amended';
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Antenatal High-Risk Assessment & Scoring Engine ----------

export interface AntenatalRiskAssessment {
  id: number;
  patientId: number;
  assessmentDate: string;
  gestationalAgeWeeks?: number | null;
  gestationalAgeDays?: number | null;
  assessedBy: number;
  assessedByName?: string | null;
  peFactors: string[];
  peRiskLevel: 'low' | 'moderate' | 'high';
  peAspirinIndicated: boolean;
  peAspirinPrescribed: boolean;
  peAspirinDosage?: string | null;
  peCalciumIndicated: boolean;
  peCalciumPrescribed: boolean;
  vteFactors: string[];
  vteScore: number;
  vteRiskLevel: 'low' | 'low_moderate' | 'intermediate' | 'high';
  vteProphylaxisRecommended?: string | null;
  vteLmwhPrescribed: boolean;
  vteLmwhDosage?: string | null;
  gdmFactors: string[];
  gdmRiskLevel: 'standard' | 'high';
  gdmScreeningTiming?: string | null;
  gdmDiagnosisStatus: 'not_tested' | 'pending' | 'normal' | 'gdm_confirmed';
  gdmFastingMgdl?: number | null;
  gdm1hrMgdl?: number | null;
  gdm2hrMgdl?: number | null;
  gdmManagementPlan?: string | null;
  ptbFactors: string[];
  ptbRiskLevel: 'low' | 'high';
  ptbProgesteroneIndicated: boolean;
  ptbProgesteronePrescribed: boolean;
  ptbCerclageAdvised: boolean;
  overallRiskLevel: 'low_risk' | 'moderate_risk' | 'high_risk';
  highRiskReasons?: string | null;
  clinicalActionPlan?: string | null;
  consultantNotes?: string | null;
  nextReviewDate?: string | null;
  createdAt: string;
  updatedAt: string;
  patientNumber?: string;
  patientName?: string;
  dateOfBirth?: string | null;
  patientPhone?: string | null;
  lastMenstrualPeriod?: string | null;
  gravida?: number | null;
  para?: number | null;
}

export interface RiskAssessmentListResponse {
  patientId: number;
  assessments: AntenatalRiskAssessment[];
}

export interface PatientRiskSummary {
  patientId: number;
  hasAssessment: boolean;
  isHighRisk: boolean;
  overallRiskLevel: 'not_assessed' | 'low_risk' | 'moderate_risk' | 'high_risk';
  activeAlerts: string[];
  prophylaxisPrescribed: string[];
  latestAssessment?: AntenatalRiskAssessment | null;
}

// ---------- Obstetric Postnatal Discharge Summary & Puerperium Care Pack ----------

export interface ObstetricDischargeSummary {
  id: number;
  patientId: number;
  admissionId?: number | null;
  admissionNumber?: string | null;
  dischargeDate: string;
  deliveryAt?: string | null;
  deliveryMode: 'normal_vaginal' | 'assisted_vacuum' | 'assisted_forceps' | 'elective_lscs' | 'emergency_lscs' | 'vbac';
  deliveryIndication?: string | null;
  deliveryNotes?: string | null;
  primaryObstetrician?: string | null;
  perineumWoundStatus: 'intact' | 'episiotomy_healed' | 'perineal_tear_repaired' | 'lscs_wound_clean' | 'superficial_dehiscence' | 'infected' | 'other';
  perineumNotes?: string | null;
  fundalInvolution: 'contracted_normal' | 'well_contracted' | 'subinvoluted' | 'tender' | 'boggy';
  fundalHeightCm?: string | null;
  lochiaCharacter: 'rubra' | 'serosa' | 'alba' | 'excessive' | 'foul_smelling';
  lochiaNotes?: string | null;
  lactationStatus: 'established' | 'initiating' | 'suppressed' | 'cracked_nipples' | 'engorgement' | 'mastitis';
  breastExamination?: string | null;
  bladderBowelStatus?: string | null;
  dischargeBpSystolic?: number | null;
  dischargeBpDiastolic?: number | null;
  dischargePulse?: number | null;
  dischargeTempF?: number | null;
  dischargeSpo2?: number | null;
  contraceptionCounselled: boolean;
  contraceptionChosen: 'ppiucd_inserted' | 'progestin_only_pill' | 'lactational_amenorrhea' | 'barrier_condom' | 'tubal_sterilization' | 'inj_depo' | 'undecided' | 'none';
  contraceptionNotes?: string | null;
  dischargeMedicinesText?: string | null;
  alarmSignsCounselled: boolean;
  babyGender: 'female' | 'male' | 'ambiguous';
  babyBirthWeightGrams?: number | null;
  babyDischargeWeightGrams?: number | null;
  babyLengthCm?: number | null;
  babyHcCm?: number | null;
  babyGestationalAgeWeeks?: number | null;
  babyGestationalAgeDays?: number | null;
  babyApgar1min?: number | null;
  babyApgar5min?: number | null;
  babyCryAtBirth: 'immediate_vigorous' | 'delayed' | 'required_stimulation' | 'none';
  babyResuscitationDetails?: string | null;
  babyBloodGroup?: string | null;
  babyPediatricPatientId?: number | null;
  babyPatientNumber?: string | null;
  babyPatientName?: string | null;
  neonatalExam: Record<string, string>;
  neonatalFeedingMethod: 'exclusive_breastfeeding' | 'expressed_breast_milk' | 'mixed_feeding' | 'formula_feeding';
  meconiumPassed: boolean;
  urinePassed: boolean;
  jaundiceAssessment: 'none' | 'mild_physiological' | 'phototherapy_required' | 'pathological';
  bcgGiven: boolean;
  bcgDate?: string | null;
  opvZeroGiven: boolean;
  opvZeroDate?: string | null;
  hepbBirthGiven: boolean;
  hepbBirthDate?: string | null;
  hearingScreenResult: 'pass' | 'refer' | 'not_screened';
  metabolicScreenResult: 'normal' | 'pending' | 'abnormal' | 'not_screened';
  maternalFollowupDate?: string | null;
  newbornFollowupDate?: string | null;
  consultantSpecialInstructions?: string | null;
  status: 'draft' | 'finalized';
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  patientNumber?: string;
  patientName?: string;
  dateOfBirth?: string | null;
  patientPhone?: string | null;
  gravida?: number | null;
  para?: number | null;
}

export interface ObstetricDischargeListResponse {
  patientId: number;
  discharges: ObstetricDischargeSummary[];
}

// ---------- Maternity Admission Card & Delivery Ward Handover Board ----------

export interface MaternityAdmission {
  id: number;
  patientId: number;
  admissionId?: number | null;
  admissionDate: string;
  laborStage: 'not_in_labor' | 'latent_phase' | 'active_phase' | 'second_stage' | 'third_stage' | 'immediate_postpartum';
  admissionIndication: 'in_labor' | 'prom' | 'postdated' | 'induction_of_labor' | 'pre_eclampsia' | 'gdm_monitoring' | 'fetal_growth_restriction' | 'reduced_fetal_movements' | 'antepartum_hemorrhage' | 'elective_lscs_planned' | 'other';
  indicationDetails?: string | null;
  contractionOnsetAt?: string | null;
  gestationalAgeWeeks?: number | null;
  gestationalAgeDays?: number | null;
  gravida?: number | null;
  para?: number | null;
  bloodGroup?: string | null;
  allergiesSummary?: string | null;
  highRiskAlerts?: string | null;
  bishopDilation: number;
  bishopEffacement: number;
  bishopStation: number;
  bishopConsistency: number;
  bishopPosition: number;
  bishopTotalScore: number;
  bishopInterpretation: 'unfavorable' | 'intermediate' | 'favorable';
  membraneStatus: 'intact' | 'ruptured_clear' | 'ruptured_meconium_thin' | 'ruptured_meconium_thick' | 'ruptured_blood_stained';
  membraneRupturedAt?: string | null;
  membraneRuptureHours?: number | null;
  promAntibioticsGiven: boolean;
  liquorNotes?: string | null;
  fetalHeartRate?: number | null;
  fetalPresentation: 'cephalic_vertex' | 'breech_frank' | 'breech_complete' | 'transverse_lie' | 'compound' | 'other';
  fetalLie: 'longitudinal' | 'transverse' | 'oblique';
  fetalEngagement: 'engaged' | 'not_engaged' | 'deeply_engaged';
  ctgCategory: 'category_1' | 'category_2' | 'category_3' | 'not_performed';
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  pulse?: number | null;
  temperatureF?: number | null;
  spo2?: number | null;
  urineProtein: 'nil' | 'trace' | '1+' | '2+' | '3+' | '4+';
  currentLocation: 'triage' | 'antenatal_ward' | 'labor_room' | 'delivery_suite' | 'operating_theatre' | 'recovery_postnatal';
  attendingMidwifeNurse?: string | null;
  primaryObstetrician?: string | null;
  activeOxytocinRate?: string | null;
  latestCervicalDilationCm?: number | null;
  latestFetalStation?: string | null;
  status: 'in_labor' | 'induction' | 'transferred_to_ot' | 'delivered' | 'discharged' | 'cancelled';
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  patientName?: string;
  patientNumber?: string;
  dateOfBirth?: string | null;
  patientPhone?: string | null;
  admissionNumber?: string | null;
  bedRoom?: string | null;
  bedLabel?: string | null;
  latestHandover?: {
    id: number;
    shiftName: string;
    handoverAt: string;
    recommendation: string;
    urgencyLevel: string;
  } | null;
  lscsPrepActive?: boolean;
  handovers?: MaternityHandoverEntry[];
  oxytocinLogs?: OxytocinTitrationLog[];
  emergencyLscsChecklist?: EmergencyLscsChecklist | null;
}

export interface MaternityHandoverEntry {
  id: number;
  maternityAdmissionId: number;
  shiftName: 'morning' | 'evening' | 'night';
  handoverAt: string;
  outgoingStaff: string;
  incomingStaff: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  urgencyLevel: 'routine' | 'watch_closely' | 'immediate_attention';
  createdBy: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface OxytocinTitrationLog {
  id: number;
  maternityAdmissionId: number;
  loggedAt: string;
  infusionRateMUPerMin: number;
  dropsPerMin?: number | null;
  contractionsPer10min: number;
  contractionDurationSec: number;
  contractionIntensity: 'mild' | 'moderate' | 'strong';
  fetalHeartRate: number;
  maternalPulse?: number | null;
  maternalBpSystolic?: number | null;
  maternalBpDiastolic?: number | null;
  hyperstimulationNoted: boolean;
  actionTaken?: string | null;
  loggedBy: number;
  loggedByName?: string | null;
  createdAt: string;
}

export interface EmergencyLscsChecklist {
  id: number;
  maternityAdmissionId: number;
  decisionAt: string;
  decisionToDeliveryTargetMins: number;
  lscsCategory: 'category_1_immediate_threat' | 'category_2_maternal_fetal_compromise' | 'category_3_early_delivery' | 'category_4_elective';
  surgicalIndication: string;
  operatingSurgeon?: string | null;
  anesthetistNotified: boolean;
  anesthetistName?: string | null;
  pediatricianNotified: boolean;
  pediatricianName?: string | null;
  consentSigned: boolean;
  consentType?: string | null;
  npoSolidHours?: number | null;
  npoClearFluidsHours?: number | null;
  wideBoreIvAccess: boolean;
  bloodArranged: boolean;
  bloodUnitsArranged?: number | null;
  preopAntacidGiven: boolean;
  antibioticProphylaxisGiven: boolean;
  antibioticNameTime?: string | null;
  foleyCatheterInserted: boolean;
  abdominalPrepDone: boolean;
  otReady: boolean;
  shiftedToOtAt?: string | null;
  notes?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  updatedAt: string;
}

export interface DeliveryWardBoardResponse {
  count: number;
  admissions: MaternityAdmission[];
}

// ---------- Antenatal Longitudinal Lab Trends & Serology Matrix ----------

export interface AntenatalLabTrend {
  id: number;
  patientId: number;
  testDate: string;
  gestationalAgeWeeks?: number | null;
  gestationalAgeDays?: number | null;
  trimester: 't1' | 't2' | 't3';
  parameterKey: string;
  parameterName: string;
  numericValue: number;
  unit: string;
  referenceRange?: string | null;
  abnormalFlag: 'normal' | 'low' | 'high' | 'critical';
  clinicalAction?: string | null;
  labResultId?: number | null;
  attachmentId?: number | null;
  createdBy: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface AntenatalLabTrendsResponse {
  patientId: number;
  totalCount: number;
  trendsByParam: Record<string, AntenatalLabTrend[]>;
  allTrends: AntenatalLabTrend[];
}

export interface AntenatalSerologyMatrix {
  id?: number;
  patientId: number;
  bloodGroupAbo?: string | null;
  rhFactor?: 'positive' | 'negative' | null;
  indirectCoombsTestBooking: 'negative' | 'positive' | 'not_done';
  indirectCoombsTest28w: 'negative' | 'positive' | 'not_done';
  antiDGiven: boolean;
  antiDGivenDate?: string | null;
  antiDBatchDose?: string | null;
  hivStatus: 'non_reactive' | 'reactive' | 'pending' | 'not_tested';
  hivTestedDate?: string | null;
  hbsagStatus: 'non_reactive' | 'reactive' | 'pending' | 'not_tested';
  hbsagTestedDate?: string | null;
  hcvStatus: 'non_reactive' | 'reactive' | 'pending' | 'not_tested';
  hcvTestedDate?: string | null;
  vdrlRprStatus: 'non_reactive' | 'reactive' | 'pending' | 'not_tested';
  vdrlRprTiter?: string | null;
  vdrlTestedDate?: string | null;
  rubellaIggStatus: 'immune' | 'non_immune' | 'equivocal' | 'not_tested';
  rubellaIggValue?: number | null;
  rubellaTestedDate?: string | null;
  gbsCultureStatus: 'negative' | 'positive' | 'pending' | 'not_tested';
  gbsTestedDate?: string | null;
  urineCultureStatus: 'no_growth' | 'significant_growth' | 'mixed_growth' | 'not_tested';
  urineCultureOrganism?: string | null;
  urineCultureDate?: string | null;
  hemoglobinopathyHplc: 'normal_a1_a2' | 'beta_thalassemia_trait' | 'sickle_cell_trait' | 'hb_e_trait' | 'other_variant' | 'not_tested';
  hplcHba2Pct?: number | null;
  hplcTestedDate?: string | null;
  consultantReviewNotes?: string | null;
  updatedBy?: number;
  updatedByName?: string | null;
  updatedAt?: string;
}

export interface AntenatalSerologyResponse {
  patientId: number;
  exists: boolean;
  serology: AntenatalSerologyMatrix | null;
}

// ---------- Antenatal Medication Safety & Teratogenic Exposure Registry ----------

export interface AntenatalMedicationExposure {
  id: number;
  patientId: number;
  medicineName: string;
  genericName?: string | null;
  fdaCategory: 'A' | 'B' | 'C' | 'D' | 'X' | 'N/A';
  riskLevel: 'safe' | 'caution' | 'high_risk' | 'contraindicated';
  trimesterExposure: 'preconception' | 't1_organogenesis' | 't2' | 't3' | 'multiple_unknown';
  gestationalAgeWeeks?: number | null;
  gestationalAgeDays?: number | null;
  exposureStartDate?: string | null;
  exposureEndDate?: string | null;
  exposureDose?: string | null;
  fetalRiskSummary: string;
  teratogenicMechanism?: string | null;
  anomalyScanIndicated: boolean;
  fetalEchoIndicated: boolean;
  counselingNotes?: string | null;
  actionPlan?: string | null;
  counseledBy: number;
  counseledByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationExposuresResponse {
  patientId: number;
  count: number;
  exposures: AntenatalMedicationExposure[];
}

// ---------- Postpartum Hemorrhage (PPH) & Quantitative Blood Loss (QBL) ----------

export interface PphTimelineEntry {
  id: number;
  pphAssessmentId: number;
  loggedAt: string;
  drapeIncrementMl: number;
  spongeIncrementG: number;
  clotsIncrementG: number;
  cumulativeQblMl: number;
  pulse?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  shockIndex?: number | null;
  actionTaken?: string | null;
  loggedBy: number;
  loggedByName?: string | null;
  createdAt: string;
}

export interface PphAssessment {
  id: number;
  patientId: number;
  maternityAdmissionId?: number | null;
  deliveryMode: 'vaginal' | 'cesarean' | 'assisted_vacuum_forceps';
  deliveryTimestamp: string;
  assessmentTimestamp: string;
  pphStage: 'stage_0_routine' | 'stage_1_alert' | 'stage_2_moderate' | 'stage_3_severe_mtp';
  primaryEtiology4t: 'tone_atony' | 'trauma_laceration' | 'tissue_retained' | 'thrombin_coagulopathy' | 'mixed_unclear';
  etiologyDetails?: string | null;
  uterineTone: 'well_contracted_firm' | 'soft_boggy' | 'relaxing_between_massage' | 'uncontracted';
  qblTotalMl: number;
  qblCalibratedDrapeMl: number;
  qblSuctionCanisterMl: number;
  qblSpongesWetWeightG: number;
  qblSpongesDryWeightG: number;
  qblClotsWeighedG: number;
  eblVisualEstimateMl?: number | null;
  maternalPulse?: number | null;
  maternalBpSystolic?: number | null;
  maternalBpDiastolic?: number | null;
  shockIndex?: number | null;
  shockIndexSeverity: 'normal' | 'early_warning' | 'high_risk' | 'critical_collapse';
  meanArterialPressure?: number | null;
  spo2Pct?: number | null;
  temperatureC?: number | null;
  bimanualCompressionDone: boolean;
  bladderCatheterized: boolean;
  ivAccessTwoWideBore: boolean;
  crystalloidsInfusedMl: number;
  oxytocinGiven: boolean;
  oxytocinDoseRoute?: string | null;
  tranexamicAcidGiven: boolean;
  txaGivenAt?: string | null;
  methylergometrineGiven: boolean;
  methergineContraindicated: boolean;
  carboprostGiven: boolean;
  carboprostDosesCount: number;
  carboprostContraindicated: boolean;
  misoprostolGiven: boolean;
  misoprostolDoseMcg: number;
  uterineTamponadeBalloonUsed: boolean;
  balloonFillVolumeMl: number;
  mtpActivated: boolean;
  bloodUnitsTransfused: number;
  ffpUnitsTransfused: number;
  plateletUnitsTransfused: number;
  cryoprecipitateUnitsTransfused: number;
  surgicalIntervention: 'none' | 'compression_sutures_b_lynch' | 'uterine_artery_ligation' | 'internal_iliac_ligation' | 'peripartum_hysterectomy' | 'examination_under_anesthesia';
  outcomeStatus: 'bleeding_controlled' | 'stable_under_observation' | 'transferred_to_ot' | 'transferred_to_icu' | 'critical_unstable';
  attendingObstetrician?: string | null;
  attendingAnesthetist?: string | null;
  nurseInCharge?: string | null;
  notes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  patientName?: string;
  patientNumber?: string;
  dateOfBirth?: string | null;
  patientPhone?: string | null;
  patientBloodGroup?: string | null;
  timelineEntries?: PphTimelineEntry[];
}

export interface PphAssessmentsResponse {
  patientId: number;
  count: number;
  assessments: PphAssessment[];
}

export interface NeonatalNewsObservation {
  id: number;
  resuscitationEventId: number;
  patientId: number;
  recordedAt: string;
  postnatalAgeHours?: number | null;
  heartRateBpm?: number | null;
  hrScore: number;
  respiratoryRateBpm?: number | null;
  rrScore: number;
  temperatureC?: number | null;
  tempScore: number;
  spo2Percent?: number | null;
  spo2Score: number;
  supplementalOxygen: boolean;
  oxygenScore: number;
  color: 'pink' | 'acrocyanosis' | 'pallor' | 'central_cyanosis' | 'jaundice_early';
  colorScore: number;
  toneNeurology: 'normal_active' | 'mildly_floppy_jittery' | 'lethargic_poor_suck' | 'severely_hypotonic_seizures';
  toneScore: number;
  gruntingStridor: 'none' | 'intermittent_audible_stethoscope' | 'persistent_audible_naked_ear';
  gruntingScore: number;
  totalNewsScore: number;
  alertSeverity: 'green_low' | 'yellow_medium' | 'red_high';
  bloodGlucoseMgDl?: number | null;
  feedingStatus?: 'breastfeeding_well' | 'poor_latch' | 'expressed_breast_milk' | 'formula' | 'npo_iv_fluids' | null;
  clinicalActionTaken?: string | null;
  recordedBy: number;
  recordedByName?: string | null;
  createdAt: string;
}

export interface NeonatalResuscitationEvent {
  id: number;
  patientId: number;
  babyPatientId?: number | null;
  maternityAdmissionId?: number | null;
  deliveryTimestamp: string;
  gestationalAgeWeeks?: number | null;
  gestationalAgeDays?: number | null;
  birthWeightGrams?: number | null;
  babyGender: 'female' | 'male' | 'ambiguous' | 'unspecified';
  deliveryMode: 'vaginal' | 'cesarean' | 'assisted_vacuum_forceps';
  liquorAppearance: 'clear' | 'meconium_thin' | 'meconium_thick' | 'blood_stained' | 'absent';

  apgar1mHeartRate: number;
  apgar1mRespiratoryEffort: number;
  apgar1mMuscleTone: number;
  apgar1mReflexIrritability: number;
  apgar1mColor: number;
  apgar1mTotal: number;

  apgar5mHeartRate: number;
  apgar5mRespiratoryEffort: number;
  apgar5mMuscleTone: number;
  apgar5mReflexIrritability: number;
  apgar5mColor: number;
  apgar5mTotal: number;

  apgar10mHeartRate?: number | null;
  apgar10mRespiratoryEffort?: number | null;
  apgar10mMuscleTone?: number | null;
  apgar10mReflexIrritability?: number | null;
  apgar10mColor?: number | null;
  apgar10mTotal?: number | null;

  sasThoracoabdominalMovement: number;
  sasIntercostalRetraction: number;
  sasXiphoidRetraction: number;
  sasNaresDilation: number;
  sasExpiratoryGrunt: number;
  sasTotalScore: number;
  sasDistressSeverity: 'none' | 'mild' | 'moderate' | 'severe';

  initialStepsCompleted: boolean;
  delayedCordClampingSeconds?: number | null;
  temperatureControlMethod: 'skin_to_skin' | 'radiant_warmer' | 'plastic_wrap_preterm' | 'transwarmer_mattress' | 'incubator';
  initialTemperatureC?: number | null;
  meconiumManagement: 'not_applicable' | 'vigorous_routine_care' | 'non_vigorous_bulb_suction' | 'endotracheal_suctioning';
  supplementalOxygenGiven: boolean;
  targetFio2Percent?: number | null;
  ppvInitiated: boolean;
  ppvDevice?: 't_piece_resuscitator' | 'self_inflating_bag' | 'flow_inflating_bag' | null;
  ppvStartSeconds?: number | null;
  mrSopaStepsRequired: boolean;
  laryngealMaskOrEttUsed: 'none' | 'lma_size_1' | 'ett_oral' | 'ett_nasal';
  chestCompressionsPerformed: boolean;
  chestCompressionsDurationSeconds?: number | null;
  epinephrineGiven: boolean;
  epinephrineDoseMg?: number | null;
  volumeExpanderGiven: boolean;
  volumeExpanderMl?: number | null;

  atRiskHypoglycemia: boolean;
  hypoglycemiaRiskReason?: string | null;
  initialBloodGlucoseMgDl?: number | null;
  glucoseManagementAction: 'none' | 'early_breastfeeding' | 'supplemental_formula_ebm' | 'dextrose_10pct_bolus_infusion';

  primaryResuscitationOutcome: 'routine_maternal_side' | 'postnatal_ward_observation' | 'sncu_level_2' | 'nicu_level_3' | 'neonatal_death';
  cordBloodGasPh?: number | null;
  cordBloodGasBe?: number | null;
  pediatricianAttending?: string | null;
  resuscitationNurse?: string | null;
  notes?: string | null;

  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;

  motherName?: string;
  motherPatientNumber?: string;
  babyName?: string | null;
  babyPatientNumber?: string | null;
  newsObservations?: NeonatalNewsObservation[];
}

export interface NeonatalResuscitationsResponse {
  patientId: number;
  count: number;
  events: NeonatalResuscitationEvent[];
}

export interface MaternalMeowsObservation {
  id: number;
  meowsEpisodeId: number;
  patientId: number;
  recordedAt: string;

  respiratoryRate?: number | null;
  rrTrigger: 'green' | 'yellow' | 'red';
  spo2Percent?: number | null;
  spo2Trigger: 'green' | 'yellow' | 'red';
  supplementalO2: boolean;
  o2FlowRateLpm?: number | null;
  temperatureC?: number | null;
  tempTrigger: 'green' | 'yellow' | 'red';
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  bpTrigger: 'green' | 'yellow' | 'red';
  heartRate?: number | null;
  hrTrigger: 'green' | 'yellow' | 'red';
  avpuConsciousness: 'alert' | 'voice' | 'pain' | 'unresponsive' | 'confused_agitated';
  neuroTrigger: 'green' | 'yellow' | 'red';

  painScore: number;
  lochiaStatus: 'normal' | 'scant' | 'heavy_foul_smelling' | 'excessive_clots_hemorrhage';
  lochiaTrigger: 'green' | 'yellow' | 'red';
  urineOutputMlHr?: number | null;
  urineTrigger: 'green' | 'yellow' | 'red';
  proteinuria: 'nil' | 'trace' | '1+' | '2+' | '3+' | '4+';
  proteinuriaTrigger: 'green' | 'yellow' | 'red';

  yellowTriggersCount: number;
  redTriggersCount: number;
  overallAlertLevel: 'normal_green' | 'single_yellow' | 'urgent_two_yellow_one_red' | 'critical_multiple_red';
  actionRequired?: string | null;
  actionTaken?: string | null;
  escalatedToDoctor: boolean;
  escalatedToName?: string | null;

  suspectedInfectionSite?: string | null;
  sosScore: number;
  sosRiskLevel: 'low' | 'intermediate' | 'high_septic_shock';
  serumLactateMmolL?: number | null;
  whiteCellCountK?: number | null;

  bundleBloodCulturesTaken: boolean;
  bundleLactateDrawn: boolean;
  bundleIvAntibioticsGiven: boolean;
  bundleIvFluidsBolusGiven: boolean;
  bundleOxygenApplied: boolean;
  bundleFoleyUrineHourly: boolean;
  bundleNotes?: string | null;

  recordedBy: number;
  recordedByName?: string | null;
  createdAt: string;
}

export interface MaternalMeowsEpisode {
  id: number;
  patientId: number;
  maternityAdmissionId?: number | null;
  episodeType: 'antenatal' | 'intrapartum' | 'postpartum' | 'post_op_lscs';
  startedAt: string;
  clinicalIndication?: string | null;
  primaryDiagnosis?: string | null;
  highRiskFlags?: string | null;
  isActive: boolean;
  status: 'active_monitoring' | 'stepped_down_stable' | 'transferred_to_hdu_icu' | 'discharged' | 'resolved';

  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;

  patientName?: string;
  patientNumber?: string;
  dateOfBirth?: string | null;
  patientPhone?: string | null;
  observations?: MaternalMeowsObservation[];
}

export interface MaternalMeowsEpisodesResponse {
  patientId: number;
  count: number;
  episodes: MaternalMeowsEpisode[];
}

// ---------- Neonatal Hyperbilirubinemia (Jaundice) ----------

export interface NeonatalBilirubinReading {
  id: number;
  episodeId: number;
  patientId: number;
  sampleDatetime: string;
  ageHours: number;
  readingType: 'tsb_serum' | 'tcb_transcutaneous';
  bilirubinMgDl: number;
  bilirubinUmolL?: number | null;
  rateOfRiseMgDlHr?: number | null;
  bhutaniRiskZone?: 'low' | 'low_intermediate' | 'high_intermediate' | 'high' | null;
  phototherapyThresholdMgDl?: number | null;
  exchangeThresholdMgDl?: number | null;
  phototherapyIndicated: boolean;
  exchangeIndicated: boolean;
  clinicalAction?: string | null;
  activePhototherapy: boolean;
  phototherapyDevice?: string | null;
  notes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface NeonatalJaundiceEpisode {
  id: number;
  patientId: number;
  patientName?: string | null;
  patientNumber?: string | null;
  gender?: string | null;
  admissionId?: number | null;
  deliveryRecordId?: number | null;
  birthDatetime: string;
  gestationalAgeWeeks: number;
  birthWeightGrams?: number | null;
  bloodGroup?: string | null;
  maternalBloodGroup?: string | null;
  directCoombsTest: 'positive' | 'negative' | 'not_tested';
  g6pdDeficiency: 'normal' | 'deficient' | 'not_tested';
  neurotoxicityRisk: boolean;
  feedingType: 'exclusive_breastfeeding' | 'formula' | 'mixed';
  status: 'monitoring' | 'under_phototherapy' | 'resolved' | 'escalated_transfusion' | 'discharged';
  clinicalSummary?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  readingsCount: number;
  readings: NeonatalBilirubinReading[];
  latestReading?: NeonatalBilirubinReading | null;
}

export interface NeonatalJaundiceListResponse {
  patientId: number;
  episodes: NeonatalJaundiceEpisode[];
}

export interface InfertilityWorkup {
  id: number;
  patientId: number;
  partnerName?: string | null;
  partnerAge?: number | null;
  infertilityType: 'primary' | 'secondary';
  durationYears?: number | null;
  femaleFactors: string[];
  baselineAmhNgMl?: number | null;
  baselineFshMiuMl?: number | null;
  baselineAfcTotal?: number | null;
  hsgFindings?: string | null;
  semenVolumeMl?: number | null;
  semenConcentrationMilMl?: number | null;
  semenTotalMotilityPct?: number | null;
  semenProgressiveMotilityPct?: number | null;
  semenNormalMorphologyPct?: number | null;
  semenAnalysisInterpretation?: string | null;
  clinicalNotes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolliculometryScan {
  id: number;
  cycleId: number;
  patientId: number;
  scanDatetime: string;
  cycleDay: number;
  rightOvaryFollicles: number[];
  leftOvaryFollicles: number[];
  leadingFollicleSizeMm?: number | null;
  leadingFollicleOvary?: 'right' | 'left' | 'bilateral' | 'none' | null;
  endometrialThicknessMm?: number | null;
  endometrialPattern?: 'trilaminar_a' | 'isogenous_b' | 'hyperechoic_c' | 'irregular' | null;
  freeFluidPod: boolean;
  ovulationRuptureObserved: boolean;
  growthRateMmDay?: number | null;
  readinessStage?: 'baseline' | 'early_follicular' | 'mid_follicular' | 'mature_ready_to_trigger' | 'ovulated_corpus_luteum' | 'hyperstimulation_risk' | null;
  clinicalAdvice?: string | null;
  sonographerNotes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface FolliculometryCycle {
  id: number;
  patientId: number;
  patientName?: string | null;
  patientNumber?: string | null;
  workupId?: number | null;
  cycleNumber: number;
  lmpDate: string;
  protocolType: 'natural' | 'letrozole' | 'clomiphene' | 'gonadotropins' | 'letrozole_plus_gonadotropins' | 'clomiphene_plus_gonadotropins' | 'other';
  protocolDetails?: string | null;
  plannedProcedure: 'timed_intercourse' | 'iui' | 'ivf_referral' | 'cancelled';
  status: 'active' | 'triggered' | 'ovulated_ruptured' | 'completed' | 'cancelled';
  cancellationReason?: string | null;
  triggerDrug?: string | null;
  triggerDatetime?: string | null;
  advisedTicIuiDatetime?: string | null;
  lutealSupport?: string | null;
  cycleOutcome: 'pending' | 'not_pregnant' | 'biochemical_pregnancy' | 'clinical_pregnancy' | 'ectopic' | 'cancelled';
  outcomeNotes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  scansCount: number;
  scans: FolliculometryScan[];
  latestScan?: FolliculometryScan | null;
}

export interface InfertilityWorkupResponse {
  patientId: number;
  workup: InfertilityWorkup | null;
}

export interface FolliculometryCyclesResponse {
  patientId: number;
  cycles: FolliculometryCycle[];
}

export interface ReedaWoundAssessment {
  id: number;
  pathwayId: number;
  patientId: number;
  assessmentDatetime: string;
  postOpDay: number;
  rednessScore: number;
  edemaScore: number;
  ecchymosisScore: number;
  dischargeScore: number;
  approximationScore: number;
  totalReedaScore: number;
  painScore10?: number | null;
  dressingCondition: 'dry_intact' | 'soaked' | 'removed_clean' | 'reinforcement_needed';
  healingCategory: 'optimal_healing' | 'mild_inflammation' | 'moderate_impairment_suspected_ssi' | 'severe_complication_dehiscence';
  actionPlan?: string | null;
  assessorNotes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface ErasPostOpPathway {
  id: number;
  patientId: number;
  patientName?: string | null;
  patientNumber?: string | null;
  admissionId?: number | null;
  operativeNoteId?: number | null;
  surgeryDatetime: string;
  surgeryType: 'elective_lscs' | 'emergency_lscs' | 'laparotomy' | 'myomectomy' | 'other_gynecologic_surgery';
  incisionType: 'pfannenstiel' | 'joel_cohen' | 'midline_vertical' | 'other';
  skinClosureType: 'subcuticular_monocryl' | 'staples' | 'interrupted_mattress' | 'dermabond_glue';
  oralFluidsAchievedHours?: number | null;
  regularDietAchievedHours?: number | null;
  catheterRemovedHours?: number | null;
  firstMobilizationHours?: number | null;
  multimodalAnalgesiaAdherent: boolean;
  dvtProphylaxisApplied: 'early_mobilization_ted' | 'scd_mechanical' | 'lmwh_pharmacological' | 'none';
  status: 'active' | 'discharge_ready' | 'discharged' | 'escalated_complication';
  clinicalNotes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  assessmentsCount: number;
  assessments: ReedaWoundAssessment[];
  latestAssessment?: ReedaWoundAssessment | null;
}

export interface ErasPathwaysResponse {
  patientId: number;
  pathways: ErasPostOpPathway[];
}

// ---------- Gestational Diabetes Mellitus (GDM) & Glycemic Tracker ----------

export interface GdmProfile {
  id: number;
  patient_id: number;
  gestational_age_weeks?: number | null;
  diagnostic_criteria: 'dipsi' | 'iadpsg' | 'carpenter_coustan' | 'prior_pregestational' | 'clinical_hba1c';
  diagnostic_date: string;
  ogtt_fasting_mg_dl?: number | null;
  ogtt_1hr_mg_dl?: number | null;
  ogtt_2hr_mg_dl?: number | null;
  ogtt_3hr_mg_dl?: number | null;
  baseline_hba1c?: number | null;
  white_classification: 'a1_diet' | 'a2_medication' | 'class_b_pregestational' | 'class_c' | 'class_d';
  current_management: 'medical_nutrition_therapy' | 'metformin' | 'insulin' | 'insulin_plus_metformin';
  target_fasting_mg_dl: number;
  target_postprandial_mg_dl: number;
  postprandial_window: '1_hour' | '2_hour';
  target_hba1c: number;
  insulin_regimen_type: 'none' | 'basal_only' | 'bolus_only' | 'basal_bolus' | 'split_mixed_nph_reg';
  basal_insulin_name?: string | null;
  basal_units_morning?: number | null;
  basal_units_night?: number | null;
  bolus_insulin_name?: string | null;
  bolus_units_breakfast?: number | null;
  bolus_units_lunch?: number | null;
  bolus_units_dinner?: number | null;
  metformin_dose_mg_day?: number | null;
  dietary_calories_prescribed?: number | null;
  fetal_surveillance_notes?: string | null;
  planned_delivery_weeks?: number | null;
  status: 'active' | 'resolved_postpartum' | 'converted_type2';
  notes?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface GdmGlucoseLog {
  id: number;
  profile_id: number;
  patient_id: number;
  log_date: string;
  log_time: string;
  meal_slot:
    | 'fasting'
    | 'post_breakfast'
    | 'pre_lunch'
    | 'post_lunch'
    | 'pre_dinner'
    | 'post_dinner'
    | 'bedtime'
    | '3_am_nocturnal'
    | 'random';
  blood_glucose_mg_dl: number;
  target_status:
    | 'severe_hypoglycemia'
    | 'mild_hypoglycemia'
    | 'in_target'
    | 'mild_excursion'
    | 'severe_excursion';
  carbs_consumed_estimate?: string | null;
  insulin_administered_units?: number | null;
  physical_activity_min?: number | null;
  symptoms?: string | null;
  action_taken?: string | null;
  source: 'patient_log' | 'ward_nurse_glucometer' | 'lab_venous';
  notes?: string | null;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  created_at: string;
}

export interface GdmFetalSurveillance {
  id: number;
  profile_id: number;
  patient_id: number;
  assessment_date: string;
  gestational_age_weeks?: number | null;
  estimated_fetal_weight_g?: number | null;
  efw_percentile?: number | null;
  abdominal_circumference_mm?: number | null;
  ac_percentile?: number | null;
  amniotic_fluid_index_cm?: number | null;
  single_deepest_pocket_cm?: number | null;
  macrosomia_risk_flag: 'normal' | 'borderline_ac_over_75' | 'macrosomia_suspected' | 'polyhydramnios';
  clinical_plan?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface GdmProfileResponse {
  profile: GdmProfile | null;
  summary: any | null;
  recentSurveillance: GdmFetalSurveillance | null;
}

// ---------- Cardiotocography (CTG) & Non-Stress Test (NST) ----------

export interface CtgEpisode {
  id: number;
  patient_id: number;
  admission_id?: number | null;
  test_type: 'antenatal_nst' | 'intrapartum_continuous' | 'intrapartum_intermittent' | 'oxytocin_challenge_test';
  performed_at: string;
  gestational_age_weeks?: number | null;
  indication?: string | null;
  duration_minutes: number;
  paper_speed_cm_min: number;
  baseline_fhr_bpm: number;
  variability_category: 'absent' | 'minimal' | 'moderate' | 'marked' | 'sinusoidal';
  variability_amplitude_bpm?: number | null;
  accelerations_count: number;
  accelerations_criteria: '15x15' | '10x10';
  decelerations_type: 'none' | 'early' | 'variable_uncomplicated' | 'variable_complicated' | 'late' | 'prolonged';
  decelerations_recurrent: number | boolean;
  decelerations_details?: string | null;
  uterine_contractions_per_10min: number;
  tachysystole_present: number | boolean;
  fetal_movement_felt: number | boolean;
  vibroacoustic_stimulation_done: number | boolean;
  vas_response?: string | null;
  nst_classification: 'reactive' | 'non_reactive' | 'equivocal_unsatisfactory';
  figo_classification: 'normal' | 'suspicious' | 'pathological';
  nichd_category: 'category_1_normal' | 'category_2_indeterminate' | 'category_3_abnormal';
  intrauterine_resuscitation_required: number | boolean;
  resuscitation_measures?: string | null;
  clinical_action_plan?: string | null;
  recommended_follow_up?: string | null;
  fhr_trace_data_json?: string | null;
  tracePoints?: any[];
  resuscitationMeasuresList?: string[];
  notes?: string | null;
  performed_by?: number | null;
  reviewed_by?: number | null;
  performed_by_name?: string | null;
  reviewed_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CtgEpisodesResponse {
  episodes: CtgEpisode[];
}
