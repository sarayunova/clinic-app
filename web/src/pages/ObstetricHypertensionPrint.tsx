import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getObstetricHypertensiveCrisis,
  auditObstetricHypertensionPrint,
  type ObstetricHypertensiveCrisisRecord,
  type ObstetricHypertensiveDoseRecord,
} from '../api';

export const ObstetricHypertensionPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    crisis: ObstetricHypertensiveCrisisRecord;
    doseLogs: ObstetricHypertensiveDoseRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getObstetricHypertensiveCrisis(parseInt(id, 10));
        setData(res);
        await auditObstetricHypertensionPrint(parseInt(id, 10));
      } catch (err: any) {
        setError(err.message || 'Failed to load hypertensive crisis dossier');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Generating hypertensive crisis dossier...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>{error || 'Record not found'}</p>
        <Link to="/obstetric-hypertension" className="mt-4 inline-block text-blue-600 hover:underline">
          Return to Console
        </Link>
      </div>
    );
  }

  const { crisis, doseLogs } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 print:p-0 print:max-w-none text-xs">
      {/* Print Toolbar */}
      <div className="print:hidden mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-xl border border-gray-200">
        <div>
          <span className="font-bold text-sm text-gray-800">Printable Clinical Dossier</span>
          <p className="text-xs text-gray-500">Emergency Obstetric Resuscitation Record</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/patients/${crisis.patient_id}`}
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
          <h1 className="text-xl font-black text-rose-900 tracking-tight">LIVI HEALTHCARE CLINIC & MATERNITY</h1>
          <p className="text-[10px] text-gray-600">Department of Obstetrics & Gynecology | Obstetric High Dependency Unit (HDU)</p>
          <p className="text-[10px] text-gray-500">Emergent Antihypertensive Resuscitation Protocol (ACOG Practice Bulletin No. 222)</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-2.5 py-1 bg-rose-100 text-rose-900 rounded font-black text-[11px] uppercase tracking-wider">
            HYPERTENSIVE CRISIS DOSSIER
          </span>
          <div className="text-[10px] text-gray-500 mt-1">Record ID: {crisis.crisis_code}</div>
        </div>
      </div>

      {/* Patient Demographics */}
      <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
        <div>
          <span className="text-gray-500 block text-[10px]">Patient Name:</span>
          <span className="font-bold text-gray-900">{crisis.patient_name || `Patient #${crisis.patient_id}`}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">UHID / Record:</span>
          <span className="font-bold text-gray-900">{crisis.patient_uhid || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Onset Phase / Gestation:</span>
          <span className="font-bold text-gray-900 capitalize">
            {crisis.onset_phase} ({crisis.gestation_weeks ? `${crisis.gestation_weeks} weeks` : 'Postpartum'})
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Initiation Datetime:</span>
          <span className="font-bold text-gray-900">{new Date(crisis.crisis_datetime).toLocaleString()}</span>
        </div>
      </div>

      {/* Section 1: Initial Presentation & Hemodynamics */}
      <div className="border border-gray-300 rounded-lg p-3 mb-4 space-y-2">
        <div className="flex justify-between items-center border-b pb-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">
            1. Severe Hypertensive Crisis Hemodynamic Profile
          </span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
              crisis.blood_pressure_controlled ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {crisis.blood_pressure_controlled ? 'BP Controlled' : 'Active Crisis Escalation'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1 text-[11px]">
          <div>
            <span className="text-gray-500">Initial Severe BP:</span>{' '}
            <span className="font-bold text-rose-800">{crisis.initial_sbp}/{crisis.initial_dbp} mmHg</span>
          </div>
          <div>
            <span className="text-gray-500">Initial MAP:</span>{' '}
            <span className="font-bold text-gray-900">{crisis.initial_map} mmHg</span>
          </div>
          <div>
            <span className="text-gray-500">Latest BP Response:</span>{' '}
            <span className="font-bold text-gray-900">
              {crisis.final_sbp && crisis.final_dbp ? `${crisis.final_sbp}/${crisis.final_dbp} mmHg` : 'In progress'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Latest MAP:</span>{' '}
            <span className="font-bold text-gray-900">{crisis.final_map ? `${crisis.final_map} mmHg` : '-'}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-[11px]">
          <div>
            <span className="text-gray-500">First-Line Selected:</span>{' '}
            <span className="font-semibold uppercase">{crisis.first_line_agent}</span>
          </div>
          <div>
            <span className="text-gray-500">Asthma / Bradycardia:</span>{' '}
            <span className="font-semibold">
              {crisis.asthma_history ? 'Asthma +' : 'Asthma -'} / {crisis.bradycardia_history ? 'Brady +' : 'Brady -'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">MgSO₄ Seizure Prophylaxis:</span>{' '}
            <span className="font-semibold">{crisis.mgso4_co_administered ? '✅ Active Zuspan Regimen' : 'None'}</span>
          </div>
        </div>
      </div>

      {/* Section 2: Cumulative Dosages & PPCM BOARD */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-gray-300 rounded-lg p-3 space-y-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1">
            2. Cumulative Antihypertensive Administered
          </span>
          <div className="text-[11px]">
            <span className="text-gray-500">IV Labetalol:</span>{' '}
            <span className="font-bold text-gray-900">{crisis.cumulative_labetalol_mg} mg</span> (Max 300 mg)
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">IV Hydralazine:</span>{' '}
            <span className="font-bold text-gray-900">{crisis.cumulative_hydralazine_mg} mg</span> (Max 20 mg)
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">Oral Nifedipine:</span>{' '}
            <span className="font-bold text-gray-900">{crisis.cumulative_nifedipine_mg} mg</span>
          </div>
        </div>

        <div className="border border-gray-300 rounded-lg p-3 space-y-1.5">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1">
            3. Peripartum Cardiomyopathy (PPCM) BOARD
          </span>
          <div className="text-[11px]">
            <span className="text-gray-500">PPCM Screen:</span>{' '}
            <span className="font-semibold">{crisis.ppcm_screen_positive ? '⚠️ Positive' : 'Negative'}</span>{' '}
            {crisis.lvef_percent && `(LVEF: ${crisis.lvef_percent}%)`}
          </div>
          <div className="text-[11px]">
            <span className="text-gray-500">Biomarkers:</span>{' '}
            <span>
              NT-proBNP {crisis.nt_pro_bnp_pg_ml ?? 'N/A'} pg/mL | Troponin-I {crisis.troponin_i_ng_ml ?? 'N/A'}
            </span>
          </div>
          <div className="text-[10px] text-gray-600">
            BOARD: Bromocriptine {crisis.board_bromocriptine_started ? 'Yes' : 'No'} | Anticoagulation{' '}
            {crisis.board_anticoagulation_started ? 'LMWH' : 'No'} | Diuretics {crisis.board_diuretics_started ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      {/* Section 3: Chronological Dose Log */}
      <div className="border border-gray-300 rounded-lg p-3 mb-4">
        <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block border-b pb-1 mb-2">
          4. Chronological Step-by-Step Medication Administration Log
        </span>

        {doseLogs.length === 0 ? (
          <p className="text-gray-400 italic text-[11px]">No dose checkpoints recorded.</p>
        ) : (
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-700">
                <th className="py-1 px-1.5">Step</th>
                <th className="py-1 px-1.5">Time</th>
                <th className="py-1 px-1.5">Medication & Dose</th>
                <th className="py-1 px-1.5">Route</th>
                <th className="py-1 px-1.5">Pre-Dose BP (MAP)</th>
                <th className="py-1 px-1.5">Fetal HR</th>
                <th className="py-1 px-1.5">Maternal Symptoms</th>
                <th className="py-1 px-1.5">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {doseLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-1 px-1.5 font-bold">Step {log.step_number}</td>
                  <td className="py-1 px-1.5 text-gray-500">
                    {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1 px-1.5 font-semibold text-gray-900">
                    {log.medication_administered} ({log.dose_value} {log.dose_unit})
                  </td>
                  <td className="py-1 px-1.5">{log.route}</td>
                  <td className="py-1 px-1.5 font-bold text-rose-800">
                    {log.sbp}/{log.dbp} ({log.map_mmhg})
                  </td>
                  <td className="py-1 px-1.5">{log.fetal_heart_rate ?? '-'}</td>
                  <td className="py-1 px-1.5 text-gray-600">{log.maternal_symptoms || '-'}</td>
                  <td className="py-1 px-1.5 text-gray-600">{log.logged_by_name || 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clinical Notes */}
      {crisis.clinical_notes && (
        <div className="border border-gray-300 rounded-lg p-3 mb-6 text-[11px]">
          <span className="font-bold text-gray-800 uppercase block mb-1">Obstetric Management & Delivery Plan:</span>
          <p className="text-gray-700">{crisis.clinical_notes}</p>
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-[11px]">
        <div>
          <div className="h-10 border-b border-gray-400 mb-1"></div>
          <span className="font-bold text-gray-800 block">Labor & Delivery Charge Nurse</span>
          <span className="text-gray-500 text-[10px]">Verified Vital Signs & Medication Dosing</span>
        </div>
        <div className="text-right">
          <div className="h-10 border-b border-gray-400 mb-1"></div>
          <span className="font-bold text-gray-800 block">
            {crisis.consultant_name || 'Consultant Obstetrician & Gynecologist'}
          </span>
          <span className="text-gray-500 text-[10px]">Consultant Obstetrician & Reg. Medical Officer</span>
        </div>
      </div>
    </div>
  );
};
