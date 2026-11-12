import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricDicEpisodes, type ObstetricDicRecord } from '../api';

export const ObstetricDicPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricDicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricDicEpisodes();
      setEpisodes(res.episodes || []);
    } catch (err) {
      console.error('Failed to load obstetric DIC episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, []);

  const filtered = episodes.filter((ep) => {
    const matchesSearch =
      ep.episode_number.toLowerCase().includes(search.toLowerCase()) ||
      (ep.patient_name && ep.patient_name.toLowerCase().includes(search.toLowerCase())) ||
      ep.clinical_trigger.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = episodes.length;
  const criticalFibrinogenCount = episodes.filter((e) => e.fibrinogen_mg_dl < 200).length;
  const mtpActiveCount = episodes.filter((e) => e.is_mtp_activated === 1).length;
  const severePphCount = episodes.filter((e) => e.clinical_trigger === 'severe_pph').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩸</span> Obstetric DIC & Fibrinogen-Guided Resuscitation Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pregnancy-Modified ISTH DIC Criteria • Target Fibrinogen &ge; 200 mg/dL • Balanced 1:1:1 MTP & Cryoprecipitate Protocol
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Resuscitation Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Obstetric coagulopathy cases</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-200 dark:border-red-900 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Critical Hypofibrinogenemia
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{criticalFibrinogenCount}</div>
          <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">Fibrinogen &lt; 200 mg/dL (Stat Cryo)</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-purple-200 dark:border-purple-900 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            MTP Activated
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{mtpActiveCount}</div>
          <div className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">1:1:1 Balanced blood package</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Severe PPH Trigger
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{severePphCount}</div>
          <div className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">Consumptive maternal hemorrhage</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            placeholder="Search by episode number, patient name, trigger..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
          <select
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="stabilized">Stabilized</option>
            <option value="resolved">Resolved</option>
            <option value="transferred">Transferred</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading obstetric coagulopathy cohorts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No obstetric DIC records found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode #</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Trigger & EBL</th>
                  <th className="px-4 py-3">Fibrinogen</th>
                  <th className="px-4 py-3">Platelets & INR</th>
                  <th className="px-4 py-3">Resuscitation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {ep.episode_number}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/patient/${ep.patient_id}`} className="text-blue-600 hover:underline font-medium">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold text-slate-900 dark:text-white capitalize">
                        {ep.clinical_trigger.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-400">EBL: {ep.estimated_blood_loss_ml} mL</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold">
                      <span className={ep.fibrinogen_mg_dl < 200 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}>
                        {ep.fibrinogen_mg_dl} mg/dL
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>Plt: {ep.platelet_count_k_ul}k</div>
                      <div>INR: {ep.inr}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>MTP: {ep.is_mtp_activated ? 'Yes' : 'No'} | TXA: {ep.tranexamic_acid_given ? 'Yes' : 'No'}</div>
                      <div>Cryo: {ep.cryoprecipitate_units_given} U</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ep.status === 'active'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                            : ep.status === 'stabilized'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {ep.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patient/${ep.patient_id}`}
                        className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                      >
                        View Bedside
                      </Link>
                      <a
                        href={`/protocols/obstetric-dic/print/${ep.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100"
                      >
                        Print Dossier
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
