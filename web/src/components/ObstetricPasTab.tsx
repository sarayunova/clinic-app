import React, { useState, useEffect } from 'react';
import {
  getObstetricPasEpisodes,
  getObstetricPasEpisode,
  deleteObstetricPasEpisode,
  deleteObstetricPasFlowsheet,
  ObstetricPasRecord,
  ObstetricPasFlowsheetRecord,
} from '../api';
import { ObstetricPasModal } from './ObstetricPasModal';
import { ObstetricPasFlowsheetModal } from './ObstetricPasFlowsheetModal';

interface Props {
  patientId: number;
  gestationWeeks?: number;
}

export const ObstetricPasTab: React.FC<Props> = ({
  patientId,
  gestationWeeks,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricPasRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricPasRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<ObstetricPasFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricPasEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadEpisodeDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err) {
      console.error('Failed to load PAS episodes', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetail = async (id: number) => {
    try {
      const res = await getObstetricPasEpisode(id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.logs);
    } catch (err) {
      console.error('Failed to load PAS episode detail', err);
    }
  };

  useEffect(() => {
    void fetchEpisodes();
  }, [patientId]);

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this PAS record?')) return;
    try {
      await deleteObstetricPasEpisode(id);
      void fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Error deleting episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteObstetricPasFlowsheet(selectedEpisode.id, logId);
      void loadEpisodeDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err.message || 'Error deleting flowsheet log');
    }
  };

  const getGradeBadgeClass = (grade: string) => {
    if (grade.includes('grade_3')) return 'badge danger';
    if (grade.includes('grade_2')) return 'badge warn';
    return 'badge info';
  };

  if (loading) {
    return <p className="muted center">Loading Placenta Accreta Spectrum records...</p>;
  }

  return (
    <div className="tab-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3>🩸 Placenta Accreta Spectrum (PAS) MDT Protocol</h3>
          <p className="muted" style={{ margin: 0 }}>FIGO / SMFM Staging, Surgical Hemorrhage Preparedness & Planned Delivery Protocol</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setShowEpisodeModal(true)}>
          + New PAS Protocol
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card muted center" style={{ padding: '2rem' }}>
          No PAS protocols recorded for this patient. Click "+ New PAS Protocol" to stage ultrasound markers, reserve blood products, and schedule MDT cesarean hysterectomy.
        </div>
      ) : (
        <div className="grid col-3 gap-1">
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <h4>Protocols History</h4>
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
                    <span className={getGradeBadgeClass(ep.pas_grade)}>
                      {ep.pas_grade.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="small muted">
                    Delivery Target: {ep.planned_delivery_weeks}w · Status: {ep.status}
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
                    <h4>Protocol {selectedEpisode.episode_code}</h4>
                    <span className={getGradeBadgeClass(selectedEpisode.pas_grade)}>
                      {selectedEpisode.pas_grade.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="badge" style={{ marginLeft: '0.5rem' }}>
                      {selectedEpisode.status}
                    </span>
                  </div>
                  <div>
                    <a
                      href={`/obstetric-pas/${selectedEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn small"
                      style={{ marginRight: '0.5rem' }}
                    >
                      🖨️ Print MDT Dossier
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
                    <div><strong>Gestation & History:</strong> {selectedEpisode.gestation_weeks}w · {selectedEpisode.previous_cesareans_count} prior cesareans</div>
                    <div><strong>Previa & Clear Zone:</strong> {selectedEpisode.placenta_previa_present ? 'Previa' : 'No Previa'} · {selectedEpisode.loss_of_clear_zone ? 'Loss of Clear Zone' : 'Clear Zone Intact'}</div>
                    <div><strong>Myometrium & Lacunae:</strong> {selectedEpisode.myometrial_thickness_less_1mm ? '<1 mm Thinning' : 'Normal'} · Lacunae Grade {selectedEpisode.lacunae_grade}</div>
                  </div>
                  <div>
                    <div><strong>Planned Delivery:</strong> {selectedEpisode.planned_delivery_weeks} weeks</div>
                    <div><strong>Surgical Approach:</strong> {selectedEpisode.surgical_approach.replace(/_/g, ' ')}</div>
                    <div><strong>Blood Bank Reserved:</strong> {selectedEpisode.prbc_units_reserved} PRBC, {selectedEpisode.ffp_units_reserved} FFP, {selectedEpisode.platelet_units_reserved} Plt</div>
                    <div><strong>Adjuncts:</strong> {selectedEpisode.ir_embolization_planned ? 'IR Balloon' : 'No IR'} · {selectedEpisode.ureteral_stents_planned ? 'Ureteral Stents' : 'No Stents'}</div>
                  </div>
                </div>

                {selectedEpisode.clinical_notes && (
                  <p style={{ marginTop: '0.75rem', fontStyle: 'italic' }}>
                    <strong>Clinical & MDT Notes:</strong> {selectedEpisode.clinical_notes}
                  </p>
                )}

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h5>Antenatal Surveillance & Bleeding Flowsheet</h5>
                  <button
                    type="button"
                    className="btn small primary"
                    onClick={() => setShowFlowsheetModal(true)}
                  >
                    + Log Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p className="muted small">No antenatal bleeding or surveillance checkpoints recorded yet.</p>
                ) : (
                  <table className="table compact" style={{ marginTop: '0.5rem' }}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Gestation</th>
                        <th>Bleeding (mL)</th>
                        <th>Maternal BP / HR</th>
                        <th>CTG Category</th>
                        <th>Hb (g/dL)</th>
                        <th>Crossmatch</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flowsheetLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.log_datetime.slice(11, 16)}</td>
                          <td>{log.gestation_weeks}w</td>
                          <td>{log.antenatal_bleeding_episode ? `${log.vaginal_bleeding_ml} mL` : 'None'}</td>
                          <td>{log.maternal_sbp && log.maternal_dbp ? `${log.maternal_sbp}/${log.maternal_dbp}` : '-'} · {log.maternal_hr ? `${log.maternal_hr} bpm` : ''}</td>
                          <td>{log.ctg_category.replace(/_/g, ' ')}</td>
                          <td>{log.hemoglobin_g_dl ? `${log.hemoglobin_g_dl} g/dL` : '-'}</td>
                          <td>{log.crossmatch_units_confirmed ? '✅ Verified' : '❌ Pending'}</td>
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
              <p className="muted center">Select a protocol to view detail.</p>
            )}
          </div>
        </div>
      )}

      {showEpisodeModal && (
        <ObstetricPasModal
          patientId={patientId}
          gestationWeeks={gestationWeeks}
          onClose={() => setShowEpisodeModal(false)}
          onSaved={() => {
            setShowEpisodeModal(false);
            void fetchEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <ObstetricPasFlowsheetModal
          episodeId={selectedEpisode.id}
          gestationWeeks={selectedEpisode.gestation_weeks}
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
