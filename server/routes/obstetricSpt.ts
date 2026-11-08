import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateObstetricSpt,
} from '../../web/src/obstetricSptEngine.js';

function assertCanManageSpt(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage obstetric septic pelvic thrombophlebitis protocols');
  }
  return user;
}

const sptEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  deliveryDatetime: z.string().min(1),
  deliveryMode: z.enum(['cesarean_section', 'operative_vaginal', 'spontaneous_vaginal']),
  postpartumDay: z.coerce.number().int().min(0).max(60),
  sptPhenotype: z.enum(['ovarian_vein_thrombosis', 'deep_septic_pelvic_thrombophlebitis', 'undifferentiated_refractory_fever']),
  affectedVein: z.enum(['right_ovarian_vein', 'left_ovarian_vein', 'bilateral_ovarian_veins', 'internal_iliac_plexus', 'not_visualized_clinical_diagnosis']),
  peakTemperatureCelsius: z.coerce.number().min(35.0).max(43.0),
  hoursRefractoryTripleAntibiotics: z.coerce.number().int().min(0).max(240).default(48),
  pelvicCtMriFindings: z.enum(['thrombus_with_rim_enhancement', 'pelvic_phlebitis_perivascular_stranding', 'negative_no_thrombus_seen', 'imaging_pending']),
  pelvicAbscessRuledOut: z.boolean().default(true),
  heparinChallengeInitiated: z.boolean().default(true),
  heparinChallengeStartDatetime: z.string().optional().nullable(),
  anticoagulantRegimen: z.enum(['iv_unfractionated_heparin_infusion', 'therapeutic_lmwh_weight_based', 'transition_to_oral_anticoagulation']),
  targetApttSeconds: z.string().default('60-85s (1.5-2.5x control)'),
  defervescenceHours: z.coerce.number().min(0).max(240).optional().nullable(),
  heparinChallengeResponse: z.enum(['pending_under_48h', 'positive_defervescence_within_48_72h', 'refractory_persistent_fever', 'alternative_pathology_identified']),
  status: z.enum([
    'heparin_challenge_eval',
    'active_therapeutic_anticoagulation',
    'afebrile_antibiotic_completion',
    'outpatient_anticoagulation_bridge',
    'resolved_thrombus_recanalized',
  ]).default('heparin_challenge_eval'),
  clinicalNotes: z.string().optional().nullable(),
});

const sptFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursSinceHeparinStart: z.coerce.number().min(0).max(360),
  temperatureCelsius: z.coerce.number().min(34.0).max(43.0),
  heartRate: z.coerce.number().int().min(30).max(220),
  systolicBp: z.coerce.number().int().min(50).max(250),
  diastolicBp: z.coerce.number().int().min(30).max(150),
  apttSeconds: z.coerce.number().min(15).max(200).optional().nullable(),
  antiXaActivityIuMl: z.coerce.number().min(0).max(3.0).optional().nullable(),
  heparinInfusionRateUnitsHr: z.coerce.number().min(0).max(5000).optional().nullable(),
  bleedingSigns: z.enum(['none', 'mild_lochia_rubra', 'wound_hematoma', 'major_pelvic_hemorrhage']),
  flankAbdominalPainScore: z.coerce.number().int().min(0).max(10).default(0),
  notes: z.string().optional().nullable(),
});

export function registerObstetricSptRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/obstetric-spt/evaluate', async (req) => {
    assertCanManageSpt(req);
    const body = req.body as any;

    const evaluation = evaluateObstetricSpt({
      deliveryMode: body.deliveryMode || 'cesarean_section',
      postpartumDay: Number(body.postpartumDay || 4),
      sptPhenotype: body.sptPhenotype || 'ovarian_vein_thrombosis',
      affectedVein: body.affectedVein || 'right_ovarian_vein',
      peakTemperatureCelsius: Number(body.peakTemperatureCelsius || 38.8),
      hoursRefractoryTripleAntibiotics: Number(body.hoursRefractoryTripleAntibiotics || 48),
      pelvicCtMriFindings: body.pelvicCtMriFindings || 'thrombus_with_rim_enhancement',
      pelvicAbscessRuledOut: body.pelvicAbscessRuledOut !== undefined ? Boolean(body.pelvicAbscessRuledOut) : true,
      heparinChallengeInitiated: body.heparinChallengeInitiated !== undefined ? Boolean(body.heparinChallengeInitiated) : true,
      anticoagulantRegimen: body.anticoagulantRegimen || 'iv_unfractionated_heparin_infusion',
      targetApttSeconds: body.targetApttSeconds || '60-85s (1.5-2.5x control)',
      defervescenceHours: body.defervescenceHours !== undefined && body.defervescenceHours !== null ? Number(body.defervescenceHours) : null,
      heparinChallengeResponse: body.heparinChallengeResponse || 'pending_under_48h',
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/obstetric-spt/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_spt_episodes e
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
  app.get('/api/obstetric-spt/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM obstetric_spt_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric SPT episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM obstetric_spt_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.spt_episode_id = ?
      ORDER BY l.hours_since_heparin_start ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluateObstetricSpt({
      deliveryMode: episode.delivery_mode,
      postpartumDay: episode.postpartum_day,
      sptPhenotype: episode.spt_phenotype,
      affectedVein: episode.affected_vein,
      peakTemperatureCelsius: episode.peak_temperature_celsius,
      hoursRefractoryTripleAntibiotics: episode.hours_refractory_triple_antibiotics,
      pelvicCtMriFindings: episode.pelvic_ct_mri_findings,
      pelvicAbscessRuledOut: Boolean(episode.pelvic_abscess_ruled_out),
      heparinChallengeInitiated: Boolean(episode.heparin_challenge_initiated),
      anticoagulantRegimen: episode.anticoagulant_regimen,
      targetApttSeconds: episode.target_aptt_seconds,
      defervescenceHours: episode.defervescence_hours,
      heparinChallengeResponse: episode.heparin_challenge_response,
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/obstetric-spt/episodes', async (req) => {
    const user = assertCanManageSpt(req);
    const data = parse(sptEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM obstetric_spt_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `SPT-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_spt_episodes (
        patient_id, admission_id, episode_code, delivery_datetime, delivery_mode,
        postpartum_day, spt_phenotype, affected_vein, peak_temperature_celsius,
        hours_refractory_triple_antibiotics, pelvic_ct_mri_findings, pelvic_abscess_ruled_out,
        heparin_challenge_initiated, heparin_challenge_start_datetime, anticoagulant_regimen,
        target_aptt_seconds, defervescence_hours, heparin_challenge_response,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    const result = stmt.run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.deliveryDatetime,
      data.deliveryMode,
      data.postpartumDay,
      data.sptPhenotype,
      data.affectedVein,
      data.peakTemperatureCelsius,
      data.hoursRefractoryTripleAntibiotics,
      data.pelvicCtMriFindings,
      data.pelvicAbscessRuledOut ? 1 : 0,
      data.heparinChallengeInitiated ? 1 : 0,
      data.heparinChallengeStartDatetime || null,
      data.anticoagulantRegimen,
      data.targetApttSeconds,
      data.defervescenceHours || null,
      data.heparinChallengeResponse,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_spt.create',
      entity: 'obstetric_spt_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM obstetric_spt_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/obstetric-spt/episodes/:id', async (req) => {
    const user = assertCanManageSpt(req);
    const { id } = req.params as { id: string };
    const data = parse(sptEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM obstetric_spt_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric SPT episode not found');

    db.prepare(`
      UPDATE obstetric_spt_episodes SET
        patient_id = ?, admission_id = ?, delivery_datetime = ?, delivery_mode = ?,
        postpartum_day = ?, spt_phenotype = ?, affected_vein = ?, peak_temperature_celsius = ?,
        hours_refractory_triple_antibiotics = ?, pelvic_ct_mri_findings = ?, pelvic_abscess_ruled_out = ?,
        heparin_challenge_initiated = ?, heparin_challenge_start_datetime = ?, anticoagulant_regimen = ?,
        target_aptt_seconds = ?, defervescence_hours = ?, heparin_challenge_response = ?,
        status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.deliveryDatetime,
      data.deliveryMode,
      data.postpartumDay,
      data.sptPhenotype,
      data.affectedVein,
      data.peakTemperatureCelsius,
      data.hoursRefractoryTripleAntibiotics,
      data.pelvicCtMriFindings,
      data.pelvicAbscessRuledOut ? 1 : 0,
      data.heparinChallengeInitiated ? 1 : 0,
      data.heparinChallengeStartDatetime || null,
      data.anticoagulantRegimen,
      data.targetApttSeconds,
      data.defervescenceHours || null,
      data.heparinChallengeResponse,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_spt.update',
      entity: 'obstetric_spt_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    const episode = db.prepare(`SELECT * FROM obstetric_spt_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Update Status
  app.patch('/api/obstetric-spt/episodes/:id/status', async (req) => {
    const user = assertCanManageSpt(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM obstetric_spt_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric SPT episode not found');

    db.prepare(`
      UPDATE obstetric_spt_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_spt.status_update',
      entity: 'obstetric_spt_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/obstetric-spt/episodes/:id', async (req) => {
    const user = assertCanManageSpt(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM obstetric_spt_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Obstetric SPT episode not found');

    db.prepare(`DELETE FROM obstetric_spt_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_spt.delete',
      entity: 'obstetric_spt_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/obstetric-spt/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageSpt(req);
    const { id } = req.params as { id: string };
    const data = parse(sptFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM obstetric_spt_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Obstetric SPT episode not found');

    const result = db.prepare(`
      INSERT INTO obstetric_spt_flowsheet_logs (
        spt_episode_id, patient_id, log_datetime, hours_since_heparin_start,
        temperature_celsius, heart_rate, systolic_bp, diastolic_bp,
        aptt_seconds, anti_xa_activity_iu_ml, heparin_infusion_rate_units_hr,
        bleeding_signs, flank_abdominal_pain_score, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursSinceHeparinStart,
      data.temperatureCelsius,
      data.heartRate,
      data.systolicBp,
      data.diastolicBp,
      data.apttSeconds || null,
      data.antiXaActivityIuMl || null,
      data.heparinInfusionRateUnitsHr || null,
      data.bleedingSigns,
      data.flankAbdominalPainScore,
      data.notes || null,
      user.id
    );

    // If defervescence documented (e.g. temp < 37.8°C at >= 24h), update defervescenceHours if not yet set
    if (data.temperatureCelsius < 37.8 && !episode.defervescence_hours && data.hoursSinceHeparinStart >= 12) {
      db.prepare(`
        UPDATE obstetric_spt_episodes
        SET defervescence_hours = ?,
            heparin_challenge_response = 'positive_defervescence_within_48_72h',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(data.hoursSinceHeparinStart, Number(id));
    }

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_spt.flowsheet_add',
      entity: 'obstetric_spt_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, temperature: data.temperatureCelsius },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM obstetric_spt_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/obstetric-spt/flowsheet/:id', async (req) => {
    const user = assertCanManageSpt(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM obstetric_spt_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM obstetric_spt_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_spt.flowsheet_delete',
      entity: 'obstetric_spt_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.spt_episode_id },
    });

    return { ok: true };
  });
}
