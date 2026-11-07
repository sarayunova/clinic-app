import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalPphnEpisodes, NeonatalPphnRecord } from '../api';

export const NeonatalPphnPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalPphnRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNeonatalPphnEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCount = episodes.filter((e) => e.status === 'active_ino_therapy' || e.status === 'weaning_ino').length;
  const criticalCount = episodes.filter((e) => e.pphn_severity_tier === 'critical_ecmo_oi_40_plus').length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🫁 Neonatal PPHN & Inhaled Nitric Oxide Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Oxygenation Index (OI) surveillance, iNO gas titration, and ECMO rescue criteria (AAP / AHA 2015)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🟢</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{activeCount}</div>
              <div className="muted small">Active on iNO</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{criticalCount}</div>
              <div className="muted small">Critical OI $\ge 40$</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Episodes</option>
          <option value="active_ino_therapy">Active iNO Therapy</option>
          <option value="weaning_ino">Weaning iNO</option>
          <option value="evaluating">Evaluating</option>
          <option value="ecmo_referred">ECMO Referred</option>
          <option value="resolved_weaned">Resolved / Weaned</option>
        </select>
      </div>

      {loading && <p className="muted">Loading PPHN registry...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <p className="muted">No Neonatal PPHN episodes found matching criteria.</p>
        </div>
      )}

      {!loading && episodes.length > 0 && (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th>Episode / Date</th>
                <th>Patient</th>
                <th>Gestation / Wt</th>
                <th>Etiology</th>
                <th>Pre/Post SpO2</th>
                <th>OI (MAP / FiO2 / PaO2)</th>
                <th>Severity Tier</th>
                <th>iNO Dose</th>
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
                    <Link to={`/patients/${ep.patient_id}?tab=neonatal_pphn`}>
                      <strong>{ep.patient_name}</strong>
                    </Link>
                    <div className="muted small">{ep.patient_number}</div>
                  </td>
                  <td>{ep.gestational_age_weeks}w · {ep.birth_weight_grams}g</td>
                  <td>{ep.primary_etiology.replace(/_/g, ' ')}</td>
                  <td>
                    {ep.preductal_spo2}% / {ep.postductal_spo2}%
                    <span className="muted small" style={{ display: 'block', color: ep.spo2_gradient >= 10 ? '#b91c1c' : 'inherit' }}>
                      Δ {ep.spo2_gradient}%
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ fontWeight: 'bold' }}>
                      OI {ep.calculated_oi}
                    </span>
                    <span className="muted small" style={{ display: 'block' }}>
                      MAP {ep.mean_airway_pressure_cmh2o} · FiO2 {ep.fio2_percent}%
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          ep.pphn_severity_tier === 'critical_ecmo_oi_40_plus'
                            ? '#fee2e2'
                            : ep.pphn_severity_tier === 'severe_oi_25_39'
                            ? '#ffedd5'
                            : '#e0f2fe',
                        color:
                          ep.pphn_severity_tier === 'critical_ecmo_oi_40_plus'
                            ? '#991b1b'
                            : ep.pphn_severity_tier === 'severe_oi_25_39'
                            ? '#9a3412'
                            : '#075985',
                      }}
                    >
                      {ep.pphn_severity_tier.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {ep.ino_active ? (
                      <strong style={{ color: '#0369a1' }}>{ep.ino_dose_ppm} ppm</strong>
                    ) : (
                      <span className="muted">Inactive</span>
                    )}
                  </td>
                  <td>
                    <span className="badge">{ep.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link className="btn small" to={`/patients/${ep.patient_id}?tab=neonatal_pphn`}>
                        Chart
                      </Link>
                      <a
                        className="btn small"
                        href={`/neonatal-pphn/${ep.id}/print`}
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
