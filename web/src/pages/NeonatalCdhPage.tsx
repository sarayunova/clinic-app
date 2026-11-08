import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalCdhEpisodes, type NeonatalCdhRecord } from '../api';

export const NeonatalCdhPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalCdhRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalCdhEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load neonatal CDH episodes:', err);
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
  const severeCount = episodes.filter((e) => e.observed_expected_lhr_percent < 25.0).length;
  const liverUpCount = episodes.filter((e) => e.liver_herniation_up === 1).length;
  const readyCount = episodes.filter((e) => e.postductal_spo2_percent >= 85 && e.peak_inspiratory_pressure_cmh2o < 25).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫁</span> Neonatal Congenital Diaphragmatic Hernia (CDH) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP / EURO-CDH: Gentle Ventilation • Pre/Post-Ductal Shunts • Permissive Hypercapnia • Delayed Repair Timing
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total CDH Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Bochdalek &amp; Morgagni</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Severe Hypoplasia (&lt;25%)
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{severeCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">o/e LHR &lt; 25% (ECMO triage)</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Intrathoracic Liver-Up
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{liverUpCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Patch closure likely</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Ventilator Stabilized
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{readyCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Postductal &ge;85%, PIP &lt;25</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by code or patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 w-full sm:w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by Status"
            className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Statuses</option>
            <option value="preop_gentle_ventilation">Pre-op Gentle Ventilation</option>
            <option value="pulmonary_hypertension_crisis">PPHN Crisis &amp; iNO</option>
            <option value="in_operating_room_repair">In Operating Room Repair</option>
            <option value="postop_ventilatory_weaning">Post-op Ventilatory Weaning</option>
            <option value="recovering_extubated">Recovering / Extubated</option>
            <option value="resolved_discharged_home">Resolved / Discharged Home</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading CDH cohort...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">No CDH episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Defect Side &amp; Liver</th>
                  <th className="px-4 py-3">o/e LHR %</th>
                  <th className="px-4 py-3">Ventilation (PIP/PEEP)</th>
                  <th className="px-4 py-3">SpO2 (Pre / Post)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filtered.map((ep) => {
                  const gradient = Math.max(0, ep.preductal_spo2_percent - ep.postductal_spo2_percent);
                  return (
                    <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {ep.episode_code}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=neonatal_cdh`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {ep.patient_name || `Patient #${ep.patient_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="capitalize">{ep.defect_side.replace('_', ' ')}</div>
                        {ep.liver_herniation_up === 1 && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            Liver-Up
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold">
                        <span
                          className={
                            ep.observed_expected_lhr_percent < 25
                              ? 'text-rose-600 font-bold'
                              : ep.observed_expected_lhr_percent <= 35
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }
                        >
                          {ep.observed_expected_lhr_percent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {ep.peak_inspiratory_pressure_cmh2o} / {ep.peep_cmh2o}{' '}
                        {ep.peak_inspiratory_pressure_cmh2o >= 25 && (
                          <span className="text-rose-500 font-bold ml-1">PIP high</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {ep.preductal_spo2_percent}% / {ep.postductal_spo2_percent}%
                        {gradient >= 10 && (
                          <span className="text-rose-600 font-bold ml-1">({gradient}% Δ)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {ep.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=neonatal_cdh`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Manage
                        </Link>
                        <a
                          href={`/neonatal-cdh/${ep.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          Print 🖨
                        </a>
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
