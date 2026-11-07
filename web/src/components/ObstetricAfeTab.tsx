import React, { useState, useEffect, useCallback } from 'react';
import {
  getObstetricAfeEpisodes,
  getObstetricAfeEpisode,
  deleteObstetricAfeEpisode,
  deleteObstetricAfeFlowsheet,
  ObstetricAfeRecord,
  ObstetricAfeFlowsheetRecord,
} from '../api';
import { ObstetricAfeModal } from './ObstetricAfeModal';
import { ObstetricAfeFlowsheetModal } from './ObstetricAfeFlowsheetModal';

interface Props {
  patientId: number;
}

export const ObstetricAfeTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricAfeRecord[]>([]);
  const [selectedEpId, setSelectedEpId] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricAfeRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricAfeFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const loadEpisodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getObstetricAfeEpisodes({ patientId });
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
      const res = await getObstetricAfeEpisode(id);
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
    if (!confirm('Are you sure you want to delete this AFE resuscitation episode?')) return;
    await deleteObstetricAfeEpisode(id);
    setSelectedEpId(null);
    void loadEpisodes();
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpId || !confirm('Delete this observation log?')) return;
    await deleteObstetricAfeFlowsheet(selectedEpId, logId);
    void loadDetail(selectedEpId);
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>🩸 Amniotic Fluid Embolism (AFE) & A-OK Resuscitation Protocol</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Clark 4-Criteria Case Definition, A-OK Pharmacologic Resuscitation, and Massive Transfusion Surveillance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn small primary" onClick={() => setShowCreateModal(true)}>
            + New AFE Episode
          </button>
        </div>
      </div>

      {loading && <p className="muted">Loading AFE records...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p className="muted" style={{ margin: 0 }}>No AFE resuscitation episodes recorded for this patient.</p>
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
              {ep.episode_code} ({new Date(ep.arrest_onset_datetime).toLocaleDateString()}) · {ep.status.replace(/_/g, ' ')}
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
                backgroundColor: evalResult.clarkCriteriaMet ? '#fee2e2' : '#fef3c7',
                borderLeft: `6px solid ${evalResult.clarkCriteriaMet ? '#dc2626' : '#d97706'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17 }}>
                    {evalResult.clarkCriteriaMet ? '🚨 Clark 4-Criteria Validated AFE' : `⚠️ Criteria Score: ${evalResult.criteriaMetCount}/4`}
                  </h4>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Timing: <strong>{selectedEpisode.timing_relation.replace(/_/g, ' ')}</strong> · Gestation: <strong>{selectedEpisode.gestation_weeks}w</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge" style={{ fontSize: 14, fontWeight: 'bold' }}>
                    A-OK: {evalResult.aokRegimenComplete ? '✓ Complete' : 'Incomplete'}
                  </span>
                  <a
                    className="btn small"
                    href={`/patients/${patientId}/obstetric-afe/${selectedEpisode.id}/print`}
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
                <p style={{ margin: '4px 0' }}>
                  <strong>A-OK Resuscitation Drugs:</strong> Atropine: {selectedEpisode.atropine_given ? '✓ Given' : 'Pending'} · Ondansetron: {selectedEpisode.ondansetron_given ? '✓ Given' : 'Pending'} · Ketorolac: {selectedEpisode.ketorolac_given ? '✓ Given' : 'Pending'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>Coagulopathy Profile:</strong> Fibrinogen {selectedEpisode.fibrinogen_mg_dl ?? '—'} mg/dL · Platelets {selectedEpisode.platelet_count ?? '—'} · INR {selectedEpisode.pt_inr ?? '—'} · Transfused: {selectedEpisode.prbc_transfused_units} PRBC, {selectedEpisode.ffp_transfused_units} FFP, {selectedEpisode.cryoprecipitate_units} Cryo
                </p>
                {evalResult.cryoprecipitateIndicated && (
                  <p style={{ margin: '4px 0', color: '#b91c1c', fontWeight: 'bold' }}>
                    ⚠️ Severe Hypofibrinogenemia: Transfuse 10 units Cryoprecipitate stat. Target Fibrinogen $\ge 200$ mg/dL.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>⏱️ Serial Resuscitation & Hemodynamic Flowsheet</h4>
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
                      <th>Time / Min</th>
                      <th>BP (mmHg)</th>
                      <th>HR</th>
                      <th>SpO2 / EtCO2</th>
                      <th>Vasopressor</th>
                      <th>Fibrinogen</th>
                      <th>Platelets</th>
                      <th>INR</th>
                      <th>QBL (mL)</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <strong>+{l.minutes_from_arrest}m</strong>
                          <div className="muted small">{new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td>{l.sbp_mmhg != null && l.dbp_mmhg != null ? `${l.sbp_mmhg}/${l.dbp_mmhg}` : '—'}</td>
                        <td>{l.hr_bpm ?? '—'}</td>
                        <td>{l.spo2_percent != null ? `${l.spo2_percent}%` : '—'} / {l.etco2_mmhg != null ? `${l.etco2_mmhg}` : '—'}</td>
                        <td>
                          <span className="badge">{l.vasopressor_active.replace(/_/g, ' ')}</span>
                        </td>
                        <td>
                          <span style={{ color: (l.fibrinogen_mg_dl ?? 200) < 200 ? '#b91c1c' : 'inherit', fontWeight: (l.fibrinogen_mg_dl ?? 200) < 200 ? 'bold' : 'normal' }}>
                            {l.fibrinogen_mg_dl != null ? `${l.fibrinogen_mg_dl}` : '—'}
                          </span>
                        </td>
                        <td>{l.platelet_count != null ? `${l.platelet_count}` : '—'}</td>
                        <td>{l.inr != null ? `${l.inr}` : '—'}</td>
                        <td>{l.qbl_total_ml != null ? `${l.qbl_total_ml}` : '—'}</td>
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
        <ObstetricAfeModal
          patientId={patientId}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => void loadEpisodes()}
        />
      )}

      {showLogModal && selectedEpisode && (
        <ObstetricAfeFlowsheetModal
          episodeId={selectedEpisode.id}
          onClose={() => setShowLogModal(false)}
          onSaved={() => void loadDetail(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
