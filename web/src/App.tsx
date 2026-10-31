import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, useMe } from './auth';
import { AuthScreens, ChangePasswordPage } from './pages/AuthScreens';
import { Dashboard } from './pages/Dashboard';
import { PatientsPage } from './pages/Patients';
import { PatientPage } from './pages/PatientPage';
import { UsersPage } from './pages/Users';
import { VisitPage } from './pages/VisitPage';

export function App() {
  const { state } = useAuth();
  if (state.status === 'loading') return <p className="center muted">Loading…</p>;
  if (state.status !== 'ready') return <AuthScreens />;
  if (state.me.mustChangePassword) return <AuthScreens forceChange />;
  return <Shell />;
}

function Shell() {
  const me = useMe();
  const { logout, can } = useAuth();
  const links = [
    { to: '/', label: 'Today', icon: '📅', end: true },
    { to: '/patients', label: 'Patients', icon: '👥', end: false },
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
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/new" element={<PatientPage />} />
          <Route path="/patients/:id" element={<PatientPage />} />
          <Route path="/visits/:id" element={can('visit:read') ? <VisitPage /> : <Navigate to="/" replace />} />
          <Route path="/users" element={can('user:manage') ? <UsersPage /> : <Navigate to="/" replace />} />
          <Route path="/account" element={<ChangePasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
