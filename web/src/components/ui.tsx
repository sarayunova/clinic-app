import type { ReactNode } from 'react';
import { ApiError } from '../api';

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="banner error" role="alert">
      {msg}
    </div>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function AllergyBadge({ status, details }: { status: 'unknown' | 'none' | 'known'; details?: string | null }) {
  if (status === 'known') return <span className="badge danger" title={details ?? ''}>⚠ Allergy: {details}</span>;
  if (status === 'none') return <span className="badge ok">No known allergies</span>;
  return <span className="badge warn">Allergies not recorded</span>;
}

export function fieldErrorsOf(e: unknown): Record<string, string> {
  return e instanceof ApiError ? e.fieldErrors : {};
}

export function formatAge(age: number | null | undefined, estimated: boolean): string {
  if (age == null) return 'Age not recorded';
  return `${estimated ? '~' : ''}${age} yrs`;
}

export const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  waiting: 'Waiting',
  in_consultation: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  absent: 'Absent',
};
