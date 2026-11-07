import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getPediatricSepticShockEpisode,
  auditPediatricSepticShockPrint,
  type PediatricSepticShockRecord,
  type PediatricSepticShockFlowsheetRecord,
} from '../api';

export const PediatricSepticShockPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricSepticShockRecord;
    flowsheetLogs: PediatricSepticShockFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getPediatricSepticShockEpisode(parseInt(id, 10));
        setData(res);
        await auditPediatricSepticShockPrint(parseInt(id, 10));
      } catch (err: any) {
        setError(err.message || 'Failed to load septic shock dossier');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Generating septic shock resuscitation dossier...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>{error || 'Record not found'}</p>
        <Link to="/pediatric-septic-shock" className="mt-4 inline-block text-blue-600 hover:underline">
          Return to Console
        </Link>
      </div>
    );
  }

  const { episode, flowsheetLogs } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 print:p-0 print:max-w-none text-xs">
      {/* Print Toolbar */}
      <div className="print:hidden mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-xl border border-gray-200">
        <div>
          <span className="font-bold text-sm text-gray-800">Printable Clinical Dossier</span>
          <p className="text-xs text-gray-500">Emergency Resuscitation Record (PALS / Surviving Sepsis)</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/patients/${episode.patient_id}`}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50"
          >
            Back to Patient
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-indigo-700 text-white rounded-lg text-xs font-bold shadow hover:bg-indigo-800"
          >
            Print Dossier (PDF)
          </button>
        </div>
      </div>

      {/* Letterhead */}
      <div className="border-b-2 border-indigo-900 pb-4 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-indigo-950 tracking-tight">LIVI HEALTHCARE CLINIC & PICU</h1>
          <p className="text-[10px] text-gray-600">Department of Pediatric Emergency & Critical Care Medicine</p>
          <p className="text-[10px] text-gray-500">Pediatric Advanced Life Support (PALS) Resuscitation Protocol</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-900 rounded font-black text-[11px] uppercase tracking-wider">
            SEPTIC SHOCK DOSSIER
          </span>
          <div className="text-[10px] text-gray-500 mt-1">Record ID: {episode.episode_code}</div>
        </div>
      </div>

      {/* Patient Demographics */}
      <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
        <div>
          <span className="text-gray-500 block text-[10px]">Patient Name:</span>
          <span className="font-bold text-gray-900">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">UHID / Record:</span>
          <span className="font-bold text-gray-900">{episode.patient_uhid || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Age / Calibrated Weight:</span>
          <span className="font-bold text-gray-900">{episode.age_months} months ({episode.weight_kg} kg)</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Recognition Time:</span>
          <span className="font-bold text-gray-900">{new Date(episode.recognition_datetime).toLocaleString()}</span>
        </div>
      </div>

      {/* Section 1: Initial Shock Recognition & Phenotype */}
      <div className="border border-gray-300 rounded-lg p-3 mb-4 space-y-2">
        <div className="flex justify-between items-center border-b pb-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">
            1. Shock Phenotype & Hemodynamic Baseline
          </span>
          <span className="font-black text-indigo-900 uppercase">
            {episode.shock_phenotype.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1 text-[11px]">
          <div>
            <span className="text-gray-500">Initial Heart Rate:</span>{' '}
            <span className="font-bold text-gray-900">{episode.heart_rate_bpm} bpm</span>
          </div>
          <div>
            <span className="text-gray-500">Blood Pressure:</span>{' '}
            <span className="font-bold text-gray-900">{episode.sbp}/{episode.dbp} ({episode.map_mmhg} MAP)</span>
          </div>
          <div>
            <span className="text-gray-500">Capillary Refill:</span>{' '}
            <span className="font-bold text-gray-900">{episode.capillary_refill_seconds}s</span>
          </div>
          <div>
            <span className="text-gray-500">Extremity Temp / Pulse:</span>{' '}
            <span className="font-bold capitalize">{episode.extremity_temperature} / {episode.pulse_quality}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-[11px]">
          <div>
            <span className="text-gray-500">First-Line Vasoactive:</span>{' '}
            <span className="font-semibold uppercase">{episode.first_line_vasoactive} Infusion</span>
          </div>
          <div>
            <span className="text-gray-500">Mental Status (AVPU):</span>{' '}
            <span className="font-semibold uppercase">{episode.mental_status}</span>
          </div>
          <div>
            <span className="text-gray-500">Current VIS Score:</span>{' '}
            <span className="font-bold text-indigo-900">{episode.current_vis_score}</span>
          </div>
        </div>
      </div>

      {/* Section 2: Fluid Resuscitation & Safety Stops */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-gray-300 rounded-lg p-3 space-y-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1">
            2. Crystalloid Resuscitation Adequacy
          </span>
          <div className="text-[11px]">
            <span className="text-gray-500">Total Crystalloid:</span>{' '}
            <span className="font-bold text-gray-900">{episode.cumulative_fluid_ml} mL</span> ({episode.cumulative_fluid_ml_kg} mL/kg)
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">Fluid Overload Status:</span>{' '}
            <span className="font-semibold">
              {episode.fluid_overload_alert ? '⚠️ Overload Flagged (Fluids Held)' : 'No Hepatomegaly/Rales'}
            </span>
          </div>
        </div>

        <div className="border border-gray-300 rounded-lg p-3 space-y-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1">
            3. Refractory Shock & Corticosteroids
          </span>
          <div className="text-[11px]">
            <span className="text-gray-500">Fluid-Refractory:</span>{' '}
            <span className="font-semibold">{episode.fluid_refractory ? 'Yes (≥ 40 mL/kg given)' : 'No'}</span>
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">Stress Hydrocortisone:</span>{' '}
            <span className="font-semibold">{episode.stress_hydrocortisone_administered ? '✅ Administered' : 'Not given'}</span>
          </div>
        </div>
      </div>

      {/* Section 3: Flowsheet Chronology */}
      <div className="border border-gray-300 rounded-lg p-3 mb-4">
        <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1 mb-2">
          4. Chronological Resuscitation Flowsheet & VIS Scores
        </span>

        {flowsheetLogs.length === 0 ? (
          <p className="text-gray-400 italic text-[11px]">No flowsheet checkpoints logged.</p>
        ) : (
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-700">
                <th className="py-1 px-1.5">Min</th>
                <th className="py-1 px-1.5">Time</th>
                <th className="py-1 px-1.5">HR</th>
                <th className="py-1 px-1.5">BP (MAP)</th>
                <th className="py-1 px-1.5">Cap Refill</th>
                <th className="py-1 px-1.5">Bolus Given</th>
                <th className="py-1 px-1.5">Total (mL/kg)</th>
                <th className="py-1 px-1.5">VIS</th>
                <th className="py-1 px-1.5">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flowsheetLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-1 px-1.5 font-bold">{log.minutes_from_recognition}m</td>
                  <td className="py-1 px-1.5 text-gray-500">
                    {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1 px-1.5 font-bold">{log.heart_rate_bpm ?? '-'}</td>
                  <td className="py-1 px-1.5">
                    {log.sbp}/{log.dbp} ({log.map_mmhg})
                  </td>
                  <td className="py-1 px-1.5">{log.capillary_refill_seconds ? `${log.capillary_refill_seconds}s` : '-'}</td>
                  <td className="py-1 px-1.5 font-medium">
                    {log.bolus_fluid_volume_ml > 0 ? `+${log.bolus_fluid_volume_ml} mL` : '-'}
                  </td>
                  <td className="py-1 px-1.5">{log.total_fluid_ml_kg} mL/kg</td>
                  <td className="py-1 px-1.5 font-black text-indigo-900">{log.vis_score}</td>
                  <td className="py-1 px-1.5 text-gray-600">{log.logged_by_name || 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clinical Notes */}
      {episode.clinical_notes && (
        <div className="border border-gray-300 rounded-lg p-3 mb-6 text-[11px]">
          <span className="font-bold text-gray-800 uppercase block mb-1">Clinical Impressions & Disposition:</span>
          <p className="text-gray-700">{episode.clinical_notes}</p>
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-[11px]">
        <div>
          <div className="h-10 border-b border-gray-400 mb-1"></div>
          <span className="font-bold text-gray-800 block">Pediatric Resuscitation Nurse / Fellow</span>
          <span className="text-gray-500 text-[10px]">Verified Timeline & Fluid Balance</span>
        </div>
        <div className="text-right">
          <div className="h-10 border-b border-gray-400 mb-1"></div>
          <span className="font-bold text-gray-800 block">
            {episode.consultant_name || 'Consultant Pediatric Intensivist'}
          </span>
          <span className="text-gray-500 text-[10px]">Attending Intensivist & Reg. Medical Officer</span>
        </div>
      </div>
    </div>
  );
};
