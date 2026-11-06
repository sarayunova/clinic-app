import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit, diff } from '../audit.js';
import { badRequest, conflict, forbidden, notFound, parse } from '../errors.js';
import { can, type Role } from '../permissions.js';
import { isRealDate, localDate, localTime, localToUtcIso, nowIso } from '../time.js';
import { camelize, toSnake } from '../util.js';
import { measure, round1 } from '../validation.js';
import { ageYears } from './patients.js';
import { medicinesOf } from './medicines.js';
import { dischargeOf } from './discharge.js';
import { intervalHoursOf, doseState } from './station.js';

const date = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');
const text = (max: number) => z.string().trim().max(max).transform((s) => (s === '' ? null : s)).nullable();

// ---------- Schemas ----------

const bedCreate = z.object({ room: z.string().trim().min(1).max(40), label: z.string().trim().min(1).max(40) }).strict();
const bedPatch = z.object({ active: z.boolean() }).strict();

const admitSchema = z
  .object({
    patientId: z.number().int().min(1),
    bedId: z.number().int().min(1),
    reason: z.string().trim().min(2, 'Reason for admission is required').max(500),
    diagnosis: text(1000).optional(),
    initialAssessment: text(4000).optional(),
    treatmentPlan: text(4000).optional(),
    expectedDischargeDate: date.nullable().optional(),
    admittedDate: date.optional(),
    admittedTime: clock.optional(),
  })
  .strict();
const admissionPatch = z
  .object({
    version: z.number().int().min(1),
    reason: z.string().trim().min(2).max(500).optional(),
    diagnosis: text(1000).optional(),
    initialAssessment: text(4000).optional(),
    treatmentPlan: text(4000).optional(),
    expectedDischargeDate: date.nullable().optional(),
  })
  .strict();
const dischargePlanSchema = z
  .object({
    expectedDischargeDate: date.nullable().optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict();
const transferSchema = z
  .object({
    toBedId: z.number().int().min(1),
    reason: z.string().trim().min(2, 'Give a reason for the move').max(300),
    transferDate: date.optional(),
    transferTime: clock.optional(),
    version: z.number().int().min(1),
  })
  .strict();
const listSchema = z.object({ status: z.enum(['admitted', 'discharged', 'all']).default('admitted') });

const ENTRY_TYPES = ['doctor_round', 'nursing_note', 'observation', 'procedure', 'investigation'] as const;
type EntryType = (typeof ENTRY_TYPES)[number];
const CLINICAL_TYPES: EntryType[] = ['doctor_round', 'procedure', 'investigation'];
const NURSING_TYPES: EntryType[] = ['nursing_note', 'observation'];

const entryFields = {
  content: text(4000).optional(),
  systolicMmhg: measure(40, 300, true),
  diastolicMmhg: measure(20, 200, true),
  pulseBpm: measure(20, 250, true),
  temperatureC: measure(30, 45),
  spo2Pct: measure(50, 100, true),
  respRate: measure(4, 80, true),
};
const entrySchema = z
  .object({ type: z.enum(ENTRY_TYPES), ...entryFields, clinicalDate: date.optional(), clinicalTime: clock.optional() })
  .strict();
const correctionSchema = z
  .object({ ...entryFields, reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500) })
  .strict();
const MEASURES = ['systolicMmhg', 'diastolicMmhg', 'pulseBpm', 'temperatureC', 'spo2Pct', 'respRate'] as const;

type Row = Record<string, unknown>;

/** Clinic-local date+time (or "now" if both blank) to a UTC instant; never in the future. */
export function makeInstant(tz: string) {
  return function instant(d: string | undefined, t: string | undefined, label: string, dateField: string): string {
    if ((d === undefined) !== (t === undefined)) {
      throw badRequest(`Enter both the ${label} date and time, or leave both blank`, [{ field: dateField, message: 'Enter both date and time' }]);
    }
    if (d === undefined || t === undefined) return nowIso();
    const iso = localToUtcIso(d, t, tz);
    if (!iso) throw badRequest('That date and time do not exist', [{ field: dateField, message: 'Not a real date and time' }]);
    if (Date.parse(iso) > Date.now() + 5 * 60_000) {
      throw badRequest(`The ${label} time cannot be in the future`, [{ field: dateField, message: 'Cannot be in the future' }]);
    }
    return iso;
  };
}


export function registerIpdRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const tz = cfg.timezone;
  const idOf = (raw: unknown, what: string) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) throw notFound(what);
    return id;
  };

  const instant = makeInstant(tz);

  const dayNumber = (admittedAtIso: string) => {
    const a = Date.parse(localDate(new Date(admittedAtIso), tz));
    const t = Date.parse(localDate(new Date(), tz));
    return Math.max(1, Math.round((t - a) / 86_400_000) + 1);
  };

  // ---------- Beds and ward board ----------

  app.get('/api/beds', async (req) => {
    const user = requirePerm(req, 'ipd:read_basic');
    const canClinical = can(user.role, 'ipd:read');

    const rows = db
      .prepare(
        `SELECT b.id, b.room, b.label, b.active,
                a.id AS admission_id, a.admission_number, a.admitted_at,
                a.version AS admission_version, a.reason AS admission_reason, a.diagnosis AS admission_diagnosis, a.expected_discharge_date,
                p.id AS patient_id, p.full_name AS patient_name, p.patient_number, p.allergy_status, p.allergy_details,
                p.date_of_birth, p.estimated_age_years
           FROM beds b
           LEFT JOIN admissions a ON a.bed_id = b.id AND a.status = 'admitted'
           LEFT JOIN patients p ON p.id = a.patient_id
          ORDER BY b.room COLLATE NOCASE, b.label COLLATE NOCASE`,
      )
      .all() as Row[];

    const now = new Date();
    const nowStamp = nowIso();

    const lastObsStmt = canClinical
      ? db.prepare(
          `SELECT c.clinical_at, c.systolic_mmhg, c.diastolic_mmhg, c.pulse_bpm, c.temperature_c, c.spo2_pct, c.resp_rate
             FROM care_entries c
            WHERE c.admission_id = ? AND c.entry_type = 'observation'
              AND NOT EXISTS (SELECT 1 FROM care_entries x WHERE x.corrects_id = c.id)
            ORDER BY c.clinical_at DESC, c.id DESC LIMIT 1`,
        )
      : null;

    const activePartographStmt = canClinical
      ? db.prepare(
          `SELECT id, partograph_number, status, start_time
             FROM partographs
            WHERE admission_id = ? AND status = 'active'
            ORDER BY start_time DESC, id DESC LIMIT 1`,
        )
      : null;

    const activeOrdersStmt = canClinical
      ? db.prepare(
          `SELECT id, frequency, start_at FROM medicine_orders
            WHERE admission_id = ? AND (stopped_at IS NULL OR stopped_at > ?)`,
        )
      : null;

    const lastMedRecordStmt = canClinical
      ? db.prepare(
          `SELECT given_at FROM medication_records r
            WHERE r.order_id = ? AND NOT EXISTS (SELECT 1 FROM medication_records x WHERE x.corrects_id = r.id)
            ORDER BY r.given_at DESC, r.id DESC LIMIT 1`,
        )
      : null;

    return rows.map((r) => {
      const o: Record<string, unknown> = {
        id: r.id,
        room: r.room,
        label: r.label,
        active: r.active === 1,
        occupied: r.admission_id != null,
        admissionId: r.admission_id ?? null,
        admissionNumber: r.admission_number ?? null,
        patientId: r.patient_id ?? null,
        patientName: r.patient_name ?? null,
        patientNumber: r.patient_number ?? null,
        allergyStatus: r.allergy_status ?? null,
        allergyDetails: r.allergy_details ?? null,
      };

      if (r.admission_id != null) {
        o.admissionId = r.admission_id;
        o.admissionNumber = r.admission_number;
        o.admittedAt = r.admitted_at;
        o.patientId = r.patient_id;
        o.patientName = r.patient_name;
        o.patientNumber = r.patient_number;
        o.allergyStatus = r.allergy_status;
        o.allergyDetails = r.allergy_details;
        if (r.admitted_at) {
          o.dayNumber = dayNumber(r.admitted_at as string);
          o.admittedDate = localDate(new Date(r.admitted_at as string), tz);
          o.admittedTime = localTime(r.admitted_at as string, tz);
        }

        const dob = r.date_of_birth as string | null;
        o.patientAgeYears = dob ? ageYears(dob, localDate(new Date(), tz)) : (r.estimated_age_years as number | null);
        o.expectedDischargeDate = r.expected_discharge_date ?? null;

        if (canClinical) {
          o.admissionVersion = r.admission_version;
          o.admissionReason = r.admission_reason;
          o.admissionDiagnosis = r.admission_diagnosis;

          const obs = lastObsStmt?.get(r.admission_id as number) as Row | undefined;
          o.lastObservation = obs
            ? {
                ...camelize(obs),
                date: localDate(new Date(obs.clinical_at as string), tz),
                time: localTime(obs.clinical_at as string, tz),
              }
            : null;

          const partograph = activePartographStmt?.get(r.admission_id as number) as Row | undefined;
          o.activeLaborPartograph = partograph ? camelize(partograph) : null;

          if (activeOrdersStmt && lastMedRecordStmt) {
            const orders = activeOrdersStmt.all(r.admission_id as number, nowStamp) as Row[];
            let dueCount = 0;
            for (const ord of orders) {
              const rec = lastMedRecordStmt.get(ord.id as number) as { given_at: string } | undefined;
              const intervalHours = intervalHoursOf(ord.frequency as string);
              const st = doseState({ intervalHours, startAt: ord.start_at as string, lastAt: rec?.given_at ?? null, now });
              if (st === 'may_be_due') dueCount++;
            }
            o.mayBeDueCount = dueCount;
          }
        }
      }
      return o;
    });
  });

  app.post('/api/beds', async (req, reply) => {
    const user = requirePerm(req, 'bed:manage');
    const body = parse(bedCreate, req.body);
    const id = tx(db, () => {
      if (db.prepare('SELECT 1 FROM beds WHERE room = ? COLLATE NOCASE AND label = ? COLLATE NOCASE').get(body.room, body.label)) {
        throw conflict('That room already has a bed with this label');
      }
      const r = db.prepare('INSERT INTO beds(room, label, created_at) VALUES (?,?,?)').run(body.room, body.label, nowIso());
      const bid = Number(r.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'bed.create', entity: 'bed', entityId: bid, detail: body });
      return bid;
    });
    return reply.status(201).send({ id, ...body, active: true });
  });

  app.patch('/api/beds/:id', async (req) => {
    const user = requirePerm(req, 'bed:manage');
    const id = idOf((req.params as { id: string }).id, 'Bed');
    const body = parse(bedPatch, req.body);
    return tx(db, () => {
      const bed = db.prepare('SELECT id, active FROM beds WHERE id = ?').get(id) as { id: number; active: number } | undefined;
      if (!bed) throw notFound('Bed');
      if (!body.active && db.prepare("SELECT 1 FROM admissions WHERE bed_id = ? AND status = 'admitted'").get(id)) {
        throw conflict('This bed is occupied. Discharge the patient before taking it out of use.');
      }
      db.prepare('UPDATE beds SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id);
      audit(db, { actorId: user.id, action: body.active ? 'bed.activate' : 'bed.deactivate', entity: 'bed', entityId: id });
      return { id, active: body.active };
    });
  });

  // ---------- Admissions ----------

  const ADMISSION_SELECT = `
    SELECT a.*, p.patient_number, p.full_name AS patient_name, p.date_of_birth, p.estimated_age_years,
           p.allergy_status, p.allergy_details, p.last_menstrual_period, p.gravida, p.para, p.abortions, p.living, b.room AS bed_room, b.label AS bed_label, cu.full_name AS created_by_name
      FROM admissions a JOIN patients p ON p.id = a.patient_id JOIN beds b ON b.id = a.bed_id
      LEFT JOIN users cu ON cu.id = a.created_by`;
  const BASIC_KEYS = new Set([
    'id', 'admissionNumber', 'patientId', 'patientNumber', 'patientName', 'ageYears', 'ageIsEstimated', 'allergyStatus', 'allergyDetails',
    'bedId', 'bedRoom', 'bedLabel', 'admittedAt', 'admittedDate', 'admittedTime', 'dayNumber', 'status', 'dischargedAt', 'version',
    'expectedDischargeDate',
  ]);

  function presentRow(row: Row, role: Role) {
    const o = camelize(row);
    const dob = o.dateOfBirth as string | null;
    o.ageYears = dob ? ageYears(dob, localDate(new Date(), tz)) : (o.estimatedAgeYears as number | null);
    o.ageIsEstimated = !dob && o.estimatedAgeYears != null;
    o.admittedDate = localDate(new Date(o.admittedAt as string), tz);
    o.admittedTime = localTime(o.admittedAt as string, tz);
    o.dayNumber = o.status === 'admitted' ? dayNumber(o.admittedAt as string) : null;
    if (o.dischargedAt) {
      o.dischargedDate = localDate(new Date(o.dischargedAt as string), tz);
      o.dischargedTime = localTime(o.dischargedAt as string, tz);
    }
    if (can(role, 'ipd:read')) return o;
    return Object.fromEntries(Object.entries(o).filter(([k]) => BASIC_KEYS.has(k) || k === 'dischargedDate' || k === 'dischargedTime'));
  }

  function entriesOf(admissionId: number, user: { id: number; role: Role }) {
    const rows = db
      .prepare(
        `SELECT e.*, u.full_name AS author_name FROM care_entries e JOIN users u ON u.id = e.author_id
          WHERE e.admission_id = ? ORDER BY e.clinical_at, e.id`,
      )
      .all(admissionId) as Row[];
    const shape = (r: Row) => {
      const o = camelize(r);
      o.clinicalDate = localDate(new Date(r.clinical_at as string), tz);
      o.clinicalTime = localTime(r.clinical_at as string, tz);
      o.createdDate = localDate(new Date(r.created_at as string), tz);
      o.createdTime = localTime(r.created_at as string, tz);
      return o;
    };
    type Shaped = Record<string, unknown> & { corrections: Record<string, unknown>[] };
    const originals: Shaped[] = rows.filter((r) => r.corrects_id == null).map((r) => ({ ...shape(r), corrections: [] }));
    const byId = new Map<number, Shaped>(originals.map((o) => [o.id as number, o]));
    for (const r of rows.filter((x) => x.corrects_id != null)) byId.get(r.corrects_id as number)?.corrections.push(shape(r));
    for (const o of originals) {
      const type = o.entryType as EntryType;
      o.canCorrect = can(user.role, 'care:write_clinical') || (NURSING_TYPES.includes(type) && can(user.role, 'care:write_nursing') && o.authorId === user.id);
    }
    return originals;
  }

  /** Every move of this admission, oldest first, with the beds' names as they are now. */
  function transfersOf(admissionId: number) {
    return (
      db
        .prepare(
          `SELECT t.id, t.transferred_at, t.reason, u.full_name AS by_name, f.room AS from_room, f.label AS from_label, d.room AS to_room, d.label AS to_label
             FROM bed_transfers t JOIN users u ON u.id = t.transferred_by JOIN beds f ON f.id = t.from_bed_id JOIN beds d ON d.id = t.to_bed_id
            WHERE t.admission_id = ? ORDER BY t.transferred_at, t.id`,
        )
        .all(admissionId) as Row[]
    ).map((r) => ({
      ...camelize(r),
      date: localDate(new Date(r.transferred_at as string), tz),
      time: localTime(r.transferred_at as string, tz),
    }));
  }

  function present(id: number, user: { id: number; role: Role }) {
    const row = db.prepare(`${ADMISSION_SELECT} WHERE a.id = ?`).get(id) as Row | undefined;
    if (!row) throw notFound('Admission');
    const out = presentRow(row, user.role);
    if (can(user.role, 'ipd:read')) {
      out.entries = entriesOf(id, user);
      out.transfers = transfersOf(id);
      out.orders = medicinesOf(db, tz, id, user);
      out.discharge = dischargeOf(db, tz, id);
    }
    return out;
  }

  app.post('/api/admissions', async (req, reply) => {
    const user = requirePerm(req, 'admission:create');
    const body = parse(admitSchema, req.body);
    const admittedAt = instant(body.admittedDate, body.admittedTime, 'admission', 'admittedDate');
    const id = tx(db, () => {
      if (!db.prepare('SELECT 1 FROM patients WHERE id = ?').get(body.patientId)) throw notFound('Patient');
      const bed = db.prepare('SELECT active, room, label FROM beds WHERE id = ?').get(body.bedId) as { active: number; room: string; label: string } | undefined;
      if (!bed) throw notFound('Bed');
      if (!bed.active) throw badRequest('That bed is not in use');
      if (db.prepare("SELECT 1 FROM admissions WHERE bed_id = ? AND status = 'admitted'").get(body.bedId)) {
        throw conflict(`Bed ${bed.room} / ${bed.label} is already occupied`);
      }
      const current = db
        .prepare("SELECT a.admission_number, b.room, b.label FROM admissions a JOIN beds b ON b.id = a.bed_id WHERE a.patient_id = ? AND a.status = 'admitted'")
        .get(body.patientId) as { admission_number: string; room: string; label: string } | undefined;
      if (current) throw conflict(`This patient is already admitted (${current.admission_number}, ${current.room} / ${current.label})`);

      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'admission'").run();
      const n = (db.prepare("SELECT value FROM counters WHERE name = 'admission'").get() as { value: number }).value;
      const number = 'A' + String(n).padStart(6, '0');
      const now = nowIso();
      const r = db
        .prepare(
          `INSERT INTO admissions(admission_number, patient_id, bed_id, admitted_at, reason, diagnosis, initial_assessment, treatment_plan, expected_discharge_date, created_by, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          number,
          body.patientId,
          body.bedId,
          admittedAt,
          body.reason,
          body.diagnosis ?? null,
          body.initialAssessment ?? null,
          body.treatmentPlan ?? null,
          body.expectedDischargeDate ?? null,
          user.id,
          now,
          now,
        );
      const aid = Number(r.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'admission.create', entity: 'admission', entityId: aid, detail: { number, patientId: body.patientId, bedId: body.bedId } });
      return aid;
    });
    return reply.status(201).send(present(id, user));
  });

  app.get('/api/admissions', async (req) => {
    const user = requirePerm(req, 'ipd:read_basic');
    const { status } = parse(listSchema, req.query);
    const rows = db
      .prepare(`${ADMISSION_SELECT} ${status === 'all' ? '' : 'WHERE a.status = ?'} ORDER BY a.admitted_at DESC, a.id DESC LIMIT 200`)
      .all(...(status === 'all' ? [] : [status])) as Row[];
    return rows.map((r) => presentRow(r, user.role));
  });

  app.get('/api/admissions/:id', async (req) => {
    const user = requirePerm(req, 'ipd:read_basic');
    const id = idOf((req.params as { id: string }).id, 'Admission');
    const out = present(id, user);
    if (can(user.role, 'ipd:read')) audit(db, { actorId: user.id, action: 'admission.view', entity: 'admission', entityId: id });
    return out;
  });

  app.get('/api/patients/:id/admissions', async (req) => {
    const user = requirePerm(req, 'ipd:read_basic');
    const pid = idOf((req.params as { id: string }).id, 'Patient');
    const rows = db.prepare(`${ADMISSION_SELECT} WHERE a.patient_id = ? ORDER BY a.admitted_at DESC, a.id DESC`).all(pid) as Row[];
    return rows.map((r) => presentRow(r, user.role));
  });

  app.patch('/api/admissions/:id', async (req) => {
    const user = requirePerm(req, 'admission:write');
    const id = idOf((req.params as { id: string }).id, 'Admission');
    const { version, ...changes } = parse(admissionPatch, req.body);
    tx(db, () => {
      const cur = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id) as Row | undefined;
      if (!cur) throw notFound('Admission');
      if (cur.status !== 'admitted') throw badRequest('This admission has ended');
      if (cur.version !== version) throw conflict('This admission was changed by someone else. Reload it and try again.', { currentVersion: cur.version });
      const keys = (Object.keys(changes) as (keyof typeof changes)[]).filter((k) => (changes[k] ?? null) !== (cur[toSnake(k)] ?? null));
      if (!keys.length) return;
      const detail = diff(
        Object.fromEntries(keys.map((k) => [k, cur[toSnake(k)]])),
        Object.fromEntries(keys.map((k) => [k, changes[k]])),
      );
      db.prepare(`UPDATE admissions SET ${keys.map((k) => `${toSnake(k)} = ?`).join(', ')}, version = version + 1, updated_at = ? WHERE id = ?`).run(
        ...keys.map((k) => changes[k] as string | null), nowIso(), id,
      );
      audit(db, { actorId: user.id, action: 'admission.update', entity: 'admission', entityId: id, detail });
    });
    return present(id, user);
  });

  app.patch('/api/admissions/:id/discharge-plan', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'admission:write') && !can(user.role, 'care:write_nursing') && !can(user.role, 'discharge:write')) {
      throw forbidden('Only clinical staff can update the expected discharge plan');
    }
    const id = idOf((req.params as { id: string }).id, 'Admission');
    const body = parse(dischargePlanSchema, req.body);
    tx(db, () => {
      const cur = db.prepare('SELECT id, status, version, expected_discharge_date FROM admissions WHERE id = ?').get(id) as
        | { id: number; status: string; version: number; expected_discharge_date: string | null }
        | undefined;
      if (!cur) throw notFound('Admission');
      if (cur.status !== 'admitted') throw badRequest('This admission has ended');
      if (body.version != null && cur.version !== body.version) {
        throw conflict('This admission was changed by someone else. Reload it and try again.', { currentVersion: cur.version });
      }
      const nextVal = body.expectedDischargeDate ?? null;
      if (nextVal !== cur.expected_discharge_date) {
        const detail = diff(
          { expectedDischargeDate: cur.expected_discharge_date },
          { expectedDischargeDate: nextVal },
        );
        db.prepare('UPDATE admissions SET expected_discharge_date = ?, version = version + 1, updated_at = ? WHERE id = ?').run(
          nextVal,
          nowIso(),
          id,
        );
        audit(db, { actorId: user.id, action: 'admission.update', entity: 'admission', entityId: id, detail });
      }
    });
    return present(id, user);
  });

  app.post('/api/admissions/:id/transfer', async (req) => {
    const user = requirePerm(req, 'bed:transfer');
    const id = idOf((req.params as { id: string }).id, 'Admission');
    const b = parse(transferSchema, req.body);
    const at = instant(b.transferDate, b.transferTime, 'transfer', 'transferDate');
    tx(db, () => {
      const cur = db.prepare('SELECT status, version, bed_id, admitted_at FROM admissions WHERE id = ?').get(id) as
        | { status: string; version: number; bed_id: number; admitted_at: string }
        | undefined;
      if (!cur) throw notFound('Admission');
      if (cur.status !== 'admitted') throw badRequest('This patient has been discharged; they can no longer be moved');
      if (cur.version !== b.version) throw conflict('This admission was changed by someone else. Reload it and try again.', { currentVersion: cur.version });
      if (b.toBedId === cur.bed_id) throw badRequest('The patient is already in that bed', [{ field: 'toBedId', message: 'Already in this bed' }]);
      const to = db.prepare('SELECT active, room, label FROM beds WHERE id = ?').get(b.toBedId) as { active: number; room: string; label: string } | undefined;
      if (!to) throw notFound('Bed');
      if (!to.active) throw badRequest('That bed is not in use', [{ field: 'toBedId', message: 'Bed is not in use' }]);
      if (db.prepare("SELECT 1 FROM admissions WHERE bed_id = ? AND status = 'admitted'").get(b.toBedId)) {
        throw conflict(`Bed ${to.room} / ${to.label} is already occupied`);
      }
      const last = (db.prepare('SELECT MAX(transferred_at) AS t FROM bed_transfers WHERE admission_id = ?').get(id) as { t: string | null }).t;
      const earliest = last && last > cur.admitted_at ? last : cur.admitted_at;
      if (at < earliest) {
        throw badRequest(last ? 'The move cannot be earlier than the previous move' : 'The move cannot be earlier than the admission', [
          { field: 'transferDate', message: 'Too early' },
        ]);
      }
      const from = db.prepare('SELECT room, label FROM beds WHERE id = ?').get(cur.bed_id) as { room: string; label: string };
      const now = nowIso();
      db.prepare('INSERT INTO bed_transfers(admission_id, from_bed_id, to_bed_id, transferred_at, reason, transferred_by, created_at) VALUES (?,?,?,?,?,?,?)').run(
        id, cur.bed_id, b.toBedId, at, b.reason, user.id, now,
      );
      db.prepare('UPDATE admissions SET bed_id = ?, version = version + 1, updated_at = ? WHERE id = ?').run(b.toBedId, now, id);
      audit(db, {
        actorId: user.id,
        action: 'admission.transfer',
        entity: 'admission',
        entityId: id,
        detail: { bed: { from: `${from.room} / ${from.label}`, to: `${to.room} / ${to.label}` }, reason: b.reason, at },
      });
    });
    return present(id, user);
  });

  // ---------- Care entries ----------

  /** Checks measurement combinations shared by new entries and corrections. */
  function checkEntryContent(type: EntryType, b: Partial<Record<(typeof MEASURES)[number], number | null>> & { content?: string | null }) {
    const hasMeasure = MEASURES.some((m) => b[m] != null);
    if (hasMeasure && type !== 'observation') throw badRequest('Measurements can only be recorded on an observation entry');
    if ((b.systolicMmhg == null) !== (b.diastolicMmhg == null)) {
      throw badRequest('Enter both systolic and diastolic blood pressure', [{ field: 'diastolicMmhg', message: 'Blood pressure needs both values' }]);
    }
    if (b.systolicMmhg != null && b.diastolicMmhg != null && b.systolicMmhg <= b.diastolicMmhg) {
      throw badRequest('Systolic pressure must be higher than diastolic', [{ field: 'systolicMmhg', message: 'Must be higher than diastolic' }]);
    }
    if (type === 'observation' ? !hasMeasure && !b.content : !b.content) {
      throw badRequest(type === 'observation' ? 'Enter at least one measurement or a note' : 'Write the entry text', [{ field: 'content', message: 'Required' }]);
    }
  }

  const insertEntry = (admissionId: number, type: EntryType, clinicalAt: string, authorId: number, b: Record<string, unknown>, corrects?: { id: number; reason: string }) =>
    db
      .prepare(
        `INSERT INTO care_entries(admission_id, entry_type, clinical_at, created_at, author_id, content, systolic_mmhg, diastolic_mmhg, pulse_bpm,
                                  temperature_c, spo2_pct, resp_rate, corrects_id, correction_reason)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        admissionId, type, clinicalAt, nowIso(), authorId, (b.content as string | null) ?? null,
        (b.systolicMmhg as number | null) ?? null, (b.diastolicMmhg as number | null) ?? null, (b.pulseBpm as number | null) ?? null,
        round1(b.temperatureC as number | null), (b.spo2Pct as number | null) ?? null, (b.respRate as number | null) ?? null,
        corrects?.id ?? null, corrects?.reason ?? null,
      );

  app.post('/api/admissions/:id/entries', async (req, reply) => {
    const user = requireUser(req);
    const id = idOf((req.params as { id: string }).id, 'Admission');
    const b = parse(entrySchema, req.body);
    const needed = CLINICAL_TYPES.includes(b.type) ? 'care:write_clinical' : 'care:write_nursing';
    if (!can(user.role, needed)) throw forbidden(CLINICAL_TYPES.includes(b.type) ? 'Only the doctor can add this type of entry' : undefined);
    checkEntryContent(b.type, b);
    const clinicalAt = instant(b.clinicalDate, b.clinicalTime, 'entry', 'clinicalDate');
    tx(db, () => {
      const adm = db.prepare('SELECT status, admitted_at FROM admissions WHERE id = ?').get(id) as { status: string; admitted_at: string } | undefined;
      if (!adm) throw notFound('Admission');
      if (adm.status !== 'admitted') throw badRequest('This patient has been discharged; new entries cannot be added');
      if (clinicalAt < adm.admitted_at) throw badRequest('An entry cannot be dated before the admission', [{ field: 'clinicalDate', message: 'Before the admission time' }]);
      const r = insertEntry(id, b.type, clinicalAt, user.id, b);
      audit(db, { actorId: user.id, action: 'care.add', entity: 'admission', entityId: id, detail: { entryId: Number(r.lastInsertRowid), type: b.type } });
    });
    return reply.status(201).send(present(id, user));
  });

  app.post('/api/admissions/:id/entries/:entryId/correct', async (req, reply) => {
    const user = requireUser(req);
    const params = req.params as { id: string; entryId: string };
    const id = idOf(params.id, 'Admission');
    const entryId = idOf(params.entryId, 'Entry');
    const { reason, ...b } = parse(correctionSchema, req.body);
    tx(db, () => {
      const orig = db.prepare('SELECT * FROM care_entries WHERE id = ? AND admission_id = ? AND corrects_id IS NULL').get(entryId, id) as Row | undefined;
      if (!orig) throw notFound('Entry');
      const type = orig.entry_type as EntryType;
      const isDoctor = can(user.role, 'care:write_clinical');
      const ownNursing = NURSING_TYPES.includes(type) && can(user.role, 'care:write_nursing') && orig.author_id === user.id;
      if (!isDoctor && !ownNursing) throw forbidden('You can correct your own nursing entries; the doctor can correct any entry');
      checkEntryContent(type, b);
      const r = insertEntry(id, type, orig.clinical_at as string, user.id, b, { id: entryId, reason });
      audit(db, { actorId: user.id, action: 'care.correct', entity: 'admission', entityId: id, detail: { entryId, correctionId: Number(r.lastInsertRowid), reason } });
    });
    return reply.status(201).send(present(id, user));
  });
}
