import React, { useState, useEffect } from 'react';
import {
  getPediatricAcuteLiverFailureEpisodes,
  getPediatricAcuteLiverFailureEpisode,
  patchPediatricAcuteLiverFailureStatus,
  deletePediatricAcuteLiverFailureEpisode,
  deletePediatricAcuteLiverFailureFlowsheet,
  type PediatricAcuteLiverFailureRecord,
  type PediatricAcuteLiverFailureFlowsheetRecord,
} from '../api';
import {
  evaluatePediatricAcuteLiverFailure,
  type PediatricAcuteLiverFailureResult,
  type HepaticEncephalopathyGrade,
} from '../pediatricAcuteLiverFailureEngine';
import { PediatricAcuteLiverFailureModal } from './PediatricAcuteLiverFailureModal';
import { PediatricAcuteLiverFailureFlowsheetModal } from './PediatricAcuteLiverFailureFlowsheetModal';

interface Props {
  patientId: number;
}

export const PediatricAcuteLiverFailureTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricAcuteLiverFailureRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricAcuteLiverFailureRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<PediatricAcuteLiverFailureFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showEpisodeModal, setShowEpisodeModal] = useState<boolean>(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricAcuteLiverFailureEpisodes({ patientId });
      setEpisodes(res.episodes || []);
      if (res.episodes && res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getPediatricAcuteLiverFailureEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric acute liver failure records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleSelectEpisode = async (ep: PediatricAcuteLiverFailureRecord) => {
    try {
      const epRes = await getPediatricAcuteLiverFailureEpisode(ep.id);
      setSelectedEpisode(epRes.episode);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to select episode');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const updated = await patchPediatricAcuteLiverFailureStatus(selectedEpisode.id, newStatus);
      setSelectedEpisode(updated.episode);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this PALF episode?')) return;
    try {
      await deletePediatricAcuteLiverFailureEpisode(id);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this bedside flowsheet checkpoint?')) return;
    try {
      await deletePediatricAcuteLiverFailureFlowsheet(selectedEpisode.id, logId);
      const epRes = await getPediatricAcuteLiverFailureEpisode(selectedEpisode.id);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading) return <div>Loading Pediatric Acute Liver Failure (PALF) records...</div>;

  let evaluation: PediatricAcuteLiverFailureResult | null = null;
  if (selectedEpisode) {
    evaluation = evaluatePediatricAcuteLiverFailure({
      ageMonths: selectedEpisode.age_months,
      weightKg: selectedEpisode.weight_kg,
      suspectedEtiology: selectedEpisode.suspected_etiology,
      encephalopathyStage: selectedEpisode.encephalopathy_stage as HepaticEncephalopathyGrade,
      inr: selectedEpisode.inr,
      totalBilirubinMgDl: selectedEpisode.total_bilirubin_mg_dl,
      directBilirubinMgDl: selectedEpisode.direct_bilirubin_mg_dl,
      altUL: selectedEpisode.alt_u_l,
      astUL: selectedEpisode.ast_u_l,
      serumAmmoniaUmolL: selectedEpisode.serum_ammonia_umol_l,
      bloodGlucoseMgDl: selectedEpisode.blood_glucose_mg_dl,
      serumSodiumMeqL: selectedEpisode.serum_sodium_meq_l,
      serumCreatinineMgDl: selectedEpisode.serum_creatinine_mg_dl,
      hasCerebralEdema: Boolean(selectedEpisode.has_cerebral_edema),
    });
  }

  return (
    <div className="tab-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Series 41C: Pediatric Acute Liver Failure (PALF) & Neuroprotection</h3>
        <button className="btn primary" onClick={() => setShowEpisodeModal(true)}>
          + Initiate PALF Protocol
        </button>
      </div>

      {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

      {episodes.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p>No pediatric acute liver failure episodes logged for this patient.</p>
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
                    INR: <strong>{ep.inr}</strong> | Grade {ep.encephalopathy_stage} HE
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
                      Age: {(selectedEpisode.age_months / 12).toFixed(1)} yrs ({selectedEpisode.age_months}m) |
                      Weight: {selectedEpisode.weight_kg} kg
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
                      href={`/protocols/palf/print/${selectedEpisode.id}`}
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
                      evaluation.palfSeverityCategory === 'fulminant_hepatic_failure'
                        ? 'border-danger'
                        : evaluation.palfSeverityCategory === 'acute_liver_injury_coagulopathy'
                        ? 'border-warning'
                        : 'border-info'
                    }`}
                    style={{ marginTop: 16, padding: 12 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge" style={{ fontWeight: 'bold' }}>
                        {evaluation.severityLabel}
                      </span>
                      <span style={{ color: evaluation.kingsCollege.isCriteriaMet ? '#d9534f' : 'inherit', fontWeight: 'bold' }}>
                        King&apos;s College Criteria: {evaluation.kingsCollege.isCriteriaMet ? 'POSITIVE' : 'Negative'}
                      </span>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <strong>Transplant Listing: </strong> {evaluation.kingsCollege.rationale}
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <strong>Neuroprotection Directives: </strong>
                      {evaluation.neuroprotectionPlan.targetSodiumMeqL} • {evaluation.neuroprotectionPlan.nAcetylcysteineDirectives}
                    </div>

                    {evaluation.clinicalAlerts.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong style={{ color: '#d9534f' }}>Critical Clinical Alerts:</strong>
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
                    <strong>Etiology:</strong> {selectedEpisode.suspected_etiology}
                  </div>
                  <div>
                    <strong>INR:</strong> {selectedEpisode.inr}
                  </div>
                  <div>
                    <strong>Encephalopathy Grade:</strong> Grade {selectedEpisode.encephalopathy_stage}
                  </div>
                  <div>
                    <strong>Total / Direct Bili:</strong> {selectedEpisode.total_bilirubin_mg_dl} / {selectedEpisode.direct_bilirubin_mg_dl ?? '-'} mg/dL
                  </div>
                  <div>
                    <strong>ALT / AST:</strong> {selectedEpisode.alt_u_l} / {selectedEpisode.ast_u_l} U/L
                  </div>
                  <div>
                    <strong>Ammonia:</strong> {selectedEpisode.serum_ammonia_umol_l ?? '-'} µmol/L
                  </div>
                  <div>
                    <strong>3% Saline Active:</strong> {selectedEpisode.hypertonic_saline_3pct_active ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>IV NAC Active:</strong> {selectedEpisode.nac_infusion_active ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>Transplant Center Alerted:</strong> {selectedEpisode.transplant_center_contacted ? 'Yes' : 'No'}
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
                  <h4 style={{ margin: 0 }}>Bedside Neurological & PICU Surveillance Checkpoints ({flowsheetLogs.length})</h4>
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
                          <th>Grade / GCS</th>
                          <th>Pupils</th>
                          <th>MAP / HR</th>
                          <th>Na+ / Glucose</th>
                          <th>Ammonia</th>
                          <th>Stools</th>
                          <th>ICP Monitoring & Notes</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flowsheetLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{new Date(log.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>Grade {log.encephalopathy_stage} (GCS {log.gcs_score ?? '-'})</td>
                            <td>{log.pupil_reactivity}</td>
                            <td>{log.mean_arterial_pressure_mmhg ? `${log.mean_arterial_pressure_mmhg} mmHg` : '-'} ({log.heart_rate_bpm ?? '-'} bpm)</td>
                            <td>Na: {log.serum_sodium_meq_l ?? '-'} | Gluc: {log.blood_glucose_mg_dl ?? '-'}</td>
                            <td>{log.serum_ammonia_umol_l ? `${log.serum_ammonia_umol_l} µmol/L` : '-'}</td>
                            <td>{log.daily_stool_count}</td>
                            <td>
                              {log.icp_monitoring_notes && <div><strong>ICP:</strong> {log.icp_monitoring_notes}</div>}
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
        <PediatricAcuteLiverFailureModal
          patientId={patientId}
          existingEpisode={selectedEpisode}
          onClose={() => setShowEpisodeModal(false)}
          onSaved={loadData}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <PediatricAcuteLiverFailureFlowsheetModal
          episodeId={selectedEpisode.id}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
};
