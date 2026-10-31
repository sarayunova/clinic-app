import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit } from '../audit.js';
import { badRequest, conflict, notFound, parse } from '../errors.js';
import { can } from '../permissions.js';
import { isRealDate, localDate, localTime, localToUtcIso, nowIso } from '../time.js';
import { camelize } from '../util.js';

const CATEGORIES = ['consultation', 'investigation', 'procedure', 'room_bed', 'other'] as const;
const MAX_PAISE = 1_000_000_000;
const name = z.string().trim().min(1, 'Enter a name').max(300);
const price = z.number().int('Price must be a whole number of paise').min(0).max(MAX_PAISE);

const createSchema = z.object({ category: z.enum(CATEGORIES), name, pricePaise: price }).strict();
const patchSchema = z
  .object({ category: z.enum(CATEGORIES), name, pricePaise: price, active: z.boolean() })
  .strict()
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to change');
const listSchema = z.object({ all: z.enum(['0', '1']).default('0') });
const reportSchema = z.object({ from: z.string().refine(isRealDate, 'Invalid date').optional(), to: z.string().refine(isRealDate, 'Invalid date').optional() });

type Row = Record<string, unknown>;
const MAX_DAYS = 366;
const MAX_LISTED = 500;

function addDays(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function registerPricingRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const tz = cfg.timezone;

  // ---------- Price list ----------

  app.get('/api/price-items', async (req) => {
    const user = requirePerm(req, 'billing:read');
    const q = parse(listSchema, req.query);
    // Switched-off items are only shown to someone who can manage the list.
    const all = q.all === '1' && can(user.role, 'pricelist:manage');
    const rows = db
      .prepare(`SELECT * FROM price_items ${all ? '' : 'WHERE active = 1'} ORDER BY category, name COLLATE NOCASE`)
      .all() as Row[];
    return rows.map(camelize);
  });

  app.post('/api/price-items', async (req, reply) => {
    const user = requirePerm(req, 'pricelist:manage');
    const b = parse(createSchema, req.body);
    const id = tx(db, () => {
      if (db.prepare('SELECT 1 FROM price_items WHERE category = ? AND name = ?').get(b.category, b.name)) {
        throw conflict('That item is already in the price list', [{ field: 'name', message: 'Already in the list' }]);
      }
      const now = nowIso();
      const r = db
        .prepare('INSERT INTO price_items(category, name, price_paise, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)')
        .run(b.category, b.name, b.pricePaise, user.id, now, now);
      const iid = Number(r.lastInsertRowid);
      audit(db, { actorId: user.id, action: 'price.create', entity: 'price_item', entityId: iid, detail: b });
      return iid;
    });
    return reply.status(201).send(camelize(db.prepare('SELECT * FROM price_items WHERE id = ?').get(id) as Row));
  });

  app.patch('/api/price-items/:id', async (req) => {
    const user = requirePerm(req, 'pricelist:manage');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) throw notFound('Price list item');
    const b = parse(patchSchema, req.body);
    tx(db, () => {
      const cur = db.prepare('SELECT * FROM price_items WHERE id = ?').get(id) as Row | undefined;
      if (!cur) throw notFound('Price list item');
      const next = {
        category: b.category ?? (cur.category as string),
        name: b.name ?? (cur.name as string),
        price_paise: b.pricePaise ?? (cur.price_paise as number),
        active: b.active === undefined ? (cur.active as number) : b.active ? 1 : 0,
      };
      const dup = db.prepare('SELECT id FROM price_items WHERE category = ? AND name = ? AND id <> ?').get(next.category, next.name, id);
      if (dup) throw conflict('That item is already in the price list', [{ field: 'name', message: 'Already in the list' }]);
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const k of Object.keys(next) as (keyof typeof next)[]) {
        if (next[k] !== cur[k]) changes[k] = { from: cur[k], to: next[k] };
      }
      if (Object.keys(changes).length === 0) return;
      db.prepare('UPDATE price_items SET category = ?, name = ?, price_paise = ?, active = ?, updated_at = ? WHERE id = ?').run(
        next.category, next.name, next.price_paise, next.active, nowIso(), id,
      );
      audit(db, { actorId: user.id, action: 'price.update', entity: 'price_item', entityId: id, detail: changes });
    });
    return camelize(db.prepare('SELECT * FROM price_items WHERE id = ?').get(id) as Row);
  });

  // ---------- Collection report ----------

  app.get('/api/billing/collections', async (req) => {
    const user = requirePerm(req, 'billing:read');
    const q = parse(reportSchema, req.query);
    const today = localDate(new Date(), tz);
    const from = q.from ?? q.to ?? today;
    const to = q.to ?? q.from ?? today;
    if (to < from) throw badRequest('The end date is before the start date', [{ field: 'to', message: 'Before the start date' }]);
    if (addDays(from, MAX_DAYS) < to) throw badRequest(`Choose a range of at most ${MAX_DAYS} days`, [{ field: 'to', message: 'Range too long' }]);
    // Whole clinic-local days: [start of "from", start of the day after "to").
    const startIso = localToUtcIso(from, '00:00', tz)!;
    const endIso = localToUtcIso(addDays(to, 1), '00:00', tz)!;

    const pays = db
      .prepare(
        `SELECT p.id, p.kind, p.receipt_number, p.amount_paise, p.method, p.reference, p.reason, p.paid_at,
                u.full_name AS received_by_name, i.id AS invoice_id, i.invoice_number, i.status AS invoice_status,
                pt.id AS patient_id, pt.patient_number, pt.full_name AS patient_name
           FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN patients pt ON pt.id = i.patient_id
           JOIN users u ON u.id = p.received_by
          WHERE p.paid_at >= ? AND p.paid_at < ? ORDER BY p.paid_at, p.id`,
      )
      .all(startIso, endIso) as Row[];

    interface Bucket { count: number; paidPaise: number; refundedPaise: number }
    const blank = (): Bucket => ({ count: 0, paidPaise: 0, refundedPaise: 0 });
    const total = blank();
    const byMethod = new Map<string, Bucket>();
    const byStaff = new Map<string, Bucket>();
    const byDay = new Map<string, Bucket>();
    const add = (m: Map<string, Bucket>, k: string, r: Row) => {
      const b = m.get(k) ?? blank();
      b.count += 1;
      if (r.kind === 'payment') b.paidPaise += r.amount_paise as number;
      else b.refundedPaise += r.amount_paise as number;
      m.set(k, b);
    };
    for (const r of pays) {
      add(new Map([['', total]]), '', r);
      add(byMethod, r.method as string, r);
      add(byStaff, r.received_by_name as string, r);
      add(byDay, localDate(new Date(r.paid_at as string), tz), r);
    }
    const flat = (m: Map<string, Bucket>) => [...m.entries()].map(([k, b]) => ({ key: k, ...b, netPaise: b.paidPaise - b.refundedPaise }));

    const issued = db
      .prepare(
        `SELECT i.id, (SELECT COALESCE(SUM(amount_paise),0) FROM invoice_lines WHERE invoice_id = i.id)
                    + (SELECT COALESCE(SUM(amount_paise),0) FROM adjustments WHERE invoice_id = i.id) AS total
           FROM invoices i WHERE i.issued_at >= ? AND i.issued_at < ?`,
      )
      .all(startIso, endIso) as { id: number; total: number }[];

    audit(db, { actorId: user.id, action: 'billing.report', entity: 'billing', detail: { from, to } });

    const listed = pays.slice(0, MAX_LISTED).map((r) => ({
      id: r.id,
      kind: r.kind,
      receiptNumber: r.receipt_number,
      amountPaise: r.amount_paise,
      method: r.method,
      reference: r.reference,
      reason: r.reason,
      date: localDate(new Date(r.paid_at as string), tz),
      time: localTime(r.paid_at as string, tz),
      receivedByName: r.received_by_name,
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number,
      patientId: r.patient_id,
      patientNumber: r.patient_number,
      patientName: r.patient_name,
    }));
    return {
      from,
      to,
      count: total.count,
      paidPaise: total.paidPaise,
      refundedPaise: total.refundedPaise,
      netPaise: total.paidPaise - total.refundedPaise,
      byMethod: flat(byMethod).map(({ key, ...r }) => ({ method: key, ...r })),
      byStaff: flat(byStaff).map(({ key, ...r }) => ({ name: key, ...r })),
      byDay: flat(byDay).map(({ key, ...r }) => ({ date: key, ...r })).sort((a, b) => a.date.localeCompare(b.date)),
      invoicesIssued: { count: issued.length, totalPaise: issued.reduce((n, r) => n + r.total, 0) },
      transactions: listed,
      truncated: pays.length > MAX_LISTED,
    };
  });
}
