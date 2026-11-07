import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalHypoglycemiaPrint } from '../api';

export const NeonatalHypoglycemiaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getNeonatalHypoglycemiaPrint(parseInt(id, 10))
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
      <div className="border-b-2 border-blue-900 pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-blue-950 uppercase">
            LiVi Mother & Child Hospital
          </h1>
          <p className="text-xs text-gray-600">NICU / Special Care Nursery • Neuro-Metabolic Critical Care</p>
          <p className="text-xs font-semibold text-blue-900 mt-1">
            NEONATAL HYPOGLYCEMIA, GIR & aEEG RESUSCITATION DOSSIER
          </p>
        </div>
        <div className="text-right text-xs">
          <div className="font-mono font-bold text-sm text-gray-900">{episode.episode_code}</div>
          <div className="text-gray-500">Printed: {new Date(printedAt).toLocaleString()}</div>
          <div className="text-gray-500">Clinician: {printedBy}</div>
        </div>
      </div>

      {/* Patient & Infant Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border text-xs">
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Infant / Patient</span>
          <span className="font-bold text-gray-900 text-sm">{patient.full_name}</span>
          <span className="text-[11px] text-gray-500 block">MRN: {patient.patient_number}</span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Age / Weight</span>
          <span className="font-bold text-gray-900 text-sm">
            {episode.age_hours} hours | {episode.current_weight_kg} kg
          </span>
          <span className="text-[11px] text-gray-500 block">Birth Wt: {episode.birth_weight_kg} kg</span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Evaluation Date</span>
          <span className="font-bold text-gray-900 text-sm">
            {new Date(episode.evaluation_datetime).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Protocol Status</span>
          <span className="font-bold uppercase text-blue-900 text-sm">
            {episode.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Clinical Target & GIR Snapshot */}
      <div className="grid grid-cols-3 gap-4 border p-4 rounded-lg bg-blue-50/40 text-xs">
        <div>
          <span className="text-blue-900 font-bold block uppercase">Blood Sugar & Target</span>
          <div className="text-lg font-black text-blue-950 mt-0.5">
            {episode.initial_blood_glucose_mg_dl} mg/dL
          </div>
          <span className="text-gray-600">AAP Target: &gt;={episode.glucose_target_mg_dl} mg/dL</span>
        </div>
        <div>
          <span className="text-blue-900 font-bold block uppercase">Glucose Infusion Rate (GIR)</span>
          <div className="text-lg font-black text-emerald-800 mt-0.5">
            {episode.current_gir_mg_kg_min} mg/kg/min
          </div>
          <span className="text-gray-600">
            {episode.fluid_dextrose_percent}% Dextrose @ {episode.fluid_rate_ml_hr} mL/hr
          </span>
        </div>
        <div>
          <span className="text-blue-900 font-bold block uppercase">D10W Mini-Bolus Given</span>
          <div className="text-lg font-black text-amber-800 mt-0.5">
            {episode.d10w_bolus_given_ml > 0 ? `${episode.d10w_bolus_given_ml} mL` : 'None'}
          </div>
          <span className="text-gray-600">Standard Dosing: 2 mL/kg over 5-10 min</span>
        </div>
      </div>

      {/* Neuro-Monitoring & Seizures */}
      <div className="border p-4 rounded-lg text-xs space-y-2 bg-purple-50/30 border-purple-200">
        <h3 className="font-bold text-purple-900 uppercase">aEEG Neuro-Monitoring & Seizure Profile</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-600 block">aEEG Background Pattern:</span>
            <span className="font-bold text-gray-900">
              {episode.aeeg_background_pattern.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <div>
            <span className="text-gray-600 block">Seizures Observed:</span>
            <span className="font-bold text-gray-900">
              {episode.seizure_activity_observed ? episode.seizure_type.replace(/_/g, ' ') : 'None'}
            </span>
          </div>
        </div>
        {episode.first_line_asm_given === 1 && (
          <div className="pt-2 border-t border-purple-200 font-medium text-purple-950">
            Anti-seizure Medications Administered: Phenobarbital{' '}
            {episode.phenobarbital_dose_mg ? `${episode.phenobarbital_dose_mg} mg` : 'standard dose'} IV
            {episode.levetiracetam_dose_mg ? `, Levetiracetam ${episode.levetiracetam_dose_mg} mg IV` : ''}.
          </div>
        )}
      </div>

      {/* Serial Flowsheet Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
          Bedside Serial Glucose & GIR Infusion History
        </h3>
        <table className="w-full text-xs border border-gray-300">
          <thead className="bg-gray-100 text-gray-700 font-bold border-b">
            <tr>
              <th className="py-2 px-2 border-r text-left">Log Time</th>
              <th className="py-2 px-2 border-r text-center">Hour</th>
              <th className="py-2 px-2 border-r text-right">Blood Sugar</th>
              <th className="py-2 px-2 border-r text-left">Fluid Infusion</th>
              <th className="py-2 px-2 border-r text-right">GIR</th>
              <th className="py-2 px-2 border-r text-left">Feed</th>
              <th className="py-2 px-2 border-r text-left">aEEG</th>
              <th className="py-2 px-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y text-gray-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-center text-gray-500">
                  No serial flowsheet logs recorded.
                </td>
              </tr>
            ) : (
              logs.map((l: any) => (
                <tr key={l.id}>
                  <td className="py-1.5 px-2 border-r whitespace-nowrap">
                    {new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1.5 px-2 border-r text-center">+{l.hours_on_protocol}h</td>
                  <td className="py-1.5 px-2 border-r text-right font-bold">{l.blood_glucose_mg_dl} mg/dL</td>
                  <td className="py-1.5 px-2 border-r">
                    {l.fluid_dextrose_percent}% @ {l.fluid_rate_ml_hr} mL/h
                  </td>
                  <td className="py-1.5 px-2 border-r text-right font-semibold text-blue-900">
                    {l.calculated_gir_mg_kg_min}
                  </td>
                  <td className="py-1.5 px-2 border-r">
                    {l.feeding_volume_ml > 0 ? `${l.feeding_volume_ml} mL (${l.feeding_type})` : '-'}
                  </td>
                  <td className="py-1.5 px-2 border-r font-mono text-[11px]">
                    {l.aeeg_pattern.slice(0, 12)}
                  </td>
                  <td className="py-1.5 px-2">{l.notes || '-'}</td>
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
          <span className="font-semibold text-gray-800">Attending Neonatologist Signature & Seal</span>
        </div>
        <div>
          <div className="border-b border-gray-400 pb-8 mb-1"></div>
          <span className="font-semibold text-gray-800">NICU Staff Nurse Signature & Registration No.</span>
        </div>
      </div>
    </div>
  );
};
