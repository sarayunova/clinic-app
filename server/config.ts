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
  /** Where encrypted backups are written. Should be a different disk from dataDir. */
  backupDir: string;
  /** Null = automatic backups off. Never stored in the database or sent to the browser. */
  backupPassphrase: string | null;
  backupKeep: number;
  backupIntervalHours: number;
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
    backupDir: process.env.CLINIC_BACKUP_DIR ?? path.join(dataDir, 'backups'),
    backupPassphrase: passphraseFromEnv(),
    backupKeep: Number(process.env.CLINIC_BACKUP_KEEP ?? 30),
    backupIntervalHours: Number(process.env.CLINIC_BACKUP_INTERVAL_HOURS ?? 24),
  };
  return { ...base, ...overrides };
}
