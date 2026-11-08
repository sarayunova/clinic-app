import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricAcuteScrotum,
} from '../../web/src/pediatricAcuteScrotumEngine.js';

function assertCanManageScrotum(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage acute scrotum protocols');
  }
  return user;
}

const scrotumEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.0).max(21.0),
  affectedSide: z.enum(['right', 'left', 'bilateral']),
  symptomDurationHours: z.coerce.number().min(0.1).max(720.0),
  twistTestisSwelling: z.coerce.number().int().min(0).max(2),
  twistHardTestis: z.coerce.number().int().min(0).max(2),
  twistAbsentCremastericReflex: z.coerce.number().int().min(0).max(1),
  twistNauseaVomiting: z.coerce.number().int().min(0).max(1),
  twistHighRidingTestis: z.coerce.number().int().min(0).max(1),
  dopplerUltrasoundPerformed: z.boolean().default(false),
  dopplerFindings: z.enum([
    'not_performed',
    'absent_arterial_flow_torsion_confirmed',
    'decreased_flow_partial_torsion',
    'normal_flow_appendix_torsion_blue_dot',
    'increased_hyperemic_flow_epididymo_orchitis',
  ]).default('not_performed'),
  manualDetorsionAttempted: z.boolean().default(false),
  surgicalExplorationPerformed: z.boolean().default(false),
  intraoperativeFindings: z.enum([
    'preop_evaluation',
    'viable_testis_after_detorsion',
    'necrotic_nonviable_orchiectomy_performed',
    'torsion_appendix_testis_excised',
    'normal_testis_epididymitis_managed',
  ]).default('preop_evaluation'),
  bilateralOrchiopexyPerformed: z.boolean().default(false),
  status: z.enum([
    'emergency_triage_under_6h',
    'urgent_ultrasound_intermediate_risk',
    'in_operating_room_exploration',
    'postop_scrotal_support_recovery',
    'resolved_discharged_home',
  ]).default('emergency_triage_under_6h'),
  clinicalNotes: z.string().optional().nullable(),
});

const scrotumFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromPresentation: z.coerce.number().min(0.1).max(720.0),
  painScoreFlaccOrVas: z.coerce.number().int().min(0).max(10),
  scrotalEdemaErythema: z.enum([
    'mild',
    'moderate',
    'severe_tense',
    'resolving',
  ]),
  cremastericReflexStatus: z.enum([
    'absent',
    'sluggish',
    'intact_normal',
  ]),
  woundDressingClean: z.boolean().default(true),
  ambulationStatus: z.enum([
    'bedrest_scrotal_elevation',
    'gentle_ambulation_supported',
    'full_activity',
  ]),
  notes: z.string().optional().nullable(),
});

export function registerPediatricAcuteScrotumRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/pediatric-acute-scrotum/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(scrotumEpisodeSchema.omit({ patientId: true }), req.body);
    const evaluation = evaluatePediatricAcuteScrotum({
      ageYears: data.ageYears,
      affectedSide: data.affectedSide,
      symptomDurationHours: data.symptomDurationHours,
      twistTestisSwelling: data.twistTestisSwelling,
      twistHardTestis: data.twistHardTestis,
      twistAbsentCremastericReflex: data.twistAbsentCremastericReflex,
      twistNauseaVomiting: data.twistNauseaVomiting,
      twistHighRidingTestis: data.twistHighRidingTestis,
      dopplerUltrasoundPerformed: data.dopplerUltrasoundPerformed,
      dopplerFindings: data.dopplerFindings,
      manualDetorsionAttempted: data.manualDetorsionAttempted,
      surgicalExplorationPerformed: data.surgicalExplorationPerformed,
      intraoperativeFindings: data.intraoperativeFindings,
      bilateralOrchiopexyPerformed: data.bilateralOrchiopexyPerformed,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-acute-scrotum/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*, p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_acute_scrotum_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
    `;
    const params: any[] = [];
    if (patientId) {
      query += ' WHERE e.patient_id = ?';
      params.push(Number(patientId));
    }
    query += ' ORDER BY e.id DESC';

    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/pediatric-acute-scrotum/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_acute_scrotum_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Acute Scrotum episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_acute_scrotum_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.scrotum_episode_id = ?
      ORDER BY l.hours_from_presentation ASC, l.id ASC
    `).all(Number(id));

    const evaluation = evaluatePediatricAcuteScrotum({
      ageYears: episode.age_years,
      affectedSide: episode.affected_side,
      symptomDurationHours: episode.symptom_duration_hours,
      twistTestisSwelling: episode.twist_testis_swelling,
      twistHardTestis: episode.twist_hard_testis,
      twistAbsentCremastericReflex: episode.twist_absent_cremasteric_reflex,
      twistNauseaVomiting: episode.twist_nausea_vomiting,
      twistHighRidingTestis: episode.twist_high_riding_testis,
      dopplerUltrasoundPerformed: Boolean(episode.doppler_ultrasound_performed),
      dopplerFindings: episode.doppler_findings,
      manualDetorsionAttempted: Boolean(episode.manual_detorsion_attempted),
      surgicalExplorationPerformed: Boolean(episode.surgical_exploration_performed),
      intraoperativeFindings: episode.intraoperative_findings,
      bilateralOrchiopexyPerformed: Boolean(episode.bilateral_orchiopexy_performed),
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/pediatric-acute-scrotum/episodes', async (req) => {
    const user = assertCanManageScrotum(req);
    const data = parse(scrotumEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM pediatric_acute_scrotum_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `TWIST-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_acute_scrotum_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_years, affected_side,
        symptom_duration_hours,
        twist_testis_swelling, twist_hard_testis, twist_absent_cremasteric_reflex,
        twist_nausea_vomiting, twist_high_riding_testis,
        doppler_ultrasound_performed, doppler_findings,
        manual_detorsion_attempted, surgical_exploration_performed,
        intraoperative_findings, bilateral_orchiopexy_performed,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, ?,
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
      data.ageYears,
      data.affectedSide,
      data.symptomDurationHours,
      data.twistTestisSwelling,
      data.twistHardTestis,
      data.twistAbsentCremastericReflex,
      data.twistNauseaVomiting,
      data.twistHighRidingTestis,
      data.dopplerUltrasoundPerformed ? 1 : 0,
      data.dopplerFindings,
      data.manualDetorsionAttempted ? 1 : 0,
      data.surgicalExplorationPerformed ? 1 : 0,
      data.intraoperativeFindings,
      data.bilateralOrchiopexyPerformed ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const episodeId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_acute_scrotum.create',
      entity: 'pediatric_acute_scrotum_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, side: data.affectedSide },
    });

    const episode = db.prepare(`SELECT * FROM pediatric_acute_scrotum_episodes WHERE id = ?`).get(episodeId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/pediatric-acute-scrotum/episodes/:id', async (req) => {
    const user = assertCanManageScrotum(req);
    const { id } = req.params as { id: string };
    const data = parse(scrotumEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_acute_scrotum_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Acute Scrotum episode not found');

    db.prepare(`
      UPDATE pediatric_acute_scrotum_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, age_years = ?, affected_side = ?,
        symptom_duration_hours = ?,
        twist_testis_swelling = ?, twist_hard_testis = ?, twist_absent_cremasteric_reflex = ?,
        twist_nausea_vomiting = ?, twist_high_riding_testis = ?,
        doppler_ultrasound_performed = ?, doppler_findings = ?,
        manual_detorsion_attempted = ?, surgical_exploration_performed = ?,
        intraoperative_findings = ?, bilateral_orchiopexy_performed = ?,
        status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.ageYears,
      data.affectedSide,
      data.symptomDurationHours,
      data.twistTestisSwelling,
      data.twistHardTestis,
      data.twistAbsentCremastericReflex,
      data.twistNauseaVomiting,
      data.twistHighRidingTestis,
      data.dopplerUltrasoundPerformed ? 1 : 0,
      data.dopplerFindings,
      data.manualDetorsionAttempted ? 1 : 0,
      data.surgicalExplorationPerformed ? 1 : 0,
      data.intraoperativeFindings,
      data.bilateralOrchiopexyPerformed ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_acute_scrotum.update',
      entity: 'pediatric_acute_scrotum_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status: data.status },
    });

    const episode = db.prepare(`SELECT * FROM pediatric_acute_scrotum_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Patch Status
  app.patch('/api/pediatric-acute-scrotum/episodes/:id/status', async (req) => {
    const user = assertCanManageScrotum(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM pediatric_acute_scrotum_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Acute Scrotum episode not found');

    db.prepare(`
      UPDATE pediatric_acute_scrotum_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_acute_scrotum.status_change',
      entity: 'pediatric_acute_scrotum_episodes',
      entityId: Number(id),
      detail: { status },
    });

    return { ok: true };
  });

  // 7. Delete Episode (Doctor only)
  app.delete('/api/pediatric-acute-scrotum/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') throw forbidden('Only doctors can delete Acute Scrotum episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM pediatric_acute_scrotum_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Acute Scrotum episode not found');

    db.prepare(`DELETE FROM pediatric_acute_scrotum_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_acute_scrotum.delete',
      entity: 'pediatric_acute_scrotum_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/pediatric-acute-scrotum/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageScrotum(req);
    const { id } = req.params as { id: string };
    const data = parse(scrotumFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM pediatric_acute_scrotum_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Acute Scrotum episode not found');

    const result = db.prepare(`
      INSERT INTO pediatric_acute_scrotum_flowsheet_logs (
        scrotum_episode_id, patient_id, log_datetime, hours_from_presentation,
        pain_score_flacc_or_vas, scrotal_edema_erythema, cremasteric_reflex_status,
        wound_dressing_clean, ambulation_status, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromPresentation,
      data.painScoreFlaccOrVas,
      data.scrotalEdemaErythema,
      data.cremastericReflexStatus,
      data.woundDressingClean ? 1 : 0,
      data.ambulationStatus,
      data.notes || null,
      user.id
    );

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_acute_scrotum.flowsheet_add',
      entity: 'pediatric_acute_scrotum_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, pain: data.painScoreFlaccOrVas },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM pediatric_acute_scrotum_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/pediatric-acute-scrotum/flowsheet/:id', async (req) => {
    const user = assertCanManageScrotum(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM pediatric_acute_scrotum_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM pediatric_acute_scrotum_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_acute_scrotum.flowsheet_delete',
      entity: 'pediatric_acute_scrotum_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.scrotum_episode_id },
    });

    return { ok: true };
  });
}
