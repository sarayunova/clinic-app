import React, { useState, useEffect } from 'react';
import {
  getPediatricEmpyemaEpisodes,
  getPediatricEmpyemaEpisode,
  updatePediatricEmpyemaEpisode,
  type PediatricEmpyemaRecord,
  type PediatricEmpyemaFlowsheetRecord,
} from '../api';
import { PediatricEmpyemaModal } from './PediatricEmpyemaModal';
import { PediatricEmpyemaFlowsheetModal } from './PediatricEmpyemaFlowsheetModal';
import { type PediatricEmpyemaEvaluationResult } from '../pediatricEmpyemaEngine';

interface Props {
  patientId: number;
}

export const PediatricEmpyemaTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricEmpyemaRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricEmpyemaRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricEmpyemaEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricEmpyemaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricEmpyemaEpisodes({ patientId });
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
      console.error('Error loading Empyema episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricEmpyemaEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading Empyema details:', err);
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

  const handleStatusChange = async (newStatus: PediatricEmpyemaRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updatePediatricEmpyemaEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        ageYears: currentEpisode.age_years,
        weightKg: currentEpisode.weight_kg,
        stagingPhase: currentEpisode.staging_phase,
        ultrasoundFindings: currentEpisode.ultrasound_findings,
        pleuralFluidPh: currentEpisode.pleural_fluid_ph,
        pleuralFluidGlucoseMgDl: currentEpisode.pleural_fluid_glucose_mg_dl,
        pleuralFluidLdhUL: currentEpisode.pleural_fluid_ldh_u_l,
        pleuralFluidAppearance: currentEpisode.pleural_fluid_appearance,
        gramStainCultureIsolated: currentEpisode.gram_stain_culture_isolated,
        chestTubePlaced: Boolean(currentEpisode.chest_tube_placed),
        chestTubeSizeFr: currentEpisode.chest_tube_size_fr,
        intrapleuralFibrinolyticTherapy: currentEpisode.intrapleural_fibrinolytic_therapy,
        dosesCompleted: currentEpisode.doses_completed,
        vatsDecorticationIndicated: Boolean(currentEpisode.vats_decortication_indicated),
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      loadEpisodeDetails(currentEpisode.id);
      loadEpisodes();
    } catch (err) {
      console.error('Failed to update empyema status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-6 text-gray-500">Loading Pediatric Empyema episodes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Episode Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Pediatric Empyema &amp; Complicated Parapneumonic Effusion
          </h2>
          <p className="text-xs text-gray-500">
            BTS Guidelines • Intrapleural tPA + Dornase alfa (DNase) • VATS Surgical Decortication
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
            className="px-3.5 py-1.5 bg-indigo-700 text-white rounded text-sm font-semibold hover:bg-indigo-800"
          >
            + New Empyema Episode
          </button>
        </div>
      </div>

      {!currentEpisode ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500 text-sm">No pediatric empyema episode recorded for this patient.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 bg-indigo-700 text-white rounded text-sm font-medium hover:bg-indigo-800"
          >
            Initiate Empyema Evaluation
          </button>
        </div>
      ) : (
        <>
          {/* Urgency Alert & Recommendation Banner */}
          {evaluation && (
            <div
              className={`p-4 rounded-lg border ${
                evaluation.urgencyTier === 'vats_thoracoscopy_surgical'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : evaluation.urgencyTier === 'intrapleural_fibrinolysis_active'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-indigo-50 border-indigo-300 text-indigo-900'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="font-bold text-base">{evaluation.urgencyTierLabel}</span>
                  <p className="text-xs mt-1 font-medium">
                    Calculated Stage: <span className="uppercase font-bold">{evaluation.calculatedRecommendedStage.replace(/_/g, ' ')}</span> • tPA {evaluation.fibrinolyticDosing.tpaDoseMg}mg + DNase {evaluation.fibrinolyticDosing.dornaseAlfaDoseMg}mg
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs rounded-full font-bold uppercase bg-white border">
                    {currentEpisode.intrapleural_fibrinolytic_therapy.replace(/_/g, ' ')}
                  </span>
                  <a
                    href={`/pediatric-empyema/${currentEpisode.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-xs font-semibold"
                  >
                    🖨️ Printable Dossier
                  </a>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-3 py-1 bg-indigo-800 text-white rounded text-xs font-semibold hover:bg-indigo-900"
                  >
                    Edit Protocol
                  </button>
                </div>
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

          {/* Status Progression Workflow */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="text-xs">
              <span className="font-semibold text-gray-500 uppercase tracking-wider">Protocol Status: </span>
              <span className="font-bold text-indigo-800 ml-1 uppercase">
                {currentEpisode.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Update Phase:</span>
              <button
                onClick={() => handleStatusChange('chest_tube_insertion')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'chest_tube_insertion'
                    ? 'bg-indigo-700 text-white border-indigo-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                1. Drain Inserted
              </button>
              <button
                onClick={() => handleStatusChange('intrapleural_fibrinolysis_active')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'intrapleural_fibrinolysis_active'
                    ? 'bg-indigo-700 text-white border-indigo-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                2. Fibrinolysis (tPA/DNase)
              </button>
              <button
                onClick={() => handleStatusChange('vats_surgical_decortication')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'vats_surgical_decortication'
                    ? 'bg-red-700 text-white border-red-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                3. VATS Surgery
              </button>
              <button
                onClick={() => handleStatusChange('resolving_drain_removal_phase')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'resolving_drain_removal_phase'
                    ? 'bg-indigo-700 text-white border-indigo-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                4. Drain Removal
              </button>
              <button
                onClick={() => handleStatusChange('discharged_complete_resolution')}
                className={`px-2.5 py-1 text-xs rounded font-medium border ${
                  currentEpisode.status === 'discharged_complete_resolution'
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                5. Complete Resolution
              </button>
            </div>
          </div>

          {/* Assessment Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-2">
                Patient &amp; Ultrasound Staging
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Age:</span>
                  <span className="font-semibold">{currentEpisode.age_years} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Weight:</span>
                  <span className="font-semibold">{currentEpisode.weight_kg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Staging:</span>
                  <span className="font-semibold text-indigo-700">{currentEpisode.staging_phase.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">US Morphology:</span>
                  <span className="font-semibold">{currentEpisode.ultrasound_findings.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Culture:</span>
                  <span className="font-semibold text-indigo-900">{currentEpisode.gram_stain_culture_isolated || 'None reported'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
                Pleural Fluid Analysis (Light's)
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pleural Fluid pH:</span>
                  <span className={`font-semibold ${currentEpisode.pleural_fluid_ph !== null && currentEpisode.pleural_fluid_ph < 7.20 ? 'text-red-600 font-bold' : ''}`}>
                    {currentEpisode.pleural_fluid_ph !== null ? currentEpisode.pleural_fluid_ph : '—'} (&lt;7.20)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Glucose:</span>
                  <span className={`font-semibold ${currentEpisode.pleural_fluid_glucose_mg_dl !== null && currentEpisode.pleural_fluid_glucose_mg_dl < 40 ? 'text-red-600 font-bold' : ''}`}>
                    {currentEpisode.pleural_fluid_glucose_mg_dl !== null ? `${currentEpisode.pleural_fluid_glucose_mg_dl} mg/dL` : '—'} (&lt;40)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">LDH:</span>
                  <span className={`font-semibold ${currentEpisode.pleural_fluid_ldh_u_l !== null && currentEpisode.pleural_fluid_ldh_u_l > 1000 ? 'text-red-600 font-bold' : ''}`}>
                    {currentEpisode.pleural_fluid_ldh_u_l !== null ? `${currentEpisode.pleural_fluid_ldh_u_l} U/L` : '—'} (&gt;1000)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Appearance:</span>
                  <span className="font-semibold capitalize text-amber-800">{currentEpisode.pleural_fluid_appearance.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">VATS Indication:</span>
                  <span className={`font-semibold ${currentEpisode.vats_decortication_indicated ? 'text-red-700 font-bold' : 'text-gray-700'}`}>
                    {currentEpisode.vats_decortication_indicated ? 'YES - DECORTICATION' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Fibrinolytic Regimen (BTS)
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Chest Tube:</span>
                  <span className="font-semibold text-green-700">
                    {currentEpisode.chest_tube_placed ? `In Situ (${currentEpisode.chest_tube_size_fr || 10} Fr)` : 'Not Placed'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Regimen:</span>
                  <span className="font-semibold text-indigo-800">{currentEpisode.intrapleural_fibrinolytic_therapy.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Doses Given:</span>
                  <span className="font-bold text-indigo-900">{currentEpisode.doses_completed} / 6 completed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Clamp Dwell:</span>
                  <span className="font-semibold">2 Hours (then -15 cmH2O)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Flowsheet Log Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-gray-900">Chest Drain &amp; Fibrinolysis Flowsheet</h3>
                <p className="text-xs text-gray-500">Drain output, effluent character, air leak, and tPA dwell logs</p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 bg-indigo-700 text-white rounded text-xs font-semibold hover:bg-indigo-800"
              >
                + Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">
                No flowsheet entries recorded yet. Click "+ Add Checkpoint" to log drain output and tPA dwell.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Hours</th>
                      <th className="py-2.5 px-3">Output (mL)</th>
                      <th className="py-2.5 px-3">Effluent</th>
                      <th className="py-2.5 px-3">Air Leak</th>
                      <th className="py-2.5 px-3">Dwell Done</th>
                      <th className="py-2.5 px-3">Temp / RR</th>
                      <th className="py-2.5 px-3">SpO2</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 whitespace-nowrap">{log.log_datetime.replace('T', ' ')}</td>
                        <td className="py-2 px-3">{log.hours_from_drain_placement}h</td>
                        <td className="py-2 px-3 font-bold text-indigo-800">{log.chest_drain_output_ml} mL</td>
                        <td className="py-2 px-3 capitalize">{log.drain_effluent_appearance.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-3 capitalize">{log.air_leak_grade.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              log.fibrinolytic_instilled_dwell_completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {log.fibrinolytic_instilled_dwell_completed ? '2h Dwell Done' : 'No Dwell'}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">{log.temperature_celsius}°C / {log.respiratory_rate}</td>
                        <td className="py-2 px-3">{log.oxygen_saturation_pct}%</td>
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
        <PediatricEmpyemaModal
          patientId={patientId}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => loadEpisodes()}
        />
      )}

      {showEditModal && currentEpisode && (
        <PediatricEmpyemaModal
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
        <PediatricEmpyemaFlowsheetModal
          episodeId={currentEpisode.id}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(currentEpisode.id)}
        />
      )}
    </div>
  );
};
