import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { notFound } from '../errors.js';
import { tlsFiles, tlsStatus } from '../tls.js';

export function registerSecurityRoutes(app: FastifyInstance, { cfg, tls }: Ctx): void {
  app.get('/api/security', async (req) => {
    requirePerm(req, 'settings:manage');
    return { ...tlsStatus(tls ?? null, cfg.host), caAvailable: fs.existsSync(tlsFiles(cfg.tlsDir).caCert) };
  });

  // The CA certificate is public information (it only lets a device recognise this clinic's server), so it needs no login.
  // Never serve the CA key or the server key: only this one file.
  app.get('/api/tls/ca.crt', async (_req, reply) => {
    const file = tlsFiles(cfg.tlsDir).caCert;
    if (!fs.existsSync(file)) throw notFound('Certificate');
    return reply
      .header('Content-Type', 'application/x-x509-ca-cert')
      .header('Content-Disposition', 'attachment; filename="clinic-ca.crt"')
      .send(fs.readFileSync(file));
  });
}
