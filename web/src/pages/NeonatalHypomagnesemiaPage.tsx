import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalHypomagnesemiaEpisodes, NeonatalHypomagnesemiaRecord } from '../api';

export const NeonatalHypomagnesemiaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalHypomagnesemiaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNeonatalHypomagnesemiaEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const criticalCount = episodes.filter((e) => e.serum_magnesium_mg_dl < 1.2).length;
  const activeResusCount = episodes.filter((e) => e.status === 'acute_resuscitation').length;
  const seizureCount = episodes.filter((e) => e.seizures_observed === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0284c7' }}>⚡ Neonatal Hypomagnesemia & Refractory Seizures Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            AAP / Nelson Pediatrics: Serum Mg &lt; 1.5 mg/dL, PTH-Refractory Hypocalcemia Auditing, 50% MgSO4 Bolus Calculation &amp; DTR / Toxicity Surveillance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{criticalCount}</div>
              <div className="muted small">Critical (&lt; 1.2 mg/dL)</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{activeResusCount}</div>
              <div className="muted small">Active Resuscitation</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#7c3aed' }}>{seizureCount}</div>
              <div className="muted small">Seizure Cases</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Hypomagnesemia Cases</option>
          <option value="acute_resuscitation">Acute Resuscitation</option>
          <option value="maintenance_infusion">Maintenance Infusion</option>
          <option value="monitoring_stabilized">Monitoring &amp; Stabilized</option>
          <option value="resolved_eumagnesemic">Resolved Eumagnesemic</option>
        </select>
        <span className="muted">Total matching cases: {episodes.length}</span>
      </div>

      {loading ? (
        <div>Loading neonatal hypomagnesemia records...</div>
      ) : episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No neonatal hypomagnesemia episodes found matching criteria.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '10px 14px' }}>Episode Code</th>
                <th style={{ padding: '10px 14px' }}>Patient</th>
                <th style={{ padding: '10px 14px' }}>Age / Wt</th>
                <th style={{ padding: '10px 14px' }}>Serum Mg</th>
                <th style={{ padding: '10px 14px' }}>Concurrent Ca</th>
                <th style={{ padding: '10px 14px' }}>Symptoms</th>
                <th style={{ padding: '10px 14px' }}>50% MgSO4 Bolus</th>
                <th style={{ padding: '10px 14px' }}>ECG Monitoring</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ color: '#0284c7' }}>
                      {ep.episode_code}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ fontWeight: 'bold' }}>
                      {ep.patient_name || `Patient #${ep.patient_id}`}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.chronological_age_hours}h ({ep.current_weight_kg} kg)
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        fontWeight: 'bold',
                        color: ep.serum_magnesium_mg_dl < 1.2 ? '#dc2626' : '#0284c7',
                      }}
                    >
                      {ep.serum_magnesium_mg_dl} mg/dL
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.ionized_calcium_mmol_l ? `${ep.ionized_calcium_mmol_l} mmol/L` : 'N/A'}{' '}
                    {ep.calcium_refractory_tetany ? <span style={{ color: '#dc2626', fontWeight: 'bold' }}>[Refractory]</span> : ''}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    {ep.neuromuscular_symptoms.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold', color: '#16a34a' }}>
                    {ep.magnesium_sulfate_bolus_ml} mL
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.continuous_ecg_monitored ? '✓ ECG Monitored' : '⚠️ None'}
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
                      <Link to={`/neonatal-hypomagnesemia/${ep.id}/print`} className="button small secondary" target="_blank">
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
