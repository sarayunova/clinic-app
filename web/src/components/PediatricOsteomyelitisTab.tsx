import React, { useState, useEffect } from 'react';
import {
  getPediatricOsteomyelitisEpisodes,
  getPediatricOsteomyelitisEpisode,
  updatePediatricOsteomyelitisEpisode,
  type PediatricOsteomyelitisRecord,
  type PediatricOsteomyelitisFlowsheetRecord,
} from '../api';
import { PediatricOsteomyelitisModal } from './PediatricOsteomyelitisModal';
import { PediatricOsteomyelitisFlowsheetModal } from './PediatricOsteomyelitisFlowsheetModal';
import { type PediatricOsteomyelitisEvaluationResult } from '../pediatricOsteomyelitisEngine';

interface Props {
  patientId: number;
}

export const PediatricOsteomyelitisTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricOsteomyelitisRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricOsteomyelitisRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricOsteomyelitisEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricOsteomyelitisFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricOsteomyelitisEpisodes({ patientId });
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
      console.error('Error loading pediatric osteomyelitis episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricOsteomyelitisEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading pediatric osteomyelitis details:', err);
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

  const handleStatusChange = async (newStatus: PediatricOsteomyelitisRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updatePediatricOsteomyelitisEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        ageYears: currentEpisode.age_years,
        weightKg: currentEpisode.weight_kg,
        boneInvolved: currentEpisode.bone_involved,
        laterality: currentEpisode.laterality,
        kocherFeverGt385: Boolean(currentEpisode.kocher_fever_gt_38_5),
        kocherNonWeightBearing: Boolean(currentEpisode.kocher_non_weight_bearing),
        kocherEsrGt40: Boolean(currentEpisode.kocher_esr_gt_40),
        kocherWbcGt12k: Boolean(currentEpisode.kocher_wbc_gt_12k),
        crpAdmissionMgL: currentEpisode.crp_admission_mg_l,
        crpPeakMgL: currentEpisode.crp_peak_mg_l,
        subperiostealAbscessPresent: Boolean(currentEpisode.subperiosteal_abscess_present),
        abscessSizeDepthMm: currentEpisode.abscess_size_depth_mm,
        imagingModalityConfirmatory: currentEpisode.imaging_modality_confirmatory,
        surgicalDecompressionPerformed: Boolean(currentEpisode.surgical_decompression_performed),
        surgicalProcedure: currentEpisode.surgical_procedure,
        isolatedPathogen: currentEpisode.isolated_pathogen,
        currentAntibioticRegimen: currentEpisode.current_antibiotic_regimen,
        oralSwitchCriteriaMet: Boolean(currentEpisode.oral_switch_criteria_met),
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      await loadEpisodeDetails(currentEpisode.id);
      await loadEpisodes();
    } catch (err) {
      console.error('Error updating osteomyelitis status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-4 text-center">Loading Acute Hematogenous Osteomyelitis protocol...</div>;
  }

  return (
    <div className="pediatric-osteomyelitis-tab p-3">
      {/* Header & Episode Selector */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <h3 className="m-0">🦴 Pediatric Acute Hematogenous Osteomyelitis (AHO)</h3>
          {episodes.length > 1 && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={selectedEpisodeId ?? ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.bone_involved.replace(/_/g, ' ').toUpperCase()})
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
                ➕ Log Biomarker Checkpoint
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowEditModal(true)}
              >
                ✏️ Edit Protocol
              </button>
              <a
                href={`/pediatric-osteomyelitis/${currentEpisode.id}/print`}
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
            ➕ New Osteomyelitis Protocol
          </button>
        </div>
      </div>

      {!currentEpisode ? (
        <div className="card text-center p-5">
          <h4>No Acute Osteomyelitis Record Found</h4>
          <p className="text-muted">
            Initiate Kocher criteria scoring, CRP kinetic monitoring, and subperiosteal abscess surveillance for pediatric bone infections.
          </p>
          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Initiate AHO &amp; Abscess Protocol
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
                { key: 'initial_iv_empiric_therapy', label: '1. IV Empiric Phase' },
                { key: 'surgical_drainage_and_culture', label: '2. Surgical Drainage' },
                { key: 'pathogen_directed_iv_therapy', label: '3. Targeted IV Phase' },
                { key: 'oral_step_down_therapy', label: '4. Oral Step-Down' },
                { key: 'resolved_treatment_completed', label: '5. Treatment Completed' },
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
                  evaluation.urgencyTier === 'emergency_surgical_decompression'
                    ? '#dc3545'
                    : evaluation.urgencyTier === 'urgent_inpatient_parenteral_therapy'
                    ? '#ffc107'
                    : '#198754'
                }`,
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="m-0">
                  Kocher Score: {evaluation.kocherScore}/4 ({evaluation.kocherRiskCategory})
                </h5>
                <span
                  className={`badge ${
                    evaluation.urgencyTier === 'emergency_surgical_decompression'
                      ? 'bg-danger'
                      : evaluation.urgencyTier === 'urgent_inpatient_parenteral_therapy'
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
                    <small className="text-muted d-block">Bone Involved</small>
                    <strong>{currentEpisode.laterality.toUpperCase()} {currentEpisode.bone_involved.replace(/_/g, ' ')}</strong>
                    <div>{currentEpisode.age_years} yrs • {currentEpisode.weight_kg} kg</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">CRP Kinetics</small>
                    <strong>Peak: {currentEpisode.crp_peak_mg_l} mg/L</strong>
                    <div>{evaluation.crpDeclinePercent !== null ? `${evaluation.crpDeclinePercent}% decline from peak` : 'Initial level'}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Subperiosteal Abscess</small>
                    <strong>{currentEpisode.abscess_size_depth_mm} mm depth</strong>
                    <div className={evaluation.isSurgicalDecompressionIndicated ? 'text-danger fw-bold' : ''}>
                      {evaluation.subperiostealAbscessSeverityLabel}
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Pathogen &amp; Regimen</small>
                    <strong className="text-primary">{currentEpisode.isolated_pathogen.replace(/_/g, ' ')}</strong>
                    <div>{currentEpisode.current_antibiotic_regimen.replace(/_/g, ' ')}</div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mt-2">
                <div className="col-md-6">
                  <h6 className="fw-bold mb-1">💊 Targeted Antimicrobial Guidance</h6>
                  <p className="small text-muted mb-0">{evaluation.targetedAntibioticRecommendation}</p>
                  <p className="small text-muted mt-1 mb-0"><strong>Oral Switch:</strong> {evaluation.oralSwitchEvaluation}</p>
                </div>
                <div className="col-md-6">
                  <h6 className="fw-bold mb-1">🏥 Surgical &amp; Monitoring Rules</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.surgicalDirectives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                    {evaluation.monitoringDirectives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Flowsheet Log Checkpoints Table */}
          <div className="card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="m-0">📈 Daily Biomarker (CRP/ESR) &amp; Clinical Recovery Flowsheet</h5>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowFlowsheetModal(true)}
              >
                ➕ Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-muted my-3">No biomarker checkpoints logged yet. Track Day 1-3 response above.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Temp (°C)</th>
                      <th>CRP (mg/L)</th>
                      <th>ESR</th>
                      <th>Pain (0-10)</th>
                      <th>Weight-Bearing</th>
                      <th>Local Signs</th>
                      <th>Route</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowsheet.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <strong>Day {log.day_of_therapy}</strong>
                        </td>
                        <td>{new Date(log.log_datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <span className={log.temperature_celsius >= 38.0 ? 'text-danger fw-bold' : 'text-success'}>
                            {log.temperature_celsius}°C
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-secondary">
                            {log.crp_level_mg_l} mg/L
                          </span>
                        </td>
                        <td>{log.esr_mm_hr ? `${log.esr_mm_hr} mm/h` : '—'}</td>
                        <td>{log.pain_score_flacc_or_vas} / 10</td>
                        <td>
                          <span className={`badge ${log.weight_bearing_status === 'full_weight_bearing_pain_free' ? 'bg-success' : log.weight_bearing_status === 'partial_weight_bearing_limp' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                            {log.weight_bearing_status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{log.local_signs.replace(/_/g, ' ')}</td>
                        <td>
                          <span className={`badge ${log.route_of_administration === 'oral_step_down' ? 'bg-info text-dark' : 'bg-primary'}`}>
                            {log.route_of_administration.replace(/_/g, ' ')}
                          </span>
                        </td>
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
      <PediatricOsteomyelitisModal
        patientId={patientId}
        existingEpisode={null}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {currentEpisode && (
        <PediatricOsteomyelitisModal
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
        <PediatricOsteomyelitisFlowsheetModal
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
