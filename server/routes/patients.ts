import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit, diff } from '../audit.js';
import { badRequest, conflict, forbidden, notFound, parse } from '../errors.js';
import { can, type Permission, type Role } from '../permissions.js';
import { isRealDate, localDate, nowIso } from '../time.js';
import { camelize, escapeLike, toSnake } from '../util.js';

// ---------- Field definitions ----------

const date = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');
const text = (max = 4000) =>
  z.string().trim().max(max).transform((s) => (s === '' ? null : s)).nullable();
const phone = z
  .string()
  .trim()
  .transform((s) => (s === '' ? null : s))
  .refine((s) => s === null || /^[0-9+()\-\s]{6,20}$/.test(s), 'Enter a valid phone number')
  .nullable();
const count = z.number().int().min(0).max(30).nullable();

const FIELDS = {
  // demographics
  fullName: z.string().trim().min(2, 'Name is required').max(120),
  dateOfBirth: date.nullable(),
  estimatedAgeYears: z.number().int().min(0).max(130).nullable(),
  phone,
  address: text(500),
  emergencyContactName: text(120),
  emergencyContactPhone: phone,
  // allergies
  allergyStatus: z.enum(['unknown', 'none', 'known']),
  allergyDetails: text(1000),
  // clinical
  medicalHistory: text(),
  surgicalHistory: text(),
  familyHistory: text(),
  menstrualHistory: text(),
  lastMenstrualPeriod: date.nullable(),
  menopauseStatus: z.enum(['unknown', 'not_applicable', 'pre', 'peri', 'post']),
  obstetricHistory: text(),
  gravida: count,
  para: count,
  abortions: count,
  living: count,
  ongoingMedicines: text(),
  clinicalNotes: text(),
} as const;

type FieldKey = keyof typeof FIELDS;

const GROUP: Record<FieldKey, Permission> = {
  fullName: 'patient:write_demographics',
  dateOfBirth: 'patient:write_demographics',
  estimatedAgeYears: 'patient:write_demographics',
  phone: 'patient:write_demographics',
  address: 'patient:write_demographics',
  emergencyContactName: 'patient:write_demographics',
  emergencyContactPhone: 'patient:write_demographics',
  allergyStatus: 'patient:write_allergies',
  allergyDetails: 'patient:write_allergies',
  medicalHistory: 'patient:write_clinical',
  surgicalHistory: 'patient:write_clinical',
  familyHistory: 'patient:write_clinical',
  menstrualHistory: 'patient:write_clinical',
  lastMenstrualPeriod: 'patient:write_clinical',
  menopauseStatus: 'patient:write_clinical',
  obstetricHistory: 'patient:write_clinical',
  gravida: 'patient:write_clinical',
  para: 'patient:write_clinical',
  abortions: 'patient:write_clinical',
  living: 'patient:write_clinical',
  ongoingMedicines: 'patient:write_clinical',
  clinicalNotes: 'patient:write_clinical',
};

const BASIC_KEYS = new Set([
  'id', 'patientNumber', 'fullName', 'dateOfBirth', 'estimatedAgeYears', 'phone', 'address',
  'emergencyContactName', 'emergencyContactPhone', 'allergyStatus', 'allergyDetails',
  'version', 'createdAt', 'updatedAt', 'ageYears', 'ageIsEstimated',
]);

const DEFAULTS: Record<FieldKey, unknown> = {
  fullName: '', dateOfBirth: null, estimatedAgeYears: null, phone: null, address: null,
  emergencyContactName: null, emergencyContactPhone: null, allergyStatus: 'unknown', allergyDetails: null,
  medicalHistory: null, surgicalHistory: null, familyHistory: null, menstrualHistory: null,
  lastMenstrualPeriod: null, menopauseStatus: 'unknown', obstetricHistory: null, gravida: null, para: null,
  abortions: null, living: null,
  ongoingMedicines: null, clinicalNotes: null,
};

const base = z.object(FIELDS).partial();
const createSchema = base.extend({ fullName: FIELDS.fullName }).strict();
const patchSchema = base.extend({ version: z.number().int().min(1) }).strict();
const dupSchema = z.object({ fullName: z.string().max(120).optional(), dateOfBirth: date.nullable().optional(), phone: phone.optional(), excludeId: z.number().int().optional() }).strict();
const searchSchema = z.object({ q: z.string().trim().min(2, 'Type at least 2 characters').max(100) });

// ---------- Helpers ----------

export function ageYears(dob: string, today: string): number {
  const [y, m, d] = dob.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export function registerPatientRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const today = () => localDate(new Date(), cfg.timezone);

  function assertCanWrite(role: Role, keys: string[]): void {
    const denied = keys.filter((k) => !can(role, GROUP[k as FieldKey]));
    if (denied.length) throw forbidden(`Your role cannot edit: ${denied.join(', ')}`);
  }

  /** Cross-field checks on the full (merged) record. Mutates allergyDetails when status isn't 'known'. */
  function validateRecord(rec: Record<FieldKey, unknown>): void {
    const t = today();
    const dob = rec.dateOfBirth as string | null;
    if (dob && (dob > t || dob < '1900-01-01')) throw badRequest('Date of birth is not plausible', [{ field: 'dateOfBirth', message: 'Must be between 1900-01-01 and today' }]);
    const lmp = rec.lastMenstrualPeriod as string | null;
    if (lmp && lmp > t) throw badRequest('Last menstrual period cannot be in the future', [{ field: 'lastMenstrualPeriod', message: 'Cannot be in the future' }]);
    if (rec.allergyStatus === 'known' && !rec.allergyDetails) {
      throw badRequest('Describe the allergy (and reaction, if known)', [{ field: 'allergyDetails', message: 'Required when allergies are known' }]);
    }
    if (rec.allergyStatus !== 'known') rec.allergyDetails = null;
    const g = rec.gravida as number | null;
    const p = rec.para as number | null;
    const a = rec.abortions as number | null;
    if (g !== null && p !== null && p > g) throw badRequest('Para cannot exceed gravida', [{ field: 'para', message: 'Cannot exceed gravida' }]);
    if (g !== null && a !== null && a > g) throw badRequest('Abortions cannot exceed gravida', [{ field: 'abortions', message: 'Cannot exceed gravida' }]);
    if (g !== null && p !== null && a !== null && p + a > g) {
      throw badRequest('Para plus abortions cannot exceed gravida', [{ field: 'abortions', message: 'Para + abortions cannot exceed gravida' }]);
    }
  }

  function present(row: object, role: Role) {
    const out = camelize(row);
    const dob = out.dateOfBirth as string | null;
    out.ageYears = dob ? ageYears(dob, today()) : (out.estimatedAgeYears as number | null);
    out.ageIsEstimated = !dob && out.estimatedAgeYears != null;
    if (can(role, 'patient:read_clinical')) return out;
    return Object.fromEntries(Object.entries(out).filter(([k]) => BASIC_KEYS.has(k)));
  }

  function findDuplicates(c: { fullName?: string | null; dateOfBirth?: string | null; phone?: string | null }, excludeId?: number) {
    const clauses: string[] = [];
    const args: (string | number)[] = [];
    if (c.phone) { clauses.push('phone = ?'); args.push(c.phone); }
    if (c.fullName && c.dateOfBirth) { clauses.push('(full_name = ? COLLATE NOCASE AND date_of_birth = ?)'); args.push(c.fullName.trim(), c.dateOfBirth); }
    if (!clauses.length) return [];
    return db
      .prepare(
        `SELECT id, patient_number AS patientNumber, full_name AS fullName, phone, date_of_birth AS dateOfBirth
           FROM patients WHERE (${clauses.join(' OR ')}) ${excludeId ? 'AND id <> ?' : ''} ORDER BY id LIMIT 10`,
      )
      .all(...args, ...(excludeId ? [excludeId] : []));
  }

  const idOf = (raw: unknown) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) throw notFound('Patient');
    return id;
  };

  // ---------- Routes ----------

  app.get('/api/patients', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const { q } = parse(searchSchema, req.query);
    const like = `%${escapeLike(q)}%`;
    const digits = q.replace(/\D/g, '');
    const phoneExpr = "replace(replace(replace(replace(replace(phone,' ',''),'-',''),'(',''),')',''),'+','')";
    const clauses = ["full_name LIKE ? ESCAPE '\\'", "patient_number LIKE ? ESCAPE '\\'"];
    const args: string[] = [like, `${escapeLike(q)}%`];
    if (digits.length >= 3) { clauses.push(`${phoneExpr} LIKE ? ESCAPE '\\'`); args.push(`%${escapeLike(digits)}%`); }
    const rows = db
      .prepare(
        `SELECT id, patient_number, full_name, date_of_birth, estimated_age_years, phone, allergy_status
           FROM patients WHERE ${clauses.join(' OR ')} ORDER BY full_name COLLATE NOCASE LIMIT 50`,
      )
      .all(...args);
    return rows.map((r) => {
      const o = camelize(r);
      const dob = o.dateOfBirth as string | null;
      return { ...o, ageYears: dob ? ageYears(dob, today()) : o.estimatedAgeYears, ageIsEstimated: !dob && o.estimatedAgeYears != null };
    });
  });

  app.post('/api/patients/check-duplicates', async (req) => {
    requirePerm(req, 'patient:write_demographics');
    const b = parse(dupSchema, req.body);
    return { possibleDuplicates: findDuplicates(b, b.excludeId) };
  });

  app.post('/api/patients', async (req, reply) => {
    const user = requireUser(req);
    const body = parse(createSchema, req.body) as Partial<Record<FieldKey, unknown>>;
    assertCanWrite(user.role, Object.keys(body));
    const rec = { ...DEFAULTS, ...body } as Record<FieldKey, unknown>;
    validateRecord(rec);
    const keys = Object.keys(FIELDS) as FieldKey[];

    const row = tx(db, () => {
      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'patient'").run();
      const n = (db.prepare("SELECT value FROM counters WHERE name = 'patient'").get() as { value: number }).value;
      const patientNumber = 'P' + String(n).padStart(6, '0');
      const now = nowIso();
      const r = db
        .prepare(
          `INSERT INTO patients(patient_number, ${keys.map(toSnake).join(', ')}, created_by, created_at, updated_at)
           VALUES (?, ${keys.map(() => '?').join(', ')}, ?, ?, ?)`,
        )
        .run(patientNumber, ...keys.map((k) => rec[k] as string | number | null), user.id, now, now);
      const id = Number(r.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'patient.create', entity: 'patient', entityId: id, detail: { patientNumber } });
      return db.prepare('SELECT * FROM patients WHERE id = ?').get(id)!;
    });
    const possibleDuplicates = findDuplicates(rec as { fullName: string; dateOfBirth: string | null; phone: string | null }, (row as { id: number }).id);
    return reply.status(201).send({ patient: present(row, user.role), possibleDuplicates });
  });

  app.get('/api/patients/:id', async (req) => {
    const user = requirePerm(req, 'patient:read_basic');
    const id = idOf((req.params as { id: string }).id);
    const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!row) throw notFound('Patient');
    audit(db, { actorId: user.id, action: 'patient.view', entity: 'patient', entityId: id });
    return present(row, user.role);
  });

  app.patch('/api/patients/:id', async (req) => {
    const user = requireUser(req);
    const id = idOf((req.params as { id: string }).id);
    const { version, ...changes } = parse(patchSchema, req.body) as { version: number } & Partial<Record<FieldKey, unknown>>;
    assertCanWrite(user.role, Object.keys(changes));

    return tx(db, () => {
      const before = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (!before) throw notFound('Patient');
      if (before.version !== version) {
        throw conflict('This record was changed by someone else. Reload it and try again.', { currentVersion: before.version });
      }
      const current = camelize(before) as Record<FieldKey, unknown>;
      const merged = { ...current, ...changes } as Record<FieldKey, unknown>;
      validateRecord(merged);
      const keys = (Object.keys(FIELDS) as FieldKey[]).filter((k) => (merged[k] ?? null) !== (current[k] ?? null));
      if (keys.length === 0) return present(before, user.role);

      const changed = diff(
        Object.fromEntries(keys.map((k) => [k, current[k]])),
        Object.fromEntries(keys.map((k) => [k, merged[k]])),
      );
      const r = db
        .prepare(
          `UPDATE patients SET ${keys.map((k) => `${toSnake(k)} = ?`).join(', ')}, version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?`,
        )
        .run(...keys.map((k) => merged[k] as string | number | null), nowIso(), id, version);
      if (r.changes !== 1) throw conflict('This record was changed by someone else. Reload it and try again.');
      audit(db, { actorId: user.id, action: 'patient.update', entity: 'patient', entityId: id, detail: changed });
      return present(db.prepare('SELECT * FROM patients WHERE id = ?').get(id)!, user.role);
    });
  });
}
