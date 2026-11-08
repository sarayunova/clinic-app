import { useState } from 'react';

export function HelpPage() {
  const [activeTab, setActiveTab] = useState<'network' | 'doctor' | 'nurse' | 'attender' | 'faq'>('network');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>Clinic Help & Staff Manual</h1>
          <div className="muted small">Operational workflows, local network access, and role-based staff guides</div>
        </div>
        <button type="button" className="btn small" onClick={() => window.print()}>
          🖨️ Print Manual
        </button>
      </div>

      <div className="row wrap" style={{ gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`btn small ${activeTab === 'network' ? 'primary' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          🌐 Network & Wi-Fi Setup
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'doctor' ? 'primary' : ''}`}
          onClick={() => setActiveTab('doctor')}
        >
          👨‍⚕️ Doctor Guide
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'nurse' ? 'primary' : ''}`}
          onClick={() => setActiveTab('nurse')}
        >
          👩‍⚕️ Nurse Guide
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'attender' ? 'primary' : ''}`}
          onClick={() => setActiveTab('attender')}
        >
          🧑‍💼 Attendant & Reception Guide
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'faq' ? 'primary' : ''}`}
          onClick={() => setActiveTab('faq')}
        >
          ❓ FAQ & Troubleshooting
        </button>
      </div>

      {activeTab === 'network' && (
        <div className="stack">
          <div className="card">
            <h2>1. Running on the Clinic Network (LAN & Wi-Fi)</h2>
            <p>
              The system allows doctors, ward nurses, and receptionists to access the application from laptops,
              Android tablets, and iPads across the clinic Wi-Fi.
            </p>
            <div className="banner info" style={{ marginBottom: '1rem' }}>
              <strong>🔒 Strict Security:</strong> To protect medical records and passwords over clinic Wi-Fi, the
              software refuses external network connections until HTTPS is enabled.
            </div>

            <ol className="stack" style={{ paddingLeft: '1.2rem' }}>
              <li>
                <strong>Step 1: Reserve a Static IP for the Server PC</strong>
                <p className="muted small">
                  In your clinic Wi-Fi router settings, reserve an IP for the main clinic computer (e.g.{' '}
                  <code>192.168.1.50</code>).
                </p>
              </li>
              <li>
                <strong>Step 2: Generate the Security Certificate (Once)</strong>
                <p className="muted small">Open PowerShell on the main PC and run:</p>
                <pre style={{ background: 'var(--surface-subtle)', padding: '0.75rem', borderRadius: '8px', overflowX: 'auto' }}>
                  cd C:\ClinicApp{'\n'}
                  $env:CLINIC_CA_PASSPHRASE = "ClinicSecretPassphrase123"{'\n'}
                  .\clinic.exe cert --name clinic-server --ip 192.168.1.50
                </pre>
              </li>
              <li>
                <strong>Step 3: Allow Firewall Port 3080</strong>
                <pre style={{ background: 'var(--surface-subtle)', padding: '0.75rem', borderRadius: '8px', overflowX: 'auto' }}>
                  New-NetFirewallRule -DisplayName "Clinic App LAN" -Direction Inbound -Protocol TCP -LocalPort 3080 -Action Allow -Profile Private
                </pre>
              </li>
              <li>
                <strong>Step 4: Start Server on All Interfaces</strong>
                <pre style={{ background: 'var(--surface-subtle)', padding: '0.75rem', borderRadius: '8px', overflowX: 'auto' }}>
                  powershell -ExecutionPolicy Bypass -File C:\ClinicApp\scripts\install-autostart.ps1 -ListenHost 0.0.0.0 -StartNow
                </pre>
              </li>
              <li>
                <strong>Step 5: Connect from Staff Tablets & Phones</strong>
                <p className="muted small">
                  Open the browser on any staff device connected to the clinic Wi-Fi and visit:{' '}
                  <strong><code>https://192.168.1.50:3080</code></strong>.
                </p>
              </li>
            </ol>
          </div>

          <div className="card">
            <h2>2. Adding Staff Accounts (Nurses & Attendants)</h2>
            <p>Only the Doctor has permission to create and manage accounts.</p>
            <ul style={{ paddingLeft: '1.2rem' }}>
              <li>Go to <strong>Staff & Users</strong> (<code>/users</code>) in the sidebar.</li>
              <li>Click <strong>+ New User</strong>.</li>
              <li>Choose role: <code>nurse</code> for ward/triage staff, or <code>attender</code> for reception & billing.</li>
              <li>Set a temporary password. On first login, staff are automatically prompted to set a private password.</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'doctor' && (
        <div className="stack">
          <div className="card">
            <h2>👨‍⚕️ Doctor Operational Guide</h2>
            <p className="muted">Full clinical authority: OPD, Prescriptions, Admissions, 80+ Protocols, and Audits.</p>

            <div className="stack" style={{ marginTop: '1rem' }}>
              <div>
                <h3>1. OPD Consultations & Prescriptions</h3>
                <ul>
                  <li>Open <strong>Today</strong> on the dashboard to see the live queue (Waiting, In Consultation, Completed).</li>
                  <li>Review nurse triage vitals (Blood pressure, Pulse, SpO2, Blood glucose, BMI, Urine dipstick).</li>
                  <li>Type Presenting Complaints, Examination, and Diagnosis.</li>
                  <li>Use the <strong>Quick-Meds Box</strong> and dosage chips (<code>1-0-1</code>, <code>5 days</code>) for fast prescriptions.</li>
                  <li>Click <strong>Finalise Consultation</strong> to lock and generate the printable prescription.</li>
                </ul>
              </div>

              <div>
                <h3>2. Clinical Protocols Hub (80+ Conditions)</h3>
                <p className="muted small">Access evidence-based protocols and automated calculators under <strong>Clinical Protocols</strong>:</p>
                <ul>
                  <li><strong>Obstetrics:</strong> Zuspan IV MgSO4 protocol for Pre-eclampsia, PPH Bundle & Tamponade, GDM (DIPSI/IADPSG), ICP, PAS, TOLAC.</li>
                  <li><strong>Neonatology:</strong> Sepsis, RDS & Surfactant, HIE cooling, AAP Bhutani Jaundice phototherapy curves, Hypoglycemia.</li>
                  <li><strong>Pediatrics:</strong> DKA, Status Epilepticus, Anaphylaxis, Septic Shock, Croup, PALS Code Sheet, Trauma Score.</li>
                </ul>
              </div>

              <div>
                <h3>3. Inpatient Admissions & Discharge</h3>
                <ul>
                  <li>Click <strong>Admit to Ward</strong> on any patient file and assign a ward bed.</li>
                  <li>Prescribe scheduled medications and IV fluids to populate the nurse's MAR sheet.</li>
                  <li>During daily rounds, add Clinical Care Entries and view nursing observations.</li>
                  <li>Click <strong>Discharge Patient</strong> to create the official discharge summary and free the bed.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'nurse' && (
        <div className="stack">
          <div className="card">
            <h2>👩‍⚕️ Nurse Operational Guide</h2>
            <p className="muted">Triage vitals, ward station, medication administration chart (MAR), and flowsheets.</p>

            <div className="stack" style={{ marginTop: '1rem' }}>
              <div>
                <h3>1. Outpatient Triage & Vitals Recording</h3>
                <ul>
                  <li>Select the arrived patient in <strong>Appointments</strong> or <strong>Patients</strong>.</li>
                  <li>Record BP (Systolic/Diastolic), Pulse, SpO2, Temp, Blood Sugar, and dipstick.</li>
                  <li>The app automatically calculates BMI and flags abnormal vitals (BP ≥ 140/90, SpO2 &lt; 95%) for the doctor.</li>
                </ul>
              </div>

              <div>
                <h3>2. Nurse Station & Inpatients (<code>/station</code>)</h3>
                <ul>
                  <li>View all admitted inpatients, their bed location, attending doctor, and admission day.</li>
                  <li><strong>Bed Transfers:</strong> If moving a mother or child between Labor Ward, Postnatal, or HDU, click <strong>Transfer Bed</strong> and select the destination vacant bed.</li>
                </ul>
              </div>

              <div>
                <h3>3. Medication Administration Record (MAR)</h3>
                <ul>
                  <li>In the inpatient's chart, open the <strong>Medications / MAR</strong> tab.</li>
                  <li>For each scheduled dose ordered by the doctor, click <strong>Administer</strong> and record status: <strong>Given</strong>, <strong>Withheld</strong>, or <strong>Refused</strong>.</li>
                  <li>Your name and timestamp are automatically audited.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'attender' && (
        <div className="stack">
          <div className="card">
            <h2>🧑‍💼 Attendant & Receptionist Guide</h2>
            <p className="muted">Patient registration with Aadhaar last 4 digits, fast search, queue status, and billing.</p>

            <div className="stack" style={{ marginTop: '1rem' }}>
              <div>
                <h3>1. Patient Registration (with Aadhaar Last 4 Digits)</h3>
                <ul>
                  <li>Click <strong>Patients</strong> &gt; <strong>+ Register Patient</strong>.</li>
                  <li>Enter Full Name, Phone, and <strong>Aadhaar (last 4 digits)</strong> (e.g. <code>5432</code>).</li>
                  <li>Enter Spouse/Partner Name and Locality/Address.</li>
                  <li>Click <strong>Save Patient</strong>. The app generates an auto-incrementing Patient Number (e.g. <code>P000142</code>).</li>
                </ul>
              </div>

              <div>
                <h3>2. Instant Patient Search</h3>
                <p className="muted small">In the Patients search bar:</p>
                <ul>
                  <li><strong>By Aadhaar last 4:</strong> Type <code>5432</code> for an instant match!</li>
                  <li><strong>By Phone:</strong> Type the phone number or last 4–5 digits.</li>
                  <li><strong>By Name / Spouse:</strong> Type patient name or husband's name.</li>
                </ul>
              </div>

              <div>
                <h3>3. Queue Management</h3>
                <ul>
                  <li>When a patient arrives in the waiting hall, change their appointment status from <code>Scheduled</code> to <strong><code>Waiting</code></strong>.</li>
                  <li>The doctor's consultation queue updates immediately.</li>
                </ul>
              </div>

              <div>
                <h3>4. Billing, Invoices & Receipts</h3>
                <ul>
                  <li>Click <strong>Billing</strong> &gt; <strong>New Invoice</strong>.</li>
                  <li>Add consultation, lab tests, ultrasound, or bed charges.</li>
                  <li>Collect payment via <strong>Cash</strong>, <strong>UPI / QR</strong>, or <strong>Card</strong>.</li>
                  <li>Click <strong>Print Receipt</strong> (supports A4 and 80mm thermal receipt printers).</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="stack">
          <div className="card">
            <h2>❓ Troubleshooting & Common Questions</h2>
            <div className="stack" style={{ marginTop: '1rem' }}>
              <div>
                <strong>Q: The tablet shows "Your connection is not private".</strong>
                <p className="muted small">
                  The clinic security certificate (<code>ca.crt</code>) must be installed on the tablet as a Trusted Root
                  Certificate. Download it from the Clinic settings page and install it once on each tablet.
                </p>
              </div>

              <div>
                <strong>Q: A staff member forgot their password.</strong>
                <p className="muted small">
                  The Doctor can open <strong>Staff & Users</strong> (<code>/users</code>), select the staff member, and
                  click <strong>Reset Password</strong> to issue a new temporary password.
                </p>
              </div>

              <div>
                <strong>Q: "Another clinic server is already running".</strong>
                <p className="muted small">
                  The app is already running as a Windows background task. Run <code>C:\ClinicApp\kill-clinic.bat</code> to
                  stop running background instances before launching manually.
                </p>
              </div>

              <div>
                <strong>Q: Where are the database backups stored?</strong>
                <p className="muted small">
                  Backups are encrypted and stored in your configured backup directory (e.g. external USB drive). Read{' '}
                  <code>docs/BACKUP-AND-RESTORE.md</code> for one-step restore procedures.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
