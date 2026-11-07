import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { nowIso } from '../time.js';
import {
  evaluatePediatricGrowth,
  detectDevelopmentalRedFlags,
  STANDARD_MILESTONES,
  type ChildSex,
} from '../../web/src/pediatricGrowthEngine.js';

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

export const createGrowthRecordSchema = z
  .object({
    recordedDate: z.string().min(8, 'Recording date YYYY-MM-DD required'),
    ageMonths: z.number().min(0).max(120),
    sex: z.enum(['male', 'female']),
    weightKg: optNullableNumber(0.5, 80),
    heightLengthCm: optNullableNumber(20, 180),
    headCircumferenceCm: optNullableNumber(15, 70),
    clinicalNotes: optNullableString(1000),
  })
  .strict();

export const updateMilestoneSchema = z
  .object({
    milestoneKey: z.string().min(1, 'Milestone key required'),
    status: z.enum(['achieved', 'emerging', 'delayed', 'not_tested']),
    achievedDate: optNullableString(20),
    ageAchievedMonths: optNullableNumber(0, 120),
    notes: optNullableString(500),
  })
  .strict();

function assertPatientExists(ctx: Ctx, patientId: number) {
  const row = ctx.db
    .prepare('SELECT id, full_name, date_of_birth FROM patients WHERE id = ?')
    .get(patientId) as { id: number; full_name: string; date_of_birth: string | null } | undefined;
  if (!row) throw notFound('Patient not found');
  return row;
}

export function registerPediatricGrowthRoutes(app: FastifyInstance, ctx: Ctx) {
  // GET /api/patients/:id/pediatric/growth
  app.get('/api/patients/:id/pediatric/growth', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const records = ctx.db
      .prepare(
        `SELECT g.*, u.full_name as recorded_by_name
         FROM pediatric_growth_records g
         LEFT JOIN users u ON g.recorded_by = u.id
         WHERE g.patient_id = ?
         ORDER BY g.age_months ASC, g.recorded_date ASC`,
      )
      .all(patientId);

    return { records };
  });

  // POST /api/patients/:id/pediatric/growth
  app.post('/api/patients/:id/pediatric/growth', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const parseResult = createGrowthRecordSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const b = parseResult.data;

    // Evaluate WHO Z-scores
    const evalRes = evaluatePediatricGrowth(
      b.ageMonths,
      b.sex as ChildSex,
      b.weightKg,
      b.heightLengthCm,
      b.headCircumferenceCm,
    );

    const now = nowIso();
    const res = ctx.db
      .prepare(
        `INSERT INTO pediatric_growth_records (
          patient_id, recorded_date, age_months, sex, weight_kg, height_length_cm,
          head_circumference_cm, bmi, weight_for_age_z, weight_for_age_status,
          height_for_age_z, height_for_age_status, weight_for_height_z,
          weight_for_height_status, hc_for_age_z, hc_for_age_status,
          clinical_notes, recorded_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )`,
      )
      .run(
        patientId,
        b.recordedDate,
        b.ageMonths,
        b.sex,
        b.weightKg ?? null,
        b.heightLengthCm ?? null,
        b.headCircumferenceCm ?? null,
        evalRes.bmi ?? null,
        evalRes.weightZ ?? null,
        evalRes.weightStatus ?? null,
        evalRes.heightZ ?? null,
        evalRes.heightStatus ?? null,
        evalRes.bmiZ ?? null,
        evalRes.bmiStatus ?? null,
        evalRes.hcZ ?? null,
        evalRes.hcStatus ?? null,
        b.clinicalNotes ?? null,
        user?.id ?? null,
        now,
        now,
      );

    const growthId = Number(res.lastInsertRowid);
    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'create_pediatric_growth_record',
      entity: 'pediatric_growth_record',
      entityId: growthId,
      detail: {
        patientId,
        growthId,
        ageMonths: b.ageMonths,
        weightZ: evalRes.weightZ,
        heightZ: evalRes.heightZ,
      },
    });

    const created = ctx.db.prepare('SELECT * FROM pediatric_growth_records WHERE id = ?').get(growthId);
    return { record: created, evaluation: evalRes };
  });

  // DELETE /api/patients/:id/pediatric/growth/:growthId
  app.delete('/api/patients/:id/pediatric/growth/:growthId', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const patientId = Number((req.params as { id: string }).id);
    const growthId = Number((req.params as { growthId: string }).growthId);
    if (!Number.isInteger(patientId) || !Number.isInteger(growthId)) throw badRequest('Invalid parameters');

    const row = ctx.db
      .prepare('SELECT id FROM pediatric_growth_records WHERE id = ? AND patient_id = ?')
      .get(growthId, patientId);
    if (!row) throw notFound('Growth record not found');

    ctx.db.prepare('DELETE FROM pediatric_growth_records WHERE id = ?').run(growthId);
    return { success: true, deletedId: growthId };
  });

  // GET /api/patients/:id/pediatric/milestones
  app.get('/api/patients/:id/pediatric/milestones', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    const patient = assertPatientExists(ctx, patientId);

    // Calculate current age in months
    let currentAgeMonths = 12;
    if (patient.date_of_birth) {
      const dob = new Date(patient.date_of_birth);
      const diffDays = Math.max(0, (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24));
      currentAgeMonths = Math.round((diffDays / 30.4375) * 10) / 10;
    }

    const recordedEvaluations = ctx.db
      .prepare(
        `SELECT m.*, u.full_name as recorded_by_name
         FROM pediatric_milestone_evaluations m
         LEFT JOIN users u ON m.recorded_by = u.id
         WHERE m.patient_id = ?`,
      )
      .all(patientId) as any[];

    const evalMap = new Map<string, any>(recordedEvaluations.map((e) => [e.milestone_key, e]));

    // Merge standard definitions with recorded statuses
    const mergedMilestones = STANDARD_MILESTONES.map((def) => {
      const recorded = evalMap.get(def.key);
      const status = recorded?.status || 'not_tested';
      const isRedFlag = currentAgeMonths > def.upperLimitAgeMonths && status !== 'achieved';

      return {
        key: def.key,
        title: def.title,
        domain: def.domain,
        expectedAgeMonths: def.expectedAgeMonths,
        upperLimitAgeMonths: def.upperLimitAgeMonths,
        description: def.description,
        status,
        achievedDate: recorded?.achieved_date || null,
        ageAchievedMonths: recorded?.age_achieved_months || null,
        isRedFlag,
        notes: recorded?.notes || null,
        recordedByName: recorded?.recorded_by_name || null,
        updatedAt: recorded?.updated_at || null,
      };
    });

    const redFlagsResult = detectDevelopmentalRedFlags(
      currentAgeMonths,
      mergedMilestones.map((m) => ({ milestone_key: m.key, status: m.status })),
    );

    return {
      currentAgeMonths,
      milestones: mergedMilestones,
      redFlags: redFlagsResult.redFlags,
      delayCount: redFlagsResult.delayCount,
    };
  });

  // POST /api/patients/:id/pediatric/milestones
  app.post('/api/patients/:id/pediatric/milestones', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    const patient = assertPatientExists(ctx, patientId);

    const parseResult = updateMilestoneSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const b = parseResult.data;

    const def = STANDARD_MILESTONES.find((m) => m.key === b.milestoneKey);
    if (!def) throw badRequest(`Unknown milestone key: ${b.milestoneKey}`);

    let currentAgeMonths = 12;
    if (patient.date_of_birth) {
      const dob = new Date(patient.date_of_birth);
      const diffDays = Math.max(0, (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24));
      currentAgeMonths = Math.round((diffDays / 30.4375) * 10) / 10;
    }

    const isRedFlag = currentAgeMonths > def.upperLimitAgeMonths && b.status !== 'achieved';
    const now = nowIso();

    ctx.db
      .prepare(
        `INSERT INTO pediatric_milestone_evaluations (
          patient_id, milestone_key, milestone_title, domain,
          expected_age_months, upper_limit_age_months, status,
          achieved_date, age_achieved_months, is_red_flag, notes,
          recorded_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
        ON CONFLICT(patient_id, milestone_key) DO UPDATE SET
          status = excluded.status,
          achieved_date = excluded.achieved_date,
          age_achieved_months = excluded.age_achieved_months,
          is_red_flag = excluded.is_red_flag,
          notes = excluded.notes,
          recorded_by = excluded.recorded_by,
          updated_at = excluded.updated_at`,
      )
      .run(
        patientId,
        def.key,
        def.title,
        def.domain,
        def.expectedAgeMonths,
        def.upperLimitAgeMonths,
        b.status,
        b.achievedDate ?? null,
        b.ageAchievedMonths ?? null,
        isRedFlag ? 1 : 0,
        b.notes ?? null,
        user?.id ?? null,
        now,
        now,
      );

    return { success: true, milestoneKey: def.key, status: b.status, isRedFlag };
  });
}
