import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getNeonatalMasEpisode, type NeonatalMasRecord, type NeonatalMasFlowsheetRecord } from '../api';

export const NeonatalMasPrint: React.FC = () => {
  const [searchParams] = useSearchParams();
  const idStr = searchParams.get('id');
  const id = idStr ? parseInt(idStr) : 0;

  const [episode, setEpisode] = useState<NeonatalMasRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalMasFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalMasEpisode(id)
      .then((res) => {
        setEpisode(res.episode);
        setLogs(res.logs);
        setEvalResult(res.evalResult);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm">Loading printable clinical dossier...</div>;
  if (!episode) return <div className="p-8 text-center text-sm text-red-600">Episode not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-sans print:p-0">
      {/* Print Trigger Button */}
      <div className="mb-6 flex justify-between items-center print:hidden">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-teal-600 text-white font-semibold rounded shadow hover:bg-teal-700 text-sm"
        >
          Print Dossier / Save PDF
        </button>
        <span className="text-xs text-gray-500">Official Hospital Inpatient Clinical Protocol Record</span>
      </div>

      {/* Header */}
      <div className="border-b-2 border-teal-800 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-teal-950">
              Neonatal Meconium Aspiration Syndrome (MAS) Protocol Dossier
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Clinical Guidelines: AAP NRP 8th Ed &bull; Cochrane Neonatal Review on Surfactant in MAS &bull; PPHN Management
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold text-sm text-gray-900 block">{episode.episode_code}</span>
            <span className="text-gray-500">
              Date: {new Date(episode.diagnosis_datetime).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Patient & Infant Demographics */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-gray-50 p-4 rounded border border-gray-200">
        <div>
          <span className="text-gray-500 block">Patient Name</span>
          <strong className="text-sm text-gray-900">{episode.patient_name || `Patient #${episode.patient_id}`}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Gestational Age & Weight</span>
          <strong className="text-sm text-gray-900">
            {episode.gestational_age_weeks} weeks &bull; Birth: {episode.birth_weight_grams}g &bull; Current: {episode.current_weight_kg} kg
          </strong>
        </div>
        <div>
          <span className="text-gray-500 block">Amniotic Fluid Consistency</span>
          <strong className="capitalize">{episode.amniotic_fluid_meconium_consistency.replace(/_/g, ' ')}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Delivery Room Vigor & Suction</span>
          <strong className="capitalize">
            {episode.delivery_room_vigor.replace(/_/g, ' ')} &bull; ET Suction:{' '}
            {episode.endotracheal_suctioning_performed === 1 ? 'Yes' : 'No'}
          </strong>
        </div>
      </div>

      {/* Ventilatory & Gas Exchange Metrics */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-teal-900">
          Respiratory Support & Hemodynamic Baseline
        </h2>
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Support Mode</span>
            <strong className="text-gray-900 capitalize">{episode.respiratory_support_mode.replace(/_/g, ' ')}</strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">FiO2 / MAP</span>
            <strong className="text-gray-900">{episode.fio2_percent}% / {episode.mean_airway_pressure_cmh2o} cmH2O</strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Oxygenation Index (OI)</span>
            <strong className="text-gray-900 text-sm">
              {episode.oxygenation_index !== null ? episode.oxygenation_index : 'N/A'}
            </strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Blood Gas (PaO2/PaCO2/pH)</span>
            <strong className="text-gray-900">
              {episode.pao2_mmhg ?? '-'}/{episode.paco2_mmhg ?? '-'}/{episode.arterial_ph ?? '-'}
            </strong>
          </div>
        </div>
      </div>

      {/* Therapeutics: Surfactant & iNO */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-teal-900">
          Pulmonary Vasodilator & Surfactant Management
        </h2>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Inhaled Nitric Oxide (iNO)</span>
            <strong className="text-purple-900">
              {episode.inhaled_nitric_oxide_prescribed === 1 ? `${episode.ino_dose_ppm} ppm Continuous` : 'None'}
            </strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Exogenous Surfactant</span>
            <strong className="text-blue-900">
              {episode.surfactant_administered === 1
                ? `${episode.surfactant_dose_mg_kg} mg/kg (${episode.surfactant_delivery_method.replace(/_/g, ' ')})`
                : 'Not Administered'}
            </strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Air Leak / Pneumothorax</span>
            <strong className="text-rose-900 capitalize">
              {episode.pulmonary_air_leak_present === 1 ? episode.air_leak_type.replace(/_/g, ' ') : 'None'}
            </strong>
          </div>
        </div>
      </div>

      {/* Clinical Evaluation Directives */}
      {evalResult && (
        <div className="mb-6 bg-teal-50 p-4 rounded border border-teal-200 text-xs space-y-2">
          <strong className="text-teal-950 uppercase block font-bold">
            Clinical Decision Support & Protocol Directives:
          </strong>
          <p className="text-teal-900 font-semibold">{evalResult.hypoxemicFailureLabel}</p>
          {evalResult.therapeuticActionPlan.map((plan: string, idx: number) => (
            <div key={idx} className="flex gap-2 text-teal-950">
              <span>&bull;</span>
              <span>{plan}</span>
            </div>
          ))}
        </div>
      )}

      {/* Flowsheet Table */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-teal-900">
          Serial Bedside Flowsheet Checkpoints
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No flowsheet logs recorded.</p>
        ) : (
          <table className="w-full text-xs text-left border border-collapse">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="py-2 px-2 border">Timestamp</th>
                <th className="py-2 px-2 border">HR / RR</th>
                <th className="py-2 px-2 border">Pre / Post SpO2</th>
                <th className="py-2 px-2 border">FiO2 / MAP</th>
                <th className="py-2 px-2 border">PaO2 / OI</th>
                <th className="py-2 px-2 border">iNO (ppm)</th>
                <th className="py-2 px-2 border">Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((lg) => (
                <tr key={lg.id} className="border-b">
                  <td className="py-1.5 px-2 border whitespace-nowrap">
                    {new Date(lg.log_datetime).toLocaleString()}
                  </td>
                  <td className="py-1.5 px-2 border">
                    {lg.heart_rate_bpm} / {lg.respiratory_rate}
                  </td>
                  <td className="py-1.5 px-2 border">
                    {lg.pre_ductal_spo2_percent}% / {lg.post_ductal_spo2_percent}% (&Delta;{' '}
                    {Math.max(0, lg.pre_ductal_spo2_percent - lg.post_ductal_spo2_percent)}%)
                  </td>
                  <td className="py-1.5 px-2 border">
                    {lg.fio2_percent}% / {lg.mean_airway_pressure_cmh2o}
                  </td>
                  <td className="py-1.5 px-2 border">
                    {lg.pao2_mmhg ?? '-'} / {lg.oxygenation_index !== null ? `OI ${lg.oxygenation_index}` : '-'}
                  </td>
                  <td className="py-1.5 px-2 border">
                    {lg.ino_dose_ppm > 0 ? `${lg.ino_dose_ppm}` : '-'}
                  </td>
                  <td className="py-1.5 px-2 border">{lg.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature Section */}
      <div className="grid grid-cols-2 gap-12 pt-8 border-t border-gray-300 text-xs">
        <div>
          <span className="text-gray-500 block mb-8">Attending Neonatologist / Consultant:</span>
          <div className="border-b border-gray-400 w-3/4 mb-1"></div>
          <strong>{episode.consultant_name || 'Dr. Vivek Saxena, MD (Neonatology)'}</strong>
        </div>
        <div>
          <span className="text-gray-500 block mb-8">NICU Charge Nurse / Respiratory Therapist:</span>
          <div className="border-b border-gray-400 w-3/4 mb-1"></div>
          <strong>Staff Signature & Date</strong>
        </div>
      </div>
    </div>
  );
};
