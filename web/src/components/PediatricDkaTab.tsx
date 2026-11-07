import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getPediatricDkaEpisodes,
  getPediatricDkaEpisode,
  updatePediatricDkaStatus,
  deletePediatricDkaEpisode,
  deletePediatricDkaFlowsheet,
  type PediatricDkaRecord,
  type PediatricDkaFlowsheetRecord,
} from '../api';
import { PediatricDkaModal } from './PediatricDkaModal';
import { DkaFlowsheetModal } from './DkaFlowsheetModal';

interface PediatricDkaTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricDkaTab: React.FC<PediatricDkaTabProps> = ({ patientId, patientName }) => {
  const [episodes, setEpisodes] = useState<PediatricDkaRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<PediatricDkaRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<PediatricDkaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [isFlowsheetModalOpen, setIsFlowsheetModalOpen] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricDkaEpisodes({ patientId });
      setEpisodes(res.episodes);
      const first = res.episodes[0];
      if (first) {
        setSelectedEpisodeId(first.id);
        fetchDetails(first.id);
      } else {
        setSelectedEpisodeId(null);
        setActiveEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric DKA episodes');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: number) => {
    try {
      const res = await getPediatricDkaEpisode(id);
      setActiveEpisode(res.episode);
      setFlowsheetLogs(res.flowsheetLogs);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [patientId]);

  const handleSelect = (id: number) => {
    setSelectedEpisodeId(id);
    fetchDetails(id);
  };

  const handleStatusChange = async (
    id: number,
    status: 'active_resuscitation' | 'ketoacidosis_resolved_subcutaneous_bridged' | 'completed' | 'discontinued'
  ) => {
    try {
      await updatePediatricDkaStatus(id, status);
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this DKA episode and its flowsheet logs?')) return;
    try {
      await deletePediatricDkaEpisode(id);
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete episode');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!window.confirm('Delete this hourly flowsheet entry?')) return;
    try {
      await deletePediatricDkaFlowsheet(logId);
      if (selectedEpisodeId) fetchDetails(selectedEpisodeId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  const nextHourNumber = flowsheetLogs.length > 0
    ? Math.max(...flowsheetLogs.map(l => l.hours_on_protocol)) + 1
    : 1;

  const targetTotalRate = activeEpisode?.rehydration_rate_ml_hr ?? 80;
  const defaultInsulinRate = activeEpisode
    ? Number((activeEpisode.child_weight_kg * activeEpisode.insulin_infusion_rate_u_kg_hr).toFixed(2))
    : 1.2;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Bar */}
      <div className="bg-gradient-to-r from-amber-900 via-orange-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-amber-700/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-white/10 rounded-xl">🧸</span>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                Pediatric Diabetic Ketoacidosis (DKA) &amp; Two-Bag Resuscitation
              </h2>
              <p className="text-xs text-amber-200 mt-0.5">
                ISPAD / PECARN Consensus · 48h Deficit + Maintenance · Two-Bag Titratable Dextrose · Regular Insulin (No Bolus) · Cerebral Edema Vigilance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEpisodeModalOpen(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center gap-1.5"
          >
            <span>+</span> Initiate DKA Resuscitation
          </button>
          {selectedEpisodeId && (
            <Link
              to={`/pediatric-dka/${selectedEpisodeId}/print`}
              target="_blank"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <span>🖨️</span> Dossier
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium animate-pulse">
          Loading pediatric DKA episodes and resuscitation flowsheets...
        </div>
      ) : episodes.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <span className="text-4xl block mb-2">🩸</span>
          <h3 className="text-base font-bold text-slate-800">No Pediatric DKA Resuscitation Episodes</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Evaluate pediatric hyperglycemic crisis, metabolic acidosis (pH &lt; 7.30, HCO3 &lt; 15 mmol/L), ketosis, and 48-hour rehydration.
          </p>
          <button
            type="button"
            onClick={() => setIsEpisodeModalOpen(true)}
            className="mt-4 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded-xl shadow transition"
          >
            Start DKA Resuscitation Episode
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Episodes List */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              DKA Episodes ({episodes.length})
            </h3>
            <div className="space-y-2">
              {episodes.map((e) => {
                const isSel = e.id === selectedEpisodeId;
                const sevColor =
                  e.dka_severity === 'severe_ph_lt_7_10'
                    ? 'border-red-500 bg-red-50/50'
                    : e.dka_severity === 'moderate_ph_7_10_7_19'
                    ? 'border-amber-500 bg-amber-50/50'
                    : 'border-slate-300 bg-white';

                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => handleSelect(e.id)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition ${
                      isSel ? 'border-amber-600 bg-amber-50/60 shadow-sm' : sevColor
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800">
                        {e.episode_code || `DKA-#${e.id}`}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(e.diagnosis_datetime).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-black text-rose-700">
                        pH {e.venous_ph}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        BG {e.initial_blood_glucose_mg_dl}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          e.dka_severity === 'severe_ph_lt_7_10'
                            ? 'bg-red-100 text-red-900'
                            : e.dka_severity === 'moderate_ph_7_10_7_19'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {e.dka_severity?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 capitalize">
                        {e.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Episode Details and Flowsheet */}
          {activeEpisode && (
            <div className="lg:col-span-3 space-y-6">
              {/* Resuscitation Metrics Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {activeEpisode.episode_code}
                      </span>
                      <span
                        className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                          activeEpisode.dka_severity === 'severe_ph_lt_7_10'
                            ? 'bg-red-600 text-white'
                            : activeEpisode.dka_severity === 'moderate_ph_7_10_7_19'
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {activeEpisode.dka_severity?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        Diagnosed {new Date(activeEpisode.diagnosis_datetime).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">
                      Child Weight: {activeEpisode.child_weight_kg} kg · Dehydration: {activeEpisode.estimated_dehydration_percent}% · Saline Bolus: {activeEpisode.initial_saline_bolus_ml ?? 0} mL
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500">Status:</label>
                    <select
                      className="border rounded-lg px-2.5 py-1 text-xs font-bold bg-slate-50 text-slate-800"
                      value={activeEpisode.status}
                      onChange={(e) => handleStatusChange(activeEpisode.id, e.target.value as any)}
                    >
                      <option value="active_resuscitation">Active Resuscitation (Two-Bag)</option>
                      <option value="ketoacidosis_resolved_subcutaneous_bridged">Bridged to SC Insulin</option>
                      <option value="completed">Completed / Discharged</option>
                      <option value="discontinued">Discontinued</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteEpisode(activeEpisode.id)}
                      className="text-xs text-red-500 hover:text-red-700 p-1"
                      title="Delete episode"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Fluid & Insulin Target Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                    <div className="text-[10px] uppercase font-bold text-amber-800">48h Rehydration Rate</div>
                    <div className="text-2xl font-black text-amber-900 mt-0.5">
                      {activeEpisode.rehydration_rate_ml_hr} <span className="text-xs font-normal">mL/hr</span>
                    </div>
                    <div className="text-[10px] text-amber-700">Maintenance + Deficit / 48h</div>
                  </div>

                  <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
                    <div className="text-[10px] uppercase font-bold text-rose-800">Regular Insulin Infusion</div>
                    <div className="text-2xl font-black text-rose-900 mt-0.5">
                      {Number((activeEpisode.child_weight_kg * activeEpisode.insulin_infusion_rate_u_kg_hr).toFixed(2))} <span className="text-xs font-normal">U/hr</span>
                    </div>
                    <div className="text-[10px] text-rose-700 font-bold">STRICTLY NO BOLUS ({activeEpisode.insulin_infusion_rate_u_kg_hr} U/kg/h)</div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Corrected Sodium</div>
                    <div className="text-2xl font-black text-slate-800 mt-0.5">
                      {flowsheetLogs[0]?.corrected_sodium_meq_l ? `${flowsheetLogs[0].corrected_sodium_meq_l} mEq` : 'Trending'}
                    </div>
                    <div className="text-[10px] text-slate-500">Must rise as glucose falls</div>
                  </div>

                  <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
                    <div className="text-[10px] uppercase font-bold text-indigo-800">Cerebral Edema Standby</div>
                    <div className="text-sm font-black text-indigo-950 mt-1">
                      3% Saline: 3–5 mL/kg
                    </div>
                    <div className="text-[10px] text-indigo-700">or Mannitol 0.5–1 g/kg IV</div>
                  </div>
                </div>

                {/* Two-Bag System Instructions */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-xs space-y-2">
                  <div className="font-bold text-indigo-900 flex items-center justify-between">
                    <span>🍼 ISPAD Two-Bag Titration Protocol</span>
                    <span className="font-mono text-indigo-800">Target Total Rate: {activeEpisode.rehydration_rate_ml_hr} mL/hr</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                    <div>
                      <strong>Bag 1 (D0):</strong> 0.9% NaCl with 20 mEq/L KCl &amp; 20 mEq/L K-Phos. Run when BG &gt; 300 mg/dL.
                    </div>
                    <div>
                      <strong>Bag 2 (D10):</strong> 10% Dextrose in 0.9% NaCl with 20 mEq/L KCl &amp; 20 mEq/L K-Phos. Titrate in as BG approaches 250–300 mg/dL to maintain glucose between 150–250 mg/dL while continuing insulin for ketoacidosis clearance.
                    </div>
                  </div>
                </div>
              </div>

              {/* 48-Hour Resuscitation Flowsheet */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>⏱️</span> 48-Hour Hourly Flowsheet Logs ({flowsheetLogs.length} Entries)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Hourly blood glucose, corrected sodium, Bag 1 &amp; Bag 2 titration rates, insulin units, and neuro checks.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFlowsheetModalOpen(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <span>+</span> Log Hour #{nextHourNumber}
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <div className="p-8 text-center border border-dashed rounded-xl bg-slate-50 text-slate-500 text-xs">
                    No hourly resuscitation logs recorded yet. Begin by logging Hour #1.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b font-bold">
                          <th className="p-2.5">Hr #</th>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Glucose</th>
                          <th className="p-2.5">pH / HCO3</th>
                          <th className="p-2.5">Corr Na</th>
                          <th className="p-2.5">Bag 1 (D0)</th>
                          <th className="p-2.5">Bag 2 (D10)</th>
                          <th className="p-2.5">Insulin</th>
                          <th className="p-2.5">GCS</th>
                          <th className="p-2.5">Alerts</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-800">
                        {flowsheetLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-2.5 font-bold text-amber-800">#{log.hours_on_protocol}</td>
                            <td className="p-2.5 text-slate-500 whitespace-nowrap">
                              {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2.5 font-black text-rose-700">
                              {log.blood_glucose_mg_dl} mg/dL
                            </td>
                            <td className="p-2.5 font-semibold">
                              {log.venous_ph ?? '—'} / {log.serum_bicarbonate_mmol_l ?? '—'}
                            </td>
                            <td className="p-2.5 font-mono">
                              {log.corrected_sodium_meq_l ? `${log.corrected_sodium_meq_l} mEq` : '—'}
                            </td>
                            <td className="p-2.5 text-cyan-800 font-bold">
                              {log.bag_1_rate_ml_hr} mL/h
                            </td>
                            <td className="p-2.5 text-amber-800 font-bold">
                              {log.bag_2_rate_ml_hr} mL/h
                            </td>
                            <td className="p-2.5 font-bold text-rose-700">
                              {log.insulin_infusion_units_hr} U/h
                            </td>
                            <td className="p-2.5 font-black">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  log.glasgow_coma_scale_score < 14
                                    ? 'bg-red-100 text-red-900 font-black'
                                    : 'bg-emerald-100 text-emerald-900'
                                }`}
                              >
                                GCS {log.glasgow_coma_scale_score}
                              </span>
                            </td>
                            <td className="p-2.5">
                              {log.cushing_triad_warning ? (
                                <span className="px-1.5 py-0.5 bg-red-600 text-white rounded font-bold text-[10px]">
                                  ⚠️ CUSHING
                                </span>
                              ) : log.neurological_headache_vomiting ? (
                                <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-[10px]">
                                  Headache
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Stable</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteFlowsheet(log.id)}
                                className="text-red-400 hover:text-red-700 font-bold text-xs"
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
        </div>
      )}

      {/* Episode Modal */}
      <PediatricDkaModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isEpisodeModalOpen}
        onClose={() => setIsEpisodeModalOpen(false)}
        onSuccess={() => {
          fetchEpisodes();
        }}
      />

      {/* Flowsheet Log Modal */}
      {selectedEpisodeId && (
        <DkaFlowsheetModal
          dkaEpisodeId={selectedEpisodeId}
          patientName={patientName}
          nextHourNumber={nextHourNumber}
          targetTotalRateMlHr={targetTotalRate}
          defaultInsulinRateUnitsHr={defaultInsulinRate}
          isOpen={isFlowsheetModalOpen}
          onClose={() => setIsFlowsheetModalOpen(false)}
          onSuccess={() => {
            fetchDetails(selectedEpisodeId);
          }}
        />
      )}
    </div>
  );
};
