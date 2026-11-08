import React, { useState, useEffect } from 'react';
import {
  getPediatricAcuteScrotumEpisodes,
  getPediatricAcuteScrotumEpisode,
  updatePediatricAcuteScrotumEpisode,
  type PediatricAcuteScrotumRecord,
  type PediatricAcuteScrotumFlowsheetRecord,
} from '../api';
import { PediatricAcuteScrotumModal } from './PediatricAcuteScrotumModal';
import { PediatricAcuteScrotumFlowsheetModal } from './PediatricAcuteScrotumFlowsheetModal';
import { type PediatricAcuteScrotumEvaluationResult } from '../pediatricAcuteScrotumEngine';

interface Props {
  patientId: number;
}

export const PediatricAcuteScrotumTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricAcuteScrotumRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricAcuteScrotumRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricAcuteScrotumEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricAcuteScrotumFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricAcuteScrotumEpisodes({ patientId });
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
      console.error('Error loading acute scrotum episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricAcuteScrotumEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading acute scrotum episode details:', err);
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

  const handleStatusChange = async (newStatus: PediatricAcuteScrotumRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updatePediatricAcuteScrotumEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        ageYears: currentEpisode.age_years,
        affectedSide: currentEpisode.affected_side,
        symptomDurationHours: currentEpisode.symptom_duration_hours,
        twistTestisSwelling: currentEpisode.twist_testis_swelling,
        twistHardTestis: currentEpisode.twist_hard_testis,
        twistAbsentCremastericReflex: currentEpisode.twist_absent_cremasteric_reflex,
        twistNauseaVomiting: currentEpisode.twist_nausea_vomiting,
        twistHighRidingTestis: currentEpisode.twist_high_riding_testis,
        dopplerUltrasoundPerformed: Boolean(currentEpisode.doppler_ultrasound_performed),
        dopplerFindings: currentEpisode.doppler_findings,
        manualDetorsionAttempted: Boolean(currentEpisode.manual_detorsion_attempted),
        surgicalExplorationPerformed: Boolean(currentEpisode.surgical_exploration_performed),
        intraoperativeFindings: currentEpisode.intraoperative_findings,
        bilateralOrchiopexyPerformed: Boolean(currentEpisode.bilateral_orchiopexy_performed),
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      await loadEpisodeDetails(currentEpisode.id);
      await loadEpisodes();
    } catch (err) {
      console.error('Error updating acute scrotum status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Loading Pediatric Acute Scrotum Protocol records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩻</span> Pediatric Acute Scrotum &amp; TWIST Score Protocol
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AUA / ESPU Guidelines • TWIST Scoring (0–7) • 6-Hour Golden Salvage Window • Bilateral Dartos Orchiopexy
          </p>
        </div>
        <div className="flex items-center gap-2">
          {episodes.length > 0 && (
            <select
              value={selectedEpisodeId || ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
              aria-label="Select Acute Scrotum Episode"
              className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.affected_side} testis) - {ep.status}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            + New Scrotum Episode
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 text-sm">No acute scrotum episodes recorded for this patient.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 transition"
          >
            Initiate Acute Scrotum Triage
          </button>
        </div>
      ) : currentEpisode && evaluation ? (
        <div className="space-y-6">
          {/* Status & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Episode:
              </span>
              <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                {currentEpisode.episode_code}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                {evaluation.twistRiskCategoryLabel}
              </span>
              {evaluation.isGoldenWindowActive ? (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  Golden Window Active (&le;6h)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Delayed Presentation ({currentEpisode.symptom_duration_hours}h)
                </span>
              )}
              {evaluation.isImmediateSurgeryMandated && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 animate-pulse">
                  Immediate OR Transfer ⚠️
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={currentEpisode.status}
                onChange={(e) => handleStatusChange(e.target.value as PediatricAcuteScrotumRecord['status'])}
                aria-label="Change Scrotum Status"
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              >
                <option value="emergency_triage_under_6h">Emergency Triage (&le;6h)</option>
                <option value="urgent_ultrasound_intermediate_risk">Urgent Ultrasound (Intermediate)</option>
                <option value="in_operating_room_exploration">In Operating Room Exploration</option>
                <option value="postop_scrotal_support_recovery">Post-op Scrotal Support</option>
                <option value="resolved_discharged_home">Resolved / Discharged Home</option>
              </select>

              <button
                onClick={() => setShowEditModal(true)}
                className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 rounded-lg transition"
              >
                Edit Details
              </button>
              <a
                href={`/pediatric-acute-scrotum/${currentEpisode.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition"
              >
                Print Dossier 🖨
              </a>
            </div>
          </div>

          {/* Critical Alerts Banner */}
          {evaluation.alerts.length > 0 && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 p-4 rounded-r-xl space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <span>⚠️</span> Urgent Acute Scrotum Directives
              </div>
              <ul className="list-disc pl-5 text-xs text-rose-900 dark:text-rose-200 space-y-0.5">
                {evaluation.alerts.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">TWIST Score</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {evaluation.twistScoreTotal} <span className="text-xs font-normal">/ 7</span>
              </div>
              <div className="text-[10px] text-slate-400 capitalize">{evaluation.twistRiskCategory.replace('_', ' ')}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Symptom Duration &amp; Salvage</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEpisode.symptom_duration_hours} <span className="text-xs font-normal">hours</span>
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                {evaluation.salvageProbabilityEstimate}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Doppler Ultrasound</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {currentEpisode.doppler_findings.replace(/_/g, ' ')}
              </div>
              <div className="text-[10px] text-slate-400">
                {currentEpisode.doppler_ultrasound_performed === 1 ? 'Scan Performed' : 'Scan Not Done'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Bilateral Orchiopexy</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEpisode.bilateral_orchiopexy_performed === 1 ? '✅ Performed' : '❌ Not Performed'}
              </div>
              <div className="text-[10px] text-slate-400">3-Point Dartos Pouch</div>
            </div>
          </div>

          {/* Clinical Directives Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>⏱️</span> Pre-op &amp; Triage Directives
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.preoperativeDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🔪</span> Intraoperative Directives
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.surgicalExplorationDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🩲</span> Post-op Recovery Directives
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.postoperativeDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Flowsheet Log Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📊</span> Post-Torsion Scrotal Recovery &amp; Pain Flowsheet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track FLACC/VAS pain scores, scrotal edema, cremasteric return, dressing status, and mobility.
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
              >
                + Record Recovery Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No post-torsion recovery logs recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2">Time / Hours</th>
                      <th className="px-3 py-2">Pain (0–10)</th>
                      <th className="px-3 py-2">Scrotal Edema</th>
                      <th className="px-3 py-2">Cremasteric</th>
                      <th className="px-3 py-2">Dressing Intact</th>
                      <th className="px-3 py-2">Ambulation</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono text-[11px]">
                    {flowsheet.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-3 py-2 font-sans font-semibold">
                          +{f.hours_from_presentation}h ({new Date(f.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </td>
                        <td className="px-3 py-2 font-bold text-indigo-600 dark:text-indigo-400">
                          {f.pain_score_flacc_or_vas} / 10
                        </td>
                        <td className="px-3 py-2 uppercase">{f.scrotal_edema_erythema.replace('_', ' ')}</td>
                        <td className="px-3 py-2 uppercase">{f.cremasteric_reflex_status.replace('_', ' ')}</td>
                        <td className="px-3 py-2 font-sans">
                          {f.wound_dressing_clean === 1 ? '✅ Clean' : '⚠️ Changed'}
                        </td>
                        <td className="px-3 py-2 font-sans truncate max-w-xs">{f.ambulation_status.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 font-sans truncate max-w-xs">{f.notes || '—'}</td>
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
      {showCreateModal && (
        <PediatricAcuteScrotumModal
          patientId={patientId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newId) => {
            setShowCreateModal(false);
            if (newId) setSelectedEpisodeId(newId);
            loadEpisodes();
          }}
        />
      )}

      {showEditModal && currentEpisode && (
        <PediatricAcuteScrotumModal
          patientId={patientId}
          initialEpisode={currentEpisode}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadEpisodeDetails(currentEpisode.id);
            loadEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && currentEpisode && (
        <PediatricAcuteScrotumFlowsheetModal
          episodeId={currentEpisode.id}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => {
            setShowFlowsheetModal(false);
            loadEpisodeDetails(currentEpisode.id);
          }}
        />
      )}
    </div>
  );
};
