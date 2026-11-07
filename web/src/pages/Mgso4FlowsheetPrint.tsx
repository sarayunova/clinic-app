import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getMgso4Protocol,
  auditMgso4Print,
  type Mgso4ProtocolRecord,
  type Mgso4FlowsheetRecord,
} from '../api';

export const Mgso4FlowsheetPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    protocol: Mgso4ProtocolRecord;
    flowsheet: Mgso4FlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const protocolId = Number(id);
    Promise.all([
      getMgso4Protocol(protocolId),
      auditMgso4Print(protocolId).catch(() => {}),
    ])
      .then(([res]) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load flowsheet dossier');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-sans">
        Preparing Magnesium Sulfate Obstetric HDU Printable Dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-600 font-sans">
        {error || 'Protocol record not found'}
      </div>
    );
  }

  const { protocol, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-sans text-xs leading-normal print:p-0 print:max-w-none">
      {/* Print Controls (Hidden on Print) */}
      <div className="mb-6 flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 print:hidden">
        <div>
          <span className="font-bold text-gray-800 text-sm block">
            NABH Obstetric Critical Care Dossier
          </span>
          <span className="text-gray-500 text-xs">
            Ready for medical record archiving and clinical handoff
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow text-xs flex items-center gap-1.5"
        >
          🖨️ Print Dossier (A4)
        </button>
      </div>

      {/* Hospital Letterhead */}
      <div className="border-b-2 border-gray-900 pb-4 mb-4 text-center">
        <h1 className="text-xl font-black uppercase tracking-wider">
          LIVI CLINIC & MATERNITY HOSPITAL
        </h1>
        <p className="text-[11px] text-gray-600 uppercase font-semibold tracking-wide">
          Department of Obstetrics & Gynecology &bull; Obstetric High Dependency Unit (HDU)
        </p>
        <h2 className="text-sm font-extrabold uppercase mt-2 bg-gray-900 text-white py-1 tracking-wider">
          MAGNESIUM SULFATE (MgSO₄) RESUSCITATION & HOURLY MONITORING FLOWSHEET
        </h2>
      </div>

      {/* Patient & Admission Demographics */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-3 mb-4 rounded bg-gray-50/50">
        <div>
          <div className="grid grid-cols-3 gap-1">
            <span className="font-bold text-gray-700">Patient Name:</span>
            <span className="col-span-2 font-black uppercase">{protocol.patient_name || 'Patient'}</span>

            <span className="font-bold text-gray-700">UHID:</span>
            <span className="col-span-2 font-mono font-bold">{protocol.patient_uhid}</span>

            <span className="font-bold text-gray-700">Protocol Code:</span>
            <span className="col-span-2 font-mono font-bold text-rose-700">{protocol.protocol_code}</span>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-1">
            <span className="font-bold text-gray-700">Indication:</span>
            <span className="col-span-2 font-bold uppercase">{protocol.indication.replace(/_/g, ' ')}</span>

            <span className="font-bold text-gray-700">Regimen:</span>
            <span className="col-span-2 font-bold uppercase">{protocol.regimen_type.replace(/_/g, ' ')}</span>

            <span className="font-bold text-gray-700">Attending:</span>
            <span className="col-span-2">{protocol.prescribed_by_name || 'Dr. Preeti Sharma, MD (OBGYN)'}</span>
          </div>
        </div>
      </div>

      {/* Protocol Specifications & Safety Mandates */}
      <div className="border border-gray-300 p-3 mb-4 rounded space-y-2">
        <div className="font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1">
          Regimen Specifications & Safety Verification Checklist
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="font-bold block text-gray-600">Loading Dose Details:</span>
            <span>{protocol.loading_dose_details}</span>
          </div>
          <div>
            <span className="font-bold block text-gray-600">Maintenance Rate:</span>
            <span>{protocol.maintenance_rate_g_per_h} g/hr IV / IM</span>
          </div>
          <div>
            <span className="font-bold block text-gray-600">Initiation Time:</span>
            <span>{new Date(protocol.initiation_datetime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <div>
            <span className="font-bold block text-gray-600">Status:</span>
            <span className="font-bold uppercase">{protocol.status.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="font-bold block text-gray-600">Bedside Antidote:</span>
            <span className="font-bold text-emerald-800">
              {protocol.antidote_calcium_gluconate_given === 1 ? '🚨 10% Calcium Gluconate Given' : '✓ 10% Calcium Gluconate Verified Bedside'}
            </span>
          </div>
          <div>
            <span className="font-bold block text-gray-600">Target Duration:</span>
            <span>24 Hours Postpartum / Post-Seizure</span>
          </div>
        </div>
      </div>

      {/* Hourly Flowsheet Matrix */}
      <div className="mb-4">
        <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-2 text-xs">
          Chronological Bedside Hourly Observations (Hours 1 – 24)
        </h3>
        <table className="w-full border-collapse border border-gray-400 text-[10px]">
          <thead>
            <tr className="bg-gray-200 text-gray-900 font-bold uppercase text-center border-b border-gray-400">
              <th className="border border-gray-300 p-1">Hr</th>
              <th className="border border-gray-300 p-1">Time</th>
              <th className="border border-gray-300 p-1">Patellar Reflex</th>
              <th className="border border-gray-300 p-1">RR (bpm)</th>
              <th className="border border-gray-300 p-1">Urine (mL/h)</th>
              <th className="border border-gray-300 p-1">BP (mmHg)</th>
              <th className="border border-gray-300 p-1">HR</th>
              <th className="border border-gray-300 p-1">SpO₂</th>
              <th className="border border-gray-300 p-1">Serum Mg</th>
              <th className="border border-gray-300 p-1">Action / Meds Given</th>
              <th className="border border-gray-300 p-1">Nurse</th>
            </tr>
          </thead>
          <tbody>
            {flowsheet.length === 0 ? (
              <tr>
                <td colSpan={11} className="border border-gray-300 p-4 text-center text-gray-500">
                  No hourly observations recorded yet.
                </td>
              </tr>
            ) : (
              flowsheet.map((entry) => (
                <tr key={entry.id} className="text-center hover:bg-gray-50 border-b border-gray-300">
                  <td className="border border-gray-300 p-1 font-bold">{entry.hour_number}</td>
                  <td className="border border-gray-300 p-1 whitespace-nowrap">
                    {new Date(entry.observation_datetime).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="border border-gray-300 p-1 uppercase font-semibold">
                    {entry.patellar_reflex.replace(/_/g, ' ')}
                  </td>
                  <td className="border border-gray-300 p-1 font-bold">{entry.respiratory_rate_bpm}</td>
                  <td className="border border-gray-300 p-1 font-bold">{entry.urine_output_last_hour_ml}</td>
                  <td className="border border-gray-300 p-1 font-bold">
                    {entry.blood_pressure_sys}/{entry.blood_pressure_dia}
                  </td>
                  <td className="border border-gray-300 p-1">{entry.heart_rate_bpm}</td>
                  <td className="border border-gray-300 p-1">{entry.spo2_percent}%</td>
                  <td className="border border-gray-300 p-1">
                    {entry.serum_magnesium_mg_dl ? `${entry.serum_magnesium_mg_dl}` : '-'}
                  </td>
                  <td className="border border-gray-300 p-1 text-left">
                    <span className="capitalize">{entry.action_taken.replace(/_/g, ' ')}</span>
                    {entry.antihypertensive_given && (
                      <span className="block text-red-700 font-bold">
                        + {entry.antihypertensive_given}
                      </span>
                    )}
                  </td>
                  <td className="border border-gray-300 p-1">{entry.nurse_name || 'Staff Nurse'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Reference / Emergency Card Box */}
      <div className="border border-gray-400 p-2.5 rounded bg-gray-50 text-[10px] space-y-1 mb-8">
        <span className="font-bold text-gray-900 block uppercase">
          Toxicity Triad Thresholds & Calcium Gluconate Antidote Protocol
        </span>
        <p className="text-gray-700">
          <strong>1. Absent Knee Jerk (DTR = 0):</strong> First clinical sign of toxicity (~8-10 mg/dL). HOLD INFUSION.<br />
          <strong>2. Respiratory Depression (&lt; 16 bpm):</strong> Threat of respiratory arrest (&lt; 12 bpm). ADMINISTER ANTIDOTE STAT.<br />
          <strong>3. Oliguria (&lt; 30 mL/hr):</strong> Magnesium excretion impaired. Reduce or hold infusion to prevent toxic accumulation.<br />
          <strong>ANTIDOTE:</strong> 10% Calcium Gluconate 10 mL (1 g) IV push slowly over 10 minutes.
        </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-center text-xs">
        <div>
          <div className="h-12 border-b border-gray-400 border-dashed mb-2"></div>
          <span className="font-bold block">Staff Nurse Incharge (HDU)</span>
          <span className="text-[10px] text-gray-500">Sign & Date / Registration No.</span>
        </div>
        <div>
          <div className="h-12 border-b border-gray-400 border-dashed mb-2"></div>
          <span className="font-bold block">Consultant Obstetrician / Intensivist</span>
          <span className="text-[10px] text-gray-500">Sign & Date / Registration No.</span>
        </div>
      </div>
    </div>
  );
};
