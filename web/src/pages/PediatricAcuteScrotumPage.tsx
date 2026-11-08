import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricAcuteScrotumEpisodes, type PediatricAcuteScrotumRecord } from '../api';

export const PediatricAcuteScrotumPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricAcuteScrotumRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricAcuteScrotumEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load acute scrotum episodes:', err);
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
  const highRiskCount = episodes.filter((e) => {
    const score =
      e.twist_testis_swelling +
      e.twist_hard_testis +
      e.twist_absent_cremasteric_reflex +
      e.twist_nausea_vomiting +
      e.twist_high_riding_testis;
    return score >= 5;
  }).length;
  const goldenWindowCount = episodes.filter((e) => e.symptom_duration_hours <= 6.0).length;
  const orchiopexyCount = episodes.filter((e) => e.bilateral_orchiopexy_performed === 1).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩻</span> Pediatric Acute Scrotum &amp; TWIST Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AUA / ESPU / AAP: TWIST Score (0–7) • 6-Hour Golden Salvage Window • Bilateral Dartos Orchiopexy
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Scrotum Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Torsion, hydatid &amp; orchitis</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            High Risk TWIST (5–7)
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{highRiskCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Immediate surgical exploration</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Golden Window (&le; 6h)
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{goldenWindowCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">&gt;90% testicular viability rate</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Bilateral Orchiopexy
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{orchiopexyCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Dartos pouch fixation complete</div>
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
            <option value="all">All Triage Stages</option>
            <option value="emergency_triage_under_6h">Emergency Triage (&le;6h)</option>
            <option value="urgent_ultrasound_intermediate_risk">Urgent Ultrasound (Intermediate)</option>
            <option value="in_operating_room_exploration">In Operating Room Exploration</option>
            <option value="postop_scrotal_support_recovery">Post-op Scrotal Support</option>
            <option value="resolved_discharged_home">Resolved / Discharged Home</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading Acute Scrotum cohort...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">No acute scrotum episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Side &amp; Age</th>
                  <th className="px-4 py-3">TWIST Score</th>
                  <th className="px-4 py-3">Duration (Window)</th>
                  <th className="px-4 py-3">Ultrasound / Detorsion</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filtered.map((ep) => {
                  const twistScore =
                    ep.twist_testis_swelling +
                    ep.twist_hard_testis +
                    ep.twist_absent_cremasteric_reflex +
                    ep.twist_nausea_vomiting +
                    ep.twist_high_riding_testis;
                  return (
                    <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {ep.episode_code}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=pediatric_acute_scrotum`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {ep.patient_name || `Patient #${ep.patient_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold capitalize">{ep.affected_side}</span> ({ep.age_years} yo)
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        <span
                          className={
                            twistScore >= 5
                              ? 'text-rose-600 font-bold'
                              : twistScore >= 3
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }
                        >
                          {twistScore} / 7
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {ep.symptom_duration_hours}h{' '}
                        {ep.symptom_duration_hours <= 6.0 ? (
                          <span className="text-emerald-600 font-semibold ml-1">(Golden)</span>
                        ) : (
                          <span className="text-slate-400 ml-1">(&gt;6h)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        <div>{ep.doppler_findings.replace(/_/g, ' ')}</div>
                        {ep.bilateral_orchiopexy_performed === 1 && (
                          <span className="text-emerald-600 font-semibold">✅ Bilateral pexy</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {ep.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=pediatric_acute_scrotum`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Manage
                        </Link>
                        <a
                          href={`/pediatric-acute-scrotum/${ep.id}/print`}
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
