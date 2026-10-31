import os from 'node:os';
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
  };
  return { ...base, ...overrides };
}
