import React, { useState, useEffect } from 'react';
import {
  getNeonatalHypomagnesemiaEpisodes,
  getNeonatalHypomagnesemiaEpisode,
  updateNeonatalHypomagnesemiaEpisode,
  deleteNeonatalHypomagnesemiaEpisode,
  deleteNeonatalHypomagnesemiaFlowsheet,
  type NeonatalHypomagnesemiaRecord,
  type NeonatalHypomagnesemiaFlowsheetRecord,
} from '../api';
import { NeonatalHypomagnesemiaModal } from './NeonatalHypomagnesemiaModal';
import { NeonatalHypomagnesemiaFlowsheetModal } from './NeonatalHypomagnesemiaFlowsheetModal';

interface NeonatalHypomagnesemiaTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalHypomagnesemiaTab: React.FC<NeonatalHypomagnesemiaTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalHypomagnesemiaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalHypomagnesemiaRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalHypomagnesemiaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalHypomagnesemiaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load neonatal hypomagnesemia episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getNeonatalHypomagnesemiaEpisode(id);
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
      await updateNeonatalHypomagnesemiaEpisode(selectedEpisode.id, { status: newStatus });
      loadDetail(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Are you sure you want to delete this neonatal hypomagnesemia episode?')) return;
    try {
      await deleteNeonatalHypomagnesemiaEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteNeonatalHypomagnesemiaFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && episodes.length === 0) {
    return <div style={{ padding: 20 }}>Loading neonatal hypomagnesemia records...</div>;
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {error && <div className="alert error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, color: '#0284c7' }}>⚡ Neonatal Hypomagnesemia & Refractory Seizures Protocol</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            AAP / Nelson Pediatrics: Serum Mg &lt; 1.5 mg/dL, PTH-Refractory Hypocalcemia &amp; 50% MgSO4 Bolus / DTR Surveillance
          </p>
        </div>
        <button className="button primary" onClick={() => setShowModal(true)}>
          + Initiate Hypomagnesemia Protocol
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No hypomagnesemia episodes recorded for this neonate.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* Episode Selector List */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 13, textTransform: 'uppercase', color: '#64748b' }}>
              Episodes ({episodes.length})
            </h4>
            <div className="stack" style={{ gap: 8 }}>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => loadDetail(ep.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedEpisode?.id === ep.id ? '#e0f2fe' : '#f8fafc',
                    border: `1px solid ${selectedEpisode?.id === ep.id ? '#0284c7' : '#e2e8f0'}`,
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: 14 }}>{ep.episode_code}</div>
                  <div className="small muted">
                    {new Date(ep.onset_datetime).toLocaleDateString()} | Mg: {ep.serum_magnesium_mg_dl} mg/dL
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: ep.status === 'acute_resuscitation' ? '#fee2e2' : '#f1f5f9',
                        color: ep.status === 'acute_resuscitation' ? '#dc2626' : '#334155',
                        fontWeight: 'bold',
                      }}
                    >
                      {ep.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Episode Details & Flowsheet */}
          {selectedEpisode && (
            <div className="stack" style={{ gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18 }}>
                      Episode {selectedEpisode.episode_code}
                    </h3>
                    <div className="small muted">
                      Onset: {new Date(selectedEpisode.onset_datetime).toLocaleString()} | Attending: {selectedEpisode.consultant_name || 'Staff'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`/neonatal-hypomagnesemia/${selectedEpisode.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="button small secondary"
                    >
                      🖨️ Print Dossier
                    </a>
                    <button className="button small primary" onClick={() => setShowFlowsheetModal(true)}>
                      + Add Flowsheet Log
                    </button>
                    <button className="button small text-danger" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Serum Magnesium</div>
                    <div style={{ fontSize: 22, fontWeight: 'bold', color: selectedEpisode.serum_magnesium_mg_dl < 1.2 ? '#dc2626' : '#0284c7' }}>
                      {selectedEpisode.serum_magnesium_mg_dl} mg/dL
                    </div>
                    <div className="small muted">Cutoff: &lt; 1.5 mg/dL</div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">50% MgSO4 Bolus</div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#16a34a' }}>
                      {selectedEpisode.magnesium_sulfate_bolus_ml} mL
                    </div>
                    <div className="small muted">
                      {selectedEpisode.administration_route.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Calcium / Refractoriness</div>
                    <div style={{ fontSize: 15, fontWeight: 'bold' }}>
                      {selectedEpisode.calcium_refractory_tetany ? (
                        <span style={{ color: '#dc2626' }}>⚠️ Refractory Tetany</span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>Controlled</span>
                      )}
                    </div>
                    <div className="small muted">
                      iCa: {selectedEpisode.ionized_calcium_mmol_l ? `${selectedEpisode.ionized_calcium_mmol_l} mmol/L` : 'Not drawn'}
                    </div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Clinical Status</div>
                    <select
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      style={{ fontSize: 13, marginTop: 4, width: '100%' }}
                    >
                      <option value="acute_resuscitation">Acute Resuscitation</option>
                      <option value="maintenance_infusion">Maintenance Infusion</option>
                      <option value="monitoring_stabilized">Monitoring & Stabilized</option>
                      <option value="resolved_eumagnesemic">Resolved Eumagnesemic</option>
                    </select>
                  </div>
                </div>

                {/* Algorithmic Clinical Guidance */}
                {evalResult && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                    <div style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: 4 }}>
                      AAP / Nelson Clinical Action Directives:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.5 }}>
                      {evalResult.criticalActionPlan.map((act: string, idx: number) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedEpisode.clinical_notes && (
                  <div className="small" style={{ fontStyle: 'italic', marginBottom: 16 }}>
                    Notes: {selectedEpisode.clinical_notes}
                  </div>
                )}

                {/* Flowsheet Table */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>
                    Serial Serum Mg, DTR & Toxicity Surveillance Logs ({logs.length})
                  </h4>
                  {logs.length === 0 ? (
                    <div className="muted small">No serial flowsheet logs recorded yet.</div>
                  ) : (
                    <table className="table" style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Hours</th>
                          <th>Serum Mg</th>
                          <th>Ionized Ca</th>
                          <th>HR / RR</th>
                          <th>DTR Reflexes</th>
                          <th>ECG Rhythm</th>
                          <th>Rate (mL/h)</th>
                          <th>Seizure?</th>
                          <th>Logged By</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((lg) => (
                          <tr key={lg.id}>
                            <td>{new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>+{lg.hours_from_onset}h</td>
                            <td style={{ fontWeight: 'bold' }}>{lg.serum_magnesium_mg_dl ?? '-'}</td>
                            <td>{lg.ionized_calcium_mmol_l ?? '-'}</td>
                            <td>{lg.heart_rate_bpm} / {lg.respiratory_rate}</td>
                            <td>
                              <span
                                style={{
                                  color: lg.deep_tendon_reflexes === 'absent_areflexia_toxicity' ? '#dc2626' : '#111827',
                                  fontWeight: lg.deep_tendon_reflexes === 'absent_areflexia_toxicity' ? 'bold' : 'normal',
                                }}
                              >
                                {lg.deep_tendon_reflexes.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>{lg.ecg_rhythm_strip.replace(/_/g, ' ')}</td>
                            <td>{lg.magnesium_infusion_rate_ml_hr}</td>
                            <td>{lg.seizure_activity_present ? <span style={{ color: '#dc2626', fontWeight: 'bold' }}>YES</span> : 'No'}</td>
                            <td>{lg.logged_by_name || 'Staff'}</td>
                            <td>
                              <button
                                className="button small text-danger"
                                style={{ padding: '2px 6px' }}
                                onClick={() => handleDeleteLog(lg.id)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <NeonatalHypomagnesemiaModal
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
        <NeonatalHypomagnesemiaFlowsheetModal
          episodeId={selectedEpisode.id}
          patientName={patientName}
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
