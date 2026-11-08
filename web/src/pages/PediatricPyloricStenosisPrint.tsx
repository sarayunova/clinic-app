import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricPyloricStenosisEpisode,
  type PediatricPyloricStenosisRecord,
  type PediatricPyloricStenosisFlowsheetRecord,
} from '../api';
import { type PediatricPyloricStenosisResult } from '../pediatricPyloricStenosisEngine';

export const PediatricPyloricStenosisPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricPyloricStenosisRecord;
    evaluation: PediatricPyloricStenosisResult;
    flowsheet: PediatricPyloricStenosisFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPediatricPyloricStenosisEpisode(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Pyloric Stenosis dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating IHPS Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button (Hidden in Print) */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Dossier Header */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
            Department of Pediatric Surgery & Critical Care
          </h1>
          <p className="text-sm font-semibold text-slate-700">
            Infantile Hypertrophic Pyloric Stenosis (IHPS) Resuscitation & Pre-Op Clearance Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            APSA / British Association of Paediatric Surgeons (BAPS) Resuscitation Consensus
          </p>
        </div>
        <div className="text-right">
          <div className="text-base font-black font-mono">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-600">Generated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Clinical Information */}
      <div className="grid grid-cols-4 gap-2 border border-slate-300 p-2.5 rounded mb-4 bg-slate-50">
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Infant Name</span>
          <span className="font-bold text-xs">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Age</span>
          <span className="font-semibold">{episode.age_weeks} weeks</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Weight / Birth Wt</span>
          <span className="font-semibold">{episode.weight_kg} kg / {episode.birth_weight_kg} kg</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Clinical Triad</span>
          <span className="font-semibold">{episode.palpable_olive_mass ? 'Palpable Olive +' : 'No Olive'} • Hungry Vomiter</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Ultrasound Findings</span>
          <span className="font-bold text-amber-800">{episode.pyloric_muscle_thickness_mm ?? '-'} mm thickness • {episode.pyloric_channel_length_mm ?? '-'} mm length</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Dehydration</span>
          <span className="font-semibold">{episode.dehydration_percentage}% dehydration</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Clearance Status</span>
          <span className={`font-bold ${episode.surgical_clearance_granted ? 'text-emerald-700' : 'text-red-700'}`}>
            {episode.surgical_clearance_granted ? 'CLEARED FOR OR' : 'UNDER ACTIVE RESUSCITATION'}
          </span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Attending Surgeon</span>
          <span className="font-semibold">{episode.consultant_name || 'Pediatric Surgeon'}</span>
        </div>
      </div>

      {/* Pre-Op Clearance Checklist Card */}
      <div className="border border-slate-300 p-3 rounded mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-2">
          Strict Pre-Operative Metabolic Clearance Matrix
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Serum Chloride (Cl⁻)</span>
            <span className={`text-base font-black ${evaluation.preOpClearance.chlorideAdequate ? 'text-emerald-700' : 'text-red-700'}`}>
              {episode.serum_chloride_meq_l} mEq/L
            </span>
            <span className="text-[9px] text-slate-500 block">Target ≥ 100 mEq/L</span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Serum Bicarbonate (HCO₃⁻)</span>
            <span className={`text-base font-black ${evaluation.preOpClearance.bicarbonateAdequate ? 'text-emerald-700' : 'text-red-700'}`}>
              {episode.serum_bicarbonate_meq_l} mEq/L
            </span>
            <span className="text-[9px] text-slate-500 block">Target ≤ 28 mEq/L</span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Serum Potassium (K⁺)</span>
            <span className={`text-base font-black ${evaluation.preOpClearance.potassiumAdequate ? 'text-emerald-700' : 'text-red-700'}`}>
              {episode.serum_potassium_meq_l} mEq/L
            </span>
            <span className="text-[9px] text-slate-500 block">Target ≥ 3.5 mEq/L</span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Urine Output (UOP)</span>
            <span className={`text-base font-black ${evaluation.preOpClearance.urineOutputAdequate ? 'text-emerald-700' : 'text-red-700'}`}>
              {episode.urine_output_ml_kg_hr} mL/kg/h
            </span>
            <span className="text-[9px] text-slate-500 block">Target ≥ 1.0 mL/kg/h</span>
          </div>
        </div>
      </div>

      {/* Fluid Resuscitation & Diagnostic Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-slate-300 p-2.5 rounded">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
            Fluid Resuscitation Protocol
          </h4>
          <p className="mb-1"><strong>Regimen:</strong> {evaluation.fluidGuidance}</p>
          <p className="mb-1"><strong>KCl Infusion:</strong> {episode.potassium_supplementation_started ? 'KCl Added (20 mEq/L in IV bag)' : 'Withheld until urine flow established'}</p>
          <p className="text-slate-600"><strong>Infusion Rate:</strong> {episode.fluid_resuscitation_rate_ml_hr ?? '1.5x maintenance'} mL/hr</p>
        </div>

        <div className="border border-slate-300 p-2.5 rounded">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
            Operative & Feeding Plan
          </h4>
          <p className="font-bold mb-1">
            Procedure: Ramstedt Pyloromyotomy ({episode.pyloromyotomy_technique?.replace(/_/g, ' ') || 'Laparoscopic / RUQ Open'})
          </p>
          <p className="text-slate-600 mb-1">
            Surgery Performed: {episode.surgery_performed ? 'Yes (Completed)' : 'Pending Electrolyte Optimization'}
          </p>
          <p className="text-slate-500 text-[10px]">
            Post-Op Feeds: {episode.postop_feeding_started ? 'Started (Pedialyte advancing to formula/breast milk)' : 'NPO until recovery'}
          </p>
        </div>
      </div>

      {/* Flowsheet Table */}
      <div className="border border-slate-300 p-2.5 rounded mb-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-2">
          Serial Electrolyte & Urine Output Surveillance Flowsheet
        </h4>
        <table className="w-full text-left text-[10px] border">
          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
            <tr>
              <th className="p-1 border">Timestamp</th>
              <th className="p-1 border text-center">Hours Post-Adm</th>
              <th className="p-1 border text-center">Cl- (≥100)</th>
              <th className="p-1 border text-center">HCO3- (≤28)</th>
              <th className="p-1 border text-center">K+ (≥3.5)</th>
              <th className="p-1 border text-center">pH</th>
              <th className="p-1 border text-center">UOP (mL/kg/h)</th>
              <th className="p-1 border text-center">IV Rate</th>
              <th className="p-1 border">Staff</th>
            </tr>
          </thead>
          <tbody>
            {flowsheet.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-2 text-center text-slate-500">
                  No serial flowsheet logs recorded.
                </td>
              </tr>
            ) : (
              flowsheet.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="p-1 border whitespace-nowrap">{l.log_datetime.replace('T', ' ')}</td>
                  <td className="p-1 border text-center font-bold">{l.hours_from_admission} hrs</td>
                  <td className={`p-1 border text-center font-bold ${l.serum_chloride_meq_l && l.serum_chloride_meq_l >= 100 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {l.serum_chloride_meq_l ?? '-'}
                  </td>
                  <td className={`p-1 border text-center font-bold ${l.serum_bicarbonate_meq_l && l.serum_bicarbonate_meq_l <= 28 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {l.serum_bicarbonate_meq_l ?? '-'}
                  </td>
                  <td className={`p-1 border text-center font-bold ${l.serum_potassium_meq_l && l.serum_potassium_meq_l >= 3.5 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {l.serum_potassium_meq_l ?? '-'}
                  </td>
                  <td className="p-1 border text-center">{l.blood_ph ?? '-'}</td>
                  <td className={`p-1 border text-center font-bold ${l.urine_output_ml_kg_hr >= 1.0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {l.urine_output_ml_kg_hr}
                  </td>
                  <td className="p-1 border text-center">{l.iv_fluid_rate_ml_hr} mL/h</td>
                  <td className="p-1 border">{l.logged_by_name ?? 'Staff'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Recommendations & Notes */}
      <div className="border border-slate-300 p-2.5 rounded mb-6">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
          Recommendations & Surgical Resuscitation Notes
        </h4>
        <ul className="list-disc list-inside space-y-0.5 text-slate-700">
          {evaluation.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {episode.clinical_notes && (
          <p className="mt-2 text-slate-600 italic">
            <strong>Notes:</strong> {episode.clinical_notes}
          </p>
        )}
      </div>

      {/* Attestation & Signature Block */}
      <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-300">
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Pediatric Anesthesiologist Clearance Signature</p>
          <div className="h-8 border-b border-dashed border-slate-400 mt-4"></div>
          <p className="text-[10px] text-slate-600 mt-1">MD / Anesthesiologist Signature & Date</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Attending Pediatric Surgeon Signature</p>
          <div className="h-8 border-b border-dashed border-slate-400 mt-4"></div>
          <p className="text-[10px] text-slate-600 mt-1">MD / FRCS / FAAP Signature & Medical Council Reg No.</p>
        </div>
      </div>
    </div>
  );
};
