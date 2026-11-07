import React, { useState, useEffect } from 'react';
import { getNeonatalBindEpisodes, NeonatalBindAabrRecord } from '../api';
import { NeonatalBindAabrModal } from '../components/NeonatalBindAabrModal';

export const NeonatalBindAabrPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalBindAabrRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalBindEpisodes({ status: statusFilter || undefined });
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🧠</span>
            <h1 className="text-2xl font-black tracking-tight">
              Neonatal BIND & AABR Neuro-Auditory Console
            </h1>
          </div>
          <p className="text-xs text-amber-100 max-w-2xl">
            Surveillance of Acute Bilirubin Encephalopathy (BIND 0-9), Bilirubin/Albumin Ratios, Automated Auditory Brainstem Response (AABR), and Kernicterus Prevention (AAP 2022 / NICE CG98 / JCIH 2019).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-white text-amber-800 hover:bg-amber-50 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
          >
            <span>+</span> New BIND Assessment
          </button>
        </div>
      </div>

      {/* Filter and Metrics Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-600 uppercase">Filter by Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value="">All Active & Historical ({episodes.length})</option>
            <option value="under_phototherapy">Under Intensive Phototherapy</option>
            <option value="post_exchange_transfusion">Post-Exchange Transfusion</option>
            <option value="high_risk_neuro_followup">High-Risk Neuro Follow-Up</option>
            <option value="cleared_pass">Cleared / AABR Pass</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
          <div>
            Severe ABE / Risk:{' '}
            <strong className="text-red-700">
              {episodes.filter((e) => e.total_bind_score >= 4 || e.bind_severity === 'severe_abe').length}
            </strong>
          </div>
          <div>
            AABR Referrals:{' '}
            <strong className="text-amber-700">
              {episodes.filter((e) => e.aabr_right_ear === 'refer' || e.aabr_left_ear === 'refer').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading BIND assessments...</div>
        ) : episodes.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            No neonatal BIND & AABR records found matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-700 border-b font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Episode Code</th>
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Peak TSB</th>
                  <th className="py-3 px-4">B/A Ratio</th>
                  <th className="py-3 px-4">BIND Score</th>
                  <th className="py-3 px-4">AABR Hearing</th>
                  <th className="py-3 px-4">Interventions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-amber-50/40 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {ep.episode_code}
                      <span className="block text-[10px] text-gray-400 font-normal">
                        {new Date(ep.assessment_datetime).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-700">
                      <a href={`/patients/${ep.patient_id}`} className="text-amber-700 hover:underline">
                        Patient #{ep.patient_id}
                      </a>
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-950">
                      {ep.peak_tsb_mg_dl} mg/dL
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-700">
                      {ep.calculated_b_a_ratio ? `${ep.calculated_b_a_ratio} mg/g` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-extrabold ${
                          ep.total_bind_score >= 7
                            ? 'bg-red-100 text-red-800'
                            : ep.total_bind_score >= 4
                            ? 'bg-amber-100 text-amber-800'
                            : ep.total_bind_score >= 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.total_bind_score}/9 ({ep.bind_severity.replace(/_/g, ' ')})
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          ep.aabr_right_ear === 'refer' || ep.aabr_left_ear === 'refer'
                            ? 'text-red-700 font-bold'
                            : ep.aabr_right_ear === 'pass' && ep.aabr_left_ear === 'pass'
                            ? 'text-emerald-700 font-bold'
                            : 'text-gray-500'
                        }`}
                      >
                        R:{ep.aabr_right_ear.toUpperCase()} | L:{ep.aabr_left_ear.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {ep.exchange_transfusion_performed === 1 && (
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded mr-1">
                          DVET
                        </span>
                      )}
                      {ep.ivig_given === 1 && (
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          IVIG
                        </span>
                      )}
                      {ep.exchange_transfusion_performed === 0 && ep.ivig_given === 0 && (
                        <span>Phototherapy</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          ep.status === 'cleared_pass'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ep.status === 'post_exchange_transfusion'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <a
                          href={`/patients/${ep.patient_id}?tab=neonatal_bind`}
                          className="text-amber-700 hover:text-amber-900 font-bold hover:underline"
                        >
                          Chart
                        </a>
                        <a
                          href={`/neonatal-bind-aabr/${ep.id}/print`}
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
        <NeonatalBindAabrModal
          patientId={1}
          onClose={() => setShowModal(false)}
          onSuccess={() => fetchEpisodes()}
        />
      )}
    </div>
  );
};
