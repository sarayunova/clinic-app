import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type PatientSummary } from '../api';
import { useAuth } from '../auth';
import { BookAppointment } from '../components/BookAppointment';
import { formatAge } from '../components/ui';

type PatientCategory = 'all' | 'antenatal' | 'pediatric' | 'inpatient' | 'high_risk' | 'allergies';
type RiskTag = '' | 'rh_negative' | 'hypertension' | 'lscs' | 'boh';

export function PatientsPage() {
  const nav = useNavigate();
  const { can } = useAuth();

  const [q, setQ] = useState('');
  const [category, setCategory] = useState<PatientCategory>('all');
  const [tag, setTag] = useState<RiskTag>('');
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingPatient, setBookingPatient] = useState<PatientSummary | null>(null);

  useEffect(() => {
    const term = q.trim();
    const hasFilter = category !== 'all' || Boolean(tag);

    if (!hasFilter && term.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (term) params.set('q', term);
        if (category !== 'all') params.set('category', category);
        if (tag) params.set('tag', tag);
        params.set('limit', '50');

        const res = await api<PatientSummary[]>('GET', `/api/patients?${params.toString()}`);
        if (!cancelled) {
          setResults(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, category, tag]);

  const clearFilters = () => {
    setQ('');
    setCategory('all');
    setTag('');
  };

  return (
    <div className="page narrow stack" style={{ gap: '1.2rem' }}>
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0 }}>Patient Directory</h1>
          <div className="muted small">
            Search by name, patient ID, phone substring, partner/spouse name, or locality
          </div>
        </div>
        {can('patient:write_demographics') && (
          <Link className="btn primary" to="/patients/new">
            + Register patient
          </Link>
        )}
      </header>

      {/* Search Input Box */}
      <div className="card stack" style={{ padding: '0.8rem 1rem', gap: '0.8rem' }}>
        <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type patient name, phone, partner name (e.g. Ramesh) or locality..."
            aria-label="Search patients"
            autoFocus
            style={{ fontSize: '1rem', padding: '0.6rem 0.8rem' }}
          />
          {(q || category !== 'all' || tag) && (
            <button
              type="button"
              className="btn small"
              onClick={clearFilters}
              title="Reset all search filters"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="row wrap" style={{ gap: '0.35rem', alignItems: 'center' }}>
          <span className="small muted" style={{ marginRight: '0.2rem' }}>Filter by:</span>
          <button
            type="button"
            className={`btn small ${category === 'all' && !tag ? 'primary' : ''}`}
            onClick={() => { setCategory('all'); setTag(''); }}
          >
            👥 All Patients
          </button>
          <button
            type="button"
            className={`btn small ${category === 'antenatal' ? 'primary' : ''}`}
            onClick={() => setCategory(category === 'antenatal' ? 'all' : 'antenatal')}
          >
            🤰 Maternity & Antenatal
          </button>
          <button
            type="button"
            className={`btn small ${category === 'pediatric' ? 'primary' : ''}`}
            onClick={() => setCategory(category === 'pediatric' ? 'all' : 'pediatric')}
          >
            👶 Children (≤18y)
          </button>
          <button
            type="button"
            className={`btn small ${category === 'inpatient' ? 'primary' : ''}`}
            onClick={() => setCategory(category === 'inpatient' ? 'all' : 'inpatient')}
          >
            🛏️ Inpatients (Admitted)
          </button>
          <button
            type="button"
            className={`btn small ${category === 'high_risk' ? 'primary' : ''}`}
            onClick={() => setCategory(category === 'high_risk' ? 'all' : 'high_risk')}
          >
            ⚠️ High-Risk
          </button>
          <button
            type="button"
            className={`btn small ${category === 'allergies' ? 'primary' : ''}`}
            onClick={() => setCategory(category === 'allergies' ? 'all' : 'allergies')}
          >
            🏷️ Known Allergies
          </button>
        </div>

        {/* Quick Clinical Risk Tags */}
        <div className="row wrap" style={{ gap: '0.35rem', alignItems: 'center' }}>
          <span className="small muted" style={{ marginRight: '0.2rem' }}>Clinical tags:</span>
          <button
            type="button"
            className={`btn small ${tag === 'rh_negative' ? 'primary' : ''}`}
            onClick={() => setTag(tag === 'rh_negative' ? '' : 'rh_negative')}
            style={{ fontSize: '0.8rem' }}
          >
            🩸 Rh-Negative
          </button>
          <button
            type="button"
            className={`btn small ${tag === 'hypertension' ? 'primary' : ''}`}
            onClick={() => setTag(tag === 'hypertension' ? '' : 'hypertension')}
            style={{ fontSize: '0.8rem' }}
          >
            ⚡ High BP (≥140/90)
          </button>
          <button
            type="button"
            className={`btn small ${tag === 'lscs' ? 'primary' : ''}`}
            onClick={() => setTag(tag === 'lscs' ? '' : 'lscs')}
            style={{ fontSize: '0.8rem' }}
          >
            ✂️ Prior Cesarean / LSCS
          </button>
          <button
            type="button"
            className={`btn small ${tag === 'boh' ? 'primary' : ''}`}
            onClick={() => setTag(tag === 'boh' ? '' : 'boh')}
            style={{ fontSize: '0.8rem' }}
          >
            ⚠️ BOH (≥2 Abortions)
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {/* Booking Modal Helper */}
      {bookingPatient && (
        <BookAppointment
          patient={{ id: bookingPatient.id, name: bookingPatient.fullName }}
          onCancel={() => setBookingPatient(null)}
          onBooked={() => setBookingPatient(null)}
        />
      )}

      {/* Results Header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
          {category === 'all' && !tag && q.trim().length < 2
            ? 'Patients'
            : `Search Results (${results.length})`}
        </h2>
        {loading && <span className="small muted">Searching…</span>}
      </div>

      {/* Results List */}
      {category === 'all' && !tag && q.trim().length < 2 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <p className="muted" style={{ margin: '0 0 0.8rem 0' }}>
            Type at least 2 characters to search by patient name, patient ID, phone digits, spouse/partner name, or select a cohort filter above.
          </p>
          <div className="row wrap" style={{ justifyContent: 'center', gap: '0.5rem' }}>
            <button type="button" className="btn small" onClick={() => setCategory('antenatal')}>
              🤰 Browse Antenatal Mothers
            </button>
            <button type="button" className="btn small" onClick={() => setCategory('inpatient')}>
              🛏️ Current Inpatients
            </button>
            <button type="button" className="btn small" onClick={() => setCategory('pediatric')}>
              👶 Children
            </button>
          </div>
        </div>
      ) : results.length === 0 && !loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="muted" style={{ margin: 0 }}>No matching patients found.</p>
          {(category !== 'all' || tag) && (
            <button type="button" className="btn small" onClick={clearFilters} style={{ marginTop: '0.8rem' }}>
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: '0.6rem' }}>
          {results.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{
                padding: '0.8rem 1rem',
                borderLeft: p.isHighRisk
                  ? '4px solid #ef4444'
                  : p.isInpatient
                  ? '4px solid #f59e0b'
                  : p.isAntenatal
                  ? '4px solid #0284c7'
                  : '4px solid #cbd5e1',
              }}
            >
              <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <div className="row wrap" style={{ alignItems: 'center', gap: '0.5rem' }}>
                    <Link
                      to={`/patients/${p.id}`}
                      style={{ fontSize: '1.1rem', fontWeight: 700, textDecoration: 'none' }}
                    >
                      {p.fullName}
                    </Link>
                    <span className="muted small">{p.patientNumber}</span>
                    <span className="small">
                      · {p.detailedAge ?? formatAge(p.ageYears, p.ageIsEstimated)}
                    </span>
                    {p.phone && <span className="small">· 📞 {p.phone}</span>}
                  </div>

                  {/* Partner / Locality Info */}
                  <div className="muted small" style={{ marginTop: '0.2rem' }}>
                    {p.emergencyContactName && (
                      <span style={{ marginRight: '0.8rem' }}>
                        👤 <strong>Partner/Spouse:</strong> {p.emergencyContactName}
                        {p.emergencyContactPhone && ` (${p.emergencyContactPhone})`}
                      </span>
                    )}
                    {p.address && <span>📍 {p.address}</span>}
                  </div>

                  {/* Clinical & Maternity Chips */}
                  <div className="row wrap" style={{ gap: '0.4rem', marginTop: '0.4rem' }}>
                    {p.isAntenatal && (
                      <span
                        className="chip"
                        style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600, fontSize: '0.8rem' }}
                      >
                        🤰 {p.gestationalAgeFormatted ?? 'Antenatal'}
                        {p.edd ? ` · EDD ${p.edd}` : ''}
                        {p.gpal ? ` · ${p.gpal}` : ''}
                      </span>
                    )}

                    {p.isInpatient && (
                      <span
                        className="chip"
                        style={{ background: '#fef3c7', color: '#92400e', fontWeight: 600, fontSize: '0.8rem' }}
                      >
                        🛏️ Inpatient: {p.inpatientBed}
                      </span>
                    )}

                    {p.isPediatric && (
                      <span
                        className="chip"
                        style={{ background: '#f0fdf4', color: '#166534', fontSize: '0.8rem' }}
                      >
                        👶 Pediatric
                      </span>
                    )}

                    {p.allergyStatus === 'known' && (
                      <span
                        className="chip"
                        style={{ background: '#fff1f2', color: '#be123c', fontWeight: 600, fontSize: '0.8rem' }}
                      >
                        ⚠️ Allergy Alert
                      </span>
                    )}

                    {p.highRiskFlags?.map((flag, idx) => (
                      <span
                        key={idx}
                        className="chip"
                        style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 700, fontSize: '0.78rem' }}
                      >
                        ⚠️ {flag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="row wrap no-print" style={{ gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => nav(`/patients/${p.id}`)}
                  >
                    📂 Record
                  </button>
                  {can('appointment:create') && (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setBookingPatient(p)}
                    >
                      + Appt
                    </button>
                  )}
                  {can('patient:read_clinical') && (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => nav(`/patients/${p.id}/summary/print`)}
                      title="Print Clinical Summary or Referral Card"
                    >
                      🖨️ Card
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
