import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePerm, type Ctx } from '../app.js';
import { tx } from '../db.js';
import { audit } from '../audit.js';
import { notFound, parse } from '../errors.js';
import { localDate, nowIso } from '../time.js';

/** One-time jobs that cannot be checked by the app itself. The doctor ticks them off when done. */
export const CHECKLIST = [
  { key: 'backup_passphrase', title: 'Backup passphrase set and written down', detail: 'Without the passphrase a backup cannot be opened. Keep a copy somewhere other than this computer.' },
  { key: 'offsite_copy', title: 'Backups are copied off this computer', detail: 'A USB drive or second machine, kept somewhere else, so a fire, theft or dead disk does not take the backups too.' },
  { key: 'practice_restore', title: 'A practice restore has been done', detail: 'Restore a backup to a spare folder and check the records open. See docs/BACKUP-AND-RESTORE.md.' },
  { key: 'https_server', title: 'HTTPS set up on the clinic computer', detail: 'npm run cert, then restart. See docs/HTTPS-SETUP.md.' },
  { key: 'https_devices', title: 'Certificate installed on every staff device', detail: 'Each tablet or PC opens the app with no browser warning.' },
  { key: 'autostart', title: 'Automatic start installed and survived a restart', detail: 'Restart the computer and check the app is back without anyone logging in. See docs/AUTO-START.md.' },
  { key: 'printer_test', title: 'Invoice, receipt, prescription and discharge summary printed on the real printer', detail: 'Margins, page breaks and the letterhead look right on paper.' },
  { key: 'bitlocker', title: 'Disk encryption (BitLocker) on the clinic computer', detail: 'Protects the records if the computer is stolen.' },
  { key: 'ups', title: 'UPS (battery backup) fitted', detail: 'A power cut should not corrupt the database.' },
  { key: 'owner_named', title: 'Someone is named to look after backups and updates', detail: 'Write the name in the note.' },
  { key: 'second_doctor_account', title: 'A second doctor-level account exists for emergencies', detail: 'Only a doctor can reset passwords. If the one doctor account is locked out, nobody in the app can fix it. Create a second account with the doctor role (Staff), set a long password, and keep it sealed somewhere safe. Write where it is kept in the note, not the password.' },
  { key: 'permissions_reviewed', title: 'Doctor has reviewed what nurses and reception can do', detail: 'The permission table in the README matches how the clinic works.' },
  { key: 'privacy_rules', title: 'Privacy, retention and clinical-document rules for this location confirmed', detail: 'How long records are kept, who may see them, what consent is needed.' },
  { key: 'price_list', title: 'Price list entered', detail: 'Billing > Price list.' },
  { key: 'clinic_details', title: 'Clinic name, address, phone and registration number entered', detail: 'Clinic page. They print on every document.' },
] as const;

const KEYS = CHECKLIST.map((c) => c.key) as string[];
const bodySchema = z.object({ done: z.boolean(), note: z.string().trim().max(300).optional() }).strict();

export function registerChecklistRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  app.get('/api/checklist', async (req) => {
    requirePerm(req, 'settings:manage');
    const rows = db
      .prepare('SELECT c.key, c.done_at, c.note, u.full_name AS done_by_name FROM setup_checks c JOIN users u ON u.id = c.done_by')
      .all() as { key: string; done_at: string; note: string | null; done_by_name: string }[];
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return CHECKLIST.map((c) => {
      const r = byKey.get(c.key);
      return { ...c, done: !!r, doneDate: r ? localDate(new Date(r.done_at), cfg.timezone) : null, doneByName: r?.done_by_name ?? null, note: r?.note ?? null };
    });
  });

  app.put('/api/checklist/:key', async (req) => {
    const user = requirePerm(req, 'settings:manage');
    const key = (req.params as { key: string }).key;
    if (!KEYS.includes(key)) throw notFound('Checklist item');
    const b = parse(bodySchema, req.body);
    tx(db, () => {
      if (b.done) {
        db.prepare(
          'INSERT INTO setup_checks(key, done_by, done_at, note) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET done_by = excluded.done_by, done_at = excluded.done_at, note = excluded.note',
        ).run(key, user.id, nowIso(), b.note || null);
      } else {
        db.prepare('DELETE FROM setup_checks WHERE key = ?').run(key);
      }
      audit(db, { actorId: user.id, action: 'checklist.update', entity: 'checklist', entityId: key, detail: { done: b.done, note: b.note ?? null } });
    });
    return { ok: true };
  });
}
