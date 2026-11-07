import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricPphPrint } from '../api';

export const ObstetricPphPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getObstetricPphPrint(parseInt(id, 10))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load print dossier');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (data && !loading) {
      window.print();
    }
  }, [data, loading]);

  if (loading) return <div className="p-8 text-sm">Generating printable clinical dossier...</div>;
  if (error || !data) return <div className="p-8 text-sm text-red-600">{error || 'Episode not found'}</div>;

  const { episode, patient, logs, printedAt, printedBy } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans text-gray-900 space-y-6 print:p-0">
      {/* Clinic Header */}
      <div className="border-b-2 border-red-900 pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-red-950 uppercase">
            LiVi Mother & Child Hospital
          </h1>
          <p className="text-xs text-gray-600">Department of Obstetrics & Gynecology • Labor Ward & Obstetric HDU</p>
          <p className="text-xs font-semibold text-red-900 mt-1">
            POSTPARTUM HEMORRHAGE (PPH), GRAVIMETRIC QBL & WHO E-MOTIVE DOSSIER
          </p>
        </div>
        <div className="text-right text-xs">
          <div className="font-mono font-bold text-sm text-gray-900">{episode.episode_code}</div>
          <div className="text-gray-500">Printed: {new Date(printedAt).toLocaleString()}</div>
          <div className="text-gray-500">Managing Clinician: {printedBy}</div>
        </div>
      </div>

      {/* Patient & Delivery Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border text-xs">
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Patient Name</span>
          <span className="font-bold text-gray-900 text-sm">{patient.full_name}</span>
          <span className="text-[11px] text-gray-500 block">MRN: {patient.patient_number}</span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Delivery Mode / Gestation</span>
          <span className="font-bold text-gray-900 text-sm capitalize">
            {episode.delivery_mode} {episode.gestation_weeks ? `(${episode.gestation_weeks}w)` : ''}
          </span>
          <span className="text-[11px] text-gray-500 block">
            Recognized: {new Date(episode.pph_recognition_datetime).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">4T Etiology</span>
          <span className="font-bold text-gray-900 text-sm capitalize">
            {episode.etiology_4t.replace(/_/g, ' ')}
          </span>
          <span className="text-[11px] text-gray-500 block">
            {episode.maternal_hypertension_history ? 'HTN (No Ergometrine)' : 'No HTN'}
            {episode.maternal_asthma_history ? ' | Asthma (No PGF2a)' : ''}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Protocol Status</span>
          <span className="font-bold uppercase text-red-900 text-sm">
            {episode.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Hemodynamic & QBL Metrics */}
      <div className="grid grid-cols-3 gap-4 border p-4 rounded-lg bg-red-50/40 text-xs">
        <div>
          <span className="text-red-950 font-bold block uppercase">Cumulative QBL</span>
          <div className="text-xl font-black text-red-950 mt-0.5">
            {episode.gravimetric_qbl_ml} mL
          </div>
          <span className="text-gray-600">
            Drape: {episode.drape_blood_volume_ml} mL | Sponge: {episode.swab_sponge_weight_net_g}g
          </span>
        </div>
        <div>
          <span className="text-red-950 font-bold block uppercase">Initial Shock Index (HR/SBP)</span>
          <div className="text-xl font-black text-red-900 mt-0.5">
            {episode.shock_index}
          </div>
          <span className="text-gray-600">
            Initial Vitals: {episode.initial_sbp}/{episode.initial_dbp} mmHg, HR {episode.initial_heart_rate} bpm
          </span>
        </div>
        <div>
          <span className="text-red-950 font-bold block uppercase">Bakri Tamponade</span>
          <div className="text-base font-bold text-gray-900 mt-0.5">
            {episode.bakri_balloon_placed ? `${episode.bakri_fill_volume_ml} mL sterile saline` : 'Not Placed'}
          </div>
          <span className="text-gray-600 capitalize">
            Tamponade Test: {episode.tamponade_test_result.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* E-MOTIVE First Response Execution */}
      <div className="border p-4 rounded-lg text-xs space-y-2 bg-blue-50/40 border-blue-200">
        <h3 className="font-bold text-blue-950 uppercase">WHO E-MOTIVE First-Response Package Verification</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <span className="text-gray-500 block">Uterine Massage:</span>
            <span className="font-bold text-emerald-800">{episode.emotive_massage_done ? 'Completed' : 'Pending'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Oxytocin Infusion:</span>
            <span className="font-bold text-emerald-800">{episode.emotive_oxytocin_given ? 'Administered' : 'Pending'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Tranexamic Acid (TXA 1g):</span>
            <span className="font-bold text-emerald-800">{episode.emotive_txa_given ? 'Administered (<3h)' : 'Pending'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Warm IV Crystalloids:</span>
            <span className="font-bold text-emerald-800">{episode.emotive_iv_fluids_given ? 'Infused' : 'Pending'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Genital Tract Examination:</span>
            <span className="font-bold text-emerald-800">{episode.emotive_exam_completed ? 'Completed' : 'Pending'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Escalation Trigger:</span>
            <span className="font-bold text-red-800">{episode.emotive_escalation_needed ? 'Escalated' : 'Controlled'}</span>
          </div>
        </div>
      </div>

      {/* Serial Flowsheet Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
          Bedside Hemodynamic & Blood Loss Flowsheet History
        </h3>
        <table className="w-full text-xs border border-gray-300">
          <thead className="bg-gray-100 text-gray-700 font-bold border-b">
            <tr>
              <th className="py-2 px-2 border-r text-left">Time</th>
              <th className="py-2 px-2 border-r text-center">Elapsed</th>
              <th className="py-2 px-2 border-r text-right">Interval Loss</th>
              <th className="py-2 px-2 border-r text-right">Cumulative QBL</th>
              <th className="py-2 px-2 border-r text-center">BP</th>
              <th className="py-2 px-2 border-r text-center">HR</th>
              <th className="py-2 px-2 border-r text-center">SI</th>
              <th className="py-2 px-2 border-r text-left">Tone</th>
              <th className="py-2 px-2 text-left">Medication / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y text-gray-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-4 text-center text-gray-500">
                  No serial flowsheet logs recorded.
                </td>
              </tr>
            ) : (
              logs.map((l: any) => (
                <tr key={l.id}>
                  <td className="py-1.5 px-2 border-r whitespace-nowrap">
                    {new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1.5 px-2 border-r text-center">+{l.minutes_from_recognition}m</td>
                  <td className="py-1.5 px-2 border-r text-right font-semibold">+{l.interval_blood_loss_ml} mL</td>
                  <td className="py-1.5 px-2 border-r text-right font-black text-red-950">{l.cumulative_qbl_ml} mL</td>
                  <td className="py-1.5 px-2 border-r text-center font-mono">{l.sbp}/{l.dbp}</td>
                  <td className="py-1.5 px-2 border-r text-center font-bold text-red-700">{l.heart_rate_bpm}</td>
                  <td className="py-1.5 px-2 border-r text-center font-semibold">{l.calculated_shock_index}</td>
                  <td className="py-1.5 px-2 border-r capitalize">{l.uterine_tone.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 px-2">{l.medication_given || l.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Notes */}
      {episode.clinical_notes && (
        <div className="border p-3 rounded text-xs bg-gray-50">
          <span className="font-bold text-gray-700 block uppercase">Consultant Clinical Notes:</span>
          <p className="mt-1 text-gray-800">{episode.clinical_notes}</p>
        </div>
      )}

      {/* Sign-off signatures */}
      <div className="pt-8 border-t grid grid-cols-2 gap-8 text-xs">
        <div>
          <div className="border-b border-gray-400 pb-8 mb-1"></div>
          <span className="font-semibold text-gray-800">Attending Consultant Obstetrician Signature</span>
        </div>
        <div>
          <div className="border-b border-gray-400 pb-8 mb-1"></div>
          <span className="font-semibold text-gray-800">Labor Ward Nurse / Midwife In-Charge</span>
        </div>
      </div>
    </div>
  );
};
