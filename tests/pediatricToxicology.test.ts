import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { openDb, type DB } from '../server/db.js';
import { loadConfig } from '../server/config.js';
import { evaluatePediatricToxicology } from '../web/src/pediatricToxicologyEngine.js';

const PW = 'Password@12345';
const cfg = loadConfig({ dbFile: ':memory:' });

let app: FastifyInstance;
let db: DB;
let doctor: string;
let nurse: string;
let attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  body?: unknown
) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  const res = await app.inject({
    method,
    url,
    headers,
    payload: body as any,
  });
  return {
    status: res.statusCode,
    body: res.body ? JSON.parse(res.body) : null,
    setCookie: res.headers['set-cookie'] as string | undefined,
  };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

describe('Pediatric Acute Toxic Ingestion Engine (Pure Unit Tests)', () => {
  it('evaluates APAP toxicity breaching Rumack-Matthew nomogram and calculates 3-bag IV NAC', () => {
    const res = evaluatePediatricToxicology({
      ageYears: 3.5,
      weightKg: 15.0,
      substanceCategory: 'acetaminophen_paracetamol',
      ingestedDoseMgKg: 180.0,
      hoursPostIngestion: 4.5,
      serumLevelValue: 195.0,
      rumackMatthewLineBreached: true,
      altUL: 35.0,
      astUL: 42.0,
      totalBilirubinMgDl: 0.6,
      prothrombinTimeInr: 1.0,
      antidoteIndicated: true,
      antidoteAdministered: 'iv_n_acetylcysteine_nac_protocol',
      gastricDecontaminationContraindicated: false,
    });

    expect(res.isAntidoteIndicated).toBe(true);
    expect(res.antidoteName).toContain('N-Acetylcysteine');
    expect(res.rumackMatthewNomogramBreached).toBe(true);
    expect(res.antidoteDosingDirectives.some((d) => d.includes('Bag 1 (Loading): 2250 mg'))).toBe(true);
    expect(res.antidoteDosingDirectives.some((d) => d.includes('Bag 2: 750 mg'))).toBe(true);
    expect(res.antidoteDosingDirectives.some((d) => d.includes('Bag 3: 1500 mg'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('RUMACK-MATTHEW TREATMENT LINE BREACHED'))).toBe(true);
    expect(res.urgencyTier).toBe('emergency_antidote_and_picu');
  });

  it('evaluates acute elemental iron ingestion indicating IV Deferoxamine chelation', () => {
    const res = evaluatePediatricToxicology({
      ageYears: 2.0,
      weightKg: 12.0,
      substanceCategory: 'iron_elemental_supplement',
      ingestedDoseMgKg: 65.0,
      hoursPostIngestion: 3.0,
      serumLevelValue: 520.0,
      rumackMatthewLineBreached: false,
      altUL: 22.0,
      astUL: 26.0,
      totalBilirubinMgDl: 0.5,
      prothrombinTimeInr: 1.05,
      antidoteIndicated: true,
      antidoteAdministered: 'iv_deferoxamine_chelation',
      gastricDecontaminationContraindicated: false,
    });

    expect(res.isAntidoteIndicated).toBe(true);
    expect(res.antidoteName).toContain('Deferoxamine');
    expect(res.antidoteDosingDirectives.some((d) => d.includes('15 mg/kg/hr'))).toBe(true);
    expect(res.antidoteDosingDirectives.some((d) => d.includes('Vin-Rosé Urine'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('CRITICAL IRON TOXICITY'))).toBe(true);
  });

  it('evaluates organophosphate toxidrome with SLUDGEM syndrome and Atropine/2-PAM directives', () => {
    const res = evaluatePediatricToxicology({
      ageYears: 6.0,
      weightKg: 20.0,
      substanceCategory: 'organophosphate_carbamate',
      ingestedDoseMgKg: 0.0,
      hoursPostIngestion: 2.0,
      serumLevelValue: 0.0,
      rumackMatthewLineBreached: false,
      altUL: 25.0,
      astUL: 28.0,
      totalBilirubinMgDl: 0.7,
      prothrombinTimeInr: 1.0,
      antidoteIndicated: true,
      antidoteAdministered: 'atropine_pralidoxime_regimen',
      gastricDecontaminationContraindicated: false,
    });

    expect(res.isAntidoteIndicated).toBe(true);
    expect(res.antidoteName).toContain('Atropine + Pralidoxime');
    expect(res.antidoteDosingDirectives.some((d) => d.includes('Pralidoxime (2-PAM): Administer 500 mg'))).toBe(true);
    expect(res.alerts.some((a) => a.includes('SLUDGEM'))).toBe(true);
  });

  it('detects caustic and hydrocarbon strict contraindication to gastric lavage or emesis', () => {
    const causticRes = evaluatePediatricToxicology({
      ageYears: 2.5,
      weightKg: 13.0,
      substanceCategory: 'caustic_alkali_acid_battery',
      ingestedDoseMgKg: 0.0,
      hoursPostIngestion: 1.5,
      serumLevelValue: 0.0,
      rumackMatthewLineBreached: false,
      altUL: 20.0,
      astUL: 20.0,
      totalBilirubinMgDl: 0.4,
      prothrombinTimeInr: 1.0,
      antidoteIndicated: false,
      antidoteAdministered: 'supportive_care_only',
      gastricDecontaminationContraindicated: true,
    });

    expect(causticRes.isDecontaminationStrictlyContraindicated).toBe(true);
    expect(causticRes.alerts.some((a) => a.includes('STRICT GASTRIC DECONTAMINATION CONTRAINDICATION'))).toBe(true);
  });
});

describe('Pediatric Toxicology Fastify API & RBAC', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.toxicology',
      fullName: 'Dr. Meera Pediatric Toxicologist',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.picu',
      fullName: 'Nurse Kavya PICU',
      role: 'nurse',
      password: 'temp-pass-nurse',
    });
    const nurseFirst = await login('nurse.picu', 'temp-pass-nurse');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse',
      newPassword: PW,
    });
    nurse = await login('nurse.picu', PW);

    // Attender setup
    await call('POST', '/api/users', doctor, {
      username: 'attender.picu',
      fullName: 'Attender Santosh',
      role: 'attender',
      password: 'temp-pass-attender',
    });
    const attenderFirst = await login('attender.picu', 'temp-pass-attender');
    await call('POST', '/api/auth/change-password', attenderFirst, {
      currentPassword: 'temp-pass-attender',
      newPassword: PW,
    });
    attender = await login('attender.picu', PW);

    const p = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav (Toxicology)',
      dateOfBirth: '2023-05-10',
      phone: '9876543210',
      address: 'PICU Bay 1',
    });
    expect(p.status).toBe(201);
    patientId = p.body.patient.id;
  });

  it('allows doctor to manage pediatric toxicology episodes and nurse to log flowsheet entries', async () => {
    // 1. Evaluate Preview API
    const evalRes = await call('POST', '/api/pediatric-toxicology/evaluate', doctor, {
      ageYears: 3.5,
      weightKg: 15.0,
      substanceCategory: 'acetaminophen_paracetamol',
      ingestedDoseMgKg: 186.7,
      hoursPostIngestion: 4.5,
      serumLevelValue: 195.0,
      rumackMatthewLineBreached: true,
      altUL: 32.0,
      astUL: 38.0,
      totalBilirubinMgDl: 0.6,
      prothrombinTimeInr: 1.0,
      antidoteIndicated: true,
      antidoteAdministered: 'iv_n_acetylcysteine_nac_protocol',
      gastricDecontaminationContraindicated: false,
    });
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.antidoteDosingDirectives.some((d: string) => d.includes('Bag 1 (Loading): 2250 mg'))).toBe(true);

    // 2. Create Episode
    const createRes = await call('POST', '/api/pediatric-toxicology/episodes', doctor, {
      patientId,
      ingestionDatetime: '2026-11-08T06:00:00',
      presentationDatetime: '2026-11-08T10:30:00',
      ageYears: 3.5,
      weightKg: 15.0,
      substanceCategory: 'acetaminophen_paracetamol',
      ingestedDoseMgKg: 186.7,
      hoursPostIngestion: 4.5,
      serumLevelValue: 195.0,
      rumackMatthewLineBreached: true,
      altUL: 32.0,
      astUL: 38.0,
      totalBilirubinMgDl: 0.6,
      prothrombinTimeInr: 1.0,
      antidoteIndicated: true,
      antidoteAdministered: 'iv_n_acetylcysteine_nac_protocol',
      gastricDecontaminationContraindicated: false,
      status: 'antidote_infusion_active',
      clinicalNotes: 'APAP overdose treated with IV NAC 3-bag regimen.',
    });
    expect(createRes.status).toBe(201);
    const epId = createRes.body.episode.id;
    expect(createRes.body.episode.episode_code).toMatch(/^TOX-/);

    // 3. Nurse logs flowsheet entry
    const flowRes = await call('POST', `/api/pediatric-toxicology/episodes/${epId}/flowsheet`, nurse, {
      logDatetime: '2026-11-08T11:45:00',
      hoursFromIngestion: 5.75,
      heartRateBpm: 110,
      systolicBpMmhg: 102,
      respiratoryRate: 24,
      spo2Percent: 99.0,
      altUL: 34.0,
      astUL: 39.0,
      toxinSerumLevel: 175.0,
      vinRoseUrineObserved: false,
      notes: 'Bag 1 complete. Bag 2 infusing smoothly.',
    });
    expect(flowRes.status).toBe(201);
    const flowLogId = flowRes.body.flowsheetLog.id;

    // 4. Fetch Episode Detail
    const getRes = await call('GET', `/api/pediatric-toxicology/episodes/${epId}`, doctor);
    expect(getRes.status).toBe(200);
    expect(getRes.body.episode.id).toBe(epId);
    expect(getRes.body.flowsheet.length).toBe(1);
    expect(getRes.body.evaluation.isAntidoteIndicated).toBe(true);

    // 5. Update Status
    const statusRes = await call('PATCH', `/api/pediatric-toxicology/episodes/${epId}/status`, doctor, {
      status: 'toxic_levels_clearing',
    });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.episode.status).toBe('toxic_levels_clearing');

    // 6. Delete Flowsheet Entry
    const delFlowRes = await call('DELETE', `/api/pediatric-toxicology/episodes/${epId}/flowsheet/${flowLogId}`, doctor);
    expect(delFlowRes.status).toBe(200);

    // 7. Attender unauthorized
    const unauthRes = await call('POST', '/api/pediatric-toxicology/episodes', attender, {
      patientId,
      ingestionDatetime: '2026-11-08T06:00:00',
      presentationDatetime: '2026-11-08T10:30:00',
      ageYears: 3.5,
      weightKg: 15.0,
      substanceCategory: 'acetaminophen_paracetamol',
      ingestedDoseMgKg: 100.0,
      hoursPostIngestion: 4.0,
      serumLevelValue: 50.0,
    });
    expect(unauthRes.status).toBe(403);
  });
});
