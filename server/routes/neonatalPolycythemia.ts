import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  calculatePetVolume,
  calculateAliquotSize,
  evaluateNeonatalPolycythemia,
  type NeonatalSamplingSite,
  type PolycythemiaSymptomDetails,
} from '../../web/src/neonatalPolycythemiaEngine.js';

function assertCanManageNeonatalPolycythemia(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical neonatologists, pediatricians, and NICU nurses can manage neonatal polycythemia records');
  }
  return user;
}

export const neonatalPolycythemiaEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  diagnosisDatetime: z.string().min(1, 'Diagnosis datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6500),
  chronologicalAgeHours: z.number().int().min(0).max(720),
  currentWeightKg: z.number().min(0.3).max(10.0),

  samplingSite: z.enum(['peripheral_venous', 'umbilical_venous', 'capillary_unconfirmed']),
  venousHematocritPct: z.number().min(40.0).max(90.0),
  hemoglobinGDl: z.number().min(10.0).max(30.0).nullable().optional(),
  bloodVolumeMlKg: z.number().min(60.0).max(120.0).default(80.0),
  targetHematocritPct: z.number().min(45.0).max(65.0).default(55.0),

  symptomsPresent: z.boolean().default(false),
  symptomDetails: z.enum([
    'asymptomatic',
    'plethora_ruddy_appearance',
    'poor_feeding_lethargy',
    'jitteriness_tremors',
    'tachypnea_respiratory_distress',
    'hypoglycemia',
    'cyanosis_peripheral',
    'priapism_or_oliguria',
  ]).default('asymptomatic'),
  serumGlucoseMgDl: z.number().min(10).max(500).nullable().optional(),
  plateletCount: z.number().int().min(1000).max(1000000).nullable().optional(),
  serumBilirubinMgDl: z.number().min(0.1).max(40.0).nullable().optional(),

  replacementFluid: z.enum(['normal_saline_0_9', '5_percent_albumin', 'fresh_frozen_plasma']).default('normal_saline_0_9'),
  status: z.enum([
    'hydration_surveillance',
    'pet_procedure_in_progress',
    'post_pet_observation',
    'eupolycythemic_resolved',
  ]).default('hydration_surveillance'),
  clinicalNotes: z.string().nullable().optional(),
});

export const neonatalPolycythemiaFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromTriage: z.number().min(0).default(0),
  aliquotNumber: z.number().int().min(1).max(50).default(1),
  volumeWithdrawnMl: z.number().min(0).max(100).default(0),
  volumeInfusedMl: z.number().min(0).max(100).default(0),
  cumulativeExchangedMl: z.number().min(0).max(500).default(0),
  currentHematocritPct: z.number().min(30.0).max(90.0).nullable().optional(),

  heartRateBpm: z.number().int().min(40).max(250),
  respiratoryRate: z.number().int().min(10).max(150),
  meanArterialPressureMmhg: z.number().min(10).max(120).nullable().optional(),
  capillaryRefillSeconds: z.number().min(0.5).max(10.0).nullable().optional(),
  bloodGlucoseMgDl: z.number().min(10).max(500).nullable().optional(),
  adverseEventsObserved: z.enum([
    'none',
    'hypotension_bradycardia',
    'catheter_thrombosis',
    'abdominal_distension_nec_suspicion',
    'hypoglycemia_recurrence',
  ]).default('none'),
  notes: z.string().nullable().optional(),
});

export function registerNeonatalPolycythemiaRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Preview
  app.post('/api/neonatal-polycythemia/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(neonatalPolycythemiaEpisodeSchema.partial(), req.body);

    const evalResult = evaluateNeonatalPolycythemia({
      gestationalAgeWeeks: data.gestationalAgeWeeks ?? 39,
      birthWeightGrams: data.birthWeightGrams ?? 3200,
      chronologicalAgeHours: data.chronologicalAgeHours ?? 12,
      currentWeightKg: data.currentWeightKg ?? 3.2,
      samplingSite: (data.samplingSite as NeonatalSamplingSite) ?? 'peripheral_venous',
      venousHematocritPct: data.venousHematocritPct ?? 66.0,
      hemoglobinGDl: data.hemoglobinGDl ?? undefined,
      bloodVolumeMlKg: data.bloodVolumeMlKg ?? 80.0,
      targetHematocritPct: data.targetHematocritPct ?? 55.0,
      symptomsPresent: data.symptomsPresent ?? false,
      symptomDetails: (data.symptomDetails as PolycythemiaSymptomDetails) ?? 'asymptomatic',
      serumGlucoseMgDl: data.serumGlucoseMgDl ?? undefined,
      plateletCount: data.plateletCount ?? undefined,
      serumBilirubinMgDl: data.serumBilirubinMgDl ?? undefined,
    });

    return { evalResult };
  });

  // 2. Create Neonatal Polycythemia Episode
  app.post('/api/neonatal-polycythemia/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalPolycythemia(req);
    const data = parse(neonatalPolycythemiaEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateNeonatalPolycythemia({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      chronologicalAgeHours: data.chronologicalAgeHours,
      currentWeightKg: data.currentWeightKg,
      samplingSite: data.samplingSite,
      venousHematocritPct: data.venousHematocritPct,
      hemoglobinGDl: data.hemoglobinGDl ?? undefined,
      bloodVolumeMlKg: data.bloodVolumeMlKg,
      targetHematocritPct: data.targetHematocritPct,
      symptomsPresent: data.symptomsPresent,
      symptomDetails: data.symptomDetails,
      serumGlucoseMgDl: data.serumGlucoseMgDl ?? undefined,
      plateletCount: data.plateletCount ?? undefined,
      serumBilirubinMgDl: data.serumBilirubinMgDl ?? undefined,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `POLYCYT-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO neonatal_polycythemia_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        gestational_age_weeks, birth_weight_grams, chronological_age_hours, current_weight_kg,
        sampling_site, venous_hematocrit_pct, hemoglobin_g_dl,
        blood_volume_ml_kg, target_hematocrit_pct,
        symptoms_present, symptom_details,
        serum_glucose_mg_dl, platelet_count, serum_bilirubin_mg_dl,
        partial_exchange_indicated, exchange_volume_ml, aliquot_size_ml, replacement_fluid,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.diagnosisDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.chronologicalAgeHours,
      data.currentWeightKg,
      data.samplingSite,
      data.venousHematocritPct,
      data.hemoglobinGDl ?? null,
      data.bloodVolumeMlKg,
      data.targetHematocritPct,
      data.symptomsPresent ? 1 : 0,
      data.symptomDetails,
      data.serumGlucoseMgDl ?? null,
      data.plateletCount ?? null,
      data.serumBilirubinMgDl ?? null,
      evalResult.partialExchangeIndicated ? 1 : 0,
      evalResult.exchangeVolumeMl,
      evalResult.recommendedAliquotSizeMl,
      data.replacementFluid,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_polycythemia.create',
      entity: 'neonatal_polycythemia_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, venousHct: data.venousHematocritPct, exchangeVol: evalResult.exchangeVolumeMl },
    });

    const created = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM neonatal_polycythemia_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(episodeId);

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Episodes
  app.get('/api/neonatal-polycythemia/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM neonatal_polycythemia_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
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

    query += ' ORDER BY e.created_at DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet Logs and Fresh Engine Calculation
  app.get('/api/neonatal-polycythemia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode: any = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM neonatal_polycythemia_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id));

    if (!episode) throw notFound('Neonatal polycythemia episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM neonatal_polycythemia_flowsheet_logs l
      LEFT JOIN users u ON u.id = l.logged_by_id
      WHERE l.polycythemia_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateNeonatalPolycythemia({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      birthWeightGrams: episode.birth_weight_grams,
      chronologicalAgeHours: episode.chronological_age_hours,
      currentWeightKg: episode.current_weight_kg,
      samplingSite: episode.sampling_site,
      venousHematocritPct: episode.venous_hematocrit_pct,
      hemoglobinGDl: episode.hemoglobin_g_dl ?? undefined,
      bloodVolumeMlKg: episode.blood_volume_ml_kg,
      targetHematocritPct: episode.target_hematocrit_pct,
      symptomsPresent: Boolean(episode.symptoms_present),
      symptomDetails: episode.symptom_details,
      serumGlucoseMgDl: episode.serum_glucose_mg_dl ?? undefined,
      plateletCount: episode.platelet_count ?? undefined,
      serumBilirubinMgDl: episode.serum_bilirubin_mg_dl ?? undefined,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode Status / Notes
  app.patch('/api/neonatal-polycythemia/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalPolycythemia(req);
    const { id } = req.params as { id: string };

    const updateSchema = z.object({
      status: z.enum([
        'hydration_surveillance',
        'pet_procedure_in_progress',
        'post_pet_observation',
        'eupolycythemic_resolved',
      ]).optional(),
      clinicalNotes: z.string().nullable().optional(),
    });

    const data = parse(updateSchema, req.body);
    const episode = db.prepare('SELECT * FROM neonatal_polycythemia_episodes WHERE id = ?').get(Number(id));
    if (!episode) throw notFound('Neonatal polycythemia episode not found');

    const updates: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.clinicalNotes !== undefined) {
      updates.push('clinical_notes = ?');
      params.push(data.clinicalNotes);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(Number(id));
      db.prepare(`UPDATE neonatal_polycythemia_episodes SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      audit(db, {
        actorId: user.id,
        action: 'neonatal_polycythemia.update',
        entity: 'neonatal_polycythemia_episodes',
        entityId: Number(id),
        detail: { ...data },
      });
    }

    const updated = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM neonatal_polycythemia_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id));

    return { episode: updated };
  });

  // 6. Delete Episode (Doctor only)
  app.delete('/api/neonatal-polycythemia/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete polycythemia episodes');

    const { id } = req.params as { id: string };
    const episode = db.prepare('SELECT id, patient_id, episode_code FROM neonatal_polycythemia_episodes WHERE id = ?').get(Number(id)) as { id: number; patient_id: number; episode_code: string } | undefined;
    if (!episode) throw notFound('Neonatal polycythemia episode not found');

    db.prepare('DELETE FROM neonatal_polycythemia_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_polycythemia.delete',
      entity: 'neonatal_polycythemia_episodes',
      entityId: Number(id),
      detail: { episodeCode: episode.episode_code, patientId: episode.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Observation Log
  app.post('/api/neonatal-polycythemia/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalPolycythemia(req);
    const { id } = req.params as { id: string };
    const data = parse(neonatalPolycythemiaFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT id, patient_id FROM neonatal_polycythemia_episodes WHERE id = ?').get(Number(id)) as { id: number; patient_id: number } | undefined;
    if (!episode) throw notFound('Neonatal polycythemia episode not found');

    const stmt = db.prepare(`
      INSERT INTO neonatal_polycythemia_flowsheet_logs (
        polycythemia_episode_id, patient_id, log_datetime, hours_from_triage,
        aliquot_number, volume_withdrawn_ml, volume_infused_ml, cumulative_exchanged_ml, current_hematocrit_pct,
        heart_rate_bpm, respiratory_rate, mean_arterial_pressure_mmhg, capillary_refill_seconds, blood_glucose_mg_dl,
        adverse_events_observed, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      episode.id,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromTriage,
      data.aliquotNumber,
      data.volumeWithdrawnMl,
      data.volumeInfusedMl,
      data.cumulativeExchangedMl,
      data.currentHematocritPct ?? null,
      data.heartRateBpm,
      data.respiratoryRate,
      data.meanArterialPressureMmhg ?? null,
      data.capillaryRefillSeconds ?? null,
      data.bloodGlucoseMgDl ?? null,
      data.adverseEventsObserved,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_polycythemia.flowsheet_add',
      entity: 'neonatal_polycythemia_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: episode.id, aliquot: data.aliquotNumber },
    });

    reply.status(201);
    return { logId: Number(info.lastInsertRowid) };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-polycythemia/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalPolycythemia(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare('SELECT id, polycythemia_episode_id FROM neonatal_polycythemia_flowsheet_logs WHERE id = ? AND polycythemia_episode_id = ?').get(Number(logId), Number(id));
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_polycythemia_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_polycythemia.flowsheet_delete',
      entity: 'neonatal_polycythemia_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
