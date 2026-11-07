import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  calculateMaternalCardiacRisk,
  calculateMaternalIcp,
  type MaternalCardiacInput,
  type MaternalIcpInput,
} from '../../web/src/maternalComorbidityEngine.js';

function assertCanManageMaternalComorbidities(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and obstetric nursing staff can manage maternal medical comorbidity records');
  }
  return user;
}

export const maternalCardiacSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentDatetime: z.string().min(1, 'Assessment datetime is required'),
  gestationalAgeWeeks: z.number().min(4).max(44).nullable().optional(),
  cardiacDiagnosis: z.string().min(2, 'Cardiac diagnosis is required'),
  mwhoClass: z.enum(['mwho_I', 'mwho_II', 'mwho_II_III', 'mwho_III', 'mwho_IV']),
  priorCardiacEvent: z.boolean().default(false),
  priorArrhythmia: z.boolean().default(false),
  nyhaClassBaseline: z.enum(['I', 'II', 'III', 'IV']).default('I'),
  leftHeartObstruction: z.boolean().default(false),
  reducedSystemicVentricularFunctionEfLt50: z.boolean().default(false),
  highRiskValveOrAorta: z.boolean().default(false),
  latePregnancyPresentation: z.boolean().default(false),
  monitoringPlanAntepartum: z.string().max(1000).nullable().optional(),
  deliveryModeRecommendation: z.string().default('vaginal_with_assisted_second_stage'),
  anesthesiaRecommendation: z.string().max(1000).nullable().optional(),
  icuPostpartumBedReserved: z.boolean().default(false),
  attendingCardiologistName: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const maternalIcpSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  observationDatetime: z.string().min(1, 'Observation datetime is required'),
  gestationalAgeWeeks: z.number().min(4).max(44),
  pruritusSeverity: z.enum([
    'mild_nocturnal_palms_soles',
    'moderate_continuous',
    'severe_intractable_excoriations',
  ]),
  totalSerumBileAcidsUmolL: z.number().min(0).max(500, 'Serum bile acids required'),
  altUL: z.number().nullable().optional(),
  astUL: z.number().nullable().optional(),
  totalBilirubinMgDl: z.number().nullable().optional(),
  patientWeightKg: z.number().min(30).max(200).default(60),
  fetalSurveillanceIntervalDays: z.number().int().min(1).max(14).default(7),
  status: z.enum(['active_monitoring', 'delivered', 'resolved']).default('active_monitoring'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export function registerMaternalComorbiditiesRoutes(app: FastifyInstance, ctx: Ctx) {
  // --- A. Maternal Cardiac Assessments ---

  // 1. List cardiac assessments
  app.get('/api/maternal-comorbidities/cardiac', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT c.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_obgyn_name
      FROM maternal_cardiac_assessments c
      JOIN patients pat ON c.patient_id = pat.id
      JOIN users u ON c.consultant_obgyn_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND c.patient_id = ?';
      params.push(Number(patientId));
    }

    query += ' ORDER BY c.assessment_datetime DESC, c.id DESC';

    const assessments = ctx.db.prepare(query).all(...params);
    return reply.send({ assessments });
  });

  // 2. Create cardiac assessment
  app.post('/api/maternal-comorbidities/cardiac', async (req, reply) => {
    const user = assertCanManageMaternalComorbidities(req);
    const body = parse(maternalCardiacSchema, req.body);

    const calcInput: MaternalCardiacInput = {
      mwhoClass: body.mwhoClass,
      nyhaClassBaseline: body.nyhaClassBaseline,
      priorCardiacEvent: body.priorCardiacEvent,
      baselineNyhaOrCyanosis: body.nyhaClassBaseline === 'III' || body.nyhaClassBaseline === 'IV',
      highRiskValveOrAorta: body.highRiskValveOrAorta,
      reducedSystemicVentricularFunction: body.reducedSystemicVentricularFunctionEfLt50,
      leftHeartObstruction: body.leftHeartObstruction,
      priorArrhythmia: body.priorArrhythmia,
      latePregnancyPresentation: body.latePregnancyPresentation,
    };

    const calcResult = calculateMaternalCardiacRisk(calcInput);
    const dateCode = (body.assessmentDatetime || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const assessmentCode = `CARDIAC-${dateCode}-${randSuffix}`;

    const stmt = ctx.db.prepare(`
      INSERT INTO maternal_cardiac_assessments (
        patient_id, admission_id, assessment_code, assessment_datetime, gestational_age_weeks,
        cardiac_diagnosis, mwho_class, prior_cardiac_event, prior_arrhythmia, nyha_class_baseline,
        left_heart_obstruction, reduced_systemic_ventricular_function_ef_lt50,
        high_risk_valve_or_aorta, late_pregnancy_presentation, carpreg_ii_score,
        predicted_cardiac_event_risk_pct, monitoring_plan_antepartum, delivery_mode_recommendation,
        anesthesia_recommendation, icu_postpartum_bed_reserved, attending_cardiologist_name,
        consultant_obgyn_id, notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const result = stmt.run(
      body.patientId,
      body.admissionId ?? null,
      assessmentCode,
      body.assessmentDatetime,
      body.gestationalAgeWeeks ?? null,
      body.cardiacDiagnosis,
      body.mwhoClass,
      body.priorCardiacEvent ? 1 : 0,
      body.priorArrhythmia ? 1 : 0,
      body.nyhaClassBaseline,
      body.leftHeartObstruction ? 1 : 0,
      body.reducedSystemicVentricularFunctionEfLt50 ? 1 : 0,
      body.highRiskValveOrAorta ? 1 : 0,
      body.latePregnancyPresentation ? 1 : 0,
      calcResult.carpregIiScore,
      calcResult.predictedEventRiskPct,
      body.monitoringPlanAntepartum ?? calcResult.hemodynamicMonitoringRecommendations.join('; '),
      body.deliveryModeRecommendation || calcResult.recommendedDeliveryMode,
      body.anesthesiaRecommendation ?? calcResult.anesthesiaAdvice.join('; '),
      body.icuPostpartumBedReserved ? 1 : 0,
      body.attendingCardiologistName ?? null,
      user.id,
      body.notes ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_cardiac.assessment_create',
      entity: 'maternal_cardiac_assessments',
      entityId: Number(result.lastInsertRowid),
      detail: {
        assessmentCode,
        patientId: body.patientId,
        mwhoClass: body.mwhoClass,
        carpregScore: calcResult.carpregIiScore,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT c.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as consultant_obgyn_name
         FROM maternal_cardiac_assessments c
         JOIN patients pat ON c.patient_id = pat.id
         JOIN users u ON c.consultant_obgyn_id = u.id
         WHERE c.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ assessment: inserted, calculation: calcResult });
  });

  // 3. Get single cardiac assessment
  app.get('/api/maternal-comorbidities/cardiac/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const assessment = ctx.db
      .prepare(
        `SELECT c.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as consultant_obgyn_name
         FROM maternal_cardiac_assessments c
         JOIN patients pat ON c.patient_id = pat.id
         JOIN users u ON c.consultant_obgyn_id = u.id
         WHERE c.id = ?`
      )
      .get(Number(id));

    if (!assessment) {
      throw notFound('Maternal cardiac assessment not found');
    }

    return reply.send({ assessment });
  });

  // 4. Update cardiac assessment
  app.put('/api/maternal-comorbidities/cardiac/:id', async (req, reply) => {
    const user = assertCanManageMaternalComorbidities(req);
    const { id } = req.params as { id: string };
    const body = parse(maternalCardiacSchema, req.body);

    const existing = ctx.db.prepare('SELECT id, assessment_code FROM maternal_cardiac_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Maternal cardiac assessment not found');
    }

    const calcResult = calculateMaternalCardiacRisk({
      mwhoClass: body.mwhoClass,
      nyhaClassBaseline: body.nyhaClassBaseline,
      priorCardiacEvent: body.priorCardiacEvent,
      baselineNyhaOrCyanosis: body.nyhaClassBaseline === 'III' || body.nyhaClassBaseline === 'IV',
      highRiskValveOrAorta: body.highRiskValveOrAorta,
      reducedSystemicVentricularFunction: body.reducedSystemicVentricularFunctionEfLt50,
      leftHeartObstruction: body.leftHeartObstruction,
      priorArrhythmia: body.priorArrhythmia,
      latePregnancyPresentation: body.latePregnancyPresentation,
    });

    ctx.db
      .prepare(
        `UPDATE maternal_cardiac_assessments
         SET assessment_datetime = ?, gestational_age_weeks = ?, cardiac_diagnosis = ?,
             mwho_class = ?, prior_cardiac_event = ?, prior_arrhythmia = ?, nyha_class_baseline = ?,
             left_heart_obstruction = ?, reduced_systemic_ventricular_function_ef_lt50 = ?,
             high_risk_valve_or_aorta = ?, late_pregnancy_presentation = ?, carpreg_ii_score = ?,
             predicted_cardiac_event_risk_pct = ?, monitoring_plan_antepartum = ?,
             delivery_mode_recommendation = ?, anesthesia_recommendation = ?,
             icu_postpartum_bed_reserved = ?, attending_cardiologist_name = ?, notes = ?
         WHERE id = ?`
      )
      .run(
        body.assessmentDatetime,
        body.gestationalAgeWeeks ?? null,
        body.cardiacDiagnosis,
        body.mwhoClass,
        body.priorCardiacEvent ? 1 : 0,
        body.priorArrhythmia ? 1 : 0,
        body.nyhaClassBaseline,
        body.leftHeartObstruction ? 1 : 0,
        body.reducedSystemicVentricularFunctionEfLt50 ? 1 : 0,
        body.highRiskValveOrAorta ? 1 : 0,
        body.latePregnancyPresentation ? 1 : 0,
        calcResult.carpregIiScore,
        calcResult.predictedEventRiskPct,
        body.monitoringPlanAntepartum ?? null,
        body.deliveryModeRecommendation,
        body.anesthesiaRecommendation ?? null,
        body.icuPostpartumBedReserved ? 1 : 0,
        body.attendingCardiologistName ?? null,
        body.notes ?? null,
        Number(id)
      );

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_cardiac.assessment_update',
      entity: 'maternal_cardiac_assessments',
      entityId: Number(id),
      detail: { assessmentCode: existing.assessment_code, mwhoClass: body.mwhoClass },
    });

    const updated = ctx.db
      .prepare(
        `SELECT c.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                u.full_name as consultant_obgyn_name
         FROM maternal_cardiac_assessments c
         JOIN patients pat ON c.patient_id = pat.id
         JOIN users u ON c.consultant_obgyn_id = u.id
         WHERE c.id = ?`
      )
      .get(Number(id));

    return reply.send({ assessment: updated });
  });

  // 5. Delete cardiac assessment
  app.delete('/api/maternal-comorbidities/cardiac/:id', async (req, reply) => {
    const user = assertCanManageMaternalComorbidities(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT id, assessment_code FROM maternal_cardiac_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Maternal cardiac assessment not found');
    }

    ctx.db.prepare('DELETE FROM maternal_cardiac_assessments WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_cardiac.assessment_delete',
      entity: 'maternal_cardiac_assessments',
      entityId: Number(id),
      detail: { assessmentCode: existing.assessment_code },
    });

    return reply.send({ success: true, message: 'Maternal cardiac assessment deleted' });
  });

  // --- B. Maternal ICP (Intrahepatic Cholestasis) Surveillance ---

  // 6. List ICP surveillance episodes
  app.get('/api/maternal-comorbidities/icp', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT i.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as assessed_by_name
      FROM maternal_icp_surveillance i
      JOIN patients pat ON i.patient_id = pat.id
      JOIN users u ON i.assessed_by_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND i.patient_id = ?';
      params.push(Number(patientId));
    }
    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    query += ' ORDER BY i.observation_datetime DESC, i.id DESC';

    const surveillance = ctx.db.prepare(query).all(...params);
    return reply.send({ surveillance });
  });

  // 7. Create ICP surveillance episode
  app.post('/api/maternal-comorbidities/icp', async (req, reply) => {
    const user = assertCanManageMaternalComorbidities(req);
    const body = parse(maternalIcpSchema, req.body);

    const calcResult = calculateMaternalIcp({
      totalSerumBileAcidsUmolL: body.totalSerumBileAcidsUmolL,
      gestationalAgeWeeks: body.gestationalAgeWeeks,
      patientWeightKg: body.patientWeightKg,
      pruritusSeverity: body.pruritusSeverity,
    });

    const dateCode = (body.observationDatetime || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `ICP-${dateCode}-${randSuffix}`;

    const udcaDoseMgKgDay = Number((calcResult.recommendedUdcaDailyMg / body.patientWeightKg).toFixed(1));

    const stmt = ctx.db.prepare(`
      INSERT INTO maternal_icp_surveillance (
        patient_id, admission_id, episode_code, observation_datetime, gestational_age_weeks,
        pruritus_severity, total_serum_bile_acids_umol_l, icp_severity_tier,
        alt_u_l, ast_u_l, total_bilirubin_mg_dl, udca_prescribed_mg_day,
        udca_dose_mg_kg_day, recommended_delivery_gestation_weeks,
        fetal_surveillance_interval_days, status, assessed_by_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      body.patientId,
      body.admissionId ?? null,
      episodeCode,
      body.observationDatetime,
      body.gestationalAgeWeeks,
      body.pruritusSeverity,
      body.totalSerumBileAcidsUmolL,
      calcResult.severityTier,
      body.altUL ?? null,
      body.astUL ?? null,
      body.totalBilirubinMgDl ?? null,
      calcResult.recommendedUdcaDailyMg,
      udcaDoseMgKgDay,
      calcResult.recommendedDeliveryGestationWeeks,
      calcResult.surveillanceIntervalDays,
      body.status,
      user.id,
      body.clinicalNotes ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_icp.surveillance_create',
      entity: 'maternal_icp_surveillance',
      entityId: Number(result.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: body.patientId,
        bileAcids: body.totalSerumBileAcidsUmolL,
        severityTier: calcResult.severityTier,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT i.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as assessed_by_name
         FROM maternal_icp_surveillance i
         JOIN patients pat ON i.patient_id = pat.id
         JOIN users u ON i.assessed_by_id = u.id
         WHERE i.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ episode: inserted, calculation: calcResult });
  });

  // 8. Get single ICP episode
  app.get('/api/maternal-comorbidities/icp/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = ctx.db
      .prepare(
        `SELECT i.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as assessed_by_name
         FROM maternal_icp_surveillance i
         JOIN patients pat ON i.patient_id = pat.id
         JOIN users u ON i.assessed_by_id = u.id
         WHERE i.id = ?`
      )
      .get(Number(id));

    if (!episode) {
      throw notFound('Maternal ICP surveillance episode not found');
    }

    return reply.send({ episode });
  });

  // 9. Update ICP episode
  app.put('/api/maternal-comorbidities/icp/:id', async (req, reply) => {
    const user = assertCanManageMaternalComorbidities(req);
    const { id } = req.params as { id: string };
    const body = parse(maternalIcpSchema, req.body);

    const existing = ctx.db.prepare('SELECT id, episode_code FROM maternal_icp_surveillance WHERE id = ?').get(Number(id)) as
      | { id: number; episode_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Maternal ICP surveillance episode not found');
    }

    const calcResult = calculateMaternalIcp({
      totalSerumBileAcidsUmolL: body.totalSerumBileAcidsUmolL,
      gestationalAgeWeeks: body.gestationalAgeWeeks,
      patientWeightKg: body.patientWeightKg,
      pruritusSeverity: body.pruritusSeverity,
    });
    const udcaDoseMgKgDay = Number((calcResult.recommendedUdcaDailyMg / body.patientWeightKg).toFixed(1));

    ctx.db
      .prepare(
        `UPDATE maternal_icp_surveillance
         SET observation_datetime = ?, gestational_age_weeks = ?, pruritus_severity = ?,
             total_serum_bile_acids_umol_l = ?, icp_severity_tier = ?, alt_u_l = ?,
             ast_u_l = ?, total_bilirubin_mg_dl = ?, udca_prescribed_mg_day = ?,
             udca_dose_mg_kg_day = ?, recommended_delivery_gestation_weeks = ?,
             fetal_surveillance_interval_days = ?, status = ?, clinical_notes = ?
         WHERE id = ?`
      )
      .run(
        body.observationDatetime,
        body.gestationalAgeWeeks,
        body.pruritusSeverity,
        body.totalSerumBileAcidsUmolL,
        calcResult.severityTier,
        body.altUL ?? null,
        body.astUL ?? null,
        body.totalBilirubinMgDl ?? null,
        calcResult.recommendedUdcaDailyMg,
        udcaDoseMgKgDay,
        calcResult.recommendedDeliveryGestationWeeks,
        calcResult.surveillanceIntervalDays,
        body.status,
        body.clinicalNotes ?? null,
        Number(id)
      );

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_icp.surveillance_update',
      entity: 'maternal_icp_surveillance',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, bileAcids: body.totalSerumBileAcidsUmolL },
    });

    const updated = ctx.db
      .prepare(
        `SELECT i.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                u.full_name as assessed_by_name
         FROM maternal_icp_surveillance i
         JOIN patients pat ON i.patient_id = pat.id
         JOIN users u ON i.assessed_by_id = u.id
         WHERE i.id = ?`
      )
      .get(Number(id));

    return reply.send({ episode: updated });
  });

  // 10. Delete ICP episode
  app.delete('/api/maternal-comorbidities/icp/:id', async (req, reply) => {
    const user = assertCanManageMaternalComorbidities(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT id, episode_code FROM maternal_icp_surveillance WHERE id = ?').get(Number(id)) as
      | { id: number; episode_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Maternal ICP surveillance episode not found');
    }

    ctx.db.prepare('DELETE FROM maternal_icp_surveillance WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_icp.surveillance_delete',
      entity: 'maternal_icp_surveillance',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code },
    });

    return reply.send({ success: true, message: 'ICP surveillance record deleted' });
  });

  // 11. Print audit
  app.post('/api/maternal-comorbidities/:type/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { type, id } = req.params as { type: string; id: string };

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_comorbidities.print',
      entity: type === 'cardiac' ? 'maternal_cardiac_assessments' : 'maternal_icp_surveillance',
      entityId: Number(id),
      detail: { type },
    });

    return reply.send({ success: true, message: 'Maternal comorbidities report print audited' });
  });
}
