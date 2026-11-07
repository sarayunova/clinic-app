import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getNicuTpnPrescription,
  auditNicuTpnPrint,
  type NicuTpnPrescriptionRecord,
  type NicuTpnLabRecord,
} from '../api';

export const NicuTpnOrderPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    prescription: NicuTpnPrescriptionRecord;
    labs: NicuTpnLabRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await getNicuTpnPrescription(Number(id));
        setData(res);
        await auditNicuTpnPrint(Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load TPN order sheet');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading NICU TPN Compounding Order Sheet...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'NICU TPN order not found'}
        </div>
        <Link to="/nicu-tpn" className="text-blue-600 underline text-sm">
          &larr; Return to NICU TPN Console
        </Link>
      </div>
    );
  }

  const { prescription: p, labs } = data;

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans">
      {/* Non-printing Control Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden bg-slate-100 p-3 rounded-lg border border-slate-300">
        <Link to="/nicu-tpn" className="text-blue-600 hover:underline text-xs font-semibold">
          &larr; Back to NICU TPN Console
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold hover:bg-blue-800 shadow"
        >
          🖨️ Print Order Sheet
        </button>
      </div>

      {/* Sheet Container */}
      <div className="max-w-4xl mx-auto border-2 border-slate-800 p-6 rounded-lg space-y-5">
        {/* Hospital & Protocol Header */}
        <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              DIVISION OF NEONATOLOGY & CLINICAL NUTRITION
            </h1>
            <h2 className="text-sm font-bold text-slate-700">
              NICU Level-3 Total Parenteral Nutrition (TPN) & Electrolyte Compounding Order Sheet
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Protocol: ESPGHAN / NNF Precision Neonatal Parenteral Nutrition Standards
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-sm font-bold block text-blue-900">{p.prescription_code}</span>
            <span className="text-[11px] text-slate-500">Date: {p.prescription_date}</span>
            <span
              className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                p.route_category === 'central_line_uvc_picc'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              {p.route_category === 'central_line_uvc_picc' ? 'MANDATORY CENTRAL LINE (UVC/PICC)' : 'PERIPHERAL LINE SAFE'}
            </span>
          </div>
        </div>

        {/* Patient Demographics Banner */}
        <div className="bg-slate-50 p-3 rounded border border-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
            <strong className="text-slate-900">{p.patient_name}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">UHID</span>
            <strong className="font-mono text-slate-900">{p.patient_uhid}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Day of Life / Gestation</span>
            <strong className="text-slate-900">DOL {p.day_of_life} {p.gestational_age_weeks ? `(${p.gestational_age_weeks} wks)` : ''}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Birth / Current Weight</span>
            <strong className="text-slate-900">{p.birth_weight_kg} kg / {p.current_weight_kg} kg</strong>
          </div>
        </div>

        {/* Key Nutritional & Fluid Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-blue-50/80 rounded border border-blue-200">
            <span className="text-blue-900 font-bold block text-[10px] uppercase">Fluid Balance</span>
            <span className="text-sm font-extrabold text-blue-950">{p.parenteral_fluid_ml_day} mL/day</span>
            <span className="text-[10px] text-blue-700 block mt-0.5">Rate: {(p.parenteral_fluid_ml_day / 24).toFixed(2)} mL/hr</span>
          </div>

          <div className="p-2.5 bg-indigo-50/80 rounded border border-indigo-200">
            <span className="text-indigo-900 font-bold block text-[10px] uppercase">GIR (mg/kg/min)</span>
            <span className="text-sm font-extrabold text-indigo-950">{p.glucose_infusion_rate_gir}</span>
            <span className="text-[10px] text-indigo-700 block mt-0.5">Dextrose {p.dextrose_percent}% ({p.dextrose_volume_ml} mL)</span>
          </div>

          <div className="p-2.5 bg-amber-50/80 rounded border border-amber-200">
            <span className="text-amber-900 font-bold block text-[10px] uppercase">Total Energy</span>
            <span className="text-sm font-extrabold text-amber-950">{p.calories_per_kg_day} kcal/kg/d</span>
            <span className="text-[10px] text-amber-700 block mt-0.5">Total: {p.total_calories_kcal_day} kcal/d</span>
          </div>

          <div className="p-2.5 bg-cyan-50/80 rounded border border-cyan-200">
            <span className="text-cyan-900 font-bold block text-[10px] uppercase">Total Osmolarity</span>
            <span className={`text-sm font-extrabold ${p.total_osmolarity_mosm_l > 900 ? 'text-rose-700' : 'text-cyan-950'}`}>
              {p.total_osmolarity_mosm_l} mOsm/L
            </span>
            <span className="text-[10px] text-cyan-700 block mt-0.5">NPC:N = {p.non_protein_calorie_nitrogen_ratio}:1</span>
          </div>
        </div>

        {/* Compounding Recipe Details */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-300 pb-1">
            PHARMACY CLEANROOM COMPOUNDING SPECIFICATIONS (24-HOUR VOLUME)
          </h3>
          <table className="w-full text-left text-xs border border-slate-300">
            <thead className="bg-slate-100 font-bold text-slate-800">
              <tr>
                <th className="p-2 border-b border-r border-slate-300">Solution / Nutrient</th>
                <th className="p-2 border-b border-r border-slate-300">Prescribed Target</th>
                <th className="p-2 border-b border-r border-slate-300">Net Volume (mL)</th>
                <th className="p-2 border-b border-slate-300">Compounding Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">Dextrose Solution Base</td>
                <td className="p-2 border-r border-slate-200">{p.dextrose_percent}% concentration</td>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-blue-900">{p.dextrose_volume_ml} mL</td>
                <td className="p-2 text-slate-600">Aqueous carrier. Compound using sterile WFI / concentrated D50%</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">Amino Acids ({p.amino_acid_solution_type})</td>
                <td className="p-2 border-r border-slate-200">{p.amino_acid_g_per_kg_day} g/kg/day</td>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-amber-900">{p.amino_acid_volume_ml} mL</td>
                <td className="p-2 text-slate-600">Add to aqueous carrier bag prior to phosphate addition</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">20% Lipid Emulsion ({p.lipid_emulsion_type})</td>
                <td className="p-2 border-r border-slate-200">{p.lipid_g_per_kg_day} g/kg/day</td>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-emerald-900">{p.lipid_volume_ml} mL</td>
                <td className="p-2 text-slate-600">
                  Infuse separately via dedicated syringe pump @ {(p.lipid_volume_ml / p.lipid_infusion_hours).toFixed(2)} mL/hr. Light-protective cover mandatory.
                </td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">Sodium (NaCl 3% / Conc.)</td>
                <td className="p-2 border-r border-slate-200">{p.sodium_meq_per_kg_day} mEq/kg/day</td>
                <td className="p-2 border-r border-slate-200 font-mono">{(p.sodium_meq_per_kg_day * p.current_weight_kg).toFixed(2)} mEq</td>
                <td className="p-2 text-slate-600">Additive to aqueous bag</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">Potassium (KCl)</td>
                <td className="p-2 border-r border-slate-200">{p.potassium_meq_per_kg_day} mEq/kg/day</td>
                <td className="p-2 border-r border-slate-200 font-mono">{(p.potassium_meq_per_kg_day * p.current_weight_kg).toFixed(2)} mEq</td>
                <td className="p-2 text-slate-600">Additive to aqueous bag</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">10% Calcium Gluconate</td>
                <td className="p-2 border-r border-slate-200">{p.calcium_gluconate_ml_per_kg_day} mL/kg/day</td>
                <td className="p-2 border-r border-slate-200 font-mono">{(p.calcium_gluconate_ml_per_kg_day * p.current_weight_kg).toFixed(2)} mL</td>
                <td className="p-2 text-rose-700 font-semibold">Add LAST to prevent Calcium-Phosphate precipitation!</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">Phosphate & Magnesium</td>
                <td className="p-2 border-r border-slate-200">PO4: {p.phosphate_mmol_per_kg_day} mmol/kg | Mg: {p.magnesium_sulfate_ml_day} mL/d</td>
                <td className="p-2 border-r border-slate-200 font-mono">{(p.phosphate_mmol_per_kg_day * p.current_weight_kg).toFixed(2)} mmol</td>
                <td className="p-2 text-slate-600">Mix thoroughly before calcium addition</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 font-bold">Heparin & MVI Pediatric</td>
                <td className="p-2 border-r border-slate-200">Heparin: {p.heparin_units_per_ml} U/mL | MVI: {p.multivitamin_mvi_ml_day} mL/d</td>
                <td className="p-2 border-r border-slate-200 font-mono">Standard Additives</td>
                <td className="p-2 text-slate-600">Heparin maintains central line lumen patency</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Special Instructions */}
        {p.notes && (
          <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs">
            <span className="font-bold text-amber-900 block mb-0.5">Special Prescriber Instructions:</span>
            <p className="text-slate-800">{p.notes}</p>
          </div>
        )}

        {/* Bedside Monitoring Checkpoints (Recent Labs) */}
        {labs.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-300 pb-1">
              RECENT BEDSIDE GLUCOSE & BIOCHEMICAL SURVEILLANCE
            </h3>
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 font-bold text-slate-800">
                <tr>
                  <th className="p-1.5 border-b border-r border-slate-300">Datetime</th>
                  <th className="p-1.5 border-b border-r border-slate-300">Glucose (mg/dL)</th>
                  <th className="p-1.5 border-b border-r border-slate-300">Na / K</th>
                  <th className="p-1.5 border-b border-r border-slate-300">Triglycerides</th>
                  <th className="p-1.5 border-b border-slate-300">GIR Adjusted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {labs.slice(0, 5).map(l => (
                  <tr key={l.id}>
                    <td className="p-1.5 border-r border-slate-200">{l.monitoring_datetime.replace('T', ' ')}</td>
                    <td className="p-1.5 border-r border-slate-200 font-bold">{l.blood_glucose_mg_dl}</td>
                    <td className="p-1.5 border-r border-slate-200">{l.serum_sodium_meq_l ?? '-'}/{l.serum_potassium_meq_l ?? '-'}</td>
                    <td className="p-1.5 border-r border-slate-200">{l.serum_triglycerides_mg_dl ?? '-'}</td>
                    <td className="p-1.5">{l.gir_adjusted_flag === 1 ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signatures & Verification */}
        <div className="pt-6 border-t-2 border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs">
          <div className="border-t border-slate-400 pt-2 text-center">
            <span className="font-bold block text-slate-900">{p.prescribed_by_name || 'Attending Neonatologist'}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Prescribing Neonatologist</span>
            <span className="text-[9px] text-slate-400 mt-1 block">Signed: {p.prescription_date}</span>
          </div>

          <div className="border-t border-slate-400 pt-2 text-center">
            <span className="font-bold block text-slate-900">
              {p.verified_by_name || (p.status === 'compounded' ? 'Verified Pharmacist' : 'Pending Verification')}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Cleanroom Compounding Pharmacist</span>
            <span className="text-[9px] text-slate-400 mt-1 block">
              {p.compounded_at ? `Compounded: ${p.compounded_at}` : 'Double-check verification required'}
            </span>
          </div>

          <div className="border-t border-slate-400 pt-2 text-center">
            <span className="font-bold block text-slate-900">Bedside Nursing Staff</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Infusion Line Verification</span>
            <span className="text-[9px] text-slate-400 mt-1 block">Line checked: UVC/PICC tip confirmed</span>
          </div>
        </div>
      </div>
    </div>
  );
};
