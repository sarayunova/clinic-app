import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getNeonatalHieAssessment,
  auditNeonatalHiePrint,
  type NeonatalHieRecord,
  type TtmFlowsheetRecord,
} from '../api';

export const NeonatalHiePrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    assessment: NeonatalHieRecord;
    flowsheetLogs: TtmFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getNeonatalHieAssessment(Number(id));
        setData(res);
        await auditNeonatalHiePrint(Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load HIE report');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading Neonatal HIE Targeted Temperature Management (TTM) Dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'Neonatal HIE assessment not found'}
        </div>
        <Link to="/neonatal-hie" className="text-cyan-600 underline text-sm">
          &larr; Return to TTM Console
        </Link>
      </div>
    );
  }

  const { assessment: a, flowsheetLogs: logs } = data;

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans print:p-0">
      <div className="max-w-4xl mx-auto border border-slate-300 rounded-xl p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Print controls (hidden in print) */}
        <div className="flex justify-between items-center mb-6 print:hidden border-b pb-4">
          <Link
            to="/neonatal-hie"
            className="text-xs font-semibold text-cyan-800 hover:underline flex items-center gap-1"
          >
            &larr; Back to TTM Console
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-2"
          >
            <span>🖨️</span> Print Clinical Dossier
          </button>
        </div>

        {/* Header Letterhead */}
        <div className="border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                Level-III Neonatal Intensive Care Unit (NICU)
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Targeted Temperature Management (TTM) &amp; Hypoxic-Ischemic Encephalopathy (HIE) Clinical Dossier
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Protocol: TOBY / CoolCap / UK Neonatal Resuscitation &amp; Hypothermia Protocol
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded">
                {a.assessment_code}
              </span>
              <p className="text-[10px] text-slate-500 mt-1">
                Generated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Patient Demographics */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Neonate Name</span>
            <span className="font-bold text-slate-900 text-sm">{a.patient_name || 'Baby of Kavita'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">UHID / MRN</span>
            <span className="font-mono font-semibold">{a.patient_uhid || `PAT-${a.patient_id}`}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Gestational Age / Weight</span>
            <span className="font-semibold">{a.gestational_age_weeks} weeks · {a.birth_weight_kg} kg</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Birth Datetime</span>
            <span className="font-semibold">{new Date(a.birth_datetime).toLocaleString()}</span>
          </div>
        </div>

        {/* Asphyxia Criteria & Sarnat Staging Grid */}
        <div className="border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Criteria A (Intrapartum Asphyxia) &amp; Sarnat Staging (Criteria B)
            </h2>
            <span className="px-2.5 py-0.5 rounded text-xs font-black uppercase bg-indigo-100 text-indigo-900">
              {a.sarnat_stage?.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block">Cord / Arterial pH</span>
              <span className="font-black text-slate-900 text-sm">{a.cord_or_arterial_ph ?? '—'}</span>
              <span className="text-[10px] text-slate-400 block">(Threshold &lt; 7.00)</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block">Base Deficit (BE)</span>
              <span className="font-black text-slate-900 text-sm">{a.base_deficit_mmol_l ? `${a.base_deficit_mmol_l} mmol/L` : '—'}</span>
              <span className="text-[10px] text-slate-400 block">(Threshold &ge; 16 mmol/L)</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block">Apgar @ 10m / Resus</span>
              <span className="font-black text-slate-900 text-sm">{a.apgar_10m ?? '—'} / {a.resuscitation_duration_minutes ?? '—'}m</span>
              <span className="text-[10px] text-slate-400 block">(&le; 5 or &ge; 10m PPV)</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block">Cooling Eligible</span>
              <span className="font-black text-cyan-800 text-sm">{a.cooling_criteria_met ? 'YES (TOBY Met)' : 'Observation'}</span>
              <span className="text-[10px] text-slate-400 block">Within 6 Hours</span>
            </div>
          </div>

          {/* Sarnat Detailed Examination */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-medium">Level of Consciousness</span>
              <p className="font-semibold capitalize text-slate-800">{a.level_of_consciousness?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-medium">Muscle Tone</span>
              <p className="font-semibold capitalize text-slate-800">{a.muscle_tone?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-medium">Primitive Reflexes (Moro/Suck)</span>
              <p className="font-semibold capitalize text-slate-800">{a.primitive_reflexes_suck_moro?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-medium">Clinical Seizures</span>
              <p className="font-semibold text-slate-800">{a.clinical_seizures_present ? 'Detected' : 'None'}</p>
            </div>
          </div>

          {a.clinical_notes && (
            <div className="p-2.5 bg-cyan-50/50 border border-cyan-100 rounded text-xs text-slate-700">
              <strong>Clinical Assessment Notes:</strong> {a.clinical_notes}
            </div>
          )}
        </div>

        {/* Cooling Protocol Specifications */}
        <div className="bg-cyan-50/30 border border-cyan-200 rounded-xl p-4 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-900 mb-2">
            Targeted Temperature Management Protocol Specification
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 text-[10px] uppercase">Cooling Device</span>
              <p className="font-semibold capitalize text-slate-800">{a.cooling_device_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase">Target Core Temp</span>
              <p className="font-black text-cyan-800">{a.target_core_temp_celsius}°C (±0.2°C)</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase">Maintenance Duration</span>
              <p className="font-semibold text-slate-800">72 Hours continuous</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase">Controlled Rewarming</span>
              <p className="font-semibold text-slate-800">+0.5°C per hour (6–12 hrs)</p>
            </div>
          </div>
        </div>

        {/* 72-Hour Flowsheet Table */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            72-Hour TTM Hourly Flowsheet Record ({logs.length} Logged Entries)
          </h2>
          {logs.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 border rounded">No hourly flowsheet records logged yet.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b font-bold">
                    <th className="p-2">Hr</th>
                    <th className="p-2">Time</th>
                    <th className="p-2">Phase</th>
                    <th className="p-2">Core Temp</th>
                    <th className="p-2">Skin</th>
                    <th className="p-2">HR/MAP</th>
                    <th className="p-2">aEEG Background</th>
                    <th className="p-2">Seizures</th>
                    <th className="p-2">Meds / Actions</th>
                    <th className="p-2">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="p-2 font-bold text-cyan-800">#{log.hours_into_protocol}</td>
                      <td className="p-2 whitespace-nowrap text-slate-500">
                        {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-2 capitalize">{log.phase.replace(/_/g, ' ')}</td>
                      <td className="p-2 font-bold">{Number(log.core_temperature_celsius).toFixed(1)}°C</td>
                      <td className="p-2">{log.skin_temperature_celsius ? `${Number(log.skin_temperature_celsius).toFixed(1)}°C` : '—'}</td>
                      <td className="p-2 whitespace-nowrap">{log.heart_rate_bpm} / {log.mean_arterial_pressure_mmhg ?? '—'}</td>
                      <td className="p-2">{log.aeeg_background_pattern?.replace(/_/g, ' ') || '—'}</td>
                      <td className="p-2 font-semibold">
                        {log.electrographic_seizures_detected ? '⚡ Seizure' : 'None'}
                      </td>
                      <td className="p-2 text-slate-600 max-w-xs truncate">
                        {log.inotropic_support ? `${log.inotropic_support}; ` : ''}
                        {log.anticonvulsant_administered ? `${log.anticonvulsant_administered}; ` : ''}
                        {log.notes || '—'}
                      </td>
                      <td className="p-2 text-slate-500 text-[10px]">{log.logged_by_name || `Staff #${log.logged_by_id}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Doctor Verification and Signatures */}
        <div className="pt-8 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs">
          <div>
            <p className="font-bold text-slate-900">Attending Neonatologist:</p>
            <p className="text-slate-600">{a.consultant_neonatologist_name || 'Dr. Sneha Roy, MD (Pediatrics), DM (Neonatology)'}</p>
            <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
            <p className="text-[10px] text-slate-400 mt-1">Signature &amp; Medical Registration Stamp</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">NICU Nursing Officer-in-Charge:</p>
            <p className="text-slate-600">Sister-in-Charge / TTM Certified Lead</p>
            <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
            <p className="text-[10px] text-slate-400 mt-1">Countersignature &amp; Verification Date</p>
          </div>
        </div>
      </div>
    </div>
  );
};
