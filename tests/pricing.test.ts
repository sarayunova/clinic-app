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
let p1: number, p2: number;

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
  p1 = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient.id;
  p2 = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer' })).body.patient.id;
});

const line = (o: object = {}) => ({ category: 'consultation', description: 'OPD consultation', quantity: 1, unitPricePaise: 50000, ...o });
/** An issued invoice for 1,000.00 rupees (2 x 500). */
async function issued(c = desk, patientId = p1) {
  const id = (await call('POST', '/api/invoices', c, { patientId })).body.id as number;
  await call('PUT', `/api/invoices/${id}/lines`, c, { lines: [line({ quantity: 2 })] });
  expect((await call('POST', `/api/invoices/${id}/issue`, c)).status).toBe(200);
  return id;
}
const pay = (c: string, id: number, amountPaise: number, p: object = {}) => call('POST', `/api/invoices/${id}/payments`, c, { amountPaise, method: 'cash', ...p });

describe('price list', () => {
  it('is managed by the doctor only, but readable by billing staff', async () => {
    const item = { category: 'consultation', name: 'OPD consultation', pricePaise: 50000 };
    expect((await call('POST', '/api/price-items', desk, item)).status).toBe(403);
    expect((await call('POST', '/api/price-items', nurse, item)).status).toBe(403);
    const made = await call('POST', '/api/price-items', doctor, item);
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ name: 'OPD consultation', pricePaise: 50000, active: 1 });
    expect((await call('GET', '/api/price-items', desk)).body).toHaveLength(1);
    expect((await call('GET', '/api/price-items', nurse)).status).toBe(403);
    expect((await call('PATCH', `/api/price-items/${made.body.id}`, desk, { pricePaise: 1 })).status).toBe(403);
  });

  it('rejects duplicates (ignoring case) and bad values', async () => {
    await call('POST', '/api/price-items', doctor, { category: 'investigation', name: 'Ultrasound', pricePaise: 80000 });
    expect((await call('POST', '/api/price-items', doctor, { category: 'investigation', name: 'ULTRASOUND', pricePaise: 1 })).status).toBe(409);
    expect((await call('POST', '/api/price-items', doctor, { category: 'other', name: 'Ultrasound', pricePaise: 1 })).status).toBe(201); // other category is fine
    expect((await call('POST', '/api/price-items', doctor, { category: 'other', name: 'x', pricePaise: -1 })).status).toBe(400);
    expect((await call('POST', '/api/price-items', doctor, { category: 'other', name: 'x', pricePaise: 10.5 })).status).toBe(400);
    expect((await call('POST', '/api/price-items', doctor, { category: 'nonsense', name: 'x', pricePaise: 1 })).status).toBe(400);
    expect((await call('POST', '/api/price-items', doctor, { category: 'other', name: '  ', pricePaise: 1 })).status).toBe(400);
  });

  it('switches items off instead of deleting, hides them from billing staff, and audits changes', async () => {
    const id = (await call('POST', '/api/price-items', doctor, { category: 'procedure', name: 'Dressing', pricePaise: 20000 })).body.id;
    const r = await call('PATCH', `/api/price-items/${id}`, doctor, { pricePaise: 25000, active: false });
    expect(r.body).toMatchObject({ pricePaise: 25000, active: 0 });
    expect((await call('GET', '/api/price-items', desk)).body).toHaveLength(0);
    expect((await call('GET', '/api/price-items?all=1', desk)).body).toHaveLength(0); // billing staff cannot see switched-off items
    expect((await call('GET', '/api/price-items?all=1', doctor)).body).toHaveLength(1);
    expect(() => db.prepare('DELETE FROM price_items').run()).toThrow(/cannot be deleted/);
    const detail = JSON.parse((db.prepare("SELECT detail FROM audit_events WHERE action = 'price.update'").get() as { detail: string }).detail);
    expect(detail.price_paise).toEqual({ from: 20000, to: 25000 });
    expect((await call('PATCH', `/api/price-items/${id}`, doctor, {})).status).toBe(400);
    expect((await call('PATCH', '/api/price-items/9999', doctor, { active: true })).status).toBe(404);
  });

  it('does not change an invoice that used an item when the price changes later', async () => {
    const id = (await call('POST', '/api/price-items', doctor, { category: 'consultation', name: 'OPD consultation', pricePaise: 50000 })).body.id;
    const inv = await issued();
    await call('PATCH', `/api/price-items/${id}`, doctor, { pricePaise: 90000 });
    expect((await call('GET', `/api/invoices/${inv}`, desk)).body.totalPaise).toBe(100000);
  });
});

describe('collection report', () => {
  it('totals payments and refunds by method, staff and day', async () => {
    const a = await issued(desk, p1);
    const b = await issued(doctor, p2);
    await pay(desk, a, 60000, { method: 'cash' });
    await pay(desk, b, 30000, { method: 'upi', reference: 'UTR1' });
    await pay(doctor, b, 10000, { method: 'cash' });
    expect((await call('POST', `/api/invoices/${b}/refunds`, doctor, { amountPaise: 5000, method: 'cash', reason: 'Wrong item billed' })).status).toBe(201);

    const r = (await call('GET', '/api/billing/collections', desk)).body;
    expect(r).toMatchObject({ count: 4, paidPaise: 100000, refundedPaise: 5000, netPaise: 95000 });
    expect(r.invoicesIssued).toEqual({ count: 2, totalPaise: 200000 });
    const m = Object.fromEntries(r.byMethod.map((x: Json) => [x.method, x.netPaise]));
    expect(m).toEqual({ cash: 65000, upi: 30000 });
    expect(r.byStaff).toHaveLength(2);
    expect(r.byDay).toHaveLength(1);
    expect(r.transactions).toHaveLength(4);
    expect(r.transactions.map((t: Json) => t.kind)).toContain('refund');
    expect(r.truncated).toBe(false);
  });

  it('uses whole clinic-local days and validates the range', async () => {
    const a = await issued();
    db.prepare("UPDATE invoices SET issued_at = '2020-01-01T00:00:00.000Z'").run(); // so payments can be dated in the past
    // Asia/Kolkata is UTC+5:30: 23:30 on 10 March locally is 18:00 UTC on the 10th; 00:30 on the 11th is 19:00 UTC on the 10th.
    expect((await pay(desk, a, 1000, { paidDate: '2020-03-10', paidTime: '23:30' })).status).toBe(201);
    expect((await pay(desk, a, 2000, { paidDate: '2020-03-11', paidTime: '00:30' })).status).toBe(201);
    const on = async (d: string) => (await call('GET', `/api/billing/collections?from=${d}&to=${d}`, desk)).body;
    expect((await on('2020-03-09')).count).toBe(0);
    const tenth = await on('2020-03-10');
    expect(tenth).toMatchObject({ count: 1, paidPaise: 1000 });
    expect(tenth.transactions[0]).toMatchObject({ date: '2020-03-10', time: '23:30' });
    expect(await on('2020-03-11')).toMatchObject({ count: 1, paidPaise: 2000 });
    const both = (await call('GET', '/api/billing/collections?from=2020-03-10&to=2020-03-11', desk)).body;
    expect(both).toMatchObject({ count: 2, paidPaise: 3000 });
    expect(both.byDay.map((d: Json) => d.date)).toEqual(['2020-03-10', '2020-03-11']);

    expect((await call('GET', '/api/billing/collections?from=2020-03-12&to=2020-03-11', desk)).status).toBe(400);
    expect((await call('GET', '/api/billing/collections?from=2019-01-01&to=2020-03-11', desk)).status).toBe(400);
    expect((await call('GET', '/api/billing/collections?from=nonsense', desk)).status).toBe(400);
  });

  it('is for billing staff only, and each view is audited', async () => {
    expect((await call('GET', '/api/billing/collections', nurse)).status).toBe(403);
    await call('GET', '/api/billing/collections', desk);
    expect((db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'billing.report'").get() as { n: number }).n).toBe(1);
  });
});
