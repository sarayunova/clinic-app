# Clinic App (development build)

Patient management for one gynaecologist at one clinic (OPD + IPD). Built against
`../Gynaecology-Patient-Management-System-Specification.md`.

**Status: stage 2 (core workflows), partly done. NOT ready for real patient information.**

## Run

Requires Node.js 24.

```
npm install
npm run build       # builds the web UI into dist/web (needed before npm start)
npm test            # 164 API tests
npm run typecheck   # server + web
npm run dev         # API with sample data in ./.devdata, auto-restart
npm run dev:web     # UI dev server on :5173 (proxies /api to :3080)
npm start           # serves UI + API; real data in %LOCALAPPDATA%\ClinicApp (override with CLINIC_DATA_DIR)
```

Open http://127.0.0.1:3080. On first run the app shows a setup screen to create the doctor account.
The server listens on this computer only. `HOST`, `PORT` and `CLINIC_TZ` (default `Asia/Kolkata`) are configurable, and so is `CLINIC_SCREEN_LOCK_MINUTES` (default 5; 0 turns the automatic screen lock off).
The app only listens on this computer until HTTPS is set up (see `docs/HTTPS-SETUP.md`); it refuses to start on the network without it.

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
| Move an admitted patient to another bed | yes | yes | no |
| Nurse station board (who needs vitals, ward round, medicines that may be due) | yes | yes | no |
| Change the billing price list | yes | no | no |
| Upload and view patient documents (scans, reports) | yes | yes | no |
| Remove a document | yes | no | no |
| Write / finalise / amend consultation and prescription | yes | no | no |
| Manage users, read audit log, download a full patient record | yes | no | no |

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
  The doctor keeps a **price list** (Billing > Price list: add, rename, re-price, switch off; nothing is deleted). While editing a
  draft, staff pick an item and its name and price are *copied* onto the line, so a later price change never alters an invoice.
  Billing has a **collection report** (payments, refunds and net by method, staff member and day, invoices issued, every
  transaction; clinic-local days, up to a year; printable; each view is audited). A finalised consultation shows its invoices and a
  button to start one for that visit.
- **Backups**: automatic encrypted backups (AES-256-GCM, passphrase-derived key) while the app runs, each re-opened and
  integrity-checked right after writing, old ones pruned, history kept in the database. The doctor sees status and "Back up now"
  under Clinic, and a warning bar everywhere if backups are off, failing or stale, or stored on the same disk as the data.
  `npm run backup` takes one by hand; `npm run restore -- <file> [--replace]` checks or restores one (current database is
  moved aside, never deleted; refuses while the server runs). See `docs/BACKUP-AND-RESTORE.md` for setup and the monthly drill.
- **Printable clinical documents**: prescription from a finalised consultation (medicines table, allergies, advice, follow-up,
  signature line; the assessment is only printed if ticked) and discharge summary from a discharged admission (including any
  addenda). Both use the clinic letterhead from "Clinic" and show the print time. Every print is recorded in the audit log.
  A draft consultation cannot be printed. Print layout hides the menu and buttons; the browser's print dialog does the rest.
- **HTTPS for the clinic network**: `npm run cert` creates a private clinic certificate authority (key stored encrypted) and a
  server certificate for the computer name and IP; staff devices install the public `ca.crt` once. With a certificate the app
  serves HTTPS only (TLS 1.2+, Secure cookie, HSTS). **Without one it refuses to listen on anything but this computer.**
  The doctor sees certificate status, expiry warnings and a certificate download under Clinic. See `docs/HTTPS-SETUP.md`.
- API:

- Setup, login (scrypt hashes, 30 min idle / 12 h absolute sessions, lockout after 5 failures, kept in the database so a restart does not clear it), forced password change for new accounts.
- **Screen lock**: after 5 idle minutes (or the "Lock screen" button) the screen is covered and the server refuses every request except unlock and log out, so reloading the page or opening another tab does not get past it. Unlocking needs the password (wrong guesses count towards the same 5-failure lockout; lock, unlock and failures go to the audit log). Typed-in work stays on the page. A locked session is not kept alive and ends at the normal idle limit; after 15 idle minutes the user is logged out anyway.
- Users and roles; deactivation ends sessions.
- Patients: sequential numbers, search by name/number/phone, duplicate warning (does not block), unknown vs none allergy, field-level permissions, stale-edit rejection (409).
- Appointments: clinic-timezone aware, status transitions enforced per role.
  Reception and doctor can reschedule an appointment that has not yet started (same record, new date/time, optional new
  reason; past dates and clashes refused; old and new values go to the audit log). Once checked in, cancel and rebook.
- Append-only audit log (database triggers block edit/delete), with before/after values and record views.
- Audit log viewer (doctor only, "Audit" in the menu): filter by person, action, date range or one patient; shows what changed
  (before → after); newest first with "load older entries". Opening the log is itself recorded. The patient page has a
  "Who has accessed this record" link.
- Patient record export (doctor only): "Download full record" at the bottom of a patient page saves one JSON file with the
  patient's details, appointments, consultations (vitals, prescriptions, revisions), admissions (care record, medicine
  orders and administrations, discharge summary and addenda) and bills (lines, payments, adjustments), plus the names and roles
  of the staff who appear in it. No passwords or sessions. The file is NOT encrypted. Every download is audited.
- Patient documents: PDF, JPEG or PNG, up to 10 MB each, added from the "Documents" section of a patient page with a title, type
  and date, optionally tied to a consultation or admission. The file type is checked from the file's contents, not its name.
  Files are stored inside the database (so every backup and restore includes them) and can only be opened through the app by
  signed-in doctor/nurse; each upload, open, download and removal is audited. Documents are never edited or erased: the doctor
  can "remove" one with a reason, which hides it (it stays in the database and backups).
- Nurse station ("Nurse station" in the menu, doctor and nurse; nurses land on it after logging in, and "Today" is still in the menu): one board with (1) outpatients checked in today and whether their
  vitals have been taken, with a "Take vitals" button; (2) every inpatient in bed order with allergies, the latest observation and
  how long ago it was taken (corrected values replace the originals), and the active medicines with the last time each was given,
  withheld or refused. A medicine is marked "May be due" only when its frequency is clearly worded ("every 8 hours", OD, BD, TDS,
  QID, "twice daily"...) and that interval has passed; anything else (PRN, once weekly, "at night"...) shows "Check chart". It is a
  reminder, not a schedule, and no clinical alert thresholds are applied. Opening the board is audited; the automatic refresh is not.
- Bed transfer (doctor and nurse, "Move to another bed" on the admission page): choose a free bed and give a reason; the move can be
  back-dated but not into the future, before the admission, or before the previous move. The old bed is free at once. Every move is
  kept permanently (from, to, when, why, who), shown on the admission, listed in the patient export and audited. Discharged patients
  cannot be moved. Moves cannot be edited or deleted.
- Starts automatically with Windows (scheduled task that restarts the server if it stops, with logs): `docs/AUTO-START.md`,
  `scripts/install-autostart.ps1`. Not yet installed on a real clinic computer.

## Remaining before real clinic use

- IPD: The nurse station shows medicines that may be due, but there is no timed round list, no overdue alarms and no clinical alert thresholds (the doctor must decide those).
- Billing: the price list starts empty; the doctor needs to enter the clinic's standard charges.
- Printing: paper layout (A4 margins, page breaks, letterhead logo) not yet tried on the clinic's printer.
- HTTPS: do the one-time setup on the clinic computer and install the certificate on each device; there is no http-to-https redirect. Install the automatic start (`docs/AUTO-START.md`) and check it survives a restart.
- Backups: copy the backup folder off the computer (USB / second machine); do a practice restore before real data.
- Confirm privacy, retention and clinical-document rules for the clinic's location.
- BitLocker on the server PC; UPS; named owner for backups and updates.
