import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricPmcdEpisodes, type ObstetricPmcdRecord } from '../api';

export const ObstetricPmcdPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricPmcdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricPmcdEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load obstetric PMCD episodes:', err);
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
  const compliantCount = episodes.filter((e) => e.pmcd_decision_minute <= 4.0).length;
  const roscCount = episodes.filter((e) => e.rosc_achieved_post_delivery === 1).length;
  const ttmCount = episodes.filter((e) => e.maternal_survival_status === 'active_icu_targeted_temperature_management').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>⚡</span> Obstetric Perimortem Cesarean Delivery (PMCD) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AHA CPR in Pregnancy / SOAP Guidelines: 4-to-5 Minute Rule • Resuscitative Hysterotomy • BEAU-CHOPS Etiology
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total PMCD Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Maternal arrest activations</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            4-Minute Rule Compliant
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{compliantCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Decision ≤ 4.0 minutes</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Maternal ROSC Achieved
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{roscCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Venous return restored</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
            ICU Targeted Temp (TTM)
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{ttmCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Neuroprotection 32–36°C</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by code or patient name..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Protocol Statuses</option>
            <option value="cardiac_arrest_resuscitation">Resuscitation Active</option>
            <option value="hysterotomy_evacuation_active">Hysterotomy Evacuation</option>
            <option value="post_rosc_intensive_care">Post-ROSC Intensive Care</option>
            <option value="surgical_hemostasis_icu">Hemostasis / ICU Transfer</option>
            <option value="convalescent_rehabilitation">Convalescent Rehab</option>
            <option value="case_closed">Case Closed</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading obstetric PMCD cohort...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No obstetric PMCD episodes found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-750 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">GA / Rhythm</th>
                  <th className="p-3">4-Min Rule</th>
                  <th className="p-3">Maternal ROSC</th>
                  <th className="p-3">BEAU-CHOPS Etiology</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric_pmcd`}
                        className="font-semibold text-slate-900 dark:text-white hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div>{ep.gestational_age_weeks} weeks GA</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{ep.initial_arrest_rhythm}</div>
                    </td>
                    <td className="p-3">
                      {ep.pmcd_decision_minute <= 4.0 ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                          Minute {ep.pmcd_decision_minute} (≤4m Met)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                          Minute {ep.pmcd_decision_minute} (&gt;4m Delayed)
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {ep.rosc_achieved_post_delivery ? (
                        <span className="text-emerald-600 font-bold dark:text-emerald-400 flex items-center gap-1">
                          <span>💓</span> Achieved
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">No ROSC</span>
                      )}
                    </td>
                    <td className="p-3 capitalize text-slate-700 dark:text-slate-300">
                      {ep.primary_etiology_beau_chops.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric_pmcd`}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300"
                      >
                        Manage
                      </Link>
                      <a
                        href={`/obstetric-pmcd/print/${ep.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                      >
                        Print 🖨
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
