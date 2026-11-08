import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalSipEpisodes, type NeonatalSipRecord } from '../api';

export const NeonatalSipPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalSipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalSipEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load neonatal SIP episodes:', err);
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
  const elbwCount = episodes.filter((e) => e.birth_weight_grams < 1000).length;
  const ppdActiveCount = episodes.filter((e) => e.surgical_approach === 'bedside_primary_peritoneal_drainage').length;
  const candidaCount = episodes.filter((e) => e.peritoneal_fluid_yeast_candida_positive === 1).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🍼</span> Neonatal Spontaneous Intestinal Perforation (SIP) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP / APSA / VON: ELBW Focal Ileal Rupture • Bedside RLQ Peritoneal Drainage • Steroid/NSAID Synergy
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total SIP Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active protocols</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            ELBW &lt;1000g Infants
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{elbwCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">High anesthetic risk</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
            Bedside PPD Drainage
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{ppdActiveCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Penrose / RLQ tube</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Candida Peritonitis
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{candidaCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Fluconazole / AmB indicated</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by episode code or patient name..."
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
            <option value="acute_perforation_triage">Acute Perforation Triage</option>
            <option value="bedside_peritoneal_drain_active">Bedside Drain Active</option>
            <option value="laparotomy_resection_enterostomy">Laparotomy / Enterostomy</option>
            <option value="drain_weaning_resolution">Drain Weaning</option>
            <option value="convalescent_enteral_feeding">Enteral Feeding</option>
            <option value="resolved_discharged">Resolved / Discharged</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading neonatal SIP cohort...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No neonatal SIP episodes found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-750 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Age / Weight / GA</th>
                  <th className="p-3">Synergy Risk</th>
                  <th className="p-3">Surgical Approach</th>
                  <th className="p-3">Drain Type</th>
                  <th className="p-3">Candida Status</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_sip`}
                        className="font-semibold text-slate-900 dark:text-white hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div>Day {ep.age_days} • <span className="font-bold">{ep.birth_weight_grams}g</span></div>
                      <div className="text-[10px] text-slate-400">{ep.gestational_age_weeks} weeks GA</div>
                    </td>
                    <td className="p-3">
                      {ep.antenatal_or_early_steroids_exposed && ep.indomethacin_or_ibuprofen_pda_exposed ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                          Steroid + NSAID
                        </span>
                      ) : ep.antenatal_or_early_steroids_exposed || ep.indomethacin_or_ibuprofen_pda_exposed ? (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          Single Exposed
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Unexposed</span>
                      )}
                    </td>
                    <td className="p-3 capitalize font-medium text-slate-800 dark:text-slate-200">
                      {ep.surgical_approach.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3 capitalize text-slate-600 dark:text-slate-400">
                      {ep.drain_type.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      {ep.peritoneal_fluid_yeast_candida_positive ? (
                        <span className="text-rose-600 font-bold dark:text-rose-400 flex items-center gap-1">
                          <span>🍄</span> Positive
                        </span>
                      ) : (
                        <span className="text-slate-400">Negative</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_sip`}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300"
                      >
                        Manage
                      </Link>
                      <a
                        href={`/neonatal-sip/print/${ep.id}`}
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
