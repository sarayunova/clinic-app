import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getNicuTpnPrescriptions,
  updateNicuTpnPrescriptionStatus,
  type NicuTpnPrescriptionRecord,
} from '../api';

export const NicuTpnPage: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<NicuTpnPrescriptionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNicuTpnPrescriptions({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setPrescriptions(res.prescriptions);
    } catch (err: any) {
      setError(err?.message || 'Failed to load NICU TPN prescriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [statusFilter]);

  const handleStatusUpdate = async (
    id: number,
    status: 'active' | 'compounded' | 'discontinued' | 'completed'
  ) => {
    try {
      await updateNicuTpnPrescriptionStatus(id, status);
      fetchPrescriptions();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const totalCount = prescriptions.length;
  const activeCount = prescriptions.filter(p => p.status === 'active').length;
  const centralCount = prescriptions.filter(p => p.route_category === 'central_line_uvc_picc').length;
  const compoundedCount = prescriptions.filter(p => p.status === 'compounded').length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>🧪</span> NICU Level-3 Total Parenteral Nutrition (TPN) Console
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Precision Neonatal Compounding (ESPGHAN), GIR Regulation, Osmolarity Safety, & Pharmacy Verification
          </p>
        </div>
        <button
          onClick={fetchPrescriptions}
          disabled={loading}
          className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
        >
          <span>🔄</span> {loading ? 'Refreshing...' : 'Refresh Console'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Active TPN Orders</span>
          <span className="text-2xl font-black text-blue-700 mt-1 block">{activeCount}</span>
          <span className="text-[11px] text-slate-400">Total in view: {totalCount}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">Central Line Mandated</span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">{centralCount}</span>
          <span className="text-[11px] text-slate-400">Osmolarity &gt; 900 mOsm/L</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Pharmacy Verified</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">{compoundedCount}</span>
          <span className="text-[11px] text-slate-400">Compounded & primed</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">Clinical Protocol</span>
          <span className="text-sm font-bold text-indigo-900 mt-1 block">ESPGHAN / NNF</span>
          <span className="text-[11px] text-slate-400">VLBW / ELBW TPN standard</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Filter Status:</span>
          {['all', 'active', 'compounded', 'discontinued', 'completed'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-full font-medium transition capitalize ${
                statusFilter === st
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <span className="text-slate-500 font-medium">Showing {prescriptions.length} orders</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading TPN orders...</div>
        ) : prescriptions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No TPN compounding prescriptions found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Order Code</th>
                  <th className="py-3 px-4">Patient (Baby)</th>
                  <th className="py-3 px-4">DOL / Wt</th>
                  <th className="py-3 px-4">Fluid & GIR</th>
                  <th className="py-3 px-4">AA & Lipids</th>
                  <th className="py-3 px-4">Osmolarity & Line</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prescriptions.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-900">
                      <Link to={`/patients/${p.patient_id}?tab=nicu_tpn`} className="hover:underline">
                        {p.prescription_code}
                      </Link>
                      <span className="block text-[10px] font-normal text-slate-400 font-sans mt-0.5">
                        {p.prescription_date}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <Link to={`/patients/${p.patient_id}`} className="font-semibold text-slate-900 hover:underline">
                        {p.patient_name}
                      </Link>
                      <span className="block text-[11px] text-slate-500 font-mono">
                        UHID: {p.patient_uhid}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-slate-800 font-medium">DOL {p.day_of_life}</span>
                      <span className="block text-[11px] text-slate-500">{p.current_weight_kg} kg</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">
                        {p.parenteral_fluid_ml_day} mL/d
                      </div>
                      <span className="text-[11px] text-indigo-700 font-bold block">
                        GIR: {p.glucose_infusion_rate_gir} mg/kg/min
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-amber-800 font-medium">
                        AA: {p.amino_acid_g_per_kg_day} g/kg ({p.amino_acid_volume_ml} mL)
                      </div>
                      <div className="text-emerald-800 text-[11px] font-medium">
                        Lipid: {p.lipid_g_per_kg_day} g/kg ({p.lipid_volume_ml} mL)
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className={`font-bold ${p.total_osmolarity_mosm_l > 900 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {p.total_osmolarity_mosm_l} mOsm/L
                      </div>
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                          p.route_category === 'central_line_uvc_picc'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.route_category === 'central_line_uvc_picc' ? 'Central Required' : 'Peripheral Safe'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                          p.status === 'active'
                            ? 'bg-blue-100 text-blue-800'
                            : p.status === 'compounded'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.verified_by_name && (
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Verified by {p.verified_by_name}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <a
                        href={`/nicu-tpn/${p.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium border border-slate-300"
                        title="Print Compounding Order Sheet"
                      >
                        🖨️ Order
                      </a>
                      {p.status === 'active' && (
                        <button
                          onClick={() => handleStatusUpdate(p.id, 'compounded')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow"
                          title="Verify as compounding pharmacist"
                        >
                          ✓ Compound
                        </button>
                      )}
                      <Link
                        to={`/patients/${p.patient_id}?tab=nicu_tpn`}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold border border-blue-200"
                      >
                        Chart ➜
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
