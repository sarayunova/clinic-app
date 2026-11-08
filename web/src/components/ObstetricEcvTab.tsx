import React, { useState, useEffect } from 'react';
import {
  getObstetricEcvEpisodes,
  getObstetricEcvEpisode,
  updateObstetricEcvStatus,
  deleteObstetricEcvFlowsheet,
  type ObstetricEcvRecord,
  type ObstetricEcvFlowsheetRecord,
} from '../api';
import { ObstetricEcvModal } from './ObstetricEcvModal';
import { ObstetricEcvFlowsheetModal } from './ObstetricEcvFlowsheetModal';
import { type ObstetricEcvEvaluationResult } from '../obstetricEcvEngine';

interface Props {
  patientId: number;
}

export const ObstetricEcvTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricEcvRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricEcvRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricEcvEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricEcvFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricEcvEpisodes({ patientId });
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
      console.error('Error loading ECV episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricEcvEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet || res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading ECV details:', err);
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
      await updateObstetricEcvStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update ECV status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deleteObstetricEcvFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete ECV flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
        <p>Loading External Cephalic Version records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">🔄</span>
            Obstetric External Cephalic Version (ECV) Protocol
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            ACOG Practice Bulletin No. 13 &middot; RCOG Green-top No. 20a &middot; Tocolysis & Predictive Calculator
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisodeId && (
            <a
              href={`#/print/obstetric-ecv/${selectedEpisodeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition"
            >
              <span>🖨️</span> Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow flex items-center gap-1.5 transition"
          >
            <span>+</span> New ECV Candidate Evaluation
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <span className="text-4xl">🔄</span>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No ECV Protocols Recorded</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
            Evaluate non-cephalic pregnancies at ≥ 36–37 weeks for version eligibility, tocolysis planning, and Rh immunoprophylaxis.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
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
                        ? 'bg-indigo-50 border-indigo-400 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-mono font-bold text-indigo-900">{ep.episode_code}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ep.ecv_outcome === 'successful_cephalic_conversion'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ep.ecv_outcome === 'emergency_cesarean_transfer'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {ep.ecv_outcome === 'successful_cephalic_conversion' ? 'Cephalic (+)' : ep.ecv_outcome.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1.5">
                      Date: {new Date(ep.procedure_datetime).toLocaleDateString([], { dateStyle: 'short' })}
                    </div>
                    <div className="text-xs font-medium text-gray-800 mt-1 flex items-center justify-between">
                      <span>Prob: {ep.calculated_success_probability_pct}%</span>
                      <span className="text-gray-500">{ep.gestational_age_weeks}w</span>
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
                          currentEpisode.status === 'successful_monitoring_discharge'
                            ? 'bg-emerald-100 text-emerald-800'
                            : currentEpisode.status === 'emergency_delivery_transfer'
                            ? 'bg-red-100 text-red-800 animate-pulse'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {currentEpisode.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Consultant: {currentEpisode.consultant_name || 'Attending Obstetrician'} &middot; Scheduled:{' '}
                      {new Date(currentEpisode.procedure_datetime).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600">Update Status:</label>
                    <select
                      value={currentEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="border rounded-lg px-2.5 py-1 text-xs font-semibold bg-gray-50 hover:bg-gray-100"
                    >
                      <option value="pre_procedure_assessment">Pre-Procedure Assessment</option>
                      <option value="tocolysis_in_progress">Tocolysis In Progress</option>
                      <option value="version_attempts_active">Version Maneuvers Active</option>
                      <option value="successful_monitoring_discharge">Successful & Monitored</option>
                      <option value="emergency_delivery_transfer">Emergency Delivery Transfer</option>
                      <option value="elective_cesarean_scheduled">Elective Cesarean Scheduled</option>
                    </select>
                  </div>
                </div>

                {/* Success Probability & Evaluation Card */}
                {evaluation && (
                  <div
                    className={`p-4 rounded-xl border ${
                      evaluation.hasAbsoluteContraindications
                        ? 'bg-red-50 border-red-300'
                        : evaluation.successLikelihoodTier === 'high'
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-amber-50 border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                          Multivariable Success Estimate
                        </div>
                        <div className="text-2xl font-black text-gray-900 mt-0.5">
                          {evaluation.calculatedSuccessProbabilityPct}% Probability of Cephalic Conversion
                        </div>
                        <div className="text-xs font-semibold text-gray-700 mt-1">
                          {evaluation.successLikelihoodTierLabel}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          evaluation.isEligibleForEcv ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                        }`}
                      >
                        {evaluation.isEligibleForEcv ? 'ELIGIBLE CANDIDATE' : 'CONTRAINDICATED'}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-gray-800 bg-white/70 p-2.5 rounded-lg border">
                      <strong>Tocolysis:</strong> {evaluation.tocolysisRecommendation}
                    </div>

                    {evaluation.alerts.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {evaluation.alerts.map((alt, i) => (
                          <div key={i} className="text-xs font-semibold flex items-center gap-1.5 text-red-900">
                            <span>⚠️</span> {alt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Procedural Features Grid */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Obstetric & Fetal Parameters
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Initial Presentation</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.fetal_presentation_initial.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Placental Location</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.placental_location.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">AFI (cm)</span>
                      <span className="font-bold text-gray-900">{currentEpisode.amniotic_fluid_index_cm} cm</span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Fetal Weight</span>
                      <span className="font-bold text-gray-900">{currentEpisode.estimated_fetal_weight_g} g</span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Tocolytic Used</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.tocolytic_agent_administered.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Maternal Rh Negative</span>
                      <span className="font-bold text-gray-900">
                        {Boolean(currentEpisode.maternal_rh_negative) ? '⚠️ Yes (Rh-)' : 'No (Rh+)'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Anti-D Given</span>
                      <span className="font-bold text-gray-900">
                        {Boolean(currentEpisode.rh_anti_d_administered) ? '✅ 300 mcg' : 'Not given'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Final Outcome</span>
                      <span className="font-bold text-gray-900 capitalize">
                        {currentEpisode.ecv_outcome.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Flowsheet Log Table */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <span>⏱️</span> Procedural Flowsheet & Fetal Heart Tracing Log
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Maternal Vitals, FHR Baseline, Decelerations & Uterine Tone
                      </p>
                    </div>
                    <button
                      onClick={() => setShowFlowsheetModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition"
                    >
                      + Add Checkpoint
                    </button>
                  </div>

                  {flowsheet.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-xs border border-dashed rounded-lg">
                      No serial checkpoints logged yet. Click &quot;Add Checkpoint&quot; to log post-attempt fetal heart rate and maternal vitals.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                          <tr>
                            <th className="py-2 px-3">Time / Min</th>
                            <th className="py-2 px-3">FHR Baseline</th>
                            <th className="py-2 px-3">EFM Pattern</th>
                            <th className="py-2 px-3">Maternal HR / BP</th>
                            <th className="py-2 px-3">Uterine Tone</th>
                            <th className="py-2 px-3">Notes</th>
                            <th className="py-2 px-3">Logged By</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-gray-800">
                          {flowsheet.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 whitespace-nowrap font-medium">
                                +{log.minutes_from_start} min ({new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </td>
                              <td className="py-2 px-3 font-bold text-indigo-700">
                                {log.fetal_heart_rate_baseline} bpm
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-medium ${
                                    log.efm_pattern === 'reactive_reassuring'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : log.efm_pattern === 'persistent_severe_bradycardia'
                                      ? 'bg-red-100 text-red-800 font-bold'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {log.efm_pattern.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {log.maternal_heart_rate} bpm &middot; {log.maternal_blood_pressure_sys ? `${log.maternal_blood_pressure_sys}/${log.maternal_blood_pressure_dia}` : '—'}
                              </td>
                              <td className="py-2 px-3">
                                {Boolean(log.uterine_relaxation_adequate) ? 'Relaxed' : 'Firm/Contracting'}
                              </td>
                              <td className="py-2 px-3 max-w-xs truncate" title={log.notes || ''}>
                                {log.notes || '—'}
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
      <ObstetricEcvModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <ObstetricEcvFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
