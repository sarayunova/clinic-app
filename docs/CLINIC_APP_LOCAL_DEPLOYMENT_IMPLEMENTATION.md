# Clinic App — Local-First Hospital Deployment Implementation Plan

**Repository:** `sarayunova/clinic-app`  
**Target branch:** create a feature branch from the latest `main`  
**Prepared:** 2026-11-13  
**Implementation agent:** Claude Code  
**Status:** implementation specification; **not** evidence that changes have been made or tested

## 1. Goal and non-negotiable requirements

Turn the existing clinic application into a **simple-to-install, simple-to-start, local-first Windows clinic/hospital system**. A hospital operator should be able to install it using a single signed installer, complete a first-run wizard, and use it without Node.js, npm, Git, PowerShell or cloud services. All operational data must remain on a hospital-controlled computer, with authorised staff accessing the application securely over the local LAN/Wi-Fi.

**Non-negotiable:**

1. **Local data residency:** patient records, attachments, billing, audit history, credentials/session state and clinic configuration live on the local hospital server only. Never send patient data to an external service, analytics SDK, cloud backup or telemetry endpoint by default. No implicit OneDrive/Desktop/cloud-synced locations. **Exception (explicit opt-in only):** an authorised admin may enable periodic upload of the existing encrypted backup file to a Google Cloud Storage bucket as an *additional* off-device copy; see §6 "Optional cloud backup upload (opt-in)". This must remain off until explicitly configured — it does not change the local-first default.
2. **No internet dependency:** after installation, ordinary login, registration, OPD, IPD, prescription, discharge, billing, reports, local backups and restore must operate with internet disabled.
3. **Easy setup:** the Windows installer and first-run wizard must guide ordinary authorised hospital personnel through safe configuration. Staff should never need terminal commands for normal operations.
4. **Reliable startup:** app starts automatically when Windows boots, including before interactive sign-in; failure/restart/reboot cases are handled and surfaced to administrators.
5. **No data loss:** upgrade, repair, service reconfiguration and uninstall must never silently remove, overwrite or reset the clinic's records, keys or backups.
6. **Secure access:** server binds to loopback by default. LAN access requires validated HTTPS and explicitly configured trusted devices/network. Never expose ports to the public internet or enable insecure HTTP LAN access.
7. **Explicit backup/recovery:** encrypted backups, off-device copy guidance, restore verification, recovery documentation and routine drills are first-class features.
8. **Clinical safety:** do **not** treat easier deployment as clinical clearance. The README explicitly states the product is a development build and not yet ready for real patient information. Do not alter that status until independent clinical/privacy/security/operational validation is complete.

## 2. Existing repository: reuse rather than rebuild

Read the current repository before coding; the following existed in the checked `main` branch on 2026-11-13:

- `installer/clinic-app.iss`: Inno Setup installer (`ClinicAppSetup-0.1.0`) for Windows x64, optional autostart, shortcuts, and process shutdown on upgrade.
- `scripts/build-exe.mjs`, `server/sea-entry.ts`, `sea-config.json`: Node SEA packaging as `clinic.exe`; web build and migrations ship separately.
- `scripts/install-autostart.ps1`, `scripts/run-clinic.ps1`, `scripts/uninstall-autostart.ps1`; `docs/AUTO-START.md`: scheduled task + supervisor, with restart on process failure.
- `docs/BACKUP-AND-RESTORE.md`: AES-256-GCM encrypted SQLite snapshots, passphrase file, validation and CLI restore; patient documents are stored in the database and included in backups.
- `docs/HTTPS-SETUP.md`: local certificate authority and HTTPS configuration.
- `README.md`: existing local SQLite app with configurable `CLINIC_DATA_DIR`, `HOST`, `PORT`, timezone, backups and role-based permissions.
- `web/`: React/Vite UI; `server/`: Fastify server and database migrations; `tests/`: Vitest tests.

**Current issues that must be examined first:**

- Default data location is currently described as `%LOCALAPPDATA%\ClinicApp`, which can vary with the Windows account running the process. A service account change could unintentionally point the app at an empty database.
- The installer currently makes autostart optional but does not complete backup-key generation, backup destination and LAN HTTPS provisioning end to end.
- Existing guides have drifted: some documentation still says auto-start or attachments are not built; some manual claims must be checked against code.
- `installer/clinic-app.iss` currently force-kills the running process during installation; replace with graceful service stop, database quiescence and timeout/escalation logic.
- Windows service registration/boot behaviour has not yet been verified on a real hospital machine.
- Security-sensitive manual examples must not hardcode realistic-looking reusable passwords.

**Before starting:** inspect exact versions, actual database path resolution, service identity, lock file, migration runner, CLI backup/restore, HTTPS configuration, packaging paths, tests, and all relevant documentation. The paths above are discovery pointers, not permission to assume current code remains unchanged.

## 3. Supported deployment modes

### A. Standalone workstation (initial target)

- One Windows 10/11 or supported Windows Server machine runs the app, database and HTTPS server.
- Doctor uses the local desktop shortcut (`http://127.0.0.1:3080` only when loopback/HTTP mode is intentionally configured; otherwise the actual validated HTTPS URL).
- Must be fully functional offline.

### B. Local hospital server + staff devices (initial target)

- One dedicated always-on Windows PC/mini-server acts as **the only authoritative database host**.
- Doctors, nurses and receptionists connect using a browser over the private hospital LAN/Wi-Fi; no DB file sharing over SMB or direct SQLite access from clients.
- Client-device onboarding should be guided: server's private LAN address, certificate trust instructions, QR code that only encodes the validated private URL, browser shortcut/PWA where supported.
- The setup wizard should distinguish **Install Hospital Server** from **Connect this device to an existing server**. Client mode must **never** create another patient database or server task.

### C. Larger hospitals (future evaluation)

- Do **not** promise SQLite will support an arbitrary number of simultaneous users. Benchmark representative workloads and measure lock contention, backup duration, database size and recovery time.
- PostgreSQL or dedicated infrastructure may be required for high concurrency/multi-site operations; do not introduce it in this initial release without an explicit architecture decision.

## 4. Target architecture and filesystem

```text
C:\Program Files\ClinicApp\
    clinic.exe                 # immutable program binaries
    dist\web\ ...             # built UI
    migrations\ ...           # DB migrations
    support\ ...              # service helper/launcher as appropriate

C:\ProgramData\ClinicApp\     # example only; controlled by installer and service
    data\clinic.sqlite        # authoritative local database
    config\ ...               # machine configuration; no plaintext credentials
    tls\ ...                  # local cert material with restricted ACLs
    logs\ ...                 # operational logs, no clinical payloads
    secrets\ ...              # restricted, encrypted/protected secrets

D:\ClinicBackups\             # separate disk, encrypted backup files
```

**Path migration:** if an existing live database is found under `%LOCALAPPDATA%\ClinicApp` or another prior `CLINIC_DATA_DIR`, **do not** blindly create a new database or move it. Detect all plausible existing locations, present the discovered source/data footprint, require explicit admin selection, take and verify a backup, stop writers, safely copy/migrate with integrity checks, and verify record counts/checksums before switching the configured location. Retain the old files until an operator explicitly archives them after successful verification. If detection is ambiguous, fail closed with a clear instruction. Preserve database journals/WAL safely using the SQLite backup API or equivalent, not a raw live-file copy.

Configure the data path once at installation and persist it **machine-wide** for the service, launcher, backup/restore and upgrades. Paths must not silently depend on which user launches the app. Use restrictive Windows ACLs so that only the service identity and explicitly authorised administrators can access protected files. Avoid storing passwords in app configs, scheduled task arguments, logs or installer command lines. Prefer Windows DPAPI / Windows Credential Manager or an equivalent narrowly scoped approach where suitable; document recovery implications and ensure encrypted backup keys remain recoverable from an independently safeguarded recovery secret.

## 5. Required user experiences

### 5.1 Installer — one setup executable

Package a versioned, code-signed `ClinicApp-Setup-x.y.z.exe` that:

1. Runs a clear prerequisite check: Windows version/architecture, admin rights, free space, data/backup volumes, port conflicts, supported service account, firewall/AV implications, previous install, configured paths.
2. Offers **Server installation** or **Client shortcut setup**. Server installs software plus background service. Client mode installs only a launcher/shortcut or provides guided browser setup; never installs a DB.
3. Keeps binaries under `Program Files`, persistent data under `ProgramData` (or explicitly selected secured path), backup outside the live data volume where possible.
4. Detects existing installations and provides **Install / Upgrade / Repair / Cancel**. No silent fresh database on an upgrade.
5. Stops the server **gracefully**, allowing active writes to finish, then runs a verified pre-upgrade backup and safe schema migration. If any check fails, stop rather than continue. Resume service only when safe.
6. Preserves previous database and secrets. Provide a documented application-binary rollback path, and **do not automatically downgrade database schema**; recovery should use a compatible verified pre-upgrade backup if rollback requires it.
7. Registers startup, creates desktop/Start Menu shortcuts and an entry for system diagnostics; runs a post-install health check and clearly reports failures.
8. Includes a non-destructive uninstall path: stop/remove service and binaries, but keep patient data and backups. Any destructive data purge must be a separate, highly explicit, independently authorised procedure; not part of normal uninstall.
9. Does not require npm, Node installation, a Git checkout or internet on the destination machine.
10. Publishes deterministic, versioned build artifacts and checksums. Document signing/reputation requirements. Do **not** claim the build is signed unless a real signing certificate and signing step are configured.

### 5.2 First-run hospital setup wizard

Only an authorised person can complete setup. Capture and validate:

- Clinic/hospital name, address, contact, clinical administrator details.
- Server versus standalone mode; port, hospital timezone (`Asia/Kolkata` default, editable).
- Doctor/admin credential creation, with role-safe provisioning and a **second sealed emergency doctor account** (existing setup checklist).
- Machine-wide database path confirmation (display existing database detection result).
- Encryption/backup configuration: recovery passphrase, secure secret storage, backup destination on a separate disk if available; generate recovery instructions without displaying secrets in logs.
- LAN/Wi-Fi access choice: default **local PC only**; LAN opt-in requires HTTPS certificates, certificate trust setup, access address verification and firewall restricted to private network ranges.
- First backup and **restore-validation** self-test before declaring setup complete.
- Printer test, Windows startup verification, time sync and power/UPS checklist.
- Clear per-step statuses, retry, and handoff guide. Never mark requirements verified if the wizard has only collected a checkbox.

Avoid reimplementing clinical modules. Build the wizard atop existing authenticated clinic settings, cert, backup and setup-checklist code where possible.

### 5.3 One-click launch and health/status screen

The user opens a **Clinic App** desktop icon; it launches a browser at the locally configured secure URL, never a brittle hardcoded address. If the server is down, show a friendly launcher/diagnostics screen and allow an authorised operator to attempt service restart. Do not embed service-control permissions in an ordinary browser API or give nurses/reception access to privileged Windows operations.

An administrator-only dashboard should display:

- Service running/stopped; last boot; app version; server URL; network/HTTPS/certificate expiry.
- Database connected/integrity check; data path and usable disk space (do not show database contents).
- Last completed **verified** encrypted backup, configured backup destination and recent failures.
- Safe non-sensitive log excerpt / diagnostic bundle, with redaction.
- Local clock/timezone and service health.
- Explicit warnings when backup path is on the same physical disk, encryption is absent, certificate is invalid/expired, the machine is low on storage, or restore testing is overdue.

All indicators must be based on real checks; never hardcode green status.

### 5.4 Reliable Windows background startup

Prefer a manageable native Windows service (or thoroughly justify retaining the existing scheduled task/supervisor). Must:

- Start at boot even when no user signs in.
- Restart after process crash with backoff and bounded retry/logging; detect repeated failures and surface a visible alarm to the operator.
- Use the **same fixed data directory and service identity** across boots/upgrades.
- Expose start/stop/restart/status controls only to authorised local admins/installer; prevent accidental second server against the same DB.
- Stop cleanly for backup/restore/upgrade; preserve active transactions and WAL integrity.
- Avoid creating an unnecessarily privileged SYSTEM service if a lower-privilege dedicated identity is feasible.
- Be tested for Windows reboot, power loss recovery and Windows Update restarts; UPS and BIOS auto power-on remain operator dependencies.

## 6. Backup, restore and disaster recovery

Retain and strengthen existing encrypted backup implementation:

- Default backup interval should be configurable (currently documented as 24 h); schedule and execute only when healthy, track retention and storage capacity.
- Use consistent SQLite online backup/snapshot semantics, include uploaded documents, reopen/decrypt and verify the resulting database, and record verified completion.
- Support encrypted backup to a separate local disk and removable drive; distinguish **another partition on the same physical drive** from genuine off-device redundancy.
- Do not auto-upload to cloud storage **by default**. Offer explicit instructions to move encrypted copies to an offline/off-site location, and optionally the cloud upload described below once the admin opts in.
- Allow authorised admins to manually initiate a backup in the UI; show last verified result.

**Optional cloud backup upload (opt-in):**

- Off by default. An authorised admin must explicitly enable it in settings (not the first-run wizard's default path) by supplying a Google Cloud Storage bucket and credentials (service-account key, scoped to that bucket only — object write/list, not project-wide access).
- Uploads the **same already-encrypted backup artifact** produced by the existing AES-256-GCM backup process, unmodified — Google Cloud only ever receives ciphertext; the passphrase/key never leaves the local machine or is transmitted to Google.
- Runs on the same configurable interval as local backups (or its own separate interval, admin's choice), and only after the local backup has completed and passed its own integrity verification — never upload an unverified or partial snapshot.
- Upload must use TLS; verify checksum of the uploaded object against the local file after transfer; retry with backoff on failure; surface upload failures on the admin health dashboard (§5.3) as a distinct indicator from local backup health.
- Store the GCS service-account key itself the same way other secrets are stored (§4: DPAPI/Credential Manager or equivalent), never in plaintext config, logs, or scheduled task arguments.
- Document bucket lifecycle/retention configuration (e.g. GCS Object Lifecycle rules) separately from local retention; losing the local machine must not make cloud-held backups unrecoverable, and vice versa.
- Treat this as moving patient data (in encrypted form) outside hospital premises: call it out explicitly in the §7 privacy/consent review before enabling for any real hospital, since local-only claims in the UI/docs must not apply once this is turned on.
- Restore UI should be a **guided maintenance workflow**, with role/OS permission boundary, pre-restore safety backup, preview of source, timestamp and size, authenticated confirmation, service stop, integrity checks, atomic swap, verification and rollback guidance. Do not expose arbitrary filesystem writes/commands from an HTTP endpoint.
- Verify encrypted backup recovery on an isolated instance without overwriting the live system. Record routine drill date and result; require a full rehearsal before real use.
- Clearly communicate **RPO** (maximum potential data loss between backups) and **RTO** (time to restore) as measured and configurable, not invented guarantees.
- Store secrets separately from backups and ensure loss of the original machine does not make every backup unrecoverable.

## 7. LAN/security/privacy requirements

- Default localhost-only binding. Explicit server-admin action is required to listen on a private network.
- Require HTTPS and valid local certificate for LAN clients; provide clear onboarding and certificate expiry/renewal process.
- Restrict Windows firewall inbound rule to intended private interfaces/subnets and trusted hospital networks; do not expose to WAN or configure router port forwarding.
- Respect existing role-based permissions and audit log. Protect web sessions/cookies, CSRF-relevant endpoints, brute-force throttling, sensitive response caching, data exports and attachment downloads.
- Log service events without names, health details, Aadhaar digits, passwords or full API request bodies. Ensure diagnostics are redacted.
- Protect the local database with ACLs and recommend BitLocker/full-disk encryption; service operation alone does not provide disk encryption.
- Verify backup key/certificate key permissions and expiry. Confirm no third-party telemetry, external fonts/CDNs or online dependencies in the production build, **other than the opt-in Google Cloud Storage backup upload (§6), which must stay disabled unless explicitly enabled by an admin.**
- Include a location-specific privacy, consent, retention, clinical record access and secure disposal review before use with real patients. Do not claim legal or regulatory compliance without a documented assessment. **If cloud backup upload is enabled, this review must explicitly cover cross-border/off-premises data transfer of encrypted patient backups (e.g. applicable Indian data-protection requirements) before enabling it for any real hospital.**

## 8. Offline updates

Support local update packages via USB or trusted local transfer. Updates must:

1. Check version/signature/checksum, available disk and supported upgrade path.
2. Detect and preserve installed data directories, machine configuration and backup secrets.
3. Take a verified pre-upgrade encrypted backup and safely stop the service.
4. Apply binary changes/migrations in a transactionally safe sequence, run post-upgrade health checks, and report errors.
5. Re-enable service and show status; keep compatible backup and rollback instructions.
6. Never overwrite databases with sample data and never change the service data path silently.

An optional future online updater must be a separate opt-in proposal and must not be introduced silently.

## 9. Delivery phases and concrete acceptance criteria

### Phase 0 — Repository audit and decisions (PR 1)

- Inspect current installer, app startup, DB path and migration handling, backups/restore, networking and config.
- Create `docs/DEPLOYMENT-ARCHITECTURE.md` and an ADR for service strategy (Windows Service versus Scheduled Task).
- Document current vs target behaviour, known data-loss hazards, threat boundaries, and support matrix.
- Propose minimal migration strategy for existing installations.

**Accept:** documented choices, no guesswork about service context/data path, no patient-data-impacting changes yet.

### Phase 1 — Stable data directory and startup (PR 2)

- Implement deterministic machine-level data path configuration, safe existing-data detection/migration, restrictive permissions, service lifecycle and health endpoints/status.
- Ensure local-only operation and existing installations remain compatible.

**Accept:** app boots after reboot with no logged-in user, correct existing patient data remains visible, second instance is blocked, no new blank DB appears after changing the interactive Windows user.

### Phase 2 — Installer and first-run wizard (PR 3)

- Upgrade installer to one-click install/upgrade/repair with validated prerequisites and safe data handling.
- Add standalone/server/client setup choices and first-run wizard.

**Accept:** a fresh Windows test machine with no Node/npm/Git installs and launches the full app offline; repeat installation/upgrade retains data and configured identities; uninstall leaves data intact.

### Phase 3 — Backup, restore, status UI and LAN onboarding (PR 4)

- Guided backup setup, health/admin dashboard, safe restore procedure and local HTTPS staff device setup.

**Accept:** encrypted backup decrypts and restores on an isolated spare environment; corrupt/wrong-key backups are refused; LAN clients cannot connect until HTTPS and trust are configured; ordinary internet connectivity is not necessary.

### Phase 4 — Release hardening and real-machine validation (PR 5)

- Test real reboot/power failure recovery, certificate setup/renewal, printer outputs, Windows updates, multiple staff sessions, low disk, app crash, corrupt DB, backup drive removal, failed installer and interrupted upgrade.
- Review clinical-content safety, role permissions, privacy and documentation separately from installer release.
- Produce release checklist and operator manual.

**Accept:** evidence-backed checks with exact OS/build/hardware, test dates, pass/fail observations and open issues. **Do not label production-ready until all mandatory checks pass and the responsible clinician/security/privacy owners approve.**

## 10. Mandatory automated and manual test matrix

| Scenario | Expected behaviour |
| --- | --- |
| Fresh install with internet disconnected, no Node/npm | Installation succeeds and local app launches |
| Restart Windows before any interactive login | Server starts automatically |
| Crash/restart the server process | Controlled recovery; no corruption; operator-visible errors |
| Change Windows user / service context | Same configured database; never a silently empty DB |
| Upgrade with existing patient/test records, documents, billing | Counts, key identifiers and attachments preserved |
| Installer interrupted or disk fills | Old data remains recoverable; no false success |
| Uninstall/reinstall | Patient database and backup files preserved |
| Start a second instance | Refused without corrupting the database |
| External internet disconnected | Core workflows and local backups still work |
| LAN enabled without valid HTTPS | Server refuses insecure network binding |
| Non-authorised staff open admin/restore tools | Access denied |
| Backup disk removed or full | Explicit alarm; live database unaffected |
| Cloud backup upload disabled (default) | No network call to Google Cloud is made; health dashboard shows cloud backup as not configured |
| Cloud backup upload enabled, network unavailable | Local encrypted backup still succeeds; upload retried/queued; failure surfaced on dashboard, not silent |
| Cloud-held backup restore | Downloaded encrypted object decrypts and restores identically to a local-disk backup of the same snapshot |
| Incorrect backup passphrase / tampered backup | Restore refused; live DB unchanged |
| Restore from verified backup to isolated machine | Record counts and sample data agree |
| TLS certificate expires | Clear warning and controlled renewal guidance |
| Network device disconnects/reconnects | No duplicate writes / silent data loss |
| Concurrent doctor+nurse+reception workloads | No integrity errors; measured lock contention |
| Logs and exported diagnostics | No clinical records, keys, passwords or protected identifiers leaked |

Use synthetic patients only in development and test environments. Verify actual Windows service behaviours on Windows, not Linux-only CI emulation. Record test evidence; do not infer test success from source code alone.

## 11. Claude Code workflow instructions

**Act as a maintainer working in this repository. Do not begin with new clinical protocol features.**

1. First inspect the repository on the latest `main`; verify every referenced path and update this specification if reality differs.
2. Create a new feature branch and start with **Phase 0**. Show a concise implementation plan and explain any consequential architecture choices in an ADR.
3. Implement in small reviewable PRs by phase. Do not merge automatically or deploy to a real hospital without explicit approval.
4. Reuse current Fastify, SQLite, React, Node SEA, Inno Setup and existing security/backup mechanisms. Avoid a needless rewrite.
5. Preserve legacy installation migration and explicit rollback/recovery steps. Never run destructive database commands against unknown existing data.
6. Add unit/integration tests, Windows-specific verification scripts, installer smoke tests and an offline packaging check as appropriate.
7. For every PR provide: changed files, functionality, migration implications, commands executed, tests passed/failed, security/data risks, manual Windows tests still needed, and exact acceptance checklist status.
8. Update `README.md`, installer guide, backup and restore guide, staff manual and setup checklist to remove outdated claims only when corresponding features are verified.
9. If a prerequisite requires hospital-specific information (actual IP/subnet, Windows edition, printers, disk volume, service identity, owner, backup key custody), implement safe defaults and a guided choice; **do not fabricate configuration**.
10. Maintain the banner/status **NOT READY FOR REAL PATIENT INFORMATION** until separate production sign-off.

### Suggested first prompt to Claude Code

> Read `CLINIC_APP_LOCAL_DEPLOYMENT_IMPLEMENTATION.md` completely. Inspect the current `main` branch and audit the installer (`installer/clinic-app.iss`), standalone exe build, startup scripts, database path selection, backup/restore and HTTPS configuration. Start with Phase 0: write an architecture decision record and a gap analysis, then implement only the smallest safe first PR toward a fixed machine-wide local data directory and reliable boot-time startup. Do not change clinical protocols, delete/move existing patient data without migration safeguards, merge, or deploy. Run applicable tests and report exact results, risks, and unverified Windows-only behaviour.

## 12. Definition of done

The project qualifies for **deployment engineering completion** only when a nontechnical authorised operator can:

- Install the server using one verified Windows installer, offline, on a clean supported PC;
- Open it from a shortcut, with the server starting automatically after a reboot;
- Enrol doctor/nurse/reception devices securely on hospital LAN without installing a database on each device;
- Confirm all records are stored locally and remain present through upgrades, Windows user changes and reinstall;
- See trustworthy service/database/backup health and recover from a verified encrypted off-device backup;
- Run routine operations without terminal commands or public internet;
- Follow a concise, tested incident recovery manual.

**Deployment convenience is necessary but not sufficient for clinical release.** Clinical validation, privacy/security approval, operator training and real hospital acceptance testing remain independent release gates.
