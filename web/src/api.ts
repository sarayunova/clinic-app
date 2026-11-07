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
  pndtRegistrationNo?: string;
  pndtMachineDetails?: string;
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

// ---------- Pediatric WHO Growth Standards & Developmental Milestones ----------

export interface PediatricGrowthRecord {
  id: number;
  patient_id: number;
  recorded_date: string;
  age_months: number;
  sex: 'male' | 'female';
  weight_kg?: number | null;
  height_length_cm?: number | null;
  head_circumference_cm?: number | null;
  bmi?: number | null;
  weight_for_age_z?: number | null;
  weight_for_age_status?: 'normal' | 'underweight' | 'severe_underweight' | 'overweight' | null;
  height_for_age_z?: number | null;
  height_for_age_status?: 'normal' | 'stunting' | 'severe_stunting' | 'tall' | null;
  weight_for_height_z?: number | null;
  weight_for_height_status?: 'normal' | 'wasting' | 'severe_acute_malnutrition' | 'overweight' | 'obese' | null;
  hc_for_age_z?: number | null;
  hc_for_age_status?: 'normal' | 'microcephaly' | 'severe_microcephaly' | 'macrocephaly' | null;
  clinical_notes?: string | null;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PediatricMilestoneItem {
  key: string;
  title: string;
  domain: 'gross_motor' | 'fine_motor_adaptive' | 'language_hearing' | 'personal_social';
  expectedAgeMonths: number;
  upperLimitAgeMonths: number;
  description: string;
  status: 'achieved' | 'emerging' | 'delayed' | 'not_tested';
  achievedDate?: string | null;
  ageAchievedMonths?: number | null;
  isRedFlag: boolean;
  notes?: string | null;
  recordedByName?: string | null;
  updatedAt?: string | null;
}

export interface PediatricGrowthResponse {
  records: PediatricGrowthRecord[];
}

export interface PediatricMilestonesResponse {
  currentAgeMonths: number;
  milestones: PediatricMilestoneItem[];
  redFlags: string[];
  delayCount: number;
}

export interface CervicalBiopsy {
  id: number;
  screening_id: number;
  patient_id: number;
  site_location: string;
  clock_position: number | null;
  specimen_label: string | null;
  histopathology_result: string;
  pathologist_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CervicalScreeningRecord {
  id: number;
  patient_id: number;
  screening_date: string;
  screening_type: string;
  indication: string;

  pap_performed: number;
  pap_sample_type: string | null;
  pap_adequacy: string | null;
  pap_result: string | null;
  pap_infections: string[];
  pap_lab_name: string | null;
  pap_report_number: string | null;

  hpv_performed: number;
  hpv_test_type: string | null;
  hpv_overall_result: string | null;
  hpv_16_positive: number;
  hpv_18_positive: number;
  hpv_45_positive: number;
  hpv_other_high_risk_positive: number;
  hpv_viral_load: string | null;

  colposcopy_performed: number;
  colposcopy_date: string | null;
  examiner_name: string | null;
  cervix_visibility: string | null;
  transformation_zone_type: string | null;
  squamocolumnar_junction_visible: string | null;

  swede_acetowhitening: number | null;
  swede_margins: number | null;
  swede_vessels: number | null;
  swede_lesion_size: number | null;
  swede_iodine_staining: number | null;
  swede_score_total: number | null;
  swede_interpretation: string | null;

  reid_margin: number | null;
  reid_color: number | null;
  reid_vessels: number | null;
  reid_iodine: number | null;
  reid_score_total: number | null;
  reid_interpretation: string | null;

  lesion_quadrants: string[];
  endocervical_curettage_done: number;

  biopsy_taken: number;
  biopsy_type: string | null;
  biopsy_sites: string | null;
  biopsy_result: string | null;
  histopathology_number: string | null;

  management_recommendation: string;
  next_recall_months: number | null;
  clinical_notes: string | null;
  status: string;

  created_by_name?: string | null;
  created_at: string;
  updated_at: string;

  biopsies: CervicalBiopsy[];
}

export interface CervicalScreeningListResponse {
  records: CervicalScreeningRecord[];
}

export interface CervicalScreeningDetailResponse {
  record: CervicalScreeningRecord;
  patient: {
    id: number;
    full_name: string;
    date_of_birth: string | null;
    last_menstrual_period: string | null;
  };
  isPregnant: boolean;
  bethesdaMeta: {
    grade: string;
    title: string;
    shortCode: string;
    description: string;
  };
}

export interface ContraceptiveCounselingRecord {
  id: number;
  patient_id: number;
  counseling_date: string;
  reproductive_plan: string;
  desired_spacing_years: number | null;
  breastfeeding_status: string;
  medical_conditions: string[];
  eligibility_results: Record<string, { method: string; name: string; category: number; status: string; reasons: string[]; clinicalNotes: string }> | null;
  chosen_method: string;
  method_rationale: string | null;
  prescribed_units: string | null;
  next_followup_date: string | null;
  counseled_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IucdFollowup {
  id: number;
  insertion_id: number;
  patient_id: number;
  followup_date: string;
  visit_interval: string;
  thread_status: string;
  pelvic_ultrasound_done: number;
  ultrasound_finding: string | null;
  bleeding_pattern: string;
  pelvic_pain_score: number;
  signs_of_infection: number;
  action_taken: string;
  clinical_notes: string | null;
  examined_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IucdInsertionRecord {
  id: number;
  patient_id: number;
  counseling_id: number | null;
  device_type: string;
  device_brand_name: string | null;
  lot_batch_number: string | null;
  device_expiry_date: string | null;
  insertion_timing: string;
  insertion_date: string;
  insertion_time: string | null;
  inserted_by: string;
  uterine_depth_cm: number | null;
  analgesia_used: string;
  thread_length_cut_cm: number | null;
  insertion_ease: string;
  complications: string;
  post_insertion_ultrasound: string;
  lifespan_years: number;
  expected_removal_date: string;
  status: string;
  removal_date: string | null;
  removal_reason: string | null;
  clinical_notes: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  followups: IucdFollowup[];
}

export interface PndtFormFRecord {
  id: number;
  formFNumber: string;
  patientId: number;
  ultrasoundReportId: number | null;
  visitId: number | null;
  scanDate: string;
  scanTime: string | null;
  clinicPndtRegNo: string;
  doctorId: number | null;
  doctorName: string;
  doctorRegNo: string;
  machineModelSerial: string;

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

  referralType: 'self_referred' | 'doctor_referred';
  referringDoctorName: string | null;
  referringDoctorRegNo: string | null;
  referringClinicAddress: string | null;
  referralSlipDate: string | null;
  selfReferralReason: string | null;

  indicationCodes: string[];
  otherIndicationDetail: string | null;
  invasiveProcedureDone: boolean;
  invasiveProcedureDetails: string | null;

  pregnantWomanDeclarationSigned: boolean;
  pregnantWomanDeclarationTime: string;
  pregnantWomanSignatureName: string;
  doctorDeclarationSigned: boolean;
  doctorDeclarationTime: string;
  doctorDeclarationName: string;

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

export interface MonthlyPndtReturnSummary {
  month: string;
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

export interface GeneticScreeningRecord {
  id: number;
  patientId: number;
  visitId: number | null;
  screeningDate: string;
  screeningType: 'first_trimester_combined' | 'quadruple_marker' | 'nipt_cfdna' | 'integrated_sequential' | 'invasive_diagnostic';
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  maternalAgeAtDelivery: number;
  maternalWeightKg: number | null;
  pregnancyType: string;
  ivfPregnancy: boolean;
  diabetesStatus: boolean;
  smoker: boolean;

  crlMm: number | null;
  ntMeasuredMm: number | null;
  ntMom: number | null;
  nasalBone: 'present' | 'absent' | 'hypoplastic' | 'not_visualized' | null;
  tricuspidRegurgitation: 'normal' | 'regurgitant' | 'not_performed' | null;
  ductusVenosus: 'positive' | 'reversed' | 'not_performed' | null;
  freeBetaHcgRaw: number | null;
  freeBetaHcgMom: number | null;
  pappARaw: number | null;
  pappAMom: number | null;

  bpdMm: number | null;
  afpRaw: number | null;
  afpMom: number | null;
  totalHcgRaw: number | null;
  totalHcgMom: number | null;
  ue3Raw: number | null;
  ue3Mom: number | null;
  inhibinARaw: number | null;
  inhibinAMom: number | null;

  backgroundT21RiskRatio: string;
  adjustedT21RiskRatio: string;
  adjustedT21RiskNumeric: number;
  adjustedT18RiskRatio: string;
  adjustedT18RiskNumeric: number;
  adjustedT13RiskRatio: string;
  adjustedT13RiskNumeric: number;
  ontdRiskStatus: 'low_risk' | 'high_risk' | 'not_applicable';
  overallRiskTier: 'low_risk' | 'intermediate_risk' | 'high_risk' | 'inconclusive';

  niptSampleDate: string | null;
  niptFetalFractionPercent: number | null;
  niptT21Result: 'low_risk' | 'high_risk' | 'inconclusive' | null;
  niptT18Result: 'low_risk' | 'high_risk' | 'inconclusive' | null;
  niptT13Result: 'low_risk' | 'high_risk' | 'inconclusive' | null;
  niptSexChromosomes: string | null;
  niptMicrodeletions: string | null;
  niptLabName: string | null;

  clinicalRecommendation: string;
  counselingNotes: string | null;
  counseledBy: number;
  counseledByName?: string | null;
  patientDecision: 'routine_care' | 'opt_for_nipt' | 'opt_for_invasive_diagnostic' | 'declined_further_testing' | 'undecided' | null;

  invasiveProcedureType: 'cvs' | 'amniocentesis' | 'cordocentesis' | 'none' | null;
  invasiveProcedureDate: string | null;
  invasivePerformedBy: string | null;
  invasiveSampleDetails: string | null;
  antiDGiven: boolean;
  karyotypeResult: string | null;
  microarrayCmaResult: string | null;
  rapidQfpcrResult: string | null;
  finalGeneticDiagnosis: string | null;

  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface FetalDopplerAssessment {
  id: number;
  patientId: number;
  ultrasoundReportId: number | null;
  assessmentDate: string;
  assessmentTime: string | null;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;

  estimatedFetalWeightG: number | null;
  efwPercentile: number | null;
  abdominalCircumferenceMm: number | null;
  acPercentile: number | null;

  uaPi: number;
  uaRi: number | null;
  uaSdRatio: number | null;
  uaEndDiastolicFlow: 'normal_positive' | 'reduced' | 'aedf_absent' | 'redf_reversed';
  uaPiCentile: number;
  uaPiStatus: 'normal' | 'elevated_above_95th';

  mcaPi: number;
  mcaRi: number | null;
  mcaPsvCmS: number | null;
  mcaPsvMom: number | null;
  mcaPiCentile: number;
  mcaBrainSparing: 'none' | 'vasodilation_below_5th';
  fetalAnemiaRisk: 'none' | 'mild' | 'moderate_to_severe';

  cprRatio: number;
  cprCentile: number;
  cprStatus: 'normal' | 'brain_sparing_redistribution';

  utaLeftPi: number | null;
  utaRightPi: number | null;
  utaMeanPi: number | null;
  utaMeanPiCentile: number | null;
  utaNotching: 'none' | 'unilateral' | 'bilateral';

  dvPiv: number | null;
  dvPivCentile: number | null;
  dvAWave: 'positive' | 'absent' | 'reversed' | 'not_performed';
  dvStatus: 'normal' | 'elevated_above_95th' | 'reversed_a_wave' | 'not_performed';

  fgrClassification: 'aga' | 'sga' | 'early_fgr' | 'late_fgr';
  barcelonaStage: 'stage_0' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4';
  monitoringFrequencyRecommendation: string;
  deliveryTimingRecommendation: string;
  steroidsIndicated: boolean;
  mgso4NeuroprotectionIndicated: boolean;

  clinicalNotes: string | null;
  performedBy: string | null;
  reviewedBy: number;
  reviewedByName: string | null;

  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}


export interface PreeclampsiaScreeningRecord {
  id: number;
  patientId: number;
  visitId: number | null;
  ultrasoundReportId: number | null;
  assessmentDate: string;
  assessmentTime: string | null;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  crlMm: number | null;

  maternalAge: number;
  maternalWeightKg: number | null;
  maternalHeightCm: number | null;
  bmi: number;
  ethnicity: 'south_asian' | 'caucasian' | 'afro_caribbean' | 'east_asian' | 'other';
  parity: 'nulliparous' | 'multiparous_no_pe' | 'multiparous_prior_pe';
  priorPeOnsetGestation: 'early_lt_34' | 'preterm_34_37' | 'term_gt_37' | null;
  conceptionMethod: 'spontaneous' | 'ivf_art' | 'ovulation_induction';
  smokingStatus: 'non_smoker' | 'smoker' | 'cessation_early_pregnancy';
  familyHistoryPe: boolean;
  chronicHypertension: boolean;
  pregestationalDiabetes: boolean;
  systemicLupusOrAps: boolean;
  chronicKidneyDisease: boolean;
  interpregnancyIntervalYears: number | null;

  sbpRight: number | null;
  dbpRight: number | null;
  sbpLeft: number | null;
  dbpLeft: number | null;
  meanArterialPressure: number;
  mapMom: number;

  utaPiLeft: number | null;
  utaPiRight: number | null;
  utaPiMean: number;
  utaPiMom: number;
  utaBilateralNotching: boolean;

  serumPlgfPgMl: number | null;
  plgfMom: number | null;
  serumPappaIuL: number | null;
  pappaMom: number | null;

  backgroundRiskRatio: string;
  backgroundRiskNumeric: number;
  fmfRiskRatio: string;
  fmfRiskNumeric: number;
  fmfRiskCategory: 'high_risk' | 'low_risk';
  clinicalRiskCategory: 'high_risk' | 'moderate_risk' | 'low_risk';
  overallRiskTier: 'high_risk' | 'low_risk';

  aspirinIndicated: boolean;
  aspirinDoseMg: number;
  aspirinTimingRationale: string;
  calciumIndicated: boolean;
  calciumDoseMg: number;
  surveillanceInterval: string;
  repeatScanWeeks: string;

  clinicalNotes: string | null;
  performedBy: string | null;
  reviewedBy: number;
  reviewedByName: string | null;

  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface FetusAssessmentItem {
  label: string;
  presentation: 'cephalic' | 'breech' | 'transverse' | 'oblique';
  bpdMm?: number | null;
  hcMm?: number | null;
  acMm?: number | null;
  flMm?: number | null;
  efwG: number;
  efwPercentile?: number | null;
  dvpCm: number;
  bladderVisualized: boolean;
  uaPi?: number | null;
  uaFlow: 'normal_positive' | 'reduced' | 'absent_aedf' | 'reversed_redf' | 'intermittent_absent_reversed';
  mcaPi?: number | null;
  mcaPsvCmS?: number | null;
  mcaPsvMom?: number | null;
  dvAWave?: 'positive' | 'absent' | 'reversed' | 'not_performed';
  hydropsPresent?: boolean;
  demised?: boolean;
}

export interface MultipleGestationPregnancy {
  id: number;
  patientId: number;
  plurality: 'twins' | 'triplets';
  chorionicity: 'dcda' | 'mcda' | 'mcma' | 'tcta' | 'dcta' | 'mc';
  amnionicity: 'diamniotic' | 'monoamniotic' | 'triamniotic';
  firstTrimesterSign: 'lambda_sign' | 't_sign' | 'no_dividing_membrane' | null;
  dividingMembraneThicknessMm: number | null;
  placentalConfiguration: 'two_separate' | 'two_fused' | 'single_anterior' | 'single_posterior' | 'single_fundal' | null;
  conceptionMethod: 'spontaneous' | 'ivf_et' | 'ovulation_induction';
  status: 'active' | 'delivered' | 'archived';
  diagnosisGestationWeeks: number | null;
  baselineNotes: string | null;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface MultipleGestationAssessment {
  id: number;
  pregnancyId: number;
  patientId: number;
  ultrasoundReportId: number | null;
  assessmentDate: string;
  assessmentTime: string | null;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  fetuses: FetusAssessmentItem[];

  efwDiscordancePercent: number;
  acDiscordancePercent: number;
  dvpDiscordanceCm: number;
  discordanceSeverity: 'concordant' | 'mild_discordance' | 'significant_discordance_gt_20' | 'severe_discordance_gt_25';
  largerFetusLabel: string | null;
  smallerFetusLabel: string | null;

  tttsStage: 'none' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'stage_5';
  sfgrType: 'none' | 'type_1' | 'type_2' | 'type_3';
  tapsStage: 'none' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'stage_5';
  cordEntanglementNoted: boolean;

  surveillanceIntervalRecommendation: string;
  deliveryTimingRecommendation: string;
  deliveryModeRecommendation: string;
  corticosteroidsIndicated: boolean;
  actionPlan: string | null;

  clinicalNotes: string | null;
  performedBy: string | null;
  reviewedBy: number;
  reviewedByName: string | null;

  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}


// ============================================================================
// Series 7: Labor Induction, Perinatal Loss & ART Cycles
// ============================================================================

export interface LaborInductionEpisode {
  id: number;
  patientId: number;
  admissionId?: number | null;
  initiationDate: string;
  initiationTime?: string | null;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  indication:
    | 'post_dates'
    | 'preeclampsia_gest_htn'
    | 'prom_rom'
    | 'oligohydramnios'
    | 'fgr_placental'
    | 'gdm_diabetes'
    | 'maternal_medical'
    | 'elective_39w'
    | 'other';
  indicationDetails?: string | null;
  previousCesareanCount: number;

  dilationCm: number;
  effacementPercent: number;
  fetalStation: number;
  consistency: 'firm' | 'medium' | 'soft';
  position: 'posterior' | 'mid' | 'anterior';
  calculatedBishopScore: number;
  cervixFavorability: 'unfavorable_le_5' | 'intermediate_6_7' | 'favorable_ge_8';

  ripeningMethod:
    | 'foley_bulb_mechanical'
    | 'cook_double_balloon'
    | 'dinoprostone_pge2_tape'
    | 'dinoprostone_pge2_gel'
    | 'misoprostol_pge1_oral'
    | 'misoprostol_pge1_vaginal'
    | 'direct_arm_oxytocin'
    | 'none';
  ripeningDoseDetails?: string | null;
  contraindicationsChecked: boolean;

  oxytocinUsed: boolean;
  oxytocinStartTime?: string | null;
  oxytocinStartRateMUPerMin?: number | null;
  oxytocinMaxRateMUPerMin?: number | null;
  armPerformed: boolean;
  armTime?: string | null;
  liquorStatus?: 'clear' | 'meconium_grade_1' | 'meconium_grade_2' | 'meconium_grade_3' | 'blood_stained' | null;

  serialBishopJson?: string | null;

  tachysystoleDetected: boolean;
  uterineHyperstimulationManagement?: string | null;

  inductionOutcome:
    | 'in_progress'
    | 'vaginal_delivery_spontaneous'
    | 'vaginal_delivery_vacuum_forceps'
    | 'emergency_cesarean_failed_induction'
    | 'emergency_cesarean_fetal_distress'
    | 'emergency_cesarean_arrest_of_dilation'
    | 'cancelled_patient_request';
  cesareanReason?: string | null;
  deliveryDatetime?: string | null;
  birthWeightGrams?: number | null;
  apgar1Min?: number | null;
  apgar5Min?: number | null;
  postpartumComplications?: string | null;
  inductionSummaryNotes?: string | null;

  attendingObstetrician?: string | null;
  reviewedBy: number;
  reviewedByName?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerinatalLossEpisode {
  id: number;
  patientId: number;
  admissionId?: number | null;
  lossType:
    | 'early_miscarriage_lt_12w'
    | 'late_miscarriage_12_20w'
    | 'stillbirth_antepartum'
    | 'stillbirth_intrapartum'
    | 'neonatal_death_early'
    | 'medical_termination_anomaly';
  diagnosisDate: string;
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  parityPrior?: string | null;

  modeOfDelivery:
    | 'spontaneous_vaginal'
    | 'induced_vaginal'
    | 'emergency_cesarean'
    | 'elective_cesarean'
    | 'surgical_evacuation_d_and_e';
  fetalPresentation?: 'cephalic' | 'breech' | 'transverse' | 'other' | null;
  fetalBirthWeightG?: number | null;
  fetalWeightCentile?: number | null;
  fetalAppearance:
    | 'fresh_stillbirth'
    | 'macerated_slight_peeling'
    | 'macerated_moderate'
    | 'macerated_severe'
    | 'gross_anomalies_present';
  apparentDysmorphicFeatures?: string | null;

  primaryCauseCategory:
    | 'fetal_anomaly_genetic'
    | 'umbilical_cord_accident'
    | 'placental_insufficiency_infarction'
    | 'placental_abruption'
    | 'chorioamnionitis_infection'
    | 'maternal_medical_preeclampsia'
    | 'maternal_medical_diabetes'
    | 'maternal_cholestasis_icp'
    | 'intrapartum_asphyxia'
    | 'unexplained_idiopathic';
  primaryCauseDetails: string;
  contributingFactors?: string | null;
  diagnosticWorkupJson?: string | null;

  maternalBloodGroup?: string | null;
  fetomaternalHemorrhageMl?: number | null;
  antiDAdministered: boolean;
  antiDDoseMcg?: number | null;
  lactationSuppressionGiven: boolean;
  lactationSuppressionDetails?: string | null;
  memoryBoxOffered: boolean;
  memoryBoxAccepted: boolean;
  bereavementCounselorContacted: boolean;

  recurrenceRiskCategory:
    | 'low_less_than_1_pct'
    | 'moderate_2_to_5_pct'
    | 'high_gt_5_pct'
    | 'dependent_on_genetics';
  futurePregnancyPlan: string;
  counselingNotes?: string | null;

  consultantName?: string | null;
  reviewedBy?: number;
  reviewedByName?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArtCycleRecord {
  id: number;
  patientId: number;
  cycleNumber: number;
  startDate: string;
  cycleType:
    | 'ivf_fresh'
    | 'icsi_fresh'
    | 'fet_frozen_transfer'
    | 'iui_husband'
    | 'iui_donor'
    | 'oocyte_vitrification'
    | 'surrogacy';
  protocolType:
    | 'gnrh_antagonist'
    | 'gnrh_agonist_long'
    | 'gnrh_agonist_short'
    | 'minimal_stimulation'
    | 'natural_modified'
    | 'hrt_programmed';
  indication:
    | 'tubal_factor'
    | 'male_factor'
    | 'pcos_ovulatory'
    | 'diminished_ovarian_reserve'
    | 'endometriosis'
    | 'unexplained'
    | 'genetic_pgt'
    | 'secondary_infertility';
  indicationNotes?: string | null;

  gonadotropinType?: string | null;
  totalGonadotropinDoseIu?: number | null;
  stimulationDays?: number | null;
  peakEstradiolPgMl?: number | null;
  triggerProgesteroneNgMl?: number | null;
  triggerType?: 'rhcg_250mcg' | 'urinary_hcg_10000iu' | 'gnrh_agonist_dual' | 'gnrh_agonist_solo_ohss_prevention' | null;
  triggerDatetime?: string | null;

  opuDatetime?: string | null;
  totalOocytesRetrieved: number;
  matureMiiOocytes: number;
  inseminationMethod?: 'standard_ivf' | 'icsi' | 'half_ivf_half_icsi' | 'frozen_thawed' | null;
  fertilized2pnCount: number;
  fertilizationRatePercent?: number | null;

  day3EmbryosCount: number;
  day5BlastocystsCount: number;
  embryosTransferredCount: number;
  transferStage?: 'day_3_cleavage' | 'day_5_blastocyst' | 'day_6_blastocyst' | 'freeze_all_no_transfer' | null;
  transferDatetime?: string | null;
  transferredEmbryosDetails?: string | null;
  endometrialThicknessAtTransferMm?: number | null;
  transferDifficulty: 'easy' | 'moderate_tenaculum' | 'difficult_stylet';
  embryosFrozenCount: number;
  frozenStorageStraws?: string | null;

  lutealSupportRegimen?: string | null;
  betaHcgDay14MiuMl?: number | null;
  betaHcgDay16MiuMl?: number | null;
  hcgDoublingTimeHours?: number | null;
  clinicalPregnancyStatus:
    | 'cycle_in_progress'
    | 'biochemical_pregnancy'
    | 'clinical_intrauterine_sac'
    | 'ectopic_pregnancy'
    | 'negative_not_pregnant'
    | 'cancelled_ohss_risk'
    | 'freeze_all';
  gestationalSacsCount: number;
  fetalHeartPresent: boolean;
  cycleNotes?: string | null;

  leadEmbryologist?: string | null;
  reviewedBy: number;
  reviewedByName?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

// Series 7 API caller methods:
export const getInductionEpisodes = (patientId: number): Promise<LaborInductionEpisode[]> =>
  api<LaborInductionEpisode[]>('GET', `/api/patients/${patientId}/induction`);

export const getInductionEpisode = (id: number): Promise<LaborInductionEpisode> =>
  api<LaborInductionEpisode>('GET', `/api/induction/${id}`);

export const createInductionEpisode = (payload: Partial<LaborInductionEpisode>): Promise<LaborInductionEpisode> =>
  api<LaborInductionEpisode>('POST', '/api/induction', payload);

export const updateInductionEpisode = (id: number, payload: Partial<LaborInductionEpisode>): Promise<LaborInductionEpisode> =>
  api<LaborInductionEpisode>('PUT', `/api/induction/${id}`, payload);

export const deleteInductionEpisode = (id: number): Promise<{ ok: boolean; deletedId: number }> =>
  api<{ ok: boolean; deletedId: number }>('DELETE', `/api/induction/${id}`);

export const auditPrintInduction = (id: number): Promise<{ ok: boolean }> =>
  api<{ ok: boolean }>('POST', `/api/induction/${id}/audit-print`);

export const calculateInduction = (input: any): Promise<any> =>
  api<any>('POST', '/api/induction/calculate', input);

export const getPerinatalLossEpisodes = (patientId: number): Promise<PerinatalLossEpisode[]> =>
  api<PerinatalLossEpisode[]>('GET', `/api/patients/${patientId}/perinatal-loss`);

export const getPerinatalLossEpisode = (id: number): Promise<PerinatalLossEpisode> =>
  api<PerinatalLossEpisode>('GET', `/api/perinatal-loss/${id}`);

export const createPerinatalLossEpisode = (payload: Partial<PerinatalLossEpisode>): Promise<PerinatalLossEpisode> =>
  api<PerinatalLossEpisode>('POST', '/api/perinatal-loss', payload);

export const updatePerinatalLossEpisode = (id: number, payload: Partial<PerinatalLossEpisode>): Promise<PerinatalLossEpisode> =>
  api<PerinatalLossEpisode>('PUT', `/api/perinatal-loss/${id}`, payload);

export const deletePerinatalLossEpisode = (id: number): Promise<{ ok: boolean; deletedId: number }> =>
  api<{ ok: boolean; deletedId: number }>('DELETE', `/api/perinatal-loss/${id}`);

export const auditPrintPerinatalLoss = (id: number): Promise<{ ok: boolean }> =>
  api<{ ok: boolean }>('POST', `/api/perinatal-loss/${id}/audit-print`);

export const calculatePerinatalLoss = (input: any): Promise<any> =>
  api<any>('POST', '/api/perinatal-loss/calculate', input);

export const getArtCycles = (patientId: number): Promise<ArtCycleRecord[]> =>
  api<ArtCycleRecord[]>('GET', `/api/patients/${patientId}/art-cycles`);

export const getArtCycle = (id: number): Promise<ArtCycleRecord> =>
  api<ArtCycleRecord>('GET', `/api/art-cycles/${id}`);

export const createArtCycle = (payload: Partial<ArtCycleRecord>): Promise<ArtCycleRecord> =>
  api<ArtCycleRecord>('POST', '/api/art-cycles', payload);

export const updateArtCycle = (id: number, payload: Partial<ArtCycleRecord>): Promise<ArtCycleRecord> =>
  api<ArtCycleRecord>('PUT', `/api/art-cycles/${id}`, payload);

export const deleteArtCycle = (id: number): Promise<{ ok: boolean; deletedId: number }> =>
  api<{ ok: boolean; deletedId: number }>('DELETE', `/api/art-cycles/${id}`);

export const auditPrintArtCycle = (id: number): Promise<{ ok: boolean }> =>
  api<{ ok: boolean }>('POST', `/api/art-cycles/${id}/audit-print`);

export const calculateArtKinetics = (input: any): Promise<any> =>
  api<any>('POST', '/api/art/calculate-kinetics', input);

export const parseGardnerBlastocystGrade = (gradeCode: string): Promise<any> =>
  api<any>('POST', '/api/art/parse-gardner-grade', { gradeCode });

// ---------- Series 8A: Endometriosis & DIE (#Enzian & rASRM) ----------

export interface EndometriosisEpisode {
  id: number;
  patientId: number;
  admissionId?: number | null;
  assessmentDate: string;
  indication: 'chronic_pelvic_pain' | 'dysmenorrhea' | 'deep_dyspareunia' | 'infertility_workup' | 'adnexal_mass_endometrioma' | 'surgical_follow_up';
  surgicalApproach: 'laparoscopy' | 'laparotomy' | 'robotic' | 'clinical_imaging_only';

  vasDysmenorrhea: number;
  vasDyspareunia: number;
  vasDyschezia: number;
  vasDysuria: number;
  vasChronicPelvicPain: number;

  rasrmPeritonealSuperficialPts: number;
  rasrmPeritonealDeepPts: number;
  rasrmOvaryRightSuperficialPts: number;
  rasrmOvaryRightDeepPts: number;
  rasrmOvaryLeftSuperficialPts: number;
  rasrmOvaryLeftDeepPts: number;
  rasrmAdhesionsOvaryRightPts: number;
  rasrmAdhesionsOvaryLeftPts: number;
  rasrmAdhesionsTubeRightPts: number;
  rasrmAdhesionsTubeLeftPts: number;
  pouchOfDouglasObliteration: 'none' | 'partial_4pts' | 'complete_40pts';
  rasrmTotalScore: number;
  rasrmStage: 'stage_1_minimal' | 'stage_2_mild' | 'stage_3_moderate' | 'stage_4_severe';

  enzianPeritoneum?: string | null;
  enzianOvaryLeft?: string | null;
  enzianOvaryRight?: string | null;
  enzianTubeLeft?: string | null;
  enzianTubeRight?: string | null;
  enzianCompartmentA?: string | null;
  enzianCompartmentB?: string | null;
  enzianCompartmentC?: string | null;
  enzianExtragenitalF?: string | null;
  enzianAdenomyosisFa: boolean;
  enzianCompositeCode: string;

  medicalManagementRegimen?: string | null;
  surgicalProcedurePerformed?: string | null;
  fertilitySparing: boolean;
  postOpHormonalSuppression?: string | null;
  clinicalNotes?: string | null;

  leadSurgeon?: string | null;
  reviewedBy: number;
  reviewedByName?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export const getEndometriosisEpisodes = (patientId: number): Promise<EndometriosisEpisode[]> =>
  api<EndometriosisEpisode[]>('GET', `/api/patients/${patientId}/endometriosis`);

export const getEndometriosisEpisode = (id: number): Promise<EndometriosisEpisode> =>
  api<EndometriosisEpisode>('GET', `/api/endometriosis/${id}`);

export const createEndometriosisEpisode = (payload: Partial<EndometriosisEpisode>): Promise<EndometriosisEpisode> =>
  api<EndometriosisEpisode>('POST', '/api/endometriosis', payload);

export const updateEndometriosisEpisode = (id: number, payload: Partial<EndometriosisEpisode>): Promise<EndometriosisEpisode> =>
  api<EndometriosisEpisode>('PUT', `/api/endometriosis/${id}`, payload);

export const deleteEndometriosisEpisode = (id: number): Promise<{ ok: boolean; deletedId: number }> =>
  api<{ ok: boolean; deletedId: number }>('DELETE', `/api/endometriosis/${id}`);

export const auditPrintEndometriosis = (id: number): Promise<{ ok: boolean }> =>
  api<{ ok: boolean }>('POST', `/api/endometriosis/${id}/audit-print`);

export const calculateEndometriosis = (payload: any): Promise<any> =>
  api<any>('POST', '/api/endometriosis/calculate', payload);

// ---------- Series 8B: Urogynecology & POP-Q Registry ----------

export interface UrogynecologyEpisode {
  id: number;
  patientId: number;
  admissionId?: number | null;
  assessmentDate: string;
  parity?: string | null;
  menopausalStatus: 'premenopausal' | 'perimenopausal' | 'postmenopausal';

  popqAaCm: number;
  popqBaCm: number;
  popqCCm: number;
  popqGhCm: number;
  popqPbCm: number;
  popqTvlCm: number;
  popqApCm: number;
  popqBpCm: number;
  popqDCm?: number | null;

  popqStage: 'stage_0' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4';
  leadingCompartment: 'anterior_cystocele' | 'apical_uterine_vault' | 'posterior_rectocele' | 'multicompartment' | 'none';
  leadingEdgeDistanceCm: number;

  urinaryIncontinenceType: 'none' | 'stress_sui' | 'urge_uui' | 'mixed_mui' | 'overflow';
  padCountPerDay: number;
  bladderDiaryDayFrequency?: number | null;
  bladderDiaryNocturia?: number | null;
  leakEpisodes24h?: number | null;
  botherScoreIciqSf?: number | null;

  pessaryManagement: 'none' | 'fitted_ring' | 'fitted_gellhorn' | 'fitted_cube' | 'pessary_declined' | 'pessary_failed';
  pessarySizeMm?: number | null;
  pessaryChangeIntervalWeeks?: number | null;
  pelvicFloorPhysiotherapy: boolean;
  surgicalProcedurePlanned?: string | null;
  clinicalNotes?: string | null;

  performedBy?: string | null;
  reviewedBy: number;
  reviewedByName?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export const getUrogynEpisodes = (patientId: number): Promise<UrogynecologyEpisode[]> =>
  api<UrogynecologyEpisode[]>('GET', `/api/patients/${patientId}/urogynecology`);

export const getUrogynEpisode = (id: number): Promise<UrogynecologyEpisode> =>
  api<UrogynecologyEpisode>('GET', `/api/urogynecology/${id}`);

export const createUrogynEpisode = (payload: Partial<UrogynecologyEpisode>): Promise<UrogynecologyEpisode> =>
  api<UrogynecologyEpisode>('POST', '/api/urogynecology', payload);

export const updateUrogynEpisode = (id: number, payload: Partial<UrogynecologyEpisode>): Promise<UrogynecologyEpisode> =>
  api<UrogynecologyEpisode>('PUT', `/api/urogynecology/${id}`, payload);

export const deleteUrogynEpisode = (id: number): Promise<{ ok: boolean; deletedId: number }> =>
  api<{ ok: boolean; deletedId: number }>('DELETE', `/api/urogynecology/${id}`);

export const auditPrintUrogyn = (id: number): Promise<{ ok: boolean }> =>
  api<{ ok: boolean }>('POST', `/api/urogynecology/${id}/audit-print`);

export const calculatePopq = (payload: any): Promise<any> =>
  api<any>('POST', '/api/urogynecology/calculate-popq', payload);

// ---------- Series 8C: Gynecological Oncology (IOTA & RMI) ----------

export interface GynOncologyEpisode {
  id: number;
  patientId: number;
  admissionId?: number | null;
  assessmentDate: string;
  clinicalIndication: 'adnexal_mass' | 'postmenopausal_bleeding' | 'cervical_neoplasia_suspected' | 'endometrial_thickening' | 'abnormal_uterine_bleeding';
  menopausalStatus: 'premenopausal' | 'postmenopausal';

  ca125LevelUml?: number | null;
  he4PmolL?: number | null;
  romaScorePercent?: number | null;

  lesionMaxDiameterMm?: number | null;
  proportionSolidTissuePercent?: number | null;
  papillaryProjectionsCount: number;
  acousticShadowsPresent: boolean;
  ascitesPresent: boolean;
  bilateralLesions: boolean;
  multilocularCysts: boolean;
  colorDopplerScore?: number | null;

  iotaSimpleRulesCategory: 'benign' | 'malignant' | 'inconclusive';
  iotaPredictedMalignancyRiskPct?: number | null;
  rmiScore: number;
  rmiRiskTier: 'low_risk_le_25' | 'intermediate_risk_26_200' | 'high_risk_gt_200';

  endometrialThicknessMm?: number | null;
  endometrialBiopsyDone: boolean;
  endometrialHistology?: string | null;

  cervicalLesionVisible: boolean;
  figoClinicalStage?: string | null;

  multidisciplinaryTumorBoardStatus: 'not_required_benign' | 'pending_board_review' | 'discussed_approved';
  managementPlan?: string | null;
  surgicalStagingDetails?: string | null;
  clinicalNotes?: string | null;

  gynOncologistName?: string | null;
  reviewedBy: number;
  reviewedByName?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export const getGynOncologyEpisodes = (patientId: number): Promise<GynOncologyEpisode[]> =>
  api<GynOncologyEpisode[]>('GET', `/api/patients/${patientId}/gyn-oncology`);

export const getGynOncologyEpisode = (id: number): Promise<GynOncologyEpisode> =>
  api<GynOncologyEpisode>('GET', `/api/gyn-oncology/${id}`);

export const createGynOncologyEpisode = (payload: Partial<GynOncologyEpisode>): Promise<GynOncologyEpisode> =>
  api<GynOncologyEpisode>('POST', '/api/gyn-oncology', payload);

export const updateGynOncologyEpisode = (id: number, payload: Partial<GynOncologyEpisode>): Promise<GynOncologyEpisode> =>
  api<GynOncologyEpisode>('PUT', `/api/gyn-oncology/${id}`, payload);

export const deleteGynOncologyEpisode = (id: number): Promise<{ ok: boolean; deletedId: number }> =>
  api<{ ok: boolean; deletedId: number }>('DELETE', `/api/gyn-oncology/${id}`);

export const auditPrintGynOncology = (id: number): Promise<{ ok: boolean }> =>
  api<{ ok: boolean }>('POST', `/api/gyn-oncology/${id}/audit-print`);

export const calculateGynOncologyRmi = (payload: any): Promise<any> =>
  api<any>('POST', '/api/gyn-oncology/calculate-rmi', payload);

// ---------- 9A: Special Newborn Care Unit (SNCU / Level-2 NICU) ----------

export interface SncuAdmission {
  id: number;
  patientId: number;
  admissionId?: number | null;
  admissionDatetime: string;
  birthWeightG: number;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  admissionIndication:
    | 'prematurity_lbw'
    | 'respiratory_distress'
    | 'neonatal_sepsis'
    | 'hypoglycemia'
    | 'hyperbilirubinemia_severe'
    | 'perinatal_asphyxia'
    | 'feeding_difficulty'
    | 'congenital_anomaly'
    | 'other';

  respiratorySupport:
    | 'room_air'
    | 'low_flow_nasal_prongs'
    | 'bubble_cpap'
    | 'high_flow_nasal_cannula'
    | 'mechanical_ventilation';
  fio2Percent?: number | null;
  peepCmH2o?: number | null;
  flowRateLMin?: number | null;
  silvermanAndersonScore?: number | null;
  downesScore?: number | null;

  phototherapyStatus: 'none' | 'single_surface_led' | 'double_surface_led' | 'biliblanket';
  kmcDurationHoursToday?: number | null;
  temperatureCelsius?: number | null;

  currentWeightG?: number | null;
  totalFluidGoalMlKgDay?: number | null;
  feedingMode: 'npo_iv_fluids' | 'og_tube_ebm' | 'paladai_ebm' | 'direct_breastfeeding' | 'formula';
  feedingVolumeMl?: number | null;
  feedingFrequencyHours: number;
  ivFluidTypeRate?: string | null;
  dailyWeightGainGKgDay?: number | null;

  heartRateBpm?: number | null;
  respiratoryRateBpm?: number | null;
  spo2Percent?: number | null;
  capillaryBloodGlucoseMgDl?: number | null;
  antibioticRegimen?: string | null;
  clinicalNotes?: string | null;

  status:
    | 'admitted'
    | 'transferred_tertiary_nicu'
    | 'discharged_to_mother'
    | 'discharged_home'
    | 'deceased';
  dischargeDatetime?: string | null;
  dischargeWeightG?: number | null;

  attendingPediatrician?: string | null;
  reviewedBy: number;
  reviewedByName?: string | null;
  createdBy: number;
  createdByName?: string | null;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export const getSncuAdmissions = (patientId: number): Promise<SncuAdmission[]> =>
  api<SncuAdmission[]>('GET', `/api/patients/${patientId}/sncu`);

export const getSncuAdmission = (id: number): Promise<SncuAdmission> =>
  api<SncuAdmission>('GET', `/api/sncu/${id}`);

export const createSncuAdmission = (payload: Partial<SncuAdmission>): Promise<SncuAdmission> =>
  api<SncuAdmission>('POST', '/api/sncu', payload);

export const updateSncuAdmission = (id: number, payload: Partial<SncuAdmission>): Promise<SncuAdmission> =>
  api<SncuAdmission>('PUT', `/api/sncu/${id}`, payload);

export const deleteSncuAdmission = (id: number): Promise<{ ok: boolean; deletedId: number }> =>
  api<{ ok: boolean; deletedId: number }>('DELETE', `/api/sncu/${id}`);

export const auditPrintSncu = (id: number): Promise<{ ok: boolean }> =>
  api<{ ok: boolean }>('POST', `/api/sncu/${id}/audit-print`);

export const calculateSncuFluidSilverman = (payload: any): Promise<any> =>
  api<any>('POST', '/api/sncu/calculate-fluid-silverman', payload);

// ---------- 9B: Immunization Recall, Smart Communication & Emergency QR Card ----------

export interface ImmunizationRecallItem {
  patientId: number;
  patientNumber: string;
  fullName: string;
  dateOfBirth: string;
  ageWeeks: number;
  ageDays: number;
  phone: string;
  parentName?: string | null;
  completedCount: number;
  dueNow: Array<{
    vaccine: { code: string; name: string; minAgeWeeks: number; maxAgeWeeks: number; labelAge: string; isNationalEssential: boolean };
    status: 'due_now';
    daysOverdueOrDue: number;
  }>;
  overdue: Array<{
    vaccine: { code: string; name: string; minAgeWeeks: number; maxAgeWeeks: number; labelAge: string; isNationalEssential: boolean };
    status: 'overdue';
    daysOverdueOrDue: number;
  }>;
  upcomingNext30d: Array<{
    vaccine: { code: string; name: string; minAgeWeeks: number; maxAgeWeeks: number; labelAge: string; isNationalEssential: boolean };
    status: 'upcoming';
    daysOverdueOrDue: number;
  }>;
  englishReminderText: string;
  hindiReminderText: string;
  englishWhatsAppLink?: string | null;
  hindiWhatsAppLink?: string | null;
}

export interface CommunicationDispatchLog {
  id: number;
  patientId: number;
  communicationType: 'whatsapp_click_to_chat' | 'sms_gateway_draft' | 'emergency_qr_access';
  triggerEvent: string;
  recipientPhone: string;
  language: 'english' | 'hindi';
  messageBody: string;
  deepLinkUrl?: string | null;
  sentBy: number;
  sentByName?: string | null;
  createdAt: string;
}

export interface EmergencyPassportBundle {
  passportData: {
    patientId: number;
    fullName: string;
    ageYears?: number | null;
    bloodGroup?: string | null;
    allergies?: string | null;
    obstetricSummary?: string | null;
    highRiskConditions?: string[];
    edd?: string | null;
    emergencyContact?: string | null;
    hospitalName: string;
    hospitalHelpline: string;
  };
  qrPayload: string;
}

export const getImmunizationRecallList = (): Promise<ImmunizationRecallItem[]> =>
  api<ImmunizationRecallItem[]>('GET', '/api/immunization/recall-list');

export const getPatientImmunizationStatus = (patientId: number): Promise<any> =>
  api<any>('GET', `/api/patients/${patientId}/immunization-status`);

export const dispatchWhatsappReminder = (payload: {
  patientId: number;
  recipientPhone: string;
  triggerEvent:
    | 'immunization_due'
    | 'antenatal_appointment_reminder'
    | 'ultrasound_scheduled'
    | 'abnormal_lab_recall'
    | 'discharge_instructions'
    | 'general_followup';
  language: 'english' | 'hindi';
  messageBody: string;
  deepLinkUrl?: string | null;
}): Promise<{ ok: boolean; dispatchId: number; deepLinkUrl: string }> =>
  api<{ ok: boolean; dispatchId: number; deepLinkUrl: string }>('POST', '/api/communication/dispatch-whatsapp', payload);

export const getCommunicationDispatchLogs = (patientId: number): Promise<CommunicationDispatchLog[]> =>
  api<CommunicationDispatchLog[]>('GET', `/api/patients/${patientId}/communication-logs`);

export const getEmergencyPassportData = (patientId: number): Promise<EmergencyPassportBundle> =>
  api<EmergencyPassportBundle>('GET', `/api/patients/${patientId}/emergency-passport`);

export const auditEmergencyQrCardPrint = (patientId: number): Promise<{ ok: boolean }> =>
  api<{ ok: boolean }>('POST', '/api/communication/audit-qr-card', { patientId });


// ==========================================
// SERIES 10: WARD BOARD, TELECONSULTATION & ABDM
// ==========================================

export interface WardBedInfo {
  bedId: number;
  bedNumber: string;
  ward: string;
  bedActive: number;
  admissionId?: number | null;
  patientId?: number | null;
  admittedAt?: string | null;
  primaryDiagnosis?: string | null;
  attendingDoctorId?: number | null;
  attendingDoctorName?: string | null;
  uhid?: string | null;
  patientName?: string | null;
  ageYears?: number | null;
  patientPhone?: string | null;
  gravida?: number | null;
  para?: number | null;
  lastMenstrualPeriod?: string | null;
}

export interface OccupiedWardAdmission extends WardBedInfo {
  latestMeows?: any | null;
  sncuRecord?: any | null;
  latestHandover?: WardHandoverNote | null;
  activeAlerts?: any[];
  deteriorationStatus: 'NORMAL_GREEN' | 'WARNING_YELLOW' | 'CRITICAL_RED';
  triggerReasons: string[];
}

export interface LiveWardBoardResponse {
  stats: {
    totalBeds: number;
    occupiedCount: number;
    vacantCount: number;
    criticalRedCount: number;
    warningYellowCount: number;
  };
  allBeds: WardBedInfo[];
  occupiedAdmissions: OccupiedWardAdmission[];
}

export interface WardHandoverNote {
  id: number;
  admission_id: number;
  shift_type: 'morning' | 'evening' | 'night';
  shift_date: string;
  nurse_id: number;
  nurse_name: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  pending_tasks?: string | string[] | null;
  iv_fluids_status?: string | null;
  dietary_order?: string | null;
  created_at: string;
}

export const getLiveWardBoard = (): Promise<LiveWardBoardResponse> =>
  api<LiveWardBoardResponse>('GET', '/api/ipd/ward-board/live');

export const createWardHandover = (payload: {
  admissionId: number;
  shiftType: 'morning' | 'evening' | 'night';
  shiftDate: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  pendingTasks?: string | string[];
  ivFluidsStatus?: string | null;
  dietaryOrder?: string | null;
}): Promise<WardHandoverNote> =>
  api<WardHandoverNote>('POST', '/api/ipd/ward-board/handover', payload);

export const getWardHandovers = (admissionId: number): Promise<{ handovers: WardHandoverNote[] }> =>
  api<{ handovers: WardHandoverNote[] }>('GET', `/api/ipd/ward-board/handover/${admissionId}`);

export const deleteWardHandover = (id: number): Promise<{ success: boolean; message: string }> =>
  api<{ success: boolean; message: string }>('DELETE', `/api/ipd/ward-board/handover/${id}`);

export const acknowledgeCriticalAlert = (id: number, resolutionNotes?: string): Promise<{ success: boolean }> =>
  api<{ success: boolean }>('POST', `/api/ipd/ward-board/alert-acknowledge/${id}`, { resolutionNotes });

export const auditWardHandoverPrint = (admissionId?: number, ward?: string): Promise<{ success: boolean }> =>
  api<{ success: boolean }>('POST', '/api/ipd/ward-board/audit-print', { admissionId, ward });

// Teleconsultations API
export interface TeleconsultationRecord {
  id: number;
  patient_id: number;
  doctor_id: number;
  scheduled_at: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  consult_type: 'FIRST_CONSULT' | 'FOLLOW_UP' | 'REPORT_REVIEW' | 'POST_OP_CHECK' | 'EMERGENCY_TRIAGE';
  video_platform: 'WHATSAPP_VIDEO' | 'JITSI' | 'PHONE_CALL' | 'OTHER';
  meeting_link?: string | null;
  meeting_room_id?: string | null;
  chief_complaint: string;
  clinical_notes?: string | null;
  provisional_diagnosis?: string | null;
  advice_instructions?: string | null;
  prescription_medicines?: string | any[] | null;
  investigations_advised?: string | any[] | null;
  telemedicine_consent_obtained: number;
  emergency_disclaimer_acknowledged: number;
  digital_signature_hash?: string | null;
  signed_by_doctor_name?: string | null;
  doctor_reg_number?: string | null;
  doctor_qualifications?: string | null;
  signed_at?: string | null;
  whatsapp_invite_sent_at?: string | null;
  created_at: string;
  patient_name?: string;
  uhid?: string;
  patient_phone?: string;
  patient_age?: number;
  doctor_name?: string;
}

export const getTeleconsultations = (params?: {
  patientId?: number;
  doctorId?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<{ teleconsultations: TeleconsultationRecord[] }> => {
  const query = new URLSearchParams();
  if (params?.patientId) query.set('patientId', String(params.patientId));
  if (params?.doctorId) query.set('doctorId', String(params.doctorId));
  if (params?.status) query.set('status', params.status);
  if (params?.fromDate) query.set('fromDate', params.fromDate);
  if (params?.toDate) query.set('toDate', params.toDate);
  const qStr = query.toString();
  return api<{ teleconsultations: TeleconsultationRecord[] }>('GET', `/api/teleconsultations${qStr ? `?${qStr}` : ''}`);
};

export const createTeleconsultation = (payload: {
  patientId: number;
  doctorId: number;
  scheduledAt: string;
  consultType?: string;
  videoPlatform?: string;
  chiefComplaint: string;
  clinicalNotes?: string | null;
  provisionalDiagnosis?: string | null;
  adviceInstructions?: string | null;
  prescriptionMedicines?: any;
  investigationsAdvised?: any;
  telemedicineConsentObtained?: boolean;
  emergencyDisclaimerAcknowledged?: boolean;
}): Promise<TeleconsultationRecord> =>
  api<TeleconsultationRecord>('POST', '/api/teleconsultations', payload);

export const getTeleconsultation = (id: number): Promise<TeleconsultationRecord> =>
  api<TeleconsultationRecord>('GET', `/api/teleconsultations/${id}`);

export const updateTeleconsultation = (id: number, payload: Partial<TeleconsultationRecord>): Promise<TeleconsultationRecord> =>
  api<TeleconsultationRecord>('PUT', `/api/teleconsultations/${id}`, payload);

export const signTeleconsultation = (id: number): Promise<TeleconsultationRecord> =>
  api<TeleconsultationRecord>('POST', `/api/teleconsultations/${id}/sign`, {});

export const sendTeleconsultationWhatsAppInvite = (id: number): Promise<{
  success: boolean;
  whatsappUrl: string;
  messageText: string;
  cleanPhone: string;
}> =>
  api<{
    success: boolean;
    whatsappUrl: string;
    messageText: string;
    cleanPhone: string;
  }>('POST', `/api/teleconsultations/${id}/whatsapp-invite`, {});

export const deleteTeleconsultation = (id: number): Promise<{ success: boolean; message: string }> =>
  api<{ success: boolean; message: string }>('DELETE', `/api/teleconsultations/${id}`);

export const auditTeleconsultationPrint = (id: number): Promise<{ success: boolean }> =>
  api<{ success: boolean }>('POST', `/api/teleconsultations/${id}/audit-print`, {});

// ABDM API
export const getAbdmPatientData = (patientId: number): Promise<{
  profile: any | null;
  consents: any[];
  fhirBundles: any[];
}> =>
  api<{
    profile: any | null;
    consents: any[];
    fhirBundles: any[];
  }>('GET', `/api/abdm/patient/${patientId}`);

export const linkAbhaProfile = (
  patientId: number,
  payload: {
    abhaNumber: string;
    abhaAddress: string;
    authMethod?: 'AADHAAR_OTP' | 'MOBILE_OTP' | 'DEMOGRAPHIC';
    kycFullName?: string;
    kycGender?: string;
    kycDob?: string;
    kycMobile?: string;
    kycAddress?: string;
  }
): Promise<any> =>
  api<any>('POST', `/api/abdm/patient/${patientId}/link`, payload);

export const mockAadhaarVerifyAbha = (patientId: number): Promise<any> =>
  api<any>('POST', `/api/abdm/patient/${patientId}/mock-aadhaar-verify`, {});

export const unlinkAbhaProfile = (patientId: number): Promise<{ success: boolean }> =>
  api<{ success: boolean }>('DELETE', `/api/abdm/patient/${patientId}/unlink`);

export const generateFhirBundle = (
  patientId: number,
  payload: {
    bundleType: 'OPConsultation' | 'DischargeSummary' | 'ImmunizationRecord' | 'AntenatalRecord';
    visitId?: number;
    admissionId?: number;
  }
): Promise<{
  bundleId: string;
  bundleJson: string;
  bundleHash: string;
  fhirObject: any;
}> =>
  api<{
    bundleId: string;
    bundleJson: string;
    bundleHash: string;
    fhirObject: any;
  }>('POST', `/api/abdm/patient/${patientId}/generate-fhir`, payload);

export const getFhirBundle = (id: string): Promise<any> =>
  api<any>('GET', `/api/abdm/fhir-bundle/${id}`);

export const createAbdmConsent = (payload: {
  patientId: number;
  purposeCode: string;
  hiTypes: string;
  requesterName: string;
  requesterHipId: string;
  dateRangeFrom: string;
  dateRangeTo: string;
  expiryAt: string;
}): Promise<any> =>
  api<any>('POST', '/api/abdm/consent', payload);

export const revokeAbdmConsent = (id: string): Promise<{ success: boolean }> =>
  api<{ success: boolean }>('POST', `/api/abdm/consent/${id}/revoke`, {});

// Series 11A: Operating Theater (OT) Scheduler, Pre-Anesthesia Clearance (PAC), and WHO Surgical Safety Checklist
export type OtRoom = 'OT_1_MAIN' | 'OT_2_MATERNITY' | 'OT_3_MINOR' | 'LABOR_OT';
export type OtPriority = 'ELECTIVE' | 'URGENT' | 'EMERGENCY_CAT_1';
export type OtStatus = 'SCHEDULED' | 'PATIENT_IN_OT' | 'SURGERY_IN_PROGRESS' | 'PACU_RECOVERY' | 'COMPLETED' | 'CANCELLED';
export type AsaGrade = 'ASA_I' | 'ASA_II' | 'ASA_III' | 'ASA_IV' | 'ASA_V' | 'ASA_I_E' | 'ASA_II_E' | 'ASA_III_E' | 'ASA_IV_E' | 'ASA_V_E';
export type MallampatiClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IV';
export type PacClearanceStatus = 'FIT_FOR_SURGERY' | 'FIT_WITH_HIGH_RISK' | 'PROCEED_EMERGENCY_LIFE_SAVING' | 'DEFERRED_PENDING_OPTIMIZATION';
export type PlannedAnesthesiaTechnique = 'SPINAL' | 'EPIDURAL' | 'CSE' | 'GENERAL_ENDOTRACHEAL' | 'TIVA' | 'LOCAL_MAC';

export interface OtScheduleRecord {
  id: number;
  patient_id: number;
  admission_id?: number | null;
  ot_room: OtRoom;
  scheduled_date: string;
  scheduled_start_time: string;
  estimated_duration_minutes: number;
  procedure_name: string;
  procedure_category: string;
  priority: OtPriority;
  status: OtStatus;
  primary_surgeon_id: number;
  primary_surgeon_name: string;
  assistant_surgeon_name?: string | null;
  anesthesiologist_id?: number | null;
  anesthesiologist_name?: string | null;
  scrub_nurse_name?: string | null;
  pediatrician_standby_name?: string | null;
  blood_units_reserved: number;
  special_equipment_needed?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  uhid?: string;
  patient_name?: string;
  patient_age?: number | null;
  patient_phone?: string | null;
  patient_address?: string | null;
  gravida?: number | null;
  para?: number | null;
  lastMenstrualPeriod?: string | null;
  primary_surgeon_full_name?: string;
  anesthesiologist_full_name?: string;
  asa_grade?: AsaGrade | null;
  pac_clearance_status?: PacClearanceStatus | null;
  signin_completed?: number;
  timeout_completed?: number;
  signout_completed?: number;
}

export interface PacClearanceRecord {
  id: number;
  patient_id: number;
  ot_schedule_id?: number | null;
  evaluation_date: string;
  anesthesiologist_id: number;
  anesthesiologist_name: string;
  asa_grade: AsaGrade;
  mallampati_class: MallampatiClass;
  mouth_opening_cm: number;
  thyromental_distance_cm: number;
  dentition_status: 'intact' | 'loose_teeth' | 'edentulous' | 'dentures_present';
  neck_mobility: 'normal_full' | 'restricted_extension' | 'fixed_flexion';
  npo_solid_hours: number;
  npo_clear_liquid_hours: number;
  cardiovascular_assessment?: string | null;
  respiratory_assessment?: string | null;
  airway_notes?: string | null;
  planned_anesthesia_technique: PlannedAnesthesiaTechnique;
  pac_clearance_status: PacClearanceStatus;
  high_risk_warnings?: string | null;
  preop_orders_instructions?: string | null;
  blood_products_crossmatched?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhoChecklistRecord {
  id: number;
  ot_schedule_id: number;
  patient_id: number;
  signin_completed: number;
  signin_patient_confirmed: number;
  signin_site_marked: number;
  signin_anesthesia_safety_check: number;
  signin_pulse_oximeter_functioning: number;
  signin_known_allergy: number;
  signin_difficult_airway_risk: number;
  signin_blood_loss_risk: number;
  signin_nurse_anesthetist_name?: string | null;
  signin_timestamp?: string | null;
  timeout_completed: number;
  timeout_team_introduced: number;
  timeout_verbal_confirmation: number;
  timeout_surgeon_review?: string | null;
  timeout_anesthetist_review?: string | null;
  timeout_nursing_sterility_confirmed: number;
  timeout_antibiotic_prophylaxis_given: number;
  timeout_antibiotic_name_dose?: string | null;
  timeout_imaging_displayed: number;
  timeout_completed_by_name?: string | null;
  timeout_timestamp?: string | null;
  signout_completed: number;
  signout_procedure_recorded_name?: string | null;
  signout_counts_correct: number;
  signout_specimen_labeled: number;
  signout_equipment_problems?: string | null;
  signout_recovery_concerns?: string | null;
  signout_completed_by_name?: string | null;
  signout_timestamp?: string | null;
  updated_at: string;
}

export const getOtSchedules = (params?: {
  date?: string;
  otRoom?: string;
  status?: string;
  patientId?: number;
}): Promise<{ schedules: OtScheduleRecord[] }> => {
  const q = new URLSearchParams();
  if (params?.date) q.append('date', params.date);
  if (params?.otRoom) q.append('otRoom', params.otRoom);
  if (params?.status) q.append('status', params.status);
  if (params?.patientId) q.append('patientId', String(params.patientId));
  const queryStr = q.toString() ? `?${q.toString()}` : '';
  return api<{ schedules: OtScheduleRecord[] }>('GET', `/api/ot-schedules${queryStr}`);
};

export const getOtStaff = (): Promise<{ staff: { id: number; fullName: string; username: string; role: Role }[] }> =>
  api<{ staff: { id: number; fullName: string; username: string; role: Role }[] }>('GET', '/api/ot-schedules/staff');

export const createOtSchedule = (payload: {
  patientId: number;
  admissionId?: number | null;
  otRoom?: OtRoom;
  scheduledDate: string;
  scheduledStartTime: string;
  estimatedDurationMinutes?: number;
  procedureName: string;
  procedureCategory?: string;
  priority?: OtPriority;
  primarySurgeonId: number;
  assistantSurgeonName?: string | null;
  anesthesiologistId?: number | null;
  scrubNurseName?: string | null;
  pediatricianStandbyName?: string | null;
  bloodUnitsReserved?: number;
  specialEquipmentNeeded?: string | null;
}): Promise<OtScheduleRecord> =>
  api<OtScheduleRecord>('POST', '/api/ot-schedules', payload);

export const getOtSchedule = (id: number): Promise<{
  schedule: OtScheduleRecord;
  pac: PacClearanceRecord | null;
  whoChecklist: WhoChecklistRecord | null;
}> =>
  api<{
    schedule: OtScheduleRecord;
    pac: PacClearanceRecord | null;
    whoChecklist: WhoChecklistRecord | null;
  }>('GET', `/api/ot-schedules/${id}`);

export const updateOtSchedule = (id: number, payload: Partial<{
  otRoom: OtRoom;
  scheduledDate: string;
  scheduledStartTime: string;
  estimatedDurationMinutes: number;
  procedureName: string;
  procedureCategory: string;
  priority: OtPriority;
  status: OtStatus;
  primarySurgeonId: number;
  assistantSurgeonName: string | null;
  anesthesiologistId: number | null;
  scrubNurseName: string | null;
  pediatricianStandbyName: string | null;
  bloodUnitsReserved: number;
  specialEquipmentNeeded: string | null;
  cancellationReason: string | null;
}>): Promise<OtScheduleRecord> =>
  api<OtScheduleRecord>('PUT', `/api/ot-schedules/${id}`, payload);

export const deleteOtSchedule = (id: number): Promise<{ success: boolean; message: string }> =>
  api<{ success: boolean; message: string }>('DELETE', `/api/ot-schedules/${id}`);

export const updateWhoChecklist = (id: number, payload: Partial<{
  signinCompleted: boolean;
  signinPatientConfirmed: boolean;
  signinSiteMarked: boolean;
  signinAnesthesiaSafetyCheck: boolean;
  signinPulseOximeterFunctioning: boolean;
  signinKnownAllergy: boolean;
  signinDifficultAirwayRisk: boolean;
  signinBloodLossRisk: boolean;
  signinNurseAnesthetistName: string | null;
  timeoutCompleted: boolean;
  timeoutTeamIntroduced: boolean;
  timeoutVerbalConfirmation: boolean;
  timeoutSurgeonReview: string | null;
  timeoutAnesthetistReview: string | null;
  timeoutNursingSterilityConfirmed: boolean;
  timeoutAntibioticProphylaxisGiven: boolean;
  timeoutAntibioticNameDose: string | null;
  timeoutImagingDisplayed: boolean;
  timeoutCompletedByName: string | null;
  signoutCompleted: boolean;
  signoutProcedureRecordedName: string | null;
  signoutCountsCorrect: boolean;
  signoutSpecimenLabeled: boolean;
  signoutEquipmentProblems: string | null;
  signoutRecoveryConcerns: string | null;
  signoutCompletedByName: string | null;
}>): Promise<WhoChecklistRecord> =>
  api<WhoChecklistRecord>('POST', `/api/ot-schedules/${id}/who-checklist`, payload);

export const getPatientPac = (patientId: number): Promise<{ clearances: PacClearanceRecord[] }> =>
  api<{ clearances: PacClearanceRecord[] }>('GET', `/api/patients/${patientId}/pac`);

export const createPatientPac = (patientId: number, payload: {
  otScheduleId?: number | null;
  evaluationDate: string;
  asaGrade: AsaGrade;
  mallampatiClass?: MallampatiClass;
  mouthOpeningCm?: number;
  thyromentalDistanceCm?: number;
  dentitionStatus?: 'intact' | 'loose_teeth' | 'edentulous' | 'dentures_present';
  neckMobility?: 'normal_full' | 'restricted_extension' | 'fixed_flexion';
  npoSolidHours?: number;
  npoClearLiquidHours?: number;
  cardiovascularAssessment?: string | null;
  respiratoryAssessment?: string | null;
  airwayNotes?: string | null;
  plannedAnesthesiaTechnique?: PlannedAnesthesiaTechnique;
  pacClearanceStatus?: PacClearanceStatus;
  highRiskWarnings?: string | null;
  preopOrdersInstructions?: string | null;
  bloodProductsCrossmatched?: string | null;
}): Promise<PacClearanceRecord> =>
  api<PacClearanceRecord>('POST', `/api/patients/${patientId}/pac`, payload);

export const deletePatientPac = (id: number): Promise<{ success: boolean; message: string }> =>
  api<{ success: boolean; message: string }>('DELETE', `/api/pac/${id}`);

export const auditOtPrint = (id: number): Promise<{ success: boolean }> =>
  api<{ success: boolean }>('POST', `/api/ot-schedules/${id}/audit-print`, {});

// Series 11B: Blood Bank Cross-Match Requisitions & Massive Transfusion Protocol (MTP)
export type BloodGroupAbo =
  | 'A_POS'
  | 'A_NEG'
  | 'B_POS'
  | 'B_NEG'
  | 'AB_POS'
  | 'AB_NEG'
  | 'O_POS'
  | 'O_NEG'
  | 'UNKNOWN';

export type BloodUrgency =
  | 'ROUTINE'
  | 'URGENT_WITHIN_2HR'
  | 'STAT_EMERGENCY_UNMATCHED';

export type BloodComponentType =
  | 'PRBC'
  | 'FFP'
  | 'PLATELET_RDP'
  | 'PLATELET_SDP'
  | 'CRYOPRECIPITATE'
  | 'WHOLE_BLOOD';

export type BloodRequisitionStatus =
  | 'REQUESTED'
  | 'SAMPLE_RECEIVED'
  | 'CROSSMATCHED'
  | 'ISSUED'
  | 'PARTIALLY_TRANSFUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type MtpTriggerReason =
  | 'PPH_ATONY'
  | 'PLACENTA_ACCRETA_SPECTRUM'
  | 'UTERINE_RUPTURE'
  | 'SURGICAL_TRAUMA'
  | 'ABRUPTIO_PLACENTAE_DIC'
  | 'ECTOPIC_HEMORRHAGE'
  | 'OTHER';

export type MtpStatus = 'ACTIVE' | 'DEACTIVATED' | 'CANCELLED';

export type TransfusionStatus = 'TRANSFUSING' | 'COMPLETED' | 'STOPPED_REACTION' | 'DISCARDED';

export interface BloodRequisitionRecord {
  id: number;
  patient_id: number;
  admission_id?: number | null;
  ot_schedule_id?: number | null;
  requisition_number: string;
  blood_group_abo: BloodGroupAbo;
  urgency: BloodUrgency;
  clinical_indication: string;
  prbc_units: number;
  ffp_units: number;
  platelet_units: number;
  cryoprecipitate_units: number;
  whole_blood_units: number;
  special_requirements?: string | null;
  status: BloodRequisitionStatus;
  requesting_doctor_id: number;
  requesting_doctor_name: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  uhid?: string;
  patient_name?: string;
  patient_age?: number | null;
  patient_phone?: string | null;
  doctor_full_name?: string;
}

export interface MtpActivationRecord {
  id: number;
  patient_id: number;
  admission_id?: number | null;
  ot_schedule_id?: number | null;
  mtp_code: string;
  activation_time: string;
  activated_by_id: number;
  activated_by_name: string;
  trigger_reason: MtpTriggerReason;
  baseline_shock_index?: number | null;
  baseline_estimated_blood_loss_ml: number;
  current_pack_round: number;
  total_prbc_transfused: number;
  total_ffp_transfused: number;
  total_platelets_transfused: number;
  total_cryo_transfused: number;
  txa_given: number;
  calcium_gluconate_given: number;
  deactivation_time?: string | null;
  deactivated_by_name?: string | null;
  outcome_summary?: string | null;
  status: MtpStatus;
  created_at: string;
  updated_at: string;
  uhid?: string;
  patient_name?: string;
  patient_age?: number | null;
  patient_phone?: string | null;
  activator_name?: string;
}

export interface MtpRoundRecord {
  id: number;
  mtp_id: number;
  round_number: number;
  round_start_time: string;
  prbc_issued: number;
  prbc_transfused: number;
  ffp_issued: number;
  ffp_transfused: number;
  platelets_issued: number;
  platelets_transfused: number;
  cryo_issued: number;
  cryo_transfused: number;
  temp_celsius?: number | null;
  heart_rate?: number | null;
  blood_pressure_sys?: number | null;
  blood_pressure_dia?: number | null;
  spo2?: number | null;
  hb_g_dl?: number | null;
  platelets_k_ul?: number | null;
  inr?: number | null;
  fibrinogen_mg_dl?: number | null;
  ionized_calcium_mmol_l?: number | null;
  ph_abg?: number | null;
  lactate_mmol_l?: number | null;
  clinical_notes?: string | null;
  recorded_by_name: string;
  created_at: string;
}

export interface TransfusionRecord {
  id: number;
  requisition_id?: number | null;
  patient_id: number;
  mtp_id?: number | null;
  unit_number: string;
  component_type: BloodComponentType;
  unit_blood_group: BloodGroupAbo;
  start_time: string;
  end_time?: string | null;
  two_nurse_verifier_1: string;
  two_nurse_verifier_2: string;
  pre_vitals_temp?: number | null;
  pre_vitals_hr?: number | null;
  pre_vitals_bp?: string | null;
  vitals_15m_temp?: number | null;
  vitals_15m_hr?: number | null;
  vitals_15m_bp?: string | null;
  post_vitals_temp?: number | null;
  post_vitals_hr?: number | null;
  post_vitals_bp?: string | null;
  adverse_reaction_observed: number;
  reaction_type?: string | null;
  reaction_details?: string | null;
  action_taken?: string | null;
  transfusion_status: TransfusionStatus;
  created_at: string;
  updated_at: string;
  uhid?: string;
  patient_name?: string;
}

export const getBloodRequisitions = (params?: {
  patientId?: number;
  status?: string;
  urgency?: string;
}): Promise<{ requisitions: BloodRequisitionRecord[] }> => {
  const q = new URLSearchParams();
  if (params?.patientId) q.append('patientId', String(params.patientId));
  if (params?.status) q.append('status', params.status);
  if (params?.urgency) q.append('urgency', params.urgency);
  const queryStr = q.toString() ? `?${q.toString()}` : '';
  return api<{ requisitions: BloodRequisitionRecord[] }>('GET', `/api/blood-requisitions${queryStr}`);
};

export const createBloodRequisition = (payload: {
  patientId: number;
  admissionId?: number | null;
  otScheduleId?: number | null;
  bloodGroupAbo?: BloodGroupAbo;
  urgency?: BloodUrgency;
  clinicalIndication: string;
  prbcUnits?: number;
  ffpUnits?: number;
  plateletUnits?: number;
  cryoprecipitateUnits?: number;
  wholeBloodUnits?: number;
  specialRequirements?: string | null;
  notes?: string | null;
}): Promise<BloodRequisitionRecord> =>
  api<BloodRequisitionRecord>('POST', '/api/blood-requisitions', payload);

export const getBloodRequisition = (id: number): Promise<{
  requisition: BloodRequisitionRecord;
  transfusions: TransfusionRecord[];
}> =>
  api<{
    requisition: BloodRequisitionRecord;
    transfusions: TransfusionRecord[];
  }>('GET', `/api/blood-requisitions/${id}`);

export const updateBloodRequisitionStatus = (
  id: number,
  status: BloodRequisitionStatus
): Promise<BloodRequisitionRecord> =>
  api<BloodRequisitionRecord>('PATCH', `/api/blood-requisitions/${id}/status`, { status });

export const deleteBloodRequisition = (id: number): Promise<{ success: boolean; message: string }> =>
  api<{ success: boolean; message: string }>('DELETE', `/api/blood-requisitions/${id}`);

export const activateMtp = (payload: {
  patientId: number;
  admissionId?: number | null;
  otScheduleId?: number | null;
  triggerReason: MtpTriggerReason;
  baselineShockIndex?: number | null;
  baselineEstimatedBloodLossMl?: number;
}): Promise<MtpActivationRecord> =>
  api<MtpActivationRecord>('POST', '/api/mtp/activate', payload);

export const getActiveMtps = (): Promise<{ activeMtps: MtpActivationRecord[] }> =>
  api<{ activeMtps: MtpActivationRecord[] }>('GET', '/api/mtp/active');

export const getMtpDetails = (id: number): Promise<{
  mtp: MtpActivationRecord;
  rounds: MtpRoundRecord[];
  transfusions: TransfusionRecord[];
}> =>
  api<{
    mtp: MtpActivationRecord;
    rounds: MtpRoundRecord[];
    transfusions: TransfusionRecord[];
  }>('GET', `/api/mtp/${id}`);

export const addMtpRound = (
  id: number,
  payload: {
    roundNumber: number;
    roundStartTime: string;
    prbcIssued?: number;
    prbcTransfused?: number;
    ffpIssued?: number;
    ffpTransfused?: number;
    plateletsIssued?: number;
    plateletsTransfused?: number;
    cryoIssued?: number;
    cryoTransfused?: number;
    tempCelsius?: number | null;
    heartRate?: number | null;
    bloodPressureSys?: number | null;
    bloodPressureDia?: number | null;
    spo2?: number | null;
    hbGDl?: number | null;
    plateletsKUl?: number | null;
    inr?: number | null;
    fibrinogenMgDl?: number | null;
    ionizedCalciumMmolL?: number | null;
    phAbg?: number | null;
    lactateMmolL?: number | null;
    clinicalNotes?: string | null;
  }
): Promise<MtpActivationRecord> =>
  api<MtpActivationRecord>('POST', `/api/mtp/${id}/rounds`, payload);

export const deactivateMtp = (
  id: number,
  payload: { outcomeSummary: string; deactivatedByName?: string | null }
): Promise<MtpActivationRecord> =>
  api<MtpActivationRecord>('POST', `/api/mtp/${id}/deactivate`, payload);

export const getTransfusions = (params?: {
  patientId?: number;
  status?: string;
}): Promise<{ transfusions: TransfusionRecord[] }> => {
  const q = new URLSearchParams();
  if (params?.patientId) q.append('patientId', String(params.patientId));
  if (params?.status) q.append('status', params.status);
  const queryStr = q.toString() ? `?${q.toString()}` : '';
  return api<{ transfusions: TransfusionRecord[] }>('GET', `/api/transfusions${queryStr}`);
};

export const logTransfusion = (payload: {
  requisitionId?: number | null;
  patientId: number;
  mtpId?: number | null;
  unitNumber: string;
  componentType: BloodComponentType;
  unitBloodGroup: BloodGroupAbo;
  startTime: string;
  twoNurseVerifier1: string;
  twoNurseVerifier2: string;
  preVitalsTemp?: number | null;
  preVitalsHr?: number | null;
  preVitalsBp?: string | null;
  vitals15mTemp?: number | null;
  vitals15mHr?: number | null;
  vitals15mBp?: string | null;
}): Promise<TransfusionRecord> =>
  api<TransfusionRecord>('POST', '/api/transfusions', payload);

export const reportTransfusionReaction = (
  id: number,
  payload: {
    reactionType: string;
    reactionDetails: string;
    actionTaken: string;
    endTime?: string | null;
    postVitalsTemp?: number | null;
    postVitalsHr?: number | null;
    postVitalsBp?: string | null;
  }
): Promise<TransfusionRecord> =>
  api<TransfusionRecord>('POST', `/api/transfusions/${id}/reaction`, payload);

export const getPatientBloodBankHistory = (patientId: number): Promise<{
  requisitions: BloodRequisitionRecord[];
  mtpActivations: MtpActivationRecord[];
  transfusions: TransfusionRecord[];
}> =>
  api<{
    requisitions: BloodRequisitionRecord[];
    mtpActivations: MtpActivationRecord[];
    transfusions: TransfusionRecord[];
  }>('GET', `/api/patients/${patientId}/blood-bank`);

export const auditMtpPrint = (id: number): Promise<{ success: boolean }> =>
  api<{ success: boolean }>('POST', `/api/mtp/${id}/audit-print`, {});

// ==========================================
// SERIES 11C: PEDIATRIC RENAL & PERITONEAL DIALYSIS
// ==========================================

export interface PediatricRenalAssessmentRecord {
  id: number;
  patient_id: number;
  assessment_datetime: string;
  patient_category: 'preterm_infant' | 'term_infant' | 'child' | 'adolescent_female' | 'adolescent_male';
  height_cm: number;
  dry_weight_kg: number;
  current_weight_kg: number;
  baseline_creatinine_mg_dl: number;
  current_creatinine_mg_dl: number;
  urine_output_ml: number | null;
  urine_output_hours: number | null;
  serum_sodium_meq_l: number | null;
  urine_sodium_meq_l: number | null;
  serum_bun_mg_dl: number | null;
  urine_urea_mg_dl: number | null;
  urine_creatinine_mg_dl: number | null;
  calculated_egfr: number;
  calculated_uop_ml_kg_h: number | null;
  calculated_fluid_overload_pct: number;
  calculated_fena_pct: number | null;
  calculated_feurea_pct: number | null;
  kdigo_scr_stage: number;
  kdigo_uop_stage: number | null;
  kdigo_overall_stage: number;
  prerenal_vs_atn: 'prerenal' | 'intrinsic_atn' | 'indeterminate' | 'not_evaluated';
  nephrotoxic_medications: string | null;
  clinical_action_plan: string | null;
  assessed_by_id: number;
  assessed_by_name?: string;
  patient_name?: string;
  patient_uhid?: string;
  patient_dob?: string;
  patient_gender?: string;
  created_at: string;
}

export interface PdSessionRecord {
  id: number;
  patient_id: number;
  session_number: string;
  start_datetime: string;
  end_datetime: string | null;
  indication:
    | 'kdigo_stage_3_aki'
    | 'severe_fluid_overload_gt20'
    | 'refractory_hyperkalemia'
    | 'severe_metabolic_acidosis'
    | 'inborn_error_metabolism'
    | 'uremic_encephalopathy'
    | 'other';
  catheter_type:
    | 'acute_rigid_percutaneous'
    | 'flexible_curved_cook'
    | 'tenckhoff_single_cuff'
    | 'tenckhoff_double_cuff'
    | 'other';
  catheter_insertion_date: string | null;
  patient_weight_kg: number;
  solution_type: 'dextrose_1_5' | 'dextrose_2_5' | 'dextrose_4_25' | 'custom_compound';
  fill_volume_ml_per_kg: number;
  calculated_fill_volume_ml: number;
  inflow_time_minutes: number;
  dwell_time_minutes: number;
  drain_time_minutes: number;
  target_cycles_count: number;
  heparin_units_per_liter: number;
  potassium_meq_per_liter: number;
  antibiotic_additive: string | null;
  status: 'active' | 'completed' | 'aborted';
  deactivation_reason: string | null;
  prescribed_by_id: number;
  prescribed_by_name?: string;
  completed_by_id?: number | null;
  completed_by_name?: string | null;
  cumulative_inflow_ml: number;
  cumulative_outflow_ml: number;
  cumulative_net_uf_ml: number;
  patient_name?: string;
  patient_uhid?: string;
  patient_dob?: string;
  patient_gender?: string;
  total_cycles_logged?: number;
  created_at: string;
}

export interface PdCycleRecord {
  id: number;
  session_id: number;
  cycle_number: number;
  cycle_start_time: string;
  inflow_ml: number;
  dwell_duration_minutes: number;
  outflow_ml: number;
  net_uf_ml: number;
  cumulative_uf_ml: number;
  effluent_appearance:
    | 'clear_straw'
    | 'hazy'
    | 'cloudy_turbid'
    | 'blood_tinged'
    | 'frank_blood'
    | 'fibrin_clots';
  abdominal_girth_cm: number | null;
  catheter_site_leakage: number;
  patient_tolerance:
    | 'well_tolerated'
    | 'mild_distress'
    | 'severe_pain_distension'
    | 'respiratory_compromise';
  nurse_id: number;
  nurse_name?: string;
  notes: string | null;
  created_at: string;
}

export interface PdEffluentLabRecord {
  id: number;
  session_id: number;
  sample_datetime: string;
  wbc_count_per_mcl: number;
  neutrophils_percent: number;
  gram_stain: string | null;
  culture_growth: string | null;
  peritonitis_confirmed: number;
  empiric_antibiotic_initiated: string | null;
  logged_by_id: number;
  logged_by_name?: string;
  session_number?: string;
  patient_name?: string;
  patient_uhid?: string;
  created_at: string;
}

export const getPediatricRenalAssessments = (params?: {
  patientId?: number;
  limit?: number;
}): Promise<{ assessments: PediatricRenalAssessmentRecord[] }> => {
  const q = new URLSearchParams();
  if (params?.patientId) q.append('patientId', String(params.patientId));
  if (params?.limit) q.append('limit', String(params.limit));
  const queryStr = q.toString() ? `?${q.toString()}` : '';
  return api<{ assessments: PediatricRenalAssessmentRecord[] }>(
    'GET',
    `/api/pediatric-renal/assessments${queryStr}`
  );
};

export const createPediatricRenalAssessment = (payload: {
  patientId: number;
  assessmentDatetime: string;
  patientCategory: string;
  heightCm: number;
  dryWeightKg: number;
  currentWeightKg: number;
  baselineCreatinineMgDl: number;
  currentCreatinineMgDl: number;
  urineOutputMl?: number | null;
  urineOutputHours?: number | null;
  serumSodiumMeqL?: number | null;
  urineSodiumMeqL?: number | null;
  serumBunMgDl?: number | null;
  urineUreaMgDl?: number | null;
  urineCreatinineMgDl?: number | null;
  nephrotoxicMedications: string[];
  clinicalActionPlan?: string | null;
}): Promise<{ assessment: PediatricRenalAssessmentRecord }> =>
  api<{ assessment: PediatricRenalAssessmentRecord }>('POST', '/api/pediatric-renal/assessments', payload);

export const getPediatricRenalAssessment = (
  id: number
): Promise<{ assessment: PediatricRenalAssessmentRecord }> =>
  api<{ assessment: PediatricRenalAssessmentRecord }>('GET', `/api/pediatric-renal/assessments/${id}`);

export const deletePediatricRenalAssessment = (
  id: number
): Promise<{ success: boolean; message: string }> =>
  api<{ success: boolean; message: string }>('DELETE', `/api/pediatric-renal/assessments/${id}`);

export const getPdSessions = (params?: {
  patientId?: number;
  status?: string;
}): Promise<{ sessions: PdSessionRecord[] }> => {
  const q = new URLSearchParams();
  if (params?.patientId) q.append('patientId', String(params.patientId));
  if (params?.status) q.append('status', params.status);
  const queryStr = q.toString() ? `?${q.toString()}` : '';
  return api<{ sessions: PdSessionRecord[] }>('GET', `/api/pediatric-renal/pd-sessions${queryStr}`);
};

export const createPdSession = (payload: {
  patientId: number;
  startDatetime: string;
  indication: string;
  catheterType: string;
  catheterInsertionDate?: string | null;
  patientWeightKg: number;
  solutionType: string;
  fillVolumeMlPerKg: number;
  inflowTimeMinutes?: number;
  dwellTimeMinutes?: number;
  drainTimeMinutes?: number;
  targetCyclesCount?: number;
  heparinUnitsPerLiter?: number;
  potassiumMeqPerLiter?: number;
  antibioticAdditive?: string | null;
}): Promise<{ session: PdSessionRecord }> =>
  api<{ session: PdSessionRecord }>('POST', '/api/pediatric-renal/pd-sessions', payload);

export const getPdSession = (
  id: number
): Promise<{
  session: PdSessionRecord;
  cycles: PdCycleRecord[];
  effluentLabs: PdEffluentLabRecord[];
}> =>
  api<{
    session: PdSessionRecord;
    cycles: PdCycleRecord[];
    effluentLabs: PdEffluentLabRecord[];
  }>('GET', `/api/pediatric-renal/pd-sessions/${id}`);

export const updatePdSessionStatus = (
  id: number,
  payload: { status: 'completed' | 'aborted' | 'active'; deactivationReason?: string }
): Promise<{ session: PdSessionRecord }> =>
  api<{ session: PdSessionRecord }>('PUT', `/api/pediatric-renal/pd-sessions/${id}/status`, payload);

export const logPdCycle = (
  sessionId: number,
  payload: {
    cycleNumber: number;
    cycleStartTime: string;
    inflowMl: number;
    dwellDurationMinutes: number;
    outflowMl: number;
    effluentAppearance: string;
    abdominalGirthCm?: number | null;
    catheterSiteLeakage: boolean;
    patientTolerance: string;
    notes?: string | null;
  }
): Promise<{ cycle: PdCycleRecord }> =>
  api<{ cycle: PdCycleRecord }>('POST', `/api/pediatric-renal/pd-sessions/${sessionId}/cycles`, payload);

export const deletePdCycle = (
  sessionId: number,
  cycleId: number
): Promise<{ success: boolean; message: string }> =>
  api<{ success: boolean; message: string }>(
    'DELETE',
    `/api/pediatric-renal/pd-sessions/${sessionId}/cycles/${cycleId}`
  );

export const logPdEffluentLab = (
  sessionId: number,
  payload: {
    sampleDatetime: string;
    wbcCountPerMcl: number;
    neutrophilsPercent: number;
    gramStain?: string | null;
    cultureGrowth?: string | null;
    empiricAntibioticInitiated?: string | null;
  }
): Promise<{ effluentLab: PdEffluentLabRecord }> =>
  api<{ effluentLab: PdEffluentLabRecord }>(
    'POST',
    `/api/pediatric-renal/pd-sessions/${sessionId}/effluent-labs`,
    payload
  );

export const getPediatricRenalDashboard = (): Promise<{
  activeSessions: (PdSessionRecord & { cycles_logged: number })[];
  highRiskRenalPatients: PediatricRenalAssessmentRecord[];
  peritonitisAlerts: (PdEffluentLabRecord & {
    session_number: string;
    patient_name: string;
    patient_uhid: string;
  })[];
}> => api('GET', '/api/pediatric-renal/dashboard');

export const auditPdPrint = (id: number): Promise<{ success: boolean }> =>
  api<{ success: boolean }>('POST', `/api/pediatric-renal/pd-sessions/${id}/print`, {});



