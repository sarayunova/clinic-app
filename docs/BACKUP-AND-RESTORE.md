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

**If this computer was set up using the Windows installer (`ClinicAppSetup-*.exe`), this is already done.**
The installer generates a strong random passphrase automatically, stores it restricted to
administrators under `%ProgramData%\ClinicApp\secrets`, and shows it once on screen so it can be
written down and kept somewhere other than this computer - see that screen's instructions. The
steps below are only for a from-source checkout, or to replace the installer-generated passphrase
with one of your own choosing.

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

Restoring replaces **every** record in the app with the contents of a backup. Anything entered after the backup was taken
will no longer appear. Use it to recover from lost or damaged data, not to undo one mistake.

### 1. Check the backup in the app (safe at any time)

**Clinic → System status → Restore from a backup.** It lists the backups and the safety copies taken before upgrades.
**Check** decrypts the chosen one into a temporary copy, checks it, and shows its patients, staff accounts and last
recorded change next to the live ones, warning you if work entered since then would no longer appear. It never changes
the live records. A wrong passphrase, or a damaged or altered file, is refused. So is a backup made by a **newer**
version of the app: install that version first.

### 2. Restore it on the clinic computer (administrator)

The page then shows the exact command for that backup. On the clinic computer, open PowerShell with **Run as
administrator** and run it, for example:

```powershell
powershell -ExecutionPolicy Bypass -File C:\ClinicApp\scripts\restore-backup.ps1 -Backup D:\ClinicBackups\clinic-20261031T140114Z.cbk
```

The script:
1. copies the backup into the data folder and checks it again
2. asks you to type `RESTORE`
3. stops the app gracefully
4. takes an encrypted safety copy of the current records (into `pre-upgrade\`, listed on the restore page)
5. restores; the current database is also kept beside it as `clinic.sqlite.before-restore-<time>`, and is put back
   automatically if the restored one fails to open
6. starts the app again and checks it answers.

Every step is written to `logs\restore-<time>.log` in the data folder. If anything fails before step 5 completes, nothing
has changed and the app is started again. Afterwards, open the app and check some recent patients. Once you are sure,
the `before-restore` file can be deleted.

A backup on a USB drive can be restored the same way: give the script its path. To only check one without the app,
run `clinic.exe restore <file> --check` (it leaves no file behind).

## Practice the restore

On **Clinic → System status**, **Test restore now** takes a backup and restores it into a separate copy through the same
code a real restore uses, without touching the live records. The page shows when it last passed and warns when it has
not passed in 90 days. Also check (step 1 above) a copy from the USB drive **once a month**: a backup that has never been
test-restored is a hope, not a backup. Before real patient data is entered, do a full practice restore (step 2) on a
spare computer and confirm the counts match.

## Not covered here

- This protects against loss and damage. It does not replace disk encryption (BitLocker) on the clinic computer.

## Uploaded documents are inside the backup

Scans and reports uploaded to a patient are stored inside the database, so every backup and every restore includes them,
with nothing extra to copy. The trade-off is size: each backup is a full copy, so as documents accumulate the database and
each daily backup grow with them (10 MB is the limit per file). Check the size of the backup folder now and then, make sure
the backup disk has room for 30 copies, and tell whoever maintains the system if backups start taking long or the disk fills.
