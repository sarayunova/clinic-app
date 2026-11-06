import React, { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type {
  ContractionIntensity,
  LaborOutcome,
  LiquorState,
  MoldingDegree,
  Partograph,
  PartographEntry,
  StationDescent,
} from '../partographLogic';
import {
  evaluateLaborAlerts,
  LIQUOR_LABELS,
  MOLDING_LABELS,
  OUTCOME_LABELS,
  STATION_DESCENT_LEVELS,
} from '../partographLogic';
import { PartographChart } from './PartographChart';
import { ErrorBanner, Field } from './ui';

interface Props {
  patientId: number;
  admissionId?: number | null;
  onChanged?: () => void;
}

export function PartographTracker({ patientId, admissionId, onChanged }: Props) {
  const { can } = useAuth();
  const canManage = can('patient:write_clinical') || can('care:write_nursing');

  const [partographs, setPartographs] = useState<Partograph[]>([]);
  const [selectedPartograph, setSelectedPartograph] = useState<Partograph | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);

  // Form states
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [parity, setParity] = useState('');
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState('39.0');
  const [ruptureTime, setRuptureTime] = useState('');
  const [fetalPosition, setFetalPosition] = useState('LOA');
  const [initialDilatation, setInitialDilatation] = useState('4.0');
  const [initialStation, setInitialStation] = useState<StationDescent>('4/5');
  const [initialFhr, setInitialFhr] = useState('140');
  const [initialLiquor, setInitialLiquor] = useState<LiquorState>('C');
  const [initialMolding, setInitialMolding] = useState<MoldingDegree>('0');

  // Observation Entry Form
  const [entryTime, setEntryTime] = useState(new Date().toISOString().slice(0, 16));
  const [fhr, setFhr] = useState('');
  const [liquor, setLiquor] = useState<LiquorState | ''>('');
  const [molding, setMolding] = useState<MoldingDegree | ''>('');
  const [dilatation, setDilatation] = useState('');
  const [station, setStation] = useState<StationDescent | ''>('');
  const [contCount, setContCount] = useState('');
  const [contIntensity, setContIntensity] = useState<ContractionIntensity | ''>('');
  const [contDuration, setContDuration] = useState('');
  const [oxyRate, setOxyRate] = useState('');
  const [oxyUnits, setOxyUnits] = useState('');
  const [drugs, setDrugs] = useState('');
  const [ivFluids, setIvFluids] = useState('');
  const [pulse, setPulse] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [temp, setTemp] = useState('');
  const [urineProt, setUrineProt] = useState('');
  const [urineKet, setUrineKet] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Outcome Form
  const [outcome, setOutcome] = useState<LaborOutcome>('normal_vaginal');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [deliveryTime, setDeliveryTime] = useState(new Date().toISOString().slice(0, 16));
  const [babyGender, setBabyGender] = useState<'male' | 'female' | 'ambiguous'>('female');
  const [babyWeightGrams, setBabyWeightGrams] = useState('3100');
  const [apgar1, setApgar1] = useState('8');
  const [apgar5, setApgar5] = useState('9');

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ partographs: Partograph[] }>('GET', `/api/patients/${patientId}/partographs`);
      setPartographs(res.partographs || []);
      if (res.partographs && res.partographs.length > 0) {
        // Load details of latest or active partograph
        await loadDetails(res.partographs[0]!.id);
      } else {
        setSelectedPartograph(null);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(id: number) {
    try {
      const p = await api<Partograph>('GET', `/api/partographs/${id}`);
      setSelectedPartograph(p);
    } catch (err) {
      setError(err);
    }
  }

  useEffect(() => {
    void loadList();
  }, [patientId]);

  async function handleStartPartograph(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        admissionId: admissionId ?? undefined,
        startTime: new Date(startTime).toISOString(),
        parity: parity.trim() || undefined,
        gestationalAgeWeeks: gestationalAgeWeeks ? parseFloat(gestationalAgeWeeks) : undefined,
        ruptureOfMembranesTime: ruptureTime ? new Date(ruptureTime).toISOString() : undefined,
        fetalPosition: fetalPosition || undefined,
        initialDilatationCm: initialDilatation ? parseFloat(initialDilatation) : undefined,
        initialStation: initialStation || undefined,
        initialFhr: initialFhr ? parseInt(initialFhr, 10) : undefined,
        initialLiquor: initialLiquor || undefined,
        initialMolding: initialMolding || undefined,
      };

      const res = await api<{ id: number }>('POST', `/api/patients/${patientId}/partographs`, payload);
      setShowStartModal(false);
      await loadList();
      await loadDetails(res.id);
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  }

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    if (!selectedPartograph) return;
    setError(null);
    try {
      const payload = {
        recordedAt: new Date(entryTime).toISOString(),
        fetalHeartRate: fhr ? parseInt(fhr, 10) : undefined,
        liquor: liquor || undefined,
        molding: molding || undefined,
        cervicalDilatationCm: dilatation ? parseFloat(dilatation) : undefined,
        stationDescent: station || undefined,
        contractionsCount: contCount ? parseInt(contCount, 10) : undefined,
        contractionsIntensity: contIntensity || undefined,
        contractionsDurationSec: contDuration ? parseInt(contDuration, 10) : undefined,
        oxytocinDropsPerMin: oxyRate ? parseInt(oxyRate, 10) : undefined,
        oxytocinUPerL: oxyUnits ? parseFloat(oxyUnits) : undefined,
        drugsGiven: drugs.trim() || undefined,
        ivFluids: ivFluids.trim() || undefined,
        maternalPulseBpm: pulse ? parseInt(pulse, 10) : undefined,
        maternalSystolicMmhg: systolic ? parseInt(systolic, 10) : undefined,
        maternalDiastolicMmhg: diastolic ? parseInt(diastolic, 10) : undefined,
        maternalTemperatureC: temp ? parseFloat(temp) : undefined,
        urineProtein: urineProt.trim() || undefined,
        urineKetones: urineKet.trim() || undefined,
        clinicalNotes: clinicalNotes.trim() || undefined,
      };

      await api('POST', `/api/partographs/${selectedPartograph.id}/entries`, payload);
      setShowEntryModal(false);
      // Reset form
      setDilatation('');
      setFhr('');
      setContCount('');
      setContDuration('');
      setClinicalNotes('');
      await loadDetails(selectedPartograph.id);
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  }

  async function handleRecordOutcome(e: FormEvent) {
    e.preventDefault();
    if (!selectedPartograph) return;
    setError(null);
    try {
      const payload = {
        status: 'completed',
        outcome,
        outcomeNotes: outcomeNotes.trim() || undefined,
        deliveryTime: new Date(deliveryTime).toISOString(),
        babyGender,
        babyWeightGrams: babyWeightGrams ? parseInt(babyWeightGrams, 10) : undefined,
        apgar1min: apgar1 ? parseInt(apgar1, 10) : undefined,
        apgar5min: apgar5 ? parseInt(apgar5, 10) : undefined,
      };

      await api('PATCH', `/api/partographs/${selectedPartograph.id}/outcome`, payload);
      setShowOutcomeModal(false);
      await loadList();
      await loadDetails(selectedPartograph.id);
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  }

  const alerts = selectedPartograph ? evaluateLaborAlerts(selectedPartograph.entries, selectedPartograph) : [];

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <ErrorBanner error={error} />

      {/* Top Header & Session Selector */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>📈 WHO Partograph &amp; Labor Progress Monitor</h2>
          <p className="muted small" style={{ margin: '0.2rem 0 0 0' }}>
            Active first stage labor curve tracking cervical dilatation alert &amp; action lines, fetal descent, FHR, contractions, and maternal vitals.
          </p>
        </div>

        <div className="row wrap" style={{ gap: '0.5rem' }}>
          {canManage && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setStartTime(new Date().toISOString().slice(0, 16));
                setShowStartModal(true);
              }}
            >
              ➕ Start Labor Partograph
            </button>
          )}

          {selectedPartograph && (
            <Link
              to={`/partographs/${selectedPartograph.id}/print`}
              className="btn"
              title="Print formal WHO Partograph Sheet"
            >
              🖨️ Print Partograph
            </Link>
          )}
        </div>
      </div>

      {/* Partograph Selector Pills */}
      {partographs.length > 1 && (
        <div className="row wrap" style={{ gap: '0.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.6rem' }}>
          <span className="muted small" style={{ alignSelf: 'center', marginRight: '0.4rem' }}>Labor Sessions:</span>
          {partographs.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn small ${selectedPartograph?.id === p.id ? 'primary' : ''}`}
              onClick={() => loadDetails(p.id)}
            >
              {p.partographNumber} · {p.startTime.slice(0, 10)} ({p.status.toUpperCase()})
            </button>
          ))}
        </div>
      )}

      {loading && !selectedPartograph && <p className="muted">Loading labor progress data…</p>}

      {!loading && partographs.length === 0 && (
        <div className="card text-center stack" style={{ padding: '2.5rem', alignItems: 'center' }}>
          <div style={{ fontSize: '2.5rem' }}>📈</div>
          <h3 style={{ margin: 0 }}>No Labor Partograph Started</h3>
          <p className="muted" style={{ maxWidth: '480px' }}>
            Initiate WHO Partograph labor curve monitoring when the patient enters the active phase of first stage labor (cervical dilatation ≥ 4 cm with regular contractions).
          </p>
          {canManage && (
            <button
              type="button"
              className="btn primary"
              onClick={() => setShowStartModal(true)}
            >
              ➕ Start Labor Partograph
            </button>
          )}
        </div>
      )}

      {selectedPartograph && (
        <>
          {/* Active Labor Summary Card */}
          <div
            className="card stack"
            style={{
              borderLeft: selectedPartograph.status === 'active' ? '4px solid #16a34a' : '4px solid #3b82f6',
              background: '#f8fafc',
            }}
          >
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: selectedPartograph.status === 'active' ? '#dcfce7' : '#e0e7ff',
                    color: selectedPartograph.status === 'active' ? '#15803d' : '#3730a3',
                    marginBottom: '0.25rem',
                  }}
                >
                  {selectedPartograph.status === 'active' ? '🟢 Active Labor Monitoring' : `🏁 Completed · ${OUTCOME_LABELS[selectedPartograph.outcome || 'normal_vaginal']}`}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  Partograph #{selectedPartograph.partographNumber}
                </h3>
              </div>

              <div className="row wrap" style={{ gap: '0.5rem' }}>
                {canManage && selectedPartograph.status === 'active' && (
                  <>
                    <button
                      type="button"
                      className="btn primary small"
                      onClick={() => {
                        setEntryTime(new Date().toISOString().slice(0, 16));
                        setShowEntryModal(true);
                      }}
                    >
                      ⏱️ Record Observation
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        setDeliveryTime(new Date().toISOString().slice(0, 16));
                        setShowOutcomeModal(true);
                      }}
                    >
                      👶 Record Delivery Outcome
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.75rem',
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span className="muted small" style={{ display: 'block' }}>Active Phase Start:</span>
                <strong>{new Date(selectedPartograph.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                <span className="muted small" style={{ display: 'block' }}>{selectedPartograph.startTime.slice(0, 10)}</span>
              </div>

              <div>
                <span className="muted small" style={{ display: 'block' }}>Parity / Gravida:</span>
                <strong>{selectedPartograph.parity || 'Unspecified'}</strong>
              </div>

              <div>
                <span className="muted small" style={{ display: 'block' }}>Gestational Age:</span>
                <strong>{selectedPartograph.gestationalAgeWeeks ? `${selectedPartograph.gestationalAgeWeeks} Wks` : '—'}</strong>
              </div>

              <div>
                <span className="muted small" style={{ display: 'block' }}>Fetal Position:</span>
                <strong>{selectedPartograph.fetalPosition || 'LOA'}</strong>
              </div>

              <div>
                <span className="muted small" style={{ display: 'block' }}>Latest Dilatation:</span>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                  {selectedPartograph.entries.length > 0 && selectedPartograph.entries[selectedPartograph.entries.length - 1]!.cervicalDilatationCm != null
                    ? `${selectedPartograph.entries[selectedPartograph.entries.length - 1]!.cervicalDilatationCm} cm`
                    : '4.0 cm (Initial)'}
                </strong>
              </div>

              <div>
                <span className="muted small" style={{ display: 'block' }}>Observations Logged:</span>
                <strong>{selectedPartograph.entries.length} entries</strong>
              </div>
            </div>
          </div>

          {/* Clinical Decision Support & Warning Alerts */}
          {alerts.length > 0 && (
            <div className="stack" style={{ gap: '0.4rem' }}>
              {alerts.map((alt, idx) => (
                <div
                  key={idx}
                  className={`banner ${alt.severity === 'critical' ? 'danger' : 'warn'}`}
                  style={{ fontSize: '0.86rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{alt.title}: </strong>
                    <span>{alt.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Graphical WHO Partograph Chart */}
          <div className="card stack">
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Labor Progress Curve &amp; Maternal-Fetal Trend</h3>
              <span className="muted small">WHO Standard Active Phase Labor Graph</span>
            </div>

            <PartographChart
              partograph={selectedPartograph}
              entries={selectedPartograph.entries}
            />
          </div>

          {/* Chronological Table of Observations */}
          <div className="card stack">
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Observation Timeline</h3>
              <span className="muted small">{selectedPartograph.entries.length} records</span>
            </div>

            {selectedPartograph.entries.length === 0 ? (
              <p className="muted small">No observations logged yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th>Time (Elapsed)</th>
                      <th>FHR (bpm)</th>
                      <th>Liquor</th>
                      <th>Molding</th>
                      <th>Dilatation</th>
                      <th>Station</th>
                      <th>Contractions</th>
                      <th>Maternal BP &amp; Pulse</th>
                      <th>Medications</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPartograph.entries.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <strong>T+{e.hoursFromStart}h</strong>
                          <span className="muted small" style={{ display: 'block' }}>
                            {new Date(e.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color: e.fetalHeartRate && (e.fetalHeartRate < 110 || e.fetalHeartRate > 160) ? '#dc2626' : '#0284c7',
                            }}
                          >
                            {e.fetalHeartRate ? `${e.fetalHeartRate} bpm` : '—'}
                          </span>
                        </td>
                        <td>{e.liquor || '—'}</td>
                        <td>{e.molding || '0'}</td>
                        <td>
                          <strong style={{ fontSize: '0.92rem' }}>
                            {e.cervicalDilatationCm != null ? `${e.cervicalDilatationCm} cm` : '—'}
                          </strong>
                        </td>
                        <td>{e.stationDescent || '—'}</td>
                        <td>
                          {e.contractionsCount != null
                            ? `${e.contractionsCount}/10 (${e.contractionsIntensity || 'mod'})`
                            : '—'}
                        </td>
                        <td>
                          {e.maternalSystolicMmhg && e.maternalDiastolicMmhg
                            ? `${e.maternalSystolicMmhg}/${e.maternalDiastolicMmhg} mmHg`
                            : '—'}
                          {e.maternalPulseBpm ? ` · ${e.maternalPulseBpm} bpm` : ''}
                        </td>
                        <td className="small">
                          {e.oxytocinDropsPerMin ? `Oxy: ${e.oxytocinDropsPerMin}dpm ` : ''}
                          {e.drugsGiven || e.ivFluids || '—'}
                        </td>
                        <td className="small muted">{e.clinicalNotes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: START LABOR PARTOGRAPH */}
      {/* ========================================================= */}
      {showStartModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal card stack" style={{ background: '#fff', maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Start WHO Labor Partograph</h3>
              <button type="button" className="btn small" onClick={() => setShowStartModal(false)}>✕</button>
            </div>

            <form onSubmit={handleStartPartograph} className="stack" style={{ gap: '0.85rem' }}>
              <Field label="Active Phase Start Time">
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </Field>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <Field label="Parity / Gravida (e.g. G2 P1)">
                    <input
                      value={parity}
                      onChange={(e) => setParity(e.target.value)}
                      placeholder="e.g. G2 P1 L1"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Gestational Age (weeks)">
                    <input
                      type="number"
                      step="0.1"
                      min="20"
                      max="45"
                      value={gestationalAgeWeeks}
                      onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                      placeholder="39.2"
                    />
                  </Field>
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <Field label="Membranes Ruptured Time">
                    <input
                      type="datetime-local"
                      value={ruptureTime}
                      onChange={(e) => setRuptureTime(e.target.value)}
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Fetal Position">
                    <select value={fetalPosition} onChange={(e) => setFetalPosition(e.target.value)}>
                      <option value="LOA">LOA (Left Occiput Anterior - Most Common)</option>
                      <option value="ROA">ROA (Right Occiput Anterior)</option>
                      <option value="LOT">LOT (Left Occiput Transverse)</option>
                      <option value="ROT">ROT (Right Occiput Transverse)</option>
                      <option value="LOP">LOP (Left Occiput Posterior)</option>
                      <option value="ROP">ROP (Right Occiput Posterior)</option>
                      <option value="Breech">Breech Presentation</option>
                    </select>
                  </Field>
                </div>
              </div>

              <h4 style={{ margin: '0.4rem 0 0.1rem 0', fontSize: '0.92rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.6rem' }}>
                Initial Examination at Start (T=0)
              </h4>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <Field label="Initial Cervical Dilatation (cm)">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={initialDilatation}
                      onChange={(e) => setInitialDilatation(e.target.value)}
                      placeholder="4.0"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Initial Fetal Head Station">
                    <select value={initialStation} onChange={(e) => setInitialStation(e.target.value as StationDescent)}>
                      {STATION_DESCENT_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl} palpable</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <Field label="Initial FHR (bpm)">
                    <input
                      type="number"
                      value={initialFhr}
                      onChange={(e) => setInitialFhr(e.target.value)}
                      placeholder="140"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Initial Liquor State">
                    <select value={initialLiquor} onChange={(e) => setInitialLiquor(e.target.value as LiquorState)}>
                      <option value="I">I · Intact Membranes</option>
                      <option value="C">C · Clear Liquor</option>
                      <option value="M">M · Meconium-Stained</option>
                      <option value="A">A · Absent / Dry</option>
                      <option value="B">B · Blood-Stained</option>
                    </select>
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Molding">
                    <select value={initialMolding} onChange={(e) => setInitialMolding(e.target.value as MoldingDegree)}>
                      <option value="0">0 · Bones separated</option>
                      <option value="+">+ · Bones touching</option>
                      <option value="++">++ · Bones overlapping</option>
                      <option value="+++">+++ · Severe / Locked</option>
                    </select>
                  </Field>
                </div>
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" className="btn" onClick={() => setShowStartModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Start Monitoring</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: RECORD PERIODIC OBSERVATION ENTRY */}
      {/* ========================================================= */}
      {showEntryModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal card stack" style={{ background: '#fff', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Record Labor Observation Entry</h3>
              <button type="button" className="btn small" onClick={() => setShowEntryModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddEntry} className="stack" style={{ gap: '0.75rem' }}>
              <Field label="Observation Timestamp">
                <input
                  type="datetime-local"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  required
                />
              </Field>

              {/* Fetal Condition */}
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.88rem', color: '#0369a1' }}>👶 Fetal Condition</strong>
                <div className="row wrap" style={{ gap: '0.65rem', marginTop: '0.4rem' }}>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <Field label="FHR (bpm, 110–160)">
                      <input
                        type="number"
                        min="60"
                        max="220"
                        value={fhr}
                        onChange={(e) => setFhr(e.target.value)}
                        placeholder="e.g. 144"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <Field label="Liquor">
                      <select value={liquor} onChange={(e) => setLiquor(e.target.value as any)}>
                        <option value="">— Select —</option>
                        <option value="I">I · Intact</option>
                        <option value="C">C · Clear</option>
                        <option value="M">M · Meconium</option>
                        <option value="A">A · Absent</option>
                        <option value="B">B · Blood</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <Field label="Molding">
                      <select value={molding} onChange={(e) => setMolding(e.target.value as any)}>
                        <option value="">— Select —</option>
                        <option value="0">0 · Separated</option>
                        <option value="+">+ · Touching</option>
                        <option value="++">++ · Overlapping</option>
                        <option value="+++">+++ · Severe locked</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Labor Progress */}
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>📈 Labor Progress (P/V Exam)</strong>
                <div className="row wrap" style={{ gap: '0.65rem', marginTop: '0.4rem' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <Field label="Cervical Dilatation (cm, 0–10)">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        value={dilatation}
                        onChange={(e) => setDilatation(e.target.value)}
                        placeholder="e.g. 6.0"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <Field label="Head Descent (fifths palpable)">
                      <select value={station} onChange={(e) => setStation(e.target.value as any)}>
                        <option value="">— Select —</option>
                        {STATION_DESCENT_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Uterine Contractions */}
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.88rem', color: '#334155' }}>⚡ Uterine Contractions (per 10 min)</strong>
                <div className="row wrap" style={{ gap: '0.65rem', marginTop: '0.4rem' }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <Field label="Count (1–5)">
                      <input
                        type="number"
                        min="0"
                        max="8"
                        value={contCount}
                        onChange={(e) => setContCount(e.target.value)}
                        placeholder="e.g. 3"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <Field label="Duration Category">
                      <select value={contIntensity} onChange={(e) => setContIntensity(e.target.value as any)}>
                        <option value="">— Select —</option>
                        <option value="mild">Mild (&lt; 20 sec)</option>
                        <option value="moderate">Moderate (20–40 sec)</option>
                        <option value="strong">Strong (&gt; 40 sec)</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: '110px' }}>
                    <Field label="Exact Seconds">
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={contDuration}
                        onChange={(e) => setContDuration(e.target.value)}
                        placeholder="35"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* Oxytocin & Medications */}
              <div className="row wrap" style={{ gap: '0.65rem' }}>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <Field label="Oxytocin Rate (drops/min)">
                    <input
                      type="number"
                      value={oxyRate}
                      onChange={(e) => setOxyRate(e.target.value)}
                      placeholder="e.g. 15"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <Field label="Oxytocin Dose (Units/L)">
                    <input
                      type="number"
                      step="0.5"
                      value={oxyUnits}
                      onChange={(e) => setOxyUnits(e.target.value)}
                      placeholder="e.g. 2.5"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <Field label="Drugs Administered">
                    <input
                      value={drugs}
                      onChange={(e) => setDrugs(e.target.value)}
                      placeholder="e.g. Inj. Ampicillin 1g IV"
                    />
                  </Field>
                </div>
              </div>

              {/* Maternal Vitals */}
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.88rem', color: '#dc2626' }}>🩺 Maternal Vitals</strong>
                <div className="row wrap" style={{ gap: '0.65rem', marginTop: '0.4rem' }}>
                  <div style={{ flex: 1, minWidth: '110px' }}>
                    <Field label="Maternal Pulse (bpm)">
                      <input
                        type="number"
                        value={pulse}
                        onChange={(e) => setPulse(e.target.value)}
                        placeholder="80"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <Field label="Systolic (mmHg)">
                      <input
                        type="number"
                        value={systolic}
                        onChange={(e) => setSystolic(e.target.value)}
                        placeholder="120"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <Field label="Diastolic (mmHg)">
                      <input
                        type="number"
                        value={diastolic}
                        onChange={(e) => setDiastolic(e.target.value)}
                        placeholder="80"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <Field label="Temp (°C)">
                      <input
                        type="number"
                        step="0.1"
                        value={temp}
                        onChange={(e) => setTemp(e.target.value)}
                        placeholder="37.0"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <Field label="Clinical Notes / Orders">
                <textarea
                  rows={2}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="e.g. Membranes ruptured spontaneously, clear liquor drained. Encouraged ambulation."
                  maxLength={1000}
                />
              </Field>

              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowEntryModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Observation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: RECORD DELIVERY OUTCOME */}
      {/* ========================================================= */}
      {showOutcomeModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal card stack" style={{ background: '#fff', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>👶 Record Delivery Outcome</h3>
              <button type="button" className="btn small" onClick={() => setShowOutcomeModal(false)}>✕</button>
            </div>

            <form onSubmit={handleRecordOutcome} className="stack" style={{ gap: '0.75rem' }}>
              <Field label="Delivery Date &amp; Time">
                <input
                  type="datetime-local"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  required
                />
              </Field>

              <Field label="Mode / Outcome of Delivery">
                <select value={outcome} onChange={(e) => setOutcome(e.target.value as LaborOutcome)}>
                  <option value="normal_vaginal">Normal Spontaneous Vaginal Delivery (NVD)</option>
                  <option value="assisted_vacuum">Vacuum-Assisted Vaginal Delivery</option>
                  <option value="assisted_forceps">Forceps Delivery</option>
                  <option value="emergency_lscs">Emergency Cesarean Section (LSCS)</option>
                  <option value="elective_lscs">Elective Cesarean Section</option>
                  <option value="transferred">Transferred to Higher Tertiary Care</option>
                </select>
              </Field>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <Field label="Baby Gender">
                    <select value={babyGender} onChange={(e) => setBabyGender(e.target.value as any)}>
                      <option value="female">Female (Girl)</option>
                      <option value="male">Male (Boy)</option>
                      <option value="ambiguous">Ambiguous</option>
                    </select>
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Birth Weight (grams)">
                    <input
                      type="number"
                      value={babyWeightGrams}
                      onChange={(e) => setBabyWeightGrams(e.target.value)}
                      placeholder="e.g. 3150"
                    />
                  </Field>
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <Field label="APGAR Score at 1 Min (0–10)">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={apgar1}
                      onChange={(e) => setApgar1(e.target.value)}
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="APGAR Score at 5 Min (0–10)">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={apgar5}
                      onChange={(e) => setApgar5(e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <Field label="Labor &amp; Delivery Summary Notes (Perineum / Placenta / Blood Loss)">
                <textarea
                  rows={3}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="e.g. Live female infant delivered over right mediolateral episiotomy. Placenta delivered complete with membranes by controlled cord traction. Estimated blood loss 250 mL. Episiotomy sutured in layers."
                />
              </Field>

              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" className="btn" onClick={() => setShowOutcomeModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Complete &amp; Save Labor Outcome</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
