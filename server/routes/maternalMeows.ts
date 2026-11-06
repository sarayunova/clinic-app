import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManageMeows(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing') && !can(user.role, 'admission:write')) {
    throw forbidden('Only clinical obstetric and nursing staff can manage MEOWS and obstetric sepsis records');
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

export const meowsEpisodeSchema = z
  .object({
    maternityAdmissionId: z.number().int().positive().nullable().optional(),
    episodeType: z.enum(['antenatal', 'intrapartum', 'postpartum', 'post_op_lscs']).default('postpartum'),
    startedAt: z.string().optional(),
    clinicalIndication: optNullableString(500),
    primaryDiagnosis: optNullableString(250),
    highRiskFlags: optNullableString(500),
    status: z.enum(['active_monitoring', 'stepped_down_stable', 'transferred_to_hdu_icu', 'discharged', 'resolved']).default('active_monitoring'),
  })
  .strict();

export const meowsObservationSchema = z
  .object({
    recordedAt: z.string().optional(),
    respiratoryRate: optNullableNumber(5, 80),
    spo2Percent: optNullableNumber(40, 100),
    supplementalO2: z.boolean().default(false),
    o2FlowRateLpm: optNullableNumber(0, 30),
    temperatureC: optNullableNumber(30, 44),
    bpSystolic: optNullableNumber(40, 300),
    bpDiastolic: optNullableNumber(20, 200),
    heartRate: optNullableNumber(30, 250),
    avpuConsciousness: z.enum(['alert', 'voice', 'pain', 'unresponsive', 'confused_agitated']).default('alert'),
    painScore: z.number().int().min(0).max(3).default(0),
    lochiaStatus: z.enum(['normal', 'scant', 'heavy_foul_smelling', 'excessive_clots_hemorrhage']).default('normal'),
    urineOutputMlHr: optNullableNumber(0, 1000),
    proteinuria: z.enum(['nil', 'trace', '1+', '2+', '3+', '4+']).default('nil'),

    actionRequired: optNullableString(500),
    actionTaken: optNullableString(500),
    escalatedToDoctor: z.boolean().default(false),
    escalatedToName: optNullableString(100),

    // Sepsis in Obstetrics Score (SOS)
    suspectedInfectionSite: optNullableString(250),
    serumLactateMmolL: optNullableNumber(0, 30),
    whiteCellCountK: optNullableNumber(0, 100),

    // 1-Hour Sepsis Bundle
    bundleBloodCulturesTaken: z.boolean().default(false),
    bundleLactateDrawn: z.boolean().default(false),
    bundleIvAntibioticsGiven: z.boolean().default(false),
    bundleIvFluidsBolusGiven: z.boolean().default(false),
    bundleOxygenApplied: z.boolean().default(false),
    bundleFoleyUrineHourly: z.boolean().default(false),
    bundleNotes: optNullableString(1000),
  })
  .strict();

function mapEpisodeRow(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    maternityAdmissionId: r.maternity_admission_id,
    episodeType: r.episode_type,
    startedAt: r.started_at,
    clinicalIndication: r.clinical_indication,
    primaryDiagnosis: r.primary_diagnosis,
    highRiskFlags: r.high_risk_flags,
    isActive: Boolean(r.is_active),
    status: r.status,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapObservationRow(r: any) {
  return {
    id: r.id,
    meowsEpisodeId: r.meows_episode_id,
    patientId: r.patient_id,
    recordedAt: r.recorded_at,

    respiratoryRate: r.respiratory_rate,
    rrTrigger: r.rr_trigger,
    spo2Percent: r.spo2_percent,
    spo2Trigger: r.spo2_trigger,
    supplementalO2: Boolean(r.supplemental_o2),
    o2FlowRateLpm: r.o2_flow_rate_lpm,
    temperatureC: r.temperature_c,
    tempTrigger: r.temp_trigger,
    bpSystolic: r.bp_systolic,
    bpDiastolic: r.bp_diastolic,
    bpTrigger: r.bp_trigger,
    heartRate: r.heart_rate,
    hrTrigger: r.hr_trigger,
    avpuConsciousness: r.avpu_consciousness,
    neuroTrigger: r.neuro_trigger,

    painScore: r.pain_score,
    lochiaStatus: r.lochia_status,
    lochiaTrigger: r.lochia_trigger,
    urineOutputMlHr: r.urine_output_ml_hr,
    urineTrigger: r.urine_trigger,
    proteinuria: r.proteinuria,
    proteinuriaTrigger: r.proteinuria_trigger,

    yellowTriggersCount: r.yellow_triggers_count,
    redTriggersCount: r.red_triggers_count,
    overallAlertLevel: r.overall_alert_level,
    actionRequired: r.action_required,
    actionTaken: r.action_taken,
    escalatedToDoctor: Boolean(r.escalated_to_doctor),
    escalatedToName: r.escalated_to_name,

    suspectedInfectionSite: r.suspected_infection_site,
    sosScore: r.sos_score,
    sosRiskLevel: r.sos_risk_level,
    serumLactateMmolL: r.serum_lactate_mmol_l,
    whiteCellCountK: r.white_cell_count_k,

    bundleBloodCulturesTaken: Boolean(r.bundle_blood_cultures_taken),
    bundleLactateDrawn: Boolean(r.bundle_lactate_drawn),
    bundleIvAntibioticsGiven: Boolean(r.bundle_iv_antibiotics_given),
    bundleIvFluidsBolusGiven: Boolean(r.bundle_iv_fluids_bolus_given),
    bundleOxygenApplied: Boolean(r.bundle_oxygen_applied),
    bundleFoleyUrineHourly: Boolean(r.bundle_foley_urine_hourly),
    bundleNotes: r.bundle_notes,

    recordedBy: r.recorded_by,
    recordedByName: r.recorded_by_name,
    createdAt: r.created_at,
  };
}

export function registerMaternalMeowsRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // GET /api/patients/:id/meows-episodes
  app.get('/api/patients/:id/meows-episodes', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const rows = db
      .prepare(
        `SELECT e.*,
                u1.full_name AS created_by_name,
                u2.full_name AS updated_by_name
         FROM maternal_meows_episodes e
         LEFT JOIN users u1 ON u1.id = e.created_by
         LEFT JOIN users u2 ON u2.id = e.updated_by
         WHERE e.patient_id = ?
         ORDER BY e.started_at DESC, e.id DESC`
      )
      .all(patientId) as any[];

    return {
      patientId,
      count: rows.length,
      episodes: rows.map(mapEpisodeRow),
    };
  });

  // GET /api/meows-episodes/:id
  app.get('/api/meows-episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid episode ID');

    const row = db
      .prepare(
        `SELECT e.*,
                u1.full_name AS created_by_name,
                u2.full_name AS updated_by_name,
                pt.full_name AS patient_name,
                pt.patient_number,
                pt.date_of_birth,
                pt.phone AS patient_phone
         FROM maternal_meows_episodes e
         JOIN patients pt ON pt.id = e.patient_id
         LEFT JOIN users u1 ON u1.id = e.created_by
         LEFT JOIN users u2 ON u2.id = e.updated_by
         WHERE e.id = ?`
      )
      .get(id) as any | undefined;

    if (!row) throw notFound('MEOWS episode not found');

    const obsRows = db
      .prepare(
        `SELECT o.*, u.full_name AS recorded_by_name
         FROM maternal_meows_observations o
         LEFT JOIN users u ON u.id = o.recorded_by
         WHERE o.meows_episode_id = ?
         ORDER BY o.recorded_at ASC, o.id ASC`
      )
      .all(id) as any[];

    const base = mapEpisodeRow(row);
    return {
      ...base,
      patientName: row.patient_name,
      patientNumber: row.patient_number,
      dateOfBirth: row.date_of_birth,
      patientPhone: row.patient_phone,
      observations: obsRows.map(mapObservationRow),
    };
  });

  // POST /api/patients/:id/meows-episodes
  app.post('/api/patients/:id/meows-episodes', async (req, reply) => {
    const user = assertCanManageMeows(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(meowsEpisodeSchema, req.body);
    const now = nowIso();
    const startedAt = b.startedAt || now;

    const res = db
      .prepare(
        `INSERT INTO maternal_meows_episodes (
           patient_id, maternity_admission_id, episode_type, started_at,
           clinical_indication, primary_diagnosis, high_risk_flags, is_active, status,
           created_by, updated_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
      )
      .run(
        patientId,
        b.maternityAdmissionId ?? null,
        b.episodeType,
        startedAt,
        b.clinicalIndication ?? null,
        b.primaryDiagnosis ?? null,
        b.highRiskFlags ?? null,
        b.status,
        user.id,
        user.id,
        now,
        now
      );

    const newId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'meows_episode.create',
      entity: 'patient',
      entityId: String(patientId),
      detail: {
        episodeId: newId,
        episodeType: b.episodeType,
        status: b.status,
      },
    });

    const created = db.prepare('SELECT * FROM maternal_meows_episodes WHERE id = ?').get(newId) as any;
    created.created_by_name = user.fullName;
    created.updated_by_name = user.fullName;

    return reply.status(201).send(mapEpisodeRow(created));
  });

  // PUT /api/meows-episodes/:id
  app.put('/api/meows-episodes/:id', async (req) => {
    const user = assertCanManageMeows(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid episode ID');

    const episode = db.prepare('SELECT id, patient_id FROM maternal_meows_episodes WHERE id = ?').get(id) as any | undefined;
    if (!episode) throw notFound('MEOWS episode not found');

    const b = parse(meowsEpisodeSchema, req.body);
    const now = nowIso();

    const isActive = b.status === 'active_monitoring' ? 1 : 0;

    db.prepare(
      `UPDATE maternal_meows_episodes SET
         episode_type = ?,
         clinical_indication = ?,
         primary_diagnosis = ?,
         high_risk_flags = ?,
         status = ?,
         is_active = ?,
         updated_by = ?,
         updated_at = ?
       WHERE id = ?`
    ).run(
      b.episodeType,
      b.clinicalIndication ?? null,
      b.primaryDiagnosis ?? null,
      b.highRiskFlags ?? null,
      b.status,
      isActive,
      user.id,
      now,
      id
    );

    audit(db, {
      actorId: user.id,
      action: 'meows_episode.update',
      entity: 'patient',
      entityId: String(episode.patient_id),
      detail: { episodeId: id, status: b.status },
    });

    const updated = db.prepare('SELECT * FROM maternal_meows_episodes WHERE id = ?').get(id) as any;
    updated.updated_by_name = user.fullName;

    return mapEpisodeRow(updated);
  });

  // POST /api/meows-episodes/:id/observations
  app.post('/api/meows-episodes/:id/observations', async (req, reply) => {
    const user = assertCanManageMeows(req);
    const episodeId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(episodeId) || episodeId <= 0) throw badRequest('Invalid episode ID');

    const episode = db.prepare('SELECT id, patient_id FROM maternal_meows_episodes WHERE id = ?').get(episodeId) as any | undefined;
    if (!episode) throw notFound('MEOWS episode not found');

    const b = parse(meowsObservationSchema, req.body);
    const now = nowIso();
    const recordedAt = b.recordedAt || now;

    // Evaluate individual parameter triggers
    let rrTrigger = 'green';
    if (b.respiratoryRate != null) {
      if (b.respiratoryRate < 10 || b.respiratoryRate > 25) rrTrigger = 'red';
      else if (b.respiratoryRate === 10 || (b.respiratoryRate >= 21 && b.respiratoryRate <= 25)) rrTrigger = 'yellow';
    }

    let spo2Trigger = 'green';
    if (b.spo2Percent != null) {
      if (b.spo2Percent < 94) spo2Trigger = 'red';
      else if (b.spo2Percent <= 95 || (b.supplementalO2 && (b.o2FlowRateLpm ?? 0) <= 2)) spo2Trigger = 'yellow';
    }
    if (b.supplementalO2 && (b.o2FlowRateLpm ?? 0) > 4 && spo2Trigger === 'green') {
      spo2Trigger = 'yellow';
    }

    let tempTrigger = 'green';
    if (b.temperatureC != null) {
      if (b.temperatureC < 35.0 || b.temperatureC >= 38.0) tempTrigger = 'red';
      else if (
        (b.temperatureC >= 35.1 && b.temperatureC <= 35.9) ||
        (b.temperatureC >= 37.5 && b.temperatureC <= 37.9)
      ) {
        tempTrigger = 'yellow';
      }
    }

    let sysTrigger = 'green';
    if (b.bpSystolic != null) {
      if (b.bpSystolic < 90 || b.bpSystolic >= 150) sysTrigger = 'red';
      else if ((b.bpSystolic >= 90 && b.bpSystolic <= 99) || (b.bpSystolic >= 140 && b.bpSystolic <= 149)) sysTrigger = 'yellow';
    }

    let diaTrigger = 'green';
    if (b.bpDiastolic != null) {
      if (b.bpDiastolic < 50 || b.bpDiastolic >= 100) diaTrigger = 'red';
      else if (b.bpDiastolic >= 90 && b.bpDiastolic <= 99) diaTrigger = 'yellow';
    }

    let bpTrigger = 'green';
    if (sysTrigger === 'red' || diaTrigger === 'red') bpTrigger = 'red';
    else if (sysTrigger === 'yellow' || diaTrigger === 'yellow') bpTrigger = 'yellow';

    let hrTrigger = 'green';
    if (b.heartRate != null) {
      if (b.heartRate < 50 || b.heartRate >= 120) hrTrigger = 'red';
      else if ((b.heartRate >= 50 && b.heartRate <= 59) || (b.heartRate >= 100 && b.heartRate <= 119)) hrTrigger = 'yellow';
    }

    let neuroTrigger = 'green';
    if (['pain', 'unresponsive', 'confused_agitated'].includes(b.avpuConsciousness)) neuroTrigger = 'red';
    else if (b.avpuConsciousness === 'voice') neuroTrigger = 'yellow';

    let lochiaTrigger = 'green';
    if (b.lochiaStatus === 'excessive_clots_hemorrhage') lochiaTrigger = 'red';
    else if (b.lochiaStatus === 'heavy_foul_smelling') lochiaTrigger = 'yellow';

    let urineTrigger = 'green';
    if (b.urineOutputMlHr != null) {
      if (b.urineOutputMlHr < 15) urineTrigger = 'red';
      else if (b.urineOutputMlHr < 30) urineTrigger = 'yellow';
    }

    let proteinuriaTrigger = 'green';
    if (['2+', '3+', '4+'].includes(b.proteinuria)) proteinuriaTrigger = 'red';
    else if (b.proteinuria === '1+') proteinuriaTrigger = 'yellow';

    // Count Yellow and Red triggers
    const triggers = [
      rrTrigger,
      spo2Trigger,
      tempTrigger,
      bpTrigger,
      hrTrigger,
      neuroTrigger,
      lochiaTrigger,
      urineTrigger,
      proteinuriaTrigger,
    ];

    const yellowCount = triggers.filter((t) => t === 'yellow').length;
    const redCount = triggers.filter((t) => t === 'red').length;

    let overallAlertLevel = 'normal_green';
    let defaultAction = 'Routine observations every 4 to 6 hours.';
    if (redCount >= 2) {
      overallAlertLevel = 'critical_multiple_red';
      defaultAction = 'CRITICAL OBSTETRIC EMERGENCY: Immediate bedside obstetrician & anesthetist call. Prepare HDU/ICU transfer.';
    } else if (redCount === 1 || yellowCount >= 2) {
      overallAlertLevel = 'urgent_two_yellow_one_red';
      defaultAction = 'URGENT MEDICAL REVIEW: Obstetrician review within 30 minutes. Repeat observations in 30 mins.';
    } else if (yellowCount === 1) {
      overallAlertLevel = 'single_yellow';
      defaultAction = 'Repeat observations within 1 hour. Ward incharge review.';
    }

    // Sepsis in Obstetrics Score (SOS)
    let sosScore = 0;
    if (b.temperatureC != null && (b.temperatureC < 36.0 || b.temperatureC >= 38.0)) sosScore += 1;
    if (b.bpSystolic != null && b.bpSystolic < 90) sosScore += 2;
    if (b.heartRate != null && b.heartRate > 120) sosScore += 1;
    if (b.respiratoryRate != null && b.respiratoryRate > 25) sosScore += 1;
    if (b.spo2Percent != null && b.spo2Percent < 92) sosScore += 2;
    if (b.whiteCellCountK != null && (b.whiteCellCountK > 12 || b.whiteCellCountK < 4)) sosScore += 1;
    if (b.serumLactateMmolL != null) {
      if (b.serumLactateMmolL >= 4.0) sosScore += 2;
      else if (b.serumLactateMmolL >= 2.0) sosScore += 1;
    }

    let sosRiskLevel = 'low';
    if (sosScore >= 6) sosRiskLevel = 'high_septic_shock';
    else if (sosScore >= 4) sosRiskLevel = 'intermediate';

    const res = db
      .prepare(
        `INSERT INTO maternal_meows_observations (
           meows_episode_id, patient_id, recorded_at,
           respiratory_rate, rr_trigger, spo2_percent, spo2_trigger, supplemental_o2, o2_flow_rate_lpm,
           temperature_c, temp_trigger, bp_systolic, bp_diastolic, bp_trigger, heart_rate, hr_trigger,
           avpu_consciousness, neuro_trigger,
           pain_score, lochia_status, lochia_trigger, urine_output_ml_hr, urine_trigger, proteinuria, proteinuria_trigger,
           yellow_triggers_count, red_triggers_count, overall_alert_level, action_required, action_taken,
           escalated_to_doctor, escalated_to_name,
           suspected_infection_site, sos_score, sos_risk_level, serum_lactate_mmol_l, white_cell_count_k,
           bundle_blood_cultures_taken, bundle_lactate_drawn, bundle_iv_antibiotics_given,
           bundle_iv_fluids_bolus_given, bundle_oxygen_applied, bundle_foley_urine_hourly, bundle_notes,
           recorded_by, created_at
         ) VALUES (
           ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?,
           ?, ?,
           ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?
         )`
      )
      .run(
        episodeId,
        episode.patient_id,
        recordedAt,
        b.respiratoryRate ?? null,
        rrTrigger,
        b.spo2Percent ?? null,
        spo2Trigger,
        b.supplementalO2 ? 1 : 0,
        b.o2FlowRateLpm ?? null,
        b.temperatureC ?? null,
        tempTrigger,
        b.bpSystolic ?? null,
        b.bpDiastolic ?? null,
        bpTrigger,
        b.heartRate ?? null,
        hrTrigger,
        b.avpuConsciousness,
        neuroTrigger,
        b.painScore,
        b.lochiaStatus,
        lochiaTrigger,
        b.urineOutputMlHr ?? null,
        urineTrigger,
        b.proteinuria,
        proteinuriaTrigger,
        yellowCount,
        redCount,
        overallAlertLevel,
        b.actionRequired || defaultAction,
        b.actionTaken ?? null,
        b.escalatedToDoctor ? 1 : 0,
        b.escalatedToName ?? null,
        b.suspectedInfectionSite ?? null,
        sosScore,
        sosRiskLevel,
        b.serumLactateMmolL ?? null,
        b.whiteCellCountK ?? null,
        b.bundleBloodCulturesTaken ? 1 : 0,
        b.bundleLactateDrawn ? 1 : 0,
        b.bundleIvAntibioticsGiven ? 1 : 0,
        b.bundleIvFluidsBolusGiven ? 1 : 0,
        b.bundleOxygenApplied ? 1 : 0,
        b.bundleFoleyUrineHourly ? 1 : 0,
        b.bundleNotes ?? null,
        user.id,
        now
      );

    const newObsId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'meows_observation.create',
      entity: 'patient',
      entityId: String(episode.patient_id),
      detail: {
        episodeId,
        observationId: newObsId,
        overallAlertLevel,
        yellowCount,
        redCount,
        sosScore,
      },
    });

    const created = db.prepare('SELECT * FROM maternal_meows_observations WHERE id = ?').get(newObsId) as any;
    created.recorded_by_name = user.fullName;

    return reply.status(201).send(mapObservationRow(created));
  });

  // DELETE /api/meows-episodes/:id
  app.delete('/api/meows-episodes/:id', async (req) => {
    const user = assertCanManageMeows(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid episode ID');

    const episode = db.prepare('SELECT id, patient_id FROM maternal_meows_episodes WHERE id = ?').get(id) as any | undefined;
    if (!episode) throw notFound('MEOWS episode not found');

    db.prepare('DELETE FROM maternal_meows_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'meows_episode.delete',
      entity: 'patient',
      entityId: String(episode.patient_id),
      detail: { episodeId: id },
    });

    return { ok: true, deletedId: id };
  });

  // DELETE /api/meows-observations/:id
  app.delete('/api/meows-observations/:id', async (req) => {
    const user = assertCanManageMeows(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid observation ID');

    const obs = db.prepare('SELECT id, patient_id, meows_episode_id FROM maternal_meows_observations WHERE id = ?').get(id) as any | undefined;
    if (!obs) throw notFound('MEOWS observation not found');

    db.prepare('DELETE FROM maternal_meows_observations WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'meows_observation.delete',
      entity: 'patient',
      entityId: String(obs.patient_id),
      detail: { observationId: id, episodeId: obs.meows_episode_id },
    });

    return { ok: true, deletedId: id };
  });
}
