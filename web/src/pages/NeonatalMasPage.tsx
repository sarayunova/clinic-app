import React, { useState, useEffect } from 'react';
import { getNeonatalMasEpisodes, type NeonatalMasRecord } from '../api';
import { NeonatalMasModal } from '../components/NeonatalMasModal';

interface Props {
  userRole?: string;
}

export const NeonatalMasPage: React.FC<Props> = ({ userRole }) => {
  const [episodes, setEpisodes] = useState<NeonatalMasRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalMasRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canManage = userRole === 'doctor' || userRole === 'nurse';

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalMasEpisodes(statusFilter ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Neonatal Meconium Aspiration Syndrome (MAS) Command Center
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
              Series 28A
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            AAP Neonatal Resuscitation Program &bull; Oxygenation Index (OI) &bull; iNO &bull; Surfactant Lavage &bull; HFOV
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="acute_respiratory_failure">Acute Respiratory Failure</option>
            <option value="hfov_ino_escalation">HFOV & iNO Escalation</option>
            <option value="weaning_recovering">Weaning & Recovering</option>
            <option value="resolved_extubated">Resolved & Extubated</option>
            <option value="ecmo_transferred">ECMO Transferred</option>
          </select>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Active MAS Protocols</span>
          <p className="text-2xl font-bold text-teal-600 mt-1">
            {episodes.filter((e) => e.status !== 'resolved_extubated').length}
          </p>
          <span className="text-xs text-gray-400">Under critical surveillance</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">iNO Escalations Active</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {episodes.filter((e) => e.inhaled_nitric_oxide_prescribed === 1).length}
          </p>
          <span className="text-xs text-gray-400">PPHN targeted vasodilatation</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Surfactant Delivered</span>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {episodes.filter((e) => e.surfactant_administered === 1).length}
          </p>
          <span className="text-xs text-gray-400">Endotracheal / Lavage</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Air Leak / Pneumothorax</span>
          <p className="text-2xl font-bold text-rose-600 mt-1">
            {episodes.filter((e) => e.pulmonary_air_leak_present === 1).length}
          </p>
          <span className="text-xs text-gray-400">Thoracostomy vigilance</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 font-bold text-gray-800 text-sm">
          Active Neonatal MAS Protocol Registry
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading episodes...</div>
        ) : episodes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No neonatal MAS episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Episode</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">GA / Weight</th>
                  <th className="py-3 px-4">Meconium Consistency</th>
                  <th className="py-3 px-4">Vent Mode</th>
                  <th className="py-3 px-4">FiO2 / MAP</th>
                  <th className="py-3 px-4">OI (Oxygenation Index)</th>
                  <th className="py-3 px-4">iNO</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-bold text-gray-900">{ep.episode_code}</td>
                    <td className="py-3 px-4">
                      <a
                        href={`/patients/${ep.patient_id}?tab=neonatal-mas`}
                        className="text-teal-700 font-semibold hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      {ep.gestational_age_weeks}w / {ep.current_weight_kg} kg
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {ep.amniotic_fluid_meconium_consistency.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {ep.respiratory_support_mode.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4">
                      {ep.fio2_percent}% / {ep.mean_airway_pressure_cmh2o} cmH2O
                    </td>
                    <td className="py-3 px-4">
                      {ep.oxygenation_index !== null ? (
                        <span
                          className={`font-bold ${
                            ep.oxygenation_index >= 40
                              ? 'text-rose-700'
                              : ep.oxygenation_index >= 25
                              ? 'text-purple-700'
                              : ep.oxygenation_index >= 15
                              ? 'text-amber-700'
                              : 'text-teal-700'
                          }`}
                        >
                          OI {ep.oxygenation_index}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ep.inhaled_nitric_oxide_prescribed === 1 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">
                          {ep.ino_dose_ppm} ppm
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          ep.status === 'acute_respiratory_failure'
                            ? 'bg-rose-100 text-rose-800'
                            : ep.status === 'hfov_ino_escalation'
                            ? 'bg-purple-100 text-purple-800'
                            : ep.status === 'weaning_recovering'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex gap-2">
                      <a
                        href={`/neonatal-mas/print?id=${ep.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-600 hover:text-gray-900 underline"
                      >
                        Print
                      </a>
                      {canManage && (
                        <button
                          onClick={() => {
                            setSelectedEpisode(ep);
                            setShowModal(true);
                          }}
                          className="text-teal-600 hover:text-teal-800 font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedEpisode && (
        <NeonatalMasModal
          patientId={selectedEpisode.patient_id}
          existingEpisode={selectedEpisode}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedEpisode(null);
          }}
          onSaved={loadEpisodes}
        />
      )}
    </div>
  );
};
