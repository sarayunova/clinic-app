import React, { useState, useEffect } from 'react';
import {
  getPediatricPolytraumaEpisodes,
  getPediatricPolytraumaEpisode,
  updatePediatricPolytraumaEpisode,
  deletePediatricPolytraumaEpisode,
  deletePediatricPolytraumaFlowsheet,
  type PediatricPolytraumaRecord,
  type PediatricPolytraumaFlowsheetRecord,
} from '../api';
import { PediatricPolytraumaModal } from './PediatricPolytraumaModal';
import { PediatricPolytraumaFlowsheetModal } from './PediatricPolytraumaFlowsheetModal';

interface PediatricPolytraumaTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricPolytraumaTab: React.FC<PediatricPolytraumaTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<PediatricPolytraumaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricPolytraumaRecord | null>(null);
  const [logs, setLogs] = useState<PediatricPolytraumaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricPolytraumaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load polytrauma resuscitation episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getPediatricPolytraumaEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult((res as any).evalResult);
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
      const res = await updatePediatricPolytraumaEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this pediatric polytrauma episode record?')) return;
    try {
      await deletePediatricPolytraumaEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log entry?')) return;
    try {
      await deletePediatricPolytraumaFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'critical_high_mortality_le_8':
        return <span className="badge badge-danger">CRITICAL (PTS ≤ 8)</span>;
      case 'moderate_potential_lethal_9_10':
        return <span className="badge badge-warning">MODERATE (PTS 9-10)</span>;
      default:
        return <span className="badge badge-success">MINOR (PTS 11-12)</span>;
    }
  };

  return (
    <div className="pediatric-polytrauma-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: 0 }}>🚨 Pediatric Polytrauma Resuscitation & Trauma Score (PTS)</h4>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            ATLS 10th Ed / ACS-COT Pediatric Trauma: PTS Scoring (-6 to +12), MTP & TXA Resuscitation
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Trauma Activation
          </button>
          {selectedEpisode && (
            <a
              href={`/pediatric-polytrauma/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-secondary"
            >
              🖨️ Print Trauma Dossier
            </a>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div>Loading polytrauma resuscitation records...</div>
      ) : episodes.length === 0 ? (
        <div className="empty-state" style={{ padding: 24, textAlign: 'center', background: '#fafafa', borderRadius: 8 }}>
          <p>No pediatric polytrauma resuscitation episodes on file for this patient.</p>
          <button className="btn btn-outline-primary" onClick={() => setShowModal(true)}>
            Initiate Trauma Evaluation
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 16 }}>
          {/* Episode List */}
          <div style={{ borderRight: '1px solid #eee', paddingRight: 12 }}>
            <h5 style={{ fontSize: '0.9rem', color: '#777', textTransform: 'uppercase' }}>Trauma Activations</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => loadDetail(ep.id)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedEpisode?.id === ep.id ? '#fee2e2' : '#fff',
                    border: `1px solid ${selectedEpisode?.id === ep.id ? '#ef4444' : '#ddd'}`,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ep.episode_code}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    Wt: {ep.weight_kg} kg | Age: {ep.age_months}m
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: ep.total_pts_score <= 8 ? '#dc2626' : '#059669' }}>
                      PTS: {ep.total_pts_score > 0 ? `+${ep.total_pts_score}` : ep.total_pts_score}
                    </span>
                    {getTierBadge(ep.pts_mortality_tier)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Episode Details */}
          {selectedEpisode && (
            <div>
              <div style={{ background: '#f8f9fa', padding: 14, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>
                    {selectedEpisode.episode_code}
                    <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#666', marginLeft: 8 }}>
                      Occurred on {new Date(selectedEpisode.trauma_datetime).toLocaleString()}
                    </span>
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="form-control"
                      style={{ width: 'auto' }}
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value="acute_trauma_bay">Acute Trauma Bay</option>
                      <option value="emergent_or_surgery">Emergent OR / Surgery</option>
                      <option value="picu_damage_control">PICU Damage Control</option>
                      <option value="stepdown_ward">Stepdown Ward</option>
                      <option value="convalescent">Convalescent</option>
                    </select>
                    <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Pediatric Trauma Score</span>
                    <div style={{ fontWeight: 700, fontSize: '1.25rem', color: selectedEpisode.total_pts_score <= 8 ? '#dc2626' : '#059669' }}>
                      {selectedEpisode.total_pts_score > 0 ? `+${selectedEpisode.total_pts_score}` : selectedEpisode.total_pts_score} / 12
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Mechanism</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {selectedEpisode.trauma_mechanism.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Weight / Age</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                      {selectedEpisode.weight_kg} kg ({selectedEpisode.age_months}m)
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>FAST / Pelvic</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      FAST: {selectedEpisode.fast_exam_positive ? '⚠️ POSITIVE' : 'Negative'} | Binder: {selectedEpisode.pelvic_binder_placed ? 'YES' : 'NO'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>MTP / TXA</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      MTP: {selectedEpisode.pediatric_mtp_activated ? '🚨 ACTIVE' : 'NO'} | TXA: {selectedEpisode.txa_administered ? `${selectedEpisode.txa_dose_mg || 0}mg` : 'NO'}
                    </div>
                  </div>
                </div>

                {/* Score breakdown card */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 10, background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.8rem' }}>
                  <div><strong>Weight:</strong> {selectedEpisode.weight_score > 0 ? `+${selectedEpisode.weight_score}` : selectedEpisode.weight_score}</div>
                  <div><strong>Airway:</strong> {selectedEpisode.airway_score > 0 ? `+${selectedEpisode.airway_score}` : selectedEpisode.airway_score}</div>
                  <div><strong>SBP:</strong> {selectedEpisode.systolic_bp_score > 0 ? `+${selectedEpisode.systolic_bp_score}` : selectedEpisode.systolic_bp_score}</div>
                  <div><strong>CNS:</strong> {selectedEpisode.cns_score > 0 ? `+${selectedEpisode.cns_score}` : selectedEpisode.cns_score}</div>
                  <div><strong>Skeletal:</strong> {selectedEpisode.skeletal_score > 0 ? `+${selectedEpisode.skeletal_score}` : selectedEpisode.skeletal_score}</div>
                  <div><strong>Cutaneous:</strong> {selectedEpisode.cutaneous_score > 0 ? `+${selectedEpisode.cutaneous_score}` : selectedEpisode.cutaneous_score}</div>
                </div>

                {evalResult && (
                  <div style={{ marginTop: 14, background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: '#b91c1c' }}>{evalResult.tierLabel} ({evalResult.mortalityEstimate})</strong>
                      {evalResult.traumaCenterLevel1Mandatory && (
                        <span className="badge badge-danger">MANDATORY LEVEL 1 PEDIATRIC TRAUMA CENTER</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '8px 0', fontSize: '0.85rem', background: '#f8fafc', padding: 8, borderRadius: 4 }}>
                      <div><strong>Initial Bolus (20 mL/kg):</strong> {evalResult.initialCrystalloidBolusMl} mL Plasmalyte/NS</div>
                      <div><strong>MTP 1:1:1 Bolus (10 mL/kg):</strong> {evalResult.pediatricMtpBolusPrbcMl} mL PRBC / {evalResult.pediatricMtpBolusFfpMl} mL FFP / {evalResult.pediatricMtpBolusPlateletsMl} mL Plt</div>
                      <div><strong>TXA Resuscitation:</strong> Load {evalResult.txaLoadingDoseMg} mg + {evalResult.txaMaintenanceDoseMgHr} mg/hr</div>
                    </div>
                    <div className="alert alert-warning" style={{ margin: 0, padding: 6, fontSize: '0.82rem' }}>
                      {evalResult.hypothermiaPreventionAlert}
                    </div>
                  </div>
                )}
              </div>

              {/* Flowsheet Table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h5 style={{ margin: 0 }}>Bedside Trauma Resuscitation Flowsheet</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFlowsheetModal(true)}>
                  + Log Vital / Fluid Checkpoint
                </button>
              </div>

              {logs.length === 0 ? (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
                  No vital signs or resuscitation checkpoints logged yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-sm table-bordered" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th>Time (+min)</th>
                        <th>GCS</th>
                        <th>BP (SBP/DBP)</th>
                        <th>HR</th>
                        <th>RR</th>
                        <th>SpO2</th>
                        <th>Temp (°C)</th>
                        <th>Crystalloid (mL)</th>
                        <th>PRBC (mL)</th>
                        <th>FFP (mL)</th>
                        <th>Plt (mL)</th>
                        <th>Pupils</th>
                        <th>Logged By</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <strong>+{log.minutes_from_arrival}m</strong>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, color: log.gcs_total <= 8 ? '#dc2626' : 'inherit' }}>
                            {log.gcs_total}
                          </td>
                          <td>
                            {log.sbp_mmhg} / {log.dbp_mmhg ?? '-'}
                          </td>
                          <td>{log.heart_rate_bpm}</td>
                          <td>{log.respiratory_rate}</td>
                          <td>{log.spo2_percent}%</td>
                          <td style={{ color: log.temperature_celsius < 36 ? '#dc2626' : 'inherit' }}>
                            {log.temperature_celsius}°C
                          </td>
                          <td>{log.cumulative_crystalloid_ml}</td>
                          <td>{log.cumulative_prbc_ml}</td>
                          <td>{log.cumulative_ffp_ml}</td>
                          <td>{log.cumulative_platelets_ml}</td>
                          <td>
                            <span className={`badge ${log.pupil_status === 'equal_reactive' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                              {log.pupil_status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>{log.logged_by_name || 'Staff'}</td>
                          <td>
                            <button
                              className="btn btn-xs btn-outline-danger"
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
          )}
        </div>
      )}

      {showModal && (
        <PediatricPolytraumaModal
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
        <PediatricPolytraumaFlowsheetModal
          episodeId={selectedEpisode.id}
          initialWeightKg={selectedEpisode.weight_kg}
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
