import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricForeignBodyEpisodes, PediatricForeignBodyRecord } from '../api';

export const PediatricForeignBodyPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricForeignBodyRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPediatricForeignBodyEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResusCount = episodes.filter((e) => e.status === 'acute_choking_management').length;
  const severeCompleteCount = episodes.filter((e) => e.obstruction_severity === 'severe_complete_ineffective_cough' || e.obstruction_severity === 'unconscious_cardiorespiratory_arrest').length;
  const bronchoNeededCount = episodes.filter((e) => e.rigid_bronchoscopy_required).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#dc2626' }}>🥜 Pediatric Foreign Body Airway Obstruction & Choking Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            AAP / AHA PALS / ILCOR Guidelines: Age-Appropriate Maneuvers (Infant Back Blows/Chest Thrusts vs Child Heimlich), Strict Blind Finger Sweep Contraindication & Rigid Bronchoscopy Tracking
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{severeCompleteCount}</div>
              <div className="muted small">Severe/Complete Cases</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{activeResusCount}</div>
              <div className="muted small">Active Management</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🔬</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#4338ca' }}>{bronchoNeededCount}</div>
              <div className="muted small">Bronchoscopy Indicated</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Foreign Body Choking Cases</option>
          <option value="acute_choking_management">Acute Choking Management</option>
          <option value="picu_escalation_bronchoscopy">PICU Escalation / Bronchoscopy</option>
          <option value="post_clearance_observation">Post-Clearance Observation</option>
          <option value="discharged_home_stable">Discharged Home Stable</option>
        </select>
        <span className="muted">Total matching cases: {episodes.length}</span>
      </div>

      {loading ? (
        <div>Loading foreign body choking records...</div>
      ) : episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No pediatric foreign body airway obstruction episodes found matching criteria.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '10px 14px' }}>Episode Code</th>
                <th style={{ padding: '10px 14px' }}>Patient</th>
                <th style={{ padding: '10px 14px' }}>Age / Wt</th>
                <th style={{ padding: '10px 14px' }}>Suspected Object</th>
                <th style={{ padding: '10px 14px' }}>Obstruction Severity</th>
                <th style={{ padding: '10px 14px' }}>SpO2 / HR</th>
                <th style={{ padding: '10px 14px' }}>Intervention</th>
                <th style={{ padding: '10px 14px' }}>Sweep Avoided?</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ color: '#dc2626' }}>
                      {ep.episode_code}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Link to={`/patients/${ep.patient_id}`} style={{ fontWeight: 'bold' }}>
                      {ep.patient_name || `Patient #${ep.patient_id}`}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.age_months} mo ({ep.weight_kg} kg)
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 13, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4 }}>
                      {ep.suspected_foreign_body_nature.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 'bold',
                        background:
                          ep.obstruction_severity === 'unconscious_cardiorespiratory_arrest'
                            ? '#7f1d1d'
                            : ep.obstruction_severity === 'severe_complete_ineffective_cough'
                            ? '#fef2f2'
                            : '#ecfdf5',
                        color:
                          ep.obstruction_severity === 'unconscious_cardiorespiratory_arrest'
                            ? '#ffffff'
                            : ep.obstruction_severity === 'severe_complete_ineffective_cough'
                            ? '#dc2626'
                            : '#065f46',
                      }}
                    >
                      {ep.obstruction_severity.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: ep.spo2_percent < 92 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                      {ep.spo2_percent}%
                    </span>{' '}
                    / {ep.heart_rate_bpm} bpm
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    {ep.intervention_applied.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {ep.blind_finger_sweep_avoided ? (
                      <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: 12 }}>✓ Avoided</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 12 }}>⚠️ VIOLATION</span>
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
                      <Link to={`/pediatric-foreign-body/${ep.id}/print`} className="button small secondary" target="_blank">
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
