import React, { useState, useEffect } from 'react';
import {
  getPediatricTbiEpisodes,
  getPediatricTbiEpisode,
  deletePediatricTbiEpisode,
  deletePediatricTbiFlowsheet,
  PediatricTbiRecord,
  PediatricTbiFlowsheetRecord,
} from '../api';
import { PediatricTbiPecarnModal } from './PediatricTbiPecarnModal';
import { PediatricTbiFlowsheetModal } from './PediatricTbiFlowsheetModal';

interface Props {
  patientId: number;
  ageMonths?: number;
  weightKg?: number;
}

export const PediatricTbiPecarnTab: React.FC<Props> = ({
  patientId,
  ageMonths,
  weightKg,
}) => {
  const [episodes, setEpisodes] = useState<PediatricTbiRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricTbiRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<PediatricTbiFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricTbiEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadEpisodeDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err) {
      console.error('Failed to load TBI episodes', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetail = async (id: number) => {
    try {
      const res = await getPediatricTbiEpisode(id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.logs);
    } catch (err) {
      console.error('Failed to load TBI episode detail', err);
    }
  };

  useEffect(() => {
    void fetchEpisodes();
  }, [patientId]);

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this TBI episode?')) return;
    try {
      await deletePediatricTbiEpisode(id);
      void fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Error deleting episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deletePediatricTbiFlowsheet(selectedEpisode.id, logId);
      void loadEpisodeDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err.message || 'Error deleting flowsheet log');
    }
  };

  const getPecarnBadgeClass = (risk: string) => {
    if (risk.includes('high_risk')) return 'badge danger';
    if (risk.includes('intermediate')) return 'badge warn';
    return 'badge info';
  };

  if (loading) {
    return <p className="muted center">Loading Pediatric TBI & PECARN records...</p>;
  }

  return (
    <div className="tab-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3>🧠 Pediatric Traumatic Brain Injury (TBI) & PECARN</h3>
          <p className="muted" style={{ margin: 0 }}>Age-Stratified PECARN Neuro-Imaging Decision Rules & Tiered Raised ICP Management</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setShowEpisodeModal(true)}>
          + New TBI Episode
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card muted center" style={{ padding: '2rem' }}>
          No TBI episodes recorded for this child. Click "+ New TBI Episode" to run PECARN head injury algorithm and initiate neuro-critical monitoring.
        </div>
      ) : (
        <div className="grid col-3 gap-1">
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <h4>Episodes History</h4>
            <ul className="list">
              {episodes.map((ep) => (
                <li
                  key={ep.id}
                  style={{
                    padding: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    backgroundColor: selectedEpisode?.id === ep.id ? '#eef4ff' : 'transparent',
                  }}
                  onClick={() => loadEpisodeDetail(ep.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{ep.episode_code}</strong>
                    <span className={getPecarnBadgeClass(ep.pecarn_risk_category)}>
                      GCS {ep.gcs_score}
                    </span>
                  </div>
                  <div className="small muted">
                    {ep.age_bracket === 'under_2_years' ? '< 2yo' : '≥ 2yo'} · {ep.pecarn_risk_category.replace(/_/g, ' ')}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ gridColumn: 'span 2' }}>
            {selectedEpisode ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4>Episode {selectedEpisode.episode_code}</h4>
                    <span className={getPecarnBadgeClass(selectedEpisode.pecarn_risk_category)}>
                      {selectedEpisode.pecarn_risk_category.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="badge" style={{ marginLeft: '0.5rem' }}>
                      {selectedEpisode.status}
                    </span>
                  </div>
                  <div>
                    <a
                      href={`/pediatric-tbi/${selectedEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn small"
                      style={{ marginRight: '0.5rem' }}
                    >
                      🖨️ Print Neuro Dossier
                    </a>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid col-2 gap-1" style={{ marginTop: '1rem', background: '#f8f9fa', padding: '0.75rem', borderRadius: '4px' }}>
                  <div>
                    <div><strong>Age & Weight:</strong> {selectedEpisode.age_months} months ({selectedEpisode.age_bracket.replace(/_/g, ' ')}) · {selectedEpisode.weight_kg} kg</div>
                    <div><strong>Injury Mechanism:</strong> {selectedEpisode.injury_mechanism.replace(/_/g, ' ')}</div>
                    <div><strong>GCS & Mental Status:</strong> GCS {selectedEpisode.gcs_score}/15 · {selectedEpisode.altered_mental_status ? 'Altered / Irritable' : 'Normal'}</div>
                  </div>
                  <div>
                    <div><strong>CT Status & Findings:</strong> {selectedEpisode.ct_performed ? `CT Done: ${selectedEpisode.ct_findings.replace(/_/g, ' ')}` : 'No CT Performed'}</div>
                    <div><strong>Raised ICP Tier:</strong> {selectedEpisode.icp_management_tier.replace(/_/g, ' ')}</div>
                    <div><strong>Hyperosmolar Rx:</strong> {selectedEpisode.hyperosmolar_agent.replace(/_/g, ' ')}</div>
                    <div><strong>Airway Status:</strong> {selectedEpisode.intubation_status.replace(/_/g, ' ')}</div>
                  </div>
                </div>

                {selectedEpisode.clinical_notes && (
                  <p style={{ marginTop: '0.75rem', fontStyle: 'italic' }}>
                    <strong>Clinical & Neurosurgical Notes:</strong> {selectedEpisode.clinical_notes}
                  </p>
                )}

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h5>Serial Neuro-Checks, Pupillometry & ICP Flowsheet</h5>
                  <button
                    type="button"
                    className="btn small primary"
                    onClick={() => setShowFlowsheetModal(true)}
                  >
                    + Log Neuro-Check
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p className="muted small">No serial neuro-checks recorded yet.</p>
                ) : (
                  <table className="table compact" style={{ marginTop: '0.5rem' }}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>+Min</th>
                        <th>GCS (E+V+M)</th>
                        <th>Pupils</th>
                        <th>Vitals BP / HR</th>
                        <th>ICP (mmHg)</th>
                        <th>CPP (mmHg)</th>
                        <th>Hyperosmolar</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flowsheetLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.log_datetime.slice(11, 16)}</td>
                          <td>+{log.minutes_from_injury}m</td>
                          <td><strong>{log.gcs_total}/15</strong> ({log.gcs_eye}+{log.gcs_verbal}+{log.gcs_motor})</td>
                          <td>{log.pupil_reactivity.replace(/_/g, ' ')}</td>
                          <td>{log.vitals_sbp && log.vitals_dbp ? `${log.vitals_sbp}/${log.vitals_dbp}` : '-'} · {log.vitals_hr ?? ''}</td>
                          <td>{log.icp_mmhg ? `${log.icp_mmhg}` : '-'}</td>
                          <td><strong>{log.calculated_cpp_mmhg ? `${log.calculated_cpp_mmhg}` : '-'}</strong></td>
                          <td>{log.hyperosmolar_bolus_given.replace(/_/g, ' ')}</td>
                          <td>
                            <button
                              type="button"
                              className="btn tiny danger"
                              onClick={() => handleDeleteFlowsheet(log.id)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <p className="muted center">Select an episode to view detail.</p>
            )}
          </div>
        </div>
      )}

      {showEpisodeModal && (
        <PediatricTbiPecarnModal
          patientId={patientId}
          ageMonths={ageMonths}
          weightKg={weightKg}
          onClose={() => setShowEpisodeModal(false)}
          onSaved={() => {
            setShowEpisodeModal(false);
            void fetchEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <PediatricTbiFlowsheetModal
          episodeId={selectedEpisode.id}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => {
            setShowFlowsheetModal(false);
            void loadEpisodeDetail(selectedEpisode.id);
          }}
        />
      )}
    </div>
  );
};
