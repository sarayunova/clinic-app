import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMgso4Dashboard,
  getMgso4Protocols,
  type Mgso4ProtocolRecord,
} from '../api';
import { Mgso4ProtocolModal } from '../components/Mgso4ProtocolModal';
import { Mgso4HourlyFlowsheetModal } from '../components/Mgso4HourlyFlowsheetModal';

export const ObstetricHduPage: React.FC = () => {
  const [activeProtocols, setActiveProtocols] = useState<Mgso4ProtocolRecord[]>([]);
  const [allProtocols, setAllProtocols] = useState<Mgso4ProtocolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isInitiateOpen, setIsInitiateOpen] = useState(false);
  const [flowsheetModalData, setFlowsheetModalData] = useState<{
    protocolId: number;
    patientName: string;
    nextHour: number;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, listRes] = await Promise.all([
        getMgso4Dashboard(),
        getMgso4Protocols(),
      ]);
      setActiveProtocols(dashRes.activeProtocols);
      setAllProtocols(listRes.protocols);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Obstetric HDU dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🤰</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Obstetric High Dependency Unit (HDU) & Eclampsia Command Center
            </h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Real-time Magnesium Sulfate Resuscitation Surveillance, Bedside Triad Toxicity Checks, and Maternal Safety Bundles
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsInitiateOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow transition-colors flex items-center gap-2"
          >
            <span>⚡</span> Initiate MgSO₄ Protocol
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium border border-gray-300 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Infusions</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-rose-600">{activeProtocols.length}</span>
            <span className="text-xs text-rose-700 font-medium">HDU / Labour Ward</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Antidote Triggered</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-amber-600">
              {activeProtocols.filter((p) => p.antidote_calcium_gluconate_given === 1).length}
            </span>
            <span className="text-xs text-amber-700 font-medium">10% Calcium Gluconate</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Severe Range BP Cases</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-rose-700">
              {activeProtocols.filter((p) => p.indication === 'severe_preeclampsia_impending' || p.indication.includes('eclampsia')).length}
            </span>
            <span className="text-xs text-rose-800 font-medium">BP ≥ 160/110 Target</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Protocols Logged</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-gray-900">{allProtocols.length}</span>
            <span className="text-xs text-gray-500 font-medium">Cumulative Audits</span>
          </div>
        </div>
      </div>

      {/* Active Protocols Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Current Active Magnesium Sulfate Infusions</h2>
            <p className="text-xs text-gray-500">
              Strict hourly patellar reflex, respiratory rate (&ge;16 bpm), and urine output (&ge;30 mL/hr) monitoring
            </p>
          </div>
        </div>

        {activeProtocols.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <span className="text-3xl">🧘‍♀️</span>
            <p className="text-sm font-semibold text-gray-700 mt-2">
              No active MgSO₄ resuscitation protocols running in the Obstetric HDU at this moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProtocols.map((p) => (
              <div
                key={p.id}
                className="p-5 rounded-xl border-2 border-rose-300 bg-rose-50/40 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      to={`/patients/${p.patient_id}?tab=mgso4`}
                      className="text-base font-black text-rose-800 hover:underline"
                    >
                      {p.patient_name || `Patient #${p.patient_id}`}
                    </Link>
                    <div className="text-xs text-gray-500">
                      UHID: {p.patient_uhid} &bull; Code: {p.protocol_code}
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-rose-600 text-white">
                    {p.regimen_type === 'zuspan_iv' ? 'Zuspan IV' : p.regimen_type === 'pritchard_im' ? 'Pritchard IM' : 'Preterm Neuro'}
                  </span>
                </div>

                <div className="bg-white/80 p-3 rounded-lg border border-rose-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Indication:</span>
                    <span className="font-bold text-gray-800 capitalize">{p.indication.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Maintenance:</span>
                    <span className="font-semibold text-gray-800">{p.maintenance_rate_g_per_h} g/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Loading Dose:</span>
                    <span className="font-semibold text-gray-800">{p.loading_dose_details}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started At:</span>
                    <span className="text-gray-700">
                      {new Date(p.initiation_datetime).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() =>
                      setFlowsheetModalData({
                        protocolId: p.id,
                        patientName: p.patient_name || 'Patient',
                        nextHour: 1,
                      })
                    }
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow"
                  >
                    ⏱️ Log Hourly Check
                  </button>
                  <div className="flex gap-2">
                    <Link
                      to={`/mgso4/${p.id}/print`}
                      target="_blank"
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300"
                    >
                      🖨️ Print
                    </Link>
                    <Link
                      to={`/patients/${p.patient_id}?tab=mgso4`}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow"
                    >
                      Open Flowsheet →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Protocol Registry Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">All Resuscitation Protocols History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left divide-y divide-gray-200">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Regimen</th>
                <th className="py-2.5 px-3">Indication</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Started</th>
                <th className="py-2.5 px-3">Attending</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allProtocols.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No protocol records found.
                  </td>
                </tr>
              ) : (
                allProtocols.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <Link
                        to={`/patients/${p.patient_id}?tab=mgso4`}
                        className="font-bold text-blue-600 hover:underline"
                      >
                        {p.patient_name || `Patient #${p.patient_id}`}
                      </Link>
                      <div className="text-[11px] text-gray-500">UHID: {p.patient_uhid}</div>
                    </td>
                    <td className="py-3 px-3 uppercase font-semibold text-gray-800">
                      {p.regimen_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-3 text-gray-700 capitalize">
                      {p.indication.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        p.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {new Date(p.initiation_datetime).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {p.prescribed_by_name || 'Dr. Preeti Sharma'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/patients/${p.patient_id}?tab=mgso4`}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium border border-gray-300"
                      >
                        View Flowsheet →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isInitiateOpen && (
        <Mgso4ProtocolModal
          patientId={activeProtocols[0]?.patient_id || 1}
          patientName={activeProtocols[0]?.patient_name || 'Obstetric Inpatient'}
          onClose={() => setIsInitiateOpen(false)}
          onSuccess={() => {
            setIsInitiateOpen(false);
            fetchData();
          }}
        />
      )}

      {flowsheetModalData && (
        <Mgso4HourlyFlowsheetModal
          protocolId={flowsheetModalData.protocolId}
          patientName={flowsheetModalData.patientName}
          nextHourNumber={flowsheetModalData.nextHour}
          onClose={() => setFlowsheetModalData(null)}
          onSuccess={() => {
            setFlowsheetModalData(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
