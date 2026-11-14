# Clinic App Standalone Windows Installer

This folder contains the Inno Setup script to package **Clinic App** into a single, standalone Windows installer (`ClinicAppSetup-<version>.exe`).

The resulting installer can be installed onto a clinic or ward computer with **no Node.js, npm, or Git installation required**.

---

## Prerequisites

1. **Node.js 22 LTS or later** (for building the app & Single Executable Application).
2. **Inno Setup 6** (free open-source installer compiler for Windows):
   - Download and install from [jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php)
   - Ensure `ISCC.exe` is in your `PATH` or located at `C:\Program Files (x86)\Inno Setup 6\ISCC.exe` (or `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`).

---

## Build Steps

Run these commands from the root of the `clinic-app` repository:

### 1. Build the Web Frontend
```powershell
npm run build
```
This generates the optimized React frontend bundles into `dist/web/`.

### 2. Build the Standalone Server Executable (`clinic.exe`)
```powershell
npm run build:exe
```
This uses esbuild and Node's Single Executable Application (SEA) feature to bundle:
- The Fastify backend server
- Database migrations & models
- CLI subcommands (`backup`, `restore`, `cert`)
into `dist-exe/clinic.exe`.

### 3. Compile the Inno Setup Installer
Using the Inno Setup command-line compiler:
```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\clinic-app.iss
```
Or open `installer\clinic-app.iss` in the Inno Setup GUI and click **Build > Compile**.

The generated installer will be saved to `installer/output/ClinicAppSetup-<version>.exe`, with the version taken from
`package.json` (`npm run build:installer` passes it to ISCC and refuses to package a `clinic.exe` built from a different
version). Next to it, `ClinicAppSetup-<version>.exe.sha256` holds its SHA-256 checksum. Whoever installs it should compare
the two before running it, especially if the file came on a USB drive or through a messaging app:

```powershell
Get-FileHash .\ClinicAppSetup-0.1.0.exe -Algorithm SHA256   # must equal the hash in the .sha256 file
```

The installer is not code-signed yet, so Windows SmartScreen will warn when it is run; the checksum is what confirms the file
is the one that was built.

---

## What the Installer Deploys

The installer's first page asks how this computer is being used:

- **Install the clinic server on this computer** - the full install, for the main clinic PC:
  - `clinic.exe` - Single executable running server and CLI tools.
  - `dist/web/` - Production web frontend assets.
  - `migrations/` - SQLite database migrations.
  - `scripts/` - Autostart and supervisor PowerShell scripts (`run-clinic.ps1`, `install-autostart.ps1`, `uninstall-autostart.ps1`).
  - `docs/` - Operational guides (`AUTO-START.md`, `BACKUP-AND-RESTORE.md`, `HTTPS-SETUP.md`, `CLINIC-OPERATIONS-MANUAL.md`).
  - Runs prerequisite checks (free disk space on both the install and `ProgramData` drives, Windows 10/Server 2016+, and whether the server's port is already in use by something else) before copying anything.
  - Generates a backup encryption passphrase and a certificate-authority passphrase automatically (cryptographically random, never typed by anyone), stores them restricted to administrators under `%ProgramData%\ClinicApp\secrets`, wires the backup passphrase into the autostart registration so automatic backups are on from first boot, and shows the passphrases once on screen to be written down and kept somewhere other than this computer. An upgrade/repair never regenerates an existing passphrase - doing so would make backups taken under the old one unrecoverable.
- **Connect this device to an existing clinic server** - client mode: installs no binary, no migrations and no database. It only asks for the server's address and creates a shortcut to it (plus `docs/HTTPS-SETUP.md` and `docs/CLINIC-OPERATIONS-MANUAL.md`, which apply to any staff device). Phones and tablets need no installer at all: the doctor's **Clinic → Connect a staff device** page shows a QR code that opens a guided certificate-trust page on the device (see `docs/HTTPS-SETUP.md`).

Targets `C:\ClinicApp` by default (either mode).

### Upgrade, repair and downgrade

Running the installer on a computer that already has the app:

- **Remembers what the computer is.** It starts on server or staff-device mode to match the existing install (and the server
  address, for a staff device). Switching a server to a staff device, or a staff device to a server, asks for confirmation,
  defaulting to No: the first stops serving patients from this computer, the second creates a new, separate database.
- **Says what it will do** on its first page: repair (same version) or upgrade from version X.
- **Refuses a downgrade by default** (older version over newer): the newer version may already have upgraded the database.
- **Stops the server gracefully, then takes a verified safety copy of the database before replacing anything.** It uses the
  new `clinic.exe` (extracted to a temp folder) and its `snapshot` command. The command finds the database exactly as the
  upgraded server will, opens it read-only, copies it with SQLite's online backup, and checks the copy's integrity and
  record counts. The copy goes in `%ProgramData%\ClinicApp\pre-upgrade\` (newest 3 kept). If no database exists yet, there is
  nothing to copy and setup continues. If the copy fails (damaged database, disk full, several possible data folders), setup
  says why and asks whether to continue without it, defaulting to **No: stop with nothing changed**.
- **Checks the server came back.** On the last page (when automatic start was chosen) it runs `clinic.exe health`. That
  waits up to 90 seconds for the server to answer, and checks that it is the *new* version answering, not an old process
  that survived the upgrade. The result is shown on the page.

The safety copy is **encrypted with the backup passphrase** (a `.cbk` file, the same format as regular backups) whenever
this computer has one, which every installer-made server does. To go back to it, reinstall the version it came from and
use the normal restore (`clinic.exe restore <file>.cbk --replace`, see `docs/BACKUP-AND-RESTORE.md`).
On older installs without a passphrase it is a plain `clinic-pre-upgrade-*.sqlite` file instead, kept in the data folder
under the same restricted permissions as the live database. To go back to that: stop the app, move `clinic.sqlite` aside,
copy the safety copy in as `clinic.sqlite`, and start the app with the version it came from.

### Data Directory Isolation
Patient data and the SQLite database default to the machine-wide `%ProgramData%\ClinicApp`, independent of which Windows account runs the server - see `docs/DEPLOYMENT-ARCHITECTURE.md` for the full detection/fallback logic (an existing per-user database from an older install is detected and kept in place, never silently replaced by an empty one; `CLINIC_DATA_DIR` always overrides both).
Upgrading or uninstalling the application from `C:\ClinicApp` **never touches or deletes patient data**.

---

## Command Line Usage for `clinic.exe`

Once installed or built, `clinic.exe` can be used directly from PowerShell or Command Prompt:

```powershell
# Start the clinic server
clinic.exe

# Run an encrypted backup snapshot
clinic.exe backup

# Verify or restore from a backup file
clinic.exe restore path\to\backup.cbk [--replace]

# Generate or update clinic TLS certificates
clinic.exe cert [--name <computer-name>] [--ip <ip-address>]

# Copy an existing per-user database to the machine-wide location (dry-run by default)
clinic.exe migrate-data-dir [--yes]

# Ask a running server to stop gracefully (used by the installer on upgrade)
clinic.exe request-stop [--timeout <seconds>]

# Verified copy of the database into <data folder>\pre-upgrade (server must be stopped; never creates a database);
# encrypted when a backup passphrase is available
clinic.exe snapshot [--passphrase-file <file>]

# Wait for this computer's server to answer and confirm it is this version (exit 0 ok, 1 down, 3 older version answering)
clinic.exe health [--timeout <seconds>] [--any-version]

# Print this program's version
clinic.exe version

# Show help
clinic.exe --help
```
