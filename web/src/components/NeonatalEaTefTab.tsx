import React, { useState, useEffect } from 'react';
import {
  getNeonatalEaTefEpisodes,
  getNeonatalEaTefEpisode,
  updateNeonatalEaTefEpisode,
  type NeonatalEaTefRecord,
  type NeonatalEaTefFlowsheetRecord,
} from '../api';
import { NeonatalEaTefModal } from './NeonatalEaTefModal';
import { NeonatalEaTefFlowsheetModal } from './NeonatalEaTefFlowsheetModal';
import { type NeonatalEaTefEvaluationResult } from '../neonatalEaTefEngine';

interface Props {
  patientId: number;
}

export const NeonatalEaTefTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalEaTefRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalEaTefRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalEaTefEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalEaTefFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalEaTefEpisodes({ patientId });
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
      console.error('Error loading EA/TEF episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalEaTefEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading EA/TEF details:', err);
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

  const handleStatusChange = async (newStatus: NeonatalEaTefRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateNeonatalEaTefEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        ageHours: currentEpisode.age_hours,
        weightKg: currentEpisode.weight_kg,
        frothyOralSecretions: Boolean(currentEpisode.frothy_oral_secretions),
        chokingCyanosisWithFeed: Boolean(currentEpisode.choking_cyanosis_with_feed),
        ogTubeCoilingDistanceCm: currentEpisode.og_tube_coiling_distance_cm,
        grossClassificationType: currentEpisode.gross_classification_type,
        abdominalGasPattern: currentEpisode.abdominal_gas_pattern,
        replogleTubeInSitu: Boolean(currentEpisode.replogle_tube_in_situ),
        replogleSuctionPressureMmHg: currentEpisode.replogle_suction_pressure_mmhg,
        gapLengthClassification: currentEpisode.gap_length_classification,
        vacterlVertebralAnomaly: Boolean(currentEpisode.vacterl_vertebral_anomaly),
        vacterlAnorectalMalformation: Boolean(currentEpisode.vacterl_anorectal_malformation),
        vacterlCardiacAnomaly: Boolean(currentEpisode.vacterl_cardiac_anomaly),
        vacterlRightAorticArch: Boolean(currentEpisode.vacterl_right_aortic_arch),
        vacterlRenalUltrasoundAbnormal: Boolean(currentEpisode.vacterl_renal_ultrasound_abnormal),
        vacterlLimbRadialAnomaly: Boolean(currentEpisode.vacterl_limb_radial_anomaly),
        headOfBedElevated30deg: Boolean(currentEpisode.head_of_bed_elevated_30deg),
        surgicalProcedurePlanned: currentEpisode.surgical_procedure_planned,
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      loadEpisodeDetails(currentEpisode.id);
      loadEpisodes();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-6 text-gray-500">Loading EA/TEF episodes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Episode Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Neonatal Esophageal Atresia & TEF (EA/TEF) Management
          </h2>
          <p className="text-xs text-gray-500">
            Replogle Sump Suction 20-30 mmHg • Gross Types A-E • VACTERL Association
          </p>
        </div>

        <div className="flex items-center gap-2">
          {episodes.length > 0 && (
            <select
              value={selectedEpisodeId || ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
              className="border rounded px-3 py-1.5 text-sm bg-white font-medium"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-cyan-700 text-white rounded text-sm font-semibold hover:bg-cyan-800"
          >
            + New EA/TEF Episode
          </button>
        </div>
      </div>

      {!currentEpisode ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500 text-sm">No EA/TEF protocol recorded for this patient.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 bg-cyan-700 text-white rounded text-sm font-medium hover:bg-cyan-800"
          >
            Initiate EA/TEF Evaluation
          </button>
        </div>
      ) : (
        <>
          {/* Urgency Alert & Classification Banner */}
          {evaluation && (
            <div
              className={`p-4 rounded-lg border ${
                evaluation.urgencyTier === 'emergency_surgical_repair'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : evaluation.urgencyTier === 'staged_long_gap_management'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-cyan-50 border-cyan-300 text-cyan-900'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="font-bold text-base">{evaluation.urgencyTierLabel}</span>
                  <p className="text-xs mt-1 font-medium">{evaluation.grossTypeDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs rounded-full font-bold uppercase bg-white border">
                    {currentEpisode.gap_length_classification.replace(/_/g, ' ')}
                  </span>
                  <a
                    href={`/neonatal-ea-tef/${currentEpisode.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-xs font-semibold"
                  >
                    🖨️ Printable Dossier
                  </a>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-3 py-1 bg-cyan-800 text-white rounded text-xs font-semibold hover:bg-cyan-900"
                  >
                    Edit Protocol
                  </button>
                </div>
              </div>

              {/* Thoracotomy Lateralization highlight */}
              <div className="mt-3 p-2 bg-white/80 rounded border text-xs">
                <span className="font-bold">Thoracotomy Side Lateralization: </span>
                <span className={evaluation.surgicalThoracotomySide === 'left_thoracotomy_right_arch' ? 'text-red-700 font-bold' : 'text-gray-800 font-medium'}>
                  {evaluation.surgicalThoracotomySideLabel}
                </span>
              </div>

              {evaluation.alerts.length > 0 && (
                <div className="mt-3 space-y-1">
                  {evaluation.alerts.map((al, idx) => (
                    <div key={idx} className="text-xs font-semibold text-red-700 flex items-start gap-1">
                      <span>⚠️</span>
                      <span>{al}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clinical Status & Workflow Progression */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="text-xs">
              <span className="font-semibold text-gray-500 uppercase tracking-wider">Protocol Status: </span>
              <span className="font-bold text-cyan-800 ml-1 uppercase">
                {currentEpisode.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Update Phase:</span>
              <button
                onClick={() => handleStatusChange('preop_replogle_sump_decompression')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'preop_replogle_sump_decompression'
                    ? 'bg-cyan-700 text-white border-cyan-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                1. Pre-op Sump
              </button>
              <button
                onClick={() => handleStatusChange('in_operating_room_thoracotomy')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'in_operating_room_thoracotomy'
                    ? 'bg-cyan-700 text-white border-cyan-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                2. Operating Room
              </button>
              <button
                onClick={() => handleStatusChange('postop_transanastomotic_tube_recovery')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'postop_transanastomotic_tube_recovery'
                    ? 'bg-cyan-700 text-white border-cyan-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                3. Post-op Tube
              </button>
              <button
                onClick={() => handleStatusChange('esophagram_contrast_clearance')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'esophagram_contrast_clearance'
                    ? 'bg-cyan-700 text-white border-cyan-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                4. Esophagram
              </button>
              <button
                onClick={() => handleStatusChange('resolved_full_oral_feeding')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'resolved_full_oral_feeding'
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                5. Oral Feeding
              </button>
            </div>
          </div>

          {/* Clinical Assessment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Neonatal Vitals & Tube Coiling
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Age:</span>
                  <span className="font-semibold">{currentEpisode.age_hours} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Weight:</span>
                  <span className="font-semibold">{currentEpisode.weight_kg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">OG Tube Coiling:</span>
                  <span className="font-semibold text-cyan-700">{currentEpisode.og_tube_coiling_distance_cm} cm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Frothy Secretions:</span>
                  <span className="font-semibold">{currentEpisode.frothy_oral_secretions ? 'Yes (Profuse)' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Feed Cyanosis:</span>
                  <span className="font-semibold text-red-600">{currentEpisode.choking_cyanosis_with_feed ? 'Present' : 'Absent'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Head Up 30-45°:</span>
                  <span className="font-semibold">{currentEpisode.head_of_bed_elevated_30deg ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-800 mb-2">
                Replogle Sump Suction Protocol
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Replogle In Situ:</span>
                  <span className="font-semibold text-green-700">
                    {currentEpisode.replogle_tube_in_situ ? 'Yes (Double-Lumen)' : 'NO (Place 8/10 Fr)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Continuous Suction:</span>
                  <span className="font-semibold text-cyan-800">{currentEpisode.replogle_suction_pressure_mmhg} mmHg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Range:</span>
                  <span className="font-semibold text-gray-700">20 - 30 mmHg low suction</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Abdominal Gas:</span>
                  <span className="font-semibold">{currentEpisode.abdominal_gas_pattern.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Planned Surgery:</span>
                  <span className="font-semibold">{currentEpisode.surgical_procedure_planned.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  VACTERL Association
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  {evaluation?.vacterlFeatureCount ?? 1} / 6
                </span>
              </div>
              <div className="space-y-1 text-xs">
                {evaluation?.vacterlDefectsIdentified.map((def, idx) => (
                  <div key={idx} className="flex items-start gap-1 text-gray-800 font-medium">
                    <span className="text-amber-600">•</span>
                    <span>{def}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Flowsheet Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-gray-900">Replogle Sump & Airway Flowsheet</h3>
                <p className="text-xs text-gray-500">Continuous suction monitoring, flush logs, and aspirate volume</p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 bg-cyan-700 text-white rounded text-xs font-semibold hover:bg-cyan-800"
              >
                + Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">
                No flowsheet entries recorded yet. Click "+ Add Checkpoint" to log Replogle suction and aspirate.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Hours</th>
                      <th className="py-2.5 px-3">Flushed</th>
                      <th className="py-2.5 px-3">Aspirate Vol</th>
                      <th className="py-2.5 px-3">Character</th>
                      <th className="py-2.5 px-3">HR / RR</th>
                      <th className="py-2.5 px-3">SpO2</th>
                      <th className="py-2.5 px-3">Girth</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 whitespace-nowrap">{log.log_datetime.replace('T', ' ')}</td>
                        <td className="py-2 px-3">{log.hours_from_admission}h</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              log.replogle_saline_flushed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.replogle_saline_flushed ? 'Flushed' : 'Not Flushed'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-cyan-800">
                          {log.replogle_aspirate_volume_ml !== null ? `${log.replogle_aspirate_volume_ml} mL` : '—'}
                        </td>
                        <td className="py-2 px-3 capitalize">{log.replogle_aspirate_character.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{log.heart_rate} / {log.respiratory_rate}</td>
                        <td className="py-2 px-3 font-medium">{log.oxygen_saturation_pct}%</td>
                        <td className="py-2 px-3">{log.abdominal_girth_cm ? `${log.abdominal_girth_cm} cm` : '—'}</td>
                        <td className="py-2 px-3 max-w-xs truncate" title={log.notes || ''}>{log.notes || '—'}</td>
                        <td className="py-2 px-3 text-gray-500">{log.logged_by_name || `User #${log.logged_by_id}`}</td>
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
      {showCreateModal && (
        <NeonatalEaTefModal
          patientId={patientId}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => loadEpisodes()}
        />
      )}

      {showEditModal && currentEpisode && (
        <NeonatalEaTefModal
          patientId={patientId}
          existingEpisode={currentEpisode}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            loadEpisodes();
            loadEpisodeDetails(currentEpisode.id);
          }}
        />
      )}

      {showFlowsheetModal && currentEpisode && (
        <NeonatalEaTefFlowsheetModal
          episodeId={currentEpisode.id}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(currentEpisode.id)}
        />
      )}
    </div>
  );
};
