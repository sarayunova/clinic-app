import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export interface Config {
  dataDir: string;
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
  const dataDir =
    process.env.CLINIC_DATA_DIR ??
    path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), '.clinic-app'), 'ClinicApp');
  const base: Config = {
    dataDir,
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
