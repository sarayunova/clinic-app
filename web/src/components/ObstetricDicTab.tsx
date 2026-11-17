import React, { useState, useEffect } from 'react';
import {
  getObstetricDicEpisodes,
  getObstetricDicEpisode,
  patchObstetricDicStatus,
  deleteObstetricDicEpisode,
  deleteObstetricDicFlowsheet,
  type ObstetricDicRecord,
  type ObstetricDicFlowsheetRecord,
} from '../api';
import {
  evaluateObstetricDic,
  type ObstetricDicEvaluationResult,
} from '../obstetricDicEngine';
import { ObstetricDicModal } from './ObstetricDicModal';
import { ObstetricDicFlowsheetModal } from './ObstetricDicFlowsheetModal';

interface Props {
  patientId: number;
}

export const ObstetricDicTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricDicRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricDicRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<ObstetricDicFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showEpisodeModal, setShowEpisodeModal] = useState<boolean>(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getObstetricDicEpisodes({ patientId });
      setEpisodes(res.episodes || []);
      if (res.episodes && res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getObstetricDicEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load obstetric DIC records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleSelectEpisode = async (ep: ObstetricDicRecord) => {
    try {
      const epRes = await getObstetricDicEpisode(ep.id);
      setSelectedEpisode(epRes.episode);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to select episode');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const updated = await patchObstetricDicStatus(selectedEpisode.id, newStatus);
      setSelectedEpisode(updated.episode);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this obstetric DIC episode?')) return;
    try {
      await deleteObstetricDicEpisode(id);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this bedside transfusion flowsheet checkpoint?')) return;
    try {
      await deleteObstetricDicFlowsheet(selectedEpisode.id, logId);
      const epRes = await getObstetricDicEpisode(selectedEpisode.id);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading) return <div>Loading Obstetric DIC & Coagulopathy records...</div>;

  let evaluation: ObstetricDicEvaluationResult | null = null;
  if (selectedEpisode) {
    evaluation = evaluateObstetricDic({
      gestationalAgeWeeks: selectedEpisode.gestational_age_weeks,
      clinicalTrigger: selectedEpisode.clinical_trigger,
      plateletCountKUl: selectedEpisode.platelet_count_k_ul,
      fibrinogenMgDl: selectedEpisode.fibrinogen_mg_dl,
      inr: selectedEpisode.inr,
      prothrombinTimeSec: selectedEpisode.prothrombin_time_sec,
      controlPtSec: selectedEpisode.control_pt_sec,
      apttSec: selectedEpisode.aptt_sec,
      dDimerUgMl: selectedEpisode.d_dimer_ug_ml,
      estimatedBloodLossMl: selectedEpisode.estimated_blood_loss_ml,
      overtBleedingSites: selectedEpisode.overt_bleeding_sites,
      isMtpActivated: Boolean(selectedEpisode.is_mtp_activated),
      ionizedCalciumMmolL: selectedEpisode.ionized_calcium_mmol_l,
      coreTemperatureC: selectedEpisode.core_temperature_c,
    });
  }

  return (
    <div className="tab-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Series 41B: Obstetric DIC & Fibrinogen-Guided Resuscitation</h3>
        <button className="btn primary" onClick={() => setShowEpisodeModal(true)}>
          + Initiate DIC Protocol
        </button>
      </div>

      {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

      {episodes.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p>No obstetric DIC episodes logged for this patient.</p>
          <button className="btn primary small" onClick={() => setShowEpisodeModal(true)}>
            Initiate DIC Protocol Now
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
          {/* Episode List */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Episodes ({episodes.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedEpisode?.id === ep.id ? 'var(--color-bg-selected, #e8f4fd)' : '#f9f9f9',
                    border: selectedEpisode?.id === ep.id ? '1px solid #1976d2' : '1px solid #ddd',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{ep.episode_number}</strong>
                    <span className="badge small">{ep.status}</span>
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>
                    {new Date(ep.diagnosis_datetime).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.85em', marginTop: 4 }}>
                    Fibrinogen: <strong>{ep.fibrinogen_mg_dl} mg/dL</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Episode Details */}
          {selectedEpisode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      Episode {selectedEpisode.episode_number}
                    </h3>
                    <div style={{ color: '#666', fontSize: '0.9em', marginTop: 4 }}>
                      Diagnosed: {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()} |
                      Gestational: {selectedEpisode.gestational_age_weeks ? `${selectedEpisode.gestational_age_weeks}w` : 'Postpartum'} |
                      EBL: {selectedEpisode.estimated_blood_loss_ml} mL
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="btn small"
                    >
                      <option value="active">Active</option>
                      <option value="stabilized">Stabilized</option>
                      <option value="resolved">Resolved</option>
                      <option value="transferred">Transferred</option>
                    </select>
                    <a
                      href={`/protocols/obstetric-dic/print/${selectedEpisode.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn secondary small"
                    >
                      Print Dossier
                    </a>
                    <button
                      className="btn secondary small"
                      onClick={() => setShowEpisodeModal(true)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn danger small"
                      onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {evaluation && (
                  <div
                    className={`card ${
                      evaluation.severityCategory === 'overt_consumptive_dic'
                        ? 'border-danger'
                        : evaluation.severityCategory === 'evolving_non_overt_dic'
                        ? 'border-warning'
                        : 'border-info'
                    }`}
                    style={{ marginTop: 16, padding: 12 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge" style={{ fontWeight: 'bold' }}>
                        {evaluation.severityLabel} (ISTH Score: {evaluation.modifiedIsthDicScore}/8)
                      </span>
                      <span>
                        <strong>Target Fibrinogen: &ge; 200 mg/dL</strong>
                      </span>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <strong>Resuscitation Need: </strong>
                      <span style={{ color: evaluation.fibrinogenPlan.isCriticalHypofibrinogenemia ? '#d9534f' : 'inherit' }}>
                        {evaluation.fibrinogenPlan.recommendedCryoprecipitateUnits} Units Cryoprecipitate (or {evaluation.fibrinogenPlan.recommendedFibrinogenConcentrateGrams}g Fibrinogen Concentrate)
                      </span>
                    </div>

                    {evaluation.clinicalAlerts.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong style={{ color: '#d9534f' }}>Critical Coagulopathy Alerts:</strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {evaluation.clinicalAlerts.map((alert, idx) => (
                            <li key={idx} style={{ color: '#d9534f' }}>{alert}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div>
                    <strong>Trigger:</strong> {selectedEpisode.clinical_trigger}
                  </div>
                  <div>
                    <strong>Fibrinogen:</strong> {selectedEpisode.fibrinogen_mg_dl} mg/dL
                  </div>
                  <div>
                    <strong>Platelets:</strong> {selectedEpisode.platelet_count_k_ul} x10^3/µL
                  </div>
                  <div>
                    <strong>INR:</strong> {selectedEpisode.inr}
                  </div>
                  <div>
                    <strong>MTP Activated:</strong> {selectedEpisode.is_mtp_activated ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>Tranexamic Acid:</strong> {selectedEpisode.tranexamic_acid_given ? 'Given (1g IV)' : 'Not Given'}
                  </div>
                  <div>
                    <strong>Cryo Infused:</strong> {selectedEpisode.cryoprecipitate_units_given} Units
                  </div>
                  <div>
                    <strong>Bleeding Sites:</strong> {selectedEpisode.overt_bleeding_sites}
                  </div>
                </div>

                {selectedEpisode.clinical_summary && (
                  <div style={{ marginTop: 12 }}>
                    <strong>Clinical Notes:</strong>
                    <p style={{ margin: '4px 0', color: '#555' }}>{selectedEpisode.clinical_summary}</p>
                  </div>
                )}
              </div>

              {/* Flowsheet Logs */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>Hourly Coagulation & Transfusion Checkpoints ({flowsheetLogs.length})</h4>
                  <button className="btn primary small" onClick={() => setShowFlowsheetModal(true)}>
                    + Add Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No hourly flowsheet checks recorded yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.9em' }}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>BP / HR</th>
                          <th>EBL / hr</th>
                          <th>Fibrinogen</th>
                          <th>Platelets</th>
                          <th>INR</th>
                          <th>Urine</th>
                          <th>Hemostasis State & Components</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flowsheetLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{new Date(log.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>{log.systolic_bp && log.diastolic_bp ? `${log.systolic_bp}/${log.diastolic_bp}` : '-'} ({log.heart_rate_bpm ?? '-'} bpm)</td>
                            <td><strong>{log.hourly_blood_loss_ml} mL</strong></td>
                            <td style={{ color: log.serial_fibrinogen_mg_dl && log.serial_fibrinogen_mg_dl < 200 ? '#d9534f' : 'inherit' }}>
                              {log.serial_fibrinogen_mg_dl ?? '-'}
                            </td>
                            <td>{log.serial_platelets_k_ul ?? '-'}</td>
                            <td>{log.serial_inr ?? '-'}</td>
                            <td>{log.urine_output_ml_hr ? `${log.urine_output_ml_hr} mL/h` : '-'}</td>
                            <td>
                              <div><strong>{log.clinical_hemostasis_state}</strong></div>
                              {log.blood_components_infused && <div style={{ color: '#1976d2' }}>{log.blood_components_infused}</div>}
                              {log.nurse_notes && <div style={{ color: '#555' }}>{log.nurse_notes}</div>}
                            </td>
                            <td>
                              <button
                                className="btn danger small"
                                onClick={() => handleDeleteFlowsheet(log.id)}
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

      {showEpisodeModal && (
        <ObstetricDicModal
          patientId={patientId}
          existingEpisode={selectedEpisode}
          onClose={() => setShowEpisodeModal(false)}
          onSaved={loadData}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <ObstetricDicFlowsheetModal
          episodeId={selectedEpisode.id}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
};
