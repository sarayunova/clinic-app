import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPediatricRenalDashboard,
  type PdSessionRecord,
  type PediatricRenalAssessmentRecord,
  type PdEffluentLabRecord,
} from '../api';

export const PediatricRenalPage: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState<(PdSessionRecord & { cycles_logged: number })[]>([]);
  const [highRiskPatients, setHighRiskPatients] = useState<PediatricRenalAssessmentRecord[]>([]);
  const [peritonitisAlerts, setPeritonitisAlerts] = useState<
    (PdEffluentLabRecord & {
      session_number: string;
      patient_name: string;
      patient_uhid: string;
    })[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPediatricRenalDashboard();
      setActiveSessions(data.activeSessions);
      setHighRiskPatients(data.highRiskRenalPatients);
      setPeritonitisAlerts(data.peritonitisAlerts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pediatric renal dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <span>💧</span> Pediatric & Neonatal Renal Command Center
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Acute Kidney Injury (KDIGO) Surveillance, Fluid Overload Tracking & Inpatient Peritoneal Dialysis Management
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
        >
          <span>🔄</span> {loading ? 'Refreshing...' : 'Refresh Monitor'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Peritonitis Critical Alerts Banner */}
      {peritonitisAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <h2 className="text-sm font-bold text-red-900 uppercase tracking-wide">
              Active Peritonitis Surveillance Alerts ({peritonitisAlerts.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {peritonitisAlerts.map(alert => (
              <div key={alert.id} className="bg-white p-3 rounded-lg border border-red-200 text-xs space-y-1">
                <div className="flex justify-between items-center font-bold text-red-800">
                  <span>{alert.patient_name} ({alert.patient_uhid})</span>
                  <span>{alert.sample_datetime.slice(11, 16)}</span>
                </div>
                <div className="text-gray-700">
                  Session: <strong>{alert.session_number}</strong> | WBC: <strong className="text-red-700">{alert.wbc_count_per_mcl} /µL</strong> ({alert.neutrophils_percent}% PMN)
                </div>
                {alert.empiric_antibiotic_initiated && (
                  <div className="text-emerald-700 font-semibold">
                    Antibiotics: {alert.empiric_antibiotic_initiated}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Peritoneal Dialysis Resuscitation Station */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>🌀</span> Active Inpatient Peritoneal Dialysis Resuscitation ({activeSessions.length})
          </h2>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold">
            Live Dialysis Flowsheets
          </span>
        </div>

        {activeSessions.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">
            No active peritoneal dialysis sessions underway in SNCU/PICU.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeSessions.map(session => (
              <div
                key={session.id}
                className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/40 to-white shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      <Link
                        to={`/patients/${session.patient_id}?tab=pediatric_renal`}
                        className="text-blue-700 hover:underline"
                      >
                        {session.patient_name}
                      </Link>{' '}
                      <span className="text-gray-500 text-xs font-normal">({session.patient_uhid})</span>
                    </h3>
                    <p className="text-xs text-gray-600 font-medium">
                      Session: <span className="font-bold text-gray-800">{session.session_number}</span> | Started: {session.start_datetime.slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-lg border text-xs">
                  <div>
                    <span className="text-gray-500 text-[10px] block">Prescription</span>
                    <span className="font-bold text-gray-800">
                      {session.solution_type === 'dextrose_1_5' && '1.5% Dextrose'}
                      {session.solution_type === 'dextrose_2_5' && '2.5% Dextrose'}
                      {session.solution_type === 'dextrose_4_25' && '4.25% Dextrose'}
                      {session.solution_type === 'custom_compound' && 'Custom'}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      {session.calculated_fill_volume_ml} mL/cycle
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">Cycles Logged</span>
                    <span className="font-bold text-gray-800">
                      {session.cycles_logged} / {session.target_cycles_count}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      Dwell: {session.dwell_time_minutes}m
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">Net Ultrafiltration</span>
                    <span
                      className={`text-sm font-black ${
                        session.cumulative_net_uf_ml >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {session.cumulative_net_uf_ml >= 0
                        ? `+${session.cumulative_net_uf_ml} mL`
                        : `${session.cumulative_net_uf_ml} mL`}
                    </span>
                    <span className="text-[10px] text-gray-500 block">Cumulative</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-600 truncate max-w-[200px]">
                    Indication: <strong>{session.indication.replace(/_/g, ' ')}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/patients/${session.patient_id}?tab=pediatric_renal`}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold"
                    >
                      Open Flowsheet
                    </Link>
                    <a
                      href={`/pediatric-renal/${session.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-xs font-semibold"
                    >
                      Print
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* High-Risk Pediatric AKI Surveillance Roster */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>⚠️</span> High-Risk Renal Impairment & AKI Surveillance Roster ({highRiskPatients.length})
          </h2>
          <span className="text-xs text-gray-500">
            Patients with KDIGO Stage ≥ 2 or Fluid Overload ≥ 10%
          </span>
        </div>

        {highRiskPatients.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">
            No pediatric inpatients currently flagged with Stage 2-3 AKI or critical fluid overload.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
              <thead className="bg-gray-100 text-gray-700 font-semibold uppercase">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">KDIGO Stage</th>
                  <th className="px-3 py-2 text-right">eGFR</th>
                  <th className="px-3 py-2 text-right">SCr Base &rarr; Curr</th>
                  <th className="px-3 py-2 text-right">Fluid Overload</th>
                  <th className="px-3 py-2 text-right">Urine Output</th>
                  <th className="px-3 py-2">Urinary Triage</th>
                  <th className="px-3 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {highRiskPatients.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">
                      <Link
                        to={`/patients/${p.patient_id}?tab=pediatric_renal`}
                        className="text-blue-700 hover:underline font-bold"
                      >
                        {p.patient_name}
                      </Link>
                      <span className="block text-[10px] text-gray-500">{p.patient_uhid}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {p.patient_category.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-white font-bold text-[10px] ${
                          p.kdigo_overall_stage === 3
                            ? 'bg-rose-600'
                            : p.kdigo_overall_stage === 2
                            ? 'bg-orange-500'
                            : 'bg-amber-500'
                        }`}
                      >
                        Stage {p.kdigo_overall_stage}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-indigo-700">
                      {p.calculated_egfr}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-800">
                      {p.baseline_creatinine_mg_dl} &rarr; {p.current_creatinine_mg_dl}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-bold ${
                        p.calculated_fluid_overload_pct >= 20
                          ? 'text-rose-700'
                          : p.calculated_fluid_overload_pct >= 10
                          ? 'text-amber-700'
                          : 'text-gray-800'
                      }`}
                    >
                      {p.calculated_fluid_overload_pct}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {p.calculated_uop_ml_kg_h !== null ? `${p.calculated_uop_ml_kg_h} mL/kg/h` : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-medium text-gray-700">
                        {p.calculated_fena_pct !== null ? `FENa ${p.calculated_fena_pct}%` : ''}{' '}
                        {p.prerenal_vs_atn !== 'not_evaluated' ? `(${p.prerenal_vs_atn})` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Link
                        to={`/patients/${p.patient_id}?tab=pediatric_renal`}
                        className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold"
                      >
                        Manage
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
