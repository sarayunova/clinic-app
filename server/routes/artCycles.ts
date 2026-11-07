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
  calculateHcgDoublingKinetics,
  parseGardnerGrade,
  type HcgKineticsInput,
  type HcgKineticsResult,
} from '../../web/src/artEngine.js';

function assertCanManageArt(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage ART & embryo transfer cycles');
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

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const hcgKineticsSchema = z.object({
  hcg1Value: z.number().min(0.1, 'Day 14 beta-hCG must be greater than 0'),
  hcg1Datetime: z.string().min(1, 'Initial beta-hCG date/time is required'),
  hcg2Value: z.number().min(0.1, 'Follow-up beta-hCG must be greater than 0'),
  hcg2Datetime: z.string().min(1, 'Follow-up beta-hCG date/time is required'),
});

export const artCycleSchema = z.object({
  patientId: z.number().int().positive('Valid patient ID required'),
  cycleNumber: z.number().int().min(1).default(1),
  startDate: z.string().regex(dateRegex, 'Start date must be YYYY-MM-DD'),
  cycleType: z.enum([
    'ivf_fresh',
    'icsi_fresh',
    'fet_frozen_transfer',
    'iui_husband',
    'iui_donor',
    'oocyte_vitrification',
    'surrogacy',
  ]),
  protocolType: z.enum([
    'gnrh_antagonist',
    'gnrh_agonist_long',
    'gnrh_agonist_short',
    'minimal_stimulation',
    'natural_modified',
    'hrt_programmed',
  ]),
  indication: z.enum([
    'tubal_factor',
    'male_factor',
    'pcos_ovulatory',
    'diminished_ovarian_reserve',
    'endometriosis',
    'unexplained',
    'genetic_pgt',
    'secondary_infertility',
  ]),
  indicationNotes: optNullableString(1000),

  // Controlled Ovarian Stimulation (COH) & Trigger
  gonadotropinType: optNullableString(200),
  totalGonadotropinDoseIu: optNullableNumber(0, 15000),
  stimulationDays: optNullableNumber(0, 30),
  peakEstradiolPgMl: optNullableNumber(0, 25000),
  triggerProgesteroneNgMl: optNullableNumber(0, 50),
  triggerType: z
    .enum(['rhcg_250mcg', 'urinary_hcg_10000iu', 'gnrh_agonist_dual', 'gnrh_agonist_solo_ohss_prevention'])
    .nullable()
    .optional(),
  triggerDatetime: optNullableString(30),

  // Oocyte Retrieval (OPU) & Insemination
  opuDatetime: optNullableString(30),
  totalOocytesRetrieved: z.number().int().min(0).max(100).default(0),
  matureMiiOocytes: z.number().int().min(0).max(100).default(0),
  inseminationMethod: z
    .enum(['standard_ivf', 'icsi', 'half_ivf_half_icsi', 'frozen_thawed'])
    .nullable()
    .optional(),
  fertilized2pnCount: z.number().int().min(0).max(100).default(0),
  fertilizationRatePercent: optNullableNumber(0, 100),

  // Embryo Cohort & Transfer
  day3EmbryosCount: z.number().int().min(0).max(100).default(0),
  day5BlastocystsCount: z.number().int().min(0).max(100).default(0),
  embryosTransferredCount: z.number().int().min(0).max(10).default(0),
  transferStage: z
    .enum(['day_3_cleavage', 'day_5_blastocyst', 'day_6_blastocyst', 'freeze_all_no_transfer'])
    .nullable()
    .optional(),
  transferDatetime: optNullableString(30),
  transferredEmbryosDetails: optNullableString(2000),
  endometrialThicknessAtTransferMm: optNullableNumber(0, 25),
  transferDifficulty: z.enum(['easy', 'moderate_tenaculum', 'difficult_stylet']).default('easy'),
  embryosFrozenCount: z.number().int().min(0).max(100).default(0),
  frozenStorageStraws: optNullableString(1000),

  // Luteal Phase Support & Pregnancy Outcome
  lutealSupportRegimen: optNullableString(1000),
  betaHcgDay14MiuMl: optNullableNumber(0, 100000),
  betaHcgDay16MiuMl: optNullableNumber(0, 200000),
  hcgDoublingTimeHours: optNullableNumber(-1, 500),
  clinicalPregnancyStatus: z
    .enum([
      'cycle_in_progress',
      'biochemical_pregnancy',
      'clinical_intrauterine_sac',
      'ectopic_pregnancy',
      'negative_not_pregnant',
      'cancelled_ohss_risk',
      'freeze_all',
    ])
    .default('cycle_in_progress'),
  gestationalSacsCount: z.number().int().min(0).max(5).default(0),
  fetalHeartPresent: z.boolean().default(false),
  cycleNotes: optNullableString(4000),

  leadEmbryologist: optNullableString(200),
  reviewedBy: z.number().int().positive('Valid reviewer ID required'),
});

function rowToArtCycle(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    patientId: r.patient_id,
    cycleNumber: r.cycle_number,
    startDate: r.start_date,
    cycleType: r.cycle_type,
    protocolType: r.protocol_type,
    indication: r.indication,
    indicationNotes: r.indication_notes,

    gonadotropinType: r.gonadotropin_type,
    totalGonadotropinDoseIu: r.total_gonadotropin_dose_iu,
    stimulationDays: r.stimulation_days,
    peakEstradiolPgMl: r.peak_estradiol_pg_ml,
    triggerProgesteroneNgMl: r.trigger_progesterone_ng_ml,
    triggerType: r.trigger_type,
    triggerDatetime: r.trigger_datetime,

    opuDatetime: r.opu_datetime,
    totalOocytesRetrieved: r.total_oocytes_retrieved,
    matureMiiOocytes: r.mature_mii_oocytes,
    inseminationMethod: r.insemination_method,
    fertilized2pnCount: r.fertilized_2pn_count,
    fertilizationRatePercent: r.fertilization_rate_percent,

    day3EmbryosCount: r.day3_embryos_count,
    day5BlastocystsCount: r.day5_blastocysts_count,
    embryosTransferredCount: r.embryos_transferred_count,
    transferStage: r.transfer_stage,
    transferDatetime: r.transfer_datetime,
    transferredEmbryosDetails: r.transferred_embryos_details,
    endometrialThicknessAtTransferMm: r.endometrial_thickness_at_transfer_mm,
    transferDifficulty: r.transfer_difficulty,
    embryosFrozenCount: r.embryos_frozen_count,
    frozenStorageStraws: r.frozen_storage_straws,

    lutealSupportRegimen: r.luteal_support_regimen,
    betaHcgDay14MiuMl: r.beta_hcg_day14_miu_ml,
    betaHcgDay16MiuMl: r.beta_hcg_day16_miu_ml,
    hcgDoublingTimeHours: r.hcg_doubling_time_hours,
    clinicalPregnancyStatus: r.clinical_pregnancy_status,
    gestationalSacsCount: r.gestational_sacs_count,
    fetalHeartPresent: Boolean(r.fetal_heart_present),
    cycleNotes: r.cycle_notes,

    leadEmbryologist: r.lead_embryologist,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name ?? null,
    createdBy: r.created_by,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerArtCycleRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Calculate hCG doubling kinetics
  app.post('/api/art/calculate-kinetics', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const parsed = hcgKineticsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }
    return calculateHcgDoublingKinetics(parsed.data);
  });

  // 2. Parse Gardner Blastocyst Grade
  app.post('/api/art/parse-gardner-grade', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = req.body as { gradeCode?: string };
    if (!body?.gradeCode || typeof body.gradeCode !== 'string') {
      throw badRequest('gradeCode string is required (e.g. "4AA", "3BB")');
    }
    return parseGardnerGrade(body.gradeCode);
  });

  // 3. List cycles for a patient
  app.get<{ Params: { patientId: string } }>('/api/patients/:patientId/art-cycles', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const rows = ctx.db
      .prepare(
        `SELECT a.*,
                u.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM art_cycles a
         LEFT JOIN users u ON u.id = a.reviewed_by
         LEFT JOIN users c ON c.id = a.created_by
         WHERE a.patient_id = ?
         ORDER BY a.start_date DESC, a.id DESC`,
      )
      .all(patientId);

    return rows.map(rowToArtCycle);
  });

  // 4. Get cycle by ID
  app.get<{ Params: { id: string } }>('/api/art-cycles/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid cycle ID');

    const row = ctx.db
      .prepare(
        `SELECT a.*,
                u.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM art_cycles a
         LEFT JOIN users u ON u.id = a.reviewed_by
         LEFT JOIN users c ON c.id = a.created_by
         WHERE a.id = ?`,
      )
      .get(id);

    if (!row) throw notFound('ART cycle not found');
    return rowToArtCycle(row);
  });

  // 5. Create ART cycle
  app.post('/api/art-cycles', async (req, reply) => {
    const user = assertCanManageArt(req);
    const parsed = artCycleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;

    // Check patient exists
    const patient = ctx.db.prepare('SELECT id FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    // Automatically compute 2PN fertilization rate if oocytes & 2PN given
    let fertRate = data.fertilizationRatePercent;
    if (fertRate === null || fertRate === undefined) {
      if (data.matureMiiOocytes > 0) {
        fertRate = Math.round((data.fertilized2pnCount / data.matureMiiOocytes) * 1000) / 10;
      } else if (data.totalOocytesRetrieved > 0) {
        fertRate = Math.round((data.fertilized2pnCount / data.totalOocytesRetrieved) * 1000) / 10;
      }
    }

    const now = nowIso();
    const result = tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        INSERT INTO art_cycles (
          patient_id, cycle_number, start_date, cycle_type, protocol_type,
          indication, indication_notes, gonadotropin_type, total_gonadotropin_dose_iu,
          stimulation_days, peak_estradiol_pg_ml, trigger_progesterone_ng_ml,
          trigger_type, trigger_datetime, opu_datetime, total_oocytes_retrieved,
          mature_mii_oocytes, insemination_method, fertilized_2pn_count,
          fertilization_rate_percent, day3_embryos_count, day5_blastocysts_count,
          embryos_transferred_count, transfer_stage, transfer_datetime,
          transferred_embryos_details, endometrial_thickness_at_transfer_mm,
          transfer_difficulty, embryos_frozen_count, frozen_storage_straws,
          luteal_support_regimen, beta_hcg_day14_miu_ml, beta_hcg_day16_miu_ml,
          hcg_doubling_time_hours, clinical_pregnancy_status, gestational_sacs_count,
          fetal_heart_present, cycle_notes, lead_embryologist,
          reviewed_by, created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `);

      const info = stmt.run(
        data.patientId,
        data.cycleNumber,
        data.startDate,
        data.cycleType,
        data.protocolType,
        data.indication,
        data.indicationNotes ?? null,
        data.gonadotropinType ?? null,
        data.totalGonadotropinDoseIu ?? null,
        data.stimulationDays ?? null,
        data.peakEstradiolPgMl ?? null,
        data.triggerProgesteroneNgMl ?? null,
        data.triggerType ?? null,
        data.triggerDatetime ?? null,
        data.opuDatetime ?? null,
        data.totalOocytesRetrieved,
        data.matureMiiOocytes,
        data.inseminationMethod ?? null,
        data.fertilized2pnCount,
        fertRate ?? null,
        data.day3EmbryosCount,
        data.day5BlastocystsCount,
        data.embryosTransferredCount,
        data.transferStage ?? null,
        data.transferDatetime ?? null,
        data.transferredEmbryosDetails ?? null,
        data.endometrialThicknessAtTransferMm ?? null,
        data.transferDifficulty,
        data.embryosFrozenCount,
        data.frozenStorageStraws ?? null,
        data.lutealSupportRegimen ?? null,
        data.betaHcgDay14MiuMl ?? null,
        data.betaHcgDay16MiuMl ?? null,
        data.hcgDoublingTimeHours ?? null,
        data.clinicalPregnancyStatus,
        data.gestationalSacsCount,
        data.fetalHeartPresent ? 1 : 0,
        data.cycleNotes ?? null,
        data.leadEmbryologist ?? null,
        data.reviewedBy,
        user.id,
        user.id,
        now,
        now,
      );

      const cycleId = Number(info.lastInsertRowid);
      audit(ctx.db, {
        actorId: user.id,
        action: 'art.cycle_create',
        entity: 'art_cycles',
        entityId: cycleId,
        detail: JSON.stringify({
          patientId: data.patientId,
          cycleType: data.cycleType,
          cycleNumber: data.cycleNumber,
          embryosTransferred: data.embryosTransferredCount,
        }),
      });

      return cycleId;
    });

    reply.status(201);
    const created = ctx.db
      .prepare(
        `SELECT a.*,
                u.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM art_cycles a
         LEFT JOIN users u ON u.id = a.reviewed_by
         LEFT JOIN users c ON c.id = a.created_by
         WHERE a.id = ?`,
      )
      .get(result);

    return rowToArtCycle(created);
  });

  // 6. Update ART cycle
  app.put<{ Params: { id: string } }>('/api/art-cycles/:id', async (req) => {
    const user = assertCanManageArt(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid cycle ID');

    const existing = ctx.db.prepare('SELECT id, patient_id FROM art_cycles WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('ART cycle not found');

    const parsed = artCycleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed', parsed.error.format());
    }

    const data = parsed.data;

    let fertRate = data.fertilizationRatePercent;
    if (fertRate === null || fertRate === undefined) {
      if (data.matureMiiOocytes > 0) {
        fertRate = Math.round((data.fertilized2pnCount / data.matureMiiOocytes) * 1000) / 10;
      } else if (data.totalOocytesRetrieved > 0) {
        fertRate = Math.round((data.fertilized2pnCount / data.totalOocytesRetrieved) * 1000) / 10;
      }
    }

    const now = nowIso();
    tx(ctx.db, () => {
      const stmt = ctx.db.prepare(`
        UPDATE art_cycles SET
          cycle_number = ?,
          start_date = ?,
          cycle_type = ?,
          protocol_type = ?,
          indication = ?,
          indication_notes = ?,
          gonadotropin_type = ?,
          total_gonadotropin_dose_iu = ?,
          stimulation_days = ?,
          peak_estradiol_pg_ml = ?,
          trigger_progesterone_ng_ml = ?,
          trigger_type = ?,
          trigger_datetime = ?,
          opu_datetime = ?,
          total_oocytes_retrieved = ?,
          mature_mii_oocytes = ?,
          insemination_method = ?,
          fertilized_2pn_count = ?,
          fertilization_rate_percent = ?,
          day3_embryos_count = ?,
          day5_blastocysts_count = ?,
          embryos_transferred_count = ?,
          transfer_stage = ?,
          transfer_datetime = ?,
          transferred_embryos_details = ?,
          endometrial_thickness_at_transfer_mm = ?,
          transfer_difficulty = ?,
          embryos_frozen_count = ?,
          frozen_storage_straws = ?,
          luteal_support_regimen = ?,
          beta_hcg_day14_miu_ml = ?,
          beta_hcg_day16_miu_ml = ?,
          hcg_doubling_time_hours = ?,
          clinical_pregnancy_status = ?,
          gestational_sacs_count = ?,
          fetal_heart_present = ?,
          cycle_notes = ?,
          lead_embryologist = ?,
          reviewed_by = ?,
          updated_by = ?,
          updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        data.cycleNumber,
        data.startDate,
        data.cycleType,
        data.protocolType,
        data.indication,
        data.indicationNotes ?? null,
        data.gonadotropinType ?? null,
        data.totalGonadotropinDoseIu ?? null,
        data.stimulationDays ?? null,
        data.peakEstradiolPgMl ?? null,
        data.triggerProgesteroneNgMl ?? null,
        data.triggerType ?? null,
        data.triggerDatetime ?? null,
        data.opuDatetime ?? null,
        data.totalOocytesRetrieved,
        data.matureMiiOocytes,
        data.inseminationMethod ?? null,
        data.fertilized2pnCount,
        fertRate ?? null,
        data.day3EmbryosCount,
        data.day5BlastocystsCount,
        data.embryosTransferredCount,
        data.transferStage ?? null,
        data.transferDatetime ?? null,
        data.transferredEmbryosDetails ?? null,
        data.endometrialThicknessAtTransferMm ?? null,
        data.transferDifficulty,
        data.embryosFrozenCount,
        data.frozenStorageStraws ?? null,
        data.lutealSupportRegimen ?? null,
        data.betaHcgDay14MiuMl ?? null,
        data.betaHcgDay16MiuMl ?? null,
        data.hcgDoublingTimeHours ?? null,
        data.clinicalPregnancyStatus,
        data.gestationalSacsCount,
        data.fetalHeartPresent ? 1 : 0,
        data.cycleNotes ?? null,
        data.leadEmbryologist ?? null,
        data.reviewedBy,
        user.id,
        now,
        id,
      );

      audit(ctx.db, {
        actorId: user.id,
        action: 'art.cycle_update',
        entity: 'art_cycles',
        entityId: id,
        detail: JSON.stringify({
          patientId: existing.patient_id,
          cycleNumber: data.cycleNumber,
          clinicalPregnancyStatus: data.clinicalPregnancyStatus,
        }),
      });
    });

    const updated = ctx.db
      .prepare(
        `SELECT a.*,
                u.full_name as reviewed_by_name,
                c.full_name as created_by_name
         FROM art_cycles a
         LEFT JOIN users u ON u.id = a.reviewed_by
         LEFT JOIN users c ON c.id = a.created_by
         WHERE a.id = ?`,
      )
      .get(id);

    return rowToArtCycle(updated);
  });

  // 7. Delete ART cycle
  app.delete<{ Params: { id: string } }>('/api/art-cycles/:id', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'user:manage') && !can(user.role, 'patient:write_clinical')) {
      throw forbidden('Only doctors or administrators can delete ART cycle records');
    }

    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid cycle ID');

    const existing = ctx.db.prepare('SELECT id, patient_id FROM art_cycles WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('ART cycle not found');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM art_cycles WHERE id = ?').run(id);
      audit(ctx.db, {
        actorId: user.id,
        action: 'art.cycle_delete',
        entity: 'art_cycles',
        entityId: id,
        detail: JSON.stringify({ patientId: existing.patient_id }),
      });
    });

    return { ok: true, deletedId: id };
  });

  // 8. Audit Print
  app.post<{ Params: { id: string } }>('/api/art-cycles/:id/audit-print', async (req) => {
    const user = requireUser(req);
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw badRequest('Invalid cycle ID');

    const existing = ctx.db.prepare('SELECT id, patient_id FROM art_cycles WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('ART cycle not found');

    audit(ctx.db, {
      actorId: user.id,
      action: 'art.cycle_print',
      entity: 'art_cycles',
      entityId: id,
      detail: JSON.stringify({ patientId: existing.patient_id }),
    });

    return { ok: true };
  });
}
