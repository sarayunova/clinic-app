import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricSvtEpisodes, PediatricSvtRecord } from '../api';

export const PediatricSvtPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricSvtRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPediatricSvtEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResuscitationCount = episodes.filter((e) => e.status === 'acute_svt_resuscitation').length;
  const unstableShockCount = episodes.filter((e) => e.hemodynamic_stability === 'unstable_decompensated_shock').length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#dc2626' }}>⚡ Pediatric SVT & Emergency Dysrhythmia Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            AHA/AAP PALS 2020 & PACES: SVT Identification, Rapid Adenosine Push & Synchronized Electrical Cardioversion
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{activeResuscitationCount}</div>
              <div className="muted small">Active Resuscitations</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{unstableShockCount}</div>
              <div className="muted small">Decompensated Shock</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All SVT Episodes</option>
          <option value="acute_svt_resuscitation">Acute SVT Resuscitation</option>
          <option value="converted_sinus_surveillance">Converted Sinus Surveillance</option>
          <option value="refractory_picu_transfer">Refractory PICU Transfer</option>
          <option value="discharged_maintenance_therapy">Discharged Maintenance</option>
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
              <th style={{ padding: '12px 16px' }}>Heart Rate</th>
              <th style={{ padding: '12px 16px' }}>Stability</th>
              <th style={{ padding: '12px 16px' }}>Adenosine Dosing</th>
              <th style={{ padding: '12px 16px' }}>Cardioversion</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No pediatric SVT resuscitation episodes found matching criteria.
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
                    <strong style={{ color: ep.heart_rate_bpm >= 220 ? '#dc2626' : '#b45309' }}>
                      {ep.heart_rate_bpm} bpm
                    </strong>
                    <div className="muted small">{ep.qrs_duration_ms} ms ({ep.qrs_morphology === 'narrow_complex_le_0_09s' ? 'Narrow' : 'Wide'})</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="badge"
                      style={{
                        background: ep.hemodynamic_stability === 'unstable_decompensated_shock' ? '#fef2f2' : '#f0fdf4',
                        color: ep.hemodynamic_stability === 'unstable_decompensated_shock' ? '#b91c1c' : '#15803d',
                        border: `1px solid ${ep.hemodynamic_stability === 'unstable_decompensated_shock' ? '#f87171' : '#86efac'}`,
                        padding: '4px 8px',
                      }}
                    >
                      {ep.hemodynamic_stability === 'unstable_decompensated_shock' ? '🚨 Unstable Shock' : '✅ Compensated'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600, color: '#1e40af' }}>{ep.adenosine_first_dose_mg} mg</span> / <span style={{ color: '#1e40af' }}>{ep.adenosine_second_dose_mg} mg</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600, color: '#b45309' }}>{ep.synchronized_cardioversion_joules ?? Math.round(ep.weight_kg * 1.0)} J</span> (2nd: {Math.round(ep.weight_kg * 2.0)} J)
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="badge"
                      style={{
                        background: ep.status === 'acute_svt_resuscitation' ? '#fee2e2' : ep.status === 'converted_sinus_surveillance' ? '#dcfce7' : '#f1f5f9',
                        color: ep.status === 'acute_svt_resuscitation' ? '#991b1b' : ep.status === 'converted_sinus_surveillance' ? '#166534' : '#475569',
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
                        href={`/pediatric-svt/${ep.id}/print`}
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
