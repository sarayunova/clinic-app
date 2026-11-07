import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import {
  lookupAwareTier,
  isRestrictedApprovalRequired,
  evaluateAntibioticTimeout,
  generateAntibiogram,
} from '../web/src/amsEngine.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any;

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, attender: string;
let patientId: number;

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  cookie?: string,
  payload?: unknown,
) {
  const res = await app.inject({
    method,
    url,
    payload: payload as object,
    headers: cookie ? { cookie } : {},
  });
  const sc = res.headers['set-cookie'];
  return {
    status: res.statusCode,
    headers: res.headers,
    body: (res.body ? (res.headers['content-type']?.includes('application/json') ? JSON.parse(res.body) : res.body) : null) as Json,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
  };
}

async function login(username: string, password = PW) {
  const r = await call('POST', '/api/auth/login', undefined, { username, password });
  expect(r.status).toBe(200);
  return r.setCookie!.split(';')[0]!;
}

// -------------------------------------------------------------
// Pure Calculation Clinical Engine Tests (Run instantly in-memory)
// -------------------------------------------------------------
describe('Antimicrobial Stewardship (AMS) Engine (Pure Unit Tests)', () => {
  it('correctly classifies WHO AWaRe tiers and identifies restricted Reserve agents', () => {
    // 1. Access Tier
    expect(lookupAwareTier('Ampicillin')).toBe('access');
    expect(lookupAwareTier('Gentamicin')).toBe('access');
    expect(lookupAwareTier('Metronidazole')).toBe('access');
    expect(isRestrictedApprovalRequired('Ampicillin')).toBe(false);

    // 2. Watch Tier
    expect(lookupAwareTier('Amikacin')).toBe('watch');
    expect(lookupAwareTier('Cefotaxime')).toBe('watch');
    expect(lookupAwareTier('Ceftriaxone')).toBe('watch');
    expect(lookupAwareTier('Piperacillin-Tazobactam')).toBe('watch');
    expect(lookupAwareTier('Meropenem')).toBe('watch');
    expect(isRestrictedApprovalRequired('Meropenem')).toBe(true);

    // 3. Reserve Tier
    expect(lookupAwareTier('Colistin')).toBe('reserve');
    expect(lookupAwareTier('Linezolid')).toBe('reserve');
    expect(lookupAwareTier('Ceftazidime-Avibactam')).toBe('reserve');
    expect(isRestrictedApprovalRequired('Colistin')).toBe(true);
    expect(isRestrictedApprovalRequired('Linezolid')).toBe(true);
  });

  it('evaluates 48-72h antibiotic timeout thresholds and review status', () => {
    const now = Date.now();

    // 1. Less than 48 hours: Routine, no timeout due yet
    const recent = new Date(now - 24 * 3600 * 1000).toISOString();
    const evalRecent = evaluateAntibioticTimeout({
      prescribedDatetime: recent,
      hasReviewLogged: false,
    });
    expect(evalRecent.isTimeoutDue).toBe(false);
    expect(evalRecent.urgency).toBe('routine');

    // 2. Between 48 and 72 hours: Due warning
    const dueTime = new Date(now - 52 * 3600 * 1000).toISOString();
    const evalDue = evaluateAntibioticTimeout({
      prescribedDatetime: dueTime,
      hasReviewLogged: false,
    });
    expect(evalDue.isTimeoutDue).toBe(true);
    expect(evalDue.urgency).toBe('due_warning');
    expect(evalDue.recommendation).toContain('ANTIBIOTIC TIMEOUT DUE');

    // 3. Greater than 72 hours: Critical overdue
    const overdueTime = new Date(now - 80 * 3600 * 1000).toISOString();
    const evalOverdue = evaluateAntibioticTimeout({
      prescribedDatetime: overdueTime,
      hasReviewLogged: false,
    });
    expect(evalOverdue.isTimeoutDue).toBe(true);
    expect(evalOverdue.urgency).toBe('overdue_critical');
    expect(evalOverdue.recommendation).toContain('OVERDUE TIMEOUT');

    // 4. Completed timeout review: Marked non-due
    const reviewed = evaluateAntibioticTimeout({
      prescribedDatetime: overdueTime,
      hasReviewLogged: true,
    });
    expect(reviewed.isTimeoutDue).toBe(false);
    expect(reviewed.urgency).toBe('routine');
  });

  it('computes cumulative hospital antibiogram susceptibility percentages per CLSI guidelines', () => {
    const mockIsolates = [
      {
        pathogen_isolated: 'Klebsiella pneumoniae',
        sensitivities_json: JSON.stringify({
          Ampicillin: 'R',
          Gentamicin: 'S',
          Meropenem: 'S',
          Colistin: 'S',
        }),
      },
      {
        pathogen_isolated: 'Klebsiella pneumoniae',
        sensitivities_json: JSON.stringify({
          Ampicillin: 'R',
          Gentamicin: 'R',
          Meropenem: 'S',
          Colistin: 'S',
        }),
      },
      {
        pathogen_isolated: 'Klebsiella pneumoniae',
        sensitivities_json: JSON.stringify({
          Ampicillin: 'R',
          Gentamicin: 'S',
          Meropenem: 'R', // Carbapenem-resistant
          Colistin: 'S',
        }),
      },
      {
        pathogen_isolated: 'Staphylococcus aureus',
        sensitivities_json: JSON.stringify({
          Vancomycin: 'S',
          Linezolid: 'S',
          Ampicillin: 'R',
        }),
      },
    ];

    const antibiogram = generateAntibiogram(mockIsolates);
    expect(antibiogram.length).toBe(2);

    const kp = antibiogram.find(r => r.pathogen === 'Klebsiella pneumoniae');
    expect(kp).toBeDefined();
    expect(kp!.totalIsolates).toBe(3);

    // Ampicillin: 0/3 (0%)
    expect(kp!.drugs.Ampicillin?.susceptibilityPct).toBe(0);
    // Gentamicin: 2/3 (67%)
    expect(kp!.drugs.Gentamicin?.susceptibilityPct).toBe(67);
    // Meropenem: 2/3 (67%)
    expect(kp!.drugs.Meropenem?.susceptibilityPct).toBe(67);
    // Colistin: 3/3 (100%)
    expect(kp!.drugs.Colistin?.susceptibilityPct).toBe(100);

    const sa = antibiogram.find(r => r.pathogen === 'Staphylococcus aureus');
    expect(sa).toBeDefined();
    expect(sa!.drugs.Vancomycin?.susceptibilityPct).toBe(100);
  });
});

// -------------------------------------------------------------
// REST API Integration & RBAC Tests
// -------------------------------------------------------------
describe('Antimicrobial Stewardship (AMS) REST API Integration', () => {
  beforeEach(async () => {
    db = openDb(':memory:');
    app = await buildApp({ db, cfg, secureCookies: false });

    // Doctor setup
    const setup = await call('POST', '/api/setup', undefined, {
      username: 'dr.pedams',
      fullName: 'Dr. Vikram Seth (Pediatric AMS Chair)',
      password: PW,
    });
    doctor = setup.setCookie!.split(';')[0]!;

    // Nurse setup
    await call('POST', '/api/users', doctor, {
      username: 'nurse.ams',
      fullName: 'Sister Anita PICU',
      role: 'nurse',
      password: 'temp-pass-nurse-ams',
    });
    const nurseFirst = await login('nurse.ams', 'temp-pass-nurse-ams');
    await call('POST', '/api/auth/change-password', nurseFirst, {
      currentPassword: 'temp-pass-nurse-ams',
      newPassword: PW,
    });
    nurse = await login('nurse.ams', PW);

    // Attender setup (Read only / Blocked from clinical writes)
    await call('POST', '/api/users', doctor, {
      username: 'desk.attender',
      fullName: 'Reception Desk',
      role: 'attender',
      password: 'temp-pass-desk-ams',
    });
    const deskFirst = await login('desk.attender', 'temp-pass-desk-ams');
    await call('POST', '/api/auth/change-password', deskFirst, {
      currentPassword: 'temp-pass-desk-ams',
      newPassword: PW,
    });
    attender = await login('desk.attender', PW);

    // Create pediatric test patient
    const patRes = await call('POST', '/api/patients', doctor, {
      fullName: 'Master Aarav Sharma',
      dateOfBirth: '2023-04-10',
      estimatedAgeYears: 3,
      phone: '9876543210',
      address: 'Indore, MP',
      gravida: null,
      para: null,
    });
    expect(patRes.status).toBe(201);
    patientId = patRes.body.patient.id;
  });

  it('prescribes an antimicrobial regimen, classifies AWaRe tier, logs timeout review and calculates antibiogram', async () => {
    // 1. Prescribe Access Tier antibiotic (Ampicillin)
    const prescRes1 = await call('POST', '/api/ams/prescriptions', doctor, {
      patientId,
      prescribedDatetime: new Date(Date.now() - 55 * 3600 * 1000).toISOString(), // 55 hrs ago -> due for timeout
      drugName: 'Ampicillin',
      route: 'iv',
      dosage: '100 mg/kg/dose',
      frequency: 'q6h',
      indication: 'empiric_early_onset_sepsis',
      suspectedFocus: 'Neonatal Sepsis / Bloodstream',
      culturesSent: true,
      cultureSpecimenTypes: ['blood', 'urine'],
      plannedDurationDays: 7,
    });
    expect(prescRes1.status).toBe(201);
    expect(prescRes1.body.prescription.aware_tier).toBe('access');
    expect(prescRes1.body.prescription.status).toBe('active');
    const prescriptionId = prescRes1.body.prescription.id;

    // 2. Prescribe Reserve Tier antibiotic (Colistin) with restricted approval note
    const prescRes2 = await call('POST', '/api/ams/prescriptions', doctor, {
      patientId,
      prescribedDatetime: new Date().toISOString(),
      drugName: 'Colistin',
      route: 'iv',
      dosage: '50,000 IU/kg/day divided q8h',
      frequency: 'q8h',
      indication: 'culture_proven_pathogen',
      suspectedFocus: 'MDR Ventilator Associated Pneumonia',
      culturesSent: true,
      cultureSpecimenTypes: ['eta_respiratory'],
      plannedDurationDays: 10,
      restrictedApprovalNotes: 'Approved by Dr. Vikram Seth for Pan-Drug Resistant Acinetobacter',
    });
    expect(prescRes2.status).toBe(201);
    expect(prescRes2.body.prescription.aware_tier).toBe('reserve');
    expect(prescRes2.body.prescription.restricted_approval_by_id).toBeDefined();

    // 3. List AMS Prescriptions
    const listRes = await call('GET', `/api/ams/prescriptions?patientId=${patientId}`, doctor);
    expect(listRes.status).toBe(200);
    expect(listRes.body.prescriptions.length).toBe(2);

    // 4. Retrieve single prescription detail
    const detailRes = await call('GET', `/api/ams/prescriptions/${prescriptionId}`, doctor);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.prescription.drug_name).toBe('Ampicillin');
    expect(detailRes.body.reviews.length).toBe(0);

    // 5. Nurse logs a 48-72h Antibiotic Timeout Review (De-escalation / switch)
    const timeoutRes = await call('POST', `/api/ams/prescriptions/${prescriptionId}/timeout`, nurse, {
      reviewDatetime: new Date().toISOString(),
      timeoutAction: 'de_escalate',
      cultureResultSummary: 'pathogen_isolated_sensitivities_available',
      clinicalResponse: 'improving_afebrile',
      justificationNotes: 'Blood culture grew Enterococcus faecalis sensitive to Ampicillin; afebrile for 48h, CRP falling.',
      newAntimicrobialRegimen: 'Continue Ampicillin monotherapy; stop empiric Gentamicin coverage.',
    });
    expect(timeoutRes.status).toBe(201);
    expect(timeoutRes.body.timeoutReview.timeout_action).toBe('de_escalate');

    // Verify parent prescription status was transitioned to 'de_escalated'
    const updatedPresc = await call('GET', `/api/ams/prescriptions/${prescriptionId}`, doctor);
    expect(updatedPresc.body.prescription.status).toBe('de_escalated');
    expect(updatedPresc.body.reviews.length).toBe(1);

    // 6. Record positive microbiology isolate
    const isolateRes = await call('POST', '/api/ams/isolates', doctor, {
      patientId,
      amsPrescriptionId: prescriptionId,
      collectionDatetime: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      specimenType: 'blood',
      pathogenIsolated: 'Enterococcus faecalis',
      colonyCountCfuMl: '>10^5 CFU/mL',
      sensitivities: {
        Ampicillin: 'S',
        Vancomycin: 'S',
        Linezolid: 'S',
        Gentamicin: 'R',
      },
      multidrugResistant: false,
      reportedAt: new Date().toISOString(),
    });
    expect(isolateRes.status).toBe(201);
    expect(isolateRes.body.isolate.pathogen_isolated).toBe('Enterococcus faecalis');

    // 7. Verify isolates list endpoint
    const isolatesList = await call('GET', `/api/ams/isolates?patientId=${patientId}`, doctor);
    expect(isolatesList.status).toBe(200);
    expect(isolatesList.body.isolates.length).toBe(1);

    // 8. Cumulative Antibiogram endpoint
    const antibiogramRes = await call('GET', '/api/ams/antibiogram', doctor);
    expect(antibiogramRes.status).toBe(200);
    expect(antibiogramRes.body.totalIsolatesCount).toBe(1);
    const efRow = antibiogramRes.body.antibiogram.find((r: any) => r.pathogen === 'Enterococcus faecalis');
    expect(efRow).toBeDefined();
    expect(efRow.drugs.Ampicillin.susceptibilityPct).toBe(100);

    // 9. AMS Dashboard endpoint
    const dashRes = await call('GET', '/api/ams/dashboard', doctor);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.activePrescriptions.length).toBeGreaterThan(0);
    expect(dashRes.body.recentIsolates.length).toBeGreaterThan(0);

    // 10. RBAC check: attender cannot create prescriptions or timeout reviews (403)
    const blockedPresc = await call('POST', '/api/ams/prescriptions', attender, {
      patientId,
      prescribedDatetime: new Date().toISOString(),
      drugName: 'Amikacin',
      dosage: '15 mg/kg',
      frequency: 'q24h',
      indication: 'surgical_prophylaxis',
    });
    expect(blockedPresc.status).toBe(403);
  });
});
