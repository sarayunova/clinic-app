import React, { useState, useEffect, useCallback } from 'react';
import {
  getPediatricAsthmaEpisodes,
  getPediatricAsthmaEpisode,
  deletePediatricAsthmaEpisode,
  deletePediatricAsthmaFlowsheet,
  PediatricAsthmaStatusRecord,
  PediatricAsthmaStatusFlowsheetRecord,
} from '../api';
import { PediatricAsthmaStatusModal } from './PediatricAsthmaStatusModal';
import { PediatricAsthmaStatusFlowsheetModal } from './PediatricAsthmaStatusFlowsheetModal';

interface Props {
  patientId: number;
}

export const PediatricAsthmaStatusTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricAsthmaStatusRecord[]>([]);
  const [selectedEpId, setSelectedEpId] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricAsthmaStatusRecord | null>(null);
  const [logs, setLogs] = useState<PediatricAsthmaStatusFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const loadEpisodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPediatricAsthmaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && !selectedEpId) {
        setSelectedEpId(res.episodes[0]!.id);
      }
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedEpId]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await getPediatricAsthmaEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void loadEpisodes();
  }, [loadEpisodes]);

  useEffect(() => {
    if (selectedEpId) {
      void loadDetail(selectedEpId);
    } else {
      setSelectedEpisode(null);
      setLogs([]);
      setEvalResult(null);
    }
  }, [selectedEpId, loadDetail]);

  const handleDeleteEpisode = async (id: number) => {
    if (!confirm('Are you sure you want to delete this status asthmaticus episode?')) return;
    await deletePediatricAsthmaEpisode(id);
    setSelectedEpId(null);
    void loadEpisodes();
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpId || !confirm('Delete this observation log?')) return;
    await deletePediatricAsthmaFlowsheet(selectedEpId, logId);
    void loadDetail(selectedEpId);
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>🫁 Pediatric Status Asthmaticus & M-WCAS Resuscitation</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Modified Wood's Clinical Asthma Score, Continuous Bronchodilator Infusions & High-Dependency PICU Escalation
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn small primary" onClick={() => setShowCreateModal(true)}>
            + New Asthma Episode
          </button>
        </div>
      </div>

      {loading && <p className="muted">Loading asthma episodes...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p className="muted" style={{ margin: 0 }}>No status asthmaticus episodes recorded for this child.</p>
        </div>
      )}

      {episodes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {episodes.map((ep) => (
            <button
              key={ep.id}
              type="button"
              className={`btn small ${selectedEpId === ep.id ? 'primary' : ''}`}
              onClick={() => setSelectedEpId(ep.id)}
            >
              {ep.episode_code} ({new Date(ep.onset_datetime).toLocaleDateString()}) · M-WCAS {ep.total_mwcas_score}/10
            </button>
          ))}
        </div>
      )}

      {selectedEpisode && (
        <div className="stack">
          {evalResult && (
            <div
              style={{
                padding: '16px',
                borderRadius: 8,
                backgroundColor:
                  evalResult.severityTier === 'severe_impending_failure_7_10'
                    ? '#fee2e2'
                    : evalResult.severityTier === 'moderate_4_6'
                    ? '#ffedd5'
                    : '#ecfdf5',
                borderLeft: `6px solid ${
                  evalResult.severityTier === 'severe_impending_failure_7_10'
                    ? '#dc2626'
                    : evalResult.severityTier === 'moderate_4_6'
                    ? '#f97316'
                    : '#10b981'
                }`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17 }}>{evalResult.severityTitle}</h4>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Age: <strong>{selectedEpisode.age_months}m</strong> ({selectedEpisode.weight_kg}kg) · SpO2 (RA): <strong>{selectedEpisode.spo2_room_air_percent}%</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge" style={{ fontSize: 15, padding: '6px 12px', fontWeight: 'bold' }}>
                    M-WCAS: {selectedEpisode.total_mwcas_score} / 10
                  </span>
                  <a
                    className="btn small"
                    href={`/patients/${patientId}/pediatric-asthma/${selectedEpisode.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🖨️ Print Dossier
                  </a>
                  <button
                    type="button"
                    className="btn small"
                    style={{ color: '#b91c1c' }}
                    onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 13 }}>
                <p style={{ margin: '4px 0' }}><strong>Blood Gas Analysis:</strong> {evalResult.vbgInterpretation}</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                  <span>Continuous Albuterol: <strong>{evalResult.albuterolContinuous.recommendedDose}</strong></span>
                  <span>IV Magnesium: <strong>{evalResult.ivMagnesiumSulfate.recommendedDose}</strong></span>
                  <span>IV Steroids: <strong>{evalResult.systemicSteroids.recommendedDose}</strong></span>
                </div>
                {evalResult.respiratoryExhaustionRisk && (
                  <p style={{ margin: '6px 0 0', color: '#b91c1c', fontWeight: 'bold' }}>
                    🚨 Respiratory Exhaustion Warning: Prepare for non-invasive BiPAP or rapid-sequence intubation with Ketamine.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>⏱️ Serial M-WCAS & Bronchodilator Flowsheet</h4>
              <button type="button" className="btn small primary" onClick={() => setShowLogModal(true)}>
                + Log Observation
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="muted small">No serial flowsheet observations logged yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ fontSize: 13, width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Min / Time</th>
                      <th>RR</th>
                      <th>HR</th>
                      <th>SpO2 (FiO2)</th>
                      <th>M-WCAS</th>
                      <th>Albuterol (mg/h)</th>
                      <th>Terbutaline</th>
                      <th>BiPAP</th>
                      <th>VBG pH/pCO2</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <strong>+{l.minutes_from_triage}m</strong>
                          <div className="muted small">{new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td><strong>{l.respiratory_rate}</strong> /min</td>
                        <td>{l.heart_rate} bpm</td>
                        <td>{l.spo2_percent}% ({l.fio2_percent}%)</td>
                        <td>
                          <span className="badge" style={{ fontWeight: 'bold' }}>
                            {l.total_mwcas_score} / 10
                          </span>
                        </td>
                        <td>{l.albuterol_rate_mg_hr != null ? `${l.albuterol_rate_mg_hr}` : '—'}</td>
                        <td>{l.terbutaline_rate_mcg_kg_min != null ? `${l.terbutaline_rate_mcg_kg_min}` : '—'}</td>
                        <td className="muted small">{l.bipap_settings ?? '—'}</td>
                        <td>{l.vbg_ph != null && l.vbg_pco2_mmhg != null ? `${l.vbg_ph} / ${l.vbg_pco2_mmhg}` : '—'}</td>
                        <td className="muted small">{l.notes ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn small"
                            style={{ color: '#b91c1c', padding: '2px 6px' }}
                            onClick={() => handleDeleteLog(l.id)}
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

      {showCreateModal && (
        <PediatricAsthmaStatusModal
          patientId={patientId}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => void loadEpisodes()}
        />
      )}

      {showLogModal && selectedEpisode && (
        <PediatricAsthmaStatusFlowsheetModal
          episodeId={selectedEpisode.id}
          lastAlbuterolRate={Number(selectedEpisode.tier1_continuous_albuterol ? 8.0 : 0)}
          onClose={() => setShowLogModal(false)}
          onSaved={() => void loadDetail(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
