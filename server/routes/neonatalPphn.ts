import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculateOxygenationIndex,
  calculateSpo2Gradient,
  classifyPphnSeverity,
  evaluateNeonatalPphn,
} from '../../web/src/neonatalPphnEngine.js';

function assertCanManageNeonatalPphn(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical pediatricians and NICU nurses can manage neonatal PPHN & iNO records');
  }
  return user;
}

export const neonatalPphnEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  onsetDatetime: z.string().min(1, 'Onset datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6000),
  primaryEtiology: z.enum([
    'idiopathic',
    'meconium_aspiration_syndrome',
    'respiratory_distress_syndrome',
    'congenital_diaphragmatic_hernia',
    'neonatal_pneumonia_sepsis',
    'pulmonary_hypoplasia',
    'other',
  ]).default('idiopathic'),
  preductalSpo2: z.number().min(30).max(100),
  postductalSpo2: z.number().min(30).max(100),
  meanAirwayPressureCmh2o: z.number().min(4).max(35),
  fio2Percent: z.number().min(21).max(100),
  pao2Mmhg: z.number().min(15).max(350),
  echoTrJetVelocityMs: z.number().min(0).max(8.0).nullable().optional(),
  echoEstimatedRvspMmhg: z.number().min(0).max(150.0).nullable().optional(),
  echoShuntDirection: z.enum(['right_to_left', 'bidirectional', 'left_to_right']).default('right_to_left'),
  inoActive: z.boolean().default(false),
  inoDosePpm: z.number().min(0).max(80).default(0),
  methemoglobinPercent: z.number().min(0).max(30).nullable().optional(),
  sildenafilActive: z.boolean().default(false),
  milrinoneActive: z.boolean().default(false),
  status: z.enum([
    'evaluating',
    'active_ino_therapy',
    'weaning_ino',
    'ecmo_referred',
    'resolved_weaned',
  ]).default('evaluating'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const neonatalPphnFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromOnset: z.number().min(0).default(0),
  preductalSpo2: z.number().min(30).max(100),
  postductalSpo2: z.number().min(30).max(100),
  mapCmh2o: z.number().min(4).max(35),
  fio2Percent: z.number().min(21).max(100),
  pao2Mmhg: z.number().min(15).max(350),
  inoDosePpm: z.number().min(0).max(80).default(0),
  methemoglobinPercent: z.number().min(0).max(30).nullable().optional(),
  circuitNo2Ppm: z.number().min(0).max(10).nullable().optional(),
  meanArterialPressureMmhg: z.number().min(15).max(100).nullable().optional(),
  inotropicScore: z.number().min(0).max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function registerNeonatalPphnRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Calculator Endpoint
  app.post('/api/neonatal-pphn/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(neonatalPphnEpisodeSchema.partial(), req.body);

    const evalResult = evaluateNeonatalPphn({
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? 38,
      birthWeightGrams: body.birthWeightGrams ?? 3100,
      primaryEtiology: body.primaryEtiology ?? 'meconium_aspiration_syndrome',
      preductalSpo2: body.preductalSpo2 ?? 92,
      postductalSpo2: body.postductalSpo2 ?? 80,
      meanAirwayPressureCmh2o: body.meanAirwayPressureCmh2o ?? 14,
      fio2Percent: body.fio2Percent ?? 100,
      pao2Mmhg: body.pao2Mmhg ?? 55,
      echoTrJetVelocityMs: body.echoTrJetVelocityMs ?? undefined,
      echoEstimatedRvspMmhg: body.echoEstimatedRvspMmhg ?? undefined,
      echoShuntDirection: body.echoShuntDirection,
      currentInoDosePpm: body.inoDosePpm,
      methemoglobinPercent: body.methemoglobinPercent ?? undefined,
    });

    return { evalResult };
  });

  // 2. Create Neonatal PPHN Episode
  app.post('/api/neonatal-pphn/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalPphn(req);
    const data = parse(neonatalPphnEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const spo2Gradient = calculateSpo2Gradient(data.preductalSpo2, data.postductalSpo2);
    const calculatedOi = calculateOxygenationIndex(data.meanAirwayPressureCmh2o, data.fio2Percent, data.pao2Mmhg);
    const pphnSeverityTier = classifyPphnSeverity(calculatedOi);

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `PPHN-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_pphn_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        gestational_age_weeks, birth_weight_grams, primary_etiology,
        preductal_spo2, postductal_spo2, spo2_gradient,
        mean_airway_pressure_cmh2o, fio2_percent, pao2_mmhg,
        calculated_oi, pphn_severity_tier,
        echo_tr_jet_velocity_m_s, echo_estimated_rvsp_mmhg, echo_shunt_direction,
        ino_active, ino_dose_ppm, methemoglobin_percent,
        sildenafil_active, milrinone_active, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.primaryEtiology,
      data.preductalSpo2,
      data.postductalSpo2,
      spo2Gradient,
      data.meanAirwayPressureCmh2o,
      data.fio2Percent,
      data.pao2Mmhg,
      calculatedOi,
      pphnSeverityTier,
      data.echoTrJetVelocityMs ?? null,
      data.echoEstimatedRvspMmhg ?? null,
      data.echoShuntDirection,
      data.inoActive ? 1 : 0,
      data.inoDosePpm,
      data.methemoglobinPercent ?? null,
      data.sildenafilActive ? 1 : 0,
      data.milrinoneActive ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM neonatal_pphn_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_pphn.episode_create',
      entity: 'neonatal_pphn_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        calculatedOi,
        pphnSeverityTier,
        inoActive: data.inoActive,
        inoDosePpm: data.inoDosePpm,
      },
    });

    reply.status(201);
    return { episode: created };
  });

  // 3. List Episodes
  app.get('/api/neonatal-pphn/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM neonatal_pphn_episodes e
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

    query += ' ORDER BY e.onset_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/neonatal-pphn/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM neonatal_pphn_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal PPHN episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM neonatal_pphn_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.pphn_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateNeonatalPphn({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      primaryEtiology: episode.primary_etiology,
      preductalSpo2: episode.preductal_spo2,
      postductalSpo2: episode.postductal_spo2,
      meanAirwayPressureCmh2o: episode.mean_airway_pressure_cmh2o,
      fio2Percent: episode.fio2_percent,
      pao2Mmhg: episode.pao2_mmhg,
      echoTrJetVelocityMs: episode.echo_tr_jet_velocity_m_s ?? undefined,
      echoEstimatedRvspMmhg: episode.echo_estimated_rvsp_mmhg ?? undefined,
      echoShuntDirection: episode.echo_shunt_direction,
      currentInoDosePpm: episode.ino_dose_ppm,
      methemoglobinPercent: episode.methemoglobin_percent ?? undefined,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/neonatal-pphn/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalPphn(req);
    const { id } = req.params as { id: string };
    const patch = parse(neonatalPphnEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM neonatal_pphn_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal PPHN episode not found');

    const preductal = patch.preductalSpo2 ?? existing.preductal_spo2;
    const postductal = patch.postductalSpo2 ?? existing.postductal_spo2;
    const map = patch.meanAirwayPressureCmh2o ?? existing.mean_airway_pressure_cmh2o;
    const fio2 = patch.fio2Percent ?? existing.fio2_percent;
    const pao2 = patch.pao2Mmhg ?? existing.pao2_mmhg;

    const spo2Gradient = calculateSpo2Gradient(preductal, postductal);
    const calculatedOi = calculateOxygenationIndex(map, fio2, pao2);
    const pphnSeverityTier = classifyPphnSeverity(calculatedOi);

    db.prepare(`
      UPDATE neonatal_pphn_episodes SET
        gestational_age_weeks = COALESCE(?, gestational_age_weeks),
        birth_weight_grams = COALESCE(?, birth_weight_grams),
        primary_etiology = COALESCE(?, primary_etiology),
        preductal_spo2 = ?,
        postductal_spo2 = ?,
        spo2_gradient = ?,
        mean_airway_pressure_cmh2o = ?,
        fio2_percent = ?,
        pao2_mmhg = ?,
        calculated_oi = ?,
        pphn_severity_tier = ?,
        echo_tr_jet_velocity_m_s = COALESCE(?, echo_tr_jet_velocity_m_s),
        echo_estimated_rvsp_mmhg = COALESCE(?, echo_estimated_rvsp_mmhg),
        echo_shunt_direction = COALESCE(?, echo_shunt_direction),
        ino_active = COALESCE(?, ino_active),
        ino_dose_ppm = COALESCE(?, ino_dose_ppm),
        methemoglobin_percent = COALESCE(?, methemoglobin_percent),
        sildenafil_active = COALESCE(?, sildenafil_active),
        milrinone_active = COALESCE(?, milrinone_active),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      patch.gestationalAgeWeeks ?? null,
      patch.birthWeightGrams ?? null,
      patch.primaryEtiology ?? null,
      preductal,
      postductal,
      spo2Gradient,
      map,
      fio2,
      pao2,
      calculatedOi,
      pphnSeverityTier,
      patch.echoTrJetVelocityMs ?? null,
      patch.echoEstimatedRvspMmhg ?? null,
      patch.echoShuntDirection ?? null,
      patch.inoActive !== undefined ? (patch.inoActive ? 1 : 0) : null,
      patch.inoDosePpm ?? null,
      patch.methemoglobinPercent ?? null,
      patch.sildenafilActive !== undefined ? (patch.sildenafilActive ? 1 : 0) : null,
      patch.milrinoneActive !== undefined ? (patch.milrinoneActive ? 1 : 0) : null,
      patch.status ?? null,
      patch.clinicalNotes ?? null,
      Number(id),
    );

    const updated = db.prepare('SELECT * FROM neonatal_pphn_episodes WHERE id = ?').get(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_pphn.episode_update',
      entity: 'neonatal_pphn_episodes',
      entityId: Number(id),
      detail: patch,
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-pphn/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete PPHN episodes');
    }
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM neonatal_pphn_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal PPHN episode not found');

    db.prepare('DELETE FROM neonatal_pphn_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_pphn.episode_delete',
      entity: 'neonatal_pphn_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Observation Log
  app.post('/api/neonatal-pphn/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalPphn(req);
    const { id } = req.params as { id: string };
    const data = parse(neonatalPphnFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM neonatal_pphn_episodes WHERE id = ?').get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal PPHN episode not found');

    const spo2Gradient = calculateSpo2Gradient(data.preductalSpo2, data.postductalSpo2);
    const calculatedOi = calculateOxygenationIndex(data.mapCmh2o, data.fio2Percent, data.pao2Mmhg);

    const info = db.prepare(`
      INSERT INTO neonatal_pphn_flowsheet_logs (
        pphn_episode_id, patient_id, log_datetime, hours_from_onset,
        preductal_spo2, postductal_spo2, spo2_gradient,
        map_cmh2o, fio2_percent, pao2_mmhg, calculated_oi,
        ino_dose_ppm, methemoglobin_percent, circuit_no2_ppm,
        mean_arterial_pressure_mmhg, inotropic_score, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromOnset,
      data.preductalSpo2,
      data.postductalSpo2,
      spo2Gradient,
      data.mapCmh2o,
      data.fio2Percent,
      data.pao2Mmhg,
      calculatedOi,
      data.inoDosePpm,
      data.methemoglobinPercent ?? null,
      data.circuitNo2Ppm ?? null,
      data.meanArterialPressureMmhg ?? null,
      data.inotropicScore ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_pphn.flowsheet_log',
      entity: 'neonatal_pphn_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), calculatedOi, spo2Gradient, inoDosePpm: data.inoDosePpm },
    });

    reply.status(201);
    return { logId: info.lastInsertRowid, calculatedOi, spo2Gradient };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-pphn/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete PPHN flowsheet logs');
    }
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM neonatal_pphn_flowsheet_logs WHERE id = ? AND pphn_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_pphn_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_pphn.flowsheet_delete',
      entity: 'neonatal_pphn_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
