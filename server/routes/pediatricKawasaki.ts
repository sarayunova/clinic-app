import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricKawasaki,
} from '../../web/src/pediatricKawasakiEngine.js';

function assertCanManageKawasaki(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric Kawasaki protocols');
  }
  return user;
}

const kawasakiEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  presentationDatetime: z.string().min(1),
  ageMonths: z.coerce.number().min(0).max(240),
  weightKg: z.coerce.number().min(1.0).max(100.0),
  feverDurationDays: z.coerce.number().min(1).max(60),
  conjunctivitisBilateralBulbar: z.boolean().default(true),
  oralMucosalChanges: z.boolean().default(true),
  polymorphousExanthemRash: z.boolean().default(true),
  peripheralExtremityChanges: z.boolean().default(true),
  cervicalLymphadenopathyGe15cm: z.boolean().default(false),
  bcgScarErythema: z.boolean().default(false),
  perinealErythemaDesquamation: z.boolean().default(false),
  crpMgL: z.coerce.number().min(0).max(500).default(50.0),
  esrMmHr: z.coerce.number().min(0).max(200).default(60.0),
  serumAlbuminGDl: z.coerce.number().min(0.5).max(7.0).optional().nullable(),
  serumSodiumMeqL: z.coerce.number().min(100).max(160).optional().nullable(),
  plateletCount: z.coerce.number().min(0).max(2000000).optional().nullable(),
  wbcCount: z.coerce.number().min(0).max(100000).optional().nullable(),
  altUL: z.coerce.number().min(0).max(2000).optional().nullable(),
  neutrophilPct: z.coerce.number().min(0).max(100).optional().nullable(),
  sterilePyuriaPresent: z.boolean().default(false),
  ivigAdministered: z.boolean().default(true),
  ivigDoseGKg: z.coerce.number().min(0.5).max(4.0).default(2.0),
  aspirinDoseMgKgDay: z.coerce.number().min(0).max(100).default(40.0),
  echoPerformed: z.boolean().default(true),
  ladZScore: z.coerce.number().min(-5).max(30).optional().nullable(),
  rcaZScore: z.coerce.number().min(-5).max(30).optional().nullable(),
  status: z.enum([
    'active_diagnostic_workup',
    'ivig_infusion_in_progress',
    'afebrile_post_ivig_monitoring',
    'ivig_resistant_retreatment',
    'resolved_discharged',
  ]).default('active_diagnostic_workup'),
  clinicalNotes: z.string().optional().nullable(),
});

const kawasakiFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  hoursFromAdmission: z.coerce.number().min(0).max(720),
  temperatureCelsius: z.coerce.number().min(30).max(45),
  heartRate: z.coerce.number().min(30).max(250),
  bloodPressureSys: z.coerce.number().min(30).max(200).optional().nullable(),
  bloodPressureDia: z.coerce.number().min(20).max(150).optional().nullable(),
  ivigInfusionRunning: z.boolean().default(false),
  aspirinDoseGivenMg: z.coerce.number().min(0).max(2000).optional().nullable(),
  rashAppearance: z.string().optional().nullable(),
  extremityEdema: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function registerPediatricKawasakiRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate
  app.post('/api/pediatric-kawasaki/evaluate', async (req) => {
    assertCanManageKawasaki(req);
    const body = req.body as any;

    const evaluation = evaluatePediatricKawasaki({
      ageMonths: Number(body.ageMonths || 24),
      weightKg: Number(body.weightKg || 12.0),
      feverDurationDays: Number(body.feverDurationDays || 6),
      conjunctivitisBilateralBulbar: body.conjunctivitisBilateralBulbar !== undefined ? Boolean(body.conjunctivitisBilateralBulbar) : true,
      oralMucosalChanges: body.oralMucosalChanges !== undefined ? Boolean(body.oralMucosalChanges) : true,
      polymorphousExanthemRash: body.polymorphousExanthemRash !== undefined ? Boolean(body.polymorphousExanthemRash) : true,
      peripheralExtremityChanges: body.peripheralExtremityChanges !== undefined ? Boolean(body.peripheralExtremityChanges) : true,
      cervicalLymphadenopathyGe15cm: Boolean(body.cervicalLymphadenopathyGe15cm),
      bcgScarErythema: Boolean(body.bcgScarErythema),
      perinealErythemaDesquamation: Boolean(body.perinealErythemaDesquamation),
      crpMgL: Number(body.crpMgL || 65.0),
      esrMmHr: Number(body.esrMmHr || 75.0),
      serumAlbuminGDl: body.serumAlbuminGDl ? Number(body.serumAlbuminGDl) : undefined,
      serumSodiumMeqL: body.serumSodiumMeqL ? Number(body.serumSodiumMeqL) : undefined,
      plateletCount: body.plateletCount ? Number(body.plateletCount) : undefined,
      wbcCount: body.wbcCount ? Number(body.wbcCount) : undefined,
      altUL: body.altUL ? Number(body.altUL) : undefined,
      neutrophilPct: body.neutrophilPct ? Number(body.neutrophilPct) : undefined,
      sterilePyuriaPresent: Boolean(body.sterilePyuriaPresent),
      echoPerformed: body.echoPerformed !== undefined ? Boolean(body.echoPerformed) : true,
      ladZScore: body.ladZScore ? Number(body.ladZScore) : undefined,
      rcaZScore: body.rcaZScore ? Number(body.rcaZScore) : undefined,
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-kawasaki/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_kawasaki_episodes e
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
        conjunctivitis_bilateral_bulbar: Boolean(r.conjunctivitis_bilateral_bulbar),
        oral_mucosal_changes: Boolean(r.oral_mucosal_changes),
        polymorphous_exanthem_rash: Boolean(r.polymorphous_exanthem_rash),
        peripheral_extremity_changes: Boolean(r.peripheral_extremity_changes),
        cervical_lymphadenopathy_ge_1_5cm: Boolean(r.cervical_lymphadenopathy_ge_1_5cm),
        bcg_scar_erythema: Boolean(r.bcg_scar_erythema),
        perineal_erythema_desquamation: Boolean(r.perineal_erythema_desquamation),
        sterile_pyuria_present: Boolean(r.sterile_pyuria_present),
        ivig_administered: Boolean(r.ivig_administered),
        echo_performed: Boolean(r.echo_performed),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/pediatric-kawasaki/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_kawasaki_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Pediatric Kawasaki episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_kawasaki_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.kawasaki_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const evaluation = evaluatePediatricKawasaki({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      feverDurationDays: episode.fever_duration_days,
      conjunctivitisBilateralBulbar: Boolean(episode.conjunctivitis_bilateral_bulbar),
      oralMucosalChanges: Boolean(episode.oral_mucosal_changes),
      polymorphousExanthemRash: Boolean(episode.polymorphous_exanthem_rash),
      peripheralExtremityChanges: Boolean(episode.peripheral_extremity_changes),
      cervicalLymphadenopathyGe15cm: Boolean(episode.cervical_lymphadenopathy_ge_1_5cm),
      bcgScarErythema: Boolean(episode.bcg_scar_erythema),
      perinealErythemaDesquamation: Boolean(episode.perineal_erythema_desquamation),
      crpMgL: episode.crp_mg_l,
      esrMmHr: episode.esr_mm_hr,
      serumAlbuminGDl: episode.serum_albumin_g_dl ?? undefined,
      serumSodiumMeqL: episode.serum_sodium_meq_l ?? undefined,
      plateletCount: episode.platelet_count ?? undefined,
      wbcCount: episode.wbc_count ?? undefined,
      altUL: episode.alt_u_l ?? undefined,
      neutrophilPct: episode.neutrophil_pct ?? undefined,
      sterilePyuriaPresent: Boolean(episode.sterile_pyuria_present),
      echoPerformed: Boolean(episode.echo_performed),
      ladZScore: episode.lad_z_score ?? undefined,
      rcaZScore: episode.rca_z_score ?? undefined,
    });

    return {
      episode: {
        ...episode,
        conjunctivitis_bilateral_bulbar: Boolean(episode.conjunctivitis_bilateral_bulbar),
        oral_mucosal_changes: Boolean(episode.oral_mucosal_changes),
        polymorphous_exanthem_rash: Boolean(episode.polymorphous_exanthem_rash),
        peripheral_extremity_changes: Boolean(episode.peripheral_extremity_changes),
        cervical_lymphadenopathy_ge_1_5cm: Boolean(episode.cervical_lymphadenopathy_ge_1_5cm),
        bcg_scar_erythema: Boolean(episode.bcg_scar_erythema),
        perineal_erythema_desquamation: Boolean(episode.perineal_erythema_desquamation),
        sterile_pyuria_present: Boolean(episode.sterile_pyuria_present),
        ivig_administered: Boolean(episode.ivig_administered),
        echo_performed: Boolean(episode.echo_performed),
      },
      evaluation,
      flowsheet: flowsheet.map(f => ({
        ...f,
        ivig_infusion_running: Boolean(f.ivig_infusion_running),
      })),
    };
  });

  // 4. Create Episode
  app.post('/api/pediatric-kawasaki/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageKawasaki(req);
    const data = parse(kawasakiEpisodeSchema, req.body);

    const evaluation = evaluatePediatricKawasaki({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      feverDurationDays: data.feverDurationDays,
      conjunctivitisBilateralBulbar: data.conjunctivitisBilateralBulbar,
      oralMucosalChanges: data.oralMucosalChanges,
      polymorphousExanthemRash: data.polymorphousExanthemRash,
      peripheralExtremityChanges: data.peripheralExtremityChanges,
      cervicalLymphadenopathyGe15cm: data.cervicalLymphadenopathyGe15cm,
      bcgScarErythema: data.bcgScarErythema,
      perinealErythemaDesquamation: data.perinealErythemaDesquamation,
      crpMgL: data.crpMgL,
      esrMmHr: data.esrMmHr,
      serumAlbuminGDl: data.serumAlbuminGDl ?? undefined,
      serumSodiumMeqL: data.serumSodiumMeqL ?? undefined,
      plateletCount: data.plateletCount ?? undefined,
      wbcCount: data.wbcCount ?? undefined,
      altUL: data.altUL ?? undefined,
      neutrophilPct: data.neutrophilPct ?? undefined,
      sterilePyuriaPresent: data.sterilePyuriaPresent,
      echoPerformed: data.echoPerformed,
      ladZScore: data.ladZScore ?? undefined,
      rcaZScore: data.rcaZScore ?? undefined,
    });

    const dateStr = data.presentationDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `KAW-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO pediatric_kawasaki_episodes (
        patient_id, admission_id, episode_code, presentation_datetime,
        age_months, weight_kg, fever_duration_days,
        conjunctivitis_bilateral_bulbar, oral_mucosal_changes, polymorphous_exanthem_rash,
        peripheral_extremity_changes, cervical_lymphadenopathy_ge_1_5cm, bcg_scar_erythema,
        perineal_erythema_desquamation, principal_criteria_count, diagnosis_classification,
        crp_mg_l, esr_mm_hr, serum_albumin_g_dl, serum_sodium_meq_l,
        platelet_count, wbc_count, alt_u_l, neutrophil_pct, sterile_pyuria_present,
        kobayashi_score, ivig_resistance_risk, ivig_administered,
        ivig_dose_g_kg, aspirin_dose_mg_kg_day, echo_performed,
        lad_z_score, rca_z_score, coronary_aneurysm_classification,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.presentationDatetime,
      data.ageMonths,
      data.weightKg,
      data.feverDurationDays,
      data.conjunctivitisBilateralBulbar ? 1 : 0,
      data.oralMucosalChanges ? 1 : 0,
      data.polymorphousExanthemRash ? 1 : 0,
      data.peripheralExtremityChanges ? 1 : 0,
      data.cervicalLymphadenopathyGe15cm ? 1 : 0,
      data.bcgScarErythema ? 1 : 0,
      data.perinealErythemaDesquamation ? 1 : 0,
      evaluation.principalCriteriaCount,
      evaluation.diagnosisClassification,
      data.crpMgL,
      data.esrMmHr,
      data.serumAlbuminGDl ?? null,
      data.serumSodiumMeqL ?? null,
      data.plateletCount ?? null,
      data.wbcCount ?? null,
      data.altUL ?? null,
      data.neutrophilPct ?? null,
      data.sterilePyuriaPresent ? 1 : 0,
      evaluation.kobayashiScore,
      evaluation.ivigResistanceRisk,
      data.ivigAdministered ? 1 : 0,
      data.ivigDoseGKg,
      data.aspirinDoseMgKgDay,
      data.echoPerformed ? 1 : 0,
      data.ladZScore ?? null,
      data.rcaZScore ?? null,
      evaluation.coronaryAneurysmClassification,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_kawasaki.create',
      entity: 'pediatric_kawasaki_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, classification: evaluation.diagnosisClassification, kobayashi: evaluation.kobayashiScore },
    });

    reply.status(201);
    return { episodeId, episodeCode, evaluation, success: true };
  });

  // 5. Update Status
  app.patch('/api/pediatric-kawasaki/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManageKawasaki(req);
    const { id } = req.params as { id: string };
    const {
      status,
      ivigAdministered,
      ladZScore,
      rcaZScore,
      coronaryAneurysmClassification,
      clinicalNotes,
    } = req.body as any;

    const validStatuses = [
      'active_diagnostic_workup',
      'ivig_infusion_in_progress',
      'afebrile_post_ivig_monitoring',
      'ivig_resistant_retreatment',
      'resolved_discharged',
    ];
    if (status && !validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE pediatric_kawasaki_episodes
      SET status = COALESCE(?, status),
          ivig_administered = CASE WHEN ? IS NOT NULL THEN ? ELSE ivig_administered END,
          lad_z_score = COALESCE(?, lad_z_score),
          rca_z_score = COALESCE(?, rca_z_score),
          coronary_aneurysm_classification = COALESCE(?, coronary_aneurysm_classification),
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status ?? null,
      ivigAdministered !== undefined ? (ivigAdministered ? 1 : 0) : null,
      ivigAdministered !== undefined ? (ivigAdministered ? 1 : 0) : null,
      ladZScore ?? null,
      rcaZScore ?? null,
      coronaryAneurysmClassification ?? null,
      clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_kawasaki.status_update',
      entity: 'pediatric_kawasaki_episodes',
      entityId: Number(id),
      detail: { status, ivigAdministered },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/pediatric-kawasaki/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_kawasaki_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.kawasaki_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return {
      logs: rows.map(r => ({
        ...r,
        ivig_infusion_running: Boolean(r.ivig_infusion_running),
      })),
    };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-kawasaki/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManageKawasaki(req);
    const { id } = req.params as { id: string };
    const data = parse(kawasakiFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM pediatric_kawasaki_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric Kawasaki episode not found');

    const res = db.prepare(`
      INSERT INTO pediatric_kawasaki_flowsheet_logs (
        kawasaki_episode_id, patient_id, log_datetime,
        hours_from_admission, temperature_celsius, heart_rate,
        blood_pressure_sys, blood_pressure_dia, ivig_infusion_running,
        aspirin_dose_given_mg, rash_appearance, extremity_edema,
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
      data.hoursFromAdmission,
      data.temperatureCelsius,
      data.heartRate,
      data.bloodPressureSys ?? null,
      data.bloodPressureDia ?? null,
      data.ivigInfusionRunning ? 1 : 0,
      data.aspirinDoseGivenMg ?? null,
      data.rashAppearance ?? null,
      data.extremityEdema ?? null,
      data.notes ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_kawasaki.flowsheet_add',
      entity: 'pediatric_kawasaki_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), temp: data.temperatureCelsius, hr: data.heartRate },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-kawasaki/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManageKawasaki(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM pediatric_kawasaki_flowsheet_logs
      WHERE id = ? AND kawasaki_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_kawasaki_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_kawasaki.flowsheet_delete',
      entity: 'pediatric_kawasaki_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
