import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManagePph(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing') && !can(user.role, 'admission:write')) {
    throw forbidden('Only clinical obstetric and nursing staff can manage PPH assessments and resuscitation protocols');
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

export const pphAssessmentSchema = z
  .object({
    maternityAdmissionId: z.number().int().positive().nullable().optional(),
    deliveryMode: z.enum(['vaginal', 'cesarean', 'assisted_vacuum_forceps']).default('vaginal'),
    deliveryTimestamp: z.string().min(1, 'Delivery timestamp is required'),
    assessmentTimestamp: z.string().optional(),
    pphStage: z.enum(['stage_0_routine', 'stage_1_alert', 'stage_2_moderate', 'stage_3_severe_mtp']).default('stage_0_routine'),
    primaryEtiology4t: z.enum(['tone_atony', 'trauma_laceration', 'tissue_retained', 'thrombin_coagulopathy', 'mixed_unclear']).default('tone_atony'),
    etiologyDetails: optNullableString(500),
    uterineTone: z.enum(['well_contracted_firm', 'soft_boggy', 'relaxing_between_massage', 'uncontracted']).default('soft_boggy'),
    
    // QBL Calculator fields
    qblTotalMl: z.number().int().min(0).default(0),
    qblCalibratedDrapeMl: z.number().int().min(0).default(0),
    qblSuctionCanisterMl: z.number().int().min(0).default(0),
    qblSpongesWetWeightG: z.number().int().min(0).default(0),
    qblSpongesDryWeightG: z.number().int().min(0).default(0),
    qblClotsWeighedG: z.number().int().min(0).default(0),
    eblVisualEstimateMl: optNullableNumber(0, 10000),

    // Hemodynamics & Shock Index
    maternalPulse: optNullableNumber(20, 250),
    maternalBpSystolic: optNullableNumber(30, 300),
    maternalBpDiastolic: optNullableNumber(10, 200),
    shockIndex: z.number().min(0).max(10).nullable().optional(),
    shockIndexSeverity: z.enum(['normal', 'early_warning', 'high_risk', 'critical_collapse']).default('normal'),
    meanArterialPressure: optNullableNumber(10, 250),
    spo2Pct: optNullableNumber(0, 100),
    temperatureC: optNullableNumber(30, 45),

    // Medical Resuscitation & Uterotonics
    bimanualCompressionDone: z.boolean().default(false),
    bladderCatheterized: z.boolean().default(false),
    ivAccessTwoWideBore: z.boolean().default(false),
    crystalloidsInfusedMl: z.number().int().min(0).default(0),

    oxytocinGiven: z.boolean().default(false),
    oxytocinDoseRoute: optNullableString(200),

    tranexamicAcidGiven: z.boolean().default(false),
    txaGivenAt: optNullableString(50),

    methylergometrineGiven: z.boolean().default(false),
    methergineContraindicated: z.boolean().default(false),

    carboprostGiven: z.boolean().default(false),
    carboprostDosesCount: z.number().int().min(0).default(0),
    carboprostContraindicated: z.boolean().default(false),

    misoprostolGiven: z.boolean().default(false),
    misoprostolDoseMcg: z.number().int().min(0).default(0),

    // Tamponade & Transfusions
    uterineTamponadeBalloonUsed: z.boolean().default(false),
    balloonFillVolumeMl: z.number().int().min(0).default(0),

    mtpActivated: z.boolean().default(false),
    bloodUnitsTransfused: z.number().int().min(0).default(0),
    ffpUnitsTransfused: z.number().int().min(0).default(0),
    plateletUnitsTransfused: z.number().int().min(0).default(0),
    cryoprecipitateUnitsTransfused: z.number().int().min(0).default(0),

    surgicalIntervention: z.enum([
      'none',
      'compression_sutures_b_lynch',
      'uterine_artery_ligation',
      'internal_iliac_ligation',
      'peripartum_hysterectomy',
      'examination_under_anesthesia'
    ]).default('none'),

    outcomeStatus: z.enum([
      'bleeding_controlled',
      'stable_under_observation',
      'transferred_to_ot',
      'transferred_to_icu',
      'critical_unstable'
    ]).default('bleeding_controlled'),

    attendingObstetrician: optNullableString(100),
    attendingAnesthetist: optNullableString(100),
    nurseInCharge: optNullableString(100),
    notes: optNullableString(2000),
  })
  .strict();

export const timelineEntrySchema = z
  .object({
    loggedAt: z.string().optional(),
    drapeIncrementMl: z.number().int().min(0).default(0),
    spongeIncrementG: z.number().int().min(0).default(0),
    clotsIncrementG: z.number().int().min(0).default(0),
    cumulativeQblMl: z.number().int().min(0),
    pulse: optNullableNumber(20, 250),
    bpSystolic: optNullableNumber(30, 300),
    bpDiastolic: optNullableNumber(10, 200),
    shockIndex: z.number().min(0).max(10).nullable().optional(),
    actionTaken: optNullableString(500),
  })
  .strict();

function mapRow(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    maternityAdmissionId: r.maternity_admission_id,
    deliveryMode: r.delivery_mode,
    deliveryTimestamp: r.delivery_timestamp,
    assessmentTimestamp: r.assessment_timestamp,
    pphStage: r.pph_stage,
    primaryEtiology4t: r.primary_etiology_4t,
    etiologyDetails: r.etiology_details,
    uterineTone: r.uterine_tone,
    qblTotalMl: r.qbl_total_ml,
    qblCalibratedDrapeMl: r.qbl_calibrated_drape_ml,
    qblSuctionCanisterMl: r.qbl_suction_canister_ml,
    qblSpongesWetWeightG: r.qbl_sponges_wet_weight_g,
    qblSpongesDryWeightG: r.qbl_sponges_dry_weight_g,
    qblClotsWeighedG: r.qbl_clots_weighed_g,
    eblVisualEstimateMl: r.ebl_visual_estimate_ml,
    maternalPulse: r.maternal_pulse,
    maternalBpSystolic: r.maternal_bp_systolic,
    maternalBpDiastolic: r.maternal_bp_diastolic,
    shockIndex: r.shock_index,
    shockIndexSeverity: r.shock_index_severity,
    meanArterialPressure: r.mean_arterial_pressure,
    spo2Pct: r.spo2_pct,
    temperatureC: r.temperature_c,
    bimanualCompressionDone: r.bimanual_compression_done === 1,
    bladderCatheterized: r.bladder_catheterized === 1,
    ivAccessTwoWideBore: r.iv_access_two_wide_bore === 1,
    crystalloidsInfusedMl: r.crystalloids_infused_ml,
    oxytocinGiven: r.oxytocin_given === 1,
    oxytocinDoseRoute: r.oxytocin_dose_route,
    tranexamicAcidGiven: r.tranexamic_acid_given === 1,
    txaGivenAt: r.txa_given_at,
    methylergometrineGiven: r.methylergometrine_given === 1,
    methergineContraindicated: r.methergine_contraindicated === 1,
    carboprostGiven: r.carboprost_given === 1,
    carboprostDosesCount: r.carboprost_doses_count,
    carboprostContraindicated: r.carboprost_contraindicated === 1,
    misoprostolGiven: r.misoprostol_given === 1,
    misoprostolDoseMcg: r.misoprostol_dose_mcg,
    uterineTamponadeBalloonUsed: r.uterine_tamponade_balloon_used === 1,
    balloonFillVolumeMl: r.balloon_fill_volume_ml,
    mtpActivated: r.mtp_activated === 1,
    bloodUnitsTransfused: r.blood_units_transfused,
    ffpUnitsTransfused: r.ffp_units_transfused,
    plateletUnitsTransfused: r.platelet_units_transfused,
    cryoprecipitateUnitsTransfused: r.cryoprecipitate_units_transfused,
    surgicalIntervention: r.surgical_intervention,
    outcomeStatus: r.outcome_status,
    attendingObstetrician: r.attending_obstetrician,
    attendingAnesthetist: r.attending_anesthetist,
    nurseInCharge: r.nurse_in_charge,
    notes: r.notes,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerPphResuscitationRoutes(app: FastifyInstance, { db }: Ctx): void {
  // GET /api/patients/:id/pph-assessments
  app.get('/api/patients/:id/pph-assessments', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const rows = db
      .prepare(
        `SELECT p.*,
                u1.full_name AS created_by_name,
                u2.full_name AS updated_by_name
         FROM pph_assessments p
         LEFT JOIN users u1 ON u1.id = p.created_by
         LEFT JOIN users u2 ON u2.id = p.updated_by
         WHERE p.patient_id = ?
         ORDER BY p.assessment_timestamp DESC, p.id DESC`
      )
      .all(patientId) as any[];

    return {
      patientId,
      count: rows.length,
      assessments: rows.map(mapRow),
    };
  });

  // GET /api/pph-assessments/:id
  app.get('/api/pph-assessments/:id', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid assessment ID');

    const row = db
      .prepare(
        `SELECT p.*,
                u1.full_name AS created_by_name,
                u2.full_name AS updated_by_name,
                pt.full_name AS patient_name,
                pt.patient_number,
                pt.date_of_birth,
                pt.phone AS patient_phone,
                ma.blood_group AS patient_blood_group
         FROM pph_assessments p
         JOIN patients pt ON pt.id = p.patient_id
         LEFT JOIN maternity_admissions ma ON ma.id = p.maternity_admission_id
         LEFT JOIN users u1 ON u1.id = p.created_by
         LEFT JOIN users u2 ON u2.id = p.updated_by
         WHERE p.id = ?`
      )
      .get(id) as any | undefined;

    if (!row) throw notFound('PPH assessment not found');

    const timelineRows = db
      .prepare(
        `SELECT t.*, u.full_name AS logged_by_name
         FROM pph_qbl_timeline_entries t
         LEFT JOIN users u ON u.id = t.logged_by
         WHERE t.pph_assessment_id = ?
         ORDER BY t.logged_at ASC, t.id ASC`
      )
      .all(id) as any[];

    const base = mapRow(row);
    return {
      ...base,
      patientName: row.patient_name,
      patientNumber: row.patient_number,
      dateOfBirth: row.date_of_birth,
      patientPhone: row.patient_phone,
      patientBloodGroup: row.patient_blood_group ?? null,
      timelineEntries: timelineRows.map((t) => ({
        id: t.id,
        pphAssessmentId: t.pph_assessment_id,
        loggedAt: t.logged_at,
        drapeIncrementMl: t.drape_increment_ml,
        spongeIncrementG: t.sponge_increment_g,
        clotsIncrementG: t.clots_increment_g,
        cumulativeQblMl: t.cumulative_qbl_ml,
        pulse: t.pulse,
        bpSystolic: t.bp_systolic,
        bpDiastolic: t.bp_diastolic,
        shockIndex: t.shock_index,
        actionTaken: t.action_taken,
        loggedBy: t.logged_by,
        loggedByName: t.logged_by_name,
        createdAt: t.created_at,
      })),
    };
  });

  // POST /api/patients/:id/pph-assessments
  app.post('/api/patients/:id/pph-assessments', async (req, reply) => {
    const user = assertCanManagePph(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(pphAssessmentSchema, req.body);
    const now = nowIso();
    const assessmentTimestamp = b.assessmentTimestamp || now;

    // Auto-calculate QBL if breakdown provided
    let calculatedQbl = b.qblTotalMl;
    const netGauzeBlood = Math.max(0, b.qblSpongesWetWeightG - b.qblSpongesDryWeightG);
    const gravimetric = netGauzeBlood + b.qblClotsWeighedG;
    const volumetric = b.qblCalibratedDrapeMl + b.qblSuctionCanisterMl;
    if (gravimetric + volumetric > 0 && calculatedQbl === 0) {
      calculatedQbl = gravimetric + volumetric;
    }

    // Auto-calculate Shock Index
    let si = b.shockIndex ?? null;
    let siSeverity = b.shockIndexSeverity;
    if (b.maternalPulse && b.maternalBpSystolic && b.maternalBpSystolic > 0) {
      si = Math.round((b.maternalPulse / b.maternalBpSystolic) * 100) / 100;
      if (si < 0.9) siSeverity = 'normal';
      else if (si < 1.0) siSeverity = 'early_warning';
      else if (si < 1.4) siSeverity = 'high_risk';
      else siSeverity = 'critical_collapse';
    }

    // Auto-calculate MAP
    let map = b.meanArterialPressure ?? null;
    if (b.maternalBpSystolic && b.maternalBpDiastolic) {
      map = Math.round(b.maternalBpDiastolic + (b.maternalBpSystolic - b.maternalBpDiastolic) / 3);
    }

    const res = db
      .prepare(
        `INSERT INTO pph_assessments (
           patient_id, maternity_admission_id, delivery_mode, delivery_timestamp, assessment_timestamp,
           pph_stage, primary_etiology_4t, etiology_details, uterine_tone,
           qbl_total_ml, qbl_calibrated_drape_ml, qbl_suction_canister_ml,
           qbl_sponges_wet_weight_g, qbl_sponges_dry_weight_g, qbl_clots_weighed_g, ebl_visual_estimate_ml,
           maternal_pulse, maternal_bp_systolic, maternal_bp_diastolic, shock_index, shock_index_severity,
           mean_arterial_pressure, spo2_pct, temperature_c,
           bimanual_compression_done, bladder_catheterized, iv_access_two_wide_bore, crystalloids_infused_ml,
           oxytocin_given, oxytocin_dose_route, tranexamic_acid_given, txa_given_at,
           methylergometrine_given, methergine_contraindicated, carboprost_given, carboprost_doses_count,
           carboprost_contraindicated, misoprostol_given, misoprostol_dose_mcg,
           uterine_tamponade_balloon_used, balloon_fill_volume_ml, mtp_activated,
           blood_units_transfused, ffp_units_transfused, platelet_units_transfused, cryoprecipitate_units_transfused,
           surgical_intervention, outcome_status,
           attending_obstetrician, attending_anesthetist, nurse_in_charge, notes,
           created_by, updated_by, created_at, updated_at
         ) VALUES (
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?
         )`
      )
      .run(
        patientId,
        b.maternityAdmissionId ?? null,
        b.deliveryMode,
        b.deliveryTimestamp,
        assessmentTimestamp,
        b.pphStage,
        b.primaryEtiology4t,
        b.etiologyDetails ?? null,
        b.uterineTone,
        calculatedQbl,
        b.qblCalibratedDrapeMl,
        b.qblSuctionCanisterMl,
        b.qblSpongesWetWeightG,
        b.qblSpongesDryWeightG,
        b.qblClotsWeighedG,
        b.eblVisualEstimateMl ?? null,
        b.maternalPulse ?? null,
        b.maternalBpSystolic ?? null,
        b.maternalBpDiastolic ?? null,
        si,
        siSeverity,
        map,
        b.spo2Pct ?? null,
        b.temperatureC ?? null,
        b.bimanualCompressionDone ? 1 : 0,
        b.bladderCatheterized ? 1 : 0,
        b.ivAccessTwoWideBore ? 1 : 0,
        b.crystalloidsInfusedMl,
        b.oxytocinGiven ? 1 : 0,
        b.oxytocinDoseRoute ?? null,
        b.tranexamicAcidGiven ? 1 : 0,
        b.txaGivenAt ?? null,
        b.methylergometrineGiven ? 1 : 0,
        b.methergineContraindicated ? 1 : 0,
        b.carboprostGiven ? 1 : 0,
        b.carboprostDosesCount,
        b.carboprostContraindicated ? 1 : 0,
        b.misoprostolGiven ? 1 : 0,
        b.misoprostolDoseMcg,
        b.uterineTamponadeBalloonUsed ? 1 : 0,
        b.balloonFillVolumeMl,
        b.mtpActivated ? 1 : 0,
        b.bloodUnitsTransfused,
        b.ffpUnitsTransfused,
        b.plateletUnitsTransfused,
        b.cryoprecipitateUnitsTransfused,
        b.surgicalIntervention,
        b.outcomeStatus,
        b.attendingObstetrician ?? null,
        b.attendingAnesthetist ?? null,
        b.nurseInCharge ?? null,
        b.notes ?? null,
        user.id,
        user.id,
        now,
        now
      );

    const newId = Number(res.lastInsertRowid);

    // Initial timeline record
    db.prepare(
      `INSERT INTO pph_qbl_timeline_entries (
         pph_assessment_id, logged_at, drape_increment_ml, sponge_increment_g, clots_increment_g,
         cumulative_qbl_ml, pulse, bp_systolic, bp_diastolic, shock_index, action_taken,
         logged_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId,
      assessmentTimestamp,
      b.qblCalibratedDrapeMl,
      netGauzeBlood,
      b.qblClotsWeighedG,
      calculatedQbl,
      b.maternalPulse ?? null,
      b.maternalBpSystolic ?? null,
      b.maternalBpDiastolic ?? null,
      si,
      'Initial QBL & Obstetric Shock Index assessment documented',
      user.id,
      now
    );

    audit(db, {
      actorId: user.id,
      action: 'pph_assessment.create',
      entity: 'patient',
      entityId: patientId,
      detail: {
        assessmentId: newId,
        pphStage: b.pphStage,
        qblTotalMl: calculatedQbl,
        shockIndex: si,
        mtpActivated: b.mtpActivated,
      },
    });

    const created = db.prepare('SELECT * FROM pph_assessments WHERE id = ?').get(newId) as any;
    created.created_by_name = user.fullName;
    created.updated_by_name = user.fullName;

    return reply.status(201).send(mapRow(created));
  });

  // POST /api/pph-assessments/:id/timeline
  app.post('/api/pph-assessments/:id/timeline', async (req, reply) => {
    const user = assertCanManagePph(req);
    const assessmentId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(assessmentId) || assessmentId <= 0) throw badRequest('Invalid assessment ID');

    const assessment = db.prepare('SELECT * FROM pph_assessments WHERE id = ?').get(assessmentId) as any | undefined;
    if (!assessment) throw notFound('PPH assessment not found');

    const b = parse(timelineEntrySchema, req.body);
    const now = nowIso();
    const loggedAt = b.loggedAt || now;

    let si = b.shockIndex ?? null;
    if (b.pulse && b.bpSystolic && b.bpSystolic > 0) {
      si = Math.round((b.pulse / b.bpSystolic) * 100) / 100;
    }

    const res = db
      .prepare(
        `INSERT INTO pph_qbl_timeline_entries (
           pph_assessment_id, logged_at, drape_increment_ml, sponge_increment_g, clots_increment_g,
           cumulative_qbl_ml, pulse, bp_systolic, bp_diastolic, shock_index, action_taken,
           logged_by, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        assessmentId,
        loggedAt,
        b.drapeIncrementMl,
        b.spongeIncrementG,
        b.clotsIncrementG,
        b.cumulativeQblMl,
        b.pulse ?? null,
        b.bpSystolic ?? null,
        b.bpDiastolic ?? null,
        si,
        b.actionTaken ?? null,
        user.id,
        now
      );

    // Update parent assessment cumulative QBL and vitals
    let siSeverity = assessment.shock_index_severity;
    if (si != null) {
      if (si < 0.9) siSeverity = 'normal';
      else if (si < 1.0) siSeverity = 'early_warning';
      else if (si < 1.4) siSeverity = 'high_risk';
      else siSeverity = 'critical_collapse';
    }

    db.prepare(
      `UPDATE pph_assessments SET
         qbl_total_ml = ?,
         maternal_pulse = COALESCE(?, maternal_pulse),
         maternal_bp_systolic = COALESCE(?, maternal_bp_systolic),
         maternal_bp_diastolic = COALESCE(?, maternal_bp_diastolic),
         shock_index = COALESCE(?, shock_index),
         shock_index_severity = ?,
         updated_by = ?,
         updated_at = ?
       WHERE id = ?`
    ).run(
      b.cumulativeQblMl,
      b.pulse ?? null,
      b.bpSystolic ?? null,
      b.bpDiastolic ?? null,
      si,
      siSeverity,
      user.id,
      now,
      assessmentId
    );

    audit(db, {
      actorId: user.id,
      action: 'pph_assessment.timeline_entry',
      entity: 'patient',
      entityId: assessment.patient_id,
      detail: {
        assessmentId,
        timelineId: Number(res.lastInsertRowid),
        cumulativeQblMl: b.cumulativeQblMl,
        shockIndex: si,
      },
    });

    return reply.status(201).send({
      id: Number(res.lastInsertRowid),
      pphAssessmentId: assessmentId,
      loggedAt,
      drapeIncrementMl: b.drapeIncrementMl,
      spongeIncrementG: b.spongeIncrementG,
      clotsIncrementG: b.clotsIncrementG,
      cumulativeQblMl: b.cumulativeQblMl,
      pulse: b.pulse ?? null,
      bpSystolic: b.bpSystolic ?? null,
      bpDiastolic: b.bpDiastolic ?? null,
      shockIndex: si,
      actionTaken: b.actionTaken ?? null,
      loggedBy: user.id,
      loggedByName: user.fullName,
      createdAt: now,
    });
  });

  // DELETE /api/pph-assessments/:id
  app.delete('/api/pph-assessments/:id', async (req) => {
    const user = assertCanManagePph(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid assessment ID');

    const existing = db.prepare('SELECT * FROM pph_assessments WHERE id = ?').get(id) as any | undefined;
    if (!existing) throw notFound('PPH assessment record not found');

    db.prepare('DELETE FROM pph_assessments WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'pph_assessment.delete',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        assessmentId: id,
        qblTotalMl: existing.qbl_total_ml,
      },
    });

    return { ok: true };
  });
}
