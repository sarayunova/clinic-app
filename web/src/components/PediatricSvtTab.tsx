import React, { useState, useEffect } from 'react';
import {
  getPediatricSvtEpisodes,
  getPediatricSvtEpisode,
  updatePediatricSvtEpisode,
  deletePediatricSvtEpisode,
  deletePediatricSvtFlowsheet,
  type PediatricSvtRecord,
  type PediatricSvtFlowsheetRecord,
} from '../api';
import { PediatricSvtModal } from './PediatricSvtModal';
import { PediatricSvtFlowsheetModal } from './PediatricSvtFlowsheetModal';

interface PediatricSvtTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricSvtTab: React.FC<PediatricSvtTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<PediatricSvtRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricSvtRecord | null>(null);
  const [logs, setLogs] = useState<PediatricSvtFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricSvtEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric SVT episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getPediatricSvtEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load SVT episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const res = await updatePediatricSvtEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this pediatric SVT episode record?')) return;
    try {
      await deletePediatricSvtEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deletePediatricSvtFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet entry');
    }
  };

  return (
    <div className="pediatric-svt-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: '#dc2626' }}>⚡ Pediatric SVT & Emergency Dysrhythmia Protocol</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            AHA/AAP PALS 2020 & PACES: Narrow Complex SVT Differentiation, Vagal Maneuvers, Rapid Adenosine Flush & Synchronized Cardioversion
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
          onClick={() => setShowModal(true)}
        >
          + Initiate SVT Resuscitation
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && <p className="muted">Loading pediatric SVT protocol data...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', background: '#f8fafc' }}>
          <p className="muted" style={{ margin: 0 }}>
            No supraventricular tachycardia resuscitation episodes recorded for this patient.
          </p>
        </div>
      )}

      {episodes.length > 0 && selectedEpisode && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Episode List Sidebar */}
          <div className="card" style={{ padding: 12 }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b' }}>
              SVT Episodes
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  className={`btn btn-sm ${ep.id === selectedEpisode.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 8,
                    borderColor: ep.hemodynamic_stability === 'unstable_decompensated_shock' ? '#ef4444' : undefined,
                  }}
                  onClick={() => loadDetail(ep.id)}
                >
                  <span style={{ fontWeight: 'bold' }}>{ep.episode_code}</span>
                  <span style={{ fontSize: '0.75rem' }}>{new Date(ep.onset_datetime).toLocaleDateString()}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: ep.hemodynamic_stability === 'unstable_decompensated_shock' ? '#dc2626' : '#16a34a',
                      fontWeight: 600,
                    }}
                  >
                    {ep.heart_rate_bpm} bpm ({ep.hemodynamic_stability === 'unstable_decompensated_shock' ? 'UNSTABLE' : 'STABLE'})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Episode Details */}
          <div className="stack" style={{ gap: 16 }}>
            {/* Main Assessment Card */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#dc2626' }}>
                    HR: {selectedEpisode.heart_rate_bpm} bpm — {selectedEpisode.hemodynamic_stability === 'unstable_decompensated_shock' ? '🚨 UNSTABLE DECOMPENSATED SHOCK' : '✅ STABLE COMPENSATED PERFUSION'}
                  </h4>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Onset: {new Date(selectedEpisode.onset_datetime).toLocaleString()} | Age: {selectedEpisode.age_months}m | Weight: {selectedEpisode.weight_kg} kg | QRS: {selectedEpisode.qrs_duration_ms} ms ({selectedEpisode.qrs_morphology.replace(/_/g, ' ')})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-control"
                    style={{ width: 'auto', fontSize: '0.85rem' }}
                    value={selectedEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="acute_svt_resuscitation">Acute SVT Resuscitation</option>
                    <option value="converted_sinus_surveillance">Converted Sinus Surveillance</option>
                    <option value="refractory_picu_transfer">Refractory PICU Transfer</option>
                    <option value="discharged_maintenance_therapy">Discharged Maintenance</option>
                  </select>
                  <a
                    href={`/pediatric-svt/${selectedEpisode.id}/print`}
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

              {/* Status Alert Banner */}
              <div
                style={{
                  background: selectedEpisode.hemodynamic_stability === 'unstable_decompensated_shock' ? '#fef2f2' : '#f0fdf4',
                  borderLeft: `4px solid ${selectedEpisode.hemodynamic_stability === 'unstable_decompensated_shock' ? '#ef4444' : '#16a34a'}`,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: selectedEpisode.hemodynamic_stability === 'unstable_decompensated_shock' ? '#dc2626' : '#15803d' }}>
                      {evalResult?.summary || 'PALS SVT Clinical Evaluation'}
                    </strong>
                    <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 4 }}>
                      {evalResult?.diagnosticExplanation}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: selectedEpisode.hemodynamic_stability === 'unstable_decompensated_shock' ? '#dc2626' : '#16a34a',
                      color: '#fff',
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {selectedEpisode.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Critical Calculation Cards: Adenosine & Synchronized Cardioversion */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.85rem', marginBottom: 6 }}>
                    💉 PALS Adenosine Weight-Adjusted Rapid IV Doses
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>1st Dose (0.1 mg/kg, max 6 mg):</span>
                    <strong style={{ color: '#1e40af' }}>{selectedEpisode.adenosine_first_dose_mg} mg</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>2nd Dose (0.2 mg/kg, max 12 mg):</span>
                    <strong style={{ color: '#1e40af' }}>{selectedEpisode.adenosine_second_dose_mg} mg</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: 6 }}>
                    Administration: Rapid push via proximal large-bore IV with 2-syringe stopcock + immediate 5-10 mL saline flush.
                  </div>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontWeight: 600, color: '#b45309', fontSize: '0.85rem', marginBottom: 6 }}>
                    ⚡ Synchronized Electrical Cardioversion Energy
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Initial Shock (0.5 - 1.0 J/kg):</span>
                    <strong style={{ color: '#b45309' }}>{evalResult?.initialCardioversionJoules ?? selectedEpisode.synchronized_cardioversion_joules ?? Math.round(selectedEpisode.weight_kg * 1.0)} Joules</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Subsequent Shock (2.0 J/kg):</span>
                    <strong style={{ color: '#b45309' }}>{evalResult?.secondCardioversionJoules ?? Math.round(selectedEpisode.weight_kg * 2.0)} Joules</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 6 }}>
                    Mode: Defibrillator SYNCHRONIZED on R-wave. Indicated immediately for shock or if refractory to 2 Adenosine pushes.
                  </div>
                </div>
              </div>

              {/* Vagal Maneuver Guidance & Perfusion Detail */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Vagal Technique</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {selectedEpisode.vagal_maneuver_attempted.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: selectedEpisode.vagal_maneuver_successful ? '#16a34a' : '#64748b' }}>
                    {selectedEpisode.vagal_maneuver_successful ? '✅ Vagal Conversion Achieved' : 'Refractory / Not converted'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Hemodynamics & Perfusion</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {selectedEpisode.signs_of_shock.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: selectedEpisode.hemodynamic_stability === 'unstable_decompensated_shock' ? '#dc2626' : '#16a34a' }}>
                    {selectedEpisode.hemodynamic_stability === 'unstable_decompensated_shock' ? '🚨 Unstable Decompensated Shock' : '✅ Compensated Perfusion'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Maintenance Antiarrhythmic</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4338ca' }}>
                    {selectedEpisode.maintenance_antiarrhythmic.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Cardiology consultation indicated
                  </div>
                </div>
              </div>

              {/* Critical PALS Resuscitation Steps Checklist */}
              {evalResult?.criticalResuscitationSteps && (
                <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: '#6b21a8', fontSize: '0.85rem', marginBottom: 6 }}>
                    📋 PALS Stepwise Resuscitation Pathway
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#581c87' }}>
                    {evalResult.criticalResuscitationSteps.map((step: string, idx: number) => (
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

            {/* Bedside Flowsheet Table */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, color: '#dc2626' }}>
                  ⏱️ Bedside PALS Resuscitation Flowsheet ({logs.length} checkpoints)
                </h4>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                  onClick={() => setShowFlowsheetModal(true)}
                >
                  + Add Flowsheet Checkpoint
                </button>
              </div>

              {logs.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  No bedside checkpoint logs yet. Click "+ Add Flowsheet Checkpoint" to document heart rate, rhythm changes, adenosine flushes, or cardioversion responses.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: 6 }}>Time (+Mins)</th>
                        <th style={{ padding: 6 }}>Heart Rate</th>
                        <th style={{ padding: 6 }}>Rhythm State</th>
                        <th style={{ padding: 6 }}>BP (mmHg)</th>
                        <th style={{ padding: 6 }}>Cap Refill / SpO2</th>
                        <th style={{ padding: 6 }}>Mental Status</th>
                        <th style={{ padding: 6 }}>Intervention</th>
                        <th style={{ padding: 6 }}>Notes</th>
                        <th style={{ padding: 6, textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: 6 }}>
                            <div>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <small className="muted">T+{log.minutes_from_triage}m</small>
                          </td>
                          <td style={{ padding: 6 }}>
                            <strong style={{ color: log.heart_rate_bpm >= 200 ? '#dc2626' : '#16a34a' }}>
                              {log.heart_rate_bpm} bpm
                            </strong>
                          </td>
                          <td style={{ padding: 6 }}>
                            <span
                              className="badge"
                              style={{
                                background: log.rhythm_state === 'sinus_rhythm_restored' ? '#16a34a' : '#dc2626',
                                color: '#fff',
                                padding: '2px 6px',
                                fontSize: '0.75rem',
                              }}
                            >
                              {log.rhythm_state.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: 6 }}>
                            {log.sbp_mmhg} {log.dbp_mmhg ? `/ ${log.dbp_mmhg}` : ''}
                          </td>
                          <td style={{ padding: 6 }}>
                            {log.capillary_refill_seconds}s | {log.spo2_percent}%
                          </td>
                          <td style={{ padding: 6 }}>
                            <span style={{ color: log.mental_status === 'alert_normal' ? '#16a34a' : '#dc2626' }}>
                              {log.mental_status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: 6 }}>
                            <strong style={{ color: '#4338ca' }}>
                              {log.intervention_administered.replace(/_/g, ' ')}
                            </strong>
                          </td>
                          <td style={{ padding: 6, maxWidth: 200 }}>
                            {log.notes || '—'}
                          </td>
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
        <PediatricSvtModal
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
        <PediatricSvtFlowsheetModal
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
