import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricPolytraumaEpisodes, PediatricPolytraumaRecord } from '../api';

export const PediatricPolytraumaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricPolytraumaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPediatricPolytraumaEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResuscitationCount = episodes.filter(
    (e) => e.status === 'acute_trauma_bay' || e.status === 'emergent_or_surgery' || e.status === 'picu_damage_control'
  ).length;
  const criticalPtsCount = episodes.filter((e) => e.total_pts_score <= 8).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🚨 Pediatric Polytrauma Resuscitation Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            ATLS 10th Ed / ACS-COT Pediatric Trauma: PTS Scoring (-6 to +12), Damage Control MTP & TXA Protocol
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🩸</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{activeResuscitationCount}</div>
              <div className="muted small">Active Trauma / PICU</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{criticalPtsCount}</div>
              <div className="muted small">Critical PTS (≤ 8)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Trauma Activations</option>
          <option value="acute_trauma_bay">Acute Trauma Bay</option>
          <option value="emergent_or_surgery">Emergent OR / Surgery</option>
          <option value="picu_damage_control">PICU Damage Control</option>
          <option value="stepdown_ward">Stepdown Ward</option>
          <option value="convalescent">Convalescent</option>
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
              <th style={{ padding: '12px 16px' }}>Age / Wt</th>
              <th style={{ padding: '12px 16px' }}>Mechanism</th>
              <th style={{ padding: '12px 16px' }}>PTS Score</th>
              <th style={{ padding: '12px 16px' }}>FAST / Binder</th>
              <th style={{ padding: '12px 16px' }}>MTP / TXA</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No pediatric polytrauma activations found matching criteria.
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
                    {ep.age_months}m / {ep.weight_kg} kg
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.trauma_mechanism.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className={`badge ${
                        ep.total_pts_score <= 8
                          ? 'badge-danger'
                          : ep.total_pts_score <= 10
                          ? 'badge-warning'
                          : 'badge-success'
                      }`}
                    >
                      PTS: {ep.total_pts_score > 0 ? `+${ep.total_pts_score}` : ep.total_pts_score}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.fast_exam_positive ? (
                      <span className="badge badge-danger">FAST +</span>
                    ) : (
                      <span className="badge badge-secondary">FAST -</span>
                    )}
                    {ep.pelvic_binder_placed ? <span className="badge badge-warning" style={{ marginLeft: 4 }}>Binder</span> : null}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.pediatric_mtp_activated ? (
                      <span className="badge badge-danger">MTP</span>
                    ) : (
                      <span className="muted">No MTP</span>
                    )}
                    {ep.txa_administered ? <span className="badge badge-info" style={{ marginLeft: 4 }}>TXA</span> : null}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-secondary">{ep.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/patients/${ep.patient_id}`} className="btn btn-sm btn-outline-primary">
                        View Chart
                      </Link>
                      <a
                        href={`/pediatric-polytrauma/${ep.id}/print`}
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
