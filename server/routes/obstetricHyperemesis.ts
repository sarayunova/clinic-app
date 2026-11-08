import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricHyperemesis,
} from '../../web/src/obstetricHyperemesisEngine.js';

function assertCanManageHyperemesis(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric hyperemesis protocols');
  }
  return user;
}

const hyperemesisEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(4.0).max(44.0),
  puqeNauseaHours: z.coerce.number().int().min(1).max(5),
  puqeVomitingEpisodes: z.coerce.number().int().min(1).max(5),
  puqeRetchingEpisodes: z.coerce.number().int().min(1).max(5),
  weightLossPercent: z.coerce.number().min(0.0).max(35.0),
  ketonuriaLevel: z.enum([
    'negative',
    'trace',
    'one_plus',
    'two_plus',
    'three_plus',
    'four_plus',
  ]),
  serumPotassiumMmolL: z.coerce.number().min(1.5).max(7.0),
  serumSodiumMmolL: z.coerce.number().min(100.0).max(160.0),
  serumChlorideMmolL: z.coerce.number().min(70.0).max(130.0),
  bicarbonateMmolL: z.coerce.number().min(10.0).max(45.0),
  parenteralThiamineGivenBeforeDextrose: z.boolean().default(true),
  wernickeTriadSymptomsPresent: z.boolean().default(false),
  currentAntiemeticTier: z.enum([
    'tier_1_doxylamine_pyridoxine',
    'tier_2_dimenhydrinate_or_metoclopramide',
    'tier_3_ondansetron_5ht3_antagonist',
    'tier_4_corticosteroid_methylprednisolone_pulse',
    'refractory_enteral_jejunostomy_tpn',
  ]).default('tier_1_doxylamine_pyridoxine'),
  thromboprophylaxisLmwhPrescribed: z.boolean().default(false),
  status: z.enum([
    'inpatient_iv_hydration_thiamine',
    'antiemetic_step_up_escalation',
    'corticosteroid_pulse_therapy',
    'oral_tolerance_dietary_reintroduction',
    'outpatient_maintenance_surveillance',
    'resolved_discharged_home',
  ]).default('inpatient_iv_hydration_thiamine'),
  clinicalNotes: z.string().optional().nullable(),
});

const hyperemesisFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  dayOfTreatment: z.coerce.number().int().min(1).max(180),
  puqeScoreTotal: z.coerce.number().int().min(3).max(15),
  vomitingEpisodes24h: z.coerce.number().int().min(0).max(50),
  ketonuriaDipstick: z.enum([
    'negative',
    'trace',
    'one_plus',
    'two_plus',
    'three_plus',
    'four_plus',
  ]),
  ivFluidBalanceMl24h: z.coerce.number().min(-3000.0).max(6000.0),
  oralFluidIntakeMl: z.coerce.number().min(0.0).max(5000.0),
  potassiumMmolL: z.coerce.number().min(1.5).max(7.0),
  thiamineAdministered: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

export function registerObstetricHyperemesisRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/obstetric-hyperemesis/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(hyperemesisEpisodeSchema.omit({ patientId: true }), req.body);
    const evaluation = evaluateObstetricHyperemesis({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      puqeNauseaHours: data.puqeNauseaHours,
      puqeVomitingEpisodes: data.puqeVomitingEpisodes,
      puqeRetchingEpisodes: data.puqeRetchingEpisodes,
      weightLossPercent: data.weightLossPercent,
      ketonuriaLevel: data.ketonuriaLevel,
      serumPotassiumMmolL: data.serumPotassiumMmolL,
      serumSodiumMmolL: data.serumSodiumMmolL,
      serumChlorideMmolL: data.serumChlorideMmolL,
      bicarbonateMmolL: data.bicarbonateMmolL,
      parenteralThiamineGivenBeforeDextrose: data.parenteralThiamineGivenBeforeDextrose,
      wernickeTriadSymptomsPresent: data.wernickeTriadSymptomsPresent,
      currentAntiemeticTier: data.currentAntiemeticTier,
      thromboprophylaxisLmwhPrescribed: data.thromboprophylaxisLmwhPrescribed,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-hyperemesis/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*, p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_hyperemesis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];
    if (patientId) {
      query += ' WHERE e.patient_id = ?';
      params.push(Number(patientId));
    }
    query += ' ORDER BY e.id DESC';

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/obstetric-hyperemesis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_hyperemesis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric Hyperemesis episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_hyperemesis_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.hyperemesis_episode_id = ?
      ORDER BY l.day_of_treatment ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateObstetricHyperemesis({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      puqeNauseaHours: episode.puqe_nausea_hours,
      puqeVomitingEpisodes: episode.puqe_vomiting_episodes,
      puqeRetchingEpisodes: episode.puqe_retching_episodes,
      weightLossPercent: episode.weight_loss_percent,
      ketonuriaLevel: episode.ketonuria_level,
      serumPotassiumMmolL: episode.serum_potassium_mmol_l,
      serumSodiumMmolL: episode.serum_sodium_mmol_l,
      serumChlorideMmolL: episode.serum_chloride_mmol_l,
      bicarbonateMmolL: episode.bicarbonate_mmol_l,
      parenteralThiamineGivenBeforeDextrose: Boolean(episode.parenteral_thiamine_given_before_dextrose),
      wernickeTriadSymptomsPresent: Boolean(episode.wernicke_triad_symptoms_present),
      currentAntiemeticTier: episode.current_antiemetic_tier,
      thromboprophylaxisLmwhPrescribed: Boolean(episode.thromboprophylaxis_lmwh_prescribed),
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/obstetric-hyperemesis/episodes', async (req) => {
    const user = assertCanManageHyperemesis(req);
    const data = parse(hyperemesisEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM obstetric_hyperemesis_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `HG-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_hyperemesis_episodes (
        patient_id, admission_id, episode_code, onset_datetime, gestational_age_weeks,
        puqe_nausea_hours, puqe_vomiting_episodes, puqe_retching_episodes,
        weight_loss_percent, ketonuria_level,
        serum_potassium_mmol_l, serum_sodium_mmol_l, serum_chloride_mmol_l, bicarbonate_mmol_l,
        parenteral_thiamine_given_before_dextrose, wernicke_triad_symptoms_present,
        current_antiemetic_tier, thromboprophylaxis_lmwh_prescribed,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.puqeNauseaHours,
      data.puqeVomitingEpisodes,
      data.puqeRetchingEpisodes,
      data.weightLossPercent,
      data.ketonuriaLevel,
      data.serumPotassiumMmolL,
      data.serumSodiumMmolL,
      data.serumChlorideMmolL,
      data.bicarbonateMmolL,
      data.parenteralThiamineGivenBeforeDextrose ? 1 : 0,
      data.wernickeTriadSymptomsPresent ? 1 : 0,
      data.currentAntiemeticTier,
      data.thromboprophylaxisLmwhPrescribed ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hyperemesis.create',
      entity: 'obstetric_hyperemesis_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, tier: data.currentAntiemeticTier },
    });

    const episode = db.prepare(`SELECT * FROM obstetric_hyperemesis_episodes WHERE id = ?`).get(episodeId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/obstetric-hyperemesis/episodes/:id', async (req) => {
    const user = assertCanManageHyperemesis(req);
    const { id } = req.params as { id: string };
    const data = parse(hyperemesisEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_hyperemesis_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric Hyperemesis episode not found');

    db.prepare(`
      UPDATE obstetric_hyperemesis_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, gestational_age_weeks = ?,
        puqe_nausea_hours = ?, puqe_vomiting_episodes = ?, puqe_retching_episodes = ?,
        weight_loss_percent = ?, ketonuria_level = ?,
        serum_potassium_mmol_l = ?, serum_sodium_mmol_l = ?, serum_chloride_mmol_l = ?, bicarbonate_mmol_l = ?,
        parenteral_thiamine_given_before_dextrose = ?, wernicke_triad_symptoms_present = ?,
        current_antiemetic_tier = ?, thromboprophylaxis_lmwh_prescribed = ?,
        status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.puqeNauseaHours,
      data.puqeVomitingEpisodes,
      data.puqeRetchingEpisodes,
      data.weightLossPercent,
      data.ketonuriaLevel,
      data.serumPotassiumMmolL,
      data.serumSodiumMmolL,
      data.serumChlorideMmolL,
      data.bicarbonateMmolL,
      data.parenteralThiamineGivenBeforeDextrose ? 1 : 0,
      data.wernickeTriadSymptomsPresent ? 1 : 0,
      data.currentAntiemeticTier,
      data.thromboprophylaxisLmwhPrescribed ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hyperemesis.update',
      entity: 'obstetric_hyperemesis_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status: data.status },
    });

    const episode = db.prepare(`SELECT * FROM obstetric_hyperemesis_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Patch Status
  app.patch('/api/obstetric-hyperemesis/episodes/:id/status', async (req) => {
    const user = assertCanManageHyperemesis(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM obstetric_hyperemesis_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric Hyperemesis episode not found');

    db.prepare(`
      UPDATE obstetric_hyperemesis_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hyperemesis.status_change',
      entity: 'obstetric_hyperemesis_episodes',
      entityId: Number(id),
      detail: { status },
    });

    return { ok: true };
  });

  // 7. Delete Episode (Doctor only)
  app.delete('/api/obstetric-hyperemesis/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete Hyperemesis episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM obstetric_hyperemesis_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric Hyperemesis episode not found');

    db.prepare(`DELETE FROM obstetric_hyperemesis_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hyperemesis.delete',
      entity: 'obstetric_hyperemesis_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/obstetric-hyperemesis/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageHyperemesis(req);
    const { id } = req.params as { id: string };
    const data = parse(hyperemesisFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM obstetric_hyperemesis_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric Hyperemesis episode not found');

    const result = db.prepare(`
      INSERT INTO obstetric_hyperemesis_flowsheet_logs (
        hyperemesis_episode_id, patient_id, log_datetime, day_of_treatment,
        puqe_score_total, vomiting_episodes_24h, ketonuria_dipstick,
        iv_fluid_balance_ml_24h, oral_fluid_intake_ml, potassium_mmol_l,
        thiamine_administered, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.dayOfTreatment,
      data.puqeScoreTotal,
      data.vomitingEpisodes24h,
      data.ketonuriaDipstick,
      data.ivFluidBalanceMl24h,
      data.oralFluidIntakeMl,
      data.potassiumMmolL,
      data.thiamineAdministered ? 1 : 0,
      data.notes || null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hyperemesis.flowsheet_add',
      entity: 'obstetric_hyperemesis_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, puqe: data.puqeScoreTotal },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM obstetric_hyperemesis_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/obstetric-hyperemesis/flowsheet/:id', async (req) => {
    const user = assertCanManageHyperemesis(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM obstetric_hyperemesis_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM obstetric_hyperemesis_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hyperemesis.flowsheet_delete',
      entity: 'obstetric_hyperemesis_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.hyperemesis_episode_id },
    });

    return { ok: true };
  });
}
