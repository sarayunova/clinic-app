# Clinic App (development build)

Patient management for one gynaecologist at one clinic (OPD + IPD). Built against
`../Gynaecology-Patient-Management-System-Specification.md`.

**Status: stage 2 (core workflows), partly done. NOT ready for real patient information.**

## Run

Requires Node.js 24.

```
npm install
npm run build       # builds the web UI into dist/web (needed before npm start)
npm test            # 79 API tests
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
- **IPD, part 2 (medicines and discharge)**: the doctor orders medicines (medicine, strength, dose, route, frequency, instructions);
  an order is never edited, only stopped once with a reason. Doctor or nurse records what was actually given, withheld or refused
  (dose, actual time, optional due time, reason when not given) as separate append-only records; mistakes are corrected with a
  reason and the original stays. Doctor discharges with a summary (final diagnosis, condition, findings, course, procedures,
  take-home medicines, instructions, warning signs, follow-up): this frees the bed and stops running medicines. The summary is
  immutable; later additions are addenda with a reason. Discharge cannot be earlier than the admission or the latest entry.
  The system does not check doses, interactions or allergies against orders.
- **Billing** (doctor and reception; hidden from nurses): invoices start as editable drafts (category, description, whole-number
  quantity, price in rupees, stored as integer paise) and are issued with an invoice number (INV000001), after which the charges
  are locked. Payments are separate records with receipt numbers (R000001), method, optional reference and time; a payment cannot
  exceed the balance. Only the doctor can add a discount, write-off or correction (signed, with a reason), refund (F000001; also
  how a mistaken payment is reversed) or cancel an invoice (only when no money is held). Nothing posted is edited or deleted.
  Balance = charges + adjustments - payments + refunds. Invoices can link to an admission. Printable invoice and receipt/refund
  note; clinic name, address, phone and doctor registration number are set by the doctor under "Clinic". No tax is applied.
- **Backups**: automatic encrypted backups (AES-256-GCM, passphrase-derived key) while the app runs, each re-opened and
  integrity-checked right after writing, old ones pruned, history kept in the database. The doctor sees status and "Back up now"
  under Clinic, and a warning bar everywhere if backups are off, failing or stale, or stored on the same disk as the data.
  `npm run backup` takes one by hand; `npm run restore -- <file> [--replace]` checks or restores one (current database is
  moved aside, never deleted; refuses while the server runs). See `docs/BACKUP-AND-RESTORE.md` for setup and the monthly drill.
- **Printable clinical documents**: prescription from a finalised consultation (medicines table, allergies, advice, follow-up,
  signature line; the assessment is only printed if ticked) and discharge summary from a discharged admission (including any
  addenda). Both use the clinic letterhead from "Clinic" and show the print time. Every print is recorded in the audit log.
  A draft consultation cannot be printed. Print layout hides the menu and buttons; the browser's print dialog does the rest.
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
- IPD: bed transfer; medication round / due-dose view for nurses; discharge summary print.
- Billing: charges are typed in by hand (no price list); no daily collection report; link from a consultation not yet in the UI.
- Printing: paper layout (A4 margins, page breaks, letterhead logo) not yet tried on the clinic's printer.
- Attachments (private storage, type and size limits).
- HTTPS for LAN access from other devices.
- Backups: copy the backup folder off the computer (USB / second machine); do a practice restore before real data; attachments once they exist.
- Audit of exports; patient record export.
- Login lockout is in memory (resets on restart); no screen-lock timer in the UI yet.
- Confirm privacy, retention and clinical-document rules for the clinic's location.
- BitLocker on the server PC; UPS; named owner for backups and updates.
