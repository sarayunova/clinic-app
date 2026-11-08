import React, { useState, useEffect } from 'react';
import {
  getPediatricCroupEpisodes,
  getPediatricCroupEpisode,
  updatePediatricCroupEpisode,
  deletePediatricCroupEpisode,
  deletePediatricCroupFlowsheet,
  type PediatricCroupRecord,
  type PediatricCroupFlowsheetRecord,
} from '../api';
import { PediatricCroupModal } from './PediatricCroupModal';
import { PediatricCroupFlowsheetModal } from './PediatricCroupFlowsheetModal';

interface PediatricCroupTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricCroupTab: React.FC<PediatricCroupTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<PediatricCroupRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricCroupRecord | null>(null);
  const [logs, setLogs] = useState<PediatricCroupFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricCroupEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load croup episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getPediatricCroupEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load croup episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const res = await updatePediatricCroupEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this pediatric croup episode record?')) return;
    try {
      await deletePediatricCroupEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deletePediatricCroupFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="pediatric-croup-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: '#0284c7' }}>🌬️ Pediatric Croup & Airway Obstruction Protocol</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            Westley Croup Score Staging, Weight-Based Dexamethasone & Nebulized Epinephrine Rebound Monitoring
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ backgroundColor: '#0284c7', borderColor: '#0369a1' }}
          onClick={() => setShowModal(true)}
        >
          + Record Croup Triage
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && <p className="muted">Loading pediatric croup triage data...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', background: '#f8fafc' }}>
          <p className="muted" style={{ margin: 0 }}>
            No croup or acute upper airway obstruction episodes recorded for this patient.
          </p>
        </div>
      )}

      {episodes.length > 0 && selectedEpisode && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Episode List Sidebar */}
          <div className="card" style={{ padding: 12 }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b' }}>
              Croup Evaluations
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  className={`btn btn-sm ${ep.id === selectedEpisode.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', padding: 8 }}
                  onClick={() => loadDetail(ep.id)}
                >
                  <span style={{ fontWeight: 'bold' }}>{ep.episode_code}</span>
                  <span style={{ fontSize: '0.75rem' }}>{new Date(ep.triage_datetime).toLocaleDateString()}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: ep.westley_croup_score_total >= 6 ? '#dc2626' : '#0284c7',
                      fontWeight: 600,
                    }}
                  >
                    Score {ep.westley_croup_score_total}/17 ({ep.croup_severity_tier.replace(/_/g, ' ')})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Episode Details */}
          <div className="stack" style={{ gap: 16 }}>
            {/* Header Card */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#0284c7' }}>
                    Westley Score: {selectedEpisode.westley_croup_score_total}/17 — {selectedEpisode.croup_severity_tier.replace(/_/g, ' ').toUpperCase()}
                  </h4>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Triaged: {new Date(selectedEpisode.triage_datetime).toLocaleString()} | Age: {selectedEpisode.age_months}m | Weight: {selectedEpisode.weight_kg} kg | HR: {selectedEpisode.heart_rate_bpm} bpm | RR: {selectedEpisode.respiratory_rate} | SpO2: {selectedEpisode.spo2_percent}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-control"
                    style={{ width: 'auto', fontSize: '0.85rem' }}
                    value={selectedEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="acute_triage_resuscitation">Acute Triage & Resuscitation</option>
                    <option value="post_nebulization_observation">Post-Nebulization Observation</option>
                    <option value="picu_admission_escalation">PICU Admission Escalation</option>
                    <option value="discharged_home_stable">Discharged Home Stable</option>
                  </select>
                  <a
                    href={`/pediatric-croup/${selectedEpisode.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-secondary"
                  >
                    🖨️ Print Dossier
                  </a>
                  <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Status Alert Banner */}
              <div
                style={{
                  background: selectedEpisode.westley_croup_score_total >= 6 ? '#fef2f2' : '#f0f9ff',
                  borderLeft: `4px solid ${selectedEpisode.westley_croup_score_total >= 6 ? '#ef4444' : '#0284c7'}`,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: selectedEpisode.westley_croup_score_total >= 6 ? '#b91c1c' : '#0369a1' }}>
                      {evalResult?.summary || 'Pediatric Croup Clinical Staging'}
                    </strong>
                    <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: 4 }}>
                      Dexamethasone: <strong>{selectedEpisode.dexamethasone_dose_mg} mg</strong> ({selectedEpisode.dexamethasone_route.toUpperCase()}) | Stridor at rest: {selectedEpisode.inspiratory_stridor_score === 2 ? 'YES' : 'NO'} | Barking cough: {selectedEpisode.barking_cough_present ? 'YES' : 'NO'}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: selectedEpisode.westley_croup_score_total >= 6 ? '#dc2626' : '#0284c7',
                      color: '#fff',
                      padding: '6px 12px',
                    }}
                  >
                    {selectedEpisode.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Action Cards: Dexamethasone & Nebulized Epinephrine */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontWeight: 600, color: '#15803d', fontSize: '0.85rem', marginBottom: 6 }}>
                    💊 Systemic Corticosteroid (Dexamethasone)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Calculated Single Dose:</span>
                    <strong style={{ color: '#15803d' }}>{selectedEpisode.dexamethasone_dose_mg} mg</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Route:</span>
                    <strong style={{ color: '#15803d' }}>{selectedEpisode.dexamethasone_route.toUpperCase()}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 6 }}>
                    Status: {selectedEpisode.dexamethasone_administered ? '✅ Administered' : 'Pending administration'}
                  </div>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontWeight: 600, color: '#b45309', fontSize: '0.85rem', marginBottom: 6 }}>
                    🌬️ Nebulized L-Epinephrine 1:1000 Protocol
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Nebulizer Dose (0.5 mL/kg, max 5 mL):</span>
                    <strong style={{ color: '#b45309' }}>
                      {selectedEpisode.epinephrine_nebulization_dose_ml ? `${selectedEpisode.epinephrine_nebulization_dose_ml} mL` : 'Not Indicated (Mild)'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Mandatory Rebound Surveillance:</span>
                    <strong style={{ color: '#b45309' }}>{selectedEpisode.rebound_observation_hours_required} Hours</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 6 }}>
                    Administer in 3 mL NS with high-flow blow-by oxygen over 10-15 min.
                  </div>
                </div>
              </div>

              {/* Westley Score Components Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Stridor</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedEpisode.inspiratory_stridor_score} / 2</div>
                  <div style={{ fontSize: '0.7rem' }}>{selectedEpisode.inspiratory_stridor_score === 2 ? 'At rest' : selectedEpisode.inspiratory_stridor_score === 1 ? 'Agitation' : 'None'}</div>
                </div>

                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Retractions</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedEpisode.retractions_score} / 3</div>
                  <div style={{ fontSize: '0.7rem' }}>{selectedEpisode.retractions_score === 3 ? 'Severe' : selectedEpisode.retractions_score === 2 ? 'Moderate' : selectedEpisode.retractions_score === 1 ? 'Mild' : 'None'}</div>
                </div>

                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Air Entry</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedEpisode.air_entry_score} / 2</div>
                  <div style={{ fontSize: '0.7rem' }}>{selectedEpisode.air_entry_score === 2 ? 'Markedly dec' : selectedEpisode.air_entry_score === 1 ? 'Decreased' : 'Normal'}</div>
                </div>

                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Cyanosis</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedEpisode.cyanosis_score} / 5</div>
                  <div style={{ fontSize: '0.7rem' }}>{selectedEpisode.cyanosis_score === 5 ? 'At rest' : selectedEpisode.cyanosis_score === 4 ? 'Agitation' : 'None'}</div>
                </div>

                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Consciousness</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedEpisode.consciousness_score} / 5</div>
                  <div style={{ fontSize: '0.7rem' }}>{selectedEpisode.consciousness_score === 5 ? 'Lethargic' : 'Alert'}</div>
                </div>
              </div>

              {/* Action Plan */}
              {evalResult?.criticalActionPlan && (
                <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: '#0f766e', fontSize: '0.85rem', marginBottom: 6 }}>
                    📋 Clinical Action Pathway
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#115e59' }}>
                    {evalResult.criticalActionPlan.map((step: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: 2 }}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {selectedEpisode.clinical_notes && (
                <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: 8, borderRadius: 4 }}>
                  <strong>Notes:</strong> {selectedEpisode.clinical_notes}
                </div>
              )}
            </div>

            {/* Bedside Flowsheet */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, color: '#0284c7' }}>
                  ⏱️ Airway & Nebulization Response Flowsheet ({logs.length} checkpoints)
                </h4>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ backgroundColor: '#0284c7', borderColor: '#0369a1' }}
                  onClick={() => setShowFlowsheetModal(true)}
                >
                  + Add Airway Checkpoint
                </button>
              </div>

              {logs.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  No serial airway checkpoint logs yet. Click "+ Add Airway Checkpoint" to document Westley score improvements, stridor resolution, or repeat nebulization.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: 6 }}>Time (+Mins)</th>
                        <th style={{ padding: 6 }}>Westley Score</th>
                        <th style={{ padding: 6 }}>HR / RR / SpO2</th>
                        <th style={{ padding: 6 }}>Stridor at Rest</th>
                        <th style={{ padding: 6 }}>Retractions</th>
                        <th style={{ padding: 6 }}>Intervention Given</th>
                        <th style={{ padding: 6 }}>Notes</th>
                        <th style={{ padding: 6, textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: 6 }}>
                            <div>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <small className="muted">+{log.minutes_from_triage}m</small>
                          </td>
                          <td style={{ padding: 6 }}>
                            <strong style={{ color: log.westley_score_current >= 6 ? '#dc2626' : log.westley_score_current >= 3 ? '#f59e0b' : '#16a34a' }}>
                              {log.westley_score_current}/17
                            </strong>
                          </td>
                          <td style={{ padding: 6 }}>
                            {log.heart_rate_bpm} bpm | {log.respiratory_rate}/m | {log.spo2_percent}%
                          </td>
                          <td style={{ padding: 6 }}>
                            <span style={{ color: log.stridor_at_rest ? '#dc2626' : '#16a34a', fontWeight: log.stridor_at_rest ? 700 : 400 }}>
                              {log.stridor_at_rest ? 'Present at Rest' : 'Absent at Rest'}
                            </span>
                          </td>
                          <td style={{ padding: 6 }}>{log.chest_retractions_severity.replace(/_/g, ' ')}</td>
                          <td style={{ padding: 6 }}>
                            <strong style={{ color: '#0369a1' }}>{log.intervention_given.replace(/_/g, ' ')}</strong>
                          </td>
                          <td style={{ padding: 6, maxWidth: 200 }}>{log.notes || '—'}</td>
                          <td style={{ padding: 6, textAlign: 'right' }}>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                              onClick={() => handleDeleteLog(log.id)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <PediatricCroupModal
          patientId={patientId}
          patientName={patientName}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <PediatricCroupFlowsheetModal
          episodeId={selectedEpisode.id}
          patientId={patientId}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => {
            setShowFlowsheetModal(false);
            loadDetail(selectedEpisode.id);
          }}
        />
      )}
    </div>
  );
};
