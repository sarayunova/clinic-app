import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricPardsPrint } from '../api';

export const PediatricPardsPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getPediatricPardsPrint(parseInt(id, 10))
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
      <div className="border-b-2 border-indigo-900 pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-indigo-950 uppercase">
            LiVi Mother & Child Hospital
          </h1>
          <p className="text-xs text-gray-600">Pediatric Intensive Care Unit (PICU) • Critical Care Medicine</p>
          <p className="text-xs font-semibold text-indigo-900 mt-1">
            PEDIATRIC ARDS (PARDS) & PALICC-2 MECHANICAL VENTILATION DOSSIER
          </p>
        </div>
        <div className="text-right text-xs">
          <div className="font-mono font-bold text-sm text-gray-900">{episode.episode_code}</div>
          <div className="text-gray-500">Printed: {new Date(printedAt).toLocaleString()}</div>
          <div className="text-gray-500">Attending Intensivist: {printedBy}</div>
        </div>
      </div>

      {/* Patient & Diagnosis Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border text-xs">
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Patient Name</span>
          <span className="font-bold text-gray-900 text-sm">{patient.full_name}</span>
          <span className="text-[11px] text-gray-500 block">MRN: {patient.patient_number}</span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Age / Weight</span>
          <span className="font-bold text-gray-900 text-sm">
            {episode.age_months} months | {episode.weight_kg} kg
          </span>
          <span className="text-[11px] text-gray-500 block">
            PBW: {episode.predicted_body_weight_kg || episode.weight_kg} kg
          </span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">Trigger Cause</span>
          <span className="font-bold text-gray-900 text-sm capitalize">
            {episode.trigger_cause.replace(/_/g, ' ')}
          </span>
          <span className="text-[11px] text-gray-500 block">
            Diagnosed: {new Date(episode.diagnosis_datetime).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-semibold">PARDS Severity Tier</span>
          <span className="font-bold uppercase text-indigo-900 text-sm">
            {episode.pards_severity.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Ventilation & Mechanics Metrics */}
      <div className="grid grid-cols-3 gap-4 border p-4 rounded-lg bg-indigo-50/40 text-xs">
        <div>
          <span className="text-indigo-950 font-bold block uppercase">Oxygenation Index (OI/OSI)</span>
          <div className="text-xl font-black text-indigo-950 mt-0.5">
            {episode.calculated_oi !== null ? `OI: ${episode.calculated_oi}` : episode.calculated_osi !== null ? `OSI: ${episode.calculated_osi}` : 'At Risk'}
          </div>
          <span className="text-gray-600">
            MAP: {episode.current_map_cmh2o} cmH2O | PEEP: {episode.current_peep_cmh2o} cmH2O
          </span>
        </div>
        <div>
          <span className="text-indigo-950 font-bold block uppercase">Target Tidal Volume (Vt)</span>
          <div className="text-xl font-black text-emerald-800 mt-0.5">
            {episode.target_tidal_volume_ml_min} - {episode.target_tidal_volume_ml_max} mL
          </div>
          <span className="text-gray-600">
            PALICC-2 Lung-Protective Band ({episode.pards_severity === 'moderate' || episode.pards_severity === 'severe' ? '3-6' : '5-8'} mL/kg)
          </span>
        </div>
        <div>
          <span className="text-indigo-950 font-bold block uppercase">Pressure Limits</span>
          <div className="text-sm font-bold text-gray-900 mt-1">
            Pplat &le; {episode.plateau_pressure_limit_cmh2o} | &Delta;P &lt; {episode.driving_pressure_limit_cmh2o} cmH2O
          </div>
          <span className="text-gray-600">
            Prone: {episode.prone_positioning_active ? 'Active (>=16h)' : 'No'} | NMB: {episode.neuromuscular_blockade_active ? 'Infusion' : 'No'}
          </span>
        </div>
      </div>

      {/* Serial Ventilation Mechanics Flowsheet */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
          PICU Bedside Mechanical Ventilation Flowsheet History
        </h3>
        <table className="w-full text-xs border border-gray-300">
          <thead className="bg-gray-100 text-gray-700 font-bold border-b">
            <tr>
              <th className="py-2 px-2 border-r text-left">Time</th>
              <th className="py-2 px-2 border-r text-center">Hour</th>
              <th className="py-2 px-2 border-r text-center">Pplat/PEEP</th>
              <th className="py-2 px-2 border-r text-center">Driving &Delta;P</th>
              <th className="py-2 px-2 border-r text-center">MAP/FiO2</th>
              <th className="py-2 px-2 border-r text-center">Tidal Vol</th>
              <th className="py-2 px-2 border-r text-center">OI / OSI</th>
              <th className="py-2 px-2 border-r text-center">ABG (pH/PaO2/PCO2)</th>
              <th className="py-2 px-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y text-gray-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-4 text-center text-gray-500">
                  No serial ventilation flowsheet logs recorded.
                </td>
              </tr>
            ) : (
              logs.map((l: any) => (
                <tr key={l.id}>
                  <td className="py-1.5 px-2 border-r whitespace-nowrap">
                    {new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1.5 px-2 border-r text-center">+{l.hours_on_protocol}h</td>
                  <td className="py-1.5 px-2 border-r text-center font-mono">
                    {l.plateau_pressure_cmh2o ?? '-'}/{l.peep_cmh2o}
                  </td>
                  <td className="py-1.5 px-2 border-r text-center font-bold">
                    {l.calculated_driving_pressure_cmh2o !== null ? `${l.calculated_driving_pressure_cmh2o}` : '-'}
                  </td>
                  <td className="py-1.5 px-2 border-r text-center">
                    {l.map_cmh2o} / {l.fio2_percent}%
                  </td>
                  <td className="py-1.5 px-2 border-r text-center font-semibold">
                    {l.tidal_volume_set_ml ? `${l.tidal_volume_set_ml} mL` : '-'}
                  </td>
                  <td className="py-1.5 px-2 border-r text-center font-bold text-indigo-950">
                    {l.calculated_oi !== null ? `OI: ${l.calculated_oi}` : l.calculated_osi !== null ? `OSI: ${l.calculated_osi}` : '-'}
                  </td>
                  <td className="py-1.5 px-2 border-r text-center font-mono text-[11px]">
                    {l.abg_ph ? `${l.abg_ph} / ${l.abg_pao2_mmhg ?? '-'} / ${l.abg_pco2_mmhg ?? '-'}` : '-'}
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
          <span className="font-semibold text-gray-800">Attending Pediatric Intensivist Signature</span>
        </div>
        <div>
          <div className="border-b border-gray-400 pb-8 mb-1"></div>
          <span className="font-semibold text-gray-800">PICU Respiratory Therapist / Charge Nurse</span>
        </div>
      </div>
    </div>
  );
};
