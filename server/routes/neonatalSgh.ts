import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalSgh,
} from '../../web/src/neonatalSghEngine.js';

function assertCanManageSgh(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal SGH protocols');
  }
  return user;
}

const sghEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  birthDatetime: z.string().min(1),
  diagnosisDatetime: z.string().min(1),
  deliveryMode: z.enum([
    'vacuum_assisted',
    'forceps_assisted',
    'vacuum_failed_cesarean',
    'normal_vaginal',
    'emergency_cesarean_unassisted',
  ]),
  vacuumCupPopoffs: z.coerce.number().min(0).max(10).default(0),
  birthWeightKg: z.coerce.number().min(0.5).max(8.0),
  initialHeadCircumferenceCm: z.coerce.number().min(20).max(45),
  currentHeadCircumferenceCm: z.coerce.number().min(20).max(50),
  swellingCrossesSutures: z.boolean().default(true),
  swellingFluctuantPitting: z.boolean().default(true),
  periorbitalEcchymosis: z.boolean().default(false),
  earDisplacement: z.boolean().default(false),
  pallorSevere: z.boolean().default(true),
  heartRateBpm: z.coerce.number().min(30).max(250),
  bloodPressureSys: z.coerce.number().min(20).max(150).optional().nullable(),
  bloodPressureDia: z.coerce.number().min(10).max(100).optional().nullable(),
  capillaryRefillSeconds: z.coerce.number().min(0).max(15).optional().nullable(),
  hematocritInitialPct: z.coerce.number().min(10).max(75).optional().nullable(),
  hematocritLowestPct: z.coerce.number().min(10).max(75).optional().nullable(),
  plateletCount: z.coerce.number().min(0).max(1000000).optional().nullable(),
  fibrinogenMgDl: z.coerce.number().min(0).max(600).optional().nullable(),
  mtpActivated: z.boolean().default(false),
  prbcVolumeTransfusedMl: z.coerce.number().min(0).max(500).default(0.0),
  ffpVolumeTransfusedMl: z.coerce.number().min(0).max(500).default(0.0),
  cryoprecipitateVolumeMl: z.coerce.number().min(0).max(500).default(0.0),
  status: z.enum([
    'active_resuscitation',
    'mtp_massive_transfusion',
    'stabilized_monitoring',
    'resolved_discharged',
  ]).default('active_resuscitation'),
  clinicalNotes: z.string().optional().nullable(),
});

const sghFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromBirth: z.coerce.number().min(0).max(720),
  headCircumferenceCm: z.coerce.number().min(20).max(50),
  bloodPressureSys: z.coerce.number().min(20).max(150).optional().nullable(),
  bloodPressureDia: z.coerce.number().min(10).max(100).optional().nullable(),
  heartRate: z.coerce.number().min(30).max(250),
  capillaryRefillSeconds: z.coerce.number().min(0).max(15).optional().nullable(),
  hematocritPct: z.coerce.number().min(10).max(75).optional().nullable(),
  bloodProductsTransfused: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalSghRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/neonatal-sgh/evaluate', async (req) => {
    assertCanManageSgh(req);
    const body = req.body as any;

    const evaluation = evaluateNeonatalSgh({
      birthWeightKg: Number(body.birthWeightKg || 3.2),
      initialHeadCircumferenceCm: Number(body.initialHeadCircumferenceCm || 34.0),
      currentHeadCircumferenceCm: Number(body.currentHeadCircumferenceCm || 35.5),
      heartRateBpm: Number(body.heartRateBpm || 165),
      bloodPressureSys: body.bloodPressureSys ? Number(body.bloodPressureSys) : undefined,
      capillaryRefillSeconds: body.capillaryRefillSeconds ? Number(body.capillaryRefillSeconds) : undefined,
      swellingCrossesSutures: body.swellingCrossesSutures !== undefined ? Boolean(body.swellingCrossesSutures) : true,
      swellingFluctuantPitting: body.swellingFluctuantPitting !== undefined ? Boolean(body.swellingFluctuantPitting) : true,
      periorbitalEcchymosis: Boolean(body.periorbitalEcchymosis),
      earDisplacement: Boolean(body.earDisplacement),
      pallorSevere: body.pallorSevere !== undefined ? Boolean(body.pallorSevere) : true,
      vacuumCupPopoffs: body.vacuumCupPopoffs ? Number(body.vacuumCupPopoffs) : undefined,
      hematocritInitialPct: body.hematocritInitialPct ? Number(body.hematocritInitialPct) : undefined,
      hematocritLowestPct: body.hematocritLowestPct ? Number(body.hematocritLowestPct) : undefined,
      fibrinogenMgDl: body.fibrinogenMgDl ? Number(body.fibrinogenMgDl) : undefined,
      plateletCount: body.plateletCount ? Number(body.plateletCount) : undefined,
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-sgh/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_sgh_episodes e
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
        swelling_crosses_sutures: Boolean(r.swelling_crosses_sutures),
        swelling_fluctuant_pitting: Boolean(r.swelling_fluctuant_pitting),
        periorbital_ecchymosis: Boolean(r.periorbital_ecchymosis),
        ear_displacement: Boolean(r.ear_displacement),
        pallor_severe: Boolean(r.pallor_severe),
        mtp_activated: Boolean(r.mtp_activated),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/neonatal-sgh/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM neonatal_sgh_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Neonatal SGH episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_sgh_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.sgh_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const evaluation = evaluateNeonatalSgh({
      birthWeightKg: episode.birth_weight_kg,
      initialHeadCircumferenceCm: episode.initial_head_circumference_cm,
      currentHeadCircumferenceCm: episode.current_head_circumference_cm,
      heartRateBpm: episode.heart_rate_bpm,
      bloodPressureSys: episode.blood_pressure_sys ?? undefined,
      capillaryRefillSeconds: episode.capillary_refill_seconds ?? undefined,
      swellingCrossesSutures: Boolean(episode.swelling_crosses_sutures),
      swellingFluctuantPitting: Boolean(episode.swelling_fluctuant_pitting),
      periorbitalEcchymosis: Boolean(episode.periorbital_ecchymosis),
      earDisplacement: Boolean(episode.ear_displacement),
      pallorSevere: Boolean(episode.pallor_severe),
      vacuumCupPopoffs: episode.vacuum_cup_popoffs,
      hematocritInitialPct: episode.hematocrit_initial_pct ?? undefined,
      hematocritLowestPct: episode.hematocrit_lowest_pct ?? undefined,
      fibrinogenMgDl: episode.fibrinogen_mg_dl ?? undefined,
      plateletCount: episode.platelet_count ?? undefined,
    });

    return {
      episode: {
        ...episode,
        swelling_crosses_sutures: Boolean(episode.swelling_crosses_sutures),
        swelling_fluctuant_pitting: Boolean(episode.swelling_fluctuant_pitting),
        periorbital_ecchymosis: Boolean(episode.periorbital_ecchymosis),
        ear_displacement: Boolean(episode.ear_displacement),
        pallor_severe: Boolean(episode.pallor_severe),
        mtp_activated: Boolean(episode.mtp_activated),
      },
      evaluation,
      flowsheet,
    };
  });

  // 4. Create Episode
  app.post('/api/neonatal-sgh/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageSgh(req);
    const data = parse(sghEpisodeSchema, req.body);

    const evaluation = evaluateNeonatalSgh({
      birthWeightKg: data.birthWeightKg,
      initialHeadCircumferenceCm: data.initialHeadCircumferenceCm,
      currentHeadCircumferenceCm: data.currentHeadCircumferenceCm,
      heartRateBpm: data.heartRateBpm,
      bloodPressureSys: data.bloodPressureSys ?? undefined,
      capillaryRefillSeconds: data.capillaryRefillSeconds ?? undefined,
      swellingCrossesSutures: data.swellingCrossesSutures,
      swellingFluctuantPitting: data.swellingFluctuantPitting,
      periorbitalEcchymosis: data.periorbitalEcchymosis,
      earDisplacement: data.earDisplacement,
      pallorSevere: data.pallorSevere,
      vacuumCupPopoffs: data.vacuumCupPopoffs,
      hematocritInitialPct: data.hematocritInitialPct ?? undefined,
      hematocritLowestPct: data.hematocritLowestPct ?? undefined,
      fibrinogenMgDl: data.fibrinogenMgDl ?? undefined,
      plateletCount: data.plateletCount ?? undefined,
    });

    const dateStr = data.diagnosisDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `SGH-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO neonatal_sgh_episodes (
        patient_id, admission_id, episode_code, birth_datetime,
        diagnosis_datetime, delivery_mode, vacuum_cup_popoffs,
        birth_weight_kg, initial_head_circumference_cm, current_head_circumference_cm,
        hc_increase_cm, estimated_occult_blood_loss_ml, circulating_volume_loss_pct,
        swelling_crosses_sutures, swelling_fluctuant_pitting, periorbital_ecchymosis,
        ear_displacement, pallor_severe, shock_state,
        heart_rate_bpm, blood_pressure_sys, blood_pressure_dia,
        shock_index, capillary_refill_seconds, hematocrit_initial_pct,
        hematocrit_lowest_pct, platelet_count, fibrinogen_mg_dl,
        mtp_activated, prbc_volume_transfused_ml, ffp_volume_transfused_ml,
        cryoprecipitate_volume_ml, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.birthDatetime,
      data.diagnosisDatetime,
      data.deliveryMode,
      data.vacuumCupPopoffs,
      data.birthWeightKg,
      data.initialHeadCircumferenceCm,
      data.currentHeadCircumferenceCm,
      evaluation.hcIncreaseCm,
      evaluation.estimatedOccultBloodLossMl,
      evaluation.circulatingVolumeLossPct,
      data.swellingCrossesSutures ? 1 : 0,
      data.swellingFluctuantPitting ? 1 : 0,
      data.periorbitalEcchymosis ? 1 : 0,
      data.earDisplacement ? 1 : 0,
      data.pallorSevere ? 1 : 0,
      evaluation.shockSeverityTier,
      data.heartRateBpm,
      data.bloodPressureSys ?? null,
      data.bloodPressureDia ?? null,
      evaluation.shockIndex ?? null,
      data.capillaryRefillSeconds ?? null,
      data.hematocritInitialPct ?? null,
      data.hematocritLowestPct ?? null,
      data.plateletCount ?? null,
      data.fibrinogenMgDl ?? null,
      data.mtpActivated ? 1 : 0,
      data.prbcVolumeTransfusedMl,
      data.ffpVolumeTransfusedMl,
      data.cryoprecipitateVolumeMl,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sgh.create',
      entity: 'neonatal_sgh_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, shockState: evaluation.shockSeverityTier, lossPct: evaluation.circulatingVolumeLossPct },
    });

    reply.status(201);
    return { episodeId, episodeCode, evaluation, success: true };
  });

  // 5. Update Status & Transfusion Volumes
  app.patch('/api/neonatal-sgh/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageSgh(req);
    const { id } = req.params as { id: string };
    const {
      status,
      mtpActivated,
      prbcVolumeTransfusedMl,
      ffpVolumeTransfusedMl,
      cryoprecipitateVolumeMl,
      clinicalNotes,
    } = req.body as any;

    const validStatuses = [
      'active_resuscitation',
      'mtp_massive_transfusion',
      'stabilized_monitoring',
      'resolved_discharged',
    ];
    if (status && !validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE neonatal_sgh_episodes
      SET status = COALESCE(?, status),
          mtp_activated = CASE WHEN ? IS NOT NULL THEN ? ELSE mtp_activated END,
          prbc_volume_transfused_ml = COALESCE(?, prbc_volume_transfused_ml),
          ffp_volume_transfused_ml = COALESCE(?, ffp_volume_transfused_ml),
          cryoprecipitate_volume_ml = COALESCE(?, cryoprecipitate_volume_ml),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status ?? null,
      mtpActivated !== undefined ? (mtpActivated ? 1 : 0) : null,
      mtpActivated !== undefined ? (mtpActivated ? 1 : 0) : null,
      prbcVolumeTransfusedMl ?? null,
      ffpVolumeTransfusedMl ?? null,
      cryoprecipitateVolumeMl ?? null,
      clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sgh.status_update',
      entity: 'neonatal_sgh_episodes',
      entityId: Number(id),
      detail: { status, mtpActivated },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/neonatal-sgh/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM neonatal_sgh_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.sgh_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return { logs: rows };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-sgh/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageSgh(req);
    const { id } = req.params as { id: string };
    const data = parse(sghFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM neonatal_sgh_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal SGH episode not found');

    const shockIndex = (data.bloodPressureSys && data.bloodPressureSys > 0)
      ? Number((data.heartRate / data.bloodPressureSys).toFixed(2))
      : null;

    const res = db.prepare(`
      INSERT INTO neonatal_sgh_flowsheet_logs (
        sgh_episode_id, patient_id, log_datetime,
        hours_from_birth, head_circumference_cm, blood_pressure_sys,
        blood_pressure_dia, heart_rate, shock_index,
        capillary_refill_seconds, hematocrit_pct, blood_products_transfused,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromBirth,
      data.headCircumferenceCm,
      data.bloodPressureSys ?? null,
      data.bloodPressureDia ?? null,
      data.heartRate,
      shockIndex,
      data.capillaryRefillSeconds ?? null,
      data.hematocritPct ?? null,
      data.bloodProductsTransfused ?? null,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sgh.flowsheet_add',
      entity: 'neonatal_sgh_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), hc: data.headCircumferenceCm, hr: data.heartRate },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-sgh/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageSgh(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM neonatal_sgh_flowsheet_logs
      WHERE id = ? AND sgh_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_sgh_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sgh.flowsheet_delete',
      entity: 'neonatal_sgh_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
