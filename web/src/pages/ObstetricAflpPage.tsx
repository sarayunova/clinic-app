import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricAflpEpisodes, ObstetricAflpRecord } from '../api';

export const ObstetricAflpPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricAflpRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getObstetricAflpEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResusCount = episodes.filter((e) => e.status === 'active_critical_resuscitation' || e.status === 'postpartum_icu_monitoring').length;
  const confirmedCount = episodes.filter((e) => e.aflp_confirmed === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🩺 Obstetric AFLP & Emergency MDT Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Swansea 14-Criteria Diagnostic Staging, D10W Glycemic Stabilization & LCHAD Screening Registry
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🟢</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{activeResusCount}</div>
              <div className="muted small">Active ICU / Resus</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{confirmedCount}</div>
              <div className="muted small">AFLP Confirmed (&ge;6)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Episodes</option>
          <option value="active_critical_resuscitation">Active Critical Resuscitation</option>
          <option value="postpartum_icu_monitoring">Postpartum ICU Monitoring</option>
          <option value="hepatic_recovery">Hepatic Recovery</option>
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
              <th style={{ padding: '12px 16px' }}>Gestation</th>
              <th style={{ padding: '12px 16px' }}>Swansea Criteria</th>
              <th style={{ padding: '12px 16px' }}>AFLP Result</th>
              <th style={{ padding: '12px 16px' }}>D10W Infusion</th>
              <th style={{ padding: '12px 16px' }}>Delivery Urgency</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No AFLP episodes found matching criteria.
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
                  <td style={{ padding: '12px 16px' }}>{ep.gestation_weeks}w</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
                    {ep.total_swansea_criteria_met} / 14 met
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${ep.aflp_confirmed ? 'badge-danger' : 'badge-success'}`}>
                      {ep.aflp_confirmed ? 'AFLP CONFIRMED' : 'AFLP UNLIKELY'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.dextrose_infusion_active ? (
                      <span className="badge badge-primary">D10W Running</span>
                    ) : (
                      <span className="muted">Inactive</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.delivery_urgency.replace(/_/g, ' ').toUpperCase()}
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
                        href={`/obstetric-aflp/${ep.id}/print`}
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
