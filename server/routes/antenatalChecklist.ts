import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { audit } from '../audit.js';
import { badRequest, notFound, parse } from '../errors.js';
import { localDate, nowIso } from '../time.js';
import {
  ANTENATAL_TEST_CATALOG,
  ANTENATAL_TEST_MAP,
  type AntenatalTestDef,
} from '../antenatalCatalog.js';

const optNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const patchTestSchema = z
  .object({
    status: z.enum(['pending', 'ordered', 'completed', 'not_required']).optional(),
    resultValue: optNullableString(500),
    notes: optNullableString(1000),
    performedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
      .nullable()
      .optional(),
    attachmentId: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'No fields provided to update');

type DbTestRow = {
  id: number;
  patient_id: number;
  test_key: string;
  category: string;
  test_name: string;
  status: string;
  result_value: string | null;
  notes: string | null;
  performed_date: string | null;
  attachment_id: number | null;
  updated_at: string;
  updated_by_name: string | null;
  attachment_title: string | null;
  attachment_original_name: string | null;
  attachment_mime: string | null;
};

export function registerAntenatalChecklistRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  // GET /api/patients/:id/antenatal-checklist
  app.get('/api/patients/:id/antenatal-checklist', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      throw badRequest('Invalid patient ID');
    }

    const patient = db
      .prepare('SELECT id, full_name, last_menstrual_period, gravida, para FROM patients WHERE id = ?')
      .get(patientId) as { id: number; full_name: string } | undefined;
    if (!patient) throw notFound('Patient not found');

    const savedRows = db
      .prepare(
        `SELECT t.id, t.patient_id, t.test_key, t.category, t.test_name, t.status, t.result_value, t.notes,
                t.performed_date, t.attachment_id, t.updated_at,
                u.full_name AS updated_by_name,
                a.title AS attachment_title, a.original_name AS attachment_original_name, a.mime AS attachment_mime
         FROM patient_antenatal_tests t
         LEFT JOIN users u ON u.id = t.updated_by
         LEFT JOIN attachments a ON a.id = t.attachment_id AND a.voided_at IS NULL
         WHERE t.patient_id = ?`
      )
      .all(patientId) as DbTestRow[];

    const savedMap = new Map<string, DbTestRow>(savedRows.map((r) => [r.test_key, r]));

    const tests = ANTENATAL_TEST_CATALOG.map((def: AntenatalTestDef) => {
      const saved = savedMap.get(def.key);
      if (saved) {
        return {
          id: saved.id,
          testKey: def.key,
          category: def.category,
          testName: def.name,
          recommendedWeeks: def.recommendedWeeks,
          description: def.description,
          isMandatory: Boolean(def.isMandatory),
          flagForRhNegative: Boolean(def.flagForRhNegative),
          status: saved.status,
          resultValue: saved.result_value,
          notes: saved.notes,
          performedDate: saved.performed_date,
          attachmentId: saved.attachment_id,
          attachmentTitle: saved.attachment_title,
          attachmentOriginalName: saved.attachment_original_name,
          attachmentMime: saved.attachment_mime,
          updatedByName: saved.updated_by_name,
          updatedAt: saved.updated_at,
        };
      }
      return {
        id: null,
        testKey: def.key,
        category: def.category,
        testName: def.name,
        recommendedWeeks: def.recommendedWeeks,
        description: def.description,
        isMandatory: Boolean(def.isMandatory),
        flagForRhNegative: Boolean(def.flagForRhNegative),
        status: 'pending',
        resultValue: null,
        notes: null,
        performedDate: null,
        attachmentId: null,
        attachmentTitle: null,
        attachmentOriginalName: null,
        attachmentMime: null,
        updatedByName: null,
        updatedAt: null,
      };
    });

    const total = tests.length;
    const completed = tests.filter((t) => t.status === 'completed').length;
    const ordered = tests.filter((t) => t.status === 'ordered').length;
    const pending = tests.filter((t) => t.status === 'pending').length;
    const notRequired = tests.filter((t) => t.status === 'not_required').length;
    const applicable = total - notRequired;
    const completionPercentage = applicable > 0 ? Math.round((completed / applicable) * 100) : 100;

    return {
      patientId,
      patientName: patient.full_name,
      tests,
      summary: {
        total,
        completed,
        ordered,
        pending,
        notRequired,
        completionPercentage,
      },
    };
  });

  // PATCH /api/patients/:id/antenatal-checklist/:testKey
  app.patch('/api/patients/:id/antenatal-checklist/:testKey', async (req) => {
    const user = requirePerm(req, 'patient:write_clinical');
    const { id, testKey } = req.params as { id: string; testKey: string };
    const patientId = Number(id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      throw badRequest('Invalid patient ID');
    }

    const def = ANTENATAL_TEST_MAP[testKey];
    if (!def) {
      throw badRequest(`Unknown antenatal test key: ${testKey}`);
    }

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const body = parse(patchTestSchema, req.body);

    if (body.performedDate) {
      const today = localDate(new Date(), cfg.timezone);
      if (body.performedDate > today) {
        throw badRequest('Performed date cannot be in the future', [
          { field: 'performedDate', message: 'Cannot be in the future' },
        ]);
      }
    }

    if (body.attachmentId != null) {
      const att = db
        .prepare('SELECT id FROM attachments WHERE id = ? AND patient_id = ? AND voided_at IS NULL')
        .get(body.attachmentId, patientId);
      if (!att) {
        throw badRequest('Document attachment not found or does not belong to this patient', [
          { field: 'attachmentId', message: 'Document not found' },
        ]);
      }
    }

    const existing = db
      .prepare('SELECT * FROM patient_antenatal_tests WHERE patient_id = ? AND test_key = ?')
      .get(patientId, testKey) as
      | {
          id: number;
          status: string;
          result_value: string | null;
          notes: string | null;
          performed_date: string | null;
          attachment_id: number | null;
        }
      | undefined;

    const newStatus = body.status !== undefined ? body.status : (existing?.status ?? 'pending');
    const newResult = body.resultValue !== undefined ? body.resultValue : (existing?.result_value ?? null);
    const newNotes = body.notes !== undefined ? body.notes : (existing?.notes ?? null);
    const newDate = body.performedDate !== undefined ? body.performedDate : (existing?.performed_date ?? null);
    const newAttachmentId =
      body.attachmentId !== undefined ? body.attachmentId : (existing?.attachment_id ?? null);
    const at = nowIso();

    db.prepare(
      `INSERT INTO patient_antenatal_tests (
         patient_id, test_key, category, test_name, status, result_value, notes, performed_date, attachment_id, updated_by, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT(patient_id, test_key) DO UPDATE SET
         status = excluded.status,
         result_value = excluded.result_value,
         notes = excluded.notes,
         performed_date = excluded.performed_date,
         attachment_id = excluded.attachment_id,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`
    ).run(
      patientId,
      testKey,
      def.category,
      def.name,
      newStatus,
      newResult,
      newNotes,
      newDate,
      newAttachmentId,
      user.id,
      at
    );

    audit(db, {
      actorId: user.id,
      action: 'antenatal.checklist_update',
      entity: 'patient',
      entityId: patientId,
      detail: {
        testKey,
        testName: def.name,
        status: newStatus,
        resultValue: newResult,
      },
    });

    // Return the updated item
    const updated = db
      .prepare(
        `SELECT t.id, t.patient_id, t.test_key, t.category, t.test_name, t.status, t.result_value, t.notes,
                t.performed_date, t.attachment_id, t.updated_at,
                u.full_name AS updated_by_name,
                a.title AS attachment_title, a.original_name AS attachment_original_name, a.mime AS attachment_mime
         FROM patient_antenatal_tests t
         LEFT JOIN users u ON u.id = t.updated_by
         LEFT JOIN attachments a ON a.id = t.attachment_id AND a.voided_at IS NULL
         WHERE t.patient_id = ? AND t.test_key = ?`
      )
      .get(patientId, testKey) as DbTestRow;

    return {
      id: updated.id,
      testKey: def.key,
      category: def.category,
      testName: def.name,
      recommendedWeeks: def.recommendedWeeks,
      description: def.description,
      isMandatory: Boolean(def.isMandatory),
      flagForRhNegative: Boolean(def.flagForRhNegative),
      status: updated.status,
      resultValue: updated.result_value,
      notes: updated.notes,
      performedDate: updated.performed_date,
      attachmentId: updated.attachment_id,
      attachmentTitle: updated.attachment_title,
      attachmentOriginalName: updated.attachment_original_name,
      attachmentMime: updated.attachment_mime,
      updatedByName: updated.updated_by_name,
      updatedAt: updated.updated_at,
    };
  });
}
