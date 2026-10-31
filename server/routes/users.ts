import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { assertStrongPassword, destroyUserSessions, hashPassword } from '../auth.js';
import { tx } from '../db.js';
import { audit, diff } from '../audit.js';
import { HttpError, conflict, notFound, parse } from '../errors.js';
import { ROLES } from '../permissions.js';
import { nowIso } from '../time.js';

const roleSchema = z.enum(ROLES as [string, ...string[]]);
const createSchema = z
  .object({
    username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dot, dash or underscore'),
    fullName: z.string().trim().min(2).max(100),
    role: roleSchema,
    password: z.string(),
  })
  .strict();
const patchSchema = z
  .object({ fullName: z.string().trim().min(2).max(100).optional(), role: roleSchema.optional(), active: z.boolean().optional() })
  .strict();
const resetSchema = z.object({ password: z.string() }).strict();

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: string;
  active: number;
  must_change_password: number;
  created_at: string;
}
const present = (r: UserRow) => ({
  id: r.id,
  username: r.username,
  fullName: r.full_name,
  role: r.role,
  active: r.active === 1,
  mustChangePassword: r.must_change_password === 1,
  createdAt: r.created_at,
});

export function registerUserRoutes(app: FastifyInstance, { db }: Ctx): void {
  const COLS = 'id, username, full_name, role, active, must_change_password, created_at';
  const getUser = (id: number) => db.prepare(`SELECT ${COLS} FROM users WHERE id = ?`).get(id) as UserRow | undefined;
  const idOf = (raw: unknown) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) throw notFound('User');
    return id;
  };

  app.get('/api/users', async (req) => {
    requirePerm(req, 'user:manage');
    return (db.prepare(`SELECT ${COLS} FROM users ORDER BY full_name COLLATE NOCASE`).all() as unknown as UserRow[]).map(present);
  });

  app.post('/api/users', async (req, reply) => {
    const actor = requirePerm(req, 'user:manage');
    const body = parse(createSchema, req.body);
    assertStrongPassword(body.password, body.username);
    const hash = await hashPassword(body.password);
    const id = tx(db, () => {
      if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(body.username)) {
        throw conflict('That username is already taken');
      }
      const now = nowIso();
      const r = db
        .prepare(
          `INSERT INTO users(username, full_name, role, password_hash, must_change_password, created_at, updated_at)
           VALUES (?,?,?,?,1,?,?)`,
        )
        .run(body.username, body.fullName, body.role, hash, now, now);
      const uid = Number(r.lastInsertRowid);
      audit(db, { actorId: actor.id, action: 'user.create', entity: 'user', entityId: uid, detail: { username: body.username, role: body.role } });
      return uid;
    });
    return reply.status(201).send(present(getUser(id)!));
  });

  app.patch('/api/users/:id', async (req) => {
    const actor = requirePerm(req, 'user:manage');
    const id = idOf((req.params as { id: string }).id);
    const body = parse(patchSchema, req.body);
    return tx(db, () => {
      const before = getUser(id);
      if (!before) throw notFound('User');
      if (id === actor.id && (body.active === false || (body.role && body.role !== before.role))) {
        throw new HttpError(400, 'bad_request', 'You cannot deactivate your own account or change your own role');
      }
      const next = {
        full_name: body.fullName ?? before.full_name,
        role: body.role ?? before.role,
        active: body.active === undefined ? before.active : body.active ? 1 : 0,
      };
      const changes = diff(before as unknown as Record<string, unknown>, next);
      if (Object.keys(changes).length === 0) return present(before);
      db.prepare('UPDATE users SET full_name = ?, role = ?, active = ?, updated_at = ? WHERE id = ?').run(
        next.full_name, next.role, next.active, nowIso(), id,
      );
      if (next.active === 0 || next.role !== before.role) destroyUserSessions(db, id);
      audit(db, { actorId: actor.id, action: 'user.update', entity: 'user', entityId: id, detail: changes });
      return present(getUser(id)!);
    });
  });

  app.post('/api/users/:id/reset-password', async (req) => {
    const actor = requirePerm(req, 'user:manage');
    const id = idOf((req.params as { id: string }).id);
    const body = parse(resetSchema, req.body);
    const target = getUser(id);
    if (!target) throw notFound('User');
    assertStrongPassword(body.password, target.username);
    const hash = await hashPassword(body.password);
    tx(db, () => {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?').run(hash, nowIso(), id);
      destroyUserSessions(db, id);
      audit(db, { actorId: actor.id, action: 'user.reset_password', entity: 'user', entityId: id });
    });
    return { ok: true };
  });
}
