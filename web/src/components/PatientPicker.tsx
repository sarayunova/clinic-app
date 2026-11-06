import { useEffect, useState } from 'react';
import { api, type PatientSummary } from '../api';
import { formatAge } from './ui';

/** Debounced name / number / phone / partner search. Calls onPick when a result is chosen. */
export function PatientPicker({ onPick, autoFocus = false }: { onPick: (p: PatientSummary) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const r = await api<PatientSummary[]>('GET', `/api/patients?q=${encodeURIComponent(term)}`);
        if (!cancelled) {
          setResults(r);
          setSearched(true);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="picker">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, patient number, phone, partner/spouse or address"
        aria-label="Search patients"
        autoFocus={autoFocus}
      />
      {error && <div className="banner error">{error}</div>}
      {searched && results.length === 0 && <p className="muted">No patients found.</p>}
      <ul className="list">
        {results.map((p) => (
          <li key={p.id}>
            <button type="button" className="list-item" onClick={() => onPick(p)}>
              <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{p.fullName}</strong>
                <div className="row wrap" style={{ gap: '0.3rem', fontSize: '0.75rem' }}>
                  {p.isAntenatal && (
                    <span className="chip" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                      🤰 {p.gestationalAgeFormatted ?? 'Antenatal'}
                    </span>
                  )}
                  {p.isInpatient && (
                    <span className="chip" style={{ background: '#fef3c7', color: '#92400e' }}>
                      🛏️ Inpatient
                    </span>
                  )}
                  {p.isHighRisk && (
                    <span className="chip" style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>
                      ⚠️ High Risk
                    </span>
                  )}
                  {p.allergyStatus === 'known' && (
                    <span className="chip" style={{ background: '#fff1f2', color: '#be123c' }}>
                      Allergy
                    </span>
                  )}
                </div>
              </div>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {p.patientNumber} · {p.detailedAge ?? formatAge(p.ageYears, p.ageIsEstimated)}
                {p.phone ? ` · 📞 ${p.phone}` : ''}
                {p.emergencyContactName ? ` · Partner: ${p.emergencyContactName}` : ''}
                {p.address ? ` · ${p.address}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
