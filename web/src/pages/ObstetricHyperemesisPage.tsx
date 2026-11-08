import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricHyperemesisEpisodes, type ObstetricHyperemesisRecord } from '../api';

export const ObstetricHyperemesisPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricHyperemesisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricHyperemesisEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load hyperemesis episodes:', err);
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
  const severePuqeCount = episodes.filter((e) => {
    const score = e.puqe_nausea_hours + e.puqe_vomiting_episodes + e.puqe_retching_episodes;
    return score >= 13;
  }).length;
  const thiamineHazardCount = episodes.filter((e) => e.parenteral_thiamine_given_before_dextrose === 0).length;
  const severeWeightLossCount = episodes.filter((e) => e.weight_loss_percent >= 5.0).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🤰</span> Obstetric Hyperemesis Gravidarum (HG) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ACOG Practice Bulletin No. 189 / RCOG No. 69: PUQE-24 Scoring • Mandatory Thiamine Pre-Dextrose • Electrolyte Restoration
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total HG Inpatients
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active &amp; stepped-down cases</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Severe PUQE (&ge; 13)
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{severePuqeCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Inpatient IV hydration indicated</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Thiamine Pre-Dextrose Due
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{thiamineHazardCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Wernicke prevention priority</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Weight Loss &gt; 5%
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{severeWeightLossCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Catabolic starvation markers</div>
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
            <option value="all">All Care Stages</option>
            <option value="inpatient_iv_hydration_thiamine">Inpatient IV Hydration &amp; Thiamine</option>
            <option value="antiemetic_step_up_escalation">Antiemetic Step-Up Escalation</option>
            <option value="corticosteroid_pulse_therapy">Corticosteroid Pulse Therapy</option>
            <option value="oral_tolerance_dietary_reintroduction">Oral Tolerance Reintroduction</option>
            <option value="outpatient_maintenance_surveillance">Outpatient Maintenance</option>
            <option value="resolved_discharged_home">Resolved / Discharged Home</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading HG cohort...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">No hyperemesis episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">GA (wks)</th>
                  <th className="px-4 py-3">PUQE-24 Score</th>
                  <th className="px-4 py-3">Weight Loss &amp; Ketones</th>
                  <th className="px-4 py-3">K+ (mmol/L)</th>
                  <th className="px-4 py-3">Thiamine Pre-Dextrose</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filtered.map((ep) => {
                  const puqeScore = ep.puqe_nausea_hours + ep.puqe_vomiting_episodes + ep.puqe_retching_episodes;
                  return (
                    <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {ep.episode_code}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=obstetric_hyperemesis`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {ep.patient_name || `Patient #${ep.patient_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold">{ep.gestational_age_weeks} wks</td>
                      <td className="px-4 py-3 font-mono font-bold">
                        <span
                          className={
                            puqeScore >= 13
                              ? 'text-rose-600 font-bold'
                              : puqeScore >= 7
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }
                        >
                          {puqeScore} / 15
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {ep.weight_loss_percent}% wt loss
                        <span className="block text-[10px] uppercase text-slate-400">
                          {ep.ketonuria_level.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {ep.serum_potassium_mmol_l}{' '}
                        {ep.serum_potassium_mmol_l < 3.5 && (
                          <span className="text-rose-500 font-bold ml-1">low</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {ep.parenteral_thiamine_given_before_dextrose === 1 ? (
                          <span className="text-emerald-600 font-semibold">✅ Given</span>
                        ) : (
                          <span className="text-rose-600 font-bold animate-pulse">❌ Thiamine Due</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {ep.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=obstetric_hyperemesis`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Manage
                        </Link>
                        <a
                          href={`/obstetric-hyperemesis/${ep.id}/print`}
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
