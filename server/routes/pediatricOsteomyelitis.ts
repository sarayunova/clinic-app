import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricOsteomyelitis,
} from '../../web/src/pediatricOsteomyelitisEngine.js';

function assertCanManageOsteo(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric acute osteomyelitis protocols');
  }
  return user;
}

const osteoEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  onsetDatetime: z.string().min(1),
  ageYears: z.coerce.number().min(0.1).max(18.0),
  weightKg: z.coerce.number().min(2.0).max(120.0),
  boneInvolved: z.enum([
    'distal_femur',
    'proximal_tibia',
    'distal_tibia',
    'proximal_humerus',
    'fibula',
    'radius_ulna',
    'pelvis',
    'other_bone',
  ]),
  laterality: z.enum(['right', 'left', 'bilateral']),
  kocherFeverGt385: z.boolean().default(true),
  kocherNonWeightBearing: z.boolean().default(true),
  kocherEsrGt40: z.boolean().default(true),
  kocherWbcGt12k: z.boolean().default(true),
  crpAdmissionMgL: z.coerce.number().min(0).max(500.0),
  crpPeakMgL: z.coerce.number().min(0).max(500.0),
  subperiostealAbscessPresent: z.boolean().default(false),
  abscessSizeDepthMm: z.coerce.number().min(0).max(50.0).default(0.0),
  imagingModalityConfirmatory: z.enum([
    'ultrasound_subperiosteal_fluid',
    'mri_with_contrast',
    'plain_radiograph_lytic_changes',
    'ct_scan',
  ]),
  surgicalDecompressionPerformed: z.boolean().default(false),
  surgicalProcedure: z.enum([
    'none_medical_management',
    'percutaneous_needle_aspiration',
    'cortical_fenestration_and_drainage',
    'extensive_debridement_sequestrectomy',
  ]).default('none_medical_management'),
  isolatedPathogen: z.enum([
    'staphylococcus_aureus_mssa',
    'staphylococcus_aureus_mrsa',
    'streptococcus_pyogenes_group_a',
    'kingella_kingae',
    'pseudomonas_aeruginosa',
    'culture_negative_clinical_aho',
  ]).default('staphylococcus_aureus_mssa'),
  currentAntibioticRegimen: z.enum([
    'iv_cefazolin',
    'iv_vancomycin',
    'iv_clindamycin',
    'iv_ceftriaxone',
    'oral_cephalexin',
    'oral_clindamycin',
    'oral_amoxicillin_clavulanate',
  ]).default('iv_cefazolin'),
  oralSwitchCriteriaMet: z.boolean().default(false),
  status: z.enum([
    'initial_iv_empiric_therapy',
    'surgical_drainage_and_culture',
    'pathogen_directed_iv_therapy',
    'oral_step_down_therapy',
    'resolved_treatment_completed',
  ]).default('initial_iv_empiric_therapy'),
  clinicalNotes: z.string().optional().nullable(),
});

const osteoFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  dayOfTherapy: z.coerce.number().int().min(1).max(90).default(1),
  temperatureCelsius: z.coerce.number().min(34.0).max(43.0),
  crpLevelMgL: z.coerce.number().min(0).max(500.0),
  esrMmHr: z.coerce.number().min(0).max(200.0).optional().nullable(),
  painScoreFlaccOrVas: z.coerce.number().int().min(0).max(10),
  weightBearingStatus: z.enum(['unable_refuses_pseudoparalysis', 'partial_weight_bearing_limp', 'full_weight_bearing_pain_free']),
  localSigns: z.enum(['marked_edema_erythema_warmth', 'moderately_tender_improving', 'mild_tenderness_no_swelling', 'completely_quiescent']),
  routeOfAdministration: z.enum(['iv_infusion', 'oral_step_down']),
  notes: z.string().optional().nullable(),
});

export function registerPediatricOsteomyelitisRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Evaluate Preview
  app.post('/api/pediatric-osteomyelitis/evaluate', async (req) => {
    assertCanManageOsteo(req);
    const body = req.body as any;

    const evaluation = evaluatePediatricOsteomyelitis({
      ageYears: Number(body.ageYears || 6),
      weightKg: Number(body.weightKg || 22),
      boneInvolved: body.boneInvolved || 'distal_femur',
      laterality: body.laterality || 'right',
      kocherFeverGt385: Boolean(body.kocherFeverGt385),
      kocherNonWeightBearing: Boolean(body.kocherNonWeightBearing),
      kocherEsrGt40: Boolean(body.kocherEsrGt40),
      kocherWbcGt12k: Boolean(body.kocherWbcGt12k),
      crpAdmissionMgL: Number(body.crpAdmissionMgL || 68),
      crpPeakMgL: Number(body.crpPeakMgL || 94),
      subperiostealAbscessPresent: Boolean(body.subperiostealAbscessPresent),
      abscessSizeDepthMm: Number(body.abscessSizeDepthMm || 0),
      imagingModalityConfirmatory: body.imagingModalityConfirmatory || 'mri_with_contrast',
      surgicalDecompressionPerformed: Boolean(body.surgicalDecompressionPerformed),
      surgicalProcedure: body.surgicalProcedure || 'none_medical_management',
      isolatedPathogen: body.isolatedPathogen || 'staphylococcus_aureus_mssa',
      currentAntibioticRegimen: body.currentAntibioticRegimen || 'iv_cefazolin',
      oralSwitchCriteriaMet: Boolean(body.oralSwitchCriteriaMet),
      currentCrpMgL: body.currentCrpMgL !== undefined ? Number(body.currentCrpMgL) : undefined,
      currentTemperatureCelsius: body.currentTemperatureCelsius !== undefined ? Number(body.currentTemperatureCelsius) : undefined,
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-osteomyelitis/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_osteomyelitis_episodes e
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
  app.get('/api/pediatric-osteomyelitis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_osteomyelitis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(Number(id)) as any;

    if (!episode) throw notFound('Pediatric osteomyelitis episode not found');

    const flowsheetLogs = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_osteomyelitis_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.osteomyelitis_episode_id = ?
      ORDER BY l.day_of_therapy ASC, l.id ASC
    `).all(Number(id));

    const latestLog = flowsheetLogs.length > 0 ? (flowsheetLogs[flowsheetLogs.length - 1] as any) : null;

    const evaluation = evaluatePediatricOsteomyelitis({
      ageYears: episode.age_years,
      weightKg: episode.weight_kg,
      boneInvolved: episode.bone_involved,
      laterality: episode.laterality,
      kocherFeverGt385: Boolean(episode.kocher_fever_gt_38_5),
      kocherNonWeightBearing: Boolean(episode.kocher_non_weight_bearing),
      kocherEsrGt40: Boolean(episode.kocher_esr_gt_40),
      kocherWbcGt12k: Boolean(episode.kocher_wbc_gt_12k),
      crpAdmissionMgL: episode.crp_admission_mg_l,
      crpPeakMgL: episode.crp_peak_mg_l,
      subperiostealAbscessPresent: Boolean(episode.subperiosteal_abscess_present),
      abscessSizeDepthMm: episode.abscess_size_depth_mm,
      imagingModalityConfirmatory: episode.imaging_modality_confirmatory,
      surgicalDecompressionPerformed: Boolean(episode.surgical_decompression_performed),
      surgicalProcedure: episode.surgical_procedure,
      isolatedPathogen: episode.isolated_pathogen,
      currentAntibioticRegimen: episode.current_antibiotic_regimen,
      oralSwitchCriteriaMet: Boolean(episode.oral_switch_criteria_met),
      currentCrpMgL: latestLog ? latestLog.crp_level_mg_l : episode.crp_admission_mg_l,
      currentTemperatureCelsius: latestLog ? latestLog.temperature_celsius : undefined,
    });

    return { episode, flowsheetLogs, evaluation };
  });

  // 4. Create Episode
  app.post('/api/pediatric-osteomyelitis/episodes', async (req) => {
    const user = assertCanManageOsteo(req);
    const data = parse(osteoEpisodeSchema, req.body);

    const count = (db.prepare(`SELECT COUNT(*) as c FROM pediatric_osteomyelitis_episodes`).get() as any).c;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const episodeCode = `OSTEO-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO pediatric_osteomyelitis_episodes (
        patient_id, admission_id, episode_code, onset_datetime, age_years, weight_kg,
        bone_involved, laterality, kocher_fever_gt_38_5, kocher_non_weight_bearing,
        kocher_esr_gt_40, kocher_wbc_gt_12k, crp_admission_mg_l, crp_peak_mg_l,
        subperiosteal_abscess_present, abscess_size_depth_mm, imaging_modality_confirmatory,
        surgical_decompression_performed, surgical_procedure, isolated_pathogen,
        current_antibiotic_regimen, oral_switch_criteria_met,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
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
      data.weightKg,
      data.boneInvolved,
      data.laterality,
      data.kocherFeverGt385 ? 1 : 0,
      data.kocherNonWeightBearing ? 1 : 0,
      data.kocherEsrGt40 ? 1 : 0,
      data.kocherWbcGt12k ? 1 : 0,
      data.crpAdmissionMgL,
      data.crpPeakMgL,
      data.subperiostealAbscessPresent ? 1 : 0,
      data.abscessSizeDepthMm,
      data.imagingModalityConfirmatory,
      data.surgicalDecompressionPerformed ? 1 : 0,
      data.surgicalProcedure,
      data.isolatedPathogen,
      data.currentAntibioticRegimen,
      data.oralSwitchCriteriaMet ? 1 : 0,
      data.status,
      user.id,
      data.clinicalNotes || null
    );

    const newId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_osteomyelitis.create',
      entity: 'pediatric_osteomyelitis_episodes',
      entityId: newId,
      detail: { episodeId: newId, episodeCode, patientId: data.patientId },
    });

    const episode = db.prepare(`SELECT * FROM pediatric_osteomyelitis_episodes WHERE id = ?`).get(newId);
    return { episode };
  });

  // 5. Update Episode
  app.put('/api/pediatric-osteomyelitis/episodes/:id', async (req) => {
    const user = assertCanManageOsteo(req);
    const { id } = req.params as { id: string };
    const data = parse(osteoEpisodeSchema, req.body);

    const existing = db.prepare(`SELECT * FROM pediatric_osteomyelitis_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Pediatric osteomyelitis episode not found');

    db.prepare(`
      UPDATE pediatric_osteomyelitis_episodes SET
        patient_id = ?, admission_id = ?, onset_datetime = ?, age_years = ?, weight_kg = ?,
        bone_involved = ?, laterality = ?, kocher_fever_gt_38_5 = ?, kocher_non_weight_bearing = ?,
        kocher_esr_gt_40 = ?, kocher_wbc_gt_12k = ?, crp_admission_mg_l = ?, crp_peak_mg_l = ?,
        subperiosteal_abscess_present = ?, abscess_size_depth_mm = ?, imaging_modality_confirmatory = ?,
        surgical_decompression_performed = ?, surgical_procedure = ?, isolated_pathogen = ?,
        current_antibiotic_regimen = ?, oral_switch_criteria_met = ?,
        status = ?, clinical_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.patientId,
      data.admissionId || null,
      data.onsetDatetime,
      data.ageYears,
      data.weightKg,
      data.boneInvolved,
      data.laterality,
      data.kocherFeverGt385 ? 1 : 0,
      data.kocherNonWeightBearing ? 1 : 0,
      data.kocherEsrGt40 ? 1 : 0,
      data.kocherWbcGt12k ? 1 : 0,
      data.crpAdmissionMgL,
      data.crpPeakMgL,
      data.subperiostealAbscessPresent ? 1 : 0,
      data.abscessSizeDepthMm,
      data.imagingModalityConfirmatory,
      data.surgicalDecompressionPerformed ? 1 : 0,
      data.surgicalProcedure,
      data.isolatedPathogen,
      data.currentAntibioticRegimen,
      data.oralSwitchCriteriaMet ? 1 : 0,
      data.status,
      data.clinicalNotes || null,
      Number(id)
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_osteomyelitis.update',
      entity: 'pediatric_osteomyelitis_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    const episode = db.prepare(`SELECT * FROM pediatric_osteomyelitis_episodes WHERE id = ?`).get(Number(id));
    return { episode };
  });

  // 6. Update Status
  app.patch('/api/pediatric-osteomyelitis/episodes/:id/status', async (req) => {
    const user = assertCanManageOsteo(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const existing = db.prepare(`SELECT * FROM pediatric_osteomyelitis_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Pediatric osteomyelitis episode not found');

    db.prepare(`
      UPDATE pediatric_osteomyelitis_episodes
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_osteomyelitis.status_update',
      entity: 'pediatric_osteomyelitis_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id), status },
    });

    return { ok: true, status };
  });

  // 7. Delete Episode
  app.delete('/api/pediatric-osteomyelitis/episodes/:id', async (req) => {
    const user = assertCanManageOsteo(req);
    const { id } = req.params as { id: string };

    const existing = db.prepare(`SELECT * FROM pediatric_osteomyelitis_episodes WHERE id = ?`).get(Number(id));
    if (!existing) throw notFound('Pediatric osteomyelitis episode not found');

    db.prepare(`DELETE FROM pediatric_osteomyelitis_episodes WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_osteomyelitis.delete',
      entity: 'pediatric_osteomyelitis_episodes',
      entityId: Number(id),
      detail: { episodeId: Number(id) },
    });

    return { ok: true };
  });

  // 8. Add Flowsheet Log
  app.post('/api/pediatric-osteomyelitis/episodes/:id/flowsheet', async (req) => {
    const user = assertCanManageOsteo(req);
    const { id } = req.params as { id: string };
    const data = parse(osteoFlowsheetSchema, req.body);

    const episode = db.prepare(`SELECT * FROM pediatric_osteomyelitis_episodes WHERE id = ?`).get(Number(id)) as any;
    if (!episode) throw notFound('Pediatric osteomyelitis episode not found');

    const result = db.prepare(`
      INSERT INTO pediatric_osteomyelitis_flowsheet_logs (
        osteomyelitis_episode_id, patient_id, log_datetime, day_of_therapy,
        temperature_celsius, crp_level_mg_l, esr_mm_hr, pain_score_flacc_or_vas,
        weight_bearing_status, local_signs, route_of_administration, notes, logged_by_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(
      Number(id),
      episode.patient_id,
      data.logDatetime,
      data.dayOfTherapy,
      data.temperatureCelsius,
      data.crpLevelMgL,
      data.esrMmHr || null,
      data.painScoreFlaccOrVas,
      data.weightBearingStatus,
      data.localSigns,
      data.routeOfAdministration,
      data.notes || null,
      user.id
    );

    // If new CRP peak observed, update peak
    if (data.crpLevelMgL > episode.crp_peak_mg_l) {
      db.prepare(`
        UPDATE pediatric_osteomyelitis_episodes
        SET crp_peak_mg_l = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(data.crpLevelMgL, Number(id));
    }

    const logId = Number(result.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_osteomyelitis.flowsheet_add',
      entity: 'pediatric_osteomyelitis_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), logId, crp: data.crpLevelMgL },
    });

    const flowsheetLog = db.prepare(`SELECT * FROM pediatric_osteomyelitis_flowsheet_logs WHERE id = ?`).get(logId);
    return { flowsheetLog };
  });

  // 9. Delete Flowsheet Log
  app.delete('/api/pediatric-osteomyelitis/flowsheet/:id', async (req) => {
    const user = assertCanManageOsteo(req);
    const { id } = req.params as { id: string };

    const log = db.prepare(`SELECT * FROM pediatric_osteomyelitis_flowsheet_logs WHERE id = ?`).get(Number(id)) as any;
    if (!log) throw notFound('Flowsheet log not found');

    db.prepare(`DELETE FROM pediatric_osteomyelitis_flowsheet_logs WHERE id = ?`).run(Number(id));

    audit(db, {
      actorId: user.id,
      action: 'pediatric_osteomyelitis.flowsheet_delete',
      entity: 'pediatric_osteomyelitis_flowsheet_logs',
      entityId: Number(id),
      detail: { logId: Number(id), episodeId: log.osteomyelitis_episode_id },
    });

    return { ok: true };
  });
}
