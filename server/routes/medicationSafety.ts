import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManageMedicationSafety(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'visit:write') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage antenatal medication safety and exposure records');
  }
  return user;
}

const optNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const optNullableNumber = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .nullable()
    .optional();

export const createExposureSchema = z
  .object({
    medicineName: z.string().trim().min(1, 'Medicine name is required').max(200),
    genericName: optNullableString(200),
    fdaCategory: z.enum(['A', 'B', 'C', 'D', 'X', 'N/A']).default('N/A'),
    riskLevel: z.enum(['safe', 'caution', 'high_risk', 'contraindicated']),
    trimesterExposure: z.enum(['preconception', 't1_organogenesis', 't2', 't3', 'multiple_unknown']),
    gestationalAgeWeeks: optNullableNumber(0, 44),
    gestationalAgeDays: optNullableNumber(0, 6),
    exposureStartDate: optNullableString(50),
    exposureEndDate: optNullableString(50),
    exposureDose: optNullableString(200),
    fetalRiskSummary: z.string().trim().min(1, 'Fetal risk summary is required').max(1000),
    teratogenicMechanism: optNullableString(1000),
    anomalyScanIndicated: z.boolean().default(false),
    fetalEchoIndicated: z.boolean().default(false),
    counselingNotes: optNullableString(2000),
    actionPlan: optNullableString(2000),
  })
  .strict();

export function registerMedicationSafetyRoutes(app: FastifyInstance, { db }: Ctx): void {
  // GET /api/patients/:id/medication-exposures
  app.get('/api/patients/:id/medication-exposures', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const rows = db
      .prepare(
        `SELECT e.*, u.full_name AS counseled_by_name
         FROM antenatal_medication_exposures e
         LEFT JOIN users u ON u.id = e.counseled_by
         WHERE e.patient_id = ?
         ORDER BY e.created_at DESC, e.id DESC`
      )
      .all(patientId) as any[];

    return {
      patientId,
      count: rows.length,
      exposures: rows.map((r) => ({
        id: r.id,
        patientId: r.patient_id,
        medicineName: r.medicine_name,
        genericName: r.generic_name,
        fdaCategory: r.fda_category,
        riskLevel: r.risk_level,
        trimesterExposure: r.trimester_exposure,
        gestationalAgeWeeks: r.gestational_age_weeks,
        gestationalAgeDays: r.gestational_age_days,
        exposureStartDate: r.exposure_start_date,
        exposureEndDate: r.exposure_end_date,
        exposureDose: r.exposure_dose,
        fetalRiskSummary: r.fetal_risk_summary,
        teratogenicMechanism: r.teratogenic_mechanism,
        anomalyScanIndicated: r.anomaly_scan_indicated === 1,
        fetalEchoIndicated: r.fetal_echo_indicated === 1,
        counselingNotes: r.counseling_notes,
        actionPlan: r.action_plan,
        counseledBy: r.counseled_by,
        counseledByName: r.counseled_by_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    };
  });

  // POST /api/patients/:id/medication-exposures
  app.post('/api/patients/:id/medication-exposures', async (req, reply) => {
    const user = assertCanManageMedicationSafety(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(createExposureSchema, req.body);
    const now = nowIso();

    const res = db
      .prepare(
        `INSERT INTO antenatal_medication_exposures (
           patient_id, medicine_name, generic_name, fda_category, risk_level,
           trimester_exposure, gestational_age_weeks, gestational_age_days,
           exposure_start_date, exposure_end_date, exposure_dose,
           fetal_risk_summary, teratogenic_mechanism,
           anomaly_scan_indicated, fetal_echo_indicated,
           counseling_notes, action_plan,
           counseled_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        patientId,
        b.medicineName,
        b.genericName ?? null,
        b.fdaCategory,
        b.riskLevel,
        b.trimesterExposure,
        b.gestationalAgeWeeks ?? null,
        b.gestationalAgeDays ?? null,
        b.exposureStartDate ?? null,
        b.exposureEndDate ?? null,
        b.exposureDose ?? null,
        b.fetalRiskSummary,
        b.teratogenicMechanism ?? null,
        b.anomalyScanIndicated ? 1 : 0,
        b.fetalEchoIndicated ? 1 : 0,
        b.counselingNotes ?? null,
        b.actionPlan ?? null,
        user.id,
        now,
        now
      );

    const newId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'medication_exposure.create',
      entity: 'patient',
      entityId: patientId,
      detail: {
        exposureId: newId,
        medicineName: b.medicineName,
        riskLevel: b.riskLevel,
        fdaCategory: b.fdaCategory,
        anomalyScanIndicated: b.anomalyScanIndicated,
      },
    });

    const created = db.prepare('SELECT * FROM antenatal_medication_exposures WHERE id = ?').get(newId) as any;
    return reply.status(201).send({
      id: created.id,
      patientId: created.patient_id,
      medicineName: created.medicine_name,
      genericName: created.generic_name,
      fdaCategory: created.fda_category,
      riskLevel: created.risk_level,
      trimesterExposure: created.trimester_exposure,
      gestationalAgeWeeks: created.gestational_age_weeks,
      gestationalAgeDays: created.gestational_age_days,
      exposureStartDate: created.exposure_start_date,
      exposureEndDate: created.exposure_end_date,
      exposureDose: created.exposure_dose,
      fetalRiskSummary: created.fetal_risk_summary,
      teratogenicMechanism: created.teratogenic_mechanism,
      anomalyScanIndicated: created.anomaly_scan_indicated === 1,
      fetalEchoIndicated: created.fetal_echo_indicated === 1,
      counselingNotes: created.counseling_notes,
      actionPlan: created.action_plan,
      counseledBy: created.counseled_by,
      counseledByName: user.fullName,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    });
  });

  // DELETE /api/medication-exposures/:id
  app.delete('/api/medication-exposures/:id', async (req) => {
    const user = assertCanManageMedicationSafety(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid exposure ID');

    const existing = db.prepare('SELECT * FROM antenatal_medication_exposures WHERE id = ?').get(id) as any | undefined;
    if (!existing) throw notFound('Medication exposure record not found');

    db.prepare('DELETE FROM antenatal_medication_exposures WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'medication_exposure.delete',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        exposureId: id,
        medicineName: existing.medicine_name,
      },
    });

    return { ok: true };
  });
}
