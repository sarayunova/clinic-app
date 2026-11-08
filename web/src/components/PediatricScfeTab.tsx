import React, { useState, useEffect } from 'react';
import {
  getPediatricScfeEpisodes,
  getPediatricScfeEpisode,
  patchPediatricScfeStatus,
  deletePediatricScfeFlowsheet,
  type PediatricScfeRecord,
  type PediatricScfeFlowsheetRecord,
} from '../api';
import { PediatricScfeModal } from './PediatricScfeModal';
import { PediatricScfeFlowsheetModal } from './PediatricScfeFlowsheetModal';
import { type PediatricScfeEvaluationResult } from '../pediatricScfeEngine';

interface Props {
  patientId: number;
}

export const PediatricScfeTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricScfeRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricScfeRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricScfeEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricScfeFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricScfeEpisodes({ patientId });
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
      console.error('Error loading SCFE episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricScfeEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading SCFE details:', err);
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
      await patchPediatricScfeStatus(currentEpisode.id, newStatus);
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
      await deletePediatricScfeFlowsheet(currentEpisode.id, flowsheetId);
      await loadEpisodeDetails(currentEpisode.id);
    } catch (err) {
      console.error('Failed to delete flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-4 text-center text-slate-500">Loading Pediatric SCFE protocol...</div>;
  }

  return (
    <div className="pediatric-scfe-tab p-4 space-y-6">
      {/* Header & Episode Selector */}
      <div className="flex justify-between items-center flex-wrap gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-xl">
            🦴
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              Pediatric SCFE &amp; Loder Instability Protocol
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              POSNA / AAOS: Loder Stability AVN Risk • Southwick Angle • Avoid Forceful Reduction • Prophylactic Pinning
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
                  {ep.episode_code} ({ep.affected_hip} hip)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentEpisode && (
            <>
              <a
                href={`/pediatric-scfe/${currentEpisode.id}/print`}
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
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition"
          >
            + New SCFE Episode
          </button>
        </div>
      </div>

      {/* No episodes state */}
      {episodes.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
          <div className="text-4xl mb-3">🦴</div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No SCFE Episodes Recorded</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            This patient has no active SCFE episodes. Initiate an episode to classify Loder stability, calculate Southwick severity, and evaluate AVN risk &amp; prophylactic pinning.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow"
          >
            Initiate SCFE Protocol
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
              <span className={`text-xs px-2.5 py-1 rounded font-bold uppercase tracking-wider ${evaluation.isUnstableScfe ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                {evaluation.loderClassificationLabel}
              </span>
              <span className="text-xs px-2.5 py-1 rounded font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                {evaluation.southwickSeverityLabel}
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
                  <option value="strict_bedrest_non_weight_bearing">Strict Bedrest Non-Weight Bearing</option>
                  <option value="urgent_preop_radiographic_workup">Urgent Pre-op Radiographic Workup</option>
                  <option value="in_situ_percutaneous_pinning_performed">In-Situ Pinning Performed</option>
                  <option value="postop_protected_weight_bearing">Post-op Protected Weight Bearing</option>
                  <option value="contralateral_surveillance">Contralateral Surveillance</option>
                  <option value="resolved_physeal_fusion">Resolved (Physeal Fusion Complete)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Critical Alerts Banner */}
          {evaluation.alerts.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-600 p-4 rounded-r-xl space-y-1">
              <div className="text-xs font-bold text-red-900 dark:text-red-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>🚨</span> High-Risk Orthopedic &amp; AVN Alerts
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
                Loder Stability
              </span>
              <span className={`text-xl font-black mt-1 block ${evaluation.isUnstableScfe ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {evaluation.isUnstableScfe ? 'Unstable' : 'Stable'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block font-mono font-semibold">
                AVN: {evaluation.avascularNecrosisRiskPct}
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                Southwick Slip Angle
              </span>
              <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                {currentEpisode.southwick_slip_angle_degrees}°
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Severity: {evaluation.southwickSeverity.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                Trethowan &amp; Knee Pain
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                Klein Line: {currentEpisode.klein_line_trethowan_abnormal === 1 ? 'Abnormal' : 'Normal'}
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block font-semibold">
                Referred Knee Pain: {currentEpisode.referred_knee_thigh_pain === 1 ? 'Yes (Pitfall!)' : 'No'}
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                Contralateral Pinning
              </span>
              <span className={`text-sm font-bold mt-1 block ${evaluation.isContralateralProphylacticPinningIndicated ? 'text-purple-600 dark:text-purple-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {evaluation.isContralateralProphylacticPinningIndicated ? 'Indicated' : 'Surveillance'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Pinning Performed: {currentEpisode.contralateral_hip_prophylactic_pinning === 1 ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {/* Protocols & Directives 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Card: Preoperative & Surgical Directives */}
            <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                  Emergency Preoperative Directives
                </h4>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  {evaluation.preoperativeDirectives.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                  Surgical Intervention &amp; Screw Trajectory
                </h4>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Procedure: {currentEpisode.surgical_procedure_performed.replace(/_/g, ' ')}
                </div>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  {evaluation.surgicalDirectives.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Card: Postoperative Mobility & Contralateral Pinning */}
            <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                  Postoperative Weight-Bearing &amp; Rehabilitation
                </h4>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  {evaluation.postoperativeMobilityDirectives.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
                  Contralateral Hip Assessment
                </h4>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {evaluation.contralateralPinningRationale}
                </div>
              </div>
            </div>
          </div>

          {/* Flowsheet Log Table */}
          <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Serial SCFE Flowsheet &amp; Rehabilitation Audits ({flowsheet.length})
                </h4>
                <p className="text-xs text-slate-500">
                  Daily pain scores, weight-bearing compliance, hip internal rotation &amp; neurovascular status
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                + Record Serial Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed rounded-lg">
                No serial flowsheet logs recorded yet. Add observations to verify strict non-weight bearing and hip mobility.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Day</th>
                      <th className="px-3 py-2">VAS Pain</th>
                      <th className="px-3 py-2">NWB Compliance</th>
                      <th className="px-3 py-2">Hip IR</th>
                      <th className="px-3 py-2">Wound</th>
                      <th className="px-3 py-2">Neurovascular</th>
                      <th className="px-3 py-2">Staff</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {flowsheet.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                          {new Date(f.log_datetime).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                          Day {f.day_from_presentation}
                        </td>
                        <td className="px-3 py-2 font-bold font-mono text-amber-600 dark:text-amber-400">
                          {f.pain_score_vas}/10
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${f.non_weight_bearing_compliance === 'strict_wheelchair_bedrest' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {f.non_weight_bearing_compliance.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                          {f.hip_internal_rotation_degrees}°
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {f.wound_dressing_clean === 1 ? 'Clean/Dry' : 'Strike-through'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="capitalize text-[11px] text-slate-600 dark:text-slate-400">
                            {f.distal_neurovascular_status.replace(/_/g, ' ')}
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
        <PediatricScfeModal
          patientId={patientId}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            loadEpisodes();
          }}
        />
      )}

      {showEditModal && currentEpisode && (
        <PediatricScfeModal
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
        <PediatricScfeFlowsheetModal
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
