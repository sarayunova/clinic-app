import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricStatusEpilepticusPrint } from '../api';

export const PediatricStatusEpilepticusPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPediatricStatusEpilepticusPrint(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading status epilepticus dossier...</div>;
  if (!data || !data.episode) return <div className="p-8 text-center text-red-500">Episode not found.</div>;

  const { episode, patient, logs, printedAt, printedBy } = data;

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white text-gray-900 font-sans print:p-0">
      {/* Header */}
      <div className="border-b-2 border-red-700 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black text-red-900 tracking-wide uppercase">
            Pediatric Emergency & Intensive Care Unit (PICU)
          </h1>
          <h2 className="text-sm font-bold text-gray-700">
            Pediatric Status Epilepticus Emergency Resuscitation Dossier
          </h2>
          <p className="text-xs text-gray-500">
            American Epilepsy Society (AES 2016) / PALS 2025 / ESETT Resuscitation Algorithm
          </p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>Report Ref: <strong className="font-mono text-gray-900">{episode.episode_code}</strong></div>
          <div>Printed: {new Date(printedAt).toLocaleString()}</div>
          <div>Physician: {printedBy}</div>
        </div>
      </div>

      {/* Patient & Demographics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs mb-6">
        <div>
          <span className="text-gray-500 block">Patient Name:</span>
          <strong className="text-gray-900 text-sm">{patient?.full_name ?? `ID #${episode.patient_id}`}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Age / Weight:</span>
          <strong>{episode.age_months} months / {episode.weight_kg} kg</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Seizure Onset:</span>
          <strong>{new Date(episode.seizure_onset_datetime).toLocaleTimeString()}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Status:</span>
          <strong className="text-red-900 uppercase">{episode.status.replace(/_/g, ' ')}</strong>
        </div>
      </div>

      {/* Etiology & Semiology */}
      <div className="border border-red-300 rounded-lg p-4 bg-red-50/50 mb-6">
        <h3 className="font-bold text-sm text-red-950 uppercase mb-2">
          Clinical Seizure Characteristics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded border border-red-200">
          <div>Etiology: <strong className="capitalize">{episode.etiology.replace(/_/g, ' ')}</strong></div>
          <div>Semiology: <strong className="capitalize">{episode.seizure_semiology.replace(/_/g, ' ')}</strong></div>
          <div>Seizure Cessation: <strong>{episode.seizure_cessation_minute ? `Minute ${episode.seizure_cessation_minute}` : 'Ongoing / Refractory'}</strong></div>
        </div>
      </div>

      {/* Medication Tiers */}
      <div className="grid grid-cols-3 gap-3 text-xs mb-6">
        <div className="border p-3 rounded-lg bg-gray-50">
          <h4 className="font-bold text-red-900 uppercase mb-1">Phase 1: Emergent Benzo</h4>
          <p>Administered: <strong>{episode.phase1_benzo_given ? 'YES' : 'NO'}</strong></p>
          <p>Agent: <strong>{episode.phase1_benzo_agent?.replace(/_/g, ' ') ?? '-'}</strong></p>
          <p>Dose: <strong>{episode.phase1_benzo_dose_mg ? `${episode.phase1_benzo_dose_mg} mg` : '-'}</strong></p>
          <p>Administered Minute: <strong>{episode.phase1_administered_minute ? `Min ${episode.phase1_administered_minute}` : '-'}</strong></p>
        </div>

        <div className="border p-3 rounded-lg bg-gray-50">
          <h4 className="font-bold text-amber-900 uppercase mb-1">Phase 2: Second-Line AED</h4>
          <p>Administered: <strong>{episode.phase2_second_line_given ? 'YES' : 'NO'}</strong></p>
          <p>Agent: <strong className="capitalize">{episode.phase2_agent?.replace(/_/g, ' ') ?? '-'}</strong></p>
          <p>Dose: <strong>{episode.phase2_dose_mg ? `${episode.phase2_dose_mg} mg` : '-'}</strong></p>
          <p>Administered Minute: <strong>{episode.phase2_administered_minute ? `Min ${episode.phase2_administered_minute}` : '-'}</strong></p>
        </div>

        <div className="border p-3 rounded-lg bg-gray-50">
          <h4 className="font-bold text-purple-900 uppercase mb-1">Phase 3: Refractory Status</h4>
          <p>Refractory Status: <strong>{episode.phase3_refractory_status ? 'YES' : 'NO'}</strong></p>
          <p>Infusion Agent: <strong className="capitalize">{episode.phase3_infusion_agent?.replace(/_/g, ' ') ?? '-'}</strong></p>
          <p>Infusion Rate: <strong>{episode.phase3_infusion_rate_mcg_kg_min ? `${episode.phase3_infusion_rate_mcg_kg_min} mcg/kg/min` : '-'}</strong></p>
        </div>
      </div>

      {/* Bedside Timeline Checkpoints */}
      <div className="mb-6">
        <h3 className="font-bold text-sm text-gray-800 uppercase mb-2">
          Bedside Timeline Checkpoints ({logs?.length ?? 0})
        </h3>
        <table className="w-full text-xs text-left border">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="py-1.5 px-2">Minute / Time</th>
              <th className="py-1.5 px-2">Phase</th>
              <th className="py-1.5 px-2">Seizure</th>
              <th className="py-1.5 px-2">Vitals (HR / BP / SpO2)</th>
              <th className="py-1.5 px-2">Airway</th>
              <th className="py-1.5 px-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs?.map((lg: any) => (
              <tr key={lg.id}>
                <td className="py-1 px-2 font-bold">Min {lg.minutes_from_onset} ({new Date(lg.log_datetime).toLocaleTimeString()})</td>
                <td className="py-1 px-2">{lg.phase_active.replace(/_/g, ' ')}</td>
                <td className="py-1 px-2 font-bold uppercase">{lg.seizure_activity_present === 1 ? 'ONGOING' : 'ABATED'}</td>
                <td className="py-1 px-2 font-mono">{lg.vitals_hr ?? '-'}/min | {lg.vitals_sbp ?? '-'}/{lg.vitals_dbp ?? '-'} | {lg.vitals_spo2 ? `${lg.vitals_spo2}%` : '-'}</td>
                <td className="py-1 px-2">{lg.airway_status.replace(/_/g, ' ')}</td>
                <td className="py-1 px-2 text-gray-600">{lg.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Signature Box */}
      <div className="pt-8 border-t flex justify-between items-end text-xs text-gray-600">
        <div>
          <p className="font-semibold text-gray-800">Attending Pediatric Intensivist / Neurologist</p>
          <div className="h-10"></div>
          <p className="border-t border-gray-400 w-48 pt-1">Signature & Stamp</p>
        </div>
        <div className="text-right">
          <p>Confidential Emergency Resuscitation Record</p>
          <p>Generated by LiVi Clinic OS</p>
        </div>
      </div>
    </div>
  );
};
