import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SESSION_COOKIE, requireUser, type Ctx } from '../app.js';
import {
  assertStrongPassword,
  createSession,
  destroySession,
  destroyUserSessions,
  hashPassword,
  verifyPassword,
} from '../auth.js';
import { tx } from '../db.js';
import { audit } from '../audit.js';
import { HttpError, badRequest, parse, unauthorized } from '../errors.js';
import { permissionsFor } from '../permissions.js';
import { nowIso } from '../time.js';

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dot, dash or underscore');

const setupSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().min(2).max(100),
  password: z.string(),
});
const loginSchema = z.object({ username: z.string().max(100), password: z.string().max(200) });
const changePasswordSchema = z.object({ currentPassword: z.string().max(200), newPassword: z.string() });

// Verifying against this when a username doesn't exist keeps response timing similar.
let dummyHash: Promise<string> | null = null;

export function registerAuthRoutes(app: FastifyInstance, { db, cfg, throttle, secureCookies }: Ctx): void {
  const setCookie = (reply: import('fastify').FastifyReply, token: string) =>
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: secureCookies,
      path: '/',
      maxAge: cfg.sessionMaxHours * 3600,
    });

  const userCount = () => (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;

  app.get('/api/setup/status', async () => ({ needsSetup: userCount() === 0 }));

  // First-run only: creates the doctor account. Closed as soon as any user exists.
  app.post('/api/setup', async (req, reply) => {
    const body = parse(setupSchema, req.body);
    assertStrongPassword(body.password, body.username);
    const hash = await hashPassword(body.password);
    const id = tx(db, () => {
      if (userCount() > 0) throw new HttpError(409, 'already_setup', 'Setup has already been completed');
      const now = nowIso();
      const r = db
        .prepare(
          `INSERT INTO users(username, full_name, role, password_hash, must_change_password, created_at, updated_at)
           VALUES (?,?,?,?,0,?,?)`,
        )
        .run(body.username, body.fullName, 'doctor', hash, now, now);
      const uid = Number(r.lastInsertRowid);
      audit(db, { actorId: uid, action: 'user.create', entity: 'user', entityId: uid, detail: { role: 'doctor', setup: true } });
      return uid;
    });
    setCookie(reply, createSession(db, cfg, id));
    return reply.status(201).send({ ok: true });
  });

  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = parse(loginSchema, req.body);
    const wait = throttle.lockedFor(username);
    if (wait > 0) {
      throw new HttpError(429, 'locked', `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`);
    }
    const row = db
      .prepare('SELECT id, password_hash, active FROM users WHERE username = ?')
      .get(username) as { id: number; password_hash: string; active: number } | undefined;

    dummyHash ??= hashPassword('not-a-real-password');
    const ok = row ? await verifyPassword(password, row.password_hash) : (await verifyPassword(password, await dummyHash), false);

    if (!row || !ok || !row.active) {
      throttle.fail(username);
      audit(db, { actorId: row?.id ?? null, action: 'auth.login_failed', entity: 'user', entityId: row?.id ?? null, detail: { username } });
      throw unauthorized('Incorrect username or password');
    }
    throttle.succeed(username);
    audit(db, { actorId: row.id, action: 'auth.login', entity: 'user', entityId: row.id });
    setCookie(reply, createSession(db, cfg, row.id));
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.user) audit(db, { actorId: req.user.id, action: 'auth.logout', entity: 'user', entityId: req.user.id });
    destroySession(db, req.sessionToken);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async (req) => {
    const user = requireUser(req, { allowMustChange: true });
    return { ...user, permissions: permissionsFor(user.role) };
  });

  app.post('/api/auth/change-password', async (req) => {
    const user = requireUser(req, { allowMustChange: true });
    const body = parse(changePasswordSchema, req.body);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
    if (!(await verifyPassword(body.currentPassword, row.password_hash))) throw badRequest('Current password is incorrect');
    assertStrongPassword(body.newPassword, user.username);
    if (body.newPassword === body.currentPassword) throw badRequest('Choose a password different from the current one');
    const hash = await hashPassword(body.newPassword);
    tx(db, () => {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(hash, nowIso(), user.id);
      destroyUserSessions(db, user.id, req.sessionToken);
      audit(db, { actorId: user.id, action: 'auth.change_password', entity: 'user', entityId: user.id });
    });
    return { ok: true };
  });
}
