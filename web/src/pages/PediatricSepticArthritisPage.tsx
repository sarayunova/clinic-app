import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricSepticArthritisEpisodes, PediatricSepticArthritisRecord } from '../api';

export const PediatricSepticArthritisPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricSepticArthritisRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPediatricSepticArthritisEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const criticalKocherCount = episodes.filter((e) => e.kocher_criteria_met_count >= 3).length;
  const orCount = episodes.filter((e) => e.status === 'operating_room_arthrotomy').length;
  const effusionCount = episodes.filter((e) => e.ultrasound_effusion_detected === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#b91c1c' }}>🦴 Pediatric Septic Arthritis &amp; Kocher Criteria Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Kocher MS et al. (JBJS): Diagnostic Probability Stratification, Joint Effusion Ultrasound, Emergent Arthrotomy Decompression &amp; AVN Prevention
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{criticalKocherCount}</div>
              <div className="muted small">Kocher ≥ 3/4 Cases</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🏥</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{orCount}</div>
              <div className="muted small">Operating Room Active</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🔬</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0284c7' }}>{effusionCount}</div>
              <div className="muted small">Ultrasound Effusion (+)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Septic Arthritis Cases</option>
          <option value="evaluation_pending">Evaluation Pending</option>
          <option value="operating_room_arthrotomy">Operating Room / Arthrotomy</option>
          <option value="postoperative_iv_antibiotics">Postoperative IV Antibiotics</option>
          <option value="transient_synovitis_observed">Transient Synovitis Observed</option>
          <option value="infection_resolved_discharged">Infection Resolved &amp; Discharged</option>
        </select>
        <span className="muted">Total matching cases: {episodes.length}</span>
      </div>

      {loading ? (
        <div>Loading pediatric septic arthritis records...</div>
      ) : episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No pediatric septic arthritis episodes found matching criteria.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '10px 14px' }}>Episode Code</th>
                <th style={{ padding: '10px 14px' }}>Patient</th>
                <th style={{ padding: '10px 14px' }}>Age / Wt</th>
                <th style={{ padding: '10px 14px' }}>Joint</th>
                <th style={{ padding: '10px 14px' }}>Kocher Score</th>
                <th style={{ padding: '10px 14px' }}>Probability</th>
                <th style={{ padding: '10px 14px' }}>Ultrasound</th>
                <th style={{ padding: '10px 14px' }}>Surgical Approach</th>
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
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.age_months}m ({ep.weight_kg} kg)
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>
                    {ep.affected_joint.replace(/_/g, ' ').toUpperCase()}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 'bold',
                        background: ep.kocher_criteria_met_count >= 3 ? '#fee2e2' : '#ecfdf5',
                        color: ep.kocher_criteria_met_count >= 3 ? '#dc2626' : '#065f46',
                      }}
                    >
                      {ep.kocher_criteria_met_count} / 4 Criteria
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold', color: ep.predicted_probability_percent >= 90 ? '#dc2626' : '#111827' }}>
                    {ep.predicted_probability_percent}% Risk
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.ultrasound_effusion_detected ? (
                      <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Effusion (+)</span>
                    ) : (
                      'None'
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    {ep.surgical_approach.replace(/_/g, ' ')}
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
                      <Link to={`/pediatric-septic-arthritis/${ep.id}/print`} className="button small secondary" target="_blank">
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
