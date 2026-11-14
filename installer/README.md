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

The generated installer will be saved to:
```
installer/output/ClinicAppSetup-0.1.0.exe
```

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
- **Connect this device to an existing clinic server** - client mode: installs no binary, no migrations and no database. It only asks for the server's address and creates a shortcut to it (plus `docs/HTTPS-SETUP.md` and `docs/CLINIC-OPERATIONS-MANUAL.md`, which apply to any staff device). See the implementation plan's Phase 2 slice 5 for the richer client-onboarding flow (QR code, certificate-trust walkthrough) still to come.

Targets `C:\ClinicApp` by default (either mode).

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

# Show help
clinic.exe --help
```
