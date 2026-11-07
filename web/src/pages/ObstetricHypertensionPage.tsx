import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getObstetricHypertensiveCrises,
  updateObstetricHypertensiveCrisis,
  type ObstetricHypertensiveCrisisRecord,
} from '../api';

export const ObstetricHypertensionPage: React.FC = () => {
  const [crises, setCrises] = useState<ObstetricHypertensiveCrisisRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCrises = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getObstetricHypertensiveCrises({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setCrises(res.crises);
    } catch (err: any) {
      setError(err.message || 'Failed to load hypertensive crisis records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrises();
  }, [statusFilter]);

  const handleUpdateStatus = async (id: number, newStatus: any) => {
    try {
      await updateObstetricHypertensiveCrisis(id, { status: newStatus });
      fetchCrises();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 via-rose-700 to-purple-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
            <span>Labor & Delivery / Obstetric ICU Console</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Acute Obstetric Hypertensive Crisis & PPCM Registry
          </h1>
          <p className="text-rose-100 mt-2 max-w-2xl text-sm leading-relaxed">
            Time-critical emergent antihypertensive management (ACOG PB 222), rapid-acting IV titration surveillance, and Peripartum Cardiomyopathy BOARD protocol adherence monitoring.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[180px]">
          <span className="text-xs uppercase tracking-wider text-rose-200 font-bold block">
            Active Severe Crises
          </span>
          <span className="text-3xl font-black mt-1 block">
            {crises.filter((c) => c.status === 'active_crisis').length}
          </span>
          <span className="text-[11px] text-rose-100">Uncontrolled SBP &ge; 160 or DBP &ge; 110</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold border rounded-lg px-3 py-1.5 bg-gray-50 border-gray-300"
          >
            <option value="all">All Crises</option>
            <option value="active_crisis">Active Severe Crisis</option>
            <option value="controlled_surveillance">Controlled Surveillance</option>
            <option value="resolved">Resolved</option>
            <option value="icu_transferred">Transferred to ICU</option>
          </select>
        </div>

        <button
          onClick={fetchCrises}
          className="text-xs text-rose-700 hover:text-rose-900 font-bold flex items-center gap-1"
        >
          <span>🔄</span> Refresh Roster
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Crisis Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Loading crisis records...</div>
        ) : crises.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No hypertensive crises found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left divide-y divide-gray-200">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Crisis Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Initial BP (MAP)</th>
                  <th className="px-4 py-3">Latest Post-Dose BP</th>
                  <th className="px-4 py-3">Cumulative Medication</th>
                  <th className="px-4 py-3">PPCM Status</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {crises.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">
                      <div>{c.crisis_code}</div>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {new Date(c.crisis_datetime).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        to={`/patients/${c.patient_id}`}
                        className="font-bold text-rose-800 hover:underline"
                      >
                        {c.patient_name || `Patient #${c.patient_id}`}
                      </Link>
                      <div className="text-[10px] text-gray-400">{c.patient_uhid}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-rose-800">
                        {c.initial_sbp}/{c.initial_dbp}
                      </div>
                      <span className="text-gray-500 text-[10px]">{c.initial_map} mmHg MAP</span>
                    </td>

                    <td className="px-4 py-3">
                      {c.final_sbp && c.final_dbp ? (
                        <div>
                          <span
                            className={`font-bold ${
                              c.blood_pressure_controlled ? 'text-emerald-700' : 'text-rose-800'
                            }`}
                          >
                            {c.final_sbp}/{c.final_dbp}
                          </span>
                          <div className="text-[10px] text-gray-500">
                            {c.final_map} MAP ({c.blood_pressure_controlled ? 'Controlled' : 'Elevated'})
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Awaiting dose</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-[11px] space-y-0.5">
                        {c.cumulative_labetalol_mg > 0 && (
                          <span className="inline-block mr-1 px-1.5 py-0.5 bg-rose-100 text-rose-800 font-medium rounded text-[10px]">
                            Labetalol: {c.cumulative_labetalol_mg}mg
                          </span>
                        )}
                        {c.cumulative_hydralazine_mg > 0 && (
                          <span className="inline-block mr-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 font-medium rounded text-[10px]">
                            Hydral: {c.cumulative_hydralazine_mg}mg
                          </span>
                        )}
                        {c.cumulative_nifedipine_mg > 0 && (
                          <span className="inline-block mr-1 px-1.5 py-0.5 bg-purple-100 text-purple-800 font-medium rounded text-[10px]">
                            Nifed: {c.cumulative_nifedipine_mg}mg
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {c.ppcm_screen_positive ? (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 font-bold rounded text-[10px]">
                          BOARD Active {c.lvef_percent ? `(${c.lvef_percent}%)` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">Negative</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={c.status}
                        onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                        className={`text-xs font-bold rounded-lg px-2 py-1 border ${
                          c.status === 'active_crisis'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : c.status === 'controlled_surveillance'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        <option value="active_crisis">Active Crisis</option>
                        <option value="controlled_surveillance">Controlled</option>
                        <option value="resolved">Resolved</option>
                        <option value="icu_transferred">ICU Transferred</option>
                      </select>
                    </td>

                    <td className="px-4 py-3 text-right space-x-2">
                      <a
                        href={`/patients/${c.patient_id}/obstetric-hypertension/${c.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-[11px]"
                      >
                        🖨️ Dossier
                      </a>
                      <Link
                        to={`/patients/${c.patient_id}`}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-[11px]"
                      >
                        Open Chart
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
