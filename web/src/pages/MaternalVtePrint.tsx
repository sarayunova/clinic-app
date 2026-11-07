import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getMaternalVteAssessment,
  auditMaternalVtePrint,
  type MaternalVteAssessmentRecord,
  type MaternalVteDoseLogRecord,
} from '../api';

export const MaternalVtePrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    assessment: MaternalVteAssessmentRecord;
    doseLogs: MaternalVteDoseLogRecord[];
    neuraxialStatus: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getMaternalVteAssessment(Number(id));
        setData(res);
        await auditMaternalVtePrint(Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load Maternal VTE report');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading Maternal VTE Risk & Thromboprophylaxis Dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'Maternal VTE assessment not found'}
        </div>
        <Link to="/maternal-vte" className="text-rose-700 underline text-sm">
          ← Return to VTE Console
        </Link>
      </div>
    );
  }

  const { assessment: a, doseLogs: doses, neuraxialStatus: ns } = data;

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans print:p-0">
      {/* Top action toolbar (hidden on print) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          to={`/patients/${a.patient_id}?tab=maternal_vte`}
          className="text-xs font-semibold text-rose-700 hover:underline flex items-center gap-1"
        >
          ← Return to Patient Chart
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-rose-800 text-white rounded-lg text-xs font-bold shadow hover:bg-rose-900 flex items-center gap-2"
        >
          <span>🖨️</span> Print Legal Clinical Record
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto border border-gray-300 p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Hospital Header */}
        <div className="border-b-2 border-rose-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-rose-950 uppercase tracking-tight">
              LiVi Women & Maternal Healthcare
            </h1>
            <p className="text-xs text-slate-600">
              Maternal Venous Thromboembolism (VTE) Risk Assessment & Thromboprophylaxis Dossier
            </p>
            <p className="text-[10px] text-slate-500">
              References: RCOG Green-top Guideline No. 37a & ACOG Practice Bulletin No. 196
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-black text-rose-900 bg-rose-50 px-2.5 py-1 border border-rose-200 rounded">
              VTE-ASSESS-{a.id}
            </span>
            <p className="text-[10px] text-slate-500 mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>
        </div>

        {/* Patient Demographics Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Patient Name</span>
            <span className="font-bold text-slate-900 text-sm">{a.patient_name}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">UHID</span>
            <span className="font-mono font-bold text-slate-900">{a.patient_uhid}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Stage & Gestation</span>
            <span className="font-bold text-slate-900">
              {a.assessment_type.replace(/_/g, ' ').toUpperCase()} {a.gestational_age_weeks ? `(${a.gestational_age_weeks}w)` : ''}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Weight & BMI</span>
            <span className="font-bold text-slate-900">{a.current_weight_kg} kg • BMI {a.bmi} kg/m²</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Assessment Datetime</span>
            <span className="font-semibold text-slate-800">{new Date(a.assessment_datetime).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Assessing Clinician</span>
            <span className="font-semibold text-slate-800">{a.assessed_by_name || 'Attending Obstetrician'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">RCOG Total Score</span>
            <span className="font-black text-rose-900 text-sm">{a.total_vte_score} Points</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Stratified Risk Tier</span>
            <span className="font-bold text-slate-900 uppercase">{a.risk_tier.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* LMWH Dosing & Stockings Summary Box */}
        <div className="border border-rose-300 rounded-lg p-4 mb-6 bg-rose-50/40">
          <h3 className="text-xs font-bold text-rose-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>💊</span> Prescribed Thromboprophylaxis Regimen
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">LMWH Agent</span>
              <span className="font-bold text-rose-950 uppercase">{a.lmwh_agent || 'None (Low Risk)'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Daily Calibrated Dose</span>
              <span className="font-bold text-rose-950">{a.lmwh_daily_dose_mg_or_units || 'Mobilization & Hydration'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Weight Tier Band</span>
              <span className="font-bold text-slate-800">{a.weight_tier_bracket || 'Standard (50-90 kg)'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Anti-Embolic Stockings</span>
              <span className="font-bold text-purple-900">{a.anti_embolic_stockings_ordered === 1 ? 'YES (Graduated GECS)' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Neuraxial Anesthesia Safety Notice */}
        <div className="border-2 border-amber-300 rounded-lg p-4 mb-6 bg-amber-50 text-xs text-amber-950 space-y-1">
          <div className="font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span>⚠️</span> Mandatory Neuraxial Regional Anesthesia Safety Clearances (ACOG & ASRA)
          </div>
          <p>
            • <strong>Prophylactic LMWH:</strong> Minimum <strong>12 hours</strong> delay must elapse between the last subcutaneous dose and spinal/epidural needle placement or catheter removal.
          </p>
          <p>
            • <strong>Therapeutic LMWH:</strong> Minimum <strong>24 hours</strong> delay required.
          </p>
          <p>
            • <strong>Catheter Removal:</strong> Next dose of LMWH must NOT be administered for at least <strong>4 hours</strong> after epidural catheter extraction.
          </p>
          {ns && (
            <div className="mt-2 pt-2 border-t border-amber-200 font-bold">
              Current Anesthesia Status: <span className={ns.isEligibleNow ? 'text-emerald-700' : 'text-rose-700'}>{ns.statusLabel}</span>
            </div>
          )}
        </div>

        {/* Historical LMWH Dose Administration Table */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            LMWH Administration Flowsheet & Laboratory Surveillance Log
          </h3>
          <table className="min-w-full border border-slate-300 text-[10px]">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th className="p-1.5 border-r text-left">Administered Date & Time</th>
                <th className="p-1.5 border-r text-left">Agent & Dose</th>
                <th className="p-1.5 border-r text-center">Route & Site</th>
                <th className="p-1.5 border-r text-center">Platelet Count</th>
                <th className="p-1.5 border-r text-center">Bleeding Signs</th>
                <th className="p-1.5 text-left">Administering Nurse / Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {doses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                    No LMWH doses recorded on this flowsheet.
                  </td>
                </tr>
              ) : (
                doses.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-1.5 border-r font-mono">
                      {new Date(d.administered_at).toLocaleString()}
                    </td>
                    <td className="p-1.5 border-r font-bold text-rose-950">
                      {d.agent} ({d.dose})
                    </td>
                    <td className="p-1.5 border-r text-center uppercase">
                      {d.route} • {d.site?.replace(/_/g, ' ') || 'Subcutaneous'}
                    </td>
                    <td className="p-1.5 border-r text-center font-mono">
                      {d.platelet_count ? `${d.platelet_count.toLocaleString()}/µL` : '—'}
                    </td>
                    <td className="p-1.5 border-r text-center font-bold">
                      <span className={d.bleeding_signs_observed === 1 ? 'text-red-700' : 'text-emerald-700'}>
                        {d.bleeding_signs_observed === 1 ? 'BLEEDING NOTED' : 'None'}
                      </span>
                    </td>
                    <td className="p-1.5">
                      {d.administered_by_name || 'Staff Nurse'} {d.notes && `— ${d.notes}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Clinical Notes */}
        {a.clinical_notes && (
          <div className="border border-slate-200 rounded p-3 mb-8 bg-slate-50 text-xs">
            <span className="font-bold text-slate-700 block mb-1">Obstetrician Clinical Summary & Follow-up:</span>
            <p className="text-slate-800">{a.clinical_notes}</p>
          </div>
        )}

        {/* Signature Blocks */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
          <div>
            <div className="border-b border-slate-400 pb-8 mb-2"></div>
            <p className="font-bold text-slate-800">Consultant Obstetrician & Gynecologist</p>
            <p className="text-[10px] text-slate-500">Reg No: ____________________ • Signature & Seal</p>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-8 mb-2"></div>
            <p className="font-bold text-slate-800">Consultant Obstetric Anesthesiologist</p>
            <p className="text-[10px] text-slate-500">Neuraxial Safety Clearance Verified</p>
          </div>
        </div>
      </div>
    </div>
  );
};
