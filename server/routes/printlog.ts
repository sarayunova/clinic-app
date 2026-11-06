import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse } from '../errors.js';

const schema = z
  .object({
    kind: z.enum(['prescription', 'discharge_summary', 'antenatal_summary', 'referral_card']),
    id: z.number().int().min(1),
  })
  .strict();

/** Records that a clinical document was printed (a copy of patient information left the screen). */
export function registerPrintLogRoutes(app: FastifyInstance, { db }: Ctx): void {
  app.post('/api/print-log', async (req, reply) => {
    const b = parse(schema, req.body);
    if (b.kind === 'prescription') {
      const user = requirePerm(req, 'visit:read');
      const v = db.prepare('SELECT status FROM visits WHERE id = ?').get(b.id) as { status: string } | undefined;
      if (!v) throw notFound('Visit');
      if (v.status !== 'final') throw badRequest('Only a finalised consultation can be printed');
      audit(db, { actorId: user.id, action: 'document.print', entity: 'visit', entityId: b.id, detail: { kind: b.kind } });
    } else if (b.kind === 'discharge_summary') {
      const user = requirePerm(req, 'ipd:read');
      const a = db.prepare('SELECT status FROM admissions WHERE id = ?').get(b.id) as { status: string } | undefined;
      if (!a) throw notFound('Admission');
      if (a.status !== 'discharged') throw badRequest('Only a discharged admission has a discharge summary to print');
      audit(db, { actorId: user.id, action: 'document.print', entity: 'admission', entityId: b.id, detail: { kind: b.kind } });
    } else {
      const user = requirePerm(req, 'patient:read_clinical');
      const p = db.prepare('SELECT id FROM patients WHERE id = ?').get(b.id) as { id: number } | undefined;
      if (!p) throw notFound('Patient');
      audit(db, { actorId: user.id, action: 'document.print', entity: 'patient', entityId: b.id, detail: { kind: b.kind } });
    }
    return reply.status(201).send({ ok: true });
  });
}
