import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalHypocalcemiaEpisodes, NeonatalHypocalcemiaRecord } from '../api';

export const NeonatalHypocalcemiaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalHypocalcemiaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNeonatalHypocalcemiaEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeIvCount = episodes.filter((e) => e.status === 'acute_iv_correction').length;
  const emergencyBolusCount = episodes.filter((e) => e.emergency_bolus_indicated === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#b45309' }}>🧪 Neonatal Hypocalcemia & Electrolyte Protocol Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            AAP / NICE Guidelines: Ionized Calcium Titration, 10% Calcium Gluconate Infusion & Concurrent Hypomagnesemia Management
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💉</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b45309' }}>{activeIvCount}</div>
              <div className="muted small">Active IV Corrections</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{emergencyBolusCount}</div>
              <div className="muted small">Emergency Bolus Cases</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Hypocalcemia Cases</option>
          <option value="acute_iv_correction">Acute IV Correction</option>
          <option value="maintenance_infusion_weaning">Maintenance Infusion & Weaning</option>
          <option value="transitioned_to_oral_supplements">Transitioned to Oral</option>
          <option value="eucalcemic_resolved">Eucalcemic Resolved</option>
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
              <th style={{ padding: '12px 16px' }}>Gestation / Age</th>
              <th style={{ padding: '12px 16px' }}>iCa / Total Ca</th>
              <th style={{ padding: '12px 16px' }}>Magnesium</th>
              <th style={{ padding: '12px 16px' }}>Symptoms / QTc</th>
              <th style={{ padding: '12px 16px' }}>Bolus Volume</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No neonatal hypocalcemia episodes found matching criteria.
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
                    {ep.gestational_age_weeks}w | Day {Math.floor(ep.chronological_age_hours / 24)} ({ep.chronological_age_hours}h)
                    <div className="muted small">{ep.onset_timing === 'early_onset_le_72h' ? 'Early Onset ≤72h' : 'Late Onset >72h'}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <strong style={{ color: ep.ionized_calcium_mmol_l < 1.0 ? '#dc2626' : '#16a34a' }}>
                      {ep.ionized_calcium_mmol_l} mmol/L
                    </strong>
                    <div className="muted small">Total: {ep.total_calcium_mg_dl} mg/dL</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: ep.serum_magnesium_mg_dl < 1.5 ? '#b45309' : 'inherit', fontWeight: ep.serum_magnesium_mg_dl < 1.5 ? 600 : 400 }}>
                      {ep.serum_magnesium_mg_dl} mg/dL
                    </span>
                    {ep.concurrent_hypomagnesemia === 1 && (
                      <span className="badge" style={{ background: '#fef3c7', color: '#92400e', marginLeft: 4, fontSize: '0.7rem' }}>
                        Low Mg
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: ep.symptoms_present ? '#dc2626' : '#16a34a' }}>
                      {ep.symptom_details.replace(/_/g, ' ')}
                    </span>
                    {ep.ecg_qtc_seconds && (
                      <div className="muted small">QTc: {ep.ecg_qtc_seconds}s {ep.ecg_prolonged_qtc ? '(Prolonged)' : ''}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <strong style={{ color: '#1e40af' }}>{ep.calcium_gluconate_10pct_bolus_ml} mL</strong>
                    <div className="muted small">10% Gluconate</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="badge"
                      style={{
                        background: ep.status === 'acute_iv_correction' ? '#fee2e2' : ep.status === 'eucalcemic_resolved' ? '#dcfce7' : '#fef3c7',
                        color: ep.status === 'acute_iv_correction' ? '#991b1b' : ep.status === 'eucalcemic_resolved' ? '#166534' : '#92400e',
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
                        href={`/neonatal-hypocalcemia/${ep.id}/print`}
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
