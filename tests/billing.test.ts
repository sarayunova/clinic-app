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

async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, cookie?: string, payload?: unknown) {
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
/** An issued invoice for ₹1,000.00 (2 x ₹500). */
async function issued(c = desk, patientId = p1) {
  const id = (await call('POST', '/api/invoices', c, { patientId })).body.id as number;
  await call('PUT', `/api/invoices/${id}/lines`, c, { lines: [line({ quantity: 2 })] });
  const r = await call('POST', `/api/invoices/${id}/issue`, c);
  expect(r.status).toBe(200);
  return id;
}
const pay = (c: string, id: number, amountPaise: number, p: object = {}) => call('POST', `/api/invoices/${id}/payments`, c, { amountPaise, method: 'cash', ...p });
const get = async (id: number, c = desk) => (await call('GET', `/api/invoices/${id}`, c)).body as Json;

describe('invoices', () => {
  it('lets reception and doctor bill, but not the nurse', async () => {
    expect((await call('POST', '/api/invoices', nurse, { patientId: p1 })).status).toBe(403);
    expect((await call('GET', '/api/invoices', nurse)).status).toBe(403);
    expect((await call('POST', '/api/invoices', desk, { patientId: p1 })).status).toBe(201);
    expect((await call('POST', '/api/invoices', doctor, { patientId: p1 })).status).toBe(201);
  });

  it('computes line amounts from integer paise and totals', async () => {
    const id = (await call('POST', '/api/invoices', desk, { patientId: p1 })).body.id;
    const r = await call('PUT', `/api/invoices/${id}/lines`, desk, {
      lines: [line({ quantity: 3, unitPricePaise: 15050 }), line({ category: 'investigation', description: 'Ultrasound', unitPricePaise: 80000 })],
    });
    expect(r.status).toBe(200);
    expect(r.body.lines.map((l: Json) => l.amountPaise)).toEqual([45150, 80000]);
    expect(r.body).toMatchObject({ status: 'draft', totalPaise: 125150, balancePaise: 125150, invoiceNumber: null });
  });

  it('rejects negative, fractional or zero-quantity charges and bad links', async () => {
    const id = (await call('POST', '/api/invoices', desk, { patientId: p1 })).body.id;
    const put = (l: object) => call('PUT', `/api/invoices/${id}/lines`, desk, { lines: [l] });
    expect((await put(line({ unitPricePaise: -100 }))).status).toBe(400);
    expect((await put(line({ unitPricePaise: 100.5 }))).status).toBe(400);
    expect((await put(line({ quantity: 0 }))).status).toBe(400);
    expect((await put(line({ quantity: 1.5 }))).status).toBe(400);
    expect((await put(line({ description: ' ' }))).status).toBe(400);
    expect((await put(line({ category: 'tax' }))).status).toBe(400);
    expect((await call('POST', '/api/invoices', desk, { patientId: p1, admissionId: 999 })).status).toBe(400);
  });

  it('links to an admission of the same patient only', async () => {
    const bed = (await call('POST', '/api/beds', doctor, { room: 'R1', label: 'A' })).body.id;
    const adm = (await call('POST', '/api/admissions', doctor, { patientId: p1, bedId: bed, reason: 'Observation' })).body.id;
    expect((await call('POST', '/api/invoices', desk, { patientId: p2, admissionId: adm })).status).toBe(400);
    const ok = await call('POST', '/api/invoices', desk, { patientId: p1, admissionId: adm });
    expect(ok.status).toBe(201);
    expect(ok.body.admissionNumber).toBe('A000001');
  });

  it('issues with a number only when it has a charge, then locks the lines', async () => {
    const id = (await call('POST', '/api/invoices', desk, { patientId: p1 })).body.id;
    expect((await call('POST', `/api/invoices/${id}/issue`, desk)).status).toBe(400); // empty
    await call('PUT', `/api/invoices/${id}/lines`, desk, { lines: [line()] });
    const r = await call('POST', `/api/invoices/${id}/issue`, desk);
    expect(r.body).toMatchObject({ status: 'issued', invoiceNumber: 'INV000001', paymentState: 'unpaid' });
    expect((await call('PUT', `/api/invoices/${id}/lines`, desk, { lines: [line({ unitPricePaise: 1 })] })).status).toBe(409);
    expect((await call('POST', `/api/invoices/${id}/issue`, desk)).status).toBe(400);
    expect(() => db.prepare('UPDATE invoice_lines SET unit_price_paise = 1, amount_paise = 1 WHERE invoice_id = ?').run(id)).toThrow();
    expect(() => db.prepare('DELETE FROM invoices WHERE id = ?').run(id)).toThrow();
    expect((await issued()) > id).toBe(true);
    expect((await get(id + 1)).invoiceNumber).toBe('INV000002');
  });

  it('discards drafts but never issued invoices', async () => {
    const draft = (await call('POST', '/api/invoices', desk, { patientId: p1 })).body.id;
    expect((await call('DELETE', `/api/invoices/${draft}`, desk)).status).toBe(200);
    expect((await call('GET', `/api/invoices/${draft}`, desk)).status).toBe(404);
    const id = await issued();
    expect((await call('DELETE', `/api/invoices/${id}`, desk)).status).toBe(409);
  });
});

describe('payments', () => {
  it('records payments with receipt numbers and computes the balance', async () => {
    const id = await issued();
    const r1 = await pay(desk, id, 40000, { method: 'upi', reference: 'UPI123' });
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ totalPaise: 100000, netPaidPaise: 40000, balancePaise: 60000, paymentState: 'part_paid' });
    expect(r1.body.payments[0]).toMatchObject({ receiptNumber: 'R000001', method: 'upi', reference: 'UPI123', receivedByName: 'desk1' });
    const r2 = await pay(desk, id, 60000);
    expect(r2.body).toMatchObject({ balancePaise: 0, paymentState: 'paid' });
    expect(r2.body.payments[1].receiptNumber).toBe('R000002');
  });

  it('rejects overpayment, zero, fractional and bad methods; nurse cannot take payment', async () => {
    const id = await issued();
    expect((await pay(desk, id, 100001)).status).toBe(400);
    expect((await pay(desk, id, 0)).status).toBe(400);
    expect((await pay(desk, id, 10.5)).status).toBe(400);
    expect((await pay(desk, id, 100, { method: 'bitcoin' })).status).toBe(400);
    expect((await pay(nurse, id, 100)).status).toBe(403);
    expect((await get(id)).payments).toHaveLength(0);
  });

  it('rejects payments on drafts, cancelled invoices and dates before issue or in the future', async () => {
    const draft = (await call('POST', '/api/invoices', desk, { patientId: p1 })).body.id;
    expect((await pay(desk, draft, 100)).status).toBe(400);
    const id = await issued();
    expect((await pay(desk, id, 100, { paidDate: '2020-01-01', paidTime: '10:00' })).status).toBe(400);
    expect((await pay(desk, id, 100, { paidDate: '2999-01-01', paidTime: '10:00' })).status).toBe(400);
    await call('POST', `/api/invoices/${id}/cancel`, doctor, { reason: 'Billed in error' });
    expect((await pay(desk, id, 100)).status).toBe(400);
  });

  it('keeps payments append-only', async () => {
    const id = await issued();
    await pay(desk, id, 100);
    expect(() => db.prepare('UPDATE payments SET amount_paise = 1 WHERE invoice_id = ?').run(id)).toThrow();
    expect(() => db.prepare('DELETE FROM payments WHERE invoice_id = ?').run(id)).toThrow();
  });
});

describe('adjustments, refunds and cancellation (doctor only)', () => {
  it('lets only the doctor discount, with a reason, and the balance follows', async () => {
    const id = await issued();
    const url = `/api/invoices/${id}/adjustments`;
    expect((await call('POST', url, desk, { amountPaise: -10000, kind: 'discount', reason: 'Staff family' })).status).toBe(403);
    expect((await call('POST', url, doctor, { amountPaise: -10000, kind: 'discount', reason: '' })).status).toBe(400);
    expect((await call('POST', url, doctor, { amountPaise: 10000, kind: 'discount', reason: 'Wrong sign' })).status).toBe(400); // discount must reduce
    expect((await call('POST', url, doctor, { amountPaise: -100001, kind: 'write_off', reason: 'Too much' })).status).toBe(400); // total < 0
    const r = await call('POST', url, doctor, { amountPaise: -10000, kind: 'discount', reason: 'Staff family' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ linesPaise: 100000, adjustmentsPaise: -10000, totalPaise: 90000, balancePaise: 90000 });
    expect(r.body.adjustments[0]).toMatchObject({ authorisedByName: 'Dr Rao', reason: 'Staff family' });
    // a correction may increase the bill
    expect((await call('POST', url, doctor, { amountPaise: 5000, kind: 'correction', reason: 'Missed a charge' })).body.totalPaise).toBe(95000);
    expect(() => db.prepare('UPDATE adjustments SET amount_paise = 1').run()).toThrow();
  });

  it('shows a credit when a discount follows full payment, and refunds it', async () => {
    const id = await issued();
    await pay(desk, id, 100000);
    const adj = await call('POST', `/api/invoices/${id}/adjustments`, doctor, { amountPaise: -20000, kind: 'discount', reason: 'Agreed after payment' });
    expect(adj.body).toMatchObject({ balancePaise: -20000, paymentState: 'credit' });
    const url = `/api/invoices/${id}/refunds`;
    expect((await call('POST', url, desk, { amountPaise: 20000, method: 'cash', reason: 'Return credit' })).status).toBe(403);
    expect((await call('POST', url, doctor, { amountPaise: 20000, method: 'cash', reason: '' })).status).toBe(400);
    expect((await call('POST', url, doctor, { amountPaise: 100001, method: 'cash', reason: 'More than paid' })).status).toBe(400);
    const r = await call('POST', url, doctor, { amountPaise: 20000, method: 'cash', reason: 'Return the discount' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ netPaidPaise: 80000, refundedPaise: 20000, balancePaise: 0, paymentState: 'paid' });
    expect(r.body.payments.at(-1)).toMatchObject({ kind: 'refund', receiptNumber: 'F000001' });
  });

  it('refuses to cancel an invoice that still holds money; allows it after a full refund', async () => {
    const id = await issued();
    await pay(desk, id, 5000);
    const cancel = (c: string) => call('POST', `/api/invoices/${id}/cancel`, c, { reason: 'Billed to wrong patient' });
    expect((await cancel(desk)).status).toBe(403);
    expect((await cancel(doctor)).status).toBe(409);
    await call('POST', `/api/invoices/${id}/refunds`, doctor, { amountPaise: 5000, method: 'cash', reason: 'Cancelling the invoice' });
    const r = await cancel(doctor);
    expect(r.body).toMatchObject({ status: 'cancelled', paymentState: 'cancelled' });
    expect(() => db.prepare("UPDATE invoices SET status = 'issued' WHERE id = ?").run(id)).toThrow();
    const open = (await call('GET', '/api/invoices?status=unpaid', desk)).body as Json[];
    expect(open.find((i) => i.id === id)).toBeUndefined();
  });
});

describe('listing and clinic details', () => {
  it('lists unpaid invoices and by patient', async () => {
    const a = await issued(desk, p1);
    const b = await issued(desk, p2);
    await pay(desk, b, 100000);
    const open = (await call('GET', '/api/invoices', desk)).body as Json[];
    expect(open.map((i) => i.id)).toEqual([a]);
    expect(((await call('GET', `/api/patients/${p2}/invoices`, desk)).body as Json[]).map((i) => i.id)).toEqual([b]);
    expect(((await call('GET', '/api/invoices?status=all', desk)).body as Json[])).toHaveLength(2);
  });

  it('stores clinic details for printing: doctor writes, everyone logged in reads', async () => {
    expect((await call('PUT', '/api/settings', desk, { clinicName: 'X' })).status).toBe(403);
    expect((await call('PUT', '/api/settings', doctor, { clinicName: 'Rao Women’s Clinic', phone: '0000' })).status).toBe(200);
    expect((await call('GET', '/api/settings', nurse)).body).toMatchObject({ clinicName: 'Rao Women’s Clinic', phone: '0000', address: '' });
    expect((await call('GET', '/api/settings')).status).toBe(401);
    expect((await call('PUT', '/api/settings', doctor, { unknown: 'x' })).status).toBe(400);
  });
});
