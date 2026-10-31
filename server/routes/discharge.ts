import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx, type DB } from '../db.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse } from '../errors.js';
import { isRealDate, localDate, localTime, nowIso } from '../time.js';
import { camelize } from '../util.js';
import { makeInstant } from './ipd.js';

const date = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');
const text = (max: number) => z.string().trim().max(max).transform((s) => (s === '' ? null : s)).nullable();
const required = (what: string, max: number) => z.string().trim().min(2, `${what} is required`).max(max);

const dischargeSchema = z
  .object({
    finalDiagnosis: required('Final diagnosis', 1000),
    conditionAtDischarge: required('Condition at discharge', 1000),
    findings: text(4000).optional(),
    course: text(4000).optional(),
    procedures: text(4000).optional(),
    dischargeMedicines: text(4000).optional(),
    instructions: text(4000).optional(),
    warningSigns: text(4000).optional(),
    followUp: text(1000).optional(),
    dischargeDate: date.optional(),
    dischargeTime: clock.optional(),
  })
  .strict();
const addendumSchema = z
  .object({ content: required('Addendum text', 4000), reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500) })
  .strict();

type Row = Record<string, unknown>;

export function dischargeOf(db: DB, tz: string, admissionId: number) {
  const s = db
    .prepare('SELECT d.*, u.full_name AS written_by_name FROM discharge_summaries d JOIN users u ON u.id = d.written_by WHERE d.admission_id = ?')
    .get(admissionId) as Row | undefined;
  if (!s) return { summary: null, addenda: [] };
  const summary = camelize(s);
  summary.finalisedDate = localDate(new Date(s.finalised_at as string), tz);
  summary.finalisedTime = localTime(s.finalised_at as string, tz);
  const addenda = (
    db
      .prepare('SELECT a.*, u.full_name AS author_name FROM discharge_addenda a JOIN users u ON u.id = a.author_id WHERE a.admission_id = ? ORDER BY a.id')
      .all(admissionId) as Row[]
  ).map((r) => ({ ...camelize(r), createdDate: localDate(new Date(r.created_at as string), tz), createdTime: localTime(r.created_at as string, tz) }));
  return { summary, addenda };
}

export function registerDischargeRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const instant = makeInstant(cfg.timezone);
  const num = (raw: unknown) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw notFound('Admission');
    return n;
  };

  app.post('/api/admissions/:id/discharge', async (req, reply) => {
    const user = requirePerm(req, 'discharge:write');
    const aid = num((req.params as { id: string }).id);
    const { dischargeDate, dischargeTime, ...b } = parse(dischargeSchema, req.body);
    const at = instant(dischargeDate, dischargeTime, 'discharge', 'dischargeDate');
    tx(db, () => {
      const adm = db.prepare('SELECT status, admitted_at FROM admissions WHERE id = ?').get(aid) as { status: string; admitted_at: string } | undefined;
      if (!adm) throw notFound('Admission');
      if (adm.status !== 'admitted') throw badRequest('This patient has already been discharged');
      // Discharge cannot come before anything already on the record.
      const latest = db
        .prepare(
          `SELECT MAX(t) AS m FROM (
             SELECT MAX(clinical_at) AS t FROM care_entries WHERE admission_id = ?1
             UNION ALL SELECT MAX(start_at) FROM medicine_orders WHERE admission_id = ?1
             UNION ALL SELECT MAX(r.given_at) FROM medication_records r JOIN medicine_orders o ON o.id = r.order_id WHERE o.admission_id = ?1
             UNION ALL SELECT ?2)`,
        )
        .get(aid, adm.admitted_at) as { m: string };
      if (at < latest.m) {
        throw badRequest('The discharge time cannot be earlier than the admission or the latest entry on the record', [{ field: 'dischargeDate', message: 'Too early' }]);
      }
      const now = nowIso();
      db.prepare(
        `INSERT INTO discharge_summaries(admission_id, final_diagnosis, findings, course, procedures, condition_at_discharge, discharge_medicines,
                                         instructions, warning_signs, follow_up, written_by, finalised_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        aid, b.finalDiagnosis, b.findings ?? null, b.course ?? null, b.procedures ?? null, b.conditionAtDischarge, b.dischargeMedicines ?? null,
        b.instructions ?? null, b.warningSigns ?? null, b.followUp ?? null, user.id, now,
      );
      // Anything still running stops at discharge.
      db.prepare("UPDATE medicine_orders SET stopped_at = ?, stopped_by = ?, stop_reason = 'Discharged' WHERE admission_id = ? AND stopped_at IS NULL").run(at, user.id, aid);
      db.prepare("UPDATE admissions SET status = 'discharged', discharged_at = ?, version = version + 1, updated_at = ? WHERE id = ?").run(at, now, aid);
      audit(db, { actorId: user.id, action: 'admission.discharge', entity: 'admission', entityId: aid, detail: { dischargedAt: at } });
    });
    return reply.status(201).send({ id: aid, discharged: true });
  });

  app.post('/api/admissions/:id/addenda', async (req, reply) => {
    const user = requirePerm(req, 'discharge:write');
    const aid = num((req.params as { id: string }).id);
    const b = parse(addendumSchema, req.body);
    tx(db, () => {
      const adm = db.prepare('SELECT status FROM admissions WHERE id = ?').get(aid) as { status: string } | undefined;
      if (!adm) throw notFound('Admission');
      if (adm.status !== 'discharged') throw badRequest('Addenda can only be added after discharge');
      db.prepare('INSERT INTO discharge_addenda(admission_id, content, reason, author_id, created_at) VALUES (?,?,?,?,?)').run(aid, b.content, b.reason, user.id, nowIso());
      audit(db, { actorId: user.id, action: 'discharge.addendum', entity: 'admission', entityId: aid, detail: { reason: b.reason } });
    });
    return reply.status(201).send({ id: aid });
  });
}
