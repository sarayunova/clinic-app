# Starting the clinic app automatically with Windows

Without this, someone has to open a terminal and type `npm start` after every power cut or restart, and until they do
nobody can use the system. With it, the clinic computer starts the app by itself about 30 seconds after Windows starts
(even if nobody has logged in) and starts it again if it ever stops. This page is for whoever looks after the clinic computer.

## What gets installed

One Windows scheduled task called **ClinicApp**. It runs `scripts\run-clinic.ps1`, which starts the server, writes
logs, and restarts the server a few seconds after it stops for any reason. It runs as the Windows user who installs it,
with ordinary (not administrator) rights, and stores no password. Nothing else on the computer is changed.

The backup passphrase is **not** put into the task. Keep it in its own file and give the installer the file's location.

## One-time setup

1. **Put the app in a plain folder**, for example `C:\ClinicApp`, not on the Desktop or in OneDrive. At start-up
   those folders may not be available yet, and patient data must never be in a cloud-synced folder.

   ```powershell
   cd C:\ClinicApp
   npm ci
   npm run build
   ```

2. **Make a backup passphrase file** (at least 12 characters, one line) somewhere only you can read, for example
   `C:\ClinicSecrets\backup-passphrase.txt`. Keep a copy of the passphrase away from this computer
   (see `docs/BACKUP-AND-RESTORE.md`). Without it, automatic backups stay off and the app warns on screen.
3. **Preview**, in PowerShell:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1 -DryRun `
     -BackupPassphraseFile C:\ClinicSecrets\backup-passphrase.txt -BackupDir D:\ClinicBackups
   ```

   It prints the task it would create and warns about anything likely to go wrong. It creates nothing.
4. **Install**, in a PowerShell opened with *Run as administrator*: the same command without `-DryRun`
   (add `-StartNow` to start it straight away).
5. **Check it**: restart the computer, wait a minute, and open http://127.0.0.1:3080 without opening any terminal.
   Look at the backup banner in the app, and at the logs (below).

Useful options: `-DataDir` (default: the same data folder as when you start the app by hand), `-Port`,
`-ListenHost 0.0.0.0` (tablets and phones; only after HTTPS is set up, see `docs/HTTPS-SETUP.md`), `-TlsDir`.
If the data folder differs from the one you have been using, the app will start with an empty system.

## Everyday use

| Want to | Do this (administrator PowerShell) |
| --- | --- |
| See if it is running | `Get-ScheduledTask ClinicApp` shows *Running*; or open the app |
| Stop it now (for maintenance, a restore) | `Stop-ScheduledTask ClinicApp` |
| Start it again | `Start-ScheduledTask ClinicApp` |
| Turn automatic start off | `powershell -ExecutionPolicy Bypass -File scripts\uninstall-autostart.ps1` (patient data is not touched) |

**Stop it before restoring a backup or updating the app**, then start it again afterwards. If you start the app by hand
while the task is running, the second copy refuses to start ("another clinic server is already running").

To update the app: stop the task, update the files (`git pull`, `npm ci`, `npm run build`), start the task.

## Logs

In the data folder, under `logs`: `supervisor.log` (starts, stops, restarts), and one `server-YYYYMMDD.out.log` /
`.err.log` pair per day. Logs older than 30 days are deleted. They contain no patient records (the audit log inside
the database is the record of who did what). If the app will not start, `supervisor.log` shows that it keeps
restarting and `server-*.err.log` shows why; a broken setup is retried every 10 seconds, slowing to every 2 minutes.

## What this does not do

- It does not keep the computer itself switched on, protected from power cuts (use a UPS), or set to start after a power
  failure (a BIOS/firmware setting, "restore on AC power loss").
- Windows updates may restart the computer; the app comes back by itself, but anyone using it will see a short outage.
- It does not make the app reachable from outside the clinic, and should not be made so.
- It was written and tested here only up to the point of registering the task (the preview, the restart supervisor,
  and Windows PowerShell 5.1 compatibility). **The first real install and restart must be checked on the clinic computer**
  (step 5 above).
