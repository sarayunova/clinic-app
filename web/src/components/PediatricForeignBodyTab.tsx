import React, { useState, useEffect } from 'react';
import {
  getPediatricForeignBodyEpisodes,
  getPediatricForeignBodyEpisode,
  updatePediatricForeignBodyEpisode,
  deletePediatricForeignBodyEpisode,
  deletePediatricForeignBodyFlowsheet,
  type PediatricForeignBodyRecord,
  type PediatricForeignBodyFlowsheetRecord,
} from '../api';
import { PediatricForeignBodyModal } from './PediatricForeignBodyModal';
import { PediatricForeignBodyFlowsheetModal } from './PediatricForeignBodyFlowsheetModal';

interface PediatricForeignBodyTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricForeignBodyTab: React.FC<PediatricForeignBodyTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<PediatricForeignBodyRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricForeignBodyRecord | null>(null);
  const [logs, setLogs] = useState<PediatricForeignBodyFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricForeignBodyEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load foreign body choking episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getPediatricForeignBodyEpisode(id);
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

  const handleStatusChange = async (newStatus: any) => {
    if (!selectedEpisode) return;
    try {
      await updatePediatricForeignBodyEpisode(selectedEpisode.id, { status: newStatus });
      loadDetail(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Are you sure you want to delete this foreign body choking episode?')) return;
    try {
      await deletePediatricForeignBodyEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deletePediatricForeignBodyFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && episodes.length === 0) {
    return <div style={{ padding: 20 }}>Loading foreign body records...</div>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      {error && <div className="banner error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, color: '#0369a1' }}>🥜 Pediatric Foreign Body Airway Obstruction & Choking</h3>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            AAP / PALS Guidelines: Age-Stratified Maneuvers (&lt;1y Back Slaps vs ≥1y Heimlich), Direct Laryngoscopy & Strict Avoidance of Blind Sweeps
          </span>
        </div>
        <button type="button" className="btn primary" onClick={() => setShowModal(true)}>
          + Record Choking Emergency
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
          No foreign body choking episodes recorded for {patientName}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* Sidebar Episode List */}
          <div className="card" style={{ padding: 10, alignSelf: 'start' }}>
            <h4 style={{ margin: '4px 0 8px 6px', fontSize: '0.85rem', color: '#475569' }}>Recorded Incidents</h4>
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
                    borderColor: selectedEpisode?.id === ep.id ? '#0284c7' : '#e2e8f0',
                    background: selectedEpisode?.id === ep.id ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0369a1' }}>{ep.episode_code}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(ep.incident_datetime).toLocaleDateString()} | {ep.suspected_foreign_body_nature.replace(/_/g, ' ')}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${ep.foreign_body_expelled ? 'success' : 'danger'}`} style={{ fontSize: '0.7rem' }}>
                      {ep.foreign_body_expelled ? 'Expelled' : 'Impaction Ongoing'}
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
                      Incident at {new Date(selectedEpisode.incident_datetime).toLocaleString()} | Attended by Dr. {selectedEpisode.consultant_name || 'Emergency Pediatrician'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value="acute_choking_management">Acute Choking Management Active</option>
                      <option value="post_clearance_observation">Post-Clearance Observation</option>
                      <option value="picu_escalation_bronchoscopy">PICU / Bronchoscopy Escalation</option>
                      <option value="discharged_home_stable">Discharged Home Stable</option>
                    </select>
                    <a
                      href={`/pediatric-foreign-body/${selectedEpisode.id}/print`}
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
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Obstruction Tier</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: selectedEpisode.obstruction_severity.includes('severe') ? '#dc2626' : '#0369a1' }}>
                      {selectedEpisode.obstruction_severity.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Object: {selectedEpisode.suspected_foreign_body_nature.replace(/_/g, ' ')}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Airway Clearance Status</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: selectedEpisode.foreign_body_expelled ? '#16a34a' : '#dc2626' }}>
                      {selectedEpisode.foreign_body_expelled ? 'EXPELLED / RESTORED' : 'ONGOING IMPACTION'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Spontaneous: {selectedEpisode.spontaneous_respiration_restored ? 'YES' : 'Pending'}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Triage Vitals</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      HR {selectedEpisode.heart_rate_bpm} | RR {selectedEpisode.respiratory_rate}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      SpO₂: {selectedEpisode.spo2_percent}% {selectedEpisode.cyanosis_present ? '(Cyanosis +)' : ''}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Blind Sweep Audit</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: selectedEpisode.blind_finger_sweep_avoided ? '#16a34a' : '#dc2626' }}>
                      {selectedEpisode.blind_finger_sweep_avoided ? 'STRICTLY AVOIDED' : 'VIOLATION REPORTED'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Bronchoscopy: {selectedEpisode.rigid_bronchoscopy_required ? 'Indicated' : 'Not required'}
                    </div>
                  </div>
                </div>

                {evalResult?.clinicalSafetyDirectives && (
                  <div style={{ marginTop: 12, background: '#f0f9ff', padding: 10, borderRadius: 6, border: '1px solid #bae6fd', fontSize: '0.85rem' }}>
                    <strong style={{ color: '#0369a1' }}>Safety & Resuscitation Directives:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {evalResult.clinicalSafetyDirectives.map((d: string, idx: number) => (
                        <li key={idx}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Flowsheet Log List */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>
                    Airway Resuscitation & Observation Flowsheet ({logs.length} entries)
                  </h4>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setShowFlowsheetModal(true)}
                  >
                    + Log Airway Checkpoint
                  </button>
                </div>

                {logs.length === 0 ? (
                  <p className="muted" style={{ margin: '8px 0', fontSize: '0.85rem' }}>
                    No airway observation checkpoints recorded yet.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                          <th style={{ padding: 6, textAlign: 'left' }}>Time / Delta</th>
                          <th style={{ padding: 6, textAlign: 'left' }}>Mental Status</th>
                          <th style={{ padding: 6, textAlign: 'left' }}>Airway Patency</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>HR / RR</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>SpO₂</th>
                          <th style={{ padding: 6, textAlign: 'left' }}>Intervention</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>Object Out?</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: 6 }}>
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+{log.minutes_from_choking}m)
                            </td>
                            <td style={{ padding: 6 }}>{log.mental_status.replace(/_/g, ' ')}</td>
                            <td style={{ padding: 6, fontWeight: 600 }}>{log.airway_patency.replace(/_/g, ' ')}</td>
                            <td style={{ padding: 6, textAlign: 'center' }}>{log.heart_rate_bpm} / {log.respiratory_rate}</td>
                            <td style={{ padding: 6, textAlign: 'center' }}>{log.spo2_percent}%</td>
                            <td style={{ padding: 6 }}>{log.intervention_cycle.replace(/_/g, ' ')}</td>
                            <td style={{ padding: 6, textAlign: 'center' }}>
                              <span className={`badge ${log.foreign_object_visualized_or_removed ? 'success' : 'neutral'}`}>
                                {log.foreign_object_visualized_or_removed ? 'YES' : 'No'}
                              </span>
                            </td>
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
        <PediatricForeignBodyModal
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
        <PediatricForeignBodyFlowsheetModal
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
