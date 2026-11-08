import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricPdph,
} from '../../web/src/obstetricPdphEngine.js';

function assertCanManageObstetricPdph(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric PDPH protocols');
  }
  return user;
}

const obstetricPdphEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  procedureType: z.enum([
    'labor_epidural_adp',
    'spinal_anesthesia',
    'combined_spinal_epidural',
    'diagnostic_lumbar_puncture',
  ]),
  punctureDatetime: z.string().min(1),
  needleGauge: z.enum([
    '16G_tuohy',
    '17G_tuohy',
    '18G_tuohy',
    '22G_quincke',
    '25G_whitacre',
    '27G_whitacre',
    'other',
  ]),
  headacheOnsetDatetime: z.string().min(1),
  initialVasScore: z.coerce.number().min(0).max(10),
  posturalComponent: z.boolean().default(true),
  neckStiffness: z.boolean().default(false),
  auditorySymptoms: z.boolean().default(false),
  visualSymptomsDiplopia: z.boolean().default(false),
  conservativeHydrationMl24h: z.coerce.number().min(500).max(6000).default(2500),
  caffeineAdministered: z.boolean().default(false),
  analgesicsPrescribed: z.string().optional().nullable(),
  ebpIndicated: z.boolean().default(false),
  ebpPerformed: z.boolean().default(false),
  ebpDatetime: z.string().optional().nullable(),
  ebpBloodVolumeMl: z.coerce.number().min(0).max(30).optional().nullable(),
  ebpInterspace: z.string().optional().nullable(),
  postEbpVasScore: z.coerce.number().min(0).max(10).optional().nullable(),
  redFlagsPresent: z.boolean().default(false),
  redFlagNotes: z.string().optional().nullable(),
  status: z.enum([
    'conservative_management',
    'ebp_scheduled',
    'ebp_completed_resolving',
    'headache_resolved',
    'referred_neurology_imaging',
  ]).default('conservative_management'),
  clinicalNotes: z.string().optional().nullable(),
});

const pdphFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  postureAssessed: z.enum(['supine', 'sitting_upright', 'standing_ambulating']),
  vasPainScore: z.coerce.number().min(0).max(10),
  headacheReliefOnLying: z.boolean().default(true),
  bloodPressureSys: z.coerce.number().min(50).max(250).optional().nullable(),
  bloodPressureDia: z.coerce.number().min(30).max(150).optional().nullable(),
  heartRate: z.coerce.number().min(30).max(220).optional().nullable(),
  temperatureCelsius: z.coerce.number().min(34.0).max(42.0).optional().nullable(),
  neurologicalSymptomsPresent: z.boolean().default(false),
  interventionsGiven: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerObstetricPdphRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate PDPH protocol
  app.post('/api/obstetric-pdph/evaluate', async (req) => {
    assertCanManageObstetricPdph(req);
    const body = req.body as any;

    const evaluation = evaluateObstetricPdph({
      procedureType: body.procedureType || 'labor_epidural_adp',
      needleGauge: body.needleGauge || '16G_tuohy',
      initialVasScore: Number(body.initialVasScore || 7),
      posturalComponent: body.posturalComponent !== undefined ? Boolean(body.posturalComponent) : true,
      neckStiffness: Boolean(body.neckStiffness),
      auditorySymptoms: Boolean(body.auditorySymptoms),
      visualSymptomsDiplopia: Boolean(body.visualSymptomsDiplopia),
      conservativeHydrationMl24h: body.conservativeHydrationMl24h ? Number(body.conservativeHydrationMl24h) : 2500,
      caffeineAdministered: Boolean(body.caffeineAdministered),
      redFlagsPresent: Boolean(body.redFlagsPresent),
      temperatureCelsius: body.temperatureCelsius ? Number(body.temperatureCelsius) : undefined,
      bloodPressureSys: body.bloodPressureSys ? Number(body.bloodPressureSys) : undefined,
      bloodPressureDia: body.bloodPressureDia ? Number(body.bloodPressureDia) : undefined,
    });

    return { evaluation };
  });

  // 2. List PDPH Episodes
  app.get('/api/obstetric-pdph/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_pdph_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` WHERE e.patient_id = ? `;
      params.push(patientId);
    }

    query += ` ORDER BY e.id DESC`;
    const rows = db.prepare(query).all(...params) as any[];

    return {
      episodes: rows.map(r => ({
        ...r,
        postural_component: Boolean(r.postural_component),
        neck_stiffness: Boolean(r.neck_stiffness),
        auditory_symptoms: Boolean(r.auditory_symptoms),
        visual_symptoms_diplopia: Boolean(r.visual_symptoms_diplopia),
        caffeine_administered: Boolean(r.caffeine_administered),
        ebp_indicated: Boolean(r.ebp_indicated),
        ebp_performed: Boolean(r.ebp_performed),
        red_flags_present: Boolean(r.red_flags_present),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/obstetric-pdph/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_pdph_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Obstetric PDPH episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_pdph_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.pdph_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const evaluation = evaluateObstetricPdph({
      procedureType: episode.procedure_type,
      needleGauge: episode.needle_gauge,
      initialVasScore: episode.initial_vas_score,
      posturalComponent: Boolean(episode.postural_component),
      neckStiffness: Boolean(episode.neck_stiffness),
      auditorySymptoms: Boolean(episode.auditory_symptoms),
      visualSymptomsDiplopia: Boolean(episode.visual_symptoms_diplopia),
      conservativeHydrationMl24h: episode.conservative_hydration_ml_24h,
      caffeineAdministered: Boolean(episode.caffeine_administered),
      redFlagsPresent: Boolean(episode.red_flags_present),
    });

    return {
      episode: {
        ...episode,
        postural_component: Boolean(episode.postural_component),
        neck_stiffness: Boolean(episode.neck_stiffness),
        auditory_symptoms: Boolean(episode.auditory_symptoms),
        visual_symptoms_diplopia: Boolean(episode.visual_symptoms_diplopia),
        caffeine_administered: Boolean(episode.caffeine_administered),
        ebp_indicated: Boolean(episode.ebp_indicated),
        ebp_performed: Boolean(episode.ebp_performed),
        red_flags_present: Boolean(episode.red_flags_present),
      },
      evaluation,
      flowsheet: flowsheet.map(f => ({
        ...f,
        headache_relief_on_lying: Boolean(f.headache_relief_on_lying),
        neurological_symptoms_present: Boolean(f.neurological_symptoms_present),
      })),
    };
  });

  // 4. Create PDPH Episode
  app.post('/api/obstetric-pdph/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageObstetricPdph(req);
    const data = parse(obstetricPdphEpisodeSchema, req.body);

    const evaluation = evaluateObstetricPdph({
      procedureType: data.procedureType,
      needleGauge: data.needleGauge,
      initialVasScore: data.initialVasScore,
      posturalComponent: data.posturalComponent,
      neckStiffness: data.neckStiffness,
      auditorySymptoms: data.auditorySymptoms,
      visualSymptomsDiplopia: data.visualSymptomsDiplopia,
      conservativeHydrationMl24h: data.conservativeHydrationMl24h,
      caffeineAdministered: data.caffeineAdministered,
      redFlagsPresent: data.redFlagsPresent,
    });

    const dateStr = data.headacheOnsetDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `PDPH-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO obstetric_pdph_episodes (
        patient_id, admission_id, episode_code, procedure_type,
        puncture_datetime, needle_gauge, headache_onset_datetime,
        initial_vas_score, postural_component, neck_stiffness,
        auditory_symptoms, visual_symptoms_diplopia,
        conservative_hydration_ml_24h, caffeine_administered, analgesics_prescribed,
        ebp_indicated, ebp_performed, ebp_datetime,
        ebp_blood_volume_ml, ebp_interspace, post_ebp_vas_score,
        red_flags_present, red_flag_notes, status,
        consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.procedureType,
      data.punctureDatetime,
      data.needleGauge,
      data.headacheOnsetDatetime,
      data.initialVasScore,
      data.posturalComponent ? 1 : 0,
      data.neckStiffness ? 1 : 0,
      data.auditorySymptoms ? 1 : 0,
      data.visualSymptomsDiplopia ? 1 : 0,
      data.conservativeHydrationMl24h,
      data.caffeineAdministered ? 1 : 0,
      data.analgesicsPrescribed ?? null,
      (data.ebpIndicated || evaluation.ebpIndicated) ? 1 : 0,
      data.ebpPerformed ? 1 : 0,
      data.ebpDatetime ?? null,
      data.ebpBloodVolumeMl ?? null,
      data.ebpInterspace ?? null,
      data.postEbpVasScore ?? null,
      (data.redFlagsPresent || evaluation.hasRedFlags) ? 1 : 0,
      data.redFlagNotes ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pdph.create',
      entity: 'obstetric_pdph_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, vas: data.initialVasScore, ebpIndicated: evaluation.ebpIndicated },
    });

    reply.status(201);
    return { episodeId, episodeCode, evaluation, success: true };
  });

  // 5. Update Status & EBP Details
  app.patch('/api/obstetric-pdph/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageObstetricPdph(req);
    const { id } = req.params as { id: string };
    const {
      status,
      ebpPerformed,
      ebpDatetime,
      ebpBloodVolumeMl,
      ebpInterspace,
      postEbpVasScore,
      clinicalNotes,
    } = req.body as any;

    const validStatuses = [
      'conservative_management',
      'ebp_scheduled',
      'ebp_completed_resolving',
      'headache_resolved',
      'referred_neurology_imaging',
    ];
    if (status && !validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE obstetric_pdph_episodes
      SET status = COALESCE(?, status),
          ebp_performed = CASE WHEN ? IS NOT NULL THEN ? ELSE ebp_performed END,
          ebp_datetime = COALESCE(?, ebp_datetime),
          ebp_blood_volume_ml = COALESCE(?, ebp_blood_volume_ml),
          ebp_interspace = COALESCE(?, ebp_interspace),
          post_ebp_vas_score = COALESCE(?, post_ebp_vas_score),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status ?? null,
      ebpPerformed !== undefined ? (ebpPerformed ? 1 : 0) : null,
      ebpPerformed !== undefined ? (ebpPerformed ? 1 : 0) : null,
      ebpDatetime ?? null,
      ebpBloodVolumeMl ?? null,
      ebpInterspace ?? null,
      postEbpVasScore ?? null,
      clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pdph.status_update',
      entity: 'obstetric_pdph_episodes',
      entityId: Number(id),
      detail: { status, ebpPerformed },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/obstetric-pdph/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_pdph_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.pdph_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return {
      logs: rows.map(r => ({
        ...r,
        headache_relief_on_lying: Boolean(r.headache_relief_on_lying),
        neurological_symptoms_present: Boolean(r.neurological_symptoms_present),
      })),
    };
  });

  // 7. Add Flowsheet Log
  app.post('/api/obstetric-pdph/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricPdph(req);
    const { id } = req.params as { id: string };
    const data = parse(pdphFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM obstetric_pdph_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Obstetric PDPH episode not found');

    const res = db.prepare(`
      INSERT INTO obstetric_pdph_flowsheet_logs (
        pdph_episode_id, patient_id, log_datetime,
        posture_assessed, vas_pain_score, headache_relief_on_lying,
        blood_pressure_sys, blood_pressure_dia, heart_rate,
        temperature_celsius, neurological_symptoms_present,
        interventions_given, notes, logged_by_id
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.postureAssessed,
      data.vasPainScore,
      data.headacheReliefOnLying ? 1 : 0,
      data.bloodPressureSys ?? null,
      data.bloodPressureDia ?? null,
      data.heartRate ?? null,
      data.temperatureCelsius ?? null,
      data.neurologicalSymptomsPresent ? 1 : 0,
      data.interventionsGiven ?? null,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pdph.flowsheet_add',
      entity: 'obstetric_pdph_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), posture: data.postureAssessed, vas: data.vasPainScore },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-pdph/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageObstetricPdph(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM obstetric_pdph_flowsheet_logs
      WHERE id = ? AND pdph_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_pdph_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_pdph.flowsheet_delete',
      entity: 'obstetric_pdph_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
