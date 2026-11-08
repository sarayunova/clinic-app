import React, { useState, useEffect } from 'react';
import {
  getPediatricHusEpisodes,
  getPediatricHusEpisode,
  updatePediatricHusStatus,
  deletePediatricHusFlowsheet,
  type PediatricHusRecord,
  type PediatricHusFlowsheetRecord,
} from '../api';
import { PediatricHusModal } from './PediatricHusModal';
import { PediatricHusFlowsheetModal } from './PediatricHusFlowsheetModal';
import { type PediatricHusEvaluationResult } from '../pediatricHusEngine';

interface Props {
  patientId: number;
}

export const PediatricHusTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricHusRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricHusRecord | null>(null);
  const [evaluation, setEvaluation] = useState<PediatricHusEvaluationResult | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricHusFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricHusEpisodes({ patientId });
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
      console.error('Error loading Pediatric HUS episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricHusEpisode(id);
      setCurrentEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet || res.flowsheetLogs || []);
    } catch (err) {
      console.error('Error loading Pediatric HUS details:', err);
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
      await updatePediatricHusStatus(selectedEpisodeId, { status: newStatus });
      loadEpisodeDetails(selectedEpisodeId);
      loadEpisodes();
    } catch (err) {
      console.error('Failed to update HUS status:', err);
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deletePediatricHusFlowsheet(selectedEpisodeId, logId);
      loadEpisodeDetails(selectedEpisodeId);
    } catch (err) {
      console.error('Failed to delete flowsheet log:', err);
    }
  };

  if (loading && episodes.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading Pediatric HUS protocols...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🔬</span> Pediatric Hemolytic Uremic Syndrome Protocol (STEC & aHUS)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            IPNA Guidelines: Triad Assessment (MAHA + Thrombocytopenia + KDIGO AKI), Strict Antibiotic Avoidance & RRT
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            + Initiate HUS Protocol
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            No Hemolytic Uremic Syndrome episodes recorded for this pediatric patient.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-cyan-700 text-white rounded-lg text-sm font-semibold hover:bg-cyan-800 shadow"
          >
            Initiate HUS Protocol
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
                      ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      ep.dialysis_rrt_indicated
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                    }`}>
                      {ep.dialysis_rrt_indicated ? 'Dialysis' : 'Medical'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {ep.age_years} yrs • Plt: {ep.platelet_count.toLocaleString()} • Cr: {ep.serum_creatinine_mg_dl} mg/dL
                  </div>
                  <div className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400 truncate">
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
                      currentEpisode.dialysis_rrt_indicated
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                        : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200'
                    }`}>
                      {currentEpisode.dialysis_rrt_indicated ? 'RRT / Dialysis Indicated' : 'Hydration & Conservative'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Consultant: Dr. {currentEpisode.consultant_name || 'Pediatric Nephrologist'} • Evaluated: {new Date(currentEpisode.onset_datetime).toLocaleString()}
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
                      <option value="active_fluid_electrolyte_management">Active Fluid & Electrolyte Management</option>
                      <option value="dialysis_crrt_running">Dialysis / CRRT Running</option>
                      <option value="eculizumab_infusion">Eculizumab Infusion</option>
                      <option value="renal_recovery_phase">Renal Recovery Phase</option>
                      <option value="resolved_normal_renal_function">Resolved / Normal Renal Function</option>
                    </select>
                  </div>

                  <a
                    href={`/pediatric-hus/${currentEpisode.id}/print`}
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
                  evaluation.dialysisRrtIndicated
                    ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800'
                    : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚨</span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {evaluation.kdigoAkiStageLabel}
                      </h4>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800 shadow-sm text-slate-700 dark:text-slate-200">
                      Triad: {evaluation.isTriadDiagnosticMet ? 'Diagnostic Triad Met' : 'Partial Triad'}
                    </span>
                  </div>

                  {evaluation.dialysisRrtIndicated && (
                    <p className="text-xs font-bold text-red-800 dark:text-red-200 mb-2">
                      RRT Recommendation: {evaluation.dialysisModalityRecommendation}
                    </p>
                  )}

                  <div className="p-2.5 bg-red-100/90 dark:bg-red-900/60 rounded border border-red-300 dark:border-red-700 text-xs font-black text-red-900 dark:text-red-100 mb-3">
                    {evaluation.antibioticContraindicationAlert}
                  </div>

                  <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-lg border border-cyan-200 dark:border-cyan-900/60">
                    <h5 className="text-xs font-bold text-cyan-900 dark:text-cyan-200 mb-1">
                      IPNA Fluid & Electrolyte Directives
                    </h5>
                    <ul className="text-xs text-cyan-800 dark:text-cyan-300 space-y-1 list-disc pl-4">
                      {evaluation.fluidManagementDirectives.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Clinical Triad & Laboratory Grid */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                  Diagnostic Triad & Nephrology Biomarkers
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Phenotype</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {currentEpisode.hus_phenotype.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Shiga Toxin</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 capitalize">
                      {currentEpisode.shiga_toxin_result.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Hemoglobin / Plt</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {currentEpisode.hemoglobin_g_dl} g/dL • {currentEpisode.platelet_count.toLocaleString()}/mcL
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Schistocytes / LDH</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentEpisode.schistocytes_present_pct}% • {currentEpisode.serum_ldh_u_l} U/L
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Serum Creatinine</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">
                      {currentEpisode.serum_creatinine_mg_dl} mg/dL (Base: {currentEpisode.baseline_creatinine_mg_dl})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Serum Potassium</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {currentEpisode.serum_potassium_meq_l} mEq/L
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Oliguria Duration</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentEpisode.oliguria_anuria_duration_hours} hours
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Antibiotics Withheld</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {currentEpisode.antibiotics_avoided_strict ? 'YES (Withheld)' : 'NO (Violated)'}
                    </span>
                  </div>
                </div>

                {currentEpisode.clinical_notes && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold block mb-0.5">Consultant Nephrologist Notes:</span>
                    {currentEpisode.clinical_notes}
                  </div>
                )}
              </div>

              {/* Serial Nephrology Flowsheet */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>📈</span> Serial Nephrology & UOP Flowsheet ({flowsheet.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Surveillance of urine output, fluid balance, creatinine, potassium & blood pressure
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    + Log Checkpoint
                  </button>
                </div>

                {flowsheet.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed rounded-lg">
                    No flowsheet checkpoints logged yet. Record serial UOP, Cr, K+ and vitals.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Hrs</th>
                          <th className="p-2.5">UOP (mL/kg/h)</th>
                          <th className="p-2.5">Balance (mL)</th>
                          <th className="p-2.5">Cr (mg/dL)</th>
                          <th className="p-2.5">K+ (mEq/L)</th>
                          <th className="p-2.5">Plt</th>
                          <th className="p-2.5">BP (mmHg)</th>
                          <th className="p-2.5">Neuro</th>
                          <th className="p-2.5">UF (mL)</th>
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
                            <td className={`p-2.5 font-bold ${log.urine_output_ml_kg_hr < 0.5 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {log.urine_output_ml_kg_hr}
                            </td>
                            <td className="p-2.5">{log.fluid_balance_24h_ml ? `${log.fluid_balance_24h_ml > 0 ? '+' : ''}${log.fluid_balance_24h_ml}` : '—'}</td>
                            <td className="p-2.5 font-bold text-cyan-600 dark:text-cyan-400">{log.serum_creatinine_mg_dl}</td>
                            <td className={`p-2.5 font-bold ${log.serum_potassium_meq_l >= 5.5 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                              {log.serum_potassium_meq_l}
                            </td>
                            <td className="p-2.5">{log.platelet_count.toLocaleString()}</td>
                            <td className="p-2.5">{log.blood_pressure_sys}/{log.blood_pressure_dia}</td>
                            <td className="p-2.5 capitalize">{log.neurological_status.replace(/_/g, ' ')}</td>
                            <td className="p-2.5">{log.dialysis_ultrafiltration_ml ?? '—'}</td>
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
      <PediatricHusModal
        patientId={patientId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={() => {
          loadEpisodes();
          setShowCreateModal(false);
        }}
      />

      {selectedEpisodeId && (
        <PediatricHusFlowsheetModal
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
