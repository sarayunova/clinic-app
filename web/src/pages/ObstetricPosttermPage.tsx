import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricPosttermEpisodes, ObstetricPosttermRecord } from '../api';

export const ObstetricPosttermPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricPosttermRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getObstetricPosttermEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeRipeningCount = episodes.filter((e) => e.status === 'inpatient_cervical_ripening').length;
  const oligohydramniosCount = episodes.filter((e) => e.oligohydramnios_present === 1).length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#047857' }}>🩺 Post-Term & Bishop Cervical Ripening Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            ACOG Practice Bulletin No. 146: Post-Term Pregnancy Surveillance, Modified Bishop Scoring & Labor Induction Management
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌿</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#047857' }}>{activeRipeningCount}</div>
              <div className="muted small">Active Cervical Ripening</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💧</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{oligohydramniosCount}</div>
              <div className="muted small">Oligohydramnios (AFI ≤5cm)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Post-Term Patients</option>
          <option value="outpatient_surveillance">Outpatient Surveillance</option>
          <option value="inpatient_cervical_ripening">Inpatient Cervical Ripening</option>
          <option value="oxytocin_labor_induction">Oxytocin Labor Induction</option>
          <option value="cesarean_delivery">Cesarean Delivery</option>
          <option value="postpartum_completed">Postpartum Completed</option>
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
              <th style={{ padding: '12px 16px' }}>Gestational Age</th>
              <th style={{ padding: '12px 16px' }}>Amniotic Fluid</th>
              <th style={{ padding: '12px 16px' }}>Bishop Score</th>
              <th style={{ padding: '12px 16px' }}>Prior CS?</th>
              <th style={{ padding: '12px 16px' }}>Recommended Ripening</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center' }} className="muted">
                  No post-term pregnancy episodes found matching criteria.
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
                    <strong>{ep.gestational_age_weeks} weeks</strong>
                    <div className="muted small">{ep.postterm_classification === 'post_term_ge_42_0' ? '≥42w Post-Term' : '41w Late-Term'}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: ep.oligohydramnios_present ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      AFI {ep.amniotic_fluid_index_cm} cm
                    </span>
                    <div className="muted small">SDP: {ep.single_deepest_pocket_cm} cm</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="badge"
                      style={{
                        background: ep.cervix_favorable ? '#dcfce7' : '#fef3c7',
                        color: ep.cervix_favorable ? '#166534' : '#92400e',
                        padding: '4px 8px',
                      }}
                    >
                      {ep.bishop_score_total}/13 ({ep.cervix_favorable ? 'Favorable' : 'Unfavorable'})
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: ep.prior_cesarean_section ? '#dc2626' : '#16a34a', fontWeight: ep.prior_cesarean_section ? 600 : 400 }}>
                      {ep.prior_cesarean_section ? '⚠️ Prior CS' : 'Unscarred'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600, color: '#047857' }}>
                      {ep.recommended_ripening_method.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="badge"
                      style={{
                        background: ep.status === 'inpatient_cervical_ripening' ? '#ecfdf5' : '#f1f5f9',
                        color: ep.status === 'inpatient_cervical_ripening' ? '#065f46' : '#475569',
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
                        href={`/obstetric-postterm/${ep.id}/print`}
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
