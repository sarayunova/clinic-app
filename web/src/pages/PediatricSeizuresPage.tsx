import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPediatricSeizureEpisodes,
  updatePediatricSeizureEpisode,
  type PediatricSeizureRecord,
} from '../api';

export const PediatricSeizuresPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricSeizureRecord[]>([]);
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricSeizureEpisodes({
        phase: phaseFilter === 'all' ? undefined : phaseFilter,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Pediatric Seizures console');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [phaseFilter]);

  const handlePhaseUpdate = async (id: number, newPhase: any) => {
    try {
      await updatePediatricSeizureEpisode(id, { currentAlgorithmPhase: newPhase });
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update phase');
    }
  };

  const totalCount = episodes.length;
  const activeResusCount = episodes.filter(e => e.current_algorithm_phase !== 'seizure_aborted_postictal').length;
  const refractoryCount = episodes.filter(e => e.current_algorithm_phase === 'phase_4_refractory_rsi_picu_gt_40m').length;
  const hypoglycemiaCount = episodes.filter(e => e.blood_glucose_mg_dl !== null && e.blood_glucose_mg_dl < 60).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-gradient-to-r from-red-950 via-red-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <span>⚡</span> Pediatric Emergency Status Epilepticus Resuscitation Console
          </h1>
          <p className="text-sm text-red-200 mt-1">
            AES Guidelines & PALS Resuscitation Protocol • 4-Phase Algorithm, Broselow Drug Dosing & Refractory RSI / PICU Escalation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/patients"
            className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow"
          >
            ← Patient Directory
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase">Total Seizure Episodes</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{totalCount}</p>
          <span className="text-xs text-gray-400">Documented resuscitations</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
          <span className="text-xs font-bold text-red-700 uppercase">Active Resuscitations</span>
          <p className="text-2xl font-black text-red-900 mt-1">{activeResusCount}</p>
          <span className="text-xs text-red-700">Underway in ER / PICU</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm">
          <span className="text-xs font-bold text-purple-700 uppercase">Refractory Status (&gt;40m)</span>
          <p className="text-2xl font-black text-purple-900 mt-1">{refractoryCount}</p>
          <span className="text-xs text-purple-700">RSI & Continuous Infusion</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs font-bold text-amber-700 uppercase">Hypoglycemic Provocations</span>
          <p className="text-2xl font-black text-amber-800 mt-1">{hypoglycemiaCount}</p>
          <span className="text-xs text-amber-700">D10W 2 mL/kg Bolus required</span>
        </div>
      </div>

      {/* Roster & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700">Algorithm Phase Filter:</span>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="text-xs border rounded-lg px-2.5 py-1.5 font-medium bg-gray-50 text-gray-800"
            >
              <option value="all">All Phases</option>
              <option value="phase_1_stabilization_0_5m">Phase 1: Stabilization (0-5m)</option>
              <option value="phase_2_first_line_bzd_5_20m">Phase 2: First-line BZD (5-20m)</option>
              <option value="phase_3_second_line_asm_20_40m">Phase 3: Second-line ASM (20-40m)</option>
              <option value="phase_4_refractory_rsi_picu_gt_40m">Phase 4: Refractory RSI (&gt;40m)</option>
              <option value="seizure_aborted_postictal">Seizure Aborted / Postictal</option>
            </select>
          </div>
          <button
            onClick={fetchEpisodes}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 border rounded-lg bg-gray-50"
          >
            ↻ Refresh Roster
          </button>
        </div>

        {loading && <p className="text-center text-sm text-gray-500 py-8">Loading seizure roster...</p>}
        {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        {!loading && episodes.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No pediatric seizure episodes found matching the selected phase filter.
          </div>
        )}

        {!loading && episodes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2 text-left">Code / Time</th>
                  <th className="px-3 py-2 text-left">Child / UHID</th>
                  <th className="px-3 py-2 text-center">Age / Wt / Zone</th>
                  <th className="px-3 py-2 text-center">Semiology & Etiology</th>
                  <th className="px-3 py-2 text-center">Blood Glucose</th>
                  <th className="px-3 py-2 text-center">Current Phase</th>
                  <th className="px-3 py-2 text-center">Second-Line ASM</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {episodes.map((ep) => {
                  const phaseBadgeColor =
                    ep.current_algorithm_phase === 'phase_4_refractory_rsi_picu_gt_40m'
                      ? 'bg-purple-100 text-purple-900 border-purple-300 font-black'
                      : ep.current_algorithm_phase === 'phase_3_second_line_asm_20_40m'
                      ? 'bg-red-100 text-red-900 border-red-300 font-bold'
                      : ep.current_algorithm_phase === 'phase_2_first_line_bzd_5_20m'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                      : ep.current_algorithm_phase === 'phase_1_stabilization_0_5m'
                      ? 'bg-blue-100 text-blue-900 border-blue-300 font-semibold'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold';

                  return (
                    <tr key={ep.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-mono font-bold text-red-900 whitespace-nowrap">
                        <div>{ep.episode_code}</div>
                        <div className="text-[10px] text-gray-400 font-normal">
                          {new Date(ep.seizure_start_datetime).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=pediatric_seizures`}
                          className="font-bold text-red-700 hover:underline"
                        >
                          {ep.patient_name}
                        </Link>
                        <div className="text-[10px] text-gray-400">{ep.patient_uhid}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="font-semibold">{ep.patient_age_months} mo • {ep.weight_kg} kg</div>
                        <span className="text-[10px] font-black uppercase text-indigo-800">
                          {ep.broselow_color_zone || 'Standard'} Zone
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="font-bold text-gray-900">{ep.seizure_type.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] text-gray-500">{ep.etiology?.replace(/_/g, ' ') || 'Unknown'}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {ep.blood_glucose_mg_dl ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ep.blood_glucose_mg_dl < 60 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                            {ep.blood_glucose_mg_dl} mg/dL
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Pending</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <select
                          value={ep.current_algorithm_phase}
                          onChange={(e) => handlePhaseUpdate(ep.id, e.target.value)}
                          className={`text-[10px] rounded border px-2 py-1 ${phaseBadgeColor}`}
                        >
                          <option value="phase_1_stabilization_0_5m">Phase 1: Stabilization</option>
                          <option value="phase_2_first_line_bzd_5_20m">Phase 2: First-line BZD</option>
                          <option value="phase_3_second_line_asm_20_40m">Phase 3: Second-line ASM</option>
                          <option value="phase_4_refractory_rsi_picu_gt_40m">Phase 4: Refractory RSI</option>
                          <option value="seizure_aborted_postictal">Aborted / Postictal</option>
                        </select>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {ep.phase3_second_line_agent ? (
                          <div className="font-bold text-indigo-900 text-[10px]">
                            {ep.phase3_second_line_agent.split(' ')[0]}
                            <div className="text-[10px] text-gray-500 font-normal uppercase">{ep.phase3_infusion_status || 'Infusing'}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">None Given</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            to={`/patients/${ep.patient_id}?tab=pediatric_seizures`}
                            className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded font-semibold text-[10px]"
                          >
                            Chart Tab
                          </Link>
                          <Link
                            to={`/pediatric-seizures/print/${ep.id}`}
                            className="px-2 py-1 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded font-semibold text-[10px]"
                          >
                            🖨️ Dossier
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
