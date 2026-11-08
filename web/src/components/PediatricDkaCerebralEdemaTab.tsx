import React, { useState, useEffect } from 'react';
import {
  getPediatricDkaCerebralEdemaEpisodes,
  getPediatricDkaCerebralEdemaEpisode,
  updatePediatricDkaCerebralEdemaStatus,
  deletePediatricDkaCerebralEdemaFlowsheet,
  type PediatricDkaCerebralEdemaRecord,
  type PediatricDkaCerebralEdemaFlowsheetRecord,
} from '../api';
import { PediatricDkaCerebralEdemaModal } from './PediatricDkaCerebralEdemaModal';
import { PediatricDkaCerebralEdemaFlowsheetModal } from './PediatricDkaCerebralEdemaFlowsheetModal';
import { type PediatricDkaCerebralEdemaEvaluationResult } from '../pediatricDkaCerebralEdemaEngine';

interface Props {
  patientId: number;
}

export const PediatricDkaCerebralEdemaTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricDkaCerebralEdemaRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricDkaCerebralEdemaRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricDkaCerebralEdemaEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricDkaCerebralEdemaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricDkaCerebralEdemaEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const firstId = res.episodes[0].id;
        setSelectedEpisodeId(prev => (prev && res.episodes.some(e => e.id === prev) ? prev : firstId));
      } else {
        setSelectedEpisodeId(null);
        setCurrentEpisode(null);
        setEvaluation(null);
        setFlowsheet([]);
      }
    } catch (err) {
      console.error('Error loading DKA CE episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricDkaCerebralEdemaEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet || res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading DKA CE details:', err);
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

  const handleStatusChange = async (status: string) => {
    if (!selectedEpisodeId) return;
    try {
      await updatePediatricDkaCerebralEdemaStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update DKA CE status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deletePediatricDkaCerebralEdemaFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete DKA CE flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full mb-2"></div>
        <p>Loading DKA Cerebral Edema records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="p-2 bg-rose-100 text-rose-700 rounded-lg">🧠</span>
            Pediatric DKA Cerebral Edema & Hyperosmolar Rescue Protocol
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            ISPAD 2022 Guidelines &middot; Muir Criteria &middot; 3% NaCl / Mannitol Stat Therapy &middot; PICU Neuroprotection
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisodeId && (
            <a
              href={`#/print/pediatric-dka-ce/${selectedEpisodeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition"
            >
              <span>🖨️</span> Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow flex items-center gap-1.5 transition"
          >
            <span>+</span> New Cerebral Edema Assessment
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <span className="text-4xl">🧠</span>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No Cerebral Edema Protocols Recorded</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
            Evaluate any pediatric DKA patient showing headache, lethargy, recurrent vomiting, or bradycardia for emergent hyperosmolar rescue.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
          >
            Initiate Protocol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Episode Selector List */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Episodes ({episodes.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {episodes.map((ep) => {
                const isSelected = ep.id === selectedEpisodeId;
                return (
                  <div
                    key={ep.id}
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-rose-50 border-rose-400 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-mono font-bold text-rose-900">{ep.episode_code}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ep.muir_criteria_category === 'diagnostic_cerebral_edema'
                            ? 'bg-rose-600 text-white'
                            : ep.muir_criteria_category === 'impending_warning_signs'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.muir_criteria_category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1.5">
                      GCS: <span className="font-bold text-rose-700">{ep.gcs_score}/15</span> &middot; Na+: {ep.serum_sodium_measured_meq_l} mEq/L
                    </div>
                    <div className="text-xs font-medium text-gray-800 mt-1 flex items-center justify-between">
                      <span>Dose: {ep.hyperosmolar_dose_ml} mL</span>
                      <span className="text-gray-500">{ep.age_years}y &middot; {ep.weight_kg}kg</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Episode Details & Flowsheet */}
          <div className="lg:col-span-3 space-y-6">
            {currentEpisode && (
              <>
                {/* Status Bar */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-900">{currentEpisode.episode_code}</span>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          currentEpisode.status === 'neurological_recovery_gcs15'
                            ? 'bg-emerald-100 text-emerald-800'
                            : currentEpisode.status === 'brainstem_herniation_critical'
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {currentEpisode.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Consultant: {currentEpisode.consultant_name || 'PICU Intensivist'} &middot; Detected:{' '}
                      {new Date(currentEpisode.detection_datetime).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600">Update Status:</label>
                    <select
                      value={currentEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs font-semibold bg-gray-50 hover:bg-gray-100"
                    >
                      <option value="emergent_hyperosmolar_rescue">Emergent Rescue</option>
                      <option value="hypertonic_saline_infusing">Saline / Mannitol Infusing</option>
                      <option value="picu_neuro_monitoring">PICU Neuro Monitoring</option>
                      <option value="neurological_recovery_gcs15">Recovered (GCS 15)</option>
                      <option value="brainstem_herniation_critical">Brainstem Herniation</option>
                    </select>
                  </div>
                </div>

                {/* Classification & Dosing Card */}
                {evaluation && (
                  <div
                    className={`p-4 rounded-xl border ${
                      evaluation.muirCriteriaCategory === 'diagnostic_cerebral_edema'
                        ? 'bg-rose-50 border-rose-300'
                        : evaluation.muirCriteriaCategory === 'impending_warning_signs'
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-emerald-50 border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-bold text-gray-900">{evaluation.muirCriteriaCategoryLabel}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Corrected Sodium: <span className="font-bold text-gray-900">{evaluation.serumSodiumCorrectedMeqL} mEq/L</span> &middot;{' '}
                          Effective Osmolality: <span className="font-bold text-gray-900">{evaluation.effectiveSerumOsmolalityMosmKg} mOsm/kg</span>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          evaluation.hyperosmolarRescueIndicated ? 'bg-rose-600 text-white animate-pulse' : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {evaluation.hyperosmolarRescueIndicated ? 'STAT RESCUE GIVEN' : 'SURVEILLANCE'}
                      </span>
                    </div>

                    {/* Dosing Reminder */}
                    <div className="mt-3 p-3 bg-white/80 rounded-lg border text-xs text-rose-950">
                      <strong>Recommended Hyperosmolar Dose:</strong>{' '}
                      3% Hypertonic Saline {evaluation.hyperosmolarSaline3PctDoseMl} mL (5 mL/kg) IV over 10-15 min OR 20% Mannitol {evaluation.mannitol20PctDoseMl} mL (2.5 mL/kg) over 20 min.
                    </div>

                    {evaluation.alerts.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {evaluation.alerts.map((alt, i) => (
                          <div key={i} className="text-xs font-semibold flex items-center gap-1.5 text-rose-900">
                            <span>🚨</span> {alt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Clinical Findings Grid */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Neurological Assessment & Laboratory Parameters
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Glasgow Coma Scale</span>
                      <span className="font-black text-rose-700 text-sm">{currentEpisode.gcs_score} / 15</span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Pupillary Reactivity</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.pupillary_abnormality.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Blood Glucose</span>
                      <span className="font-bold text-gray-900">{currentEpisode.blood_glucose_mg_dl} mg/dL</span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Measured / Corrected Na+</span>
                      <span className="font-bold text-gray-900">
                        {currentEpisode.serum_sodium_measured_meq_l} / {currentEpisode.serum_sodium_corrected_meq_l} mEq/L
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Effective Osmolality</span>
                      <span className="font-bold text-gray-900">{currentEpisode.effective_serum_osmolality_mosm_kg} mOsm/kg</span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Blood pH / HCO3-</span>
                      <span className="font-bold text-gray-900">{currentEpisode.blood_ph} / {currentEpisode.serum_bicarbonate_meq_l} mEq/L</span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Hyperosmolar Rescue Dose</span>
                      <span className="font-bold text-rose-700 capitalize">
                        {currentEpisode.hyperosmolar_dose_ml} mL ({currentEpisode.primary_hyperosmolar_agent.replace(/_/g, ' ')})
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Fluid Rate -30%</span>
                      <span className="font-bold text-emerald-700">
                        {Boolean(currentEpisode.fluid_rate_reduced_by_30pct) ? '✅ Enforced' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Flowsheet Log Table */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <span>⏱️</span> PICU Serial Neurological & Osmolar Trajectory Log
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Serial GCS, Pupils, Corrected Na+, Glucose & IV Fluid Rate
                      </p>
                    </div>
                    <button
                      onClick={() => setShowFlowsheetModal(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow transition"
                    >
                      + Add Checkpoint
                    </button>
                  </div>

                  {flowsheet.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-xs border border-dashed rounded-lg">
                      No serial checkpoints logged yet. Click &quot;Add Checkpoint&quot; to log post-hyperosmolar GCS and sodium checks.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                          <tr>
                            <th className="py-2 px-3">Time / Hours</th>
                            <th className="py-2 px-3">GCS</th>
                            <th className="py-2 px-3">Pupils</th>
                            <th className="py-2 px-3">Glucose (mg/dL)</th>
                            <th className="py-2 px-3">Na+ (Meas / Corr)</th>
                            <th className="py-2 px-3">Fluid Rate</th>
                            <th className="py-2 px-3">Agent Given / Notes</th>
                            <th className="py-2 px-3">Logged By</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-gray-800">
                          {flowsheet.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 whitespace-nowrap font-medium">
                                +{log.hours_from_detection}h ({new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </td>
                              <td className="py-2 px-3 font-black text-rose-700">{log.gcs_score} / 15</td>
                              <td className="py-2 px-3">{log.pupil_size_and_reactivity}</td>
                              <td className="py-2 px-3 font-semibold">{log.blood_glucose_mg_dl}</td>
                              <td className="py-2 px-3 font-bold text-gray-900">
                                {log.serum_sodium_measured_meq_l} / {log.serum_sodium_corrected_meq_l}
                              </td>
                              <td className="py-2 px-3">{log.iv_fluid_rate_ml_hr} mL/hr</td>
                              <td className="py-2 px-3 max-w-xs truncate" title={log.hyperosmolar_agent_given || log.neurological_exam_notes || ''}>
                                {log.hyperosmolar_agent_given || log.neurological_exam_notes || log.notes || '—'}
                              </td>
                              <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                                {log.logged_by_name || 'Staff'}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() => handleDeleteFlowsheet(log.id)}
                                  className="text-red-500 hover:text-red-700 font-bold px-1"
                                  title="Delete Checkpoint"
                                >
                                  &times;
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <PediatricDkaCerebralEdemaModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <PediatricDkaCerebralEdemaFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
