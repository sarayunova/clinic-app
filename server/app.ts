import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { DB } from './db.js';
import type { Config } from './config.js';
import { LoginThrottle, resolveSession, type SessionUser } from './auth.js';
import { HttpError, forbidden, unauthorized } from './errors.js';
import { can, type Permission } from './permissions.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerUserRoutes } from './routes/users.js';
import { registerPatientRoutes } from './routes/patients.js';
import { registerAppointmentRoutes } from './routes/appointments.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerVisitRoutes } from './routes/visits.js';
import { registerIpdRoutes } from './routes/ipd.js';
import { registerMedicineRoutes } from './routes/medicines.js';
import { registerDischargeRoutes } from './routes/discharge.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerPrintLogRoutes } from './routes/printlog.js';
import { registerBackupRoutes } from './routes/backups.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionToken: string | undefined;
  }
}

export interface Ctx {
  db: DB;
  cfg: Config;
  throttle: LoginThrottle;
  /** Set true when served over HTTPS so the session cookie is marked Secure. */
  secureCookies: boolean;
  /** Folder holding the built web UI (dist/web). Omit for API-only (tests). */
  webRoot?: string;
}

export const SESSION_COOKIE = 'clinic_session';

/** Requires a logged-in user. Users who must change their password are blocked from everything else. */
export function requireUser(req: FastifyRequest, opts: { allowMustChange?: boolean } = {}): SessionUser {
  if (!req.user) throw unauthorized();
  if (req.user.mustChangePassword && !opts.allowMustChange) {
    throw new HttpError(403, 'password_change_required', 'You must change your password before continuing');
  }
  return req.user;
}

export function requirePerm(req: FastifyRequest, perm: Permission): SessionUser {
  const user = requireUser(req);
  if (!can(user.role, perm)) throw forbidden();
  return user;
}

export async function buildApp(ctx: Omit<Ctx, 'throttle'> & { throttle?: LoginThrottle }): Promise<FastifyInstance> {
  const full: Ctx = {
    ...ctx,
    throttle: ctx.throttle ?? new LoginThrottle(ctx.cfg.loginMaxFailures, ctx.cfg.loginLockMinutes),
  };
  const app = Fastify({ logger: false, bodyLimit: 1_000_000, trustProxy: false });
  await app.register(cookie);

  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', undefined);

  app.addHook('onRequest', async (req) => {
    req.sessionToken = req.cookies[SESSION_COOKIE];
    req.user = resolveSession(full.db, full.cfg, req.sessionToken);

    // Defence in depth on top of SameSite=Strict: browsers send Origin on cross-site writes.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin) {
        let originHost = '';
        try {
          originHost = new URL(origin).host;
        } catch {
          /* fall through to rejection */
        }
        if (originHost !== req.headers.host) throw forbidden('Cross-site request blocked');
      }
    }
  });

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });

  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send({ error: { code: 'bad_request', message: (err as Error).message } });
    }
    console.error(err);
    return reply.status(500).send({ error: { code: 'server_error', message: 'Something went wrong. Nothing was saved.' } });
  });

  if (ctx.webRoot) {
    await app.register(fastifyStatic, { root: ctx.webRoot });
  }
  app.setNotFoundHandler((req, reply) => {
    // Single-page app: unknown non-API GETs get index.html so client-side routes survive a refresh.
    if (ctx.webRoot && req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
    return reply.status(404).send({ error: { code: 'not_found', message: 'Not found' } });
  });

  registerAuthRoutes(app, full);
  registerUserRoutes(app, full);
  registerPatientRoutes(app, full);
  registerAppointmentRoutes(app, full);
  registerVisitRoutes(app, full);
  registerIpdRoutes(app, full);
  registerMedicineRoutes(app, full);
  registerDischargeRoutes(app, full);
  registerBillingRoutes(app, full);
  registerPrintLogRoutes(app, full);
  registerBackupRoutes(app, full);
  registerAuditRoutes(app, full);

  app.get('/api/health', async () => ({ ok: true }));
  return app;
}
