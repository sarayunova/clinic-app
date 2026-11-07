import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalBindPrint } from '../api';

export const NeonatalBindAabrPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalBindPrint(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading BIND print dossier...</div>;
  if (!data || !data.episode) return <div className="p-8 text-center text-red-500">Assessment not found.</div>;

  const { episode, patient, logs, printedAt, printedBy } = data;

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white text-gray-900 font-sans print:p-0">
      {/* Clinic Header */}
      <div className="border-b-2 border-amber-600 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black text-amber-900 tracking-wide uppercase">
            Neonatal Intensive Care Unit (NICU)
          </h1>
          <h2 className="text-sm font-bold text-gray-700">
            Acute Bilirubin Encephalopathy (BIND) & AABR Neuro-Auditory Dossier
          </h2>
          <p className="text-xs text-gray-500">
            AAP 2022 Guidelines for Hyperbilirubinemia Management & Kernicterus Prevention
          </p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>Report Ref: <strong className="font-mono text-gray-900">{episode.episode_code}</strong></div>
          <div>Printed: {new Date(printedAt).toLocaleString()}</div>
          <div>Clinician: {printedBy}</div>
        </div>
      </div>

      {/* Patient & Demographics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs mb-6">
        <div>
          <span className="text-gray-500 block">Neonate Patient:</span>
          <strong className="text-gray-900 text-sm">{patient?.full_name ?? `ID #${episode.patient_id}`}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Gestational Age / Weight:</span>
          <strong>{episode.gestational_age_weeks} weeks / {episode.birth_weight_grams} g</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Peak TSB / Direct:</span>
          <strong className="text-amber-900">{episode.peak_tsb_mg_dl} mg/dL {episode.direct_bilirubin_mg_dl ? `(${episode.direct_bilirubin_mg_dl})` : ''}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">B/A Ratio:</span>
          <strong>{episode.calculated_b_a_ratio ? `${episode.calculated_b_a_ratio} mg/g` : 'N/A'}</strong>
        </div>
      </div>

      {/* BIND Scores Box */}
      <div className="border border-amber-300 rounded-lg p-4 bg-amber-50/50 mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-sm text-amber-950 uppercase">
            BIND Evaluation (Total Score: {episode.total_bind_score}/9 — {episode.bind_severity.replace(/_/g, ' ').toUpperCase()})
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-amber-300">
            Status: {episode.status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs bg-white p-3 rounded border border-amber-200">
          <div>Mental Status Score: <strong>{episode.mental_status_score}/3</strong></div>
          <div>Muscle Tone Score: <strong>{episode.muscle_tone_score}/3</strong></div>
          <div>Cry Quality Score: <strong>{episode.cry_score}/3</strong></div>
        </div>
      </div>

      {/* AABR Screening & Interventions */}
      <div className="grid grid-cols-2 gap-4 text-xs mb-6">
        <div className="border p-3 rounded-lg bg-gray-50">
          <h4 className="font-bold text-gray-800 uppercase mb-1">AABR Hearing Screening</h4>
          <p>Right Ear: <strong>{episode.aabr_right_ear.toUpperCase()}</strong></p>
          <p>Left Ear: <strong>{episode.aabr_left_ear.toUpperCase()}</strong></p>
          <p className="text-gray-500 mt-1">Screened on: {episode.aabr_test_datetime ? new Date(episode.aabr_test_datetime).toLocaleString() : 'Postnatal Stay'}</p>
        </div>

        <div className="border p-3 rounded-lg bg-gray-50">
          <h4 className="font-bold text-gray-800 uppercase mb-1">Advanced Interventions</h4>
          <p>Double-Volume Exchange Transfusion (DVET): <strong>{episode.exchange_transfusion_performed === 1 ? 'YES' : 'NO'}</strong></p>
          <p>Intravenous Immunoglobulin (IVIG): <strong>{episode.ivig_given === 1 ? 'YES' : 'NO'}</strong></p>
        </div>
      </div>

      {/* Neuro-Auditory Follow-Up Plan */}
      {episode.neuro_auditory_followup_plan && (
        <div className="p-3 bg-gray-50 border rounded-lg text-xs mb-6">
          <strong className="block text-gray-800 uppercase mb-0.5">Neuro-Auditory Follow-Up Strategy:</strong>
          <p className="text-gray-700">{episode.neuro_auditory_followup_plan}</p>
        </div>
      )}

      {/* Serial Checkpoints */}
      <div className="mb-6">
        <h3 className="font-bold text-sm text-gray-800 uppercase mb-2">
          Bedside Serial Checkpoints ({logs?.length ?? 0})
        </h3>
        <table className="w-full text-xs text-left border">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="py-1.5 px-2">Time / Elapsed</th>
              <th className="py-1.5 px-2">BIND Score (M/T/C)</th>
              <th className="py-1.5 px-2">TSB (mg/dL)</th>
              <th className="py-1.5 px-2">Phototherapy</th>
              <th className="py-1.5 px-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs?.map((lg: any) => (
              <tr key={lg.id}>
                <td className="py-1 px-2">{new Date(lg.log_datetime).toLocaleTimeString()} (+{lg.hours_from_admission}h)</td>
                <td className="py-1 px-2 font-mono">M:{lg.mental_status_score} T:{lg.muscle_tone_score} C:{lg.cry_score} (Total: {lg.total_bind_score}/9)</td>
                <td className="py-1 px-2 font-semibold">{lg.tsb_mg_dl ? `${lg.tsb_mg_dl} mg/dL` : '-'}</td>
                <td className="py-1 px-2">{lg.phototherapy_type?.replace(/_/g, ' ') ?? 'None'}</td>
                <td className="py-1 px-2 text-gray-600">{lg.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Signature Box */}
      <div className="pt-8 border-t flex justify-between items-end text-xs text-gray-600">
        <div>
          <p className="font-semibold text-gray-800">Duty Neonatologist / Pediatrician</p>
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
