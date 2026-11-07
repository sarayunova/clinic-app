import React, { useState } from 'react';
import {
  createBloodRequisition,
  type BloodGroupAbo,
  type BloodUrgency,
} from '../api';

const INDICATION_PRESETS = [
  'Elective LSCS (Cesarean Section) Standby',
  'Severe Postpartum Hemorrhage (PPH) - Uterine Atony',
  'Placenta Previa / Accreta Spectrum (High Risk Hemorrhage)',
  'Severe Anemia in Third Trimester / Labor (Hb < 7.0 g/dL)',
  'Ruptured Ectopic Pregnancy with Hemoperitoneum',
  'Abruptio Placentae with Secondary Coagulopathy (DIC)',
  'Major Gynecological Oncologic Debulking Surgery',
];

interface BloodRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId?: number;
  patientsList?: { id: number; fullName: string; patientNumber: string }[];
}

export function BloodRequisitionModal({
  isOpen,
  onClose,
  onSuccess,
  patientId: initialPatientId,
  patientsList = [],
}: BloodRequisitionModalProps) {
  const [patientId, setPatientId] = useState<number | ''>(initialPatientId || (patientsList[0]?.id || ''));
  const [bloodGroup, setBloodGroup] = useState<BloodGroupAbo>('UNKNOWN');
  const [urgency, setUrgency] = useState<BloodUrgency>('URGENT_WITHIN_2HR');
  const [indication, setIndication] = useState<string>(INDICATION_PRESETS[0] || 'Elective LSCS (Cesarean Section) Standby');
  const [prbcUnits, setPrbcUnits] = useState(2);
  const [ffpUnits, setFfpUnits] = useState(2);
  const [plateletUnits, setPlateletUnits] = useState(0);
  const [cryoUnits, setCryoUnits] = useState(0);
  const [wholeBloodUnits, setWholeBloodUnits] = useState(0);
  const [leukodepleted, setLeukodepleted] = useState(true);
  const [irradiated, setIrradiated] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      alert('Please select a patient.');
      return;
    }

    try {
      setSaving(true);
      const specials: string[] = [];
      if (leukodepleted) specials.push('Leukodepleted');
      if (irradiated) specials.push('Irradiated');

      await createBloodRequisition({
        patientId: Number(patientId),
        bloodGroupAbo: bloodGroup,
        urgency,
        clinicalIndication: indication,
        prbcUnits: Number(prbcUnits),
        ffpUnits: Number(ffpUnits),
        plateletUnits: Number(plateletUnits),
        cryoprecipitateUnits: Number(cryoUnits),
        wholeBloodUnits: Number(wholeBloodUnits),
        specialRequirements: specials.length > 0 ? specials.join(', ') : null,
        notes: notes || null,
      });

      alert('Blood component requisition submitted successfully to Blood Bank!');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Failed to submit blood requisition: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden border border-slate-200 text-xs"
      >
        <div className="bg-rose-700 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">🩸</span>
            <h2 className="font-bold text-sm tracking-wide">
              Blood Bank Cross-Match & Component Requisition
            </h2>
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
          {/* Patient Selection */}
          {!initialPatientId && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Patient *</label>
              <select
                required
                value={patientId}
                onChange={(e) => setPatientId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="">-- Choose Patient --</option>
                {patientsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.patientNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Presets */}
          <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
            <span className="font-bold text-rose-800 block mb-1.5 text-[11px]">Clinical Indication Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {INDICATION_PRESETS.map((ind, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setIndication(ind)}
                  className="px-2 py-1 bg-white hover:bg-rose-100 text-rose-800 rounded border border-rose-300 text-[10px] font-medium transition-colors"
                >
                  {ind.split('(')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinical Indication *</label>
              <input
                type="text"
                required
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Patient Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroupAbo)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="UNKNOWN">Unknown (Send sample)</option>
                  <option value="A_POS">A Positive</option>
                  <option value="A_NEG">A Negative</option>
                  <option value="B_POS">B Positive</option>
                  <option value="B_NEG">B Negative</option>
                  <option value="AB_POS">AB Positive</option>
                  <option value="AB_NEG">AB Negative</option>
                  <option value="O_POS">O Positive</option>
                  <option value="O_NEG">O Negative (Universal)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Urgency Level</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as BloodUrgency)}
                  className={`w-full px-2.5 py-2 border rounded-lg font-bold ${
                    urgency === 'STAT_EMERGENCY_UNMATCHED'
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : urgency === 'URGENT_WITHIN_2HR'
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  <option value="ROUTINE">Routine (Elective)</option>
                  <option value="URGENT_WITHIN_2HR">Urgent (Within 2 Hours)</option>
                  <option value="STAT_EMERGENCY_UNMATCHED">STAT Emergency (Unmatched O-neg)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Component Quantities */}
          <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block">
              Requested Blood Components (Units)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div>
                <label className="block text-[10px] font-bold text-rose-700 mb-1">PRBC</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={prbcUnits}
                  onChange={(e) => setPrbcUnits(Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center font-bold text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-amber-700 mb-1">FFP</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={ffpUnits}
                  onChange={(e) => setFfpUnits(Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center font-bold text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-blue-700 mb-1">Platelets (RDP/SDP)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={plateletUnits}
                  onChange={(e) => setPlateletUnits(Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center font-bold text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-purple-700 mb-1">Cryoprecipitate</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={cryoUnits}
                  onChange={(e) => setCryoUnits(Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center font-bold text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">Whole Blood</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={wholeBloodUnits}
                  onChange={(e) => setWholeBloodUnits(Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-center font-bold text-sm"
                />
              </div>
            </div>
          </div>

          {/* Special Requirements */}
          <div className="flex gap-4 p-2.5 bg-slate-100 rounded-lg text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={leukodepleted}
                onChange={(e) => setLeukodepleted(e.target.checked)}
                className="rounded text-rose-600"
              />
              <span className="font-semibold text-slate-800">Leukodepleted</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={irradiated}
                onChange={(e) => setIrradiated(e.target.checked)}
                className="rounded text-rose-600"
              />
              <span className="font-semibold text-slate-800">Irradiated Blood Products</span>
            </label>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Instructions for Blood Bank</label>
            <input
              type="text"
              placeholder="e.g. Keep ready in OT-2 blood refrigerator, delivery anticipated at 11 AM"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            />
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
            {saving ? 'Submitting...' : 'Dispatch Requisition to Blood Bank'}
          </button>
        </div>
      </form>
    </div>
  );
}
