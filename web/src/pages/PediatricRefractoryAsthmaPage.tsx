import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricRefractoryAsthmaEpisodes, type PediatricRefractoryAsthmaRecord } from '../api';

export const PediatricRefractoryAsthmaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricRefractoryAsthmaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricRefractoryAsthmaEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load pediatric refractory status asthmaticus episodes:', err);
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
  const exhaustionCount = episodes.filter(
    (e) => e.silent_chest_or_exhaustion === 1 || e.pco2_mmhg >= 42 || e.ph_value <= 7.28
  ).length;
  const rescueInfusionCount = episodes.filter(
    (e) => e.continuous_iv_terbutaline_active === 1 || e.iv_ketamine_infusion_active === 1
  ).length;
  const ventilatorySupportCount = episodes.filter(
    (e) => e.ventilatory_support_mode !== 'standard_low_flow_oxygen'
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫁</span> Pediatric Refractory Status Asthmaticus (PICU Rescue) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            BTS / SIGN Guideline 158 • PALS Refractory Bronchospasm Resuscitation • IV Terbutaline & Ketamine Rescue
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total PICU Resuscitations
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Refractory pediatric cases</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-200 dark:border-red-900 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Impending Arrest / Silent Chest
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{exhaustionCount}</div>
          <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">pCO₂ ≥ 42 mmHg / Acidosis</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-purple-200 dark:border-purple-900 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            IV Terbutaline / Ketamine
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{rescueInfusionCount}</div>
          <div className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">2nd-line continuous bronchodilators</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Advanced Ventilatory Support
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{ventilatorySupportCount}</div>
          <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">HFNC / BiPAP / Permissive Hypercapnia</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            placeholder="Search by episode code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Status:</label>
          <select
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="impending_respiratory_failure">Impending Respiratory Failure</option>
            <option value="second_line_iv_bronchodilator_infusion">2nd-Line IV Infusion</option>
            <option value="bipap_noninvasive_support">BiPAP Non-Invasive</option>
            <option value="invasive_mechanical_ventilation_picu">Invasive Ventilation (PICU)</option>
            <option value="bronchospasm_relieving_weaning">Bronchospasm Relieving</option>
            <option value="extubated_convalescent_stepdown">Extubated Stepdown</option>
            <option value="resolved_transferred_to_ward">Resolved / Transferred</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading pediatric refractory asthma episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No pediatric refractory asthma episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Age / Weight</th>
                  <th className="px-4 py-3">PAS / RR / HR</th>
                  <th className="px-4 py-3">Blood Gas (pCO₂ / pH)</th>
                  <th className="px-4 py-3">Rescue Infusions</th>
                  <th className="px-4 py-3">Ventilation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => {
                  const hasArrestRisk = ep.silent_chest_or_exhaustion === 1 || ep.pco2_mmhg >= 42 || ep.ph_value <= 7.28;
                  return (
                    <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=pediatric-refractory-asthma`}
                          className="text-blue-600 hover:underline"
                        >
                          {ep.episode_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {ep.patient_name || `Patient #${ep.patient_id}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {ep.age_years} yrs • {ep.weight_kg} kg
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        PAS {ep.initial_pediatric_asthma_score}/12 • RR {ep.respiratory_rate} • HR {ep.heart_rate_bpm}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            hasArrestRisk ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          pCO₂ {ep.pco2_mmhg} | pH {ep.ph_value}
                        </span>
                        {ep.silent_chest_or_exhaustion === 1 && (
                          <div className="text-xs text-red-600 font-semibold">Silent Chest</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col gap-1">
                          {ep.continuous_iv_terbutaline_active === 1 && (
                            <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
                              Terbutaline {ep.terbutaline_dose_mcg_kg_min} µg/kg/min
                            </span>
                          )}
                          {ep.iv_ketamine_infusion_active === 1 && (
                            <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-1.5 py-0.5 rounded font-medium">
                              Ketamine {ep.ketamine_dose_mg_kg_hr} mg/kg/hr
                            </span>
                          )}
                          {ep.continuous_iv_terbutaline_active === 0 && ep.iv_ketamine_infusion_active === 0 && (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">
                        {ep.ventilatory_support_mode.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            ep.status === 'impending_respiratory_failure'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              : ep.status === 'second_line_iv_bronchodilator_infusion'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : ep.status === 'resolved_transferred_to_ward'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {ep.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link
                          to={`/pediatric-refractory-asthma/${ep.id}/print`}
                          target="_blank"
                          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded font-medium text-slate-700 dark:text-slate-200"
                        >
                          🖨️ Dossier
                        </Link>
                        <Link
                          to={`/patients/${ep.patient_id}?tab=pediatric-refractory-asthma`}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                        >
                          Chart →
                        </Link>
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
