import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluateNeonatalSip,
} from '../../web/src/neonatalSipEngine.js';

function assertCanManageSip(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage neonatal SIP protocols');
  }
  return user;
}

const sipEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageDays: z.coerce.number().int().min(0).max(90),
  birthWeightGrams: z.coerce.number().int().min(300).max(5000),
  gestationalAgeWeeks: z.coerce.number().min(22.0).max(42.0),
  antenatalOrEarlySteroidsExposed: z.boolean().default(false),
  indomethacinOrIbuprofenPdaExposed: z.boolean().default(false),
  pneumoperitoneumConfirmed: z.boolean().default(true),
  pneumatosisIntestinalisAbsent: z.boolean().default(true),
  portalVenousGasAbsent: z.boolean().default(true),
  abdominalWallBluishDiscoloration: z.boolean().default(false),
  peritonealDrainagePerformed: z.boolean().default(true),
  drainType: z.enum([
    'penrose_drain',
    'chest_tube_10fr',
    'pigtail_catheter',
    'none_laparotomy_primary',
  ]).default('penrose_drain'),
  peritonealFluidYeastCandidaPositive: z.boolean().default(false),
  surgicalApproach: z.enum([
    'bedside_primary_peritoneal_drainage',
    'urgent_exploratory_laparotomy',
    'delayed_laparotomy_post_drain_failure',
  ]).default('bedside_primary_peritoneal_drainage'),
  status: z.enum([
    'acute_perforation_triage',
    'bedside_peritoneal_drain_active',
    'laparotomy_resection_enterostomy',
    'drain_weaning_resolution',
    'convalescent_enteral_feeding',
    'resolved_discharged_home',
  ]).default('acute_perforation_triage'),
  clinicalNotes: z.string().optional().nullable(),
});

const sipFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromIntervention: z.coerce.number().int().min(0).max(720),
  drainOutputMl24h: z.coerce.number().min(0.0).max(500.0),
  drainOutputCharacter: z.enum([
    'serosanguinous',
    'bilious',
    'feculent_meconium',
    'purulent',
    'minimal_clear',
  ]),
  abdominalGirthCm: z.coerce.number().min(10.0).max(60.0),
  meanAirwayPressureCmh2o: z.coerce.number().min(4.0).max(30.0),
  inotropicSupportActive: z.boolean().default(false),
  plateletCountKUl: z.coerce.number().int().min(5).max(1000),
  crpMgL: z.coerce.number().min(0.0).max(300.0),
  notes: z.string().optional().nullable(),
});

export function registerNeonatalSipRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/neonatal-sip/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const data = parse(sipEpisodeSchema.omit({ patientId: true }).partial({ onsetDatetime: true, status: true }), req.body);
    const evaluation = evaluateNeonatalSip({
      ageDays: data.ageDays,
      birthWeightGrams: data.birthWeightGrams,
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      antenatalOrEarlySteroidsExposed: data.antenatalOrEarlySteroidsExposed,
      indomethacinOrIbuprofenPdaExposed: data.indomethacinOrIbuprofenPdaExposed,
      pneumoperitoneumConfirmed: data.pneumoperitoneumConfirmed,
      pneumatosisIntestinalisAbsent: data.pneumatosisIntestinalisAbsent,
      portalVenousGasAbsent: data.portalVenousGasAbsent,
      abdominalWallBluishDiscoloration: data.abdominalWallBluishDiscoloration,
      peritonealDrainagePerformed: data.peritonealDrainagePerformed,
      drainType: data.drainType,
      peritonealFluidYeastCandidaPositive: data.peritonealFluidYeastCandidaPositive,
      surgicalApproach: data.surgicalApproach,
    });
    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/neonatal-sip/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let episodes;
    if (patientId) {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM neonatal_sip_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        WHERE e.patient_id = ?
        ORDER BY e.created_at DESC
      `).all(Number(patientId));
    } else {
      episodes = db.prepare(`
        SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
        FROM neonatal_sip_episodes e
        JOIN patients p ON p.id = e.patient_id
        LEFT JOIN users u ON u.id = e.consultant_id
        ORDER BY e.created_at DESC
      `).all();
    }

    return { episodes };
  });

  // 3. Get Single Episode with Evaluation and Flowsheet Logs
  app.get('/api/neonatal-sip/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, p.date_of_birth, u.full_name as consultant_name
      FROM neonatal_sip_episodes e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN users u ON u.id = e.consultant_id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Neonatal SIP episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT f.*, u.full_name as logged_by_name
      FROM neonatal_sip_flowsheet_logs f
      LEFT JOIN users u ON u.id = f.logged_by_id
      WHERE f.sip_episode_id = ?
      ORDER BY f.log_datetime DESC
    `).all(Number(id));

    const evaluation = evaluateNeonatalSip({
      ageDays: episode.age_days,
      birthWeightGrams: episode.birth_weight_grams,
      gestationalAgeWeeks: episode.gestational_age_weeks,
      antenatalOrEarlySteroidsExposed: Boolean(episode.antenatal_or_early_steroids_exposed),
      indomethacinOrIbuprofenPdaExposed: Boolean(episode.indomethacin_or_ibuprofen_pda_exposed),
      pneumoperitoneumConfirmed: Boolean(episode.pneumoperitoneum_confirmed),
      pneumatosisIntestinalisAbsent: Boolean(episode.pneumatosis_intestinalis_absent),
      portalVenousGasAbsent: Boolean(episode.portal_venous_gas_absent),
      abdominalWallBluishDiscoloration: Boolean(episode.abdominal_wall_bluish_discoloration),
      peritonealDrainagePerformed: Boolean(episode.peritoneal_drainage_performed),
      drainType: episode.drain_type,
      peritonealFluidYeastCandidaPositive: Boolean(episode.peritoneal_fluid_yeast_candida_positive),
      surgicalApproach: episode.surgical_approach,
    });

    return { episode, evaluation, flowsheetLogs };
  });

  // 4. Create Episode
  app.post('/api/neonatal-sip/episodes', async (req, reply) => {
    const user = assertCanManageSip(req);
    const data = parse(sipEpisodeSchema, req.body);

    const patient = db.prepare(`SELECT id FROM patients WHERE id = ?`).get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const episodeCode = `SIP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const result = db.prepare(`
      INSERT INTO neonatal_sip_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_days,
        birth_weight_grams, gestational_age_weeks,
        antenatal_or_early_steroids_exposed, indomethacin_or_ibuprofen_pda_exposed,
        pneumoperitoneum_confirmed, pneumatosis_intestinalis_absent, portal_venous_gas_absent,
        abdominal_wall_bluish_discoloration, peritoneal_drainage_performed,
        drain_type, peritoneal_fluid_yeast_candida_positive, surgical_approach,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId || null,
      episodeCode,
      data.onsetDatetime,
      data.ageDays,
      data.birthWeightGrams,
      data.gestationalAgeWeeks,
      data.antenatalOrEarlySteroidsExposed ? 1 : 0,
      data.indomethacinOrIbuprofenPdaExposed ? 1 : 0,
      data.pneumoperitoneumConfirmed ? 1 : 0,
      data.pneumatosisIntestinalisAbsent ? 1 : 0,
      data.portalVenousGasAbsent ? 1 : 0,
      data.abdominalWallBluishDiscoloration ? 1 : 0,
      data.peritonealDrainagePerformed ? 1 : 0,
      data.drainType,
      data.peritonealFluidYeastCandidaPositive ? 1 : 0,
      data.surgicalApproach,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const created = db.prepare(`SELECT * FROM neonatal_sip_episodes WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sip.episode_create',
      entity: 'neonatal_sip_episodes',
      entityId: created.id,
      detail: { episodeId: created.id, episodeCode, patientId: data.patientId },
    });

    reply.code(201);
    return { episode: created };
  });

  // 5. Update Episode
  app.put('/api/neonatal-sip/episodes/:id', async (req) => {
    const user = assertCanManageSip(req);
    const { id } = req.params as { id: string };
    const data = parse(sipEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM neonatal_sip_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal SIP episode not found');

    db.prepare(`
      UPDATE neonatal_sip_episodes SET
        admission_id = ?,
        onset_datetime = ?,
        age_days = ?,
        birth_weight_grams = ?,
        gestational_age_weeks = ?,
        antenatal_or_early_steroids_exposed = ?,
        indomethacin_or_ibuprofen_pda_exposed = ?,
        pneumoperitoneum_confirmed = ?,
        pneumatosis_intestinalis_absent = ?,
        portal_venous_gas_absent = ?,
        abdominal_wall_bluish_discoloration = ?,
        peritoneal_drainage_performed = ?,
        drain_type = ?,
        peritoneal_fluid_yeast_candida_positive = ?,
        surgical_approach = ?,
        status = ?,
        clinical_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.admissionId || null,
      data.onsetDatetime,
      data.ageDays,
      data.birthWeightGrams,
      data.gestationalAgeWeeks,
      data.antenatalOrEarlySteroidsExposed ? 1 : 0,
      data.indomethacinOrIbuprofenPdaExposed ? 1 : 0,
      data.pneumoperitoneumConfirmed ? 1 : 0,
      data.pneumatosisIntestinalisAbsent ? 1 : 0,
      data.portalVenousGasAbsent ? 1 : 0,
      data.abdominalWallBluishDiscoloration ? 1 : 0,
      data.peritonealDrainagePerformed ? 1 : 0,
      data.drainType,
      data.peritonealFluidYeastCandidaPositive ? 1 : 0,
      data.surgicalApproach,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    const updated = db.prepare(`SELECT * FROM neonatal_sip_episodes WHERE id = ?`).get(Number(id)) as any;

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sip.episode_update',
      entity: 'neonatal_sip_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: data.patientId },
    });

    return { episode: updated };
  });

  // 6. Patch Status
  app.patch('/api/neonatal-sip/episodes/:id/status', async (req) => {
    const user = assertCanManageSip(req);
    const { id } = req.params as { id: string };
    const { status } = parse(z.object({
      status: sipEpisodeSchema.shape.status,
    }), req.body);

    const existing = db.prepare(`SELECT * FROM neonatal_sip_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal SIP episode not found');

    db.prepare(`
      UPDATE neonatal_sip_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sip.status_patch',
      entity: 'neonatal_sip_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), previousStatus: existing.status, newStatus: status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/neonatal-sip/episodes/:id', async (req) => {
    const user = assertCanManageSip(req);
    if (user.role !== 'doctor') throw forbidden('Only doctors can delete SIP episodes');
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM neonatal_sip_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!existing) throw notFound('Neonatal SIP episode not found');

    db.prepare(`DELETE FROM neonatal_sip_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sip.episode_delete',
      entity: 'neonatal_sip_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), patientId: existing.patient_id },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Checkpoint
  app.post('/api/neonatal-sip/episodes/:id/flowsheet', async (req, reply) => {
    const user = assertCanManageSip(req);
    const { id } = req.params as { id: string };
    const data = parse(sipFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM neonatal_sip_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Neonatal SIP episode not found');

    const result = db.prepare(`
      INSERT INTO neonatal_sip_flowsheet_logs (
        sip_episode_id, patient_id, log_datetime, hours_from_intervention,
        drain_output_ml_24h, drain_output_character, abdominal_girth_cm,
        mean_airway_pressure_cmh2o, inotropic_support_active, platelet_count_k_ul,
        crp_mg_l, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.hoursFromIntervention,
      data.drainOutputMl24h,
      data.drainOutputCharacter,
      data.abdominalGirthCm,
      data.meanAirwayPressureCmh2o,
      data.inotropicSupportActive ? 1 : 0,
      data.plateletCountKUl,
      data.crpMgL,
      data.notes || null,
      user.id
    );

    const created = db.prepare(`SELECT * FROM neonatal_sip_flowsheet_logs WHERE id = ?`).get(result.lastInsertRowid) as any;

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sip.flowsheet_add',
      entity: 'neonatal_sip_flowsheet_logs',
      entityId: created.id,
      detail: { flowsheetId: created.id, episodeId: Number(id), patientId: episode.patient_id },
    });

    reply.code(201);
    return { flowsheetLog: created };
  });

  // 9. Delete Flowsheet Checkpoint
  app.delete('/api/neonatal-sip/flowsheet/:flowsheetId', async (req) => {
    const user = assertCanManageSip(req);
    const { flowsheetId } = req.params as { flowsheetId: string };

    const existing = db.prepare(`SELECT * FROM neonatal_sip_flowsheet_logs WHERE id = ?`).get(Number(flowsheetId)) as any;
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM neonatal_sip_flowsheet_logs WHERE id = ?`).run(Number(flowsheetId));

    audit(db, {
      actorId: user.id,
      action: 'neonatal_sip.flowsheet_delete',
      entity: 'neonatal_sip_flowsheet_logs',
      entityId: Number(flowsheetId),
      detail: { flowsheetId: Number(flowsheetId), episodeId: existing.sip_episode_id },
    });

    return { ok: true };
  });
}
