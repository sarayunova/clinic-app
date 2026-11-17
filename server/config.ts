import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

/** Thrown when the data directory cannot be determined safely (see `resolveDataDir`). */
export class ConfigError extends Error {}

export type DataDirSource =
  | 'explicit' // CLINIC_DATA_DIR / an explicit override was given
  | 'machine-default-existing' // the machine-wide ProgramData path already has a database
  | 'machine-default-fresh' // no database found anywhere; starting fresh at the machine-wide path
  | 'legacy-fallback'; // a pre-existing per-user database was found and is still being used as-is

export interface LegacyDataDirCandidate {
  path: string;
  dbFile: string;
  sizeBytes: number;
}

/** The machine-wide data directory every installation should converge on (see docs/DEPLOYMENT-ARCHITECTURE.md). */
export function defaultMachineDataDir(): string {
  return path.join(process.env.ProgramData ?? 'C:\\ProgramData', 'ClinicApp');
}

/**
 * Finds existing, non-empty `clinic.sqlite` files at every location this app has ever defaulted to,
 * so an upgrade or an operator change never silently starts against a fresh empty database while real
 * data sits elsewhere. Only reads file metadata; never opens or modifies anything it finds.
 */
export function findDataDirCandidates(usersRoot = path.join(process.env.SystemDrive ?? 'C:', 'Users')): LegacyDataDirCandidate[] {
  const candidateDirs = new Set<string>();
  if (process.env.LOCALAPPDATA) candidateDirs.add(path.join(process.env.LOCALAPPDATA, 'ClinicApp'));
  candidateDirs.add(path.join(os.homedir(), '.clinic-app', 'ClinicApp'));
  try {
    // Best effort: catches data left behind by a different Windows account than the one running now.
    // Requires read access to other profiles' AppData\Local, which an ordinary user account will not have.
    for (const entry of fs.readdirSync(usersRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) candidateDirs.add(path.join(usersRoot, entry.name, 'AppData', 'Local', 'ClinicApp'));
    }
  } catch {
    /* no rights to enumerate other profiles; the candidates already added still apply */
  }
  const found: LegacyDataDirCandidate[] = [];
  for (const dir of candidateDirs) {
    const dbFile = path.join(dir, 'clinic.sqlite');
    try {
      const sizeBytes = fs.statSync(dbFile).size;
      if (sizeBytes > 0) found.push({ path: dir, dbFile, sizeBytes });
    } catch {
      /* no database at this candidate */
    }
  }
  return found;
}

export interface DataDirResolution {
  dataDir: string;
  source: DataDirSource;
  legacyCandidatesFound: LegacyDataDirCandidate[];
}

/**
 * Decides where patient data lives when nothing explicit was configured. Never moves or creates
 * anything itself — only decides which existing location (if any) is authoritative, or that this is
 * a genuinely fresh install. Throws rather than guessing when more than one location has real data.
 */
export function resolveDataDir(usersRoot?: string): DataDirResolution {
  const machineDir = defaultMachineDataDir();
  let machineHasData = false;
  try {
    machineHasData = fs.statSync(path.join(machineDir, 'clinic.sqlite')).size > 0;
  } catch {
    /* fresh machine, or not yet migrated */
  }
  if (machineHasData) return { dataDir: machineDir, source: 'machine-default-existing', legacyCandidatesFound: [] };

  const legacy = usersRoot === undefined ? findDataDirCandidates() : findDataDirCandidates(usersRoot);
  if (legacy.length === 0) return { dataDir: machineDir, source: 'machine-default-fresh', legacyCandidatesFound: [] };
  if (legacy.length > 1) {
    throw new ConfigError(
      'Found patient data in more than one location and cannot tell which is current:\n' +
        legacy.map((c) => `  - ${c.path} (${c.sizeBytes} bytes)`).join('\n') +
        '\nSet CLINIC_DATA_DIR explicitly to the correct one and restart. Nothing has been changed.',
    );
  }
  return { dataDir: legacy[0]!.path, source: 'legacy-fallback', legacyCandidatesFound: legacy };
}

export interface Config {
  dataDir: string;
  /** How dataDir was decided; 'legacy-fallback' means existing per-user data is being used as-is and has not yet moved to the machine-wide path. */
  dataDirSource: DataDirSource;
  /** Other locations with real data found alongside the chosen one (only populated for 'legacy-fallback'). */
  legacyDataDirsFound: LegacyDataDirCandidate[];
  dbFile: string;
  host: string;
  port: number;
  timezone: string;
  sessionIdleMinutes: number;
  sessionMaxHours: number;
  /** Failed logins allowed per username before a temporary lock. */
  loginMaxFailures: number;
  loginLockMinutes: number;
  /** The screen locks (password needed to continue) after this many idle minutes. 0 = never lock automatically. */
  screenLockMinutes: number;
  /** Where encrypted backups are written. Should be a different disk from dataDir. */
  backupDir: string;
  /** Null = automatic backups off. Never stored in the database or sent to the browser. */
  backupPassphrase: string | null;
  backupKeep: number;
  backupIntervalHours: number;
  /** Folder holding ca.crt, server.crt and server.key (HTTPS). */
  tlsDir: string;
  /** With HTTPS on: also listen on this plain-HTTP port and redirect to HTTPS (80 is the usual one). 0 = off. */
  httpRedirectPort: number;
  /** Escape hatch for a trusted test network only; never for real patient data. */
  allowInsecureLan: boolean;
}

function passphraseFromEnv(): string | null {
  const file = process.env.CLINIC_BACKUP_PASSPHRASE_FILE;
  if (file) return fs.readFileSync(file, 'utf8').replace(/[\r\n]+$/, '');
  return process.env.CLINIC_BACKUP_PASSPHRASE ?? null;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  // Real records must live outside cloud-synced folders (OneDrive etc).
  // Detection only runs when nothing explicit was given — an explicit dataDir (override or
  // CLINIC_DATA_DIR) always wins outright and never triggers a filesystem scan.
  let dataDir: string;
  let dataDirSource: DataDirSource = 'explicit';
  let legacyDataDirsFound: LegacyDataDirCandidate[] = [];
  if (overrides.dataDir) {
    dataDir = overrides.dataDir;
  } else if (process.env.CLINIC_DATA_DIR) {
    dataDir = process.env.CLINIC_DATA_DIR;
  } else if (overrides.dbFile) {
    // The caller already fully controls where the database lives (tests pointing dbFile at
    // ':memory:' or a temp file without caring about dataDir) — skip the filesystem scan and use
    // the old static default, so callers that only ever overrode dbFile see no behaviour change.
    dataDir = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), '.clinic-app'), 'ClinicApp');
  } else {
    const resolution = resolveDataDir();
    dataDir = resolution.dataDir;
    dataDirSource = resolution.source;
    legacyDataDirsFound = resolution.legacyCandidatesFound;
  }
  const base: Config = {
    dataDir,
    dataDirSource,
    legacyDataDirsFound,
    dbFile: path.join(dataDir, 'clinic.sqlite'),
    // Localhost only until HTTPS/LAN access controls are in place.
    host: process.env.HOST ?? '127.0.0.1',
    port: Number(process.env.PORT ?? 3080),
    timezone: process.env.CLINIC_TZ ?? 'Asia/Kolkata',
    sessionIdleMinutes: 30,
    sessionMaxHours: 12,
    loginMaxFailures: 5,
    loginLockMinutes: 5,
    screenLockMinutes: Number(process.env.CLINIC_SCREEN_LOCK_MINUTES ?? 5),
    backupDir: process.env.CLINIC_BACKUP_DIR ?? path.join(dataDir, 'backups'),
    backupPassphrase: passphraseFromEnv(),
    backupKeep: Number(process.env.CLINIC_BACKUP_KEEP ?? 30),
    backupIntervalHours: Number(process.env.CLINIC_BACKUP_INTERVAL_HOURS ?? 24),
    tlsDir: process.env.CLINIC_TLS_DIR ?? path.join(dataDir, 'tls'),
    httpRedirectPort: Number(process.env.CLINIC_HTTP_REDIRECT_PORT ?? 0),
    allowInsecureLan: process.env.CLINIC_ALLOW_INSECURE_LAN === '1',
  };
  return { ...base, ...overrides };
}
