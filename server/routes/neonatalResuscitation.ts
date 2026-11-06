import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';

function assertCanManageNeonatal(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing') && !can(user.role, 'admission:write')) {
    throw forbidden('Only clinical pediatric, obstetric, and neonatal nursing staff can manage neonatal resuscitation and NEW-S records');
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

export const neonatalResuscitationSchema = z
  .object({
    babyPatientId: z.number().int().positive().nullable().optional(),
    maternityAdmissionId: z.number().int().positive().nullable().optional(),
    deliveryTimestamp: z.string().min(1, 'Delivery timestamp is required'),
    gestationalAgeWeeks: optNullableNumber(20, 45),
    gestationalAgeDays: optNullableNumber(0, 6),
    birthWeightGrams: optNullableNumber(300, 7000),
    babyGender: z.enum(['female', 'male', 'ambiguous', 'unspecified']).default('unspecified'),
    deliveryMode: z.enum(['vaginal', 'cesarean', 'assisted_vacuum_forceps']).default('vaginal'),
    liquorAppearance: z.enum(['clear', 'meconium_thin', 'meconium_thick', 'blood_stained', 'absent']).default('clear'),

    // APGAR 1 min
    apgar1mHeartRate: z.number().int().min(0).max(2).default(2),
    apgar1mRespiratoryEffort: z.number().int().min(0).max(2).default(2),
    apgar1mMuscleTone: z.number().int().min(0).max(2).default(2),
    apgar1mReflexIrritability: z.number().int().min(0).max(2).default(2),
    apgar1mColor: z.number().int().min(0).max(2).default(1),
    apgar1mTotal: z.number().int().min(0).max(10).default(9),

    // APGAR 5 min
    apgar5mHeartRate: z.number().int().min(0).max(2).default(2),
    apgar5mRespiratoryEffort: z.number().int().min(0).max(2).default(2),
    apgar5mMuscleTone: z.number().int().min(0).max(2).default(2),
    apgar5mReflexIrritability: z.number().int().min(0).max(2).default(2),
    apgar5mColor: z.number().int().min(0).max(2).default(2),
    apgar5mTotal: z.number().int().min(0).max(10).default(10),

    // APGAR 10 min
    apgar10mHeartRate: optNullableNumber(0, 2),
    apgar10mRespiratoryEffort: optNullableNumber(0, 2),
    apgar10mMuscleTone: optNullableNumber(0, 2),
    apgar10mReflexIrritability: optNullableNumber(0, 2),
    apgar10mColor: optNullableNumber(0, 2),
    apgar10mTotal: optNullableNumber(0, 10),

    // Silverman-Anderson Retraction Score (SAS)
    sasThoracoabdominalMovement: z.number().int().min(0).max(2).default(0),
    sasIntercostalRetraction: z.number().int().min(0).max(2).default(0),
    sasXiphoidRetraction: z.number().int().min(0).max(2).default(0),
    sasNaresDilation: z.number().int().min(0).max(2).default(0),
    sasExpiratoryGrunt: z.number().int().min(0).max(2).default(0),
    sasTotalScore: z.number().int().min(0).max(10).default(0),
    sasDistressSeverity: z.enum(['none', 'mild', 'moderate', 'severe']).default('none'),

    // NRP Resuscitation Steps
    initialStepsCompleted: z.boolean().default(true),
    delayedCordClampingSeconds: optNullableNumber(0, 300).default(60),
    temperatureControlMethod: z.enum([
      'skin_to_skin',
      'radiant_warmer',
      'plastic_wrap_preterm',
      'transwarmer_mattress',
      'incubator',
    ]).default('radiant_warmer'),
    initialTemperatureC: optNullableNumber(30, 42),
    meconiumManagement: z.enum([
      'not_applicable',
      'vigorous_routine_care',
      'non_vigorous_bulb_suction',
      'endotracheal_suctioning',
    ]).default('not_applicable'),
    supplementalOxygenGiven: z.boolean().default(false),
    targetFio2Percent: optNullableNumber(21, 100).default(21),
    ppvInitiated: z.boolean().default(false),
    ppvDevice: z.enum(['t_piece_resuscitator', 'self_inflating_bag', 'flow_inflating_bag']).nullable().optional(),
    ppvStartSeconds: optNullableNumber(0, 600),
    mrSopaStepsRequired: z.boolean().default(false),
    laryngealMaskOrEttUsed: z.enum(['none', 'lma_size_1', 'ett_oral', 'ett_nasal']).default('none'),
    chestCompressionsPerformed: z.boolean().default(false),
    chestCompressionsDurationSeconds: optNullableNumber(0, 3600).default(0),
    epinephrineGiven: z.boolean().default(false),
    epinephrineDoseMg: optNullableNumber(0, 5).default(0),
    volumeExpanderGiven: z.boolean().default(false),
    volumeExpanderMl: optNullableNumber(0, 500).default(0),

    // Bedside Glycemia & Disposition
    atRiskHypoglycemia: z.boolean().default(false),
    hypoglycemiaRiskReason: optNullableString(500),
    initialBloodGlucoseMgDl: optNullableNumber(5, 500),
    glucoseManagementAction: z.enum([
      'none',
      'early_breastfeeding',
      'supplemental_formula_ebm',
      'dextrose_10pct_bolus_infusion',
    ]).default('none'),

    primaryResuscitationOutcome: z.enum([
      'routine_maternal_side',
      'postnatal_ward_observation',
      'sncu_level_2',
      'nicu_level_3',
      'neonatal_death',
    ]).default('routine_maternal_side'),
    cordBloodGasPh: optNullableNumber(6.5, 7.8),
    cordBloodGasBe: optNullableNumber(-30, 30),
    pediatricianAttending: optNullableString(100),
    resuscitationNurse: optNullableString(100),
    notes: optNullableString(2000),
  })
  .strict();

export const newsObservationSchema = z
  .object({
    recordedAt: z.string().optional(),
    postnatalAgeHours: optNullableNumber(0, 1000),
    heartRateBpm: optNullableNumber(20, 300),
    hrScore: z.number().int().min(0).max(3).default(0),
    respiratoryRateBpm: optNullableNumber(5, 200),
    rrScore: z.number().int().min(0).max(3).default(0),
    temperatureC: optNullableNumber(30, 43),
    tempScore: z.number().int().min(0).max(3).default(0),
    spo2Percent: optNullableNumber(40, 100),
    spo2Score: z.number().int().min(0).max(3).default(0),
    supplementalOxygen: z.boolean().default(false),
    oxygenScore: z.number().int().min(0).max(3).default(0),
    color: z.enum(['pink', 'acrocyanosis', 'pallor', 'central_cyanosis', 'jaundice_early']).default('pink'),
    colorScore: z.number().int().min(0).max(3).default(0),
    toneNeurology: z.enum(['normal_active', 'mildly_floppy_jittery', 'lethargic_poor_suck', 'severely_hypotonic_seizures']).default('normal_active'),
    toneScore: z.number().int().min(0).max(3).default(0),
    gruntingStridor: z.enum(['none', 'intermittent_audible_stethoscope', 'persistent_audible_naked_ear']).default('none'),
    gruntingScore: z.number().int().min(0).max(3).default(0),
    totalNewsScore: z.number().int().min(0).max(30).default(0),
    alertSeverity: z.enum(['green_low', 'yellow_medium', 'red_high']).default('green_low'),
    bloodGlucoseMgDl: optNullableNumber(5, 500),
    feedingStatus: z.enum(['breastfeeding_well', 'poor_latch', 'expressed_breast_milk', 'formula', 'npo_iv_fluids']).nullable().optional(),
    clinicalActionTaken: optNullableString(500),
  })
  .strict();

function mapEventRow(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    babyPatientId: r.baby_patient_id,
    maternityAdmissionId: r.maternity_admission_id,
    deliveryTimestamp: r.delivery_timestamp,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    birthWeightGrams: r.birth_weight_grams,
    babyGender: r.baby_gender,
    deliveryMode: r.delivery_mode,
    liquorAppearance: r.liquor_appearance,

    apgar1mHeartRate: r.apgar_1m_heart_rate,
    apgar1mRespiratoryEffort: r.apgar_1m_respiratory_effort,
    apgar1mMuscleTone: r.apgar_1m_muscle_tone,
    apgar1mReflexIrritability: r.apgar_1m_reflex_irritability,
    apgar1mColor: r.apgar_1m_color,
    apgar1mTotal: r.apgar_1m_total,

    apgar5mHeartRate: r.apgar_5m_heart_rate,
    apgar5mRespiratoryEffort: r.apgar_5m_respiratory_effort,
    apgar5mMuscleTone: r.apgar_5m_muscle_tone,
    apgar5mReflexIrritability: r.apgar_5m_reflex_irritability,
    apgar5mColor: r.apgar_5m_color,
    apgar5mTotal: r.apgar_5m_total,

    apgar10mHeartRate: r.apgar_10m_heart_rate,
    apgar10mRespiratoryEffort: r.apgar_10m_respiratory_effort,
    apgar10mMuscleTone: r.apgar_10m_muscle_tone,
    apgar10mReflexIrritability: r.apgar_10m_reflex_irritability,
    apgar10mColor: r.apgar_10m_color,
    apgar10mTotal: r.apgar_10m_total,

    sasThoracoabdominalMovement: r.sas_thoracoabdominal_movement,
    sasIntercostalRetraction: r.sas_intercostal_retraction,
    sasXiphoidRetraction: r.sas_xiphoid_retraction,
    sasNaresDilation: r.sas_nares_dilation,
    sasExpiratoryGrunt: r.sas_expiratory_grunt,
    sasTotalScore: r.sas_total_score,
    sasDistressSeverity: r.sas_distress_severity,

    initialStepsCompleted: Boolean(r.initial_steps_completed),
    delayedCordClampingSeconds: r.delayed_cord_clamping_seconds,
    temperatureControlMethod: r.temperature_control_method,
    initialTemperatureC: r.initial_temperature_c,
    meconiumManagement: r.meconium_management,
    supplementalOxygenGiven: Boolean(r.supplemental_oxygen_given),
    targetFio2Percent: r.target_fio2_percent,
    ppvInitiated: Boolean(r.ppv_initiated),
    ppvDevice: r.ppv_device,
    ppvStartSeconds: r.ppv_start_seconds,
    mrSopaStepsRequired: Boolean(r.mr_sopa_steps_required),
    laryngealMaskOrEttUsed: r.laryngeal_mask_or_ett_used,
    chestCompressionsPerformed: Boolean(r.chest_compressions_performed),
    chestCompressionsDurationSeconds: r.chest_compressions_duration_seconds,
    epinephrineGiven: Boolean(r.epinephrine_given),
    epinephrineDoseMg: r.epinephrine_dose_mg,
    volumeExpanderGiven: Boolean(r.volume_expander_given),
    volumeExpanderMl: r.volume_expander_ml,

    atRiskHypoglycemia: Boolean(r.at_risk_hypoglycemia),
    hypoglycemiaRiskReason: r.hypoglycemia_risk_reason,
    initialBloodGlucoseMgDl: r.initial_blood_glucose_mg_dl,
    glucoseManagementAction: r.glucose_management_action,

    primaryResuscitationOutcome: r.primary_resuscitation_outcome,
    cordBloodGasPh: r.cord_blood_gas_ph,
    cordBloodGasBe: r.cord_blood_gas_be,
    pediatricianAttending: r.pediatrician_attending,
    resuscitationNurse: r.resuscitation_nurse,
    notes: r.notes,

    createdBy: r.created_by,
    createdByName: r.created_by_name,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapNewsRow(r: any) {
  return {
    id: r.id,
    resuscitationEventId: r.resuscitation_event_id,
    patientId: r.patient_id,
    recordedAt: r.recorded_at,
    postnatalAgeHours: r.postnatal_age_hours,
    heartRateBpm: r.heart_rate_bpm,
    hrScore: r.hr_score,
    respiratoryRateBpm: r.respiratory_rate_bpm,
    rrScore: r.rr_score,
    temperatureC: r.temperature_c,
    tempScore: r.temp_score,
    spo2Percent: r.spo2_percent,
    spo2Score: r.spo2_score,
    supplementalOxygen: Boolean(r.supplemental_oxygen),
    oxygenScore: r.oxygen_score,
    color: r.color,
    colorScore: r.color_score,
    toneNeurology: r.tone_neurology,
    toneScore: r.tone_score,
    gruntingStridor: r.grunting_stridor,
    gruntingScore: r.grunting_score,
    totalNewsScore: r.total_news_score,
    alertSeverity: r.alert_severity,
    bloodGlucoseMgDl: r.blood_glucose_mg_dl,
    feedingStatus: r.feeding_status,
    clinicalActionTaken: r.clinical_action_taken,
    recordedBy: r.recorded_by,
    recordedByName: r.recorded_by_name,
    createdAt: r.created_at,
  };
}

export function registerNeonatalResuscitationRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // GET /api/patients/:id/neonatal-resuscitations
  app.get('/api/patients/:id/neonatal-resuscitations', async (req) => {
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
         FROM neonatal_resuscitation_events e
         LEFT JOIN users u1 ON u1.id = e.created_by
         LEFT JOIN users u2 ON u2.id = e.updated_by
         WHERE e.patient_id = ? OR e.baby_patient_id = ?
         ORDER BY e.delivery_timestamp DESC, e.id DESC`
      )
      .all(patientId, patientId) as any[];

    return {
      patientId,
      count: rows.length,
      events: rows.map(mapEventRow),
    };
  });

  // GET /api/neonatal-resuscitations/:id
  app.get('/api/neonatal-resuscitations/:id', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid event ID');

    const row = db
      .prepare(
        `SELECT e.*,
                u1.full_name AS created_by_name,
                u2.full_name AS updated_by_name,
                pt.full_name AS mother_name,
                pt.patient_number AS mother_patient_number,
                bp.full_name AS baby_name,
                bp.patient_number AS baby_patient_number
         FROM neonatal_resuscitation_events e
         JOIN patients pt ON pt.id = e.patient_id
         LEFT JOIN patients bp ON bp.id = e.baby_patient_id
         LEFT JOIN users u1 ON u1.id = e.created_by
         LEFT JOIN users u2 ON u2.id = e.updated_by
         WHERE e.id = ?`
      )
      .get(id) as any | undefined;

    if (!row) throw notFound('Neonatal resuscitation event not found');

    const newsRows = db
      .prepare(
        `SELECT n.*, u.full_name AS recorded_by_name
         FROM neonatal_news_observations n
         LEFT JOIN users u ON u.id = n.recorded_by
         WHERE n.resuscitation_event_id = ?
         ORDER BY n.recorded_at ASC, n.id ASC`
      )
      .all(id) as any[];

    const base = mapEventRow(row);
    return {
      ...base,
      motherName: row.mother_name,
      motherPatientNumber: row.mother_patient_number,
      babyName: row.baby_name ?? null,
      babyPatientNumber: row.baby_patient_number ?? null,
      newsObservations: newsRows.map(mapNewsRow),
    };
  });

  // POST /api/patients/:id/neonatal-resuscitations
  app.post('/api/patients/:id/neonatal-resuscitations', async (req, reply) => {
    const user = assertCanManageNeonatal(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(neonatalResuscitationSchema, req.body);
    const now = nowIso();

    // Auto-calculate APGAR totals if components present
    const apgar1mTotal = b.apgar1mHeartRate + b.apgar1mRespiratoryEffort + b.apgar1mMuscleTone + b.apgar1mReflexIrritability + b.apgar1mColor;
    const apgar5mTotal = b.apgar5mHeartRate + b.apgar5mRespiratoryEffort + b.apgar5mMuscleTone + b.apgar5mReflexIrritability + b.apgar5mColor;

    let apgar10mTotal: number | null = null;
    if (b.apgar10mHeartRate != null && b.apgar10mRespiratoryEffort != null) {
      apgar10mTotal = (b.apgar10mHeartRate ?? 0) +
        (b.apgar10mRespiratoryEffort ?? 0) +
        (b.apgar10mMuscleTone ?? 0) +
        (b.apgar10mReflexIrritability ?? 0) +
        (b.apgar10mColor ?? 0);
    }

    // Auto-calculate Silverman-Anderson Score
    const sasTotal = b.sasThoracoabdominalMovement + b.sasIntercostalRetraction + b.sasXiphoidRetraction + b.sasNaresDilation + b.sasExpiratoryGrunt;
    let sasDistress = b.sasDistressSeverity;
    if (sasTotal === 0) sasDistress = 'none';
    else if (sasTotal <= 3) sasDistress = 'mild';
    else if (sasTotal <= 6) sasDistress = 'moderate';
    else sasDistress = 'severe';

    const res = db
      .prepare(
        `INSERT INTO neonatal_resuscitation_events (
           patient_id, baby_patient_id, maternity_admission_id, delivery_timestamp,
           gestational_age_weeks, gestational_age_days, birth_weight_grams, baby_gender, delivery_mode, liquor_appearance,
           apgar_1m_heart_rate, apgar_1m_respiratory_effort, apgar_1m_muscle_tone, apgar_1m_reflex_irritability, apgar_1m_color, apgar_1m_total,
           apgar_5m_heart_rate, apgar_5m_respiratory_effort, apgar_5m_muscle_tone, apgar_5m_reflex_irritability, apgar_5m_color, apgar_5m_total,
           apgar_10m_heart_rate, apgar_10m_respiratory_effort, apgar_10m_muscle_tone, apgar_10m_reflex_irritability, apgar_10m_color, apgar_10m_total,
           sas_thoracoabdominal_movement, sas_intercostal_retraction, sas_xiphoid_retraction, sas_nares_dilation, sas_expiratory_grunt, sas_total_score, sas_distress_severity,
           initial_steps_completed, delayed_cord_clamping_seconds, temperature_control_method, initial_temperature_c, meconium_management,
           supplemental_oxygen_given, target_fio2_percent, ppv_initiated, ppv_device, ppv_start_seconds,
           mr_sopa_steps_required, laryngeal_mask_or_ett_used, chest_compressions_performed, chest_compressions_duration_seconds,
           epinephrine_given, epinephrine_dose_mg, volume_expander_given, volume_expander_ml,
           at_risk_hypoglycemia, hypoglycemia_risk_reason, initial_blood_glucose_mg_dl, glucose_management_action,
           primary_resuscitation_outcome, cord_blood_gas_ph, cord_blood_gas_be,
           pediatrician_attending, resuscitation_nurse, notes,
           created_by, updated_by, created_at, updated_at
         ) VALUES (
           ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?
         )`
      )
      .run(
        patientId,
        b.babyPatientId ?? null,
        b.maternityAdmissionId ?? null,
        b.deliveryTimestamp,
        b.gestationalAgeWeeks ?? null,
        b.gestationalAgeDays ?? null,
        b.birthWeightGrams ?? null,
        b.babyGender,
        b.deliveryMode,
        b.liquorAppearance,

        b.apgar1mHeartRate,
        b.apgar1mRespiratoryEffort,
        b.apgar1mMuscleTone,
        b.apgar1mReflexIrritability,
        b.apgar1mColor,
        apgar1mTotal,

        b.apgar5mHeartRate,
        b.apgar5mRespiratoryEffort,
        b.apgar5mMuscleTone,
        b.apgar5mReflexIrritability,
        b.apgar5mColor,
        apgar5mTotal,

        b.apgar10mHeartRate ?? null,
        b.apgar10mRespiratoryEffort ?? null,
        b.apgar10mMuscleTone ?? null,
        b.apgar10mReflexIrritability ?? null,
        b.apgar10mColor ?? null,
        apgar10mTotal,

        b.sasThoracoabdominalMovement,
        b.sasIntercostalRetraction,
        b.sasXiphoidRetraction,
        b.sasNaresDilation,
        b.sasExpiratoryGrunt,
        sasTotal,
        sasDistress,

        b.initialStepsCompleted ? 1 : 0,
        b.delayedCordClampingSeconds ?? null,
        b.temperatureControlMethod,
        b.initialTemperatureC ?? null,
        b.meconiumManagement,

        b.supplementalOxygenGiven ? 1 : 0,
        b.targetFio2Percent ?? 21,
        b.ppvInitiated ? 1 : 0,
        b.ppvDevice ?? null,
        b.ppvStartSeconds ?? null,

        b.mrSopaStepsRequired ? 1 : 0,
        b.laryngealMaskOrEttUsed,
        b.chestCompressionsPerformed ? 1 : 0,
        b.chestCompressionsDurationSeconds ?? 0,

        b.epinephrineGiven ? 1 : 0,
        b.epinephrineDoseMg ?? 0,
        b.volumeExpanderGiven ? 1 : 0,
        b.volumeExpanderMl ?? 0,

        b.atRiskHypoglycemia ? 1 : 0,
        b.hypoglycemiaRiskReason ?? null,
        b.initialBloodGlucoseMgDl ?? null,
        b.glucoseManagementAction,

        b.primaryResuscitationOutcome,
        b.cordBloodGasPh ?? null,
        b.cordBloodGasBe ?? null,

        b.pediatricianAttending ?? null,
        b.resuscitationNurse ?? null,
        b.notes ?? null,

        user.id,
        user.id,
        now,
        now
      );

    const newId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_resuscitation.create',
      entity: 'patient',
      entityId: String(patientId),
      detail: {
        eventId: newId,
        apgar1m: apgar1mTotal,
        apgar5m: apgar5mTotal,
        sasScore: sasTotal,
        ppvInitiated: b.ppvInitiated,
        outcome: b.primaryResuscitationOutcome,
      },
    });

    const created = db.prepare('SELECT * FROM neonatal_resuscitation_events WHERE id = ?').get(newId) as any;
    created.created_by_name = user.fullName;
    created.updated_by_name = user.fullName;

    return reply.status(201).send(mapEventRow(created));
  });

  // POST /api/neonatal-resuscitations/:id/news
  app.post('/api/neonatal-resuscitations/:id/news', async (req, reply) => {
    const user = assertCanManageNeonatal(req);
    const eventId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(eventId) || eventId <= 0) throw badRequest('Invalid event ID');

    const event = db.prepare('SELECT id, patient_id FROM neonatal_resuscitation_events WHERE id = ?').get(eventId) as any | undefined;
    if (!event) throw notFound('Neonatal resuscitation event not found');

    const b = parse(newsObservationSchema, req.body);
    const now = nowIso();
    const recordedAt = b.recordedAt || now;

    // Auto-calculate NEW-S score component values
    let hrScore = b.hrScore;
    if (b.heartRateBpm != null) {
      if (b.heartRateBpm < 100 || b.heartRateBpm > 180) hrScore = 3;
      else if (b.heartRateBpm <= 109 || b.heartRateBpm >= 161) hrScore = 1;
      else hrScore = 0;
    }

    let rrScore = b.rrScore;
    if (b.respiratoryRateBpm != null) {
      if (b.respiratoryRateBpm < 30 || b.respiratoryRateBpm > 80) rrScore = 3;
      else if (b.respiratoryRateBpm <= 39 || b.respiratoryRateBpm >= 61) rrScore = 1;
      else rrScore = 0;
    }

    let tempScore = b.tempScore;
    if (b.temperatureC != null) {
      if (b.temperatureC < 36.0 || b.temperatureC >= 38.0) tempScore = 3;
      else if (b.temperatureC <= 36.4 || b.temperatureC >= 37.6) tempScore = 1;
      else tempScore = 0;
    }

    let spo2Score = b.spo2Score;
    if (b.spo2Percent != null) {
      if (b.spo2Percent < 90) spo2Score = 3;
      else if (b.spo2Percent <= 94) spo2Score = 1;
      else spo2Score = 0;
    }

    const oxygenScore = b.supplementalOxygen ? 3 : 0;

    let colorScore = 0;
    if (b.color === 'acrocyanosis') colorScore = 1;
    else if (b.color === 'pallor' || b.color === 'central_cyanosis' || b.color === 'jaundice_early') colorScore = 3;

    let toneScore = 0;
    if (b.toneNeurology === 'mildly_floppy_jittery') toneScore = 1;
    else if (b.toneNeurology === 'lethargic_poor_suck') toneScore = 2;
    else if (b.toneNeurology === 'severely_hypotonic_seizures') toneScore = 3;

    let gruntingScore = 0;
    if (b.gruntingStridor === 'intermittent_audible_stethoscope') gruntingScore = 1;
    else if (b.gruntingStridor === 'persistent_audible_naked_ear') gruntingScore = 3;

    const totalNewsScore = hrScore + rrScore + tempScore + spo2Score + oxygenScore + colorScore + toneScore + gruntingScore;

    const hasRedFlag = [hrScore, rrScore, tempScore, spo2Score, oxygenScore, colorScore, toneScore, gruntingScore].some(s => s >= 3);
    let alertSeverity: 'green_low' | 'yellow_medium' | 'red_high' = 'green_low';
    if (totalNewsScore >= 4 || hasRedFlag) alertSeverity = 'red_high';
    else if (totalNewsScore >= 2) alertSeverity = 'yellow_medium';

    const res = db
      .prepare(
        `INSERT INTO neonatal_news_observations (
           resuscitation_event_id, patient_id, recorded_at, postnatal_age_hours,
           heart_rate_bpm, hr_score, respiratory_rate_bpm, rr_score,
           temperature_c, temp_score, spo2_percent, spo2_score,
           supplemental_oxygen, oxygen_score, color, color_score,
           tone_neurology, tone_score, grunting_stridor, grunting_score,
           total_news_score, alert_severity, blood_glucose_mg_dl, feeding_status,
           clinical_action_taken, recorded_by, created_at
         ) VALUES (
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?
         )`
      )
      .run(
        eventId,
        event.patient_id,
        recordedAt,
        b.postnatalAgeHours ?? null,
        b.heartRateBpm ?? null,
        hrScore,
        b.respiratoryRateBpm ?? null,
        rrScore,
        b.temperatureC ?? null,
        tempScore,
        b.spo2Percent ?? null,
        spo2Score,
        b.supplementalOxygen ? 1 : 0,
        oxygenScore,
        b.color,
        colorScore,
        b.toneNeurology,
        toneScore,
        b.gruntingStridor,
        gruntingScore,
        totalNewsScore,
        alertSeverity,
        b.bloodGlucoseMgDl ?? null,
        b.feedingStatus ?? null,
        b.clinicalActionTaken ?? null,
        user.id,
        now
      );

    const newNewsId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_news.observation',
      entity: 'patient',
      entityId: String(event.patient_id),
      detail: {
        eventId,
        newsObservationId: newNewsId,
        totalNewsScore,
        alertSeverity,
      },
    });

    const created = db.prepare('SELECT * FROM neonatal_news_observations WHERE id = ?').get(newNewsId) as any;
    created.recorded_by_name = user.fullName;

    return reply.status(201).send(mapNewsRow(created));
  });

  // DELETE /api/neonatal-resuscitations/:id
  app.delete('/api/neonatal-resuscitations/:id', async (req) => {
    const user = assertCanManageNeonatal(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid event ID');

    const event = db.prepare('SELECT id, patient_id FROM neonatal_resuscitation_events WHERE id = ?').get(id) as any | undefined;
    if (!event) throw notFound('Neonatal resuscitation event not found');

    db.prepare('DELETE FROM neonatal_resuscitation_events WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_resuscitation.delete',
      entity: 'patient',
      entityId: String(event.patient_id),
      detail: { eventId: id },
    });

    return { ok: true, deletedId: id };
  });

  // DELETE /api/neonatal-news/:id
  app.delete('/api/neonatal-news/:id', async (req) => {
    const user = assertCanManageNeonatal(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid observation ID');

    const obs = db.prepare('SELECT id, patient_id, resuscitation_event_id FROM neonatal_news_observations WHERE id = ?').get(id) as any | undefined;
    if (!obs) throw notFound('NEW-S observation not found');

    db.prepare('DELETE FROM neonatal_news_observations WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_news.delete',
      entity: 'patient',
      entityId: String(obs.patient_id),
      detail: { observationId: id, eventId: obs.resuscitation_event_id },
    });

    return { ok: true, deletedId: id };
  });
}
