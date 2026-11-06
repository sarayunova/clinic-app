import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit } from '../audit.js';
import { conflict, notFound, parse } from '../errors.js';
import { can } from '../permissions.js';
import { nowIso } from '../time.js';
import { camelize } from '../util.js';

const text = (max: number) => z.string().trim().max(max).transform((s) => (s === '' ? null : s)).nullable();
const optText = (max: number) => text(max).optional();

const itemSchema = z
  .object({
    medicine: z.string().trim().min(1, 'Medicine name is required').max(200),
    strength: optText(100),
    dose: optText(100),
    route: optText(60),
    frequency: optText(100),
    duration: optText(100),
    instructions: optText(500),
  })
  .strict();

const itemsSchema = z.array(itemSchema).min(1, 'Add at least one medicine to the template').max(30);

const createSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    category: z.string().trim().min(1).max(60).default('General'),
    items: itemsSchema,
  })
  .strict();

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    items: itemsSchema.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to change');

const listQuery = z.object({ all: z.enum(['0', '1']).default('0') });

type Row = Record<string, unknown>;

function presentTemplate(row: Row) {
  const o = camelize(row);
  o.active = Boolean(row.active);
  o.items = JSON.parse(row.items_json as string);
  delete o.itemsJson;
  return o;
}

export function registerTemplateRoutes(app: FastifyInstance, { db }: Ctx): void {
  app.get('/api/prescription-templates', async (req) => {
    const user = requirePerm(req, 'visit:read');
    const q = parse(listQuery, req.query);
    const showAll = q.all === '1' && can(user.role, 'visit:write');
    const rows = db
      .prepare(
        `SELECT t.*, u.full_name AS created_by_name
           FROM prescription_templates t JOIN users u ON u.id = t.created_by
          ${showAll ? '' : 'WHERE t.active = 1'}
          ORDER BY t.category, t.name COLLATE NOCASE`,
      )
      .all() as Row[];

    return rows.map(presentTemplate);
  });

  app.post('/api/prescription-templates', async (req, reply) => {
    const user = requirePerm(req, 'visit:write');
    const b = parse(createSchema, req.body);

    const id = tx(db, () => {
      if (db.prepare('SELECT 1 FROM prescription_templates WHERE name = ? COLLATE NOCASE').get(b.name)) {
        throw conflict('A template with that name already exists', [{ field: 'name', message: 'Name already in use' }]);
      }
      const now = nowIso();
      const itemsJson = JSON.stringify(b.items);
      const r = db
        .prepare(
          'INSERT INTO prescription_templates(name, category, items_json, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)',
        )
        .run(b.name, b.category, itemsJson, user.id, now, now);
      const tid = Number(r.lastInsertRowid);
      audit(db, {
        actorId: user.id,
        action: 'template.create',
        entity: 'prescription_template',
        entityId: tid,
        detail: { name: b.name, category: b.category, itemCount: b.items.length },
      });
      return tid;
    });

    const row = db.prepare('SELECT * FROM prescription_templates WHERE id = ?').get(id) as Row;
    return reply.status(201).send(presentTemplate(row));
  });

  app.patch('/api/prescription-templates/:id', async (req) => {
    const user = requirePerm(req, 'visit:write');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) throw notFound('Prescription template');
    const b = parse(patchSchema, req.body);

    return tx(db, () => {
      const cur = db.prepare('SELECT * FROM prescription_templates WHERE id = ?').get(id) as Row | undefined;
      if (!cur) throw notFound('Prescription template');

      if (b.name && b.name.toLowerCase() !== (cur.name as string).toLowerCase()) {
        if (db.prepare('SELECT 1 FROM prescription_templates WHERE name = ? COLLATE NOCASE AND id <> ?').get(b.name, id)) {
          throw conflict('A template with that name already exists', [{ field: 'name', message: 'Name already in use' }]);
        }
      }

      const updates: string[] = [];
      const args: (string | number)[] = [];
      if (b.name !== undefined) { updates.push('name = ?'); args.push(b.name); }
      if (b.category !== undefined) { updates.push('category = ?'); args.push(b.category); }
      if (b.items !== undefined) { updates.push('items_json = ?'); args.push(JSON.stringify(b.items)); }
      if (b.active !== undefined) { updates.push('active = ?'); args.push(b.active ? 1 : 0); }
      updates.push('updated_at = ?');
      args.push(nowIso());
      args.push(id);

      db.prepare(`UPDATE prescription_templates SET ${updates.join(', ')} WHERE id = ?`).run(...args);

      audit(db, {
        actorId: user.id,
        action: 'template.update',
        entity: 'prescription_template',
        entityId: id,
        detail: b,
      });

      const updated = db.prepare('SELECT * FROM prescription_templates WHERE id = ?').get(id) as Row;
      return presentTemplate(updated);
    });
  });
}
