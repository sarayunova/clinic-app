import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import { calculateMaternalSepsis, type MaternalSepsisInput } from '../../web/src/maternalSepsisEngine.js';

function assertCanManageMaternalSepsis(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and obstetric nursing staff can manage maternal sepsis records');
  }
  return user;
}

export const maternalSepsisAssessmentSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  assessmentDatetime: z.string().min(1, 'Assessment datetime is required'),
  gestationalAgeWeeks: z.number().min(4).max(44).nullable().optional(),
  postpartumDays: z.number().int().min(0).max(60).nullable().optional(),
  suspectedSource: z.enum([
    'chorioamnionitis_intrauterine',
    'postpartum_endometritis',
    'urinary_tract_pyelonephritis',
    'respiratory_pneumonia',
    'septic_pelvic_thrombophlebitis',
    'surgical_site_cesarean_wound',
    'mastitis_breast_abscess',
    'other_unknown_source',
  ]),
  temperatureCelsius: z.number().min(30.0).max(44.0),
  systolicBpMmhg: z.number().int().min(40).max(260),
  diastolicBpMmhg: z.number().int().min(20).max(180),
  heartRateBpm: z.number().int().min(30).max(240),
  respiratoryRateBpm: z.number().int().min(6).max(60),
  spo2Percent: z.number().min(50).max(100),
  wbcCountPerUl: z.number().nullable().optional(),
  immatureBandsPercent: z.number().nullable().optional(),
  serumLactateMmolL: z.number().nullable().optional(),
  clinicalImpression: z.string().max(1000).nullable().optional(),
});

export const maternalSepsisBundleSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  bloodCulturesDrawn: z.boolean().default(false),
  bloodCulturesDrawnTime: z.string().nullable().optional(),
  ivAntibioticsGiven: z.boolean().default(false),
  antibioticNameRegimen: z.string().max(200).nullable().optional(),
  ivAntibioticsTime: z.string().nullable().optional(),
  antibioticWithin60m: z.boolean().default(false),
  fluidBolus30mlPerKgGiven: z.boolean().default(false),
  fluidBolusVolumeMl: z.number().nullable().optional(),
  norepinephrineVasopressorActive: z.boolean().default(false),
  vasopressorDoseMcgMin: z.number().nullable().optional(),
  repeatLactateMmolL: z.number().nullable().optional(),
  targetMapAchievedGte65: z.boolean().default(false),
  urineOutputMlHr: z.number().nullable().optional(),
  interventionsSummary: z.string().max(500).nullable().optional(),
});

export function registerMaternalSepsisRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List maternal sepsis assessments
  app.get('/api/maternal-sepsis/assessments', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT s.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as assessed_by_name
      FROM maternal_sepsis_assessments s
      JOIN patients pat ON s.patient_id = pat.id
      JOIN users u ON s.assessed_by_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND s.patient_id = ?';
      params.push(Number(patientId));
    }

    query += ' ORDER BY s.assessment_datetime DESC, s.id DESC';

    const assessments = ctx.db.prepare(query).all(...params);
    return reply.send({ assessments });
  });

  // 2. Create maternal sepsis assessment
  app.post('/api/maternal-sepsis/assessments', async (req, reply) => {
    const user = assertCanManageMaternalSepsis(req);
    const body = parse(maternalSepsisAssessmentSchema, req.body);

    const evalInput: MaternalSepsisInput = {
      temperatureCelsius: body.temperatureCelsius,
      systolicBpMmhg: body.systolicBpMmhg,
      diastolicBpMmhg: body.diastolicBpMmhg,
      heartRateBpm: body.heartRateBpm,
      respiratoryRateBpm: body.respiratoryRateBpm,
      spo2Percent: body.spo2Percent,
      wbcCountPerUl: body.wbcCountPerUl ?? undefined,
      immatureBandsPercent: body.immatureBandsPercent ?? undefined,
      serumLactateMmolL: body.serumLactateMmolL ?? undefined,
    };

    const calcResult = calculateMaternalSepsis(evalInput);
    const dateCode = (body.assessmentDatetime || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const assessmentCode = `SEPSIS-${dateCode}-${randSuffix}`;

    const stmt = ctx.db.prepare(`
      INSERT INTO maternal_sepsis_assessments (
        patient_id, admission_id, assessment_code, assessment_datetime, gestational_age_weeks,
        postpartum_days, suspected_source, temperature_celsius, systolic_bp_mmhg,
        diastolic_bp_mmhg, heart_rate_bpm, respiratory_rate_bpm, spo2_percent,
        wbc_count_per_ul, immature_bands_percent, serum_lactate_mmol_l, sos_score,
        sos_risk_level, obstetric_shock_index, shock_index_tier, mean_arterial_pressure_mmhg,
        icu_transfer_recommended, assessed_by_id, clinical_impression
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const result = stmt.run(
      body.patientId,
      body.admissionId ?? null,
      assessmentCode,
      body.assessmentDatetime,
      body.gestationalAgeWeeks ?? null,
      body.postpartumDays ?? null,
      body.suspectedSource,
      body.temperatureCelsius,
      body.systolicBpMmhg,
      body.diastolicBpMmhg,
      body.heartRateBpm,
      body.respiratoryRateBpm,
      body.spo2Percent,
      body.wbcCountPerUl ?? null,
      body.immatureBandsPercent ?? null,
      body.serumLactateMmolL ?? null,
      calcResult.sosScore,
      calcResult.sosRiskLevel,
      calcResult.obstetricShockIndex,
      calcResult.shockIndexTier,
      calcResult.meanArterialPressureMmhg,
      calcResult.icuTransferRecommended ? 1 : 0,
      user.id,
      body.clinicalImpression ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_sepsis.assessment_create',
      entity: 'maternal_sepsis_assessments',
      entityId: Number(result.lastInsertRowid),
      detail: {
        assessmentCode,
        patientId: body.patientId,
        sosScore: calcResult.sosScore,
        shockIndex: calcResult.obstetricShockIndex,
        riskLevel: calcResult.sosRiskLevel,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT s.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as assessed_by_name
         FROM maternal_sepsis_assessments s
         JOIN patients pat ON s.patient_id = pat.id
         JOIN users u ON s.assessed_by_id = u.id
         WHERE s.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ assessment: inserted, calculation: calcResult });
  });

  // 3. Get single assessment with bundle logs
  app.get('/api/maternal-sepsis/assessments/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const assessment = ctx.db
      .prepare(
        `SELECT s.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as assessed_by_name
         FROM maternal_sepsis_assessments s
         JOIN patients pat ON s.patient_id = pat.id
         JOIN users u ON s.assessed_by_id = u.id
         WHERE s.id = ?`
      )
      .get(Number(id));

    if (!assessment) {
      throw notFound('Maternal sepsis assessment not found');
    }

    const bundleLogs = ctx.db
      .prepare(
        `SELECT b.*, u.full_name as logged_by_name
         FROM maternal_sepsis_bundle_logs b
         JOIN users u ON b.logged_by_id = u.id
         WHERE b.sepsis_assessment_id = ?
         ORDER BY b.log_datetime DESC, b.id DESC`
      )
      .all(Number(id));

    return reply.send({ assessment, bundleLogs });
  });

  // 4. Update assessment
  app.put('/api/maternal-sepsis/assessments/:id', async (req, reply) => {
    const user = assertCanManageMaternalSepsis(req);
    const { id } = req.params as { id: string };
    const body = parse(maternalSepsisAssessmentSchema, req.body);

    const existing = ctx.db.prepare('SELECT id, assessment_code FROM maternal_sepsis_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Maternal sepsis assessment not found');
    }

    const calcResult = calculateMaternalSepsis({
      temperatureCelsius: body.temperatureCelsius,
      systolicBpMmhg: body.systolicBpMmhg,
      diastolicBpMmhg: body.diastolicBpMmhg,
      heartRateBpm: body.heartRateBpm,
      respiratoryRateBpm: body.respiratoryRateBpm,
      spo2Percent: body.spo2Percent,
      wbcCountPerUl: body.wbcCountPerUl ?? undefined,
      immatureBandsPercent: body.immatureBandsPercent ?? undefined,
      serumLactateMmolL: body.serumLactateMmolL ?? undefined,
    });

    ctx.db
      .prepare(
        `UPDATE maternal_sepsis_assessments
         SET assessment_datetime = ?, gestational_age_weeks = ?, postpartum_days = ?,
             suspected_source = ?, temperature_celsius = ?, systolic_bp_mmhg = ?,
             diastolic_bp_mmhg = ?, heart_rate_bpm = ?, respiratory_rate_bpm = ?,
             spo2_percent = ?, wbc_count_per_ul = ?, immature_bands_percent = ?,
             serum_lactate_mmol_l = ?, sos_score = ?, sos_risk_level = ?,
             obstetric_shock_index = ?, shock_index_tier = ?, mean_arterial_pressure_mmhg = ?,
             icu_transfer_recommended = ?, clinical_impression = ?
         WHERE id = ?`
      )
      .run(
        body.assessmentDatetime,
        body.gestationalAgeWeeks ?? null,
        body.postpartumDays ?? null,
        body.suspectedSource,
        body.temperatureCelsius,
        body.systolicBpMmhg,
        body.diastolicBpMmhg,
        body.heartRateBpm,
        body.respiratoryRateBpm,
        body.spo2Percent,
        body.wbcCountPerUl ?? null,
        body.immatureBandsPercent ?? null,
        body.serumLactateMmolL ?? null,
        calcResult.sosScore,
        calcResult.sosRiskLevel,
        calcResult.obstetricShockIndex,
        calcResult.shockIndexTier,
        calcResult.meanArterialPressureMmhg,
        calcResult.icuTransferRecommended ? 1 : 0,
        body.clinicalImpression ?? null,
        Number(id)
      );

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_sepsis.assessment_update',
      entity: 'maternal_sepsis_assessments',
      entityId: Number(id),
      detail: { assessmentCode: existing.assessment_code, sosScore: calcResult.sosScore },
    });

    const updated = ctx.db
      .prepare(
        `SELECT s.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                u.full_name as assessed_by_name
         FROM maternal_sepsis_assessments s
         JOIN patients pat ON s.patient_id = pat.id
         JOIN users u ON s.assessed_by_id = u.id
         WHERE s.id = ?`
      )
      .get(Number(id));

    return reply.send({ assessment: updated });
  });

  // 5. Delete assessment
  app.delete('/api/maternal-sepsis/assessments/:id', async (req, reply) => {
    const user = assertCanManageMaternalSepsis(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT id, assessment_code FROM maternal_sepsis_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Maternal sepsis assessment not found');
    }

    ctx.db.prepare('DELETE FROM maternal_sepsis_assessments WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_sepsis.assessment_delete',
      entity: 'maternal_sepsis_assessments',
      entityId: Number(id),
      detail: { assessmentCode: existing.assessment_code },
    });

    return reply.send({ success: true, message: 'Maternal sepsis assessment deleted' });
  });

  // 6. Log Hour-1 Sepsis Bundle checkpoint
  app.post('/api/maternal-sepsis/assessments/:id/bundle', async (req, reply) => {
    const user = assertCanManageMaternalSepsis(req);
    const { id } = req.params as { id: string };
    const body = parse(maternalSepsisBundleSchema, req.body);

    const sepsis = ctx.db.prepare('SELECT id, assessment_code FROM maternal_sepsis_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!sepsis) {
      throw notFound('Maternal sepsis assessment not found');
    }

    const stmt = ctx.db.prepare(`
      INSERT INTO maternal_sepsis_bundle_logs (
        sepsis_assessment_id, log_datetime, blood_cultures_drawn, blood_cultures_drawn_time,
        iv_antibiotics_given, antibiotic_name_regimen, iv_antibiotics_time,
        antibiotic_within_60m, fluid_bolus_30ml_per_kg_given, fluid_bolus_volume_ml,
        norepinephrine_vasopressor_active, vasopressor_dose_mcg_min, repeat_lactate_mmol_l,
        target_map_achieved_gte_65, urine_output_ml_hr, logged_by_id, interventions_summary
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      Number(id),
      body.logDatetime,
      body.bloodCulturesDrawn ? 1 : 0,
      body.bloodCulturesDrawnTime ?? null,
      body.ivAntibioticsGiven ? 1 : 0,
      body.antibioticNameRegimen ?? null,
      body.ivAntibioticsTime ?? null,
      body.antibioticWithin60m ? 1 : 0,
      body.fluidBolus30mlPerKgGiven ? 1 : 0,
      body.fluidBolusVolumeMl ?? null,
      body.norepinephrineVasopressorActive ? 1 : 0,
      body.vasopressorDoseMcgMin ?? null,
      body.repeatLactateMmolL ?? null,
      body.targetMapAchievedGte65 ? 1 : 0,
      body.urineOutputMlHr ?? null,
      user.id,
      body.interventionsSummary ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_sepsis.bundle_log',
      entity: 'maternal_sepsis_bundle_logs',
      entityId: Number(result.lastInsertRowid),
      detail: {
        sepsisAssessmentId: Number(id),
        antibioticsWithin60m: body.antibioticWithin60m,
        fluidBolusGiven: body.fluidBolus30mlPerKgGiven,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT b.*, u.full_name as logged_by_name
         FROM maternal_sepsis_bundle_logs b
         JOIN users u ON b.logged_by_id = u.id
         WHERE b.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ log: inserted });
  });

  // 7. Delete bundle log
  app.delete('/api/maternal-sepsis/bundle/:logId', async (req, reply) => {
    const user = assertCanManageMaternalSepsis(req);
    const { logId } = req.params as { logId: string };

    const existing = ctx.db.prepare('SELECT id, sepsis_assessment_id FROM maternal_sepsis_bundle_logs WHERE id = ?').get(Number(logId)) as
      | { id: number; sepsis_assessment_id: number }
      | undefined;
    if (!existing) {
      throw notFound('Maternal sepsis bundle log not found');
    }

    ctx.db.prepare('DELETE FROM maternal_sepsis_bundle_logs WHERE id = ?').run(Number(logId));

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_sepsis.bundle_delete',
      entity: 'maternal_sepsis_bundle_logs',
      entityId: Number(logId),
      detail: { sepsisAssessmentId: existing.sepsis_assessment_id },
    });

    return reply.send({ success: true, message: 'Maternal sepsis bundle log deleted' });
  });

  // 8. Print audit
  app.post('/api/maternal-sepsis/assessments/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const sepsis = ctx.db.prepare('SELECT id, assessment_code FROM maternal_sepsis_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!sepsis) {
      throw notFound('Maternal sepsis assessment not found');
    }

    audit(ctx.db, {
      actorId: user.id,
      action: 'maternal_sepsis.print',
      entity: 'maternal_sepsis_assessments',
      entityId: Number(id),
      detail: { assessmentCode: sepsis.assessment_code },
    });

    return reply.send({ success: true, message: 'Maternal sepsis resuscitation print audited' });
  });
}
