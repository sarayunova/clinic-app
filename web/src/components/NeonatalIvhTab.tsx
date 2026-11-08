import React, { useState, useEffect } from 'react';
import {
  getNeonatalIvhEpisodes,
  getNeonatalIvhEpisode,
  updateNeonatalIvhEpisode,
  deleteNeonatalIvhEpisode,
  deleteNeonatalIvhFlowsheet,
  type NeonatalIvhRecord,
  type NeonatalIvhFlowsheetRecord,
} from '../api';
import { NeonatalIvhModal } from './NeonatalIvhModal';
import { NeonatalIvhFlowsheetModal } from './NeonatalIvhFlowsheetModal';

interface NeonatalIvhTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalIvhTab: React.FC<NeonatalIvhTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalIvhRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalIvhRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalIvhFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalIvhEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load IVH episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getNeonatalIvhEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load IVH episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const res = await updateNeonatalIvhEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this neonatal IVH episode record?')) return;
    try {
      await deleteNeonatalIvhEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalIvhFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="neonatal-ivh-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: '#1e3a8a' }}>🧠 Neonatal IVH & Levene PHH Surveillance</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            Papile Cranial Ultrasound Staging, Levene Ventricular Index Curve & Hydrocephalus Decompression
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Record Cranial Ultrasound
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && <p className="muted">Loading neonatal IVH surveillance data...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', background: '#f8fafc' }}>
          <p className="muted" style={{ margin: 0 }}>
            No cranial ultrasound or post-hemorrhagic hydrocephalus evaluations recorded for this infant.
          </p>
        </div>
      )}

      {episodes.length > 0 && selectedEpisode && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Episode List Sidebar */}
          <div className="card" style={{ padding: 12 }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b' }}>
              Ultrasound Evaluations
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
                  <span style={{ fontSize: '0.75rem' }}>{new Date(ep.scan_datetime).toLocaleDateString()}</span>
                  <span style={{ fontSize: '0.75rem', color: ep.phh_intervention_threshold_crossed ? '#dc2626' : 'inherit' }}>
                    {ep.papile_grade.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Episode Details */}
          <div className="stack" style={{ gap: 16 }}>
            {/* Main Assessment Card */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#1e3a8a' }}>
                    {selectedEpisode.papile_grade.replace(/_/g, ' ').toUpperCase()} ({selectedEpisode.hemorrhage_laterality.replace(/_/g, ' ')})
                  </h4>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Scanned: {new Date(selectedEpisode.scan_datetime).toLocaleString()} | PMA: {selectedEpisode.current_pma_weeks}w | Day {selectedEpisode.chronological_age_days}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-control"
                    style={{ width: 'auto', fontSize: '0.85rem' }}
                    value={selectedEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="ultrasound_surveillance_active">Surveillance Active</option>
                    <option value="phh_active_decompression">Active Decompression</option>
                    <option value="post_surgical_shunt_monitoring">Post-Surgical Shunt</option>
                    <option value="stable_arrested_hydrocephalus">Arrested Hydrocephalus</option>
                    <option value="resolved_quiescent">Resolved</option>
                  </select>
                  <a
                    href={`/neonatal-ivh/${selectedEpisode.id}/print`}
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
                  background: selectedEpisode.phh_intervention_threshold_crossed ? '#fef2f2' : '#eff6ff',
                  borderLeft: `4px solid ${selectedEpisode.phh_intervention_threshold_crossed ? '#ef4444' : '#3b82f6'}`,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ color: selectedEpisode.phh_intervention_threshold_crossed ? '#b91c1c' : '#1e40af' }}>
                      {evalResult?.summary || 'Cranial Ultrasound Assessment'}
                    </strong>
                    <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 4 }}>
                      {evalResult?.interventionGuidance}
                    </div>
                  </div>
                  <span className={`badge ${selectedEpisode.phh_intervention_threshold_crossed ? 'badge-danger' : 'badge-primary'}`} style={{ height: 'fit-content' }}>
                    {selectedEpisode.phh_intervention_threshold_crossed ? 'ACTION LINE CROSSED' : 'STABLE'}
                  </span>
                </div>
              </div>

              {/* Ultrasound Morphometry Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ padding: 10, background: '#f8fafc' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Max Ventricular Index</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: selectedEpisode.ventricular_index_right_mm >= selectedEpisode.levene_action_line_threshold_mm ? '#dc2626' : '#1e3a8a' }}>
                    {Math.max(selectedEpisode.ventricular_index_left_mm, selectedEpisode.ventricular_index_right_mm)} mm
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>
                    L: {selectedEpisode.ventricular_index_left_mm} | R: {selectedEpisode.ventricular_index_right_mm}
                  </div>
                </div>
                <div className="card" style={{ padding: 10, background: '#f8fafc' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Levene Thresholds</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {selectedEpisode.levene_action_line_threshold_mm} mm
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>
                    97th: {selectedEpisode.levene_97th_percentile_mm} mm (+4mm Action)
                  </div>
                </div>
                <div className="card" style={{ padding: 10, background: '#f8fafc' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Max Anterior Horn Width</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: Math.max(selectedEpisode.anterior_horn_width_left_mm, selectedEpisode.anterior_horn_width_right_mm) >= 6.0 ? '#dc2626' : 'inherit' }}>
                    {Math.max(selectedEpisode.anterior_horn_width_left_mm, selectedEpisode.anterior_horn_width_right_mm)} mm
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>
                    Threshold &gt; 6 mm
                  </div>
                </div>
                <div className="card" style={{ padding: 10, background: '#f8fafc' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Head Circumference</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {selectedEpisode.head_circumference_cm} cm
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>
                    Growth: {selectedEpisode.head_circumference_growth_cm_week} cm/wk
                  </div>
                </div>
              </div>

              {/* Parenchymal / Neurosurgery Protocol */}
              <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#334155' }}>
                  Neurosurgical Decompression & VP Shunt Readiness
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: '0.85rem' }}>
                  <div>
                    <strong>Active Modality:</strong> {selectedEpisode.intervention_status.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div>
                    <strong>CSF Protein:</strong> {selectedEpisode.csf_protein_g_l !== null ? `${selectedEpisode.csf_protein_g_l} g/L` : 'Not Sampled'}
                  </div>
                  <div>
                    <strong>VP Shunt Criteria:</strong> {evalResult?.vpShuntReadiness?.readyForVpShunt ? '✅ READY' : '⏳ TEMPORIZING'}
                  </div>
                </div>
                {evalResult?.vpShuntReadiness?.criteriaNotes && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    {evalResult.vpShuntReadiness.criteriaNotes}
                  </p>
                )}
              </div>

              {selectedEpisode.clinical_notes && (
                <div style={{ fontSize: '0.85rem', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                  <strong>Notes:</strong> {selectedEpisode.clinical_notes}
                </div>
              )}
            </div>

            {/* Bedside Serial Ultrasound & CSF Flowsheet */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#1e3a8a' }}>Bedside Cranial Ultrasound & PHH Flowsheet</h4>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Serial ventricular dimensions, fontanelle tension, and CSF tapping volumes
                  </span>
                </div>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFlowsheetModal(true)}>
                  + Log Ultrasound / Tap
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>Date/Time</th>
                      <th style={{ padding: 8 }}>Day</th>
                      <th style={{ padding: 8 }}>VI (mm)</th>
                      <th style={{ padding: 8 }}>AHW (mm)</th>
                      <th style={{ padding: 8 }}>HC (cm)</th>
                      <th style={{ padding: 8 }}>Fontanelle</th>
                      <th style={{ padding: 8 }}>CSF Tapped (mL)</th>
                      <th style={{ padding: 8 }}>Logged By</th>
                      <th style={{ padding: 8 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 16 }} className="muted">
                          No serial flowsheet logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: 8 }}>{new Date(log.log_datetime).toLocaleString()}</td>
                          <td style={{ padding: 8 }}>+{log.days_from_baseline}d</td>
                          <td style={{ padding: 8, fontWeight: 600, color: log.ventricular_index_mm >= selectedEpisode.levene_action_line_threshold_mm ? '#dc2626' : 'inherit' }}>
                            {log.ventricular_index_mm} mm
                          </td>
                          <td style={{ padding: 8 }}>{log.anterior_horn_width_mm} mm</td>
                          <td style={{ padding: 8 }}>{log.head_circumference_cm} cm</td>
                          <td style={{ padding: 8 }}>
                            <span className={`badge ${log.fontanelle_tension === 'bulging_tense' ? 'badge-danger' : log.fontanelle_tension === 'full' ? 'badge-warning' : 'badge-secondary'}`}>
                              {log.fontanelle_tension.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: 8, fontWeight: 'bold' }}>{log.csf_volume_tapped_ml} mL</td>
                          <td style={{ padding: 8 }} className="muted">{log.logged_by_name || `User #${log.logged_by_id}`}</td>
                          <td style={{ padding: 8 }}>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteLog(log.id)}>✕</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <NeonatalIvhModal
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
        <NeonatalIvhFlowsheetModal
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
