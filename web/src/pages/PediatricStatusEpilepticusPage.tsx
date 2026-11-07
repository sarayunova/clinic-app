import React, { useState, useEffect } from 'react';
import { getPediatricStatusEpilepticusEpisodes, PediatricStatusEpilepticusRecord } from '../api';
import { PediatricStatusEpilepticusModal } from '../components/PediatricStatusEpilepticusModal';

export const PediatricStatusEpilepticusPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricStatusEpilepticusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricStatusEpilepticusEpisodes({ status: statusFilter || undefined });
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-red-800 via-red-700 to-rose-700 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">⚡</span>
            <h1 className="text-2xl font-black tracking-tight">
              Pediatric Status Epilepticus Emergency Resuscitation Console
            </h1>
          </div>
          <p className="text-xs text-red-100 max-w-2xl">
            Rapid Stepwise Anticonvulsant Algorithm: Emergent Benzodiazepine &rarr; Non-Sedating Second-Line AED &rarr; PICU Refractory Infusions (AES 2016 / PALS 2025 / ESETT).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-white text-red-900 hover:bg-red-50 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
          >
            <span>+</span> New Seizure Resuscitation
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-600 uppercase">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value="">All Resuscitations ({episodes.length})</option>
            <option value="active_seizure">Active Seizures (Ongoing)</option>
            <option value="refractory_status">Refractory Status (Phase 3)</option>
            <option value="seizure_abated_post_ictal">Seizure Abated / Post-Ictal</option>
            <option value="picu_neuro_monitoring">PICU Continuous EEG Monitoring</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
          <div>
            Active Seizures:{' '}
            <strong className="text-red-700">
              {episodes.filter((e) => e.status === 'active_seizure' || e.status === 'refractory_status').length}
            </strong>
          </div>
          <div>
            Refractory Status (Phase 3):{' '}
            <strong className="text-purple-700">
              {episodes.filter((e) => e.phase3_refractory_status === 1 || e.status === 'refractory_status').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading seizure resuscitation records...</div>
        ) : episodes.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            No pediatric status epilepticus episodes found matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-700 border-b font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Episode Code</th>
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Age / Weight</th>
                  <th className="py-3 px-4">Etiology</th>
                  <th className="py-3 px-4">Phase 1 Benzo</th>
                  <th className="py-3 px-4">Phase 2 AED</th>
                  <th className="py-3 px-4">Phase 3 Infusion</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-red-50/40 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {ep.episode_code}
                      <span className="block text-[10px] text-gray-400 font-normal">
                        {new Date(ep.seizure_onset_datetime).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-700">
                      <a href={`/patients/${ep.patient_id}`} className="text-red-700 hover:underline">
                        Patient #{ep.patient_id}
                      </a>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-800">
                      {ep.age_months}m / {ep.weight_kg} kg
                    </td>
                    <td className="py-3 px-4 capitalize text-gray-700">
                      {ep.etiology.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-bold text-red-900">
                      {ep.phase1_benzo_agent ? `${ep.phase1_benzo_dose_mg} mg` : 'None'}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-900">
                      {ep.phase2_agent ? `${ep.phase2_dose_mg} mg` : 'None'}
                    </td>
                    <td className="py-3 px-4 text-purple-900 font-medium">
                      {ep.phase3_infusion_agent ? `${ep.phase3_infusion_agent.replace(/_/g, ' ')}` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          ep.status === 'active_seizure'
                            ? 'bg-red-100 text-red-800 animate-pulse'
                            : ep.status === 'refractory_status'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <a
                          href={`/patients/${ep.patient_id}?tab=pediatric_status_epilepticus`}
                          className="text-red-700 hover:text-red-900 font-bold hover:underline"
                        >
                          Chart
                        </a>
                        <a
                          href={`/pediatric-status-epilepticus/${ep.id}/print`}
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
        <PediatricStatusEpilepticusModal
          patientId={1}
          onClose={() => setShowModal(false)}
          onSuccess={() => fetchEpisodes()}
        />
      )}
    </div>
  );
};
