import React, { useState, useEffect } from 'react';
import {
  getPediatricAnaphylaxisEpisodes,
  getPediatricAnaphylaxisEpisode,
  updatePediatricAnaphylaxisEpisode,
  deletePediatricAnaphylaxisEpisode,
  deletePediatricAnaphylaxisFlowsheet,
  type PediatricAnaphylaxisRecord,
  type PediatricAnaphylaxisFlowsheetRecord,
} from '../api';
import { PediatricAnaphylaxisModal } from './PediatricAnaphylaxisModal';
import { PediatricAnaphylaxisFlowsheetModal } from './PediatricAnaphylaxisFlowsheetModal';

interface PediatricAnaphylaxisTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricAnaphylaxisTab: React.FC<PediatricAnaphylaxisTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<PediatricAnaphylaxisRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricAnaphylaxisRecord | null>(null);
  const [logs, setLogs] = useState<PediatricAnaphylaxisFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricAnaphylaxisEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load anaphylaxis episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getPediatricAnaphylaxisEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load anaphylaxis episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const res = await updatePediatricAnaphylaxisEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this pediatric anaphylaxis episode record?')) return;
    try {
      await deletePediatricAnaphylaxisEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log entry?')) return;
    try {
      await deletePediatricAnaphylaxisFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="pediatric-anaphylaxis-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: 0 }}>🚨 Pediatric Anaphylaxis Emergency Resuscitation</h4>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            WAO 2020 / EAACI Protocol: Weight-Adjusted IM Epinephrine, Refractory IV Infusion & Biphasic Surveillance
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Anaphylaxis Activation
          </button>
          {selectedEpisode && (
            <a
              href={`/pediatric-anaphylaxis/${selectedEpisode.id}/print`}
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
        <div>Loading anaphylaxis resuscitation records...</div>
      ) : episodes.length === 0 ? (
        <div className="empty-state" style={{ padding: 24, textAlign: 'center', background: '#fafafa', borderRadius: 8 }}>
          <p>No acute anaphylaxis resuscitation episodes on file for this child.</p>
          <button className="btn btn-outline-primary" onClick={() => setShowModal(true)}>
            Record Anaphylaxis Episode
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 16 }}>
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
                    background: selectedEpisode?.id === ep.id ? '#fee2e2' : '#fff',
                    border: `1px solid ${selectedEpisode?.id === ep.id ? '#ef4444' : '#ddd'}`,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ep.episode_code}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    {ep.weight_kg} kg | Trigger: {ep.trigger_type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge ${ep.severity_tier === 'refractory_shock' ? 'badge-danger' : ep.severity_tier === 'severe_life_threatening' ? 'badge-warning' : 'badge-info'}`}>
                      {ep.severity_tier.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>{ep.im_epinephrine_doses_given} dose(s)</span>
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
                      Triaged on {new Date(selectedEpisode.triage_datetime).toLocaleString()}
                    </span>
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="form-control"
                      style={{ width: 'auto' }}
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <option value="acute_resuscitation_bay">Acute Resuscitation Bay</option>
                      <option value="refractory_picu_infusion">Refractory PICU Infusion</option>
                      <option value="biphasic_surveillance_observation">Biphasic Surveillance</option>
                      <option value="discharged_auto_injector_prescribed">Discharged (Autoinjector Rx)</option>
                    </select>
                    <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>IM Epinephrine Dose</span>
                    <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#dc2626' }}>
                      {selectedEpisode.weight_adjusted_epinephrine_im_dose_mg} mg
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Device</span>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {selectedEpisode.autoinjector_recommended.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Doses Given</span>
                    <div style={{ fontWeight: 700, fontSize: '1.25rem', color: selectedEpisode.im_epinephrine_doses_given >= 2 ? '#d97706' : '#16a34a' }}>
                      {selectedEpisode.im_epinephrine_doses_given} Dose(s)
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Refractory Shock</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: selectedEpisode.refractory_shock_declared ? '#dc2626' : '#16a34a' }}>
                      {selectedEpisode.refractory_shock_declared ? '🚨 DECLARED' : 'No'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Surveillance</span>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                      {selectedEpisode.biphasic_surveillance_recommended_hours} Hours
                    </div>
                  </div>
                </div>

                {evalResult && (
                  <div style={{ marginTop: 14, background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: selectedEpisode.refractory_shock_declared ? '#991b1b' : '#166534' }}>
                        {evalResult.summary}
                      </strong>
                      <span className="badge badge-danger">{evalResult.criteriaExplanation}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '8px 0', fontSize: '0.85rem' }}>
                      <div><strong>Fluid Bolus (20 mL/kg):</strong> {evalResult.fluidBolusVolumeMl} mL</div>
                      <div><strong>Diphenhydramine IV:</strong> {evalResult.h1AntihistamineDoseMg} mg</div>
                      <div><strong>Methylprednisolone IV:</strong> {evalResult.methylprednisoloneDoseMg} mg</div>
                    </div>

                    {evalResult.refractoryShockDeclared && (
                      <div className="alert alert-danger" style={{ margin: 0, padding: 6, fontSize: '0.82rem' }}>
                        🚨 Continuous IV Epinephrine Infusion: 0.1 mcg/kg/min titrating up to 1.0 mcg/kg/min for target SBP. Transfer to PICU.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Flowsheet Table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h5 style={{ margin: 0 }}>Bedside Anaphylaxis Resuscitation Flowsheet</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFlowsheetModal(true)}>
                  + Log Observation
                </button>
              </div>

              {logs.length === 0 ? (
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
                  No vital signs or anaphylaxis checkpoints logged yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-sm table-bordered" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th>Time (+min)</th>
                        <th>BP (SBP/DBP)</th>
                        <th>HR</th>
                        <th>RR</th>
                        <th>SpO2</th>
                        <th>Stridor</th>
                        <th>Wheeze</th>
                        <th>Urticaria</th>
                        <th>Cumul. IM Doses</th>
                        <th>Crystalloid</th>
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
                          <td>{log.sbp_mmhg} / {log.dbp_mmhg ?? '-'}</td>
                          <td>{log.heart_rate_bpm}</td>
                          <td>{log.respiratory_rate}</td>
                          <td>{log.spo2_percent}%</td>
                          <td style={{ color: log.stridor_present ? '#dc2626' : 'inherit', fontWeight: log.stridor_present ? 700 : 400 }}>
                            {log.stridor_present ? '⚠️ PRESENT' : 'None'}
                          </td>
                          <td>{log.wheeze_severity}</td>
                          <td>{log.urticaria_coverage}</td>
                          <td>{log.cumulative_im_epinephrine_doses}</td>
                          <td>{log.cumulative_crystalloid_ml} mL</td>
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
        <PediatricAnaphylaxisModal
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
        <PediatricAnaphylaxisFlowsheetModal
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
