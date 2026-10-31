import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx, type DB } from '../db.js';
import { audit } from '../audit.js';
import { badRequest, forbidden, notFound, parse } from '../errors.js';
import { can, type Role } from '../permissions.js';
import { isRealDate, localDate, localTime, nowIso } from '../time.js';
import { camelize } from '../util.js';
import { makeInstant } from './ipd.js';

const date = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');
const text = (max: number) => z.string().trim().max(max).transform((s) => (s === '' ? null : s)).nullable();

const orderSchema = z
  .object({
    medicine: z.string().trim().min(1, 'Medicine name is required').max(200),
    strength: text(100).optional(),
    dose: z.string().trim().min(1, 'Dose is required').max(100),
    route: text(60).optional(),
    frequency: z.string().trim().min(1, 'Frequency is required').max(100),
    instructions: text(500).optional(),
    startDate: date.optional(),
    startTime: clock.optional(),
  })
  .strict();
const stopSchema = z
  .object({ reason: z.string().trim().min(3, 'Give a reason').max(500), stopDate: date.optional(), stopTime: clock.optional() })
  .strict();
const recordFields = {
  outcome: z.enum(['given', 'withheld', 'refused']),
  dose: text(100).optional(),
  reason: text(500).optional(),
  givenDate: date.optional(),
  givenTime: clock.optional(),
  scheduledDate: date.optional(),
  scheduledTime: clock.optional(),
};
const recordSchema = z.object(recordFields).strict();
const recordCorrection = z
  .object({ ...recordFields, correctionReason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500) })
  .strict();

type Row = Record<string, unknown>;
type OrderRow = { start_at: string; stopped_at: string | null; dose: string };
type RecordInput = z.infer<typeof recordSchema>;

/** Orders for an admission with their administration records (corrections nested). */
export function medicinesOf(db: DB, tz: string, admissionId: number, user: { id: number; role: Role }) {
  const when = (iso: string | null) => (iso ? { date: localDate(new Date(iso), tz), time: localTime(iso, tz) } : null);
  const orders = db
    .prepare(
      `SELECT o.*, u.full_name AS ordered_by_name, s.full_name AS stopped_by_name
         FROM medicine_orders o JOIN users u ON u.id = o.ordered_by LEFT JOIN users s ON s.id = o.stopped_by
        WHERE o.admission_id = ? ORDER BY o.start_at, o.id`,
    )
    .all(admissionId) as Row[];
  const recs = db
    .prepare(
      `SELECT r.*, u.full_name AS recorded_by_name FROM medication_records r
         JOIN users u ON u.id = r.recorded_by JOIN medicine_orders o ON o.id = r.order_id
        WHERE o.admission_id = ? ORDER BY r.given_at, r.id`,
    )
    .all(admissionId) as Row[];
  const shapeRec = (r: Row) => {
    const o = camelize(r);
    const g = when(r.given_at as string)!;
    o.givenDate = g.date;
    o.givenTime = g.time;
    const sc = when(r.scheduled_at as string | null);
    o.scheduledDate = sc?.date ?? null;
    o.scheduledTime = sc?.time ?? null;
    const c = when(r.created_at as string)!;
    o.createdDate = c.date;
    o.createdTime = c.time;
    return o;
  };
  return orders.map((r) => {
    const o = camelize(r);
    const s = when(r.start_at as string)!;
    o.startDate = s.date;
    o.startTime = s.time;
    const st = when(r.stopped_at as string | null);
    o.stoppedDate = st?.date ?? null;
    o.stoppedTime = st?.time ?? null;
    o.active = r.stopped_at == null;
    const mine = recs.filter((x) => x.order_id === r.id);
    type Shaped = Record<string, unknown> & { corrections: Record<string, unknown>[]; canCorrect: boolean };
    const originals: Shaped[] = mine
      .filter((x) => x.corrects_id == null)
      .map((x) => ({ ...shapeRec(x), corrections: [], canCorrect: false }));
    const byId = new Map(originals.map((x) => [x.id as number, x]));
    for (const c of mine.filter((x) => x.corrects_id != null)) byId.get(c.corrects_id as number)?.corrections.push(shapeRec(c));
    for (const x of originals) x.canCorrect = can(user.role, 'order:write') || (can(user.role, 'med:administer') && x.recordedBy === user.id);
    o.records = originals;
    return o;
  });
}

export function registerMedicineRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const instant = makeInstant(cfg.timezone);
  const num = (raw: unknown, what: string) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw notFound(what);
    return n;
  };
  const admissionOpen = (id: number) => {
    const a = db.prepare('SELECT status, admitted_at FROM admissions WHERE id = ?').get(id) as { status: string; admitted_at: string } | undefined;
    if (!a) throw notFound('Admission');
    if (a.status !== 'admitted') throw badRequest('This patient has been discharged; medicines can no longer be changed');
    return a;
  };
  const orderOf = (oid: number, aid: number) => {
    const o = db.prepare('SELECT start_at, stopped_at, dose FROM medicine_orders WHERE id = ? AND admission_id = ?').get(oid, aid) as OrderRow | undefined;
    if (!o) throw notFound('Order');
    return o;
  };

  app.post('/api/admissions/:id/orders', async (req, reply) => {
    const user = requirePerm(req, 'order:write');
    const aid = num((req.params as { id: string }).id, 'Admission');
    const b = parse(orderSchema, req.body);
    const startAt = instant(b.startDate, b.startTime, 'start', 'startDate');
    const id = tx(db, () => {
      const adm = admissionOpen(aid);
      if (startAt < adm.admitted_at) throw badRequest('A medicine cannot start before the admission', [{ field: 'startDate', message: 'Before the admission time' }]);
      const r = db
        .prepare(
          `INSERT INTO medicine_orders(admission_id, medicine, strength, dose, route, frequency, instructions, start_at, ordered_by, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(aid, b.medicine, b.strength ?? null, b.dose, b.route ?? null, b.frequency, b.instructions ?? null, startAt, user.id, nowIso());
      const oid = Number(r.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'order.create', entity: 'admission', entityId: aid, detail: { orderId: oid, medicine: b.medicine, dose: b.dose, frequency: b.frequency } });
      return oid;
    });
    return reply.status(201).send({ id });
  });

  app.post('/api/admissions/:id/orders/:orderId/stop', async (req) => {
    const user = requirePerm(req, 'order:write');
    const p = req.params as { id: string; orderId: string };
    const aid = num(p.id, 'Admission');
    const oid = num(p.orderId, 'Order');
    const b = parse(stopSchema, req.body);
    const at = instant(b.stopDate, b.stopTime, 'stop', 'stopDate');
    tx(db, () => {
      admissionOpen(aid);
      const o = orderOf(oid, aid);
      if (o.stopped_at) throw badRequest('This medicine has already been stopped');
      if (at < o.start_at) throw badRequest('It cannot be stopped before it started', [{ field: 'stopDate', message: 'Before the start time' }]);
      const last = db.prepare('SELECT MAX(given_at) AS m FROM medication_records WHERE order_id = ?').get(oid) as { m: string | null };
      if (last.m && at < last.m) throw badRequest('It cannot be stopped before a dose that was already recorded', [{ field: 'stopDate', message: 'Before the last recorded dose' }]);
      db.prepare('UPDATE medicine_orders SET stopped_at = ?, stopped_by = ?, stop_reason = ? WHERE id = ?').run(at, user.id, b.reason, oid);
      audit(db, { actorId: user.id, action: 'order.stop', entity: 'admission', entityId: aid, detail: { orderId: oid, reason: b.reason } });
    });
    return { id: oid, stopped: true };
  });

  /** Shared checks for a new record and for a correction. Returns the values to store. */
  function recordValues(b: RecordInput, order: OrderRow, admittedAt: string) {
    const givenAt = instant(b.givenDate, b.givenTime, 'administration', 'givenDate');
    if (givenAt < order.start_at || givenAt < admittedAt) throw badRequest('That is before the medicine was ordered to start', [{ field: 'givenDate', message: 'Before the start time' }]);
    if (order.stopped_at && givenAt > order.stopped_at) throw badRequest('That is after the medicine was stopped', [{ field: 'givenDate', message: 'After the stop time' }]);
    if ((b.scheduledDate === undefined) !== (b.scheduledTime === undefined)) {
      throw badRequest('Enter both the due date and time, or leave both blank', [{ field: 'scheduledDate', message: 'Enter both date and time' }]);
    }
    const scheduledAt = b.scheduledDate !== undefined && b.scheduledTime !== undefined ? instant(b.scheduledDate, b.scheduledTime, 'due', 'scheduledDate') : null;
    if (b.outcome === 'given') return { givenAt, scheduledAt, dose: b.dose ?? order.dose, reason: b.reason ?? null };
    if (!b.reason) throw badRequest('Say why it was not given', [{ field: 'reason', message: 'Required when not given' }]);
    return { givenAt, scheduledAt, dose: null, reason: b.reason };
  }

  const insertRecord = (
    orderId: number,
    outcome: string,
    v: { givenAt: string; scheduledAt: string | null; dose: string | null; reason: string | null },
    userId: number,
    corrects?: { id: number; reason: string },
  ) =>
    Number(
      db
        .prepare(
          `INSERT INTO medication_records(order_id, outcome, scheduled_at, given_at, dose_given, reason, recorded_by, created_at, corrects_id, correction_reason)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(orderId, outcome, v.scheduledAt, v.givenAt, v.dose, v.reason, userId, nowIso(), corrects?.id ?? null, corrects?.reason ?? null).lastInsertRowid,
    );

  app.post('/api/admissions/:id/orders/:orderId/records', async (req, reply) => {
    const user = requirePerm(req, 'med:administer');
    const p = req.params as { id: string; orderId: string };
    const aid = num(p.id, 'Admission');
    const oid = num(p.orderId, 'Order');
    const b = parse(recordSchema, req.body);
    const id = tx(db, () => {
      const adm = admissionOpen(aid);
      const rid = insertRecord(oid, b.outcome, recordValues(b, orderOf(oid, aid), adm.admitted_at), user.id);
      audit(db, { actorId: user.id, action: 'medication.record', entity: 'admission', entityId: aid, detail: { orderId: oid, recordId: rid, outcome: b.outcome } });
      return rid;
    });
    return reply.status(201).send({ id });
  });

  app.post('/api/admissions/:id/orders/:orderId/records/:recordId/correct', async (req, reply) => {
    const user = requirePerm(req, 'med:administer');
    const p = req.params as { id: string; orderId: string; recordId: string };
    const aid = num(p.id, 'Admission');
    const oid = num(p.orderId, 'Order');
    const rid = num(p.recordId, 'Record');
    const { correctionReason, ...b } = parse(recordCorrection, req.body);
    const id = tx(db, () => {
      const adm = admissionOpen(aid);
      const o = orderOf(oid, aid);
      const orig = db.prepare('SELECT recorded_by FROM medication_records WHERE id = ? AND order_id = ? AND corrects_id IS NULL').get(rid, oid) as { recorded_by: number } | undefined;
      if (!orig) throw notFound('Record');
      if (!can(user.role, 'order:write') && orig.recorded_by !== user.id) throw forbidden('You can correct your own records; the doctor can correct any record');
      const nid = insertRecord(oid, b.outcome, recordValues(b, o, adm.admitted_at), user.id, { id: rid, reason: correctionReason });
      audit(db, { actorId: user.id, action: 'medication.correct', entity: 'admission', entityId: aid, detail: { orderId: oid, recordId: rid, reason: correctionReason } });
      return nid;
    });
    return reply.status(201).send({ id });
  });
}
