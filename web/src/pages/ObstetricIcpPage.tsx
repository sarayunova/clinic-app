import React, { useState, useEffect } from 'react';
import { getObstetricIcpEpisodes, ObstetricIcpRecord } from '../api';
import { ObstetricIcpModal } from '../components/ObstetricIcpModal';

export const ObstetricIcpPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricIcpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricIcpEpisodes({ status: statusFilter || undefined });
      setEpisodes(res.episodes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🩺</span>
            <h1 className="text-2xl font-black tracking-tight">
              Obstetric Cholestasis (ICP) Department Console
            </h1>
          </div>
          <p className="text-xs text-teal-100 max-w-2xl">
            Total Serum Bile Acids (TSBA) Risk Stratification, Stillbirth Risk Reduction, Ursodeoxycholic Acid (UDCA) Stewardship, and Fetal Delivery Scheduling (SMFM 2021 / RCOG 43 / ACOG 2021).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-white text-teal-900 hover:bg-teal-50 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
          >
            <span>+</span> New ICP Assessment
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-600 uppercase">Filter by Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value="">All Statuses ({episodes.length})</option>
            <option value="active_surveillance">Active Outpatient Surveillance</option>
            <option value="medication_titration">Medication Titration</option>
            <option value="planned_induction">Planned Induction Scheduled</option>
            <option value="delivered">Delivered / Postpartum</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
          <div>
            Severe ICP (&ge;100 umol/L):{' '}
            <strong className="text-red-700">
              {episodes.filter((e) => e.icp_severity_tier === 'severe_ge_100' || e.peak_tsba_umol_l >= 100).length}
            </strong>
          </div>
          <div>
            Moderate ICP (40-99 umol/L):{' '}
            <strong className="text-amber-700">
              {episodes.filter((e) => e.icp_severity_tier === 'moderate_40_99').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading ICP episodes...</div>
        ) : episodes.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            No obstetric cholestasis (ICP) records found matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-700 border-b font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Episode Code</th>
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">GA at Dx</th>
                  <th className="py-3 px-4">Peak TSBA</th>
                  <th className="py-3 px-4">Severity Tier</th>
                  <th className="py-3 px-4">UDCA Dose</th>
                  <th className="py-3 px-4">Planned Delivery</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-teal-50/40 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {ep.episode_code}
                      <span className="block text-[10px] text-gray-400 font-normal">
                        {new Date(ep.diagnosis_datetime).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-700">
                      <a href={`/patients/${ep.patient_id}`} className="text-teal-700 hover:underline">
                        Patient #{ep.patient_id}
                      </a>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-800">
                      {ep.gestation_weeks} weeks
                    </td>
                    <td className="py-3 px-4 font-bold text-teal-950">
                      {ep.peak_tsba_umol_l} umol/L
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-extrabold uppercase ${
                          ep.icp_severity_tier === 'severe_ge_100'
                            ? 'bg-red-100 text-red-800'
                            : ep.icp_severity_tier === 'moderate_40_99'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.icp_severity_tier.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-700">
                      {ep.udca_dose_mg_day} mg/d
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {ep.planned_delivery_weeks} weeks
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          ep.status === 'delivered'
                            ? 'bg-purple-100 text-purple-800'
                            : ep.status === 'planned_induction'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <a
                          href={`/patients/${ep.patient_id}?tab=obstetric_icp`}
                          className="text-teal-700 hover:text-teal-900 font-bold hover:underline"
                        >
                          Chart
                        </a>
                        <a
                          href={`/obstetric-icp/${ep.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-500 hover:text-gray-800"
                          title="Print Dossier"
                        >
                          🖨️
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ObstetricIcpModal
          patientId={1}
          onClose={() => setShowModal(false)}
          onSuccess={() => fetchEpisodes()}
        />
      )}
    </div>
  );
};
