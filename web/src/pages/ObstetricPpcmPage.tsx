import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricPpcmEpisodes, ObstetricPpcmRecord } from '../api';

export const ObstetricPpcmPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricPpcmRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getObstetricPpcmEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const severeLvefCount = episodes.filter((e) => e.lvef_percent < 35.0).length;
  const shockCount = episodes.filter((e) => e.cardiogenic_shock_present === 1 || e.status === 'icu_mechanical_support').length;
  const bromocriptineCount = episodes.filter((e) => e.bromocriptine_initiated === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#e11d48' }}>🫀 Obstetric Peripartum Cardiomyopathy (PPCM) Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            ESC Guidelines &amp; BOARD Protocol: Left Ventricular Ejection Fraction (LVEF &lt; 45%), Prolactin Suppression (Bromocriptine) &amp; Anticoagulation Safety Auditing
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{severeLvefCount}</div>
              <div className="muted small">LVEF &lt; 35% Cases</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#be123c' }}>{shockCount}</div>
              <div className="muted small">Cardiogenic Shock/ICU</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💊</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#16a34a' }}>{bromocriptineCount}</div>
              <div className="muted small">Bromocriptine Active</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All PPCM Cases</option>
          <option value="acute_decompensation">Acute Decompensation</option>
          <option value="icu_mechanical_support">ICU / Mechanical Circulatory Support</option>
          <option value="stabilized_on_board_protocol">Stabilized on BOARD Protocol</option>
          <option value="recovered_ejection_fraction">Recovered Ejection Fraction</option>
        </select>
        <span className="muted">Total matching cases: {episodes.length}</span>
      </div>

      {loading ? (
        <div>Loading obstetric PPCM records...</div>
      ) : episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No obstetric PPCM episodes found matching criteria.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '10px 14px' }}>Episode Code</th>
                <th style={{ padding: '10px 14px' }}>Patient</th>
                <th style={{ padding: '10px 14px' }}>Timing</th>
                <th style={{ padding: '10px 14px' }}>LVEF / NYHA</th>
                <th style={{ padding: '10px 14px' }}>NT-proBNP</th>
                <th style={{ padding: '10px 14px' }}>Bromocriptine</th>
                <th style={{ padding: '10px 14px' }}>Anticoagulation</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ color: '#e11d48' }}>
                      {ep.episode_code}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ fontWeight: 'bold' }}>
                      {ep.patient_name || `Patient #${ep.patient_id}`}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    {ep.timing_category.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        fontWeight: 'bold',
                        color: ep.lvef_percent < 35.0 ? '#dc2626' : '#e11d48',
                      }}
                    >
                      {ep.lvef_percent}%
                    </span>{' '}
                    ({ep.nyha_class.replace(/_/g, ' ').toUpperCase()})
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.nt_probnp_pg_ml ? `${ep.nt_probnp_pg_ml} pg/mL` : '-'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.bromocriptine_initiated ? (
                      <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Initiated</span>
                    ) : (
                      <span className="muted">Deferred</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.anticoagulation_prescribed ? (
                      <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Covered</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ OMISSION</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, background: '#f1f5f9', color: '#334155' }}>
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/patients/${ep.patient_id}`} className="button small">
                        Chart
                      </Link>
                      <Link to={`/obstetric-ppcm/${ep.id}/print`} className="button small secondary" target="_blank">
                        Print Dossier
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
