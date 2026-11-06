import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { tx, type DB } from '../db.js';
import { audit } from '../audit.js';
import { badRequest, conflict, notFound, parse } from '../errors.js';
import { can, type Role } from '../permissions.js';
import { isRealDate, localDate, localTime, nowIso } from '../time.js';
import { camelize } from '../util.js';
import { makeInstant } from './ipd.js';

const date = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');
const text = (max: number) => z.string().trim().max(max).transform((s) => (s === '' ? null : s)).nullable();

const MAX_PAISE = 1_000_000_000; // 1 crore rupees: a sanity limit, not a business rule
const paise = z.number().int('Amount must be a whole number of paise').min(0).max(MAX_PAISE);
const CATEGORIES = ['consultation', 'investigation', 'procedure', 'room_bed', 'other'] as const;
const METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'] as const;

const createSchema = z
  .object({
    patientId: z.number().int().min(1),
    visitId: z.number().int().min(1).optional(),
    admissionId: z.number().int().min(1).optional(),
    notes: text(1000).optional(),
  })
  .strict();
const linesSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            category: z.enum(CATEGORIES),
            description: z.string().trim().min(1, 'Describe the charge').max(300),
            quantity: z.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1').max(10_000),
            unitPricePaise: paise,
          })
          .strict(),
      )
      .max(200),
    notes: text(1000).optional(),
  })
  .strict();
const paymentSchema = z
  .object({
    amountPaise: z.number().int().min(1, 'Enter an amount above zero').max(MAX_PAISE),
    method: z.enum(METHODS),
    reference: text(100).optional(),
    paidDate: date.optional(),
    paidTime: clock.optional(),
  })
  .strict();
const refundSchema = z
  .object({
    amountPaise: z.number().int().min(1, 'Enter an amount above zero').max(MAX_PAISE),
    method: z.enum(METHODS),
    reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500),
    reference: text(100).optional(),
  })
  .strict();
const adjustmentSchema = z
  .object({
    amountPaise: z.number().int().min(-MAX_PAISE).max(MAX_PAISE).refine((n) => n !== 0, 'Amount cannot be zero'),
    kind: z.enum(['discount', 'write_off', 'correction']),
    reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500),
  })
  .strict();
const cancelSchema = z.object({ reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500) }).strict();
const listSchema = z.object({
  status: z.enum(['draft', 'unpaid', 'all']).default('unpaid'),
  patientId: z.coerce.number().int().min(1).optional(),
});
const SETTING_KEYS = [
  'clinicName',
  'address',
  'phone',
  'doctorName',
  'registrationNo',
  'clinicTagline',
  'email',
  'website',
  'doctorQualifications',
  'headerLayout',
  'footerText',
  'showLogoOnPrint',
  'showSignatureOnPrint',
  'preprintedStationery',
  'topMarginMm',
  'stampText',
  'logoDataUrl',
  'signatureDataUrl',
] as const;
const settingsSchema = z
  .object({
    clinicName: z.string().trim().max(300).optional(),
    address: z.string().trim().max(600).optional(),
    phone: z.string().trim().max(150).optional(),
    doctorName: z.string().trim().max(300).optional(),
    registrationNo: z.string().trim().max(150).optional(),
    clinicTagline: z.string().trim().max(300).optional(),
    email: z.string().trim().max(150).optional(),
    website: z.string().trim().max(150).optional(),
    doctorQualifications: z.string().trim().max(300).optional(),
    headerLayout: z.enum(['centered', 'split', 'modern']).or(z.literal('')).optional(),
    footerText: z.string().trim().max(600).optional(),
    showLogoOnPrint: z.enum(['0', '1']).or(z.literal('')).optional(),
    showSignatureOnPrint: z.enum(['0', '1']).or(z.literal('')).optional(),
    preprintedStationery: z.enum(['0', '1']).or(z.literal('')).optional(),
    topMarginMm: z.string().regex(/^\d{0,3}$/, 'Margin must be 0 to 999 mm').optional(),
    stampText: z.string().trim().max(200).optional(),
    logoDataUrl: z.string().max(2_500_000).optional(),
    signatureDataUrl: z.string().max(2_500_000).optional(),
  })
  .strict();

type Row = Record<string, unknown>;

interface Totals {
  linesPaise: number;
  adjustmentsPaise: number;
  totalPaise: number;
  paidPaise: number;
  refundedPaise: number;
  netPaidPaise: number;
  balancePaise: number;
}

export function totalsOf(db: DB, invoiceId: number): Totals {
  const one = (sql: string) => (db.prepare(sql).get(invoiceId) as { v: number | null }).v ?? 0;
  const linesPaise = one('SELECT SUM(amount_paise) AS v FROM invoice_lines WHERE invoice_id = ?');
  const adjustmentsPaise = one('SELECT SUM(amount_paise) AS v FROM adjustments WHERE invoice_id = ?');
  const paidPaise = one("SELECT SUM(amount_paise) AS v FROM payments WHERE invoice_id = ? AND kind = 'payment'");
  const refundedPaise = one("SELECT SUM(amount_paise) AS v FROM payments WHERE invoice_id = ? AND kind = 'refund'");
  const totalPaise = linesPaise + adjustmentsPaise;
  const netPaidPaise = paidPaise - refundedPaise;
  return { linesPaise, adjustmentsPaise, totalPaise, paidPaise, refundedPaise, netPaidPaise, balancePaise: totalPaise - netPaidPaise };
}

function paymentState(status: string, t: Totals): 'draft' | 'cancelled' | 'unpaid' | 'part_paid' | 'paid' | 'credit' {
  if (status === 'draft' || status === 'cancelled') return status;
  if (t.balancePaise < 0) return 'credit';
  if (t.balancePaise === 0) return t.totalPaise === 0 ? 'unpaid' : 'paid';
  return t.netPaidPaise > 0 ? 'part_paid' : 'unpaid';
}

export function registerBillingRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const tz = cfg.timezone;
  const instant = makeInstant(tz);
  const num = (raw: unknown, what = 'Invoice') => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw notFound(what);
    return n;
  };
  const stamp = (iso: string | null, prefix: string, o: Row) => {
    o[`${prefix}Date`] = iso ? localDate(new Date(iso), tz) : null;
    o[`${prefix}Time`] = iso ? localTime(iso, tz) : null;
  };

  const SELECT = `
    SELECT i.*, p.patient_number, p.full_name AS patient_name, cu.full_name AS created_by_name,
           a.admission_number, v.visit_at
      FROM invoices i JOIN patients p ON p.id = i.patient_id JOIN users cu ON cu.id = i.created_by
      LEFT JOIN admissions a ON a.id = i.admission_id LEFT JOIN visits v ON v.id = i.visit_id`;

  function summary(r: Row): Row {
    const o = camelize(r);
    const t = totalsOf(db, r.id as number);
    Object.assign(o, t);
    o.paymentState = paymentState(r.status as string, t);
    stamp(r.issued_at as string | null, 'issued', o);
    stamp(r.visit_at as string | null, 'visit', o);
    return o;
  }

  function detail(id: number, role: Role): Row {
    const r = db.prepare(`${SELECT} WHERE i.id = ?`).get(id) as Row | undefined;
    if (!r) throw notFound('Invoice');
    const o = summary(r);
    o.lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY position').all(id).map((x) => camelize(x as Row));
    o.adjustments = (
      db.prepare('SELECT a.*, u.full_name AS authorised_by_name FROM adjustments a JOIN users u ON u.id = a.authorised_by WHERE a.invoice_id = ? ORDER BY a.id').all(id) as Row[]
    ).map((x) => {
      const y = camelize(x);
      stamp(x.created_at as string, 'created', y);
      return y;
    });
    o.payments = (
      db.prepare('SELECT p.*, u.full_name AS received_by_name FROM payments p JOIN users u ON u.id = p.received_by WHERE p.invoice_id = ? ORDER BY p.paid_at, p.id').all(id) as Row[]
    ).map((x) => {
      const y = camelize(x);
      stamp(x.paid_at as string, 'paid', y);
      return y;
    });
    stamp(r.cancelled_at as string | null, 'cancelled', o);
    o.canAuthorise = can(role, 'billing:authorise');
    return o;
  }

  // ---------- Clinic details (printed on invoices and receipts) ----------

  app.get('/api/settings', async (req) => {
    requireUser(req);
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const out: Record<string, string> = Object.fromEntries(SETTING_KEYS.map((k) => [k, '']));
    for (const r of rows) out[r.key] = r.value;
    return out;
  });

  app.put('/api/settings', { bodyLimit: 3_000_000 }, async (req) => {
    const user = requirePerm(req, 'settings:manage');
    const body = parse(settingsSchema, req.body) as Record<string, string>;
    tx(db, () => {
      for (const [k, v] of Object.entries(body)) {
        db.prepare('INSERT INTO settings(key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(k, v, nowIso());
      }
      const auditDetail: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) {
        if (k === 'logoDataUrl' && v && v.length > 50) {
          auditDetail[k] = '[image data attached]';
        } else if (k === 'signatureDataUrl' && v && v.length > 50) {
          auditDetail[k] = '[signature data attached]';
        } else {
          auditDetail[k] = v;
        }
      }
      audit(db, { actorId: user.id, action: 'settings.update', entity: 'settings', entityId: 0, detail: auditDetail });
    });
    return { ok: true };
  });

  // ---------- Invoices ----------

  app.post('/api/invoices', async (req, reply) => {
    const user = requirePerm(req, 'invoice:write');
    const b = parse(createSchema, req.body);
    const id = tx(db, () => {
      if (!db.prepare('SELECT 1 FROM patients WHERE id = ?').get(b.patientId)) throw notFound('Patient');
      if (b.visitId && !db.prepare('SELECT 1 FROM visits WHERE id = ? AND patient_id = ?').get(b.visitId, b.patientId)) {
        throw badRequest('That visit does not belong to this patient', [{ field: 'visitId', message: 'Wrong patient' }]);
      }
      if (b.admissionId && !db.prepare('SELECT 1 FROM admissions WHERE id = ? AND patient_id = ?').get(b.admissionId, b.patientId)) {
        throw badRequest('That admission does not belong to this patient', [{ field: 'admissionId', message: 'Wrong patient' }]);
      }
      const now = nowIso();
      const r = db
        .prepare('INSERT INTO invoices(patient_id, visit_id, admission_id, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(b.patientId, b.visitId ?? null, b.admissionId ?? null, b.notes ?? null, user.id, now, now);
      const iid = Number(r.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'invoice.create', entity: 'invoice', entityId: iid, detail: { patientId: b.patientId, visitId: b.visitId, admissionId: b.admissionId } });
      return iid;
    });
    return reply.status(201).send(detail(id, user.role));
  });

  app.get('/api/invoices', async (req) => {
    const user = requirePerm(req, 'billing:read');
    const q = parse(listSchema, req.query);
    const rows = db
      .prepare(`${SELECT} ${q.patientId ? 'WHERE i.patient_id = ?' : ''} ORDER BY i.created_at DESC, i.id DESC LIMIT 500`)
      .all(...(q.patientId ? [q.patientId] : [])) as Row[];
    const out = rows.map(summary).filter((o) => {
      if (q.status === 'all') return true;
      if (q.status === 'draft') return o.status === 'draft';
      return o.status === 'issued' && (o.balancePaise as number) !== 0;
    });
    void user;
    return out;
  });

  app.get('/api/patients/:id/invoices', async (req) => {
    requirePerm(req, 'billing:read');
    const pid = num((req.params as { id: string }).id, 'Patient');
    return (db.prepare(`${SELECT} WHERE i.patient_id = ? ORDER BY i.created_at DESC, i.id DESC`).all(pid) as Row[]).map(summary);
  });

  app.get('/api/invoices/:id', async (req) => {
    const user = requirePerm(req, 'billing:read');
    return detail(num((req.params as { id: string }).id), user.role);
  });

  app.put('/api/invoices/:id/lines', async (req) => {
    const user = requirePerm(req, 'invoice:write');
    const id = num((req.params as { id: string }).id);
    const b = parse(linesSchema, req.body);
    tx(db, () => {
      const inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(id) as { status: string } | undefined;
      if (!inv) throw notFound('Invoice');
      if (inv.status !== 'draft') throw conflict('This invoice has been issued. Use an adjustment to change what is owed.');
      db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(id);
      const ins = db.prepare('INSERT INTO invoice_lines(invoice_id, position, category, description, quantity, unit_price_paise, amount_paise) VALUES (?,?,?,?,?,?,?)');
      b.lines.forEach((l, i) => ins.run(id, i + 1, l.category, l.description, l.quantity, l.unitPricePaise, l.quantity * l.unitPricePaise));
      if (b.notes !== undefined) db.prepare('UPDATE invoices SET notes = ? WHERE id = ?').run(b.notes, id);
      db.prepare('UPDATE invoices SET updated_at = ? WHERE id = ?').run(nowIso(), id);
      const total = totalsOf(db, id).linesPaise;
      if (total > MAX_PAISE) throw badRequest('The invoice total is unrealistically large; check the amounts');
      audit(db, { actorId: user.id, action: 'invoice.lines', entity: 'invoice', entityId: id, detail: { lines: b.lines.length, totalPaise: total } });
    });
    return detail(id, user.role);
  });

  app.post('/api/invoices/:id/issue', async (req) => {
    const user = requirePerm(req, 'invoice:write');
    const id = num((req.params as { id: string }).id);
    tx(db, () => {
      const inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(id) as { status: string } | undefined;
      if (!inv) throw notFound('Invoice');
      if (inv.status !== 'draft') throw badRequest('This invoice has already been issued');
      const t = totalsOf(db, id);
      if (t.linesPaise <= 0) throw badRequest('Add at least one charge with an amount before issuing');
      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'invoice'").run();
      const n = (db.prepare("SELECT value FROM counters WHERE name = 'invoice'").get() as { value: number }).value;
      const number = 'INV' + String(n).padStart(6, '0');
      const now = nowIso();
      db.prepare("UPDATE invoices SET status = 'issued', invoice_number = ?, issued_at = ?, updated_at = ? WHERE id = ?").run(number, now, now, id);
      audit(db, { actorId: user.id, action: 'invoice.issue', entity: 'invoice', entityId: id, detail: { number, totalPaise: t.linesPaise } });
    });
    return detail(id, user.role);
  });

  app.delete('/api/invoices/:id', async (req) => {
    const user = requirePerm(req, 'invoice:write');
    const id = num((req.params as { id: string }).id);
    tx(db, () => {
      const inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(id) as { status: string } | undefined;
      if (!inv) throw notFound('Invoice');
      if (inv.status !== 'draft') throw conflict('Only a draft can be discarded. An issued invoice is cancelled instead.');
      db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
      audit(db, { actorId: user.id, action: 'invoice.discard', entity: 'invoice', entityId: id });
    });
    return { id, discarded: true };
  });

  app.post('/api/invoices/:id/payments', async (req, reply) => {
    const user = requirePerm(req, 'payment:take');
    const id = num((req.params as { id: string }).id);
    const b = parse(paymentSchema, req.body);
    const paidAt = instant(b.paidDate, b.paidTime, 'payment', 'paidDate');
    tx(db, () => {
      const inv = db.prepare('SELECT status, issued_at FROM invoices WHERE id = ?').get(id) as { status: string; issued_at: string } | undefined;
      if (!inv) throw notFound('Invoice');
      if (inv.status !== 'issued') throw badRequest(inv.status === 'draft' ? 'Issue the invoice before taking payment' : 'This invoice was cancelled');
      if (paidAt < inv.issued_at) throw badRequest('A payment cannot be dated before the invoice was issued', [{ field: 'paidDate', message: 'Before the invoice date' }]);
      const t = totalsOf(db, id);
      if (b.amountPaise > t.balancePaise) {
        throw badRequest(`The payment is more than the balance due (${(t.balancePaise / 100).toFixed(2)})`, [{ field: 'amountPaise', message: 'More than the balance' }]);
      }
      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'receipt'").run();
      const n = (db.prepare("SELECT value FROM counters WHERE name = 'receipt'").get() as { value: number }).value;
      const receipt = 'R' + String(n).padStart(6, '0');
      db.prepare("INSERT INTO payments(invoice_id, kind, receipt_number, amount_paise, method, reference, paid_at, received_by, created_at) VALUES (?,'payment',?,?,?,?,?,?,?)").run(
        id, receipt, b.amountPaise, b.method, b.reference ?? null, paidAt, user.id, nowIso(),
      );
      audit(db, { actorId: user.id, action: 'payment.record', entity: 'invoice', entityId: id, detail: { receipt, amountPaise: b.amountPaise, method: b.method } });
    });
    return reply.status(201).send(detail(id, user.role));
  });

  app.post('/api/invoices/:id/refunds', async (req, reply) => {
    const user = requirePerm(req, 'billing:authorise');
    const id = num((req.params as { id: string }).id);
    const b = parse(refundSchema, req.body);
    tx(db, () => {
      const inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(id) as { status: string } | undefined;
      if (!inv) throw notFound('Invoice');
      if (inv.status === 'draft') throw badRequest('Nothing has been paid on a draft');
      const t = totalsOf(db, id);
      if (b.amountPaise > t.netPaidPaise) {
        throw badRequest(`A refund cannot be more than what has been paid and not yet refunded (${(t.netPaidPaise / 100).toFixed(2)})`, [{ field: 'amountPaise', message: 'More than was paid' }]);
      }
      // The trigger only allows payments on issued invoices; refunds on a cancelled invoice are not needed because cancelling requires nothing outstanding.
      if (inv.status !== 'issued') throw badRequest('This invoice was cancelled');
      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'refund'").run();
      const n = (db.prepare("SELECT value FROM counters WHERE name = 'refund'").get() as { value: number }).value;
      const number = 'F' + String(n).padStart(6, '0');
      db.prepare("INSERT INTO payments(invoice_id, kind, receipt_number, amount_paise, method, reference, reason, paid_at, received_by, created_at) VALUES (?,'refund',?,?,?,?,?,?,?,?)").run(
        id, number, b.amountPaise, b.method, b.reference ?? null, b.reason, nowIso(), user.id, nowIso(),
      );
      audit(db, { actorId: user.id, action: 'refund.record', entity: 'invoice', entityId: id, detail: { number, amountPaise: b.amountPaise, reason: b.reason } });
    });
    return reply.status(201).send(detail(id, user.role));
  });

  app.post('/api/invoices/:id/adjustments', async (req, reply) => {
    const user = requirePerm(req, 'billing:authorise');
    const id = num((req.params as { id: string }).id);
    const b = parse(adjustmentSchema, req.body);
    tx(db, () => {
      const inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(id) as { status: string } | undefined;
      if (!inv) throw notFound('Invoice');
      if (inv.status !== 'issued') throw badRequest('Adjustments apply to an issued invoice');
      if (b.kind !== 'correction' && b.amountPaise > 0) throw badRequest('A discount or write-off must reduce the bill (enter a negative amount)', [{ field: 'amountPaise', message: 'Must be negative' }]);
      const t = totalsOf(db, id);
      if (t.totalPaise + b.amountPaise < 0) throw badRequest('That would make the invoice total negative', [{ field: 'amountPaise', message: 'Larger than the invoice total' }]);
      db.prepare('INSERT INTO adjustments(invoice_id, amount_paise, kind, reason, authorised_by, created_at) VALUES (?,?,?,?,?,?)').run(id, b.amountPaise, b.kind, b.reason, user.id, nowIso());
      audit(db, { actorId: user.id, action: 'invoice.adjust', entity: 'invoice', entityId: id, detail: { amountPaise: b.amountPaise, kind: b.kind, reason: b.reason } });
    });
    return reply.status(201).send(detail(id, user.role));
  });

  app.post('/api/invoices/:id/cancel', async (req) => {
    const user = requirePerm(req, 'billing:authorise');
    const id = num((req.params as { id: string }).id);
    const b = parse(cancelSchema, req.body);
    tx(db, () => {
      const inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(id) as { status: string } | undefined;
      if (!inv) throw notFound('Invoice');
      if (inv.status !== 'issued') throw badRequest('Only an issued invoice can be cancelled');
      if (totalsOf(db, id).netPaidPaise !== 0) throw conflict('Money has been received on this invoice. Refund it in full before cancelling.');
      const now = nowIso();
      db.prepare("UPDATE invoices SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?").run(now, b.reason, now, id);
      audit(db, { actorId: user.id, action: 'invoice.cancel', entity: 'invoice', entityId: id, detail: { reason: b.reason } });
    });
    return detail(id, user.role);
  });
}
