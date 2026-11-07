import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricAsthmaEpisodes, PediatricAsthmaStatusRecord } from '../api';

export const PediatricAsthmaStatusPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricAsthmaStatusRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPediatricAsthmaEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const severeCount = episodes.filter((e) => e.severity_tier === 'severe_impending_failure_7_10').length;
  const picuCount = episodes.filter((e) => e.status === 'picu_monitoring').length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🫁 Pediatric Status Asthmaticus Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Modified Wood's Clinical Asthma Score (M-WCAS), Continuous Bronchodilators & High-Dependency PICU Resuscitation
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{severeCount}</div>
              <div className="muted small">Severe / Impending Failure</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🏥</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{picuCount}</div>
              <div className="muted small">PICU Monitoring</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Episodes</option>
          <option value="acute_ed_treatment">Acute Emergency Resuscitation</option>
          <option value="picu_monitoring">PICU Monitoring</option>
          <option value="stepdown_ward">Step-down Ward</option>
          <option value="discharged_resolved">Discharged / Resolved</option>
        </select>
      </div>

      {loading && <p className="muted">Loading status asthmaticus registry...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <p className="muted">No pediatric status asthmaticus episodes found matching criteria.</p>
        </div>
      )}

      {!loading && episodes.length > 0 && (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th>Episode / Date</th>
                <th>Patient</th>
                <th>Age / Weight</th>
                <th>SpO2 (RA)</th>
                <th>M-WCAS Score</th>
                <th>Severity Tier</th>
                <th>Continuous Albuterol</th>
                <th>Advanced Support</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id}>
                  <td>
                    <strong>{ep.episode_code}</strong>
                    <div className="muted small">{new Date(ep.onset_datetime).toLocaleDateString()}</div>
                  </td>
                  <td>
                    <Link to={`/patients/${ep.patient_id}?tab=pediatric_asthma_status`}>
                      <strong>{ep.patient_name}</strong>
                    </Link>
                    <div className="muted small">{ep.patient_number}</div>
                  </td>
                  <td>{ep.age_months}m · {ep.weight_kg}kg</td>
                  <td>{ep.spo2_room_air_percent}%</td>
                  <td>
                    <span className="badge" style={{ fontWeight: 'bold' }}>
                      {ep.total_mwcas_score} / 10
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          ep.severity_tier === 'severe_impending_failure_7_10'
                            ? '#fee2e2'
                            : ep.severity_tier === 'moderate_4_6'
                            ? '#ffedd5'
                            : '#ecfdf5',
                        color:
                          ep.severity_tier === 'severe_impending_failure_7_10'
                            ? '#991b1b'
                            : ep.severity_tier === 'moderate_4_6'
                            ? '#9a3412'
                            : '#065f46',
                      }}
                    >
                      {ep.severity_tier.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {ep.tier1_continuous_albuterol ? (
                      <span style={{ color: '#047857', fontWeight: 600 }}>Active</span>
                    ) : (
                      <span className="muted">Inactive</span>
                    )}
                  </td>
                  <td>
                    <span className="badge">{ep.tier4_respiratory_support.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <span className="badge">{ep.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link className="btn small" to={`/patients/${ep.patient_id}?tab=pediatric_asthma_status`}>
                        Chart
                      </Link>
                      <a
                        className="btn small"
                        href={`/pediatric-asthma/${ep.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Print
                      </a>
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
