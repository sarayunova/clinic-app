import React, { useState, useEffect } from 'react';
import {
  getObstetricPpcmEpisodes,
  getObstetricPpcmEpisode,
  updateObstetricPpcmEpisode,
  deleteObstetricPpcmEpisode,
  deleteObstetricPpcmFlowsheet,
  type ObstetricPpcmRecord,
  type ObstetricPpcmFlowsheetRecord,
} from '../api';
import { ObstetricPpcmModal } from './ObstetricPpcmModal';
import { ObstetricPpcmFlowsheetModal } from './ObstetricPpcmFlowsheetModal';

interface ObstetricPpcmTabProps {
  patientId: number;
  patientName: string;
}

export const ObstetricPpcmTab: React.FC<ObstetricPpcmTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricPpcmRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricPpcmRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricPpcmFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricPpcmEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load obstetric PPCM episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getObstetricPpcmEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: any) => {
    if (!selectedEpisode) return;
    try {
      await updateObstetricPpcmEpisode(selectedEpisode.id, { status: newStatus });
      loadDetail(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Are you sure you want to delete this obstetric PPCM episode?')) return;
    try {
      await deleteObstetricPpcmEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteObstetricPpcmFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && episodes.length === 0) {
    return <div style={{ padding: 20 }}>Loading obstetric PPCM records...</div>;
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {error && <div className="alert error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, color: '#e11d48' }}>🫀 Obstetric Peripartum Cardiomyopathy (PPCM) Protocol</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            ESC Guidelines &amp; BOARD Protocol: LVEF &lt; 45%, Bromocriptine Prolactin Suppression &amp; Mandatory Anticoagulation Auditing
          </p>
        </div>
        <button className="button primary" onClick={() => setShowModal(true)}>
          + Initiate PPCM Episode
        </button>
      </div>

      {episodes.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          No peripartum cardiomyopathy episodes recorded for this patient.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* Episode Selector List */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 13, textTransform: 'uppercase', color: '#64748b' }}>
              Episodes ({episodes.length})
            </h4>
            <div className="stack" style={{ gap: 8 }}>
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => loadDetail(ep.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedEpisode?.id === ep.id ? '#ffe4e6' : '#f8fafc',
                    border: `1px solid ${selectedEpisode?.id === ep.id ? '#e11d48' : '#e2e8f0'}`,
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: 14 }}>{ep.episode_code}</div>
                  <div className="small muted">
                    {new Date(ep.presentation_datetime).toLocaleDateString()} | EF: {ep.lvef_percent}%
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: ep.status === 'acute_decompensation' ? '#fee2e2' : '#f1f5f9',
                        color: ep.status === 'acute_decompensation' ? '#dc2626' : '#334155',
                        fontWeight: 'bold',
                      }}
                    >
                      {ep.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Episode Details & Flowsheet */}
          {selectedEpisode && (
            <div className="stack" style={{ gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18 }}>
                      Episode {selectedEpisode.episode_code}
                    </h3>
                    <div className="small muted">
                      Presented: {new Date(selectedEpisode.presentation_datetime).toLocaleString()} | Attending: {selectedEpisode.consultant_name || 'Staff'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`/obstetric-ppcm/${selectedEpisode.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="button small secondary"
                    >
                      🖨️ Print Dossier
                    </a>
                    <button className="button small primary" onClick={() => setShowFlowsheetModal(true)}>
                      + Add Flowsheet Log
                    </button>
                    <button className="button small text-danger" onClick={handleDeleteEpisode}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">LV Ejection Fraction</div>
                    <div style={{ fontSize: 22, fontWeight: 'bold', color: selectedEpisode.lvef_percent < 35 ? '#dc2626' : '#e11d48' }}>
                      {selectedEpisode.lvef_percent}%
                    </div>
                    <div className="small muted">{selectedEpisode.nyha_class.replace(/_/g, ' ').toUpperCase()}</div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Bromocriptine Protocol</div>
                    <div style={{ fontSize: 15, fontWeight: 'bold', color: selectedEpisode.bromocriptine_initiated ? '#16a34a' : '#b45309' }}>
                      {selectedEpisode.bromocriptine_initiated ? 'INITIATED' : 'Deferred'}
                    </div>
                    <div className="small muted" style={{ fontSize: 11 }}>
                      {selectedEpisode.bromocriptine_regimen.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Anticoagulation</div>
                    <div style={{ fontSize: 15, fontWeight: 'bold' }}>
                      {selectedEpisode.anticoagulation_prescribed ? (
                        <span style={{ color: '#16a34a' }}>✓ Prescribed</span>
                      ) : (
                        <span style={{ color: '#dc2626' }}>⚠️ VIOLATION</span>
                      )}
                    </div>
                    <div className="small muted" style={{ fontSize: 11 }}>
                      {selectedEpisode.anticoagulation_agent.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="card" style={{ background: '#f8fafc', padding: 12 }}>
                    <div className="small muted">Clinical Status</div>
                    <select
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      style={{ fontSize: 13, marginTop: 4, width: '100%' }}
                    >
                      <option value="acute_decompensation">Acute Decompensation</option>
                      <option value="icu_mechanical_support">ICU / Mechanical Support</option>
                      <option value="stabilized_on_board_protocol">Stabilized on BOARD</option>
                      <option value="recovered_ejection_fraction">Recovered Ejection Fraction</option>
                    </select>
                  </div>
                </div>

                {/* BOARD Protocol Guidance */}
                {evalResult && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                    <div style={{ fontWeight: 'bold', color: '#be123c', marginBottom: 4 }}>
                      ESC / BOARD Protocol Clinical Directives:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.5 }}>
                      {evalResult.criticalActionPlan.map((act: string, idx: number) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedEpisode.clinical_notes && (
                  <div className="small" style={{ fontStyle: 'italic', marginBottom: 16 }}>
                    Notes: {selectedEpisode.clinical_notes}
                  </div>
                )}

                {/* Flowsheet Table */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>
                    Hemodynamic &amp; Inotropic Support Flowsheet Logs ({logs.length})
                  </h4>
                  {logs.length === 0 ? (
                    <div className="muted small">No serial flowsheet logs recorded yet.</div>
                  ) : (
                    <table className="table" style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Hours</th>
                          <th>HR</th>
                          <th>BP</th>
                          <th>RR / SpO2</th>
                          <th>O2 Flow</th>
                          <th>Urine (mL/h)</th>
                          <th>Fluid Bal</th>
                          <th>Inotrope</th>
                          <th>Logged By</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((lg) => (
                          <tr key={lg.id}>
                            <td>{new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>+{lg.hours_from_presentation}h</td>
                            <td>{lg.heart_rate_bpm}</td>
                            <td>{lg.blood_pressure_sys}/{lg.blood_pressure_dia}</td>
                            <td>{lg.respiratory_rate} / {lg.spo2_percent}%</td>
                            <td>{lg.oxygen_requirement_l_min} L/m</td>
                            <td>{lg.urine_output_ml_hr}</td>
                            <td style={{ color: lg.fluid_balance_cumulative_ml < 0 ? '#16a34a' : '#b45309' }}>
                              {lg.fluid_balance_cumulative_ml > 0 ? `+${lg.fluid_balance_cumulative_ml}` : lg.fluid_balance_cumulative_ml} mL
                            </td>
                            <td>{lg.inotropic_support}</td>
                            <td>{lg.logged_by_name || 'Staff'}</td>
                            <td>
                              <button
                                className="button small text-danger"
                                style={{ padding: '2px 6px' }}
                                onClick={() => handleDeleteLog(lg.id)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ObstetricPpcmModal
          patientId={patientId}
          patientName={patientName}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <ObstetricPpcmFlowsheetModal
          episodeId={selectedEpisode.id}
          patientName={patientName}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => {
            setShowFlowsheetModal(false);
            loadDetail(selectedEpisode.id);
          }}
        />
      )}
    </div>
  );
};
