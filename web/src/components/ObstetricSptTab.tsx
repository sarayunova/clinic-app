import React, { useState, useEffect } from 'react';
import {
  getObstetricSptEpisodes,
  getObstetricSptEpisode,
  updateObstetricSptEpisode,
  type ObstetricSptRecord,
  type ObstetricSptFlowsheetRecord,
} from '../api';
import { ObstetricSptModal } from './ObstetricSptModal';
import { ObstetricSptFlowsheetModal } from './ObstetricSptFlowsheetModal';
import { type ObstetricSptEvaluationResult } from '../obstetricSptEngine';

interface Props {
  patientId: number;
}

export const ObstetricSptTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricSptRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricSptRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricSptEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricSptFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricSptEpisodes({ patientId });
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
      console.error('Error loading obstetric SPT episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricSptEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading obstetric SPT details:', err);
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

  const handleStatusChange = async (newStatus: ObstetricSptRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateObstetricSptEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        deliveryDatetime: currentEpisode.delivery_datetime,
        deliveryMode: currentEpisode.delivery_mode,
        postpartumDay: currentEpisode.postpartum_day,
        sptPhenotype: currentEpisode.spt_phenotype,
        affectedVein: currentEpisode.affected_vein,
        peakTemperatureCelsius: currentEpisode.peak_temperature_celsius,
        hoursRefractoryTripleAntibiotics: currentEpisode.hours_refractory_triple_antibiotics,
        pelvicCtMriFindings: currentEpisode.pelvic_ct_mri_findings,
        pelvicAbscessRuledOut: Boolean(currentEpisode.pelvic_abscess_ruled_out),
        heparinChallengeInitiated: Boolean(currentEpisode.heparin_challenge_initiated),
        heparinChallengeStartDatetime: currentEpisode.heparin_challenge_start_datetime,
        anticoagulantRegimen: currentEpisode.anticoagulant_regimen,
        targetApttSeconds: currentEpisode.target_aptt_seconds,
        defervescenceHours: currentEpisode.defervescence_hours,
        heparinChallengeResponse: currentEpisode.heparin_challenge_response,
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      await loadEpisodeDetails(currentEpisode.id);
      await loadEpisodes();
    } catch (err) {
      console.error('Error updating SPT status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-4 text-center">Loading Septic Pelvic Thrombophlebitis protocol...</div>;
  }

  return (
    <div className="obstetric-spt-tab p-3">
      {/* Header & Episode Selector */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <h3 className="m-0">🩸 Obstetric Septic Pelvic Thrombophlebitis &amp; Heparin Challenge</h3>
          {episodes.length > 1 && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={selectedEpisodeId ?? ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.spt_phenotype.replace(/_/g, ' ').toUpperCase()})
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
                ➕ Log Heparin Checkpoint
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowEditModal(true)}
              >
                ✏️ Edit Protocol
              </button>
              <a
                href={`/obstetric-spt/${currentEpisode.id}/print`}
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
            ➕ New SPT Protocol
          </button>
        </div>
      </div>

      {!currentEpisode ? (
        <div className="card text-center p-5">
          <h4>No Septic Pelvic Thrombophlebitis Record Found</h4>
          <p className="text-muted">
            Initiate a heparin challenge protocol for refractory postpartum fever following cesarean or operative delivery.
          </p>
          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Initiate SPT &amp; Heparin Challenge Protocol
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
                { key: 'heparin_challenge_eval', label: '1. Heparin Challenge Eval' },
                { key: 'active_therapeutic_anticoagulation', label: '2. Therapeutic Anticoagulation' },
                { key: 'afebrile_antibiotic_completion', label: '3. Afebrile Abx Completion' },
                { key: 'outpatient_anticoagulation_bridge', label: '4. Outpatient Bridge' },
                { key: 'resolved_thrombus_recanalized', label: '5. Resolved / Recanalized' },
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
                  evaluation.urgencyTier === 'urgent_heparin_challenge'
                    ? '#ffc107'
                    : evaluation.urgencyTier === 'active_therapeutic_management'
                    ? '#0d6efd'
                    : '#198754'
                }`,
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="m-0">{evaluation.diagnosticLikelihoodLabel}</h5>
                <span
                  className={`badge ${
                    evaluation.urgencyTier === 'urgent_heparin_challenge'
                      ? 'bg-warning text-dark'
                      : evaluation.urgencyTier === 'active_therapeutic_management'
                      ? 'bg-primary'
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
                    <small className="text-muted d-block">Affected Territory</small>
                    <strong>{currentEpisode.affected_vein.replace(/_/g, ' ')}</strong>
                    <div>{currentEpisode.spt_phenotype.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Peak Temp &amp; Abx Hours</small>
                    <strong>{currentEpisode.peak_temperature_celsius}°C</strong>
                    <div>{currentEpisode.hours_refractory_triple_antibiotics}h on triple Abx</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Pelvic CT / MRI</small>
                    <strong>{currentEpisode.pelvic_ct_mri_findings.replace(/_/g, ' ')}</strong>
                    <div>{currentEpisode.pelvic_abscess_ruled_out ? 'Abscess Ruled Out' : 'Abscess Not Ruled Out!'}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Heparin Challenge Result</small>
                    <strong className="text-primary">{currentEpisode.heparin_challenge_response.replace(/_/g, ' ')}</strong>
                    <div>{currentEpisode.defervescence_hours ? `Lysis at ${currentEpisode.defervescence_hours}h` : 'Pending lysis'}</div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mt-2">
                <div className="col-md-6">
                  <h6 className="fw-bold mb-1">💉 Anticoagulation Dosing Directives</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.heparinDosingDirectives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6 className="fw-bold mb-1">💊 Antimicrobial Coverage Rules</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.antimicrobialDirectives.map((d, i) => (
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
              <h5 className="m-0">📈 Heparin Challenge &amp; Temperature Lysis Flowsheet</h5>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowFlowsheetModal(true)}
              >
                ➕ Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-muted my-3">No heparin challenge checkpoints logged yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Hours on Heparin</th>
                      <th>Time</th>
                      <th>Temp (°C)</th>
                      <th>Heart Rate</th>
                      <th>BP</th>
                      <th>aPTT</th>
                      <th>Heparin Rate</th>
                      <th>Pain (0-10)</th>
                      <th>Bleeding Signs</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowsheet.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <strong>{log.hours_since_heparin_start} hrs</strong>
                        </td>
                        <td>{new Date(log.log_datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <span className={`fw-bold ${log.temperature_celsius >= 38.0 ? 'text-danger' : 'text-success'}`}>
                            {log.temperature_celsius}°C
                          </span>
                        </td>
                        <td>{log.heart_rate} bpm</td>
                        <td>{log.systolic_bp}/{log.diastolic_bp} mmHg</td>
                        <td>
                          <span className="badge bg-secondary">
                            {log.aptt_seconds ? `${log.aptt_seconds}s` : '—'}
                          </span>
                        </td>
                        <td>{log.heparin_infusion_rate_units_hr ? `${log.heparin_infusion_rate_units_hr} U/h` : '—'}</td>
                        <td>
                          <span className={log.flank_abdominal_pain_score > 4 ? 'text-warning fw-bold' : ''}>
                            {log.flank_abdominal_pain_score} / 10
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${log.bleeding_signs === 'none' ? 'bg-success' : 'bg-danger'}`}>
                            {log.bleeding_signs.replace(/_/g, ' ')}
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
      <ObstetricSptModal
        patientId={patientId}
        existingEpisode={null}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {currentEpisode && (
        <ObstetricSptModal
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
        <ObstetricSptFlowsheetModal
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
