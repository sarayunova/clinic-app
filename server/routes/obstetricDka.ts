import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateAnionGap,
  calculateCorrectedSodium,
  calculateEffectiveOsmolality,
  evaluateObstetricDka,
  type DiabetesType,
  type EfmCategory,
} from '../../web/src/obstetricDkaEngine.js';

function assertCanManageObstetricDka(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only obstetricians, maternal-fetal medicine specialists, and ICU nurses can manage obstetric DKA records');
  }
  return user;
}

export const obstetricDkaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  presentationDatetime: z.string().min(1, 'Presentation datetime is required'),
  gestationWeeks: z.number().min(6).max(44),
  maternalWeightKg: z.number().min(30).max(250),
  diabetesType: z.enum([
    'pregestational_type1',
    'pregestational_type2',
    'gestational_gdm',
    'new_onset',
  ]),
  precipitatingTrigger: z.enum([
    'infection_sepsis',
    'antenatal_steroid_betamethasone',
    'emesis_starvation',
    'insulin_omission',
    'pump_failure',
    'beta_mimetic_tocolysis',
    'unknown',
  ]),

  // Initial Biochemicals
  bloodGlucoseMgDl: z.number().min(40).max(1500),
  arterialOrVenousPh: z.number().min(6.5).max(7.6),
  serumBicarbonateMeqL: z.number().min(1).max(50),
  serumKetonesBetaOhbMmolL: z.number().min(0).max(25).nullable().optional(),
  urineKetones: z.enum(['negative', 'trace', '1_plus', '2_plus', '3_plus', '4_plus']),
  serumSodiumMeqL: z.number().min(100).max(180),
  serumPotassiumMeqL: z.number().min(1.5).max(9.0),
  serumChlorideMeqL: z.number().min(60).max(140),

  // Fetal
  fetalHeartRateBaselineBpm: z.number().int().min(60).max(240).nullable().optional(),
  fetalVariability: z.enum(['normal_moderate', 'minimal', 'absent', 'marked']).nullable().optional(),
  decelerationsPresent: z.enum(['none', 'early', 'variable', 'late', 'prolonged']).nullable().optional(),
  efmCategory: z.enum(['category_1_normal', 'category_2_indeterminate', 'category_3_abnormal']).nullable().optional(),

  // Resuscitation & Orders
  insulinInfusionRateUnitsHr: z.number().min(0).max(50).default(0),
  dextroseAddedToFluids: z.boolean().default(false),
  status: z.enum([
    'active_acidosis_resuscitation',
    'euglycemic_dextrose_infusion',
    'acidosis_resolved_transitioning',
    'resolved_subcutaneous_insulin',
  ]).default('active_acidosis_resuscitation'),
  clinicalNotes: z.string().nullable().optional(),
});

export const obstetricDkaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromPresentation: z.number().min(0).default(0),
  bloodGlucoseMgDl: z.number().min(20).max(1500),
  insulinRateUnitsHr: z.number().min(0).max(50),
  ivFluidType: z.string().min(1, 'IV fluid type is required'),
  ivFluidRateMlHr: z.number().min(0).max(2000),
  vbgPh: z.number().min(6.5).max(7.6).nullable().optional(),
  serumBicarbonateMeqL: z.number().min(1).max(50).nullable().optional(),
  calculatedAnionGap: z.number().min(-10).max(50).nullable().optional(),
  serumPotassiumMeqL: z.number().min(1.5).max(9.0),
  potassiumReplacementMeqL: z.number().min(0).max(80).default(0),
  fhrBaselineBpm: z.number().int().min(60).max(240).nullable().optional(),
  fhrVariability: z.string().nullable().optional(),
  fhrDecelerations: z.string().nullable().optional(),
  maternalSbpMmhg: z.number().int().min(50).max(250).nullable().optional(),
  maternalDbpMmhg: z.number().int().min(30).max(150).nullable().optional(),
  maternalHrBpm: z.number().int().min(40).max(200).nullable().optional(),
  urineOutputMlHr: z.number().min(0).max(1000).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export function registerObstetricDkaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live DKA Calculation & Protocol Preview
  app.post('/api/obstetric-dka/evaluate', async (req) => {
    assertCanManageObstetricDka(req);
    const body = req.body as Partial<z.infer<typeof obstetricDkaEpisodeSchema>>;

    const evalResult = evaluateObstetricDka({
      gestationWeeks: body.gestationWeeks ?? 32,
      maternalWeightKg: body.maternalWeightKg ?? 70,
      diabetesType: (body.diabetesType as DiabetesType) ?? 'gestational_gdm',
      bloodGlucoseMgDl: body.bloodGlucoseMgDl ?? 180,
      arterialOrVenousPh: body.arterialOrVenousPh ?? 7.22,
      serumBicarbonateMeqL: body.serumBicarbonateMeqL ?? 12,
      serumSodiumMeqL: body.serumSodiumMeqL ?? 136,
      serumPotassiumMeqL: body.serumPotassiumMeqL ?? 4.2,
      serumChlorideMeqL: body.serumChlorideMeqL ?? 102,
      serumKetonesBetaOhbMmolL: body.serumKetonesBetaOhbMmolL ?? 4.5,
      urineKetones: body.urineKetones ?? '3_plus',
      fetalHeartRateBaselineBpm: body.fetalHeartRateBaselineBpm ?? undefined,
      fetalVariability: body.fetalVariability ?? undefined,
      decelerationsPresent: body.decelerationsPresent ?? undefined,
      efmCategory: body.efmCategory ?? undefined,
    });

    return { evalResult };
  });

  // 2. Create Obstetric DKA Episode
  app.post('/api/obstetric-dka/episodes', async (req, reply) => {
    const user = assertCanManageObstetricDka(req);
    const data = parse(obstetricDkaEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateObstetricDka({
      gestationWeeks: data.gestationWeeks,
      maternalWeightKg: data.maternalWeightKg,
      diabetesType: data.diabetesType,
      bloodGlucoseMgDl: data.bloodGlucoseMgDl,
      arterialOrVenousPh: data.arterialOrVenousPh,
      serumBicarbonateMeqL: data.serumBicarbonateMeqL,
      serumSodiumMeqL: data.serumSodiumMeqL,
      serumPotassiumMeqL: data.serumPotassiumMeqL,
      serumChlorideMeqL: data.serumChlorideMeqL,
      serumKetonesBetaOhbMmolL: data.serumKetonesBetaOhbMmolL ?? undefined,
      urineKetones: data.urineKetones,
      fetalHeartRateBaselineBpm: data.fetalHeartRateBaselineBpm ?? undefined,
      fetalVariability: data.fetalVariability ?? undefined,
      decelerationsPresent: data.decelerationsPresent ?? undefined,
      efmCategory: data.efmCategory ?? undefined,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `OBDKA-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_dka_episodes (
        patient_id, admission_id, episode_code, presentation_datetime,
        gestation_weeks, diabetes_type, precipitating_trigger,
        blood_glucose_mg_dl, is_euglycemic_dka, arterial_or_venous_ph,
        serum_bicarbonate_meq_l, serum_ketones_beta_ohb_mmol_l, urine_ketones,
        serum_sodium_meq_l, serum_potassium_meq_l, serum_chloride_meq_l,
        calculated_anion_gap, corrected_sodium_meq_l, effective_osmolality_mosm_kg,
        fetal_heart_rate_baseline_bpm, fetal_variability, decelerations_present, efm_category,
        intrauterine_resuscitation_advisement, dka_severity_tier,
        insulin_infusion_rate_units_hr, dextrose_added_to_fluids, status,
        consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.presentationDatetime,
      data.gestationWeeks,
      data.diabetesType,
      data.precipitatingTrigger,
      data.bloodGlucoseMgDl,
      evalResult.isEuglycemicDka ? 1 : 0,
      data.arterialOrVenousPh,
      data.serumBicarbonateMeqL,
      data.serumKetonesBetaOhbMmolL ?? null,
      data.urineKetones,
      data.serumSodiumMeqL,
      data.serumPotassiumMeqL,
      data.serumChlorideMeqL,
      evalResult.calculatedAnionGap,
      evalResult.correctedSodiumMeqL,
      evalResult.effectiveOsmolalityMosmKg,
      data.fetalHeartRateBaselineBpm ?? null,
      data.fetalVariability ?? null,
      data.decelerationsPresent ?? null,
      data.efmCategory ?? null,
      evalResult.fetalResuscitationGuidance,
      evalResult.dkaSeverityTier,
      data.insulinInfusionRateUnitsHr > 0 ? data.insulinInfusionRateUnitsHr : evalResult.regularInsulinInfusionRateUnitsHr,
      data.dextroseAddedToFluids ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM obstetric_dka_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_dka.episode_create',
      entity: 'obstetric_dka_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        isEuglycemicDka: evalResult.isEuglycemicDka,
        dkaSeverityTier: evalResult.dkaSeverityTier,
      },
    });

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Obstetric DKA Episodes
  app.get('/api/obstetric-dka/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM obstetric_dka_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND e.patient_id = ?';
      params.push(Number(patientId));
    }
    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }

    query += ' ORDER BY e.presentation_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/obstetric-dka/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM obstetric_dka_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric DKA episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM obstetric_dka_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.dka_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateObstetricDka({
      gestationWeeks: episode.gestation_weeks,
      maternalWeightKg: 70, // default if not persisted
      diabetesType: episode.diabetes_type,
      bloodGlucoseMgDl: episode.blood_glucose_mg_dl,
      arterialOrVenousPh: episode.arterial_or_venous_ph,
      serumBicarbonateMeqL: episode.serum_bicarbonate_meq_l,
      serumSodiumMeqL: episode.serum_sodium_meq_l,
      serumPotassiumMeqL: episode.serum_potassium_meq_l,
      serumChlorideMeqL: episode.serum_chloride_meq_l,
      serumKetonesBetaOhbMmolL: episode.serum_ketones_beta_ohb_mmol_l ?? undefined,
      urineKetones: episode.urine_ketones ?? undefined,
      fetalHeartRateBaselineBpm: episode.fetal_heart_rate_baseline_bpm ?? undefined,
      fetalVariability: episode.fetal_variability ?? undefined,
      decelerationsPresent: episode.decelerations_present ?? undefined,
      efmCategory: episode.efm_category ?? undefined,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Obstetric DKA Episode
  app.patch('/api/obstetric-dka/episodes/:id', async (req) => {
    const user = assertCanManageObstetricDka(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM obstetric_dka_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric DKA episode not found');

    const body = req.body as any;
    const nextStatus = body.status ?? existing.status;
    const nextDextrose = body.dextroseAddedToFluids !== undefined ? (body.dextroseAddedToFluids ? 1 : 0) : existing.dextrose_added_to_fluids;
    const nextInsulin = body.insulinInfusionRateUnitsHr ?? existing.insulin_infusion_rate_units_hr;
    const nextNotes = body.clinicalNotes !== undefined ? body.clinicalNotes : existing.clinical_notes;

    db.prepare(`
      UPDATE obstetric_dka_episodes
      SET status = ?, dextrose_added_to_fluids = ?, insulin_infusion_rate_units_hr = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextDextrose, nextInsulin, nextNotes, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_dka.episode_update',
      entity: 'obstetric_dka_episodes',
      entityId: Number(id),
      detail: { nextStatus, nextDextrose, nextInsulin },
    });

    const updated = db.prepare('SELECT * FROM obstetric_dka_episodes WHERE id = ?').get(Number(id));
    return { episode: updated };
  });

  // 6. Delete Obstetric DKA Episode
  app.delete('/api/obstetric-dka/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete obstetric DKA episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM obstetric_dka_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric DKA episode not found');

    db.prepare('DELETE FROM obstetric_dka_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_dka.episode_delete',
      entity: 'obstetric_dka_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Checkpoint
  app.post('/api/obstetric-dka/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricDka(req);
    const { id } = req.params as { id: string };
    const data = parse(obstetricDkaFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM obstetric_dka_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric DKA episode not found');

    const stmt = db.prepare(`
      INSERT INTO obstetric_dka_flowsheet_logs (
        dka_episode_id, patient_id, log_datetime, hours_from_presentation,
        blood_glucose_mg_dl, insulin_rate_units_hr, iv_fluid_type, iv_fluid_rate_ml_hr,
        vbg_ph, serum_bicarbonate_meq_l, calculated_anion_gap,
        serum_potassium_meq_l, potassium_replacement_meq_l,
        fhr_baseline_bpm, fhr_variability, fhr_decelerations,
        maternal_sbp_mmhg, maternal_dbp_mmhg, maternal_hr_bpm,
        urine_output_ml_hr, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromPresentation,
      data.bloodGlucoseMgDl,
      data.insulinRateUnitsHr,
      data.ivFluidType,
      data.ivFluidRateMlHr,
      data.vbgPh ?? null,
      data.serumBicarbonateMeqL ?? null,
      data.calculatedAnionGap ?? null,
      data.serumPotassiumMeqL,
      data.potassiumReplacementMeqL,
      data.fhrBaselineBpm ?? null,
      data.fhrVariability ?? null,
      data.fhrDecelerations ?? null,
      data.maternalSbpMmhg ?? null,
      data.maternalDbpMmhg ?? null,
      data.maternalHrBpm ?? null,
      data.urineOutputMlHr ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_dka.flowsheet_create',
      entity: 'obstetric_dka_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), bloodGlucoseMgDl: data.bloodGlucoseMgDl },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Flowsheet Checkpoint
  app.delete('/api/obstetric-dka/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageObstetricDka(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id FROM obstetric_dka_flowsheet_logs WHERE id = ? AND dka_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_dka_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_dka.flowsheet_delete',
      entity: 'obstetric_dka_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
