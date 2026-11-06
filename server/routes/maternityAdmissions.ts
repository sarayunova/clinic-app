import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';

function assertCanManageMaternity(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical staff can manage maternity admissions and handovers');
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

export const laborStages = [
  'not_in_labor',
  'latent_phase',
  'active_phase',
  'second_stage',
  'third_stage',
  'immediate_postpartum',
] as const;

export const admissionIndications = [
  'in_labor',
  'prom',
  'postdated',
  'induction_of_labor',
  'pre_eclampsia',
  'gdm_monitoring',
  'fetal_growth_restriction',
  'reduced_fetal_movements',
  'antepartum_hemorrhage',
  'elective_lscs_planned',
  'other',
] as const;

export const membraneStatuses = [
  'intact',
  'ruptured_clear',
  'ruptured_meconium_thin',
  'ruptured_meconium_thick',
  'ruptured_blood_stained',
] as const;

export const fetalPresentations = [
  'cephalic_vertex',
  'breech_frank',
  'breech_complete',
  'transverse_lie',
  'compound',
  'other',
] as const;

export const fetalLies = ['longitudinal', 'transverse', 'oblique'] as const;
export const fetalEngagements = ['engaged', 'not_engaged', 'deeply_engaged'] as const;
export const ctgCategories = ['category_1', 'category_2', 'category_3', 'not_performed'] as const;
export const urineProteinLevels = ['nil', 'trace', '1+', '2+', '3+', '4+'] as const;

export const wardLocations = [
  'triage',
  'antenatal_ward',
  'labor_room',
  'delivery_suite',
  'operating_theatre',
  'recovery_postnatal',
] as const;

export const admissionStatuses = [
  'in_labor',
  'induction',
  'transferred_to_ot',
  'delivered',
  'discharged',
  'cancelled',
] as const;

export const lscsCategories = [
  'category_1_immediate_threat',
  'category_2_maternal_fetal_compromise',
  'category_3_early_delivery',
  'category_4_elective',
] as const;

export function computeBishopScore(d: number, e: number, s: number, con: number, pos: number) {
  const dilation = Math.max(0, Math.min(3, d || 0));
  const effacement = Math.max(0, Math.min(3, e || 0));
  const station = Math.max(0, Math.min(3, s || 0));
  const consistency = Math.max(0, Math.min(2, con || 0));
  const position = Math.max(0, Math.min(2, pos || 0));
  const total = dilation + effacement + station + consistency + position;
  let interpretation: 'unfavorable' | 'intermediate' | 'favorable' = 'unfavorable';
  if (total >= 9) interpretation = 'favorable';
  else if (total >= 6) interpretation = 'intermediate';
  return { total, interpretation };
}

export function calcRuptureDuration(rupturedAt?: string | null): number | null {
  if (!rupturedAt) return null;
  const t = Date.parse(rupturedAt);
  if (isNaN(t)) return null;
  const diffHours = (Date.now() - t) / 3_600_000;
  return Math.max(0, Math.round(diffHours * 10) / 10);
}

export const createMaternityAdmissionSchema = z
  .object({
    admissionId: z.number().int().positive().nullable().optional(),
    admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    laborStage: z.enum(laborStages).default('latent_phase'),
    admissionIndication: z.enum(admissionIndications).default('in_labor'),
    indicationDetails: optNullableString(500),
    contractionOnsetAt: optNullableString(50),
    gestationalAgeWeeks: optNullableNumber(20, 44),
    gestationalAgeDays: optNullableNumber(0, 6),
    gravida: optNullableNumber(0, 20),
    para: optNullableNumber(0, 20),
    bloodGroup: optNullableString(20),
    allergiesSummary: optNullableString(500),
    highRiskAlerts: optNullableString(1000),

    // Bishop score components
    bishopDilation: z.number().int().min(0).max(3).default(0),
    bishopEffacement: z.number().int().min(0).max(3).default(0),
    bishopStation: z.number().int().min(0).max(3).default(0),
    bishopConsistency: z.number().int().min(0).max(2).default(0),
    bishopPosition: z.number().int().min(0).max(2).default(0),

    // Membranes
    membraneStatus: z.enum(membraneStatuses).default('intact'),
    membraneRupturedAt: optNullableString(50),
    membraneRuptureHours: optNullableNumber(0, 500),
    promAntibioticsGiven: z.boolean().default(false),
    liquorNotes: optNullableString(500),

    // Fetus
    fetalHeartRate: optNullableNumber(50, 220),
    fetalPresentation: z.enum(fetalPresentations).default('cephalic_vertex'),
    fetalLie: z.enum(fetalLies).default('longitudinal'),
    fetalEngagement: z.enum(fetalEngagements).default('engaged'),
    ctgCategory: z.enum(ctgCategories).default('category_1'),

    // Maternal vitals
    bpSystolic: optNullableNumber(60, 260),
    bpDiastolic: optNullableNumber(30, 160),
    pulse: optNullableNumber(30, 220),
    temperatureF: optNullableNumber(90, 110),
    spo2: optNullableNumber(50, 100),
    urineProtein: z.enum(urineProteinLevels).default('nil'),

    // Location & progress
    currentLocation: z.enum(wardLocations).default('labor_room'),
    attendingMidwifeNurse: optNullableString(150),
    primaryObstetrician: optNullableString(150),
    activeOxytocinRate: optNullableString(100),
    latestCervicalDilationCm: optNullableNumber(0, 10),
    latestFetalStation: optNullableString(20),
    status: z.enum(admissionStatuses).default('in_labor'),
  })
  .strict();

export const patchMaternityAdmissionSchema = z
  .object({
    admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
    laborStage: z.enum(laborStages).optional(),
    admissionIndication: z.enum(admissionIndications).optional(),
    indicationDetails: optNullableString(500),
    contractionOnsetAt: optNullableString(50),
    gestationalAgeWeeks: optNullableNumber(20, 44),
    gestationalAgeDays: optNullableNumber(0, 6),
    gravida: optNullableNumber(0, 20),
    para: optNullableNumber(0, 20),
    bloodGroup: optNullableString(20),
    allergiesSummary: optNullableString(500),
    highRiskAlerts: optNullableString(1000),
    bishopDilation: z.number().int().min(0).max(3).optional(),
    bishopEffacement: z.number().int().min(0).max(3).optional(),
    bishopStation: z.number().int().min(0).max(3).optional(),
    bishopConsistency: z.number().int().min(0).max(2).optional(),
    bishopPosition: z.number().int().min(0).max(2).optional(),
    membraneStatus: z.enum(membraneStatuses).optional(),
    membraneRupturedAt: optNullableString(50),
    membraneRuptureHours: optNullableNumber(0, 500),
    promAntibioticsGiven: z.boolean().optional(),
    liquorNotes: optNullableString(500),
    fetalHeartRate: optNullableNumber(50, 220),
    fetalPresentation: z.enum(fetalPresentations).optional(),
    fetalLie: z.enum(fetalLies).optional(),
    fetalEngagement: z.enum(fetalEngagements).optional(),
    ctgCategory: z.enum(ctgCategories).optional(),
    bpSystolic: optNullableNumber(60, 260),
    bpDiastolic: optNullableNumber(30, 160),
    pulse: optNullableNumber(30, 220),
    temperatureF: optNullableNumber(90, 110),
    spo2: optNullableNumber(50, 100),
    urineProtein: z.enum(urineProteinLevels).optional(),
    currentLocation: z.enum(wardLocations).optional(),
    attendingMidwifeNurse: optNullableString(150),
    primaryObstetrician: optNullableString(150),
    activeOxytocinRate: optNullableString(100),
    latestCervicalDilationCm: optNullableNumber(0, 10),
    latestFetalStation: optNullableString(20),
    status: z.enum(admissionStatuses).optional(),
  })
  .strict();

export const handoverSchema = z
  .object({
    shiftName: z.enum(['morning', 'evening', 'night']),
    handoverAt: optNullableString(50),
    outgoingStaff: z.string().trim().min(1).max(150),
    incomingStaff: z.string().trim().min(1).max(150),
    situation: z.string().trim().min(1).max(2000),
    background: z.string().trim().min(1).max(2000),
    assessment: z.string().trim().min(1).max(2000),
    recommendation: z.string().trim().min(1).max(2000),
    urgencyLevel: z.enum(['routine', 'watch_closely', 'immediate_attention']).default('routine'),
  })
  .strict();

export const oxytocinLogSchema = z
  .object({
    loggedAt: optNullableString(50),
    infusionRateMUPerMin: z.number().min(0).max(100),
    dropsPerMin: optNullableNumber(0, 200),
    contractionsPer10min: z.number().int().min(0).max(20),
    contractionDurationSec: z.number().int().min(0).max(300),
    contractionIntensity: z.enum(['mild', 'moderate', 'strong']).default('moderate'),
    fetalHeartRate: z.number().int().min(50).max(220),
    maternalPulse: optNullableNumber(30, 220),
    maternalBpSystolic: optNullableNumber(60, 260),
    maternalBpDiastolic: optNullableNumber(30, 160),
    hyperstimulationNoted: z.boolean().optional(),
    actionTaken: optNullableString(500),
  })
  .strict();

export const emergencyLscsChecklistSchema = z
  .object({
    decisionAt: optNullableString(50),
    decisionToDeliveryTargetMins: z.number().int().min(5).max(180).default(30),
    lscsCategory: z.enum(lscsCategories).default('category_1_immediate_threat'),
    surgicalIndication: z.string().trim().min(1).max(500),
    operatingSurgeon: optNullableString(150),
    anesthetistNotified: z.boolean().default(false),
    anesthetistName: optNullableString(150),
    pediatricianNotified: z.boolean().default(false),
    pediatricianName: optNullableString(150),
    consentSigned: z.boolean().default(false),
    consentType: optNullableString(200),
    npoSolidHours: optNullableNumber(0, 72),
    npoClearFluidsHours: optNullableNumber(0, 72),
    wideBoreIvAccess: z.boolean().default(false),
    bloodArranged: z.boolean().default(false),
    bloodUnitsArranged: optNullableNumber(0, 20),
    preopAntacidGiven: z.boolean().default(false),
    antibioticProphylaxisGiven: z.boolean().default(false),
    antibioticNameTime: optNullableString(200),
    foleyCatheterInserted: z.boolean().default(false),
    abdominalPrepDone: z.boolean().default(false),
    otReady: z.boolean().default(false),
    shiftedToOtAt: optNullableString(50),
    notes: optNullableString(2000),
  })
  .strict();

type DbMaternityRow = {
  id: number;
  patient_id: number;
  admission_id: number | null;
  admission_date: string;
  labor_stage: string;
  admission_indication: string;
  indication_details: string | null;
  contraction_onset_at: string | null;
  gestational_age_weeks: number | null;
  gestational_age_days: number | null;
  gravida: number | null;
  para: number | null;
  blood_group: string | null;
  allergies_summary: string | null;
  high_risk_alerts: string | null;
  bishop_dilation: number;
  bishop_effacement: number;
  bishop_station: number;
  bishop_consistency: number;
  bishop_position: number;
  bishop_total_score: number;
  bishop_interpretation: string;
  membrane_status: string;
  membrane_ruptured_at: string | null;
  membrane_rupture_hours: number | null;
  prom_antibiotics_given: number;
  liquor_notes: string | null;
  fetal_heart_rate: number | null;
  fetal_presentation: string;
  fetal_lie: string;
  fetal_engagement: string;
  ctg_category: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  temperature_f: number | null;
  spo2: number | null;
  urine_protein: string;
  current_location: string;
  attending_midwife_nurse: string | null;
  primary_obstetrician: string | null;
  active_oxytocin_rate: string | null;
  latest_cervical_dilation_cm: number | null;
  latest_fetal_station: string | null;
  status: string;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  patient_name?: string;
  patient_number?: string;
  date_of_birth?: string | null;
  patient_phone?: string | null;
  admission_number?: string | null;
  bed_room?: string | null;
  bed_label?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  latest_handover_id?: number | null;
  latest_handover_shift?: string | null;
  latest_handover_at?: string | null;
  latest_handover_recommendation?: string | null;
  latest_handover_urgency?: string | null;
  lscs_prep_active?: number | null;
};

function mapMaternityRow(r: DbMaternityRow) {
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    admissionDate: r.admission_date,
    laborStage: r.labor_stage,
    admissionIndication: r.admission_indication,
    indicationDetails: r.indication_details,
    contractionOnsetAt: r.contraction_onset_at,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    gravida: r.gravida,
    para: r.para,
    bloodGroup: r.blood_group,
    allergiesSummary: r.allergies_summary,
    highRiskAlerts: r.high_risk_alerts,
    bishopDilation: r.bishop_dilation,
    bishopEffacement: r.bishop_effacement,
    bishopStation: r.bishop_station,
    bishopConsistency: r.bishop_consistency,
    bishopPosition: r.bishop_position,
    bishopTotalScore: r.bishop_total_score,
    bishopInterpretation: r.bishop_interpretation,
    membraneStatus: r.membrane_status,
    membraneRupturedAt: r.membrane_ruptured_at,
    membraneRuptureHours: r.membrane_rupture_hours,
    promAntibioticsGiven: r.prom_antibiotics_given === 1,
    liquorNotes: r.liquor_notes,
    fetalHeartRate: r.fetal_heart_rate,
    fetalPresentation: r.fetal_presentation,
    fetalLie: r.fetal_lie,
    fetalEngagement: r.fetal_engagement,
    ctgCategory: r.ctg_category,
    bpSystolic: r.bp_systolic,
    bpDiastolic: r.bp_diastolic,
    pulse: r.pulse,
    temperatureF: r.temperature_f,
    spo2: r.spo2,
    urineProtein: r.urine_protein,
    currentLocation: r.current_location,
    attendingMidwifeNurse: r.attending_midwife_nurse,
    primaryObstetrician: r.primary_obstetrician,
    activeOxytocinRate: r.active_oxytocin_rate,
    latestCervicalDilationCm: r.latest_cervical_dilation_cm,
    latestFetalStation: r.latest_fetal_station,
    status: r.status,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    patientName: r.patient_name,
    patientNumber: r.patient_number,
    dateOfBirth: r.date_of_birth,
    patientPhone: r.patient_phone,
    admissionNumber: r.admission_number ?? null,
    bedRoom: r.bed_room ?? null,
    bedLabel: r.bed_label ?? null,
    latestHandover: r.latest_handover_id
      ? {
          id: r.latest_handover_id,
          shiftName: r.latest_handover_shift,
          handoverAt: r.latest_handover_at,
          recommendation: r.latest_handover_recommendation,
          urgencyLevel: r.latest_handover_urgency,
        }
      : null,
    lscsPrepActive: Boolean(r.lscs_prep_active),
  };
}

export function registerMaternityAdmissionRoutes(app: FastifyInstance, { db }: Ctx): void {
  // GET /api/maternity-admissions
  // Returns Delivery Ward Handover Board list (active or filtered)
  app.get('/api/maternity-admissions', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const q = req.query as { status?: string; location?: string; activeOnly?: string };

    let sql = `
      SELECT m.*,
             p.full_name AS patient_name,
             p.patient_number,
             p.date_of_birth,
             p.phone AS patient_phone,
             adm.admission_number,
             b.room AS bed_room,
             b.label AS bed_label,
             cu.full_name AS created_by_name,
             uu.full_name AS updated_by_name,
             h.id AS latest_handover_id,
             h.shift_name AS latest_handover_shift,
             h.handover_at AS latest_handover_at,
             h.recommendation AS latest_handover_recommendation,
             h.urgency_level AS latest_handover_urgency,
             (CASE WHEN lscs.id IS NOT NULL AND lscs.ot_ready = 0 THEN 1 ELSE 0 END) AS lscs_prep_active
      FROM maternity_admissions m
      JOIN patients p ON p.id = m.patient_id
      LEFT JOIN admissions adm ON adm.id = m.admission_id
      LEFT JOIN beds b ON b.id = adm.bed_id
      LEFT JOIN users cu ON cu.id = m.created_by
      LEFT JOIN users uu ON uu.id = m.updated_by
      LEFT JOIN emergency_lscs_checklists lscs ON lscs.maternity_admission_id = m.id
      LEFT JOIN (
        SELECT h1.*
        FROM maternity_handover_entries h1
        INNER JOIN (
          SELECT maternity_admission_id, MAX(id) AS max_id
          FROM maternity_handover_entries
          GROUP BY maternity_admission_id
        ) h2 ON h1.id = h2.max_id
      ) h ON h.maternity_admission_id = m.id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (q.status) {
      sql += ' AND m.status = ?';
      params.push(q.status);
    } else if (q.activeOnly === 'true' || q.activeOnly === undefined) {
      sql += " AND m.status IN ('in_labor', 'induction', 'transferred_to_ot')";
    }

    if (q.location) {
      sql += ' AND m.current_location = ?';
      params.push(q.location);
    }

    sql += ' ORDER BY m.status ASC, m.latest_cervical_dilation_cm DESC, m.admission_date DESC, m.id DESC';

    const rows = db.prepare(sql).all(...params) as DbMaternityRow[];
    return {
      count: rows.length,
      admissions: rows.map(mapMaternityRow),
    };
  });

  // GET /api/patients/:id/maternity-admissions
  app.get('/api/patients/:id/maternity-admissions', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const rows = db
      .prepare(
        `SELECT m.*,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name,
                adm.admission_number,
                b.room AS bed_room,
                b.label AS bed_label,
                (CASE WHEN lscs.id IS NOT NULL AND lscs.ot_ready = 0 THEN 1 ELSE 0 END) AS lscs_prep_active
         FROM maternity_admissions m
         LEFT JOIN admissions adm ON adm.id = m.admission_id
         LEFT JOIN beds b ON b.id = adm.bed_id
         LEFT JOIN users cu ON cu.id = m.created_by
         LEFT JOIN users uu ON uu.id = m.updated_by
         LEFT JOIN emergency_lscs_checklists lscs ON lscs.maternity_admission_id = m.id
         WHERE m.patient_id = ?
         ORDER BY m.admission_date DESC, m.id DESC`
      )
      .all(patientId) as DbMaternityRow[];

    return {
      patientId,
      admissions: rows.map(mapMaternityRow),
    };
  });

  // GET /api/maternity-admissions/:id
  app.get('/api/maternity-admissions/:id', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid admission ID');

    const row = db
      .prepare(
        `SELECT m.*,
                p.full_name AS patient_name,
                p.patient_number,
                p.date_of_birth,
                p.phone AS patient_phone,
                adm.admission_number,
                b.room AS bed_room,
                b.label AS bed_label,
                cu.full_name AS created_by_name,
                uu.full_name AS updated_by_name
         FROM maternity_admissions m
         JOIN patients p ON p.id = m.patient_id
         LEFT JOIN admissions adm ON adm.id = m.admission_id
         LEFT JOIN beds b ON b.id = adm.bed_id
         LEFT JOIN users cu ON cu.id = m.created_by
         LEFT JOIN users uu ON uu.id = m.updated_by
         WHERE m.id = ?`
      )
      .get(id) as DbMaternityRow | undefined;

    if (!row) throw notFound('Maternity admission record not found');

    // Handovers list
    const handovers = db
      .prepare(
        `SELECT h.*, u.full_name AS created_by_name
         FROM maternity_handover_entries h
         LEFT JOIN users u ON u.id = h.created_by
         WHERE h.maternity_admission_id = ?
         ORDER BY h.handover_at DESC, h.id DESC`
      )
      .all(id) as any[];

    // Oxytocin logs list
    const oxytocinLogs = db
      .prepare(
        `SELECT o.*
         FROM oxytocin_titration_logs o
         WHERE o.maternity_admission_id = ?
         ORDER BY o.logged_at DESC, o.id DESC`
      )
      .all(id) as any[];

    // Emergency LSCS checklist
    const lscsChecklist = db
      .prepare(
        `SELECT l.*, u.full_name AS updated_by_name
         FROM emergency_lscs_checklists l
         LEFT JOIN users u ON u.id = l.updated_by
         WHERE l.maternity_admission_id = ?`
      )
      .get(id) as any | undefined;

    return {
      ...mapMaternityRow(row),
      handovers: handovers.map((h) => ({
        id: h.id,
        maternityAdmissionId: h.maternity_admission_id,
        shiftName: h.shift_name,
        handoverAt: h.handover_at,
        outgoingStaff: h.outgoing_staff,
        incomingStaff: h.incoming_staff,
        situation: h.situation,
        background: h.background,
        assessment: h.assessment,
        recommendation: h.recommendation,
        urgencyLevel: h.urgency_level,
        createdBy: h.created_by,
        createdByName: h.created_by_name,
        createdAt: h.created_at,
      })),
      oxytocinLogs: oxytocinLogs.map((o) => ({
        id: o.id,
        maternityAdmissionId: o.maternity_admission_id,
        loggedAt: o.logged_at,
        infusionRateMUPerMin: o.infusion_rate_mU_min,
        dropsPerMin: o.drops_per_min,
        contractionsPer10min: o.contractions_per_10min,
        contractionDurationSec: o.contraction_duration_sec,
        contractionIntensity: o.contraction_intensity,
        fetalHeartRate: o.fetal_heart_rate,
        maternalPulse: o.maternal_pulse,
        maternalBpSystolic: o.maternal_bp_systolic,
        maternalBpDiastolic: o.maternal_bp_diastolic,
        hyperstimulationNoted: o.hyperstimulation_noted === 1,
        actionTaken: o.action_taken,
        loggedBy: o.logged_by,
        loggedByName: o.logged_by_name,
        createdAt: o.created_at,
      })),
      emergencyLscsChecklist: lscsChecklist
        ? {
            id: lscsChecklist.id,
            maternityAdmissionId: lscsChecklist.maternity_admission_id,
            decisionAt: lscsChecklist.decision_at,
            decisionToDeliveryTargetMins: lscsChecklist.decision_to_delivery_target_mins,
            lscsCategory: lscsChecklist.lscs_category,
            surgicalIndication: lscsChecklist.surgical_indication,
            operatingSurgeon: lscsChecklist.operating_surgeon,
            anesthetistNotified: lscsChecklist.anesthetist_notified === 1,
            anesthetistName: lscsChecklist.anesthetist_name,
            pediatricianNotified: lscsChecklist.pediatrician_notified === 1,
            pediatricianName: lscsChecklist.pediatrician_name,
            consentSigned: lscsChecklist.consent_signed === 1,
            consentType: lscsChecklist.consent_type,
            npoSolidHours: lscsChecklist.npo_solid_hours,
            npoClearFluidsHours: lscsChecklist.npo_clear_fluids_hours,
            wideBoreIvAccess: lscsChecklist.wide_bore_iv_access === 1,
            bloodArranged: lscsChecklist.blood_arranged === 1,
            bloodUnitsArranged: lscsChecklist.blood_units_arranged,
            preopAntacidGiven: lscsChecklist.preop_antacid_given === 1,
            antibioticProphylaxisGiven: lscsChecklist.antibiotic_prophylaxis_given === 1,
            antibioticNameTime: lscsChecklist.antibiotic_name_time,
            foleyCatheterInserted: lscsChecklist.foley_catheter_inserted === 1,
            abdominalPrepDone: lscsChecklist.abdominal_prep_done === 1,
            otReady: lscsChecklist.ot_ready === 1,
            shiftedToOtAt: lscsChecklist.shifted_to_ot_at,
            notes: lscsChecklist.notes,
            updatedBy: lscsChecklist.updated_by,
            updatedByName: lscsChecklist.updated_by_name,
            updatedAt: lscsChecklist.updated_at,
          }
        : null,
    };
  });

  // POST /api/patients/:id/maternity-admissions
  app.post('/api/patients/:id/maternity-admissions', async (req, reply) => {
    const user = assertCanManageMaternity(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(createMaternityAdmissionSchema, req.body);
    const now = nowIso();

    // Calculate Bishop Score
    const bishop = computeBishopScore(
      b.bishopDilation,
      b.bishopEffacement,
      b.bishopStation,
      b.bishopConsistency,
      b.bishopPosition
    );

    // Calculate PROM duration if membrane ruptured
    const ruptureHours = b.membraneRuptureHours ?? calcRuptureDuration(b.membraneRupturedAt);

    const stmt = db.prepare(`
      INSERT INTO maternity_admissions (
        patient_id, admission_id, admission_date, labor_stage, admission_indication, indication_details,
        contraction_onset_at, gestational_age_weeks, gestational_age_days, gravida, para, blood_group,
        allergies_summary, high_risk_alerts,
        bishop_dilation, bishop_effacement, bishop_station, bishop_consistency, bishop_position,
        bishop_total_score, bishop_interpretation,
        membrane_status, membrane_ruptured_at, membrane_rupture_hours, prom_antibiotics_given, liquor_notes,
        fetal_heart_rate, fetal_presentation, fetal_lie, fetal_engagement, ctg_category,
        bp_systolic, bp_diastolic, pulse, temperature_f, spo2, urine_protein,
        current_location, attending_midwife_nurse, primary_obstetrician, active_oxytocin_rate,
        latest_cervical_dilation_cm, latest_fetal_station, status,
        created_by, updated_by, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const res = stmt.run(
      patientId,
      b.admissionId ?? null,
      b.admissionDate,
      b.laborStage,
      b.admissionIndication,
      b.indicationDetails ?? null,
      b.contractionOnsetAt ?? null,
      b.gestationalAgeWeeks ?? null,
      b.gestationalAgeDays ?? null,
      b.gravida ?? null,
      b.para ?? null,
      b.bloodGroup ?? null,
      b.allergiesSummary ?? null,
      b.highRiskAlerts ?? null,
      b.bishopDilation,
      b.bishopEffacement,
      b.bishopStation,
      b.bishopConsistency,
      b.bishopPosition,
      bishop.total,
      bishop.interpretation,
      b.membraneStatus,
      b.membraneRupturedAt ?? null,
      ruptureHours,
      b.promAntibioticsGiven ? 1 : 0,
      b.liquorNotes ?? null,
      b.fetalHeartRate ?? null,
      b.fetalPresentation,
      b.fetalLie,
      b.fetalEngagement,
      b.ctgCategory,
      b.bpSystolic ?? null,
      b.bpDiastolic ?? null,
      b.pulse ?? null,
      b.temperatureF ?? null,
      b.spo2 ?? null,
      b.urineProtein,
      b.currentLocation,
      b.attendingMidwifeNurse ?? null,
      b.primaryObstetrician ?? null,
      b.activeOxytocinRate ?? null,
      b.latestCervicalDilationCm ?? null,
      b.latestFetalStation ?? null,
      b.status,
      user.id,
      user.id,
      now,
      now
    );

    const newId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'maternity_admission.create',
      entity: 'patient',
      entityId: patientId,
      detail: {
        admissionRecordId: newId,
        laborStage: b.laborStage,
        bishopScore: bishop.total,
        currentLocation: b.currentLocation,
      },
    });

    const created = db.prepare('SELECT * FROM maternity_admissions WHERE id = ?').get(newId) as DbMaternityRow;
    return reply.status(201).send(mapMaternityRow(created));
  });

  // PATCH /api/maternity-admissions/:id
  app.patch('/api/maternity-admissions/:id', async (req) => {
    const user = assertCanManageMaternity(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid admission ID');

    const existing = db.prepare('SELECT * FROM maternity_admissions WHERE id = ?').get(id) as DbMaternityRow | undefined;
    if (!existing) throw notFound('Maternity admission not found');

    const b = parse(patchMaternityAdmissionSchema, req.body);
    const now = nowIso();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const stringMap: Record<string, string> = {
      admissionDate: 'admission_date',
      laborStage: 'labor_stage',
      admissionIndication: 'admission_indication',
      indicationDetails: 'indication_details',
      contractionOnsetAt: 'contraction_onset_at',
      gestationalAgeWeeks: 'gestational_age_weeks',
      gestationalAgeDays: 'gestational_age_days',
      gravida: 'gravida',
      para: 'para',
      bloodGroup: 'blood_group',
      allergiesSummary: 'allergies_summary',
      highRiskAlerts: 'high_risk_alerts',
      membraneStatus: 'membrane_status',
      membraneRupturedAt: 'membrane_ruptured_at',
      membraneRuptureHours: 'membrane_rupture_hours',
      liquorNotes: 'liquor_notes',
      fetalHeartRate: 'fetal_heart_rate',
      fetalPresentation: 'fetal_presentation',
      fetalLie: 'fetal_lie',
      fetalEngagement: 'fetal_engagement',
      ctgCategory: 'ctg_category',
      bpSystolic: 'bp_systolic',
      bpDiastolic: 'bp_diastolic',
      pulse: 'pulse',
      temperatureF: 'temperature_f',
      spo2: 'spo2',
      urineProtein: 'urine_protein',
      currentLocation: 'current_location',
      attendingMidwifeNurse: 'attending_midwife_nurse',
      primaryObstetrician: 'primary_obstetrician',
      activeOxytocinRate: 'active_oxytocin_rate',
      latestCervicalDilationCm: 'latest_cervical_dilation_cm',
      latestFetalStation: 'latest_fetal_station',
      status: 'status',
    };

    for (const [k, col] of Object.entries(stringMap)) {
      if (k in b) {
        fields.push(`${col} = ?`);
        values.push((b as any)[k] ?? null);
      }
    }

    if ('promAntibioticsGiven' in b) {
      fields.push('prom_antibiotics_given = ?');
      values.push(b.promAntibioticsGiven ? 1 : 0);
    }

    // Check if Bishop components changed
    const dVal = b.bishopDilation ?? existing.bishop_dilation;
    const eVal = b.bishopEffacement ?? existing.bishop_effacement;
    const sVal = b.bishopStation ?? existing.bishop_station;
    const conVal = b.bishopConsistency ?? existing.bishop_consistency;
    const posVal = b.bishopPosition ?? existing.bishop_position;

    if (
      'bishopDilation' in b ||
      'bishopEffacement' in b ||
      'bishopStation' in b ||
      'bishopConsistency' in b ||
      'bishopPosition' in b
    ) {
      const bishop = computeBishopScore(dVal, eVal, sVal, conVal, posVal);
      fields.push(
        'bishop_dilation = ?',
        'bishop_effacement = ?',
        'bishop_station = ?',
        'bishop_consistency = ?',
        'bishop_position = ?',
        'bishop_total_score = ?',
        'bishop_interpretation = ?'
      );
      values.push(dVal, eVal, sVal, conVal, posVal, bishop.total, bishop.interpretation);
    }

    if (fields.length === 0) throw badRequest('No fields to update');

    fields.push('updated_by = ?', 'updated_at = ?');
    values.push(user.id, now, id);

    db.prepare(`UPDATE maternity_admissions SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    audit(db, {
      actorId: user.id,
      action: 'maternity_admission.update',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        admissionRecordId: id,
        updatedFields: Object.keys(b),
      },
    });

    const updated = db.prepare('SELECT * FROM maternity_admissions WHERE id = ?').get(id) as DbMaternityRow;
    return mapMaternityRow(updated);
  });

  // DELETE /api/maternity-admissions/:id
  app.delete('/api/maternity-admissions/:id', async (req) => {
    const user = assertCanManageMaternity(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid admission ID');

    const existing = db.prepare('SELECT * FROM maternity_admissions WHERE id = ?').get(id) as DbMaternityRow | undefined;
    if (!existing) throw notFound('Maternity admission not found');

    db.prepare('DELETE FROM maternity_admissions WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'maternity_admission.delete',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        admissionRecordId: id,
      },
    });

    return { ok: true };
  });

  // POST /api/maternity-admissions/:id/handover
  // Records an SBAR shift handover note
  app.post('/api/maternity-admissions/:id/handover', async (req, reply) => {
    const user = assertCanManageMaternity(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid admission ID');

    const admission = db.prepare('SELECT id, patient_id FROM maternity_admissions WHERE id = ?').get(id) as { id: number; patient_id: number } | undefined;
    if (!admission) throw notFound('Maternity admission not found');

    const b = parse(handoverSchema, req.body);
    const now = nowIso();
    const handoverAt = b.handoverAt || now;

    const res = db
      .prepare(
        `INSERT INTO maternity_handover_entries (
           maternity_admission_id, shift_name, handover_at, outgoing_staff, incoming_staff,
           situation, background, assessment, recommendation, urgency_level,
           created_by, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        b.shiftName,
        handoverAt,
        b.outgoingStaff,
        b.incomingStaff,
        b.situation,
        b.background,
        b.assessment,
        b.recommendation,
        b.urgencyLevel,
        user.id,
        now
      );

    const newHandoverId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'maternity_handover.create',
      entity: 'patient',
      entityId: admission.patient_id,
      detail: {
        admissionRecordId: id,
        handoverId: newHandoverId,
        shiftName: b.shiftName,
        urgencyLevel: b.urgencyLevel,
      },
    });

    const created = db.prepare('SELECT * FROM maternity_handover_entries WHERE id = ?').get(newHandoverId) as any;
    return reply.status(201).send({
      id: created.id,
      maternityAdmissionId: created.maternity_admission_id,
      shiftName: created.shift_name,
      handoverAt: created.handover_at,
      outgoingStaff: created.outgoing_staff,
      incomingStaff: created.incoming_staff,
      situation: created.situation,
      background: created.background,
      assessment: created.assessment,
      recommendation: created.recommendation,
      urgencyLevel: created.urgency_level,
      createdBy: created.created_by,
      createdByName: user.fullName,
      createdAt: created.created_at,
    });
  });

  // POST /api/maternity-admissions/:id/oxytocin
  // Logs an oxytocin infusion titration step with automatic tachysystole check
  app.post('/api/maternity-admissions/:id/oxytocin', async (req, reply) => {
    const user = assertCanManageMaternity(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid admission ID');

    const admission = db.prepare('SELECT id, patient_id FROM maternity_admissions WHERE id = ?').get(id) as { id: number; patient_id: number } | undefined;
    if (!admission) throw notFound('Maternity admission not found');

    const b = parse(oxytocinLogSchema, req.body);
    const now = nowIso();
    const loggedAt = b.loggedAt || now;

    // Detect tachysystole: > 5 contractions in 10 mins or > 90 seconds
    const tachysystole = b.hyperstimulationNoted ?? (b.contractionsPer10min > 5 || b.contractionDurationSec > 90);

    const res = db
      .prepare(
        `INSERT INTO oxytocin_titration_logs (
           maternity_admission_id, logged_at, infusion_rate_mU_min, drops_per_min,
           contractions_per_10min, contraction_duration_sec, contraction_intensity,
           fetal_heart_rate, maternal_pulse, maternal_bp_systolic, maternal_bp_diastolic,
           hyperstimulation_noted, action_taken, logged_by, logged_by_name, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        loggedAt,
        b.infusionRateMUPerMin,
        b.dropsPerMin ?? null,
        b.contractionsPer10min,
        b.contractionDurationSec,
        b.contractionIntensity,
        b.fetalHeartRate,
        b.maternalPulse ?? null,
        b.maternalBpSystolic ?? null,
        b.maternalBpDiastolic ?? null,
        tachysystole ? 1 : 0,
        b.actionTaken ?? null,
        user.id,
        user.fullName,
        now
      );

    const logId = Number(res.lastInsertRowid);

    // Update active oxytocin rate on admission record
    const rateText = `${b.infusionRateMUPerMin} mU/min${b.dropsPerMin ? ` (${b.dropsPerMin} drops/min)` : ''}`;
    db.prepare('UPDATE maternity_admissions SET active_oxytocin_rate = ?, updated_by = ?, updated_at = ? WHERE id = ?').run(
      rateText,
      user.id,
      now,
      id
    );

    audit(db, {
      actorId: user.id,
      action: 'oxytocin_log.create',
      entity: 'patient',
      entityId: admission.patient_id,
      detail: {
        admissionRecordId: id,
        logId,
        infusionRateMUPerMin: b.infusionRateMUPerMin,
        tachysystole,
      },
    });

    const created = db.prepare('SELECT * FROM oxytocin_titration_logs WHERE id = ?').get(logId) as any;
    return reply.status(201).send({
      id: created.id,
      maternityAdmissionId: created.maternity_admission_id,
      loggedAt: created.logged_at,
      infusionRateMUPerMin: created.infusion_rate_mU_min,
      dropsPerMin: created.drops_per_min,
      contractionsPer10min: created.contractions_per_10min,
      contractionDurationSec: created.contraction_duration_sec,
      contractionIntensity: created.contraction_intensity,
      fetalHeartRate: created.fetal_heart_rate,
      maternalPulse: created.maternal_pulse,
      maternalBpSystolic: created.maternal_bp_systolic,
      maternalBpDiastolic: created.maternal_bp_diastolic,
      hyperstimulationNoted: created.hyperstimulation_noted === 1,
      actionTaken: created.action_taken,
      loggedBy: created.logged_by,
      loggedByName: created.logged_by_name,
      createdAt: created.created_at,
    });
  });

  // GET /api/maternity-admissions/:id/oxytocin
  app.get('/api/maternity-admissions/:id/oxytocin', async (req) => {
    requirePerm(req, 'patient:read_basic');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid admission ID');

    const rows = db
      .prepare(
        `SELECT * FROM oxytocin_titration_logs
         WHERE maternity_admission_id = ?
         ORDER BY logged_at ASC, id ASC`
      )
      .all(id) as any[];

    return {
      maternityAdmissionId: id,
      logs: rows.map((o) => ({
        id: o.id,
        maternityAdmissionId: o.maternity_admission_id,
        loggedAt: o.logged_at,
        infusionRateMUPerMin: o.infusion_rate_mU_min,
        dropsPerMin: o.drops_per_min,
        contractionsPer10min: o.contractions_per_10min,
        contractionDurationSec: o.contraction_duration_sec,
        contractionIntensity: o.contraction_intensity,
        fetalHeartRate: o.fetal_heart_rate,
        maternalPulse: o.maternal_pulse,
        maternalBpSystolic: o.maternal_bp_systolic,
        maternalBpDiastolic: o.maternal_bp_diastolic,
        hyperstimulationNoted: o.hyperstimulation_noted === 1,
        actionTaken: o.action_taken,
        loggedBy: o.logged_by,
        loggedByName: o.logged_by_name,
        createdAt: o.created_at,
      })),
    };
  });

  // PUT /api/maternity-admissions/:id/lscs-checklist
  // Sets or updates emergency LSCS surgical readiness checklist
  app.put('/api/maternity-admissions/:id/lscs-checklist', async (req) => {
    const user = assertCanManageMaternity(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid admission ID');

    const admission = db.prepare('SELECT id, patient_id FROM maternity_admissions WHERE id = ?').get(id) as { id: number; patient_id: number } | undefined;
    if (!admission) throw notFound('Maternity admission not found');

    const b = parse(emergencyLscsChecklistSchema, req.body);
    const now = nowIso();
    const decisionAt = b.decisionAt || now;

    const existing = db.prepare('SELECT * FROM emergency_lscs_checklists WHERE maternity_admission_id = ?').get(id) as any | undefined;

    if (existing) {
      db.prepare(`
        UPDATE emergency_lscs_checklists SET
          decision_at = ?,
          decision_to_delivery_target_mins = ?,
          lscs_category = ?,
          surgical_indication = ?,
          operating_surgeon = ?,
          anesthetist_notified = ?,
          anesthetist_name = ?,
          pediatrician_notified = ?,
          pediatrician_name = ?,
          consent_signed = ?,
          consent_type = ?,
          npo_solid_hours = ?,
          npo_clear_fluids_hours = ?,
          wide_bore_iv_access = ?,
          blood_arranged = ?,
          blood_units_arranged = ?,
          preop_antacid_given = ?,
          antibiotic_prophylaxis_given = ?,
          antibiotic_name_time = ?,
          foley_catheter_inserted = ?,
          abdominal_prep_done = ?,
          ot_ready = ?,
          shifted_to_ot_at = ?,
          notes = ?,
          updated_by = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        decisionAt,
        b.decisionToDeliveryTargetMins,
        b.lscsCategory,
        b.surgicalIndication,
        b.operatingSurgeon ?? existing.operating_surgeon,
        b.anesthetistNotified ? 1 : existing.anesthetist_notified,
        b.anesthetistName ?? existing.anesthetist_name,
        b.pediatricianNotified ? 1 : existing.pediatrician_notified,
        b.pediatricianName ?? existing.pediatrician_name,
        b.consentSigned ? 1 : existing.consent_signed,
        b.consentType ?? existing.consent_type,
        b.npoSolidHours ?? existing.npo_solid_hours,
        b.npoClearFluidsHours ?? existing.npo_clear_fluids_hours,
        b.wideBoreIvAccess ? 1 : existing.wide_bore_iv_access,
        b.bloodArranged ? 1 : existing.blood_arranged,
        b.bloodUnitsArranged ?? existing.blood_units_arranged ?? 0,
        b.preopAntacidGiven ? 1 : existing.preop_antacid_given,
        b.antibioticProphylaxisGiven ? 1 : existing.antibiotic_prophylaxis_given,
        b.antibioticNameTime ?? existing.antibiotic_name_time,
        b.foleyCatheterInserted ? 1 : existing.foley_catheter_inserted,
        b.abdominalPrepDone ? 1 : existing.abdominal_prep_done,
        b.otReady ? 1 : existing.ot_ready,
        b.shiftedToOtAt ?? existing.shifted_to_ot_at,
        b.notes ?? existing.notes,
        user.id,
        now,
        existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO emergency_lscs_checklists (
          maternity_admission_id, decision_at, decision_to_delivery_target_mins, lscs_category,
          surgical_indication, operating_surgeon, anesthetist_notified, anesthetist_name,
          pediatrician_notified, pediatrician_name, consent_signed, consent_type,
          npo_solid_hours, npo_clear_fluids_hours, wide_bore_iv_access, blood_arranged, blood_units_arranged,
          preop_antacid_given, antibiotic_prophylaxis_given, antibiotic_name_time,
          foley_catheter_inserted, abdominal_prep_done, ot_ready, shifted_to_ot_at, notes,
          updated_by, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        id,
        decisionAt,
        b.decisionToDeliveryTargetMins,
        b.lscsCategory,
        b.surgicalIndication,
        b.operatingSurgeon ?? null,
        b.anesthetistNotified ? 1 : 0,
        b.anesthetistName ?? null,
        b.pediatricianNotified ? 1 : 0,
        b.pediatricianName ?? null,
        b.consentSigned ? 1 : 0,
        b.consentType ?? null,
        b.npoSolidHours ?? null,
        b.npoClearFluidsHours ?? null,
        b.wideBoreIvAccess ? 1 : 0,
        b.bloodArranged ? 1 : 0,
        b.bloodUnitsArranged ?? null,
        b.preopAntacidGiven ? 1 : 0,
        b.antibioticProphylaxisGiven ? 1 : 0,
        b.antibioticNameTime ?? null,
        b.foleyCatheterInserted ? 1 : 0,
        b.abdominalPrepDone ? 1 : 0,
        b.otReady ? 1 : 0,
        b.shiftedToOtAt ?? null,
        b.notes ?? null,
        user.id,
        now
      );
    }

    // If OT ready or shifted, update current location
    if (b.shiftedToOtAt) {
      db.prepare("UPDATE maternity_admissions SET current_location = 'operating_theatre', status = 'transferred_to_ot', updated_by = ?, updated_at = ? WHERE id = ?").run(
        user.id,
        now,
        id
      );
    }

    audit(db, {
      actorId: user.id,
      action: 'emergency_lscs_checklist.save',
      entity: 'patient',
      entityId: admission.patient_id,
      detail: {
        admissionRecordId: id,
        lscsCategory: b.lscsCategory,
        targetMins: b.decisionToDeliveryTargetMins,
        otReady: b.otReady,
      },
    });

    const checklist = db.prepare('SELECT * FROM emergency_lscs_checklists WHERE maternity_admission_id = ?').get(id) as any;
    return {
      id: checklist.id,
      maternityAdmissionId: checklist.maternity_admission_id,
      decisionAt: checklist.decision_at,
      decisionToDeliveryTargetMins: checklist.decision_to_delivery_target_mins,
      lscsCategory: checklist.lscs_category,
      surgicalIndication: checklist.surgical_indication,
      operatingSurgeon: checklist.operating_surgeon,
      anesthetistNotified: checklist.anesthetist_notified === 1,
      anesthetistName: checklist.anesthetist_name,
      pediatricianNotified: checklist.pediatrician_notified === 1,
      pediatricianName: checklist.pediatrician_name,
      consentSigned: checklist.consent_signed === 1,
      consentType: checklist.consent_type,
      npoSolidHours: checklist.npo_solid_hours,
      npoClearFluidsHours: checklist.npo_clear_fluids_hours,
      wideBoreIvAccess: checklist.wide_bore_iv_access === 1,
      bloodArranged: checklist.blood_arranged === 1,
      bloodUnitsArranged: checklist.blood_units_arranged,
      preopAntacidGiven: checklist.preop_antacid_given === 1,
      antibioticProphylaxisGiven: checklist.antibiotic_prophylaxis_given === 1,
      antibioticNameTime: checklist.antibiotic_name_time,
      foleyCatheterInserted: checklist.foley_catheter_inserted === 1,
      abdominalPrepDone: checklist.abdominal_prep_done === 1,
      otReady: checklist.ot_ready === 1,
      shiftedToOtAt: checklist.shifted_to_ot_at,
      notes: checklist.notes,
      updatedBy: checklist.updated_by,
      updatedByName: user.fullName,
      updatedAt: checklist.updated_at,
    };
  });
}
