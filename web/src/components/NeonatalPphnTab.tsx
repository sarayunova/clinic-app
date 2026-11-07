import React, { useState, useEffect, useCallback } from 'react';
import {
  getNeonatalPphnEpisodes,
  getNeonatalPphnEpisode,
  deleteNeonatalPphnEpisode,
  deleteNeonatalPphnFlowsheet,
  NeonatalPphnRecord,
  NeonatalPphnFlowsheetRecord,
} from '../api';
import { NeonatalPphnModal } from './NeonatalPphnModal';
import { NeonatalPphnFlowsheetModal } from './NeonatalPphnFlowsheetModal';

interface Props {
  patientId: number;
}

export const NeonatalPphnTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalPphnRecord[]>([]);
  const [selectedEpId, setSelectedEpId] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalPphnRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalPphnFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const loadEpisodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNeonatalPphnEpisodes({ patientId });
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
      const res = await getNeonatalPphnEpisode(id);
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
    if (!confirm('Are you sure you want to delete this PPHN episode?')) return;
    await deleteNeonatalPphnEpisode(id);
    setSelectedEpId(null);
    void loadEpisodes();
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpId || !confirm('Delete this observation log?')) return;
    await deleteNeonatalPphnFlowsheet(selectedEpId, logId);
    void loadDetail(selectedEpId);
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>🫁 Persistent Pulmonary Hypertension (PPHN) & iNO Protocol</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Oxygenation Index (OI) calculation, Inhaled Nitric Oxide (iNO) titration, and MetHb surveillance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn small primary" onClick={() => setShowCreateModal(true)}>
            + New PPHN Episode
          </button>
        </div>
      </div>

      {loading && <p className="muted">Loading PPHN episodes...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p className="muted" style={{ margin: 0 }}>No PPHN episodes recorded for this infant.</p>
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
              {ep.episode_code} ({new Date(ep.onset_datetime).toLocaleDateString()}) · OI {ep.calculated_oi}
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
                  evalResult.severityTier === 'critical_ecmo_oi_40_plus'
                    ? '#fee2e2'
                    : evalResult.severityTier === 'severe_oi_25_39'
                    ? '#ffedd5'
                    : '#e0f2fe',
                borderLeft: `6px solid ${
                  evalResult.severityTier === 'critical_ecmo_oi_40_plus'
                    ? '#dc2626'
                    : evalResult.severityTier === 'severe_oi_25_39'
                    ? '#f97316'
                    : '#0284c7'
                }`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17 }}>{evalResult.severityTitle}</h4>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Etiology: <strong>{selectedEpisode.primary_etiology.replace(/_/g, ' ')}</strong> · Gestation: <strong>{selectedEpisode.gestational_age_weeks}w</strong> ({selectedEpisode.birth_weight_grams}g)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge" style={{ fontSize: 15, padding: '6px 12px', fontWeight: 'bold' }}>
                    OI: {selectedEpisode.calculated_oi}
                  </span>
                  <span className="badge" style={{ fontSize: 15, padding: '6px 12px' }}>
                    Δ SpO2: {selectedEpisode.spo2_gradient}%
                  </span>
                  <a
                    className="btn small"
                    href={`/patients/${patientId}/neonatal-pphn/${selectedEpisode.id}/print`}
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
                <p style={{ margin: '4px 0' }}><strong>Ductal Shunting:</strong> {evalResult.ductalShuntInterpretation}</p>
                {evalResult.inoRecommended && (
                  <p style={{ margin: '4px 0', color: '#0369a1' }}>
                    <strong>Inhaled Nitric Oxide Status:</strong> Active at {selectedEpisode.ino_dose_ppm} ppm. Methemoglobin: {selectedEpisode.methemoglobin_percent ?? 'Not tested'}% ({evalResult.methemoglobinAdvice})
                  </p>
                )}
                {evalResult.ecmoReferralIndicated && (
                  <p style={{ margin: '4px 0', color: '#b91c1c', fontWeight: 'bold' }}>
                    🚨 ECMO Criteria Met: Oxygenation Index $\ge 40$. Contact ECMO Retrieval Team stat.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>⏱️ Serial PPHN & iNO Titration Flowsheet</h4>
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
                      <th>Time / Hr</th>
                      <th>Pre/Post SpO2</th>
                      <th>Δ SpO2</th>
                      <th>MAP / FiO2</th>
                      <th>PaO2</th>
                      <th>OI</th>
                      <th>iNO (ppm)</th>
                      <th>MetHb (%)</th>
                      <th>NO2 (ppm)</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <strong>+{l.hours_from_onset}h</strong>
                          <div className="muted small">{new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td>{l.preductal_spo2}% / {l.postductal_spo2}%</td>
                        <td>
                          <span style={{ color: l.spo2_gradient >= 10 ? '#b91c1c' : 'inherit', fontWeight: l.spo2_gradient >= 10 ? 'bold' : 'normal' }}>
                            {l.spo2_gradient}%
                          </span>
                        </td>
                        <td>{l.map_cmh2o} / {l.fio2_percent}%</td>
                        <td>{l.pao2_mmhg}</td>
                        <td>
                          <span className="badge" style={{ fontWeight: 'bold' }}>
                            {l.calculated_oi}
                          </span>
                        </td>
                        <td><strong>{l.ino_dose_ppm}</strong> ppm</td>
                        <td>
                          <span style={{ color: (l.methemoglobin_percent ?? 0) >= 2.5 ? '#b91c1c' : 'inherit' }}>
                            {l.methemoglobin_percent != null ? `${l.methemoglobin_percent}%` : '—'}
                          </span>
                        </td>
                        <td>{l.circuit_no2_ppm != null ? `${l.circuit_no2_ppm}` : '—'}</td>
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
        <NeonatalPphnModal
          patientId={patientId}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => void loadEpisodes()}
        />
      )}

      {showLogModal && selectedEpisode && (
        <NeonatalPphnFlowsheetModal
          episodeId={selectedEpisode.id}
          lastPreductal={selectedEpisode.preductal_spo2}
          lastPostductal={selectedEpisode.postductal_spo2}
          lastMap={selectedEpisode.mean_airway_pressure_cmh2o}
          lastFio2={selectedEpisode.fio2_percent}
          lastPao2={selectedEpisode.pao2_mmhg}
          lastInoDose={selectedEpisode.ino_dose_ppm}
          onClose={() => setShowLogModal(false)}
          onSaved={() => void loadDetail(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
