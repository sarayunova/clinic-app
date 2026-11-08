import React, { useState, useEffect } from 'react';
import {
  getNeonatalAbdominalDefectsEpisodes,
  getNeonatalAbdominalDefectsEpisode,
  updateNeonatalAbdominalDefectsEpisode,
  type NeonatalAbdominalDefectRecord,
  type NeonatalAbdominalDefectFlowsheetRecord,
} from '../api';
import { NeonatalAbdominalDefectsModal } from './NeonatalAbdominalDefectsModal';
import { NeonatalAbdominalDefectsFlowsheetModal } from './NeonatalAbdominalDefectsFlowsheetModal';
import { type NeonatalAbdominalDefectsEvaluationResult } from '../neonatalAbdominalDefectsEngine';

interface Props {
  patientId: number;
}

export const NeonatalAbdominalDefectsTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalAbdominalDefectRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalAbdominalDefectRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalAbdominalDefectsEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalAbdominalDefectFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalAbdominalDefectsEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const firstId = res.episodes[0].id;
        setSelectedEpisodeId((prev) => (prev && res.episodes.some((e) => e.id === prev) ? prev : firstId));
      } else {
        setSelectedEpisodeId(null);
        setCurrentEpisode(null);
        setEvaluation(null);
        setFlowsheet([]);
      }
    } catch (err) {
      console.error('Error loading abdominal wall defect episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalAbdominalDefectsEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading abdominal wall defect details:', err);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  useEffect(() => {
    if (selectedEpisodeId) {
      loadEpisodeDetails(selectedEpisodeId);
    }
  }, [selectedEpisodeId]);

  const handleStatusChange = async (newStatus: NeonatalAbdominalDefectRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateNeonatalAbdominalDefectsEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        defectType: currentEpisode.defect_type,
        defectDiameterCm: currentEpisode.defect_diameter_cm,
        cordInsertionSite: currentEpisode.cord_insertion_site,
        membraneSacPresent: Boolean(currentEpisode.membrane_sac_present),
        evisceratedOrgans: currentEpisode.eviscerated_organs,
        bowelCondition: currentEpisode.bowel_condition,
        closureApproach: currentEpisode.closure_approach,
        siloType: currentEpisode.silo_type,
        siloHeightCm: currentEpisode.silo_height_cm,
        currentBladderPressureMmHg: currentEpisode.current_bladder_pressure_mmhg,
        peakInspiratoryPressureCmH2O: currentEpisode.peak_inspiratory_pressure_cmh2o,
        beckwithWiedemannSuspected: Boolean(currentEpisode.beckwith_wiedemann_suspected),
        cardiacEchoCompleted: Boolean(currentEpisode.cardiac_echo_completed),
        associatedAnomaliesNote: currentEpisode.associated_anomalies_note,
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      await loadEpisodeDetails(currentEpisode.id);
      await loadEpisodes();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-4 text-center">Loading abdominal wall defect protocol...</div>;
  }

  return (
    <div className="abdominal-defects-tab p-3">
      {/* Header & Episode Selector */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <h3 className="m-0">👶 Neonatal Gastroschisis vs Omphalocele Silo Protocol</h3>
          {episodes.length > 1 && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={selectedEpisodeId ?? ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.defect_type.toUpperCase()})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="d-flex gap-2">
          {currentEpisode && (
            <>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowFlowsheetModal(true)}
              >
                ➕ Log Silo Checkpoint
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowEditModal(true)}
              >
                ✏️ Edit Protocol
              </button>
              <a
                href={`/neonatal-abdominal-defects/${currentEpisode.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-dark btn-sm"
              >
                🖨️ Print Dossier
              </a>
            </>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
          >
            ➕ New Defect Protocol
          </button>
        </div>
      </div>

      {!currentEpisode ? (
        <div className="card text-center p-5">
          <h4>No Abdominal Wall Defect Record Found</h4>
          <p className="text-muted">
            Initiate a staged silo reduction or primary closure protocol for gastroschisis or omphalocele.
          </p>
          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Initiate Abdominal Wall Defect Protocol
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Status Stepper */}
          <div className="card mb-3 p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold">Clinical Care Pathway:</span>
              <span className="badge bg-secondary">{currentEpisode.status.replace(/_/g, ' ').toUpperCase()}</span>
            </div>
            <div className="btn-group w-100" role="group">
              {[
                { key: 'initial_stabilization_silo_placement', label: '1. Silo Placement' },
                { key: 'active_daily_serial_reduction', label: '2. Daily Reduction' },
                { key: 'ready_for_fascial_closure', label: '3. Ready for Closure' },
                { key: 'post_closure_compartment_monitoring', label: '4. Post-Closure Monitoring' },
                { key: 'resolved_enteral_feeds_established', label: '5. Enteral Feeds' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  className={`btn btn-sm ${
                    currentEpisode.status === st.key ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                  onClick={() => handleStatusChange(st.key as any)}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Insights Banner */}
          {evaluation && (
            <div
              className="card mb-3 p-3"
              style={{
                borderLeft: `5px solid ${
                  evaluation.urgencyTier === 'emergency_acs_or_compromise'
                    ? '#dc3545'
                    : evaluation.urgencyTier === 'urgent_staged_reduction'
                    ? '#ffc107'
                    : '#198754'
                }`,
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="m-0">{evaluation.defectClassificationLabel}</h5>
                <span
                  className={`badge ${
                    evaluation.urgencyTier === 'emergency_acs_or_compromise'
                      ? 'bg-danger'
                      : evaluation.urgencyTier === 'urgent_staged_reduction'
                      ? 'bg-warning text-dark'
                      : 'bg-success'
                  }`}
                >
                  {evaluation.urgencyTierLabel}
                </span>
              </div>

              {evaluation.alerts.length > 0 && (
                <div className="alert alert-danger p-2 mb-2">
                  {evaluation.alerts.map((al, idx) => (
                    <div key={idx}>⚠️ {al}</div>
                  ))}
                </div>
              )}

              <div className="row g-2 mt-1">
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Defect Diameter</small>
                    <strong>{currentEpisode.defect_diameter_cm} cm</strong>
                    <div>{evaluation.isGiantDefect ? '⚠️ Giant Defect (>=5cm)' : 'Standard (<5cm)'}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Current Silo Height</small>
                    <strong>{currentEpisode.silo_height_cm ?? 'N/A'} cm</strong>
                    <div>{currentEpisode.silo_type.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Bladder Pressure (IAH)</small>
                    <strong>{currentEpisode.current_bladder_pressure_mmhg} mmHg</strong>
                    <div className="text-primary">{evaluation.iahGradeLabel}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Peak Insp. Pressure</small>
                    <strong>{currentEpisode.peak_inspiratory_pressure_cmh2o} cmH2O</strong>
                    <div>{currentEpisode.bowel_condition.replace(/_/g, ' ')}</div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mt-2">
                <div className="col-md-6">
                  <h6 className="fw-bold mb-1">💧 Fluid &amp; Thermal Directives</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.fluidManagementDirectives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6 className="fw-bold mb-1">🏥 Bedside Silo &amp; Reduction Rules</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.bedsideSiloDirectives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {evaluation.anomaliesScreeningDirectives.length > 0 && (
                <div className="mt-2 pt-2 border-top">
                  <h6 className="fw-bold mb-1">🧬 Anomalies Screening &amp; Syndromic Workup</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.anomaliesScreeningDirectives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Flowsheet Log Checkpoints Table */}
          <div className="card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="m-0">📈 Daily Silo Reduction &amp; Compartment Flowsheet</h5>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowFlowsheetModal(true)}
              >
                ➕ Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-muted my-3">No reduction checkpoints logged yet. Record Day 1 measurements above.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Reduced</th>
                      <th>Residual Silo</th>
                      <th>Bladder P.</th>
                      <th>PIP</th>
                      <th>Urine Output</th>
                      <th>Perfusion</th>
                      <th>Visceral Color</th>
                      <th>MAP</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowsheet.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <strong>Day {log.day_of_reduction}</strong>
                        </td>
                        <td>{new Date(log.log_datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{log.silo_height_reduced_cm} cm</td>
                        <td>
                          <strong>{log.residual_silo_height_cm} cm</strong>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              log.bladder_pressure_mmhg >= 15
                                ? 'bg-danger'
                                : log.bladder_pressure_mmhg >= 12
                                ? 'bg-warning text-dark'
                                : 'bg-success'
                            }`}
                          >
                            {log.bladder_pressure_mmhg} mmHg
                          </span>
                        </td>
                        <td>{log.peak_inspiratory_pressure_cmh2o} cmH2O</td>
                        <td>
                          <span className={log.urine_output_ml_kg_hr < 1.0 ? 'text-danger fw-bold' : ''}>
                            {log.urine_output_ml_kg_hr} mL/kg/h
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              log.lower_extremity_perfusion === 'warm_pink_pulses_brisk'
                                ? 'bg-success'
                                : log.lower_extremity_perfusion === 'sluggish_cap_refill_delayed'
                                ? 'bg-warning text-dark'
                                : 'bg-danger'
                            }`}
                          >
                            {log.lower_extremity_perfusion.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              log.bowel_visceral_color === 'pink_viable'
                                ? 'bg-success'
                                : log.bowel_visceral_color === 'hyperemic_mild_edema'
                                ? 'bg-info text-dark'
                                : 'bg-danger'
                            }`}
                          >
                            {log.bowel_visceral_color.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{log.mean_arterial_pressure_mmhg} mmHg</td>
                        <td className="small text-muted">{log.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <NeonatalAbdominalDefectsModal
        patientId={patientId}
        existingEpisode={null}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {currentEpisode && (
        <NeonatalAbdominalDefectsModal
          patientId={patientId}
          existingEpisode={currentEpisode}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            loadEpisodeDetails(currentEpisode.id);
            loadEpisodes();
          }}
        />
      )}

      {currentEpisode && (
        <NeonatalAbdominalDefectsFlowsheetModal
          episode={currentEpisode}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => {
            loadEpisodeDetails(currentEpisode.id);
            loadEpisodes();
          }}
        />
      )}
    </div>
  );
};
