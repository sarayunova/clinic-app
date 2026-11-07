import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getNeonatalSepsisEpisode,
  auditNeonatalSepsisPrint,
  type NeonatalSepsisRecord,
  type NeonatalInotropeRecord,
} from '../api';

export const NeonatalSepsisPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalSepsisRecord;
    inotropeLogs: NeonatalInotropeRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getNeonatalSepsisEpisode(parseInt(id, 10));
        setData(res);
        await auditNeonatalSepsisPrint(parseInt(id, 10));
      } catch (err: any) {
        setError(err.message || 'Failed to load neonatal sepsis dossier');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Generating neonatal sepsis dossier...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>{error || 'Record not found'}</p>
        <Link to="/neonatal-sepsis" className="mt-4 inline-block text-blue-600 hover:underline">
          Return to Sepsis Console
        </Link>
      </div>
    );
  }

  const { episode, inotropeLogs } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 print:p-0 print:max-w-none text-xs">
      {/* Print Trigger & Back Toolbar */}
      <div className="print:hidden mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-xl border border-gray-200">
        <div>
          <span className="font-bold text-sm text-gray-800">Printable Clinical Dossier</span>
          <p className="text-xs text-gray-500">Official medical record documentation</p>
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
            className="px-4 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-bold shadow hover:bg-rose-800"
          >
            Print Dossier (PDF)
          </button>
        </div>
      </div>

      {/* Letterhead */}
      <div className="border-b-2 border-rose-800 pb-4 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-rose-900 tracking-tight">LIVI HEALTHCARE CLINIC & NICU</h1>
          <p className="text-[10px] text-gray-600">Level-3 Neonatal Intensive Care & High-Risk Perinatal Center</p>
          <p className="text-[10px] text-gray-500">Statutory Clinical Resuscitation & Sepsis Surveillance Protocol</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-900 rounded font-black text-[11px] uppercase tracking-wider">
            NEONATAL SEPSIS DOSSIER
          </span>
          <div className="text-[10px] text-gray-500 mt-1">Dossier ID: {episode.episode_code}</div>
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
          <span className="text-gray-500 block text-[10px]">Gestational Age / Weight:</span>
          <span className="font-bold text-gray-900">{episode.gestational_age_weeks}w {episode.gestational_age_days}d ({episode.birth_weight_kg} kg)</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Evaluation Time:</span>
          <span className="font-bold text-gray-900">{new Date(episode.evaluation_datetime).toLocaleString()}</span>
        </div>
      </div>

      {/* Section 1: Kaiser EOS Risk & Recommendation */}
      <div className="border border-gray-300 rounded-lg p-3 mb-4 space-y-2">
        <div className="flex justify-between items-center border-b pb-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">
            1. Kaiser Permanente Early-Onset Sepsis (EOS) Multi-Parameter Risk
          </span>
          <span className="font-bold text-rose-800">
            EOS Risk: {episode.eos_risk_per_1000} / 1,000 live births
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1 text-[11px]">
          <div>
            <span className="text-gray-500">Max Maternal Temp:</span> <span className="font-semibold">{episode.maternal_temp_celsius}°C</span>
          </div>
          <div>
            <span className="text-gray-500">Rupture of Membranes:</span> <span className="font-semibold">{episode.rom_hours} hours</span>
          </div>
          <div>
            <span className="text-gray-500">Maternal GBS:</span> <span className="font-semibold capitalize">{episode.maternal_gbs_status}</span>
          </div>
          <div>
            <span className="text-gray-500">Intrapartum IAP:</span> <span className="font-semibold capitalize">{episode.maternal_iap_status}</span>
          </div>
        </div>

        <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded flex justify-between items-center text-[11px]">
          <div>
            <span className="text-gray-500">Clinical Presentation:</span>{' '}
            <span className="font-bold uppercase text-rose-900">{episode.clinical_presentation.replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500">Stratified Recommendation:</span>{' '}
            <span className="font-black text-rose-900 uppercase">{episode.eos_recommendation.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Section 2: Antibiotics & Left Shift Hematology */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-gray-300 rounded-lg p-3 space-y-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1">
            2. Empiric Antimicrobial Stewardship
          </span>
          <div className="text-[11px]">
            <span className="text-gray-500">Ampicillin Dose:</span>{' '}
            <span className="font-semibold">{episode.ampicillin_dose_mg ? `${episode.ampicillin_dose_mg} mg IV q12h` : 'N/A'}</span>
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">Gentamicin Dose:</span>{' '}
            <span className="font-semibold">{episode.gentamicin_dose_mg ? `${episode.gentamicin_dose_mg} mg IV single daily` : 'N/A'}</span>
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">Blood Culture:</span>{' '}
            <span className="font-semibold">{episode.blood_culture_drawn ? 'Drawn prior to antibiotics' : 'Pending'}</span>{' '}
            ({episode.blood_culture_result || 'Pending'})
          </div>
        </div>

        <div className="border border-gray-300 rounded-lg p-3 space-y-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1">
            3. Hematologic Biomarkers & Left Shift
          </span>
          <div className="text-[11px]">
            <span className="text-gray-500">I/T Ratio:</span>{' '}
            <span className="font-bold text-gray-900">{episode.it_ratio ?? 'N/A'}</span>{' '}
            {episode.it_ratio && episode.it_ratio >= 0.2 && <span className="text-red-700 font-bold">(≥ 0.20 Elevated)</span>}
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">C-Reactive Protein:</span>{' '}
            <span className="font-semibold">{episode.crp_mg_l ? `${episode.crp_mg_l} mg/L` : 'N/A'}</span>
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">Platelet Count:</span>{' '}
            <span className="font-semibold">{episode.platelets_k_ul ? `${episode.platelets_k_ul}k/µL` : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Section 3: Targeted Hemodynamics & Inotropes */}
      <div className="border border-gray-300 rounded-lg p-3 mb-4">
        <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1 mb-2">
          4. Bedside Hemodynamics & Inotrope Flowsheet Chronology
        </span>

        {inotropeLogs.length === 0 ? (
          <p className="text-gray-400 italic text-[11px]">No serial inotrope flowsheet checkpoints logged.</p>
        ) : (
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-700">
                <th className="py-1 px-1.5">Hour</th>
                <th className="py-1 px-1.5">Time</th>
                <th className="py-1 px-1.5">HR</th>
                <th className="py-1 px-1.5">BP (MAP)</th>
                <th className="py-1 px-1.5">Pre/Post SpO₂ (Δ)</th>
                <th className="py-1 px-1.5">SVC / Urine</th>
                <th className="py-1 px-1.5">Inotropes (mcg/kg/min)</th>
                <th className="py-1 px-1.5">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inotropeLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-1 px-1.5 font-bold">{log.hours_on_inotropes}h</td>
                  <td className="py-1 px-1.5 text-gray-500">
                    {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1 px-1.5">{log.heart_rate_bpm ?? '-'}</td>
                  <td className="py-1 px-1.5">
                    {log.blood_pressure_systolic}/{log.blood_pressure_diastolic} ({log.map_mmhg})
                  </td>
                  <td className="py-1 px-1.5">
                    {log.pre_ductal_spo2}% / {log.post_ductal_spo2}% (Δ{log.delta_spo2}%)
                  </td>
                  <td className="py-1 px-1.5">
                    {log.svc_flow_ml_kg_min ?? '-'} / {log.urine_output_ml_kg_hr ?? '-'}
                  </td>
                  <td className="py-1 px-1.5 font-medium">
                    {[
                      log.dopamine_mcg_kg_min > 0 ? `Dopa ${log.dopamine_mcg_kg_min}` : '',
                      log.epinephrine_mcg_kg_min > 0 ? `Epi ${log.epinephrine_mcg_kg_min}` : '',
                      log.dobutamine_mcg_kg_min > 0 ? `Dobut ${log.dobutamine_mcg_kg_min}` : '',
                      log.milrinone_mcg_kg_min > 0 ? `Milr ${log.milrinone_mcg_kg_min}` : '',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'None'}
                  </td>
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
          <span className="font-bold text-gray-800 uppercase block mb-1">Clinical Notes & Action Plan:</span>
          <p className="text-gray-700">{episode.clinical_notes}</p>
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-[11px]">
        <div>
          <div className="h-10 border-b border-gray-400 mb-1"></div>
          <span className="font-bold text-gray-800 block">NICU / SNCU Fellow / Attending Nurse</span>
          <span className="text-gray-500 text-[10px]">Recorded & Validated Checkpoints</span>
        </div>
        <div className="text-right">
          <div className="h-10 border-b border-gray-400 mb-1"></div>
          <span className="font-bold text-gray-800 block">
            {episode.consultant_name || 'Consultant Neonatologist'}
          </span>
          <span className="text-gray-500 text-[10px]">Consultant Neonatologist & Reg. Medical Officer</span>
        </div>
      </div>
    </div>
  );
};
