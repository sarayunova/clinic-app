import React, { useState, useEffect } from 'react';
import {
  getObstetricCvstEpisodes,
  getObstetricCvstEpisode,
  patchObstetricCvstStatus,
  deleteObstetricCvstEpisode,
  deleteObstetricCvstFlowsheet,
  type ObstetricCvstRecord,
  type ObstetricCvstFlowsheetRecord,
} from '../api';
import {
  evaluateObstetricCvst,
  type ObstetricCvstEvaluation,
} from '../obstetricCvstEngine';
import { ObstetricCvstModal } from './ObstetricCvstModal';
import { ObstetricCvstFlowsheetModal } from './ObstetricCvstFlowsheetModal';

interface Props {
  patientId: number;
}

export const ObstetricCvstTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricCvstRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricCvstRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<ObstetricCvstFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showEpisodeModal, setShowEpisodeModal] = useState<boolean>(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getObstetricCvstEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getObstetricCvstEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load obstetric CVST records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleSelectEpisode = async (ep: ObstetricCvstRecord) => {
    try {
      const epRes = await getObstetricCvstEpisode(ep.id);
      setSelectedEpisode(epRes.episode);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to select episode');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const updated = await patchObstetricCvstStatus(selectedEpisode.id, newStatus);
      setSelectedEpisode(updated.episode);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this obstetric CVST episode?')) return;
    try {
      await deleteObstetricCvstEpisode(id);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this neuro surveillance flowsheet log?')) return;
    try {
      await deleteObstetricCvstFlowsheet(selectedEpisode.id, logId);
      const epRes = await getObstetricCvstEpisode(selectedEpisode.id);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading) return <div>Loading Obstetric Cerebral Venous Sinus Thrombosis (CVST) records...</div>;

  let evaluation: ObstetricCvstEvaluation | null = null;
  if (selectedEpisode) {
    let sinuses: string[] = [];
    try {
      sinuses = JSON.parse(selectedEpisode.thrombosed_sinus_locations_json || '[]');
    } catch {
      sinuses = [];
    }

    evaluation = evaluateObstetricCvst({
      gestationalAgeWeeks: selectedEpisode.gestational_age_weeks,
      clinicalTiming: selectedEpisode.clinical_timing as any,
      presentingHeadacheType: selectedEpisode.presenting_headache_type as any,
      seizuresPresent: Boolean(selectedEpisode.seizures_present),
      papilledemaPresent: Boolean(selectedEpisode.papilledema_present),
      focalNeurologicalDeficit: Boolean(selectedEpisode.focal_neurological_deficit),
      alteredMentalStatusComa: Boolean(selectedEpisode.altered_mental_status_coma),
      thrombosedSinusLocations: sinuses,
      intracranialHemorrhagicVenousInfarct: Boolean(selectedEpisode.intracranial_hemorrhagic_venous_infarct),
      therapeuticAnticoagulationActive: Boolean(selectedEpisode.therapeutic_anticoagulation_active),
      anticoagulantAgent: selectedEpisode.anticoagulant_agent as any,
      intracranialHypertensionManagement: selectedEpisode.intracranial_hypertension_management as any,
      antiepilepticTherapyActive: Boolean(selectedEpisode.antiepileptic_therapy_active),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🧠 Obstetric Cerebral Venous Sinus Thrombosis (CVST)</h2>
          <span className="muted small">ESO Guidelines / AHA Stroke in Pregnancy / Therapeutic LMWH in Hemorrhagic Infarction</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn primary" onClick={() => setShowEpisodeModal(true)}>
            + Initiate Obstetric CVST Protocol
          </button>
        </div>
      </div>

      {error && <div className="alert banner danger">{error}</div>}

      {episodes.length === 0 ? (
        <div className="card center muted" style={{ padding: 40 }}>
          <p>No Obstetric Cerebral Venous Sinus Thrombosis episodes recorded for this patient.</p>
          <button className="btn secondary" onClick={() => setShowEpisodeModal(true)}>
            Initiate First Evaluation
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Left: Episodes List */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: '0 0 10px 0' }}>CVST Episodes</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    border: ep.id === selectedEpisode?.id ? '2px solid #1976d2' : '1px solid #ddd',
                    backgroundColor: ep.id === selectedEpisode?.id ? '#e3f2fd' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{ep.episode_code}</div>
                  <div className="small muted">
                    {new Date(ep.onset_datetime).toLocaleDateString()} | {ep.clinical_timing.replace(/_/g, ' ')}
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                    <span className={`tag small ${ep.intracranial_hemorrhagic_venous_infarct ? 'danger' : 'info'}`}>
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Selected Episode Detail */}
          {selectedEpisode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header Box */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0' }}>Episode: {selectedEpisode.episode_code}</h3>
                    <span className="muted small">
                      Onset: {new Date(selectedEpisode.onset_datetime).toLocaleString()} | Timing: {selectedEpisode.clinical_timing.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`/patients/${patientId}/obstetric-cvst/${selectedEpisode.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn small secondary"
                    >
                      🖨️ Print Dossier
                    </a>
                    <button
                      className="btn small danger"
                      onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                    >
                      Delete Episode
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <label style={{ fontWeight: 'bold' }}>Protocol Status:</label>
                  <select
                    value={selectedEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 4 }}
                  >
                    <option value="acute_cvst_inpatient_resuscitation">Acute Inpatient Resuscitation</option>
                    <option value="therapeutic_anticoagulation_active">Anticoagulation Active</option>
                    <option value="elevated_icp_critical_monitoring">Elevated ICP Critical Monitoring</option>
                    <option value="endovascular_or_surgical_intervention">Endovascular / Surgical Intervention</option>
                    <option value="subacute_neurological_rehabilitation">Subacute Neuro Rehabilitation</option>
                    <option value="convalescent_long_term_anticoagulation">Convalescent Long-Term LMWH</option>
                  </select>
                </div>

                {/* Clinical Findings Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 6 }}>
                    <span className="small muted">Headache Type</span>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {selectedEpisode.presenting_headache_type.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 6 }}>
                    <span className="small muted">Hemorrhagic Venous Infarct</span>
                    <div style={{ fontWeight: 'bold', color: selectedEpisode.intracranial_hemorrhagic_venous_infarct ? '#d32f2f' : '#2e7d32' }}>
                      {selectedEpisode.intracranial_hemorrhagic_venous_infarct ? 'YES (Confirmed on MRI/CT)' : 'None'}
                    </div>
                  </div>
                  <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 6 }}>
                    <span className="small muted">Anticoagulation Regimen</span>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {selectedEpisode.anticoagulant_agent.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 6 }}>
                    <span className="small muted">ICP Management</span>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {selectedEpisode.intracranial_hypertension_management.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {/* Neurological Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  <span className={`tag small ${selectedEpisode.papilledema_present ? 'danger' : 'info'}`}>Papilledema: {selectedEpisode.papilledema_present ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.seizures_present ? 'danger' : 'info'}`}>Seizures: {selectedEpisode.seizures_present ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.focal_neurological_deficit ? 'danger' : 'info'}`}>Focal Deficit: {selectedEpisode.focal_neurological_deficit ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.altered_mental_status_coma ? 'danger' : 'info'}`}>Altered Coma: {selectedEpisode.altered_mental_status_coma ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.antiepileptic_therapy_active ? 'warning' : 'info'}`}>Antiepileptic: {selectedEpisode.antiepileptic_therapy_active ? 'Active' : 'No'}</span>
                </div>
              </div>

              {/* Engine Analysis & Directives */}
              {evaluation && (
                <div className="card" style={{ borderLeft: `5px solid ${evaluation.isHighRiskCvst ? '#d32f2f' : '#1976d2'}` }}>
                  <h4 style={{ margin: '0 0 10px 0', color: evaluation.isHighRiskCvst ? '#d32f2f' : '#1976d2' }}>
                    Engine Stratification: {evaluation.urgencyTierLabel}
                  </h4>

                  {evaluation.alerts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {evaluation.alerts.map((al, idx) => (
                        <div key={idx} className="alert banner danger" style={{ margin: 0, padding: 8 }}>
                          ⚠️ {al}
                        </div>
                      ))}
                    </div>
                  )}

                  {evaluation.anticoagulationDirectives.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <strong>Anticoagulation Directives:</strong>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                        {evaluation.anticoagulationDirectives.map((ad, idx) => <li key={idx}>{ad}</li>)}
                      </ul>
                    </div>
                  )}

                  {evaluation.elevatedIcpDirectives.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <strong>Intracranial Hypertension Directives:</strong>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                        {evaluation.elevatedIcpDirectives.map((ed, idx) => <li key={idx}>{ed}</li>)}
                      </ul>
                    </div>
                  )}

                  {evaluation.seizureManagementDirectives.length > 0 && (
                    <div>
                      <strong>Seizure Prophylaxis Directives:</strong>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                        {evaluation.seizureManagementDirectives.map((sd, idx) => <li key={idx}>{sd}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Flowsheet Table */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>Serial Neuro-Vascular Surveillance Flowsheet</h4>
                  <button className="btn small primary" onClick={() => setShowFlowsheetModal(true)}>
                    + Add Checkpoint Log
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p className="muted small">No surveillance logs recorded yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>GCS</th>
                          <th>Pupils</th>
                          <th>Headache (NRS)</th>
                          <th>BP (mmHg)</th>
                          <th>HR</th>
                          <th>Anti-Xa / aPTT</th>
                          <th>Seizure</th>
                          <th>Notes</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flowsheetLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td><strong>{log.gcs_score}/15</strong></td>
                            <td className="capitalize">{log.pupillary_reactivity.replace(/_/g, ' ')}</td>
                            <td>{log.headache_severity_nrs}/10</td>
                            <td>{log.systolic_bp_mmhg}/{log.diastolic_bp_mmhg}</td>
                            <td>{log.heart_rate_bpm} bpm</td>
                            <td><strong>{log.anti_xa_or_aptt_level}</strong></td>
                            <td>{log.seizure_activity_observed ? '⚠️ Yes' : 'No'}</td>
                            <td>{log.notes || '—'}</td>
                            <td>
                              <button
                                className="btn tiny danger"
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
        <ObstetricCvstModal
          patientId={patientId}
          onClose={() => setShowEpisodeModal(false)}
          onSuccess={(newId) => {
            setShowEpisodeModal(false);
            loadData();
          }}
          onSaved={() => {
            setShowEpisodeModal(false);
            loadData();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <ObstetricCvstFlowsheetModal
          episode={selectedEpisode}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => {
            setShowFlowsheetModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
