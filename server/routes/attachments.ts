import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit } from '../audit.js';
import { badRequest, conflict, notFound, parse } from '../errors.js';
import { isRealDate, localDate, nowIso } from '../time.js';
import { camelize } from '../util.js';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DOC_TYPES = ['lab_report', 'ultrasound', 'imaging', 'referral', 'consent', 'outside_record', 'other'] as const;

type Mime = 'application/pdf' | 'image/jpeg' | 'image/png';

/** What the file really is, judged from its first bytes. The name and the browser's claim are not trusted. */
export function sniff(b: Buffer): Mime | null {
  if (b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}
const EXT: Record<Mime, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

const uploadSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the document a title').max(150),
    docType: z.enum(DOC_TYPES),
    documentDate: z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)'),
    visitId: z.number().int().min(1).optional(),
    admissionId: z.number().int().min(1).optional(),
    fileName: z.string().trim().min(1).max(255),
    /** The file, base64-encoded. */
    data: z.string().min(1, 'Choose a file'),
  })
  .strict();
const voidSchema = z.object({ reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500) }).strict();
const fileQuery = z.object({ download: z.enum(['1']).optional() });

const COLUMNS = `a.id, a.patient_id, a.visit_id, a.admission_id, a.doc_type, a.title, a.document_date, a.original_name, a.mime,
  a.size_bytes, a.sha256, a.created_at, u.full_name AS uploaded_by_name`;
const FROM = 'FROM attachments a JOIN users u ON u.id = a.uploaded_by';

export function registerAttachmentRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const idParam = (req: { params: unknown }, what: string) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) throw notFound(what);
    return id;
  };

  app.get('/api/patients/:id/attachments', async (req) => {
    requirePerm(req, 'attachment:read');
    const pid = idParam(req, 'Patient');
    if (!db.prepare('SELECT 1 FROM patients WHERE id = ?').get(pid)) throw notFound('Patient');
    return db
      .prepare(`SELECT ${COLUMNS}, v.visit_at, adm.admission_number ${FROM}
                  LEFT JOIN visits v ON v.id = a.visit_id LEFT JOIN admissions adm ON adm.id = a.admission_id
                 WHERE a.patient_id = ? AND a.voided_at IS NULL ORDER BY a.document_date DESC, a.id DESC`)
      .all(pid)
      .map((r) => {
        const o = camelize(r);
        const { visitAt, ...rest } = o;
        return { ...rest, visitDate: visitAt ? localDate(new Date(visitAt as string), cfg.timezone) : null };
      });
  });

  app.post('/api/patients/:id/attachments', { bodyLimit: Math.ceil((MAX_FILE_BYTES * 4) / 3) + 64 * 1024 }, async (req, reply) => {
    const user = requirePerm(req, 'attachment:write');
    const pid = idParam(req, 'Patient');
    const b = parse(uploadSchema, req.body);
    if (b.visitId && b.admissionId) throw badRequest('Link the document to a consultation or an admission, not both');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b.data) || b.data.length % 4 !== 0) {
      throw badRequest('The file could not be read', [{ field: 'data', message: 'Not a valid file' }]);
    }
    const bytes = Buffer.from(b.data, 'base64');
    if (bytes.length === 0) throw badRequest('The file is empty', [{ field: 'data', message: 'The file is empty' }]);
    if (bytes.length > MAX_FILE_BYTES) {
      throw badRequest(`The file is too large. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`, [{ field: 'data', message: 'File too large' }]);
    }
    const mime = sniff(bytes);
    if (!mime) throw badRequest('Only PDF, JPEG and PNG files are accepted', [{ field: 'data', message: 'Unsupported file type' }]);
    if (b.documentDate > localDate(new Date(), cfg.timezone)) {
      throw badRequest('The document date cannot be in the future', [{ field: 'documentDate', message: 'In the future' }]);
    }

    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const name = (b.fileName.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 200) || 'document';
    const id = tx(db, () => {
      if (!db.prepare('SELECT 1 FROM patients WHERE id = ?').get(pid)) throw notFound('Patient');
      if (b.visitId && !db.prepare('SELECT 1 FROM visits WHERE id = ? AND patient_id = ?').get(b.visitId, pid)) {
        throw badRequest('That consultation does not belong to this patient', [{ field: 'visitId', message: 'Wrong patient' }]);
      }
      if (b.admissionId && !db.prepare('SELECT 1 FROM admissions WHERE id = ? AND patient_id = ?').get(b.admissionId, pid)) {
        throw badRequest('That admission does not belong to this patient', [{ field: 'admissionId', message: 'Wrong patient' }]);
      }
      const dup = db.prepare('SELECT title FROM attachments WHERE patient_id = ? AND sha256 = ? AND voided_at IS NULL').get(pid, sha256) as
        | { title: string }
        | undefined;
      if (dup) throw conflict(`This exact file is already saved for this patient as "${dup.title}"`);
      const r = db
        .prepare(
          `INSERT INTO attachments(patient_id, visit_id, admission_id, doc_type, title, document_date, original_name, mime, size_bytes, sha256, uploaded_by, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(pid, b.visitId ?? null, b.admissionId ?? null, b.docType, b.title, b.documentDate, name, mime, bytes.length, sha256, user.id, nowIso());
      const aid = Number(r.lastInsertRowid);
      db.prepare('INSERT INTO attachment_blobs(attachment_id, data) VALUES (?, ?)').run(aid, bytes);
      audit(db, {
        actorId: user.id,
        action: 'attachment.upload',
        entity: 'attachment',
        entityId: aid,
        detail: { title: b.title, docType: b.docType, sizeBytes: bytes.length, sha256 },
      });
      return aid;
    });
    return reply.status(201).send(camelize(db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE a.id = ?`).get(id) as object));
  });

  app.get('/api/attachments/:id/file', async (req, reply) => {
    const user = requirePerm(req, 'attachment:read');
    const id = idParam(req, 'Document');
    const q = parse(fileQuery, req.query);
    const row = db
      .prepare('SELECT a.mime, a.original_name, a.title, a.voided_at, b.data FROM attachments a JOIN attachment_blobs b ON b.attachment_id = a.id WHERE a.id = ?')
      .get(id) as { mime: Mime; original_name: string; title: string; voided_at: string | null; data: Uint8Array } | undefined;
    if (!row || row.voided_at) throw notFound('Document');
    audit(db, { actorId: user.id, action: q.download ? 'attachment.download' : 'attachment.view', entity: 'attachment', entityId: id, detail: { title: row.title } });
    const base = row.original_name.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9._ -]/g, '_') || 'document';
    return reply
      .header('Content-Type', row.mime)
      .header('Content-Disposition', `${q.download ? 'attachment' : 'inline'}; filename="${base}.${EXT[row.mime]}"`)
      .header('Cache-Control', 'private, no-store')
      .send(Buffer.from(row.data));
  });

  app.post('/api/attachments/:id/void', async (req) => {
    const user = requirePerm(req, 'attachment:void');
    const id = idParam(req, 'Document');
    const b = parse(voidSchema, req.body);
    return tx(db, () => {
      const cur = db.prepare('SELECT title, voided_at FROM attachments WHERE id = ?').get(id) as { title: string; voided_at: string | null } | undefined;
      if (!cur) throw notFound('Document');
      if (cur.voided_at) throw conflict('This document has already been removed');
      db.prepare('UPDATE attachments SET voided_at = ?, voided_by = ?, void_reason = ? WHERE id = ?').run(nowIso(), user.id, b.reason, id);
      audit(db, { actorId: user.id, action: 'attachment.void', entity: 'attachment', entityId: id, detail: { title: cur.title, reason: b.reason } });
      return { ok: true };
    });
  });
}
