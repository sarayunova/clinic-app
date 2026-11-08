import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricPpromEpisodes, ObstetricPpromRecord } from '../api';

export const ObstetricPpromPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricPpromRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getObstetricPpromEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeLatencyCount = episodes.filter((e) => e.status === 'inpatient_latency_surveillance').length;
  const tripleICount = episodes.filter((e) => e.triple_i_category === 'suspected_triple_i' || e.triple_i_category === 'confirmed_triple_i').length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🩺 Obstetric PPROM & Triple I Latency Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            ACOG Practice Bulletin 217 Latency Regimens, Chorioamnionitis Surveillance & Delivery Timing Planning
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💊</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{activeLatencyCount}</div>
              <div className="muted small">Active Latency Protocol</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{tripleICount}</div>
              <div className="muted small">Triple I / Chorioamnionitis</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All PPROM Episodes</option>
          <option value="inpatient_latency_surveillance">Inpatient Latency Surveillance</option>
          <option value="active_triple_i_sepsis_resuscitation">Triple I Sepsis Resuscitation</option>
          <option value="labor_induction_delivery">Labor Induction / Delivery</option>
          <option value="postpartum_resolved">Postpartum Resolved</option>
        </select>
        <button className="btn btn-secondary" onClick={() => void loadData()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Episode Code</th>
              <th style={{ padding: '12px 16px' }}>Patient</th>
              <th style={{ padding: '12px 16px' }}>Gestation</th>
              <th style={{ padding: '12px 16px' }}>Maternal Temp / HR</th>
              <th style={{ padding: '12px 16px' }}>Fetal HR</th>
              <th style={{ padding: '12px 16px' }}>Triple I Staging</th>
              <th style={{ padding: '12px 16px' }}>Latency Regimen</th>
              <th style={{ padding: '12px 16px' }}>Delivery Plan</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No obstetric PPROM episodes found matching criteria.
                </td>
              </tr>
            ) : (
              episodes.map((ep) => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{ep.episode_code}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ fontWeight: 500, color: '#2563eb' }}>
                      {ep.patient_name || `Patient #${ep.patient_id}`}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.gestation_weeks} weeks
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: ep.maternal_temperature_celsius >= 38.0 ? '#dc2626' : 'inherit' }}>
                    {ep.maternal_temperature_celsius}°C / {ep.maternal_heart_rate_bpm} bpm
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: ep.fetal_heart_rate_bpm > 160 ? '#dc2626' : 'inherit' }}>
                    {ep.fetal_heart_rate_bpm} bpm
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${ep.triple_i_category.includes('triple_i') ? 'badge-danger' : 'badge-info'}`}>
                      {ep.triple_i_category.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.latency_antibiotic_regimen.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-secondary">{ep.delivery_timing_plan.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/patients/${ep.patient_id}`} className="btn btn-sm btn-outline-primary">
                        View Chart
                      </Link>
                      <a
                        href={`/obstetric-pprom/${ep.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Print
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
