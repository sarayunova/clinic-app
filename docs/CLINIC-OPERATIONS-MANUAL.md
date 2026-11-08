# LiVi Clinic & Maternity — Operations, Network & Staff User Manual

This comprehensive guide covers:
1. [How to Run the Application](#1-how-to-run-the-application)
2. [How to Run in the Local Clinic Network (Wi-Fi / LAN)](#2-how-to-run-in-the-local-clinic-network-lan--wi-fi)
3. [How to Grant Access to Nurses and Attendants](#3-how-to-grant-access-to-nurses-and-attendants)
4. [Doctor's Operational Guide](#4-doctors-operational-guide)
5. [Nurse's Operational Guide](#5-nurses-operational-guide)
6. [Attendant / Receptionist Operational Guide](#6-attendant--receptionist-operational-guide)

---

## 1. How to Run the Application

The clinic software can be run either as a permanent Windows background service (recommended for daily clinic operations) or manually via the terminal.

### Mode A: Automated Windows Service (Recommended)
When installed using the installer (`ClinicAppSetup-0.1.0.exe`) into `C:\ClinicApp`:
- The app runs automatically in the background as a Windows Scheduled Task (**`ClinicApp`**) whenever the computer turns on (even before anyone logs into Windows).
- If it ever stops or crashes, the background supervisor (`run-clinic.ps1`) automatically restarts it within seconds.

**Service Management Commands (Run PowerShell as Administrator):**
```powershell
# Check if the service is running
Get-ScheduledTask ClinicApp

# Stop the service (for maintenance or database restores)
Stop-ScheduledTask ClinicApp

# Start the service
Start-ScheduledTask ClinicApp

# Emergency shutdown / kill running processes
C:\ClinicApp\kill-clinic.bat
```

### Mode B: Manual Execution
If running without the scheduled task:
```powershell
# Open terminal in installation folder:
cd C:\ClinicApp
.\clinic.exe
```
Or in development mode from source:
```powershell
npm run dev
```

### Accessing the Web Interface
On the main computer, open any web browser (Google Chrome, Microsoft Edge, Mozilla Firefox) and navigate to:
```
http://127.0.0.1:3080
```
*(Or `https://localhost:3080` once HTTPS is configured)*.

---

## 2. How to Run in the Local Clinic Network (LAN / Wi-Fi)

To allow receptionists, ward nurses, and doctors to access the system from other PCs, laptops, Android tablets, or iPads across the clinic Wi-Fi, configure secure local networking.

> **Security Requirement:** Patient data and medical credentials must never travel unencrypted over clinic Wi-Fi. The software enforces HTTPS before allowing any network connections from outside the host machine.

### Step 1: Assign a Static IP to the Main Clinic Server PC
1. Open your clinic Wi-Fi router's admin settings (typically `192.168.1.1`).
2. Go to **DHCP Reservation** / **Static Lease**.
3. Reserve an IP address for the Main Clinic PC (for example: `192.168.1.50`).

### Step 2: Generate the Clinic Security Certificate (Once)
On the main clinic computer, open PowerShell and run:
```powershell
cd C:\ClinicApp
$env:CLINIC_CA_PASSPHRASE = "YourStrongPassphrase123"
.\clinic.exe cert --name clinic-server --ip 192.168.1.50
```
*(Replace `192.168.1.50` with your PC's reserved IP address)*.
This creates a local Certificate Authority (`ca.crt`) and an encrypted server certificate in your data directory under `tls/`.

### Step 3: Allow Port 3080 through Windows Firewall
Run PowerShell as Administrator on the main PC:
```powershell
New-NetFirewallRule -DisplayName "Clinic App LAN" -Direction Inbound -Protocol TCP -LocalPort 3080 -Action Allow -Profile Private
```

### Step 4: Configure the App to Listen on the Network
In `C:\ClinicApp\scripts\install-autostart.ps1` or your environment:
- Set `HOST=0.0.0.0`
- Set `PORT=3080`

If using the automated scheduled task:
```powershell
powershell -ExecutionPolicy Bypass -File C:\ClinicApp\scripts\install-autostart.ps1 -ListenHost 0.0.0.0 -StartNow
```

### Step 5: Install the Clinic Certificate (`ca.crt`) on Staff Devices
To prevent browser warning screens on staff tablets and phones:
1. On the main PC, open the app, log in as Doctor, go to **Clinic Settings**, and click **Download Clinic Certificate** (or copy `ca.crt` to a USB drive).
2. **On Windows PCs:** Double-click `ca.crt` → *Install Certificate* → *Local Machine* → *Place in: Trusted Root Certification Authorities* → *Finish*.
3. **On Android Tablets:** Open *Settings* → *Security* → *Encryption & Credentials* → *Install a Certificate* → *CA Certificate* → select `ca.crt`.
4. **On iPad / iPhone:** Open `ca.crt` in Safari → *Profile Downloaded* → *Settings* → *Install Profile* → then go to *Settings > General > About > Certificate Trust Settings* and toggle on full trust.

### Step 6: Connect from Staff Devices
On any clinic device connected to the clinic Wi-Fi, open the browser and navigate to:
```
https://192.168.1.50:3080
```
Bookmark this URL on staff tablets and computers.

---

## 3. How to Grant Access to Nurses and Attendants

Only a **Doctor** can create, modify, or deactivate staff accounts.

### Step-by-Step Account Creation:
1. Log in with the **Doctor** account.
2. In the left navigation sidebar, click **Staff & Users** (`/users`).
3. Click the **+ New User** button.
4. Fill in the user details:
   - **Username**: Lowercase username without spaces (e.g., `nurse.priya`, `reception.ramesh`).
   - **Full Name**: Staff member's official name (e.g., `Staff Nurse Priya S`, `Ramesh Kumar`).
   - **Role**: Select one of:
     - `nurse` — for OPD triage, ward nursing, vitals, MAR, and inpatient care.
     - `attender` — for front-desk reception, patient registration, appointments, and billing.
     - `doctor` — for consulting clinicians.
   - **Temporary Password**: Set a temporary password (minimum 8 characters with at least one number and special character).
5. Click **Create User**.

### First-Time Login Workflow for Staff:
1. Provide the staff member with their username and temporary password.
2. When they first log in at `https://192.168.1.50:3080`, the system automatically prompts: **"Password change required"**.
3. They enter their temporary password and create their private new password.
4. If a staff member forgets their password, the Doctor can click **Reset Password** on the `/users` page at any time.

---

## 4. Doctor's Operational Guide

### Primary Responsibilities & Features
Doctors have full access to all clinical records, prescriptions, admissions, discharge summaries, billing, audits, and clinical protocols.

```
┌────────────────────────────────────────────────────────┐
│                   DOCTOR WORKFLOW                      │
│                                                        │
│  1. OPD Queue ────> 2. Consultation ────> 3. Rx & Labs │
│         │                  │                    │      │
│         v                  v                    v      │
│  Protocols Hub       IPD Admission       Discharge &   │
│  (80+ Conditions)    & Daily Rounds        Summary     │
└────────────────────────────────────────────────────────┘
```

### 1. Daily OPD Consultations
1. Open **Clinic** / **Appointments** on the dashboard.
2. Filter the queue: *Waiting*, *In Consultation*, or *Completed*.
3. Click on a waiting patient to open their visit record.
4. Review nurse triage vitals (BP, Pulse, SpO2, Temp, Blood Sugar, BMI) recorded beforehand.
5. Enter **Presenting Complaints**, **Clinical Examination**, and **Provisional Diagnosis**.
6. **Prescriptions (Rx):**
   - Click preset quick-tabs (Antenatal, Pediatric, Infection, Pain, Gastric).
   - Click chips for rapid frequency and duration (e.g. `1-0-1`, `5 days`, `After food`).
   - The app automatically warns if the patient has a recorded drug allergy!
7. Click **Finalise Consultation** to lock the record and generate an official printable prescription.

### 2. Clinical Protocols Hub (80+ Conditions)
Click **Clinical Protocols** (`/protocols`) in the sidebar to access standardized clinical calculators and evidence-based clinical flowsheets:
- **Obstetric High-Risk:** Pre-eclampsia/Eclampsia (Zuspan MgSO4 protocol), Postpartum Hemorrhage (PPH Bundle), Gestational Diabetes (DIPSI/IADPSG), Cholestasis (ICP), Placenta Accreta (PAS), VBAC/TOLAC checklist.
- **Neonatal Intensive Care:** Neonatal Sepsis, RDS & Surfactant, HIE (Sarnat staging & cooling), Jaundice (AAP Bhutani phototherapy curves), Hypoglycemia, Neonatal Resuscitation.
- **Pediatric Emergencies:** Pediatric DKA, Status Epilepticus, Anaphylaxis, Septic Shock, Croup, PALS Code Sheet, Pediatric Trauma Score.

### 3. Inpatient (IPD) Care & Admissions
1. In the patient's file, click **Admit to Ward**.
2. Select Ward/Room and Bed (e.g., `Maternity Ward / Bed 04`).
3. Enter Admission Diagnosis and Treatment Orders.
4. **Daily Rounds:** Add Clinical Care Entries (Observations, Progress Notes, Ultrasound findings).
5. **Medicine Orders:** Prescribe IV fluids and scheduled medications for the nurse to administer on the MAR flowsheet.
6. **Discharge:** When ready, click **Discharge Patient**. Complete the comprehensive discharge summary, print instructions for the family, and free the bed.

---

## 5. Nurse's Operational Guide

### Primary Responsibilities & Features
Nurses have access to patient basic demographics, vitals entry, ward bed management, inpatient care flowsheets, and medication administration (MAR). They cannot edit prescriptions, generate bills, or alter doctor consults.

```
┌────────────────────────────────────────────────────────┐
│                    NURSE WORKFLOW                      │
│                                                        │
│  1. Vitals Triage ─> 2. Ward Station ─> 3. Medication  │
│     (BP, SpO2, BG)     (Bed & Moves)       Chart (MAR) │
│                               │                 │      │
│                               v                 v      │
│                        Nursing Notes       Flowsheets  │
│                        & Observations    (MgSO4, Phot) │
└────────────────────────────────────────────────────────┘
```

### 1. Recording Outpatient Vitals (OPD Triage)
1. In the sidebar, click **Appointments** or **Patients**.
2. Select the patient who has arrived.
3. In the visit record, enter vital signs:
   - Systolic / Diastolic Blood Pressure (mmHg)
   - Pulse (bpm) & Respiratory Rate
   - Temperature (°F) & Oxygen Saturation (SpO2 %)
   - Weight (kg), Height (cm) — auto-computes BMI
   - Random Blood Sugar (RBS mg/dL)
   - Urine Albumin & Sugar (dipstick for antenatal mothers)
4. Click **Save Vitals**. If BP is high (≥140/90) or SpO2 is low (<95%), the system flags a visual alert for the doctor.

### 2. Nurse Station & Inpatient Ward Management (`/station`)
1. Click **Nurse Station** in the navigation menu.
2. View all currently admitted inpatients, their assigned bed, attending doctor, and admission day.
3. **Bed Transfers:** If a patient is transferred from Labor Ward to Postnatal Ward or HDU:
   - Click **Transfer Bed**.
   - Select the destination vacant bed and record the transfer reason.
   - The bed board updates instantly across the hospital.

### 3. Medication Administration Record (MAR)
1. Open the patient's admission chart.
2. Navigate to the **Medications / MAR** tab.
3. Review doctor's active drug orders.
4. For each scheduled dose:
   - Click **Administer**.
   - Select status: **Given**, **Withheld** (e.g., patient fasting for surgery), or **Refused**.
   - The record stamps your name, date, and exact timestamp into the audit trail.

### 4. Nursing Progress Notes & Flowsheets
- Record fluid balance (Intake/Output chart).
- Hourly vitals and fetal heart sound (FHS) monitoring.
- MgSO4 toxicity checks (patellar reflex, respiratory rate, hourly urine output).

---

## 6. Attendant / Receptionist Operational Guide

### Primary Responsibilities & Features
Attendants handle front-desk reception: registering new patients, rapid search, queue status, scheduling appointments, and billing/invoicing. Attendants **cannot** see clinical histories, doctor notes, or medical diagnoses (protecting patient privacy).

```
┌────────────────────────────────────────────────────────┐
│                  ATTENDANT WORKFLOW                    │
│                                                        │
│  1. Patient Reg ───> 2. Fast Search ───> 3. Queue &    │
│     (Aadhaar last 4)   (Aadhaar/Phone)      Billing    │
│                               │                 │      │
│                               v                 v      │
│                         Book Appt /        Collect Pay │
│                         Token Status       & Receipt   │
└────────────────────────────────────────────────────────┘
```

### 1. Patient Registration (with Aadhaar Last 4 Digits)
1. In the sidebar, click **Patients** (`/patients`), then click **+ Register Patient**.
2. Enter the registration fields:
   - **Full Name** *(Required)*: Patient's name.
   - **Aadhaar (last 4 digits)**: Enter exactly **4 digits** (e.g. `5432`).
     > **Tip:** Entering the last 4 digits of Aadhaar ensures that on return visits, finding the patient takes less than 2 seconds even if their name spelling differs!
   - **Date of Birth** or **Estimated Age**.
   - **Phone**: 10-digit mobile number.
   - **Emergency Contact / Spouse**: Partner/husband name and phone.
   - **Address**: Locality / village / street.
3. Click **Save Patient**. The system assigns an automatic Patient ID (e.g. `P000142`).
   *(If a duplicate phone or Aadhaar is already registered, the app alerts you immediately to prevent duplicate files).*

### 2. Fast Patient Search
In the top search box on the **Patients** page:
- **By Aadhaar last 4:** Type `5432` → Instant exact match!
- **By Phone:** Type the mobile number or any 4–5 digits.
- **By Name / Partner:** Type patient name or husband's name (e.g. `Ramesh`).

### 3. Managing the Queue & Booking Appointments
1. Click **Appointments** (`/`) from the sidebar.
2. Click **+ Book Appointment**.
3. Choose the patient, consultation type, and time.
4. When the patient arrives in the waiting hall:
   - Change status from `Scheduled` to **`Waiting`**.
   - The doctor's screen immediately shows the patient at the top of their consultation queue.

### 4. Billing, Invoices & Receipt Printing
1. Click **Billing** (`/billing`) or click **New Invoice** directly from the patient page.
2. Add billed items:
   - Consultation fee
   - Ultrasound scan / Lab test
   - Delivery / Ward charges / Nursing care
3. Click **Issue Invoice**.
4. **Collect Payment:**
   - Enter amount received.
   - Select payment mode: **Cash**, **UPI / GPay / PhonePe**, or **Card**.
5. Click **Print Receipt** (supports standard A4 printing and 80mm thermal receipt printers).

---

## 7. Quick Troubleshooting & FAQ

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **"Refusing to listen on 0.0.0.0 without HTTPS"** | Certificate not generated | Run `clinic.exe cert --name <pc-name> --ip <ip>` on the server PC. |
| **Tablet shows "Your connection is not private"** | CA certificate not installed on device | Download `ca.crt` from Clinic Settings and install as Trusted Root CA on the tablet. |
| **"Another clinic server is already running"** | App already running as Windows service | Run `C:\ClinicApp\kill-clinic.bat` to stop old background instances before manual startup. |
| **Staff member locked out / forgot password** | Multiple incorrect attempts or forgotten pass | Doctor opens `/users`, clicks staff member, and clicks **Reset Password**. |
| **Backup warning banner visible in red** | Automated daily backup passphrase not set | Open `docs/BACKUP-AND-RESTORE.md` to configure encrypted USB / secondary drive backup. |
