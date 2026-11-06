import type { FastifyInstance } from 'fastify';
import type { Ctx } from '../app.js';
import { localDate, localTime, nowIso } from '../time.js';

export interface TvQueueItem {
  id: number;
  tokenNumber: number;
  displayName: string;
  status: 'scheduled' | 'waiting' | 'in_consultation' | 'completed';
  scheduledTime: string;
  room?: string;
}

export interface TvQueueResponse {
  clinicName: string;
  doctorName: string;
  serverTime: string;
  serverDate: string;
  current: TvQueueItem[];
  next: TvQueueItem[];
  waiting: TvQueueItem[];
  scheduled: TvQueueItem[];
  completedCount: number;
  totalToday: number;
}

/**
 * Privacy masking: preserves first name + last initial (e.g. "Asha Verma" -> "Asha V.").
 * Strips common honorifics to protect identity while keeping tokens recognizable.
 */
export function maskPatientName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Patient';
  const titles = new Set(['mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.', 'master', 'baby', 'b/o']);
  let cleanParts = parts;
  if (parts.length > 1 && titles.has(parts[0]!.toLowerCase())) {
    cleanParts = parts.slice(1);
  }
  if (cleanParts.length === 0) return 'Patient';
  if (cleanParts.length === 1) return cleanParts[0]!;
  const first = cleanParts[0]!;
  const last = cleanParts[cleanParts.length - 1]!;
  const initial = last && last[0] ? `${last[0].toUpperCase()}.` : '';
  return `${first} ${initial}`.trim();
}

type Row = Record<string, unknown>;

export function registerTvRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  app.get('/api/tv/queue', async () => {
    const now = new Date();
    const today = localDate(now, cfg.timezone);
    const timeFormatted = localTime(nowIso(), cfg.timezone);

    // Read clinic details
    const settingsRows = db
      .prepare("SELECT key, value FROM settings WHERE key IN ('clinicName', 'doctorName')")
      .all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of settingsRows) settings[r.key] = r.value;
    const clinicName = settings.clinicName || 'Clinic';
    const doctorName = settings.doctorName || '';

    // Fetch today's appointments with chronological token numbering
    const rows = db
      .prepare(
        `SELECT a.id, a.scheduled_at, a.status, p.full_name AS patient_name,
                ROW_NUMBER() OVER (ORDER BY a.scheduled_at, a.id) AS token_number
           FROM appointments a
           JOIN patients p ON p.id = a.patient_id
          WHERE a.scheduled_date = ?
            AND a.status IN ('scheduled', 'waiting', 'in_consultation', 'completed')
          ORDER BY a.scheduled_at, a.id`,
      )
      .all(today) as Row[];

    const current: TvQueueItem[] = [];
    const waitingAll: TvQueueItem[] = [];
    const scheduled: TvQueueItem[] = [];
    let completedCount = 0;

    for (const r of rows) {
      const item: TvQueueItem = {
        id: r.id as number,
        tokenNumber: r.token_number as number,
        displayName: maskPatientName(r.patient_name as string),
        status: r.status as TvQueueItem['status'],
        scheduledTime: localTime(r.scheduled_at as string, cfg.timezone),
        room: 'Consultation Room 1',
      };

      if (r.status === 'in_consultation') {
        current.push(item);
      } else if (r.status === 'waiting') {
        waitingAll.push(item);
      } else if (r.status === 'scheduled') {
        scheduled.push(item);
      } else if (r.status === 'completed') {
        completedCount++;
      }
    }

    // The next 1-2 in line from checked-in waiting patients
    const next = waitingAll.slice(0, 2);
    const waiting = waitingAll.slice(2);

    const res: TvQueueResponse = {
      clinicName,
      doctorName,
      serverTime: timeFormatted,
      serverDate: today,
      current,
      next,
      waiting,
      scheduled,
      completedCount,
      totalToday: rows.length,
    };

    return res;
  });
}
