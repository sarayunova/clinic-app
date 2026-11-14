# Deployment Architecture — Gap Analysis (Phase 0)

**Status:** Phase 0 deliverable per `docs/CLINIC_APP_LOCAL_DEPLOYMENT_IMPLEMENTATION.md` §9. Documentation only — no code, data-path, service, or installer behaviour changes in this PR.

**Scope:** what the repository actually does today (verified by reading the code, not the existing docs) versus what the local-deployment implementation plan requires, so Phase 1 starts from facts instead of assumptions.

## 1. Current state, verified against code

| Subsystem | Current behaviour | Evidence |
| --- | --- | --- |
| Data directory | `CLINIC_DATA_DIR` env override, else `%LOCALAPPDATA%\ClinicApp` (per-Windows-user), else `~/.clinic-app` | `server/config.ts:40-42` |
| Database file | `<dataDir>/clinic.sqlite` | `server/config.ts:45` |
| Backup dir / TLS dir | Both default to subfolders of the same `dataDir` unless overridden | `server/config.ts:55,60` |
| Process lifecycle | Windows **Scheduled Task** (`ClinicApp`), trigger `AtStartup` + 30s delay, principal `S4U` / `RunLevel Limited`, `UserId` = the account that *ran the installer script* (`$env:USERDOMAIN\$env:USERNAME`) | `scripts/install-autostart.ps1:73,92-106` |
| Crash recovery | Two layers: SCM-level `RestartCount 5` / `RestartInterval 1min` on the task itself, plus an independent exponential-backoff loop (5s→120s, unbounded) inside the launched script | `scripts/install-autostart.ps1:97`, `scripts/run-clinic.ps1:63-87` |
| Second-instance guard | Plain PID file (`server.pid`), liveness checked via `process.kill(pid, 0)`, enforced before DB open | `server/restore.ts:7-18`, `server/index.ts:26-29` |
| Migrations | Run on every `openDb()` call (every boot, every CLI backup/restore), tracked in `schema_migrations`, 149 lexically-sorted `.sql` files, no down-migrations | `server/db.ts:26-43`, `server/migrations/*.sql` |
| Backup encryption | AES-256-GCM over a gzip'd SQLite snapshot; key via `scryptSync(passphrase, salt, 32)`; passphrase from `CLINIC_BACKUP_PASSPHRASE_FILE`/`CLINIC_BACKUP_PASSPHRASE`, never persisted by the app | `server/backup.ts:1-30` |
| Backup verification | Every backup is decrypted and integrity-checked immediately after writing, before being reported as successful | `server/backup.ts` (`runBackup`, ~150-188) |
| Patient documents in backups | Confirmed: attachments live in the DB (migration `007_attachments.sql`, `server/routes/attachments.ts`), so they are included automatically | `docs/BACKUP-AND-RESTORE.md:78-83` |
| Backup/restore surfaces | Both CLI (`clinic.exe backup` / `restore`) and HTTP (`GET /api/backups`, `POST /api/backups/run`, `GET /api/backups/download/:filename`), gated by `backup:manage` permission | `server/sea-entry.ts:7-14`, `server/routes/backups.ts` |
| HTTPS / LAN binding | Defaults to `127.0.0.1`. `checkListenSafety()` **actively refuses** to listen on a non-loopback host without active TLS, throwing unless `CLINIC_ALLOW_INSECURE_LAN=1` is explicitly set (and even then shows a scary warning) | `server/config.ts:46-47`, `server/tls.ts:166-176` |
| TLS material | Self-issued private CA + per-server cert (node-forge), expiry enforced at load | `server/tls.ts` |
| Installer shutdown | **Force-kills** the running process on every install/upgrade — no graceful stop, no coordination with the app's own SIGTERM handler | `installer/clinic-app.iss:24,40-42`, cf. clean shutdown path at `server/index.ts:61-70` that is never given a chance to run |
| Installer + data directory | `[UninstallDelete]` only removes the app's own program-folder subfolders (`dist`, `migrations`, `scripts`, `docs`); **never touches** `%LOCALAPPDATA%`/`ProgramData` | `installer/clinic-app.iss:75-82` |
| Packaging | `scripts/build-exe.mjs` bundles `server/sea-entry.ts` with esbuild → CJS, injected into a Node SEA executable via `postject`, producing `clinic.exe`. Web build (`dist/web`) and migrations ship as plain folders beside the exe, resolved relative to `process.execPath` when running as SEA | `scripts/build-exe.mjs`, `sea-config.json`, `server/db.ts:9-15`, `server/index.ts:32-38` |
| Automated test coverage | `tests/backup.test.ts` covers encrypt/decrypt round-trip, tamper detection, restore, pruning, HTTP surface (incl. path traversal). **No test** covers the PID-file second-instance guard, `CLINIC_DATA_DIR` resolution, or any Scheduled Task/supervisor script (inherently untestable in CI — Windows-only, interactive-session-dependent) | `tests/backup.test.ts`, `tests/lock.test.ts` (covers login lockout, not instance locking) |

## 2. Known data-loss / correctness hazards (confirmed, not hypothetical)

1. **Per-user data directory.** Because `dataDir` defaults to `%LOCALAPPDATA%` of whichever Windows account is active, and the Scheduled Task's `UserId` is fixed to whichever account ran `install-autostart.ps1`, any of the following silently produces an empty-looking database instead of an error:
   - A different admin re-runs the installer/autostart script under their own account.
   - The original account is renamed, removed, or its profile is reset.
   - Someone runs `clinic.exe` by hand under a different login to "check something."
   This is the exact hazard the implementation plan's §2 calls out, and it is live in the current code, not just a theoretical risk.
2. ~~**Ungraceful installer shutdown.**~~ **Fixed.** `PrepareToInstall` now calls `clinic.exe request-stop --timeout 30` first — a sentinel file (`server/restore.ts`'s `requestGracefulStop`/`shutdownRequestFile`) that a running server polls for and responds to by draining through its existing SIGINT/SIGTERM shutdown path (stops the backup scheduler, closes the HTTP listener, closes the database, removes its own pid file) rather than being killed mid-write. Chosen over sending a POSIX-style signal because Windows cannot reliably deliver one to an external process the way `Stop-Process`/`taskkill` can be relied on to just terminate it. The previous force-kill sequence remains as the fallback if the graceful request times out — including the one-time upgrade from a version that predates this command, where the old binary's attempt to parse `request-stop` as a server-start argument is safely rejected by the existing second-instance guard, falling through to the same fallback. Verified end-to-end against a real running instance (isolated data directory and port), not just unit-tested.
3. **No machine-wide identity.** Because both the data path and the Scheduled Task principal are tied to a specific human account rather than a fixed machine-level identity, "service identity" and "data location" currently drift together in a way that defeats the plan's requirement that both stay fixed across boots, upgrades, and operator changes.
4. **Dev convenience script risk.** The untracked `scripts/clean-install.ps1` unconditionally deletes `%LOCALAPPDATA%\ClinicApp` and `C:\ClinicApp` with no confirmation prompt. It is not wired into any shipped flow (not referenced by the `.iss` installer or `package.json`) and appears to be the repo owner's own dev-machine reset tool — flagged here only so Phase 1 does not accidentally generalize or ship it; left untouched as it's outside this plan's scope and may be in-progress work.

## 3. Threat / trust boundaries

- **Loopback (same machine) → authenticated session:** current default; low risk, already enforced as the only binding `checkListenSafety` allows without TLS.
- **LAN device → server:** requires explicit admin opt-in (`HOST` ≠ loopback) **and** valid TLS, or the server refuses to start. This boundary is already enforced in code, ahead of the plan's own requirement — Phase 1/3 work here is onboarding UX, not the enforcement itself.
- **Installer → running process:** currently crosses the boundary destructively (force-kill) with no negotiation. This needs to become a cooperative shutdown (installer signals, app drains and exits, installer verifies exit) before Phase 2 ships an installer with upgrade-in-place.
- **Any local Windows account → app identity:** currently *not* a real boundary — any account that can run the install script or `clinic.exe` directly becomes "the" service identity. Phase 1 must collapse this to a single fixed machine-level identity (see ADR on service strategy).
- **Optional cloud backup upload (planned, §6 of the implementation doc):** a new boundary once implemented — local machine → Google Cloud Storage. Must stay opt-in, upload ciphertext only, and never transmit the backup passphrase/key.

## 4. Support matrix (as currently exercisable)

| Mode | Current support | Gap to plan |
| --- | --- | --- |
| A. Standalone workstation | Works today for a single logged-in-or-not session on one machine, modulo hazard #1 above | Needs machine-wide data path + fixed service identity |
| B. Hospital server + LAN clients | TLS/loopback enforcement exists; no guided client onboarding (QR/cert-trust flow), no server/client install-mode split in the installer yet | Phase 2/3 work, not yet started |
| C. Larger hospitals / multi-site | No concurrency benchmarking exists | Explicitly out of scope for this initial release per the plan — do not build ahead of a measured need |

## 5. Minimal migration strategy for existing installations

Any machine that already has a live database under the current per-user `%LOCALAPPDATA%\ClinicApp` (or a custom `CLINIC_DATA_DIR`) must not lose data when Phase 1 introduces a machine-wide path. Proposed sequence (to be implemented, not yet built):

1. On first boot after the Phase 1 upgrade, detect all plausible existing data directories (current user's `%LOCALAPPDATA%\ClinicApp`, any value previously recorded for `CLINIC_DATA_DIR`, and — best-effort — other local user profiles' `%LOCALAPPDATA%\ClinicApp` if the service account has rights to enumerate them).
2. If exactly one candidate contains a non-empty `clinic.sqlite`, present it to the installing admin for explicit confirmation — never silently adopt it, never silently create a fresh empty DB alongside it.
3. Take a verified backup of the discovered database *before* touching anything (reuse `server/backup.ts`'s existing encrypt-and-verify path).
4. Copy the database using SQLite's own backup API (or an equivalent WAL-safe method) — never a raw file copy of a possibly-open file — into the new machine-wide path (`C:\ProgramData\ClinicApp\data\`, per the plan's §4 target layout).
5. Verify row counts / checksums between source and destination before switching the live configuration to the new path.
6. Leave the old location untouched on disk until an operator explicitly archives it after confirming the new location works across a reboot.
7. If more than one plausible candidate is found and they disagree, fail closed with a clear message rather than guessing.

This sequence is deferred to Phase 1 implementation; Phase 0 only establishes that it is required and roughly what it must do.

## 6. Documentation drift found during this audit

- `docs/BACKUP-AND-RESTORE.md` **contradicts itself**: its "Not covered yet" section (lines ~72-75) claims attachments "do not exist in the app yet" and that "the app does not start by itself when Windows starts" — both false against current code (attachments ship via migration `007` + `routes/attachments.ts`; autostart ships via `install-autostart.ps1`). Three lines later in the same file (~78-83), a different section correctly describes attachments being included in backups. This file needs a consistency pass before it's handed to an operator.
- `installer/README.md` (around lines 62-63) repeats the `%LOCALAPPDATA%` default as if it were settled, rather than flagging it as the known hazard this plan addresses.
- `README.md`'s "not ready for real patient information" banner is current and should **not** be changed by any Phase 0-4 deployment work — only an independent clinical/privacy/security sign-off can change it (plan §1.8, §12).
- Two existing scripts are not inventoried in the implementation plan's §2 and should be tracked going forward: `scripts/setup-clinic-pc.ps1` (an undocumented convenience wrapper) and `scripts/seed-demo.ts` (reads `CLINIC_DATA_DIR`/`.devdata` — Phase 1 should confirm it can never be pointed at a real machine-wide data directory by accident).

## 7. What Phase 1 inherits from this document

- Build the machine-wide data path and the existing-data migration sequence in §5.
- Resolve service identity per the companion ADR (`docs/ADR-0001-WINDOWS-SERVICE-VS-SCHEDULED-TASK.md`).
- Do not touch backup encryption, HTTPS enforcement, or migration-runner logic — all three already meet the plan's intent and only need machine-wide-path wiring, not redesign.
- Installer graceful-shutdown rework (hazard #2) is Phase 2 scope (installer rewrite), but Phase 1's service-identity change should not make it harder to fix later.
