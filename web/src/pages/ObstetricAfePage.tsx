import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricAfeEpisodes, ObstetricAfeRecord } from '../api';

export const ObstetricAfePage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricAfeRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getObstetricAfeEpisodes(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeResusCount = episodes.filter((e) => e.status === 'acute_resuscitation').length;
  const icuCount = episodes.filter((e) => e.status === 'post_cardiac_arrest_icu').length;

  return (
    <div className="stack" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🩸 Obstetric Amniotic Fluid Embolism (AFE) Console</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Clark 4-Criteria Case Definition, A-OK Pharmacologic Resuscitation & MTP Coagulopathy Tracking (SMFM 2016)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>{activeResusCount}</div>
              <div className="muted small">Active Resuscitation</div>
            </div>
          </div>
          <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🏥</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{icuCount}</div>
              <div className="muted small">Post-Arrest ICU</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Episodes</option>
          <option value="acute_resuscitation">Acute Resuscitation</option>
          <option value="post_cardiac_arrest_icu">Post-Cardiac Arrest ICU</option>
          <option value="coagulopathy_stabilizing">Coagulopathy Stabilizing</option>
          <option value="convalescent">Convalescent</option>
          <option value="maternal_death">Maternal Death</option>
        </select>
      </div>

      {loading && <p className="muted">Loading AFE registry...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <p className="muted">No Obstetric AFE episodes found matching criteria.</p>
        </div>
      )}

      {!loading && episodes.length > 0 && (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th>Episode / Date</th>
                <th>Patient</th>
                <th>Gestation</th>
                <th>Timing Relation</th>
                <th>Clark Criteria</th>
                <th>A-OK Regimen</th>
                <th>Fibrinogen / Transfusion</th>
                <th>PMCD Done</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id}>
                  <td>
                    <strong>{ep.episode_code}</strong>
                    <div className="muted small">{new Date(ep.arrest_onset_datetime).toLocaleDateString()}</div>
                  </td>
                  <td>
                    <Link to={`/patients/${ep.patient_id}?tab=obstetric_afe`}>
                      <strong>{ep.patient_name}</strong>
                    </Link>
                    <div className="muted small">{ep.patient_number}</div>
                  </td>
                  <td>{ep.gestation_weeks} weeks</td>
                  <td>{ep.timing_relation.replace(/_/g, ' ')}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: ep.clark_criteria_met ? '#fee2e2' : '#fef3c7',
                        color: ep.clark_criteria_met ? '#991b1b' : '#92400e',
                        fontWeight: 'bold',
                      }}
                    >
                      {ep.clark_criteria_met ? 'Confirmed (4/4)' : 'Atypical / Partial'}
                    </span>
                  </td>
                  <td>
                    <span className="badge">
                      {ep.aok_regimen_complete ? '✓ Complete' : 'Incomplete'}
                    </span>
                  </td>
                  <td>
                    <div>{ep.fibrinogen_mg_dl != null ? `${ep.fibrinogen_mg_dl} mg/dL` : 'Pending'}</div>
                    <div className="muted small">PRBC: {ep.prbc_transfused_units} · Cryo: {ep.cryoprecipitate_units}</div>
                  </td>
                  <td>
                    {ep.pmcd_performed ? (
                      <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                        PMCD {ep.pmcd_decision_to_delivery_minutes ? `(${ep.pmcd_decision_to_delivery_minutes}m)` : ''}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge">{ep.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link className="btn small" to={`/patients/${ep.patient_id}?tab=obstetric_afe`}>
                        Chart
                      </Link>
                      <a
                        className="btn small"
                        href={`/obstetric-afe/${ep.id}/print`}
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
