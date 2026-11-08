import React, { useState, useEffect } from 'react';
import {
  getObstetricPosttermEpisodes,
  getObstetricPosttermEpisode,
  updateObstetricPosttermEpisode,
  deleteObstetricPosttermEpisode,
  deleteObstetricPosttermFlowsheet,
  type ObstetricPosttermRecord,
  type ObstetricPosttermFlowsheetRecord,
} from '../api';
import { ObstetricPosttermModal } from './ObstetricPosttermModal';
import { ObstetricPosttermFlowsheetModal } from './ObstetricPosttermFlowsheetModal';

interface ObstetricPosttermTabProps {
  patientId: number;
  patientName: string;
}

export const ObstetricPosttermTab: React.FC<ObstetricPosttermTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricPosttermRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricPosttermRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricPosttermFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricPosttermEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load post-term episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getObstetricPosttermEpisode(id);
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
      const res = await updateObstetricPosttermEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this post-term evaluation record?')) return;
    try {
      await deleteObstetricPosttermEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteObstetricPosttermFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="obstetric-postterm-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: '#047857' }}>🩺 Post-Term & Bishop Cervical Ripening Protocol</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            ACOG Practice Bulletin No. 146: Oligohydramnios Surveillance, Modified Bishop Score & Safe Induction Pathways
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ backgroundColor: '#047857', borderColor: '#065f46' }}
          onClick={() => setShowModal(true)}
        >
          + Record Post-Term Evaluation
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && <p className="muted">Loading post-term pregnancy surveillance data...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', background: '#f8fafc' }}>
          <p className="muted" style={{ margin: 0 }}>
            No post-term or late-term pregnancy evaluations recorded for this patient.
          </p>
        </div>
      )}

      {episodes.length > 0 && selectedEpisode && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Episode List Sidebar */}
          <div className="card" style={{ padding: 12 }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b' }}>
              Assessments
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  className={`btn btn-sm ${ep.id === selectedEpisode.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', padding: 8 }}
                  onClick={() => loadDetail(ep.id)}
                >
                  <span style={{ fontWeight: 'bold' }}>{ep.episode_code}</span>
                  <span style={{ fontSize: '0.75rem' }}>{new Date(ep.assessment_datetime).toLocaleDateString()}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: ep.oligohydramnios_present ? '#dc2626' : '#047857',
                      fontWeight: 600,
                    }}
                  >
                    {ep.gestational_age_weeks}w (Bishop: {ep.bishop_score_total})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Episode Details */}
          <div className="stack" style={{ gap: 16 }}>
            {/* Main Header Card */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#047857' }}>
                    {selectedEpisode.gestational_age_weeks} Weeks — {selectedEpisode.postterm_classification === 'post_term_ge_42_0' ? 'Post-Term (≥42w)' : 'Late-Term (41+0 to 41+6w)'}
                  </h4>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Assessed: {new Date(selectedEpisode.assessment_datetime).toLocaleString()} | Dating: {selectedEpisode.dating_method.replace(/_/g, ' ')} | AFI: {selectedEpisode.amniotic_fluid_index_cm} cm (SDP: {selectedEpisode.single_deepest_pocket_cm} cm)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-control"
                    style={{ width: 'auto', fontSize: '0.85rem' }}
                    value={selectedEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="outpatient_surveillance">Outpatient Surveillance</option>
                    <option value="inpatient_cervical_ripening">Inpatient Cervical Ripening</option>
                    <option value="oxytocin_labor_induction">Oxytocin Labor Induction</option>
                    <option value="cesarean_delivery">Cesarean Delivery</option>
                    <option value="postpartum_completed">Postpartum Completed</option>
                  </select>
                  <a
                    href={`/obstetric-postterm/${selectedEpisode.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-secondary"
                  >
                    🖨️ Print Dossier
                  </a>
                  <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              <div
                style={{
                  background: selectedEpisode.oligohydramnios_present ? '#fef2f2' : '#f0fdf4',
                  borderLeft: `4px solid ${selectedEpisode.oligohydramnios_present ? '#ef4444' : '#10b981'}`,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: selectedEpisode.oligohydramnios_present ? '#b91c1c' : '#047857' }}>
                      {evalResult?.summary || 'Post-Term Pregnancy Evaluation'}
                    </strong>
                    <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: 4 }}>
                      {evalResult?.ripeningGuidance}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: selectedEpisode.cervix_favorable ? '#10b981' : '#f59e0b',
                      color: '#fff',
                      padding: '6px 12px',
                    }}
                  >
                    Bishop: {selectedEpisode.bishop_score_total}/13 ({selectedEpisode.cervix_favorable ? 'Favorable >6' : 'Unfavorable ≤6'})
                  </span>
                </div>
              </div>

              {/* Bishop Score & Pelvic Findings Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Dilation & Effacement</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {selectedEpisode.cervical_dilation_cm} cm | {selectedEpisode.cervical_effacement_pct}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Station: {selectedEpisode.fetal_station >= 0 ? `+${selectedEpisode.fetal_station}` : selectedEpisode.fetal_station}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Consistency & Position</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {selectedEpisode.cervical_consistency.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {selectedEpisode.cervical_position.toUpperCase()}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Amniotic Fluid (AFI/SDP)</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: selectedEpisode.oligohydramnios_present ? '#dc2626' : '#16a34a' }}>
                    {selectedEpisode.amniotic_fluid_index_cm} cm ({selectedEpisode.oligohydramnios_present ? 'Oligohydramnios' : 'Normal'})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Deepest Pocket: {selectedEpisode.single_deepest_pocket_cm} cm
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Recommended Method</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#047857' }}>
                    {selectedEpisode.recommended_ripening_method.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {selectedEpisode.prior_cesarean_section ? 'Prior CS: Prostaglandins Contradicted' : 'Unscarred Uterus'}
                  </div>
                </div>
              </div>

              {/* Warning for Prior Cesarean */}
              {selectedEpisode.prior_cesarean_section === 1 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: '#b91c1c', fontSize: '0.85rem' }}>
                    ⚠️ UTERINE SCAR SAFETY ALERT (ACOG PB 146)
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#991b1b', marginTop: 4 }}>
                    Patient has a history of prior Cesarean delivery. Prostaglandin analogs (Misoprostol PGE1 and Dinoprostone PGE2) are strictly contraindicated due to elevated uterine rupture risk. Mechanical cervical dilation with a Foley balloon catheter is mandatory.
                  </div>
                </div>
              )}

              {/* Stepwise Action Plan */}
              {evalResult?.clinicalActionPlan && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: '#065f46', fontSize: '0.85rem', marginBottom: 6 }}>
                    📋 Clinical Action Pathway
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#047857' }}>
                    {evalResult.clinicalActionPlan.map((step: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: 2 }}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {selectedEpisode.clinical_notes && (
                <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: 8, borderRadius: 4 }}>
                  <strong>Notes:</strong> {selectedEpisode.clinical_notes}
                </div>
              )}
            </div>

            {/* Bedside Flowsheet */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, color: '#047857' }}>
                  ⏱️ Bedside Ripening & Labor Flowsheet ({logs.length} checkpoints)
                </h4>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ backgroundColor: '#047857', borderColor: '#065f46' }}
                  onClick={() => setShowFlowsheetModal(true)}
                >
                  + Add Checkpoint
                </button>
              </div>

              {logs.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  No bedside cervical ripening checkpoints logged yet. Click "+ Add Checkpoint" to document serial Bishop exams, contractions, and fetal heart rate responses.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: 6 }}>Time (+Hours)</th>
                        <th style={{ padding: 6 }}>Bishop Score</th>
                        <th style={{ padding: 6 }}>Dilation / Effacement</th>
                        <th style={{ padding: 6 }}>Contractions / 10m</th>
                        <th style={{ padding: 6 }}>FHR & CTG</th>
                        <th style={{ padding: 6 }}>Action Taken</th>
                        <th style={{ padding: 6 }}>Notes</th>
                        <th style={{ padding: 6, textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: 6 }}>
                            <div>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <small className="muted">+{log.hours_from_ripening_start}h</small>
                          </td>
                          <td style={{ padding: 6 }}>
                            <strong style={{ color: log.bishop_score_current > 6 ? '#10b981' : '#f59e0b' }}>
                              {log.bishop_score_current}/13
                            </strong>
                          </td>
                          <td style={{ padding: 6 }}>
                            {log.dilation_cm} cm | {log.effacement_pct}%
                          </td>
                          <td style={{ padding: 6 }}>
                            <span style={{ color: log.contractions_per_10min > 5 ? '#dc2626' : 'inherit', fontWeight: log.contractions_per_10min > 5 ? 700 : 400 }}>
                              {log.contractions_per_10min}/10m {log.tachysystole_present ? '(Tachysystole)' : ''}
                            </span>
                          </td>
                          <td style={{ padding: 6 }}>
                            {log.fetal_heart_rate_bpm} bpm ({log.fhr_category.replace(/_/g, ' ')})
                          </td>
                          <td style={{ padding: 6 }}>
                            <strong style={{ color: '#047857' }}>{log.action_taken.replace(/_/g, ' ')}</strong>
                          </td>
                          <td style={{ padding: 6, maxWidth: 200 }}>{log.notes || '—'}</td>
                          <td style={{ padding: 6, textAlign: 'right' }}>
                            <button
                              className="btn btn-sm btn-outline-danger"
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
          </div>
        </div>
      )}

      {showModal && (
        <ObstetricPosttermModal
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
        <ObstetricPosttermFlowsheetModal
          episodeId={selectedEpisode.id}
          patientId={patientId}
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
