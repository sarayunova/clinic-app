# Clinic App (development build)

Patient management for one gynaecologist at one clinic (OPD + IPD). Built against
`../Gynaecology-Patient-Management-System-Specification.md`.

**Status: stage 2 (core workflows), partly done. NOT ready for real patient information.**

## Run

Requires Node.js 24.

```
npm install
npm run build       # builds the web UI into dist/web (needed before npm start)
npm test            # 42 API tests
npm run typecheck   # server + web
npm run dev         # API with sample data in ./.devdata, auto-restart
npm run dev:web     # UI dev server on :5173 (proxies /api to :3080)
npm start           # serves UI + API; real data in %LOCALAPPDATA%\ClinicApp (override with CLINIC_DATA_DIR)
```

Open http://127.0.0.1:3080. On first run the app shows a setup screen to create the doctor account.
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
| Open consultation, view records and prescriptions | yes | yes | no |
| Record vitals | yes | yes | no |
| Write / finalise / amend consultation and prescription | yes | no | no |
| Manage users, read audit log | yes | no | no |

Role boundaries for nurse and attender are my assumptions - confirm with the doctor.

## Built so far

- **Web UI** (PC, tablet, phone: sidebar on desktop, bottom tab bar on small screens, 46px touch targets, light/dark):
  login, first-run setup, forced password change, Today dashboard (check-in / start / complete, allergy alert on every card),
  patient search + registration (duplicate warning) + profile editing with role-limited sections, staff accounts (doctor),
  automatic screen lock after 15 minutes of inactivity.
- **OPD consultation** (doctor and nurse; hidden from reception): opened from the Today list once a patient is checked in.
  Nurse and doctor record vitals as separate dated entries with units (never overwritten; a correction is a new reading).
  Doctor writes complaints, history, examination, assessment, antenatal notes, investigations, advice, follow-up date and
  prescription items (medicine, strength, dose, route, frequency, duration, instructions) as a draft.
  Finalising locks the notes and completes the appointment. Later corrections ("Amend") need a reason; the finalised
  original stays on record as revision 1 and every amendment keeps a full snapshot, author, time and reason.
  The patient profile lists the patient's visits. The system never suggests diagnoses or doses.
- **IPD, part 1 (admissions and care record)**: Wards board (rooms and beds, occupancy, allergy badge; doctor adds or takes beds
  out of use). Doctor or nurse admits a patient to a free bed (one active admission per patient and per bed, optional backdated
  admission time). Doctor edits diagnosis, assessment and plan (audited). Care record is append-only: nursing notes and
  observations (nurse or doctor), doctor rounds, procedures and investigations (doctor). Mistakes are fixed by a correction with a
  reason; the original stays visible, struck through. Reception sees only basic admission details.
  Not built yet: discharge (so beds stay occupied), bed transfer, medicine orders and administration.
- API:

- Setup, login (scrypt hashes, 30 min idle / 12 h absolute sessions, lockout after 5 failures), forced password change for new accounts.
- Users and roles; deactivation ends sessions.
- Patients: sequential numbers, search by name/number/phone, duplicate warning (does not block), unknown vs none allergy, field-level permissions, stale-edit rejection (409).
- Appointments: clinic-timezone aware, status transitions enforced per role.
- Append-only audit log (database triggers block edit/delete), with before/after values and record views.

## Remaining before real clinic use

- Nurse-specific screens (vitals, observations) - these need the OPD/IPD records below.
- Audit log viewer in the UI (the log is recorded and readable via the API).
- Rescheduling an appointment (for now: cancel and rebook).
- Printable prescription from a finalised consultation (see printing below).
- Billing charges created from a consultation.
- IPD part 2: medicine orders vs administration records, discharge summary and discharge (releases the bed), bed transfer.
- Billing: itemised invoices, payments, receipts, adjustments.
- Printable prescription / discharge summary / invoice / receipt.
- Attachments (private storage, type and size limits).
- HTTPS for LAN access from other devices.
- Encrypted automated backups and a tested restore (database + attachments).
- Audit of exports; patient record export.
- Login lockout is in memory (resets on restart); no screen-lock timer in the UI yet.
- Confirm privacy, retention and clinical-document rules for the clinic's location.
- BitLocker on the server PC; UPS; named owner for backups and updates.
