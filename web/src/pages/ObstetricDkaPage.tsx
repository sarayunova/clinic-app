import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricDkaEpisodes, ObstetricDkaRecord } from '../api';

export const ObstetricDkaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricDkaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getObstetricDkaEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResuscitationCount = episodes.filter((e) => e.status === 'active_acidosis_resuscitation' || e.status === 'euglycemic_dextrose_infusion').length;
  const euglycemicCount = episodes.filter((e) => e.is_euglycemic_dka === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🩺 Obstetric DKA & Euglycemic Acidosis Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            ACOG Practice Bulletin / Sibai & Viteri Protocol: Intrauterine Resuscitation, Insulin Titration & Anion Gap Closure
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💉</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{activeResuscitationCount}</div>
              <div className="muted small">Active Acidosis Protocol</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#c2410c' }}>{euglycemicCount}</div>
              <div className="muted small">Euglycemic DKA Cases</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All DKA Episodes</option>
          <option value="active_acidosis_resuscitation">Active Acidosis Resuscitation</option>
          <option value="euglycemic_dextrose_infusion">Euglycemic Dextrose Infusion</option>
          <option value="acidosis_resolved_transitioning">Acidosis Resolved (Transitioning)</option>
          <option value="resolved_subcutaneous_insulin">Resolved (On SubQ Insulin)</option>
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
              <th style={{ padding: '12px 16px' }}>Gestation / Type</th>
              <th style={{ padding: '12px 16px' }}>Glucose</th>
              <th style={{ padding: '12px 16px' }}>pH / HCO3</th>
              <th style={{ padding: '12px 16px' }}>Anion Gap</th>
              <th style={{ padding: '12px 16px' }}>Euglycemic</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No obstetric DKA episodes found matching criteria.
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
                    {ep.gestation_weeks}w ({ep.diabetes_type.replace(/_/g, ' ')})
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: ep.is_euglycemic_dka ? '#d97706' : '#dc2626' }}>
                    {ep.blood_glucose_mg_dl} mg/dL
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.arterial_or_venous_ph} / {ep.serum_bicarbonate_meq_l} mEq
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: ep.calculated_anion_gap > 12 ? '#dc2626' : '#16a34a' }}>
                    {ep.calculated_anion_gap} mEq/L
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ep.is_euglycemic_dka ? (
                      <span className="badge badge-warning">EUGLYCEMIC</span>
                    ) : (
                      <span className="muted">Hyperglycemic</span>
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
                        href={`/obstetric-dka/${ep.id}/print`}
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
