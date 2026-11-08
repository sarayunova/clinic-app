import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalTtn,
  calculateSilvermanAndersonScore,
  type SilvermanAndersonInputs,
} from '../../web/src/neonatalTtnEngine.js';

function assertCanManageNeonatalTtn(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal TTN protocols');
  }
  return user;
}

const silvermanAndersonSchema = z.object({
  chestRetractionUpper: z.coerce.number().min(0).max(2).default(0),
  chestRetractionLower: z.coerce.number().min(0).max(2).default(0),
  xiphoidRetraction: z.coerce.number().min(0).max(2).default(0),
  nasalFlaring: z.coerce.number().min(0).max(2).default(0),
  expiratoryGrunt: z.coerce.number().min(0).max(2).default(0),
});

const neonatalTtnEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  diagnosisDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(26.0).max(44.0),
  birthWeightKg: z.coerce.number().min(0.5).max(7.0),
  deliveryMode: z.enum([
    'elective_cesarean_no_labor',
    'emergency_cesarean_in_labor',
    'vaginal_spontaneous',
    'vaginal_instrumental',
  ]),
  maternalDiabetes: z.boolean().default(false),
  maternalAsthma: z.boolean().default(false),
  maternalFluidOverload: z.boolean().default(false),
  initialRespiratoryRate: z.coerce.number().min(20).max(180),
  silvermanAndersonInputs: silvermanAndersonSchema,
  cxrFindings: z.enum([
    'perihilar_streaking_sunburst',
    'fissural_fluid_line',
    'prominent_vascularity',
    'hyperaeration',
    'normal_or_equivocal',
    'ground_glass_rds_overlap',
  ]),
  initialFio2Percent: z.coerce.number().min(21.0).max(100.0).default(21.0),
  respiratorySupportInitial: z.enum([
    'room_air',
    'nasal_cannula_low_flow',
    'hfnc',
    'bubble_cpap',
    'mechanical_ventilation',
  ]),
  cpapPeepCmh2o: z.coerce.number().min(0).max(15).optional().nullable(),
  feedingStatus: z.enum([
    'npo_iv_fluids',
    'orogastric_gavage',
    'oral_breast_bottle',
  ]),
  bloodGasPh: z.coerce.number().min(6.8).max(7.7).optional().nullable(),
  bloodGasPco2: z.coerce.number().min(10).max(120).optional().nullable(),
  bloodGasPao2: z.coerce.number().min(10).max(300).optional().nullable(),
  status: z.enum([
    'active_monitoring',
    'weaning_support',
    'resolved_discharged',
    'escalated_to_rds_surfactant',
    'escalated_to_pphn',
  ]).default('active_monitoring'),
  clinicalNotes: z.string().optional().nullable(),
});

const ttnFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  respiratoryRate: z.coerce.number().min(20).max(180),
  heartRate: z.coerce.number().min(40).max(240),
  spo2Percent: z.coerce.number().min(40).max(100),
  fio2Percent: z.coerce.number().min(21).max(100),
  cpapPeepCmh2o: z.coerce.number().min(0).max(15).optional().nullable(),
  silvermanAndersonScore: z.coerce.number().min(0).max(10).default(0),
  gruntingPresent: z.boolean().default(false),
  feedingRoute: z.enum(['npo_iv', 'gavage_tube', 'oral_breast', 'oral_bottle']).optional().nullable(),
  bloodGasPh: z.coerce.number().min(6.8).max(7.7).optional().nullable(),
  bloodGasPco2: z.coerce.number().min(10).max(120).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalTtnRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate TTN algorithm
  app.post('/api/neonatal-ttn/evaluate', async (req) => {
    assertCanManageNeonatalTtn(req);
    const body = req.body as any;
    const silvermanInputs: SilvermanAndersonInputs = body.silvermanAndersonInputs || {
      chestRetractionUpper: Number(body.chestRetractionUpper || 0),
      chestRetractionLower: Number(body.chestRetractionLower || 0),
      xiphoidRetraction: Number(body.xiphoidRetraction || 0),
      nasalFlaring: Number(body.nasalFlaring || 0),
      expiratoryGrunt: Number(body.expiratoryGrunt || 0),
    };

    const evaluation = evaluateNeonatalTtn({
      gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 38),
      birthWeightKg: Number(body.birthWeightKg || 3.2),
      deliveryMode: body.deliveryMode || 'elective_cesarean_no_labor',
      maternalDiabetes: Boolean(body.maternalDiabetes),
      maternalAsthma: Boolean(body.maternalAsthma),
      maternalFluidOverload: Boolean(body.maternalFluidOverload),
      initialRespiratoryRate: Number(body.initialRespiratoryRate || 75),
      silvermanAndersonInputs: silvermanInputs,
      cxrFindings: body.cxrFindings || 'perihilar_streaking_sunburst',
      initialFio2Percent: Number(body.initialFio2Percent || 25),
      respiratorySupportInitial: body.respiratorySupportInitial || 'room_air',
      cpapPeepCmh2o: body.cpapPeepCmh2o ? Number(body.cpapPeepCmh2o) : undefined,
      feedingStatus: body.feedingStatus || 'npo_iv_fluids',
      bloodGasPh: body.bloodGasPh ? Number(body.bloodGasPh) : undefined,
      bloodGasPco2: body.bloodGasPco2 ? Number(body.bloodGasPco2) : undefined,
      bloodGasPao2: body.bloodGasPao2 ? Number(body.bloodGasPao2) : undefined,
    });

    return { evaluation };
  });

  // 2. List TTN Episodes
  app.get('/api/neonatal-ttn/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_ttn_episodes e
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
        maternal_diabetes: Boolean(r.maternal_diabetes),
        maternal_asthma: Boolean(r.maternal_asthma),
        maternal_fluid_overload: Boolean(r.maternal_fluid_overload),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/neonatal-ttn/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_ttn_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Neonatal TTN episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_ttn_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.ttn_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const silvermanInputs: SilvermanAndersonInputs = {
      chestRetractionUpper: episode.chest_retraction_upper,
      chestRetractionLower: episode.chest_retraction_lower,
      xiphoidRetraction: episode.xiphoid_retraction,
      nasalFlaring: episode.nasal_flaring,
      expiratoryGrunt: episode.expiratory_grunt,
    };

    const evaluation = evaluateNeonatalTtn({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightKg: episode.birth_weight_kg,
      deliveryMode: episode.delivery_mode,
      maternalDiabetes: Boolean(episode.maternal_diabetes),
      maternalAsthma: Boolean(episode.maternal_asthma),
      maternalFluidOverload: Boolean(episode.maternal_fluid_overload),
      initialRespiratoryRate: episode.initial_respiratory_rate,
      silvermanAndersonInputs: silvermanInputs,
      cxrFindings: episode.cxr_findings,
      initialFio2Percent: episode.initial_fio2_percent,
      respiratorySupportInitial: episode.respiratory_support_initial,
      cpapPeepCmh2o: episode.cpap_peep_cmh2o ?? undefined,
      feedingStatus: episode.feeding_status,
      bloodGasPh: episode.blood_gas_ph ?? undefined,
      bloodGasPco2: episode.blood_gas_pco2 ?? undefined,
      bloodGasPao2: episode.blood_gas_pao2 ?? undefined,
    });

    return {
      episode: {
        ...episode,
        maternal_diabetes: Boolean(episode.maternal_diabetes),
        maternal_asthma: Boolean(episode.maternal_asthma),
        maternal_fluid_overload: Boolean(episode.maternal_fluid_overload),
      },
      evaluation,
      flowsheet: flowsheet.map(f => ({
        ...f,
        grunting_present: Boolean(f.grunting_present),
      })),
    };
  });

  // 4. Create TTN Episode
  app.post('/api/neonatal-ttn/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalTtn(req);
    const data = parse(neonatalTtnEpisodeSchema, req.body);

    const silvermanScore = calculateSilvermanAndersonScore(data.silvermanAndersonInputs);
    const dateStr = data.diagnosisDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `TTN-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO neonatal_ttn_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        gestational_age_weeks, birth_weight_kg, delivery_mode,
        maternal_diabetes, maternal_asthma, maternal_fluid_overload,
        initial_respiratory_rate, silverman_anderson_score,
        chest_retraction_upper, chest_retraction_lower, xiphoid_retraction,
        nasal_flaring, expiratory_grunt,
        cxr_findings, initial_fio2_percent, respiratory_support_initial,
        cpap_peep_cmh2o, feeding_status,
        blood_gas_ph, blood_gas_pco2, blood_gas_pao2,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.diagnosisDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightKg,
      data.deliveryMode,
      data.maternalDiabetes ? 1 : 0,
      data.maternalAsthma ? 1 : 0,
      data.maternalFluidOverload ? 1 : 0,
      data.initialRespiratoryRate,
      silvermanScore,
      data.silvermanAndersonInputs.chestRetractionUpper,
      data.silvermanAndersonInputs.chestRetractionLower,
      data.silvermanAndersonInputs.xiphoidRetraction,
      data.silvermanAndersonInputs.nasalFlaring,
      data.silvermanAndersonInputs.expiratoryGrunt,
      data.cxrFindings,
      data.initialFio2Percent,
      data.respiratorySupportInitial,
      data.cpapPeepCmh2o ?? null,
      data.feedingStatus,
      data.bloodGasPh ?? null,
      data.bloodGasPco2 ?? null,
      data.bloodGasPao2 ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ttn.create',
      entity: 'neonatal_ttn_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, silvermanScore, status: data.status },
    });

    reply.status(201);
    return { episodeId, episodeCode, silvermanScore, success: true };
  });

  // 5. Update Status
  app.patch('/api/neonatal-ttn/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageNeonatalTtn(req);
    const { id } = req.params as { id: string };
    const { status, clinicalNotes } = req.body as { status: string; clinicalNotes?: string };

    const validStatuses = [
      'active_monitoring',
      'weaning_support',
      'resolved_discharged',
      'escalated_to_rds_surfactant',
      'escalated_to_pphn',
    ];
    if (!validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE neonatal_ttn_episodes
      SET status = ?, clinical_notes = COALESCE(?, clinical_notes), updated_at = datetime('now')
      WHERE id = ?
    `).run(status, clinicalNotes ?? null, id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ttn.status_update',
      entity: 'neonatal_ttn_episodes',
      entityId: Number(id),
      detail: { status },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/neonatal-ttn/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_ttn_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.ttn_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return {
      logs: rows.map(r => ({
        ...r,
        grunting_present: Boolean(r.grunting_present),
      })),
    };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-ttn/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalTtn(req);
    const { id } = req.params as { id: string };
    const data = parse(ttnFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM neonatal_ttn_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal TTN episode not found');

    const res = db.prepare(`
      INSERT INTO neonatal_ttn_flowsheet_logs (
        ttn_episode_id, patient_id, log_datetime,
        respiratory_rate, heart_rate, spo2_percent, fio2_percent,
        cpap_peep_cmh2o, silverman_anderson_score, grunting_present,
        feeding_route, blood_gas_ph, blood_gas_pco2, notes,
        logged_by_id
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.respiratoryRate,
      data.heartRate,
      data.spo2Percent,
      data.fio2Percent,
      data.cpapPeepCmh2o ?? null,
      data.silvermanAndersonScore,
      data.gruntingPresent ? 1 : 0,
      data.feedingRoute ?? null,
      data.bloodGasPh ?? null,
      data.bloodGasPco2 ?? null,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ttn.flowsheet_add',
      entity: 'neonatal_ttn_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), rr: data.respiratoryRate, fio2: data.fio2Percent },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-ttn/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalTtn(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM neonatal_ttn_flowsheet_logs
      WHERE id = ? AND ttn_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_ttn_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_ttn.flowsheet_delete',
      entity: 'neonatal_ttn_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
