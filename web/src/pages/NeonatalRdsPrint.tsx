import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getNeonatalRdsEpisode,
  auditNeonatalRdsPrint,
  type NeonatalRdsRecord,
  type NeonatalNivFlowsheetRecord,
} from '../api';

export const NeonatalRdsPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalRdsRecord;
    flowsheetLogs: NeonatalNivFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getNeonatalRdsEpisode(Number(id));
        setData(res);
        await auditNeonatalRdsPrint(Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load RDS report');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading Neonatal RDS & Bubble CPAP Dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'Neonatal RDS episode not found'}
        </div>
        <Link to="/neonatal-rds" className="text-sky-700 underline text-sm">
          ← Return to RDS Console
        </Link>
      </div>
    );
  }

  const { episode: ep, flowsheetLogs: logs } = data;

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans print:p-0">
      {/* Top action toolbar (hidden on print) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          to={`/patients/${ep.patient_id}?tab=neonatal_rds`}
          className="text-xs font-semibold text-sky-700 hover:underline flex items-center gap-1"
        >
          ← Return to Patient Chart
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-sky-800 text-white rounded-lg text-xs font-bold shadow hover:bg-sky-900 flex items-center gap-2"
        >
          <span>🖨️</span> Print Legal Clinical Record
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto border border-gray-300 p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Hospital Header */}
        <div className="border-b-2 border-sky-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-sky-950 uppercase tracking-tight">
              LiVi NICU Level-3 Neonatal Intensive Care
            </h1>
            <p className="text-xs text-slate-600">
              European Consensus Guidelines for RDS (2022/2023 Update) & LISA Surfactant Protocol
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-black text-sky-900 bg-sky-50 px-2.5 py-1 border border-sky-200 rounded">
              {ep.episode_code}
            </span>
            <p className="text-[10px] text-slate-500 mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>
        </div>

        {/* Patient Demographics Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Neonate Name</span>
            <span className="font-bold text-slate-900 text-sm">{ep.patient_name}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Patient UHID</span>
            <span className="font-mono font-bold text-slate-900">{ep.patient_uhid}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Gestational Age / Sex</span>
            <span className="font-bold text-slate-900">{ep.gestational_age_weeks} weeks • {ep.patient_gender || 'Neonate'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Birth Wt / Current Wt</span>
            <span className="font-bold text-slate-900">{ep.birth_weight_kg} kg / {ep.current_weight_kg} kg</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Protocol Onset</span>
            <span className="font-semibold text-slate-800">{new Date(ep.onset_datetime).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Consultant Neonatologist</span>
            <span className="font-semibold text-slate-800">{ep.consultant_neonatologist_name || 'Attending Neonatologist'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Protocol Status</span>
            <span className="font-bold text-sky-900 uppercase">{ep.status.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Primary NIV Modality</span>
            <span className="font-bold text-slate-800 uppercase">{ep.niv_modality.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* Clinical Assessment Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50/30 text-center">
            <span className="text-[10px] font-bold text-indigo-700 uppercase block">Silverman-Anderson Score</span>
            <p className="text-2xl font-black text-indigo-900 my-1">{ep.silverman_anderson_score} / 10</p>
            <span className="text-[10px] text-indigo-800">{ep.silverman_anderson_score <= 3 ? 'Mild Distress' : ep.silverman_anderson_score <= 6 ? 'Moderate' : 'Severe / Impending Failure'}</span>
          </div>
          <div className="border border-purple-200 rounded-lg p-3 bg-purple-50/30 text-center">
            <span className="text-[10px] font-bold text-purple-700 uppercase block">Downes' Score</span>
            <p className="text-2xl font-black text-purple-900 my-1">{ep.downes_score} / 10</p>
            <span className="text-[10px] text-purple-800">{ep.downes_score <= 3 ? 'Mild' : ep.downes_score <= 7 ? 'Significant' : 'Severe Distress'}</span>
          </div>
          <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/30 text-center">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">a/A Oxygen Ratio</span>
            <p className="text-2xl font-black text-emerald-900 my-1">{ep.a_a_ratio ?? '—'}</p>
            <span className="text-[10px] text-emerald-800">{ep.a_a_ratio && ep.a_a_ratio < 0.22 ? 'Alveolar Collapse (<0.22)' : 'V/Q Exchange'}</span>
          </div>
          <div className="border border-sky-200 rounded-lg p-3 bg-sky-50/30 text-center">
            <span className="text-[10px] font-bold text-sky-700 uppercase block">Oxygenation Index (OI)</span>
            <p className="text-2xl font-black text-sky-900 my-1">{ep.oxygenation_index ?? '—'}</p>
            <span className="text-[10px] text-sky-800">Target &lt; 5.0</span>
          </div>
        </div>

        {/* Surfactant Replacement & LISA Method */}
        {ep.surfactant_indicated === 1 && (
          <div className="border border-amber-300 rounded-lg p-4 mb-6 bg-amber-50/40">
            <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>💉</span> Surfactant Replacement Record (LISA / MIST Protocol)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Brand / Agent</span>
                <span className="font-bold text-amber-950">{ep.surfactant_brand?.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Total Dose & Volume</span>
                <span className="font-bold text-amber-950">{ep.surfactant_total_dose_mg} mg ({ep.surfactant_total_volume_ml} mL)</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Delivery Technique</span>
                <span className="font-bold text-sky-900 uppercase">{ep.administration_method?.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Administered At</span>
                <span className="font-bold text-slate-800">{ep.surfactant_administered_at ? new Date(ep.surfactant_administered_at).toLocaleString() : 'Pending'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Flowsheet Table */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Bedside Bubble CPAP Flowsheet & Nasal Columella Surveillance Log
          </h3>
          <table className="min-w-full border border-slate-300 text-[10px]">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th className="p-1.5 border-r text-left">Time / Protocol Hr</th>
                <th className="p-1.5 border-r text-center">RR / HR (bpm)</th>
                <th className="p-1.5 border-r text-center">SpO2 (%)</th>
                <th className="p-1.5 border-r text-center">Silverman / Downes</th>
                <th className="p-1.5 border-r text-center">PEEP (cmH2O) / Flow / FiO2</th>
                <th className="p-1.5 border-r text-center">Columella Skin Check</th>
                <th className="p-1.5 border-r text-center">ABG (pH / PaCO2 / PaO2)</th>
                <th className="p-1.5 text-left">Notes / Sign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                    No bedside flowsheet entries logged.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-1.5 border-r font-mono">
                      Hr {log.hours_on_protocol} • {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-1.5 border-r text-center">
                      {log.respiratory_rate_bpm} / {log.heart_rate_bpm}
                    </td>
                    <td className="p-1.5 border-r text-center font-bold text-blue-800">
                      {log.spo2_percent}%
                    </td>
                    <td className="p-1.5 border-r text-center font-semibold">
                      {log.silverman_score} / {log.downes_score}
                    </td>
                    <td className="p-1.5 border-r text-center font-medium">
                      {log.peep_cmh2o} / {log.flow_lpm} L / {log.fio2_percent}%
                    </td>
                    <td className="p-1.5 border-r text-center font-bold">
                      <span className={log.nasal_columella_skin_check === 'intact' ? 'text-emerald-700' : 'text-red-700'}>
                        {log.nasal_columella_skin_check.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-1.5 border-r text-center">
                      {log.arterial_blood_gas_ph ? `${log.arterial_blood_gas_ph} / ${log.arterial_pco2_mmhg} / ${log.arterial_pao2_mmhg}` : '—'}
                    </td>
                    <td className="p-1.5">
                      {log.notes || '—'} {log.logged_by_name && `(${log.logged_by_name})`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Clinical Notes & Signatures */}
        {ep.clinical_notes && (
          <div className="border border-slate-200 rounded p-3 mb-8 bg-slate-50 text-xs">
            <span className="font-bold text-slate-700 block mb-1">Clinical Notes & Neonatologist Orders:</span>
            <p className="text-slate-800">{ep.clinical_notes}</p>
          </div>
        )}

        {/* Signature Blocks */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
          <div>
            <div className="border-b border-slate-400 pb-8 mb-2"></div>
            <p className="font-bold text-slate-800">Bedside NICU Staff Nurse</p>
            <p className="text-[10px] text-slate-500">Bubble CPAP & Columella Surveillance Certified</p>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-8 mb-2"></div>
            <p className="font-bold text-slate-800">Consultant Neonatologist</p>
            <p className="text-[10px] text-slate-500">Reg No: ____________________ • Signature & Seal</p>
          </div>
        </div>
      </div>
    </div>
  );
};
