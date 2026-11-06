import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  findMedicationSafetyRule,
  evaluatePrescriptionSafety,
} from '../web/src/pregnancyMedicationSafety.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let motherId: number;

async function call(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg, secureCookies: false });
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.sharma', fullName: 'Dr Sharma', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  for (const [username, role] of [['nurse_mary', 'nurse'], ['desk_raj', 'attender']] as const) {
    await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    const first = await login(username, 'temporary-pass-1');
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  }
  nurse = await login('nurse_mary');
  desk = await login('desk_raj');

  motherId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Meera Nambiar',
    dateOfBirth: '1994-06-14',
    phone: '9845012345',
    lastMenstrualPeriod: '2026-03-01',
    gravida: 1,
    para: 0,
    living: 0,
    abortions: 0,
  })).body.patient.id;
});

describe('Antenatal Medication Safety Rules & Teratogen Engine', () => {
  it('correctly matches generic and common brand names in knowledge base', () => {
    expect(findMedicationSafetyRule('Telmisartan 40mg')?.id).toBe('ace-inhibitors-arbs');
    expect(findMedicationSafetyRule('Tab Telma 40')?.id).toBe('ace-inhibitors-arbs');
    expect(findMedicationSafetyRule('Tab Brufen 400')?.id).toBe('nsaids-systemic');
    expect(findMedicationSafetyRule('Combiflam')?.id).toBe('nsaids-systemic');
    expect(findMedicationSafetyRule('Tab Atorva 20')?.id).toBe('statins');
    expect(findMedicationSafetyRule('Sodium Valproate')?.id).toBe('valproate');
    expect(findMedicationSafetyRule('Valparin Chrono')?.id).toBe('valproate');
    expect(findMedicationSafetyRule('Doxicip 100')?.id).toBe('tetracyclines');
    expect(findMedicationSafetyRule('Tab Augmentin 625')?.id).toBe('amoxicillin-clavulanate');
    expect(findMedicationSafetyRule('Calpol 650')?.id).toBe('paracetamol');
    expect(findMedicationSafetyRule('Inj Clexane 40')?.id).toBe('enoxaparin-lmwh');
  });

  it('evaluates trimester-dependent contraindication for NSAIDs in 3rd trimester', () => {
    // 1st trimester (week 8) -> Caution
    const t1 = evaluatePrescriptionSafety('Ibuprofen 400mg', 8);
    expect(t1.evaluatedRiskLevel).toBe('caution');
    expect(t1.fdaCategory).toBe('C');

    // 2nd trimester (week 20) -> Caution
    const t2 = evaluatePrescriptionSafety('Ibuprofen 400mg', 20);
    expect(t2.evaluatedRiskLevel).toBe('caution');

    // 3rd trimester (week 32) -> Strictly CONTRAINDICATED (ductus arteriosus closure & oligohydramnios)
    const t3 = evaluatePrescriptionSafety('Ibuprofen 400mg', 32);
    expect(t3.evaluatedRiskLevel).toBe('contraindicated');
    expect(t3.warningSummary).toContain('CONTRAINDICATED in 3rd trimester');
    expect(t3.warningSummary).toContain('ductus arteriosus');
    expect(t3.suggestedAlternatives).toContain('Paracetamol (Acetaminophen 500–1000 mg tid/qid)');
  });

  it('evaluates ACE Inhibitor / ARB fetotoxicity and suggests obstetric safe alternatives', () => {
    const acei = evaluatePrescriptionSafety('Telmisartan 40mg', 18);
    expect(acei.evaluatedRiskLevel).toBe('contraindicated');
    expect(acei.fdaCategory).toBe('D');
    expect(acei.fetalRisks).toContain('Renal dysgenesis');
    expect(acei.fetalRisks).toContain('Potter sequence');
    expect(acei.suggestedAlternatives).toContain('Labetalol (100–400 mg bid)');
    expect(acei.suggestedAlternatives).toContain('Methyldopa (250–500 mg tid)');
  });

  it('evaluates Category X teratogens (Statins, Valproate, Warfarin, Isotretinoin)', () => {
    const statin = evaluatePrescriptionSafety('Atorvastatin 20mg', 10);
    expect(statin.evaluatedRiskLevel).toBe('contraindicated');
    expect(statin.fdaCategory).toBe('X');

    const valproate = evaluatePrescriptionSafety('Sodium Valproate 500mg', 6);
    expect(valproate.evaluatedRiskLevel).toBe('contraindicated');
    expect(valproate.fdaCategory).toBe('X');
    expect(valproate.fetalRisks).toContain('Neural tube defects');

    const warfarin = evaluatePrescriptionSafety('Warfarin 5mg', 8);
    expect(warfarin.evaluatedRiskLevel).toBe('contraindicated');
    expect(warfarin.fetalRisks).toContain('Warfarin embryopathy');
    expect(warfarin.suggestedAlternatives).toContain('Enoxaparin (Clexane, LMWH 40–80 mg/day)');
  });

  it('evaluates safe first-line antenatal medications', () => {
    const pcm = evaluatePrescriptionSafety('Paracetamol 650mg', 16);
    expect(pcm.evaluatedRiskLevel).toBe('safe');
    expect(pcm.fdaCategory).toBe('B');

    const folic = evaluatePrescriptionSafety('Folic Acid 5mg', 8);
    expect(folic.evaluatedRiskLevel).toBe('safe');
    expect(folic.fdaCategory).toBe('A');

    const augmentin = evaluatePrescriptionSafety('Augmentin 625mg', 24);
    expect(augmentin.evaluatedRiskLevel).toBe('safe');
    expect(augmentin.fdaCategory).toBe('B');

    const labetalol = evaluatePrescriptionSafety('Labetalol 100mg', 30);
    expect(labetalol.evaluatedRiskLevel).toBe('safe');
  });
});

describe('Antenatal Medication Exposures API', () => {
  it('records, retrieves, and deletes a maternal teratogenic exposure event', async () => {
    // Initial fetch
    const getInit = await call('GET', `/api/patients/${motherId}/medication-exposures`, doctor);
    expect(getInit.status).toBe(200);
    expect(getInit.body.count).toBe(0);

    // Doctor logs inadvertent early 1st trimester exposure to Telmisartan
    const createRes = await call('POST', `/api/patients/${motherId}/medication-exposures`, doctor, {
      medicineName: 'Telma 40 (Telmisartan)',
      genericName: 'Telmisartan',
      fdaCategory: 'D',
      riskLevel: 'contraindicated',
      trimesterExposure: 't1_organogenesis',
      gestationalAgeWeeks: 6,
      gestationalAgeDays: 4,
      exposureStartDate: '2026-03-01',
      exposureEndDate: '2026-04-10',
      exposureDose: '40mg once daily',
      fetalRiskSummary: 'Exposure during early organogenesis; potential renal tubular dysgenesis and calvarial hypoplasia risk.',
      teratogenicMechanism: 'Inhibition of renin-angiotensin-aldosterone system in developing embryonic vasculature.',
      anomalyScanIndicated: true,
      fetalEchoIndicated: true,
      counselingNotes: 'Detailed parental counseling conducted regarding baseline background anomaly risk vs drug exposure. High-dose folic acid initiated.',
      actionPlan: 'Telmisartan stopped immediately upon pregnancy confirmation; switched to Tab Labetalol 100mg bid; Level II anomaly scan scheduled at 18–20 weeks.',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeGreaterThan(0);
    expect(createRes.body.medicineName).toBe('Telma 40 (Telmisartan)');
    expect(createRes.body.anomalyScanIndicated).toBe(true);
    expect(createRes.body.fetalEchoIndicated).toBe(true);

    // Nurse retrieves exposures list
    const listRes = await call('GET', `/api/patients/${motherId}/medication-exposures`, nurse);
    expect(listRes.status).toBe(200);
    expect(listRes.body.count).toBe(1);
    expect(listRes.body.exposures[0].counseledByName).toBe('Dr Sharma');

    // Audit event check
    const auditEvents = db.prepare('SELECT action FROM audit_events WHERE entity_id = ?').all(String(motherId)) as { action: string }[];
    const actions = auditEvents.map((a) => a.action);
    expect(actions).toContain('medication_exposure.create');

    // Clinical staff deletes exposure
    const delRes = await call('DELETE', `/api/medication-exposures/${createRes.body.id}`, doctor);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    const afterDel = await call('GET', `/api/patients/${motherId}/medication-exposures`, doctor);
    expect(afterDel.body.count).toBe(0);
  });

  it('enforces RBAC: desk attender cannot log medication exposure records', async () => {
    const res = await call('POST', `/api/patients/${motherId}/medication-exposures`, desk, {
      medicineName: 'Brufen',
      riskLevel: 'caution',
      trimesterExposure: 't1_organogenesis',
      fetalRiskSummary: 'NSAID exposure',
    });
    expect(res.status).toBe(403);
  });
});
