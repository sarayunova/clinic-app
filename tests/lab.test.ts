import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { evaluateLabResultFlag, LAB_PANELS } from '../web/src/labCatalog.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let patientId: number;

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
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
  const setup = await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW });
  doctor = setup.setCookie!.split(';')[0]!;
  for (const [username, role] of [['nurse1', 'nurse'], ['desk1', 'attender']] as const) {
    await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
    const first = await login(username, 'temporary-pass-1');
    await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  }
  nurse = await login('nurse1');
  desk = await login('desk1');

  patientId = (await call('POST', '/api/patients', doctor, {
    fullName: 'Shobha Nambiar',
    dateOfBirth: '1994-08-20',
    phone: '9876543210',
    lastMenstrualPeriod: '2026-03-15',
  })).body.patient.id;
});

describe('Lab Catalog & Abnormal Value Evaluator', () => {
  it('loads standard investigation panels with defined test definitions', () => {
    expect(LAB_PANELS.length).toBeGreaterThanOrEqual(5);
    const anc = LAB_PANELS.find((p) => p.id === 'antenatal_first_trimester');
    expect(anc).toBeDefined();
    expect(anc!.tests.length).toBeGreaterThanOrEqual(8);
  });

  it('correctly evaluates qualitative and numeric abnormal/critical flags', () => {
    // Normal values
    expect(evaluateLabResultFlag('Hemoglobin (Hb)', '12.4')).toBe('normal');
    expect(evaluateLabResultFlag('Platelet Count', '240,000')).toBe('normal');
    expect(evaluateLabResultFlag('Serum TSH', '1.8')).toBe('normal');
    expect(evaluateLabResultFlag('Fasting Plasma Glucose', '85')).toBe('normal');

    // Low flags
    expect(evaluateLabResultFlag('Hemoglobin (Hb)', '9.8')).toBe('low');
    expect(evaluateLabResultFlag('Platelet Count', '95000')).toBe('low');
    expect(evaluateLabResultFlag('Serum Potassium', '3.1')).toBe('low');

    // High flags
    expect(evaluateLabResultFlag('Fasting Plasma Glucose', '105')).toBe('high');
    expect(evaluateLabResultFlag('SGPT / ALT', '68')).toBe('high');
    expect(evaluateLabResultFlag('Serum TSH', '6.5')).toBe('high');

    // Critical life-threatening alerts
    expect(evaluateLabResultFlag('Hemoglobin (Hb)', '5.5')).toBe('critical');
    expect(evaluateLabResultFlag('Platelet Count', '28000')).toBe('critical');
    expect(evaluateLabResultFlag('Serum Potassium', '2.4')).toBe('critical');
    expect(evaluateLabResultFlag('Serum Potassium', '6.8')).toBe('critical');
    expect(evaluateLabResultFlag('Urine Albumin', '3+')).toBe('critical');

    // Serology qualitative markers
    expect(evaluateLabResultFlag('HIV I & II', 'Non-Reactive')).toBe('normal');
    expect(evaluateLabResultFlag('HBsAg', 'Reactive')).toBe('abnormal');
    expect(evaluateLabResultFlag('VDRL / RPR', 'Positive (1:8)')).toBe('abnormal');
  });
});

describe('Laboratory Orders & Results API', () => {
  it('enforces role access: clinical staff allowed, desk & unauthenticated blocked', async () => {
    const payload = {
      orderDate: '2026-06-10',
      priority: 'routine',
      panelName: 'Complete Hemogram',
      clinicalNotes: 'Routine checkup',
      items: [
        { testName: 'Hemoglobin (Hb)', category: 'hematology', unit: 'g/dL', referenceRange: '12.0 - 15.5' },
        { testName: 'Platelet Count', category: 'hematology', unit: '/uL', referenceRange: '150000 - 450000' },
      ],
    };

    // Unauthenticated -> 401
    const r1 = await call('POST', `/api/patients/${patientId}/lab-orders`, undefined, payload);
    expect(r1.status).toBe(401);

    // Desk staff -> 403
    const r2 = await call('POST', `/api/patients/${patientId}/lab-orders`, desk, payload);
    expect(r2.status).toBe(403);

    // Nurse -> 201
    const r3 = await call('POST', `/api/patients/${patientId}/lab-orders`, nurse, payload);
    expect(r3.status).toBe(201);
    expect(r3.body.orderNumber).toMatch(/^LAB-\d{6}-\d{4}$/);
    expect(r3.body.items.length).toBe(2);

    // Doctor -> 201
    const r4 = await call('POST', `/api/patients/${patientId}/lab-orders`, doctor, payload);
    expect(r4.status).toBe(201);
  });

  it('validates schema bounds and rejects empty item list', async () => {
    // Missing items
    const r1 = await call('POST', `/api/patients/${patientId}/lab-orders`, doctor, {
      orderDate: '2026-06-10',
      items: [],
    });
    expect(r1.status).toBe(400);

    // Invalid priority
    const r2 = await call('POST', `/api/patients/${patientId}/lab-orders`, doctor, {
      orderDate: '2026-06-10',
      priority: 'whenever',
      items: [{ testName: 'Glucose', category: 'biochemistry' }],
    });
    expect(r2.status).toBe(400);
  });

  it('completes the full lab workflow: order -> collect -> send -> result entry -> auto completion & audit', async () => {
    // 1. Order Antenatal Booking tests
    const orderRes = await call('POST', `/api/patients/${patientId}/lab-orders`, doctor, {
      orderDate: '2026-06-12',
      priority: 'urgent',
      panelName: 'Antenatal Booking Panel',
      clinicalNotes: '10 weeks primigravida booking',
      items: [
        { testName: 'Hemoglobin (Hb)', category: 'hematology', unit: 'g/dL', referenceRange: '11.0 - 14.0' },
        { testName: 'Serum TSH', category: 'hormones', unit: 'mIU/L', referenceRange: '0.2 - 2.5' },
        { testName: 'HIV I & II', category: 'serology', unit: '', referenceRange: 'Non-Reactive' },
      ],
    });
    expect(orderRes.status).toBe(201);
    const order = orderRes.body;
    expect(order.status).toBe('ordered');
    expect(order.items.length).toBe(3);

    const hbItemId = order.items[0].id;
    const tshItemId = order.items[1].id;
    const hivItemId = order.items[2].id;

    // 2. Phlebotomist / Nurse marks sample collected
    const collectedRes = await call('PATCH', `/api/lab-orders/${order.id}/status`, nurse, {
      status: 'sample_collected',
    });
    expect(collectedRes.status).toBe(200);
    expect(collectedRes.body.status).toBe('sample_collected');

    // 3. Mark sent to lab
    const sentRes = await call('PATCH', `/api/lab-orders/${order.id}/status`, nurse, {
      status: 'sent_to_lab',
    });
    expect(sentRes.status).toBe(200);
    expect(sentRes.body.status).toBe('sent_to_lab');

    // 4. Enter Results for items
    // Hb: 9.8 g/dL (Mild Anemia -> low flag)
    const rHb = await call('PATCH', `/api/lab-results/${hbItemId}`, nurse, {
      resultValue: '9.8',
      flag: 'low',
      notes: 'Mild microcytic hypochromic anemia',
    });
    expect(rHb.status).toBe(200);
    expect(rHb.body.status).toBe('completed');
    expect(rHb.body.flag).toBe('low');

    // TSH: 1.65 mIU/L (Normal)
    const rTsh = await call('PATCH', `/api/lab-results/${tshItemId}`, doctor, {
      resultValue: '1.65',
      flag: 'normal',
    });
    expect(rTsh.status).toBe(200);

    // HIV: Non-Reactive (Normal)
    const rHiv = await call('PATCH', `/api/lab-results/${hivItemId}`, doctor, {
      resultValue: 'Non-Reactive',
      flag: 'normal',
    });
    expect(rHiv.status).toBe(200);

    // 5. Verify that parent order status is now automatically 'completed'
    const finalOrder = await call('GET', `/api/lab-orders/${order.id}`, doctor);
    expect(finalOrder.status).toBe(200);
    expect(finalOrder.body.status).toBe('completed');

    // 6. Test printing requisition slip (logs audit)
    const printRes = await call('POST', `/api/lab-orders/${order.id}/print`, nurse);
    expect(printRes.status).toBe(200);
    expect(printRes.body.ok).toBe(true);

    // 7. Verify integration with Clinical Summary
    const summary = await call('GET', `/api/patients/${patientId}/clinical-summary`, doctor);
    expect(summary.status).toBe(200);
    expect(summary.body.recentLabResults).toBeDefined();
    expect(summary.body.recentLabResults.length).toBeGreaterThanOrEqual(3);
    const hbFound = summary.body.recentLabResults.find((x: any) => x.id === hbItemId);
    expect(hbFound).toBeDefined();
    expect(hbFound.resultValue).toBe('9.8');
    expect(hbFound.flag).toBe('low');

    // 8. Verify audit logs
    const auditEvents = db
      .prepare("SELECT action, entity_id FROM audit_events WHERE action LIKE 'lab.%' ORDER BY id ASC")
      .all() as { action: string; entity_id: string }[];

    expect(auditEvents.length).toBeGreaterThanOrEqual(5);
    expect(auditEvents.map((a) => a.action)).toContain('lab.order');
    expect(auditEvents.map((a) => a.action)).toContain('lab.status');
    expect(auditEvents.map((a) => a.action)).toContain('lab.result');
    expect(auditEvents.map((a) => a.action)).toContain('lab.print');
  });

  it('handles cancellation of a lab order with reason', async () => {
    const orderRes = await call('POST', `/api/patients/${patientId}/lab-orders`, doctor, {
      orderDate: '2026-06-14',
      priority: 'routine',
      items: [{ testName: 'Serum Ferritin', category: 'biochemistry' }],
    });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.id;

    const cancelRes = await call('PATCH', `/api/lab-orders/${orderId}/status`, doctor, {
      status: 'cancelled',
      cancellationReason: 'Duplicate order entered in error',
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');
    expect(cancelRes.body.cancellationReason).toBe('Duplicate order entered in error');
    expect(cancelRes.body.items[0].status).toBe('cancelled');
  });
});
