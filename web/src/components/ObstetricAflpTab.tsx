import React, { useState, useEffect } from 'react';
import {
  getObstetricAflpEpisodes,
  getObstetricAflpEpisode,
  updateObstetricAflpEpisode,
  deleteObstetricAflpEpisode,
  deleteObstetricAflpFlowsheet,
  type ObstetricAflpRecord,
  type ObstetricAflpFlowsheetRecord,
} from '../api';
import { ObstetricAflpModal } from './ObstetricAflpModal';
import { ObstetricAflpFlowsheetModal } from './ObstetricAflpFlowsheetModal';

interface ObstetricAflpTabProps {
  patientId: number;
  patientName: string;
}

export const ObstetricAflpTab: React.FC<ObstetricAflpTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricAflpRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricAflpRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricAflpFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricAflpEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load AFLP episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getObstetricAflpEpisode(id);
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
      const res = await updateObstetricAflpEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this AFLP episode record?')) return;
    try {
      await deleteObstetricAflpEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteObstetricAflpFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="obstetric-aflp-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: 0 }}>🩺 Acute Fatty Liver of Pregnancy (AFLP) & Swansea Staging</h4>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            Swansea 14-Criteria Diagnostic Staging, D10W Glycemic Protocol & Emergent Delivery Pathway
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New AFLP Evaluation
          </button>
          {selectedEpisode && (
            <a
              href={`/obstetric-aflp/${selectedEpisode.id}/print`}
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
        <div>Loading AFLP records...</div>
      ) : episodes.length === 0 ? (
        <div className="empty-state" style={{ padding: 24, textAlign: 'center', background: '#fafafa', borderRadius: 8 }}>
          <p>No Acute Fatty Liver of Pregnancy (AFLP) episodes on file for this patient.</p>
          <button className="btn btn-outline-primary" onClick={() => setShowModal(true)}>
            Record Swansea Evaluation
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Episode List */}
          <div style={{ borderRight: '1px solid #eee', paddingRight: 12 }}>
            <h5 style={{ fontSize: '0.9rem', color: '#777', textTransform: 'uppercase' }}>Episodes</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => loadDetail(ep.id)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedEpisode?.id === ep.id ? '#fef2f2' : '#fff',
                    border: `1px solid ${selectedEpisode?.id === ep.id ? '#dc2626' : '#ddd'}`,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ep.episode_code}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    {ep.gestation_weeks}w | Criteria: {ep.total_swansea_criteria_met}/14
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${ep.aflp_confirmed ? 'badge-danger' : 'badge-success'}`}>
                      {ep.aflp_confirmed ? 'AFLP CONFIRMED' : 'AFLP UNLIKELY'}
                    </span>
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
                      Diagnosed {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()}
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
                      <option value="active_critical_resuscitation">Active Critical Resuscitation</option>
                      <option value="postpartum_icu_monitoring">Postpartum ICU Monitoring</option>
                      <option value="hepatic_recovery">Hepatic Recovery</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Swansea Criteria Met</span>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: selectedEpisode.aflp_confirmed ? '#dc2626' : '#16a34a' }}>
                      {selectedEpisode.total_swansea_criteria_met} of 14
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Delivery Plan</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {selectedEpisode.delivery_urgency.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>D10W Infusion</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: selectedEpisode.dextrose_infusion_active ? '#2563eb' : '#666' }}>
                      {selectedEpisode.dextrose_infusion_active ? 'ACTIVE' : 'INACTIVE'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>INR / Glucose</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                      {selectedEpisode.inr ?? '-'} / {selectedEpisode.serum_glucose_mg_dl ? `${selectedEpisode.serum_glucose_mg_dl} mg/dL` : '-'}
                    </div>
                  </div>
                </div>

                {evalResult && (
                  <div style={{ marginTop: 14, background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e0e0e0' }}>
                    <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: 4 }}>
                      {evalResult.deliveryRecommendation}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#444', marginBottom: 6 }}>
                      {evalResult.hypoglycemiaProtocol}
                    </div>
                    <div className="alert alert-danger" style={{ margin: 0, padding: 8, fontSize: '0.85rem' }}>
                      {evalResult.lchadScreeningAlert}
                    </div>
                  </div>
                )}
              </div>

              {/* Flowsheet Table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h5 style={{ margin: 0 }}>Bedside Glycemic & Coagulopathy Checkpoints</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFlowsheetModal(true)}>
                  + Log Checkpoint
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
                        <th>Hours</th>
                        <th>Glucose</th>
                        <th>D10W Rate</th>
                        <th>BP / HR</th>
                        <th>Enceph</th>
                        <th>INR</th>
                        <th>Fib</th>
                        <th>Plt</th>
                        <th>Products</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>+{log.hours_from_diagnosis}h</td>
                          <td style={{ fontWeight: 600, color: log.blood_glucose_mg_dl < 70 ? '#dc2626' : '#111' }}>
                            {log.blood_glucose_mg_dl} mg/dL
                          </td>
                          <td>{log.dextrose_infusion_rate_ml_hr} mL/hr (D{log.dextrose_concentration_percent})</td>
                          <td>
                            {log.sbp_mmhg ? `${log.sbp_mmhg}/${log.dbp_mmhg || '-'}` : '-'} | {log.hr_bpm || '-'}
                          </td>
                          <td>Grade {log.encephalopathy_grade}</td>
                          <td style={{ fontWeight: log.inr && log.inr > 1.4 ? 700 : 400 }}>{log.inr ?? '-'}</td>
                          <td>{log.fibrinogen_mg_dl ? `${log.fibrinogen_mg_dl} mg/dL` : '-'}</td>
                          <td>{log.platelet_count ? `${log.platelet_count.toLocaleString()}` : '-'}</td>
                          <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.blood_products_administered || '-'}
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
        <ObstetricAflpModal
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
        <ObstetricAflpFlowsheetModal
          episodeId={selectedEpisode.id}
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
