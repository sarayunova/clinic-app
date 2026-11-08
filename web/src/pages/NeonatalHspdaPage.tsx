import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalHspdaEpisodes, NeonatalHspdaRecord } from '../api';

export const NeonatalHspdaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalHspdaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNeonatalHspdaEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeTherapyCount = episodes.filter((e) => e.status === 'medical_therapy_active').length;
  const confirmedHspdaCount = episodes.filter((e) => e.hspda_confirmed === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🫀 Neonatal hsPDA Echocardiographic Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            McNamara & Sehgal Echocardiographic Staging, Pharmacotherapy & Interventional Closure Surveillance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💊</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{activeTherapyCount}</div>
              <div className="muted small">Active Medical Therapy</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{confirmedHspdaCount}</div>
              <div className="muted small">Confirmed hsPDA</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Echo Evaluations</option>
          <option value="echocardiographic_surveillance">Echocardiographic Surveillance</option>
          <option value="medical_therapy_active">Medical Therapy Active</option>
          <option value="post_therapy_echo_reassessment">Post-Therapy Reassessment</option>
          <option value="interventional_referral">Interventional Referral</option>
          <option value="resolved_closed">Resolved / Closed</option>
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
              <th style={{ padding: '12px 16px' }}>GA / Wt</th>
              <th style={{ padding: '12px 16px' }}>Duct Diameter</th>
              <th style={{ padding: '12px 16px' }}>LA : Ao</th>
              <th style={{ padding: '12px 16px' }}>Aorta Diastolic Flow</th>
              <th style={{ padding: '12px 16px' }}>Pharmacotherapy</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No neonatal hsPDA episodes found matching criteria.
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
                    {ep.gestational_age_weeks}w / {ep.current_weight_grams}g
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: ep.ductal_diameter_mm >= 2.0 ? '#dc2626' : '#2563eb' }}>
                    {ep.ductal_diameter_mm} mm
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.la_ao_ratio}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${ep.descending_aorta_diastolic_flow === 'retrograde_steal' ? 'badge-danger' : ep.descending_aorta_diastolic_flow === 'absent_diastolic' ? 'badge-warning' : 'badge-info'}`}>
                      {ep.descending_aorta_diastolic_flow.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.pharmacotherapy_selected.replace(/_/g, ' ').toUpperCase()}
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
                        href={`/neonatal-hspda/${ep.id}/print`}
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
