import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigError, defaultMachineDataDir, findDataDirCandidates, loadConfig, resolveDataDir } from '../server/config.js';

let dir: string;
let origProgramData: string | undefined;
let origLocalAppData: string | undefined;
let origCliDataDir: string | undefined;
let usersRoot: string;

const writeDb = (dbFile: string, bytes = 10) => {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.writeFileSync(dbFile, Buffer.alloc(bytes, 1));
};

// `usersRoot` is always passed explicitly to findDataDirCandidates/resolveDataDir below so these
// tests never scan this machine's real C:\Users — only loadConfig's explicit-override paths (which
// never scan anything) are safe to call without that seam.
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-datadir-test-'));
  usersRoot = path.join(dir, 'Users'); // left empty unless a test adds a profile under it
  fs.mkdirSync(usersRoot, { recursive: true });
  origProgramData = process.env.ProgramData;
  origLocalAppData = process.env.LOCALAPPDATA;
  origCliDataDir = process.env.CLINIC_DATA_DIR;
  process.env.ProgramData = path.join(dir, 'ProgramData');
  process.env.LOCALAPPDATA = path.join(dir, 'LocalAppData');
  delete process.env.CLINIC_DATA_DIR;
});

afterEach(() => {
  if (origProgramData === undefined) delete process.env.ProgramData;
  else process.env.ProgramData = origProgramData;
  if (origLocalAppData === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = origLocalAppData;
  if (origCliDataDir === undefined) delete process.env.CLINIC_DATA_DIR;
  else process.env.CLINIC_DATA_DIR = origCliDataDir;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('defaultMachineDataDir', () => {
  it('is under ProgramData\\ClinicApp', () => {
    expect(defaultMachineDataDir()).toBe(path.join(process.env.ProgramData!, 'ClinicApp'));
  });
});

describe('findDataDirCandidates', () => {
  it('finds nothing on a clean machine', () => {
    expect(findDataDirCandidates(usersRoot)).toEqual([]);
  });

  it('ignores an empty database file (not yet initialised, or a stray empty file)', () => {
    writeDb(path.join(process.env.LOCALAPPDATA!, 'ClinicApp', 'clinic.sqlite'), 0);
    expect(findDataDirCandidates(usersRoot)).toEqual([]);
  });

  it("finds the current user's legacy database", () => {
    const dbFile = path.join(process.env.LOCALAPPDATA!, 'ClinicApp', 'clinic.sqlite');
    writeDb(dbFile);
    const found = findDataDirCandidates(usersRoot);
    expect(found).toHaveLength(1);
    expect(found[0]!.dbFile).toBe(dbFile);
    expect(found[0]!.sizeBytes).toBe(10);
  });

  it("finds another Windows profile's database via the users root", () => {
    const otherDb = path.join(usersRoot, 'drsharma', 'AppData', 'Local', 'ClinicApp', 'clinic.sqlite');
    writeDb(otherDb);
    const found = findDataDirCandidates(usersRoot);
    expect(found.map((c) => c.dbFile)).toContain(otherDb);
  });

  it('does not fail when the users root cannot be read', () => {
    expect(findDataDirCandidates(path.join(dir, 'does-not-exist'))).toEqual([]);
  });
});

describe('resolveDataDir', () => {
  it('uses the machine-wide path when it already has data, ignoring legacy locations', () => {
    writeDb(path.join(defaultMachineDataDir(), 'clinic.sqlite'));
    writeDb(path.join(process.env.LOCALAPPDATA!, 'ClinicApp', 'clinic.sqlite'));
    const r = resolveDataDir(usersRoot);
    expect(r.source).toBe('machine-default-existing');
    expect(r.dataDir).toBe(defaultMachineDataDir());
  });

  it('defaults to the machine-wide path on a genuinely fresh machine', () => {
    const r = resolveDataDir(usersRoot);
    expect(r.source).toBe('machine-default-fresh');
    expect(r.dataDir).toBe(defaultMachineDataDir());
  });

  it('falls back to a single legacy database without touching it', () => {
    const legacyDb = path.join(process.env.LOCALAPPDATA!, 'ClinicApp', 'clinic.sqlite');
    writeDb(legacyDb);
    const r = resolveDataDir(usersRoot);
    expect(r.source).toBe('legacy-fallback');
    expect(r.dataDir).toBe(path.dirname(legacyDb));
    expect(fs.existsSync(defaultMachineDataDir())).toBe(false);
  });

  it('fails closed with ConfigError rather than guessing when locations disagree', () => {
    writeDb(path.join(process.env.LOCALAPPDATA!, 'ClinicApp', 'clinic.sqlite'));
    writeDb(path.join(usersRoot, 'drsharma', 'AppData', 'Local', 'ClinicApp', 'clinic.sqlite'));
    expect(() => resolveDataDir(usersRoot)).toThrow(ConfigError);
    expect(fs.existsSync(defaultMachineDataDir())).toBe(false);
  });
});

describe('loadConfig data directory selection', () => {
  it('never scans the filesystem when dataDir is explicitly overridden', () => {
    const explicit = path.join(dir, 'explicit-data');
    const cfg = loadConfig({ dataDir: explicit });
    expect(cfg.dataDir).toBe(explicit);
    expect(cfg.dataDirSource).toBe('explicit');
    expect(fs.existsSync(defaultMachineDataDir())).toBe(false);
  });

  it('never scans the filesystem when CLINIC_DATA_DIR is set', () => {
    process.env.CLINIC_DATA_DIR = path.join(dir, 'env-data');
    const cfg = loadConfig();
    expect(cfg.dataDir).toBe(path.join(dir, 'env-data'));
    expect(cfg.dataDirSource).toBe('explicit');
  });
});
