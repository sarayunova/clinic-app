import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit } from '../audit.js';
import { badRequest, conflict, forbidden, notFound, parse } from '../errors.js';
import { can } from '../permissions.js';
import { isRealDate, localDate, localToUtcIso, nowIso } from '../time.js';
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
const listSchema = z.object({ date: date.optional() });
const statusSchema = z.object({ status: z.enum(STATUSES), version: z.number().int().min(1) }).strict();

const SELECT = `
  SELECT a.id, a.patient_id, a.scheduled_at, a.scheduled_date, a.reason, a.status, a.version, a.created_at, a.updated_at,
         p.patient_number, p.full_name AS patient_name, p.phone AS patient_phone,
         p.allergy_status, p.allergy_details
    FROM appointments a JOIN patients p ON p.id = a.patient_id`;

export function registerAppointmentRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const get = (id: number) => db.prepare(`${SELECT} WHERE a.id = ?`).get(id);

  app.get('/api/appointments', async (req) => {
    requirePerm(req, 'appointment:read');
    const q = parse(listSchema, req.query);
    const day = q.date ?? localDate(new Date(), cfg.timezone);
    return db.prepare(`${SELECT} WHERE a.scheduled_date = ? ORDER BY a.scheduled_at, a.id`).all(day).map(camelize);
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
    return reply.status(201).send(camelize(get(id)!));
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
      return camelize(get(id)!);
    });
  });
}
