export interface GestationalAge {
  weeks: number;
  days: number;
  totalDays: number;
  formatted: string;
  fullFormatted: string;
  isPlausiblePregnancy: boolean;
}

/**
 * Calculates Expected Date of Delivery (EDD) from LMP via Naegele's rule (+280 days).
 * Returns YYYY-MM-DD or null if invalid.
 */
export function calculateEdd(lmpDate: string | null | undefined): string | null {
  if (!lmpDate || !/^\d{4}-\d{2}-\d{2}$/.test(lmpDate)) return null;
  const parts = lmpDate.split('-').map(Number);
  if (parts.length !== 3 || parts[0] == null || parts[1] == null || parts[2] == null) return null;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + 280);
  return dt.toISOString().slice(0, 10);
}

/**
 * Calculates Gestational Age from LMP as of a specific date (defaults to today's local date).
 */
export function calculateGestationalAge(
  lmpDate: string | null | undefined,
  asOfDate?: string | null,
): GestationalAge | null {
  if (!lmpDate || !/^\d{4}-\d{2}-\d{2}$/.test(lmpDate)) return null;
  const target = asOfDate || new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return null;

  const lparts = lmpDate.split('-').map(Number);
  const tparts = target.split('-').map(Number);
  if (lparts.length !== 3 || lparts[0] == null || lparts[1] == null || lparts[2] == null) return null;
  if (tparts.length !== 3 || tparts[0] == null || tparts[1] == null || tparts[2] == null) return null;

  const [ly, lm, ld] = lparts;
  const [ty, tm, td] = tparts;
  const lmpUtc = Date.UTC(ly, lm - 1, ld);
  const targetUtc = Date.UTC(ty, tm - 1, td);

  const diffMs = targetUtc - lmpUtc;
  const totalDays = Math.floor(diffMs / (24 * 3600 * 1000));
  if (totalDays < 0) return null;

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const isPlausiblePregnancy = totalDays <= 308; // within 44 weeks

  return {
    weeks,
    days,
    totalDays,
    formatted: `${weeks}w ${days}d`,
    fullFormatted: `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ${days} ${days === 1 ? 'day' : 'days'}`,
    isPlausiblePregnancy,
  };
}

/**
 * Formats Gravida, Para, Abortions, Living into standard clinical notation (e.g. "G3 P1 A1 L1").
 */
export function formatGpal(opts: {
  gravida?: unknown;
  para?: unknown;
  abortions?: unknown;
  living?: unknown;
}): string | null {
  const g = typeof opts.gravida === 'number' ? opts.gravida : null;
  const p = typeof opts.para === 'number' ? opts.para : null;
  const a = typeof opts.abortions === 'number' ? opts.abortions : null;
  const l = typeof opts.living === 'number' ? opts.living : null;

  if (g === null && p === null && a === null && l === null) return null;
  const parts: string[] = [];
  if (g !== null) parts.push(`G${g}`);
  if (p !== null) parts.push(`P${p}`);
  if (a !== null) parts.push(`A${a}`);
  if (l !== null) parts.push(`L${l}`);
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Returns the obstetric trimester based on completed weeks of gestation:
 * - 1st Trimester: < 14 weeks
 * - 2nd Trimester: 14 to 27 completed weeks (< 28 weeks)
 * - 3rd Trimester: >= 28 weeks
 */
export function getTrimester(weeks: number): { trimester: 1 | 2 | 3; label: string } {
  if (weeks < 14) return { trimester: 1, label: '1st Trimester' };
  if (weeks < 28) return { trimester: 2, label: '2nd Trimester' };
  return { trimester: 3, label: '3rd Trimester' };
}
