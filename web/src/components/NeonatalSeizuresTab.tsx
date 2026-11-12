import React, { useState, useEffect } from 'react';
import {
  getNeonatalSeizuresEpisodes,
  getNeonatalSeizuresEpisode,
  patchNeonatalSeizuresStatus,
  deleteNeonatalSeizuresEpisode,
  deleteNeonatalSeizuresFlowsheet,
  type NeonatalSeizuresRecord,
  type NeonatalSeizuresFlowsheetRecord,
} from '../api';
import {
  evaluateNeonatalSeizures,
  type NeonatalSeizuresEvaluationResult,
} from '../neonatalSeizuresEngine';
import { NeonatalSeizuresModal } from './NeonatalSeizuresModal';
import { NeonatalSeizuresFlowsheetModal } from './NeonatalSeizuresFlowsheetModal';

interface Props {
  patientId: number;
}

export const NeonatalSeizuresTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalSeizuresRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalSeizuresRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<NeonatalSeizuresFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showEpisodeModal, setShowEpisodeModal] = useState<boolean>(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalSeizuresEpisodes({ patientId });
      setEpisodes(res.episodes || []);
      if (res.episodes && res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getNeonatalSeizuresEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load neonatal seizure records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleSelectEpisode = async (ep: NeonatalSeizuresRecord) => {
    try {
      const epRes = await getNeonatalSeizuresEpisode(ep.id);
      setSelectedEpisode(epRes.episode);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to select episode');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const updated = await patchNeonatalSeizuresStatus(selectedEpisode.id, newStatus);
      setSelectedEpisode(updated.episode);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this neonatal seizures episode?')) return;
    try {
      await deleteNeonatalSeizuresEpisode(id);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this bedside flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalSeizuresFlowsheet(selectedEpisode.id, logId);
      const epRes = await getNeonatalSeizuresEpisode(selectedEpisode.id);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading) return <div>Loading Neonatal Seizures & Status Epilepticus records...</div>;

  let evaluation: NeonatalSeizuresEvaluationResult | null = null;
  if (selectedEpisode) {
    evaluation = evaluateNeonatalSeizures({
      gestationalAgeWeeks: selectedEpisode.gestational_age_weeks,
      postnatalAgeDays: selectedEpisode.postnatal_age_days,
      currentWeightKg: selectedEpisode.current_weight_kg,
      seizureSemiology: selectedEpisode.seizure_semiology,
      seizureDurationCategory: selectedEpisode.seizure_duration_category,
      suspectedEtiology: selectedEpisode.suspected_etiology,
      bloodGlucoseMgDl: selectedEpisode.blood_glucose_mg_dl,
      ionizedCalciumMmolL: selectedEpisode.ionized_calcium_mmol_l,
      serumMagnesiumMgDl: selectedEpisode.serum_magnesium_mg_dl,
      sodiumMeqL: selectedEpisode.sodium_meq_l,
      cumulativePhenobarbitalMgKg: selectedEpisode.cumulative_phenobarbital_mg_kg,
      secondLineGiven: Boolean(selectedEpisode.second_line_given),
      pyridoxineTrialDone: Boolean(selectedEpisode.pyridoxine_trial_done),
    });
  }

  return (
    <div className="tab-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Series 41A: Neonatal Seizures & Status Epilepticus Management</h3>
        <button className="btn primary" onClick={() => setShowEpisodeModal(true)}>
          + Initiate Seizures Protocol
        </button>
      </div>

      {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

      {episodes.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p>No neonatal seizure episodes logged for this patient.</p>
          <button className="btn primary small" onClick={() => setShowEpisodeModal(true)}>
            Initiate Protocol Now
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
                    Semiology: <em>{ep.seizure_semiology}</em>
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
                      Gestational: {selectedEpisode.gestational_age_weeks}w |
                      Postnatal: {selectedEpisode.postnatal_age_days}d |
                      Weight: {selectedEpisode.current_weight_kg} kg
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
                      href={`/protocols/neonatal-seizures/print/${selectedEpisode.id}`}
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
                      evaluation.urgencyCategory === 'emergency_resuscitation'
                        ? 'border-danger'
                        : evaluation.urgencyCategory === 'high_priority_active'
                        ? 'border-warning'
                        : 'border-info'
                    }`}
                    style={{ marginTop: 16, padding: 12 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge" style={{ fontWeight: 'bold' }}>
                        {evaluation.urgencyLabel}
                      </span>
                      <span>
                        <strong>Phenobarbital Loading (20 mg/kg): </strong>
                        {evaluation.phenobarbitalLoading.bolusDoseMg} mg IV ({evaluation.phenobarbitalLoading.bolusVolumeMl} mL)
                      </span>
                    </div>

                    {evaluation.metabolicDirectives.some((m) => m.isTriggered) && (
                      <div style={{ marginTop: 10 }}>
                        <strong style={{ color: '#d9534f' }}>Urgent Metabolic Resuscitation:</strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {evaluation.metabolicDirectives
                            .filter((m) => m.isTriggered)
                            .map((m, idx) => (
                              <li key={idx} style={{ color: '#d9534f' }}>
                                <strong>{m.condition}:</strong> {m.intervention} ({m.volumeMl} mL via {m.route})
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.secondLineRecommendation && (
                      <div style={{ marginTop: 10 }}>
                        <strong>Second-Line Anticonvulsant: </strong>
                        {evaluation.secondLineRecommendation.drug} — Bolus: {evaluation.secondLineRecommendation.bolusDoseMg} mg IV over {evaluation.secondLineRecommendation.administrationRate}
                      </div>
                    )}

                    {evaluation.pyridoxineTrialIndicated && (
                      <div style={{ marginTop: 10, color: '#c05621', fontWeight: 600 }}>
                        ⚠️ Refractory Seizures: Pyridoxine (Vitamin B6) trial 100 mg IV indicated with continuous EEG/vitals.
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div>
                    <strong>Semiology:</strong> {selectedEpisode.seizure_semiology}
                  </div>
                  <div>
                    <strong>Duration:</strong> {selectedEpisode.seizure_duration_category}
                  </div>
                  <div>
                    <strong>Suspected Etiology:</strong> {selectedEpisode.suspected_etiology}
                  </div>
                  <div>
                    <strong>Cumulative Phenobarbital:</strong> {selectedEpisode.cumulative_phenobarbital_mg_kg} mg/kg
                  </div>
                  <div>
                    <strong>Second Line Given:</strong> {selectedEpisode.second_line_given ? `Yes (${selectedEpisode.second_line_anticonvulsant})` : 'No'}
                  </div>
                  <div>
                    <strong>Pyridoxine Trial:</strong> {selectedEpisode.pyridoxine_trial_done ? (selectedEpisode.pyridoxine_responsive ? 'Responsive' : 'Non-responsive') : 'Not Done'}
                  </div>
                  <div>
                    <strong>Respiratory Support:</strong> {selectedEpisode.respiratory_support_status}
                  </div>
                </div>

                {selectedEpisode.clinical_summary && (
                  <div style={{ marginTop: 12 }}>
                    <strong>Clinical Summary:</strong>
                    <p style={{ margin: '4px 0', color: '#555' }}>{selectedEpisode.clinical_summary}</p>
                  </div>
                )}
              </div>

              {/* Bedside Flowsheet Logs */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>Bedside Seizure & Vital Checkpoints ({flowsheetLogs.length})</h4>
                  <button className="btn primary small" onClick={() => setShowFlowsheetModal(true)}>
                    + Add Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No bedside flowsheet checks recorded yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.9em' }}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Seizures/hr</th>
                          <th>Clinical State</th>
                          <th>HR / RR / SpO2</th>
                          <th>BP</th>
                          <th>Sedation</th>
                          <th>aEEG</th>
                          <th>Medications / Notes</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flowsheetLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{new Date(log.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td><strong>{log.seizure_count_past_hour}</strong></td>
                            <td>{log.current_seizure_state}</td>
                            <td>{log.heart_rate_bpm ?? '-'} / {log.respiratory_rate_bpm ?? '-'} / {log.spo2_percent ? `${log.spo2_percent}%` : '-'}</td>
                            <td>{log.blood_pressure_sys && log.blood_pressure_dia ? `${log.blood_pressure_sys}/${log.blood_pressure_dia}` : '-'}</td>
                            <td>{log.sedation_score}</td>
                            <td>{log.eeg_background}</td>
                            <td>
                              {log.medication_administered && <div><strong>Meds:</strong> {log.medication_administered}</div>}
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
        <NeonatalSeizuresModal
          patientId={patientId}
          existingEpisode={selectedEpisode}
          onClose={() => setShowEpisodeModal(false)}
          onSaved={loadData}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <NeonatalSeizuresFlowsheetModal
          episodeId={selectedEpisode.id}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
};
