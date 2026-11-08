import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricEmpyemaEpisodes, type PediatricEmpyemaRecord } from '../api';

export const PediatricEmpyemaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricEmpyemaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricEmpyemaEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load Pediatric Empyema episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, []);

  const filtered = episodes.filter((ep) => {
    const matchesSearch =
      ep.episode_code.toLowerCase().includes(search.toLowerCase()) ||
      (ep.patient_name && ep.patient_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || ep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = episodes.length;
  const stage2Count = episodes.filter((e) => e.staging_phase === 'stage_2_fibrinopurulent_complicated').length;
  const vatsCount = episodes.filter((e) => e.vats_decortication_indicated === 1 || e.status === 'vats_surgical_decortication').length;
  const fibrinolysisCount = episodes.filter((e) => e.intrapleural_fibrinolytic_therapy === 'tpa_plus_dornase_alfa_twice_daily').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫁</span> Pediatric Empyema &amp; Complicated Effusion Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            BTS Guidelines: Small-Bore Chest Drainage • Intrapleural tPA/Dornase Alfa • VATS Thoracoscopy Staging
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Episodes
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Pediatric pleural cases</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Stage 2 Fibrinopurulent
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {stage2Count}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Loculated empyema</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Intrapleural Fibrinolysis
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {fibrinolysisCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">tPA + DNase protocol</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            VATS Decortication
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {vatsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Surgical peel debridement</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Search by episode code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-3.5 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            <option value="chest_tube_insertion">Chest Tube Placement</option>
            <option value="intrapleural_fibrinolysis_active">Active Fibrinolysis (tPA/DNase)</option>
            <option value="vats_surgical_decortication">VATS Decortication</option>
            <option value="resolving_drain_removal_phase">Drain Removal Phase</option>
            <option value="discharged_complete_resolution">Discharged Resolved</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading Pediatric Empyema protocols...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching Pediatric Empyema records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Episode Code</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Age / Weight</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">pH / Glucose / LDH</th>
                  <th className="py-3 px-4">Fibrinolytic Regimen</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                      {ep.episode_code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric_empyema`}
                        className="hover:underline text-indigo-700 dark:text-indigo-400 font-semibold"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {ep.age_years}y • {ep.weight_kg}kg
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {ep.staging_phase.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {ep.pleural_fluid_ph ?? '—'} / {ep.pleural_fluid_glucose_mg_dl ?? '—'} / {ep.pleural_fluid_ldh_u_l ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">
                        {ep.intrapleural_fibrinolytic_therapy.replace(/_/g, ' ')} ({ep.doses_completed}/6)
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric_empyema`}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Open Chart
                      </Link>
                      <a
                        href={`/pediatric-empyema/${ep.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-slate-800 font-semibold"
                      >
                        Print
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
