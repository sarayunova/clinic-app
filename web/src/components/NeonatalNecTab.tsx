import React, { useState, useEffect } from 'react';
import {
  getNeonatalNecEpisodes,
  getNeonatalNecEpisode,
  deleteNeonatalNecEpisode,
  deleteNeonatalNecFlowsheet,
  NeonatalNecRecord,
  NeonatalNecFlowsheetRecord,
} from '../api';
import { NeonatalNecModal } from './NeonatalNecModal';
import { NeonatalNecFlowsheetModal } from './NeonatalNecFlowsheetModal';

interface Props {
  patientId: number;
  gestationalAgeWeeks?: number;
  birthWeightGrams?: number;
}

export const NeonatalNecTab: React.FC<Props> = ({
  patientId,
  gestationalAgeWeeks,
  birthWeightGrams,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalNecRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalNecRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<NeonatalNecFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalNecEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadEpisodeDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err) {
      console.error('Failed to load NEC episodes', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetail = async (id: number) => {
    try {
      const res = await getNeonatalNecEpisode(id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.logs);
    } catch (err) {
      console.error('Failed to load NEC episode detail', err);
    }
  };

  useEffect(() => {
    void fetchEpisodes();
  }, [patientId]);

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this NEC episode?')) return;
    try {
      await deleteNeonatalNecEpisode(id);
      void fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Error deleting episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalNecFlowsheet(selectedEpisode.id, logId);
      void loadEpisodeDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err.message || 'Error deleting flowsheet log');
    }
  };

  const getStageBadgeClass = (stage: string) => {
    if (stage.includes('stage_3')) return 'badge danger';
    if (stage.includes('stage_2')) return 'badge warn';
    return 'badge info';
  };

  if (loading) {
    return <p className="muted center">Loading Neonatal NEC records...</p>;
  }

  return (
    <div className="tab-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3>🫄 Neonatal Necrotizing Enterocolitis (NEC) Surveillance</h3>
          <p className="muted" style={{ margin: 0 }}>Modified Bell Staging, Abdominal Decompression & Pediatric Surgical Decision Engine</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setShowEpisodeModal(true)}>
          + New NEC Episode
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card muted center" style={{ padding: '2rem' }}>
          No NEC episodes recorded for this infant. Click "+ New NEC Episode" to initiate Modified Bell staging and decompression protocol.
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
                    <span className={getStageBadgeClass(ep.bell_stage)}>
                      {ep.bell_stage.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="small muted">
                    Onset: {ep.onset_datetime.slice(0, 16)} · Status: {ep.status}
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
                    <span className={getStageBadgeClass(selectedEpisode.bell_stage)}>
                      {selectedEpisode.bell_stage.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="badge" style={{ marginLeft: '0.5rem' }}>
                      {selectedEpisode.status}
                    </span>
                  </div>
                  <div>
                    <a
                      href={`/neonatal-nec/${selectedEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn small"
                      style={{ marginRight: '0.5rem' }}
                    >
                      🖨️ Print Dossier
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
                    <div><strong>Gestation & Weights:</strong> {selectedEpisode.gestational_age_weeks}w · Birth {selectedEpisode.birth_weight_grams}g · Current {selectedEpisode.current_weight_grams}g</div>
                    <div><strong>NPO & Decompression:</strong> {selectedEpisode.npo_active ? 'Active NPO' : 'Enteral Feeds'} · {selectedEpisode.ng_decompression_active ? 'Replogle NG Suction' : 'No tube'}</div>
                    <div><strong>Antibiotics & TPN:</strong> {selectedEpisode.broad_spectrum_antibiotics_active ? 'Broad Spectrum IV' : 'None'} · {selectedEpisode.tpn_support_active ? 'TPN Running' : 'No TPN'}</div>
                  </div>
                  <div>
                    <div><strong>Surgical Status:</strong> {selectedEpisode.surgical_consult_status.replace(/_/g, ' ')}</div>
                    <div><strong>Inotrope Support:</strong> {selectedEpisode.inotrope_support_active ? 'Active Vasoactive Infusion' : 'None'}</div>
                    <div><strong>Metabolic Markers:</strong> pH {selectedEpisode.abg_ph ?? 'N/A'} · Platelets {selectedEpisode.platelet_count ?? 'N/A'} · Lactate {selectedEpisode.serum_lactate_mmol_l ?? 'N/A'}</div>
                  </div>
                </div>

                {selectedEpisode.clinical_notes && (
                  <p style={{ marginTop: '0.75rem', fontStyle: 'italic' }}>
                    <strong>Clinical Notes:</strong> {selectedEpisode.clinical_notes}
                  </p>
                )}

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h5>Serial Abdominal Circumference & Vitals Flowsheet</h5>
                  <button
                    type="button"
                    className="btn small primary"
                    onClick={() => setShowFlowsheetModal(true)}
                  >
                    + Log Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <p className="muted small">No serial flowsheet logs recorded yet.</p>
                ) : (
                  <table className="table compact" style={{ marginTop: '0.5rem' }}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>+Hours</th>
                        <th>Girth (cm)</th>
                        <th>Residual</th>
                        <th>Character</th>
                        <th>Sounds</th>
                        <th>Wall</th>
                        <th>pH / Plt</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flowsheetLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.log_datetime.slice(11, 16)}</td>
                          <td>+{log.hours_from_onset}h</td>
                          <td><strong>{log.abdominal_girth_cm ?? '-'}</strong></td>
                          <td>{log.gastric_residual_volume_ml ? `${log.gastric_residual_volume_ml} mL` : '-'}</td>
                          <td>{log.gastric_residual_character}</td>
                          <td>{log.bowel_sounds}</td>
                          <td>{log.abdominal_wall_appearance.replace(/_/g, ' ')}</td>
                          <td>
                            {log.abg_ph ? `pH ${log.abg_ph}` : ''}
                            {log.platelet_count ? ` · ${log.platelet_count}/uL` : ''}
                          </td>
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
        <NeonatalNecModal
          patientId={patientId}
          gestationalAgeWeeks={gestationalAgeWeeks}
          birthWeightGrams={birthWeightGrams}
          onClose={() => setShowEpisodeModal(false)}
          onSaved={() => {
            setShowEpisodeModal(false);
            void fetchEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <NeonatalNecFlowsheetModal
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
