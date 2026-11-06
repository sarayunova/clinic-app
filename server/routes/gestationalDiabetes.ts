import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import {
  classifyGlucoseReading,
  calculateGlycemicSummary,
  assessMacrosomiaRisk,
  evaluateOgttDipsi,
  evaluateOgttIadpsg,
  evaluateOgttCarpenterCoustan,
  type MealSlot,
  type PostprandialWindow,
} from '../../web/src/gdmEngine.js';

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

export const createGdmProfileSchema = z
  .object({
    gestationalAgeWeeks: optNullableNumber(4, 44),
    diagnosticCriteria: z.enum([
      'dipsi',
      'iadpsg',
      'carpenter_coustan',
      'prior_pregestational',
      'clinical_hba1c',
    ]),
    diagnosticDate: z.string().min(1, 'Diagnostic date is required'),
    ogttFastingMgDl: optNullableNumber(30, 500),
    ogtt1hrMgDl: optNullableNumber(30, 500),
    ogtt2hrMgDl: optNullableNumber(30, 500),
    ogtt3hrMgDl: optNullableNumber(30, 500),
    baselineHba1c: optNullableNumber(3, 18),
    whiteClassification: z
      .enum(['a1_diet', 'a2_medication', 'class_b_pregestational', 'class_c', 'class_d'])
      .default('a1_diet'),
    currentManagement: z
      .enum(['medical_nutrition_therapy', 'metformin', 'insulin', 'insulin_plus_metformin'])
      .default('medical_nutrition_therapy'),
    targetFastingMgDl: z.number().min(60).max(140).default(95),
    targetPostprandialMgDl: z.number().min(80).max(200).default(120),
    postprandialWindow: z.enum(['1_hour', '2_hour']).default('2_hour'),
    targetHba1c: z.number().min(4).max(10).default(6.0),
    insulinRegimenType: z
      .enum(['none', 'basal_only', 'bolus_only', 'basal_bolus', 'split_mixed_nph_reg'])
      .default('none'),
    basalInsulinName: optNullableString(100),
    basalUnitsMorning: optNullableNumber(0, 200),
    basalUnitsNight: optNullableNumber(0, 200),
    bolusInsulinName: optNullableString(100),
    bolusUnitsBreakfast: optNullableNumber(0, 100),
    bolusUnitsLunch: optNullableNumber(0, 100),
    bolusUnitsDinner: optNullableNumber(0, 100),
    metforminDoseMgDay: optNullableNumber(0, 3000),
    dietaryCaloriesPrescribed: optNullableNumber(1000, 4500),
    fetalSurveillanceNotes: optNullableString(2000),
    plannedDeliveryWeeks: optNullableNumber(32, 42),
    status: z.enum(['active', 'resolved_postpartum', 'converted_type2']).default('active'),
    notes: optNullableString(2000),
  })
  .strict();

export const patchGdmProfileSchema = z
  .object({
    gestationalAgeWeeks: optNullableNumber(4, 44),
    whiteClassification: z
      .enum(['a1_diet', 'a2_medication', 'class_b_pregestational', 'class_c', 'class_d'])
      .optional(),
    currentManagement: z
      .enum(['medical_nutrition_therapy', 'metformin', 'insulin', 'insulin_plus_metformin'])
      .optional(),
    targetFastingMgDl: z.number().min(60).max(140).optional(),
    targetPostprandialMgDl: z.number().min(80).max(200).optional(),
    postprandialWindow: z.enum(['1_hour', '2_hour']).optional(),
    targetHba1c: z.number().min(4).max(10).optional(),
    insulinRegimenType: z
      .enum(['none', 'basal_only', 'bolus_only', 'basal_bolus', 'split_mixed_nph_reg'])
      .optional(),
    basalInsulinName: optNullableString(100),
    basalUnitsMorning: optNullableNumber(0, 200),
    basalUnitsNight: optNullableNumber(0, 200),
    bolusInsulinName: optNullableString(100),
    bolusUnitsBreakfast: optNullableNumber(0, 100),
    bolusUnitsLunch: optNullableNumber(0, 100),
    bolusUnitsDinner: optNullableNumber(0, 100),
    metforminDoseMgDay: optNullableNumber(0, 3000),
    dietaryCaloriesPrescribed: optNullableNumber(1000, 4500),
    fetalSurveillanceNotes: optNullableString(2000),
    plannedDeliveryWeeks: optNullableNumber(32, 42),
    status: z.enum(['active', 'resolved_postpartum', 'converted_type2']).optional(),
    notes: optNullableString(2000),
  })
  .strict();

export const createGlucoseLogSchema = z
  .object({
    profileId: z.number().int().positive().optional(),
    logDate: z.string().min(8, 'Log date YYYY-MM-DD required'),
    logTime: z.string().min(4, 'Log time HH:MM required'),
    mealSlot: z.enum([
      'fasting',
      'post_breakfast',
      'pre_lunch',
      'post_lunch',
      'pre_dinner',
      'post_dinner',
      'bedtime',
      '3_am_nocturnal',
      'random',
    ]),
    bloodGlucoseMgDl: z.number().min(20).max(600),
    carbsConsumedEstimate: optNullableString(200),
    insulinAdministeredUnits: optNullableNumber(0, 100),
    physicalActivityMin: optNullableNumber(0, 300),
    symptoms: optNullableString(200),
    actionTaken: optNullableString(200),
    source: z.enum(['patient_log', 'ward_nurse_glucometer', 'lab_venous']).default('patient_log'),
    notes: optNullableString(500),
  })
  .strict();

export const batchGlucoseLogSchema = z.object({
  profileId: z.number().int().positive().optional(),
  logs: z.array(createGlucoseLogSchema).min(1, 'At least one reading required'),
});

export const createFetalSurveillanceSchema = z
  .object({
    profileId: z.number().int().positive().optional(),
    assessmentDate: z.string().min(8, 'Assessment date required'),
    gestationalAgeWeeks: optNullableNumber(12, 44),
    estimatedFetalWeightG: optNullableNumber(200, 6500),
    efwPercentile: optNullableNumber(1, 99),
    abdominalCircumferenceMm: optNullableNumber(50, 450),
    acPercentile: optNullableNumber(1, 99),
    amnioticFluidIndexCm: optNullableNumber(0, 50),
    singleDeepestPocketCm: optNullableNumber(0, 25),
    clinicalPlan: optNullableString(1000),
  })
  .strict();

function assertPatientExists(ctx: Ctx, patientId: number) {
  const row = ctx.db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId) as
    | { id: number; full_name: string }
    | undefined;
  if (!row) throw notFound('Patient not found');
  return row;
}

export function registerGestationalDiabetesRoutes(app: FastifyInstance, ctx: Ctx) {
  // GET /api/patients/:id/gdm/profile
  app.get('/api/patients/:id/gdm/profile', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const profile = ctx.db
      .prepare(
        `SELECT p.*, u.full_name as created_by_name, uu.full_name as updated_by_name
         FROM gdm_profiles p
         LEFT JOIN users u ON p.created_by = u.id
         LEFT JOIN users uu ON p.updated_by = uu.id
         WHERE p.patient_id = ?
         ORDER BY (p.status = 'active') DESC, p.id DESC
         LIMIT 1`,
      )
      .get(patientId) as any;

    if (!profile) {
      return { profile: null, summary: null, recentSurveillance: null };
    }

    // Fetch recent glucose logs for analytics
    const logs = ctx.db
      .prepare(
        `SELECT blood_glucose_mg_dl, meal_slot, target_status, log_date, log_time
         FROM gdm_glucose_logs
         WHERE profile_id = ?
         ORDER BY log_date DESC, log_time DESC
         LIMIT 60`,
      )
      .all(profile.id) as Array<{
      blood_glucose_mg_dl: number;
      meal_slot: string;
      target_status: string;
    }>;

    const summary = calculateGlycemicSummary(logs);

    // Latest fetal surveillance
    const recentSurveillance = ctx.db
      .prepare(
        `SELECT s.*, u.full_name as created_by_name
         FROM gdm_fetal_surveillance s
         LEFT JOIN users u ON s.created_by = u.id
         WHERE s.profile_id = ?
         ORDER BY s.assessment_date DESC, s.id DESC
         LIMIT 1`,
      )
      .get(profile.id);

    return { profile, summary, recentSurveillance };
  });

  // POST /api/patients/:id/gdm/profile
  app.post('/api/patients/:id/gdm/profile', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const parseResult = createGdmProfileSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const b = parseResult.data;

    const now = nowIso();

    // If an active profile already exists, mark older ones as resolved or updated
    ctx.db
      .prepare(`UPDATE gdm_profiles SET status = 'resolved_postpartum' WHERE patient_id = ? AND status = 'active'`)
      .run(patientId);

    const res = ctx.db
      .prepare(
        `INSERT INTO gdm_profiles (
          patient_id, gestational_age_weeks, diagnostic_criteria, diagnostic_date,
          ogtt_fasting_mg_dl, ogtt_1hr_mg_dl, ogtt_2hr_mg_dl, ogtt_3hr_mg_dl, baseline_hba1c,
          white_classification, current_management, target_fasting_mg_dl, target_postprandial_mg_dl,
          postprandial_window, target_hba1c, insulin_regimen_type, basal_insulin_name,
          basal_units_morning, basal_units_night, bolus_insulin_name, bolus_units_breakfast,
          bolus_units_lunch, bolus_units_dinner, metformin_dose_mg_day, dietary_calories_prescribed,
          fetal_surveillance_notes, planned_delivery_weeks, status, notes,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )`,
      )
      .run(
        patientId,
        b.gestationalAgeWeeks ?? null,
        b.diagnosticCriteria,
        b.diagnosticDate,
        b.ogttFastingMgDl ?? null,
        b.ogtt1hrMgDl ?? null,
        b.ogtt2hrMgDl ?? null,
        b.ogtt3hrMgDl ?? null,
        b.baselineHba1c ?? null,
        b.whiteClassification,
        b.currentManagement,
        b.targetFastingMgDl,
        b.targetPostprandialMgDl,
        b.postprandialWindow,
        b.targetHba1c,
        b.insulinRegimenType,
        b.basalInsulinName ?? null,
        b.basalUnitsMorning ?? null,
        b.basalUnitsNight ?? null,
        b.bolusInsulinName ?? null,
        b.bolusUnitsBreakfast ?? null,
        b.bolusUnitsLunch ?? null,
        b.bolusUnitsDinner ?? null,
        b.metforminDoseMgDay ?? null,
        b.dietaryCaloriesPrescribed ?? null,
        b.fetalSurveillanceNotes ?? null,
        b.plannedDeliveryWeeks ?? null,
        b.status,
        b.notes ?? null,
        user?.id ?? null,
        user?.id ?? null,
        now,
        now,
      );

    const profileId = Number(res.lastInsertRowid);
    audit(ctx.db, {
      actorId: user?.id ?? null,
      action: 'create_gdm_profile',
      entity: 'gdm_profile',
      entityId: profileId,
      detail: { patientId, profileId, diagnosticCriteria: b.diagnosticCriteria, whiteClassification: b.whiteClassification },
    });

    const created = ctx.db.prepare('SELECT * FROM gdm_profiles WHERE id = ?').get(profileId);
    return { profile: created };
  });

  // PATCH /api/patients/:id/gdm/profile/:profileId
  app.patch('/api/patients/:id/gdm/profile/:profileId', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    const profileId = Number((req.params as { profileId: string }).profileId);
    if (!Number.isInteger(patientId) || !Number.isInteger(profileId)) throw badRequest('Invalid parameters');

    const existing = ctx.db
      .prepare('SELECT * FROM gdm_profiles WHERE id = ? AND patient_id = ?')
      .get(profileId, patientId) as any;
    if (!existing) throw notFound('GDM Profile not found');

    const parseResult = patchGdmProfileSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const b = parseResult.data;

    const updated = {
      gestational_age_weeks: b.gestationalAgeWeeks !== undefined ? b.gestationalAgeWeeks : existing.gestational_age_weeks,
      white_classification: b.whiteClassification ?? existing.white_classification,
      current_management: b.currentManagement ?? existing.current_management,
      target_fasting_mg_dl: b.targetFastingMgDl ?? existing.target_fasting_mg_dl,
      target_postprandial_mg_dl: b.targetPostprandialMgDl ?? existing.target_postprandial_mg_dl,
      postprandial_window: b.postprandialWindow ?? existing.postprandial_window,
      target_hba1c: b.targetHba1c ?? existing.target_hba1c,
      insulin_regimen_type: b.insulinRegimenType ?? existing.insulin_regimen_type,
      basal_insulin_name: b.basalInsulinName !== undefined ? b.basalInsulinName : existing.basal_insulin_name,
      basal_units_morning: b.basalUnitsMorning !== undefined ? b.basalUnitsMorning : existing.basal_units_morning,
      basal_units_night: b.basalUnitsNight !== undefined ? b.basalUnitsNight : existing.basal_units_night,
      bolus_insulin_name: b.bolusInsulinName !== undefined ? b.bolusInsulinName : existing.bolus_insulin_name,
      bolus_units_breakfast: b.bolusUnitsBreakfast !== undefined ? b.bolusUnitsBreakfast : existing.bolus_units_breakfast,
      bolus_units_lunch: b.bolusUnitsLunch !== undefined ? b.bolusUnitsLunch : existing.bolus_units_lunch,
      bolus_units_dinner: b.bolusUnitsDinner !== undefined ? b.bolusUnitsDinner : existing.bolus_units_dinner,
      metformin_dose_mg_day: b.metforminDoseMgDay !== undefined ? b.metforminDoseMgDay : existing.metformin_dose_mg_day,
      dietary_calories_prescribed: b.dietaryCaloriesPrescribed !== undefined ? b.dietaryCaloriesPrescribed : existing.dietary_calories_prescribed,
      fetal_surveillance_notes: b.fetalSurveillanceNotes !== undefined ? b.fetalSurveillanceNotes : existing.fetal_surveillance_notes,
      planned_delivery_weeks: b.plannedDeliveryWeeks !== undefined ? b.plannedDeliveryWeeks : existing.planned_delivery_weeks,
      status: b.status ?? existing.status,
      notes: b.notes !== undefined ? b.notes : existing.notes,
      updated_by: user?.id ?? null,
      updated_at: nowIso(),
    };

    ctx.db
      .prepare(
        `UPDATE gdm_profiles SET
          gestational_age_weeks = ?, white_classification = ?, current_management = ?,
          target_fasting_mg_dl = ?, target_postprandial_mg_dl = ?, postprandial_window = ?,
          target_hba1c = ?, insulin_regimen_type = ?, basal_insulin_name = ?,
          basal_units_morning = ?, basal_units_night = ?, bolus_insulin_name = ?,
          bolus_units_breakfast = ?, bolus_units_lunch = ?, bolus_units_dinner = ?,
          metformin_dose_mg_day = ?, dietary_calories_prescribed = ?,
          fetal_surveillance_notes = ?, planned_delivery_weeks = ?, status = ?, notes = ?,
          updated_by = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        updated.gestational_age_weeks,
        updated.white_classification,
        updated.current_management,
        updated.target_fasting_mg_dl,
        updated.target_postprandial_mg_dl,
        updated.postprandial_window,
        updated.target_hba1c,
        updated.insulin_regimen_type,
        updated.basal_insulin_name,
        updated.basal_units_morning,
        updated.basal_units_night,
        updated.bolus_insulin_name,
        updated.bolus_units_breakfast,
        updated.bolus_units_lunch,
        updated.bolus_units_dinner,
        updated.metformin_dose_mg_day,
        updated.dietary_calories_prescribed,
        updated.fetal_surveillance_notes,
        updated.planned_delivery_weeks,
        updated.status,
        updated.notes,
        updated.updated_by,
        updated.updated_at,
        profileId,
      );

    const saved = ctx.db.prepare('SELECT * FROM gdm_profiles WHERE id = ?').get(profileId);
    return { profile: saved };
  });

  // GET /api/patients/:id/gdm/logs
  app.get('/api/patients/:id/gdm/logs', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const query = req.query as { limit?: string; startDate?: string; endDate?: string; mealSlot?: string };
    const limit = Math.min(Number(query.limit) || 100, 500);

    let sql = `SELECT l.*, u.full_name as recorded_by_name
               FROM gdm_glucose_logs l
               LEFT JOIN users u ON l.recorded_by = u.id
               WHERE l.patient_id = ?`;
    const params: any[] = [patientId];

    if (query.startDate) {
      sql += ' AND l.log_date >= ?';
      params.push(query.startDate);
    }
    if (query.endDate) {
      sql += ' AND l.log_date <= ?';
      params.push(query.endDate);
    }
    if (query.mealSlot) {
      sql += ' AND l.meal_slot = ?';
      params.push(query.mealSlot);
    }

    sql += ' ORDER BY l.log_date DESC, l.log_time DESC LIMIT ?';
    params.push(limit);

    const logs = ctx.db.prepare(sql).all(...params);
    return { logs };
  });

  // POST /api/patients/:id/gdm/logs
  app.post('/api/patients/:id/gdm/logs', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const parseResult = createGlucoseLogSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const b = parseResult.data;

    let profileId = b.profileId;
    let targetFasting = 95;
    let targetPostprandial = 120;
    let postprandialWindow: PostprandialWindow = '2_hour';

    if (!profileId) {
      const activeProf = ctx.db
        .prepare(`SELECT id, target_fasting_mg_dl, target_postprandial_mg_dl, postprandial_window FROM gdm_profiles WHERE patient_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
        .get(patientId) as any;
      if (!activeProf) {
        throw badRequest('No active GDM profile found for patient. Please create a profile first.');
      }
      profileId = activeProf.id;
      targetFasting = Number(activeProf.target_fasting_mg_dl) || 95;
      targetPostprandial = Number(activeProf.target_postprandial_mg_dl) || 120;
      postprandialWindow = activeProf.postprandial_window || '2_hour';
    } else {
      const prof = ctx.db.prepare('SELECT target_fasting_mg_dl, target_postprandial_mg_dl, postprandial_window FROM gdm_profiles WHERE id = ?').get(profileId) as any;
      if (prof) {
        targetFasting = Number(prof.target_fasting_mg_dl) || 95;
        targetPostprandial = Number(prof.target_postprandial_mg_dl) || 120;
        postprandialWindow = prof.postprandial_window || '2_hour';
      }
    }

    const classification = classifyGlucoseReading(
      b.mealSlot as MealSlot,
      b.bloodGlucoseMgDl,
      targetFasting,
      targetPostprandial,
      postprandialWindow,
    );

    const now = nowIso();
    const res = ctx.db
      .prepare(
        `INSERT INTO gdm_glucose_logs (
          profile_id, patient_id, log_date, log_time, meal_slot,
          blood_glucose_mg_dl, target_status, carbs_consumed_estimate,
          insulin_administered_units, physical_activity_min, symptoms,
          action_taken, source, notes, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        profileId as number,
        patientId,
        b.logDate,
        b.logTime,
        b.mealSlot,
        b.bloodGlucoseMgDl,
        classification.status,
        b.carbsConsumedEstimate ?? null,
        b.insulinAdministeredUnits ?? null,
        b.physicalActivityMin ?? null,
        b.symptoms ?? null,
        b.actionTaken ?? null,
        b.source,
        b.notes ?? null,
        user?.id ?? null,
        now,
      );

    const logId = Number(res.lastInsertRowid);
    const created = ctx.db.prepare('SELECT * FROM gdm_glucose_logs WHERE id = ?').get(logId);
    return { log: created, classification };
  });

  // POST /api/patients/:id/gdm/logs/batch
  app.post('/api/patients/:id/gdm/logs/batch', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const parseResult = batchGlucoseLogSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const { profileId: reqProfId, logs } = parseResult.data;

    let profileId = reqProfId;
    let targetFasting = 95;
    let targetPostprandial = 120;
    let postprandialWindow: PostprandialWindow = '2_hour';

    if (!profileId) {
      const activeProf = ctx.db
        .prepare(`SELECT id, target_fasting_mg_dl, target_postprandial_mg_dl, postprandial_window FROM gdm_profiles WHERE patient_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
        .get(patientId) as any;
      if (!activeProf) {
        throw badRequest('No active GDM profile found for patient.');
      }
      profileId = activeProf.id;
      targetFasting = Number(activeProf.target_fasting_mg_dl) || 95;
      targetPostprandial = Number(activeProf.target_postprandial_mg_dl) || 120;
      postprandialWindow = activeProf.postprandial_window || '2_hour';
    }

    const now = nowIso();
    const insertStmt = ctx.db.prepare(
      `INSERT INTO gdm_glucose_logs (
        profile_id, patient_id, log_date, log_time, meal_slot,
        blood_glucose_mg_dl, target_status, carbs_consumed_estimate,
        insulin_administered_units, physical_activity_min, symptoms,
        action_taken, source, notes, recorded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertedIds: number[] = [];
    tx(ctx.db, () => {
      for (const item of logs) {
        const cls = classifyGlucoseReading(
          item.mealSlot as MealSlot,
          item.bloodGlucoseMgDl,
          targetFasting,
          targetPostprandial,
          postprandialWindow,
        );
        const r = insertStmt.run(
          profileId as number,
          patientId,
          item.logDate,
          item.logTime,
          item.mealSlot,
          item.bloodGlucoseMgDl,
          cls.status,
          item.carbsConsumedEstimate ?? null,
          item.insulinAdministeredUnits ?? null,
          item.physicalActivityMin ?? null,
          item.symptoms ?? null,
          item.actionTaken ?? null,
          item.source,
          item.notes ?? null,
          user?.id ?? null,
          now,
        );
        insertedIds.push(Number(r.lastInsertRowid));
      }
    });

    return { insertedCount: insertedIds.length, insertedIds };
  });

  // DELETE /api/patients/:id/gdm/logs/:logId
  app.delete('/api/patients/:id/gdm/logs/:logId', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const patientId = Number((req.params as { id: string }).id);
    const logId = Number((req.params as { logId: string }).logId);
    if (!Number.isInteger(patientId) || !Number.isInteger(logId)) throw badRequest('Invalid parameters');

    const row = ctx.db
      .prepare('SELECT id FROM gdm_glucose_logs WHERE id = ? AND patient_id = ?')
      .get(logId, patientId);
    if (!row) throw notFound('Glucose log not found');

    ctx.db.prepare('DELETE FROM gdm_glucose_logs WHERE id = ?').run(logId);
    return { success: true, deletedId: logId };
  });

  // GET /api/patients/:id/gdm/analytics
  app.get('/api/patients/:id/gdm/analytics', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const logs = ctx.db
      .prepare(
        `SELECT blood_glucose_mg_dl, meal_slot, target_status, log_date, log_time
         FROM gdm_glucose_logs
         WHERE patient_id = ?
         ORDER BY log_date DESC, log_time DESC`,
      )
      .all(patientId) as any[];

    const summary = calculateGlycemicSummary(logs);
    return { summary };
  });

  // POST /api/patients/:id/gdm/surveillance
  app.post('/api/patients/:id/gdm/surveillance', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user as { id: number; username: string } | undefined;
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const parseResult = createFetalSurveillanceSchema.safeParse(req.body);
    if (!parseResult.success) throw badRequest(parseResult.error.message);
    const b = parseResult.data;

    let profileId = b.profileId;
    if (!profileId) {
      const activeProf = ctx.db
        .prepare(`SELECT id FROM gdm_profiles WHERE patient_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
        .get(patientId) as any;
      if (!activeProf) throw badRequest('No active GDM profile found.');
      profileId = activeProf.id;
    }

    const risk = assessMacrosomiaRisk(
      b.acPercentile,
      b.estimatedFetalWeightG,
      b.efwPercentile,
      b.amnioticFluidIndexCm,
    );

    const now = nowIso();
    const res = ctx.db
      .prepare(
        `INSERT INTO gdm_fetal_surveillance (
          profile_id, patient_id, assessment_date, gestational_age_weeks,
          estimated_fetal_weight_g, efw_percentile, abdominal_circumference_mm,
          ac_percentile, amniotic_fluid_index_cm, single_deepest_pocket_cm,
          macrosomia_risk_flag, clinical_plan, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        profileId as number,
        patientId,
        b.assessmentDate,
        b.gestationalAgeWeeks ?? null,
        b.estimatedFetalWeightG ?? null,
        b.efwPercentile ?? null,
        b.abdominalCircumferenceMm ?? null,
        b.acPercentile ?? null,
        b.amnioticFluidIndexCm ?? null,
        b.singleDeepestPocketCm ?? null,
        risk.riskFlag,
        b.clinicalPlan ?? null,
        user?.id ?? null,
        now,
      );

    const id = Number(res.lastInsertRowid);
    const record = ctx.db.prepare('SELECT * FROM gdm_fetal_surveillance WHERE id = ?').get(id);
    return { surveillance: record, riskEvaluation: risk };
  });

  // GET /api/patients/:id/gdm/surveillance
  app.get('/api/patients/:id/gdm/surveillance', async (req: FastifyRequest) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');
    assertPatientExists(ctx, patientId);

    const list = ctx.db
      .prepare(
        `SELECT s.*, u.full_name as created_by_name
         FROM gdm_fetal_surveillance s
         LEFT JOIN users u ON s.created_by = u.id
         WHERE s.patient_id = ?
         ORDER BY s.assessment_date DESC, s.id DESC`,
      )
      .all(patientId);

    return { surveillance: list };
  });
}
