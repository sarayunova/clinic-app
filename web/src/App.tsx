import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, type BackupStatus } from './api';
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
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const { state } = useAuth();
  if (state.status === 'loading') return <p className="center muted">Loading…</p>;
  if (state.status !== 'ready') return <AuthScreens />;
  if (state.me.mustChangePassword) return <AuthScreens forceChange />;
  return <Shell />;
}

/** Tells the doctor, on every screen, when backups are not working. */
function BackupWarning() {
  const [warn, setWarn] = useState<string | null>(null);
  useEffect(() => {
    const check = () => api<BackupStatus>('GET', '/api/backups').then((s) => setWarn(s.healthy ? null : (s.warnings[0] ?? 'Backups need attention.')), () => {});
    check();
    const t = window.setInterval(check, 10 * 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (!warn) return null;
  return (
    <div className="banner warn no-print" role="alert">
      <strong>Backups need attention.</strong> {warn} <NavLink to="/settings">Open Clinic details</NavLink>
    </div>
  );
}

function Shell() {
  const me = useMe();
  const { logout, can } = useAuth();
  const links = [
    { to: '/', label: 'Today', icon: '📅', end: true },
    { to: '/patients', label: 'Patients', icon: '👥', end: false },
    { to: '/wards', label: 'Wards', icon: '🛏️', end: false },
    ...(can('billing:read') ? [{ to: '/billing', label: 'Billing', icon: '💳', end: false }] : []),
    ...(can('settings:manage') ? [{ to: '/settings', label: 'Clinic', icon: '🏥', end: false }] : []),
    ...(can('user:manage') ? [{ to: '/users', label: 'Staff', icon: '🔑', end: false }] : []),
    { to: '/account', label: 'Account', icon: '⚙️', end: false },
  ];
  return (
    <div className="shell">
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
          <button className="btn small" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </nav>
      <main className="main">
        {can('backup:manage') && <BackupWarning />}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/new" element={<PatientPage />} />
          <Route path="/patients/:id" element={<PatientPage />} />
          <Route path="/visits/:id" element={can('visit:read') ? <VisitPage /> : <Navigate to="/" replace />} />
          <Route path="/wards" element={<WardsPage />} />
          <Route path="/admissions/new" element={can('admission:create') ? <AdmitPage /> : <Navigate to="/wards" replace />} />
          <Route path="/admissions/:id" element={<AdmissionPage />} />
          <Route path="/billing" element={can('billing:read') ? <BillingPage /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id" element={can('billing:read') ? <InvoicePage /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id/print" element={can('billing:read') ? <InvoicePrint /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id/receipts/:pid" element={can('billing:read') ? <ReceiptPrint /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={can('settings:manage') ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/users" element={can('user:manage') ? <UsersPage /> : <Navigate to="/" replace />} />
          <Route path="/account" element={<ChangePasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
