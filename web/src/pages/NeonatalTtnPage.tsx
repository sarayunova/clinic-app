import React, { useState, useEffect } from 'react';
import { getNeonatalTtnEpisodes, type NeonatalTtnRecord } from '../api';
import { NeonatalTtnModal } from '../components/NeonatalTtnModal';

interface Props {
  userRole?: string;
}

export const NeonatalTtnPage: React.FC<Props> = ({ userRole }) => {
  const [episodes, setEpisodes] = useState<NeonatalTtnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalTtnRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canManage = userRole === 'doctor' || userRole === 'nurse';

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalTtnEpisodes();
      if (statusFilter) {
        setEpisodes(res.episodes.filter(e => e.status === statusFilter));
      } else {
        setEpisodes(res.episodes);
      }
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
              Neonatal Transient Tachypnea of the Newborn (TTN) Console
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
              Series 29A
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Silverman-Anderson Retraction Score &bull; Delayed Lung Fluid Resorption &bull; Bubble CPAP &bull; Feeding Stewardship
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="active_monitoring">Active Monitoring</option>
            <option value="weaning_support">Weaning Support</option>
            <option value="resolved_discharged">Resolved / Discharged</option>
            <option value="escalated_to_rds_surfactant">Escalated to RDS / Surfactant</option>
            <option value="escalated_to_pphn">Escalated to PPHN</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-800">
            Active & Historical TTN Patient Records ({episodes.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading TTN records...</div>
        ) : episodes.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No TTN episodes matching current filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100/70 text-gray-600 border-b">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">GA (Wks) / Wt (kg)</th>
                  <th className="p-3">Delivery Mode</th>
                  <th className="p-3">Initial RR</th>
                  <th className="p-3">Silverman Score</th>
                  <th className="p-3">Initial Support</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-sky-900">{ep.episode_code}</td>
                    <td className="p-3">
                      <a href={`/patients/${ep.patient_id}`} className="font-semibold text-blue-600 hover:underline">
                        {ep.patient_name || 'Patient'}
                      </a>
                    </td>
                    <td className="p-3">{ep.gestational_age_weeks}w / {ep.birth_weight_kg}kg</td>
                    <td className="p-3">{ep.delivery_mode.replace(/_/g, ' ')}</td>
                    <td className="p-3 font-semibold">{ep.initial_respiratory_rate} bpm</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        ep.silverman_anderson_score >= 7 ? 'bg-red-100 text-red-800' :
                        ep.silverman_anderson_score >= 4 ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {ep.silverman_anderson_score} / 10
                      </span>
                    </td>
                    <td className="p-3">{ep.respiratory_support_initial.replace(/_/g, ' ')} ({ep.initial_fio2_percent}%)</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 space-x-2">
                      <a
                        href={`/patients/${ep.patient_id}`}
                        className="text-sky-600 hover:underline font-semibold"
                      >
                        Chart
                      </a>
                      <a
                        href={`/patients/${ep.patient_id}/neonatal-ttn/${ep.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-500 hover:text-gray-800"
                      >
                        Print
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
