import React, { useState, useEffect } from 'react';
import { getNeonatalNecEpisodes, NeonatalNecRecord } from '../api';
import { NeonatalNecModal } from '../components/NeonatalNecModal';

export const NeonatalNecPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalNecRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalNecEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load NEC episodes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const getStageBadgeClass = (stage: string) => {
    if (stage.includes('stage_3')) return 'badge danger';
    if (stage.includes('stage_2')) return 'badge warn';
    return 'badge info';
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>🫄 Neonatal NEC Central Surveillance Console</h2>
          <p className="muted">Modified Bell Staging, Abdominal Decompression & Pediatric Surgical Decision Engine (BAPM / AAP)</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            const pidStr = window.prompt('Enter Patient ID to initiate NEC staging:');
            if (pidStr) {
              const pid = parseInt(pidStr, 10);
              if (!isNaN(pid) && pid > 0) {
                setSelectedPatientId(pid);
                setShowModal(true);
              }
            }
          }}
        >
          + New NEC Episode
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted center">Loading active NEC episodes...</p>
        ) : episodes.length === 0 ? (
          <p className="muted center" style={{ padding: '2rem' }}>No active NEC episodes recorded across the NICU.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Episode Code</th>
                <th>Patient ID</th>
                <th>Onset Time</th>
                <th>Gestation / Wt</th>
                <th>Bell Stage</th>
                <th>NPO / Decompression</th>
                <th>Surgical Consult</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id}>
                  <td><strong>{ep.episode_code}</strong></td>
                  <td><a href={`/patients/${ep.patient_id}`}>Patient #{ep.patient_id}</a></td>
                  <td>{ep.onset_datetime.slice(0, 16)}</td>
                  <td>{ep.gestational_age_weeks}w · {ep.current_weight_grams}g</td>
                  <td>
                    <span className={getStageBadgeClass(ep.bell_stage)}>
                      {ep.bell_stage.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {ep.npo_active ? 'NPO' : 'Fed'} · {ep.ng_decompression_active ? 'NG Suction' : 'No NG'}
                  </td>
                  <td>{ep.surgical_consult_status.replace(/_/g, ' ')}</td>
                  <td><span className="badge">{ep.status}</span></td>
                  <td>
                    <a
                      href={`/neonatal-nec/${ep.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn tiny"
                    >
                      🖨️ Dossier
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && selectedPatientId && (
        <NeonatalNecModal
          patientId={selectedPatientId}
          onClose={() => {
            setShowModal(false);
            setSelectedPatientId(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setSelectedPatientId(null);
            void fetchAll();
          }}
        />
      )}
    </div>
  );
};
