import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMgso4Protocols,
  getMgso4Protocol,
  updateMgso4ProtocolStatus,
  triggerMgso4Antidote,
  type Mgso4ProtocolRecord,
  type Mgso4FlowsheetRecord,
} from '../api';
import { evaluateMgso4Safety } from '../mgso4Engine';
import { Mgso4ProtocolModal } from './Mgso4ProtocolModal';
import { Mgso4HourlyFlowsheetModal } from './Mgso4HourlyFlowsheetModal';

interface Mgso4ResuscitationTabProps {
  patientId: number;
  patientName: string;
}

export const Mgso4ResuscitationTab: React.FC<Mgso4ResuscitationTabProps> = ({
  patientId,
  patientName,
}) => {
  const [protocols, setProtocols] = useState<Mgso4ProtocolRecord[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<{
    protocol: Mgso4ProtocolRecord;
    flowsheet: Mgso4FlowsheetRecord[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isInitiateOpen, setIsInitiateOpen] = useState(false);
  const [isFlowsheetOpen, setIsFlowsheetOpen] = useState(false);
  const [isAntidoteConfirmOpen, setIsAntidoteConfirmOpen] = useState(false);
  const [antidoteReason, setAntidoteReason] = useState('Loss of patellar reflexes / respiratory depression');
  const [antidoteSubmitting, setAntidoteSubmitting] = useState(false);

  const [isTerminateOpen, setIsTerminateOpen] = useState(false);
  const [terminateStatus, setTerminateStatus] = useState<'completed_24h' | 'held_toxicity' | 'aborted'>('completed_24h');
  const [terminateReason, setTerminateReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMgso4Protocols({ patientId });
      setProtocols(res.protocols);
      if (res.protocols.length > 0) {
        const active = res.protocols.find((p) => p.status === 'active') || res.protocols[0]!;
        const detail = await getMgso4Protocol(active.id);
        setSelectedProtocol(detail);
      } else {
        setSelectedProtocol(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load MgSO4 resuscitation records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleSelectProtocol = async (id: number) => {
    try {
      const detail = await getMgso4Protocol(id);
      setSelectedProtocol(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load protocol details');
    }
  };

  const handleTriggerAntidote = async () => {
    if (!selectedProtocol) return;
    setAntidoteSubmitting(true);
    try {
      await triggerMgso4Antidote(selectedProtocol.protocol.id, {
        antidoteIndication: antidoteReason,
      });
      setIsAntidoteConfirmOpen(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record antidote administration');
    } finally {
      setAntidoteSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedProtocol) return;
    try {
      await updateMgso4ProtocolStatus(selectedProtocol.protocol.id, {
        status: terminateStatus,
        terminationReason: terminateReason || undefined,
      });
      setIsTerminateOpen(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update protocol status');
    }
  };

  const latestFlowsheet = selectedProtocol?.flowsheet?.[selectedProtocol.flowsheet.length - 1] || null;
  const nextHourNumber = latestFlowsheet ? latestFlowsheet.hour_number + 1 : 1;

  const currentSafety = latestFlowsheet
    ? evaluateMgso4Safety({
        patellarReflex: latestFlowsheet.patellar_reflex as any,
        respiratoryRateBpm: latestFlowsheet.respiratory_rate_bpm,
        urineOutputLastHourMl: latestFlowsheet.urine_output_last_hour_ml,
        serumMagnesiumMgDl: latestFlowsheet.serum_magnesium_mg_dl || undefined,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>⚡</span> Severe Pre-Eclampsia / Eclampsia MgSO₄ Resuscitation Flowsheet
          </h2>
          <p className="text-xs text-gray-500">
            Zuspan IV & Pritchard IM Regimens, Mandatory Hourly Triad Checks (Reflex, RR, Urine Output), Bedside 10% Calcium Gluconate Antidote
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedProtocol?.protocol.status === 'active' && (
            <>
              <button
                onClick={() => setIsFlowsheetOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
              >
                <span>⏱️</span> Log Hour {nextHourNumber} Check
              </button>
              <button
                onClick={() => setIsAntidoteConfirmOpen(true)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow animate-pulse flex items-center gap-1.5"
              >
                <span>🚨</span> Push 10% Calcium Gluconate Antidote
              </button>
              <button
                onClick={() => setIsTerminateOpen(true)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold shadow"
              >
                ⏹️ Complete / Terminate
              </button>
            </>
          )}
          <button
            onClick={() => setIsInitiateOpen(true)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
          >
            <span>➕</span> Initiate New Protocol
          </button>
          {selectedProtocol && (
            <Link
              to={`/mgso4/${selectedProtocol.protocol.id}/print`}
              target="_blank"
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold border border-gray-300 flex items-center gap-1"
            >
              <span>🖨️</span> Print Dossier
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">
          Loading Obstetric HDU Magnesium Sulfate flowsheet...
        </div>
      ) : !selectedProtocol ? (
        <div className="bg-white p-12 text-center rounded-xl border border-dashed border-gray-300 space-y-4">
          <span className="text-4xl block">⚡</span>
          <h3 className="text-base font-bold text-gray-800">No MgSO₄ Resuscitation Protocol Active</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            This patient currently has no active Magnesium Sulfate infusion protocols. If this patient has Severe Pre-Eclampsia, Imminent Eclampsia, or active seizures, initiate the resuscitation protocol immediately.
          </p>
          <button
            onClick={() => setIsInitiateOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow"
          >
            Initiate MgSO₄ Resuscitation Protocol
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Protocol Header Card */}
          <div className={`p-5 rounded-xl border shadow-sm ${
            selectedProtocol.protocol.status === 'active'
              ? 'bg-rose-50/70 border-rose-300'
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-600 text-white">
                    {selectedProtocol.protocol.regimen_type === 'zuspan_iv' ? 'Zuspan Regimen (IV)' : selectedProtocol.protocol.regimen_type === 'pritchard_im' ? 'Pritchard Regimen (IM)' : 'Preterm Neuroprotection'}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                    selectedProtocol.protocol.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {selectedProtocol.protocol.status.replace(/_/g, ' ')}
                  </span>
                  {selectedProtocol.protocol.antidote_calcium_gluconate_given === 1 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                      🚨 ANTIDOTE CALCIUM GLUCONATE ADMINISTERED
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 mt-2">
                  Indication: {selectedProtocol.protocol.indication.replace(/_/g, ' ').toUpperCase()}
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    (Code: {selectedProtocol.protocol.protocol_code})
                  </span>
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-xs text-gray-700">
                  <div>
                    <span className="text-gray-500 block">Loading Dose:</span>
                    <span className="font-semibold">{selectedProtocol.protocol.loading_dose_details}</span>
                    <span className="block text-[11px] text-gray-500">
                      {new Date(selectedProtocol.protocol.initiation_datetime).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Maintenance Rate:</span>
                    <span className="font-semibold">{selectedProtocol.protocol.maintenance_rate_g_per_h} g/hr</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Hours Logged:</span>
                    <span className="font-semibold">{selectedProtocol.flowsheet.length} / 24 Hours</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Initiated By:</span>
                    <span className="font-semibold">{selectedProtocol.protocol.prescribed_by_name || 'Obstetrician'}</span>
                  </div>
                </div>
              </div>

              {protocols.length > 1 && (
                <div className="text-right">
                  <label className="text-[11px] font-bold text-gray-500 block mb-1 uppercase">Switch Protocol</label>
                  <select
                    value={selectedProtocol.protocol.id}
                    onChange={(e) => handleSelectProtocol(Number(e.target.value))}
                    className="text-xs border border-gray-300 rounded-lg p-1.5 bg-white font-medium"
                  >
                    {protocols.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} - {p.regimen_type} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Safety Status Card (Based on latest flowsheet entry) */}
          {latestFlowsheet && currentSafety && (
            <div className={`p-4 rounded-xl border ${
              currentSafety.toxicitySeverity === 'critical_antidote_indicated'
                ? 'bg-red-50 border-red-400 text-red-900'
                : currentSafety.toxicitySeverity === 'warning_hold_recheck'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/50 pb-2 mb-3">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <span>{currentSafety.toxicitySeverity === 'normal_therapeutic' ? '✅' : '⚠️'}</span>
                  Latest Safety Check (Hour {latestFlowsheet.hour_number} at {new Date(latestFlowsheet.observation_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
                <span className="text-xs font-bold uppercase">
                  {currentSafety.toxicitySeverity.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Patellar Reflex (DTR)</span>
                  <span className={`font-black ${latestFlowsheet.patellar_reflex === 'absent_0' ? 'text-red-700' : 'text-gray-800'}`}>
                    {latestFlowsheet.patellar_reflex.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Respiratory Rate</span>
                  <span className={`font-black ${latestFlowsheet.respiratory_rate_bpm < 16 ? 'text-red-700' : 'text-gray-800'}`}>
                    {latestFlowsheet.respiratory_rate_bpm} breaths/min
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Urine Output (Last Hour)</span>
                  <span className={`font-black ${latestFlowsheet.urine_output_last_hour_ml < 30 ? 'text-red-700' : 'text-gray-800'}`}>
                    {latestFlowsheet.urine_output_last_hour_ml} mL/h
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Blood Pressure</span>
                  <span className={`font-black ${latestFlowsheet.blood_pressure_sys >= 160 || latestFlowsheet.blood_pressure_dia >= 110 ? 'text-red-700' : 'text-gray-800'}`}>
                    {latestFlowsheet.blood_pressure_sys} / {latestFlowsheet.blood_pressure_dia} mmHg
                  </span>
                </div>
              </div>

              {currentSafety.emergencyActionRequired && (
                <div className="mt-3 p-3 bg-red-600 text-white rounded-lg text-xs font-bold flex items-center justify-between">
                  <span>CRITICAL TOXICITY INTERVENTION INDICATED! Stop infusion immediately.</span>
                  <button
                    onClick={() => setIsAntidoteConfirmOpen(true)}
                    className="px-3 py-1 bg-white text-red-700 rounded font-black hover:bg-red-50 shadow"
                  >
                    Administer Antidote Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chronological Flowsheet Logs Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Bedside Hourly Flowsheet History</h3>
                <p className="text-xs text-gray-500">Hourly DTR, Respiratory Rate, Urometer Output, and Vitals record</p>
              </div>
              {selectedProtocol.protocol.status === 'active' && (
                <button
                  onClick={() => setIsFlowsheetOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow"
                >
                  ➕ Record Hour {nextHourNumber}
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left divide-y divide-gray-200">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Hour</th>
                    <th className="py-2.5 px-3">Observation Time</th>
                    <th className="py-2.5 px-3">Patellar Reflex</th>
                    <th className="py-2.5 px-3">RR (bpm)</th>
                    <th className="py-2.5 px-3">Urine Output (mL)</th>
                    <th className="py-2.5 px-3">BP (mmHg)</th>
                    <th className="py-2.5 px-3">HR / SpO₂</th>
                    <th className="py-2.5 px-3">Serum Mg</th>
                    <th className="py-2.5 px-3">Action Taken</th>
                    <th className="py-2.5 px-3">Nurse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedProtocol.flowsheet.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-gray-500">
                        No hourly flowsheet logs recorded yet. Begin logging at Hour 1.
                      </td>
                    </tr>
                  ) : (
                    selectedProtocol.flowsheet.map((entry) => {
                      const isReflexBad = entry.patellar_reflex === 'absent_0';
                      const isRrBad = entry.respiratory_rate_bpm < 16;
                      const isUopBad = entry.urine_output_last_hour_ml < 30;
                      const isBpHigh = entry.blood_pressure_sys >= 160 || entry.blood_pressure_dia >= 110;

                      return (
                        <tr
                          key={entry.id}
                          className={`hover:bg-gray-50 ${isReflexBad || isRrBad ? 'bg-red-50/50' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-bold text-gray-900">
                            Hour {entry.hour_number}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                            {new Date(entry.observation_datetime).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className={`py-2.5 px-3 font-semibold ${isReflexBad ? 'text-red-700 font-black' : 'text-gray-800'}`}>
                            {entry.patellar_reflex.replace(/_/g, ' ')}
                          </td>
                          <td className={`py-2.5 px-3 font-semibold ${isRrBad ? 'text-red-700 font-black' : 'text-gray-800'}`}>
                            {entry.respiratory_rate_bpm}
                          </td>
                          <td className={`py-2.5 px-3 font-semibold ${isUopBad ? 'text-red-700 font-black' : 'text-gray-800'}`}>
                            {entry.urine_output_last_hour_ml} mL
                          </td>
                          <td className={`py-2.5 px-3 font-semibold ${isBpHigh ? 'text-red-700 font-black' : 'text-gray-800'}`}>
                            {entry.blood_pressure_sys}/{entry.blood_pressure_dia}
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">
                            {entry.heart_rate_bpm} bpm / {entry.spo2_percent}%
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-700">
                            {entry.serum_magnesium_mg_dl ? `${entry.serum_magnesium_mg_dl} mg/dL` : '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="capitalize px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-800">
                              {entry.action_taken.replace(/_/g, ' ')}
                            </span>
                            {entry.antihypertensive_given && (
                              <span className="block text-[10px] text-red-600 font-bold mt-0.5">
                                + {entry.antihypertensive_given}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 text-[11px]">
                            {entry.nurse_name || 'Staff Nurse'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Protocol Initiation Modal */}
      {isInitiateOpen && (
        <Mgso4ProtocolModal
          patientId={patientId}
          patientName={patientName}
          onClose={() => setIsInitiateOpen(false)}
          onSuccess={() => {
            setIsInitiateOpen(false);
            loadData();
          }}
        />
      )}

      {/* Flowsheet Modal */}
      {isFlowsheetOpen && selectedProtocol && (
        <Mgso4HourlyFlowsheetModal
          protocolId={selectedProtocol.protocol.id}
          patientName={patientName}
          nextHourNumber={nextHourNumber}
          onClose={() => setIsFlowsheetOpen(false)}
          onSuccess={() => {
            setIsFlowsheetOpen(false);
            loadData();
          }}
        />
      )}

      {/* Antidote Confirmation Modal */}
      {isAntidoteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-600 max-w-lg w-full overflow-hidden">
            <div className="bg-red-600 text-white p-4 flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <h3 className="text-base font-black uppercase">
                Emergency 10% Calcium Gluconate Administration
              </h3>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-900 leading-relaxed font-semibold">
                You are about to log the emergency administration of <strong>10% Calcium Gluconate 10 mL (1 gram) IV push over 10 minutes</strong>.
                Magnesium sulfate infusion must be halted immediately.
              </div>
              <div>
                <label className="block text-gray-700 font-bold uppercase mb-1">
                  Clinical Indication / Reason for Antidote *
                </label>
                <input
                  type="text"
                  value={antidoteReason}
                  onChange={(e) => setAntidoteReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-red-500 font-medium"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAntidoteConfirmOpen(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={antidoteSubmitting}
                  onClick={handleTriggerAntidote}
                  className="px-4 py-1.5 bg-red-600 text-white font-bold rounded hover:bg-red-700 shadow"
                >
                  {antidoteSubmitting ? 'Recording...' : 'Confirm Antidote Given'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Protocol Termination Modal */}
      {isTerminateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="bg-gray-800 text-white p-4 font-bold text-sm uppercase">
              Update Protocol Termination Status
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-bold uppercase mb-1">Status</label>
                <select
                  value={terminateStatus}
                  onChange={(e) => setTerminateStatus(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="completed_24h">Completed Full 24-Hour Course</option>
                  <option value="held_toxicity">Held Due to Magnesium Toxicity</option>
                  <option value="aborted">Aborted / Terminated Early</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-bold uppercase mb-1">Reason / Summary</label>
                <textarea
                  rows={2}
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  placeholder="e.g. 24 hours completed postpartum, normal reflexes and BP stabilized."
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTerminateOpen(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow"
                >
                  Save Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
