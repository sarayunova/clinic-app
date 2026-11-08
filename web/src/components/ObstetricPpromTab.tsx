import React, { useState, useEffect } from 'react';
import {
  getObstetricPpromEpisodes,
  getObstetricPpromEpisode,
  updateObstetricPpromEpisode,
  deleteObstetricPpromEpisode,
  deleteObstetricPpromFlowsheet,
  type ObstetricPpromRecord,
  type ObstetricPpromFlowsheetRecord,
} from '../api';
import { ObstetricPpromModal } from './ObstetricPpromModal';
import { ObstetricPpromFlowsheetModal } from './ObstetricPpromFlowsheetModal';

interface ObstetricPpromTabProps {
  patientId: number;
  patientName: string;
}

export const ObstetricPpromTab: React.FC<ObstetricPpromTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricPpromRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricPpromRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricPpromFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricPpromEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load PPROM episodes');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const res = await getObstetricPpromEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load PPROM episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const res = await updateObstetricPpromEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode || !window.confirm('Delete this obstetric PPROM episode record?')) return;
    try {
      await deleteObstetricPpromEpisode(selectedEpisode.id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteObstetricPpromFlowsheet(selectedEpisode.id, logId);
      loadDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="obstetric-pprom-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: '#991b1b' }}>🩺 Obstetric PPROM & Triple I Latency Console</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            ACOG PB 217 Latency Regimens, Chorioamnionitis Surveillance & Delivery Timing Planning
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Record PPROM Episode
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && <p className="muted">Loading PPROM surveillance records...</p>}

      {!loading && episodes.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', background: '#f8fafc' }}>
          <p className="muted" style={{ margin: 0 }}>
            No preterm premature rupture of membranes (PPROM) episodes recorded for this patient.
          </p>
        </div>
      )}

      {episodes.length > 0 && selectedEpisode && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Episode List Sidebar */}
          <div className="card" style={{ padding: 12 }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b' }}>
              PPROM Episodes
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  className={`btn btn-sm ${ep.id === selectedEpisode.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', padding: 8 }}
                  onClick={() => loadDetail(ep.id)}
                >
                  <span style={{ fontWeight: 'bold' }}>{ep.episode_code}</span>
                  <span style={{ fontSize: '0.75rem' }}>{ep.gestation_weeks}w ({new Date(ep.presentation_datetime).toLocaleDateString()})</span>
                  <span style={{ fontSize: '0.75rem', color: ep.triple_i_category.includes('triple_i') ? '#dc2626' : 'inherit' }}>
                    {ep.triple_i_category.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Episode Detail View */}
          <div className="stack" style={{ gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#991b1b' }}>
                    PPROM at {selectedEpisode.gestation_weeks} Weeks · {selectedEpisode.triple_i_category.replace(/_/g, ' ').toUpperCase()}
                  </h4>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Rupture: {new Date(selectedEpisode.rupture_datetime).toLocaleString()} | Presented: {new Date(selectedEpisode.presentation_datetime).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-control"
                    style={{ width: 'auto', fontSize: '0.85rem' }}
                    value={selectedEpisode.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="inpatient_latency_surveillance">Latency Surveillance</option>
                    <option value="active_triple_i_sepsis_resuscitation">Triple I Sepsis Resuscitation</option>
                    <option value="labor_induction_delivery">Labor Induction / Delivery</option>
                    <option value="postpartum_resolved">Postpartum Resolved</option>
                  </select>
                  <a
                    href={`/obstetric-pprom/${selectedEpisode.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-secondary"
                  >
                    🖨️ Print Dossier
                  </a>
                  <button className="btn btn-sm btn-outline-danger" onClick={handleDeleteEpisode}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Status Alert Banner */}
              <div
                style={{
                  background: selectedEpisode.triple_i_category.includes('triple_i') ? '#fef2f2' : '#f0fdf4',
                  borderLeft: `4px solid ${selectedEpisode.triple_i_category.includes('triple_i') ? '#dc2626' : '#16a34a'}`,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ color: selectedEpisode.triple_i_category.includes('triple_i') ? '#b91c1c' : '#15803d' }}>
                      {evalResult?.summary || 'PPROM Assessment'}
                    </strong>
                    <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 4 }}>
                      {evalResult?.deliveryTimingGuidance}
                    </div>
                  </div>
                  <span className={`badge ${selectedEpisode.triple_i_category.includes('triple_i') ? 'badge-danger' : 'badge-success'}`} style={{ height: 'fit-content' }}>
                    {selectedEpisode.delivery_timing_plan.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Vitals & Fluid Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ padding: 10, background: '#f8fafc' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Maternal Temperature</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: selectedEpisode.maternal_temperature_celsius >= 38.0 ? '#dc2626' : 'inherit' }}>
                    {selectedEpisode.maternal_temperature_celsius}°C
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>Threshold &ge; 38.0°C</div>
                </div>
                <div className="card" style={{ padding: 10, background: '#f8fafc' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Maternal Heart Rate</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {selectedEpisode.maternal_heart_rate_bpm} bpm
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>Tachycardia &gt; 100 bpm</div>
                </div>
                <div className="card" style={{ padding: 10, background: '#f8fafc' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Fetal Heart Rate</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: selectedEpisode.fetal_heart_rate_bpm > 160 ? '#dc2626' : 'inherit' }}>
                    {selectedEpisode.fetal_heart_rate_bpm} bpm
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>Tachycardia &gt; 160 bpm</div>
                </div>
                <div className="card" style={{ padding: 10, background: '#f8fafc' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Fluid Index (AFI / SDP)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {selectedEpisode.single_deepest_pocket_cm ? `${selectedEpisode.single_deepest_pocket_cm} cm` : 'N/A'}
                  </div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>SDP &lt; 2 cm Oligo</div>
                </div>
              </div>

              {/* Latency & Neuroprotection Regimens */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#334155' }}>Pharmacotherapy & Latency Orders</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: '0.85rem' }}>
                  <div>
                    <strong>Latency Antibiotics:</strong> {selectedEpisode.latency_antibiotic_regimen.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div>
                    <strong>Antenatal Steroids:</strong> {selectedEpisode.antenatal_corticosteroid_status.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div>
                    <strong>MgSO4 Neuroprotection:</strong> {selectedEpisode.mgso4_neuroprotection_active ? 'ACTIVE (<32w)' : 'Inactive'}
                  </div>
                </div>
              </div>

              {selectedEpisode.clinical_notes && (
                <div style={{ fontSize: '0.85rem', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                  <strong>Notes:</strong> {selectedEpisode.clinical_notes}
                </div>
              )}
            </div>

            {/* Bedside Flowsheet */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#991b1b' }}>Bedside Latency & Maternal-Fetal Vitals Flowsheet</h4>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Serial maternal temperatures, fetal heart rate tracings, and amniotic fluid checks
                  </span>
                </div>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowFlowsheetModal(true)}>
                  + Log Vitals Checkpoint
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>Date/Time</th>
                      <th style={{ padding: 8 }}>+Hours</th>
                      <th style={{ padding: 8 }}>Maternal Temp</th>
                      <th style={{ padding: 8 }}>Maternal HR</th>
                      <th style={{ padding: 8 }}>BP</th>
                      <th style={{ padding: 8 }}>FHR (bpm)</th>
                      <th style={{ padding: 8 }}>Fluid Character</th>
                      <th style={{ padding: 8 }}>CTG</th>
                      <th style={{ padding: 8 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 16 }} className="muted">
                          No flowsheet vitals logged yet.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: 8 }}>{new Date(log.log_datetime).toLocaleTimeString()}</td>
                          <td style={{ padding: 8 }}>+{log.hours_from_admission}h</td>
                          <td style={{ padding: 8, fontWeight: 600, color: log.maternal_temp_c >= 38.0 ? '#dc2626' : 'inherit' }}>
                            {log.maternal_temp_c}°C
                          </td>
                          <td style={{ padding: 8 }}>{log.maternal_hr_bpm}</td>
                          <td style={{ padding: 8 }}>{log.maternal_bp_sbp}/{log.maternal_bp_dbp}</td>
                          <td style={{ padding: 8, fontWeight: 600, color: log.fetal_hr_bpm > 160 ? '#dc2626' : 'inherit' }}>
                            {log.fetal_hr_bpm}
                          </td>
                          <td style={{ padding: 8 }}>
                            <span className={`badge ${log.amniotic_fluid_character === 'purulent_malodorous' ? 'badge-danger' : 'badge-secondary'}`}>
                              {log.amniotic_fluid_character.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: 8 }}>{log.ctg_category.replace(/_/g, ' ')}</td>
                          <td style={{ padding: 8 }}>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteLog(log.id)}>✕</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ObstetricPpromModal
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
        <ObstetricPpromFlowsheetModal
          episodeId={selectedEpisode.id}
          patientId={patientId}
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
