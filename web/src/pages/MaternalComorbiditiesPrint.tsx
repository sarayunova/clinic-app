import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getMaternalCardiacAssessment,
  getMaternalIcpEpisode,
  auditMaternalComorbiditiesPrint,
  type MaternalCardiacRecord,
  type MaternalIcpRecord,
} from '../api';

export const MaternalComorbiditiesPrint: React.FC = () => {
  const { type, id } = useParams<{ type: 'cardiac' | 'icp'; id: string }>();
  const [cardiac, setCardiac] = useState<MaternalCardiacRecord | null>(null);
  const [icp, setIcp] = useState<MaternalIcpRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) return;
    const fetchDoc = async () => {
      setLoading(true);
      try {
        if (type === 'cardiac') {
          const res = await getMaternalCardiacAssessment(Number(id));
          setCardiac(res.assessment);
        } else {
          const res = await getMaternalIcpEpisode(Number(id));
          setIcp(res.episode);
        }
        await auditMaternalComorbiditiesPrint(type, Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [type, id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading Maternal Comorbidities Consultation Dossier...
      </div>
    );
  }

  if (error || (!cardiac && !icp)) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'Record not found'}
        </div>
        <Link to="/maternal-comorbidities" className="text-blue-600 underline text-sm">
          &larr; Return to Maternal Comorbidities Console
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans">
      {/* Non-printing Control Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden bg-slate-100 p-3 rounded-lg border border-slate-300">
        <Link to="/maternal-comorbidities" className="text-blue-600 hover:underline text-xs font-semibold">
          &larr; Back to Maternal Comorbidities Console
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-rose-700 text-white rounded-lg text-xs font-bold hover:bg-rose-800 shadow"
        >
          🖨️ Print Consultation Dossier
        </button>
      </div>

      {/* Sheet Container */}
      <div className="max-w-4xl mx-auto border-2 border-slate-800 p-6 rounded-lg space-y-5">
        {/* Header */}
        <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              DIVISION OF HIGH-RISK MATERNAL-FETAL MEDICINE
            </h1>
            <h2 className="text-sm font-bold text-slate-700">
              {type === 'cardiac'
                ? 'Cardio-Obstetrics Consultation & CARPREG-II Hemodynamic Delivery Plan'
                : 'Intrahepatic Cholestasis of Pregnancy (ICP) Surveillance & Delivery Plan'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Reference: {type === 'cardiac' ? 'ESC Guidelines on Cardiovascular Disease in Pregnancy' : 'RCOG Green-top Guideline #43'}
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-sm font-bold block text-rose-900">
              {cardiac?.assessment_code || icp?.episode_code}
            </span>
            <span className="text-[11px] text-slate-500">
              {cardiac?.assessment_datetime.slice(0, 16).replace('T', ' ') || icp?.observation_datetime.slice(0, 16).replace('T', ' ')}
            </span>
          </div>
        </div>

        {/* Patient Demographics */}
        <div className="bg-slate-50 p-3 rounded border border-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
            <strong className="text-slate-900">{cardiac?.patient_name || icp?.patient_name}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">UHID</span>
            <strong className="font-mono text-slate-900">{cardiac?.patient_uhid || icp?.patient_uhid}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Gestation</span>
            <strong className="text-slate-900">
              {cardiac?.gestational_age_weeks ? `${cardiac.gestational_age_weeks} Weeks` : icp ? `${icp.gestational_age_weeks} Weeks` : 'N/A'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Category</span>
            <strong className="text-slate-900 uppercase">{type === 'cardiac' ? 'Cardiac High-Risk' : 'Obstetric Cholestasis'}</strong>
          </div>
        </div>

        {/* CARDIAC SPECIFIC VIEW */}
        {cardiac && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-50/70 rounded border border-rose-200">
              <span className="text-[10px] uppercase font-bold text-rose-900 block">Cardiac Diagnosis</span>
              <p className="text-base font-bold text-rose-950 mt-0.5">{cardiac.cardiac_diagnosis}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">mWHO Stratum</span>
                <strong className="text-sm text-slate-900 block mt-0.5">{cardiac.mwho_class.replace('_', ' ').toUpperCase()}</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">CARPREG-II Score</span>
                <strong className="text-sm text-rose-900 block mt-0.5">{cardiac.carpreg_ii_score} Points</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Predicted Event Rate</span>
                <strong className="text-sm text-slate-900 block mt-0.5">{cardiac.predicted_cardiac_event_risk_pct}%</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Postpartum ICU Bed</span>
                <strong className={`text-sm block mt-0.5 ${cardiac.icu_postpartum_bed_reserved ? 'text-rose-700' : 'text-slate-700'}`}>
                  {cardiac.icu_postpartum_bed_reserved ? 'MANDATORY RESERVED' : 'HDU / Routine Floor'}
                </strong>
              </div>
            </div>

            <div className="p-3 bg-white rounded border border-slate-300 text-xs space-y-2">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Multidisciplinary Hemodynamic Delivery Plan
              </h3>
              <div>
                <strong>Recommended Mode of Delivery:</strong> {cardiac.delivery_mode_recommendation}
              </div>
              {cardiac.monitoring_plan_antepartum && (
                <div>
                  <strong>Hemodynamic Monitoring:</strong> {cardiac.monitoring_plan_antepartum}
                </div>
              )}
              {cardiac.anesthesia_recommendation && (
                <div>
                  <strong>Anesthesia Guidance:</strong> {cardiac.anesthesia_recommendation}
                </div>
              )}
              {cardiac.notes && (
                <div className="pt-2 border-t border-slate-200 text-slate-600">
                  <strong>Consultant Notes:</strong> {cardiac.notes}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ICP SPECIFIC VIEW */}
        {icp && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-amber-50 rounded border border-amber-300">
                <span className="text-amber-900 block text-[10px] uppercase font-bold">Total Serum Bile Acids</span>
                <strong className="text-lg text-amber-950 font-black block mt-0.5">{icp.total_serum_bile_acids_umol_l} µmol/L</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Severity Tier</span>
                <strong className="text-sm text-slate-900 block mt-0.5 uppercase">{icp.icp_severity_tier.replace(/_/g, ' ')}</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">UDCA Prescribed</span>
                <strong className="text-sm text-slate-900 block mt-0.5">{icp.udca_prescribed_mg_day} mg/day ({icp.udca_dose_mg_kg_day} mg/kg)</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Recommended Delivery</span>
                <strong className="text-sm text-indigo-900 block mt-0.5">{icp.recommended_delivery_gestation_weeks} Weeks Gestation</strong>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-300 text-xs">
              <span className="font-bold text-slate-800 uppercase block mb-1">Concurrent Liver Enzymes:</span>
              <div className="grid grid-cols-3 gap-2">
                <span>ALT: <strong>{icp.alt_u_l ? `${icp.alt_u_l} U/L` : 'N/A'}</strong></span>
                <span>AST: <strong>{icp.ast_u_l ? `${icp.ast_u_l} U/L` : 'N/A'}</strong></span>
                <span>Total Bilirubin: <strong>{icp.total_bilirubin_mg_dl ? `${icp.total_bilirubin_mg_dl} mg/dL` : 'N/A'}</strong></span>
              </div>
            </div>

            {icp.clinical_notes && (
              <div className="p-3 bg-white rounded border border-slate-300 text-xs">
                <span className="font-bold text-slate-800 block mb-0.5">Surveillance & Fetal Monitoring Plan:</span>
                <p className="text-slate-700">{icp.clinical_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Signatures */}
        <div className="pt-6 border-t-2 border-slate-800 grid grid-cols-2 gap-6 text-xs">
          <div className="border-t border-slate-400 pt-2 text-center">
            <span className="font-bold block text-slate-900">
              {cardiac?.consultant_obgyn_name || icp?.assessed_by_name || 'Consultant Obstetrician'}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Consultant Maternal-Fetal Medicine</span>
          </div>

          <div className="border-t border-slate-400 pt-2 text-center">
            <span className="font-bold block text-slate-900">
              {cardiac?.attending_cardiologist_name || 'Cardiologist / Physician Sign-off'}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Specialist Physician / Cardio-Obstetrician</span>
          </div>
        </div>
      </div>
    </div>
  );
};
