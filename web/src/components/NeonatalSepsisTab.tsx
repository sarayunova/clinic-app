import React, { useState, useEffect, useCallback } from 'react';
import {
  getNeonatalSepsisEpisodes,
  getNeonatalSepsisEpisode,
  deleteNeonatalSepsisEpisode,
  deleteNeonatalInotropeFlowsheet,
  type NeonatalSepsisRecord,
  type NeonatalInotropeRecord,
} from '../api';
import { NeonatalSepsisModal } from './NeonatalSepsisModal';
import { InotropeFlowsheetModal } from './InotropeFlowsheetModal';

interface NeonatalSepsisTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalSepsisTab: React.FC<NeonatalSepsisTabProps> = ({ patientId, patientName }) => {
  const [episodes, setEpisodes] = useState<NeonatalSepsisRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<NeonatalSepsisRecord | null>(null);
  const [inotropeLogs, setInotropeLogs] = useState<NeonatalInotropeRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isSepsisModalOpen, setIsSepsisModalOpen] = useState<boolean>(false);
  const [isInotropeModalOpen, setIsInotropeModalOpen] = useState<boolean>(false);

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalSepsisEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0) {
        const targetId = selectedEpisodeId && res.episodes.some((e) => e.id === selectedEpisodeId)
          ? selectedEpisodeId
          : res.episodes[0]!.id;
        setSelectedEpisodeId(targetId);
      } else {
        setSelectedEpisodeId(null);
        setCurrentEpisode(null);
        setInotropeLogs([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load neonatal sepsis episodes');
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedEpisodeId]);

  const fetchEpisodeDetails = useCallback(async (id: number) => {
    try {
      const res = await getNeonatalSepsisEpisode(id);
      setCurrentEpisode(res.episode);
      setInotropeLogs(res.inotropeLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to load episode details');
    }
  }, []);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  useEffect(() => {
    if (selectedEpisodeId) {
      fetchEpisodeDetails(selectedEpisodeId);
    }
  }, [selectedEpisodeId, fetchEpisodeDetails]);

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this neonatal sepsis record?')) return;
    try {
      await deleteNeonatalSepsisEpisode(id);
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteNeonatalInotropeFlowsheet(logId);
      if (selectedEpisodeId) fetchEpisodeDetails(selectedEpisodeId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete log');
    }
  };

  const nextHoursOnInotropes =
    inotropeLogs.length > 0 && inotropeLogs[inotropeLogs.length - 1]
      ? inotropeLogs[inotropeLogs.length - 1]!.hours_on_inotropes + 1
      : 1;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-700 to-indigo-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">👶</span>
            <h2 className="text-2xl font-bold tracking-tight">Neonatal Sepsis & Hemodynamics Engine</h2>
          </div>
          <p className="text-amber-100 text-sm mt-1 max-w-2xl">
            Kaiser Permanente Early-Onset Sepsis (EOS) risk prediction, I/T ratio left-shift hematology, and targeted neonatal inotrope & TnECHO hemodynamics protocol.
          </p>
        </div>

        <button
          onClick={() => setIsSepsisModalOpen(true)}
          className="px-5 py-2.5 bg-white text-rose-800 hover:bg-rose-50 font-bold rounded-xl shadow-md transition-all text-sm flex items-center gap-2"
        >
          <span>➕</span> New Sepsis Evaluation
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading && episodes.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Loading sepsis records...</div>
      ) : episodes.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500">
          <p className="text-base font-semibold">No neonatal sepsis assessments recorded for this infant.</p>
          <p className="text-xs text-gray-400 mt-1">
            Initiate an early-onset sepsis evaluation to compute the Kaiser risk and generate an antibiotic roadmap.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Episode List (Sidebar) */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Evaluation History</h3>
            <div className="space-y-2">
              {episodes.map((ep) => {
                const isSelected = ep.id === selectedEpisodeId;
                return (
                  <div
                    key={ep.id}
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-50 border-amber-400 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-gray-900">{ep.episode_code}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          ep.status === 'escalated_septic_shock'
                            ? 'bg-rose-100 text-rose-800'
                            : ep.status === 'active_treatment'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600">
                      EOS Risk: <span className="font-semibold text-gray-900">{ep.eos_risk_per_1000}/1,000</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {new Date(ep.evaluation_datetime).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Episode Detail View */}
          {currentEpisode && (
            <div className="lg:col-span-3 space-y-6">
              {/* Overview Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-100 gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-gray-900">{currentEpisode.episode_code}</h3>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          currentEpisode.eos_recommendation === 'blood_culture_empiric_antibiotics'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : currentEpisode.eos_recommendation === 'serial_physical_exams'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {currentEpisode.eos_recommendation.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Evaluated: {new Date(currentEpisode.evaluation_datetime).toLocaleString()} | GA:{' '}
                      <span className="font-semibold">{currentEpisode.gestational_age_weeks}w {currentEpisode.gestational_age_days}d</span> | Birth Wt:{' '}
                      <span className="font-semibold">{currentEpisode.birth_weight_kg} kg</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/patients/${patientId}/neonatal-sepsis/${currentEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <span>🖨️</span> Dossier
                    </a>
                    <button
                      onClick={() => handleDeleteEpisode(currentEpisode.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Perinatal & Lab Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100 text-xs">
                  <div>
                    <span className="text-gray-500 block">Maternal Intrapartum Temp:</span>
                    <span className="font-bold text-gray-800 text-sm">{currentEpisode.maternal_temp_celsius}°C</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Rupture of Membranes:</span>
                    <span className="font-bold text-gray-800 text-sm">{currentEpisode.rom_hours} hours</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Maternal GBS / IAP:</span>
                    <span className="font-bold text-gray-800 text-sm capitalize">
                      {currentEpisode.maternal_gbs_status} ({currentEpisode.maternal_iap_status})
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Clinical Presentation:</span>
                    <span className="font-bold text-gray-800 text-sm capitalize">
                      {currentEpisode.clinical_presentation.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Antibiotic & Lab Strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 text-xs space-y-1.5">
                    <span className="font-bold text-amber-900 block uppercase tracking-wider text-[11px]">
                      Empiric Antibiotic Regimen
                    </span>
                    <div className="text-gray-800">
                      Ampicillin:{' '}
                      <span className="font-semibold text-gray-900">
                        {currentEpisode.ampicillin_dose_mg ? `${currentEpisode.ampicillin_dose_mg} mg IV q12h` : 'N/A'}
                      </span>
                    </div>
                    <div className="text-gray-800">
                      Gentamicin:{' '}
                      <span className="font-semibold text-gray-900">
                        {currentEpisode.gentamicin_dose_mg ? `${currentEpisode.gentamicin_dose_mg} mg IV single daily` : 'N/A'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Blood Culture: {currentEpisode.blood_culture_drawn ? '✅ Drawn' : '⏳ Pending collection'}
                    </div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3.5 text-xs space-y-1.5">
                    <span className="font-bold text-blue-900 block uppercase tracking-wider text-[11px]">
                      Hematologic Left-Shift (I/T)
                    </span>
                    <div className="text-gray-800">
                      I/T Ratio:{' '}
                      <span
                        className={`font-black ${
                          currentEpisode.it_ratio && currentEpisode.it_ratio >= 0.2
                            ? 'text-red-700'
                            : 'text-gray-900'
                        }`}
                      >
                        {currentEpisode.it_ratio ?? 'Not recorded'}
                      </span>{' '}
                      {currentEpisode.it_ratio && currentEpisode.it_ratio >= 0.2 && '(≥ 0.20 Elevated)'}
                    </div>
                    <div className="text-gray-800">
                      CRP: <span className="font-semibold">{currentEpisode.crp_mg_l ? `${currentEpisode.crp_mg_l} mg/L` : 'N/A'}</span>
                    </div>
                    <div className="text-gray-800">
                      Platelets: <span className="font-semibold">{currentEpisode.platelets_k_ul ? `${currentEpisode.platelets_k_ul}k/µL` : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5">
                    <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                      Late-Onset Sepsis (LOS)
                    </span>
                    <div className="text-gray-700">
                      Status: {currentEpisode.los_suspected ? '⚠️ High Suspicion' : 'Routine Monitoring'}
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-2">
                      {currentEpisode.clinical_notes || 'No extra clinical notes recorded.'}
                    </p>
                  </div>
                </div>

                {/* Inotrope & Hemodynamics Flowsheet Section */}
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                        <span>💉</span> Targeted Hemodynamics & Inotrope Flowsheet
                      </h4>
                      <p className="text-xs text-gray-500">
                        Tracks blood pressure, pre/post-ductal saturation difference, SVC flow and vasoactive titration.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsInotropeModalOpen(true)}
                      className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <span>➕</span> Log Inotrope Checkpoint
                    </button>
                  </div>

                  {inotropeLogs.length === 0 ? (
                    <div className="py-6 text-center bg-gray-50 border border-gray-200 rounded-xl text-gray-400 text-xs">
                      No inotrope flowsheet logs recorded yet. Click above to log vital signs, pre/post ductal SpO₂, or inotropes.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full text-xs text-left divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-gray-600 font-semibold">
                          <tr>
                            <th className="px-3 py-2">Hours</th>
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">HR (bpm)</th>
                            <th className="px-3 py-2">BP / MAP</th>
                            <th className="px-3 py-2">Pre / Post SpO₂ (Δ)</th>
                            <th className="px-3 py-2">SVC Flow / Urine</th>
                            <th className="px-3 py-2">Inotropes (mcg/kg/min)</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {inotropeLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-bold text-gray-900">{log.hours_on_inotropes}h</td>
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-3 py-2 text-gray-800">{log.heart_rate_bpm ?? '-'}</td>
                              <td className="px-3 py-2">
                                <span className="font-semibold text-gray-900">
                                  {log.blood_pressure_systolic && log.blood_pressure_diastolic
                                    ? `${log.blood_pressure_systolic}/${log.blood_pressure_diastolic}`
                                    : '-'}
                                </span>{' '}
                                {log.map_mmhg && <span className="text-indigo-700 font-bold">({log.map_mmhg})</span>}
                              </td>
                              <td className="px-3 py-2">
                                {log.pre_ductal_spo2 && log.post_ductal_spo2 ? (
                                  <span>
                                    {log.pre_ductal_spo2}% / {log.post_ductal_spo2}%{' '}
                                    <span
                                      className={`font-bold ${
                                        log.delta_spo2 && log.delta_spo2 >= 5 ? 'text-rose-700' : 'text-gray-500'
                                      }`}
                                    >
                                      (Δ{log.delta_spo2}%)
                                    </span>
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {log.svc_flow_ml_kg_min ? `${log.svc_flow_ml_kg_min} mL` : '-'}{' '}
                                / {log.urine_output_ml_kg_hr ? `${log.urine_output_ml_kg_hr} mL/kg` : '-'}
                              </td>
                              <td className="px-3 py-2">
                                <div className="space-y-0.5 text-[11px]">
                                  {log.dopamine_mcg_kg_min > 0 && (
                                    <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-medium">
                                      Dopa: {log.dopamine_mcg_kg_min}
                                    </span>
                                  )}
                                  {log.epinephrine_mcg_kg_min > 0 && (
                                    <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">
                                      Epi: {log.epinephrine_mcg_kg_min}
                                    </span>
                                  )}
                                  {log.dobutamine_mcg_kg_min > 0 && (
                                    <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                                      Dobut: {log.dobutamine_mcg_kg_min}
                                    </span>
                                  )}
                                  {log.milrinone_mcg_kg_min > 0 && (
                                    <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
                                      Milr: {log.milrinone_mcg_kg_min}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
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
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <NeonatalSepsisModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isSepsisModalOpen}
        onClose={() => setIsSepsisModalOpen(false)}
        onSuccess={(newEp) => {
          setSelectedEpisodeId(newEp.id);
          fetchEpisodes();
        }}
      />

      {currentEpisode && (
        <InotropeFlowsheetModal
          episodeId={currentEpisode.id}
          patientId={patientId}
          weightKg={currentEpisode.birth_weight_kg}
          defaultHoursOnInotropes={nextHoursOnInotropes}
          isOpen={isInotropeModalOpen}
          onClose={() => setIsInotropeModalOpen(false)}
          onSuccess={() => {
            fetchEpisodeDetails(currentEpisode.id);
          }}
        />
      )}
    </div>
  );
};
