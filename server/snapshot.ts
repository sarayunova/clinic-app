import fs from 'node:fs';
import path from 'node:path';
import { MIN_PASSPHRASE, encryptFile, verifyBackup, type VerifyResult } from './backup.js';
import { copyDatabaseVerified } from './dataMigration.js';
import { restrictToServiceAndAdmins } from './windowsAcl.js';

export class SnapshotError extends Error {}
/** There is no database yet (a fresh install): nothing to protect, which is not a failure. */
export class NoDatabaseError extends SnapshotError {}

export const SNAPSHOT_DIR_NAME = 'pre-upgrade';
const SNAPSHOT_NAME = /^clinic-pre-upgrade-\d{8}T\d{6}Z\.(sqlite|cbk)$/;

export interface SnapshotResult {
  file: string;
  sizeBytes: number;
  verify: VerifyResult;
  /** True: encrypted with the backup passphrase (a .cbk, restorable with `clinic.exe restore`). */
  encrypted: boolean;
  /** Why it is not encrypted, when it is not. */
  plainReason: string | null;
  pruned: string[];
}

function stamp(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

/**
 * A verified copy of the live database, taken by the installer just before an upgrade replaces the program, so that
 * if the new version's migrations or first start go wrong the exact pre-upgrade data can be put back.
 *
 * When a valid backup passphrase is given, the copy is encrypted exactly like a regular backup (a .cbk file that
 * `clinic.exe restore` opens), and is decrypted and checked again before it counts. Without one (installs from before
 * the installer generated passphrases), it is a plain SQLite copy instead of no copy at all; it stays in the data
 * folder beside the live database, under the same restricted permissions.
 *
 * The plain intermediate copy is always deleted. Never creates a database: if there is none (a fresh install), it
 * throws NoDatabaseError and writes nothing. The newest `keep` copies are kept; older ones are deleted only after the
 * new one has been verified.
 */
export async function snapshotDatabase(opts: {
  dbFile: string;
  dataDir: string;
  passphrase?: string | null;
  keep?: number;
  now?: Date;
}): Promise<SnapshotResult> {
  const { dbFile, dataDir, keep = 3 } = opts;
  const plainReason = !opts.passphrase
    ? 'no backup passphrase is set up on this computer'
    : opts.passphrase.length < MIN_PASSPHRASE
      ? `the backup passphrase is shorter than ${MIN_PASSPHRASE} characters, so it is not used`
      : null;
  const passphrase = plainReason ? null : opts.passphrase!;
  if (!fs.existsSync(dbFile) || fs.statSync(dbFile).size === 0) throw new NoDatabaseError(`No database at ${dbFile} yet, so there is nothing to copy.`);

  const dir = path.join(dataDir, SNAPSHOT_DIR_NAME);
  const isNew = !fs.existsSync(dir);
  fs.mkdirSync(dir, { recursive: true });
  if (isNew) restrictToServiceAndAdmins(dir);

  // Room for the copy (database plus a WAL that may not have been folded in yet), with 10% headroom - twice over
  // when encrypting, since the plain intermediate copy and the encrypted one exist at the same time.
  const needed = Math.ceil(
    (fs.statSync(dbFile).size + (fs.existsSync(`${dbFile}-wal`) ? fs.statSync(`${dbFile}-wal`).size : 0)) * 1.1 * (passphrase ? 2 : 1),
  );
  const st = fs.statfsSync(dir);
  const free = st.bavail * st.bsize;
  if (free < needed) {
    throw new SnapshotError(`Not enough free disk space for a safety copy of the database (${Math.round(free / 1e6)} MB free, about ${Math.round(needed / 1e6)} MB needed).`);
  }

  const base = path.join(dir, `clinic-pre-upgrade-${stamp(opts.now)}`);
  const file = `${base}.${passphrase ? 'cbk' : 'sqlite'}`;
  if (fs.existsSync(file)) throw new SnapshotError(`${file} already exists.`);

  let verify: VerifyResult;
  if (!passphrase) {
    verify = (await copyDatabaseVerified(dbFile, file, SnapshotError)).destVerify;
  } else {
    const plain = `${base}.plain-tmp`;
    const partial = `${file}.partial`;
    try {
      const { sourceCounts } = await copyDatabaseVerified(dbFile, plain, SnapshotError);
      await encryptFile(plain, partial, passphrase);
      fs.renameSync(partial, file);
      // Prove the encrypted file opens with this passphrase and holds the same records, before relying on it.
      verify = await verifyBackup(file, passphrase);
      if (verify.patients !== sourceCounts.patients || verify.users !== sourceCounts.users || verify.migrations !== sourceCounts.migrations) {
        throw new SnapshotError(`The encrypted safety copy did not match the database (source: ${JSON.stringify(sourceCounts)}, copy: ${JSON.stringify(verify)}).`);
      }
    } catch (e) {
      fs.rmSync(file, { force: true });
      throw e instanceof SnapshotError ? e : new SnapshotError(`Could not make the encrypted safety copy: ${(e as Error).message}`);
    } finally {
      fs.rmSync(plain, { force: true });
      fs.rmSync(partial, { force: true });
    }
  }

  const existing = fs.readdirSync(dir).filter((n) => SNAPSHOT_NAME.test(n)).sort(); // timestamped names sort by age
  const pruned = existing.slice(0, Math.max(0, existing.length - keep));
  for (const n of pruned) fs.rmSync(path.join(dir, n), { force: true });

  return { file, sizeBytes: fs.statSync(file).size, verify, encrypted: !!passphrase, plainReason, pruned };
}
