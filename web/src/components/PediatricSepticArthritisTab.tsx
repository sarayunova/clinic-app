import React, { useState, useEffect } from 'react';
import {
  getPediatricSepticArthritisEpisodes,
  getPediatricSepticArthritisEpisode,
  updatePediatricSepticArthritisEpisode,
  deletePediatricSepticArthritisEpisode,
  deletePediatricSepticArthritisFlowsheet,
  type PediatricSepticArthritisRecord,
  type PediatricSepticArthritisFlowsheetRecord,
} from '../api';
import { PediatricSepticArthritisModal } from './PediatricSepticArthritisModal';
import { PediatricSepticArthritisFlowsheetModal } from './PediatricSepticArthritisFlowsheetModal';

interface PediatricSepticArthritisTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricSepticArthritisTab: React.FC<PediatricSepticArthritisTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<PediatricSepticArthritisRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricSepticArthritisRecord | null>(null);
  const [logs, setLogs] = useState<PediatricSepticArthritisFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricSepticArthritisEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric septic arthritis episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getPediatricSepticArthritisEpisode(id);
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
      await updatePediatricSepticArthritisEpisode(selectedEpisode.id, { status: newStatus });
      loadDetail(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Are you sure you want to delete this septic arthritis episode?')) return;
    try {
      await deletePediatricSepticArthritisEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deletePediatricSepticArthritisFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && episodes.length === 0) {
    return <div style={{ padding: 20 }}>Loading pediatric septic arthritis records...</div>;
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {error && <div className="alert error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, color: '#b91c1c' }}>🦴 Pediatric Septic Arthritis &amp; Kocher Criteria Protocol</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Kocher MS et al. (JBJS): Non-Weight Bearing, Fever &gt; 38.5°C, ESR ≥ 40 mm/hr, WBC &gt; 12k &amp; Emergent Arthrotomy Decompression
          </p>
        </div>
        <button className="button primary" onClick={() => setShowModal(true)}>
          + Evaluate Septic Arthritis
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No septic arthritis episodes recorded for this pediatric patient.
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
                    background: selectedEpisode?.id === ep.id ? '#fee2e2' : '#f8fafc',
                    border: `1px solid ${selectedEpisode?.id === ep.id ? '#b91c1c' : '#e2e8f0'}`,
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: 14 }}>{ep.episode_code}</div>
                  <div className="small muted">
                    {new Date(ep.evaluation_datetime).toLocaleDateString()} | {ep.affected_joint.replace(/_/g, ' ')}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: ep.kocher_criteria_met_count >= 3 ? '#fee2e2' : '#f1f5f9',
                        color: ep.kocher_criteria_met_count >= 3 ? '#dc2626' : '#334155',
                        fontWeight: 'bold',
                      }}
                    >
                      Kocher: {ep.kocher_criteria_met_count}/4 ({ep.predicted_probability_percent}%)
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
                      Episode {selectedEpisode.episode_code} ({selectedEpisode.affected_joint.replace(/_/g, ' ').toUpperCase()})
                    </h3>
                    <div className="small muted">
                      Evaluated: {new Date(selectedEpisode.evaluation_datetime).toLocaleString()} | Attending: {selectedEpisode.consultant_name || 'Staff'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`/pediatric-septic-arthritis/${selectedEpisode.id}/print`}
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
                    <div className="small muted">Kocher Score</div>
                    <div style={{ fontSize: 22, fontWeight: 'bold', color: selectedEpisode.kocher_criteria_met_count >= 3 ? '#dc2626' : '#16a34a' }}>
                      {selectedEpisode.kocher_criteria_met_count} / 4
                    </div>
                    <div className="small muted">Risk: {selectedEpisode.predicted_probability_percent}%</div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Infection Markers</div>
                    <div style={{ fontSize: 15, fontWeight: 'bold' }}>
                      ESR: {selectedEpisode.esr_mm_hr} | WBC: {selectedEpisode.wbc_count_per_microliter}
                    </div>
                    <div className="small muted">
                      Temp: {selectedEpisode.temperature_celsius}°C {selectedEpisode.crp_mg_l ? `| CRP ${selectedEpisode.crp_mg_l}` : ''}
                    </div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Synovial Fluid / US</div>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>
                      {selectedEpisode.ultrasound_effusion_detected ? (
                        <span style={{ color: '#dc2626' }}>✓ Effusion (+)</span>
                      ) : (
                        'No Effusion'
                      )}
                    </div>
                    <div className="small muted" style={{ fontSize: 11 }}>
                      {selectedEpisode.synovial_wbc_count ? `${selectedEpisode.synovial_wbc_count} WBC/μL` : 'Tap Pending'}
                    </div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Clinical Status</div>
                    <select
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      style={{ fontSize: 13, marginTop: 4, width: '100%' }}
                    >
                      <option value="evaluation_pending">Evaluation Pending</option>
                      <option value="operating_room_arthrotomy">Operating Room / Arthrotomy</option>
                      <option value="postoperative_iv_antibiotics">Postoperative IV Antibiotics</option>
                      <option value="transient_synovitis_observed">Transient Synovitis Observed</option>
                      <option value="infection_resolved_discharged">Infection Resolved &amp; Discharged</option>
                    </select>
                  </div>
                </div>

                {/* Kocher Protocol Directives */}
                {evalResult && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                    <div style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: 4 }}>
                      Pediatric Orthopedic Emergency Guidance:
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
                    Serial Joint Examination, ROM &amp; Drain Surveillance ({logs.length})
                  </h4>
                  {logs.length === 0 ? (
                    <div className="muted small">No serial flowsheet logs recorded yet.</div>
                  ) : (
                    <table className="table" style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Hours</th>
                          <th>Temp</th>
                          <th>HR</th>
                          <th>CRP</th>
                          <th>Joint Range of Motion</th>
                          <th>Weight-Bearing</th>
                          <th>Drain (mL)</th>
                          <th>Logged By</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((lg) => (
                          <tr key={lg.id}>
                            <td>{new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>+{lg.hours_from_triage}h</td>
                            <td>{lg.temperature_celsius}°C</td>
                            <td>{lg.heart_rate_bpm}</td>
                            <td>{lg.crp_mg_l ?? '-'}</td>
                            <td>{lg.joint_range_of_motion.replace(/_/g, ' ')}</td>
                            <td>{lg.weight_bearing_ability.replace(/_/g, ' ')}</td>
                            <td>{lg.drain_output_ml_24h}</td>
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
        <PediatricSepticArthritisModal
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
        <PediatricSepticArthritisFlowsheetModal
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
