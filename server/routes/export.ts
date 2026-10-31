import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { tx, type DB } from '../db.js';
import { audit } from '../audit.js';
import { notFound } from '../errors.js';
import { localDate, nowIso } from '../time.js';
import { camelize } from '../util.js';

type Row = Record<string, unknown>;
const rows = (db: DB, sql: string, ...args: (string | number)[]): Row[] => (db.prepare(sql).all(...args) as Row[]).map(camelize);
const inList = (ids: unknown[]) => ids.map(() => '?').join(',') || 'NULL';

/** Fields that hold a staff user id. Used to list who those people were, without exporting every user. */
const STAFF_FIELDS = new Set(['createdBy', 'finalisedBy', 'recordedBy', 'authorId', 'orderedBy', 'stoppedBy', 'receivedBy', 'authorisedBy', 'writtenBy']);

function collectStaffIds(node: unknown, out = new Set<number>()): Set<number> {
  if (Array.isArray(node)) node.forEach((n) => collectStaffIds(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (STAFF_FIELDS.has(k) && typeof v === 'number') out.add(v);
      else collectStaffIds(v, out);
    }
  }
  return out;
}

/** Everything the system holds about one patient, as one JSON document. */
export function buildPatientExport(db: DB, patientId: number) {
  const patient = rows(db, 'SELECT * FROM patients WHERE id = ?', patientId)[0];
  if (!patient) return null;

  const appointments = rows(db, 'SELECT * FROM appointments WHERE patient_id = ? ORDER BY scheduled_at, id', patientId);

  const visits = rows(db, 'SELECT * FROM visits WHERE patient_id = ? ORDER BY id', patientId).map((v) => ({
    ...v,
    vitals: rows(db, 'SELECT * FROM visit_vitals WHERE visit_id = ? ORDER BY id', v.id as number),
    prescriptionItems: rows(db, 'SELECT * FROM prescription_items WHERE visit_id = ? ORDER BY id', v.id as number),
    revisions: rows(db, 'SELECT * FROM visit_revisions WHERE visit_id = ? ORDER BY id', v.id as number),
  }));

  const admissions = rows(
    db,
    'SELECT a.*, b.room AS bed_room, b.label AS bed_label FROM admissions a LEFT JOIN beds b ON b.id = a.bed_id WHERE a.patient_id = ? ORDER BY a.id',
    patientId,
  ).map((a) => {
    const aid = a.id as number;
    return {
      ...a,
      careEntries: rows(db, 'SELECT * FROM care_entries WHERE admission_id = ? ORDER BY id', aid),
      medicineOrders: rows(db, 'SELECT * FROM medicine_orders WHERE admission_id = ? ORDER BY id', aid).map((o) => ({
        ...o,
        administrations: rows(db, 'SELECT * FROM medication_records WHERE order_id = ? ORDER BY id', o.id as number),
      })),
      dischargeSummary: rows(db, 'SELECT * FROM discharge_summaries WHERE admission_id = ?', aid)[0] ?? null,
      dischargeAddenda: rows(db, 'SELECT * FROM discharge_addenda WHERE admission_id = ? ORDER BY id', aid),
    };
  });

  const invoices = rows(db, 'SELECT * FROM invoices WHERE patient_id = ? ORDER BY id', patientId).map((i) => ({
    ...i,
    lines: rows(db, 'SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id', i.id as number),
    payments: rows(db, 'SELECT * FROM payments WHERE invoice_id = ? ORDER BY id', i.id as number),
    adjustments: rows(db, 'SELECT * FROM adjustments WHERE invoice_id = ? ORDER BY id', i.id as number),
  }));

  const record = { patient, appointments, visits, admissions, invoices };
  const ids = [...collectStaffIds(record)];
  const staff = ids.length ? rows(db, `SELECT id, full_name, role FROM users WHERE id IN (${inList(ids)}) ORDER BY id`, ...ids) : [];
  return { ...record, staff };
}

export function registerExportRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  app.get('/api/patients/:id/export', async (req, reply) => {
    const user = requirePerm(req, 'record:export');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id < 1) throw notFound('Patient');

    // Built and audited in one transaction: an export never leaves without a log entry.
    const { data, counts } = tx(db, () => {
      const rec = buildPatientExport(db, id);
      if (!rec) throw notFound('Patient');
      const counts = {
        appointments: rec.appointments.length,
        visits: rec.visits.length,
        admissions: rec.admissions.length,
        invoices: rec.invoices.length,
      };
      audit(db, { actorId: user.id, action: 'patient.export', entity: 'patient', entityId: id, detail: counts });
      return { data: rec, counts };
    });

    const number = String(data.patient.patientNumber ?? id).replace(/[^A-Za-z0-9_-]/g, '');
    const doc = {
      format: 'clinic-app-patient-export',
      formatVersion: 1,
      exportedAt: nowIso(),
      exportedBy: { id: user.id, name: user.fullName },
      timezone: cfg.timezone,
      note: 'Amounts are in paise (1/100 rupee). Times are UTC unless a field says otherwise. Contains confidential patient information.',
      counts,
      ...data,
    };
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="patient-${number}-${localDate(new Date(), cfg.timezone)}.json"`)
      .header('Cache-Control', 'no-store')
      .send(JSON.stringify(doc, null, 2));
  });
}
