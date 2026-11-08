import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { forbidden, notFound, parse } from '../errors.js';
import { audit } from '../audit.js';
import {
  evaluatePediatricBacterialMeningitis,
  calculateNigrovicBmsScore,
} from '../../web/src/pediatricBacterialMeningitisEngine.js';

function assertCanManagePediatricMeningitis(req: FastifyRequest) {
  const user = req.user;
  if (!user) throw forbidden('Not authenticated');
  if (user.role !== 'doctor' && user.role !== 'nurse') {
    throw forbidden('Only doctors and nurses can manage pediatric meningitis protocols');
  }
  return user;
}

const pediatricMeningitisEpisodeSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  triageDatetime: z.string().min(1),
  ageMonths: z.coerce.number().min(0).max(240),
  weightKg: z.coerce.number().min(1.0).max(120.0),
  priorAntibioticExposure72h: z.boolean().default(false),
  seizureAtPresentation: z.boolean().default(false),
  gcsScore: z.coerce.number().min(3).max(15),
  kernigBrudzinskiSign: z.boolean().default(false),
  fontanelleBulging: z.boolean().default(false),
  purpuricRash: z.boolean().default(false),
  csfWbcCount: z.coerce.number().min(0).max(50000),
  csfNeutrophilPercent: z.coerce.number().min(0).max(100),
  csfProteinMgDl: z.coerce.number().min(0).max(2000),
  csfGlucoseMgDl: z.coerce.number().min(0).max(500),
  bloodGlucoseMgDl: z.coerce.number().min(10).max(1000),
  csfGramStainPositive: z.boolean().default(false),
  csfGramStainOrganism: z.enum([
    'none_seen',
    'gram_positive_cocci_pairs',
    'gram_negative_diplococci',
    'gram_negative_bacilli',
    'other',
  ]).default('none_seen'),
  peripheralWbc: z.coerce.number().min(0.5).max(100.0),
  peripheralAnc: z.coerce.number().min(0).max(80000),
  empiricCeftriaxoneOrdered: z.boolean().default(false),
  empiricVancomycinOrdered: z.boolean().default(false),
  dexamethasoneGivenPreAntibiotic: z.boolean().default(false),
  isolationPrecautions: z.enum(['droplet_precautions', 'standard']).default('droplet_precautions'),
  status: z.enum([
    'active_triage',
    'picu_critical_care',
    'ward_antimicrobial_therapy',
    'aseptic_meningitis_weaning',
    'resolved_discharged',
  ]).default('active_triage'),
  clinicalNotes: z.string().optional().nullable(),
});

const meningitisFlowsheetSchema = z.object({
  logDatetime: z.string().min(1),
  gcsScore: z.coerce.number().min(3).max(15),
  pupilReactivity: z.enum(['brisk_bilateral', 'sluggish', 'unequal_fixed']),
  heartRate: z.coerce.number().min(30).max(250),
  bloodPressureSys: z.coerce.number().min(40).max(220),
  bloodPressureDia: z.coerce.number().min(20).max(140),
  temperatureCelsius: z.coerce.number().min(33.0).max(43.0),
  respiratoryRate: z.coerce.number().min(10).max(100),
  seizureActivityObserved: z.boolean().default(false),
  neurologicalNotes: z.string().optional().nullable(),
  antibioticDoseAdministered: z.string().optional().nullable(),
});

export function registerPediatricBacterialMeningitisRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // 1. Preview / Evaluate Meningitis algorithm
  app.post('/api/pediatric-bacterial-meningitis/evaluate', async (req) => {
    assertCanManagePediatricMeningitis(req);
    const body = req.body as any;

    const evaluation = evaluatePediatricBacterialMeningitis({
      ageMonths: Number(body.ageMonths || 24),
      weightKg: Number(body.weightKg || 12),
      priorAntibioticExposure72h: Boolean(body.priorAntibioticExposure72h),
      seizureAtPresentation: Boolean(body.seizureAtPresentation),
      gcsScore: Number(body.gcsScore || 15),
      kernigBrudzinskiSign: Boolean(body.kernigBrudzinskiSign),
      fontanelleBulging: Boolean(body.fontanelleBulging),
      purpuricRash: Boolean(body.purpuricRash),
      csfWbcCount: Number(body.csfWbcCount || 150),
      csfNeutrophilPercent: Number(body.csfNeutrophilPercent || 75),
      csfProteinMgDl: Number(body.csfProteinMgDl || 95),
      csfGlucoseMgDl: Number(body.csfGlucoseMgDl || 30),
      bloodGlucoseMgDl: Number(body.bloodGlucoseMgDl || 100),
      csfGramStainPositive: Boolean(body.csfGramStainPositive),
      csfGramStainOrganism: body.csfGramStainOrganism || 'none_seen',
      peripheralWbc: Number(body.peripheralWbc || 15.0),
      peripheralAnc: Number(body.peripheralAnc || 11500),
    });

    return { evaluation };
  });

  // 2. List Episodes
  app.get('/api/pediatric-bacterial-meningitis/episodes', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { patientId } = req.query as { patientId?: string };

    let query = `
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_bacterial_meningitis_episodes e
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
        prior_antibiotic_exposure_72h: Boolean(r.prior_antibiotic_exposure_72h),
        seizure_at_presentation: Boolean(r.seizure_at_presentation),
        kernig_brudzinski_sign: Boolean(r.kernig_brudzinski_sign),
        fontanelle_bulging: Boolean(r.fontanelle_bulging),
        purpuric_rash: Boolean(r.purpuric_rash),
        csf_gram_stain_positive: Boolean(r.csf_gram_stain_positive),
        empiric_ceftriaxone_ordered: Boolean(r.empiric_ceftriaxone_ordered),
        empiric_vancomycin_ordered: Boolean(r.empiric_vancomycin_ordered),
        dexamethasone_given_pre_antibiotic: Boolean(r.dexamethasone_given_pre_antibiotic),
      })),
    };
  });

  // 3. Get Episode Details with Flowsheet Logs & Calculation
  app.get('/api/pediatric-bacterial-meningitis/episodes/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const episode = db.prepare(`
      SELECT e.*,
             p.full_name as patient_name, p.date_of_birth,
             u.full_name as consultant_name
      FROM pediatric_bacterial_meningitis_episodes e
      JOIN patients p ON e.patient_id = p.id
      JOIN users u ON e.consultant_id = u.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!episode) throw notFound('Pediatric bacterial meningitis episode not found');

    const flowsheet = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_bacterial_meningitis_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.meningitis_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    const evaluation = evaluatePediatricBacterialMeningitis({
      ageMonths: episode.age_months,
      weightKg: episode.weight_kg,
      priorAntibioticExposure72h: Boolean(episode.prior_antibiotic_exposure_72h),
      seizureAtPresentation: Boolean(episode.seizure_at_presentation),
      gcsScore: episode.gcs_score,
      kernigBrudzinskiSign: Boolean(episode.kernig_brudzinski_sign),
      fontanelleBulging: Boolean(episode.fontanelle_bulging),
      purpuricRash: Boolean(episode.purpuric_rash),
      csfWbcCount: episode.csf_wbc_count,
      csfNeutrophilPercent: episode.csf_neutrophil_percent,
      csfProteinMgDl: episode.csf_protein_mg_dl,
      csfGlucoseMgDl: episode.csf_glucose_mg_dl,
      bloodGlucoseMgDl: episode.blood_glucose_mg_dl,
      csfGramStainPositive: Boolean(episode.csf_gram_stain_positive),
      csfGramStainOrganism: episode.csf_gram_stain_organism,
      peripheralWbc: episode.peripheral_wbc,
      peripheralAnc: episode.peripheral_anc,
    });

    return {
      episode: {
        ...episode,
        prior_antibiotic_exposure_72h: Boolean(episode.prior_antibiotic_exposure_72h),
        seizure_at_presentation: Boolean(episode.seizure_at_presentation),
        kernig_brudzinski_sign: Boolean(episode.kernig_brudzinski_sign),
        fontanelle_bulging: Boolean(episode.fontanelle_bulging),
        purpuric_rash: Boolean(episode.purpuric_rash),
        csf_gram_stain_positive: Boolean(episode.csf_gram_stain_positive),
        empiric_ceftriaxone_ordered: Boolean(episode.empiric_ceftriaxone_ordered),
        empiric_vancomycin_ordered: Boolean(episode.empiric_vancomycin_ordered),
        dexamethasone_given_pre_antibiotic: Boolean(episode.dexamethasone_given_pre_antibiotic),
      },
      evaluation,
      flowsheet: flowsheet.map(f => ({
        ...f,
        seizure_activity_observed: Boolean(f.seizure_activity_observed),
      })),
    };
  });

  // 4. Create Episode
  app.post('/api/pediatric-bacterial-meningitis/episodes', async (req, reply) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManagePediatricMeningitis(req);
    const data = parse(pediatricMeningitisEpisodeSchema, req.body);

    const evaluation = evaluatePediatricBacterialMeningitis({
      ageMonths: data.ageMonths,
      weightKg: data.weightKg,
      priorAntibioticExposure72h: data.priorAntibioticExposure72h,
      seizureAtPresentation: data.seizureAtPresentation,
      gcsScore: data.gcsScore,
      kernigBrudzinskiSign: data.kernigBrudzinskiSign,
      fontanelleBulging: data.fontanelleBulging,
      purpuricRash: data.purpuricRash,
      csfWbcCount: data.csfWbcCount,
      csfNeutrophilPercent: data.csfNeutrophilPercent,
      csfProteinMgDl: data.csfProteinMgDl,
      csfGlucoseMgDl: data.csfGlucoseMgDl,
      bloodGlucoseMgDl: data.bloodGlucoseMgDl,
      csfGramStainPositive: data.csfGramStainPositive,
      csfGramStainOrganism: data.csfGramStainOrganism,
      peripheralWbc: data.peripheralWbc,
      peripheralAnc: data.peripheralAnc,
    });

    const dateStr = data.triageDatetime.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const episodeCode = `MEN-${dateStr}-${rand}`;

    const res = db.prepare(`
      INSERT INTO pediatric_bacterial_meningitis_episodes (
        patient_id, admission_id, episode_code, triage_datetime,
        age_months, weight_kg, prior_antibiotic_exposure_72h,
        seizure_at_presentation, gcs_score, kernig_brudzinski_sign,
        fontanelle_bulging, purpuric_rash, csf_wbc_count,
        csf_neutrophil_percent, csf_anc_calculated, csf_protein_mg_dl,
        csf_glucose_mg_dl, blood_glucose_mg_dl, csf_to_blood_glucose_ratio,
        csf_gram_stain_positive, csf_gram_stain_organism,
        peripheral_wbc, peripheral_anc, bms_score, risk_tier,
        empiric_ceftriaxone_ordered, empiric_vancomycin_ordered,
        dexamethasone_given_pre_antibiotic, isolation_precautions,
        status, consultant_id, clinical_notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )
    `).run(
      data.patientId,
      data.admissionId ?? null,
      episodeCode,
      data.triageDatetime,
      data.ageMonths,
      data.weightKg,
      data.priorAntibioticExposure72h ? 1 : 0,
      data.seizureAtPresentation ? 1 : 0,
      data.gcsScore,
      data.kernigBrudzinskiSign ? 1 : 0,
      data.fontanelleBulging ? 1 : 0,
      data.purpuricRash ? 1 : 0,
      data.csfWbcCount,
      data.csfNeutrophilPercent,
      evaluation.csfAncCalculated,
      data.csfProteinMgDl,
      data.csfGlucoseMgDl,
      data.bloodGlucoseMgDl,
      evaluation.csfToBloodGlucoseRatio,
      data.csfGramStainPositive ? 1 : 0,
      data.csfGramStainOrganism,
      data.peripheralWbc,
      data.peripheralAnc,
      evaluation.bmsBreakdown.totalBmsScore,
      evaluation.riskTier,
      data.empiricCeftriaxoneOrdered ? 1 : 0,
      data.empiricVancomycinOrdered ? 1 : 0,
      data.dexamethasoneGivenPreAntibiotic ? 1 : 0,
      data.isolationPrecautions,
      data.status,
      user.id,
      data.clinicalNotes ?? null,
    );

    const episodeId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_meningitis.create',
      entity: 'pediatric_bacterial_meningitis_episodes',
      entityId: episodeId,
      detail: { patientId: data.patientId, episodeCode, bmsScore: evaluation.bmsBreakdown.totalBmsScore, riskTier: evaluation.riskTier },
    });

    reply.status(201);
    return { episodeId, episodeCode, evaluation, success: true };
  });

  // 5. Update Status & Treatment
  app.patch('/api/pediatric-bacterial-meningitis/episodes/:id/status', async (req) => {
    requirePerm(req, 'patient:write_clinical');
    const user = assertCanManagePediatricMeningitis(req);
    const { id } = req.params as { id: string };
    const {
      status,
      empiricCeftriaxoneOrdered,
      empiricVancomycinOrdered,
      dexamethasoneGivenPreAntibiotic,
      clinicalNotes,
    } = req.body as any;

    const validStatuses = [
      'active_triage',
      'picu_critical_care',
      'ward_antimicrobial_therapy',
      'aseptic_meningitis_weaning',
      'resolved_discharged',
    ];
    if (status && !validStatuses.includes(status)) {
      throw forbidden('Invalid status update value');
    }

    db.prepare(`
      UPDATE pediatric_bacterial_meningitis_episodes
      SET status = COALESCE(?, status),
          empiric_ceftriaxone_ordered = CASE WHEN ? IS NOT NULL THEN ? ELSE empiric_ceftriaxone_ordered END,
          empiric_vancomycin_ordered = CASE WHEN ? IS NOT NULL THEN ? ELSE empiric_vancomycin_ordered END,
          dexamethasone_given_pre_antibiotic = CASE WHEN ? IS NOT NULL THEN ? ELSE dexamethasone_given_pre_antibiotic END,
          clinical_notes = COALESCE(?, clinical_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status ?? null,
      empiricCeftriaxoneOrdered !== undefined ? (empiricCeftriaxoneOrdered ? 1 : 0) : null,
      empiricCeftriaxoneOrdered !== undefined ? (empiricCeftriaxoneOrdered ? 1 : 0) : null,
      empiricVancomycinOrdered !== undefined ? (empiricVancomycinOrdered ? 1 : 0) : null,
      empiricVancomycinOrdered !== undefined ? (empiricVancomycinOrdered ? 1 : 0) : null,
      dexamethasoneGivenPreAntibiotic !== undefined ? (dexamethasoneGivenPreAntibiotic ? 1 : 0) : null,
      dexamethasoneGivenPreAntibiotic !== undefined ? (dexamethasoneGivenPreAntibiotic ? 1 : 0) : null,
      clinicalNotes ?? null,
      id,
    );

    audit(db, {
      actorId: user.id,
      action: 'pediatric_meningitis.status_update',
      entity: 'pediatric_bacterial_meningitis_episodes',
      entityId: Number(id),
      detail: { status },
    });

    return { success: true };
  });

  // 6. Get Flowsheet Logs
  app.get('/api/pediatric-bacterial-meningitis/episodes/:id/flowsheet-logs', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const { id } = req.params as { id: string };

    const rows = db.prepare(`
      SELECT l.*, u.full_name as logged_by_name
      FROM pediatric_bacterial_meningitis_flowsheet_logs l
      JOIN users u ON l.logged_by_id = u.id
      WHERE l.meningitis_episode_id = ?
      ORDER BY l.log_datetime ASC, l.id ASC
    `).all(id) as any[];

    return {
      logs: rows.map(r => ({
        ...r,
        seizure_activity_observed: Boolean(r.seizure_activity_observed),
      })),
    };
  });

  // 7. Add Flowsheet Log
  app.post('/api/pediatric-bacterial-meningitis/episodes/:id/flowsheet-logs', async (req, reply) => {
    const user = assertCanManagePediatricMeningitis(req);
    const { id } = req.params as { id: string };
    const data = parse(meningitisFlowsheetSchema, req.body);

    const episode = db.prepare('SELECT patient_id FROM pediatric_bacterial_meningitis_episodes WHERE id = ?').get(id) as any;
    if (!episode) throw notFound('Pediatric bacterial meningitis episode not found');

    const res = db.prepare(`
      INSERT INTO pediatric_bacterial_meningitis_flowsheet_logs (
        meningitis_episode_id, patient_id, log_datetime,
        gcs_score, pupil_reactivity, heart_rate,
        blood_pressure_sys, blood_pressure_dia, temperature_celsius,
        respiratory_rate, seizure_activity_observed, neurological_notes,
        antibiotic_dose_administered, logged_by_id
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
      data.gcsScore,
      data.pupilReactivity,
      data.heartRate,
      data.bloodPressureSys,
      data.bloodPressureDia,
      data.temperatureCelsius,
      data.respiratoryRate,
      data.seizureActivityObserved ? 1 : 0,
      data.neurologicalNotes ?? null,
      data.antibioticDoseAdministered ?? null,
      user.id,
    );

    const logId = Number(res.lastInsertRowid);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_meningitis.flowsheet_add',
      entity: 'pediatric_bacterial_meningitis_flowsheet_logs',
      entityId: logId,
      detail: { episodeId: Number(id), gcs: data.gcsScore, temp: data.temperatureCelsius },
    });

    reply.status(201);
    return { logId, success: true };
  });

  // 8. Delete Flowsheet Log
  app.delete('/api/pediatric-bacterial-meningitis/episodes/:id/flowsheet-logs/:logId', async (req) => {
    const user = assertCanManagePediatricMeningitis(req);
    const { id, logId } = req.params as { id: string; logId: string };

    const log = db.prepare(`
      SELECT * FROM pediatric_bacterial_meningitis_flowsheet_logs
      WHERE id = ? AND meningitis_episode_id = ?
    `).get(logId, id) as any;

    if (!log) throw notFound('Flowsheet log not found');

    db.prepare('DELETE FROM pediatric_bacterial_meningitis_flowsheet_logs WHERE id = ?').run(logId);

    audit(db, {
      actorId: user.id,
      action: 'pediatric_meningitis.flowsheet_delete',
      entity: 'pediatric_bacterial_meningitis_flowsheet_logs',
      entityId: Number(logId),
      detail: { episodeId: Number(id) },
    });

    return { success: true };
  });
}
