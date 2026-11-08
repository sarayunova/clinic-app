import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalEaTef,
} from '../../web/src/neonatalEaTefEngine.js';

function assertCanManageEaTef(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal EA/TEF protocols');
  }
  return user;
}

const eaTefEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageHours: z.coerce.number().int().min(0).max(720),
  weightKg: z.coerce.number().min(0.4).max(15.0),
  frothyOralSecretions: z.boolean().default(true),
  chokingCyanosisWithFeed: z.boolean().default(true),
  ogTubeCoilingDistanceCm: z.coerce.number().min(5.0).max(25.0),
  grossClassificationType: z.enum([
    'type_a_isolated_ea_no_fistula',
    'type_b_ea_with_proximal_tef',
    'type_c_ea_with_distal_tef',
    'type_d_ea_with_both_fistulas',
    'type_e_isolated_h_type_tef',
  ]),
  abdominalGasPattern: z.enum([
    'gasless_abdomen_no_distal_fistula',
    'aerated_gastrointestinal_tract',
    'massive_gastric_distension',
  ]),
  replogleTubeInSitu: z.boolean().default(true),
  replogleSuctionPressureMmHg: z.coerce.number().int().min(10).max(80).default(25),
  gapLengthClassification: z.enum([
    'short_gap_primary_anastomosis',
    'intermediate_gap_1_to_3_cm',
    'long_gap_greater_3_cm_or_vertebrae',
  ]),
  vacterlVertebralAnomaly: z.boolean().default(false),
  vacterlAnorectalMalformation: z.boolean().default(false),
  vacterlCardiacAnomaly: z.boolean().default(false),
  vacterlRightAorticArch: z.boolean().default(false),
  vacterlRenalUltrasoundAbnormal: z.boolean().default(false),
  vacterlLimbRadialAnomaly: z.boolean().default(false),
  headOfBedElevated30deg: z.boolean().default(true),
  surgicalProcedurePlanned: z.enum([
    'primary_extrapleural_repair_fistula_ligation',
    'thoracoscopic_repair_fistula_ligation',
    'staged_gastrostomy_delayed_anastomosis',
    'cervical_esophagostomy',
  ]),
  status: z.enum([
    'preop_replogle_sump_decompression',
    'in_operating_room_thoracotomy',
    'postop_transanastomotic_tube_recovery',
    'esophagram_contrast_clearance',
    'resolved_full_oral_feeding',
  ]).default('preop_replogle_sump_decompression'),
  clinicalNotes: z.string().optional().nullable(),
});

const eaTefFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromAdmission: z.coerce.number().min(0).max(720),
  replogleSalineFlushed: z.boolean().default(true),
  replogleAspirateVolumeMl: z.coerce.number().min(0).max(500).optional().nullable(),
  replogleAspirateCharacter: z.enum([
    'clear_saliva',
    'frothy_mucus',
    'blood_tinged',
    'bilious_reflux',
  ]),
  heartRate: z.coerce.number().int().min(30).max(250),
  respiratoryRate: z.coerce.number().int().min(5).max(120),
  oxygenSaturationPct: z.coerce.number().min(50).max(100),
  abdominalGirthCm: z.coerce.number().min(15).max(65).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalEaTefRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/neonatal-ea-tef/evaluate', async (req) => {
    assertCanManageEaTef(req);
    const body = req.body as any;

    const evaluation = evaluateNeonatalEaTef({
      ageHours: Number(body.ageHours || 12),
      weightKg: Number(body.weightKg || 3.0),
      frothyOralSecretions: body.frothyOralSecretions !== undefined ? Boolean(body.frothyOralSecretions) : true,
      chokingCyanosisWithFeed: body.chokingCyanosisWithFeed !== undefined ? Boolean(body.chokingCyanosisWithFeed) : true,
      ogTubeCoilingDistanceCm: Number(body.ogTubeCoilingDistanceCm || 10.0),
      grossClassificationType: body.grossClassificationType || 'type_c_ea_with_distal_tef',
      abdominalGasPattern: body.abdominalGasPattern || 'aerated_gastrointestinal_tract',
      replogleTubeInSitu: body.replogleTubeInSitu !== undefined ? Boolean(body.replogleTubeInSitu) : true,
      replogleSuctionPressureMmHg: Number(body.replogleSuctionPressureMmHg || 25),
      gapLengthClassification: body.gapLengthClassification || 'short_gap_primary_anastomosis',
      vacterlVertebralAnomaly: Boolean(body.vacterlVertebralAnomaly),
      vacterlAnorectalMalformation: Boolean(body.vacterlAnorectalMalformation),
      vacterlCardiacAnomaly: Boolean(body.vacterlCardiacAnomaly),
      vacterlRightAorticArch: Boolean(body.vacterlRightAorticArch),
      vacterlRenalUltrasoundAbnormal: Boolean(body.vacterlRenalUltrasoundAbnormal),
      vacterlLimbRadialAnomaly: Boolean(body.vacterlLimbRadialAnomaly),
      headOfBedElevated30deg: body.headOfBedElevated30deg !== undefined ? Boolean(body.headOfBedElevated30deg) : true,
      surgicalProcedurePlanned: body.surgicalProcedurePlanned || 'primary_extrapleural_repair_fistula_ligation',
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-ea-tef/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_ea_tef_episodes e
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

  // 3. Get Episode Details with Flowsheet Logs
  app.get('/api/neonatal-ea-tef/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_ea_tef_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal EA/TEF episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_ea_tef_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.ea_tef_episode_id = ?
      ORDER BY l.hours_from_admission ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateNeonatalEaTef({
      ageHours: episode.age_hours,
      weightKg: episode.weight_kg,
      frothyOralSecretions: Boolean(episode.frothy_oral_secretions),
      chokingCyanosisWithFeed: Boolean(episode.choking_cyanosis_with_feed),
      ogTubeCoilingDistanceCm: episode.og_tube_coiling_distance_cm,
      grossClassificationType: episode.gross_classification_type,
      abdominalGasPattern: episode.abdominal_gas_pattern,
      replogleTubeInSitu: Boolean(episode.replogle_tube_in_situ),
      replogleSuctionPressureMmHg: episode.replogle_suction_pressure_mmhg,
      gapLengthClassification: episode.gap_length_classification,
      vacterlVertebralAnomaly: Boolean(episode.vacterl_vertebral_anomaly),
      vacterlAnorectalMalformation: Boolean(episode.vacterl_anorectal_malformation),
      vacterlCardiacAnomaly: Boolean(episode.vacterl_cardiac_anomaly),
      vacterlRightAorticArch: Boolean(episode.vacterl_right_aortic_arch),
      vacterlRenalUltrasoundAbnormal: Boolean(episode.vacterl_renal_ultrasound_abnormal),
      vacterlLimbRadialAnomaly: Boolean(episode.vacterl_limb_radial_anomaly),
      headOfBedElevated30deg: Boolean(episode.head_of_bed_elevated_30deg),
      surgicalProcedurePlanned: episode.surgical_procedure_planned,
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/neonatal-ea-tef/episodes', async (req) => {
    const user = assertCanManageEaTef(req);
    const data = parse(eaTefEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM neonatal_ea_tef_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `EATEF-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_ea_tef_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_hours, weight_kg,
        frothy_oral_secretions, choking_cyanosis_with_feed, og_tube_coiling_distance_cm,
        gross_classification_type, abdominal_gas_pattern, replogle_tube_in_situ,
        replogle_suction_pressure_mmhg, gap_length_classification,
        vacterl_vertebral_anomaly, vacterl_anorectal_malformation, vacterl_cardiac_anomaly,
        vacterl_right_aortic_arch, vacterl_renal_ultrasound_abnormal, vacterl_limb_radial_anomaly,
        head_of_bed_elevated_30deg, surgical_procedure_planned, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
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
      data.frothyOralSecretions ? 1 : 0,
      data.chokingCyanosisWithFeed ? 1 : 0,
      data.ogTubeCoilingDistanceCm,
      data.grossClassificationType,
      data.abdominalGasPattern,
      data.replogleTubeInSitu ? 1 : 0,
      data.replogleSuctionPressureMmHg,
      data.gapLengthClassification,
      data.vacterlVertebralAnomaly ? 1 : 0,
      data.vacterlAnorectalMalformation ? 1 : 0,
      data.vacterlCardiacAnomaly ? 1 : 0,
      data.vacterlRightAorticArch ? 1 : 0,
      data.vacterlRenalUltrasoundAbnormal ? 1 : 0,
      data.vacterlLimbRadialAnomaly ? 1 : 0,
      data.headOfBedElevated30deg ? 1 : 0,
      data.surgicalProcedurePlanned,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ea_tef.create',
      entity: 'neonatal_ea_tef_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM neonatal_ea_tef_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/neonatal-ea-tef/episodes/:id', async (req) => {
    const user = assertCanManageEaTef(req);
    const { id } = req.params as { id: string };
    const data = parse(eaTefEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM neonatal_ea_tef_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Neonatal EA/TEF episode not found');

    db.prepare(`
      UPDATE neonatal_ea_tef_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, age_hours = ?, weight_kg = ?,
        frothy_oral_secretions = ?, choking_cyanosis_with_feed = ?, og_tube_coiling_distance_cm = ?,
        gross_classification_type = ?, abdominal_gas_pattern = ?, replogle_tube_in_situ = ?,
        replogle_suction_pressure_mmhg = ?, gap_length_classification = ?,
        vacterl_vertebral_anomaly = ?, vacterl_anorectal_malformation = ?, vacterl_cardiac_anomaly = ?,
        vacterl_right_aortic_arch = ?, vacterl_renal_ultrasound_abnormal = ?, vacterl_limb_radial_anomaly = ?,
        head_of_bed_elevated_30deg = ?, surgical_procedure_planned = ?, status = ?, clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.ageHours,
      data.weightKg,
      data.frothyOralSecretions ? 1 : 0,
      data.chokingCyanosisWithFeed ? 1 : 0,
      data.ogTubeCoilingDistanceCm,
      data.grossClassificationType,
      data.abdominalGasPattern,
      data.replogleTubeInSitu ? 1 : 0,
      data.replogleSuctionPressureMmHg,
      data.gapLengthClassification,
      data.vacterlVertebralAnomaly ? 1 : 0,
      data.vacterlAnorectalMalformation ? 1 : 0,
      data.vacterlCardiacAnomaly ? 1 : 0,
      data.vacterlRightAorticArch ? 1 : 0,
      data.vacterlRenalUltrasoundAbnormal ? 1 : 0,
      data.vacterlLimbRadialAnomaly ? 1 : 0,
      data.headOfBedElevated30deg ? 1 : 0,
      data.surgicalProcedurePlanned,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ea_tef.update',
      entity: 'neonatal_ea_tef_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: data.patientId },
    });

    const updated = db.prepare(`SELECT * FROM neonatal_ea_tef_episodes WHERE id = ?`).get(Number(id));
    return { episode: updated };
  });

  // 6. Add Flowsheet Log
  app.post('/api/neonatal-ea-tef/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageEaTef(req);
    const { id } = req.params as { id: string };
    const data = parse(eaTefFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT patient_id FROM neonatal_ea_tef_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal EA/TEF episode not found');

    const result = db.prepare(`
      INSERT INTO neonatal_ea_tef_flowsheet_logs (
        ea_tef_episode_id, patient_id, log_datetime, hours_from_admission,
        replogle_saline_flushed, replogle_aspirate_volume_ml, replogle_aspirate_character,
        heart_rate, respiratory_rate, oxygen_saturation_pct, abdominal_girth_cm, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromAdmission,
      data.replogleSalineFlushed ? 1 : 0,
      data.replogleAspirateVolumeMl || null,
      data.replogleAspirateCharacter,
      data.heartRate,
      data.respiratoryRate,
      data.oxygenSaturationPct,
      data.abdominalGirthCm || null,
      data.notes || null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ea_tef.flowsheet_add',
      entity: 'neonatal_ea_tef_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, patientId: episode.patient_id },
    });

    const log = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_ea_tef_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.id = ?
    `).get(logId);

    return { log };
  });
}
