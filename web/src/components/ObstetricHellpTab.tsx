import React, { useState, useEffect } from 'react';
import {
  getObstetricHellpEpisodes,
  getObstetricHellpEpisode,
  patchObstetricHellpStatus,
  deleteObstetricHellpFlowsheet,
  type ObstetricHellpRecord,
  type ObstetricHellpFlowsheetRecord,
} from '../api';
import { ObstetricHellpModal } from './ObstetricHellpModal';
import { ObstetricHellpFlowsheetModal } from './ObstetricHellpFlowsheetModal';
import { type ObstetricHellpEvaluationResult } from '../obstetricHellpEngine';

interface Props {
  patientId: number;
}

export const ObstetricHellpTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricHellpRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricHellpRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricHellpEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricHellpFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricHellpEpisodes({ patientId });
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
      console.error('Error loading HELLP episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricHellpEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading HELLP details:', err);
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

  const handleStatusChange = async (newStatus: string) => {
    if (!currentEpisode) return;
    try {
      await patchObstetricHellpStatus(currentEpisode.id, newStatus);
      await loadEpisodeDetails(currentEpisode.id);
      await loadEpisodes();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDeleteFlowsheet = async (flowsheetId: number) => {
    if (!currentEpisode) return;
    if (!window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteObstetricHellpFlowsheet(currentEpisode.id, flowsheetId);
      await loadEpisodeDetails(currentEpisode.id);
    } catch (err) {
      console.error('Failed to delete flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-4 text-center text-slate-500">Loading Obstetric HELLP protocol...</div>;
  }

  return (
    <div className="obstetric-hellp-tab p-4 space-y-6">
      {/* Header & Episode Selector */}
      <div className="flex justify-between items-center flex-wrap gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 font-black text-xl">
            🩸
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              Obstetric HELLP Syndrome Protocol
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ACOG Practice Bulletin No. 222 • Mississippi Triple-Class • Hepatic Hematoma &amp; Rupture Surveillance
            </p>
          </div>
          {episodes.length > 1 && (
            <select
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-2 py-1 ml-2 font-mono"
              value={selectedEpisodeId ?? ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentEpisode && (
            <>
              <a
                href={`/obstetric-hellp/${currentEpisode.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                Print Dossier 🖨
              </a>
              <button
                onClick={() => setShowEditModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
              >
                Edit Episode ✏️
              </button>
            </>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
          >
            + New HELLP Episode
          </button>
        </div>
      </div>

      {/* No episodes state */}
      {episodes.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
          <div className="text-4xl mb-3">🩸</div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No HELLP Syndrome Episodes</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            This patient currently has no active HELLP syndrome episodes. Initiate an episode to compute Mississippi Class, Tennessee criteria, hepatic rupture alerts, and dexamethasone protocols.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow"
          >
            Initiate HELLP Protocol
          </button>
        </div>
      )}

      {/* Active episode view */}
      {currentEpisode && evaluation && (
        <div className="space-y-6">
          {/* Status & Urgency Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-black text-slate-800 dark:text-slate-200">
                {currentEpisode.episode_code}
              </span>
              <span className="text-xs px-2.5 py-1 rounded font-bold uppercase tracking-wider bg-rose-600 text-white">
                {evaluation.mississippiClassLabel}
              </span>
              <span className="text-xs px-2.5 py-1 rounded font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                {evaluation.tennesseeClassificationLabel}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs">
                <span className="text-slate-500 mr-2">Status:</span>
                <select
                  className="rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs px-2 py-1 font-semibold capitalize"
                  value={currentEpisode.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="suspected">Suspected</option>
                  <option value="active_icu_resuscitation">Active ICU Resuscitation</option>
                  <option value="operative_delivery">Operative Delivery</option>
                  <option value="postpartum_stabilization">Postpartum Stabilization</option>
                  <option value="recovering_platelets_rising">Recovering (Platelets Rising)</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
          </div>

          {/* Critical Alerts Banner */}
          {evaluation.alerts.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-600 p-4 rounded-r-xl space-y-1">
              <div className="text-xs font-bold text-red-900 dark:text-red-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>🚨</span> High-Risk Clinical &amp; Hepatic Warnings
              </div>
              {evaluation.alerts.map((al, idx) => (
                <div key={idx} className="text-xs text-red-800 dark:text-red-300 font-medium">
                  • {al}
                </div>
              ))}
            </div>
          )}

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                Platelet Count
              </span>
              <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                {currentEpisode.platelet_count_per_ul.toLocaleString()} /µL
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Transfusion: {evaluation.isPlateletTransfusionIndicated ? 'Indicated' : 'Not indicated'}
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                Hepatic Transaminases
              </span>
              <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
                AST: {currentEpisode.ast_u_l} • ALT: {currentEpisode.alt_u_l} U/L
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Cutoff ≥ 70 U/L ({evaluation.isSevereTransaminitis ? 'Elevated' : 'Borderline'})
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                Hemolysis Markers
              </span>
              <span className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                LDH: {currentEpisode.ldh_u_l} U/L
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                TBil: {currentEpisode.total_bilirubin_mg_dl} mg/dL • Schistocytes: {currentEpisode.schistocytes_present === 1 ? 'Yes' : 'No'}
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                Hepatic Risk &amp; Imaging
              </span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400 mt-1 block">
                {evaluation.hepaticComplicationLabel}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block capitalize">
                {currentEpisode.hepatic_imaging_performed.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Protocols & Directives 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Card: Dexamethasone & Magnesium Sulfate */}
            <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2">
                  Dexamethasone Pulse Protocol (Mississippi)
                </h4>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  {evaluation.dexamethasoneDirectives.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                  Magnesium Sulfate Seizure Prophylaxis
                </h4>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  {evaluation.magnesiumSulfateDirectives.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Card: Obstetric Delivery Directives & Transfusion */}
            <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Delivery Strategy &amp; Timing
                </h4>
                <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                  Plan: {currentEpisode.delivery_timing_plan.replace(/_/g, ' ')}
                </div>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  {evaluation.deliveryDirectives.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                  Platelet Transfusion Threshold
                </h4>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {evaluation.plateletTransfusionThresholdMessage}
                </div>
              </div>
            </div>
          </div>

          {/* Flowsheet Log Table */}
          <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Serial HELLP Flowsheet Observations ({flowsheet.length})
                </h4>
                <p className="text-xs text-slate-500">
                  q4–q6h platelet kinetics, transaminase trends, urine output, deep tendon reflexes &amp; pain scores
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                + Record Serial Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed rounded-lg">
                No serial flowsheet logs recorded yet. Add observations to trend recovery or deterioration.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Timestamp / Hr</th>
                      <th className="px-3 py-2">Platelets</th>
                      <th className="px-3 py-2">AST / LDH</th>
                      <th className="px-3 py-2">BP (mmHg)</th>
                      <th className="px-3 py-2">Urine (mL/h)</th>
                      <th className="px-3 py-2">Reflexes</th>
                      <th className="px-3 py-2">RUQ Pain</th>
                      <th className="px-3 py-2">Staff</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {flowsheet.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                          {new Date(f.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <span className="text-[10px] text-slate-400 block">+{f.hours_from_admission}h</span>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {f.platelet_count_per_ul.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                          AST: {f.ast_u_l} • LDH: {f.ldh_u_l}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                          {f.systolic_bp}/{f.diastolic_bp}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                          <span className={f.urine_output_ml_hr < 30 ? 'font-bold text-red-600' : ''}>
                            {f.urine_output_ml_hr}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="capitalize text-[11px] text-slate-600 dark:text-slate-400">
                            {f.deep_tendon_reflexes.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${f.epigastric_pain_score > 5 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                            Score: {f.epigastric_pain_score}/10
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-[11px]">
                          {f.logged_by_name || 'Staff'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleDeleteFlowsheet(f.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
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
      {showCreateModal && (
        <ObstetricHellpModal
          patientId={patientId}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            loadEpisodes();
          }}
        />
      )}

      {showEditModal && currentEpisode && (
        <ObstetricHellpModal
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

      {showFlowsheetModal && currentEpisode && (
        <ObstetricHellpFlowsheetModal
          episode={currentEpisode}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => {
            loadEpisodeDetails(currentEpisode.id);
          }}
        />
      )}
    </div>
  );
};
