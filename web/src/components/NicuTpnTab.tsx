import React, { useState, useEffect } from 'react';
import {
  getNicuTpnPrescriptions,
  getNicuTpnPrescription,
  updateNicuTpnPrescriptionStatus,
  deleteNicuTpnPrescription,
  deleteNicuTpnLab,
  type NicuTpnPrescriptionRecord,
  type NicuTpnLabRecord,
} from '../api';
import { NicuTpnModal } from './NicuTpnModal';
import { NicuTpnLabModal } from './NicuTpnLabModal';

interface NicuTpnTabProps {
  patientId: number;
  patientName: string;
}

export const NicuTpnTab: React.FC<NicuTpnTabProps> = ({ patientId, patientName }) => {
  const [prescriptions, setPrescriptions] = useState<NicuTpnPrescriptionRecord[]>([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<number | null>(null);
  const [labs, setLabs] = useState<NicuTpnLabRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPrescribeOpen, setIsPrescribeOpen] = useState(false);
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [activePrescriptionForLab, setActivePrescriptionForLab] = useState<NicuTpnPrescriptionRecord | null>(null);

  const fetchPrescriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNicuTpnPrescriptions({ patientId });
      setPrescriptions(res.prescriptions);
      const first = res.prescriptions[0];
      if (first) {
        setSelectedPrescriptionId(first.id);
        fetchLabs(first.id);
      } else {
        setSelectedPrescriptionId(null);
        setLabs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load TPN prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchLabs = async (id: number) => {
    try {
      const res = await getNicuTpnPrescription(id);
      setLabs(res.labs);
    } catch {
      setLabs([]);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [patientId]);

  const handleSelectPrescription = (id: number) => {
    setSelectedPrescriptionId(id);
    fetchLabs(id);
  };

  const handleStatusChange = async (
    id: number,
    status: 'active' | 'compounded' | 'discontinued' | 'completed'
  ) => {
    try {
      await updateNicuTpnPrescriptionStatus(id, status);
      fetchPrescriptions();
    } catch (err: any) {
      alert(err?.message || 'Failed to update prescription status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this TPN prescription?')) return;
    try {
      await deleteNicuTpnPrescription(id);
      fetchPrescriptions();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete prescription');
    }
  };

  const handleDeleteLab = async (labId: number) => {
    if (!window.confirm('Delete this monitoring record?')) return;
    try {
      await deleteNicuTpnLab(labId);
      if (selectedPrescriptionId) fetchLabs(selectedPrescriptionId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete lab');
    }
  };

  const selectedPrescription = prescriptions.find(p => p.id === selectedPrescriptionId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded-xl shadow-md">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🧪</span> NICU Level-3 Total Parenteral Nutrition (TPN) Compounding
          </h2>
          <p className="text-xs text-blue-200 mt-0.5">
            Precision ESPGHAN/NNF fluid balance, GIR, amino acids, lipids, osmolarity, & bedside monitoring
          </p>
        </div>
        <button
          onClick={() => setIsPrescribeOpen(true)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold shadow flex items-center gap-1.5 transition"
        >
          <span>➕</span> New TPN Compounding Order
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading TPN records...</div>
      ) : prescriptions.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
          <span className="text-3xl block mb-2">🍼</span>
          <p className="text-sm font-medium text-slate-700">No NICU TPN prescriptions recorded for this patient.</p>
          <p className="text-xs text-slate-500 mt-1">Click "New TPN Compounding Order" to calculate fluids, GIR, and electrolytes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: List of Prescriptions */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              Prescription Orders ({prescriptions.length})
            </h3>
            <div className="space-y-2">
              {prescriptions.map(p => {
                const isSelected = p.id === selectedPrescriptionId;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPrescription(p.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{p.prescription_code}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'active'
                            ? 'bg-blue-100 text-blue-800'
                            : p.status === 'compounded'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Date: <strong>{p.prescription_date}</strong></span>
                        <span>DOL: <strong>{p.day_of_life}</strong></span>
                        <span>Weight: <strong>{p.current_weight_kg} kg</strong></span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
                        <span>GIR: <strong className="text-indigo-700">{p.glucose_infusion_rate_gir}</strong></span>
                        <span>Cal: <strong className="text-emerald-700">{p.calories_per_kg_day} kcal/kg</strong></span>
                        <span>Osm: <strong className={p.total_osmolarity_mosm_l > 900 ? 'text-rose-600 font-bold' : ''}>{p.total_osmolarity_mosm_l}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Order Sheet & Bedside Labs */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPrescription && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header card */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900">{selectedPrescription.prescription_code}</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          selectedPrescription.route_category === 'central_line_uvc_picc'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {selectedPrescription.route_category === 'central_line_uvc_picc' ? 'Central Access (UVC/PICC)' : 'Peripheral Access'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Prescribed on {selectedPrescription.prescription_date} by {selectedPrescription.prescribed_by_name || 'Dr. Attending'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/nicu-tpn/${selectedPrescription.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-1"
                    >
                      <span>🖨️</span> Order Sheet
                    </a>
                    {selectedPrescription.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(selectedPrescription.id, 'compounded')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        ✓ Pharmacist Verify & Compound
                      </button>
                    )}
                    {selectedPrescription.status === 'compounded' && (
                      <button
                        onClick={() => handleStatusChange(selectedPrescription.id, 'completed')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        Mark Completed
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selectedPrescription.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 text-xs rounded hover:bg-slate-100"
                      title="Delete prescription"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border-b border-slate-100 text-xs">
                  <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100">
                    <span className="text-indigo-600 font-medium block">Glucose Infusion (GIR)</span>
                    <strong className="text-lg text-indigo-950 font-bold">
                      {selectedPrescription.glucose_infusion_rate_gir}{' '}
                      <span className="text-xs font-normal">mg/kg/min</span>
                    </strong>
                    <span className="text-[10px] text-slate-500 block">Dextrose {selectedPrescription.dextrose_percent}%</span>
                  </div>

                  <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-100">
                    <span className="text-amber-700 font-medium block">Amino Acids</span>
                    <strong className="text-lg text-amber-950 font-bold">
                      {selectedPrescription.amino_acid_g_per_kg_day}{' '}
                      <span className="text-xs font-normal">g/kg/d</span>
                    </strong>
                    <span className="text-[10px] text-slate-500 block">{selectedPrescription.amino_acid_volume_ml} mL/d ({selectedPrescription.amino_acid_solution_type})</span>
                  </div>

                  <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                    <span className="text-emerald-700 font-medium block">20% Lipids</span>
                    <strong className="text-lg text-emerald-950 font-bold">
                      {selectedPrescription.lipid_g_per_kg_day}{' '}
                      <span className="text-xs font-normal">g/kg/d</span>
                    </strong>
                    <span className="text-[10px] text-slate-500 block">{selectedPrescription.lipid_volume_ml} mL/d ({selectedPrescription.lipid_emulsion_type})</span>
                  </div>

                  <div className="p-2.5 bg-cyan-50/60 rounded-lg border border-cyan-100">
                    <span className="text-cyan-700 font-medium block">Osmolarity</span>
                    <strong
                      className={`text-lg font-bold ${
                        selectedPrescription.total_osmolarity_mosm_l > 900 ? 'text-rose-600' : 'text-cyan-950'
                      }`}
                    >
                      {selectedPrescription.total_osmolarity_mosm_l}{' '}
                      <span className="text-xs font-normal">mOsm/L</span>
                    </strong>
                    <span className="text-[10px] text-slate-500 block">NPC:N = {selectedPrescription.non_protein_calorie_nitrogen_ratio}:1</span>
                  </div>
                </div>

                {/* Compounding Recipe Table */}
                <div className="p-4 border-b border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                    Pharmacy Compounding Breakdown (24h Total Fluid: {selectedPrescription.parenteral_fluid_ml_day} mL)
                  </h4>
                  <table className="w-full text-left text-xs border border-slate-200 rounded overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="py-1.5 px-3">Component</th>
                        <th className="py-1.5 px-3">Prescribed Dosing</th>
                        <th className="py-1.5 px-3">Volume to Compound</th>
                        <th className="py-1.5 px-3">Infusion Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-slate-800">Aqueous Dextrose Base</td>
                        <td className="py-1.5 px-3">Dextrose {selectedPrescription.dextrose_percent}%</td>
                        <td className="py-1.5 px-3 font-bold text-indigo-700">{selectedPrescription.dextrose_volume_ml} mL</td>
                        <td className="py-1.5 px-3">Combined with Amino Acids & Additives</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-slate-800">Amino Acid ({selectedPrescription.amino_acid_solution_type})</td>
                        <td className="py-1.5 px-3">{selectedPrescription.amino_acid_g_per_kg_day} g/kg/d</td>
                        <td className="py-1.5 px-3 font-bold text-amber-700">{selectedPrescription.amino_acid_volume_ml} mL</td>
                        <td className="py-1.5 px-3">Infuse continuously over 24h</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-slate-800">20% Lipid Emulsion ({selectedPrescription.lipid_emulsion_type})</td>
                        <td className="py-1.5 px-3">{selectedPrescription.lipid_g_per_kg_day} g/kg/d</td>
                        <td className="py-1.5 px-3 font-bold text-emerald-700">{selectedPrescription.lipid_volume_ml} mL</td>
                        <td className="py-1.5 px-3">Separate syringe piggyback @ {(selectedPrescription.lipid_volume_ml / selectedPrescription.lipid_infusion_hours).toFixed(2)} mL/h</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-slate-800">Electrolytes & Heparin</td>
                        <td className="py-1.5 px-3">
                          Na: {selectedPrescription.sodium_meq_per_kg_day} mEq/kg | K: {selectedPrescription.potassium_meq_per_kg_day} mEq/kg | Ca: {selectedPrescription.calcium_gluconate_ml_per_kg_day} mL/kg
                        </td>
                        <td className="py-1.5 px-3">
                          Heparin: {selectedPrescription.heparin_units_per_ml} U/mL | MVI: {selectedPrescription.multivitamin_mvi_ml_day} mL
                        </td>
                        <td className="py-1.5 px-3 text-slate-500">Added to aqueous bag prior to priming</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section: Bedside Lab Monitoring */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>🩸</span> Bedside Glucose & Biochemical Surveillance ({labs.length})
                    </h4>
                    <button
                      onClick={() => {
                        setActivePrescriptionForLab(selectedPrescription);
                        setIsLabModalOpen(true);
                      }}
                      className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold shadow flex items-center gap-1"
                    >
                      <span>➕</span> Log Lab Reading
                    </button>
                  </div>

                  {labs.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-3 text-center bg-slate-50 rounded border border-dashed border-slate-200">
                      No bedside glucose or lab monitoring logs recorded for this order yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-200 rounded">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="py-1.5 px-2.5">Time</th>
                            <th className="py-1.5 px-2.5">Glucose (mg/dL)</th>
                            <th className="py-1.5 px-2.5">Na / K</th>
                            <th className="py-1.5 px-2.5">Triglycerides</th>
                            <th className="py-1.5 px-2.5">GIR Adjusted</th>
                            <th className="py-1.5 px-2.5">Logged By</th>
                            <th className="py-1.5 px-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {labs.map(l => (
                            <tr key={l.id} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2.5 text-slate-800 font-medium">
                                {l.monitoring_datetime.replace('T', ' ')}
                              </td>
                              <td className="py-1.5 px-2.5">
                                <span
                                  className={`font-bold ${
                                    l.blood_glucose_mg_dl < 50
                                      ? 'text-rose-600'
                                      : l.blood_glucose_mg_dl > 150
                                      ? 'text-amber-600'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {l.blood_glucose_mg_dl}
                                </span>
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600">
                                {l.serum_sodium_meq_l ?? '-'}{' / '}{l.serum_potassium_meq_l ?? '-'}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600">
                                {l.serum_triglycerides_mg_dl ? `${l.serum_triglycerides_mg_dl} mg/dL` : '-'}
                              </td>
                              <td className="py-1.5 px-2.5">
                                {l.gir_adjusted_flag === 1 ? (
                                  <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-semibold">
                                    Yes
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">No</span>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-500">{l.logged_by_name || 'Staff'}</td>
                              <td className="py-1.5 px-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteLab(l.id)}
                                  className="text-slate-400 hover:text-rose-600"
                                  title="Delete log"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <NicuTpnModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isPrescribeOpen}
        onClose={() => setIsPrescribeOpen(false)}
        onSuccess={() => fetchPrescriptions()}
      />

      {activePrescriptionForLab && (
        <NicuTpnLabModal
          prescriptionId={activePrescriptionForLab.id}
          prescriptionCode={activePrescriptionForLab.prescription_code}
          isOpen={isLabModalOpen}
          onClose={() => {
            setIsLabModalOpen(false);
            setActivePrescriptionForLab(null);
          }}
          onSuccess={() => {
            if (selectedPrescriptionId) fetchLabs(selectedPrescriptionId);
          }}
        />
      )}
    </div>
  );
};
