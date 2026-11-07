import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPediatricDkaEpisodes,
  updatePediatricDkaStatus,
  type PediatricDkaRecord,
} from '../api';

export const PediatricDkaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricDkaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricDkaEpisodes({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric DKA roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  const handleStatusUpdate = async (
    id: number,
    status: 'active_resuscitation' | 'ketoacidosis_resolved_subcutaneous_bridged' | 'completed' | 'discontinued'
  ) => {
    try {
      await updatePediatricDkaStatus(id, status);
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const totalCount = episodes.length;
  const activeCount = episodes.filter(e => e.status === 'active_resuscitation').length;
  const severeCount = episodes.filter(e => e.dka_severity === 'severe_ph_lt_7_10').length;
  const bridgedCount = episodes.filter(e => e.status === 'ketoacidosis_resolved_subcutaneous_bridged').length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>🧸</span> Pediatric DKA &amp; Two-Bag Resuscitation Console
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            ISPAD Guidelines · 48-Hour Fluid Deficit Rehydration · Two-Bag Titratable Dextrose · Cerebral Edema Surveillance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/patients"
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow transition"
          >
            + Initiate via Patient Chart
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Pediatric DKA episodes</div>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Active Two-Bag Protocol</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{activeCount}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Continuous IV titration</div>
        </div>
        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-sm">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Severe DKA (pH &lt; 7.10)</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{severeCount}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">High cerebral edema risk</div>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Resolved / Bridged SC</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{bridgedCount}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Subcutaneous insulin active</div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Filter Status:</label>
            <select
              className="border rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-50"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Episodes</option>
              <option value="active_resuscitation">Active Resuscitation</option>
              <option value="ketoacidosis_resolved_subcutaneous_bridged">Bridged to SC Insulin</option>
              <option value="completed">Completed</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
          <span className="text-xs text-slate-500">
            Showing {episodes.length} episode records
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading DKA roster...</div>
        ) : episodes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No pediatric DKA episodes found for selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b font-bold">
                  <th className="p-3">Episode #</th>
                  <th className="p-3">Child / UHID</th>
                  <th className="p-3">Weight</th>
                  <th className="p-3">Initial BG</th>
                  <th className="p-3">pH / HCO3</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">48h Fluid Rate</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800">
                {episodes.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-amber-800">
                      {e.episode_code || `#${e.id}`}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/patients/${e.patient_id}`}
                        className="font-bold text-slate-900 hover:text-amber-700 hover:underline"
                      >
                        {e.patient_name || `Patient #${e.patient_id}`}
                      </Link>
                      <div className="text-[10px] text-slate-500">
                        UHID: {e.patient_uhid || '—'}
                      </div>
                    </td>
                    <td className="p-3 font-semibold">{e.child_weight_kg} kg</td>
                    <td className="p-3 font-black text-rose-700">
                      {e.initial_blood_glucose_mg_dl} mg/dL
                    </td>
                    <td className="p-3 font-bold">
                      pH {e.venous_ph} / {e.serum_bicarbonate_mmol_l}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                          e.dka_severity === 'severe_ph_lt_7_10'
                            ? 'bg-red-100 text-red-900'
                            : e.dka_severity === 'moderate_ph_7_10_7_19'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {e.dka_severity?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-indigo-700">
                      {e.rehydration_rate_ml_hr} mL/hr
                    </td>
                    <td className="p-3">
                      <select
                        className="border rounded px-2 py-1 text-xs font-semibold bg-white"
                        value={e.status}
                        onChange={(evt) => handleStatusUpdate(e.id, evt.target.value as any)}
                      >
                        <option value="active_resuscitation">Active Resuscitation</option>
                        <option value="ketoacidosis_resolved_subcutaneous_bridged">Bridged to SC</option>
                        <option value="completed">Completed</option>
                        <option value="discontinued">Discontinued</option>
                      </select>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/patients/${e.patient_id}`}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded text-xs transition"
                      >
                        Chart Tab
                      </Link>
                      <Link
                        to={`/pediatric-dka/${e.id}/print`}
                        target="_blank"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition"
                      >
                        🖨️ Dossier
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
