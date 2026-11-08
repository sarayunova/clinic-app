import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricCvstEpisodes, type ObstetricCvstRecord } from '../api';

export const ObstetricCvstPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricCvstRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricCvstEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load obstetric CVST episodes:', err);
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
  const hemorrhagicCount = episodes.filter((e) => e.intracranial_hemorrhagic_venous_infarct === 1).length;
  const anticoagCount = episodes.filter((e) => e.therapeutic_anticoagulation_active === 1).length;
  const seizureCount = episodes.filter((e) => e.seizures_present === 1).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧠</span> Obstetric Cerebral Venous Sinus Thrombosis (CVST) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            European Stroke Organisation (ESO) Guidelines • AHA/ASA Stroke in Pregnancy • Therapeutic Anticoagulation in Venous Hemorrhage
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Neuro-vascular monitoring</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-200 dark:border-red-900 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Hemorrhagic Infarct
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{hemorrhagicCount}</div>
          <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">LMWH mandatory (ESO guidelines)</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Anticoagulation Active
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{anticoagCount}</div>
          <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Therapeutic LMWH / UFH</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-purple-200 dark:border-purple-900 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Seizure Presentation
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{seizureCount}</div>
          <div className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">Levetiracetam active</div>
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
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</label>
          <select
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="acute_cvst_inpatient_resuscitation">Acute Inpatient Resuscitation</option>
            <option value="therapeutic_anticoagulation_active">Anticoagulation Active</option>
            <option value="elevated_icp_critical_monitoring">Elevated ICP Critical Monitoring</option>
            <option value="endovascular_or_surgical_intervention">Endovascular / Surgical</option>
            <option value="subacute_neurological_rehabilitation">Subacute Neuro Rehab</option>
            <option value="convalescent_long_term_anticoagulation">Convalescent Long-Term</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading CVST episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No obstetric CVST records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Timing</th>
                  <th className="px-4 py-3">Headache</th>
                  <th className="px-4 py-3">Hemorrhagic Infarct</th>
                  <th className="px-4 py-3">Anticoagulation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/patients/${ep.patient_id}`} className="text-blue-600 hover:underline">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">
                      {ep.clinical_timing.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">
                      {ep.presenting_headache_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      {ep.intracranial_hemorrhagic_venous_infarct === 1 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          ⚠️ Hemorrhagic Infarct
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {ep.anticoagulant_agent.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric-cvst`}
                        className="text-xs text-blue-600 font-semibold hover:underline"
                      >
                        Manage
                      </Link>
                      <Link
                        to={`/obstetric-cvst/${ep.id}/print`}
                        target="_blank"
                        className="text-xs text-slate-600 font-semibold hover:underline"
                      >
                        Print
                      </Link>
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
