import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricAnaphylaxisEpisodes, PediatricAnaphylaxisRecord } from '../api';

export const PediatricAnaphylaxisPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricAnaphylaxisRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPediatricAnaphylaxisEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResusCount = episodes.filter((e) => e.status === 'acute_resuscitation_bay').length;
  const refractoryCount = episodes.filter((e) => e.refractory_shock_declared === 1 || e.status === 'refractory_picu_infusion').length;
  const biphasicSurveillanceCount = episodes.filter((e) => e.status === 'biphasic_surveillance_observation').length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🚨 Pediatric Anaphylaxis Emergency Resuscitation Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            WAO 2020 / EAACI Guidelines: Weight-Adjusted Epinephrine, Serial Dosing, Refractory Shock IV Infusion & Biphasic Surveillance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{activeResusCount}</div>
              <div className="muted small">Active Resuscitation Bay</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🩸</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{refractoryCount}</div>
              <div className="muted small">Refractory Shock / IV Infusion</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⏱️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#d97706' }}>{biphasicSurveillanceCount}</div>
              <div className="muted small">Biphasic Observation</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Anaphylaxis Episodes</option>
          <option value="acute_resuscitation_bay">Acute Resuscitation Bay</option>
          <option value="refractory_picu_infusion">Refractory Shock / PICU Infusion</option>
          <option value="biphasic_surveillance_observation">Biphasic Surveillance Observation</option>
          <option value="discharged_auto_injector_prescribed">Discharged (Autoinjector Prescribed)</option>
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
              <th style={{ padding: '12px 16px' }}>Trigger</th>
              <th style={{ padding: '12px 16px' }}>Severity Tier</th>
              <th style={{ padding: '12px 16px' }}>IM Dose (1:1000)</th>
              <th style={{ padding: '12px 16px' }}>IM Doses Given</th>
              <th style={{ padding: '12px 16px' }}>IV Infusion</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No pediatric anaphylaxis episodes found matching criteria.
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
                    {ep.age_months >= 24 ? `${Math.floor(ep.age_months / 12)}y` : `${ep.age_months}m`} / {ep.weight_kg} kg
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-info">{ep.trigger_type.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${ep.severity_tier === 'refractory_shock' ? 'badge-danger' : ep.severity_tier === 'severe_life_threatening' ? 'badge-warning' : 'badge-secondary'}`}>
                      {ep.severity_tier.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#dc2626' }}>
                    {ep.weight_adjusted_epinephrine_im_dose_mg} mg
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <strong>{ep.im_epinephrine_doses_given}</strong> dose(s)
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.iv_epinephrine_infusion_active ? (
                      <span className="badge badge-danger">
                        {ep.epinephrine_infusion_rate_mcg_kg_min ?? 0.1} mcg/kg/min
                      </span>
                    ) : (
                      <span className="muted">None</span>
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
                        href={`/pediatric-anaphylaxis/${ep.id}/print`}
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
