import React, { useState, useEffect } from 'react';
import {
  getNeonatalHypocalcemiaEpisodes,
  getNeonatalHypocalcemiaEpisode,
  updateNeonatalHypocalcemiaEpisode,
  deleteNeonatalHypocalcemiaEpisode,
  deleteNeonatalHypocalcemiaFlowsheet,
  type NeonatalHypocalcemiaRecord,
  type NeonatalHypocalcemiaFlowsheetRecord,
} from '../api';
import { NeonatalHypocalcemiaModal } from './NeonatalHypocalcemiaModal';
import { NeonatalHypocalcemiaFlowsheetModal } from './NeonatalHypocalcemiaFlowsheetModal';

interface NeonatalHypocalcemiaTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalHypocalcemiaTab: React.FC<NeonatalHypocalcemiaTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalHypocalcemiaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalHypocalcemiaRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalHypocalcemiaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalHypocalcemiaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load neonatal hypocalcemia episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getNeonatalHypocalcemiaEpisode(id);
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
      const res = await updateNeonatalHypocalcemiaEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this neonatal hypocalcemia record?')) return;
    try {
      await deleteNeonatalHypocalcemiaEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalHypocalcemiaFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet entry');
    }
  };

  return (
    <div className="neonatal-hypocalcemia-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: '#b45309' }}>🧪 Neonatal Hypocalcemia & Electrolyte Protocol</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            AAP / NICE Guidelines: Ionized Calcium Titration, 10% Calcium Gluconate Bolus & Magnesium Correction
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ backgroundColor: '#b45309', borderColor: '#92400e' }}
          onClick={() => setShowModal(true)}
        >
          + Initiate Hypocalcemia Protocol
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && <p className="muted">Loading neonatal electrolyte data...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', background: '#f8fafc' }}>
          <p className="muted" style={{ margin: 0 }}>
            No hypocalcemia or electrolyte emergency episodes recorded for this infant.
          </p>
        </div>
      )}

      {episodes.length > 0 && selectedEpisode && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Sidebar */}
          <div className="card" style={{ padding: 12 }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b' }}>
              Hypocalcemia Episodes
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
                  <span style={{ fontSize: '0.75rem' }}>{new Date(ep.diagnosis_datetime).toLocaleDateString()}</span>
                  <span style={{ fontSize: '0.75rem', color: ep.emergency_bolus_indicated ? '#dc2626' : '#b45309', fontWeight: 600 }}>
                    iCa: {ep.ionized_calcium_mmol_l} mmol/L ({ep.onset_timing.replace(/_/g, ' ')})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Episode Details */}
          <div className="stack" style={{ gap: 16 }}>
            {/* Header Card */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#b45309' }}>
                    iCa {selectedEpisode.ionized_calcium_mmol_l} mmol/L | Total Ca {selectedEpisode.total_calcium_mg_dl} mg/dL — {selectedEpisode.emergency_bolus_indicated ? '🚨 EMERGENCY IV BOLUS INDICATED' : 'STABLE CORRECTION'}
                  </h4>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Diagnosed: {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()} | Age: {selectedEpisode.chronological_age_hours}h ({selectedEpisode.onset_timing.replace(/_/g, ' ')}) | Etiology: {selectedEpisode.etiology_category.replace(/_/g, ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-control"
                    style={{ width: 'auto', fontSize: '0.85rem' }}
                    value={selectedEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="acute_iv_correction">Acute IV Correction</option>
                    <option value="maintenance_infusion_weaning">Maintenance & Weaning</option>
                    <option value="transitioned_to_oral_supplements">Transitioned to Oral</option>
                    <option value="eucalcemic_resolved">Eucalcemic Resolved</option>
                  </select>
                  <a
                    href={`/neonatal-hypocalcemia/${selectedEpisode.id}/print`}
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
                  background: selectedEpisode.emergency_bolus_indicated ? '#fef2f2' : '#fffbeb',
                  borderLeft: `4px solid ${selectedEpisode.emergency_bolus_indicated ? '#ef4444' : '#f59e0b'}`,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: selectedEpisode.emergency_bolus_indicated ? '#b91c1c' : '#b45309' }}>
                      {evalResult?.summary || 'Neonatal Hypocalcemia Evaluation'}
                    </strong>
                    <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 4 }}>
                      Symptom Presentation: <strong>{selectedEpisode.symptom_details.replace(/_/g, ' ').toUpperCase()}</strong>
                      {selectedEpisode.ecg_qtc_seconds ? ` | ECG QTc: ${selectedEpisode.ecg_qtc_seconds}s (${selectedEpisode.ecg_prolonged_qtc ? 'Prolonged' : 'Normal'})` : ''}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: selectedEpisode.status === 'acute_iv_correction' ? '#dc2626' : '#16a34a',
                      color: '#fff',
                      padding: '6px 12px',
                    }}
                  >
                    {selectedEpisode.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Protocol Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.85rem', marginBottom: 6 }}>
                    💉 10% Calcium Gluconate IV Bolus (200 mg/kg)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Bolus Volume (undiluted):</span>
                    <strong style={{ color: '#1e40af' }}>{selectedEpisode.calcium_gluconate_10pct_bolus_ml} mL</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Diluted 1:1 with D5W:</span>
                    <strong style={{ color: '#1e40af' }}>{Math.round(selectedEpisode.calcium_gluconate_10pct_bolus_ml * 2 * 10) / 10} mL</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: 6 }}>
                    Administer SLOWLY over 10-30 min with continuous ECG. Stop immediately if HR &lt; 100 bpm.
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontWeight: 600, color: '#15803d', fontSize: '0.85rem', marginBottom: 6 }}>
                    💧 IV Maintenance Infusion (400 mg/kg/day)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Daily Maintenance Volume:</span>
                    <strong style={{ color: '#15803d' }}>
                      {evalResult?.calciumGluconateMaintenanceMlPerDay ?? Math.round((selectedEpisode.birth_weight_grams / 1000) * 4 * 10) / 10} mL/day
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Dose:</span>
                    <strong style={{ color: '#15803d' }}>{selectedEpisode.calcium_gluconate_maintenance_mg_kg_day} mg/kg/day</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 6 }}>
                    Verify IV line patency q1h. Extravasation causes severe skin necrosis / calcinosis cutis.
                  </div>
                </div>
              </div>

              {/* Hypomagnesemia Warning Card */}
              {selectedEpisode.concurrent_hypomagnesemia === 1 && (
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.85rem', marginBottom: 4 }}>
                    ⚠️ Concurrent Hypomagnesemia (Serum Mg: {selectedEpisode.serum_magnesium_mg_dl} mg/dL &lt; 1.5 mg/dL)
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#78350f' }}>
                    Magnesium deficiency blocks PTH secretion and induces end-organ PTH resistance. Administer <strong>50% Magnesium Sulfate: {selectedEpisode.magnesium_sulfate_50pct_dose_ml ?? '0.2 mL/kg'} mL</strong> slow IV over 1-2h or deep IM. Calcium correction remains refractory until magnesium is normalized.
                  </div>
                </div>
              )}

              {/* Action Plan */}
              {evalResult?.criticalActionPlan && (
                <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: '#6b21a8', fontSize: '0.85rem', marginBottom: 6 }}>
                    📋 Stepwise Clinical Action Plan
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#581c87' }}>
                    {evalResult.criticalActionPlan.map((step: string, idx: number) => (
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
                <h4 style={{ margin: 0, color: '#b45309' }}>
                  ⏱️ Bedside Calcium Infusion Flowsheet ({logs.length} checkpoints)
                </h4>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ backgroundColor: '#b45309', borderColor: '#92400e' }}
                  onClick={() => setShowFlowsheetModal(true)}
                >
                  + Add Flowsheet Checkpoint
                </button>
              </div>

              {logs.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  No bedside checkpoint logs yet. Click "+ Add Flowsheet Checkpoint" to document ionized calcium, heart rate, infusion rates, and line patency.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: 6 }}>Time (+Hours)</th>
                        <th style={{ padding: 6 }}>Heart Rate</th>
                        <th style={{ padding: 6 }}>iCa (mmol/L)</th>
                        <th style={{ padding: 6 }}>Rate (mL/hr)</th>
                        <th style={{ padding: 6 }}>IV Site Patency</th>
                        <th style={{ padding: 6 }}>Tone / Jitteriness</th>
                        <th style={{ padding: 6 }}>ECG Strip</th>
                        <th style={{ padding: 6 }}>Notes</th>
                        <th style={{ padding: 6, textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: 6 }}>
                            <div>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <small className="muted">+{log.hours_from_initiation}h</small>
                          </td>
                          <td style={{ padding: 6 }}>
                            <strong style={{ color: log.heart_rate_bpm < 100 ? '#dc2626' : '#16a34a' }}>
                              {log.heart_rate_bpm} bpm
                            </strong>
                          </td>
                          <td style={{ padding: 6 }}>
                            <strong style={{ color: log.ionized_calcium_mmol_l < 1.0 ? '#dc2626' : '#16a34a' }}>
                              {log.ionized_calcium_mmol_l} mmol/L
                            </strong>
                          </td>
                          <td style={{ padding: 6 }}>{log.calcium_infusion_rate_ml_hr} mL/hr</td>
                          <td style={{ padding: 6 }}>
                            <span
                              className="badge"
                              style={{
                                background: log.iv_site_condition === 'patent_no_extravasation' ? '#16a34a' : '#dc2626',
                                color: '#fff',
                                padding: '2px 6px',
                                fontSize: '0.75rem',
                              }}
                            >
                              {log.iv_site_condition.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: 6 }}>{log.clinical_neuromuscular_state.replace(/_/g, ' ')}</td>
                          <td style={{ padding: 6 }}>{log.ecg_rhythm_strip.replace(/_/g, ' ')}</td>
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
        <NeonatalHypocalcemiaModal
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
        <NeonatalHypocalcemiaFlowsheetModal
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
