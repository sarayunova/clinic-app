import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  classifyJensenBpdGrade,
  evaluateNeonatalBpd,
  type RespiratorySupportType,
} from '../../web/src/neonatalBpdEngine.js';

function assertCanManageNeonatalBpd(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical pediatricians and NICU nurses can manage neonatal BPD records');
  }
  return user;
}

export const neonatalBpdEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  evaluationDatetime: z.string().min(1, 'Evaluation datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6000),
  currentPmaWeeks: z.number().min(24).max(60),
  respiratorySupportType: z.enum([
    'none_room_air',
    'nasal_cannula_low_flow',
    'nasal_cannula_high_flow',
    'cpap_nippv',
    'invasive_mechanical_ventilation',
  ]),
  cannulaFlowLpm: z.number().min(0).max(25).default(0),
  fio2Percent: z.number().min(21).max(100).default(21),
  caffeineTherapyActive: z.boolean().default(false),
  diureticTherapyActive: z.boolean().default(false),
  postnatalSteroidsActive: z.boolean().default(false),
  steroidRegimen: z.string().nullable().optional(),
  homeOxygenPlanned: z.boolean().default(false),
  status: z.enum([
    'evaluating',
    'inpatient_respiratory_care',
    'weaning_protocol',
    'discharged_home_oxygen',
    'resolved',
  ]).default('evaluating'),
  clinicalNotes: z.string().nullable().optional(),
});

export const neonatalBpdFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  pmaWeeks: z.number().min(24).max(60),
  respiratorySupport: z.string().min(1, 'Respiratory support is required'),
  flowLpm: z.number().min(0).max(25).default(0),
  fio2Percent: z.number().min(21).max(100).default(21),
  spo2Percent: z.number().min(50).max(100),
  targetSpo2InRange: z.boolean().default(true),
  apneaBradycardiaEpisodes24h: z.number().int().min(0).default(0),
  diureticDoseMgKg: z.number().min(0).nullable().optional(),
  weightGrams: z.number().min(300).max(10000).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export function registerNeonatalBpdRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Calculation & Staging Preview Endpoint
  app.post('/api/neonatal-bpd/calculate', async (req) => {
    assertCanManageNeonatalBpd(req);
    const body = req.body as Partial<z.infer<typeof neonatalBpdEpisodeSchema>>;

    const evalResult = evaluateNeonatalBpd({
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? 28,
      birthWeightGrams: body.birthWeightGrams ?? 1100,
      currentPmaWeeks: body.currentPmaWeeks ?? 36,
      respiratorySupportType: (body.respiratorySupportType as RespiratorySupportType) ?? 'cpap_nippv',
      cannulaFlowLpm: body.cannulaFlowLpm ?? 0,
      fio2Percent: body.fio2Percent ?? 21,
      caffeineActive: body.caffeineTherapyActive,
      diureticsActive: body.diureticTherapyActive,
      postnatalSteroidsActive: body.postnatalSteroidsActive,
    });

    return { evalResult };
  });

  // 2. Create Neonatal BPD Episode
  app.post('/api/neonatal-bpd/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalBpd(req);
    const data = parse(neonatalBpdEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const grade = classifyJensenBpdGrade(data.respiratorySupportType, data.cannulaFlowLpm);
    const evalResult = evaluateNeonatalBpd({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      currentPmaWeeks: data.currentPmaWeeks,
      respiratorySupportType: data.respiratorySupportType,
      cannulaFlowLpm: data.cannulaFlowLpm,
      fio2Percent: data.fio2Percent,
      caffeineActive: data.caffeineTherapyActive,
      diureticsActive: data.diureticTherapyActive,
      postnatalSteroidsActive: data.postnatalSteroidsActive,
    });
    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `BPD-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_bpd_episodes (
        patient_id, admission_id, episode_code, evaluation_datetime,
        gestational_age_weeks, birth_weight_grams, current_pma_weeks,
        respiratory_support_type, cannula_flow_lpm, fio2_percent,
        jensen_bpd_grade, caffeine_therapy_active, diuretic_therapy_active,
        postnatal_steroids_active, steroid_regimen, home_oxygen_planned,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.evaluationDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.currentPmaWeeks,
      data.respiratorySupportType,
      data.cannulaFlowLpm,
      data.fio2Percent,
      grade,
      data.caffeineTherapyActive ? 1 : 0,
      data.diureticTherapyActive ? 1 : 0,
      data.postnatalSteroidsActive ? 1 : 0,
      data.steroidRegimen ?? null,
      data.homeOxygenPlanned ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM neonatal_bpd_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bpd.episode_create',
      entity: 'neonatal_bpd_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        jensenBpdGrade: grade,
        respiratorySupportType: data.respiratorySupportType,
      },
    });

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Episodes
  app.get('/api/neonatal-bpd/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM neonatal_bpd_episodes e
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

    query += ' ORDER BY e.evaluation_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/neonatal-bpd/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM neonatal_bpd_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal BPD episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM neonatal_bpd_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.bpd_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateNeonatalBpd({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      currentPmaWeeks: episode.current_pma_weeks,
      respiratorySupportType: episode.respiratory_support_type,
      cannulaFlowLpm: episode.cannula_flow_lpm,
      fio2Percent: episode.fio2_percent,
      caffeineActive: Boolean(episode.caffeine_therapy_active),
      diureticsActive: Boolean(episode.diuretic_therapy_active),
      postnatalSteroidsActive: Boolean(episode.postnatal_steroids_active),
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode Status / Parameters
  app.patch('/api/neonatal-bpd/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalBpd(req);
    const { id } = req.params as { id: string };
    const patch = req.body as Partial<z.infer<typeof neonatalBpdEpisodeSchema>>;

    const existing = db.prepare('SELECT id FROM neonatal_bpd_episodes WHERE id = ?').get(Number(id));
    if (!existing) throw notFound('Neonatal BPD episode not found');

    let grade: string | null = null;
    if (patch.respiratorySupportType !== undefined) {
      grade = classifyJensenBpdGrade(
        patch.respiratorySupportType,
        patch.cannulaFlowLpm ?? 0,
      );
    }

    db.prepare(`
      UPDATE neonatal_bpd_episodes SET
        current_pma_weeks = COALESCE(?, current_pma_weeks),
        respiratory_support_type = COALESCE(?, respiratory_support_type),
        cannula_flow_lpm = COALESCE(?, cannula_flow_lpm),
        fio2_percent = COALESCE(?, fio2_percent),
        jensen_bpd_grade = COALESCE(?, jensen_bpd_grade),
        caffeine_therapy_active = COALESCE(?, caffeine_therapy_active),
        diuretic_therapy_active = COALESCE(?, diuretic_therapy_active),
        postnatal_steroids_active = COALESCE(?, postnatal_steroids_active),
        steroid_regimen = COALESCE(?, steroid_regimen),
        home_oxygen_planned = COALESCE(?, home_oxygen_planned),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      patch.currentPmaWeeks ?? null,
      patch.respiratorySupportType ?? null,
      patch.cannulaFlowLpm ?? null,
      patch.fio2Percent ?? null,
      grade,
      patch.caffeineTherapyActive !== undefined ? (patch.caffeineTherapyActive ? 1 : 0) : null,
      patch.diureticTherapyActive !== undefined ? (patch.diureticTherapyActive ? 1 : 0) : null,
      patch.postnatalSteroidsActive !== undefined ? (patch.postnatalSteroidsActive ? 1 : 0) : null,
      patch.steroidRegimen ?? null,
      patch.homeOxygenPlanned !== undefined ? (patch.homeOxygenPlanned ? 1 : 0) : null,
      patch.status ?? null,
      patch.clinicalNotes ?? null,
      Number(id),
    );

    const updated = db.prepare('SELECT * FROM neonatal_bpd_episodes WHERE id = ?').get(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bpd.episode_update',
      entity: 'neonatal_bpd_episodes',
      entityId: Number(id),
      detail: patch,
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-bpd/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete BPD episodes');
    }
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM neonatal_bpd_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal BPD episode not found');

    db.prepare('DELETE FROM neonatal_bpd_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bpd.episode_delete',
      entity: 'neonatal_bpd_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Bedside Flowsheet Log
  app.post('/api/neonatal-bpd/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalBpd(req);
    const { id } = req.params as { id: string };
    const data = parse(neonatalBpdFlowsheetSchema, req.body);

    const ep = db.prepare('SELECT id, patient_id FROM neonatal_bpd_episodes WHERE id = ?').get(Number(id)) as any;
    if (!ep) throw notFound('Neonatal BPD episode not found');

    const stmt = db.prepare(`
      INSERT INTO neonatal_bpd_flowsheet_logs (
        bpd_episode_id, patient_id, log_datetime, pma_weeks,
        respiratory_support, flow_lpm, fio2_percent,
        spo2_percent, target_spo2_in_range, apnea_bradycardia_episodes_24h,
        diuretic_dose_mg_kg, weight_grams, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      ep.id,
      ep.patient_id,
      data.logDatetime,
      data.pmaWeeks,
      data.respiratorySupport,
      data.flowLpm,
      data.fio2Percent,
      data.spo2Percent,
      data.targetSpo2InRange ? 1 : 0,
      data.apneaBradycardiaEpisodes24h,
      data.diureticDoseMgKg ?? null,
      data.weightGrams ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bpd.flowsheet_log',
      entity: 'neonatal_bpd_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), pmaWeeks: data.pmaWeeks, spo2: data.spo2Percent },
    });

    reply.status(201);
    return { logId: info.lastInsertRowid };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-bpd/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete BPD flowsheet logs');
    }
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM neonatal_bpd_flowsheet_logs WHERE id = ? AND bpd_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_bpd_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_bpd.flowsheet_delete',
      entity: 'neonatal_bpd_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
