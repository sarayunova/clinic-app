import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricHellp,
} from '../../web/src/obstetricHellpEngine.js';

function assertCanManageHellp(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric HELLP syndrome protocols');
  }
  return user;
}

const hellpEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  gestationalAgeWeeks: z.coerce.number().min(20.0).max(44.0),
  plateletCountPerUl: z.coerce.number().int().min(1000).max(500000),
  astUL: z.coerce.number().min(5).max(5000),
  altUL: z.coerce.number().min(5).max(5000),
  ldhUL: z.coerce.number().min(50).max(10000),
  totalBilirubinMgDl: z.coerce.number().min(0.1).max(30.0),
  schistocytesPresent: z.boolean().default(true),
  systolicBp: z.coerce.number().int().min(60).max(260),
  diastolicBp: z.coerce.number().int().min(40).max(160),
  epigastricRuqPain: z.boolean().default(true),
  hepaticSubcapsularHematomaSuspected: z.boolean().default(false),
  hepaticImagingPerformed: z.enum([
    'none',
    'ultrasound_capsule_intact',
    'subcapsular_hematoma_contained',
    'hepatic_rupture_hemoperitoneum',
  ]),
  dexamethasonePulseInitiated: z.boolean().default(true),
  magnesiumSulfateSeizureProphylaxis: z.boolean().default(true),
  plateletTransfusionAdministered: z.boolean().default(false),
  deliveryTimingPlan: z.enum([
    'immediate_crash_delivery_under_2h',
    'planned_stabilization_and_delivery',
    'steroid_window_24_to_48h_if_stable',
  ]),
  status: z.enum([
    'acute_stabilization_icu_triage',
    'dexamethasone_antihypertensive_active',
    'in_operating_room_crash_delivery',
    'postpartum_icu_platelet_nadir_surveillance',
    'resolved_platelet_recovery_discharge',
  ]).default('acute_stabilization_icu_triage'),
  clinicalNotes: z.string().optional().nullable(),
});

const hellpFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromAdmission: z.coerce.number().min(0).max(720),
  plateletCountPerUl: z.coerce.number().int().min(1000).max(500000),
  astUL: z.coerce.number().min(5).max(5000),
  ldhUL: z.coerce.number().min(50).max(10000),
  systolicBp: z.coerce.number().int().min(60).max(260),
  diastolicBp: z.coerce.number().int().min(40).max(160),
  urineOutputMlHr: z.coerce.number().min(0).max(500),
  deepTendonReflexes: z.enum(['absent_hyporeflexia', 'normal_2_plus', 'hyperreflexic_clonus']),
  epigastricPainScore: z.coerce.number().int().min(0).max(10).default(0),
  notes: z.string().optional().nullable(),
});

export function registerObstetricHellpRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/obstetric-hellp/evaluate', async (req) => {
    assertCanManageHellp(req);
    const body = req.body as any;

    const evaluation = evaluateObstetricHellp({
      gestationalAgeWeeks: Number(body.gestationalAgeWeeks || 33.0),
      plateletCountPerUl: Number(body.plateletCountPerUl || 42000),
      astUL: Number(body.astUL || 145),
      altUL: Number(body.altUL || 120),
      ldhUL: Number(body.ldhUL || 850),
      totalBilirubinMgDl: Number(body.totalBilirubinMgDl || 1.8),
      schistocytesPresent: body.schistocytesPresent !== undefined ? Boolean(body.schistocytesPresent) : true,
      systolicBp: Number(body.systolicBp || 165),
      diastolicBp: Number(body.diastolicBp || 108),
      epigastricRuqPain: body.epigastricRuqPain !== undefined ? Boolean(body.epigastricRuqPain) : true,
      hepaticSubcapsularHematomaSuspected: Boolean(body.hepaticSubcapsularHematomaSuspected),
      hepaticImagingPerformed: body.hepaticImagingPerformed || 'ultrasound_capsule_intact',
      dexamethasonePulseInitiated: body.dexamethasonePulseInitiated !== undefined ? Boolean(body.dexamethasonePulseInitiated) : true,
      magnesiumSulfateSeizureProphylaxis: body.magnesiumSulfateSeizureProphylaxis !== undefined ? Boolean(body.magnesiumSulfateSeizureProphylaxis) : true,
      plateletTransfusionAdministered: Boolean(body.plateletTransfusionAdministered),
      deliveryTimingPlan: body.deliveryTimingPlan || 'immediate_crash_delivery_under_2h',
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-hellp/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_hellp_episodes e
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
  app.get('/api/obstetric-hellp/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_hellp_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric HELLP episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_hellp_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.hellp_episode_id = ?
      ORDER BY l.hours_from_admission ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateObstetricHellp({
      gestationalAgeWeeks: episode.gestational_age_weeks,
      plateletCountPerUl: episode.platelet_count_per_ul,
      astUL: episode.ast_u_l,
      altUL: episode.alt_u_l,
      ldhUL: episode.ldh_u_l,
      totalBilirubinMgDl: episode.total_bilirubin_mg_dl,
      schistocytesPresent: Boolean(episode.schistocytes_present),
      systolicBp: episode.systolic_bp,
      diastolicBp: episode.diastolic_bp,
      epigastricRuqPain: Boolean(episode.epigastric_ruq_pain),
      hepaticSubcapsularHematomaSuspected: Boolean(episode.hepatic_subcapsular_hematoma_suspected),
      hepaticImagingPerformed: episode.hepatic_imaging_performed,
      dexamethasonePulseInitiated: Boolean(episode.dexamethasone_pulse_initiated),
      magnesiumSulfateSeizureProphylaxis: Boolean(episode.magnesium_sulfate_seizure_prophylaxis),
      plateletTransfusionAdministered: Boolean(episode.platelet_transfusion_administered),
      deliveryTimingPlan: episode.delivery_timing_plan,
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/obstetric-hellp/episodes', async (req) => {
    const user = assertCanManageHellp(req);
    const data = parse(hellpEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM obstetric_hellp_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `HELLP-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_hellp_episodes (
        patient_id, admission_id, episode_code, onset_datetime, gestational_age_weeks,
        platelet_count_per_ul, ast_u_l, alt_u_l, ldh_u_l, total_bilirubin_mg_dl,
        schistocytes_present, systolic_bp, diastolic_bp, epigastric_ruq_pain,
        hepatic_subcapsular_hematoma_suspected, hepatic_imaging_performed,
        dexamethasone_pulse_initiated, magnesium_sulfate_seizure_prophylaxis,
        platelet_transfusion_administered, delivery_timing_plan,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.plateletCountPerUl,
      data.astUL,
      data.altUL,
      data.ldhUL,
      data.totalBilirubinMgDl,
      data.schistocytesPresent ? 1 : 0,
      data.systolicBp,
      data.diastolicBp,
      data.epigastricRuqPain ? 1 : 0,
      data.hepaticSubcapsularHematomaSuspected ? 1 : 0,
      data.hepaticImagingPerformed,
      data.dexamethasonePulseInitiated ? 1 : 0,
      data.magnesiumSulfateSeizureProphylaxis ? 1 : 0,
      data.plateletTransfusionAdministered ? 1 : 0,
      data.deliveryTimingPlan,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hellp.create',
      entity: 'obstetric_hellp_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM obstetric_hellp_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/obstetric-hellp/episodes/:id', async (req) => {
    const user = assertCanManageHellp(req);
    const { id } = req.params as { id: string };
    const data = parse(hellpEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_hellp_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric HELLP episode not found');

    db.prepare(`
      UPDATE obstetric_hellp_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, gestational_age_weeks = ?,
        platelet_count_per_ul = ?, ast_u_l = ?, alt_u_l = ?, ldh_u_l = ?, total_bilirubin_mg_dl = ?,
        schistocytes_present = ?, systolic_bp = ?, diastolic_bp = ?, epigastric_ruq_pain = ?,
        hepatic_subcapsular_hematoma_suspected = ?, hepatic_imaging_performed = ?,
        dexamethasone_pulse_initiated = ?, magnesium_sulfate_seizure_prophylaxis = ?,
        platelet_transfusion_administered = ?, delivery_timing_plan = ?,
        status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.plateletCountPerUl,
      data.astUL,
      data.altUL,
      data.ldhUL,
      data.totalBilirubinMgDl,
      data.schistocytesPresent ? 1 : 0,
      data.systolicBp,
      data.diastolicBp,
      data.epigastricRuqPain ? 1 : 0,
      data.hepaticSubcapsularHematomaSuspected ? 1 : 0,
      data.hepaticImagingPerformed,
      data.dexamethasonePulseInitiated ? 1 : 0,
      data.magnesiumSulfateSeizureProphylaxis ? 1 : 0,
      data.plateletTransfusionAdministered ? 1 : 0,
      data.deliveryTimingPlan,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hellp.update',
      entity: 'obstetric_hellp_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    const episode = db.prepare(`SELECT * FROM obstetric_hellp_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Update Status
  app.patch('/api/obstetric-hellp/episodes/:id/status', async (req) => {
    const user = assertCanManageHellp(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM obstetric_hellp_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric HELLP episode not found');

    db.prepare(`
      UPDATE obstetric_hellp_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hellp.status_update',
      entity: 'obstetric_hellp_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/obstetric-hellp/episodes/:id', async (req) => {
    const user = assertCanManageHellp(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM obstetric_hellp_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric HELLP episode not found');

    db.prepare(`DELETE FROM obstetric_hellp_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hellp.delete',
      entity: 'obstetric_hellp_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/obstetric-hellp/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageHellp(req);
    const { id } = req.params as { id: string };
    const data = parse(hellpFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM obstetric_hellp_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric HELLP episode not found');

    const result = db.prepare(`
      INSERT INTO obstetric_hellp_flowsheet_logs (
        hellp_episode_id, patient_id, log_datetime, hours_from_admission,
        platelet_count_per_ul, ast_u_l, ldh_u_l, systolic_bp, diastolic_bp,
        urine_output_ml_hr, deep_tendon_reflexes, epigastric_pain_score, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromAdmission,
      data.plateletCountPerUl,
      data.astUL,
      data.ldhUL,
      data.systolicBp,
      data.diastolicBp,
      data.urineOutputMlHr,
      data.deepTendonReflexes,
      data.epigastricPainScore,
      data.notes || null,
      user.id
    );

    // Update current platelets on episode if lower nadir
    if (data.plateletCountPerUl < episode.platelet_count_per_ul) {
      db.prepare(`
        UPDATE obstetric_hellp_episodes
        SET platelet_count_per_ul = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(data.plateletCountPerUl, Number(id));
    }

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hellp.flowsheet_add',
      entity: 'obstetric_hellp_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, platelets: data.plateletCountPerUl },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM obstetric_hellp_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/obstetric-hellp/flowsheet/:id', async (req) => {
    const user = assertCanManageHellp(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM obstetric_hellp_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM obstetric_hellp_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_hellp.flowsheet_delete',
      entity: 'obstetric_hellp_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.hellp_episode_id },
    });

    return { ok: true };
  });
}
