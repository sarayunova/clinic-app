import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalIntestinalAtresia,
} from '../../web/src/neonatalIntestinalAtresiaEngine.js';

function assertCanManageAtresia(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal intestinal atresia protocols');
  }
  return user;
}

const atresiaEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageHours: z.coerce.number().int().min(0).max(720),
  weightKg: z.coerce.number().min(0.4).max(15.0),
  atresiaLevel: z.enum([
    'duodenal_atresia_complete',
    'duodenal_web_stenosis',
    'jejunoileal_atresia_type_1_membrane',
    'jejunoileal_atresia_type_2_cord',
    'jejunoileal_atresia_type_3a_gap',
    'jejunoileal_atresia_type_3b_apple_peel',
    'jejunoileal_atresia_type_4_multiple',
  ]),
  polyhydramniosAntenatal: z.boolean().default(false),
  biliousEmesisPresent: z.boolean().default(true),
  abdominalDistensionPattern: z.enum([
    'scaphoid_epigastric_fullness_only',
    'generalized_distension_visible_loops',
    'soft_non_distended',
  ]),
  radiographicGasPattern: z.enum([
    'double_bubble_sign_gasless_distal',
    'triple_bubble_sign',
    'multiple_dilated_loops_air_fluid_levels',
    'microcolon_on_contrast_enema',
  ]),
  downSyndromeFeaturesPresent: z.boolean().default(false),
  karyotypeTrisomy21Confirmed: z.boolean().default(false),
  echocardiogramCardiacDefect: z.boolean().default(false),
  replogleDecompressionActive: z.boolean().default(true),
  surgicalProcedurePlanned: z.enum([
    'duodenoduodenostomy_diamond_anastomosis',
    'duodenojejunostomy',
    'primary_end_to_oblique_anastomosis',
    'tapering_enteroplasty_anastomosis',
    'temporary_enterostomy_stoma',
  ]),
  transanastomoticTubePlaced: z.boolean().default(false),
  tpnCentralLineInSitu: z.boolean().default(false),
  status: z.enum([
    'preop_nasogastric_decompression',
    'contrast_imaging_enema_workup',
    'in_operating_room_reconstruction',
    'postop_transanastomotic_tube_tpn',
    'resolved_full_enteral_nutrition',
  ]).default('preop_nasogastric_decompression'),
  clinicalNotes: z.string().optional().nullable(),
});

const atresiaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromAdmission: z.coerce.number().min(0).max(720),
  nasogastricOutputMl: z.coerce.number().min(0).max(1000),
  nasogastricAspirateCharacter: z.enum([
    'clear_gastric',
    'bilious_dark_green',
    'feculent_stasis',
  ]),
  abdominalGirthCm: z.coerce.number().min(15).max(70),
  enteralFeedRateMlHr: z.coerce.number().min(0).max(50).default(0.0),
  stoolPassageObserved: z.boolean().default(false),
  stoolCharacter: z.enum([
    'none',
    'pale_mucus_plug',
    'transitional_meconium',
    'normal_yellow_breastmilk_stool',
  ]),
  heartRate: z.coerce.number().int().min(50).max(250),
  respiratoryRate: z.coerce.number().int().min(10).max(120),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalIntestinalAtresiaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/neonatal-intestinal-atresia/evaluate', async (req) => {
    assertCanManageAtresia(req);
    const body = req.body as any;

    const evaluation = evaluateNeonatalIntestinalAtresia({
      ageHours: Number(body.ageHours || 12),
      weightKg: Number(body.weightKg || 3.0),
      atresiaLevel: body.atresiaLevel || 'duodenal_atresia_complete',
      polyhydramniosAntenatal: Boolean(body.polyhydramniosAntenatal),
      biliousEmesisPresent: body.biliousEmesisPresent !== undefined ? Boolean(body.biliousEmesisPresent) : true,
      abdominalDistensionPattern: body.abdominalDistensionPattern || 'scaphoid_epigastric_fullness_only',
      radiographicGasPattern: body.radiographicGasPattern || 'double_bubble_sign_gasless_distal',
      downSyndromeFeaturesPresent: Boolean(body.downSyndromeFeaturesPresent),
      karyotypeTrisomy21Confirmed: Boolean(body.karyotypeTrisomy21Confirmed),
      echocardiogramCardiacDefect: Boolean(body.echocardiogramCardiacDefect),
      replogleDecompressionActive: body.replogleDecompressionActive !== undefined ? Boolean(body.replogleDecompressionActive) : true,
      surgicalProcedurePlanned: body.surgicalProcedurePlanned || 'duodenoduodenostomy_diamond_anastomosis',
      transanastomoticTubePlaced: Boolean(body.transanastomoticTubePlaced),
      tpnCentralLineInSitu: Boolean(body.tpnCentralLineInSitu),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-intestinal-atresia/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_intestinal_atresia_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` WHERE e.patient_id = ? `;
      params.push(Number(patientId));
    }

    query += ` ORDER BY e.id DESC`;

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/neonatal-intestinal-atresia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_intestinal_atresia_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal intestinal atresia episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_intestinal_atresia_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.atresia_episode_id = ?
      ORDER BY l.hours_from_admission ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateNeonatalIntestinalAtresia({
      ageHours: episode.age_hours,
      weightKg: episode.weight_kg,
      atresiaLevel: episode.atresia_level,
      polyhydramniosAntenatal: Boolean(episode.polyhydramnios_antenatal),
      biliousEmesisPresent: Boolean(episode.bilious_emesis_present),
      abdominalDistensionPattern: episode.abdominal_distension_pattern,
      radiographicGasPattern: episode.radiographic_gas_pattern,
      downSyndromeFeaturesPresent: Boolean(episode.down_syndrome_features_present),
      karyotypeTrisomy21Confirmed: Boolean(episode.karyotype_trisomy_21_confirmed),
      echocardiogramCardiacDefect: Boolean(episode.echocardiogram_cardiac_defect),
      replogleDecompressionActive: Boolean(episode.replogle_decompression_active),
      surgicalProcedurePlanned: episode.surgical_procedure_planned,
      transanastomoticTubePlaced: Boolean(episode.transanastomotic_tube_placed),
      tpnCentralLineInSitu: Boolean(episode.tpn_central_line_in_situ),
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/neonatal-intestinal-atresia/episodes', async (req) => {
    const user = assertCanManageAtresia(req);
    const data = parse(atresiaEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM neonatal_intestinal_atresia_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `ATRESIA-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_intestinal_atresia_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_hours, weight_kg,
        atresia_level, polyhydramnios_antenatal, bilious_emesis_present,
        abdominal_distension_pattern, radiographic_gas_pattern,
        down_syndrome_features_present, karyotype_trisomy_21_confirmed, echocardiogram_cardiac_defect,
        replogle_decompression_active, surgical_procedure_planned,
        transanastomotic_tube_placed, tpn_central_line_in_situ, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.ageHours,
      data.weightKg,
      data.atresiaLevel,
      data.polyhydramniosAntenatal ? 1 : 0,
      data.biliousEmesisPresent ? 1 : 0,
      data.abdominalDistensionPattern,
      data.radiographicGasPattern,
      data.downSyndromeFeaturesPresent ? 1 : 0,
      data.karyotypeTrisomy21Confirmed ? 1 : 0,
      data.echocardiogramCardiacDefect ? 1 : 0,
      data.replogleDecompressionActive ? 1 : 0,
      data.surgicalProcedurePlanned,
      data.transanastomoticTubePlaced ? 1 : 0,
      data.tpnCentralLineInSitu ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_intestinal_atresia.create',
      entity: 'neonatal_intestinal_atresia_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM neonatal_intestinal_atresia_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/neonatal-intestinal-atresia/episodes/:id', async (req) => {
    const user = assertCanManageAtresia(req);
    const { id } = req.params as { id: string };
    const data = parse(atresiaEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM neonatal_intestinal_atresia_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal intestinal atresia episode not found');

    db.prepare(`
      UPDATE neonatal_intestinal_atresia_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, age_hours = ?, weight_kg = ?,
        atresia_level = ?, polyhydramnios_antenatal = ?, bilious_emesis_present = ?,
        abdominal_distension_pattern = ?, radiographic_gas_pattern = ?,
        down_syndrome_features_present = ?, karyotype_trisomy_21_confirmed = ?, echocardiogram_cardiac_defect = ?,
        replogle_decompression_active = ?, surgical_procedure_planned = ?,
        transanastomotic_tube_placed = ?, tpn_central_line_in_situ = ?, status = ?, clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.ageHours,
      data.weightKg,
      data.atresiaLevel,
      data.polyhydramniosAntenatal ? 1 : 0,
      data.biliousEmesisPresent ? 1 : 0,
      data.abdominalDistensionPattern,
      data.radiographicGasPattern,
      data.downSyndromeFeaturesPresent ? 1 : 0,
      data.karyotypeTrisomy21Confirmed ? 1 : 0,
      data.echocardiogramCardiacDefect ? 1 : 0,
      data.replogleDecompressionActive ? 1 : 0,
      data.surgicalProcedurePlanned,
      data.transanastomoticTubePlaced ? 1 : 0,
      data.tpnCentralLineInSitu ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_intestinal_atresia.update',
      entity: 'neonatal_intestinal_atresia_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    const episode = db.prepare(`SELECT * FROM neonatal_intestinal_atresia_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Update Status
  app.patch('/api/neonatal-intestinal-atresia/episodes/:id/status', async (req) => {
    const user = assertCanManageAtresia(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM neonatal_intestinal_atresia_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal intestinal atresia episode not found');

    db.prepare(`
      UPDATE neonatal_intestinal_atresia_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_intestinal_atresia.status_update',
      entity: 'neonatal_intestinal_atresia_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/neonatal-intestinal-atresia/episodes/:id', async (req) => {
    const user = assertCanManageAtresia(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM neonatal_intestinal_atresia_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal intestinal atresia episode not found');

    db.prepare(`DELETE FROM neonatal_intestinal_atresia_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_intestinal_atresia.delete',
      entity: 'neonatal_intestinal_atresia_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/neonatal-intestinal-atresia/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageAtresia(req);
    const { id } = req.params as { id: string };
    const data = parse(atresiaFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM neonatal_intestinal_atresia_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal intestinal atresia episode not found');

    const result = db.prepare(`
      INSERT INTO neonatal_intestinal_atresia_flowsheet_logs (
        atresia_episode_id, patient_id, log_datetime, hours_from_admission,
        nasogastric_output_ml, nasogastric_aspirate_character, abdominal_girth_cm,
        enteral_feed_rate_ml_hr, stool_passage_observed, stool_character,
        heart_rate, respiratory_rate, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromAdmission,
      data.nasogastricOutputMl,
      data.nasogastricAspirateCharacter,
      data.abdominalGirthCm,
      data.enteralFeedRateMlHr,
      data.stoolPassageObserved ? 1 : 0,
      data.stoolCharacter,
      data.heartRate,
      data.respiratoryRate,
      data.notes || null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_intestinal_atresia.flowsheet_add',
      entity: 'neonatal_intestinal_atresia_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, outputMl: data.nasogastricOutputMl },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM neonatal_intestinal_atresia_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/neonatal-intestinal-atresia/flowsheet/:id', async (req) => {
    const user = assertCanManageAtresia(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM neonatal_intestinal_atresia_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM neonatal_intestinal_atresia_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_intestinal_atresia.flowsheet_delete',
      entity: 'neonatal_intestinal_atresia_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.atresia_episode_id },
    });

    return { ok: true };
  });
}
