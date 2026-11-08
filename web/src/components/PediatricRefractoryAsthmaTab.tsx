import React, { useState, useEffect } from 'react';
import {
  getPediatricRefractoryAsthmaEpisodes,
  getPediatricRefractoryAsthmaEpisode,
  patchPediatricRefractoryAsthmaStatus,
  deletePediatricRefractoryAsthmaEpisode,
  deletePediatricRefractoryAsthmaFlowsheet,
  type PediatricRefractoryAsthmaRecord,
  type PediatricRefractoryAsthmaFlowsheetRecord,
} from '../api';
import {
  evaluatePediatricRefractoryAsthma,
  type PediatricRefractoryAsthmaEvaluation,
} from '../pediatricRefractoryAsthmaEngine';
import { PediatricRefractoryAsthmaModal } from './PediatricRefractoryAsthmaModal';
import { PediatricRefractoryAsthmaFlowsheetModal } from './PediatricRefractoryAsthmaFlowsheetModal';

interface Props {
  patientId: number;
}

export const PediatricRefractoryAsthmaTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricRefractoryAsthmaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricRefractoryAsthmaRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<PediatricRefractoryAsthmaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showEpisodeModal, setShowEpisodeModal] = useState<boolean>(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricRefractoryAsthmaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const epRes = await getPediatricRefractoryAsthmaEpisode(res.episodes[0].id);
        setSelectedEpisode(epRes.episode);
        setFlowsheetLogs(epRes.flowsheet || []);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric refractory status asthmaticus records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleSelectEpisode = async (ep: PediatricRefractoryAsthmaRecord) => {
    try {
      const epRes = await getPediatricRefractoryAsthmaEpisode(ep.id);
      setSelectedEpisode(epRes.episode);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to select episode');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisode) return;
    try {
      const updated = await patchPediatricRefractoryAsthmaStatus(selectedEpisode.id, newStatus);
      setSelectedEpisode(updated.episode);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this PICU refractory asthma episode?')) return;
    try {
      await deletePediatricRefractoryAsthmaEpisode(id);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this PICU surveillance flowsheet log?')) return;
    try {
      await deletePediatricRefractoryAsthmaFlowsheet(selectedEpisode.id, logId);
      const epRes = await getPediatricRefractoryAsthmaEpisode(selectedEpisode.id);
      setFlowsheetLogs(epRes.flowsheet || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading) return <div>Loading Pediatric Refractory Status Asthmaticus records...</div>;

  let evaluation: PediatricRefractoryAsthmaEvaluation | null = null;
  if (selectedEpisode) {
    evaluation = evaluatePediatricRefractoryAsthma({
      ageYears: selectedEpisode.age_years,
      weightKg: selectedEpisode.weight_kg,
      initialPediatricAsthmaScore: selectedEpisode.initial_pediatric_asthma_score,
      respiratoryRate: selectedEpisode.respiratory_rate,
      heartRateBpm: selectedEpisode.heart_rate_bpm,
      spo2Percent: selectedEpisode.spo2_percent,
      pco2Mmhg: selectedEpisode.pco2_mmhg,
      phValue: selectedEpisode.ph_value,
      silentChestOrExhaustion: Boolean(selectedEpisode.silent_chest_or_exhaustion),
      refractoryToFirstLine: Boolean(selectedEpisode.refractory_to_first_line),
      continuousIvTerbutalineActive: Boolean(selectedEpisode.continuous_iv_terbutaline_active),
      terbutalineDoseMcgKgMin: selectedEpisode.terbutaline_dose_mcg_kg_min,
      ivKetamineInfusionActive: Boolean(selectedEpisode.iv_ketamine_infusion_active),
      ketamineDoseMgKgHr: selectedEpisode.ketamine_dose_mg_kg_hr,
      helioxInhalationActive: Boolean(selectedEpisode.heliox_inhalation_active),
      helioxMixtureRatio: selectedEpisode.heliox_mixture_ratio as any,
      ivTheophyllineAminophyllineActive: Boolean(selectedEpisode.iv_theophylline_aminophylline_active),
      ventilatorySupportMode: selectedEpisode.ventilatory_support_mode as any,
      status: selectedEpisode.status as any,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Pediatric Refractory Status Asthmaticus Resuscitation (PICU Rescue)</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            BTS / SIGN Guideline 158 / PALS Refractory Bronchospasm & Permissive Hypercapnia Protocol
          </p>
        </div>
        <button className="btn primary" onClick={() => setShowEpisodeModal(true)}>
          + Launch PICU Resuscitation Episode
        </button>
      </div>

      {error && <div className="alert banner danger">{error}</div>}

      {/* Episode selector tabs */}
      {episodes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 8, overflowX: 'auto' }}>
          {episodes.map((ep) => (
            <button
              key={ep.id}
              className={`btn ${selectedEpisode?.id === ep.id ? 'primary' : 'secondary'} small`}
              onClick={() => handleSelectEpisode(ep)}
            >
              {ep.episode_code} ({ep.status.replace(/_/g, ' ')})
            </button>
          ))}
        </div>
      )}

      {!selectedEpisode ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
          <p>No pediatric refractory status asthmaticus resuscitation episodes found for this patient.</p>
          <button className="btn primary" onClick={() => setShowEpisodeModal(true)}>
            Record Critical Bronchospasm Episode
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Episode Header card */}
          <div className="card" style={{ borderLeft: '4px solid #ef4444', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="badge" style={{ backgroundColor: '#ef4444', color: '#fff', marginRight: 8 }}>
                  PICU RESCUE EPISODE
                </span>
                <span style={{ fontWeight: 'bold', fontSize: '1.2rem', marginRight: 12 }}>
                  {selectedEpisode.episode_code}
                </span>
                <span style={{ color: '#6b7280' }}>
                  Onset: {new Date(selectedEpisode.onset_datetime).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Status:</label>
                <select
                  value={selectedEpisode.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  style={{ fontWeight: 600, padding: '4px 8px', borderRadius: 4 }}
                >
                  <option value="impending_respiratory_failure">Impending Respiratory Failure</option>
                  <option value="second_line_iv_bronchodilator_infusion">2nd-Line IV Bronchodilator Infusion</option>
                  <option value="bipap_noninvasive_support">BiPAP Non-Invasive Support</option>
                  <option value="invasive_mechanical_ventilation_picu">Invasive Mechanical Ventilation (PICU)</option>
                  <option value="bronchospasm_relieving_weaning">Bronchospasm Relieving / Weaning</option>
                  <option value="extubated_convalescent_stepdown">Extubated Convalescent Stepdown</option>
                  <option value="resolved_transferred_to_ward">Resolved / Transferred to Ward</option>
                </select>
                <button
                  className="btn secondary small"
                  onClick={() => window.open(`/pediatric-refractory-asthma/${selectedEpisode.id}/print`, '_blank')}
                >
                  🖨️ Print Dossier
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => setShowEpisodeModal(true)}
                >
                  Edit
                </button>
                <button
                  className="btn danger small"
                  onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Age & Weight</div>
                <div style={{ fontWeight: 600 }}>{selectedEpisode.age_years} yrs | {selectedEpisode.weight_kg} kg</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>PAS / Respiratory Rate</div>
                <div style={{ fontWeight: 600 }}>PAS {selectedEpisode.initial_pediatric_asthma_score}/12 | RR {selectedEpisode.respiratory_rate} bpm</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Heart Rate / SpO₂</div>
                <div style={{ fontWeight: 600 }}>{selectedEpisode.heart_rate_bpm} bpm | SpO₂ {selectedEpisode.spo2_percent}%</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Blood Gas (pCO₂ / pH)</div>
                <div style={{ fontWeight: 600, color: (selectedEpisode.pco2_mmhg >= 42 || selectedEpisode.ph_value < 7.30) ? '#dc2626' : 'inherit' }}>
                  pCO₂ {selectedEpisode.pco2_mmhg} mmHg | pH {selectedEpisode.ph_value}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Ventilation Mode</div>
                <div style={{ fontWeight: 600 }}>{selectedEpisode.ventilatory_support_mode.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Heliox Inhalation</div>
                <div style={{ fontWeight: 600 }}>
                  {selectedEpisode.heliox_inhalation_active ? selectedEpisode.heliox_mixture_ratio.replace(/_/g, ' ') : 'None'}
                </div>
              </div>
            </div>
          </div>

          {/* Engine Clinical Resuscitation Directives */}
          {evaluation && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>PICU Clinical Resuscitation Assessment & Guidance</h4>
                <span
                  className="badge"
                  style={{
                    backgroundColor:
                      evaluation.severityCategory === 'imminent_arrest_extremis'
                        ? '#7f1d1d'
                        : evaluation.severityCategory === 'critical_refractory'
                        ? '#dc2626'
                        : '#ea580c',
                    color: '#fff',
                    textTransform: 'uppercase',
                  }}
                >
                  {evaluation.severityCategory.replace(/_/g, ' ')}
                </span>
              </div>

              {evaluation.isImpendingRespiratoryArrest && (
                <div className="alert banner danger" style={{ marginBottom: 12 }}>
                  ⚠️ <strong>IMPENDING HYPERCAPNIC RESPIRATORY ARREST / DIAPHRAGMATIC EXHAUSTION:</strong> Normalizing or elevated pCO₂ (≥ 42 mmHg) with acidosis in tachypneic asthma indicates loss of respiratory reserve. Prepare senior airway team, ketamine, and immediate escalation.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* 2nd-line bronchodilators */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <h5 style={{ margin: '0 0 8px', color: '#0f172a' }}>IV Bronchodilator Resuscitation Infusions</h5>
                  <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                    <strong>IV Terbutaline:</strong> {evaluation.terbutalineIndicated ? 'Indicated' : 'Not active'}<br />
                    <span>Dosing: {evaluation.terbutalineDosingDirectives.initialBolusMcgKg} µg/kg bolus → {evaluation.terbutalineDosingDirectives.maintenanceMcgKgMin} µg/kg/min (Max: {evaluation.terbutalineDosingDirectives.maxRateMcgKgMin} µg/kg/min)</span>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>IV Ketamine Infusion:</strong> {evaluation.ketamineIndicated ? 'Indicated' : 'Not active'}<br />
                    <span>Dosing: {evaluation.ketamineDosingDirectives.bolusDoseMgKg} mg/kg bolus → {evaluation.ketamineDosingDirectives.infusionRateMgKgHr} mg/kg/hr (Max: {evaluation.ketamineDosingDirectives.maxRateMgKgHr} mg/kg/hr)</span>
                  </div>
                </div>

                {/* Ventilator and Airway Directives */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <h5 style={{ margin: '0 0 8px', color: '#0f172a' }}>Airway & Mechanical Ventilation Directives</h5>
                  <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                    <strong>Ventilator Strategy:</strong> {evaluation.ventilatoryStrategyDirectives.targetTidalVolumeMlKg} | {evaluation.ventilatoryStrategyDirectives.targetIeRatio}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                    <strong>Permissive Hypercapnia Target:</strong> {evaluation.ventilatoryStrategyDirectives.permissiveHypercapniaTarget}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>Heliox Directive:</strong> {evaluation.helioxRecommendation}
                  </div>
                </div>
              </div>

              {evaluation.resuscitationActionChecklist && evaluation.resuscitationActionChecklist.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <h5 style={{ margin: '0 0 6px', color: '#0f172a' }}>Priority Resuscitation Action Checklist</h5>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#334155' }}>
                    {evaluation.resuscitationActionChecklist.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: 2 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* PICU Flowsheet Log table */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0 }}>PICU Serial Blood Gas & Bronchodilator Flowsheet</h4>
                <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '0.8rem' }}>
                  Tracks serial blood gas changes, auscultation progress, and infusion titrations
                </p>
              </div>
              <button className="btn secondary small" onClick={() => setShowFlowsheetModal(true)}>
                + Record Checkpoint
              </button>
            </div>

            {flowsheetLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                No serial blood gas checkpoints recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>PICU Hrs</th>
                      <th>RR</th>
                      <th>HR</th>
                      <th>SpO₂</th>
                      <th>pCO₂ (mmHg)</th>
                      <th>pH</th>
                      <th>Terbutaline (µg/kg/min)</th>
                      <th>Ketamine (mg/kg/hr)</th>
                      <th>I:E</th>
                      <th>Auscultation</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowsheetLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>+{log.hours_from_picu_admission}h</td>
                        <td>{log.respiratory_rate}</td>
                        <td>{log.heart_rate_bpm}</td>
                        <td style={{ color: log.spo2_percent < 92 ? '#dc2626' : 'inherit', fontWeight: 600 }}>
                          {log.spo2_percent}%
                        </td>
                        <td style={{ color: log.pco2_mmhg >= 42 ? '#dc2626' : 'inherit', fontWeight: 600 }}>
                          {log.pco2_mmhg}
                        </td>
                        <td style={{ color: log.ph_value < 7.30 ? '#dc2626' : 'inherit', fontWeight: 600 }}>
                          {log.ph_value}
                        </td>
                        <td>{log.terbutaline_infusion_rate > 0 ? `${log.terbutaline_infusion_rate}` : '—'}</td>
                        <td>{log.ketamine_infusion_rate > 0 ? `${log.ketamine_infusion_rate}` : '—'}</td>
                        <td>{log.inspiratory_expiratory_ratio.replace(/_/g, ':')}</td>
                        <td>
                          <span
                            className="badge small"
                            style={{
                              backgroundColor:
                                log.air_entry_auscultation === 'silent_chest'
                                  ? '#7f1d1d'
                                  : log.air_entry_auscultation === 'markedly_reduced_poor_air_movement'
                                  ? '#ea580c'
                                  : '#10b981',
                              color: '#fff',
                            }}
                          >
                            {log.air_entry_auscultation.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.notes || '—'}
                        </td>
                        <td>
                          <button
                            className="btn danger small"
                            style={{ padding: '2px 6px' }}
                            onClick={() => handleDeleteFlowsheet(log.id)}
                            title="Delete checkpoint"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showEpisodeModal && (
        <PediatricRefractoryAsthmaModal
          patientId={patientId}
          initialEpisode={selectedEpisode}
          existingEpisode={selectedEpisode}
          isOpen={showEpisodeModal}
          onClose={() => setShowEpisodeModal(false)}
          onSuccess={() => {
            setShowEpisodeModal(false);
            loadData();
          }}
          onSaved={() => {
            setShowEpisodeModal(false);
            loadData();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <PediatricRefractoryAsthmaFlowsheetModal
          episode={selectedEpisode}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => {
            setShowFlowsheetModal(false);
            handleSelectEpisode(selectedEpisode);
          }}
        />
      )}
    </div>
  );
};
