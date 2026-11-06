import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse } from '../errors.js';

const logCommunicationSchema = z
  .object({
    patientId: z.number().int().positive('Patient ID must be positive'),
    channel: z.enum(['whatsapp', 'sms', 'clipboard']),
    messageType: z.enum(['appointment_reminder', 'antenatal_recall', 'prescription', 'vaccination', 'custom']),
    recipientPhone: z.string().trim().min(3, 'Phone number too short').max(30),
    summary: z.string().trim().max(500).optional(),
  })
  .strict();

export function registerCommunicationRoutes(app: FastifyInstance, { db }: Ctx): void {
  app.post('/api/communication/log', async (req, reply) => {
    const user = requirePerm(req, 'patient:read_basic');
    const b = parse(logCommunicationSchema, req.body);

    const patient = db.prepare('SELECT id, full_name FROM patients WHERE id = ?').get(b.patientId) as
      | { id: number; full_name: string }
      | undefined;
    if (!patient) throw notFound('Patient not found');

    audit(db, {
      actorId: user.id,
      action: 'communication.send',
      entity: 'patient',
      entityId: b.patientId,
      detail: {
        channel: b.channel,
        messageType: b.messageType,
        recipientPhone: b.recipientPhone,
        summary: b.summary ?? `${b.messageType.replace('_', ' ')} sent via ${b.channel}`,
      },
    });

    return reply.status(201).send({ ok: true });
  });
}
