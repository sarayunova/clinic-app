import React, { useState, useEffect } from 'react';
import {
  getNeonatalBpdEpisodes,
  getNeonatalBpdEpisode,
  updateNeonatalBpdEpisode,
  deleteNeonatalBpdEpisode,
  deleteNeonatalBpdFlowsheet,
  type NeonatalBpdRecord,
  type NeonatalBpdFlowsheetRecord,
} from '../api';
import { NeonatalBpdModal } from './NeonatalBpdModal';
import { NeonatalBpdFlowsheetModal } from './NeonatalBpdFlowsheetModal';

interface NeonatalBpdTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalBpdTab: React.FC<NeonatalBpdTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalBpdRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalBpdRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalBpdFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalBpdEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load neonatal BPD episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getNeonatalBpdEpisode(id);
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
      const res = await updateNeonatalBpdEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this neonatal BPD episode record?')) return;
    try {
      await deleteNeonatalBpdEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteNeonatalBpdFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="neonatal-bpd-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: 0 }}>🫁 Neonatal Bronchopulmonary Dysplasia (BPD) & Jensen Staging</h4>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            AAP / NICHD Neonatal Research Network 2019 Criteria & Target SpO2 Protocol
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New BPD Evaluation
          </button>
          {selectedEpisode && (
            <a
              href={`/neonatal-bpd/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-secondary"
            >
              🖨️ Print Dossier
            </a>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div>Loading BPD surveillance records...</div>
      ) : episodes.length === 0 ? (
        <div className="empty-state" style={{ padding: 24, textAlign: 'center', background: '#fafafa', borderRadius: 8 }}>
          <p>No Bronchopulmonary Dysplasia (BPD) evaluations recorded for this patient.</p>
          <button className="btn btn-outline-primary" onClick={() => setShowModal(true)}>
            Record 36-Week PMA Assessment
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Episode List */}
          <div style={{ borderRight: '1px solid #eee', paddingRight: 12 }}>
            <h5 style={{ fontSize: '0.9rem', color: '#777', textTransform: 'uppercase' }}>Recorded Evaluations</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => loadDetail(ep.id)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedEpisode?.id === ep.id ? '#e3f2fd' : '#fff',
                    border: `1px solid ${selectedEpisode?.id === ep.id ? '#2196f3' : '#ddd'}`,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ep.episode_code}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    PMA: {ep.current_pma_weeks}w | GA: {ep.gestational_age_weeks}w
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${ep.jensen_bpd_grade === 'grade_3' ? 'badge-danger' : ep.jensen_bpd_grade === 'grade_2' ? 'badge-warning' : 'badge-info'}`}>
                      {ep.jensen_bpd_grade.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Episode Details & Flowsheet */}
          {selectedEpisode && (
            <div>
              <div style={{ background: '#f8f9fa', padding: 14, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>
                    {selectedEpisode.episode_code}
                    <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#666', marginLeft: 8 }}>
                      Evaluated on {new Date(selectedEpisode.evaluation_datetime).toLocaleString()}
                    </span>
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="form-control"
                      style={{ width: 'auto' }}
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value="evaluating">Evaluating</option>
                      <option value="inpatient_respiratory_care">Inpatient Respiratory Care</option>
                      <option value="weaning_protocol">Weaning Protocol</option>
                      <option value="discharged_home_oxygen">Discharged on Home O2</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Current PMA</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{selectedEpisode.current_pma_weeks} weeks</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Support Modality</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{selectedEpisode.respiratory_support_type.replace(/_/g, ' ').toUpperCase()}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Flow / FiO2</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                      {selectedEpisode.cannula_flow_lpm > 0 ? `${selectedEpisode.cannula_flow_lpm} L/min` : 'N/A'} @ {selectedEpisode.fio2_percent}%
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Jensen 2019 Staging</span>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: selectedEpisode.jensen_bpd_grade === 'grade_3' ? '#d9534f' : '#f0ad4e' }}>
                      {selectedEpisode.jensen_bpd_grade.toUpperCase().replace('_', ' ')}
                    </div>
                  </div>
                </div>

                {evalResult && (
                  <div style={{ marginTop: 14, background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <strong style={{ color: '#2c3e50' }}>{evalResult.gradeLabel}</strong>
                      <span className="badge badge-primary">Target SpO2: {evalResult.targetSpo2Min}% - {evalResult.targetSpo2Max}%</span>
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#555' }}>{evalResult.severitySummary}</p>
                    <div style={{ fontSize: '0.85rem', color: '#333' }}>
                      <strong>Caffeine:</strong> {evalResult.caffeineRecommendation}
                    </div>
                    {evalResult.homeOxygenCandidate && (
                      <div className="alert alert-warning" style={{ margin: '8px 0 0 0', padding: 6, fontSize: '0.85rem' }}>
                        ⚠️ Candidate for Home Oxygen Therapy upon neonatal discharge.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Flowsheet Table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h5 style={{ margin: 0 }}>Bedside Flowsheet & Weaning Trajectory</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFlowsheetModal(true)}>
                  + Log Observation
                </button>
              </div>

              {logs.length === 0 ? (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
                  No bedside flowsheet observations logged yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-striped">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>PMA</th>
                        <th>Support</th>
                        <th>Flow</th>
                        <th>FiO2</th>
                        <th>SpO2</th>
                        <th>In Range?</th>
                        <th>A/B Spells</th>
                        <th>Diuretic</th>
                        <th>Notes</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{log.pma_weeks}w</td>
                          <td>{log.respiratory_support}</td>
                          <td>{log.flow_lpm > 0 ? `${log.flow_lpm} L/min` : '-'}</td>
                          <td>{log.fio2_percent}%</td>
                          <td style={{ fontWeight: 600 }}>{log.spo2_percent}%</td>
                          <td>
                            <span className={`badge ${log.target_spo2_in_range ? 'badge-success' : 'badge-danger'}`}>
                              {log.target_spo2_in_range ? 'Yes (91-95)' : 'Out of Target'}
                            </span>
                          </td>
                          <td>{log.apnea_bradycardia_episodes_24h}</td>
                          <td>{log.diuretic_dose_mg_kg ? `${log.diuretic_dose_mg_kg} mg/kg` : '-'}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.notes || '-'}
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-link text-danger"
                              style={{ padding: 0 }}
                              onClick={() => handleDeleteLog(log.id)}
                            >
                              &times;
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
        <NeonatalBpdModal
          patientId={patientId}
          patientName={patientName}
          onClose={() => setShowModal(false)}
          onSuccess={(ep) => {
            setShowModal(false);
            loadEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <NeonatalBpdFlowsheetModal
          episodeId={selectedEpisode.id}
          currentPma={selectedEpisode.current_pma_weeks}
          currentSupport={selectedEpisode.respiratory_support_type}
          currentFlow={selectedEpisode.cannula_flow_lpm}
          currentFio2={selectedEpisode.fio2_percent}
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
