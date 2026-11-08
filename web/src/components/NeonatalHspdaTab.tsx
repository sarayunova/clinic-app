import React, { useState, useEffect } from 'react';
import {
  getNeonatalHspdaEpisodes,
  getNeonatalHspdaEpisode,
  updateNeonatalHspdaEpisode,
  deleteNeonatalHspdaEpisode,
  deleteNeonatalHspdaFlowsheet,
  type NeonatalHspdaRecord,
  type NeonatalHspdaFlowsheetRecord,
} from '../api';
import { NeonatalHspdaModal } from './NeonatalHspdaModal';
import { NeonatalHspdaFlowsheetModal } from './NeonatalHspdaFlowsheetModal';

interface NeonatalHspdaTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalHspdaTab: React.FC<NeonatalHspdaTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalHspdaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalHspdaRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalHspdaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalHspdaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load hsPDA episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getNeonatalHspdaEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load hsPDA episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const res = await updateNeonatalHspdaEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this neonatal hsPDA episode record?')) return;
    try {
      await deleteNeonatalHspdaEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalHspdaFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="neonatal-hspda-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: 0 }}>🫀 Neonatal Hemodynamically Significant PDA (hsPDA)</h4>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            McNamara & Sehgal Echocardiographic Staging, Pharmacotherapy & Interventional Closure Pathway
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New hsPDA Assessment
          </button>
          {selectedEpisode && (
            <a
              href={`/neonatal-hspda/${selectedEpisode.id}/print`}
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
        <div>Loading hsPDA records...</div>
      ) : episodes.length === 0 ? (
        <div className="empty-state" style={{ padding: 24, textAlign: 'center', background: '#fafafa', borderRadius: 8 }}>
          <p>No hsPDA echocardiographic episodes recorded for this infant.</p>
          <button className="btn btn-outline-primary" onClick={() => setShowModal(true)}>
            Record Echocardiogram & Staging
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 16 }}>
          {/* Episode List */}
          <div style={{ borderRight: '1px solid #eee', paddingRight: 12 }}>
            <h5 style={{ fontSize: '0.9rem', color: '#777', textTransform: 'uppercase' }}>Echo Evaluations</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => loadDetail(ep.id)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedEpisode?.id === ep.id ? '#eff6ff' : '#fff',
                    border: `1px solid ${selectedEpisode?.id === ep.id ? '#3b82f6' : '#ddd'}`,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ep.episode_code}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    Duct: {ep.ductal_diameter_mm} mm | LA:Ao {ep.la_ao_ratio}
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge ${ep.hspda_confirmed ? 'badge-danger' : 'badge-success'}`}>
                      {ep.hspda_confirmed ? 'hsPDA CONFIRMED' : 'NON-SIGNIFICANT'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>Day {ep.chronological_age_days}</span>
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
                      Echo on {new Date(selectedEpisode.echo_datetime).toLocaleString()}
                    </span>
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="form-control"
                      style={{ width: 'auto' }}
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value="echocardiographic_surveillance">Echocardiographic Surveillance</option>
                      <option value="medical_therapy_active">Medical Therapy Active</option>
                      <option value="post_therapy_echo_reassessment">Post-Therapy Reassessment</option>
                      <option value="interventional_referral">Interventional Referral</option>
                      <option value="resolved_closed">Resolved / Closed</option>
                    </select>
                    <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Ductal Diameter</span>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: selectedEpisode.ductal_diameter_mm >= 2.0 ? '#dc2626' : '#2563eb' }}>
                      {selectedEpisode.ductal_diameter_mm} mm
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>LA : Ao Ratio</span>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: selectedEpisode.la_ao_ratio >= 1.5 ? '#dc2626' : '#16a34a' }}>
                      {selectedEpisode.la_ao_ratio}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Aortic Flow Pattern</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {selectedEpisode.descending_aorta_diastolic_flow.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Pharmacotherapy</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e40af' }}>
                      {selectedEpisode.pharmacotherapy_selected.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                </div>

                {evalResult && (
                  <div style={{ marginTop: 14, background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: selectedEpisode.hspda_confirmed ? '#b91c1c' : '#166534' }}>
                        {evalResult.summary}
                      </strong>
                      <span className="badge badge-info">Echo: {evalResult.mcnamaraEchoStage} | Clinical: {evalResult.mcnamaraClinicalStage}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, margin: '8px 0', fontSize: '0.85rem' }}>
                      <div><strong>Ibuprofen Regimen:</strong> {evalResult.ibuprofenRegimen}</div>
                      <div><strong>Paracetamol Regimen:</strong> {evalResult.paracetamolRegimen}</div>
                    </div>

                    {evalResult.nsaidContraindicated && (
                      <div className="alert alert-warning" style={{ margin: '6px 0', padding: 6, fontSize: '0.82rem' }}>
                        ⚠️ NSAID Contraindications: {evalResult.contraindicationReasons.join('; ')}. {evalResult.paracetamolRecommendedAsAlternative ? 'IV Paracetamol is recommended as safer alternative.' : ''}
                      </div>
                    )}

                    {evalResult.surgicalOrCatheterReferralIndicated && (
                      <div className="alert alert-danger" style={{ margin: 0, padding: 6, fontSize: '0.82rem' }}>
                        🚨 {evalResult.interventionalGuidance}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Flowsheet Table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h5 style={{ margin: 0 }}>Bedside hsPDA Flowsheet & Hemodynamic Surveillance</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFlowsheetModal(true)}>
                  + Log Observation
                </button>
              </div>

              {logs.length === 0 ? (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
                  No bedside hemodynamics or vital signs logged yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-sm table-bordered" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th>Time (+hrs)</th>
                        <th>HR</th>
                        <th>BP (SBP/DBP)</th>
                        <th>Pulse Pressure</th>
                        <th>MAP</th>
                        <th>Support / FiO2</th>
                        <th>SpO2</th>
                        <th>Urine (mL/kg/h)</th>
                        <th>Creatinine</th>
                        <th>Platelets</th>
                        <th>Logged By</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <strong>+{log.hours_from_initiation}h</strong>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td>{log.heart_rate_bpm}</td>
                          <td>{log.sbp_mmhg} / {log.dbp_mmhg}</td>
                          <td style={{ fontWeight: 600, color: log.pulse_pressure_mmhg >= 30 ? '#dc2626' : 'inherit' }}>
                            {log.pulse_pressure_mmhg} mmHg
                          </td>
                          <td>{log.map_mmhg}</td>
                          <td>{log.respiratory_support_type} @ {log.fio2_percent}%</td>
                          <td>{log.spo2_percent}%</td>
                          <td>{log.urine_output_ml_kg_hr ?? '-'}</td>
                          <td>{log.serum_creatinine_mg_dl ? `${log.serum_creatinine_mg_dl}` : '-'}</td>
                          <td>{log.platelet_count ? `${log.platelet_count.toLocaleString()}` : '-'}</td>
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
        <NeonatalHspdaModal
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
        <NeonatalHspdaFlowsheetModal
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
