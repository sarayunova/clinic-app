import React, { useState } from 'react';
import {
  logTransfusion,
  reportTransfusionReaction,
  type BloodComponentType,
  type BloodGroupAbo,
} from '../api';

interface TransfusionLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: number;
  patientName: string;
  uhid: string;
}

export function TransfusionLogModal({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  patientName,
  uhid,
}: TransfusionLogModalProps) {
  const [componentType, setComponentType] = useState<BloodComponentType>('PRBC');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitBloodGroup, setUnitBloodGroup] = useState<BloodGroupAbo>('B_POS');
  const [startTime, setStartTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [verifier1, setVerifier1] = useState('');
  const [verifier2, setVerifier2] = useState('');

  // Pre-vitals
  const [preTemp, setPreTemp] = useState<number | ''>(36.8);
  const [preHr, setPreHr] = useState<number | ''>(82);
  const [preBp, setPreBp] = useState('118/76');

  // 15-minute vitals
  const [v15Temp, setV15Temp] = useState<number | ''>(37.0);
  const [v15Hr, setV15Hr] = useState<number | ''>(84);
  const [v15Bp, setV15Bp] = useState('116/74');

  // Adverse Reaction Toggle
  const [adverseReaction, setAdverseReaction] = useState(false);
  const [reactionType, setReactionType] = useState('ALLERGIC_URTICARIAL');
  const [reactionDetails, setReactionDetails] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitNumber || !verifier1 || !verifier2) {
      alert('Please fill in Unit Number and both nurse verifiers.');
      return;
    }

    try {
      setSaving(true);
      const res = await logTransfusion({
        patientId,
        unitNumber,
        componentType,
        unitBloodGroup,
        startTime,
        twoNurseVerifier1: verifier1,
        twoNurseVerifier2: verifier2,
        preVitalsTemp: preTemp !== '' ? Number(preTemp) : null,
        preVitalsHr: preHr !== '' ? Number(preHr) : null,
        preVitalsBp: preBp || null,
        vitals15mTemp: v15Temp !== '' ? Number(v15Temp) : null,
        vitals15mHr: v15Hr !== '' ? Number(v15Hr) : null,
        vitals15mBp: v15Bp || null,
      });

      if (adverseReaction) {
        await reportTransfusionReaction(res.id, {
          reactionType,
          reactionDetails: reactionDetails || 'Adverse reaction noted during infusion.',
          actionTaken: actionTaken || 'Transfusion stopped immediately. Notified duty doctor & blood bank.',
          postVitalsTemp: v15Temp !== '' ? Number(v15Temp) : null,
          postVitalsHr: v15Hr !== '' ? Number(v15Hr) : null,
          postVitalsBp: v15Bp || null,
        });
      }

      alert('Blood unit administration recorded successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Failed to log transfusion: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden border border-slate-200 text-xs"
      >
        <div className="bg-rose-700 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-sm tracking-wide flex items-center gap-2">
              <span>🩺</span> Bedside Transfusion Safety & Vitals Verification
            </h2>
            <div className="text-[11px] text-rose-100 mt-0.5">
              Patient: <strong>{patientName}</strong> (UHID: {uhid})
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white font-bold text-lg"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto bg-slate-50/50">
          {/* Blood Product Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Component Type</label>
              <select
                value={componentType}
                onChange={(e) => setComponentType(e.target.value as BloodComponentType)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-bold"
              >
                <option value="PRBC">Packed Red Cells (PRBC)</option>
                <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                <option value="PLATELET_RDP">Platelet RDP (Random)</option>
                <option value="PLATELET_SDP">Platelet SDP (Single Donor)</option>
                <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
                <option value="WHOLE_BLOOD">Whole Blood</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit / Bag Barcode *</label>
              <input
                type="text"
                required
                placeholder="e.g. PRBC-2026-9901"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Blood Group</label>
              <select
                value={unitBloodGroup}
                onChange={(e) => setUnitBloodGroup(e.target.value as BloodGroupAbo)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-bold"
              >
                <option value="O_NEG">O Negative (Universal)</option>
                <option value="O_POS">O Positive</option>
                <option value="A_POS">A Positive</option>
                <option value="A_NEG">A Negative</option>
                <option value="B_POS">B Positive</option>
                <option value="B_NEG">B Negative</option>
                <option value="AB_POS">AB Positive</option>
                <option value="AB_NEG">AB Negative</option>
              </select>
            </div>
          </div>

          {/* 2-Person Bedside Identification Check */}
          <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 space-y-2">
            <span className="font-bold text-rose-900 block uppercase tracking-wider text-[10px]">
              Mandatory 2-Nurse Bedside Identity & Unit Cross-Verification
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nurse Verifier 1 *</label>
                <input
                  type="text"
                  required
                  placeholder="Staff Nurse 1 Name"
                  value={verifier1}
                  onChange={(e) => setVerifier1(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nurse Verifier 2 *</label>
                <input
                  type="text"
                  required
                  placeholder="Staff Nurse 2 Name"
                  value={verifier2}
                  onChange={(e) => setVerifier2(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Pre-Transfusion Vitals */}
          <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
            <span className="font-bold text-slate-800 text-[11px] block">Baseline (Pre-Transfusion) Vitals:</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={preTemp}
                  onChange={(e) => setPreTemp(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={preHr}
                  onChange={(e) => setPreHr(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Blood Pressure</label>
                <input
                  type="text"
                  value={preBp}
                  onChange={(e) => setPreBp(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-xs"
                />
              </div>
            </div>
          </div>

          {/* 15-Minute Vitals (Critical for Acute Hemolysis) */}
          <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/40 space-y-2">
            <span className="font-bold text-amber-900 text-[11px] block">15-Minute Vital Signs Check:</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">15m Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={v15Temp}
                  onChange={(e) => setV15Temp(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">15m Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={v15Hr}
                  onChange={(e) => setV15Hr(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">15m Blood Pressure</label>
                <input
                  type="text"
                  value={v15Bp}
                  onChange={(e) => setV15Bp(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Adverse Reaction Alert Toggle */}
          <div className="border border-red-200 rounded-xl p-3 bg-red-50/50 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={adverseReaction}
                onChange={(e) => setAdverseReaction(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
              />
              <span className="font-bold text-red-800 text-xs">
                Report Acute Transfusion Reaction / Adverse Symptoms
              </span>
            </label>

            {adverseReaction && (
              <div className="space-y-3 pt-2 border-t border-red-200 animate-in fade-in duration-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Suspected Reaction Type</label>
                  <select
                    value={reactionType}
                    onChange={(e) => setReactionType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-bold text-red-700"
                  >
                    <option value="ALLERGIC_URTICARIAL">Allergic Urticaria / Pruritus / Rash</option>
                    <option value="FEBRILE_NON_HEMOLYTIC">Febrile Non-Hemolytic Reaction (Temp rise &ge; 1°C)</option>
                    <option value="ACUTE_HEMOLYTIC">Acute Hemolytic Reaction (AHTR - Flank pain, dark urine, shock)</option>
                    <option value="TRALI">TRALI (Transfusion-Related Acute Lung Injury)</option>
                    <option value="TACO">TACO (Transfusion-Associated Circulatory Overload)</option>
                    <option value="BACTERIAL_SEPSIS">Bacterial Contamination / Septic Shock</option>
                    <option value="OTHER">Other Adverse Reaction</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reaction Details & Clinical Presentation</label>
                  <textarea
                    rows={2}
                    value={reactionDetails}
                    onChange={(e) => setReactionDetails(e.target.value)}
                    placeholder="Note chills, rigors, fever, backache, shortness of breath, or rash..."
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Action Taken & Interventions</label>
                  <textarea
                    rows={2}
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="Transfusion stopped immediately, IV line flushed, doctor notified, drugs given..."
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold shadow-sm"
          >
            {saving ? 'Saving...' : 'Authorize & Log Transfusion'}
          </button>
        </div>
      </form>
    </div>
  );
}
