import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getPdSession,
  auditPdPrint,
  type PdSessionRecord,
  type PdCycleRecord,
  type PdEffluentLabRecord,
} from '../api';

export const PdFlowsheetPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    session: PdSessionRecord;
    cycles: PdCycleRecord[];
    effluentLabs: PdEffluentLabRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchSession = async () => {
      setLoading(true);
      try {
        const res = await getPdSession(Number(id));
        setData(res);
        await auditPdPrint(Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load PD flowsheet');
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 font-sans">
        Loading Peritoneal Dialysis Flowsheet Dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'PD session record not found'}
        </div>
        <Link to="/pediatric-renal" className="text-blue-600 underline text-sm">
          &larr; Return to Pediatric Renal Command Center
        </Link>
      </div>
    );
  }

  const { session, cycles, effluentLabs } = data;

  return (
    <div className="bg-white min-h-screen text-gray-900 font-sans p-6 sm:p-10 max-w-5xl mx-auto print:p-0 print:max-w-none">
      {/* Screen Toolbar */}
      <div className="print:hidden mb-6 flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/pediatric-renal"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-white"
          >
            &larr; Back to Monitor
          </Link>
          <span className="text-xs text-gray-500">
            Session: <strong className="text-gray-800">{session.session_number}</strong>
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow flex items-center gap-2"
        >
          <span>🖨️</span> Print Clinical Dossier
        </button>
      </div>

      {/* Hospital Formal Header */}
      <div className="border-b-2 border-gray-900 pb-3 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
              LiVi Specialized Women & Child Hospital
            </h1>
            <p className="text-xs font-semibold text-gray-700 tracking-wide">
              DEPARTMENT OF PEDIATRICS & NEONATOLOGY — SNCU / NICU LEVEL-2 UNIT
            </p>
            <p className="text-[11px] text-gray-500">
              National Accreditation Board for Hospitals (NABH) Clinical Documentation
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block border-2 border-gray-900 px-3 py-1 font-black text-xs uppercase tracking-wider">
              ACUTE PERITONEAL DIALYSIS FLOWSHEET
            </span>
            <p className="text-xs font-bold text-gray-800 mt-1">
              Doc ID: {session.session_number}
            </p>
          </div>
        </div>
      </div>

      {/* Demographics & Clinical Prescription Grid */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-3.5 rounded-lg text-xs mb-6 bg-gray-50/50 print:bg-transparent">
        <div className="space-y-1">
          <div>
            <span className="text-gray-500 font-medium">Patient Name:</span>{' '}
            <strong className="text-gray-900 text-sm">{session.patient_name}</strong>
          </div>
          <div>
            <span className="text-gray-500 font-medium">UHID:</span>{' '}
            <strong className="text-gray-900">{session.patient_uhid}</strong> |{' '}
            <span className="text-gray-500 font-medium">Gender:</span>{' '}
            <strong className="text-gray-900 uppercase">{session.patient_gender || 'Unspecified'}</strong>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Dry/Clinical Weight:</span>{' '}
            <strong className="text-blue-900">{session.patient_weight_kg} kg</strong>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Indication:</span>{' '}
            <strong className="text-gray-900">{session.indication.replace(/_/g, ' ').toUpperCase()}</strong>
          </div>
        </div>

        <div className="space-y-1">
          <div>
            <span className="text-gray-500 font-medium">Dialysate Solution:</span>{' '}
            <strong className="text-gray-900">
              {session.solution_type === 'dextrose_1_5' && '1.5% Dextrose (Standard)'}
              {session.solution_type === 'dextrose_2_5' && '2.5% Dextrose (Intermediate)'}
              {session.solution_type === 'dextrose_4_25' && '4.25% Dextrose (Hypertonic)'}
              {session.solution_type === 'custom_compound' && 'Custom Compound'}
            </strong>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Fill Volume:</span>{' '}
            <strong className="text-indigo-900">
              {session.calculated_fill_volume_ml} mL / exchange ({session.fill_volume_ml_per_kg} mL/kg)
            </strong>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Cycle Protocol:</span>{' '}
            <strong className="text-gray-900">
              In: {session.inflow_time_minutes}m | Dwell: {session.dwell_time_minutes}m | Drain: {session.drain_time_minutes}m
            </strong>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Additives:</span>{' '}
            <span className="text-gray-800">
              Heparin: {session.heparin_units_per_liter} U/L | KCl: {session.potassium_meq_per_liter} mEq/L
              {session.antibiotic_additive ? ` | Rx: ${session.antibiotic_additive}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Catheter & Access Details */}
      <div className="flex justify-between items-center bg-gray-100 px-3 py-1.5 rounded text-[11px] mb-4 border">
        <div>
          <span className="font-semibold text-gray-700">Catheter:</span>{' '}
          <span className="text-gray-900 font-bold">{session.catheter_type.replace(/_/g, ' ')}</span>
          {session.catheter_insertion_date && (
            <span className="text-gray-600"> (Inserted: {session.catheter_insertion_date})</span>
          )}
        </div>
        <div>
          <span className="font-semibold text-gray-700">Prescribing Physician:</span>{' '}
          <span className="text-gray-900 font-bold">Dr. {session.prescribed_by_name || 'Attending'}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-700">Status:</span>{' '}
          <span className="font-black uppercase">{session.status}</span>
        </div>
      </div>

      {/* Serial Cycle Flowsheet Table */}
      <div className="mb-6">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-800 mb-2 border-b pb-1">
          Bedside Cycle Exchange Flowsheet & Net Ultrafiltration Record
        </h2>
        <table className="min-w-full border-collapse border border-gray-400 text-[11px]">
          <thead>
            <tr className="bg-gray-100 text-gray-900 font-bold">
              <th className="border border-gray-400 px-2 py-1 text-center">#</th>
              <th className="border border-gray-400 px-2 py-1">Exchange Time</th>
              <th className="border border-gray-400 px-2 py-1 text-right">Inflow (mL)</th>
              <th className="border border-gray-400 px-2 py-1 text-center">Dwell (m)</th>
              <th className="border border-gray-400 px-2 py-1 text-right">Drain (mL)</th>
              <th className="border border-gray-400 px-2 py-1 text-right">Net UF (mL)</th>
              <th className="border border-gray-400 px-2 py-1 text-right">Cum. UF (mL)</th>
              <th className="border border-gray-400 px-2 py-1">Appearance</th>
              <th className="border border-gray-400 px-2 py-1">Girth / Leak</th>
              <th className="border border-gray-400 px-2 py-1">Nurse Sign</th>
            </tr>
          </thead>
          <tbody>
            {cycles.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-gray-400 px-3 py-4 text-center text-gray-500">
                  No cycle exchanges logged for this session.
                </td>
              </tr>
            ) : (
              cycles.map((c) => (
                <tr key={c.id}>
                  <td className="border border-gray-400 px-2 py-1 text-center font-bold">{c.cycle_number}</td>
                  <td className="border border-gray-400 px-2 py-1">{c.cycle_start_time.slice(0, 16).replace('T', ' ')}</td>
                  <td className="border border-gray-400 px-2 py-1 text-right">{c.inflow_ml}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{c.dwell_duration_minutes}</td>
                  <td className="border border-gray-400 px-2 py-1 text-right">{c.outflow_ml}</td>
                  <td className="border border-gray-400 px-2 py-1 text-right font-bold">
                    {c.net_uf_ml >= 0 ? `+${c.net_uf_ml}` : c.net_uf_ml}
                  </td>
                  <td className="border border-gray-400 px-2 py-1 text-right font-black">
                    {c.cumulative_uf_ml >= 0 ? `+${c.cumulative_uf_ml}` : c.cumulative_uf_ml}
                  </td>
                  <td className="border border-gray-400 px-2 py-1">
                    {c.effluent_appearance.replace(/_/g, ' ')}
                  </td>
                  <td className="border border-gray-400 px-2 py-1">
                    {c.abdominal_girth_cm ? `${c.abdominal_girth_cm} cm` : '-'}
                    {c.catheter_site_leakage === 1 && ' (Leak)'}
                  </td>
                  <td className="border border-gray-400 px-2 py-1 text-gray-700">{c.nurse_name || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
          {cycles.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={2} className="border border-gray-400 px-2 py-1 text-right">TOTALS:</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{session.cumulative_inflow_ml} mL</td>
                <td className="border border-gray-400 px-2 py-1"></td>
                <td className="border border-gray-400 px-2 py-1 text-right">{session.cumulative_outflow_ml} mL</td>
                <td colSpan={2} className="border border-gray-400 px-2 py-1 text-right font-black">
                  Net UF: {session.cumulative_net_uf_ml >= 0 ? `+${session.cumulative_net_uf_ml}` : session.cumulative_net_uf_ml} mL
                </td>
                <td colSpan={3} className="border border-gray-400 px-2 py-1"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Effluent Microbiology & Cytology Section */}
      {effluentLabs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-800 mb-2 border-b pb-1">
            Dialysate Effluent Cytology & Peritonitis Surveillance
          </h2>
          <table className="min-w-full border-collapse border border-gray-400 text-[11px]">
            <thead>
              <tr className="bg-gray-100 font-bold">
                <th className="border border-gray-400 px-2 py-1">Sample Date/Time</th>
                <th className="border border-gray-400 px-2 py-1 text-right">WBC (/µL)</th>
                <th className="border border-gray-400 px-2 py-1 text-right">PMN (%)</th>
                <th className="border border-gray-400 px-2 py-1">Peritonitis Status</th>
                <th className="border border-gray-400 px-2 py-1">Gram Stain & Culture</th>
                <th className="border border-gray-400 px-2 py-1">Antibiotic Initiated</th>
              </tr>
            </thead>
            <tbody>
              {effluentLabs.map((lab) => (
                <tr key={lab.id}>
                  <td className="border border-gray-400 px-2 py-1">{lab.sample_datetime.slice(0, 16).replace('T', ' ')}</td>
                  <td className="border border-gray-400 px-2 py-1 text-right font-bold">{lab.wbc_count_per_mcl}</td>
                  <td className="border border-gray-400 px-2 py-1 text-right font-bold">{lab.neutrophils_percent}%</td>
                  <td className="border border-gray-400 px-2 py-1 font-bold">
                    {lab.peritonitis_confirmed === 1 ? 'POSITIVE (CONFIRMED)' : 'NEGATIVE / CLEAR'}
                  </td>
                  <td className="border border-gray-400 px-2 py-1">
                    {lab.gram_stain || 'No smear'} | {lab.culture_growth || 'No growth'}
                  </td>
                  <td className="border border-gray-400 px-2 py-1">{lab.empiric_antibiotic_initiated || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dual Signature Block */}
      <div className="mt-12 pt-6 border-t border-gray-400 grid grid-cols-2 gap-8 text-xs">
        <div>
          <p className="font-bold text-gray-800 mb-8">Attending Pediatrician / Neonatologist Sign-off:</p>
          <div className="border-b border-gray-700 w-3/4 mb-1"></div>
          <p className="text-[11px] text-gray-600">Dr. {session.prescribed_by_name || 'Treating Pediatrician'} (MD / DNB)</p>
          <p className="text-[10px] text-gray-500">Reg. No: PMC-78921 | Date: {new Date().toLocaleDateString()}</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-8">Senior Staff Nurse (SNCU/PICU Verification):</p>
          <div className="border-b border-gray-700 w-3/4 mb-1"></div>
          <p className="text-[11px] text-gray-600">Registered Staff Nurse (Duty Station)</p>
          <p className="text-[10px] text-gray-500">Sign & Stamp | Time: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
};
