import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getPediatricSeizureEpisode,
  auditPediatricSeizurePrint,
  type PediatricSeizureRecord,
  type PediatricSeizureTimelineRecord,
} from '../api';

export const PediatricSeizurePrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricSeizureRecord;
    timelineLogs: PediatricSeizureTimelineRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getPediatricSeizureEpisode(Number(id));
        setData(res);
        await auditPediatricSeizurePrint(Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load Seizure report');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading Pediatric Status Epilepticus Resuscitation Dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'Seizure episode not found'}
        </div>
        <Link to="/pediatric-seizures" className="text-red-700 underline text-sm">
          ← Return to Seizure Console
        </Link>
      </div>
    );
  }

  const { episode: ep, timelineLogs: logs } = data;

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans print:p-0">
      {/* Top action toolbar (hidden on print) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          to={`/patients/${ep.patient_id}?tab=pediatric_seizures`}
          className="text-xs font-semibold text-red-700 hover:underline flex items-center gap-1"
        >
          ← Return to Patient Chart
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-red-800 text-white rounded-lg text-xs font-bold shadow hover:bg-red-900 flex items-center gap-2"
        >
          <span>🖨️</span> Print Legal Clinical Record
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto border border-gray-300 p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Hospital Header */}
        <div className="border-b-2 border-red-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-red-950 uppercase tracking-tight">
              LiVi Pediatric Emergency & Critical Care
            </h1>
            <p className="text-xs text-slate-600">
              American Epilepsy Society (AES) & PALS Status Epilepticus Resuscitation Protocol
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-black text-red-900 bg-red-50 px-2.5 py-1 border border-red-200 rounded">
              {ep.episode_code}
            </span>
            <p className="text-[10px] text-slate-500 mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>
        </div>

        {/* Patient Demographics Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Child Name</span>
            <span className="font-bold text-slate-900 text-sm">{ep.patient_name}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">UHID</span>
            <span className="font-mono font-bold text-slate-900">{ep.patient_uhid}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Age / Weight</span>
            <span className="font-bold text-slate-900">{ep.patient_age_months} months • {ep.weight_kg} kg</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Broselow Zone</span>
            <span className="font-black text-indigo-900 uppercase">{ep.broselow_color_zone} ZONE</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Seizure Start Time</span>
            <span className="font-semibold text-slate-800">{new Date(ep.seizure_start_datetime).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Attending Pediatrician</span>
            <span className="font-semibold text-slate-800">{ep.attending_pediatrician_name || 'Attending Pediatrician'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Seizure Semiology</span>
            <span className="font-bold text-slate-900 uppercase">{ep.seizure_type.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Suspected Etiology</span>
            <span className="font-semibold text-slate-800 uppercase">{ep.etiology?.replace(/_/g, ' ') || 'Unknown'}</span>
          </div>
        </div>

        {/* Clinical Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="border border-red-200 rounded-lg p-3 bg-red-50/30 text-center">
            <span className="text-[10px] font-bold text-red-700 uppercase block">Total Seizure Duration</span>
            <p className="text-2xl font-black text-red-900 my-1">{ep.total_seizure_duration_minutes ?? 'Ongoing'} min</p>
            <span className="text-[10px] text-red-800 font-semibold">{ep.seizure_cessation_datetime ? 'Cessation Attained' : 'Active Convulsions'}</span>
          </div>
          <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/30 text-center">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Blood Glucose</span>
            <p className="text-2xl font-black text-amber-900 my-1">{ep.blood_glucose_mg_dl ?? '—'} mg/dL</p>
            <span className="text-[10px] text-amber-800">{ep.d10w_bolus_given_ml ? `D10W: ${ep.d10w_bolus_given_ml} mL` : 'Normoglycemic'}</span>
          </div>
          <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50/30 text-center">
            <span className="text-[10px] font-bold text-indigo-700 uppercase block">Algorithm Phase</span>
            <p className="text-sm font-black text-indigo-950 my-1 uppercase">{ep.current_algorithm_phase.replace(/_/g, ' ')}</p>
            <span className="text-[10px] text-indigo-800">BZD Doses: {ep.phase2_dose_count}/2</span>
          </div>
          <div className="border border-purple-200 rounded-lg p-3 bg-purple-50/30 text-center">
            <span className="text-[10px] font-bold text-purple-700 uppercase block">Second-Line ASM</span>
            <p className="text-sm font-black text-purple-950 my-1">{ep.phase3_second_line_agent ? ep.phase3_second_line_agent.split(' ')[0] : 'None'}</p>
            <span className="text-[10px] text-purple-800 uppercase">{ep.phase3_infusion_status || 'N/A'}</span>
          </div>
        </div>

        {/* Resuscitation Timeline Table */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Sequential Bedside Resuscitation Event Timeline
          </h3>
          <table className="min-w-full border border-slate-300 text-[10px]">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th className="p-1.5 border-r text-left">Elapsed Time / Clock</th>
                <th className="p-1.5 border-r text-left">Intervention / Action Type</th>
                <th className="p-1.5 border-r text-left">Medication & Dose</th>
                <th className="p-1.5 border-r text-center">Route</th>
                <th className="p-1.5 border-r text-center">Vitals (HR / BP / SpO2)</th>
                <th className="p-1.5 border-r text-center">Motor Activity</th>
                <th className="p-1.5 text-left">Observations / Clinician</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                    No resuscitation timeline events recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-1.5 border-r font-mono font-bold text-red-900">
                      +{log.elapsed_minutes} min ({new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </td>
                    <td className="p-1.5 border-r font-semibold">
                      {log.action_type.replace(/_/g, ' ').toUpperCase()}
                    </td>
                    <td className="p-1.5 border-r font-bold text-indigo-950">
                      {log.medication_name ? `${log.medication_name} ${log.dose_administered || ''}` : '—'}
                    </td>
                    <td className="p-1.5 border-r text-center uppercase">
                      {log.route || '—'}
                    </td>
                    <td className="p-1.5 border-r text-center">
                      {log.heart_rate_bpm ? `${log.heart_rate_bpm} bpm • ` : ''}
                      {log.blood_pressure_systolic ? `${log.blood_pressure_systolic}/${log.blood_pressure_diastolic} • ` : ''}
                      {log.spo2_percent ? `${log.spo2_percent}%` : '—'}
                    </td>
                    <td className="p-1.5 border-r text-center font-bold">
                      <span className={log.active_motor_activity === 1 ? 'text-red-700' : 'text-emerald-700'}>
                        {log.active_motor_activity === 1 ? 'CONVULSING' : 'ABORTED'}
                      </span>
                    </td>
                    <td className="p-1.5">
                      {log.clinical_observations || '—'} {log.logged_by_name && `(${log.logged_by_name})`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Clinical Notes */}
        {ep.clinical_notes && (
          <div className="border border-slate-200 rounded p-3 mb-8 bg-slate-50 text-xs">
            <span className="font-bold text-slate-700 block mb-1">Pediatrician Post-Resuscitation Plan & Disposition:</span>
            <p className="text-slate-800">{ep.clinical_notes}</p>
          </div>
        )}

        {/* Signature Blocks */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
          <div>
            <div className="border-b border-slate-400 pb-8 mb-2"></div>
            <p className="font-bold text-slate-800">Pediatric Resuscitation Team Leader</p>
            <p className="text-[10px] text-slate-500">PALS / APLS Certified Provider</p>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-8 mb-2"></div>
            <p className="font-bold text-slate-800">Consultant Pediatrician / Pediatric Intensivist</p>
            <p className="text-[10px] text-slate-500">Reg No: ____________________ • Signature & Seal</p>
          </div>
        </div>
      </div>
    </div>
  );
};
