import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalAopEpisode,
  type NeonatalAopRecord,
  type NeonatalAopFlowsheetRecord,
} from '../api';
import { type NeonatalAopEvaluationResult } from '../neonatalAopEngine';

export const NeonatalAopPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalAopRecord;
    evaluation: NeonatalAopEvaluationResult;
    flowsheet: NeonatalAopFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalAopEpisode(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load AOP dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating AOP Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Neonatal AOP Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button (Hidden in Print) */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Dossier Header */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
            Neonatal Intensive Care Unit (NICU)
          </h1>
          <p className="text-sm font-semibold text-slate-700">
            Apnea of Prematurity (AOP) & Caffeine Citrate Clinical Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            AAP Clinical Report / Cochrane Neonatal AOP Review / CAP Trial Protocol
          </p>
        </div>
        <div className="text-right">
          <div className="text-base font-black font-mono">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-600">Generated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Baseline Information */}
      <div className="grid grid-cols-4 gap-2 border border-slate-300 p-2.5 rounded mb-4 bg-slate-50">
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Infant Name</span>
          <span className="font-bold text-xs">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Gestational Age</span>
          <span className="font-semibold">{episode.gestational_age_weeks} weeks</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Chronological Age</span>
          <span className="font-semibold">{episode.chronological_age_days} days</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Post-Conceptional Age</span>
          <span className="font-bold text-indigo-700 text-xs">{episode.post_conceptional_age_weeks} weeks</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Current Weight</span>
          <span className="font-semibold">{episode.current_weight_kg} kg</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Apnea Subtype</span>
          <span className="font-semibold capitalize">{episode.apnea_subtype}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Events / 24h</span>
          <span className="font-semibold">{episode.apnea_frequency_per_24h} episodes</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Consultant / Fellow</span>
          <span className="font-semibold">{episode.consultant_name || 'Attending Neonatologist'}</span>
        </div>
      </div>

      {/* Methylxanthine (Caffeine Citrate) Therapy Card */}
      <div className="border border-slate-300 p-3 rounded mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-2">
          Caffeine Citrate Dosing & Pharmacotherapy
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Loading Dose</span>
            <span className="text-sm font-black text-emerald-700">
              {evaluation.caffeineDosing.recommendedLoadingDoseMg} mg
            </span>
            <span className="text-[9px] text-slate-500 block">20 mg/kg IV/PO</span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Daily Maintenance</span>
            <span className="text-sm font-black text-emerald-700">
              {evaluation.caffeineDosing.recommendedDailyMaintenanceMg} mg/day
            </span>
            <span className="text-[9px] text-slate-500 block">{evaluation.caffeineDosing.maintenanceDoseMgKgDay} mg/kg q24h</span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Therapeutic Range</span>
            <span className="text-sm font-bold text-slate-800">8 - 20 mcg/mL</span>
            <span className="text-[9px] text-slate-500 block">Current: {episode.serum_caffeine_level_mcg_ml ?? 'N/A'} mcg/mL</span>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <span className="text-[9px] uppercase font-semibold text-slate-500 block">AOP Severity</span>
            <span className="text-sm font-bold uppercase text-slate-800">{evaluation.apneaSeverityTier.replace(/_/g, ' ')}</span>
            <span className="text-[9px] text-slate-500 block">{evaluation.apneaSeverityLabel}</span>
          </div>
        </div>
      </div>

      {/* Airway & Weaning Criteria */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-slate-300 p-2.5 rounded">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
            Airway Splinting & Respiratory Support
          </h4>
          <p className="mb-1"><strong>Support Mode:</strong> {episode.respiratory_support_mode.replace(/_/g, ' ')}</p>
          <p className="text-slate-600 mb-1">{evaluation.airwaySupportGuidance}</p>
          <p className="text-slate-600"><strong>Secondary Causes Excluded:</strong> {episode.secondary_causes_excluded ? 'Yes (sepsis/CNS ruled out)' : 'Pending full sepsis evaluation'}</p>
        </div>

        <div className="border border-slate-300 p-2.5 rounded">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
            Weaning & Discontinuation Criteria
          </h4>
          <p className="font-bold mb-1">
            Status: {evaluation.weaningEligibility.eligible ? '✓ WEANING CRITERIA MET' : '⚠ WEANING NOT ELIGIBLE'}
          </p>
          <p className="text-slate-600 mb-1">{evaluation.weaningEligibility.reason}</p>
          <p className="text-slate-500 text-[10px]">
            Apnea-Free Days: {episode.apnea_free_days_count} days • PCA: {episode.post_conceptional_age_weeks} weeks
          </p>
        </div>
      </div>

      {/* Serial Flowsheet Table */}
      <div className="border border-slate-300 p-2.5 rounded mb-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-2">
          Shift Apnea / Bradycardia / Desaturation Flowsheet Log
        </h4>
        <table className="w-full text-left text-[10px] border">
          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
            <tr>
              <th className="p-1 border">Timestamp</th>
              <th className="p-1 border text-center">Apnea</th>
              <th className="p-1 border text-center">Brady (&lt;80)</th>
              <th className="p-1 border text-center">Desat (&lt;85%)</th>
              <th className="p-1 border text-center">Lowest HR/SpO2</th>
              <th className="p-1 border">Stimulation Mode</th>
              <th className="p-1 border text-center">Caffeine Dose</th>
              <th className="p-1 border">Respiratory Support</th>
              <th className="p-1 border">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {flowsheet.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-2 text-center text-slate-500">
                  No shift flowsheet logs recorded.
                </td>
              </tr>
            ) : (
              flowsheet.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="p-1 border whitespace-nowrap">{l.log_datetime.replace('T', ' ')}</td>
                  <td className="p-1 border text-center font-bold">{l.apnea_events_count_in_shift}</td>
                  <td className="p-1 border text-center font-bold text-amber-700">{l.bradycardia_events_count}</td>
                  <td className="p-1 border text-center font-bold text-red-700">{l.desaturation_events_count}</td>
                  <td className="p-1 border text-center">
                    {l.lowest_heart_rate_bpm ?? '-'} bpm / {l.lowest_spo2_percent ?? '-'}%
                  </td>
                  <td className="p-1 border capitalize">{l.stimulation_mode_used?.replace(/_/g, ' ') ?? 'None'}</td>
                  <td className="p-1 border text-center font-semibold text-emerald-700">
                    {l.caffeine_dose_given_mg ? `${l.caffeine_dose_given_mg} mg` : '-'}
                  </td>
                  <td className="p-1 border">{l.current_respiratory_support ?? '-'}</td>
                  <td className="p-1 border">{l.logged_by_name ?? 'Staff'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Recommendations & Protocol Notes */}
      <div className="border border-slate-300 p-2.5 rounded mb-6">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b pb-1 mb-1.5">
          Recommendations & Clinical Notes
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
          <p className="text-[10px] text-slate-500 uppercase font-semibold">NICU Bedside Nurse Signature</p>
          <div className="h-8 border-b border-dashed border-slate-400 mt-4"></div>
          <p className="text-[10px] text-slate-600 mt-1">RN / BSN Signature & Date</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Attending Neonatologist Signature</p>
          <div className="h-8 border-b border-dashed border-slate-400 mt-4"></div>
          <p className="text-[10px] text-slate-600 mt-1">MD / FAAP Signature & Medical Council Reg No.</p>
        </div>
      </div>
    </div>
  );
};
