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

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown): Promise<T> {
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
