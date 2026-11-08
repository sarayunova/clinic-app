import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricDkaCerebralEdemaEpisodes, type PediatricDkaCerebralEdemaRecord } from '../api';

export const PediatricDkaCerebralEdemaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricDkaCerebralEdemaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricDkaCerebralEdemaEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load DKA CE episodes:', err);
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

  const criticalCeCount = episodes.filter(e => e.muir_criteria_category === 'diagnostic_cerebral_edema').length;
  const warningCount = episodes.filter(e => e.muir_criteria_category === 'impending_warning_signs').length;
  const hypertonicInfusingCount = episodes.filter(e => e.status === 'hypertonic_saline_infusing' || e.status === 'emergent_hyperosmolar_rescue').length;
  const recoveredCount = episodes.filter(e => e.status === 'neurological_recovery_gcs15').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧠</span> Pediatric DKA Cerebral Edema & Hyperosmolar Rescue Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ISPAD & Muir Diagnostic Criteria Protocol: Corrected Sodium Surveillance, 3% NaCl / Mannitol Stat Administration & PICU Neuroprotection
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 shadow-sm">
          <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">Diagnostic Cerebral Edema</div>
          <div className="text-2xl font-black text-rose-900 mt-1">{criticalCeCount}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">ISPAD / Muir Criteria Met</div>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 shadow-sm">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">Impending Signs</div>
          <div className="text-2xl font-black text-amber-900 mt-1">{warningCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Frequent neuro checks & fluid cut</div>
        </div>

        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/70 shadow-sm">
          <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">Hyperosmolar Active</div>
          <div className="text-2xl font-black text-purple-900 mt-1">{hypertonicInfusingCount}</div>
          <div className="text-[11px] text-purple-600 mt-0.5">3% Saline / Mannitol Running</div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 shadow-sm">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Recovered (GCS 15)</div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{recoveredCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Resolved without herniation</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-gray-500 whitespace-nowrap">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1 text-xs bg-gray-50"
          >
            <option value="all">All Statuses</option>
            <option value="emergent_hyperosmolar_rescue">Emergent Rescue</option>
            <option value="hypertonic_saline_infusing">Saline / Mannitol Infusing</option>
            <option value="picu_neuro_monitoring">PICU Monitoring</option>
            <option value="neurological_recovery_gcs15">Recovered GCS 15</option>
            <option value="brainstem_herniation_critical">Brainstem Herniation</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full mb-2"></div>
            <p className="text-xs">Loading DKA cerebral edema episodes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            No cerebral edema protocol records match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                <tr>
                  <th className="py-2.5 px-4">Episode Code</th>
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Age / Weight</th>
                  <th className="py-2.5 px-4">GCS / Pupils</th>
                  <th className="py-2.5 px-4">Glucose / Na+ Corr</th>
                  <th className="py-2.5 px-4">Muir Category</th>
                  <th className="py-2.5 px-4">Rescue Dose</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-800">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-rose-900">
                      {ep.episode_code}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-900">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline text-indigo-600">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4">
                      {ep.age_years}y &middot; {ep.weight_kg} kg
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-bold text-rose-700">{ep.gcs_score}/15</span> &middot; {ep.pupillary_abnormality.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4">
                      {ep.blood_glucose_mg_dl} mg/dL &middot; Na+ {ep.serum_sodium_corrected_meq_l}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          ep.muir_criteria_category === 'diagnostic_cerebral_edema'
                            ? 'bg-rose-600 text-white'
                            : ep.muir_criteria_category === 'impending_warning_signs'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.muir_criteria_category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-rose-700">
                      {ep.hyperosmolar_dose_ml} mL
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric_dka_ce`}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold"
                      >
                        Open Chart
                      </Link>
                      <a
                        href={`#/print/pediatric-dka-ce/${ep.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-medium"
                      >
                        🖨️ Dossier
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
