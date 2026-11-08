import React, { useState, useEffect } from 'react';
import {
  getObstetricDkaEpisodes,
  getObstetricDkaEpisode,
  updateObstetricDkaEpisode,
  deleteObstetricDkaEpisode,
  deleteObstetricDkaFlowsheet,
  type ObstetricDkaRecord,
  type ObstetricDkaFlowsheetRecord,
} from '../api';
import { ObstetricDkaModal } from './ObstetricDkaModal';
import { ObstetricDkaFlowsheetModal } from './ObstetricDkaFlowsheetModal';

interface ObstetricDkaTabProps {
  patientId: number;
  patientName: string;
}

export const ObstetricDkaTab: React.FC<ObstetricDkaTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricDkaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricDkaRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricDkaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricDkaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load obstetric DKA episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getObstetricDkaEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load DKA episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const res = await updateObstetricDkaEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this obstetric DKA episode record?')) return;
    try {
      await deleteObstetricDkaEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteObstetricDkaFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet checkpoint');
    }
  };

  return (
    <div className="obstetric-dka-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: 0 }}>🩺 Obstetric DKA & Euglycemic Ketoacidosis Protocol</h4>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            ACOG Practice Bulletin / Sibai & Viteri Protocol: Intrauterine Resuscitation, Insulin Titration & Anion Gap Closure
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New DKA Admission
          </button>
          {selectedEpisode && (
            <a
              href={`/obstetric-dka/${selectedEpisode.id}/print`}
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
        <div>Loading obstetric DKA records...</div>
      ) : episodes.length === 0 ? (
        <div className="empty-state" style={{ padding: 24, textAlign: 'center', background: '#fafafa', borderRadius: 8 }}>
          <p>No diabetic ketoacidosis (DKA) episodes on file for this patient.</p>
          <button className="btn btn-outline-primary" onClick={() => setShowModal(true)}>
            Record DKA Admission
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 16 }}>
          {/* Episode List */}
          <div style={{ borderRight: '1px solid #eee', paddingRight: 12 }}>
            <h5 style={{ fontSize: '0.9rem', color: '#777', textTransform: 'uppercase' }}>DKA Episodes</h5>
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
                    {ep.gestation_weeks}w | Glucose: {ep.blood_glucose_mg_dl} mg/dL
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge ${ep.is_euglycemic_dka ? 'badge-warning' : 'badge-danger'}`}>
                      {ep.is_euglycemic_dka ? 'EUGLYCEMIC DKA' : 'HYPERGLYCEMIC DKA'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>AG: {ep.calculated_anion_gap}</span>
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
                      Presented {new Date(selectedEpisode.presentation_datetime).toLocaleString()}
                    </span>
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="form-control"
                      style={{ width: 'auto' }}
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value="active_acidosis_resuscitation">Active Acidosis Resuscitation</option>
                      <option value="euglycemic_dextrose_infusion">Euglycemic Dextrose Infusion</option>
                      <option value="acidosis_resolved_transitioning">Acidosis Resolved (Transitioning)</option>
                      <option value="resolved_subcutaneous_insulin">Resolved (On SubQ Insulin)</option>
                    </select>
                    <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Blood Glucose</span>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: selectedEpisode.is_euglycemic_dka ? '#d97706' : '#dc2626' }}>
                      {selectedEpisode.blood_glucose_mg_dl} mg/dL
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Venous/Arterial pH</span>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: selectedEpisode.arterial_or_venous_ph < 7.20 ? '#dc2626' : '#4b5563' }}>
                      {selectedEpisode.arterial_or_venous_ph}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Bicarbonate (HCO3)</span>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: selectedEpisode.serum_bicarbonate_meq_l < 15 ? '#dc2626' : '#16a34a' }}>
                      {selectedEpisode.serum_bicarbonate_meq_l} mEq/L
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Anion Gap</span>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: selectedEpisode.calculated_anion_gap > 12 ? '#dc2626' : '#16a34a' }}>
                      {selectedEpisode.calculated_anion_gap} mEq/L
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Insulin Infusion</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#2563eb' }}>
                      {selectedEpisode.insulin_infusion_rate_units_hr} U/hr
                    </div>
                  </div>
                </div>

                {evalResult && (
                  <div style={{ marginTop: 14, background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: selectedEpisode.is_euglycemic_dka ? '#c2410c' : '#b91c1c' }}>
                        {evalResult.severityLabel}
                      </strong>
                      <span className="badge badge-info">Trigger: {selectedEpisode.precipitating_trigger.replace(/_/g, ' ')}</span>
                    </div>

                    <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#555' }}>{evalResult.summary}</p>
                    <div style={{ fontSize: '0.85rem', color: '#333' }}>
                      <strong>Potassium Protocol:</strong> {evalResult.potassiumReplacementAdvice}
                    </div>

                    <div className="alert alert-warning" style={{ margin: '8px 0 0 0', padding: 6, fontSize: '0.85rem' }}>
                      ⚠️ {evalResult.fetalResuscitationGuidance}
                    </div>
                  </div>
                )}
              </div>

              {/* Flowsheet Table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h5 style={{ margin: 0 }}>Bedside DKA Flowsheet & Fetal Heart Rate Surveillance</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFlowsheetModal(true)}>
                  + Log Observation
                </button>
              </div>

              {logs.length === 0 ? (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
                  No bedside glucose or flowsheet logs recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-sm table-bordered" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th>Time (+hrs)</th>
                        <th>Glucose (mg/dL)</th>
                        <th>Insulin (U/hr)</th>
                        <th>IV Fluid & Rate</th>
                        <th>VBG pH</th>
                        <th>HCO3</th>
                        <th>Anion Gap</th>
                        <th>K+ (mEq/L)</th>
                        <th>FHR Baseline</th>
                        <th>Urine (mL/h)</th>
                        <th>Logged By</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <strong>+{log.hours_from_presentation}h</strong>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, color: log.blood_glucose_mg_dl > 200 ? '#dc2626' : 'inherit' }}>
                            {log.blood_glucose_mg_dl}
                          </td>
                          <td>{log.insulin_rate_units_hr}</td>
                          <td>
                            {log.iv_fluid_rate_ml_hr} mL/h
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>{log.iv_fluid_type}</div>
                          </td>
                          <td>{log.vbg_ph ?? '-'}</td>
                          <td>{log.serum_bicarbonate_meq_l ?? '-'}</td>
                          <td style={{ fontWeight: 600, color: (log.calculated_anion_gap ?? 0) <= 12 ? '#16a34a' : '#dc2626' }}>
                            {log.calculated_anion_gap ?? '-'}
                          </td>
                          <td>{log.serum_potassium_meq_l}</td>
                          <td>
                            {log.fhr_baseline_bpm ? `${log.fhr_baseline_bpm} bpm` : '-'}
                            {log.fhr_decelerations && log.fhr_decelerations !== 'none' && (
                              <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>{log.fhr_decelerations}</div>
                            )}
                          </td>
                          <td>{log.urine_output_ml_hr ?? '-'}</td>
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
        <ObstetricDkaModal
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
        <ObstetricDkaFlowsheetModal
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
