import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit, diff } from '../audit.js';
import { badRequest, conflict, notFound, parse } from '../errors.js';
import { isRealDate, localDate, localTime, nowIso } from '../time.js';
import { camelize, toSnake } from '../util.js';
import { ageYears } from './patients.js';
import { measure, round1 } from '../validation.js';

// ---------- Schemas ----------

const text = (max: number) => z.string().trim().max(max).transform((s) => (s === '' ? null : s)).nullable();
const optText = (max: number) => text(max).optional();
const date = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');

const CLINICAL = {
  complaints: text(4000),
  history: text(4000),
  examination: text(4000),
  assessment: text(4000),
  antenatalNotes: text(4000),
  investigations: text(4000),
  advice: text(4000),
  followUpDate: date.nullable(),
} as const;
type ClinicalKey = keyof typeof CLINICAL;
const CLINICAL_KEYS = Object.keys(CLINICAL) as ClinicalKey[];

const itemSchema = z
  .object({
    medicine: z.string().trim().min(1, 'Medicine name is required').max(200),
    strength: optText(100),
    dose: optText(100),
    route: optText(60),
    frequency: optText(100),
    duration: optText(100),
    instructions: optText(500),
  })
  .strict();
const itemsSchema = z.array(itemSchema).max(30);
const ITEM_KEYS = ['medicine', 'strength', 'dose', 'route', 'frequency', 'duration', 'instructions'] as const;
type Item = Record<(typeof ITEM_KEYS)[number], string | null>;

const createSchema = z.object({ patientId: z.number().int().min(1), appointmentId: z.number().int().min(1).optional() }).strict();
const contentShape = z.object(CLINICAL).partial().extend({ prescriptionItems: itemsSchema.optional() });
const patchSchema = contentShape.extend({ version: z.number().int().min(1) }).strict();
const finaliseSchema = z.object({ version: z.number().int().min(1) }).strict();
const amendSchema = contentShape
  .extend({ version: z.number().int().min(1), reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500) })
  .strict();

const vitalsSchema = z
  .object({
    systolicMmhg: measure(40, 300, true),
    diastolicMmhg: measure(20, 200, true),
    pulseBpm: measure(20, 250, true),
    temperatureC: measure(30, 45),
    weightKg: measure(1, 400),
    heightCm: measure(30, 250),
    note: optText(500),
  })
  .strict();

type Row = Record<string, unknown>;

export function registerVisitRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const idOf = (raw: unknown) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) throw notFound('Visit');
    return id;
  };

  const getRow = (id: number) => db.prepare('SELECT * FROM visits WHERE id = ?').get(id) as Row | undefined;
  const itemsOf = (visitId: number) =>
    db
      .prepare(`SELECT ${ITEM_KEYS.join(', ')} FROM prescription_items WHERE visit_id = ? ORDER BY position`)
      .all(visitId) as unknown as Item[];

  /** Full copy of the clinical content, stored with every revision. */
  function snapshotOf(id: number): Record<string, unknown> & { prescriptionItems: Item[] } {
    const v = getRow(id)!;
    const fields: Record<string, unknown> = {};
    for (const k of CLINICAL_KEYS) fields[k] = v[toSnake(k)] ?? null;
    return { ...fields, prescriptionItems: itemsOf(id) };
  }

  function replaceItems(visitId: number, items: Item[]): void {
    db.prepare('DELETE FROM prescription_items WHERE visit_id = ?').run(visitId);
    const ins = db.prepare(
      `INSERT INTO prescription_items(visit_id, position, ${ITEM_KEYS.join(', ')}) VALUES (?, ?, ${ITEM_KEYS.map(() => '?').join(', ')})`,
    );
    items.forEach((it, i) => ins.run(visitId, i + 1, ...ITEM_KEYS.map((k) => it[k] ?? null)));
  }

  /**
   * Applies content changes to a visit (draft edit or amendment). Returns what actually changed.
   * Must be called inside a transaction.
   */
  function applyContent(id: number, body: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
    const before = snapshotOf(id);
    const visit = getRow(id)!;
    const next: Record<string, unknown> = { ...before };
    for (const k of CLINICAL_KEYS) if (body[k] !== undefined) next[k] = body[k];
    if (body.prescriptionItems !== undefined) next.prescriptionItems = (body.prescriptionItems as Partial<Item>[]).map((it) => Object.fromEntries(ITEM_KEYS.map((k) => [k, it[k] ?? null])));

    const fu = next.followUpDate as string | null;
    if (fu && fu < localDate(new Date(visit.visit_at as string), cfg.timezone)) {
      throw badRequest('Follow-up date cannot be before the visit date', [{ field: 'followUpDate', message: 'Cannot be before the visit date' }]);
    }

    const changes = diff(
      Object.fromEntries(CLINICAL_KEYS.map((k) => [k, before[k]])),
      Object.fromEntries(CLINICAL_KEYS.map((k) => [k, next[k]])),
    );
    const itemsChanged = JSON.stringify(before.prescriptionItems) !== JSON.stringify(next.prescriptionItems);
    if (itemsChanged) {
      changes.prescriptionItems = { from: before.prescriptionItems, to: next.prescriptionItems };
      replaceItems(id, next.prescriptionItems as Item[]);
    }
    const cols = Object.keys(changes).filter((k) => k !== 'prescriptionItems');
    if (cols.length || itemsChanged) {
      db.prepare(`UPDATE visits SET ${cols.map((c) => `${toSnake(c)} = ?`).concat('version = version + 1', 'updated_at = ?').join(', ')} WHERE id = ?`).run(
        ...cols.map((c) => next[c] as string | null),
        nowIso(),
        id,
      );
    }
    return changes;
  }

  function present(id: number) {
    const v = db
      .prepare(
        `SELECT v.*, p.patient_number, p.full_name AS patient_name, p.date_of_birth, p.estimated_age_years,
                p.allergy_status, p.allergy_details, p.last_menstrual_period, p.gravida, p.para, p.abortions, p.living, cu.full_name AS created_by_name, fu.full_name AS finalised_by_name
           FROM visits v JOIN patients p ON p.id = v.patient_id
           LEFT JOIN users cu ON cu.id = v.created_by LEFT JOIN users fu ON fu.id = v.finalised_by
          WHERE v.id = ?`,
      )
      .get(id) as Row | undefined;
    if (!v) throw notFound('Visit');
    const out = camelize(v);
    const dob = out.dateOfBirth as string | null;
    out.ageYears = dob ? ageYears(dob, localDate(new Date(), cfg.timezone)) : (out.estimatedAgeYears as number | null);
    out.ageIsEstimated = !dob && out.estimatedAgeYears != null;
    out.visitDate = localDate(new Date(out.visitAt as string), cfg.timezone);
    out.visitTime = localTime(out.visitAt as string, cfg.timezone);
    out.prescriptionItems = itemsOf(id);
    if (out.followUpDate) {
      const appt = db
        .prepare(
          `SELECT id, scheduled_date, scheduled_at, status FROM appointments
            WHERE patient_id = ? AND scheduled_date >= ? AND status IN ('scheduled','waiting','in_consultation','completed')
            ORDER BY scheduled_date, id LIMIT 1`,
        )
        .get(out.patientId as number, out.followUpDate as string) as { id: number; scheduled_date: string; scheduled_at: string; status: string } | undefined;
      out.followUpAppointment = appt
        ? {
            id: appt.id,
            scheduledDate: appt.scheduled_date,
            scheduledTime: localTime(appt.scheduled_at, cfg.timezone),
            status: appt.status,
          }
        : null;
    } else {
      out.followUpAppointment = null;
    }
    out.vitals = (
      db
        .prepare(
          `SELECT t.id, t.recorded_at, u.full_name AS recorded_by_name, t.systolic_mmhg, t.diastolic_mmhg, t.pulse_bpm,
                  t.temperature_c, t.weight_kg, t.height_cm, t.note
             FROM visit_vitals t JOIN users u ON u.id = t.recorded_by WHERE t.visit_id = ? ORDER BY t.id`,
        )
        .all(id) as Row[]
    ).map((r) => ({ ...camelize(r), recordedTime: localTime(r.recorded_at as string, cfg.timezone) }));
    out.revisions = (
      db
        .prepare(
          `SELECT r.revision_no, r.kind, r.at, r.reason, r.changes, u.full_name AS author_name
             FROM visit_revisions r JOIN users u ON u.id = r.author_id WHERE r.visit_id = ? ORDER BY r.revision_no`,
        )
        .all(id) as Row[]
    ).map((r) => ({
      ...camelize(r),
      atDate: localDate(new Date(r.at as string), cfg.timezone),
      atTime: localTime(r.at as string, cfg.timezone),
      changes: r.changes ? JSON.parse(r.changes as string) : null,
    }));
    return out;
  }

  // ---------- Routes ----------

  app.post('/api/visits', async (req, reply) => {
    const user = requirePerm(req, 'visit:create');
    const body = parse(createSchema, req.body);
    const result = tx(db, () => {
      if (!db.prepare('SELECT 1 FROM patients WHERE id = ?').get(body.patientId)) throw notFound('Patient');
      if (body.appointmentId !== undefined) {
        const appt = db.prepare('SELECT patient_id, status FROM appointments WHERE id = ?').get(body.appointmentId) as { patient_id: number; status: string } | undefined;
        if (!appt) throw notFound('Appointment');
        if (appt.patient_id !== body.patientId) throw badRequest('That appointment belongs to a different patient');
        const existing = db.prepare('SELECT id FROM visits WHERE appointment_id = ?').get(body.appointmentId) as { id: number } | undefined;
        if (existing) return { id: existing.id, created: false };
        if (appt.status !== 'waiting' && appt.status !== 'in_consultation') {
          throw badRequest('Check the patient in before opening a consultation');
        }
      }
      const now = nowIso();
      const r = db
        .prepare('INSERT INTO visits(patient_id, appointment_id, visit_at, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)')
        .run(body.patientId, body.appointmentId ?? null, now, user.id, now, now);
      const id = Number(r.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'visit.create', entity: 'visit', entityId: id, detail: { patientId: body.patientId, appointmentId: body.appointmentId ?? null } });
      return { id, created: true };
    });
    return reply.status(result.created ? 201 : 200).send(present(result.id));
  });

  app.get('/api/visits/:id', async (req) => {
    const user = requirePerm(req, 'visit:read');
    const id = idOf((req.params as { id: string }).id);
    const out = present(id);
    audit(db, { actorId: user.id, action: 'visit.view', entity: 'visit', entityId: id });
    return out;
  });

  app.get('/api/visits/:id/revisions/:no', async (req) => {
    const user = requirePerm(req, 'visit:read');
    const { id: rawId, no } = req.params as { id: string; no: string };
    const id = idOf(rawId);
    const r = db.prepare('SELECT revision_no, kind, at, reason, snapshot FROM visit_revisions WHERE visit_id = ? AND revision_no = ?').get(id, Number(no)) as Row | undefined;
    if (!r) throw notFound('Revision');
    audit(db, { actorId: user.id, action: 'visit.view_revision', entity: 'visit', entityId: id, detail: { revisionNo: r.revision_no } });
    return { ...camelize(r), snapshot: JSON.parse(r.snapshot as string) };
  });

  app.patch('/api/visits/:id', async (req) => {
    const user = requirePerm(req, 'visit:write');
    const id = idOf((req.params as { id: string }).id);
    const { version, ...content } = parse(patchSchema, req.body);
    tx(db, () => {
      const v = getRow(id);
      if (!v) throw notFound('Visit');
      if (v.status !== 'draft') throw badRequest('This consultation is finalised. Use "Amend" to record a correction with a reason.');
      if (v.version !== version) throw conflict('This consultation was changed by someone else. Reload it and try again.', { currentVersion: v.version });
      const changes = applyContent(id, content);
      if (Object.keys(changes).length) audit(db, { actorId: user.id, action: 'visit.update', entity: 'visit', entityId: id, detail: { fields: Object.keys(changes) } });
    });
    return present(id);
  });

  app.post('/api/visits/:id/vitals', async (req, reply) => {
    const user = requirePerm(req, 'vitals:write');
    const id = idOf((req.params as { id: string }).id);
    const b = parse(vitalsSchema, req.body);
    const hasValue = [b.systolicMmhg, b.diastolicMmhg, b.pulseBpm, b.temperatureC, b.weightKg, b.heightCm].some((x) => x != null);
    if (!hasValue) throw badRequest('Enter at least one measurement');
    if ((b.systolicMmhg == null) !== (b.diastolicMmhg == null)) throw badRequest('Enter both systolic and diastolic blood pressure', [{ field: 'diastolicMmhg', message: 'Blood pressure needs both values' }]);
    if (b.systolicMmhg != null && b.diastolicMmhg != null && b.systolicMmhg <= b.diastolicMmhg) {
      throw badRequest('Systolic pressure must be higher than diastolic', [{ field: 'systolicMmhg', message: 'Must be higher than diastolic' }]);
    }
    tx(db, () => {
      const v = getRow(id);
      if (!v) throw notFound('Visit');
      if (v.status !== 'draft') throw badRequest('This consultation is finalised; vitals can no longer be added');
      const r = db
        .prepare(
          `INSERT INTO visit_vitals(visit_id, recorded_at, recorded_by, systolic_mmhg, diastolic_mmhg, pulse_bpm, temperature_c, weight_kg, height_cm, note)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(id, nowIso(), user.id, b.systolicMmhg ?? null, b.diastolicMmhg ?? null, b.pulseBpm ?? null, round1(b.temperatureC), round1(b.weightKg), round1(b.heightCm), b.note ?? null);
      audit(db, { actorId: user.id, action: 'visit.vitals', entity: 'visit', entityId: id, detail: { vitalsId: Number(r.lastInsertRowid) } });
    });
    return reply.status(201).send(present(id));
  });

  app.post('/api/visits/:id/finalise', async (req) => {
    const user = requirePerm(req, 'visit:finalise');
    const id = idOf((req.params as { id: string }).id);
    const { version } = parse(finaliseSchema, req.body);
    tx(db, () => {
      const v = getRow(id);
      if (!v) throw notFound('Visit');
      if (v.status !== 'draft') throw badRequest('This consultation is already finalised');
      if (v.version !== version) throw conflict('This consultation was changed by someone else. Reload it and try again.', { currentVersion: v.version });
      if (!v.complaints && !v.assessment) throw badRequest('Record the presenting complaints or the assessment before finalising');
      const now = nowIso();
      db.prepare("UPDATE visits SET status = 'final', finalised_at = ?, finalised_by = ?, version = version + 1, updated_at = ? WHERE id = ?").run(now, user.id, now, id);
      db.prepare('INSERT INTO visit_revisions(visit_id, revision_no, kind, author_id, at, snapshot) VALUES (?,?,?,?,?,?)').run(id, 1, 'final', user.id, now, JSON.stringify(snapshotOf(id)));
      audit(db, { actorId: user.id, action: 'visit.finalise', entity: 'visit', entityId: id });
      // Finalising the consultation completes the linked appointment.
      const apptId = v.appointment_id as number | null;
      if (apptId) {
        const r = db.prepare("UPDATE appointments SET status = 'completed', version = version + 1, updated_at = ? WHERE id = ? AND status = 'in_consultation'").run(now, apptId);
        if (r.changes === 1) audit(db, { actorId: user.id, action: 'appointment.status', entity: 'appointment', entityId: apptId, detail: { from: 'in_consultation', to: 'completed', via: 'visit.finalise' } });
      }
    });
    return present(id);
  });

  app.post('/api/visits/:id/amend', async (req) => {
    const user = requirePerm(req, 'visit:finalise');
    const id = idOf((req.params as { id: string }).id);
    const { version, reason, ...content } = parse(amendSchema, req.body);
    tx(db, () => {
      const v = getRow(id);
      if (!v) throw notFound('Visit');
      if (v.status !== 'final') throw badRequest('Only a finalised consultation is amended; edit a draft directly');
      if (v.version !== version) throw conflict('This consultation was changed by someone else. Reload it and try again.', { currentVersion: v.version });
      const changes = applyContent(id, content);
      if (Object.keys(changes).length === 0) throw badRequest('Nothing was changed');
      const next = (db.prepare('SELECT MAX(revision_no) AS n FROM visit_revisions WHERE visit_id = ?').get(id) as { n: number }).n + 1;
      db.prepare('INSERT INTO visit_revisions(visit_id, revision_no, kind, author_id, at, reason, changes, snapshot) VALUES (?,?,?,?,?,?,?,?)').run(
        id, next, 'amendment', user.id, nowIso(), reason, JSON.stringify(changes), JSON.stringify(snapshotOf(id)),
      );
      audit(db, { actorId: user.id, action: 'visit.amend', entity: 'visit', entityId: id, detail: { revisionNo: next, reason, fields: Object.keys(changes) } });
    });
    return present(id);
  });

  app.get('/api/patients/:id/visits', async (req) => {
    requirePerm(req, 'visit:read');
    const pid = Number((req.params as { id: string }).id);
    if (!Number.isInteger(pid) || pid < 1) throw notFound('Patient');
    const rows = db
      .prepare(
        `SELECT v.id, v.visit_at, v.status, v.assessment, v.complaints,
                (SELECT COUNT(*) FROM visit_revisions r WHERE r.visit_id = v.id AND r.kind = 'amendment') AS amendments
           FROM visits v WHERE v.patient_id = ? ORDER BY v.visit_at DESC, v.id DESC`,
      )
      .all(pid) as Row[];
    return rows.map((r) => ({ ...camelize(r), visitDate: localDate(new Date(r.visit_at as string), cfg.timezone) }));
  });
}
