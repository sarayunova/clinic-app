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
    if (res.status === 401 && !url.startsWith('/api/auth/login')) window.dispatchEvent(new Event('clinic:unauthorized'));
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

export interface PatientSummary {
  id: number;
  patientNumber: string;
  fullName: string;
  phone: string | null;
  ageYears: number | null;
  ageIsEstimated: boolean;
  allergyStatus: 'unknown' | 'none' | 'known';
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
  ageYears: number | null;
  ageIsEstimated: boolean;
  allergyStatus: 'unknown' | 'none' | 'known';
  allergyDetails: string | null;
  complaints: string | null;
  history: string | null;
  examination: string | null;
  assessment: string | null;
  antenatalNotes: string | null;
  investigations: string | null;
  advice: string | null;
  followUpDate: string | null;
  finalisedByName: string | null;
  prescriptionItems: PrescriptionItem[];
  vitals: VitalsEntry[];
  revisions: RevisionMeta[];
}

export interface VisitSummary {
  id: number;
  visitDate: string;
  status: 'draft' | 'final';
  assessment: string | null;
  complaints: string | null;
  amendments: number;
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

export interface Admission {
  id: number;
  admissionNumber: string;
  patientId: number;
  patientNumber: string;
  patientName: string;
  ageYears: number | null;
  ageIsEstimated: boolean;
  allergyStatus: 'unknown' | 'none' | 'known';
  allergyDetails: string | null;
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

export interface ClinicSettings {
  clinicName: string;
  address: string;
  phone: string;
  doctorName: string;
  registrationNo: string;
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
