import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit, diff } from '../audit.js';
import { badRequest, conflict, forbidden, notFound, parse } from '../errors.js';
import { can, type Permission, type Role } from '../permissions.js';
import { isRealDate, localDate, nowIso } from '../time.js';
import { camelize, escapeLike, toSnake } from '../util.js';
import { formatDetailedPediatricAge } from '../pediatricCatalog.js';
import { sniff, MAX_FILE_BYTES } from './attachments.js';

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
const aadhaarLastFour = z
  .string()
  .trim()
  .transform((s) => (s === '' ? null : s))
  .refine((s) => s === null || /^\d{4}$/.test(s), 'Enter exactly the last 4 digits of Aadhaar (e.g. 5432)')
  .nullable();

const FIELDS = {
  // demographics
  fullName: z.string().trim().min(2, 'Name is required').max(120),
  dateOfBirth: date.nullable(),
  estimatedAgeYears: z.number().int().min(0).max(130).nullable(),
  phone,
  aadhaarLastFour,
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
  aadhaarLastFour: 'patient:write_demographics',
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
  'id', 'patientNumber', 'fullName', 'dateOfBirth', 'estimatedAgeYears', 'phone', 'aadhaarLastFour', 'aadhaarAttachmentId', 'address',
  'emergencyContactName', 'emergencyContactPhone', 'allergyStatus', 'allergyDetails',
  'version', 'createdAt', 'updatedAt', 'ageYears', 'ageIsEstimated',
]);

const DEFAULTS: Record<FieldKey, unknown> = {
  fullName: '', dateOfBirth: null, estimatedAgeYears: null, phone: null, aadhaarLastFour: null, address: null,
  emergencyContactName: null, emergencyContactPhone: null, allergyStatus: 'unknown', allergyDetails: null,
  medicalHistory: null, surgicalHistory: null, familyHistory: null, menstrualHistory: null,
  lastMenstrualPeriod: null, menopauseStatus: 'unknown', obstetricHistory: null, gravida: null, para: null,
  abortions: null, living: null,
  ongoingMedicines: null, clinicalNotes: null,
};

const aadhaarDocSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    data: z.string().min(1, 'Choose a file'),
  })
  .strict();

const base = z.object(FIELDS).partial();
const createSchema = base
  .extend({
    fullName: FIELDS.fullName,
    aadhaarDocument: aadhaarDocSchema.optional(),
  })
  .strict();
const patchSchema = base.extend({ version: z.number().int().min(1) }).strict();
const dupSchema = z.object({ fullName: z.string().max(120).optional(), dateOfBirth: date.nullable().optional(), phone: phone.optional(), aadhaarLastFour: aadhaarLastFour.optional(), excludeId: z.number().int().optional() }).strict();
const searchSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    category: z.enum(['all', 'antenatal', 'pediatric', 'inpatient', 'high_risk', 'allergies']).optional(),
    tag: z.string().trim().max(50).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine(
    (data) => {
      const hasFilter = Boolean(data.category && data.category !== 'all') || Boolean(data.tag);
      if (hasFilter) return true;
      return typeof data.q === 'string' && data.q.length >= 2;
    },
    { message: 'Type at least 2 characters', path: ['q'] }
  );

function calculateEdd(lmp: string | null | undefined): string | null {
  if (!lmp || !/^\d{4}-\d{2}-\d{2}$/.test(lmp)) return null;
  const [y, m, d] = lmp.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + 280);
  return dt.toISOString().slice(0, 10);
}

function calculateGestationalAge(lmp: string | null | undefined, asOf: string) {
  if (!lmp || !/^\d{4}-\d{2}-\d{2}$/.test(lmp)) return null;
  const [ly, lm, ld] = lmp.split('-').map(Number);
  const [ty, tm, td] = asOf.split('-').map(Number);
  if (!ly || !lm || !ld || !ty || !tm || !td) return null;
  const lmpUtc = Date.UTC(ly, lm - 1, ld);
  const asOfUtc = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.floor((asOfUtc - lmpUtc) / (24 * 3600 * 1000));
  if (diffDays < 0 || diffDays > 310) return null;
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  return { weeks, days, formatted: `${weeks}w ${days}d` };
}

function formatGpal(p: { gravida?: number | null; para?: number | null; abortions?: number | null; living?: number | null }): string | null {
  const parts: string[] = [];
  if (p.gravida != null) parts.push(`G${p.gravida}`);
  if (p.para != null) parts.push(`P${p.para}`);
  if (p.abortions != null) parts.push(`A${p.abortions}`);
  if (p.living != null) parts.push(`L${p.living}`);
  return parts.length > 0 ? parts.join(' ') : null;
}

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

  function findDuplicates(c: { fullName?: string | null; dateOfBirth?: string | null; phone?: string | null; aadhaarLastFour?: string | null }, excludeId?: number) {
    const clauses: string[] = [];
    const args: (string | number)[] = [];
    if (c.phone) { clauses.push('phone = ?'); args.push(c.phone); }
    if (c.aadhaarLastFour) { clauses.push('aadhaar_last_four = ?'); args.push(c.aadhaarLastFour); }
    if (c.fullName && c.dateOfBirth) { clauses.push('(full_name = ? COLLATE NOCASE AND date_of_birth = ?)'); args.push(c.fullName.trim(), c.dateOfBirth); }
    if (!clauses.length) return [];
    return db
      .prepare(
        `SELECT id, patient_number AS patientNumber, full_name AS fullName, phone, aadhaar_last_four AS aadhaarLastFour, date_of_birth AS dateOfBirth
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
    const user = requirePerm(req, 'patient:read_basic');
    const { q, category, tag, limit = 50 } = parse(searchSchema, req.query);
    const queryStr = q?.trim() || '';
    const conditions: string[] = [];
    const args: (string | number)[] = [];
    const t = today();

    if (queryStr.length > 0) {
      const like = `%${escapeLike(queryStr)}%`;
      const digits = queryStr.replace(/\D/g, '');
      const phoneExpr = "replace(replace(replace(replace(replace(p.phone,' ',''),'-',''),'(',''),')',''),'+','')";
      const emergencyPhoneExpr =
        "replace(replace(replace(replace(replace(p.emergency_contact_phone,' ',''),'-',''),'(',''),')',''),'+','')";

      const textClauses = [
        "p.full_name LIKE ? ESCAPE '\\'",
        "p.patient_number LIKE ? ESCAPE '\\'",
        "p.emergency_contact_name LIKE ? ESCAPE '\\'",
        "p.address LIKE ? ESCAPE '\\'",
      ];
      const textArgs: (string | number)[] = [like, `${escapeLike(queryStr)}%`, like, like];

      if (digits.length === 4) {
        textClauses.push('p.aadhaar_last_four = ?');
        textArgs.push(digits);
      } else if (digits.length >= 2 && digits.length < 4) {
        textClauses.push("p.aadhaar_last_four LIKE ? ESCAPE '\\\'");
        textArgs.push(`${escapeLike(digits)}%`);
      }

      if (digits.length >= 3) {
        textClauses.push(`${phoneExpr} LIKE ? ESCAPE '\\'`);
        textArgs.push(`%${escapeLike(digits)}%`);
        textClauses.push(`${emergencyPhoneExpr} LIKE ? ESCAPE '\\'`);
        textArgs.push(`%${escapeLike(digits)}%`);
      }

      conditions.push(`(${textClauses.join(' OR ')})`);
      args.push(...textArgs);
    }

    if (category === 'antenatal') {
      conditions.push(
        `(p.last_menstrual_period IS NOT NULL OR p.gravida IS NOT NULL OR EXISTS (SELECT 1 FROM visits v WHERE v.patient_id = p.id AND v.antenatal_notes IS NOT NULL))`
      );
    } else if (category === 'pediatric') {
      const pedsCutoffYear = String(parseInt(t.slice(0, 4), 10) - 18);
      conditions.push(
        `(p.estimated_age_years <= 18 OR (p.date_of_birth IS NOT NULL AND substr(p.date_of_birth, 1, 4) >= ?))`
      );
      args.push(pedsCutoffYear);
    } else if (category === 'inpatient') {
      conditions.push(`EXISTS (SELECT 1 FROM admissions a WHERE a.patient_id = p.id AND a.status = 'admitted')`);
    } else if (category === 'allergies') {
      conditions.push(`p.allergy_status = 'known'`);
    } else if (category === 'high_risk') {
      const advMaternalAgeCutoff = String(parseInt(t.slice(0, 4), 10) - 35);
      conditions.push(
        `(
          (p.date_of_birth IS NOT NULL AND substr(p.date_of_birth, 1, 4) <= ?) OR
          p.para >= 4 OR
          p.abortions >= 2 OR
          p.obstetric_history LIKE '%lscs%' OR p.obstetric_history LIKE '%cesarean%' OR
          p.surgical_history LIKE '%lscs%' OR p.surgical_history LIKE '%cesarean%' OR
          EXISTS (
            SELECT 1 FROM patient_antenatal_tests pat
            WHERE pat.patient_id = p.id AND pat.test_key = 'blood_group' AND (pat.result_value LIKE '%-%' OR pat.result_value LIKE '%neg%')
          ) OR
          EXISTS (
            SELECT 1 FROM visit_vitals vv
            JOIN visits v ON v.id = vv.visit_id
            WHERE v.patient_id = p.id AND (vv.systolic_mmhg >= 140 OR vv.diastolic_mmhg >= 90)
          )
        )`
      );
      args.push(advMaternalAgeCutoff);
    }

    if (tag === 'rh_negative') {
      conditions.push(
        `(
          EXISTS (
            SELECT 1 FROM patient_antenatal_tests pat
            WHERE pat.patient_id = p.id AND pat.test_key = 'blood_group' AND (pat.result_value LIKE '%-%' OR pat.result_value LIKE '%neg%')
          ) OR
          EXISTS (
            SELECT 1 FROM patient_pediatric_profiles pp
            WHERE pp.patient_id = p.id AND (pp.blood_group LIKE '%-%' OR pp.blood_group LIKE '%neg%')
          )
        )`
      );
    } else if (tag === 'hypertension') {
      conditions.push(
        `EXISTS (
          SELECT 1 FROM visit_vitals vv
          JOIN visits v ON v.id = vv.visit_id
          WHERE v.patient_id = p.id AND (vv.systolic_mmhg >= 140 OR vv.diastolic_mmhg >= 90)
        )`
      );
    } else if (tag === 'lscs') {
      conditions.push(
        `(p.obstetric_history LIKE '%lscs%' OR p.obstetric_history LIKE '%cesarean%' OR p.obstetric_history LIKE '%c-section%' OR p.surgical_history LIKE '%lscs%' OR p.surgical_history LIKE '%cesarean%')`
      );
    } else if (tag === 'boh') {
      conditions.push(`p.abortions >= 2`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT p.id, p.patient_number, p.full_name, p.date_of_birth, p.estimated_age_years, p.phone, p.aadhaar_last_four, p.aadhaar_attachment_id,
                p.emergency_contact_name, p.emergency_contact_phone, p.address,
                p.allergy_status, p.last_menstrual_period, p.gravida, p.para, p.abortions, p.living,
                p.obstetric_history, p.surgical_history,
                (SELECT b.room || ' / ' || b.label
                 FROM admissions a
                 JOIN beds b ON b.id = a.bed_id
                 WHERE a.patient_id = p.id AND a.status = 'admitted'
                 LIMIT 1) AS inpatient_bed,
                (SELECT pat.result_value
                 FROM patient_antenatal_tests pat
                 WHERE pat.patient_id = p.id AND pat.test_key = 'blood_group'
                 LIMIT 1) AS antenatal_blood_group,
                (SELECT pp.blood_group
                 FROM patient_pediatric_profiles pp
                 WHERE pp.patient_id = p.id
                 LIMIT 1) AS peds_blood_group,
                (SELECT vv.systolic_mmhg
                 FROM visit_vitals vv
                 JOIN visits v ON v.id = vv.visit_id
                 WHERE v.patient_id = p.id
                 ORDER BY vv.recorded_at DESC LIMIT 1) AS latest_systolic,
                (SELECT vv.diastolic_mmhg
                 FROM visit_vitals vv
                 JOIN visits v ON v.id = vv.visit_id
                 WHERE v.patient_id = p.id
                 ORDER BY vv.recorded_at DESC LIMIT 1) AS latest_diastolic
         FROM patients p
         ${whereClause}
         ORDER BY p.full_name COLLATE NOCASE
         LIMIT ?`
      )
      .all(...args, limit) as Array<{
        id: number;
        patient_number: string;
        full_name: string;
        date_of_birth: string | null;
        estimated_age_years: number | null;
        phone: string | null;
        aadhaar_last_four: string | null;
        aadhaar_attachment_id: number | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        address: string | null;
        allergy_status: 'unknown' | 'none' | 'known';
        last_menstrual_period: string | null;
        gravida: number | null;
        para: number | null;
        abortions: number | null;
        living: number | null;
        obstetric_history: string | null;
        surgical_history: string | null;
        inpatient_bed: string | null;
        antenatal_blood_group: string | null;
        peds_blood_group: string | null;
        latest_systolic: number | null;
        latest_diastolic: number | null;
      }>;

    const canSeeClinical = can(user.role, 'patient:read_clinical');

    return rows.map((r) => {
      const dob = r.date_of_birth;
      const age = dob ? ageYears(dob, t) : r.estimated_age_years;
      const isEstimated = !dob && r.estimated_age_years != null;
      const isAntenatal = Boolean(r.last_menstrual_period || r.gravida != null || r.para != null);
      const edd = isAntenatal ? calculateEdd(r.last_menstrual_period) : null;
      const ga = isAntenatal && r.last_menstrual_period ? calculateGestationalAge(r.last_menstrual_period, t) : null;
      const isPed = age != null && age <= 18;
      const detailedAge = isPed && dob ? formatDetailedPediatricAge(dob, t) : null;

      const bloodGroup = r.antenatal_blood_group || r.peds_blood_group || null;
      const highRiskFlags: string[] = [];

      if (canSeeClinical) {
        if (bloodGroup && (bloodGroup.includes('-') || /neg/i.test(bloodGroup))) {
          highRiskFlags.push('Rh-Negative');
        }
        if ((r.latest_systolic != null && r.latest_systolic >= 140) || (r.latest_diastolic != null && r.latest_diastolic >= 90)) {
          highRiskFlags.push('High BP');
        }
        if (isAntenatal && age != null && age >= 35) {
          highRiskFlags.push('Age ≥ 35');
        }
        if (r.abortions != null && r.abortions >= 2) {
          highRiskFlags.push('BOH');
        }
        if (r.para != null && r.para >= 4) {
          highRiskFlags.push('Grand Multi');
        }
        if ((r.obstetric_history && /lscs|cesarean/i.test(r.obstetric_history)) || (r.surgical_history && /lscs|cesarean/i.test(r.surgical_history))) {
          highRiskFlags.push('Prior LSCS');
        }
      }

      return {
        id: r.id,
        patientNumber: r.patient_number,
        fullName: r.full_name,
        dateOfBirth: r.date_of_birth,
        phone: r.phone,
        aadhaarLastFour: r.aadhaar_last_four,
        aadhaarAttachmentId: r.aadhaar_attachment_id ?? null,
        emergencyContactName: r.emergency_contact_name,
        emergencyContactPhone: r.emergency_contact_phone,
        address: r.address,
        allergyStatus: r.allergy_status,
        ageYears: age,
        ageIsEstimated: isEstimated,
        isAntenatal,
        gestationalAgeFormatted: ga ? ga.formatted : null,
        edd,
        gpal: isAntenatal ? formatGpal(r) : null,
        isPediatric: isPed,
        detailedAge,
        isInpatient: Boolean(r.inpatient_bed),
        inpatientBed: r.inpatient_bed ?? null,
        isHighRisk: highRiskFlags.length > 0,
        highRiskFlags: canSeeClinical ? highRiskFlags : undefined,
      };
    });
  });

  app.post('/api/patients/check-duplicates', async (req) => {
    requirePerm(req, 'patient:write_demographics');
    const b = parse(dupSchema, req.body);
    return { possibleDuplicates: findDuplicates(b, b.excludeId) };
  });

  app.post('/api/patients', { bodyLimit: Math.ceil((MAX_FILE_BYTES * 4) / 3) + 64 * 1024 }, async (req, reply) => {
    const user = requireUser(req);
    const body = parse(createSchema, req.body) as Partial<Record<FieldKey, unknown>> & {
      aadhaarDocument?: { fileName: string; data: string };
    };
    const { aadhaarDocument, ...fields } = body;
    assertCanWrite(user.role, Object.keys(fields));
    const rec = { ...DEFAULTS, ...fields } as Record<FieldKey, unknown>;
    validateRecord(rec);
    const keys = Object.keys(FIELDS) as FieldKey[];

    let aadhaarAttachment: { bytes: Buffer; mime: 'application/pdf' | 'image/jpeg' | 'image/png'; name: string; sha256: string } | null = null;
    if (aadhaarDocument) {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(aadhaarDocument.data) || aadhaarDocument.data.length % 4 !== 0) {
        throw badRequest('The Aadhaar file could not be read', [{ field: 'aadhaarDocument', message: 'Not a valid base64 file' }]);
      }
      const bytes = Buffer.from(aadhaarDocument.data, 'base64');
      if (bytes.length === 0) throw badRequest('The Aadhaar file is empty', [{ field: 'aadhaarDocument', message: 'The file is empty' }]);
      if (bytes.length > MAX_FILE_BYTES) {
        throw badRequest(`The Aadhaar file is too large. Maximum size is ${MAX_FILE_BYTES / 1024 / 1024} MB.`, [{ field: 'aadhaarDocument', message: 'File too large' }]);
      }
      const mime = sniff(bytes);
      if (!mime) throw badRequest('Only PDF, JPEG and PNG files are accepted for Aadhaar copy', [{ field: 'aadhaarDocument', message: 'Unsupported file type' }]);
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      const cleanName = (aadhaarDocument.fileName.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 200) || 'aadhaar';
      aadhaarAttachment = { bytes, mime, name: cleanName, sha256 };
    }

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

      if (aadhaarAttachment) {
        const last4 = rec.aadhaarLastFour as string | null;
        const title = last4 ? `Aadhaar Card (•••• ${last4})` : `Aadhaar Card - ${patientNumber}`;
        const attRes = db
          .prepare(
            `INSERT INTO attachments(patient_id, visit_id, admission_id, doc_type, title, document_date, original_name, mime, size_bytes, sha256, uploaded_by, created_at)
             VALUES (?, NULL, NULL, 'other', ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(id, title, today(), aadhaarAttachment.name, aadhaarAttachment.mime, aadhaarAttachment.bytes.length, aadhaarAttachment.sha256, user.id, now);
        const attachmentId = Number(attRes.lastInsertRowid);
        db.prepare('INSERT INTO attachment_blobs(attachment_id, data) VALUES (?, ?)').run(attachmentId, aadhaarAttachment.bytes);
        db.prepare('UPDATE patients SET aadhaar_attachment_id = ? WHERE id = ?').run(attachmentId, id);
        audit(db, {
          actorId: user.id,
          action: 'attachment.upload',
          entity: 'attachment',
          entityId: attachmentId,
          detail: { title, docType: 'other', sizeBytes: aadhaarAttachment.bytes.length, sha256: aadhaarAttachment.sha256 },
        });
      }

      return db.prepare('SELECT * FROM patients WHERE id = ?').get(id)!;
    });
    const possibleDuplicates = findDuplicates(rec as { fullName: string; dateOfBirth: string | null; phone: string | null; aadhaarLastFour?: string | null }, (row as { id: number }).id);
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

  const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

  app.get('/api/patients/:id/aadhaar-document', async (req, reply) => {
    const user = requirePerm(req, 'patient:read_basic');
    const id = idOf((req.params as { id: string }).id);
    const p = db.prepare('SELECT id, aadhaar_attachment_id, full_name, patient_number FROM patients WHERE id = ?').get(id) as
      | { id: number; aadhaar_attachment_id: number | null; full_name: string; patient_number: string }
      | undefined;
    if (!p) throw notFound('Patient');
    if (!p.aadhaar_attachment_id) throw notFound('Aadhaar document has not been uploaded for this patient');

    const att = db
      .prepare('SELECT a.mime, a.original_name, a.title, a.voided_at, b.data FROM attachments a JOIN attachment_blobs b ON b.attachment_id = a.id WHERE a.id = ?')
      .get(p.aadhaar_attachment_id) as { mime: string; original_name: string; title: string; voided_at: string | null; data: Uint8Array } | undefined;
    if (!att || att.voided_at) throw notFound('Aadhaar document');

    const q = parse(z.object({ download: z.enum(['1']).optional() }), req.query);
    audit(db, {
      actorId: user.id,
      action: q.download ? 'patient.download_aadhaar' : 'patient.view_aadhaar',
      entity: 'patient',
      entityId: id,
      detail: { attachmentId: p.aadhaar_attachment_id, title: att.title },
    });

    const ext = EXT[att.mime] ?? 'bin';
    const base = `Aadhaar_${p.patient_number}`;
    return reply
      .header('Content-Type', att.mime)
      .header('Content-Disposition', `${q.download ? 'attachment' : 'inline'}; filename="${base}.${ext}"`)
      .header('Cache-Control', 'private, no-store')
      .send(Buffer.from(att.data));
  });

  app.post('/api/patients/:id/aadhaar-document', { bodyLimit: Math.ceil((MAX_FILE_BYTES * 4) / 3) + 64 * 1024 }, async (req, reply) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_demographics') && !can(user.role, 'attachment:write')) {
      throw forbidden('You do not have permission to upload patient identification documents');
    }
    const id = idOf((req.params as { id: string }).id);
    const body = parse(aadhaarDocSchema, req.body);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body.data) || body.data.length % 4 !== 0) {
      throw badRequest('The Aadhaar file could not be read', [{ field: 'data', message: 'Not a valid base64 file' }]);
    }
    const bytes = Buffer.from(body.data, 'base64');
    if (bytes.length === 0) throw badRequest('The Aadhaar file is empty', [{ field: 'data', message: 'The file is empty' }]);
    if (bytes.length > MAX_FILE_BYTES) {
      throw badRequest(`The Aadhaar file is too large. Maximum size is ${MAX_FILE_BYTES / 1024 / 1024} MB.`, [{ field: 'data', message: 'File too large' }]);
    }
    const mime = sniff(bytes);
    if (!mime) throw badRequest('Only PDF, JPEG and PNG files are accepted for Aadhaar copy', [{ field: 'data', message: 'Unsupported file type' }]);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const cleanName = (body.fileName.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 200) || 'aadhaar';
    const now = nowIso();

    const patient = tx(db, () => {
      const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (!p) throw notFound('Patient');
      const last4 = p.aadhaar_last_four as string | null;
      const patientNumber = p.patient_number as string;
      const title = last4 ? `Aadhaar Card (•••• ${last4})` : `Aadhaar Card - ${patientNumber}`;
      const attRes = db
        .prepare(
          `INSERT INTO attachments(patient_id, visit_id, admission_id, doc_type, title, document_date, original_name, mime, size_bytes, sha256, uploaded_by, created_at)
           VALUES (?, NULL, NULL, 'other', ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(id, title, today(), cleanName, mime, bytes.length, sha256, user.id, now);
      const attachmentId = Number(attRes.lastInsertRowid);
      db.prepare('INSERT INTO attachment_blobs(attachment_id, data) VALUES (?, ?)').run(attachmentId, bytes);
      db.prepare('UPDATE patients SET aadhaar_attachment_id = ?, updated_at = ? WHERE id = ?').run(attachmentId, now, id);
      audit(db, {
        actorId: user.id,
        action: 'attachment.upload',
        entity: 'attachment',
        entityId: attachmentId,
        detail: { title, docType: 'other', sizeBytes: bytes.length, sha256 },
      });
      return db.prepare('SELECT * FROM patients WHERE id = ?').get(id)!;
    });

    return reply.status(201).send(present(patient, user.role));
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
