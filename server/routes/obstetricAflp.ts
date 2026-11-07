import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { notFound, forbidden, parse } from '../errors.js';
import { audit } from '../audit.js';
import { evaluateSwanseaCriteria } from '../../web/src/obstetricAflpEngine.js';

function assertCanManageObstetricAflp(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only clinical obstetricians and labor ward/HDU nurses can manage AFLP records');
  }
  return user;
}

export const obstetricAflpEpisodeSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  admissionId: z.number().int().positive().nullable().optional(),
  diagnosisDatetime: z.string().min(1, 'Diagnosis datetime is required'),
  gestationWeeks: z.number().min(20).max(44),
  vomitingPresent: z.boolean().default(false),
  abdominalPainPresent: z.boolean().default(false),
  polydipsiaPolyuriaPresent: z.boolean().default(false),
  encephalopathyPresent: z.boolean().default(false),
  elevatedBilirubin: z.boolean().default(false),
  hypoglycemiaPresent: z.boolean().default(false),
  elevatedUrate: z.boolean().default(false),
  leukocytosisPresent: z.boolean().default(false),
  ascitesOrBrightLiver: z.boolean().default(false),
  elevatedTransaminases: z.boolean().default(false),
  elevatedAmmonia: z.boolean().default(false),
  renalImpairment: z.boolean().default(false),
  coagulopathyPresent: z.boolean().default(false),
  microvesicularSteatosisBiopsy: z.boolean().default(false),
  serumGlucoseMgDl: z.number().min(10).max(500).nullable().optional(),
  serumBilirubinTotalMgDl: z.number().min(0.1).max(50).nullable().optional(),
  astUL: z.number().min(1).max(5000).nullable().optional(),
  altUL: z.number().min(1).max(5000).nullable().optional(),
  serumCreatinineMgDl: z.number().min(0.1).max(20).nullable().optional(),
  ptSeconds: z.number().min(5).max(120).nullable().optional(),
  inr: z.number().min(0.5).max(15).nullable().optional(),
  dextroseInfusionActive: z.boolean().default(false),
  deliveryUrgency: z.enum([
    'immediate_emergent_delivery',
    'urgent_stabilize_then_deliver',
    'delivered_postpartum_management',
  ]).default('immediate_emergent_delivery'),
  deliveryPerformed: z.boolean().default(false),
  deliveryDatetime: z.string().nullable().optional(),
  lchadNewbornScreeningAlert: z.boolean().default(true),
  status: z.enum([
    'evaluating',
    'active_critical_resuscitation',
    'postpartum_icu_monitoring',
    'hepatic_recovery',
    'resolved',
  ]).default('evaluating'),
  clinicalNotes: z.string().nullable().optional(),
});

export const obstetricAflpFlowsheetSchema = z.object({
  logDatetime: z.string().min(1, 'Log datetime is required'),
  hoursFromDiagnosis: z.number().min(0).default(0),
  bloodGlucoseMgDl: z.number().min(10).max(600),
  dextroseInfusionRateMlHr: z.number().min(0).max(500).default(0),
  dextroseConcentrationPercent: z.number().min(5).max(50).default(10),
  sbpMmhg: z.number().int().min(40).max(250).nullable().optional(),
  dbpMmhg: z.number().int().min(20).max(150).nullable().optional(),
  hrBpm: z.number().int().min(30).max(220).nullable().optional(),
  encephalopathyGrade: z.number().int().min(0).max(4).default(0),
  urineOutputMlHr: z.number().min(0).max(1000).nullable().optional(),
  plateletCount: z.number().int().min(1000).max(1000000).nullable().optional(),
  fibrinogenMgDl: z.number().min(10).max(1000).nullable().optional(),
  ptSeconds: z.number().min(5).max(120).nullable().optional(),
  inr: z.number().min(0.5).max(15).nullable().optional(),
  bloodProductsAdministered: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export function registerObstetricAflpRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Swansea Evaluation Preview Endpoint
  app.post('/api/obstetric-aflp/evaluate', async (req) => {
    assertCanManageObstetricAflp(req);
    const body = req.body as Partial<z.infer<typeof obstetricAflpEpisodeSchema>>;

    const evalResult = evaluateSwanseaCriteria({
      vomiting: Boolean(body.vomitingPresent),
      abdominalPain: Boolean(body.abdominalPainPresent),
      polydipsiaPolyuria: Boolean(body.polydipsiaPolyuriaPresent),
      encephalopathy: Boolean(body.encephalopathyPresent),
      elevatedBilirubin: Boolean(body.elevatedBilirubin),
      hypoglycemia: Boolean(body.hypoglycemiaPresent),
      elevatedUrate: Boolean(body.elevatedUrate),
      leukocytosis: Boolean(body.leukocytosisPresent),
      ascitesOrBrightLiver: Boolean(body.ascitesOrBrightLiver),
      elevatedTransaminases: Boolean(body.elevatedTransaminases),
      elevatedAmmonia: Boolean(body.elevatedAmmonia),
      renalImpairment: Boolean(body.renalImpairment),
      coagulopathy: Boolean(body.coagulopathyPresent),
      microvesicularSteatosisBiopsy: Boolean(body.microvesicularSteatosisBiopsy),
      serumGlucoseMgDl: body.serumGlucoseMgDl ?? undefined,
      serumBilirubinMgDl: body.serumBilirubinTotalMgDl ?? undefined,
      astUL: body.astUL ?? undefined,
      altUL: body.altUL ?? undefined,
      creatinineMgDl: body.serumCreatinineMgDl ?? undefined,
      ptSeconds: body.ptSeconds ?? undefined,
      inr: body.inr ?? undefined,
    });

    return { evalResult };
  });

  // 2. Create Obstetric AFLP Episode
  app.post('/api/obstetric-aflp/episodes', async (req, reply) => {
    const user = assertCanManageObstetricAflp(req);
    const data = parse(obstetricAflpEpisodeSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(data.patientId);
    if (!patient) throw notFound('Patient not found');

    const evalResult = evaluateSwanseaCriteria({
      vomiting: data.vomitingPresent,
      abdominalPain: data.abdominalPainPresent,
      polydipsiaPolyuria: data.polydipsiaPolyuriaPresent,
      encephalopathy: data.encephalopathyPresent,
      elevatedBilirubin: data.elevatedBilirubin,
      hypoglycemia: data.hypoglycemiaPresent,
      elevatedUrate: data.elevatedUrate,
      leukocytosis: data.leukocytosisPresent,
      ascitesOrBrightLiver: data.ascitesOrBrightLiver,
      elevatedTransaminases: data.elevatedTransaminases,
      elevatedAmmonia: data.elevatedAmmonia,
      renalImpairment: data.renalImpairment,
      coagulopathy: data.coagulopathyPresent,
      microvesicularSteatosisBiopsy: data.microvesicularSteatosisBiopsy,
      serumGlucoseMgDl: data.serumGlucoseMgDl ?? undefined,
      serumBilirubinMgDl: data.serumBilirubinTotalMgDl ?? undefined,
      astUL: data.astUL ?? undefined,
      altUL: data.altUL ?? undefined,
      creatinineMgDl: data.serumCreatinineMgDl ?? undefined,
      ptSeconds: data.ptSeconds ?? undefined,
      inr: data.inr ?? undefined,
    });

    const todayCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const episodeCode = `AFLP-${todayCode}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO obstetric_aflp_episodes (
        patient_id, admission_id, episode_code, diagnosis_datetime,
        gestation_weeks, vomiting_present, abdominal_pain_present,
        polydipsia_polyuria_present, encephalopathy_present, elevated_bilirubin,
        hypoglycemia_present, elevated_urate, leukocytosis_present,
        ascites_or_bright_liver, elevated_transaminases, elevated_ammonia,
        renal_impairment, coagulopathy_present, microvesicular_steatosis_biopsy,
        total_swansea_criteria_met, aflp_confirmed,
        serum_glucose_mg_dl, serum_bilirubin_total_mg_dl, ast_u_l, alt_u_l,
        serum_creatinine_mg_dl, pt_seconds, inr, dextrose_infusion_active,
        delivery_urgency, delivery_performed, delivery_datetime,
        lchad_newborn_screening_alert, status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.diagnosisDatetime,
      data.gestationWeeks,
      data.vomitingPresent ? 1 : 0,
      data.abdominalPainPresent ? 1 : 0,
      data.polydipsiaPolyuriaPresent ? 1 : 0,
      data.encephalopathyPresent ? 1 : 0,
      data.elevatedBilirubin ? 1 : 0,
      data.hypoglycemiaPresent ? 1 : 0,
      data.elevatedUrate ? 1 : 0,
      data.leukocytosisPresent ? 1 : 0,
      data.ascitesOrBrightLiver ? 1 : 0,
      data.elevatedTransaminases ? 1 : 0,
      data.elevatedAmmonia ? 1 : 0,
      data.renalImpairment ? 1 : 0,
      data.coagulopathyPresent ? 1 : 0,
      data.microvesicularSteatosisBiopsy ? 1 : 0,
      evalResult.totalCriteriaMet,
      evalResult.aflpConfirmed ? 1 : 0,
      data.serumGlucoseMgDl ?? null,
      data.serumBilirubinTotalMgDl ?? null,
      data.astUL ?? null,
      data.altUL ?? null,
      data.serumCreatinineMgDl ?? null,
      data.ptSeconds ?? null,
      data.inr ?? null,
      data.dextroseInfusionActive ? 1 : 0,
      data.deliveryUrgency,
      data.deliveryPerformed ? 1 : 0,
      data.deliveryDatetime ?? null,
      data.lchadNewbornScreeningAlert ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const created = db.prepare('SELECT * FROM obstetric_aflp_episodes WHERE id = ?').get(info.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'obstetric_aflp.episode_create',
      entity: 'obstetric_aflp_episodes',
      entityId: Number(info.lastInsertRowid),
      detail: {
        episodeCode,
        patientId: data.patientId,
        totalSwanseaCriteriaMet: evalResult.totalCriteriaMet,
        aflpConfirmed: evalResult.aflpConfirmed,
      },
    });

    reply.status(201);
    return { episode: created, evalResult };
  });

  // 3. List Episodes
  app.get('/api/obstetric-aflp/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let query = `
      SELECT e.*, p.full_name AS patient_name, p.patient_number, u.full_name AS consultant_name
      FROM obstetric_aflp_episodes e
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

    query += ' ORDER BY e.diagnosis_datetime DESC';
    const episodes = db.prepare(query).all(...params);
    return { episodes };
  });

  // 4. Get Episode Detail with Flowsheet
  app.get('/api/obstetric-aflp/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name AS patient_name, p.patient_number, p.date_of_birth, u.full_name AS consultant_name
      FROM obstetric_aflp_episodes e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Obstetric AFLP episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name AS logged_by_name
      FROM obstetric_aflp_flowsheet_logs l
      LEFT JOIN users u ON l.logged_by_id = u.id
      WHERE l.aflp_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(Number(id));

    const evalResult = evaluateSwanseaCriteria({
      vomiting: Boolean(episode.vomiting_present),
      abdominalPain: Boolean(episode.abdominal_pain_present),
      polydipsiaPolyuria: Boolean(episode.polydipsia_polyuria_present),
      encephalopathy: Boolean(episode.encephalopathy_present),
      elevatedBilirubin: Boolean(episode.elevated_bilirubin),
      hypoglycemia: Boolean(episode.hypoglycemia_present),
      elevatedUrate: Boolean(episode.elevated_urate),
      leukocytosis: Boolean(episode.leukocytosis_present),
      ascitesOrBrightLiver: Boolean(episode.ascites_or_bright_liver),
      elevatedTransaminases: Boolean(episode.elevated_transaminases),
      elevatedAmmonia: Boolean(episode.elevated_ammonia),
      renalImpairment: Boolean(episode.renal_impairment),
      coagulopathy: Boolean(episode.coagulopathy_present),
      microvesicularSteatosisBiopsy: Boolean(episode.microvesicular_steatosis_biopsy),
      serumGlucoseMgDl: episode.serum_glucose_mg_dl,
      serumBilirubinMgDl: episode.serum_bilirubin_total_mg_dl,
      astUL: episode.ast_u_l,
      altUL: episode.alt_u_l,
      creatinineMgDl: episode.serum_creatinine_mg_dl,
      ptSeconds: episode.pt_seconds,
      inr: episode.inr,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode Status / Delivery Info
  app.patch('/api/obstetric-aflp/episodes/:id', async (req) => {
    const user = assertCanManageObstetricAflp(req);
    const { id } = req.params as { id: string };
    const patch = req.body as Partial<z.infer<typeof obstetricAflpEpisodeSchema>>;

    const existing = db.prepare('SELECT id FROM obstetric_aflp_episodes WHERE id = ?').get(Number(id));
    if (!existing) throw notFound('Obstetric AFLP episode not found');

    db.prepare(`
      UPDATE obstetric_aflp_episodes SET
        dextrose_infusion_active = COALESCE(?, dextrose_infusion_active),
        delivery_urgency = COALESCE(?, delivery_urgency),
        delivery_performed = COALESCE(?, delivery_performed),
        delivery_datetime = COALESCE(?, delivery_datetime),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      patch.dextroseInfusionActive !== undefined ? (patch.dextroseInfusionActive ? 1 : 0) : null,
      patch.deliveryUrgency ?? null,
      patch.deliveryPerformed !== undefined ? (patch.deliveryPerformed ? 1 : 0) : null,
      patch.deliveryDatetime ?? null,
      patch.status ?? null,
      patch.clinicalNotes ?? null,
      Number(id),
    );

    const updated = db.prepare('SELECT * FROM obstetric_aflp_episodes WHERE id = ?').get(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_aflp.episode_update',
      entity: 'obstetric_aflp_episodes',
      entityId: Number(id),
      detail: patch,
    });

    return { episode: updated };
  });

  // 6. Delete Episode
  app.delete('/api/obstetric-aflp/episodes/:id', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete AFLP episodes');
    }
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT id, episode_code, patient_id FROM obstetric_aflp_episodes WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw notFound('Obstetric AFLP episode not found');

    db.prepare('DELETE FROM obstetric_aflp_episodes WHERE id = ?').run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_aflp.episode_delete',
      entity: 'obstetric_aflp_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Bedside Flowsheet Log
  app.post('/api/obstetric-aflp/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageObstetricAflp(req);
    const { id } = req.params as { id: string };
    const data = parse(obstetricAflpFlowsheetSchema, req.body);

    const ep = db.prepare('SELECT id, patient_id FROM obstetric_aflp_episodes WHERE id = ?').get(Number(id)) as any;
    if (!ep) throw notFound('Obstetric AFLP episode not found');

    const stmt = db.prepare(`
      INSERT INTO obstetric_aflp_flowsheet_logs (
        aflp_episode_id, patient_id, log_datetime, hours_from_diagnosis,
        blood_glucose_mg_dl, dextrose_infusion_rate_ml_hr,
        dextrose_concentration_percent, sbp_mmhg, dbp_mmhg, hr_bpm,
        encephalopathy_grade, urine_output_ml_hr, platelet_count,
        fibrinogen_mg_dl, pt_seconds, inr, blood_products_administered,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);

    const info = stmt.run(
      ep.id,
      ep.patient_id,
      data.logDatetime,
      data.hoursFromDiagnosis,
      data.bloodGlucoseMgDl,
      data.dextroseInfusionRateMlHr,
      data.dextroseConcentrationPercent,
      data.sbpMmhg ?? null,
      data.dbpMmhg ?? null,
      data.hrBpm ?? null,
      data.encephalopathyGrade,
      data.urineOutputMlHr ?? null,
      data.plateletCount ?? null,
      data.fibrinogenMgDl ?? null,
      data.ptSeconds ?? null,
      data.inr ?? null,
      data.bloodProductsAdministered ?? null,
      data.notes ?? null,
      user.id,
    );

    audit(db, {
      actorId: user.id,
      action: 'obstetric_aflp.flowsheet_log',
      entity: 'obstetric_aflp_flowsheet_logs',
      entityId: Number(info.lastInsertRowid),
      detail: { episodeId: Number(id), glucose: data.bloodGlucoseMgDl, d10Rate: data.dextroseInfusionRateMlHr },
    });

    reply.status(201);
    return { logId: info.lastInsertRowid };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/obstetric-aflp/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = req.user;
    if (!user || user.role !== 'doctor') {
      throw forbidden('Only doctors or administrators can delete AFLP flowsheet logs');
    }
    const { id, logId } = req.params as { id: string; logId: string };

    const existing = db.prepare('SELECT id FROM obstetric_aflp_flowsheet_logs WHERE id = ? AND aflp_episode_id = ?').get(Number(logId), Number(id));
    if (!existing) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM obstetric_aflp_flowsheet_logs WHERE id = ?').run(Number(logId));

    audit(db, {
      actorId: user.id,
      action: 'obstetric_aflp.flowsheet_delete',
      entity: 'obstetric_aflp_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
