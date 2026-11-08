import React, { useState, useEffect } from 'react';
import {
  getNeonatalIntestinalAtresiaEpisodes,
  getNeonatalIntestinalAtresiaEpisode,
  updateNeonatalIntestinalAtresiaEpisode,
  type NeonatalIntestinalAtresiaRecord,
  type NeonatalIntestinalAtresiaFlowsheetRecord,
} from '../api';
import { NeonatalIntestinalAtresiaModal } from './NeonatalIntestinalAtresiaModal';
import { NeonatalIntestinalAtresiaFlowsheetModal } from './NeonatalIntestinalAtresiaFlowsheetModal';
import { type NeonatalIntestinalAtresiaEvaluationResult } from '../neonatalIntestinalAtresiaEngine';

interface Props {
  patientId: number;
}

export const NeonatalIntestinalAtresiaTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalIntestinalAtresiaRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalIntestinalAtresiaRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalIntestinalAtresiaEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalIntestinalAtresiaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalIntestinalAtresiaEpisodes({ patientId });
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
      console.error('Error loading intestinal atresia episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalIntestinalAtresiaEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading intestinal atresia details:', err);
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

  const handleStatusChange = async (newStatus: NeonatalIntestinalAtresiaRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateNeonatalIntestinalAtresiaEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        ageHours: currentEpisode.age_hours,
        weightKg: currentEpisode.weight_kg,
        atresiaLevel: currentEpisode.atresia_level,
        polyhydramniosAntenatal: Boolean(currentEpisode.polyhydramnios_antenatal),
        biliousEmesisPresent: Boolean(currentEpisode.bilious_emesis_present),
        abdominalDistensionPattern: currentEpisode.abdominal_distension_pattern,
        radiographicGasPattern: currentEpisode.radiographic_gas_pattern,
        downSyndromeFeaturesPresent: Boolean(currentEpisode.down_syndrome_features_present),
        karyotypeTrisomy21Confirmed: Boolean(currentEpisode.karyotype_trisomy_21_confirmed),
        echocardiogramCardiacDefect: Boolean(currentEpisode.echocardiogram_cardiac_defect),
        replogleDecompressionActive: Boolean(currentEpisode.replogle_decompression_active),
        surgicalProcedurePlanned: currentEpisode.surgical_procedure_planned,
        transanastomoticTubePlaced: Boolean(currentEpisode.transanastomotic_tube_placed),
        tpnCentralLineInSitu: Boolean(currentEpisode.tpn_central_line_in_situ),
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
    return <div className="p-4 text-center">Loading Intestinal Atresia protocol...</div>;
  }

  return (
    <div className="intestinal-atresia-tab p-3">
      {/* Header & Episode Selector */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <h3 className="m-0">👶 Neonatal Intestinal Atresia (Duodenal &amp; Jejunoileal)</h3>
          {episodes.length > 1 && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={selectedEpisodeId ?? ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.atresia_level.replace(/_/g, ' ').toUpperCase()})
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
                ➕ Log NG / Feed Checkpoint
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowEditModal(true)}
              >
                ✏️ Edit Protocol
              </button>
              <a
                href={`/neonatal-intestinal-atresia/${currentEpisode.id}/print`}
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
            ➕ New Atresia Protocol
          </button>
        </div>
      </div>

      {!currentEpisode ? (
        <div className="card text-center p-5">
          <h4>No Intestinal Atresia Record Found</h4>
          <p className="text-muted">
            Initiate a protocol for duodenal double-bubble or jejunoileal apple-peel intestinal atresia.
          </p>
          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Initiate Intestinal Atresia Protocol
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
                { key: 'preop_nasogastric_decompression', label: '1. NG Decompression' },
                { key: 'contrast_imaging_enema_workup', label: '2. Contrast Workup' },
                { key: 'in_operating_room_reconstruction', label: '3. Operating Room' },
                { key: 'postop_transanastomotic_tube_tpn', label: '4. Postop TAT / TPN' },
                { key: 'resolved_full_enteral_nutrition', label: '5. Full Feeds' },
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
                  evaluation.urgencyTier === 'emergency_obstruction_or_volvulus'
                    ? '#dc3545'
                    : evaluation.urgencyTier === 'urgent_surgical_stabilization'
                    ? '#ffc107'
                    : '#198754'
                }`,
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="m-0">{evaluation.atresiaClassificationLabel}</h5>
                <span
                  className={`badge ${
                    evaluation.urgencyTier === 'emergency_obstruction_or_volvulus'
                      ? 'bg-danger'
                      : evaluation.urgencyTier === 'urgent_surgical_stabilization'
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
                    <small className="text-muted d-block">Radiographic Pattern</small>
                    <strong>{currentEpisode.radiographic_gas_pattern.replace(/_/g, ' ')}</strong>
                    <div>{currentEpisode.abdominal_distension_pattern.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Trisomy 21 / Down Risk</small>
                    <strong>{evaluation.syndromicTrisomy21Label}</strong>
                    <div>{currentEpisode.echocardiogram_cardiac_defect ? 'Cardiac Defect Confirmed' : 'Echo Unremarkable'}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Short Bowel Risk</small>
                    <strong className={evaluation.isApplePeelAtresia ? 'text-danger' : 'text-primary'}>
                      {evaluation.shortBowelSyndromeRiskLabel}
                    </strong>
                    <div>{currentEpisode.atresia_level.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-2 border rounded bg-light">
                    <small className="text-muted d-block">Surgical Plan &amp; Access</small>
                    <strong>{currentEpisode.surgical_procedure_planned.replace(/_/g, ' ')}</strong>
                    <div>{currentEpisode.transanastomotic_tube_placed ? 'TAT Placed' : 'No TAT'} • {currentEpisode.tpn_central_line_in_situ ? 'TPN Central Line' : 'Peripheral'}</div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mt-2">
                <div className="col-md-6">
                  <h6 className="fw-bold mb-1">🫁 Decompression &amp; Fluid Directives</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.decompressionDirectives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6 className="fw-bold mb-1">🔪 Operative Reconstruction Directives</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.surgicalDirectives.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {evaluation.nutritionalDirectives.length > 0 && (
                <div className="mt-2 pt-2 border-top">
                  <h6 className="fw-bold mb-1">🍼 Nutritional &amp; Motility Recovery Directives</h6>
                  <ul className="mb-0 ps-3 small text-muted">
                    {evaluation.nutritionalDirectives.map((d, i) => (
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
              <h5 className="m-0">📈 Bedside NG Decompression, Feeds &amp; Transit Flowsheet</h5>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowFlowsheetModal(true)}
              >
                ➕ Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-muted my-3">No flowsheet checkpoints logged yet. Track initial aspirate above.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Hours</th>
                      <th>Time</th>
                      <th>NG Output</th>
                      <th>Aspirate Color</th>
                      <th>Abdominal Girth</th>
                      <th>TAT / Enteral Feed</th>
                      <th>Stool Character</th>
                      <th>HR / RR</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowsheet.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <strong>{log.hours_from_admission} hrs</strong>
                        </td>
                        <td>{new Date(log.log_datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <span className="fw-bold text-primary">{log.nasogastric_output_ml} mL</span>
                        </td>
                        <td>
                          <span className={`badge ${log.nasogastric_aspirate_character === 'bilious_dark_green' ? 'bg-success' : 'bg-secondary'}`}>
                            {log.nasogastric_aspirate_character.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{log.abdominal_girth_cm} cm</td>
                        <td>{log.enteral_feed_rate_ml_hr > 0 ? `${log.enteral_feed_rate_ml_hr} mL/h` : 'NPO (TPN)'}</td>
                        <td>
                          <span className={`badge ${log.stool_character === 'normal_yellow_breastmilk_stool' ? 'bg-success' : log.stool_character === 'pale_mucus_plug' ? 'bg-warning text-dark' : 'bg-light text-dark'}`}>
                            {log.stool_character.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{log.heart_rate} / {log.respiratory_rate}</td>
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
      <NeonatalIntestinalAtresiaModal
        patientId={patientId}
        existingEpisode={null}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {currentEpisode && (
        <NeonatalIntestinalAtresiaModal
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
        <NeonatalIntestinalAtresiaFlowsheetModal
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
