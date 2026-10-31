# Clinic App (development build)

Patient management for one gynaecologist at one clinic (OPD + IPD). Built against
`../Gynaecology-Patient-Management-System-Specification.md`.

**Status: stage 2 (core workflows), partly done. NOT ready for real patient information.**

## Run

Requires Node.js 24.

```
npm install
npm test            # 17 API tests
npm run typecheck
npm run dev         # sample data in ./.devdata, auto-restart
npm start           # real data in %LOCALAPPDATA%\ClinicApp (override with CLINIC_DATA_DIR)
```

Open http://127.0.0.1:3080. On first run `POST /api/setup` creates the doctor account.
The server listens on this computer only. `HOST`, `PORT` and `CLINIC_TZ` (default `Asia/Kolkata`) are configurable.
Do not set `HOST` to expose it on the network until HTTPS exists (see below).

## Roles

| | Doctor | Nurse | Attender |
| --- | :-: | :-: | :-: |
| Search patients, see demographics + allergy alert | yes | yes | yes |
| See histories, medicines, clinical notes | yes | yes | no |
| Edit demographics | yes | no | yes |
| Edit allergies | yes | yes | no |
| Edit clinical history | yes | no | no |
| Book appointments, mark waiting/cancelled/absent | yes | status only | yes |
| Start / complete consultation | yes | no | no |
| Manage users, read audit log | yes | no | no |

Role boundaries for nurse and attender are my assumptions - confirm with the doctor.

## Built so far (API only)

- Setup, login (scrypt hashes, 30 min idle / 12 h absolute sessions, lockout after 5 failures), forced password change for new accounts.
- Users and roles; deactivation ends sessions.
- Patients: sequential numbers, search by name/number/phone, duplicate warning (does not block), unknown vs none allergy, field-level permissions, stale-edit rejection (409).
- Appointments: clinic-timezone aware, status transitions enforced per role.
- Append-only audit log (database triggers block edit/delete), with before/after values and record views.

## Remaining before real clinic use

- **No user interface yet** (responsive for PC, tablet, phone; large touch targets for nurse screens).
- OPD consultations, prescriptions, finalisation and versioned amendments.
- IPD: beds, admissions, care entries, medicine orders vs administration, discharge summary.
- Billing: itemised invoices, payments, receipts, adjustments.
- Printable prescription / discharge summary / invoice / receipt.
- Attachments (private storage, type and size limits).
- HTTPS for LAN access from other devices.
- Encrypted automated backups and a tested restore (database + attachments).
- Audit of exports; patient record export.
- Login lockout is in memory (resets on restart); no screen-lock timer in the UI yet.
- Confirm privacy, retention and clinical-document rules for the clinic's location.
- BitLocker on the server PC; UPS; named owner for backups and updates.
