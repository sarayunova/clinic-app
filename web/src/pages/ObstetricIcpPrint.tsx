import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricIcpPrint } from '../api';

export const ObstetricIcpPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricIcpPrint(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading ICP print dossier...</div>;
  if (!data || !data.episode) return <div className="p-8 text-center text-red-500">Episode not found.</div>;

  const { episode, patient, logs, printedAt, printedBy } = data;

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white text-gray-900 font-sans print:p-0">
      {/* Header */}
      <div className="border-b-2 border-teal-700 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black text-teal-900 tracking-wide uppercase">
            Department of Obstetrics & Maternal-Fetal Medicine
          </h1>
          <h2 className="text-sm font-bold text-gray-700">
            Intrahepatic Cholestasis of Pregnancy (ICP) Clinical Surveillance Dossier
          </h2>
          <p className="text-xs text-gray-500">
            SMFM 2021 / RCOG 43 Total Serum Bile Acids (TSBA) Risk Stratification & Delivery Protocol
          </p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>Report Ref: <strong className="font-mono text-gray-900">{episode.episode_code}</strong></div>
          <div>Printed: {new Date(printedAt).toLocaleString()}</div>
          <div>Consultant: {printedBy}</div>
        </div>
      </div>

      {/* Patient & Demographics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs mb-6">
        <div>
          <span className="text-gray-500 block">Patient Name:</span>
          <strong className="text-gray-900 text-sm">{patient?.full_name ?? `ID #${episode.patient_id}`}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">GA at Diagnosis:</span>
          <strong>{episode.gestation_weeks} weeks</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Peak TSBA Level:</span>
          <strong className="text-teal-900">{episode.peak_tsba_umol_l} umol/L</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Severity Tier:</span>
          <strong className="text-gray-900 uppercase">{episode.icp_severity_tier.replace(/_/g, ' ')}</strong>
        </div>
      </div>

      {/* Clinical Assessment Box */}
      <div className="border border-teal-300 rounded-lg p-4 bg-teal-50/50 mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-sm text-teal-950 uppercase">
            Clinical Management & Delivery Schedule
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-teal-300">
            Status: {episode.status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs bg-white p-3 rounded border border-teal-200 mb-3">
          <div>UDCA Dosage: <strong>{episode.udca_dose_mg_day} mg/day</strong></div>
          <div>Planned Delivery GA: <strong>{episode.planned_delivery_weeks} weeks</strong></div>
          <div>CTG Surveillance: <strong className="uppercase">{episode.ctg_surveillance_frequency.replace(/_/g, ' ')}</strong></div>
        </div>
        {episode.delivery_timing_rationale && (
          <div className="text-xs text-teal-950">
            <strong>Delivery Timing Rationale:</strong> {episode.delivery_timing_rationale}
          </div>
        )}
      </div>

      {/* Pruritus & Liver Enzymes */}
      <div className="grid grid-cols-2 gap-4 text-xs mb-6">
        <div className="border p-3 rounded-lg bg-gray-50">
          <h4 className="font-bold text-gray-800 uppercase mb-1">Pruritus Symptomatology</h4>
          <p>Severity Score: <strong>{episode.pruritus_severity_score}/10 (VAS)</strong></p>
          <p>Palms & Soles Predominance: <strong>{episode.pruritus_palms_soles === 1 ? 'YES' : 'NO'}</strong></p>
          <p>Nocturnal Exacerbation: <strong>{episode.nocturnal_worsening === 1 ? 'YES' : 'NO'}</strong></p>
        </div>

        <div className="border p-3 rounded-lg bg-gray-50">
          <h4 className="font-bold text-gray-800 uppercase mb-1">Baseline Liver Transaminases</h4>
          <p>Serum ALT (SGPT): <strong>{episode.baseline_alt_u_l ? `${episode.baseline_alt_u_l} U/L` : 'Normal / Not Tested'}</strong></p>
          <p>Serum AST (SGOT): <strong>{episode.baseline_ast_u_l ? `${episode.baseline_ast_u_l} U/L` : 'Normal / Not Tested'}</strong></p>
        </div>
      </div>

      {/* Serial Checkpoints */}
      <div className="mb-6">
        <h3 className="font-bold text-sm text-gray-800 uppercase mb-2">
          Serial Surveillance Checkpoints ({logs?.length ?? 0})
        </h3>
        <table className="w-full text-xs text-left border">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="py-1.5 px-2">Date / GA</th>
              <th className="py-1.5 px-2">TSBA (umol/L)</th>
              <th className="py-1.5 px-2">ALT / AST</th>
              <th className="py-1.5 px-2">Pruritus</th>
              <th className="py-1.5 px-2">CTG Result</th>
              <th className="py-1.5 px-2">UDCA Dose</th>
              <th className="py-1.5 px-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs?.map((lg: any) => (
              <tr key={lg.id}>
                <td className="py-1 px-2">{new Date(lg.log_datetime).toLocaleDateString()} ({lg.gestation_weeks}w)</td>
                <td className="py-1 px-2 font-semibold text-teal-900">{lg.current_tsba_umol_l} umol/L</td>
                <td className="py-1 px-2 font-mono">{lg.alt_u_l ?? '-'}/{lg.ast_u_l ?? '-'}</td>
                <td className="py-1 px-2">{lg.pruritus_score}/10</td>
                <td className="py-1 px-2 uppercase font-bold text-[10px]">{lg.ctg_result}</td>
                <td className="py-1 px-2">{lg.udca_current_dose_mg_day} mg/d</td>
                <td className="py-1 px-2 text-gray-600">{lg.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Signature Box */}
      <div className="pt-8 border-t flex justify-between items-end text-xs text-gray-600">
        <div>
          <p className="font-semibold text-gray-800">Consultant Obstetrician & Gynecologist</p>
          <div className="h-10"></div>
          <p className="border-t border-gray-400 w-48 pt-1">Signature & Stamp</p>
        </div>
        <div className="text-right">
          <p>Confidential Medical Record</p>
          <p>Generated by LiVi Clinic OS</p>
        </div>
      </div>
    </div>
  );
};
