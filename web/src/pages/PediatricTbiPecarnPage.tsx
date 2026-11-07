import React, { useState, useEffect } from 'react';
import { getPediatricTbiEpisodes, PediatricTbiRecord } from '../api';
import { PediatricTbiPecarnModal } from '../components/PediatricTbiPecarnModal';

export const PediatricTbiPecarnPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricTbiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getPediatricTbiEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load TBI episodes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const getPecarnBadgeClass = (risk: string) => {
    if (risk.includes('high_risk')) return 'badge danger';
    if (risk.includes('intermediate')) return 'badge warn';
    return 'badge info';
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>🧠 Pediatric TBI & PECARN Emergency Neuro Console</h2>
          <p className="muted">PECARN Head Injury Rules, Pediatric GCS & Tiered Raised ICP Resuscitation (BTF / Lancet)</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            const pidStr = window.prompt('Enter Patient ID to initiate TBI/PECARN assessment:');
            if (pidStr) {
              const pid = parseInt(pidStr, 10);
              if (!isNaN(pid) && pid > 0) {
                setSelectedPatientId(pid);
                setShowModal(true);
              }
            }
          }}
        >
          + New TBI Episode
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted center">Loading active Pediatric TBI cases...</p>
        ) : episodes.length === 0 ? (
          <p className="muted center" style={{ padding: '2rem' }}>No active Pediatric TBI episodes under emergency or PICU surveillance.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Episode Code</th>
                <th>Patient ID</th>
                <th>Age / Weight</th>
                <th>Injury Time</th>
                <th>GCS</th>
                <th>PECARN Risk</th>
                <th>CT Done / Findings</th>
                <th>ICP Tier</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id}>
                  <td><strong>{ep.episode_code}</strong></td>
                  <td><a href={`/patients/${ep.patient_id}`}>Patient #{ep.patient_id}</a></td>
                  <td>{ep.age_months}m ({ep.age_bracket === 'under_2_years' ? '<2y' : '≥2y'}) · {ep.weight_kg}kg</td>
                  <td>{ep.injury_datetime.slice(0, 16).replace('T', ' ')}</td>
                  <td><strong>{ep.gcs_score}/15</strong></td>
                  <td>
                    <span className={getPecarnBadgeClass(ep.pecarn_risk_category)}>
                      {ep.pecarn_risk_category.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>{ep.ct_performed ? ep.ct_findings.replace(/_/g, ' ') : 'No CT'}</td>
                  <td>{ep.icp_management_tier.replace(/_/g, ' ')}</td>
                  <td><span className="badge">{ep.status}</span></td>
                  <td>
                    <a
                      href={`/pediatric-tbi/${ep.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn tiny"
                    >
                      🖨️ Neuro Dossier
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && selectedPatientId && (
        <PediatricTbiPecarnModal
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
