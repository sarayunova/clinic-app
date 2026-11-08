import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricGbsEpisodes, type PediatricGbsRecord } from '../api';

export const PediatricGbsPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricGbsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricGbsEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load pediatric GBS episodes:', err);
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
  const respiratoryRiskCount = episodes.filter(
    (e) => e.vital_capacity_ml_kg < 20 || e.negative_inspiratory_force_cmh2o > -30 || e.peak_expiratory_pressure_cmh2o < 40
  ).length;
  const severeHughesCount = episodes.filter((e) => e.hughes_disability_score >= 4).length;
  const ivigActiveCount = episodes.filter((e) => e.status === 'immunotherapy_infusion_active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧠</span> Pediatric Guillain-Barré Syndrome (GBS) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Brighton Criteria Levels 1–4 • 20/30/40 Rule (Impending Respiratory Failure) • Hughes Score • IVIG 2 g/kg
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total GBS Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active pediatric protocols</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            20/30/40 Failure Risk
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{respiratoryRiskCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Impending respiratory arrest</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Severe Disability (Hughes ≥4)
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{severeHughesCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Bedbound or ventilated</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Active IVIG Infusion
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{ivigActiveCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total 2 g/kg regimen</div>
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
            <option value="acute_diagnostic_evaluation">Acute Diagnostic Evaluation</option>
            <option value="picu_ventilatory_support">PICU Ventilatory Support</option>
            <option value="immunotherapy_infusion_active">Immunotherapy Active</option>
            <option value="dysautonomia_telemetry_monitoring">Dysautonomia Monitoring</option>
            <option value="subacute_rehabilitation_weaning">Subacute Rehab</option>
            <option value="resolved_full_motor_recovery">Resolved Motor Recovery</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading pediatric GBS cohort...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No pediatric GBS episodes found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-750 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Age / Weight</th>
                  <th className="p-3">Brighton / Hughes</th>
                  <th className="p-3">20/30/40 Rule</th>
                  <th className="p-3">CSF Protein</th>
                  <th className="p-3">Immunotherapy</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((ep) => {
                  const rulePositive =
                    ep.vital_capacity_ml_kg < 20 ||
                    ep.negative_inspiratory_force_cmh2o > -30 ||
                    ep.peak_expiratory_pressure_cmh2o < 40;
                  return (
                    <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {ep.episode_code}
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=pediatric_gbs`}
                          className="font-semibold text-slate-900 dark:text-white hover:underline"
                        >
                          {ep.patient_name || `Patient #${ep.patient_id}`}
                        </Link>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div>{ep.age_years} yrs • <span className="font-bold">{ep.weight_kg}kg</span></div>
                        <div className="text-[10px] text-slate-400 capitalize">{ep.antecedent_infection_type.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold capitalize">{ep.brighton_criteria_level.split('_').slice(0, 2).join(' ')}</div>
                        <div className="text-[10px] font-bold text-amber-600">Hughes Score {ep.hughes_disability_score}</div>
                      </td>
                      <td className="p-3">
                        {rulePositive ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                            Breached (VC {ep.vital_capacity_ml_kg})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                            Stable Mechanics
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold">{ep.csf_protein_mg_dl} mg/dL</span>
                        <div className="text-[10px] text-slate-400">WBCs: {ep.csf_wbc_count_per_ul}/µL</div>
                      </td>
                      <td className="p-3 capitalize text-slate-700 dark:text-slate-300">
                        {ep.immunotherapy_regimen.replace(/_/g, ' ')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 capitalize">
                          {ep.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap space-x-2">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=pediatric_gbs`}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
                        >
                          Manage
                        </Link>
                        <a
                          href={`/pediatric-gbs/print/${ep.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
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
