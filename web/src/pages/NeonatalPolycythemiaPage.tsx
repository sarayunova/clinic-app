import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalPolycythemiaEpisodes, NeonatalPolycythemiaRecord } from '../api';

export const NeonatalPolycythemiaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalPolycythemiaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNeonatalPolycythemiaEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const petActiveCount = episodes.filter((e) => e.status === 'pet_procedure_in_progress').length;
  const petIndicatedCount = episodes.filter((e) => e.partial_exchange_indicated === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#991b1b' }}>🩺 Neonatal Polycythemia & Partial Exchange Transfusion (PET) Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            AAP & Gomella Guidelines: Venous Hematocrit Staging (≥ 65%), Isotonic Saline Hemodilution & Hyperviscosity Protection
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🩸</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#991b1b' }}>{petIndicatedCount}</div>
              <div className="muted small">PET Indicated Cases</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{petActiveCount}</div>
              <div className="muted small">PET Active In-Progress</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Polycythemia Cases</option>
          <option value="hydration_surveillance">Hydration & Close Surveillance</option>
          <option value="pet_procedure_in_progress">PET Procedure Active</option>
          <option value="post_pet_observation">Post-PET Recovery Observation</option>
          <option value="eupolycythemic_resolved">Eupolycythemic / Resolved</option>
        </select>
        <span className="muted">Total matching cases: {episodes.length}</span>
      </div>

      {loading ? (
        <div>Loading polycythemia records...</div>
      ) : episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No neonatal polycythemia episodes found matching criteria.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '10px 14px' }}>Episode Code</th>
                <th style={{ padding: '10px 14px' }}>Patient</th>
                <th style={{ padding: '10px 14px' }}>Diagnosed</th>
                <th style={{ padding: '10px 14px' }}>Venous Hct</th>
                <th style={{ padding: '10px 14px' }}>Symptoms</th>
                <th style={{ padding: '10px 14px' }}>PET Required?</th>
                <th style={{ padding: '10px 14px' }}>Exchange Vol</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ color: '#991b1b' }}>
                      {ep.episode_code}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ fontWeight: 'bold' }}>
                      {ep.patient_name || `Patient #${ep.patient_id}`}
                    </Link>
                    <div className="muted small">{ep.patient_number}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {new Date(ep.diagnosis_datetime).toLocaleDateString()}
                    <div className="muted small">{ep.chronological_age_hours}h of life</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 800, color: ep.venous_hematocrit_pct >= 65 ? '#dc2626' : '#16a34a' }}>
                      {ep.venous_hematocrit_pct}%
                    </span>
                    <div className="muted small">{ep.sampling_site.replace(/_/g, ' ')}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 600, color: ep.symptoms_present ? '#dc2626' : '#16a34a' }}>
                      {ep.symptoms_present ? ep.symptom_details.replace(/_/g, ' ') : 'Asymptomatic'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className={`badge ${ep.partial_exchange_indicated ? 'danger' : 'success'}`}>
                      {ep.partial_exchange_indicated ? '⚠️ PET INDICATED' : 'HYDRATION'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                    {ep.exchange_volume_ml > 0 ? `${ep.exchange_volume_ml} mL` : '-'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className="badge">
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/patients/${ep.patient_id}`} className="btn small secondary">
                        Chart
                      </Link>
                      <Link to={`/neonatal-polycythemia/${ep.id}/print`} className="btn small" target="_blank">
                        Print
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
