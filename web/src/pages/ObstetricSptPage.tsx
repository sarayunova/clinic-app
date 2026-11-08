import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricSptEpisodes, type ObstetricSptRecord } from '../api';

export const ObstetricSptPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricSptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricSptEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load obstetric SPT episodes:', err);
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
  const ovtCount = episodes.filter((e) => e.spt_phenotype === 'ovarian_vein_thrombosis').length;
  const dsptCount = episodes.filter((e) => e.spt_phenotype === 'deep_septic_pelvic_thrombophlebitis').length;
  const responsiveCount = episodes.filter((e) => e.heparin_challenge_response === 'positive_defervescence_within_48_72h').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩸</span> Obstetric Septic Pelvic Thrombophlebitis (SPT) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ACOG / SMFM / CDC: Refractory Postpartum Fever • Ovarian Vein Thrombosis vs DSPT • Heparin Challenge Protocol
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total SPT Cases
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Refractory postpartum fever</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Ovarian Vein Thrombosis
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{ovtCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Radiographic filling defect</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Deep Septic Pelvic (DSPT)
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{dsptCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Picket-fence fevers</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Heparin Responsive
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{responsiveCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Defervescence &lt; 48-72h</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            placeholder="Search by episode code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-56">
          <select
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Care Stages</option>
            <option value="heparin_challenge_eval">Heparin Challenge Eval</option>
            <option value="active_therapeutic_anticoagulation">Therapeutic Anticoagulation</option>
            <option value="afebrile_antibiotic_completion">Afebrile Abx Completion</option>
            <option value="outpatient_anticoagulation_bridge">Outpatient Bridge</option>
            <option value="resolved_thrombus_recanalized">Resolved (Recanalized)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading SPT protocols...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching protocols found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Phenotype</th>
                  <th className="px-4 py-3">Vein Involved</th>
                  <th className="px-4 py-3">Peak Temp</th>
                  <th className="px-4 py-3">Heparin Response</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric_spt`}
                        className="text-blue-600 hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                          ep.spt_phenotype === 'ovarian_vein_thrombosis'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}
                      >
                        {ep.spt_phenotype.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{ep.affected_vein.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{ep.pelvic_ct_mri_findings.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-red-600">{ep.peak_temperature_celsius}°C</span>
                      <div className="text-xs text-slate-400">{ep.hours_refractory_triple_antibiotics}h on abx</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`font-semibold ${
                          ep.heparin_challenge_response === 'positive_defervescence_within_48_72h'
                            ? 'text-emerald-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {ep.heparin_challenge_response.replace(/_/g, ' ')}
                      </span>
                      {ep.defervescence_hours && <div className="text-slate-400">{ep.defervescence_hours}h to lysis</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric_spt`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Open Chart
                      </Link>
                      <Link
                        to={`/obstetric-spt/${ep.id}/print`}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:underline font-medium"
                        target="_blank"
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
