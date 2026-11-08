import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricRetainedPlacentaEpisode,
  type ObstetricRetainedPlacentaRecord,
  type ObstetricRetainedPlacentaFlowsheetRecord,
} from '../api';
import { type ObstetricRetainedPlacentaResult } from '../obstetricRetainedPlacentaEngine';

export const ObstetricRetainedPlacentaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: ObstetricRetainedPlacentaRecord;
    evaluation: ObstetricRetainedPlacentaResult;
    flowsheet: ObstetricRetainedPlacentaFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricRetainedPlacentaEpisode(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Retained Placenta dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Retained Placenta & MROP Dossier...</div>;
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
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Dossier Header */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
            Maternity & Labor Ward Unit
          </h1>
          <p className="text-sm font-semibold text-slate-700">
            Obstetric Retained Placenta & Emergent Manual Removal (MROP) Clinical Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            RCOG Green-top Guideline / WHO Recommendations on Prevention and Treatment of Postpartum Haemorrhage
          </p>
        </div>
        <div className="text-right">
          <div className="text-base font-black font-mono">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-600">Generated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Delivery Information */}
      <div className="grid grid-cols-4 gap-2 border border-slate-300 p-2.5 rounded mb-4 bg-slate-50">
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Patient Name</span>
          <span className="font-bold text-xs">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Delivery Datetime</span>
          <span className="font-semibold">{episode.delivery_datetime.replace('T', ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Third Stage Duration</span>
          <span className="font-bold text-rose-700 text-xs">{episode.third_stage_duration_minutes} minutes</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Estimated Blood Loss</span>
          <span className={`font-bold text-xs ${episode.estimated_blood_loss_ml >= 1000 ? 'text-red-700' : 'text-slate-800'}`}>
            {episode.estimated_blood_loss_ml} mL
          </span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Active Management</span>
          <span className="font-semibold">{episode.active_management_third_stage ? 'Yes (Oxytocin + CCT)' : 'Expectant Management'}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Hemodynamic State</span>
          <span className="font-semibold capitalize">{episode.hemodynamic_stability.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Presumed Pathology</span>
          <span className="font-semibold capitalize">{episode.retained_placenta_type.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Obstetric Consultant</span>
          <span className="font-semibold">{episode.consultant_name || 'Attending Obstetrician'}</span>
        </div>
      </div>

      {/* MROP & IUV Summary Card */}
      <div className="border border-slate-300 p-3 rounded mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-2">
          Management & MROP Procedure Details
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">MROP Urgency</span>
            <span className="text-xs font-black uppercase text-rose-800 block">
              {evaluation.mropUrgencyLabel}
            </span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">IUV Oxytocin Trial</span>
            <span className="text-xs font-bold text-slate-800 block">
              {episode.iuv_oxytocin_attempted ? (episode.iuv_oxytocin_successful ? 'Successful ✓' : 'Failed') : 'Not Trialed'}
            </span>
            <span className="text-[9px] text-slate-500">20 IU in 20 mL NS</span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">MROP Performed</span>
            <span className="text-xs font-black text-slate-800 block">
              {episode.mrop_performed ? 'Yes (In Operating Theatre)' : 'No / Pending'}
            </span>
            <span className="text-[9px] text-slate-500">{episode.anesthesia_type?.replace(/_/g, ' ') || 'N/A'}</span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Placenta Complete</span>
            <span className="text-xs font-bold text-slate-800 block">
              {episode.placenta_complete_post_removal ? 'Complete Inspection ✓' : 'Incomplete / Suspected Fragment'}
            </span>
          </div>
        </div>
      </div>

      {/* Safety Bundle & Prophylaxis */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-slate-300 p-2.5 rounded">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
            Safety Bundle & Bladder Care
          </h4>
          <p className="mb-1"><strong>Bladder Decompression:</strong> {episode.bladder_catheterized ? 'Catheterized (decompressed) ✓' : 'Bladder not catheterized ⚠'}</p>
          <p className="mb-1"><strong>Post-Removal Uterotonic:</strong> {episode.post_removal_oxytocin_infusion ? 'High-dose oxytocin infusion running' : 'Not started'}</p>
          <p className="text-slate-600"><strong>Antibiotic Prophylaxis:</strong> {episode.prophylactic_antibiotics_given ? 'Administered: Ampicillin 2g + Metronidazole 500mg IV' : 'Pending antibiotic administration'}</p>
        </div>

        <div className="border border-slate-300 p-2.5 rounded">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
            Post-MROP Monitoring Checklist
          </h4>
          <ul className="list-disc list-inside space-y-0.5 text-slate-700">
            {evaluation.postRemovalChecklist.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Flowsheet Table */}
      <div className="border border-slate-300 p-2.5 rounded mb-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-2">
          Third Stage Hemodynamic & Blood Loss Surveillance Flowsheet
        </h4>
        <table className="w-full text-left text-[10px] border">
          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
            <tr>
              <th className="p-1 border">Timestamp</th>
              <th className="p-1 border text-center">Min Post-Delivery</th>
              <th className="p-1 border text-center">Blood Pressure</th>
              <th className="p-1 border text-center">Heart Rate</th>
              <th className="p-1 border text-center">Cum Blood Loss</th>
              <th className="p-1 border">Fundal Tone</th>
              <th className="p-1 border">Bleeding</th>
              <th className="p-1 border text-center">Cord Lengthening</th>
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
                  <td className="p-1 border text-center font-bold">{l.minutes_from_delivery} min</td>
                  <td className="p-1 border text-center">
                    {l.blood_pressure_sys && l.blood_pressure_dia ? `${l.blood_pressure_sys}/${l.blood_pressure_dia}` : '-'}
                  </td>
                  <td className="p-1 border text-center font-semibold">{l.heart_rate ?? '-'} bpm</td>
                  <td className={`p-1 border text-center font-bold ${l.cumulative_blood_loss_ml >= 1000 ? 'text-red-700' : ''}`}>
                    {l.cumulative_blood_loss_ml} mL
                  </td>
                  <td className="p-1 border capitalize">{l.uterine_fundus_tone.replace(/_/g, ' ')}</td>
                  <td className="p-1 border capitalize">{l.active_vaginal_bleeding.replace(/_/g, ' ')}</td>
                  <td className="p-1 border text-center font-bold">
                    {l.cord_lengthening_observed ? 'Yes' : 'No'}
                  </td>
                  <td className="p-1 border">{l.logged_by_name ?? 'Staff'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Notes & Recommendations */}
      <div className="border border-slate-300 p-2.5 rounded mb-6">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
          Recommendations & Operative Notes
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
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Labor Ward Midwife / RN Signature</p>
          <div className="h-8 border-b border-dashed border-slate-400 mt-4"></div>
          <p className="text-[10px] text-slate-600 mt-1">Midwife Signature & Registration No.</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Consultant Obstetrician / Surgeon Signature</p>
          <div className="h-8 border-b border-dashed border-slate-400 mt-4"></div>
          <p className="text-[10px] text-slate-600 mt-1">MD / MRCOG Signature & Medical Council Reg No.</p>
        </div>
      </div>
    </div>
  );
};
