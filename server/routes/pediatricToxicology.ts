import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricToxicology,
} from '../../web/src/pediatricToxicologyEngine.js';

function assertCanManageToxicology(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric toxicology protocols');
  }
  return user;
}

const toxicEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  ingestionDatetime: z.string().min(1),
  presentationDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.1).max(21.0),
  weightKg: z.coerce.number().min(2.0).max(150.0),
  substanceCategory: z.enum([
    'acetaminophen_paracetamol',
    'iron_elemental_supplement',
    'organophosphate_carbamate',
    'caustic_alkali_acid_battery',
    'hydrocarbon_petroleum',
    'other_unidentified_toxin',
  ]),
  ingestedDoseMgKg: z.coerce.number().min(0.0).max(5000.0).default(0.0),
  hoursPostIngestion: z.coerce.number().min(0.0).max(168.0),
  serumLevelValue: z.coerce.number().min(0.0).max(5000.0).default(0.0),
  rumackMatthewLineBreached: z.boolean().default(false),
  altUL: z.coerce.number().min(5.0).max(10000.0).default(20.0),
  astUL: z.coerce.number().min(5.0).max(10000.0).default(22.0),
  totalBilirubinMgDl: z.coerce.number().min(0.1).max(50.0).default(0.6),
  prothrombinTimeInr: z.coerce.number().min(0.7).max(20.0).default(1.0),
  antidoteIndicated: z.boolean().default(false),
  antidoteAdministered: z.enum([
    'iv_n_acetylcysteine_nac_protocol',
    'iv_deferoxamine_chelation',
    'atropine_pralidoxime_regimen',
    'activated_charcoal_single_dose',
    'whole_bowel_irrigation_peg',
    'supportive_care_only',
  ]).default('supportive_care_only'),
  gastricDecontaminationContraindicated: z.boolean().default(false),
  status: z.enum([
    'acute_poisoning_triage',
    'antidote_infusion_active',
    'picu_organ_support_monitoring',
    'toxic_levels_clearing',
    'convalescent_hepatic_recovery',
    'resolved_discharged_home',
  ]).default('acute_poisoning_triage'),
  clinicalNotes: z.string().optional().nullable(),
});

const toxicFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromIngestion: z.coerce.number().min(0.0).max(168.0),
  heartRateBpm: z.coerce.number().int().min(30).max(250),
  systolicBpMmhg: z.coerce.number().int().min(30).max(250),
  respiratoryRate: z.coerce.number().int().min(5).max(100),
  spo2Percent: z.coerce.number().min(40.0).max(100.0),
  altUL: z.coerce.number().min(5.0).max(10000.0),
  astUL: z.coerce.number().min(5.0).max(10000.0),
  toxinSerumLevel: z.coerce.number().min(0.0).max(5000.0).default(0.0),
  vinRoseUrineObserved: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export function registerPediatricToxicologyRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/pediatric-toxicology/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(toxicEpisodeSchema.omit({ patientId: true }).partial({ ingestionDatetime: true, presentationDatetime: true, status: true }), req.body);
    const evaluation = evaluatePediatricToxicology({
      ageYears: data.ageYears,
      weightKg: data.weightKg,
      substanceCategory: data.substanceCategory,
      ingestedDoseMgKg: data.ingestedDoseMgKg,
      hoursPostIngestion: data.hoursPostIngestion,
      serumLevelValue: data.serumLevelValue,
      rumackMatthewLineBreached: data.rumackMatthewLineBreached,
      altUL: data.altUL,
      astUL: data.astUL,
      totalBilirubinMgDl: data.totalBilirubinMgDl,
      prothrombinTimeInr: data.prothrombinTimeInr,
      antidoteIndicated: data.antidoteIndicated,
      antidoteAdministered: data.antidoteAdministered,
      gastricDecontaminationContraindicated: data.gastricDecontaminationContraindicated,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-toxicology/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM pediatric_toxic_ingestion_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM pediatric_toxic_ingestion_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.created_at DESC
      `).all();
    }

    return { episodes };
  });

  // 3. Get Episode by ID
  app.get('/api/pediatric-toxicology/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM pediatric_toxic_ingestion_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric toxicology episode not found');

    const flowsheet = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM pediatric_toxic_ingestion_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.episode_id = ?
      ORDER BY f.hours_from_ingestion ASC, f.created_at ASC
    `).all(Number(id));

    const evaluation = evaluatePediatricToxicology({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      substanceCategory: episode.substance_category,
      ingestedDoseMgKg: episode.ingested_dose_mg_kg,
      hoursPostIngestion: episode.hours_post_ingestion,
      serumLevelValue: episode.serum_level_value,
      rumackMatthewLineBreached: Boolean(episode.rumack_matthew_line_breached),
      altUL: episode.alt_u_l,
      astUL: episode.ast_u_l,
      totalBilirubinMgDl: episode.total_bilirubin_mg_dl,
      prothrombinTimeInr: episode.prothrombin_time_inr,
      antidoteIndicated: Boolean(episode.antidote_indicated),
      antidoteAdministered: episode.antidote_administered,
      gastricDecontaminationContraindicated: Boolean(episode.gastric_decontamination_contraindicated),
    });

    return { episode, flowsheet, evaluation };
  });

  // 4. Create Episode
  app.post('/api/pediatric-toxicology/episodes', async (req, reply) => {
    const user = assertCanManageToxicology(req);
    const data = parse(toxicEpisodeSchema, req.body);

    const episodeCode = `TOX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;

    const result = db.prepare(`
      INSERT INTO pediatric_toxic_ingestion_episodes (
        patient_id, admission_id, episode_code,
        ingestion_datetime, presentation_datetime,
        age_years, weight_kg, substance_category,
        ingested_dose_mg_kg, hours_post_ingestion, serum_level_value,
        rumack_matthew_line_breached, alt_u_l, ast_u_l,
        total_bilirubin_mg_dl, prothrombin_time_inr,
        antidote_indicated, antidote_administered,
        gastric_decontamination_contraindicated,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.ingestionDatetime,
      data.presentationDatetime,
      data.ageYears,
      data.weightKg,
      data.substanceCategory,
      data.ingestedDoseMgKg,
      data.hoursPostIngestion,
      data.serumLevelValue,
      data.rumackMatthewLineBreached ? 1 : 0,
      data.altUL,
      data.astUL,
      data.totalBilirubinMgDl,
      data.prothrombinTimeInr,
      data.antidoteIndicated ? 1 : 0,
      data.antidoteAdministered,
      data.gastricDecontaminationContraindicated ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const created = db.prepare(`SELECT * FROM pediatric_toxic_ingestion_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_toxicology.episode_create',
      entity: 'pediatric_toxic_ingestion_episodes',
      entityId: created.id,
      detail: { episodeId: created.id, episodeCode, patientId: data.patientId },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/pediatric-toxicology/episodes/:id', async (req) => {
    const user = assertCanManageToxicology(req);
    const { id } = req.params as { id: string };
    const data = parse(toxicEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_toxic_ingestion_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric toxicology episode not found');

    db.prepare(`
      UPDATE pediatric_toxic_ingestion_episodes SET
        admission_id = ?,
        ingestion_datetime = ?,
        presentation_datetime = ?,
        age_years = ?,
        weight_kg = ?,
        substance_category = ?,
        ingested_dose_mg_kg = ?,
        hours_post_ingestion = ?,
        serum_level_value = ?,
        rumack_matthew_line_breached = ?,
        alt_u_l = ?,
        ast_u_l = ?,
        total_bilirubin_mg_dl = ?,
        prothrombin_time_inr = ?,
        antidote_indicated = ?,
        antidote_administered = ?,
        gastric_decontamination_contraindicated = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.admissionId || null,
      data.ingestionDatetime,
      data.presentationDatetime,
      data.ageYears,
      data.weightKg,
      data.substanceCategory,
      data.ingestedDoseMgKg,
      data.hoursPostIngestion,
      data.serumLevelValue,
      data.rumackMatthewLineBreached ? 1 : 0,
      data.altUL,
      data.astUL,
      data.totalBilirubinMgDl,
      data.prothrombinTimeInr,
      data.antidoteIndicated ? 1 : 0,
      data.antidoteAdministered,
      data.gastricDecontaminationContraindicated ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM pediatric_toxic_ingestion_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_toxicology.episode_update',
      entity: 'pediatric_toxic_ingestion_episodes',
      entityId: updated.id,
      detail: { episodeId: updated.id, status: data.status },
    });

    return { episode: updated };
  });

  // 6. Patch Status
  app.patch('/api/pediatric-toxicology/episodes/:id/status', async (req) => {
    const user = assertCanManageToxicology(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({ status: toxicEpisodeSchema.shape.status }), req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_toxic_ingestion_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric toxicology episode not found');

    db.prepare(`
      UPDATE pediatric_toxic_ingestion_episodes SET
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    const updated = db.prepare(`SELECT * FROM pediatric_toxic_ingestion_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_toxicology.status_change',
      entity: 'pediatric_toxic_ingestion_episodes',
      entityId: updated.id,
      detail: { episodeId: updated.id, previousStatus: existing.status, newStatus: status },
    });

    return { episode: updated };
  });

  // 7. Delete Episode
  app.delete('/api/pediatric-toxicology/episodes/:id', async (req) => {
    const user = assertCanManageToxicology(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM pediatric_toxic_ingestion_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Pediatric toxicology episode not found');

    db.prepare(`DELETE FROM pediatric_toxic_ingestion_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_toxicology.episode_delete',
      entity: 'pediatric_toxic_ingestion_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/pediatric-toxicology/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageToxicology(req);
    const { id } = req.params as { id: string };
    const data = parse(toxicFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM pediatric_toxic_ingestion_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric toxicology episode not found');

    const result = db.prepare(`
      INSERT INTO pediatric_toxic_ingestion_flowsheet_logs (
        episode_id, patient_id, log_datetime, hours_from_ingestion,
        heart_rate_bpm, systolic_bp_mmhg, respiratory_rate, spo2_percent,
        alt_u_l, ast_u_l, toxin_serum_level, vin_rose_urine_observed,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromIngestion,
      data.heartRateBpm,
      data.systolicBpMmhg,
      data.respiratoryRate,
      data.spo2Percent,
      data.altUL,
      data.astUL,
      data.toxinSerumLevel,
      data.vinRoseUrineObserved ? 1 : 0,
      data.notes || null,
      user.id
    );

    const created = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM pediatric_toxic_ingestion_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.id = ?
    `).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'pediatric_toxicology.flowsheet_add',
      entity: 'pediatric_toxic_ingestion_flowsheet_logs',
      entityId: created.id,
      detail: { episodeId: Number(id), altUL: data.altUL, toxinSerumLevel: data.toxinSerumLevel },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/pediatric-toxicology/episodes/:id/flowsheet/:logId', async (req) => {
    const user = assertCanManageToxicology(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare(`
      SELECT * FROM pediatric_toxic_ingestion_flowsheet_logs
      WHERE id = ? AND episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM pediatric_toxic_ingestion_flowsheet_logs WHERE id = ?`).run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_toxicology.flowsheet_delete',
      entity: 'pediatric_toxic_ingestion_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id), logId: Number(logId) },
    });

    return { success: true };
  });
}
