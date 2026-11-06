import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { localDate, localTime, nowIso } from '../time.js';
import { camelize } from '../util.js';

type Row = Record<string, unknown>;

/**
 * Hours between doses for a frequency written in plain words ("every 8 hours", "BD", "TDS", "twice daily"...).
 * Returns null whenever the wording is not clearly one of these, so no due time is ever guessed: the nurse then
 * works from the chart. As-needed, once-weekly, morning/night-only and similar wording is never given an interval.
 */
export function intervalHoursOf(frequency: string): number | null {
  const f = frequency.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!f) return null;
  if (/\b(prn|sos|stat|as needed|if needed|when needed|week|weekly|alternate|alt day|fortnight|month|morning|evening|night|hs|nocte|mane|before|after|with|meals?|bedtime)\b/.test(f)) return null;
  const every = f.match(/\b(?:every|q)\s*(\d{1,2})\s*(?:h|hr|hrs|hour|hours)\b/) ?? f.match(/^q(\d{1,2})h?$/);
  if (every) {
    const n = Number(every[1]);
    return n >= 1 && n <= 24 ? n : null;
  }
  if (/^(od|qd|o\.d\.?)$|\bonce (a |per )?(day|daily)\b|^once$|^daily$|\bonce daily\b/.test(f)) return 24;
  if (/^(bd|bid|b\.d\.?)$|\btwice (a |per )?(day|daily)?\b|\b2 times (a |per )?day\b/.test(f)) return 12;
  if (/^(tds|tid|t\.d\.s\.?)$|\bthrice\b|\bthree times\b|\b3 times (a |per )?day\b/.test(f)) return 8;
  if (/^(qid|qds|q\.i\.d\.?)$|\bfour times\b|\b4 times (a |per )?day\b/.test(f)) return 6;
  return null;
}

export type DoseState = 'may_be_due' | 'not_yet' | 'starts_later' | 'unknown';

/** Elapsed-time view of one order. It is a prompt for the nurse, not a schedule: `unknown` means "check the chart". */
export function doseState(opts: { intervalHours: number | null; startAt: string; lastAt: string | null; now: Date }): DoseState {
  const start = Date.parse(opts.startAt);
  if (start > opts.now.getTime()) return 'starts_later';
  if (opts.intervalHours == null) return 'unknown';
  const since = opts.lastAt ? Date.parse(opts.lastAt) : start;
  return opts.now.getTime() - since >= opts.intervalHours * 3_600_000 ? 'may_be_due' : 'not_yet';
}

const query = z.object({ poll: z.enum(['1']).optional() });

export function registerStationRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const tz = cfg.timezone;
  const when = (iso: string | null) => (iso ? { at: iso, date: localDate(new Date(iso), tz), time: localTime(iso, tz) } : null);

  app.get('/api/station', async (req) => {
    const user = requirePerm(req, 'station:read');
    const q = query.parse(req.query ?? {});
    const now = new Date();
    const nowStamp = nowIso();
    const today = localDate(now, tz);

    // Outpatients here today who are checked in or being seen, and whether anyone has recorded their vitals yet.
    const opd = (
      db
        .prepare(
          `SELECT a.id AS appointment_id, a.status, a.scheduled_at, a.reason, p.id AS patient_id, p.full_name AS patient_name,
                  p.patient_number, p.allergy_status, p.allergy_details, p.last_menstrual_period, p.gravida, p.para, p.abortions, p.living, v.id AS visit_id, v.status AS visit_status,
                  (SELECT COUNT(*) FROM visit_vitals t WHERE t.visit_id = v.id) AS vitals_count,
                  (SELECT MAX(t.recorded_at) FROM visit_vitals t WHERE t.visit_id = v.id) AS vitals_at
             FROM appointments a JOIN patients p ON p.id = a.patient_id LEFT JOIN visits v ON v.appointment_id = a.id
            WHERE a.scheduled_date = ? AND a.status IN ('waiting','in_consultation')
            ORDER BY a.status = 'in_consultation', a.scheduled_at, a.id`,
        )
        .all(today) as Row[]
    ).map((r) => ({
      ...camelize(r),
      scheduledTime: localTime(r.scheduled_at as string, tz),
      hasVitals: (r.vitals_count as number) > 0,
      vitalsAt: when(r.vitals_at as string | null),
    }));

    // Inpatients, in bed order (the order a nurse walks the ward).
    const admissions = db
      .prepare(
        `SELECT a.id AS admission_id, a.admission_number, a.admitted_at, p.id AS patient_id, p.full_name AS patient_name,
                p.patient_number, p.allergy_status, p.allergy_details, p.last_menstrual_period, p.gravida, p.para, p.abortions, p.living, b.room AS bed_room, b.label AS bed_label
           FROM admissions a JOIN patients p ON p.id = a.patient_id JOIN beds b ON b.id = a.bed_id
          WHERE a.status = 'admitted' ORDER BY b.room, b.label`,
      )
      .all() as Row[];

    // The latest entry that has not itself been corrected by a later one.
    const lastObs = db.prepare(
      `SELECT c.clinical_at, c.systolic_mmhg, c.diastolic_mmhg, c.pulse_bpm, c.temperature_c, c.spo2_pct, c.resp_rate
         FROM care_entries c
        WHERE c.admission_id = ? AND c.entry_type = 'observation'
          AND NOT EXISTS (SELECT 1 FROM care_entries x WHERE x.corrects_id = c.id)
        ORDER BY c.clinical_at DESC, c.id DESC LIMIT 1`,
    );
    const activeOrders = db.prepare(
      `SELECT id, medicine, strength, dose, route, frequency, instructions, start_at FROM medicine_orders
        WHERE admission_id = ? AND (stopped_at IS NULL OR stopped_at > ?) ORDER BY start_at, id`,
    );
    const lastRecord = db.prepare(
      `SELECT r.outcome, r.given_at, r.reason FROM medication_records r
        WHERE r.order_id = ? AND NOT EXISTS (SELECT 1 FROM medication_records x WHERE x.corrects_id = r.id)
        ORDER BY r.given_at DESC, r.id DESC LIMIT 1`,
    );

    const ward = admissions.map((a) => {
      const obs = lastObs.get(a.admission_id as number) as Row | undefined;
      const medicines = (activeOrders.all(a.admission_id as number, nowStamp) as Row[]).map((o) => {
        const rec = lastRecord.get(o.id as number) as { outcome: string; given_at: string; reason: string | null } | undefined;
        const intervalHours = intervalHoursOf(o.frequency as string);
        return {
          orderId: o.id,
          medicine: o.medicine,
          strength: o.strength,
          dose: o.dose,
          route: o.route,
          frequency: o.frequency,
          instructions: o.instructions,
          start: when(o.start_at as string),
          intervalHours,
          last: rec ? { ...when(rec.given_at)!, outcome: rec.outcome, reason: rec.reason } : null,
          state: doseState({ intervalHours, startAt: o.start_at as string, lastAt: rec?.given_at ?? null, now }),
        };
      });
      return {
        ...camelize(a),
        admitted: when(a.admitted_at as string),
        lastObservation: obs ? { ...camelize(obs), ...when(obs.clinical_at as string)! } : null,
        medicines,
      };
    });

    // Every look at this screen shows clinical details of several patients, so it is recorded; the
    // automatic refresh (?poll=1) is not, or the log would fill with one entry a minute.
    if (!q.poll) {
      audit(db, { actorId: user.id, action: 'station.view', entity: 'station', detail: { opd: opd.length, ward: ward.length } });
    }
    return { now: nowStamp, date: today, opd, ward };
  });
}
