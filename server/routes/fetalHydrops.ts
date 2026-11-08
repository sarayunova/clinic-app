import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateFetalHydrops,
  type SuspectedHydropsEtiology,
  type InUteroInterventionPlanned,
} from '../../web/src/fetalHydropsEngine.js';

function assertCanManageHydrops(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage fetal hydrops protocols');
  }
  return user;
}

const hydropsEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  diagnosisDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(12.0).max(43.0),
  fetalCompartmentsInvolvedCount: z.coerce.number().int().min(0).max(10).default(2),
  ascitesPresent: z.boolean().default(false),
  pleuralEffusionPresent: z.boolean().default(false),
  pericardialEffusionPresent: z.boolean().default(false),
  skinEdemaPresent: z.boolean().default(false),
  placentalEdemaPresent: z.boolean().default(false),
  polyhydramniosPresent: z.boolean().default(false),
  mcaPsvMom: z.coerce.number().min(0.2).max(5.0).default(1.0),
  suspectedEtiologyCategory: z.enum([
    'cardiovascular_structural_or_arrhythmia',
    'fetal_anemia_parvovirus_or_hemoglobinopathy',
    'chromosomal_genetic_aneuploidy',
    'thoracic_lymphatic_cpam_chylothorax',
    'twin_transfusion_ttts_or_taps',
    'inborn_errors_metabolism_lysosomal',
    'idiopathic_unexplained',
  ]),
  fetalArrhythmiaDetected: z.boolean().default(false),
  maternalMirrorSyndromeSuspected: z.boolean().default(false),
  maternalSystolicBpMmhg: z.coerce.number().int().min(60).max(250).default(120),
  maternalDiastolicBpMmhg: z.coerce.number().int().min(40).max(160).default(80),
  maternalProteinuriaGrade: z.enum(['nil', 'trace', '1_plus', '2_plus', '3_plus', '4_plus']).default('nil'),
  maternalGeneralizedAnasarca: z.boolean().default(false),
  inUteroInterventionPlanned: z.enum([
    'intrauterine_blood_transfusion_iut',
    'fetal_thoracocentesis_or_pigtail_shunt',
    'antiarrhythmic_transplacental_therapy',
    'amnioreduction_serial',
    'conservative_surveillance',
    'emergent_delivery_indicated',
  ]).default('conservative_surveillance'),
  status: z.enum([
    'diagnostic_workup',
    'in_utero_intervention_active',
    'mirror_syndrome_monitoring',
    'fetal_hydrops_resolving',
    'preterm_emergency_delivery',
    'intrauterine_fetal_demise',
    'resolved_neonatal_transition',
  ]).default('diagnostic_workup'),
  clinicalNotes: z.string().optional().nullable(),
});

const hydropsFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(12.0).max(43.0),
  fetalHeartRateBpm: z.coerce.number().int().min(40).max(260),
  mcaPsvCmS: z.coerce.number().min(5.0).max(200.0),
  mcaPsvMom: z.coerce.number().min(0.2).max(5.0),
  pleuralEffusionDepthMm: z.coerce.number().min(0.0).max(100.0).default(0.0),
  ascitesDepthMm: z.coerce.number().min(0.0).max(100.0).default(0.0),
  maternalBpSystolic: z.coerce.number().int().min(60).max(250),
  maternalBpDiastolic: z.coerce.number().int().min(40).max(160),
  maternalWeightKg: z.coerce.number().min(30.0).max(250.0),
  notes: z.string().optional().nullable(),
});

export function registerFetalHydropsRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview API (No DB Persistence)
  app.post('/api/fetal-hydrops/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const b = req.body as any;
    const evaluation = evaluateFetalHydrops({
      gestationalAgeWeeks: Number(b.gestationalAgeWeeks ?? 26.0),
      ascitesPresent: Boolean(b.ascitesPresent),
      pleuralEffusionPresent: Boolean(b.pleuralEffusionPresent),
      pericardialEffusionPresent: Boolean(b.pericardialEffusionPresent),
      skinEdemaPresent: Boolean(b.skinEdemaPresent),
      placentalEdemaPresent: Boolean(b.placentalEdemaPresent),
      polyhydramniosPresent: Boolean(b.polyhydramniosPresent),
      mcaPsvMom: Number(b.mcaPsvMom ?? 1.0),
      suspectedEtiologyCategory: b.suspectedEtiologyCategory || 'idiopathic_unexplained',
      fetalArrhythmiaDetected: Boolean(b.fetalArrhythmiaDetected),
      maternalMirrorSyndromeSuspected: Boolean(b.maternalMirrorSyndromeSuspected),
      maternalSystolicBpMmhg: Number(b.maternalSystolicBpMmhg ?? 120),
      maternalDiastolicBpMmhg: Number(b.maternalDiastolicBpMmhg ?? 80),
      maternalProteinuriaGrade: b.maternalProteinuriaGrade || 'nil',
      maternalGeneralizedAnasarca: Boolean(b.maternalGeneralizedAnasarca),
      inUteroInterventionPlanned: b.inUteroInterventionPlanned || 'conservative_surveillance',
    });
    return { evaluation };
  });

  // 2. List Episodes (supports ?patientId= query or all)
  app.get('/api/fetal-hydrops/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM fetal_hydrops_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.diagnosis_datetime DESC, e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM fetal_hydrops_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.diagnosis_datetime DESC, e.created_at DESC
      `).all();
    }
    return { episodes };
  });

  // 2b. List Episodes for Patient (URL param compatibility)
  app.get('/api/fetal-hydrops/patient/:patientId', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.params as { patientId: string };
    const episodes = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM fetal_hydrops_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.patient_id = ?
      ORDER BY e.diagnosis_datetime DESC, e.created_at DESC
    `).all(Number(patientId));
    return { episodes };
  });

  // 3. Get Single Episode with Flowsheet and Evaluation
  app.get('/api/fetal-hydrops/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM fetal_hydrops_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Fetal hydrops episode not found');

    const flowsheet = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM fetal_hydrops_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.episode_id = ?
      ORDER BY f.log_datetime ASC, f.created_at ASC
    `).all(Number(id));

    const evaluation = evaluateFetalHydrops({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      ascitesPresent: Boolean(episode.ascites_present),
      pleuralEffusionPresent: Boolean(episode.pleural_effusion_present),
      pericardialEffusionPresent: Boolean(episode.pericardial_effusion_present),
      skinEdemaPresent: Boolean(episode.skin_edema_present),
      placentalEdemaPresent: Boolean(episode.placental_edema_present),
      polyhydramniosPresent: Boolean(episode.polyhydramnios_present),
      mcaPsvMom: episode.mca_psv_mom,
      suspectedEtiologyCategory: episode.suspected_etiology_category,
      fetalArrhythmiaDetected: Boolean(episode.fetal_arrhythmia_detected),
      maternalMirrorSyndromeSuspected: Boolean(episode.maternal_mirror_syndrome_suspected),
      maternalSystolicBpMmhg: episode.maternal_systolic_bp_mmhg,
      maternalDiastolicBpMmhg: episode.maternal_diastolic_bp_mmhg,
      maternalProteinuriaGrade: episode.maternal_proteinuria_grade,
      maternalGeneralizedAnasarca: Boolean(episode.maternal_generalized_anasarca),
      inUteroInterventionPlanned: episode.in_utero_intervention_planned,
    });

    return { episode, flowsheet, evaluation };
  });

  // 4. Create Episode
  app.post('/api/fetal-hydrops/episodes', async (req, reply) => {
    const user = assertCanManageHydrops(req);
    const data = parse(hydropsEpisodeSchema, req.body);

    const codeSuffix = Math.floor(100 + Math.random() * 900);
    const episodeCode = `HYD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${codeSuffix}`;

    const result = db.prepare(`
      INSERT INTO fetal_hydrops_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        gestational_age_weeks, fetal_compartments_involved_count,
        ascites_present, pleural_effusion_present, pericardial_effusion_present,
        skin_edema_present, placental_edema_present, polyhydramnios_present,
        mca_psv_mom, suspected_etiology_category, fetal_arrhythmia_detected,
        maternal_mirror_syndrome_suspected, maternal_systolic_bp_mmhg,
        maternal_diastolic_bp_mmhg, maternal_proteinuria_grade,
        maternal_generalized_anasarca, in_utero_intervention_planned,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.diagnosisDatetime,
      data.gestationalAgeWeeks,
      data.fetalCompartmentsInvolvedCount,
      data.ascitesPresent ? 1 : 0,
      data.pleuralEffusionPresent ? 1 : 0,
      data.pericardialEffusionPresent ? 1 : 0,
      data.skinEdemaPresent ? 1 : 0,
      data.placentalEdemaPresent ? 1 : 0,
      data.polyhydramniosPresent ? 1 : 0,
      data.mcaPsvMom,
      data.suspectedEtiologyCategory,
      data.fetalArrhythmiaDetected ? 1 : 0,
      data.maternalMirrorSyndromeSuspected ? 1 : 0,
      data.maternalSystolicBpMmhg,
      data.maternalDiastolicBpMmhg,
      data.maternalProteinuriaGrade,
      data.maternalGeneralizedAnasarca ? 1 : 0,
      data.inUteroInterventionPlanned,
      data.status,
      user.id,
      data.clinicalNotes ?? null
    );

    const created = db.prepare(`SELECT * FROM fetal_hydrops_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'fetal_hydrops.create',
      entity: 'fetal_hydrops_episodes',
      entityId: created.id,
      detail: { patientId: data.patientId, episodeCode, status: data.status },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/fetal-hydrops/episodes/:id', async (req) => {
    const user = assertCanManageHydrops(req);
    const { id } = req.params as { id: string };
    const data = parse(hydropsEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM fetal_hydrops_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Fetal hydrops episode not found');

    db.prepare(`
      UPDATE fetal_hydrops_episodes SET
        gestational_age_weeks = ?,
        fetal_compartments_involved_count = ?,
        ascites_present = ?,
        pleural_effusion_present = ?,
        pericardial_effusion_present = ?,
        skin_edema_present = ?,
        placental_edema_present = ?,
        polyhydramnios_present = ?,
        mca_psv_mom = ?,
        suspected_etiology_category = ?,
        fetal_arrhythmia_detected = ?,
        maternal_mirror_syndrome_suspected = ?,
        maternal_systolic_bp_mmhg = ?,
        maternal_diastolic_bp_mmhg = ?,
        maternal_proteinuria_grade = ?,
        maternal_generalized_anasarca = ?,
        in_utero_intervention_planned = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.gestationalAgeWeeks,
      data.fetalCompartmentsInvolvedCount,
      data.ascitesPresent ? 1 : 0,
      data.pleuralEffusionPresent ? 1 : 0,
      data.pericardialEffusionPresent ? 1 : 0,
      data.skinEdemaPresent ? 1 : 0,
      data.placentalEdemaPresent ? 1 : 0,
      data.polyhydramniosPresent ? 1 : 0,
      data.mcaPsvMom,
      data.suspectedEtiologyCategory,
      data.fetalArrhythmiaDetected ? 1 : 0,
      data.maternalMirrorSyndromeSuspected ? 1 : 0,
      data.maternalSystolicBpMmhg,
      data.maternalDiastolicBpMmhg,
      data.maternalProteinuriaGrade,
      data.maternalGeneralizedAnasarca ? 1 : 0,
      data.inUteroInterventionPlanned,
      data.status,
      data.clinicalNotes ?? null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM fetal_hydrops_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'fetal_hydrops.update',
      entity: 'fetal_hydrops_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status: data.status },
    });

    return { episode: updated };
  });

  // 6. Update Status Only
  app.patch('/api/fetal-hydrops/episodes/:id/status', async (req) => {
    const user = assertCanManageHydrops(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({ status: z.string() }), req.body);

    const existing = db.prepare(`SELECT * FROM fetal_hydrops_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Fetal hydrops episode not found');

    db.prepare(`
      UPDATE fetal_hydrops_episodes SET
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    const updated = db.prepare(`SELECT * FROM fetal_hydrops_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'fetal_hydrops.status_change',
      entity: 'fetal_hydrops_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), oldStatus: existing.status, newStatus: status },
    });

    return { episode: updated };
  });

  // 7. Delete Episode
  app.delete('/api/fetal-hydrops/episodes/:id', async (req) => {
    const user = assertCanManageHydrops(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM fetal_hydrops_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Fetal hydrops episode not found');

    db.prepare(`DELETE FROM fetal_hydrops_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'fetal_hydrops.delete',
      entity: 'fetal_hydrops_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), code: existing.episode_code },
    });

    return { success: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/fetal-hydrops/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageHydrops(req);
    const { id } = req.params as { id: string };
    const data = parse(hydropsFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM fetal_hydrops_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Fetal hydrops episode not found');

    const result = db.prepare(`
      INSERT INTO fetal_hydrops_flowsheet_logs (
        episode_id, patient_id, log_datetime, gestational_age_weeks,
        fetal_heart_rate_bpm, mca_psv_cm_s, mca_psv_mom,
        pleural_effusion_depth_mm, ascites_depth_mm, maternal_bp_systolic,
        maternal_bp_diastolic, maternal_weight_kg, notes, logged_by_id
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
      data.gestationalAgeWeeks,
      data.fetalHeartRateBpm,
      data.mcaPsvCmS,
      data.mcaPsvMom,
      data.pleuralEffusionDepthMm,
      data.ascitesDepthMm,
      data.maternalBpSystolic,
      data.maternalBpDiastolic,
      data.maternalWeightKg,
      data.notes ?? null,
      user.id
    );

    const created = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM fetal_hydrops_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.id = ?
    `).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'fetal_hydrops.flowsheet_add',
      entity: 'fetal_hydrops_flowsheet_logs',
      entityId: created.id,
      detail: { episodeId: Number(id), mcaPsvMom: data.mcaPsvMom },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/fetal-hydrops/episodes/:id/flowsheet/:logId', async (req) => {
    const user = assertCanManageHydrops(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare(`
      SELECT * FROM fetal_hydrops_flowsheet_logs
      WHERE id = ? AND episode_id = ?
    `).get(Number(logId), Number(id)) as any;

    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM fetal_hydrops_flowsheet_logs WHERE id = ?`).run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'fetal_hydrops.flowsheet_delete',
      entity: 'fetal_hydrops_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id), logId: Number(logId) },
    });

    return { success: true };
  });
}
