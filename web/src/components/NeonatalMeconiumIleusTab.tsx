import React, { useState, useEffect } from 'react';
import {
  getNeonatalMeconiumIleusEpisodes,
  getNeonatalMeconiumIleusEpisode,
  updateNeonatalMeconiumIleusStatus,
  deleteNeonatalMeconiumIleusFlowsheet,
  type NeonatalMeconiumIleusRecord,
  type NeonatalMeconiumIleusFlowsheetRecord,
} from '../api';
import { NeonatalMeconiumIleusModal } from './NeonatalMeconiumIleusModal';
import { NeonatalMeconiumIleusFlowsheetModal } from './NeonatalMeconiumIleusFlowsheetModal';
import { type NeonatalMeconiumIleusEvaluationResult } from '../neonatalMeconiumIleusEngine';

interface Props {
  patientId: number;
}

export const NeonatalMeconiumIleusTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalMeconiumIleusRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalMeconiumIleusRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalMeconiumIleusEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalMeconiumIleusFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalMeconiumIleusEpisodes({ patientId });
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
      console.error('Error loading Meconium Ileus episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalMeconiumIleusEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet || res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading Meconium Ileus details:', err);
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

  const handleStatusChange = async (newStatus: any) => {
    if (!selectedEpisodeId) return;
    try {
      await updateNeonatalMeconiumIleusStatus(selectedEpisodeId, { status: newStatus });
      loadEpisodeDetails(selectedEpisodeId);
      loadEpisodes();
    } catch (err) {
      console.error('Failed to update episode status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteNeonatalMeconiumIleusFlowsheet(selectedEpisodeId, logId);
      loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading Neonatal Meconium Ileus records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🍼</span> Neonatal Meconium Ileus & Cystic Fibrosis Protocol
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AAP Surgical / CF Foundation: Dilute Gastrografin Decompression & Bishop-Koop / Santulli Enterostomy
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            + New Episode Protocol
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            No Meconium Ileus decompression protocols initiated for this neonatal patient.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 shadow"
          >
            Initiate Decompression Protocol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Episode Selection Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Recorded Episodes ({episodes.length})
            </h3>
            <div className="space-y-2">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => setSelectedEpisodeId(ep.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedEpisodeId === ep.id
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      ep.surgery_indicated
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}>
                      {ep.surgery_indicated ? 'Surgery' : 'Gastrografin'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {new Date(ep.onset_datetime).toLocaleDateString()} • {ep.age_hours} hrs of life • {ep.weight_kg} kg
                  </div>
                  <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 truncate">
                    Status: {ep.status.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Episode Detail View */}
          {currentEpisode && (
            <div className="lg:col-span-3 space-y-6">
              {/* Status & Urgent Actions Card */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {currentEpisode.episode_code}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      currentEpisode.surgery_indicated
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                    }`}>
                      {currentEpisode.surgery_indicated ? 'Surgical Enterostomy Required' : 'Fluoroscopic Decompression'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Consultant: Dr. {currentEpisode.consultant_name || 'Assigned Neonatologist/Surgeon'} • Created: {new Date(currentEpisode.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Status:
                    </label>
                    <select
                      value={currentEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="text-xs border rounded-lg px-2.5 py-1.5 font-semibold bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                      <option value="initial_contrast_decompression">Initial Contrast Decompression</option>
                      <option value="repeat_enema_observation">Repeat Enema Observation</option>
                      <option value="in_operating_room_enterostomy">In Operating Room (Enterostomy)</option>
                      <option value="post_op_stoma_recovery">Post-Op Stoma Recovery</option>
                      <option value="resolved_normal_stooling">Resolved / Normal Stooling</option>
                    </select>
                  </div>

                  <a
                    href={`/neonatal-meconium-ileus/${currentEpisode.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>🖨</span> Print Dossier
                  </a>
                </div>
              </div>

              {/* Engine Evaluation Alert & Directives */}
              {evaluation && (
                <div className={`p-5 rounded-xl border ${
                  evaluation.surgeryIndicated
                    ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800'
                    : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{evaluation.surgeryIndicated ? '🚨' : '✨'}</span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {evaluation.urgencyTierLabel}
                      </h4>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800 shadow-sm text-slate-700 dark:text-slate-200">
                      CF Correlation: {evaluation.isCysticFibrosisSuspected ? 'CF Suspected' : 'Low Suspicion'}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-3">
                    {evaluation.recommendedProcedure}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-lg border border-amber-200 dark:border-amber-900/60">
                      <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Gastrografin Decompression Protocols
                      </h5>
                      <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 list-disc pl-4">
                        {evaluation.gastrografinProtocolDirectives.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-lg border border-blue-200 dark:border-blue-900/60">
                      <h5 className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Cystic Fibrosis Clinical Directives
                      </h5>
                      <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc pl-4">
                        {evaluation.cysticFibrosisDirectives.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Overview Grid */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                  Clinical Examination & Fluoroscopic Findings
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Meconium Passed</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentEpisode.meconium_passed_yet ? 'Yes' : 'No (Delayed >24-48h)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Abdominal Distension</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {currentEpisode.abdominal_distension.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Emesis Character</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {currentEpisode.emesis_character.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Doughy RLQ Masses</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentEpisode.palpable_doughy_masses ? 'Present (Pellets)' : 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Abdominal X-Ray</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {currentEpisode.plain_abdominal_xray_findings.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Disuse Microcolon</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentEpisode.microcolon_confirmed ? 'Confirmed (Slender)' : 'Normal Caliber'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Enema Outcome</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {currentEpisode.enema_success_outcome.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">CFTR Gene Panel</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentEpisode.cftr_gene_mutation_sent ? 'Sent' : 'Not Sent'}
                    </span>
                  </div>
                </div>

                {currentEpisode.clinical_notes && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold block mb-0.5">Consultant Clinical Notes:</span>
                    {currentEpisode.clinical_notes}
                  </div>
                )}
              </div>

              {/* Serial Decompression Flowsheet */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>📈</span> Serial Decompression & Hydration Flowsheet ({flowsheet.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Surveillance of abdominal girth, meconium evacuation, urine output & hydration
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    + Log Checkpoint
                  </button>
                </div>

                {flowsheet.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed rounded-lg">
                    No flowsheet checkpoints logged yet. Record serial girth and evacuation progress.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Hrs</th>
                          <th className="p-2.5">Girth (cm)</th>
                          <th className="p-2.5">Meconium Passage</th>
                          <th className="p-2.5">Hydration</th>
                          <th className="p-2.5">UOP (mL/kg/h)</th>
                          <th className="p-2.5">Na+ (mEq/L)</th>
                          <th className="p-2.5">HR</th>
                          <th className="p-2.5">Notes</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {flowsheet.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                            <td className="p-2.5 whitespace-nowrap">
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2.5">{log.hours_from_onset}h</td>
                            <td className="p-2.5 font-bold text-amber-600 dark:text-amber-400">{log.abdominal_girth_cm}</td>
                            <td className="p-2.5 capitalize">{log.meconium_evacuated_amount.replace(/_/g, ' ')}</td>
                            <td className="p-2.5 capitalize">{log.hydration_status.replace(/_/g, ' ')}</td>
                            <td className="p-2.5">{log.urine_output_ml_kg_hr ?? '—'}</td>
                            <td className="p-2.5">{log.serum_sodium_meq_l ?? '—'}</td>
                            <td className="p-2.5">{log.heart_rate}</td>
                            <td className="p-2.5 max-w-[150px] truncate" title={log.notes || ''}>{log.notes || '—'}</td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => handleDeleteFlowsheet(log.id)}
                                className="text-red-500 hover:text-red-700 font-bold px-1"
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
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <NeonatalMeconiumIleusModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={() => {
          loadEpisodes();
          setShowCreateModal(false);
        }}
      />

      {selectedEpisodeId && (
        <NeonatalMeconiumIleusFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => {
            loadEpisodeDetails(selectedEpisodeId);
            setShowFlowsheetModal(false);
          }}
        />
      )}
    </div>
  );
};
