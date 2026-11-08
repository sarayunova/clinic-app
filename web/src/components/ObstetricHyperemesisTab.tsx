import React, { useState, useEffect } from 'react';
import {
  getObstetricHyperemesisEpisodes,
  getObstetricHyperemesisEpisode,
  updateObstetricHyperemesisEpisode,
  type ObstetricHyperemesisRecord,
  type ObstetricHyperemesisFlowsheetRecord,
} from '../api';
import { ObstetricHyperemesisModal } from './ObstetricHyperemesisModal';
import { ObstetricHyperemesisFlowsheetModal } from './ObstetricHyperemesisFlowsheetModal';
import { type ObstetricHyperemesisEvaluationResult } from '../obstetricHyperemesisEngine';

interface Props {
  patientId: number;
}

export const ObstetricHyperemesisTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricHyperemesisRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<ObstetricHyperemesisRecord | null>(null);
  const [evaluation, setEvaluation] = useState<ObstetricHyperemesisEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricHyperemesisFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricHyperemesisEpisodes({ patientId });
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
      console.error('Error loading hyperemesis episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricHyperemesisEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading hyperemesis episode details:', err);
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

  const handleStatusChange = async (newStatus: ObstetricHyperemesisRecord['status']) => {
    if (!currentEpisode) return;
    try {
      await updateObstetricHyperemesisEpisode(currentEpisode.id, {
        patientId: currentEpisode.patient_id,
        admissionId: currentEpisode.admission_id,
        onsetDatetime: currentEpisode.onset_datetime,
        gestationalAgeWeeks: currentEpisode.gestational_age_weeks,
        puqeNauseaHours: currentEpisode.puqe_nausea_hours,
        puqeVomitingEpisodes: currentEpisode.puqe_vomiting_episodes,
        puqeRetchingEpisodes: currentEpisode.puqe_retching_episodes,
        weightLossPercent: currentEpisode.weight_loss_percent,
        ketonuriaLevel: currentEpisode.ketonuria_level,
        serumPotassiumMmolL: currentEpisode.serum_potassium_mmol_l,
        serumSodiumMmolL: currentEpisode.serum_sodium_mmol_l,
        serumChlorideMmolL: currentEpisode.serum_chloride_mmol_l,
        bicarbonateMmolL: currentEpisode.bicarbonate_mmol_l,
        parenteralThiamineGivenBeforeDextrose: Boolean(currentEpisode.parenteral_thiamine_given_before_dextrose),
        wernickeTriadSymptomsPresent: Boolean(currentEpisode.wernicke_triad_symptoms_present),
        currentAntiemeticTier: currentEpisode.current_antiemetic_tier,
        thromboprophylaxisLmwhPrescribed: Boolean(currentEpisode.thromboprophylaxis_lmwh_prescribed),
        status: newStatus,
        clinicalNotes: currentEpisode.clinical_notes,
      });
      await loadEpisodeDetails(currentEpisode.id);
      await loadEpisodes();
    } catch (err) {
      console.error('Error updating hyperemesis status:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Loading Hyperemesis Gravidarum Protocol records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🤰</span> Obstetric Hyperemesis Gravidarum &amp; PUQE-24 Protocol
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ACOG Practice Bulletin No. 189 / RCOG No. 69 • PUQE-24 Severity • Mandatory Thiamine Pre-Dextrose • Tiered Antiemetics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {episodes.length > 0 && (
            <select
              value={selectedEpisodeId || ''}
              onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
              aria-label="Select Hyperemesis Episode"
              className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.gestational_age_weeks} wks) - {ep.status}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            + New HG Episode
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 text-sm">No hyperemesis gravidarum episodes recorded for this patient.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 transition"
          >
            Initiate Hyperemesis Protocol
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
                {evaluation.puqeSeverityLabel}
              </span>
              {currentEpisode.parenteral_thiamine_given_before_dextrose === 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 animate-pulse">
                  Thiamine Needed Before IV Dextrose ⚠️
                </span>
              )}
              {evaluation.isSevereWeightLoss && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {currentEpisode.weight_loss_percent}% Wt Loss (&gt;5%)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={currentEpisode.status}
                onChange={(e) => handleStatusChange(e.target.value as ObstetricHyperemesisRecord['status'])}
                aria-label="Change Hyperemesis Status"
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              >
                <option value="inpatient_iv_hydration_thiamine">Inpatient IV Hydration &amp; Thiamine</option>
                <option value="antiemetic_step_up_escalation">Antiemetic Step-Up Escalation</option>
                <option value="corticosteroid_pulse_therapy">Corticosteroid Pulse Therapy</option>
                <option value="oral_tolerance_dietary_reintroduction">Oral Tolerance &amp; Dietary Reintro</option>
                <option value="outpatient_maintenance_surveillance">Outpatient Maintenance</option>
                <option value="resolved_discharged_home">Resolved / Discharged Home</option>
              </select>

              <button
                onClick={() => setShowEditModal(true)}
                className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 rounded-lg transition"
              >
                Edit Details
              </button>
              <a
                href={`/obstetric-hyperemesis/${currentEpisode.id}/print`}
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
                <span>⚠️</span> Hyperemesis Critical Alerts &amp; Directives
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
              <div className="text-[10px] font-semibold text-slate-500 uppercase">PUQE-24 Score</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {evaluation.puqeScoreTotal} <span className="text-xs font-normal">/ 15</span>
              </div>
              <div className="text-[10px] text-slate-400 capitalize">{evaluation.puqeSeverityCategory} NVP</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Weight Loss &amp; Ketones</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEpisode.weight_loss_percent}%
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase">
                Ketones: {currentEpisode.ketonuria_level.replace('_', ' ')}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Electrolytes (K+ / Na+ / Cl-)</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                K: {currentEpisode.serum_potassium_mmol_l}{' '}
                <span className="text-xs font-normal">mmol/L</span>
              </div>
              <div
                className={`text-[10px] font-semibold ${
                  evaluation.isHypokalemicAlkalosis
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {evaluation.isHypokalemicAlkalosis ? 'Hypokalemic Alkalosis' : 'Electrolytes Normal'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Wernicke Protection</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEpisode.parenteral_thiamine_given_before_dextrose === 1 ? '✅ Thiamine Given' : '❌ Thiamine Due'}
              </div>
              <div className="text-[10px] text-slate-400">{evaluation.wernickeRiskLabel}</div>
            </div>
          </div>

          {/* Clinical Directives Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>💊</span> Thiamine &amp; Wernicke Protocol
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.thiamineDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>💧</span> IV Hydration &amp; Electrolytes
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.hydrationDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🛡️</span> Antiemetics &amp; LMWH Directives
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {evaluation.antiemeticEscalationDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {evaluation.thromboprophylaxisDirectives.map((d, i) => (
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
                  <span>📊</span> Daily HG Clinical &amp; Intake Flowsheet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track PUQE-24 progression, vomiting episodes, urine ketones, fluid balance, and serum K+.
                </p>
              </div>
              <button
                onClick={() => setShowFlowsheetModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
              >
                + Record Daily Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No daily flowsheet checkpoints logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2">Day / Time</th>
                      <th className="px-3 py-2">PUQE-24 Score</th>
                      <th className="px-3 py-2">24h Vomits</th>
                      <th className="px-3 py-2">Urine Ketones</th>
                      <th className="px-3 py-2">IV Balance mL</th>
                      <th className="px-3 py-2">Oral Intake mL</th>
                      <th className="px-3 py-2">Serum K+</th>
                      <th className="px-3 py-2">Thiamine IV</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono text-[11px]">
                    {flowsheet.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-3 py-2 font-sans font-semibold">
                          Day {f.day_of_treatment} ({new Date(f.log_datetime).toLocaleDateString()})
                        </td>
                        <td className="px-3 py-2 font-bold text-indigo-600 dark:text-indigo-400">
                          {f.puqe_score_total} / 15
                        </td>
                        <td className="px-3 py-2">{f.vomiting_episodes_24h}</td>
                        <td className="px-3 py-2 uppercase">{f.ketonuria_dipstick.replace('_', ' ')}</td>
                        <td className="px-3 py-2">{f.iv_fluid_balance_ml_24h} mL</td>
                        <td className="px-3 py-2">{f.oral_fluid_intake_ml} mL</td>
                        <td className="px-3 py-2">{f.potassium_mmol_l}</td>
                        <td className="px-3 py-2 font-sans">
                          {f.thiamine_administered === 1 ? '✅ Given' : '❌ Missed'}
                        </td>
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
        <ObstetricHyperemesisModal
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
        <ObstetricHyperemesisModal
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
        <ObstetricHyperemesisFlowsheetModal
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
