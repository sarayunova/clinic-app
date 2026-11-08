import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricCroupEpisodes, PediatricCroupRecord } from '../api';

export const PediatricCroupPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricCroupRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPediatricCroupEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResuscitationCount = episodes.filter((e) => e.status === 'acute_triage_resuscitation').length;
  const severeCroupCount = episodes.filter((e) => e.westley_croup_score_total >= 6).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0284c7' }}>🌬️ Pediatric Croup & Upper Airway Protocol Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Westley Croup Score Staging, Weight-Based Dexamethasone & Nebulized Epinephrine Rebound Monitoring
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0284c7' }}>{activeResuscitationCount}</div>
              <div className="muted small">Active Triage Cases</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{severeCroupCount}</div>
              <div className="muted small">Severe / Impending Failure</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Croup Patients</option>
          <option value="acute_triage_resuscitation">Acute Triage & Resuscitation</option>
          <option value="post_nebulization_observation">Post-Nebulization Observation</option>
          <option value="picu_admission_escalation">PICU Admission Escalation</option>
          <option value="discharged_home_stable">Discharged Home Stable</option>
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
              <th style={{ padding: '12px 16px' }}>Age / Weight</th>
              <th style={{ padding: '12px 16px' }}>Westley Score</th>
              <th style={{ padding: '12px 16px' }}>Severity Tier</th>
              <th style={{ padding: '12px 16px' }}>Dexamethasone</th>
              <th style={{ padding: '12px 16px' }}>Epi Nebulizer</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No pediatric croup episodes found matching criteria.
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
                    {ep.age_months}m | {ep.weight_kg} kg
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <strong style={{ color: ep.westley_croup_score_total >= 6 ? '#dc2626' : ep.westley_croup_score_total >= 3 ? '#b45309' : '#16a34a' }}>
                      {ep.westley_croup_score_total} / 17
                    </strong>
                    <div className="muted small">Stridor: {ep.inspiratory_stridor_score}/2</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="badge"
                      style={{
                        background: ep.westley_croup_score_total >= 6 ? '#fee2e2' : ep.westley_croup_score_total >= 3 ? '#fef3c7' : '#dcfce7',
                        color: ep.westley_croup_score_total >= 6 ? '#991b1b' : ep.westley_croup_score_total >= 3 ? '#92400e' : '#166534',
                        padding: '4px 8px',
                      }}
                    >
                      {ep.croup_severity_tier.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <strong>{ep.dexamethasone_dose_mg} mg</strong> ({ep.dexamethasone_route.toUpperCase()})
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.nebulized_epinephrine_indicated ? (
                      <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                        {ep.epinephrine_nebulization_dose_ml ?? '0.5 mL/kg'} mL
                      </span>
                    ) : (
                      <span className="muted">Not Indicated</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="badge"
                      style={{
                        background: ep.status === 'acute_triage_resuscitation' ? '#e0f2fe' : ep.status === 'discharged_home_stable' ? '#dcfce7' : '#f1f5f9',
                        color: ep.status === 'acute_triage_resuscitation' ? '#0369a1' : ep.status === 'discharged_home_stable' ? '#166534' : '#475569',
                        padding: '4px 8px',
                      }}
                    >
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link
                        to={`/patients/${ep.patient_id}`}
                        className="btn btn-sm btn-outline-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      >
                        Patient
                      </Link>
                      <a
                        href={`/pediatric-croup/${ep.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      >
                        🖨️ Dossier
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
