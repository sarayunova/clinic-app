import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getPediatricDkaEpisode,
  auditPediatricDkaPrint,
  type PediatricDkaRecord,
  type PediatricDkaFlowsheetRecord,
} from '../api';

export const PediatricDkaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricDkaRecord;
    flowsheetLogs: PediatricDkaFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getPediatricDkaEpisode(Number(id));
        setData(res);
        await auditPediatricDkaPrint(Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load DKA dossier');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading Pediatric DKA 48-Hour Resuscitation Dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'Pediatric DKA episode not found'}
        </div>
        <Link to="/pediatric-dka" className="text-amber-600 underline text-sm">
          &larr; Return to DKA Console
        </Link>
      </div>
    );
  }

  const { episode: e, flowsheetLogs: logs } = data;

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans print:p-0">
      <div className="max-w-4xl mx-auto border border-slate-300 rounded-xl p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Print controls (hidden in print) */}
        <div className="flex justify-between items-center mb-6 print:hidden border-b pb-4">
          <Link
            to="/pediatric-dka"
            className="text-xs font-semibold text-amber-800 hover:underline flex items-center gap-1"
          >
            &larr; Back to DKA Console
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-2"
          >
            <span>🖨️</span> Print Clinical Dossier
          </button>
        </div>

        {/* Header Letterhead */}
        <div className="border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                Pediatric Intensive Care Unit (PICU) &amp; Emergency
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Pediatric Diabetic Ketoacidosis (DKA) Resuscitation &amp; Two-Bag System Protocol Dossier
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Clinical Standards: ISPAD 2022 Consensus · PECARN Fluid Trial · BSPED Guidelines
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded">
                {e.episode_code}
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
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Child Name</span>
            <span className="font-bold text-slate-900 text-sm">{e.patient_name || 'Aarav Sharma'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">UHID / MRN</span>
            <span className="font-mono font-semibold">{e.patient_uhid || `PAT-${e.patient_id}`}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Child Weight / Height</span>
            <span className="font-semibold">{e.child_weight_kg} kg {e.child_height_cm ? `· ${e.child_height_cm} cm` : ''}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Diagnosis Datetime</span>
            <span className="font-semibold">{new Date(e.diagnosis_datetime).toLocaleString()}</span>
          </div>
        </div>

        {/* Acid-Base & Metabolic Severity */}
        <div className="border border-slate-200 rounded-xl p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Admission Metabolic Acidosis &amp; ISPAD Severity Stratification
            </h2>
            <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase ${
              e.dka_severity === 'severe_ph_lt_7_10' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-900'
            }`}>
              {e.dka_severity?.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">Venous pH</span>
              <span className="font-black text-rose-700 text-2xl">{e.venous_ph}</span>
              <span className="text-[10px] text-slate-400 block">Severe: &lt; 7.10</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">Serum Bicarbonate</span>
              <span className="font-black text-rose-700 text-2xl">{e.serum_bicarbonate_mmol_l}</span>
              <span className="text-[10px] text-slate-400 block">mmol/L (&lt; 5 mmol/L)</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">Initial Blood Glucose</span>
              <span className="font-black text-amber-800 text-2xl">{e.initial_blood_glucose_mg_dl}</span>
              <span className="text-[10px] text-slate-400 block">mg/dL</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">Corrected Sodium</span>
              <span className="font-black text-slate-800 text-2xl">{logs[0]?.corrected_sodium_meq_l ? `${logs[0].corrected_sodium_meq_l}` : '—'}</span>
              <span className="text-[10px] text-slate-400 block">mEq/L</span>
            </div>
          </div>

          {/* 48-Hour Fluid Deficit & Maintenance Specifications */}
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
            <h3 className="font-bold text-amber-900 uppercase text-[11px]">
              48-Hour Fluid Resuscitation &amp; Two-Bag System Parameters
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-500 text-[10px] block">Estimated Dehydration</span>
                <span className="font-bold text-slate-900">{e.estimated_dehydration_percent}%</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Initial 0.9% Saline Bolus</span>
                <span className="font-bold text-slate-900">{e.initial_saline_bolus_ml ?? 0} mL (10 mL/kg)</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">48h Rehydration Rate</span>
                <span className="font-black text-indigo-700">{e.rehydration_rate_ml_hr} mL/hr</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Regular Insulin Infusion</span>
                <span className="font-black text-rose-700">
                  {Number((e.child_weight_kg * e.insulin_infusion_rate_u_kg_hr).toFixed(2))} U/hr ({e.insulin_infusion_rate_u_kg_hr} U/kg/h)
                </span>
              </div>
            </div>
          </div>

          {e.clinical_notes && (
            <div className="p-2.5 bg-slate-50 border rounded text-xs text-slate-700">
              <strong>Clinical Assessment Notes:</strong> {e.clinical_notes}
            </div>
          )}
        </div>

        {/* 48-Hour Flowsheet Table */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            48-Hour DKA Flowsheet &amp; Two-Bag Titration Record ({logs.length} Entries)
          </h2>
          {logs.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 border rounded">No flowsheet records logged yet.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b font-bold">
                    <th className="p-2">Hr</th>
                    <th className="p-2">Time</th>
                    <th className="p-2">BG (mg/dL)</th>
                    <th className="p-2">pH / HCO3</th>
                    <th className="p-2">Corr Na</th>
                    <th className="p-2">Bag 1 (D0)</th>
                    <th className="p-2">Bag 2 (D10)</th>
                    <th className="p-2">Insulin</th>
                    <th className="p-2">GCS</th>
                    <th className="p-2">Urine</th>
                    <th className="p-2">Alerts / Notes</th>
                    <th className="p-2">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="p-2 font-bold text-amber-800">#{log.hours_on_protocol}</td>
                      <td className="p-2 whitespace-nowrap text-slate-500">
                        {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-2 font-black text-rose-700">{log.blood_glucose_mg_dl}</td>
                      <td className="p-2 font-semibold">{log.venous_ph ?? '—'} / {log.serum_bicarbonate_mmol_l ?? '—'}</td>
                      <td className="p-2 font-mono">{log.corrected_sodium_meq_l ? `${log.corrected_sodium_meq_l}` : '—'}</td>
                      <td className="p-2 text-cyan-800 font-bold">{log.bag_1_rate_ml_hr} mL/h</td>
                      <td className="p-2 text-amber-800 font-bold">{log.bag_2_rate_ml_hr} mL/h</td>
                      <td className="p-2 font-bold text-rose-700">{log.insulin_infusion_units_hr} U/h</td>
                      <td className="p-2 font-black">GCS {log.glasgow_coma_scale_score}</td>
                      <td className="p-2">{log.urine_output_ml_kg_hr ? `${log.urine_output_ml_kg_hr} mL/kg` : '—'}</td>
                      <td className="p-2 text-slate-600 max-w-xs truncate">
                        {log.cushing_triad_warning ? '⚠️ Cushing Triad; ' : ''}
                        {log.neurological_headache_vomiting ? 'Headache/Vomiting; ' : ''}
                        {log.emergency_hyperosmolar_saline_given ? '3% Saline given; ' : ''}
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
            <p className="font-bold text-slate-900">Attending Pediatric Endocrinologist / Pediatrician:</p>
            <p className="text-slate-600">{e.attending_pediatrician_name || 'Dr. Sneha Roy, MD (Pediatrics)'}</p>
            <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
            <p className="text-[10px] text-slate-400 mt-1">Signature &amp; Medical Registration Stamp</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">PICU Nursing Lead / In-Charge:</p>
            <p className="text-slate-600">Sister-in-Charge / Pediatric Intensive Care Lead</p>
            <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
            <p className="text-[10px] text-slate-400 mt-1">Countersignature &amp; 48-Hour Protocol Review</p>
          </div>
        </div>
      </div>
    </div>
  );
};
