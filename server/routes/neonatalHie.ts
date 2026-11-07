import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import { evaluateNeonatalHie, type NeonatalHieInput } from '../../web/src/neonatalHieEngine.js';

function assertCanManageHie(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical physicians and neonatal nursing staff can manage neonatal HIE and hypothermia records');
  }
  return user;
}

export const neonatalHieAssessmentSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  birthDatetime: z.string().min(1, 'Birth datetime is required'),
  assessmentDatetime: z.string().min(1, 'Assessment datetime is required'),
  gestationalAgeWeeks: z.number().min(30).max(44),
  birthWeightKg: z.number().min(0.5).max(6.0),
  apgar10m: z.number().min(0).max(10).nullable().optional(),
  resuscitationDurationMinutes: z.number().min(0).max(60).nullable().optional(),
  cordOrArterialPh: z.number().min(6.5).max(7.6).nullable().optional(),
  baseDeficitMmolL: z.number().min(-10).max(40).nullable().optional(),
  levelOfConsciousness: z.enum(['hyperalert', 'lethargic_obtunded', 'stuporous_comatose']),
  muscleTone: z.enum(['normal', 'hypotonic', 'flaccid']),
  primitiveReflexesSuckMoro: z.enum(['normal_exaggerated', 'weak_incomplete', 'absent']),
  autonomicFunction: z.enum(['normal', 'sympathetic_parasympathetic_skew', 'depressed_bradycardia']),
  clinicalSeizuresPresent: z.boolean().default(false),
  coolingDeviceType: z.enum([
    'servo_controlled_cooling_blanket',
    'selective_head_cooling_cap',
    'phase_change_material_mattress',
  ]).default('servo_controlled_cooling_blanket'),
  targetCoreTempCelsius: z.number().min(32.0).max(37.5).default(33.5),
  protocolStatus: z.enum([
    'eligible_pending',
    'cooling_active',
    'rewarming_phase',
    'completed_normothermia',
    'discontinued',
  ]).default('cooling_active'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const ttmFlowsheetLogSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursIntoProtocol: z.number().min(0).max(120),
  phase: z.enum(['induction', 'maintenance_cooling', 'controlled_rewarming', 'post_cooling_normothermia']),
  coreTemperatureCelsius: z.number().min(30.0).max(42.0),
  skinTemperatureCelsius: z.number().min(30.0).max(42.0).nullable().optional(),
  heartRateBpm: z.number().int().min(40).max(240),
  meanArterialPressureMmhg: z.number().nullable().optional(),
  bloodGlucoseMgDl: z.number().nullable().optional(),
  serumPotassiumMeqL: z.number().nullable().optional(),
  aeegBackgroundPattern: z.enum([
    'continuous_normal_voltage_cnv',
    'discontinuous_normal_voltage_dnv',
    'continuous_low_voltage_clv',
    'burst_suppression_bs',
    'flat_trace_ft',
  ]).nullable().optional(),
  aeegSleepWakeCycling: z.boolean().default(false),
  electrographicSeizuresDetected: z.boolean().default(false),
  anticonvulsantAdministered: z.string().max(200).nullable().optional(),
  inotropicSupport: z.string().max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function registerNeonatalHieRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. List HIE assessments
  app.get('/api/neonatal-hie/assessments', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT h.*,
             pat.full_name as patient_name,
             pat.patient_number as patient_uhid,
             pat.date_of_birth as patient_dob,
             u.full_name as consultant_neonatologist_name
      FROM neonatal_hie_assessments h
      JOIN patients pat ON h.patient_id = pat.id
      JOIN users u ON h.consultant_neonatologist_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND h.patient_id = ?';
      params.push(Number(patientId));
    }
    if (status) {
      query += ' AND h.protocol_status = ?';
      params.push(status);
    }

    query += ' ORDER BY h.assessment_datetime DESC, h.id DESC';

    const assessments = ctx.db.prepare(query).all(...params);
    return reply.send({ assessments });
  });

  // 2. Create HIE assessment
  app.post('/api/neonatal-hie/assessments', async (req, reply) => {
    const user = assertCanManageHie(req);
    const body = parse(neonatalHieAssessmentSchema, req.body);

    const birthTime = new Date(body.birthDatetime).getTime();
    const assessTime = new Date(body.assessmentDatetime).getTime();
    const hoursFromBirth = Math.max(0, Number(((assessTime - birthTime) / (3600 * 1000)).toFixed(1)));

    const evalInput: NeonatalHieInput = {
      gestationalAgeWeeks: body.gestationalAgeWeeks,
      birthWeightKg: body.birthWeightKg,
      hoursFromBirth,
      apgar10m: body.apgar10m ?? undefined,
      resuscitationDurationMinutes: body.resuscitationDurationMinutes ?? undefined,
      cordOrArterialPh: body.cordOrArterialPh ?? undefined,
      baseDeficitMmolL: body.baseDeficitMmolL ?? undefined,
      levelOfConsciousness: body.levelOfConsciousness,
      muscleTone: body.muscleTone,
      primitiveReflexesSuckMoro: body.primitiveReflexesSuckMoro,
      autonomicFunction: body.autonomicFunction,
      clinicalSeizuresPresent: body.clinicalSeizuresPresent,
    };

    const evalResult = evaluateNeonatalHie(evalInput);
    const dateCode = (body.assessmentDatetime || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const assessmentCode = `HIE-${dateCode}-${randSuffix}`;

    const stmt = ctx.db.prepare(`
      INSERT INTO neonatal_hie_assessments (
        patient_id, admission_id, assessment_code, birth_datetime, assessment_datetime,
        gestational_age_weeks, birth_weight_kg, apgar_10m, resuscitation_duration_minutes,
        cord_or_arterial_ph, base_deficit_mmol_l, sarnat_stage, level_of_consciousness,
        muscle_tone, primitive_reflexes_suck_moro, autonomic_function, clinical_seizures_present,
        cooling_criteria_met, hours_from_birth_to_cooling, cooling_device_type,
        target_core_temp_celsius, protocol_status, cooling_started_at,
        consultant_neonatologist_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const coolingStartedAt = body.protocolStatus === 'cooling_active' ? body.assessmentDatetime : null;

    const result = stmt.run(
      body.patientId,
      body.admissionId ?? null,
      assessmentCode,
      body.birthDatetime,
      body.assessmentDatetime,
      body.gestationalAgeWeeks,
      body.birthWeightKg,
      body.apgar10m ?? null,
      body.resuscitationDurationMinutes ?? null,
      body.cordOrArterialPh ?? null,
      body.baseDeficitMmolL ?? null,
      evalResult.sarnatStage,
      body.levelOfConsciousness,
      body.muscleTone,
      body.primitiveReflexesSuckMoro,
      body.autonomicFunction,
      body.clinicalSeizuresPresent ? 1 : 0,
      evalResult.isCoolingEligible ? 1 : 0,
      hoursFromBirth,
      body.coolingDeviceType,
      body.targetCoreTempCelsius,
      body.protocolStatus,
      coolingStartedAt,
      user.id,
      body.clinicalNotes ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_hie.assessment_create',
      entity: 'neonatal_hie_assessments',
      entityId: Number(result.lastInsertRowid),
      detail: {
        assessmentCode,
        patientId: body.patientId,
        sarnatStage: evalResult.sarnatStage,
        coolingEligible: evalResult.isCoolingEligible,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT h.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as consultant_neonatologist_name
         FROM neonatal_hie_assessments h
         JOIN patients pat ON h.patient_id = pat.id
         JOIN users u ON h.consultant_neonatologist_id = u.id
         WHERE h.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ assessment: inserted, calculation: evalResult });
  });

  // 3. Get single HIE assessment with TTM flowsheet logs
  app.get('/api/neonatal-hie/assessments/:id', async (req, reply) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const assessment = ctx.db
      .prepare(
        `SELECT h.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                pat.date_of_birth as patient_dob,
                u.full_name as consultant_neonatologist_name
         FROM neonatal_hie_assessments h
         JOIN patients pat ON h.patient_id = pat.id
         JOIN users u ON h.consultant_neonatologist_id = u.id
         WHERE h.id = ?`
      )
      .get(Number(id));

    if (!assessment) {
      throw notFound('Neonatal HIE assessment not found');
    }

    const flowsheetLogs = ctx.db
      .prepare(
        `SELECT f.*, u.full_name as logged_by_name
         FROM neonatal_ttm_flowsheet_logs f
         JOIN users u ON f.logged_by_id = u.id
         WHERE f.hie_assessment_id = ?
         ORDER BY f.hours_into_protocol ASC, f.id ASC`
      )
      .all(Number(id));

    return reply.send({ assessment, flowsheetLogs });
  });

  // 4. Update HIE protocol status (e.g. advance to rewarming, completed, etc.)
  app.put('/api/neonatal-hie/assessments/:id/status', async (req, reply) => {
    const user = assertCanManageHie(req);
    const { id } = req.params as { id: string };
    const schema = z.object({
      status: z.enum([
        'eligible_pending',
        'cooling_active',
        'rewarming_phase',
        'completed_normothermia',
        'discontinued',
      ]),
    });
    const body = parse(schema, req.body);

    const existing = ctx.db.prepare('SELECT id, assessment_code FROM neonatal_hie_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Neonatal HIE assessment not found');
    }

    const nowIso = new Date().toISOString();
    let rewarmingUpdate = '';
    let completedUpdate = '';

    if (body.status === 'rewarming_phase') {
      rewarmingUpdate = `, rewarming_started_at = '${nowIso}'`;
    } else if (body.status === 'completed_normothermia' || body.status === 'discontinued') {
      completedUpdate = `, protocol_completed_at = '${nowIso}'`;
    }

    ctx.db
      .prepare(`UPDATE neonatal_hie_assessments SET protocol_status = ? ${rewarmingUpdate} ${completedUpdate} WHERE id = ?`)
      .run(body.status, Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_hie.assessment_update',
      entity: 'neonatal_hie_assessments',
      entityId: Number(id),
      detail: { assessmentCode: existing.assessment_code, newStatus: body.status },
    });

    const updated = ctx.db
      .prepare(
        `SELECT h.*,
                pat.full_name as patient_name,
                pat.patient_number as patient_uhid,
                u.full_name as consultant_neonatologist_name
         FROM neonatal_hie_assessments h
         JOIN patients pat ON h.patient_id = pat.id
         JOIN users u ON h.consultant_neonatologist_id = u.id
         WHERE h.id = ?`
      )
      .get(Number(id));

    return reply.send({ assessment: updated });
  });

  // 5. Delete HIE assessment
  app.delete('/api/neonatal-hie/assessments/:id', async (req, reply) => {
    const user = assertCanManageHie(req);
    const { id } = req.params as { id: string };

    const existing = ctx.db.prepare('SELECT id, assessment_code FROM neonatal_hie_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!existing) {
      throw notFound('Neonatal HIE assessment not found');
    }

    ctx.db.prepare('DELETE FROM neonatal_hie_assessments WHERE id = ?').run(Number(id));

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_hie.assessment_delete',
      entity: 'neonatal_hie_assessments',
      entityId: Number(id),
      detail: { assessmentCode: existing.assessment_code },
    });

    return reply.send({ success: true, message: 'Neonatal HIE assessment deleted' });
  });

  // 6. Log TTM flowsheet checkpoint
  app.post('/api/neonatal-hie/assessments/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageHie(req);
    const { id } = req.params as { id: string };
    const body = parse(ttmFlowsheetLogSchema, req.body);

    const hie = ctx.db.prepare('SELECT id, assessment_code FROM neonatal_hie_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!hie) {
      throw notFound('Neonatal HIE assessment not found');
    }

    const stmt = ctx.db.prepare(`
      INSERT INTO neonatal_ttm_flowsheet_logs (
        hie_assessment_id, log_datetime, hours_into_protocol, phase, core_temperature_celsius,
        skin_temperature_celsius, heart_rate_bpm, mean_arterial_pressure_mmhg,
        blood_glucose_mg_dl, serum_potassium_meq_l, aeeg_background_pattern,
        aeeg_sleep_wake_cycling, electrographic_seizures_detected,
        anticonvulsant_administered, inotropic_support, logged_by_id, notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      Number(id),
      body.logDatetime,
      body.hoursIntoProtocol,
      body.phase,
      body.coreTemperatureCelsius,
      body.skinTemperatureCelsius ?? null,
      body.heartRateBpm,
      body.meanArterialPressureMmhg ?? null,
      body.bloodGlucoseMgDl ?? null,
      body.serumPotassiumMeqL ?? null,
      body.aeegBackgroundPattern ?? null,
      body.aeegSleepWakeCycling ? 1 : 0,
      body.electrographicSeizuresDetected ? 1 : 0,
      body.anticonvulsantAdministered ?? null,
      body.inotropicSupport ?? null,
      user.id,
      body.notes ?? null
    );

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_ttm.flowsheet_log',
      entity: 'neonatal_ttm_flowsheet_logs',
      entityId: Number(result.lastInsertRowid),
      detail: {
        hieAssessmentId: Number(id),
        coreTemp: body.coreTemperatureCelsius,
        hours: body.hoursIntoProtocol,
        phase: body.phase,
      },
    });

    const inserted = ctx.db
      .prepare(
        `SELECT f.*, u.full_name as logged_by_name
         FROM neonatal_ttm_flowsheet_logs f
         JOIN users u ON f.logged_by_id = u.id
         WHERE f.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    return reply.status(201).send({ log: inserted });
  });

  // 7. Delete TTM flowsheet log
  app.delete('/api/neonatal-hie/flowsheet/:logId', async (req, reply) => {
    const user = assertCanManageHie(req);
    const { logId } = req.params as { logId: string };

    const existing = ctx.db.prepare('SELECT id, hie_assessment_id FROM neonatal_ttm_flowsheet_logs WHERE id = ?').get(Number(logId)) as
      | { id: number; hie_assessment_id: number }
      | undefined;
    if (!existing) {
      throw notFound('TTM flowsheet log not found');
    }

    ctx.db.prepare('DELETE FROM neonatal_ttm_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_ttm.flowsheet_delete',
      entity: 'neonatal_ttm_flowsheet_logs',
      entityId: Number(logId),
      detail: { hieAssessmentId: existing.hie_assessment_id },
    });

    return reply.send({ success: true, message: 'TTM flowsheet log deleted' });
  });

  // 8. Print audit
  app.post('/api/neonatal-hie/assessments/:id/print', async (req, reply) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const hie = ctx.db.prepare('SELECT id, assessment_code FROM neonatal_hie_assessments WHERE id = ?').get(Number(id)) as
      | { id: number; assessment_code: string }
      | undefined;
    if (!hie) {
      throw notFound('Neonatal HIE assessment not found');
    }

    audit(ctx.db, {
      actorId: user.id,
      action: 'neonatal_hie.print',
      entity: 'neonatal_hie_assessments',
      entityId: Number(id),
      detail: { assessmentCode: hie.assessment_code },
    });

    return reply.send({ success: true, message: 'Neonatal HIE flowsheet print audited' });
  });
}
