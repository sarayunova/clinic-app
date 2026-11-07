import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm, requireUser } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import {
  calculateSilvermanScore,
  calculateDownesScore,
  calculateDailyFluidGoal,
  calculateWeightVelocity,
  type SilvermanScoreInput,
  type DownesScoreInput,
} from '../../web/src/sncuEngine.js';

function assertCanManageSncu(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage SNCU neonatal inpatient records');
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

const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/;

export const sncuCalculateSchema = z.object({
  gestationalAgeWeeks: z.number().int().min(22).max(45),
  dayOfLife: z.number().int().min(1).max(120),
  phototherapyActive: z.boolean().default(false),
  birthWeightG: z.number().min(300).max(8000),
  currentWeightG: z.number().min(300).max(8000).optional(),

  // Silverman score inputs
  upperChestRetraction: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  lowerChestRetraction: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  xiphoidRetraction: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  naresDilation: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  expiratoryGrunt: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),

  // Downes score inputs
  respiratoryRateScore: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  cyanosisScore: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  airEntryScore: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  gruntingScore: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  retractionsScore: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
});

export const sncuAdmissionSchema = z.object({
  patientId: z.number().int().positive(),
  admissionId: z.number().int().positive().nullable().optional(),
  admissionDatetime: z.string().regex(isoDateTimeRegex, 'Invalid admission datetime'),
  birthWeightG: z.number().min(300).max(8000),
  gestationalAgeWeeks: z.number().int().min(22).max(45),
  gestationalAgeDays: z.number().int().min(0).max(6).default(0),
  admissionIndication: z.enum([
    'prematurity_lbw',
    'respiratory_distress',
    'neonatal_sepsis',
    'hypoglycemia',
    'hyperbilirubinemia_severe',
    'perinatal_asphyxia',
    'feeding_difficulty',
    'congenital_anomaly',
    'other',
  ]),

  // Respiratory Support & Distress Scores
  respiratorySupport: z
    .enum([
      'room_air',
      'low_flow_nasal_prongs',
      'bubble_cpap',
      'high_flow_nasal_cannula',
      'mechanical_ventilation',
    ])
    .default('room_air'),
  fio2Percent: optNullableNumber(21, 100),
  peepCmH2o: optNullableNumber(0, 20),
  flowRateLMin: optNullableNumber(0, 15),
  silvermanAndersonScore: z.number().int().min(0).max(10).nullable().optional(),
  downesScore: z.number().int().min(0).max(10).nullable().optional(),

  // Phototherapy & Thermoregulation
  phototherapyStatus: z
    .enum(['none', 'single_surface_led', 'double_surface_led', 'biliblanket'])
    .default('none'),
  kmcDurationHoursToday: optNullableNumber(0, 24),
  temperatureCelsius: optNullableNumber(32, 43),

  // Fluid & Nutritional Calculations
  currentWeightG: optNullableNumber(300, 8000),
  totalFluidGoalMlKgDay: optNullableNumber(40, 250),
  feedingMode: z
    .enum(['npo_iv_fluids', 'og_tube_ebm', 'paladai_ebm', 'direct_breastfeeding', 'formula'])
    .default('npo_iv_fluids'),
  feedingVolumeMl: optNullableNumber(0, 200),
  feedingFrequencyHours: z.number().int().min(1).max(6).default(2),
  ivFluidTypeRate: optNullableString(200),
  dailyWeightGainGKgDay: optNullableNumber(-200, 200),

  // Vitals & Metabolic Surveillance
  heartRateBpm: z.number().int().min(30).max(260).nullable().optional(),
  respiratoryRateBpm: z.number().int().min(10).max(160).nullable().optional(),
  spo2Percent: optNullableNumber(50, 100),
  capillaryBloodGlucoseMgDl: optNullableNumber(10, 600),
  antibioticRegimen: optNullableString(300),
  clinicalNotes: optNullableString(2000),

  // Discharge & Status
  status: z
    .enum([
      'admitted',
      'transferred_tertiary_nicu',
      'discharged_to_mother',
      'discharged_home',
      'deceased',
    ])
    .default('admitted'),
  dischargeDatetime: z.string().regex(isoDateTimeRegex).nullable().optional(),
  dischargeWeightG: optNullableNumber(300, 8000),
  attendingPediatrician: optNullableString(150),
  reviewedBy: z.number().int().positive().optional(),
});

function rowToSncu(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    admissionId: r.admission_id,
    admissionDatetime: r.admission_datetime,
    birthWeightG: r.birth_weight_g,
    gestationalAgeWeeks: r.gestational_age_weeks,
    gestationalAgeDays: r.gestational_age_days,
    admissionIndication: r.admission_indication,

    respiratorySupport: r.respiratory_support,
    fio2Percent: r.fio2_percent,
    peepCmH2o: r.peep_cm_h2o,
    flowRateLMin: r.flow_rate_l_min,
    silvermanAndersonScore: r.silverman_anderson_score,
    downesScore: r.downes_score,

    phototherapyStatus: r.phototherapy_status,
    kmcDurationHoursToday: r.kmc_duration_hours_today,
    temperatureCelsius: r.temperature_celsius,

    currentWeightG: r.current_weight_g,
    totalFluidGoalMlKgDay: r.total_fluid_goal_ml_kg_day,
    feedingMode: r.feeding_mode,
    feedingVolumeMl: r.feeding_volume_ml,
    feedingFrequencyHours: r.feeding_frequency_hours,
    ivFluidTypeRate: r.iv_fluid_type_rate,
    dailyWeightGainGKgDay: r.daily_weight_gain_g_kg_day,

    heartRateBpm: r.heart_rate_bpm,
    respiratoryRateBpm: r.respiratory_rate_bpm,
    spo2Percent: r.spo2_percent,
    capillaryBloodGlucoseMgDl: r.capillary_blood_glucose_mg_dl,
    antibioticRegimen: r.antibiotic_regimen,
    clinicalNotes: r.clinical_notes,

    status: r.status,
    dischargeDatetime: r.discharge_datetime,
    dischargeWeightG: r.discharge_weight_g,

    attendingPediatrician: r.attending_pediatrician,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name ?? null,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerSncuRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Calculate live fluid requirements and respiratory distress scores
  app.post('/api/sncu/calculate-fluid-silverman', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = sncuCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    const d = parsed.data;

    const fluidGoal = calculateDailyFluidGoal(
      d.gestationalAgeWeeks,
      d.dayOfLife,
      d.phototherapyActive,
    );

    const weightVelocity = d.currentWeightG
      ? calculateWeightVelocity(d.birthWeightG, d.currentWeightG, d.dayOfLife)
      : null;

    let silvermanEval = null;
    if (
      d.upperChestRetraction !== undefined ||
      d.lowerChestRetraction !== undefined ||
      d.xiphoidRetraction !== undefined ||
      d.naresDilation !== undefined ||
      d.expiratoryGrunt !== undefined
    ) {
      const input: SilvermanScoreInput = {
        upperChestRetraction: d.upperChestRetraction ?? 0,
        lowerChestRetraction: d.lowerChestRetraction ?? 0,
        xiphoidRetraction: d.xiphoidRetraction ?? 0,
        naresDilation: d.naresDilation ?? 0,
        expiratoryGrunt: d.expiratoryGrunt ?? 0,
      };
      silvermanEval = calculateSilvermanScore(input);
    }

    let downesEval = null;
    if (
      d.respiratoryRateScore !== undefined ||
      d.cyanosisScore !== undefined ||
      d.airEntryScore !== undefined ||
      d.gruntingScore !== undefined ||
      d.retractionsScore !== undefined
    ) {
      const input: DownesScoreInput = {
        respiratoryRateScore: d.respiratoryRateScore ?? 0,
        cyanosisScore: d.cyanosisScore ?? 0,
        airEntryScore: d.airEntryScore ?? 0,
        gruntingScore: d.gruntingScore ?? 0,
        retractionsScore: d.retractionsScore ?? 0,
      };
      downesEval = calculateDownesScore(input);
    }

    return {
      fluidGoal,
      weightVelocity,
      silvermanEval,
      downesEval,
    };
  });

  // 2. List SNCU admissions for a patient
  app.get<{ Params: { patientId: string } }>('/api/patients/:patientId/sncu', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const rows = ctx.db
      .prepare(
        `SELECT s.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM sncu_admissions s
         LEFT JOIN users rev ON rev.id = s.reviewed_by
         LEFT JOIN users c ON c.id = s.created_by
         WHERE s.patient_id = ?
         ORDER BY s.admission_datetime DESC, s.id DESC`,
      )
      .all(patientId);

    return rows.map(rowToSncu);
  });

  // 3. Get single SNCU admission by ID
  app.get<{ Params: { id: string } }>('/api/sncu/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid admission ID');

    const row: any = ctx.db
      .prepare(
        `SELECT s.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM sncu_admissions s
         LEFT JOIN users rev ON rev.id = s.reviewed_by
         LEFT JOIN users c ON c.id = s.created_by
         WHERE s.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('SNCU admission record not found');
    return rowToSncu(row);
  });

  // 4. Create SNCU admission
  app.post('/api/sncu', async (req) => {
    const user = assertCanManageSncu(req);
    const parsed = sncuAdmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    const d = parsed.data;

    // Verify patient exists
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(d.patientId);
    if (!patient) throw notFound('Patient not found');

    const now = nowIso();
    const reviewedBy = d.reviewedBy ?? user.id;

    // Auto-calculate fluid goal if omitted
    let fluidGoal = d.totalFluidGoalMlKgDay ?? null;
    if (!fluidGoal) {
      const calc = calculateDailyFluidGoal(
        d.gestationalAgeWeeks,
        1,
        d.phototherapyStatus !== 'none',
      );
      fluidGoal = calc.recommendedMlKgDay;
    }

    const recordId = tx(ctx.db, () => {
      const res = ctx.db
        .prepare(
          `INSERT INTO sncu_admissions (
            patient_id, admission_id, admission_datetime, birth_weight_g,
            gestational_age_weeks, gestational_age_days, admission_indication,
            respiratory_support, fio2_percent, peep_cm_h2o, flow_rate_l_min,
            silverman_anderson_score, downes_score, phototherapy_status,
            kmc_duration_hours_today, temperature_celsius, current_weight_g,
            total_fluid_goal_ml_kg_day, feeding_mode, feeding_volume_ml,
            feeding_frequency_hours, iv_fluid_type_rate, daily_weight_gain_g_kg_day,
            heart_rate_bpm, respiratory_rate_bpm, spo2_percent,
            capillary_blood_glucose_mg_dl, antibiotic_regimen, clinical_notes,
            status, discharge_datetime, discharge_weight_g, attending_pediatrician,
            reviewed_by, created_by, updated_by, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?
          )`,
        )
        .run(
          d.patientId,
          d.admissionId ?? null,
          d.admissionDatetime,
          d.birthWeightG,
          d.gestationalAgeWeeks,
          d.gestationalAgeDays,
          d.admissionIndication,
          d.respiratorySupport,
          d.fio2Percent ?? 21.0,
          d.peepCmH2o ?? null,
          d.flowRateLMin ?? null,
          d.silvermanAndersonScore ?? null,
          d.downesScore ?? null,
          d.phototherapyStatus,
          d.kmcDurationHoursToday ?? 0,
          d.temperatureCelsius ?? null,
          d.currentWeightG ?? null,
          fluidGoal,
          d.feedingMode,
          d.feedingVolumeMl ?? null,
          d.feedingFrequencyHours,
          d.ivFluidTypeRate ?? null,
          d.dailyWeightGainGKgDay ?? null,
          d.heartRateBpm ?? null,
          d.respiratoryRateBpm ?? null,
          d.spo2Percent ?? null,
          d.capillaryBloodGlucoseMgDl ?? null,
          d.antibioticRegimen ?? null,
          d.clinicalNotes ?? null,
          d.status,
          d.dischargeDatetime ?? null,
          d.dischargeWeightG ?? null,
          d.attendingPediatrician ?? null,
          reviewedBy,
          user.id,
          user.id,
          now,
          now,
        );

      const newId = Number(res.lastInsertRowid);

      audit(ctx.db, {
        actorId: user.id,
        action: 'sncu.admission_create',
        entity: 'sncu_admissions',
        entityId: newId,
        detail: {
          patientId: d.patientId,
          admissionDatetime: d.admissionDatetime,
          admissionIndication: d.admissionIndication,
          gestationalAgeWeeks: d.gestationalAgeWeeks,
          birthWeightG: d.birthWeightG,
          respiratorySupport: d.respiratorySupport,
          silvermanScore: d.silvermanAndersonScore ?? null,
          downesScore: d.downesScore ?? null,
        },
      });

      return newId;
    });

    const created: any = ctx.db
      .prepare(
        `SELECT s.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM sncu_admissions s
         LEFT JOIN users rev ON rev.id = s.reviewed_by
         LEFT JOIN users c ON c.id = s.created_by
         WHERE s.id = ?`,
      )
      .get(recordId);

    return rowToSncu(created);
  });

  // 5. Update SNCU admission
  app.put<{ Params: { id: string } }>('/api/sncu/:id', async (req) => {
    const user = assertCanManageSncu(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid admission ID');

    const existing: any = ctx.db.prepare('SELECT * FROM sncu_admissions WHERE id = ?').get(id);
    if (!existing) throw notFound('SNCU admission record not found');

    const parsed = sncuAdmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    const d = parsed.data;
    const now = nowIso();
    const reviewedBy = d.reviewedBy ?? user.id;

    tx(ctx.db, () => {
      ctx.db
        .prepare(
          `UPDATE sncu_admissions SET
            admission_id = ?,
            admission_datetime = ?,
            birth_weight_g = ?,
            gestational_age_weeks = ?,
            gestational_age_days = ?,
            admission_indication = ?,
            respiratory_support = ?,
            fio2_percent = ?,
            peep_cm_h2o = ?,
            flow_rate_l_min = ?,
            silverman_anderson_score = ?,
            downes_score = ?,
            phototherapy_status = ?,
            kmc_duration_hours_today = ?,
            temperature_celsius = ?,
            current_weight_g = ?,
            total_fluid_goal_ml_kg_day = ?,
            feeding_mode = ?,
            feeding_volume_ml = ?,
            feeding_frequency_hours = ?,
            iv_fluid_type_rate = ?,
            daily_weight_gain_g_kg_day = ?,
            heart_rate_bpm = ?,
            respiratory_rate_bpm = ?,
            spo2_percent = ?,
            capillary_blood_glucose_mg_dl = ?,
            antibiotic_regimen = ?,
            clinical_notes = ?,
            status = ?,
            discharge_datetime = ?,
            discharge_weight_g = ?,
            attending_pediatrician = ?,
            reviewed_by = ?,
            updated_by = ?,
            updated_at = ?
          WHERE id = ?`,
        )
        .run(
          d.admissionId ?? null,
          d.admissionDatetime,
          d.birthWeightG,
          d.gestationalAgeWeeks,
          d.gestationalAgeDays,
          d.admissionIndication,
          d.respiratorySupport,
          d.fio2Percent ?? 21.0,
          d.peepCmH2o ?? null,
          d.flowRateLMin ?? null,
          d.silvermanAndersonScore ?? null,
          d.downesScore ?? null,
          d.phototherapyStatus,
          d.kmcDurationHoursToday ?? 0,
          d.temperatureCelsius ?? null,
          d.currentWeightG ?? null,
          d.totalFluidGoalMlKgDay ?? null,
          d.feedingMode,
          d.feedingVolumeMl ?? null,
          d.feedingFrequencyHours,
          d.ivFluidTypeRate ?? null,
          d.dailyWeightGainGKgDay ?? null,
          d.heartRateBpm ?? null,
          d.respiratoryRateBpm ?? null,
          d.spo2Percent ?? null,
          d.capillaryBloodGlucoseMgDl ?? null,
          d.antibioticRegimen ?? null,
          d.clinicalNotes ?? null,
          d.status,
          d.dischargeDatetime ?? null,
          d.dischargeWeightG ?? null,
          d.attendingPediatrician ?? null,
          reviewedBy,
          user.id,
          now,
          id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'sncu.admission_update',
        entity: 'sncu_admissions',
        entityId: id,
        detail: {
          patientId: d.patientId,
          status: d.status,
          respiratorySupport: d.respiratorySupport,
          silvermanScore: d.silvermanAndersonScore ?? null,
          downesScore: d.downesScore ?? null,
        },
      });
    });

    const updated: any = ctx.db
      .prepare(
        `SELECT s.*,
                rev.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM sncu_admissions s
         LEFT JOIN users rev ON rev.id = s.reviewed_by
         LEFT JOIN users c ON c.id = s.created_by
         WHERE s.id = ?`,
      )
      .get(id);

    return rowToSncu(updated);
  });

  // 6. Delete SNCU admission (Doctor only)
  app.delete<{ Params: { id: string } }>('/api/sncu/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only senior medical staff can delete SNCU admission records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid admission ID');

    const existing: any = ctx.db.prepare('SELECT * FROM sncu_admissions WHERE id = ?').get(id);
    if (!existing) throw notFound('SNCU admission record not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM sncu_admissions WHERE id = ?').run(id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'sncu.admission_delete',
        entity: 'sncu_admissions',
        entityId: id,
        detail: {
          patientId: existing.patient_id,
          admissionDatetime: existing.admission_datetime,
          indication: existing.admission_indication,
        },
      });
    });

    return { ok: true, deletedId: id };
  });

  // 7. Audit print sheet
  app.post<{ Params: { id: string } }>('/api/sncu/:id/audit-print', async (req) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid admission ID');

    const existing: any = ctx.db.prepare('SELECT * FROM sncu_admissions WHERE id = ?').get(id);
    if (!existing) throw notFound('SNCU admission record not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'sncu.admission_print',
      entity: 'sncu_admissions',
      entityId: id,
      detail: {
        patientId: existing.patient_id,
        admissionDatetime: existing.admission_datetime,
      },
    });

    return { ok: true };
  });
}
