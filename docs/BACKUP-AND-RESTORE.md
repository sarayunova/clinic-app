# Backups and restore

The clinic database is one file. If it is lost or damaged and there is no backup, every record is gone.
This page is for whoever looks after the clinic computer.

## How it works

- While the clinic app is running it takes a backup automatically (every 24 hours by default) and keeps the newest 30.
- Each backup is a consistent snapshot, compressed and **encrypted** (AES-256-GCM, key from your passphrase).
  Straight after writing, the app opens it again and checks the database inside. A backup that cannot be read back is
  treated as a failure and shown as one.
- The doctor sees backup status under **Clinic** in the menu, and a warning bar on every screen if backups are
  off, failed, or more than two intervals old.
- The passphrase is never stored in the database or shown in the app. **Without the passphrase a backup cannot be opened by
  anyone.** Write it down and keep it somewhere that is not this computer (for example with the doctor, in a sealed envelope).

## One-time setup

1. Choose a passphrase of at least 12 characters (a few random words is good).
2. Save it in a text file that only the clinic's Windows account can read, for example
   `C:\ClinicSecrets\backup-passphrase.txt` (one line, nothing else).
3. Choose a backup folder **on a different disk** from the data, for example `D:\ClinicBackups`.
4. Start the app with these settings (PowerShell):

   ```powershell
   $env:CLINIC_BACKUP_PASSPHRASE_FILE = "C:\ClinicSecrets\backup-passphrase.txt"
   $env:CLINIC_BACKUP_DIR = "D:\ClinicBackups"
   npm start
   ```

   Optional: `CLINIC_BACKUP_KEEP` (how many to keep, default 30) and `CLINIC_BACKUP_INTERVAL_HOURS` (default 24).
5. Open **Clinic** in the menu and press **Back up now**. It should say "Backup taken and checked".

If the app is not running, no automatic backup happens. If the computer is switched off overnight, the first
backup runs shortly after the app is next started.

## Copy backups off the computer

A backup on the same computer does not protect against theft, fire, a failed disk or ransomware.
At least weekly, copy the files in the backup folder to a USB drive (or another computer) that is kept elsewhere.
Backups are encrypted, so a lost USB drive does not expose patient data, but keep the passphrase separate from it.

## Restore

Stop the clinic app first (press Ctrl+C in its window).

1. Check a backup without changing anything:

   ```powershell
   npm run restore -- D:\ClinicBackups\clinic-20261031T140114Z.cbk
   ```

   This decrypts it, checks the database, prints how many patients and users it holds, and writes a copy named
   `restored-<time>.sqlite` next to the live database. The live database is not touched.
   A wrong passphrase, a damaged file or a changed file is refused with a clear message.
2. Replace the live database with the backup:

   ```powershell
   npm run restore -- D:\ClinicBackups\clinic-20261031T140114Z.cbk --replace
   ```

   The current database is **moved aside, not deleted** (`clinic.sqlite.before-restore-<time>`). Start the app and check
   that the records you expect are there. Anything entered after the backup was taken is not in it.
3. Delete the `restored-*.sqlite` copy and, once you are sure, the `before-restore` copy.

## Practice the restore

Do step 1 (check only) **once a month**, using a copy from the USB drive. A backup that has never been test-restored
is a hope, not a backup. Before real patient data is entered, do a full practice restore on a spare folder and confirm the
patient counts match.

## Not covered yet

- Attachments (scans, reports) do not exist in the app yet; when they do, backups must include them.
- The app does not start by itself when Windows starts. Until it does, make sure it is running during clinic hours and overnight is not guaranteed.
- This protects against loss and damage. It does not replace disk encryption (BitLocker) on the clinic computer.

## Uploaded documents are inside the backup

Scans and reports uploaded to a patient are stored inside the database, so every backup and every restore includes them,
with nothing extra to copy. The trade-off is size: each backup is a full copy, so as documents accumulate the database and
each daily backup grow with them (10 MB is the limit per file). Check the size of the backup folder now and then, make sure
the backup disk has room for 30 copies, and tell whoever maintains the system if backups start taking long or the disk fills.
