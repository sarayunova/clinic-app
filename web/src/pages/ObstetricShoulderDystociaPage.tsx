import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricShoulderDystociaEpisodes, ObstetricShoulderDystociaRecord } from '../api';

export const ObstetricShoulderDystociaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricShoulderDystociaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getObstetricShoulderDystociaEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResusCount = episodes.filter((e) => e.status === 'resuscitation_active').length;
  const severeIntervalCount = episodes.filter((e) => e.head_to_body_interval_seconds >= 180).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#b91c1c' }}>🚨 Obstetric Shoulder Dystocia & HELPERR Protocol Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            RCOG Greentop No. 42 / ACOG PB 178: Elapsed Head-to-Body Interval Auditing, HELPERR Step Documentation & Fundal Pressure Auditing
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⏱️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{severeIntervalCount}</div>
              <div className="muted small">Interval ≥ 3 min Cases</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>👶</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{activeResusCount}</div>
              <div className="muted small">Active Resuscitation</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Shoulder Dystocia Cases</option>
          <option value="resuscitation_active">Resuscitation & Active Assessment</option>
          <option value="postpartum_hie_monitoring">Postpartum HIE & Nursery Monitoring</option>
          <option value="transferred_to_nicu">Transferred to NICU</option>
          <option value="discharged_stable">Discharged Home Stable</option>
        </select>
        <span className="muted">Total matching cases: {episodes.length}</span>
      </div>

      {loading ? (
        <div>Loading shoulder dystocia records...</div>
      ) : episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No obstetric shoulder dystocia episodes found matching criteria.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '10px 14px' }}>Episode Code</th>
                <th style={{ padding: '10px 14px' }}>Patient</th>
                <th style={{ padding: '10px 14px' }}>Delivered</th>
                <th style={{ padding: '10px 14px' }}>Head-to-Body Time</th>
                <th style={{ padding: '10px 14px' }}>Birth Weight</th>
                <th style={{ padding: '10px 14px' }}>GDM?</th>
                <th style={{ padding: '10px 14px' }}>Neonatal Injury</th>
                <th style={{ padding: '10px 14px' }}>Fundal Pressure</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ color: '#b91c1c' }}>
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
                    {new Date(ep.delivery_datetime).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 800, color: ep.head_to_body_interval_seconds >= 180 ? '#dc2626' : '#b45309' }}>
                      {ep.head_to_body_interval_seconds}s
                    </span>
                    <div className="muted small">
                      {ep.head_to_body_interval_seconds > 300 ? 'Severe Anoxia' : ep.head_to_body_interval_seconds >= 60 ? 'Prolonged' : 'Normal'}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                    {ep.actual_birth_weight_grams} g
                    <div className="muted small">{ep.actual_birth_weight_grams >= 4000 ? 'Macrosomic' : 'AGA'}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className={`badge ${ep.gestational_diabetes ? 'warning' : 'neutral'}`}>
                      {ep.gestational_diabetes ? 'GDM (+)' : 'No GDM'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 600, color: ep.neonatal_injury !== 'none' ? '#dc2626' : '#16a34a' }}>
                      {ep.neonatal_injury.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className={`badge ${ep.fundal_pressure_avoided ? 'success' : 'danger'}`}>
                      {ep.fundal_pressure_avoided ? 'Avoided' : 'VIOLATION'}
                    </span>
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
                      <Link to={`/obstetric-shoulder-dystocia/${ep.id}/print`} className="btn small" target="_blank">
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
