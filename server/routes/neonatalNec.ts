import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { notFound, parse, forbidden } from '../errors.js';
import {
  evaluateNeonatalNec,
  classifyBellStage,
  type BellStage,
} from '../../web/src/neonatalNecEngine.js';

function assertCanManageNeonatalNec(req: FastifyRequest) {
  const user = requireUser(req);
  if (
    !can(user.role, 'patient:write_clinical') &&
    !can(user.role, 'care:write_nursing') &&
    !can(user.role, 'admission:write')
  ) {
    throw forbidden('Only clinical pediatricians and NICU nurses can manage neonatal NEC records');
  }
  return user;
}

export const neonatalNecEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  onsetDatetime: z.string().min(1, 'Onset datetime is required'),
  gestationalAgeWeeks: z.number().min(22).max(44),
  birthWeightGrams: z.number().min(300).max(6000),
  currentWeightGrams: z.number().min(300).max(6000),
  temperatureInstability: z.boolean().default(false),
  apneaBradycardia: z.boolean().default(false),
  lethargyHypotonia: z.boolean().default(false),
  hypotensionShock: z.boolean().default(false),
  gastricResidualsPercent: z.number().min(0).max(100).optional(),
  abdominalDistension: z.boolean().default(false),
  biliousEmesisOrAspirate: z.boolean().default(false),
  hemePositiveStool: z.boolean().default(false),
  grossHematochezia: z.boolean().default(false),
  absentBowelSounds: z.boolean().default(false),
  abdominalWallErythemaOrInduration: z.boolean().default(false),
  radiographicPneumatosis: z.boolean().default(false),
  radiographicPortalVenousGas: z.boolean().default(false),
  radiographicAscites: z.boolean().default(false),
  radiographicPneumoperitoneum: z.boolean().default(false),
  abgPh: z.number().min(6.5).max(7.8).nullable().optional(),
  baseExcess: z.number().min(-30).max(30).nullable().optional(),
  plateletCount: z.number().int().min(1000).max(1000000).nullable().optional(),
  crpMgL: z.number().min(0).max(500).nullable().optional(),
  serumLactateMmolL: z.number().min(0).max(30).nullable().optional(),
  npoActive: z.boolean().default(true),
  ngDecompressionActive: z.boolean().default(true),
  broadSpectrumAntibioticsActive: z.boolean().default(true),
  tpnSupportActive: z.boolean().default(true),
  inotropeSupportActive: z.boolean().default(false),
  surgicalConsultStatus: z.enum([
    'not_consulted',
    'consulted_medical_management',
    'bedside_peritoneal_drain_placed',
    'exploratory_laparotomy_performed',
  ]).default('not_consulted'),
  status: z.enum([
    'evaluating',
    'active_medical_management',
    'surgical_intervention',
    'post_operative_recovery',
    'resolved_feeding_restarted',
  ]).default('active_medical_management'),
  clinicalNotes: z.string().max(1000).nullable().optional(),
});

export const neonatalNecFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromOnset: z.number().min(0).default(0),
  abdominalGirthCm: z.number().min(10).max(60).nullable().optional(),
  gastricResidualVolumeMl: z.number().min(0).max(100).nullable().optional(),
  gastricResidualCharacter: z.enum([
    'clear',
    'curdled_milk',
    'bilious',
    'feculent',
    'blood_stained',
  ]).default('clear'),
  bowelSounds: z.enum(['normal', 'hypoactive', 'absent']).default('normal'),
  abdominalWallAppearance: z.enum([
    'normal',
    'distended_soft',
    'erythematous',
    'indurated_tender',
    'discolored_bluish',
  ]).default('normal'),
  plateletCount: z.number().int().min(1000).max(1000000).nullable().optional(),
  abgPh: z.number().min(6.5).max(7.8).nullable().optional(),
  lactateMmolL: z.number().min(0).max(30).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function registerNeonatalNecRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Live Clinical Evaluation Calculator Endpoint
  app.post('/api/neonatal-nec/calculate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const body = parse(neonatalNecEpisodeSchema.partial(), req.body);

    const evalResult = evaluateNeonatalNec({
      gestationalAgeWeeks: body.gestationalAgeWeeks ?? 32,
      birthWeightGrams: body.birthWeightGrams ?? 1800,
      currentWeightGrams: body.currentWeightGrams ?? 1800,
      temperatureInstability: body.temperatureInstability,
      apneaBradycardia: body.apneaBradycardia,
      lethargyHypotonia: body.lethargyHypotonia,
      hypotensionShock: body.hypotensionShock,
      gastricResidualsPercent: body.gastricResidualsPercent,
      abdominalDistension: body.abdominalDistension,
      biliousEmesisOrAspirate: body.biliousEmesisOrAspirate,
      hemePositiveStool: body.hemePositiveStool,
      grossHematochezia: body.grossHematochezia,
      absentBowelSounds: body.absentBowelSounds,
      abdominalWallErythemaOrInduration: body.abdominalWallErythemaOrInduration,
      radiographicPneumatosis: body.radiographicPneumatosis,
      radiographicPortalVenousGas: body.radiographicPortalVenousGas,
      radiographicAscites: body.radiographicAscites,
      radiographicPneumoperitoneum: body.radiographicPneumoperitoneum,
      abgPh: body.abgPh ?? undefined,
      baseExcess: body.baseExcess ?? undefined,
      plateletCount: body.plateletCount ?? undefined,
      serumLactate: body.serumLactateMmolL ?? undefined,
    });

    return { evalResult };
  });

  // 2. Create NEC Episode
  app.post('/api/neonatal-nec/episodes', async (req, reply) => {
    const user = assertCanManageNeonatalNec(req);
    const data = parse(neonatalNecEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateNeonatalNec({
      gestationalAgeWeeks: data.gestationalAgeWeeks,
      birthWeightGrams: data.birthWeightGrams,
      currentWeightGrams: data.currentWeightGrams,
      temperatureInstability: data.temperatureInstability,
      apneaBradycardia: data.apneaBradycardia,
      lethargyHypotonia: data.lethargyHypotonia,
      hypotensionShock: data.hypotensionShock,
      gastricResidualsPercent: data.gastricResidualsPercent,
      abdominalDistension: data.abdominalDistension,
      biliousEmesisOrAspirate: data.biliousEmesisOrAspirate,
      hemePositiveStool: data.hemePositiveStool,
      grossHematochezia: data.grossHematochezia,
      absentBowelSounds: data.absentBowelSounds,
      abdominalWallErythemaOrInduration: data.abdominalWallErythemaOrInduration,
      radiographicPneumatosis: data.radiographicPneumatosis,
      radiographicPortalVenousGas: data.radiographicPortalVenousGas,
      radiographicAscites: data.radiographicAscites,
      radiographicPneumoperitoneum: data.radiographicPneumoperitoneum,
      abgPh: data.abgPh ?? undefined,
      baseExcess: data.baseExcess ?? undefined,
      plateletCount: data.plateletCount ?? undefined,
      serumLactate: data.serumLactateMmolL ?? undefined,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `NEC-${todayCode}-${rand}`;

    const systemicArr = [];
    if (data.temperatureInstability) systemicArr.push('temperature_instability');
    if (data.apneaBradycardia) systemicArr.push('apnea_bradycardia');
    if (data.lethargyHypotonia) systemicArr.push('lethargy_hypotonia');
    if (data.hypotensionShock) systemicArr.push('hypotension_shock');

    const intestinalArr = [];
    if (data.abdominalDistension) intestinalArr.push('abdominal_distension');
    if (data.biliousEmesisOrAspirate) intestinalArr.push('bilious_emesis_or_aspirate');
    if (data.hemePositiveStool) intestinalArr.push('heme_positive_stool');
    if (data.grossHematochezia) intestinalArr.push('gross_hematochezia');
    if (data.absentBowelSounds) intestinalArr.push('absent_bowel_sounds');
    if (data.abdominalWallErythemaOrInduration) intestinalArr.push('abdominal_wall_erythema');

    const radioArr = [];
    if (data.radiographicPneumatosis) radioArr.push('pneumatosis_intestinalis');
    if (data.radiographicPortalVenousGas) radioArr.push('portal_venous_gas');
    if (data.radiographicAscites) radioArr.push('ascites');
    if (data.radiographicPneumoperitoneum) radioArr.push('pneumoperitoneum');

    const stmt = db.prepare(`
      INSERT INTO neonatal_nec_episodes (
        patient_id, admission_id, episode_code, onset_datetime,
        gestational_age_weeks, birth_weight_grams, current_weight_grams,
        bell_stage, systemic_signs_json, intestinal_signs_json,
        radiological_signs_json, abg_ph, base_excess, platelet_count,
        crp_mg_l, serum_lactate_mmol_l, npo_active, ng_decompression_active,
        broad_spectrum_antibiotics_active, tpn_support_active,
        inotrope_support_active, surgical_consult_status, status,
        consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.onsetDatetime,
      data.gestationalAgeWeeks,
      data.birthWeightGrams,
      data.currentWeightGrams,
      evalResult.bellStage,
      JSON.stringify(systemicArr),
      JSON.stringify(intestinalArr),
      JSON.stringify(radioArr),
      data.abgPh ?? null,
      data.baseExcess ?? null,
      data.plateletCount ?? null,
      data.crpMgL ?? null,
      data.serumLactateMmolL ?? null,
      data.npoActive ? 1 : 0,
      data.ngDecompressionActive ? 1 : 0,
      data.broadSpectrumAntibioticsActive ? 1 : 0,
      data.tpnSupportActive ? 1 : 0,
      data.inotropeSupportActive ? 1 : 0,
      data.surgicalConsultStatus,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(info.lastInsertRowid);
    const episode = db.prepare('SELECT * FROM neonatal_nec_episodes WHERE id = ?').get(episodeId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_nec.episode_create',
      entity: 'neonatal_nec_episodes',
      entityId: episodeId,
      detail: {
        episodeCode,
        patientId: data.patientId,
        bellStage: evalResult.bellStage,
        surgicalUrgency: evalResult.surgicalUrgency,
      },
    });

    reply.status(201);
    return { episode, evalResult };
  });

  // 3. List NEC Episodes
  app.get('/api/neonatal-nec/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const query = parse(
      z.object({
        patientId: z.coerce.number().int().positive().optional(),
        status: z.string().optional(),
      }),
      req.query,
    );

    let sql = 'SELECT * FROM neonatal_nec_episodes WHERE 1=1';
    const params: any[] = [];

    if (query.patientId) {
      sql += ' AND patient_id = ?';
      params.push(query.patientId);
    }
    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    sql += ' ORDER BY id DESC';

    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet Logs
  app.get('/api/neonatal-nec/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM neonatal_nec_episodes WHERE id = ?').get(id);
    if (!episode) throw notFound('Neonatal NEC episode not found');

    const logs = db
      .prepare('SELECT * FROM neonatal_nec_flowsheet_logs WHERE nec_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, logs };
  });

  // 5. Update Episode
  app.patch('/api/neonatal-nec/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalNec(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(neonatalNecEpisodeSchema.partial(), req.body);

    const existing = db.prepare('SELECT * FROM neonatal_nec_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal NEC episode not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.surgicalConsultStatus !== undefined) {
      fields.push('surgical_consult_status = ?');
      values.push(data.surgicalConsultStatus);
    }
    if (data.npoActive !== undefined) {
      fields.push('npo_active = ?');
      values.push(data.npoActive ? 1 : 0);
    }
    if (data.ngDecompressionActive !== undefined) {
      fields.push('ng_decompression_active = ?');
      values.push(data.ngDecompressionActive ? 1 : 0);
    }
    if (data.broadSpectrumAntibioticsActive !== undefined) {
      fields.push('broad_spectrum_antibiotics_active = ?');
      values.push(data.broadSpectrumAntibioticsActive ? 1 : 0);
    }
    if (data.inotropeSupportActive !== undefined) {
      fields.push('inotrope_support_active = ?');
      values.push(data.inotropeSupportActive ? 1 : 0);
    }
    if (data.clinicalNotes !== undefined) {
      fields.push('clinical_notes = ?');
      values.push(data.clinicalNotes);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE neonatal_nec_episodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM neonatal_nec_episodes WHERE id = ?').get(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_nec.episode_update',
      entity: 'neonatal_nec_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, updatedFields: Object.keys(data) },
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/neonatal-nec/episodes/:id', async (req) => {
    const user = assertCanManageNeonatalNec(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const existing = db.prepare('SELECT * FROM neonatal_nec_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Neonatal NEC episode not found');

    db.prepare('DELETE FROM neonatal_nec_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_nec.episode_delete',
      entity: 'neonatal_nec_episodes',
      entityId: id,
      detail: { patientId: existing.patient_id, episodeCode: existing.episode_code },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/neonatal-nec/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageNeonatalNec(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const data = parse(neonatalNecFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT * FROM neonatal_nec_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal NEC episode not found');

    const stmt = db.prepare(`
      INSERT INTO neonatal_nec_flowsheet_logs (
        nec_episode_id, patient_id, log_datetime, hours_from_onset,
        abdominal_girth_cm, gastric_residual_volume_ml, gastric_residual_character,
        bowel_sounds, abdominal_wall_appearance, platelet_count,
        abg_ph, lactate_mmol_l, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromOnset,
      data.abdominalGirthCm ?? null,
      data.gastricResidualVolumeMl ?? null,
      data.gastricResidualCharacter,
      data.bowelSounds,
      data.abdominalWallAppearance,
      data.plateletCount ?? null,
      data.abgPh ?? null,
      data.lactateMmolL ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'neonatal_nec.flowsheet_log',
      entity: 'neonatal_nec_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeId: id,
        patientId: episode.patient_id,
        girth: data.abdominalGirthCm,
        appearance: data.abdominalWallAppearance,
      },
    });

    reply.status(201);
    return {
      logId: Number(info.lastInsertRowid),
      abdominalGirthCm: data.abdominalGirthCm,
    };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/neonatal-nec/episodes/:episodeId/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageNeonatalNec(req);
    const { episodeId, logId } = parse(
      z.object({
        episodeId: z.coerce.number().int().positive(),
        logId: z.coerce.number().int().positive(),
      }),
      req.params,
    );

    const log = db.prepare('SELECT * FROM neonatal_nec_flowsheet_logs WHERE id = ? AND nec_episode_id = ?').get(logId, episodeId);
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM neonatal_nec_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'neonatal_nec.flowsheet_delete',
      entity: 'neonatal_nec_flowsheet_logs',
      entityId: logId,
      detail: { episodeId },
    });

    return { success: true };
  });

  // 9. Printable Clinical Dossier
  app.get('/api/neonatal-nec/episodes/:id/print', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);

    const episode = db.prepare('SELECT * FROM neonatal_nec_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Neonatal NEC episode not found');

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patient_id);
    const logs = db
      .prepare('SELECT * FROM neonatal_nec_flowsheet_logs WHERE nec_episode_id = ? ORDER BY log_datetime ASC')
      .all(id);

    return { episode, patient, logs };
  });
}
