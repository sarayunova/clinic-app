import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePerm, requireUser, type Ctx } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';

function assertCanManageLab(req: FastifyRequest) {
  const user = requireUser(req);
  if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
    throw forbidden('Only clinical staff can manage laboratory investigations');
  }
  return user;
}

const optNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const labCategoryEnum = z.enum([
  'hematology',
  'biochemistry',
  'serology',
  'urine',
  'microbiology',
  'hormones',
  'general',
]);

const labPriorityEnum = z.enum(['routine', 'urgent', 'stat']);
const labOrderStatusEnum = z.enum(['ordered', 'sample_collected', 'sent_to_lab', 'completed', 'cancelled']);
const labResultFlagEnum = z.enum(['normal', 'low', 'high', 'critical', 'abnormal', 'pending']);
const labResultStatusEnum = z.enum(['pending', 'completed', 'cancelled']);

export const createLabOrderSchema = z
  .object({
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    priority: labPriorityEnum.default('routine'),
    visitId: z.number().int().positive().nullable().optional(),
    clinicalNotes: optNullableString(1000),
    panelName: optNullableString(200),
    items: z
      .array(
        z.object({
          testName: z.string().trim().min(1, 'Test name is required').max(200),
          category: labCategoryEnum.default('general'),
          unit: optNullableString(50),
          referenceRange: optNullableString(200),
        })
      )
      .min(1, 'At least one test must be ordered'),
  })
  .strict();

export const patchLabOrderStatusSchema = z
  .object({
    status: labOrderStatusEnum,
    cancellationReason: optNullableString(500),
  })
  .strict();

export const patchLabResultSchema = z
  .object({
    resultValue: optNullableString(500),
    numericValue: z.number().nullable().optional(),
    unit: optNullableString(50),
    referenceRange: optNullableString(200),
    flag: labResultFlagEnum.optional(),
    status: labResultStatusEnum.optional(),
    notes: optNullableString(1000),
    reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
    attachmentId: z.number().int().positive().nullable().optional(),
  })
  .strict();

type DbLabOrderRow = {
  id: number;
  patient_id: number;
  visit_id: number | null;
  order_number: string;
  order_date: string;
  priority: string;
  status: string;
  clinical_notes: string | null;
  panel_name: string | null;
  ordered_by: number;
  cancelled_by: number | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  ordered_by_name?: string | null;
  patient_number?: string;
  patient_name?: string;
  date_of_birth?: string | null;
  patient_phone?: string | null;
};

type DbLabResultRow = {
  id: number;
  order_id: number;
  patient_id: number;
  test_name: string;
  category: string;
  result_value: string | null;
  numeric_value: number | null;
  unit: string | null;
  reference_range: string | null;
  flag: string;
  status: string;
  notes: string | null;
  reported_date: string | null;
  attachment_id: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by_name?: string | null;
  attachment_title?: string | null;
  attachment_original_name?: string | null;
};

function mapResultRow(r: DbLabResultRow) {
  return {
    id: r.id,
    orderId: r.order_id,
    patientId: r.patient_id,
    testName: r.test_name,
    category: r.category,
    resultValue: r.result_value,
    numericValue: r.numeric_value,
    unit: r.unit,
    referenceRange: r.reference_range,
    flag: r.flag,
    status: r.status,
    notes: r.notes,
    reportedDate: r.reported_date,
    attachmentId: r.attachment_id,
    attachmentTitle: r.attachment_title ?? null,
    attachmentOriginalName: r.attachment_original_name ?? null,
    reviewedByName: r.reviewed_by_name ?? null,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapOrderRow(r: DbLabOrderRow, items: DbLabResultRow[]) {
  return {
    id: r.id,
    patientId: r.patient_id,
    visitId: r.visit_id,
    orderNumber: r.order_number,
    orderDate: r.order_date,
    priority: r.priority,
    status: r.status,
    clinicalNotes: r.clinical_notes,
    panelName: r.panel_name,
    orderedByName: r.ordered_by_name ?? null,
    cancellationReason: r.cancellation_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    patientNumber: r.patient_number,
    patientName: r.patient_name,
    dateOfBirth: r.date_of_birth,
    patientPhone: r.patient_phone,
    items: items.map(mapResultRow),
  };
}

export function registerLabRoutes(app: FastifyInstance, { db }: Ctx): void {
  // GET /api/patients/:id/lab-orders
  app.get('/api/patients/:id/lab-orders', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const orders = db
      .prepare(
        `SELECT o.*, u.full_name AS ordered_by_name
         FROM patient_lab_orders o
         LEFT JOIN users u ON u.id = o.ordered_by
         WHERE o.patient_id = ?
         ORDER BY o.order_date DESC, o.id DESC`
      )
      .all(patientId) as DbLabOrderRow[];

    const orderIds = orders.map((o) => o.id);
    let allItems: DbLabResultRow[] = [];
    if (orderIds.length > 0) {
      allItems = db
        .prepare(
          `SELECT r.*,
                  u.full_name AS reviewed_by_name,
                  a.title AS attachment_title,
                  a.original_name AS attachment_original_name
           FROM patient_lab_results r
           LEFT JOIN users u ON u.id = r.reviewed_by
           LEFT JOIN attachments a ON a.id = r.attachment_id AND a.voided_at IS NULL
           WHERE r.order_id IN (${orderIds.map(() => '?').join(', ')})
           ORDER BY r.id ASC`
        )
        .all(...orderIds) as DbLabResultRow[];
    }

    const itemsByOrder = new Map<number, DbLabResultRow[]>();
    for (const item of allItems) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    return {
      patientId,
      orders: orders.map((o) => mapOrderRow(o, itemsByOrder.get(o.id) ?? [])),
    };
  });

  // GET /api/lab-orders/:id
  app.get('/api/lab-orders/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid lab order ID');

    const order = db
      .prepare(
        `SELECT o.*,
                p.patient_number,
                p.full_name AS patient_name,
                p.date_of_birth,
                p.phone AS patient_phone,
                u.full_name AS ordered_by_name
         FROM patient_lab_orders o
         JOIN patients p ON p.id = o.patient_id
         LEFT JOIN users u ON u.id = o.ordered_by
         WHERE o.id = ?`
      )
      .get(id) as DbLabOrderRow | undefined;

    if (!order) throw notFound('Lab order not found');

    const items = db
      .prepare(
        `SELECT r.*,
                u.full_name AS reviewed_by_name,
                a.title AS attachment_title,
                a.original_name AS attachment_original_name
         FROM patient_lab_results r
         LEFT JOIN users u ON u.id = r.reviewed_by
         LEFT JOIN attachments a ON a.id = r.attachment_id AND a.voided_at IS NULL
         WHERE r.order_id = ?
         ORDER BY r.id ASC`
      )
      .all(id) as DbLabResultRow[];

    return mapOrderRow(order, items);
  });

  // POST /api/patients/:id/lab-orders
  app.post('/api/patients/:id/lab-orders', async (req, reply) => {
    const user = assertCanManageLab(req);
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) throw badRequest('Invalid patient ID');

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const b = parse(createLabOrderSchema, req.body);
    const now = nowIso();

    const createdOrder = tx(db, () => {
      // Generate sequential order number: LAB-YYYYMM-XXXX
      const ym = b.orderDate.replace(/-/g, '').slice(0, 6);
      const prefix = `LAB-${ym}-`;
      const last = db
        .prepare("SELECT order_number FROM patient_lab_orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1")
        .get(`${prefix}%`) as { order_number: string } | undefined;

      let nextNum = 1;
      if (last) {
        const lastSeq = parseInt(last.order_number.replace(prefix, ''), 10);
        if (!isNaN(lastSeq)) nextNum = lastSeq + 1;
      }
      const orderNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

      const res = db
        .prepare(
          `INSERT INTO patient_lab_orders (
            patient_id, visit_id, order_number, order_date, priority, status,
            clinical_notes, panel_name, ordered_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'ordered', ?, ?, ?, ?, ?)`
        )
        .run(
          patientId,
          b.visitId ?? null,
          orderNumber,
          b.orderDate,
          b.priority,
          b.clinicalNotes ?? null,
          b.panelName ?? null,
          user.id,
          now,
          now
        );

      const orderId = Number(res.lastInsertRowid);

      const insertItem = db.prepare(
        `INSERT INTO patient_lab_results (
          order_id, patient_id, test_name, category, unit, reference_range,
          flag, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)`
      );

      for (const it of b.items) {
        insertItem.run(
          orderId,
          patientId,
          it.testName,
          it.category,
          it.unit ?? null,
          it.referenceRange ?? null,
          now,
          now
        );
      }

      audit(db, {
        actorId: user.id,
        action: 'lab.order',
        entity: 'patient',
        entityId: patientId,
        detail: {
          orderId,
          orderNumber,
          priority: b.priority,
          panelName: b.panelName,
          testCount: b.items.length,
        },
      });

      return orderId;
    });

    const fullOrder = db
      .prepare('SELECT o.*, u.full_name AS ordered_by_name FROM patient_lab_orders o LEFT JOIN users u ON u.id = o.ordered_by WHERE o.id = ?')
      .get(createdOrder) as DbLabOrderRow;
    const items = db.prepare('SELECT * FROM patient_lab_results WHERE order_id = ?').all(createdOrder) as DbLabResultRow[];

    return reply.status(201).send(mapOrderRow(fullOrder, items));
  });

  // PATCH /api/lab-orders/:id/status
  app.patch('/api/lab-orders/:id/status', async (req) => {
    const user = assertCanManageLab(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid lab order ID');

    const existing = db.prepare('SELECT * FROM patient_lab_orders WHERE id = ?').get(id) as DbLabOrderRow | undefined;
    if (!existing) throw notFound('Lab order not found');

    const b = parse(patchLabOrderStatusSchema, req.body);
    const now = nowIso();

    tx(db, () => {
      if (b.status === 'cancelled') {
        db.prepare(
          'UPDATE patient_lab_orders SET status = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?'
        ).run(b.status, user.id, b.cancellationReason ?? 'Cancelled by clinician', now, id);

        db.prepare("UPDATE patient_lab_results SET status = 'cancelled', updated_at = ? WHERE order_id = ?").run(
          now,
          id
        );

        audit(db, {
          actorId: user.id,
          action: 'lab.cancel',
          entity: 'patient',
          entityId: existing.patient_id,
          detail: {
            orderId: id,
            orderNumber: existing.order_number,
            reason: b.cancellationReason,
          },
        });
      } else {
        db.prepare('UPDATE patient_lab_orders SET status = ?, updated_at = ? WHERE id = ?').run(b.status, now, id);

        audit(db, {
          actorId: user.id,
          action: 'lab.status',
          entity: 'patient',
          entityId: existing.patient_id,
          detail: {
            orderId: id,
            orderNumber: existing.order_number,
            previousStatus: existing.status,
            newStatus: b.status,
          },
        });
      }
    });

    const updated = db
      .prepare('SELECT o.*, u.full_name AS ordered_by_name FROM patient_lab_orders o LEFT JOIN users u ON u.id = o.ordered_by WHERE o.id = ?')
      .get(id) as DbLabOrderRow;
    const items = db.prepare('SELECT * FROM patient_lab_results WHERE order_id = ?').all(id) as DbLabResultRow[];

    return mapOrderRow(updated, items);
  });

  // PATCH /api/lab-results/:id
  app.patch('/api/lab-results/:id', async (req) => {
    const user = assertCanManageLab(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid lab result ID');

    const existing = db.prepare('SELECT * FROM patient_lab_results WHERE id = ?').get(id) as DbLabResultRow | undefined;
    if (!existing) throw notFound('Lab result not found');

    const b = parse(patchLabResultSchema, req.body);
    const now = nowIso();

    tx(db, () => {
      const fields: string[] = [];
      const values: (string | number | null)[] = [];

      const targetStatus = b.status ?? (b.resultValue ? 'completed' : existing.status);

      if ('resultValue' in b) {
        fields.push('result_value = ?');
        values.push(b.resultValue ?? null);
      }
      if ('numericValue' in b) {
        fields.push('numeric_value = ?');
        values.push(b.numericValue ?? null);
      }
      if ('unit' in b) {
        fields.push('unit = ?');
        values.push(b.unit ?? null);
      }
      if ('referenceRange' in b) {
        fields.push('reference_range = ?');
        values.push(b.referenceRange ?? null);
      }
      if ('flag' in b) {
        fields.push('flag = ?');
        values.push(b.flag ?? 'normal');
      }
      if ('notes' in b) {
        fields.push('notes = ?');
        values.push(b.notes ?? null);
      }
      if ('reportedDate' in b) {
        fields.push('reported_date = ?');
        values.push(b.reportedDate ?? null);
      }
      if ('attachmentId' in b) {
        fields.push('attachment_id = ?');
        values.push(b.attachmentId ?? null);
      }

      fields.push('status = ?', 'reviewed_by = ?', 'reviewed_at = ?', 'updated_at = ?');
      values.push(targetStatus, user.id, now, now, id);

      db.prepare(`UPDATE patient_lab_results SET ${fields.join(', ')} WHERE id = ?`).run(...values);

      // Check if all items in this order are now completed
      const pendingItems = db
        .prepare("SELECT COUNT(*) AS c FROM patient_lab_results WHERE order_id = ? AND status = 'pending'")
        .get(existing.order_id) as { c: number };

      if (pendingItems.c === 0) {
        db.prepare("UPDATE patient_lab_orders SET status = 'completed', updated_at = ? WHERE id = ?").run(
          now,
          existing.order_id
        );
      }

      audit(db, {
        actorId: user.id,
        action: 'lab.result',
        entity: 'patient',
        entityId: existing.patient_id,
        detail: {
          resultId: id,
          orderId: existing.order_id,
          testName: existing.test_name,
          resultValue: b.resultValue,
          flag: b.flag,
        },
      });
    });

    const updated = db
      .prepare(
        `SELECT r.*,
                u.full_name AS reviewed_by_name,
                a.title AS attachment_title,
                a.original_name AS attachment_original_name
         FROM patient_lab_results r
         LEFT JOIN users u ON u.id = r.reviewed_by
         LEFT JOIN attachments a ON a.id = r.attachment_id AND a.voided_at IS NULL
         WHERE r.id = ?`
      )
      .get(id) as DbLabResultRow;

    return mapResultRow(updated);
  });

  // POST /api/lab-orders/:id/print
  app.post('/api/lab-orders/:id/print', async (req) => {
    const user = requirePerm(req, 'patient:read_clinical');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid lab order ID');

    const existing = db.prepare('SELECT * FROM patient_lab_orders WHERE id = ?').get(id) as DbLabOrderRow | undefined;
    if (!existing) throw notFound('Lab order not found');

    audit(db, {
      actorId: user.id,
      action: 'lab.print',
      entity: 'patient',
      entityId: existing.patient_id,
      detail: {
        orderId: id,
        orderNumber: existing.order_number,
      },
    });

    return { ok: true };
  });
}
