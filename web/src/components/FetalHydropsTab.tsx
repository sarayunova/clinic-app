import React, { useState, useEffect } from 'react';
import {
  getFetalHydropsEpisodes,
  getFetalHydropsEpisode,
  patchFetalHydropsStatus,
  deleteFetalHydropsEpisode,
  deleteFetalHydropsFlowsheet,
  type FetalHydropsRecord,
  type FetalHydropsFlowsheetRecord,
} from '../api';
import {
  evaluateFetalHydrops,
  type FetalHydropsEvaluation,
} from '../fetalHydropsEngine';
import { FetalHydropsModal } from './FetalHydropsModal';
import { FetalHydropsFlowsheetModal } from './FetalHydropsFlowsheetModal';

interface Props {
  patientId: number;
}

export const FetalHydropsTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<FetalHydropsRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<FetalHydropsRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<FetalHydropsFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showEpisodeModal, setShowEpisodeModal] = useState<boolean>(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFetalHydropsEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getFetalHydropsEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load fetal hydrops records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleSelectEpisode = async (ep: FetalHydropsRecord) => {
    try {
      const epRes = await getFetalHydropsEpisode(ep.id);
      setSelectedEpisode(epRes.episode);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to select episode');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const updated = await patchFetalHydropsStatus(selectedEpisode.id, newStatus);
      setSelectedEpisode(updated.episode);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this fetal hydrops episode?')) return;
    try {
      await deleteFetalHydropsEpisode(id);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this surveillance flowsheet log?')) return;
    try {
      await deleteFetalHydropsFlowsheet(selectedEpisode.id, logId);
      const epRes = await getFetalHydropsEpisode(selectedEpisode.id);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading) return <div>Loading Non-Immune Fetal Hydrops (NIHF) & Mirror Syndrome records...</div>;

  let evaluation: FetalHydropsEvaluation | null = null;
  if (selectedEpisode) {
    evaluation = evaluateFetalHydrops({
      gestationalAgeWeeks: selectedEpisode.gestational_age_weeks,
      ascitesPresent: Boolean(selectedEpisode.ascites_present),
      pleuralEffusionPresent: Boolean(selectedEpisode.pleural_effusion_present),
      pericardialEffusionPresent: Boolean(selectedEpisode.pericardial_effusion_present),
      skinEdemaPresent: Boolean(selectedEpisode.skin_edema_present),
      placentalEdemaPresent: Boolean(selectedEpisode.placental_edema_present),
      polyhydramniosPresent: Boolean(selectedEpisode.polyhydramnios_present),
      mcaPsvMom: selectedEpisode.mca_psv_mom,
      suspectedEtiologyCategory: selectedEpisode.suspected_etiology_category,
      fetalArrhythmiaDetected: Boolean(selectedEpisode.fetal_arrhythmia_detected),
      maternalMirrorSyndromeSuspected: Boolean(selectedEpisode.maternal_mirror_syndrome_suspected),
      maternalSystolicBpMmhg: selectedEpisode.maternal_systolic_bp_mmhg,
      maternalDiastolicBpMmhg: selectedEpisode.maternal_diastolic_bp_mmhg,
      maternalProteinuriaGrade: selectedEpisode.maternal_proteinuria_grade,
      maternalGeneralizedAnasarca: Boolean(selectedEpisode.maternal_generalized_anasarca),
      inUteroInterventionPlanned: selectedEpisode.in_utero_intervention_planned,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🌊 Non-Immune Fetal Hydrops (NIHF) & Mirror Syndrome</h2>
          <span className="muted small">SMFM Consult Series #37 / In-Utero Transfusion / Thoracocentesis / Mirror Syndrome Screen</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn primary" onClick={() => setShowEpisodeModal(true)}>
            + Initiate Fetal Hydrops Protocol
          </button>
        </div>
      </div>

      {error && <div className="alert banner danger">{error}</div>}

      {episodes.length === 0 ? (
        <div className="card center muted" style={{ padding: 40 }}>
          <p>No Non-Immune Fetal Hydrops episodes recorded for this patient.</p>
          <button className="btn secondary" onClick={() => setShowEpisodeModal(true)}>
            Initiate First Evaluation
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Left: Episodes List */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Fetal Hydrops Episodes</h4>
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
                    {new Date(ep.diagnosis_datetime).toLocaleDateString()} | {ep.gestational_age_weeks}w
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                    <span className={`tag small ${ep.maternal_mirror_syndrome_suspected ? 'danger' : 'info'}`}>
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
                      Diagnosed: {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()} | GA: {selectedEpisode.gestational_age_weeks} weeks
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`/patients/${patientId}/fetal-hydrops/${selectedEpisode.id}/print`}
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
                    <option value="diagnostic_workup">Diagnostic Workup</option>
                    <option value="in_utero_intervention_active">In-Utero Intervention Active</option>
                    <option value="mirror_syndrome_monitoring">Mirror Syndrome Monitoring</option>
                    <option value="fetal_hydrops_resolving">Fetal Hydrops Resolving</option>
                    <option value="preterm_emergency_delivery">Preterm Emergency Delivery</option>
                    <option value="intrauterine_fetal_demise">Intrauterine Fetal Demise</option>
                    <option value="resolved_neonatal_transition">Resolved / Neonatal Transition</option>
                  </select>
                </div>

                {/* Clinical Findings Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 6 }}>
                    <span className="small muted">Etiology Category</span>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {selectedEpisode.suspected_etiology_category.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 6 }}>
                    <span className="small muted">MCA PSV (MoM)</span>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: selectedEpisode.mca_psv_mom >= 1.5 ? '#d32f2f' : '#2e7d32' }}>
                      {selectedEpisode.mca_psv_mom} MoM {selectedEpisode.mca_psv_mom >= 1.5 ? '(Severe Anemia)' : ''}
                    </div>
                  </div>
                  <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 6 }}>
                    <span className="small muted">Fluid Compartments</span>
                    <div style={{ fontWeight: 'bold' }}>
                      {selectedEpisode.fetal_compartments_involved_count} compartments involved
                    </div>
                  </div>
                  <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 6 }}>
                    <span className="small muted">In-Utero Intervention</span>
                    <div style={{ fontWeight: 'bold' }}>
                      {selectedEpisode.in_utero_intervention_planned.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {/* Fluid Spaces Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  <span className={`tag small ${selectedEpisode.ascites_present ? 'danger' : 'info'}`}>Ascites: {selectedEpisode.ascites_present ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.pleural_effusion_present ? 'danger' : 'info'}`}>Pleural Effusion: {selectedEpisode.pleural_effusion_present ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.pericardial_effusion_present ? 'danger' : 'info'}`}>Pericardial Effusion: {selectedEpisode.pericardial_effusion_present ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.skin_edema_present ? 'danger' : 'info'}`}>Skin Edema: {selectedEpisode.skin_edema_present ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.placental_edema_present ? 'danger' : 'info'}`}>Placentomegaly: {selectedEpisode.placental_edema_present ? 'Yes' : 'No'}</span>
                  <span className={`tag small ${selectedEpisode.polyhydramnios_present ? 'danger' : 'info'}`}>Polyhydramnios: {selectedEpisode.polyhydramnios_present ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {/* Engine Analysis & Directives */}
              {evaluation && (
                <div className="card" style={{ borderLeft: `5px solid ${evaluation.isMirrorSyndromeTriggered ? '#d32f2f' : '#1976d2'}` }}>
                  <h4 style={{ margin: '0 0 10px 0', color: evaluation.isMirrorSyndromeTriggered ? '#d32f2f' : '#1976d2' }}>
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

                  {evaluation.mirrorSyndromeDirectives.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <strong style={{ color: '#c62828' }}>Mirror Syndrome Surveillance Protocol:</strong>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                        {evaluation.mirrorSyndromeDirectives.map((ms, idx) => <li key={idx}>{ms}</li>)}
                      </ul>
                    </div>
                  )}

                  {evaluation.etiologyClinicalDirectives.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <strong>Etiology Workup Directives:</strong>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                        {evaluation.etiologyClinicalDirectives.map((ed, idx) => <li key={idx}>{ed}</li>)}
                      </ul>
                    </div>
                  )}

                  {evaluation.interventionDirectives.length > 0 && (
                    <div>
                      <strong>In-Utero Intervention Directives:</strong>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                        {evaluation.interventionDirectives.map((idr, idx) => <li key={idx}>{idr}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Flowsheet Table */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>Serial Fetal & Maternal Surveillance Flowsheet</h4>
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
                          <th>GA</th>
                          <th>FHR</th>
                          <th>MCA PSV</th>
                          <th>Pleural (mm)</th>
                          <th>Ascites (mm)</th>
                          <th>Maternal BP</th>
                          <th>Maternal Wt</th>
                          <th>Notes</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flowsheetLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>{log.gestational_age_weeks}w</td>
                            <td>{log.fetal_heart_rate_bpm} bpm</td>
                            <td><strong>{log.mca_psv_mom} MoM</strong> ({log.mca_psv_cm_s} cm/s)</td>
                            <td>{log.pleural_effusion_depth_mm} mm</td>
                            <td>{log.ascites_depth_mm} mm</td>
                            <td>{log.maternal_bp_systolic}/{log.maternal_bp_diastolic}</td>
                            <td>{log.maternal_weight_kg} kg</td>
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
        <FetalHydropsModal
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
        <FetalHydropsFlowsheetModal
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
