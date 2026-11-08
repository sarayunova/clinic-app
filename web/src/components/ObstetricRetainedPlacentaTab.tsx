import React, { useState, useEffect } from 'react';
import {
  getObstetricRetainedPlacentaEpisodes,
  getObstetricRetainedPlacentaEpisode,
  updateObstetricRetainedPlacentaStatus,
  deleteObstetricRetainedPlacentaFlowsheet,
  type ObstetricRetainedPlacentaRecord,
  type ObstetricRetainedPlacentaFlowsheetRecord,
} from '../api';
import { ObstetricRetainedPlacentaModal } from './ObstetricRetainedPlacentaModal';
import { ObstetricRetainedPlacentaFlowsheetModal } from './ObstetricRetainedPlacentaFlowsheetModal';
import { type ObstetricRetainedPlacentaResult } from '../obstetricRetainedPlacentaEngine';

interface Props {
  patientId: number;
}

export const ObstetricRetainedPlacentaTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricRetainedPlacentaRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricRetainedPlacentaRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricRetainedPlacentaResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricRetainedPlacentaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricRetainedPlacentaEpisodes({ patientId });
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
      console.error('Error loading retained placenta episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricRetainedPlacentaEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet);
    } catch (err) {
      console.error('Error loading retained placenta details:', err);
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
      await updateObstetricRetainedPlacentaStatus(selectedEpisodeId, { status });
      await loadEpisodeDetails(selectedEpisodeId);
      await loadEpisodes();
    } catch (err) {
      console.error('Failed to update retained placenta status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId) return;
    if (!confirm('Are you sure you want to delete this checkpoint log?')) return;
    try {
      await deleteObstetricRetainedPlacentaFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Loading Retained Placenta & MROP records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Episode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩸</span> Obstetric Retained Placenta & Emergent MROP Protocol
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            RCOG Green-top / WHO PPH Guidelines (Third stage &gt;30 min active / &gt;60 min expectant)
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
                  {ep.episode_code} ({ep.status.replace(/_/g, ' ')}) - {ep.delivery_datetime.slice(0, 10)}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700"
          >
            + New Retained Episode
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
            No active or historical Retained Placenta protocols recorded for this patient.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700"
          >
            Initiate Retained Placenta & MROP Protocol
          </button>
        </div>
      ) : currentEpisode && evaluation ? (
        <div className="space-y-6">
          {/* Status & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase font-bold text-slate-500">Status:</span>
              <span className="rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-rose-200 dark:border-rose-800">
                {currentEpisode.status.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-500">
                Episode: <code className="font-mono">{currentEpisode.episode_code}</code>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('under_conservative_management')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'under_conservative_management'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Conservative
              </button>
              <button
                onClick={() => handleStatusChange('iuv_oxytocin_in_progress')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'iuv_oxytocin_in_progress'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                IUV Trial
              </button>
              <button
                onClick={() => handleStatusChange('mrop_in_theater')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'mrop_in_theater'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                MROP in Theater
              </button>
              <button
                onClick={() => handleStatusChange('post_removal_recovery')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  currentEpisode.status === 'post_removal_recovery'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Recovery
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
                href={`/obstetric-retained-placenta/${currentEpisode.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Print Dossier 🖨
              </a>
            </div>
          </div>

          {/* Clinical Metrics & Urgency Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-xs uppercase font-semibold text-slate-500">Third Stage Duration</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {currentEpisode.third_stage_duration_minutes} min
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {evaluation.durationCategoryLabel}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-xs uppercase font-semibold text-slate-500">Estimated Blood Loss</span>
              <p className={`text-2xl font-bold mt-1 ${currentEpisode.estimated_blood_loss_ml >= 1000 ? 'text-red-600' : currentEpisode.estimated_blood_loss_ml >= 500 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                {currentEpisode.estimated_blood_loss_ml} mL
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Status: {currentEpisode.hemodynamic_stability.replace(/_/g, ' ')}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <span className="text-xs uppercase font-semibold text-rose-700 dark:text-rose-400">MROP Urgency Tier</span>
              <p className="text-base font-bold text-rose-900 dark:text-rose-200 mt-1">
                {evaluation.mropUrgencyLabel}
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                Type: {currentEpisode.retained_placenta_type.replace(/_/g, ' ')}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <span className="text-xs uppercase font-semibold text-rose-700 dark:text-rose-400">Bladder & IUV Protocol</span>
              <p className="text-base font-bold text-rose-900 dark:text-rose-200 mt-1">
                {currentEpisode.bladder_catheterized ? 'Catheterized ✓' : 'EMPTY BLADDER NOW ⚠'}
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                IUV Oxytocin: {currentEpisode.iuv_oxytocin_attempted ? (currentEpisode.iuv_oxytocin_successful ? 'Successful ✓' : 'Failed') : (evaluation.iuvProtocol.recommended ? 'Trial Indicated' : 'Bypass')}
              </p>
            </div>
          </div>

          {/* Guidance, Checklist & Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                Post-Removal Bundle & Safety Checklist
              </h4>
              <ul className="text-xs space-y-1.5 list-disc list-inside text-slate-700 dark:text-slate-300">
                {evaluation.postRemovalChecklist.map((item, idx) => (
                  <li key={idx} className="font-medium">{item}</li>
                ))}
              </ul>
              <div className="pt-2 text-xs border-t text-slate-600 dark:text-slate-400">
                <p><strong>Antibiotic Guidance:</strong> {evaluation.antibioticGuidance}</p>
                {currentEpisode.mrop_performed && (
                  <p className="mt-1"><strong>MROP Performed:</strong> Under {currentEpisode.anesthesia_type?.replace(/_/g, ' ') || 'Anesthesia'} at {currentEpisode.mrop_datetime?.slice(11, 16) || 'OT'}</p>
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
                    <div key={idx} className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs border border-rose-200 dark:border-rose-800 font-semibold">
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
                  Third Stage Hemodynamic & Blood Loss Flowsheet Log
                </h4>
                <p className="text-xs text-slate-500">
                  Track vital trends, uterine fundal tone, cord lengthening, and cumulative blood loss
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700"
              >
                + Log Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No checkpoints logged yet. Click "+ Log Checkpoint" to begin serial tracking.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2 border">Timestamp</th>
                      <th className="p-2 border text-center">Min Post-Delivery</th>
                      <th className="p-2 border text-center">Blood Pressure</th>
                      <th className="p-2 border text-center">Heart Rate</th>
                      <th className="p-2 border text-center">Cum Blood Loss</th>
                      <th className="p-2 border">Fundus Tone</th>
                      <th className="p-2 border">Vaginal Bleeding</th>
                      <th className="p-2 border text-center">Cord Lengthening</th>
                      <th className="p-2 border">Intervention</th>
                      <th className="p-2 border">Staff</th>
                      <th className="p-2 border text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 border whitespace-nowrap">{log.log_datetime.replace('T', ' ')}</td>
                        <td className="p-2 border text-center font-bold">{log.minutes_from_delivery} min</td>
                        <td className="p-2 border text-center">
                          {log.blood_pressure_sys && log.blood_pressure_dia ? `${log.blood_pressure_sys}/${log.blood_pressure_dia}` : '-'}
                        </td>
                        <td className="p-2 border text-center font-semibold">{log.heart_rate ?? '-'} bpm</td>
                        <td className={`p-2 border text-center font-bold ${log.cumulative_blood_loss_ml >= 1000 ? 'text-red-600' : log.cumulative_blood_loss_ml >= 500 ? 'text-amber-600' : ''}`}>
                          {log.cumulative_blood_loss_ml} mL
                        </td>
                        <td className="p-2 border capitalize">{log.uterine_fundus_tone.replace(/_/g, ' ')}</td>
                        <td className="p-2 border capitalize">{log.active_vaginal_bleeding.replace(/_/g, ' ')}</td>
                        <td className="p-2 border text-center font-bold">
                          {log.cord_lengthening_observed ? <span className="text-emerald-600">Yes ✓</span> : 'No'}
                        </td>
                        <td className="p-2 border">{log.intervention_applied ?? '-'}</td>
                        <td className="p-2 border">{log.logged_by_name ?? 'Midwife/Dr'}</td>
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
      <ObstetricRetainedPlacentaModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <ObstetricRetainedPlacentaFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
