import React, { useState, useEffect } from 'react';
import {
  getObstetricShoulderDystociaEpisodes,
  getObstetricShoulderDystociaEpisode,
  updateObstetricShoulderDystociaEpisode,
  deleteObstetricShoulderDystociaEpisode,
  deleteObstetricShoulderDystociaFlowsheet,
  type ObstetricShoulderDystociaRecord,
  type ObstetricShoulderDystociaFlowsheetRecord,
} from '../api';
import { ObstetricShoulderDystociaModal } from './ObstetricShoulderDystociaModal';
import { ObstetricShoulderDystociaFlowsheetModal } from './ObstetricShoulderDystociaFlowsheetModal';

interface ObstetricShoulderDystociaTabProps {
  patientId: number;
  patientName: string;
}

export const ObstetricShoulderDystociaTab: React.FC<ObstetricShoulderDystociaTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricShoulderDystociaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricShoulderDystociaRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricShoulderDystociaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricShoulderDystociaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load shoulder dystocia episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getObstetricShoulderDystociaEpisode(id);
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
      await updateObstetricShoulderDystociaEpisode(selectedEpisode.id, { status: newStatus });
      loadDetail(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Are you sure you want to delete this shoulder dystocia episode?')) return;
    try {
      await deleteObstetricShoulderDystociaEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteObstetricShoulderDystociaFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && episodes.length === 0) {
    return <div style={{ padding: 20 }}>Loading shoulder dystocia records...</div>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      {error && <div className="banner error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, color: '#b91c1c' }}>🚨 Obstetric Shoulder Dystocia & HELPERR Emergency Protocol</h3>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            RCOG / ACOG Guidelines: Head-to-Body Interval Auditing, HELPERR Maneuvers & Avoidance of Fundal Pressure
          </span>
        </div>
        <button type="button" className="btn primary" onClick={() => setShowModal(true)}>
          + Record Shoulder Dystocia
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
          No shoulder dystocia episodes recorded for {patientName}.
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
                    borderColor: selectedEpisode?.id === ep.id ? '#b91c1c' : '#e2e8f0',
                    background: selectedEpisode?.id === ep.id ? '#fef2f2' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#b91c1c' }}>{ep.episode_code}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(ep.delivery_datetime).toLocaleDateString()} | Interval: {ep.head_to_body_interval_seconds}s
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${ep.head_to_body_interval_seconds > 300 ? 'danger' : 'warning'}`} style={{ fontSize: '0.7rem' }}>
                      {ep.head_to_body_interval_seconds}s interval
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
                      Delivered {new Date(selectedEpisode.delivery_datetime).toLocaleString()} by Dr. {selectedEpisode.consultant_name || 'Obstetrician'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value="resuscitation_active">Resuscitation & Active Assessment</option>
                      <option value="postpartum_hie_monitoring">Postpartum HIE & Nursery Monitoring</option>
                      <option value="transferred_to_nicu">Transferred to NICU</option>
                      <option value="discharged_stable">Discharged Home Stable</option>
                    </select>
                    <a
                      href={`/obstetric-shoulder-dystocia/${selectedEpisode.id}/print`}
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
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Head-to-Body Time</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: selectedEpisode.head_to_body_interval_seconds > 180 ? '#dc2626' : '#b45309' }}>
                      {selectedEpisode.head_to_body_interval_seconds} sec
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {selectedEpisode.head_to_body_interval_seconds > 300 ? 'Critical Anoxia' : selectedEpisode.head_to_body_interval_seconds >= 60 ? 'Prolonged Dystocia' : 'Normal'}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Birth Weight & GDM</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selectedEpisode.actual_birth_weight_grams} g</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {selectedEpisode.gestational_diabetes ? 'GDM Positive (+)' : 'No GDM'}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Apgar & Cord pH</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {selectedEpisode.apgar_1min ?? '-'}/{selectedEpisode.apgar_5min ?? '-'} | pH {selectedEpisode.umbilical_arterial_ph ?? 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Injury: {selectedEpisode.neonatal_injury.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Fundal Pressure Safety</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: selectedEpisode.fundal_pressure_avoided ? '#16a34a' : '#dc2626' }}>
                      {selectedEpisode.fundal_pressure_avoided ? 'STRICTLY AVOIDED' : 'VIOLATION REPORTED'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Perineum: {selectedEpisode.perineal_tear_degree.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {evalResult?.maneuverSequenceAudit && (
                  <div style={{ marginTop: 12, background: '#fffbeb', padding: 10, borderRadius: 6, border: '1px solid #fde68a', fontSize: '0.85rem' }}>
                    <strong style={{ color: '#b45309' }}>HELPERR Maneuver Audit Trail:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {evalResult.maneuverSequenceAudit.map((m: string, idx: number) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Flowsheet Log List */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>
                    Maneuver Timestamp Flowsheet ({logs.length} entries)
                  </h4>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setShowFlowsheetModal(true)}
                  >
                    + Log Maneuver Step
                  </button>
                </div>

                {logs.length === 0 ? (
                  <p className="muted" style={{ margin: '8px 0', fontSize: '0.85rem' }}>
                    No maneuver timestamps recorded yet.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                          <th style={{ padding: 6, textAlign: 'left' }}>Time / Delta</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>Elapsed (s)</th>
                          <th style={{ padding: 6, textAlign: 'left' }}>Maneuver Executed</th>
                          <th style={{ padding: 6, textAlign: 'center' }}>Outcome</th>
                          <th style={{ padding: 6, textAlign: 'left' }}>Traction</th>
                          <th style={{ padding: 6, textAlign: 'left' }}>Notes</th>
                          <th style={{ padding: 6, textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: 6 }}>
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ padding: 6, textAlign: 'center', fontWeight: 700, color: log.seconds_from_head_delivery > 180 ? '#dc2626' : '#0f172a' }}>
                              +{log.seconds_from_head_delivery}s
                            </td>
                            <td style={{ padding: 6, fontWeight: 600 }}>{log.maneuver_attempted.replace(/_/g, ' ')}</td>
                            <td style={{ padding: 6, textAlign: 'center' }}>
                              <span className={`badge ${log.maneuver_outcome === 'successful_restitution_and_delivery' ? 'success' : 'warning'}`}>
                                {log.maneuver_outcome.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: 6 }}>{log.traction_applied.replace(/_/g, ' ')}</td>
                            <td style={{ padding: 6 }}>{log.notes || '-'}</td>
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
        <ObstetricShoulderDystociaModal
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
        <ObstetricShoulderDystociaFlowsheetModal
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
