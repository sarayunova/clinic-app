# ADR 0001: Service strategy — Windows Service vs. Scheduled Task

**Status:** Proposed (Phase 0 decision record; implementation and validation happen in Phase 1). Not yet implemented — no code changed by this ADR.

## Context

The implementation plan (`docs/CLINIC_APP_LOCAL_DEPLOYMENT_IMPLEMENTATION.md` §5.4) requires the clinic server to:

- start at boot with no interactive sign-in,
- restart after a crash with bounded retry and a visible alarm on repeated failure,
- use the *same fixed data directory and service identity* across boots and upgrades,
- expose start/stop/restart/status only to authorised local admins,
- prevent a second instance against the same database,
- stop cleanly for backup/restore/upgrade.

The current implementation (verified in `docs/DEPLOYMENT-ARCHITECTURE.md` §1) is a **Scheduled Task** (`ClinicApp`, trigger `AtStartup`, principal `S4U`/`RunLevel Limited`), registered to run as `$env:USERDOMAIN\$env:USERNAME` — i.e. whichever Windows account happened to run `install-autostart.ps1` — plus an in-process PowerShell supervisor loop (`run-clinic.ps1`) that restarts the child process with exponential backoff. A separate PID file (`server/restore.ts`) guards against a second instance.

This already satisfies "starts before interactive logon" (S4U + `AtStartup` doesn't require a signed-in session) and "restarts after crash" (two independent layers). It does **not** satisfy "same fixed service identity across operator changes": the task's identity is a specific human account, and that account is also what the current data-path default (`%LOCALAPPDATA%`) keys off. Change the account, change the identity and — under today's per-user data path — the data location too. This is the direct cause of hazard #1 and #3 in the gap-analysis doc.

## Decision

**Move to a genuine Windows Service**, registered under a dedicated, low-privilege local service account created by the installer (not a human admin's account, and not `LocalSystem`), using a thin, widely-used service wrapper rather than hand-rolling a Windows service host:

- **Wrapper:** [WinSW](https://github.com/winsw/winsw) (MIT-licensed, single self-contained exe, actively maintained, no .NET-version coupling to the host beyond what's embedded). It launches and supervises an arbitrary command line via an XML config, exposes standard `sc.exe`/Services.msc start/stop/restart, and has built-in crash-restart with configurable backoff — which can replace (not stack with) the current PowerShell supervisor loop, simplifying `run-clinic.ps1` into the command WinSW wraps rather than a second independent restart mechanism.
- **Identity:** a dedicated local account (e.g. `ClinicAppSvc`) created and password-rotated by the installer, granted exactly the rights it needs (log on as a service, read/write the machine-wide data directory under restrictive ACLs) and nothing else — not an administrator account, not an interactively-usable one.
- **Second-instance guard:** keep the existing PID-file check in `server/restore.ts` as defense-in-depth even though a real Windows Service also prevents a second SCM-managed instance by name — the PID file still protects against someone launching `clinic.exe` by hand outside the service.
- **Migration path:** `scripts/install-autostart.ps1` and `scripts/uninstall-autostart.ps1` are replaced by installer-driven service registration/removal in Phase 2; Phase 1 can prototype the WinSW config and service-account creation independently of the installer rewrite, and should keep the Scheduled Task path working until the service path is validated on a real machine (per the plan's "no guesswork about service context" acceptance bar).

This is a recommendation to validate with a Phase 1 spike (install WinSW-wrapped `clinic.exe` on a real Windows 10/11 machine, confirm boot-before-logon start, crash-restart, clean stop for backup, and SCM-restricted start/stop) before it is treated as final. If that spike surfaces a blocker, fall back to Option B below and document why.

## Alternatives considered

**A. Keep the Scheduled Task, fix only the identity/data-path coupling.**
Lower implementation cost — no new wrapper dependency, no new local account to manage. Register the task against a fixed dedicated local account instead of the installing admin's account, and make the data path machine-wide and independent of any account. This would satisfy the plan's letter but keeps a Scheduled Task doing a service's job: Task Scheduler has no concept of "the app is unhealthy," no standard `sc query` status surface hospital IT staff would recognise, and overlapping restart logic (task-level `RestartCount` + script-level backoff loop) is already slightly confusing today. Rejected as the primary path, but kept as the fallback if the WinSW spike fails, since it is strictly less risky to ship.

**B. NSSM (Non-Sucking Service Manager) instead of WinSW.**
Similar capability to WinSW, long history of use for exactly this (wrapping an arbitrary exe as a service). WinSW is preferred because it's still actively maintained upstream (NSSM's last release is old, though still widely used) and ships as a single file with the same XML-sidecar simplicity. Either is acceptable; Phase 1's spike should pick whichever proves less friction in practice and record the result here.

**C. Write a native Windows Service host (C++/Rust/a Node service shim like `node-windows`).**
Most "proper" but highest engineering cost and ongoing maintenance burden for a small team, with no capability benefit over a wrapper for this app's actual needs (single process, single port, no inter-service IPC). Rejected as disproportionate.

## Consequences

- Phase 1 adds a new third-party dependency (WinSW binary, vendored or downloaded during install) — must be checksummed/pinned like any other installer asset per plan §5.1.10.
- The installer gains responsibility for creating/managing a dedicated local service account, including password rotation and secure storage (plan §4's DPAPI/Credential Manager guidance applies here too).
- `run-clinic.ps1`'s backoff-loop logic becomes redundant once WinSW owns restart policy; Phase 1 should simplify it rather than run two restart mechanisms at once.
- Uninstall must remove the service registration and the dedicated account cleanly without touching `ProgramData` (same non-destructive guarantee the Scheduled Task path already has, per `installer/clinic-app.iss`'s current `[UninstallDelete]` scope).
- Until the Phase 1 spike is validated on a real Windows machine, the existing Scheduled Task path remains in place and functional — this ADR does not remove it yet.
