import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricAppendicitis,
  calculateSamuelPasScore,
  type ManagementPathway,
  type EmpiricAntibioticRegimen,
  type SurgicalFindings,
} from '../../web/src/pediatricAppendicitisEngine.js';

function assertCanManageAppendicitis(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric appendicitis protocols');
  }
  return user;
}

const pediatricAppendicitisEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  triageDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.5).max(18.0),
  weightKg: z.coerce.number().min(4.0).max(120.0),
  symptomDurationHours: z.coerce.number().min(1.0).max(336.0),

  coughPercussionHoppingRlqPain: z.boolean(),
  rlqTendernessLightPalpation: z.boolean(),
  migrationPainToRlq: z.boolean(),
  feverGt38c: z.boolean(),
  nauseaOrVomiting: z.boolean(),
  anorexia: z.boolean(),
  leukocytosisWbcGt10000: z.boolean(),
  neutrophiliaAncGt7500OrGe75pct: z.boolean(),

  wbcCountPerMicroliter: z.coerce.number().min(500).max(80000).optional().nullable(),
  neutrophilPercent: z.coerce.number().min(10).max(100).optional().nullable(),
  crpMgL: z.coerce.number().min(0).max(500).optional().nullable(),

  ultrasoundPerformed: z.boolean(),
  appendixVisualized: z.boolean(),
  outerDiameterMm: z.coerce.number().min(2.0).max(25.0).optional().nullable(),
  nonCompressible: z.boolean(),
  hypervascularRingOfFire: z.boolean(),
  appendicolithFecalithPresent: z.boolean(),
  periappendicealFluidOrFatStranding: z.boolean(),
  perforationOrAbscessSuspected: z.boolean(),

  managementPathway: z.enum([
    'urgent_laparoscopic_appendectomy',
    'open_appendectomy',
    'non_operative_iv_antibiotics',
    'percutaneous_abscess_drainage_interval',
    'discharge_observation',
  ]),
  empiricAntibioticRegimen: z.enum([
    'none',
    'ceftriaxone_plus_metronidazole',
    'piperacillin_tazobactam',
    'ampicillin_gentamicin_metronidazole',
    'ciprofloxacin_plus_metronidazole',
  ]).default('none'),
  surgicalFindings: z.enum([
    'uncomplicated_suppurative',
    'gangrenous_intact',
    'perforated_localized_phlegmon',
    'perforated_generalized_peritonitis',
    'normal_appendix',
  ]).optional().nullable(),

  status: z.enum([
    'triage_diagnostic_evaluation',
    'operating_room_in_transit',
    'postoperative_recovery',
    'conservative_antibiotics_inpatient',
    'resolved_discharged',
  ]).default('triage_diagnostic_evaluation'),
  clinicalNotes: z.string().optional().nullable(),
});

const pediatricAppendicitisFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromTriage: z.coerce.number().min(0).max(720).default(0),
  temperatureCelsius: z.coerce.number().min(34.0).max(43.0),
  heartRateBpm: z.coerce.number().int().min(40).max(220),
  respiratoryRate: z.coerce.number().int().min(10).max(80),
  painScoreFlaccWongBaker: z.coerce.number().int().min(0).max(10),
  abdominalExamFindings: z.enum([
    'soft_non_tender',
    'focal_rlq_tenderness_improving',
    'rebound_guarding_worsening',
    'diffuse_peritonitis',
  ]),
  oralIntakeStatus: z.enum([
    'npo_strict',
    'clear_liquids_tolerated',
    'age_appropriate_diet',
  ]),
  notes: z.string().optional().nullable(),
});

export function registerPediatricAppendicitisRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;
  // 1. Pure Preview Evaluation Endpoint
  app.post('/api/pediatric-appendicitis/evaluate', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    assertCanManageAppendicitis(req);
    const data = parse(pediatricAppendicitisEpisodeSchema.partial(), req.body);
    const evalResult = evaluatePediatricAppendicitis({
      ageYears: data.ageYears ?? 8.0,
      weightKg: data.weightKg ?? 25.0,
      symptomDurationHours: data.symptomDurationHours ?? 18.0,
      coughPercussionHoppingRlqPain: data.coughPercussionHoppingRlqPain ?? false,
      rlqTendernessLightPalpation: data.rlqTendernessLightPalpation ?? false,
      migrationPainToRlq: data.migrationPainToRlq ?? false,
      feverGt38c: data.feverGt38c ?? false,
      nauseaOrVomiting: data.nauseaOrVomiting ?? false,
      anorexia: data.anorexia ?? false,
      leukocytosisWbcGt10000: data.leukocytosisWbcGt10000 ?? false,
      neutrophiliaAncGt7500OrGe75pct: data.neutrophiliaAncGt7500OrGe75pct ?? false,
      wbcCountPerMicroliter: data.wbcCountPerMicroliter ?? undefined,
      neutrophilPercent: data.neutrophilPercent ?? undefined,
      crpMgL: data.crpMgL ?? undefined,
      ultrasoundPerformed: data.ultrasoundPerformed ?? false,
      appendixVisualized: data.appendixVisualized ?? false,
      outerDiameterMm: data.outerDiameterMm ?? undefined,
      nonCompressible: data.nonCompressible ?? false,
      hypervascularRingOfFire: data.hypervascularRingOfFire ?? false,
      appendicolithFecalithPresent: data.appendicolithFecalithPresent ?? false,
      periappendicealFluidOrFatStranding: data.periappendicealFluidOrFatStranding ?? false,
      perforationOrAbscessSuspected: data.perforationOrAbscessSuspected ?? false,
      managementPathway: data.managementPathway ?? 'urgent_laparoscopic_appendectomy',
      empiricAntibioticRegimen: data.empiricAntibioticRegimen ?? 'none',
      surgicalFindings: data.surgicalFindings ?? undefined,
    });
    return { evalResult };
  });

  // 2. List Episodes
  app.get('/api/pediatric-appendicitis/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    let sql = `
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM pediatric_appendicitis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      sql += ' AND e.patient_id = ?';
      params.push(patientId);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.created_at DESC';
    const episodes = db.prepare(sql).all(...params);
    return { episodes };
  });

  // 3. Create Episode
  app.post('/api/pediatric-appendicitis/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageAppendicitis(req);
    const data = parse(pediatricAppendicitisEpisodeSchema, req.body);

    const pasScore = calculateSamuelPasScore({
      coughPercussionHoppingRlqPain: data.coughPercussionHoppingRlqPain,
      rlqTendernessLightPalpation: data.rlqTendernessLightPalpation,
      migrationPainToRlq: data.migrationPainToRlq,
      feverGt38c: data.feverGt38c,
      nauseaOrVomiting: data.nauseaOrVomiting,
      anorexia: data.anorexia,
      leukocytosisWbcGt10000: data.leukocytosisWbcGt10000,
      neutrophiliaAncGt7500OrGe75pct: data.neutrophiliaAncGt7500OrGe75pct,
    });

    const evalResult = evaluatePediatricAppendicitis({
      ageYears: data.ageYears,
      weightKg: data.weightKg,
      symptomDurationHours: data.symptomDurationHours,
      coughPercussionHoppingRlqPain: data.coughPercussionHoppingRlqPain,
      rlqTendernessLightPalpation: data.rlqTendernessLightPalpation,
      migrationPainToRlq: data.migrationPainToRlq,
      feverGt38c: data.feverGt38c,
      nauseaOrVomiting: data.nauseaOrVomiting,
      anorexia: data.anorexia,
      leukocytosisWbcGt10000: data.leukocytosisWbcGt10000,
      neutrophiliaAncGt7500OrGe75pct: data.neutrophiliaAncGt7500OrGe75pct,
      wbcCountPerMicroliter: data.wbcCountPerMicroliter ?? undefined,
      neutrophilPercent: data.neutrophilPercent ?? undefined,
      crpMgL: data.crpMgL ?? undefined,
      ultrasoundPerformed: data.ultrasoundPerformed,
      appendixVisualized: data.appendixVisualized,
      outerDiameterMm: data.outerDiameterMm ?? undefined,
      nonCompressible: data.nonCompressible,
      hypervascularRingOfFire: data.hypervascularRingOfFire,
      appendicolithFecalithPresent: data.appendicolithFecalithPresent,
      periappendicealFluidOrFatStranding: data.periappendicealFluidOrFatStranding,
      perforationOrAbscessSuspected: data.perforationOrAbscessSuspected,
      managementPathway: data.managementPathway,
      empiricAntibioticRegimen: data.empiricAntibioticRegimen,
      surgicalFindings: data.surgicalFindings ?? undefined,
    });

    const episodeCode = `APP-${Date.now().toString().slice(-8)}`;

    const res = db.prepare(`
      INSERT INTO pediatric_appendicitis_episodes (
        patient_id, admission_id, episode_code, triage_datetime,
        age_years, weight_kg, symptom_duration_hours,
        cough_percussion_hopping_rlq_pain, rlq_tenderness_light_palpation,
        migration_pain_to_rlq, fever_gt_38c, nausea_or_vomiting, anorexia,
        leukocytosis_wbc_gt_10000, neutrophilia_anc_gt_7500_or_ge_75pct, pas_score_total,
        wbc_count_per_microliter, neutrophil_percent, crp_mg_l,
        ultrasound_performed, appendix_visualized, outer_diameter_mm,
        non_compressible, hypervascular_ring_of_fire, appendicolith_fecalith_present,
        periappendiceal_fluid_or_fat_stranding, perforation_or_abscess_suspected,
        management_pathway, empiric_antibiotic_regimen, surgical_findings,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.triageDatetime,
      data.ageYears,
      data.weightKg,
      data.symptomDurationHours,
      data.coughPercussionHoppingRlqPain ? 1 : 0,
      data.rlqTendernessLightPalpation ? 1 : 0,
      data.migrationPainToRlq ? 1 : 0,
      data.feverGt38c ? 1 : 0,
      data.nauseaOrVomiting ? 1 : 0,
      data.anorexia ? 1 : 0,
      data.leukocytosisWbcGt10000 ? 1 : 0,
      data.neutrophiliaAncGt7500OrGe75pct ? 1 : 0,
      pasScore,
      data.wbcCountPerMicroliter ?? null,
      data.neutrophilPercent ?? null,
      data.crpMgL ?? null,
      data.ultrasoundPerformed ? 1 : 0,
      data.appendixVisualized ? 1 : 0,
      data.outerDiameterMm ?? null,
      data.nonCompressible ? 1 : 0,
      data.hypervascularRingOfFire ? 1 : 0,
      data.appendicolithFecalithPresent ? 1 : 0,
      data.periappendicealFluidOrFatStranding ? 1 : 0,
      data.perforationOrAbscessSuspected ? 1 : 0,
      data.managementPathway,
      data.empiricAntibioticRegimen,
      data.surgicalFindings ?? null,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_appendicitis.create',
      entity: 'pediatric_appendicitis_episodes',
      entityId: episodeId,
      detail: { episodeCode, patientId: data.patientId, pasScore, status: data.status },
    });

    const episode = db.prepare('SELECT * FROM pediatric_appendicitis_episodes WHERE id = ?').get(episodeId);
    reply.status(201);
    return { episode, evalResult };
  });

  // 4. Retrieve Single Episode
  app.get('/api/pediatric-appendicitis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*, p.full_name as patient_name, u.full_name as consultant_name
      FROM pediatric_appendicitis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Pediatric appendicitis episode not found');

    const logs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_appendicitis_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.appendicitis_episode_id = ?
      ORDER BY l.log_datetime ASC
    `).all(id);

    const evalResult = evaluatePediatricAppendicitis({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      symptomDurationHours: episode.symptom_duration_hours,
      coughPercussionHoppingRlqPain: episode.cough_percussion_hopping_rlq_pain === 1,
      rlqTendernessLightPalpation: episode.rlq_tenderness_light_palpation === 1,
      migrationPainToRlq: episode.migration_pain_to_rlq === 1,
      feverGt38c: episode.fever_gt_38c === 1,
      nauseaOrVomiting: episode.nausea_or_vomiting === 1,
      anorexia: episode.anorexia === 1,
      leukocytosisWbcGt10000: episode.leukocytosis_wbc_gt_10000 === 1,
      neutrophiliaAncGt7500OrGe75pct: episode.neutrophilia_anc_gt_7500_or_ge_75pct === 1,
      wbcCountPerMicroliter: episode.wbc_count_per_microliter,
      neutrophilPercent: episode.neutrophil_percent,
      crpMgL: episode.crp_mg_l,
      ultrasoundPerformed: episode.ultrasound_performed === 1,
      appendixVisualized: episode.appendix_visualized === 1,
      outerDiameterMm: episode.outer_diameter_mm,
      nonCompressible: episode.non_compressible === 1,
      hypervascularRingOfFire: episode.hypervascular_ring_of_fire === 1,
      appendicolithFecalithPresent: episode.appendicolith_fecalith_present === 1,
      periappendicealFluidOrFatStranding: episode.periappendiceal_fluid_or_fat_stranding === 1,
      perforationOrAbscessSuspected: episode.perforation_or_abscess_suspected === 1,
      managementPathway: episode.management_pathway as ManagementPathway,
      empiricAntibioticRegimen: episode.empiric_antibiotic_regimen as EmpiricAntibioticRegimen,
      surgicalFindings: episode.surgical_findings as SurgicalFindings,
    });

    return { episode, logs, evalResult };
  });

  // 5. Update Episode
  app.patch('/api/pediatric-appendicitis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageAppendicitis(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM pediatric_appendicitis_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric appendicitis episode not found');

    const data = parse(pediatricAppendicitisEpisodeSchema.partial(), req.body);

    const cCough = data.coughPercussionHoppingRlqPain !== undefined ? data.coughPercussionHoppingRlqPain : existing.cough_percussion_hopping_rlq_pain === 1;
    const cRlq = data.rlqTendernessLightPalpation !== undefined ? data.rlqTendernessLightPalpation : existing.rlq_tenderness_light_palpation === 1;
    const cMig = data.migrationPainToRlq !== undefined ? data.migrationPainToRlq : existing.migration_pain_to_rlq === 1;
    const cFev = data.feverGt38c !== undefined ? data.feverGt38c : existing.fever_gt_38c === 1;
    const cNau = data.nauseaOrVomiting !== undefined ? data.nauseaOrVomiting : existing.nausea_or_vomiting === 1;
    const cAno = data.anorexia !== undefined ? data.anorexia : existing.anorexia === 1;
    const cWbc = data.leukocytosisWbcGt10000 !== undefined ? data.leukocytosisWbcGt10000 : existing.leukocytosis_wbc_gt_10000 === 1;
    const cAnc = data.neutrophiliaAncGt7500OrGe75pct !== undefined ? data.neutrophiliaAncGt7500OrGe75pct : existing.neutrophilia_anc_gt_7500_or_ge_75pct === 1;

    const pasScore = calculateSamuelPasScore({
      coughPercussionHoppingRlqPain: cCough,
      rlqTendernessLightPalpation: cRlq,
      migrationPainToRlq: cMig,
      feverGt38c: cFev,
      nauseaOrVomiting: cNau,
      anorexia: cAno,
      leukocytosisWbcGt10000: cWbc,
      neutrophiliaAncGt7500OrGe75pct: cAnc,
    });

    db.prepare(`
      UPDATE pediatric_appendicitis_episodes
      SET
        cough_percussion_hopping_rlq_pain = ?,
        rlq_tenderness_light_palpation = ?,
        migration_pain_to_rlq = ?,
        fever_gt_38c = ?,
        nausea_or_vomiting = ?,
        anorexia = ?,
        leukocytosis_wbc_gt_10000 = ?,
        neutrophilia_anc_gt_7500_or_ge_75pct = ?,
        pas_score_total = ?,
        wbc_count_per_microliter = COALESCE(?, wbc_count_per_microliter),
        neutrophil_percent = COALESCE(?, neutrophil_percent),
        crp_mg_l = COALESCE(?, crp_mg_l),
        ultrasound_performed = COALESCE(?, ultrasound_performed),
        appendix_visualized = COALESCE(?, appendix_visualized),
        outer_diameter_mm = COALESCE(?, outer_diameter_mm),
        non_compressible = COALESCE(?, non_compressible),
        hypervascular_ring_of_fire = COALESCE(?, hypervascular_ring_of_fire),
        appendicolith_fecalith_present = COALESCE(?, appendicolith_fecalith_present),
        periappendiceal_fluid_or_fat_stranding = COALESCE(?, periappendiceal_fluid_or_fat_stranding),
        perforation_or_abscess_suspected = COALESCE(?, perforation_or_abscess_suspected),
        management_pathway = COALESCE(?, management_pathway),
        empiric_antibiotic_regimen = COALESCE(?, empiric_antibiotic_regimen),
        surgical_findings = COALESCE(?, surgical_findings),
        status = COALESCE(?, status),
        clinical_notes = COALESCE(?, clinical_notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      cCough ? 1 : 0,
      cRlq ? 1 : 0,
      cMig ? 1 : 0,
      cFev ? 1 : 0,
      cNau ? 1 : 0,
      cAno ? 1 : 0,
      cWbc ? 1 : 0,
      cAnc ? 1 : 0,
      pasScore,
      data.wbcCountPerMicroliter ?? null,
      data.neutrophilPercent ?? null,
      data.crpMgL ?? null,
      data.ultrasoundPerformed !== undefined ? (data.ultrasoundPerformed ? 1 : 0) : null,
      data.appendixVisualized !== undefined ? (data.appendixVisualized ? 1 : 0) : null,
      data.outerDiameterMm ?? null,
      data.nonCompressible !== undefined ? (data.nonCompressible ? 1 : 0) : null,
      data.hypervascularRingOfFire !== undefined ? (data.hypervascularRingOfFire ? 1 : 0) : null,
      data.appendicolithFecalithPresent !== undefined ? (data.appendicolithFecalithPresent ? 1 : 0) : null,
      data.periappendicealFluidOrFatStranding !== undefined ? (data.periappendicealFluidOrFatStranding ? 1 : 0) : null,
      data.perforationOrAbscessSuspected !== undefined ? (data.perforationOrAbscessSuspected ? 1 : 0) : null,
      data.managementPathway ?? null,
      data.empiricAntibioticRegimen ?? null,
      data.surgicalFindings ?? null,
      data.status ?? null,
      data.clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_appendicitis.update',
      entity: 'pediatric_appendicitis_episodes',
      entityId: Number(id),
      detail: { updatedFields: Object.keys(data), pasScore },
    });

    const episode = db.prepare('SELECT * FROM pediatric_appendicitis_episodes WHERE id = ?').get(id);
    return { episode };
  });

  // 6. Delete Episode
  app.delete('/api/pediatric-appendicitis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageAppendicitis(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare('SELECT * FROM pediatric_appendicitis_episodes WHERE id = ?').get(id) as any;
    if (!existing) throw notFound('Pediatric appendicitis episode not found');

    db.prepare('DELETE FROM pediatric_appendicitis_episodes WHERE id = ?').run(id);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_appendicitis.delete',
      entity: 'pediatric_appendicitis_episodes',
      entityId: Number(id),
      detail: { episodeCode: existing.episode_code, patientId: existing.patient_id },
    });

    return { success: true };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-appendicitis/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageAppendicitis(req);
    const { id } = req.params as { id: string };

    const episode = db.prepare('SELECT * FROM pediatric_appendicitis_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric appendicitis episode not found');

    const data = parse(pediatricAppendicitisFlowsheetSchema, req.body);

    const res = db.prepare(`
      INSERT INTO pediatric_appendicitis_flowsheet_logs (
        appendicitis_episode_id, patient_id, log_datetime, hours_from_triage,
        temperature_celsius, heart_rate_bpm, respiratory_rate,
        pain_score_flacc_wong_baker, abdominal_exam_findings, oral_intake_status,
        notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `).run(
      id,
      episode.patient_id,
      data.logDatetime,
      data.hoursFromTriage,
      data.temperatureCelsius,
      data.heartRateBpm,
      data.respiratoryRate,
      data.painScoreFlaccWongBaker,
      data.abdominalExamFindings,
      data.oralIntakeStatus,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_appendicitis.flowsheet_add',
      entity: 'pediatric_appendicitis_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), exam: data.abdominalExamFindings, pain: data.painScoreFlaccWongBaker },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-appendicitis/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageAppendicitis(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM pediatric_appendicitis_flowsheet_logs
      WHERE id = ? AND appendicitis_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_appendicitis_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_appendicitis.flowsheet_delete',
      entity: 'pediatric_appendicitis_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
