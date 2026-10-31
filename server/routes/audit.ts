import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { parse } from '../errors.js';

const querySchema = z.object({
  entity: z.string().max(40).optional(),
  entityId: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export function registerAuditRoutes(app: FastifyInstance, { db }: Ctx): void {
  app.get('/api/audit', async (req) => {
    requirePerm(req, 'audit:read');
    const q = parse(querySchema, req.query);
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (q.entity) { where.push('a.entity = ?'); args.push(q.entity); }
    if (q.entityId) { where.push('a.entity_id = ?'); args.push(q.entityId); }
    const rows = db
      .prepare(
        `SELECT a.id, a.at, a.action, a.entity, a.entity_id AS entityId, a.detail, u.full_name AS actor
           FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY a.id DESC LIMIT ?`,
      )
      .all(...args, q.limit) as { detail: string | null }[];
    return rows.map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null }));
  });
}
