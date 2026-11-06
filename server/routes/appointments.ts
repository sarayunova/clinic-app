import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit } from '../audit.js';
import { badRequest, conflict, forbidden, notFound, parse } from '../errors.js';
import { can, type Role } from '../permissions.js';
import { addDays, isRealDate, localDate, localTime, localToUtcIso, nowIso } from '../time.js';
import { camelize } from '../util.js';

export const STATUSES = ['scheduled', 'waiting', 'in_consultation', 'completed', 'cancelled', 'absent'] as const;
type Status = (typeof STATUSES)[number];

/** Allowed moves. completed / cancelled / absent are final. */
const TRANSITIONS: Record<Status, Status[]> = {
  scheduled: ['waiting', 'cancelled', 'absent'],
  waiting: ['in_consultation', 'cancelled', 'absent'],
  in_consultation: ['completed', 'waiting'],
  completed: [],
  cancelled: [],
  absent: [],
};
const CLINICAL_TARGETS: Status[] = ['in_consultation', 'completed'];

const date = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');
const createSchema = z
  .object({
    patientId: z.number().int().min(1),
    date,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM'),
    reason: z.string().trim().min(2, 'Reason is required').max(500),
  })
  .strict();
const rescheduleSchema = z
  .object({
    date,
    time: createSchema.shape.time,
    reason: createSchema.shape.reason.optional(),
    version: z.number().int().min(1),
  })
  .strict();
const listSchema = z.object({ date: date.optional() });
const followUpsSchema = z.object({
  from: date.optional(),
  to: date.optional(),
  status: z.enum(['all', 'pending', 'booked']).default('pending'),
});
const statusSchema = z.object({ status: z.enum(STATUSES), version: z.number().int().min(1) }).strict();

const SELECT = `
  SELECT a.id, a.patient_id, a.scheduled_at, a.scheduled_date, a.reason, a.status, a.version, a.created_at, a.updated_at,
         p.patient_number, p.full_name AS patient_name, p.phone AS patient_phone,
         p.allergy_status, p.allergy_details, v.id AS visit_id, v.status AS visit_status
    FROM appointments a JOIN patients p ON p.id = a.patient_id
    LEFT JOIN visits v ON v.appointment_id = a.id`;

export function registerAppointmentRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const get = (id: number) => db.prepare(`${SELECT} WHERE a.id = ?`).get(id);
  /** camelCase row plus the clinic-local time, so clients never format times in their own timezone. */
  const present = (row: object, role: Role) => {
    const o = camelize(row);
    if (!can(role, 'visit:read')) {
      delete o.visitId; // reception does not see consultation records
      delete o.visitStatus;
    }
    return { ...o, scheduledTime: localTime(o.scheduledAt as string, cfg.timezone) };
  };

  app.get('/api/appointments/follow-ups', async (req) => {
    const user = requirePerm(req, 'appointment:read');
    const q = parse(followUpsSchema, req.query);
    const today = localDate(new Date(), cfg.timezone);
    const fromDate = q.from ?? addDays(today, -7);
    const toDate = q.to ?? addDays(today, 30);

    const rows = db
      .prepare(
        `SELECT v.id AS visit_id, v.patient_id, v.follow_up_date, v.visit_at, v.assessment,
                p.patient_number, p.full_name AS patient_name, p.phone AS patient_phone,
                p.allergy_status, p.allergy_details,
                (SELECT a.id FROM appointments a
                  WHERE a.patient_id = v.patient_id
                    AND a.scheduled_date >= v.follow_up_date
                    AND a.status IN ('scheduled', 'waiting', 'in_consultation', 'completed')
                  ORDER BY a.scheduled_date, a.id LIMIT 1) AS appointment_id,
                (SELECT a.scheduled_date FROM appointments a
                  WHERE a.patient_id = v.patient_id
                    AND a.scheduled_date >= v.follow_up_date
                    AND a.status IN ('scheduled', 'waiting', 'in_consultation', 'completed')
                  ORDER BY a.scheduled_date, a.id LIMIT 1) AS appointment_date,
                (SELECT a.scheduled_at FROM appointments a
                  WHERE a.patient_id = v.patient_id
                    AND a.scheduled_date >= v.follow_up_date
                    AND a.status IN ('scheduled', 'waiting', 'in_consultation', 'completed')
                  ORDER BY a.scheduled_date, a.id LIMIT 1) AS appointment_at,
                (SELECT a.status FROM appointments a
                  WHERE a.patient_id = v.patient_id
                    AND a.scheduled_date >= v.follow_up_date
                    AND a.status IN ('scheduled', 'waiting', 'in_consultation', 'completed')
                  ORDER BY a.scheduled_date, a.id LIMIT 1) AS appointment_status
           FROM visits v
           JOIN patients p ON p.id = v.patient_id
          WHERE v.status = 'final'
            AND v.follow_up_date IS NOT NULL
            AND v.follow_up_date >= ?
            AND v.follow_up_date <= ?
            AND v.id = (
              SELECT v2.id FROM visits v2
               WHERE v2.patient_id = v.patient_id
                 AND v2.status = 'final'
                 AND v2.follow_up_date IS NOT NULL
               ORDER BY v2.follow_up_date DESC, v2.id DESC LIMIT 1
            )
          ORDER BY v.follow_up_date ASC, v.id ASC`,
      )
      .all(fromDate, toDate) as Record<string, unknown>[];

    const result = rows
      .map((r) => {
        const o = camelize(r);
        o.visitDate = localDate(new Date(r.visit_at as string), cfg.timezone);
        o.appointmentTime = r.appointment_at ? localTime(r.appointment_at as string, cfg.timezone) : null;
        o.isOverdue = (r.follow_up_date as string) < today && !r.appointment_id;
        delete o.visitAt;
        delete o.appointmentAt;
        if (!can(user.role, 'visit:read')) {
          delete o.assessment;
        }
        return o;
      })
      .filter((o) => {
        if (q.status === 'pending') return !o.appointmentId;
        if (q.status === 'booked') return Boolean(o.appointmentId);
        return true;
      });

    return result;
  });

  app.get('/api/appointments', async (req) => {
    const user = requirePerm(req, 'appointment:read');
    const q = parse(listSchema, req.query);
    const day = q.date ?? localDate(new Date(), cfg.timezone);
    return db.prepare(`${SELECT} WHERE a.scheduled_date = ? ORDER BY a.scheduled_at, a.id`).all(day).map((r) => present(r, user.role));
  });

  app.post('/api/appointments', async (req, reply) => {
    const user = requirePerm(req, 'appointment:create');
    const body = parse(createSchema, req.body);
    const at = localToUtcIso(body.date, body.time, cfg.timezone);
    if (!at) throw badRequest('That date and time do not exist');
    if (body.date < localDate(new Date(), cfg.timezone)) throw badRequest('Appointments cannot be booked in the past');

    const id = tx(db, () => {
      if (!db.prepare('SELECT 1 FROM patients WHERE id = ?').get(body.patientId)) throw notFound('Patient');
      const dup = db
        .prepare("SELECT 1 FROM appointments WHERE patient_id = ? AND scheduled_at = ? AND status IN ('scheduled','waiting','in_consultation')")
        .get(body.patientId, at);
      if (dup) throw conflict('This patient already has an appointment at that time');
      const now = nowIso();
      const r = db
        .prepare(
          `INSERT INTO appointments(patient_id, scheduled_at, scheduled_date, reason, created_by, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?)`,
        )
        .run(body.patientId, at, body.date, body.reason, user.id, now, now);
      const aid = Number(r.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'appointment.create', entity: 'appointment', entityId: aid, detail: { patientId: body.patientId, at } });
      return aid;
    });
    return reply.status(201).send(present(get(id)!, user.role));
  });

  app.patch('/api/appointments/:id/status', async (req) => {
    const user = requirePerm(req, 'appointment:status_front');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) throw notFound('Appointment');
    const body = parse(statusSchema, req.body);
    if (CLINICAL_TARGETS.includes(body.status) && !can(user.role, 'appointment:status_clinical')) {
      throw forbidden('Only the doctor can start or complete a consultation');
    }
    return tx(db, () => {
      const cur = db.prepare('SELECT status, version FROM appointments WHERE id = ?').get(id) as { status: Status; version: number } | undefined;
      if (!cur) throw notFound('Appointment');
      if (cur.version !== body.version) throw conflict('This appointment was changed by someone else. Reload and try again.', { currentVersion: cur.version });
      if (!TRANSITIONS[cur.status].includes(body.status)) {
        throw badRequest(`Cannot change an appointment from "${cur.status}" to "${body.status}"`);
      }
      const r = db
        .prepare('UPDATE appointments SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?')
        .run(body.status, nowIso(), id, body.version);
      if (r.changes !== 1) throw conflict('This appointment was changed by someone else. Reload and try again.');
      audit(db, { actorId: user.id, action: 'appointment.status', entity: 'appointment', entityId: id, detail: { from: cur.status, to: body.status } });
      return present(get(id)!, user.role);
    });
  });

  /** Moves a not-yet-arrived appointment to another date/time. Same record, so history and links stay intact. */
  app.patch('/api/appointments/:id/reschedule', async (req) => {
    const user = requirePerm(req, 'appointment:create');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) throw notFound('Appointment');
    const body = parse(rescheduleSchema, req.body);
    const at = localToUtcIso(body.date, body.time, cfg.timezone);
    if (!at) throw badRequest('That date and time do not exist');
    if (body.date < localDate(new Date(), cfg.timezone)) throw badRequest('Appointments cannot be moved to a past date');
    return tx(db, () => {
      const cur = db
        .prepare('SELECT patient_id, status, version, scheduled_at, reason FROM appointments WHERE id = ?')
        .get(id) as { patient_id: number; status: Status; version: number; scheduled_at: string; reason: string } | undefined;
      if (!cur) throw notFound('Appointment');
      if (cur.version !== body.version) throw conflict('This appointment was changed by someone else. Reload and try again.', { currentVersion: cur.version });
      if (cur.status !== 'scheduled') throw badRequest('Only an appointment that has not yet started can be rescheduled. Cancel and rebook instead.');
      const dup = db
        .prepare("SELECT 1 FROM appointments WHERE patient_id = ? AND scheduled_at = ? AND id != ? AND status IN ('scheduled','waiting','in_consultation')")
        .get(cur.patient_id, at, id);
      if (dup) throw conflict('This patient already has an appointment at that time');
      const reason = body.reason ?? cur.reason;
      const r = db
        .prepare('UPDATE appointments SET scheduled_at = ?, scheduled_date = ?, reason = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?')
        .run(at, body.date, reason, nowIso(), id, body.version);
      if (r.changes !== 1) throw conflict('This appointment was changed by someone else. Reload and try again.');
      audit(db, {
        actorId: user.id,
        action: 'appointment.reschedule',
        entity: 'appointment',
        entityId: id,
        detail: { scheduledAt: { from: cur.scheduled_at, to: at }, ...(reason !== cur.reason ? { reason: { from: cur.reason, to: reason } } : {}) },
      });
      return present(get(id)!, user.role);
    });
  });
}
