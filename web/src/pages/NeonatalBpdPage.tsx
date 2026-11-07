import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalBpdEpisodes, NeonatalBpdRecord } from '../api';

export const NeonatalBpdPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalBpdRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNeonatalBpdEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeInpatientCount = episodes.filter((e) => e.status === 'inpatient_respiratory_care' || e.status === 'weaning_protocol').length;
  const grade3Count = episodes.filter((e) => e.jensen_bpd_grade === 'grade_3').length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🫁 Neonatal BPD & Respiratory Weaning Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Jensen 2019 / NRN 36-week PMA Staging, Target SpO2 (91-95%) Surveillance & Home Oxygen Readiness
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🟢</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{activeInpatientCount}</div>
              <div className="muted small">Active Inpatients</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{grade3Count}</div>
              <div className="muted small">Grade 3 (Ventilated)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Episodes</option>
          <option value="inpatient_respiratory_care">Inpatient Respiratory Care</option>
          <option value="weaning_protocol">Weaning Protocol</option>
          <option value="discharged_home_oxygen">Discharged on Home O2</option>
          <option value="evaluating">Evaluating</option>
          <option value="resolved">Resolved</option>
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
              <th style={{ padding: '12px 16px' }}>GA / Birth Wt</th>
              <th style={{ padding: '12px 16px' }}>Current PMA</th>
              <th style={{ padding: '12px 16px' }}>Support Modality</th>
              <th style={{ padding: '12px 16px' }}>Jensen Grade</th>
              <th style={{ padding: '12px 16px' }}>Home O2</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No BPD episodes found matching criteria.
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
                    {ep.gestational_age_weeks}w / {ep.birth_weight_grams}g
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{ep.current_pma_weeks}w</td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.respiratory_support_type.replace(/_/g, ' ').toUpperCase()}
                    {ep.cannula_flow_lpm > 0 && ` (${ep.cannula_flow_lpm} L/min)`}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className={`badge ${
                        ep.jensen_bpd_grade === 'grade_3'
                          ? 'badge-danger'
                          : ep.jensen_bpd_grade === 'grade_2'
                          ? 'badge-warning'
                          : 'badge-info'
                      }`}
                    >
                      {ep.jensen_bpd_grade.toUpperCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.home_oxygen_planned ? (
                      <span className="badge badge-warning">Planned</span>
                    ) : (
                      <span className="muted">No</span>
                    )}
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
                        href={`/neonatal-bpd/${ep.id}/print`}
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
