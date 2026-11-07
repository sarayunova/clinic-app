import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getMaternalSepsisAssessment,
  auditMaternalSepsisPrint,
  type MaternalSepsisRecord,
  type MaternalBundleRecord,
} from '../api';

export const MaternalSepsisPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    assessment: MaternalSepsisRecord;
    bundleLogs: MaternalBundleRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getMaternalSepsisAssessment(Number(id));
        setData(res);
        await auditMaternalSepsisPrint(Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load sepsis dossier');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading Maternal Sepsis Resuscitation Dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'Maternal sepsis assessment not found'}
        </div>
        <Link to="/maternal-sepsis" className="text-rose-600 underline text-sm">
          &larr; Return to Sepsis Console
        </Link>
      </div>
    );
  }

  const { assessment: a, bundleLogs: logs } = data;

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans print:p-0">
      <div className="max-w-4xl mx-auto border border-slate-300 rounded-xl p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Print controls (hidden in print) */}
        <div className="flex justify-between items-center mb-6 print:hidden border-b pb-4">
          <Link
            to="/maternal-sepsis"
            className="text-xs font-semibold text-rose-800 hover:underline flex items-center gap-1"
          >
            &larr; Back to Sepsis Console
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-2"
          >
            <span>🖨️</span> Print Clinical Dossier
          </button>
        </div>

        {/* Header Letterhead */}
        <div className="border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                Obstetric Critical Care &amp; Maternal HDU
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Maternal Critical Care Sepsis (SOS / qSOFA) &amp; Obstetric Shock Index Dossier
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Clinical Guidelines: Albright et al. Sepsis in Obstetrics Score · FIGO / ACOG Consensus
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
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
            <span className="font-bold text-slate-900 text-sm">{a.patient_name || 'Anita Patel'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">UHID / MRN</span>
            <span className="font-mono font-semibold">{a.patient_uhid || `PAT-${a.patient_id}`}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Obstetric Status</span>
            <span className="font-semibold">
              {a.gestational_age_weeks ? `Antenatal ${a.gestational_age_weeks}w` : a.postpartum_days != null ? `Postpartum Day ${a.postpartum_days}` : 'Obstetric Patient'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Suspected Infection Source</span>
            <span className="font-bold text-rose-800 capitalize">{a.suspected_source?.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* SOS Score and Shock Index Evaluation */}
        <div className="border border-slate-200 rounded-xl p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Physiological Triage &amp; Risk Stratification
            </h2>
            <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase ${
              a.sos_risk_level === 'severe_septic_shock' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-900'
            }`}>
              {a.sos_risk_level?.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">Albright SOS Score</span>
              <span className="font-black text-rose-800 text-2xl">{a.sos_score}</span>
              <span className="text-[10px] text-slate-400 block">/ 28 Points</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">Obstetric Shock Index</span>
              <span className="font-black text-slate-900 text-2xl">{Number(a.obstetric_shock_index).toFixed(2)}</span>
              <span className="text-[10px] text-slate-400 block capitalize">{a.shock_index_tier?.replace(/_/g, ' ')}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">Mean Arterial Pressure</span>
              <span className="font-black text-slate-900 text-2xl">{a.mean_arterial_pressure_mmhg}</span>
              <span className="text-[10px] text-slate-400 block">Target &ge; 65 mmHg</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">ICU Transfer Recommendation</span>
              <span className="font-black text-rose-700 text-xl">{a.icu_transfer_recommended ? 'RECOMMENDED' : 'NO'}</span>
              <span className="text-[10px] text-slate-400 block">HDU / Intensive Care</span>
            </div>
          </div>

          {/* Detailed Vitals Table */}
          <div className="overflow-x-auto border rounded-lg text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 font-semibold border-b">
                  <th className="p-2">Temperature</th>
                  <th className="p-2">Blood Pressure</th>
                  <th className="p-2">Heart Rate</th>
                  <th className="p-2">Respiratory Rate</th>
                  <th className="p-2">SpO2</th>
                  <th className="p-2">WBC Count</th>
                  <th className="p-2">Immature Bands</th>
                  <th className="p-2">Lactate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 font-bold">{a.temperature_celsius}°C</td>
                  <td className="p-2 font-bold">{a.systolic_bp_mmhg}/{a.diastolic_bp_mmhg} mmHg</td>
                  <td className="p-2 font-bold text-rose-700">{a.heart_rate_bpm} bpm</td>
                  <td className="p-2">{a.respiratory_rate_bpm} bpm</td>
                  <td className="p-2">{a.spo2_percent}%</td>
                  <td className="p-2">{a.wbc_count_per_ul ? `${a.wbc_count_per_ul} /μL` : '—'}</td>
                  <td className="p-2">{a.immature_bands_percent ? `${a.immature_bands_percent}%` : '—'}</td>
                  <td className="p-2 font-bold text-rose-800">{a.serum_lactate_mmol_l ? `${a.serum_lactate_mmol_l} mmol/L` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {a.clinical_impression && (
            <div className="p-3 bg-rose-50/50 border border-rose-100 rounded text-xs text-rose-950">
              <strong>Clinical Impression:</strong> {a.clinical_impression}
            </div>
          )}
        </div>

        {/* Hour-1 Bundle Execution Record */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            FIGO / Surviving Sepsis Campaign Hour-1 Bundle Execution Logs ({logs.length} Entries)
          </h2>
          {logs.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 border rounded">No bundle execution records logged yet.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b font-bold">
                    <th className="p-2">Time</th>
                    <th className="p-2">Blood Cultures</th>
                    <th className="p-2">IV Antibiotics</th>
                    <th className="p-2">&lt; 60m</th>
                    <th className="p-2">Fluids (30 mL/kg)</th>
                    <th className="p-2">Vasopressor</th>
                    <th className="p-2">MAP ≥ 65</th>
                    <th className="p-2">Repeat Lactate</th>
                    <th className="p-2">Urine Output</th>
                    <th className="p-2">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="p-2 whitespace-nowrap text-slate-600 font-semibold">
                        {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-2 font-medium">{log.blood_cultures_drawn ? '✅ Drawn' : 'Pending'}</td>
                      <td className="p-2 text-slate-800 font-bold max-w-xs truncate">{log.antibiotic_name_regimen || '—'}</td>
                      <td className="p-2">{log.antibiotic_within_60m ? '⚡ < 60m' : 'Delayed'}</td>
                      <td className="p-2">{log.fluid_bolus_30ml_per_kg_given ? `${log.fluid_bolus_volume_ml ?? 2000} mL` : '—'}</td>
                      <td className="p-2">{log.norepinephrine_vasopressor_active ? `Active (${log.vasopressor_dose_mcg_min ?? '—'} mcg)` : 'None'}</td>
                      <td className="p-2 font-bold">{log.target_map_achieved_gte_65 ? 'Yes' : 'No'}</td>
                      <td className="p-2 font-bold">{log.repeat_lactate_mmol_l ? `${log.repeat_lactate_mmol_l} mmol/L` : '—'}</td>
                      <td className="p-2">{log.urine_output_ml_hr ? `${log.urine_output_ml_hr} mL/hr` : '—'}</td>
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
            <p className="font-bold text-slate-900">Attending Obstetrician &amp; Gynecologist:</p>
            <p className="text-slate-600">{a.assessed_by_name || 'Dr. Anita Desai, MS (OBGYN)'}</p>
            <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
            <p className="text-[10px] text-slate-400 mt-1">Signature &amp; Medical Registration Stamp</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Maternal Critical Care Intensivist:</p>
            <p className="text-slate-600">Lead Consultant, Obstetric HDU / ICU</p>
            <div className="h-12 border-b border-dashed border-slate-400 mt-2"></div>
            <p className="text-[10px] text-slate-400 mt-1">Countersignature &amp; ICU Admission Review</p>
          </div>
        </div>
      </div>
    </div>
  );
};
