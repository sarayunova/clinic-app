import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { runBackup } from '../server/backup.js';
import { restoreBackup } from '../server/restore.js';
import { MAX_FILE_BYTES, sniff } from '../server/routes/attachments.js';

const PW = 'correct-horse-battery';
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let app: FastifyInstance;
let db: ReturnType<typeof openDb>;
let doctor: string, desk: string, nurse: string;
let asha: Json, meera: Json;

async function call(method: 'GET' | 'POST', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  const sc = res.headers['set-cookie'];
  const ct = String(res.headers['content-type'] ?? '');
  return {
    status: res.statusCode,
    headers: res.headers,
    rawBody: res.rawPayload,
    body: (ct.includes('json') && res.body ? JSON.parse(res.body) : null) as Json,
    setCookie: Array.isArray(sc) ? sc[0] : sc,
  };
}
async function staff(username: string, role: string) {
  await call('POST', '/api/users', doctor, { username, fullName: username, role, password: 'temporary-pass-1' });
  const first = (await call('POST', '/api/auth/login', undefined, { username, password: 'temporary-pass-1' })).setCookie!.split(';')[0]!;
  await call('POST', '/api/auth/change-password', first, { currentPassword: 'temporary-pass-1', newPassword: PW });
  return (await call('POST', '/api/auth/login', undefined, { username, password: PW })).setCookie!.split(';')[0]!;
}

// Tiny but genuine file headers.
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('1 0 obj<<>>endobj\n'), Buffer.from('%%EOF')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('pngdata')]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpgdata')]);
const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const body = (file: Buffer, extra: object = {}) => ({
  title: 'Scan report',
  docType: 'ultrasound',
  documentDate: today(),
  fileName: 'scan.pdf',
  data: file.toString('base64'),
  ...extra,
});
const upload = (c: string, file: Buffer, extra: object = {}, pid = asha.id) => call('POST', `/api/patients/${pid}/attachments`, c, body(file, extra));

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp({ db, cfg: loadConfig({ dataDir: 'unused' }), secureCookies: false });
  doctor = (await call('POST', '/api/setup', undefined, { username: 'dr.rao', fullName: 'Dr Rao', password: PW })).setCookie!.split(';')[0]!;
  desk = await staff('desk1', 'attender');
  nurse = await staff('nurse1', 'nurse');
  asha = (await call('POST', '/api/patients', desk, { fullName: 'Asha Verma' })).body.patient;
  meera = (await call('POST', '/api/patients', desk, { fullName: 'Meera Iyer' })).body.patient;
});

describe('file type detection', () => {
  it('goes by the first bytes, not the name', () => {
    expect(sniff(PDF)).toBe('application/pdf');
    expect(sniff(PNG)).toBe('image/png');
    expect(sniff(JPG)).toBe('image/jpeg');
    expect(sniff(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniff(Buffer.from('MZ\x90\x00 an exe'))).toBeNull();
    expect(sniff(Buffer.alloc(0))).toBeNull();
  });
});

describe('documents: upload and view', () => {
  it('stores a file and returns exactly the same bytes', async () => {
    const up = await upload(nurse, PDF);
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({ patientId: asha.id, title: 'Scan report', docType: 'ultrasound', mime: 'application/pdf', sizeBytes: PDF.length, uploadedByName: 'nurse1' });
    const f = await call('GET', `/api/attachments/${up.body.id}/file`, doctor);
    expect(f.status).toBe(200);
    expect(Buffer.compare(Buffer.from(f.rawBody), PDF)).toBe(0);
    expect(f.headers['content-type']).toBe('application/pdf');
    expect(f.headers['content-disposition']).toBe('inline; filename="scan.pdf"');
    expect(f.headers['x-content-type-options']).toBe('nosniff');
    expect(f.headers['cache-control']).toMatch(/no-store/);
    const dl = await call('GET', `/api/attachments/${up.body.id}/file?download=1`, doctor);
    expect(dl.headers['content-disposition']).toBe('attachment; filename="scan.pdf"');
  });

  it('lists a patient\'s documents, newest document date first, with the linked consultation', async () => {
    const visit = (await call('POST', '/api/visits', nurse, { patientId: asha.id })).body;
    const a = await upload(doctor, PDF, { title: 'Older report', documentDate: '2026-01-05' });
    const b = await upload(doctor, PNG, { title: 'Newer scan', documentDate: '2026-03-05', fileName: 'x.png', visitId: visit.id });
    await upload(doctor, JPG, { title: 'Someone else', fileName: 'y.jpg' }, meera.id);
    const list = (await call('GET', `/api/patients/${asha.id}/attachments`, nurse)).body as Json[];
    expect(list.map((x) => x.id)).toEqual([b.body.id, a.body.id]);
    expect(list[0]).toMatchObject({ visitId: visit.id, mime: 'image/png' });
    expect(list[0]).not.toHaveProperty('data');
    expect((await call('GET', '/api/patients/9999/attachments', doctor)).status).toBe(404);
  });

  it('decides the real type from the content even if the name lies', async () => {
    const up = await upload(doctor, PNG, { fileName: 'report.pdf' });
    expect(up.body.mime).toBe('image/png');
    const f = await call('GET', `/api/attachments/${up.body.id}/file`, doctor);
    expect(f.headers['content-type']).toBe('image/png');
    expect(f.headers['content-disposition']).toBe('inline; filename="report.png"');
  });

  it('cleans odd file names', async () => {
    const up = await upload(doctor, PDF, { fileName: '..\\..\\evil"name\r\n.pdf' });
    expect(up.status).toBe(201);
    const f = await call('GET', `/api/attachments/${up.body.id}/file`, doctor);
    expect(f.headers['content-disposition']).toMatch(/^inline; filename="[A-Za-z0-9._ -]+\.pdf"$/);
  });
});

describe('documents: rules', () => {
  it('accepts only PDF, JPEG and PNG, whatever the file is called', async () => {
    for (const bad of [Buffer.from('<html><script>alert(1)</script></html>'), Buffer.from('MZ\x90\x00 program'), Buffer.from('plain text')]) {
      const r = await upload(doctor, bad, { fileName: 'scan.pdf' });
      expect(r.status).toBe(400);
      expect(r.body.error.message).toMatch(/PDF, JPEG and PNG/);
    }
    expect((await call('POST', `/api/patients/${asha.id}/attachments`, doctor, body(PDF, { data: 'not base64!!' }))).status).toBe(400);
  });

  it('enforces the size limit and refuses empty files', async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(MAX_FILE_BYTES)]);
    const r = await upload(doctor, big);
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/too large/);
    const justUnder = Buffer.concat([PDF, Buffer.alloc(MAX_FILE_BYTES - PDF.length, 1)]);
    expect((await upload(doctor, justUnder)).status).toBe(201);
    expect((await call('POST', `/api/patients/${asha.id}/attachments`, doctor, body(PDF, { data: '' }))).status).toBe(400);
  });

  it('validates the metadata and the links', async () => {
    const visitOfMeera = (await call('POST', '/api/visits', nurse, { patientId: meera.id })).body;
    expect((await upload(doctor, PDF, { title: 'x' })).status).toBe(400);
    expect((await upload(doctor, PDF, { docType: 'selfie' })).status).toBe(400);
    expect((await upload(doctor, PDF, { documentDate: '2999-01-01' })).status).toBe(400);
    expect((await upload(doctor, PDF, { documentDate: '2026-02-30' })).status).toBe(400);
    expect((await upload(doctor, PDF, { visitId: visitOfMeera.id })).status).toBe(400); // someone else's consultation
    expect((await upload(doctor, PDF, { visitId: 1, admissionId: 1 })).status).toBe(400);
    expect((await upload(doctor, PDF, {}, 9999)).status).toBe(404);
  });

  it('refuses the same file twice for one patient, but allows it for another', async () => {
    expect((await upload(doctor, PDF)).status).toBe(201);
    const again = await upload(doctor, PDF, { title: 'Again' });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/already saved.*Scan report/);
    expect((await upload(doctor, PDF, {}, meera.id)).status).toBe(201);
  });

  it('is private: reception and signed-out users cannot list, upload or open files', async () => {
    const up = await upload(doctor, PDF);
    for (const c of [desk, undefined]) {
      const want = c ? 403 : 401;
      expect((await call('GET', `/api/patients/${asha.id}/attachments`, c)).status).toBe(want);
      expect((await upload(c as string, PNG)).status).toBe(want);
      expect((await call('GET', `/api/attachments/${up.body.id}/file`, c)).status).toBe(want);
    }
    expect((await call('GET', '/api/attachments/9999/file', doctor)).status).toBe(404);
  });
});

describe('documents: removing (voiding)', () => {
  it('lets only the doctor remove a document, with a reason; it then disappears but is kept', async () => {
    const up = await upload(nurse, PDF);
    const id = up.body.id;
    expect((await call('POST', `/api/attachments/${id}/void`, nurse, { reason: 'Wrong patient' })).status).toBe(403);
    expect((await call('POST', `/api/attachments/${id}/void`, doctor, { reason: 'no' })).status).toBe(400);
    expect((await call('POST', `/api/attachments/${id}/void`, doctor, { reason: 'Uploaded to the wrong patient' })).status).toBe(200);
    expect((await call('POST', `/api/attachments/${id}/void`, doctor, { reason: 'Uploaded to the wrong patient' })).status).toBe(409);

    expect((await call('GET', `/api/patients/${asha.id}/attachments`, doctor)).body).toEqual([]);
    expect((await call('GET', `/api/attachments/${id}/file`, doctor)).status).toBe(404);
    // Still in the database, and the same file can now be uploaded again to the right place.
    expect((db.prepare('SELECT COUNT(*) AS n FROM attachment_blobs').get() as { n: number }).n).toBe(1);
    expect((await upload(doctor, PDF)).status).toBe(201);
  });

  it('cannot be edited or deleted underneath the application either', async () => {
    const up = await upload(doctor, PDF);
    expect(() => db.prepare('UPDATE attachments SET title = ? WHERE id = ?').run('Changed', up.body.id)).toThrow(/cannot be edited/);
    expect(() => db.prepare('UPDATE attachment_blobs SET data = ? WHERE attachment_id = ?').run(Buffer.from('x'), up.body.id)).toThrow(/cannot be changed/);
    expect(() => db.prepare('DELETE FROM attachments WHERE id = ?').run(up.body.id)).toThrow(/cannot be deleted/);
    expect(() => db.prepare('DELETE FROM attachment_blobs WHERE attachment_id = ?').run(up.body.id)).toThrow(/cannot be deleted/);
    await call('POST', `/api/attachments/${up.body.id}/void`, doctor, { reason: 'Uploaded to the wrong patient' });
    expect(() => db.prepare('UPDATE attachments SET void_reason = ? WHERE id = ?').run('Something else entirely', up.body.id)).toThrow(/cannot be edited/);
  });
});

describe('documents: audit and export', () => {
  it('records upload, view, download and removal against the patient', async () => {
    const up = await upload(nurse, PDF);
    await call('GET', `/api/attachments/${up.body.id}/file`, doctor);
    await call('GET', `/api/attachments/${up.body.id}/file?download=1`, doctor);
    await call('POST', `/api/attachments/${up.body.id}/void`, doctor, { reason: 'Uploaded to the wrong patient' });
    const log = (await call('GET', `/api/audit?patientId=${asha.id}&action=attachment.*`, doctor)).body as Json[];
    expect(log.map((e) => e.action).sort()).toEqual(['attachment.download', 'attachment.upload', 'attachment.view', 'attachment.void']);
    expect(log.find((e) => e.action === 'attachment.upload')).toMatchObject({ label: 'Uploaded a document', actor: 'nurse1', patientName: 'Asha Verma' });
    expect(JSON.stringify(log)).not.toContain(PDF.toString('base64'));
  });

  it('lists documents (without their files) in the patient export, including removed ones', async () => {
    const a = await upload(nurse, PDF);
    await upload(nurse, PNG, { title: 'Second', fileName: 'b.png' });
    await call('POST', `/api/attachments/${a.body.id}/void`, doctor, { reason: 'Uploaded to the wrong patient' });
    const doc = (await call('GET', `/api/patients/${asha.id}/export`, doctor)).body;
    expect(doc.counts.attachments).toBe(2);
    expect(doc.attachments.map((x: Json) => x.title)).toEqual(['Scan report', 'Second']);
    expect(doc.attachments[0]).toMatchObject({ voidReason: 'Uploaded to the wrong patient' });
    expect(JSON.stringify(doc)).not.toContain(PNG.toString('base64'));
    expect(doc.staff.map((s: Json) => s.fullName)).toEqual(expect.arrayContaining(['nurse1', 'Dr Rao']));
  });
});

describe('documents and backups', () => {
  it('a restored backup contains the document files, byte for byte', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-att-test-'));
    try {
      const cfg = loadConfig({
        dataDir: path.join(dir, 'data'),
        dbFile: path.join(dir, 'data', 'clinic.sqlite'),
        backupDir: path.join(dir, 'backups'),
        backupPassphrase: 'a long backup passphrase 42',
      });
      const live = openDb(cfg.dbFile);
      const a2 = await buildApp({ db: live, cfg, secureCookies: false });
      const setup = await a2.inject({ method: 'POST', url: '/api/setup', payload: { username: 'dr.rao', fullName: 'Dr Rao', password: PW } });
      const cookie = (setup.headers['set-cookie'] as string).split(';')[0]!;
      const p = JSON.parse((await a2.inject({ method: 'POST', url: '/api/patients', headers: { cookie }, payload: { fullName: 'Asha Verma' } })).body).patient;
      const up = await a2.inject({ method: 'POST', url: `/api/patients/${p.id}/attachments`, headers: { cookie }, payload: body(PDF) });
      expect(up.statusCode).toBe(201);

      const r = await runBackup(live, cfg);
      live.close();
      const res = await restoreBackup({ file: path.join(cfg.backupDir, r.file), passphrase: cfg.backupPassphrase!, cfg, replace: false });
      const restored = openDb(res.restoredFile);
      const row = restored.prepare('SELECT data FROM attachment_blobs').get() as { data: Uint8Array };
      expect(Buffer.compare(Buffer.from(row.data), PDF)).toBe(0);
      restored.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
