import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { PatientPicker } from '../components/PatientPicker';

export function PatientsPage() {
  const nav = useNavigate();
  const { can } = useAuth();
  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Patients</h1>
        {can('patient:write_demographics') && (
          <Link className="btn primary" to="/patients/new">
            + Register patient
          </Link>
        )}
      </header>
      <PatientPicker onPick={(p) => nav(`/patients/${p.id}`)} autoFocus />
      <p className="muted small">Type at least 2 letters of a name, a patient number (e.g. P000012) or 3+ digits of a phone number.</p>
    </div>
  );
}
