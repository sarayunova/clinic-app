import { useEffect, useState } from 'react';
import { api, type PatientSummary } from '../api';
import { formatAge } from './ui';

/** Debounced name / number / phone search. Calls onPick when a result is chosen. */
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
        placeholder="Search by name, patient number or phone"
        aria-label="Search patients"
        autoFocus={autoFocus}
      />
      {error && <div className="banner error">{error}</div>}
      {searched && results.length === 0 && <p className="muted">No patients found.</p>}
      <ul className="list">
        {results.map((p) => (
          <li key={p.id}>
            <button type="button" className="list-item" onClick={() => onPick(p)}>
              <strong>{p.fullName}</strong>
              <span className="muted">
                {p.patientNumber} · {formatAge(p.ageYears, p.ageIsEstimated)}
                {p.phone ? ` · ${p.phone}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
