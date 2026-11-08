import React, { useState, useEffect } from 'react';
import {
  getNeonatalAopEpisodes,
  getNeonatalAopEpisode,
  updateNeonatalAopStatus,
  deleteNeonatalAopFlowsheet,
  type NeonatalAopRecord,
  type NeonatalAopFlowsheetRecord,
} from '../api';
import { NeonatalAopModal } from './NeonatalAopModal';
import { NeonatalAopFlowsheetModal } from './NeonatalAopFlowsheetModal';
import { type NeonatalAopEvaluationResult } from '../neonatalAopEngine';

interface Props {
  patientId: number;
}

export const NeonatalAopTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalAopRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalAopRecord | null>(null);
  const [evaluation, setEvaluation] = useState<NeonatalAopEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalAopFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalAopEpisodes({ patientId });
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
      console.error('Error loading AOP episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalAopEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet);
    } catch (err) {
      console.error('Error loading AOP details:', err);
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
      await updateNeonatalAopStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update AOP status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deleteNeonatalAopFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Loading Neonatal AOP protocol records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Episode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫁</span> Neonatal Apnea of Prematurity (AOP) & Caffeine Citrate
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AAP Neonatal Guidelines / CAP Trial Caffeine Protocol (&lt;34 weeks, ABD events)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {episodes.length > 0 && (
            <select
              value={selectedEpisodeId ?? ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.status.replace(/_/g, ' ')}) - {ep.onset_datetime.slice(0, 10)}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700"
          >
            + New AOP Episode
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
            No active or historical Neonatal AOP protocols recorded for this infant.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
          >
            Initiate Caffeine Citrate & AOP Protocol
          </button>
        </div>
      ) : currentEpisode && evaluation ? (
        <div className="space-y-6">
          {/* Status & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase font-bold text-slate-500">Status:</span>
              <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">
                {currentEpisode.status.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-500">
                Episode: <code className="font-mono">{currentEpisode.episode_code}</code>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('active_treatment')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'active_treatment'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => handleStatusChange('weaning_phase')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'weaning_phase'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Weaning Phase
              </button>
              <button
                onClick={() => handleStatusChange('caffeine_discontinued_monitoring')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'caffeine_discontinued_monitoring'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Discontinued Monitoring
              </button>
              <button
                onClick={() => handleStatusChange('resolved_discharged')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'resolved_discharged'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Resolved
              </button>
              <a
                href={`/neonatal-aop/${currentEpisode.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Print Dossier 🖨
              </a>
            </div>
          </div>

          {/* Clinical Metrics & Dosing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-xs uppercase font-semibold text-slate-500">Post-Conceptional Age</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {evaluation.postConceptionalAgeWeeks} wks
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Gest: {currentEpisode.gestational_age_weeks}w + Age: {currentEpisode.chronological_age_days}d
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-xs uppercase font-semibold text-slate-500">Apnea Subtype & Severity</span>
              <p className="text-lg font-bold text-slate-900 dark:text-white capitalize mt-1">
                {currentEpisode.apnea_subtype} ({evaluation.apneaSeverityTier.replace(/_/g, ' ')})
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {currentEpisode.apnea_frequency_per_24h} events/24h • Min HR: {currentEpisode.lowest_heart_rate_bpm ?? 'N/A'} bpm
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs uppercase font-semibold text-emerald-700 dark:text-emerald-400">Caffeine Citrate Loading</span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {evaluation.caffeineDosing.recommendedLoadingDoseMg} mg
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                20 mg/kg IV/PO ({currentEpisode.current_weight_kg} kg)
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs uppercase font-semibold text-emerald-700 dark:text-emerald-400">Daily Maintenance</span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {evaluation.caffeineDosing.recommendedDailyMaintenanceMg} mg/day
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {evaluation.caffeineDosing.maintenanceDoseMgKgDay} mg/kg/day q24h
              </p>
            </div>
          </div>

          {/* Dosing, Weaning & Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                Weaning Criteria & Airway Support
              </h4>
              <div
                className={`p-3 rounded-lg border text-xs ${
                  evaluation.weaningEligibility.eligible
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                    : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                }`}
              >
                <p className="font-bold">
                  {evaluation.weaningEligibility.eligible ? '✓ Weaning Criteria Met:' : '⚠ Weaning Not Yet Recommended:'}
                </p>
                <p className="mt-1">{evaluation.weaningEligibility.reason}</p>
                <p className="mt-1 text-slate-500">
                  Apnea-free days: <strong>{currentEpisode.apnea_free_days_count}</strong> (Target ≥ 5 days & PCA ≥ 33.5 - 34 wks)
                </p>
              </div>

              <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                <p><strong>Respiratory Support:</strong> {currentEpisode.respiratory_support_mode.replace(/_/g, ' ')}</p>
                <p><strong>Guidance:</strong> {evaluation.airwaySupportGuidance}</p>
                {evaluation.therapeuticDrugMonitoring && (
                  <p><strong>Serum Caffeine Level:</strong> {currentEpisode.serum_caffeine_level_mcg_ml ?? 'Not drawn'} mcg/mL — {evaluation.therapeuticDrugMonitoring.interpretation}</p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                Clinical Recommendations & Alerts
              </h4>
              {evaluation.alerts.length > 0 && (
                <div className="space-y-1">
                  {evaluation.alerts.map((alt, idx) => (
                    <div key={idx} className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs border border-amber-200 dark:border-amber-800">
                      ⚠ {alt}
                    </div>
                  ))}
                </div>
              )}
              <ul className="text-xs space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                {evaluation.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Serial Flowsheet Table */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Serial AOP & Caffeine Flowsheet Log
                </h4>
                <p className="text-xs text-slate-500">
                  Track shift apnea events, lowest HR/SpO2, stimulation required, and caffeine doses
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700"
              >
                + Log Shift Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No shift checkpoints logged yet. Click "+ Log Shift Checkpoint" to begin flowsheet tracking.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2 border">Timestamp</th>
                      <th className="p-2 border text-center">Apnea Events</th>
                      <th className="p-2 border text-center">Brady (&lt;80)</th>
                      <th className="p-2 border text-center">Desat (&lt;85%)</th>
                      <th className="p-2 border text-center">Lowest HR / SpO2</th>
                      <th className="p-2 border">Stimulation Mode</th>
                      <th className="p-2 border text-center">Caffeine Dose</th>
                      <th className="p-2 border">Support Mode</th>
                      <th className="p-2 border">Logged By</th>
                      <th className="p-2 border text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 border whitespace-nowrap">{log.log_datetime.replace('T', ' ')}</td>
                        <td className="p-2 border text-center font-bold">{log.apnea_events_count_in_shift}</td>
                        <td className="p-2 border text-center font-bold text-amber-600">{log.bradycardia_events_count}</td>
                        <td className="p-2 border text-center font-bold text-red-600">{log.desaturation_events_count}</td>
                        <td className="p-2 border text-center">
                          {log.lowest_heart_rate_bpm ?? '-'} bpm / {log.lowest_spo2_percent ?? '-'}%
                        </td>
                        <td className="p-2 border capitalize">{log.stimulation_mode_used?.replace(/_/g, ' ') ?? 'None'}</td>
                        <td className="p-2 border text-center font-semibold text-emerald-600">
                          {log.caffeine_dose_given_mg ? `${log.caffeine_dose_given_mg} mg` : '-'}
                        </td>
                        <td className="p-2 border">{log.current_respiratory_support ?? '-'}</td>
                        <td className="p-2 border">{log.logged_by_name ?? 'Staff'}</td>
                        <td className="p-2 border text-center">
                          <button
                            onClick={() => handleDeleteFlowsheet(log.id)}
                            className="text-red-500 hover:text-red-700 font-bold"
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
      ) : null}

      {/* Modals */}
      <NeonatalAopModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <NeonatalAopFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
