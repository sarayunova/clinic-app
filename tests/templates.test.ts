import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
const cfg = loadConfig({ dbFile: ':memory:' });
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, cookie?: string, payload?: unknown) {
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
});

const sampleItems = [
  { medicine: 'Tab. Iron & Folic Acid', dose: '1 tab', route: 'oral', frequency: 'OD', duration: '30 days', instructions: 'after food' },
  { medicine: 'Tab. Calcium', strength: '500 mg', dose: '1 tab', route: 'oral', frequency: 'BD', duration: '30 days', instructions: 'after meals' },
];

describe('Prescription templates / regimens', () => {
  it('allows only the doctor to create and edit templates; nurse can read', async () => {
    // Desk cannot read or create
    expect((await call('GET', '/api/prescription-templates', desk)).status).toBe(403);
    expect((await call('POST', '/api/prescription-templates', desk, { name: 'Regimen', category: 'General', items: sampleItems })).status).toBe(403);

    // Nurse cannot create
    expect((await call('POST', '/api/prescription-templates', nurse, { name: 'Regimen', category: 'General', items: sampleItems })).status).toBe(403);

    // Doctor can create
    const created = await call('POST', '/api/prescription-templates', doctor, {
      name: 'Antenatal Routine Prophylaxis',
      category: 'Antenatal',
      items: sampleItems,
    });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Antenatal Routine Prophylaxis');
    expect(created.body.items).toHaveLength(2);

    // Nurse can read active templates
    const nurseList = await call('GET', '/api/prescription-templates', nurse);
    expect(nurseList.status).toBe(200);
    expect(nurseList.body).toHaveLength(1);
    expect(nurseList.body[0].name).toBe('Antenatal Routine Prophylaxis');
  });

  it('rejects duplicates and invalid items', async () => {
    await call('POST', '/api/prescription-templates', doctor, {
      name: 'PCOS Protocol',
      category: 'Gynaecology',
      items: sampleItems,
    });

    // Duplicate name (case-insensitive)
    const dup = await call('POST', '/api/prescription-templates', doctor, {
      name: 'pcos protocol',
      category: 'Gynaecology',
      items: sampleItems,
    });
    expect(dup.status).toBe(409);

    // Empty name
    expect((await call('POST', '/api/prescription-templates', doctor, { name: '', category: 'General', items: sampleItems })).status).toBe(400);

    // Empty items
    expect((await call('POST', '/api/prescription-templates', doctor, { name: 'Empty', category: 'General', items: [] })).status).toBe(400);

    // Missing medicine name in item
    expect((await call('POST', '/api/prescription-templates', doctor, { name: 'Bad Item', category: 'General', items: [{ medicine: '' }] })).status).toBe(400);
  });

  it('switches templates off, hides them from default listing, and audits actions', async () => {
    const res = await call('POST', '/api/prescription-templates', doctor, {
      name: 'Post-Op Analgesia',
      category: 'Post-op',
      items: sampleItems,
    });
    const id = res.body.id;

    // Switch off
    const patch = await call('PATCH', `/api/prescription-templates/${id}`, doctor, { active: false });
    expect(patch.status).toBe(200);
    expect(patch.body.active).toBe(false);

    // Default list hides inactive templates
    const activeOnly = await call('GET', '/api/prescription-templates', doctor);
    expect(activeOnly.body).toHaveLength(0);

    // ?all=1 shows inactive templates to doctor
    const all = await call('GET', '/api/prescription-templates?all=1', doctor);
    expect(all.body).toHaveLength(1);
    expect(all.body[0].active).toBe(false);

    // Audit entries recorded
    const auditRes = await call('GET', `/api/audit?entity=prescription_template&entityId=${id}`, doctor);
    expect(auditRes.status).toBe(200);
    const actions = (auditRes.body as Json[]).map((e) => e.action);
    expect(actions).toContain('template.create');
    expect(actions).toContain('template.update');
  });
});
