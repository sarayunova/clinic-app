import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db.js';
import { MigrationError, migrateDataDir } from '../server/dataMigration.js';

let dir: string;
let sourceDir: string;
let sourceDbFile: string;
let destDir: string;
let destDbFile: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-migrate-test-'));
  sourceDir = path.join(dir, 'source');
  sourceDbFile = path.join(sourceDir, 'clinic.sqlite');
  destDir = path.join(dir, 'dest');
  destDbFile = path.join(destDir, 'clinic.sqlite');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const seedSource = () => {
  const db = openDb(sourceDbFile);
  db.prepare(
    "INSERT INTO users(username, full_name, role, password_hash, must_change_password, active, created_at, updated_at) VALUES ('dr','Dr','doctor','x',0,1,'2026-01-01','2026-01-01')",
  ).run();
  db.prepare(
    "INSERT INTO patients(patient_number, full_name, created_by, created_at, updated_at) VALUES ('P1','Asha Verma',1,'2026-01-01','2026-01-01')",
  ).run();
  db.close();
};

describe('migrateDataDir', () => {
  it('copies the database, verifying counts match, and leaves the source untouched', async () => {
    seedSource();
    const beforeBytes = fs.readFileSync(sourceDbFile);
    const r = await migrateDataDir({ sourceDbFile, destDir, destDbFile });
    expect(r.sourceCounts.patients).toBe(1);
    expect(r.sourceCounts.users).toBe(1);
    expect(r.sourceCounts.migrations).toBeGreaterThan(0);
    expect(r.sourceCounts.migrations).toBe(r.destVerify.migrations);
    expect(r.destVerify.integrity).toBe('ok');
    expect(r.destVerify.patients).toBe(1);
    expect(r.destVerify.users).toBe(1);
    expect(fs.existsSync(destDbFile)).toBe(true);
    // Source file is byte-for-byte unchanged (opened read-only; no migration side effects applied to it).
    expect(fs.readFileSync(sourceDbFile).equals(beforeBytes)).toBe(true);

    const copy = openDb(destDbFile);
    const patient = copy.prepare('SELECT full_name FROM patients').get() as { full_name: string };
    expect(patient.full_name).toBe('Asha Verma');
    copy.close();
  });

  it('leaves no leftover temp file after a successful migration', async () => {
    seedSource();
    await migrateDataDir({ sourceDbFile, destDir, destDbFile });
    expect(fs.existsSync(`${destDbFile}.partial`)).toBe(false);
  });

  it('refuses when there is no source database', async () => {
    await expect(migrateDataDir({ sourceDbFile, destDir, destDbFile })).rejects.toBeInstanceOf(MigrationError);
    expect(fs.existsSync(destDir)).toBe(false);
  });

  it('refuses to overwrite an existing non-empty destination', async () => {
    seedSource();
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(destDbFile, Buffer.alloc(10, 1));
    await expect(migrateDataDir({ sourceDbFile, destDir, destDbFile })).rejects.toBeInstanceOf(MigrationError);
    // The pre-existing destination file must not have been replaced.
    expect(fs.readFileSync(destDbFile).equals(Buffer.alloc(10, 1))).toBe(true);
  });

  it('allows migrating into an existing but empty destination directory', async () => {
    seedSource();
    fs.mkdirSync(destDir, { recursive: true });
    const r = await migrateDataDir({ sourceDbFile, destDir, destDbFile });
    expect(r.destVerify.integrity).toBe('ok');
  });
});
