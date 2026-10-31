import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, nurse: string, desk: string;
let asha: Json, meera: Json;
let bedA: number, bedB: number, bedC: number;
let adm: Json;

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : null) as Json, setCookie: Array.isArray(sc) ? sc[0] : sc };
}
async function staff(username: string, role: string) {
  await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
  const first = (await call('POST', '/api/auth/login', undefined, { username, password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  return (await call('POST', '/api/auth/login', undefined, { username, password: PW })).setCookie!.split(';')[0]!;
}
/** Clinic-local (Asia/Kolkata, UTC+5:30) date and time `h` hours ago (negative = in the future). */
const ago = (h: number) => {
  const d = new Date(Date.now() - h * 3_600_000 + 5.5 * 3_600_000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
};
const current = async () => (await call('GET', `/api/admissions/${adm.id}`, doctor)).body as Json;
const move = async (toBedId: number, extra: object = {}, c = nurse, version?: number) =>
  call('POST', `/api/admissions/${adm.id}/transfer`, c, { toBedId, reason: 'Needs isolation', version: version ?? (await current()).version, ...extra });
const occupant = async (bedId: number) => ((await call('GET', '/api/beds', doctor)).body as Json[]).find((b) => b.id === bedId);

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  nurse = await staff('nurse1', 'nurse');
  desk = await staff('desk1', 'attender');
  asha = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient;
  meera = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer' })).body.patient;
  bedA = (await call('POST', '/api/beds', doctor, { room: 'Room 1', label: 'A' })).body.id;
  bedB = (await call('POST', '/api/beds', doctor, { room: 'Room 1', label: 'B' })).body.id;
  bedC = (await call('POST', '/api/beds', doctor, { room: 'Room 2', label: 'A' })).body.id;
  const t = ago(24);
  adm = (await call('POST', '/api/admissions', doctor, { patientId: asha.id, bedId: bedA, reason: 'Observation', admittedDate: t.date, admittedTime: t.time })).body;
});

describe('bed transfer: who and how', () => {
  it('lets the doctor and nurses move a patient; reception and signed-out users cannot', async () => {
    expect((await move(bedB, {}, desk)).status).toBe(403);
    expect((await call('POST', `/api/admissions/${adm.id}/transfer`, undefined, { toBedId: bedB, reason: 'x y', version: 1 })).status).toBe(401);
    expect((await move(bedB, {}, nurse)).status).toBe(200);
    expect((await move(bedC, {}, doctor)).status).toBe(200);
  });

  it('moves the patient, frees the old bed and fills the new one', async () => {
    const before = await current();
    const r = await move(bedB);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ bedId: bedB, bedRoom: 'Room 1', bedLabel: 'B', version: before.version + 1 });
    expect(await occupant(bedA)).toMatchObject({ occupied: false, admissionId: null });
    expect(await occupant(bedB)).toMatchObject({ occupied: true, admissionId: adm.id, patientName: 'Asha Verma' });
    // the freed bed can be given to someone else straight away
    const other = await call('POST', '/api/admissions', doctor, { patientId: meera.id, bedId: bedA, reason: 'Post-op' });
    expect(other.status).toBe(201);
  });

  it('keeps the whole history in order, with who, when and why', async () => {
    await move(bedB, { reason: 'Isolation needed', transferDate: ago(10).date, transferTime: ago(10).time });
    await move(bedC, { reason: 'Moved to private room', transferDate: ago(2).date, transferTime: ago(2).time }, doctor);
    const a = await current();
    expect(a.transfers.map((t: Json) => [t.fromRoom + '/' + t.fromLabel, t.toRoom + '/' + t.toLabel, t.reason, t.byName])).toEqual([
      ['Room 1/A', 'Room 1/B', 'Isolation needed', 'nurse1'],
      ['Room 1/B', 'Room 2/A', 'Moved to private room', 'Dr Rao'],
    ]);
    expect(a.transfers[0]).toMatchObject({ date: ago(10).date, time: ago(10).time });
    expect(a).toMatchObject({ bedRoom: 'Room 2', bedLabel: 'A' });
  });

  it('shows reception the new bed but not the clinical history', async () => {
    await move(bedB);
    const seen = (await call('GET', `/api/admissions/${adm.id}`, desk)).body;
    expect(seen).toMatchObject({ bedRoom: 'Room 1', bedLabel: 'B' });
    expect(seen).not.toHaveProperty('transfers');
    expect(seen).not.toHaveProperty('reason');
  });
});

describe('bed transfer: refusals', () => {
  it('refuses an occupied bed, the same bed, an unused bed, an unknown bed', async () => {
    await call('POST', '/api/admissions', doctor, { patientId: meera.id, bedId: bedB, reason: 'Post-op' });
    expect((await move(bedB)).status).toBe(409);
    expect((await move(bedA)).status).toBe(400);
    await call('PATCH', `/api/beds/${bedC}`, doctor, { active: false });
    expect((await move(bedC)).status).toBe(400);
    expect((await move(9999)).status).toBe(404);
    expect((await current()).bedId).toBe(bedA); // nothing changed
  });

  it('refuses a missing reason and a stale version', async () => {
    expect((await move(bedB, { reason: ' ' })).status).toBe(400);
    expect((await move(bedB, {}, nurse, 999)).status).toBe(409);
    const ok = await move(bedB);
    expect(ok.status).toBe(200);
    expect((await call('POST', `/api/admissions/${adm.id}/transfer`, nurse, { toBedId: bedC, reason: 'Again', version: 1 })).status).toBe(409);
  });

  it('refuses times in the future, before the admission, or before the previous move', async () => {
    expect((await move(bedB, { transferDate: ago(-5).date, transferTime: ago(-5).time })).status).toBe(400);
    expect((await move(bedB, { transferDate: ago(30).date, transferTime: ago(30).time })).status).toBe(400);
    expect((await move(bedB, { transferDate: ago(10).date, transferTime: ago(10).time })).status).toBe(200);
    expect((await move(bedC, { transferDate: ago(12).date, transferTime: ago(12).time })).status).toBe(400);
    expect((await move(bedC, { transferDate: ago(9).date })).status).toBe(400); // date without a time
  });

  it('refuses to move a discharged patient', async () => {
    db.prepare("UPDATE admissions SET status = 'discharged', discharged_at = ? WHERE id = ?").run(new Date().toISOString(), adm.id);
    const r = await move(bedB);
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/discharged/);
  });

  it('cannot be edited or deleted underneath the application', async () => {
    await move(bedB);
    expect(() => db.prepare('UPDATE bed_transfers SET reason = ?').run('changed')).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM bed_transfers').run()).toThrow(/append-only/);
  });
});

describe('bed transfer: records elsewhere', () => {
  it('is audited with the old and new bed, against the patient', async () => {
    await move(bedB, { reason: 'Isolation needed' });
    const log = (await call('GET', `/api/audit?action=admission.transfer&patientId=${asha.id}`, doctor)).body as Json[];
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ label: 'Moved a patient to another bed', actor: 'nurse1', patientName: 'Asha Verma' });
    expect(log[0].detail).toMatchObject({ bed: { from: 'Room 1 / A', to: 'Room 1 / B' }, reason: 'Isolation needed' });
  });

  it('shows up on the nurse station in the new bed, and in the patient export', async () => {
    await move(bedC);
    const ward = (await call('GET', '/api/station', nurse)).body.ward as Json[];
    expect(ward).toHaveLength(1);
    expect(ward[0]).toMatchObject({ bedRoom: 'Room 2', bedLabel: 'A', patientName: 'Asha Verma' });
    const doc = (await call('GET', `/api/patients/${asha.id}/export`, doctor)).body;
    expect(doc.admissions[0].bedTransfers).toHaveLength(1);
    expect(doc.admissions[0].bedTransfers[0]).toMatchObject({ reason: 'Needs isolation' });
    expect(doc.staff.map((s: Json) => s.fullName)).toContain('nurse1');
  });
});
