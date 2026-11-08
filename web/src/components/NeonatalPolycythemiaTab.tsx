import React, { useState, useEffect } from 'react';
import {
  getNeonatalPolycythemiaEpisodes,
  getNeonatalPolycythemiaEpisode,
  updateNeonatalPolycythemiaEpisode,
  deleteNeonatalPolycythemiaEpisode,
  deleteNeonatalPolycythemiaFlowsheet,
  type NeonatalPolycythemiaRecord,
  type NeonatalPolycythemiaFlowsheetRecord,
} from '../api';
import { NeonatalPolycythemiaModal } from './NeonatalPolycythemiaModal';
import { NeonatalPolycythemiaFlowsheetModal } from './NeonatalPolycythemiaFlowsheetModal';

interface NeonatalPolycythemiaTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalPolycythemiaTab: React.FC<NeonatalPolycythemiaTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalPolycythemiaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalPolycythemiaRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalPolycythemiaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalPolycythemiaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load neonatal polycythemia episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getNeonatalPolycythemiaEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      await updateNeonatalPolycythemiaEpisode(selectedEpisode.id, { status: newStatus });
      loadDetail(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Are you sure you want to delete this polycythemia episode?')) return;
    try {
      await deleteNeonatalPolycythemiaEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteNeonatalPolycythemiaFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && episodes.length === 0) {
    return <div style={{ padding: 20 }}>Loading neonatal polycythemia records...</div>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      {error && <div className="banner error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, color: '#991b1b' }}>🩺 Neonatal Polycythemia & Partial Exchange Transfusion (PET)</h3>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Diagnostic Cutoff: Venous Hct ≥ 65% | Target: 55% with Normal Saline
          </span>
        </div>
        <button type="button" className="btn primary" onClick={() => setShowModal(true)}>
          + New Polycythemia Evaluation
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
          No neonatal polycythemia episodes recorded for {patientName}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* Sidebar Episode List */}
          <div className="card" style={{ padding: 10, alignSelf: 'start' }}>
            <h4 style={{ margin: '4px 0 8px 6px', fontSize: '0.85rem', color: '#475569' }}>Recorded Episodes</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => loadDetail(ep.id)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: selectedEpisode?.id === ep.id ? '#991b1b' : '#e2e8f0',
                    background: selectedEpisode?.id === ep.id ? '#fef2f2' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#991b1b' }}>{ep.episode_code}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(ep.diagnosis_datetime).toLocaleDateString()} | Venous Hct: {ep.venous_hematocrit_pct}%
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${ep.partial_exchange_indicated ? 'danger' : 'success'}`} style={{ fontSize: '0.7rem' }}>
                      {ep.partial_exchange_indicated ? `PET ${ep.exchange_volume_ml} mL` : 'Hydration'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Episode Detail View */}
          {selectedEpisode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Header Banner */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                      Episode {selectedEpisode.episode_code}
                    </h4>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      Diagnosed {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()} by Dr. {selectedEpisode.consultant_name || 'Pediatrician'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value="hydration_surveillance">Hydration & Close Surveillance</option>
                      <option value="pet_procedure_in_progress">PET Procedure Active</option>
                      <option value="post_pet_observation">Post-PET Recovery Observation</option>
                      <option value="eupolycythemic_resolved">Eupolycythemic / Resolved</option>
                    </select>
                    <a
                      href={`/neonatal-polycythemia/${selectedEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn secondary small"
                    >
                      🖨️ Print
                    </a>
                    <button type="button" className="btn danger small" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Synthesis Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Venous Hematocrit</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: selectedEpisode.venous_hematocrit_pct >= 65 ? '#dc2626' : '#16a34a' }}>
                      {selectedEpisode.venous_hematocrit_pct}%
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Site: {selectedEpisode.sampling_site.replace(/_/g, ' ')}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>PET Volume Required</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: selectedEpisode.partial_exchange_indicated ? '#b91c1c' : '#047857' }}>
                      {selectedEpisode.exchange_volume_ml} mL
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Target Hct {selectedEpisode.target_hematocrit_pct}%</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Aliquots (~5 mL/kg)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                      ~{selectedEpisode.aliquot_size_ml} mL
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Fluid: 0.9% Normal Saline</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Symptom Profile</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: selectedEpisode.symptoms_present ? '#dc2626' : '#16a34a' }}>
                      {selectedEpisode.symptoms_present ? selectedEpisode.symptom_details.replace(/_/g, ' ') : 'Asymptomatic'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Glucose: {selectedEpisode.serum_glucose_mg_dl ? `${selectedEpisode.serum_glucose_mg_dl} mg/dL` : 'N/A'}
                    </div>
                  </div>
                </div>

                {evalResult?.clinicalActionPlan && (
                  <div style={{ marginTop: 12, background: '#f0fdf4', padding: 10, borderRadius: 6, border: '1px solid #bbf7d0', fontSize: '0.85rem' }}>
                    <strong style={{ color: '#166534' }}>Clinical Action Directive:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {evalResult.criticalActionPlan.map((step: string, idx: number) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Flowsheet Log List */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>
                    PET Aliquot & Procedural Flowsheet ({logs.length} entries)
                  </h4>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setShowFlowsheetModal(true)}
                  >
                    + Record Aliquot / Vital Check
                  </button>
                </div>

                {logs.length === 0 ? (
                  <p className="muted" style={{ margin: '8px 0', fontSize: '0.85rem' }}>
                    No procedural aliquots logged yet.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                          <th style={{ padding: 6, textAlign: 'left' }}>Time / Delta</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>Aliquot #</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Withdrawn</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Infused</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Cumulative</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>Hct (%)</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>HR / RR</th>
                          <th style={{ padding: 6, textAlign: 'left' }}>Complications</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: 6 }}>
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+{log.hours_from_triage}h)
                            </td>
                            <td style={{ padding: 6, textAlign: 'center', fontWeight: 600 }}>#{log.aliquot_number}</td>
                            <td style={{ padding: 6, textAlign: 'right' }}>{log.volume_withdrawn_ml} mL</td>
                            <td style={{ padding: 6, textAlign: 'right' }}>{log.volume_infused_ml} mL</td>
                            <td style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>{log.cumulative_exchanged_ml} mL</td>
                            <td style={{ padding: 6, textAlign: 'center' }}>{log.current_hematocrit_pct ? `${log.current_hematocrit_pct}%` : '-'}</td>
                            <td style={{ padding: 6, textAlign: 'center' }}>{log.heart_rate_bpm} / {log.respiratory_rate}</td>
                            <td style={{ padding: 6 }}>{log.adverse_events_observed.replace(/_/g, ' ')}</td>
                            <td style={{ padding: 6, textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn danger small"
                                style={{ padding: '2px 6px', fontSize: '0.7rem' }}
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
          )}
        </div>
      )}

      {showModal && (
        <NeonatalPolycythemiaModal
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
        <NeonatalPolycythemiaFlowsheetModal
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
