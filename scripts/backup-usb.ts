/**
 * Standalone USB Backup Daemon & Removable Drive Syncer
 *
 * Automatically detects connected USB flash drives, performs SQLite WAL checkpoint,
 * creates encrypted/integrity-verified backups, and computes SHA-256 verification hash.
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runBackup, inspectDatabase } from '../server/backup.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';

function detectUsbDrive(): string | null {
  // Check CLI arguments first
  const args = process.argv.slice(2);
  const destArgIdx = args.findIndex((a) => a === '--dest' || a === '-d');
  if (destArgIdx !== -1 && args[destArgIdx + 1]) {
    return args[destArgIdx + 1];
  }
  const driveArgIdx = args.findIndex((a) => a === '--drive');
  if (driveArgIdx !== -1 && args[driveArgIdx + 1]) {
    return `${args[driveArgIdx + 1]}:\\LiVi-Backups`;
  }

  // Windows PowerShell command to detect removable volumes
  if (process.platform === 'win32') {
    try {
      const psScript = "Get-Volume | Where-Object { $_.DriveType -eq 'Removable' -and $_.DriveLetter } | Select-Object -ExpandProperty DriveLetter";
      const output = execSync('powershell', {
        input: psScript,
        encoding: 'utf8',
      }).trim();
      const letters = output
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^[A-Za-z]$/.test(l));
      if (letters.length > 0) {
        return `${letters[0]}:\\LiVi-Backups`;
      }
    } catch {
      // Fallback
    }
  }

  return null;
}

function calculateSha256(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

async function main() {
  console.log('================================================================');
  console.log('       LiVi CLINIC - AUTOMATED USB FLASH DRIVE BACKUP');
  console.log('================================================================\n');

  let usbDest = detectUsbDrive();
  if (!usbDest) {
    console.warn('[NOTICE] No removable USB flash drive detected automatically.');
    usbDest = path.join(process.cwd(), 'data', 'usb-backups');
    console.log(`[INFO] Defaulting backup target to local folder: ${usbDest}`);
  } else {
    console.log(`[INFO] Removable USB Drive Detected! Target: ${usbDest}`);
  }

  try {
    fs.mkdirSync(usbDest, { recursive: true });
  } catch (err: any) {
    console.warn(`[WARN] Could not write to detected target ${usbDest} (${err.message}).`);
    usbDest = path.join(process.cwd(), 'data', 'usb-backups');
    console.log(`[INFO] Falling back to local directory: ${usbDest}`);
    fs.mkdirSync(usbDest, { recursive: true });
  }

  const cfg = loadConfig();
  let dbFile = cfg.dbFile;

  if (!fs.existsSync(dbFile)) {
    // Check devdata or local data
    const devDb = path.join(process.cwd(), '.devdata', 'clinic.sqlite');
    const localDb = path.join(process.cwd(), 'data', 'clinic.sqlite');
    if (fs.existsSync(devDb)) {
      dbFile = devDb;
    } else if (fs.existsSync(localDb)) {
      dbFile = localDb;
    } else {
      console.error(`[ERROR] Clinic database file not found at: ${dbFile}`);
      process.exit(1);
    }
  }

  console.log(`[INFO] Database: ${dbFile}`);
  console.log('[INFO] Performing SQLite WAL checkpoint (TRUNCATE)...');
  const db = openDb(dbFile);
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (err: any) {
    console.warn('[WARN] Checkpoint notice:', err.message);
  }

  // Generate backup directly into USB directory
  const originalBackupDir = cfg.backupDir;
  cfg.backupDir = usbDest;
  if (!cfg.backupPassphrase) {
    cfg.backupPassphrase = 'clinic-default-secure-passphrase-usb';
  }

  try {
    console.log('[INFO] Creating encrypted snapshot and verifying integrity...');
    const result = await runBackup(db, cfg);
    const backupFilePath = path.join(usbDest, result.file);
    const sha256 = calculateSha256(backupFilePath);

    // Write manifest receipt
    const manifest = {
      backupFile: result.file,
      targetPath: backupFilePath,
      sizeBytes: result.sizeBytes,
      sha256,
      createdAt: new Date().toISOString(),
      integrity: result.verify.integrity,
      databaseStats: {
        patients: result.verify.patients,
        users: result.verify.users,
        appliedMigrations: result.verify.migrations,
      },
      verified: true,
    };

    const manifestPath = path.join(usbDest, `${result.file}.manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log('\n----------------------------------------------------------------');
    console.log(' [SUCCESS] USB BACKUP COMPLETED & VERIFIED SUCCESSFULLY!');
    console.log('----------------------------------------------------------------');
    console.log(` File Name    : ${result.file}`);
    console.log(` Destination  : ${backupFilePath}`);
    console.log(` Size         : ${(result.sizeBytes / 1024).toFixed(1)} KB`);
    console.log(` SHA-256 Hash : ${sha256}`);
    console.log(` Patients     : ${result.verify.patients}`);
    console.log(` Integrity    : ${result.verify.integrity.toUpperCase()}`);
    console.log(` Manifest     : ${manifestPath}`);
    console.log('----------------------------------------------------------------\n');
  } catch (err: any) {
    console.error('[ERROR] Backup operation failed:', err.message);
    process.exit(1);
  } finally {
    cfg.backupDir = originalBackupDir;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
