import React, { useState, useEffect } from 'react';
import { getObstetricPasEpisodes, ObstetricPasRecord } from '../api';
import { ObstetricPasModal } from '../components/ObstetricPasModal';

export const ObstetricPasPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricPasRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getObstetricPasEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load PAS episodes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const getGradeBadgeClass = (grade: string) => {
    if (grade.includes('grade_3')) return 'badge danger';
    if (grade.includes('grade_2')) return 'badge warn';
    return 'badge info';
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>🩸 Placenta Accreta Spectrum (PAS) MDT Surgery Board</h2>
          <p className="muted">FIGO / SMFM Staging, Interventional Radiology & Planned Cesarean Hysterectomy Coordination</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            const pidStr = window.prompt('Enter Patient ID to initiate PAS protocol:');
            if (pidStr) {
              const pid = parseInt(pidStr, 10);
              if (!isNaN(pid) && pid > 0) {
                setSelectedPatientId(pid);
                setShowModal(true);
              }
            }
          }}
        >
          + New PAS Protocol
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted center">Loading active PAS protocols...</p>
        ) : episodes.length === 0 ? (
          <p className="muted center" style={{ padding: '2rem' }}>No active PAS protocols scheduled across the obstetric unit.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Protocol Code</th>
                <th>Patient ID</th>
                <th>Gestation</th>
                <th>Prior C-Sec</th>
                <th>PAS Grade</th>
                <th>Approach</th>
                <th>Blood Bank Units</th>
                <th>Planned Delivery</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id}>
                  <td><strong>{ep.episode_code}</strong></td>
                  <td><a href={`/patients/${ep.patient_id}`}>Patient #{ep.patient_id}</a></td>
                  <td>{ep.gestation_weeks}w</td>
                  <td>{ep.previous_cesareans_count} prior</td>
                  <td>
                    <span className={getGradeBadgeClass(ep.pas_grade)}>
                      {ep.pas_grade.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>{ep.surgical_approach.replace(/_/g, ' ')}</td>
                  <td>{ep.prbc_units_reserved} PRBC / {ep.ffp_units_reserved} FFP</td>
                  <td><strong>{ep.planned_delivery_weeks}w</strong></td>
                  <td><span className="badge">{ep.status}</span></td>
                  <td>
                    <a
                      href={`/obstetric-pas/${ep.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn tiny"
                    >
                      🖨️ MDT Dossier
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && selectedPatientId && (
        <ObstetricPasModal
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
