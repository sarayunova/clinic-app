import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, type BackupStatus, type SecurityStatus } from './api';
import { useAuth, useMe } from './auth';
import { AuthScreens, ChangePasswordPage } from './pages/AuthScreens';
import { Dashboard } from './pages/Dashboard';
import { PatientsPage } from './pages/Patients';
import { PatientPage } from './pages/PatientPage';
import { UsersPage } from './pages/Users';
import { VisitPage } from './pages/VisitPage';
import { WardsPage } from './pages/Wards';
import { AdmitPage } from './pages/AdmitPage';
import { AdmissionPage } from './pages/AdmissionPage';
import { BillingPage } from './pages/Billing';
import { InvoicePage } from './pages/InvoicePage';
import { InvoicePrint, ReceiptPrint } from './pages/PrintPages';
import { DischargePrint, PrescriptionPrint } from './pages/ClinicalPrints';
import { ClinicalSummaryPrint } from './pages/ClinicalSummaryPrint';
import { UltrasoundPrint } from './pages/UltrasoundPrint';
import { LabOrderPrint } from './pages/LabOrderPrint';
import { PartographPrint } from './pages/PartographPrint';
import { OperativeNotePrint } from './pages/OperativeNotePrint';
import { RiskAssessmentPrint } from './pages/RiskAssessmentPrint';
import { ObstetricDischargePrint } from './pages/ObstetricDischargePrint';
import { MaternityAdmissionPrint } from './pages/MaternityAdmissionPrint';
import { DeliveryWardPage } from './pages/DeliveryWardPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditPage } from './pages/AuditPage';
import { StationPage } from './pages/StationPage';
import { PriceListPage } from './pages/PriceListPage';
import { ChecklistPage } from './pages/ChecklistPage';
import { PrescriptionTemplatesPage } from './pages/PrescriptionTemplatesPage';
import { CollectionReportPage } from './pages/CollectionReport';
import { TvQueuePage } from './pages/TvQueuePage';
import { ScreenLock } from './components/ScreenLock';

export function App() {
  const location = useLocation();
  if (location.pathname === '/tv') return <TvQueuePage />;

  const { state } = useAuth();
  if (state.status === 'loading') return <p className="center muted">Loading…</p>;
  if (state.status !== 'ready') return <AuthScreens />;
  if (state.me.mustChangePassword) return <AuthScreens forceChange />;
  return <Shell />;
}

/** Tells the doctor, on every screen, when backups or the secure connection need attention. */
function SystemWarning() {
  const [warn, setWarn] = useState<string | null>(null);
  useEffect(() => {
    const check = async () => {
      const found: string[] = [];
      try {
        const b = await api<BackupStatus>('GET', '/api/backups');
        if (!b.healthy) found.push(b.warnings[0] ?? 'Backups need attention.');
      } catch {
        /* status unavailable: say nothing rather than a false alarm */
      }
      try {
        found.push(...(await api<SecurityStatus>('GET', '/api/security')).warnings);
      } catch {
        /* same */
      }
      setWarn(found.length ? found.join(' ') : null);
    };
    void check();
    const t = window.setInterval(() => void check(), 10 * 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (!warn) return null;
  return (
    <div className="banner warn no-print" role="alert">
      <strong>Needs attention.</strong> {warn} <NavLink to="/settings">Open Clinic details</NavLink>
    </div>
  );
}

function Shell() {
  const me = useMe();
  const { logout, can, locked, lock } = useAuth();
  const nav = useNavigate();
  const here = useLocation().pathname;
  // Nurses start their shift on the nurse station board. Only on arrival (login or opening the app at the home page);
  // the "Today" link still works afterwards.
  useEffect(() => {
    if (me.role === 'nurse' && here === '/') nav('/station', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const links = [
    { to: '/', label: 'Today', icon: '📅', end: true },
    ...(can('station:read') ? [{ to: '/station', label: 'Nurse station', icon: '🩺', end: false }] : []),
    { to: '/patients', label: 'Patients', icon: '👥', end: false },
    { to: '/wards', label: 'Wards', icon: '🛏️', end: false },
    ...(can('ipd:read_basic') || can('station:read') ? [{ to: '/delivery-ward', label: 'Delivery ward', icon: '👶', end: false }] : []),
    ...(can('billing:read') ? [{ to: '/billing', label: 'Billing', icon: '💳', end: false }] : []),
    ...(can('settings:manage') ? [{ to: '/settings', label: 'Clinic', icon: '🏥', end: false }] : []),
    ...(can('user:manage') ? [{ to: '/users', label: 'Staff', icon: '🔑', end: false }] : []),
    ...(can('audit:read') ? [{ to: '/audit', label: 'Audit', icon: '🔍', end: false }] : []),
    { to: '/account', label: 'Account', icon: '⚙️', end: false },
  ];
  return (
    <>
    <ScreenLock />
    <div className="shell" inert={locked} aria-hidden={locked}>
      <nav className="nav" aria-label="Main">
        <div className="brand">Clinic</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span aria-hidden="true">{l.icon}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}
        <div className="nav-user">
          <div>{me.fullName}</div>
          <div className="muted small">{me.role}</div>
          <button className="btn small" onClick={() => void lock('manual')}>
            Lock screen
          </button>
          <button className="btn small" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </nav>
      <main className="main">
        {can('backup:manage') && <SystemWarning />}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/new" element={<PatientPage />} />
          <Route path="/patients/:id" element={<PatientPage />} />
          <Route path="/patients/:id/summary/print" element={can('patient:read_clinical') ? <ClinicalSummaryPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/ultrasounds/:id/print" element={can('patient:read_clinical') ? <UltrasoundPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/lab-orders/:id/print" element={can('patient:read_clinical') ? <LabOrderPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/partographs/:id/print" element={can('patient:read_clinical') ? <PartographPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/operative-notes/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <OperativeNotePrint /> : <Navigate to="/patients" replace />} />
          <Route path="/risk-assessments/:id/print" element={can('patient:read_clinical') ? <RiskAssessmentPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/obstetric-discharges/:id/print" element={can('patient:read_clinical') ? <ObstetricDischargePrint /> : <Navigate to="/patients" replace />} />
          <Route path="/maternity-admissions/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <MaternityAdmissionPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/delivery-ward" element={can('ipd:read_basic') || can('station:read') ? <DeliveryWardPage /> : <Navigate to="/" replace />} />
          <Route path="/visits/:id" element={can('visit:read') ? <VisitPage /> : <Navigate to="/" replace />} />
          <Route path="/visits/:id/print" element={can('visit:read') ? <PrescriptionPrint /> : <Navigate to="/" replace />} />
          <Route path="/admissions/:id/print" element={can('ipd:read') ? <DischargePrint /> : <Navigate to="/wards" replace />} />
          <Route path="/wards" element={<WardsPage />} />
          <Route path="/admissions/new" element={can('admission:create') ? <AdmitPage /> : <Navigate to="/wards" replace />} />
          <Route path="/admissions/:id" element={<AdmissionPage />} />
          <Route path="/billing" element={can('billing:read') ? <BillingPage /> : <Navigate to="/" replace />} />
          <Route path="/billing/prices" element={can('pricelist:manage') ? <PriceListPage /> : <Navigate to="/billing" replace />} />
          <Route path="/billing/report" element={can('billing:read') ? <CollectionReportPage /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id" element={can('billing:read') ? <InvoicePage /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id/print" element={can('billing:read') ? <InvoicePrint /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id/receipts/:pid" element={can('billing:read') ? <ReceiptPrint /> : <Navigate to="/" replace />} />
          <Route path="/settings/checklist" element={can('settings:manage') ? <ChecklistPage /> : <Navigate to="/" replace />} />
          <Route path="/settings/prescription-templates" element={can('visit:write') ? <PrescriptionTemplatesPage /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={can('settings:manage') ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/users" element={can('user:manage') ? <UsersPage /> : <Navigate to="/" replace />} />
          <Route path="/station" element={can('station:read') ? <StationPage /> : <Navigate to="/" replace />} />
          <Route path="/audit" element={can('audit:read') ? <AuditPage /> : <Navigate to="/" replace />} />
          <Route path="/tv" element={<TvQueuePage />} />
          <Route path="/account" element={<ChangePasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
    </>
  );
}
