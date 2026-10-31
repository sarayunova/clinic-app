import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { ACTION_LABELS, actionLabel } from '../auditLabels.js';
import { badRequest, parse } from '../errors.js';
import { isRealDate, localDate, localTime, localToUtcIso } from '../time.js';

const date = z.string().refine(isRealDate, 'Must be a valid date (YYYY-MM-DD)');
const id = z.coerce.number().int().min(1);
const querySchema = z.object({
  entity: z.string().max(40).optional(),
  entityId: z.string().max(40).optional(),
  patientId: id.optional(),
  actorId: id.optional(),
  /** An exact action ("patient.view") or a group ("patient.*"). */
  action: z.string().max(60).regex(/^[a-z_]+(\.([a-z_]+|\*))?$/, 'Invalid action').optional(),
  from: date.optional(),
  to: date.optional(),
  before: id.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/** The patient an event is about, found through the record it touched. */
const PATIENT_OF = `CASE a.entity
  WHEN 'patient' THEN CAST(a.entity_id AS INTEGER)
  WHEN 'visit' THEN (SELECT patient_id FROM visits WHERE id = CAST(a.entity_id AS INTEGER))
  WHEN 'admission' THEN (SELECT patient_id FROM admissions WHERE id = CAST(a.entity_id AS INTEGER))
  WHEN 'invoice' THEN (SELECT patient_id FROM invoices WHERE id = CAST(a.entity_id AS INTEGER))
  WHEN 'attachment' THEN (SELECT patient_id FROM attachments WHERE id = CAST(a.entity_id AS INTEGER))
END`;

type Row = Record<string, unknown>;

export function registerAuditRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  const tz = cfg.timezone;

  app.get('/api/audit', async (req) => {
    const user = requirePerm(req, 'audit:read');
    const q = parse(querySchema, req.query);
    const where: string[] = [];
    const args: (string | number)[] = [];
    const eq = (col: string, v: string | number | undefined) => {
      if (v !== undefined) {
        where.push(`${col} = ?`);
        args.push(v);
      }
    };
    eq('e.entity', q.entity);
    eq('e.entity_id', q.entityId);
    eq('e.patient_id', q.patientId);
    eq('e.actor_id', q.actorId);
    if (q.action) {
      if (q.action.endsWith('.*')) {
        where.push('e.action LIKE ?');
        args.push(q.action.slice(0, -1) + '%');
      } else {
        eq('e.action', q.action);
      }
    }
    if (q.from) {
      where.push('e.at >= ?');
      args.push(localToUtcIso(q.from, '00:00', tz)!);
    }
    if (q.to) {
      const next = new Date(Date.parse(q.to) + 86_400_000).toISOString().slice(0, 10); // inclusive end date
      where.push('e.at < ?');
      args.push(localToUtcIso(next, '00:00', tz)!);
    }
    if (q.from && q.to && q.from > q.to) throw badRequest('The start date is after the end date');
    if (q.before) {
      where.push('e.id < ?');
      args.push(q.before);
    }
    const rows = db
      .prepare(
        `SELECT e.*, p.full_name AS patient_name, p.patient_number
           FROM (SELECT a.id, a.at, a.action, a.entity, a.entity_id, a.detail, a.actor_id, u.full_name AS actor, ${PATIENT_OF} AS patient_id
                   FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id) e
           LEFT JOIN patients p ON p.id = e.patient_id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY e.id DESC LIMIT ?`,
      )
      .all(...args, q.limit) as Row[];

    // Looking at the audit log is itself recorded (first page of a search only, not "load more").
    if (!q.before) {
      const { before: _b, limit: _l, ...filters } = q;
      audit(db, { actorId: user.id, action: 'audit.view', entity: 'audit', detail: filters });
    }

    return rows.map((r) => ({
      id: r.id,
      at: r.at,
      atDate: localDate(new Date(r.at as string), tz),
      atTime: localTime(r.at as string, tz),
      action: r.action,
      label: actionLabel(r.action as string),
      entity: r.entity,
      entityId: r.entity_id,
      actor: r.actor ?? null,
      actorId: r.actor_id ?? null,
      patientId: r.patient_id ?? null,
      patientName: r.patient_name ?? null,
      patientNumber: r.patient_number ?? null,
      detail: r.detail ? JSON.parse(r.detail as string) : null,
    }));
  });

  /** Options for the filter drop-downs. */
  app.get('/api/audit/options', async (req) => {
    requirePerm(req, 'audit:read');
    const used = (db.prepare('SELECT DISTINCT action FROM audit_events ORDER BY action').all() as { action: string }[]).map((r) => r.action);
    const known = Object.keys(ACTION_LABELS);
    const actions = [...new Set([...known, ...used])].sort().map((value) => ({ value, label: actionLabel(value) }));
    const groups = [...new Set(actions.map((a) => a.value.split('.')[0]!))].sort();
    const actors = db.prepare('SELECT id, full_name AS name FROM users ORDER BY full_name').all() as { id: number; name: string }[];
    return { actions, groups, actors };
  });
}
