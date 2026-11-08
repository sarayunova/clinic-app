import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalIvhEpisodes, NeonatalIvhRecord } from '../api';

export const NeonatalIvhPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalIvhRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNeonatalIvhEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeDecompressionCount = episodes.filter((e) => e.status === 'phh_active_decompression').length;
  const phhActionLineCrossedCount = episodes.filter((e) => e.phh_intervention_threshold_crossed === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🧠 Neonatal IVH & Levene PHH Surveillance Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Papile Cranial Ultrasound Staging, Levene Ventricular Index Curve & Hydrocephalus Decompression Monitoring
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💉</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{activeDecompressionCount}</div>
              <div className="muted small">Active Decompression</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{phhActionLineCrossedCount}</div>
              <div className="muted small">Action Line Crossed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All IVH Evaluations</option>
          <option value="ultrasound_surveillance_active">Ultrasound Surveillance Active</option>
          <option value="phh_active_decompression">PHH Active Decompression</option>
          <option value="post_surgical_shunt_monitoring">Post-Surgical Shunt Monitoring</option>
          <option value="stable_arrested_hydrocephalus">Arrested Hydrocephalus</option>
          <option value="resolved_quiescent">Resolved / Quiescent</option>
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
              <th style={{ padding: '12px 16px' }}>GA / PMA</th>
              <th style={{ padding: '12px 16px' }}>Papile Grade</th>
              <th style={{ padding: '12px 16px' }}>Ventricular Index</th>
              <th style={{ padding: '12px 16px' }}>Davies Action Line</th>
              <th style={{ padding: '12px 16px' }}>Intervention</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No neonatal IVH episodes found matching criteria.
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
                    {ep.gestational_age_weeks}w / {ep.current_pma_weeks}w PMA
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${ep.papile_grade === 'grade_4_periventricular_infarction' ? 'badge-danger' : ep.papile_grade === 'grade_3_intraventricular_dilatation' ? 'badge-warning' : 'badge-info'}`}>
                      {ep.papile_grade.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: Math.max(ep.ventricular_index_left_mm, ep.ventricular_index_right_mm) >= ep.levene_action_line_threshold_mm ? '#dc2626' : 'inherit' }}>
                    {Math.max(ep.ventricular_index_left_mm, ep.ventricular_index_right_mm)} mm
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.levene_action_line_threshold_mm} mm
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.intervention_status.replace(/_/g, ' ').toUpperCase()}
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
                        href={`/neonatal-ivh/${ep.id}/print`}
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
