import React, { useState, useMemo } from 'react';
import {
  lookupBroselowZone,
  BROSELOW_ZONES,
  type BroselowColor,
  type BroselowZoneInfo,
} from '../palsEngine';
import { recordBroselowEvent } from '../api';

interface PalsBroselowDrawerProps {
  patientId?: number;
  patientName?: string;
  initialLengthCm?: number;
  initialWeightKg?: number;
  isOpen: boolean;
  onClose: () => void;
  onEventLogged?: () => void;
}

export const PalsBroselowDrawer: React.FC<PalsBroselowDrawerProps> = ({
  patientId,
  patientName = 'Pediatric Patient',
  initialLengthCm = 95,
  initialWeightKg = 13,
  isOpen,
  onClose,
  onEventLogged,
}) => {
  const [lengthCm, setLengthCm] = useState<number>(initialLengthCm);
  const [weightKg, setWeightKg] = useState<number>(initialWeightKg);
  const [inputMode, setInputMode] = useState<'length' | 'weight'>('length');

  // Emergency Event Logging state
  const [isLoggingEvent, setIsLoggingEvent] = useState(false);
  const [eventType, setEventType] = useState('cardiac_arrest_code_blue');
  const [outcome, setOutcome] = useState('rosc_achieved');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const activeZone: BroselowZoneInfo = useMemo(() => {
    if (inputMode === 'length') {
      return lookupBroselowZone({ lengthCm });
    } else {
      return lookupBroselowZone({ weightKg });
    }
  }, [lengthCm, weightKg, inputMode]);

  if (!isOpen) return null;

  const handleLogEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setLogError('Patient ID is required to log a Code Blue event');
      return;
    }
    setSubmitting(true);
    setLogError(null);
    setLogSuccess(null);

    try {
      await recordBroselowEvent({
        patientId,
        eventDatetime: new Date().toISOString(),
        eventType,
        measuredLengthCm: Number(lengthCm),
        outcome,
        clinicalSummary: clinicalSummary || null,
      });
      setLogSuccess('Code Blue resuscitation event successfully logged into patient medical record!');
      setIsLoggingEvent(false);
      if (onEventLogged) onEventLogged();
    } catch (err: unknown) {
      setLogError(err instanceof Error ? err.message : 'Failed to record resuscitation event');
    } finally {
      setSubmitting(false);
    }
  };

  const zonesList: BroselowColor[] = [
    'grey',
    'pink',
    'red',
    'purple',
    'yellow',
    'white',
    'blue',
    'orange',
    'green',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Resuscitation Header */}
        <div
          className="p-5 text-white flex justify-between items-center transition-colors shadow-md"
          style={{ backgroundColor: activeZone.hexColor }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h2 className="text-xl font-black tracking-wide uppercase">
                Broselow Resuscitation Emergency Tape & Formulary
              </h2>
            </div>
            <p className="text-xs text-white/90 mt-0.5">
              Active Patient: <span className="font-bold underline">{patientName}</span> &bull; AHA PALS Weight-Stratified Emergency Formulary
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl font-bold p-1 rounded transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Zone Selector Strip */}
        <div className="bg-gray-100 p-2 overflow-x-auto flex items-center gap-1.5 border-b border-gray-200">
          {zonesList.map((zColor) => {
            const z = BROSELOW_ZONES[zColor];
            const isSelected = activeZone.color === zColor;
            return (
              <button
                key={zColor}
                type="button"
                onClick={() => {
                  setInputMode('length');
                  setLengthCm(Math.round((z.lengthRangeCm[0] + z.lengthRangeCm[1]) / 2));
                  setWeightKg(z.midWeightKg);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                  isSelected
                    ? 'ring-2 ring-gray-900 shadow-md scale-105'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: z.hexColor,
                  color: z.textColor,
                  borderColor: isSelected ? '#000' : 'transparent',
                }}
              >
                {z.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {logSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <span>✅</span> {logSuccess}
            </div>
          )}
          {logError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-800 text-xs font-semibold flex items-center gap-2">
              <span>🚨</span> {logError}
            </div>
          )}

          {/* Interactive Length / Weight Dual Inputs */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-black text-gray-800 uppercase tracking-wide">
                  Child Crown-to-Heel Length: <span className="text-blue-600 font-bold text-sm">{lengthCm} cm</span>
                </label>
                <button
                  type="button"
                  onClick={() => setInputMode('length')}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${inputMode === 'length' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Length-Based (Tape)
                </button>
              </div>
              <input
                type="range"
                min="46"
                max="144"
                value={lengthCm}
                onChange={(e) => {
                  setInputMode('length');
                  setLengthCm(Number(e.target.value));
                }}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>46 cm (Grey)</span>
                <span>80 cm (Purple)</span>
                <span>110 cm (White)</span>
                <span>144 cm (Green)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-black text-gray-800 uppercase tracking-wide">
                  Estimated Weight: <span className="text-purple-600 font-bold text-sm">{activeZone.midWeightKg} kg</span>
                  <span className="text-gray-500 text-xs font-normal ml-1">({activeZone.weightRangeKg[0]} - {activeZone.weightRangeKg[1]} kg range)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setInputMode('weight')}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${inputMode === 'weight' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Weight-Based
                </button>
              </div>
              <input
                type="range"
                min="3"
                max="36"
                step="0.5"
                value={weightKg}
                onChange={(e) => {
                  setInputMode('weight');
                  setWeightKg(Number(e.target.value));
                }}
                className="w-full accent-purple-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>3 kg</span>
                <span>10 kg</span>
                <span>20 kg</span>
                <span>36 kg</span>
              </div>
            </div>
          </div>

          {/* Quick Resuscitation Dossier Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Airway Equipment Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-xl">🫁</span>
                <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wide">
                  Airway & Intubation Equipment
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">ETT Cuffed:</span>
                  <span className="font-extrabold text-blue-700 text-sm">{activeZone.ettCuffedSize} mm ID</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">ETT Uncuffed:</span>
                  <span className="font-bold text-gray-800">{activeZone.ettUncuffedSize} mm ID</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">Depth at Lip:</span>
                  <span className="font-bold text-gray-800">{activeZone.ettDepthLipCm} cm</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">Laryngoscope:</span>
                  <span className="font-semibold text-gray-800">{activeZone.laryngoscopeBlade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Suction Catheter:</span>
                  <span className="font-semibold text-gray-800">{activeZone.suctionCatheterFr} Fr</span>
                </div>
              </div>
            </div>

            {/* Defibrillation & Cardioversion Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-xl">⚡</span>
                <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wide">
                  Defibrillation & Joules (PALS)
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">Initial Defibrillation (2 J/kg):</span>
                  <span className="font-black text-rose-700 text-base">{activeZone.defibInitialJoules} Joules</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">Subsequent Defib (4 J/kg):</span>
                  <span className="font-black text-rose-900 text-base">{activeZone.defibSubsequentJoules} Joules</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">Cardioversion (0.5 - 1 J/kg):</span>
                  <span className="font-bold text-gray-800">
                    {Math.round(activeZone.midWeightKg * 0.5)} - {Math.round(activeZone.midWeightKg * 1)} Joules
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 pt-1">
                  Apply pediatric paddles for infants &lt; 10 kg; adult paddles with anterior-posterior placement for larger children.
                </div>
              </div>
            </div>

            {/* Resuscitation Fluid & Glucose Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-xl">💧</span>
                <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wide">
                  Fluids & Hypoglycemia Bolus
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">Normal Saline Bolus (20 mL/kg):</span>
                  <span className="font-black text-blue-700 text-sm">{activeZone.fluidBolusMl} mL IV/IO</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1">
                  <span className="text-gray-500">10% Dextrose (D10W, 2 mL/kg):</span>
                  <span className="font-black text-amber-700 text-sm">{activeZone.dextrose10PercentMl} mL IV/IO</span>
                </div>
                <div className="text-[10px] text-gray-500 pt-1">
                  Fluid bolus over 5-10 minutes via pressure bag. Recheck for crackles and hepatomegaly after each bolus.
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Resuscitation Formulary Matrix */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase text-gray-900 tracking-wide">
                  Pre-Calculated Weight-Based Emergency Resuscitation Drugs
                </h3>
                <p className="text-[11px] text-gray-500">
                  Target Weight: <strong className="text-gray-800">{activeZone.midWeightKg} kg</strong> ({activeZone.label})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLoggingEvent(!isLoggingEvent)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow flex items-center gap-1.5"
              >
                <span>🚨</span> {isLoggingEvent ? 'Hide Resuscitation Form' : 'Log Code Blue Resuscitation Event'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left divide-y divide-gray-200">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2 px-3">Medication</th>
                    <th className="py-2 px-3">Concentration</th>
                    <th className="py-2 px-3">Formula / Target</th>
                    <th className="py-2 px-3 text-right">Pre-Calculated Dose</th>
                    <th className="py-2 px-3">Route & Push Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="bg-red-50/70 font-semibold">
                    <td className="py-2.5 px-3 text-red-900 font-bold">Epinephrine (Cardiac Arrest)</td>
                    <td className="py-2.5 px-3 font-mono">1:10,000 (0.1 mg/mL)</td>
                    <td className="py-2.5 px-3">0.01 mg/kg (0.1 mL/kg)</td>
                    <td className="py-2.5 px-3 text-right font-black text-red-700 text-sm">
                      {activeZone.epinephrineIvDoseMl} mL
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">IV/IO push q3-5 min + 5 mL flush</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-gray-900">Amiodarone (Refractory VF/pVT)</td>
                    <td className="py-2.5 px-3 font-mono">50 mg/mL</td>
                    <td className="py-2.5 px-3">5 mg/kg bolus</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                      {activeZone.amiodaroneMg} mg ({Number((activeZone.amiodaroneMg / 50).toFixed(2))} mL)
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">Rapid IV/IO bolus during CPR</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-gray-900">Atropine (Symptomatic Bradycardia)</td>
                    <td className="py-2.5 px-3 font-mono">0.1 mg/mL or 0.6 mg/mL</td>
                    <td className="py-2.5 px-3">0.02 mg/kg (min 0.1 mg)</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                      {activeZone.atropineMg} mg
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">IV/IO push; may repeat once</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-gray-900">Adenosine (SVT 1st Dose)</td>
                    <td className="py-2.5 px-3 font-mono">3 mg/mL</td>
                    <td className="py-2.5 px-3">0.1 mg/kg (max 6 mg)</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                      {activeZone.adenosineFirstDoseMg} mg
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">Rapid 1-2 sec IV push + 10 mL saline flush</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-gray-900">Midazolam (Status Epilepticus)</td>
                    <td className="py-2.5 px-3 font-mono">1 mg/mL or 5 mg/mL</td>
                    <td className="py-2.5 px-3">0.15 mg/kg IV / 0.2 mg/kg IM/IN</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                      {Number((activeZone.midWeightKg * 0.15).toFixed(2))} mg IV
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">Slow IV over 2 min / Buccal / IN</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-gray-900">Ceftriaxone (Septic Shock)</td>
                    <td className="py-2.5 px-3 font-mono">Vial reconstitution</td>
                    <td className="py-2.5 px-3">100 mg/kg IV (max 2 g)</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                      {Math.min(2000, Math.round(activeZone.midWeightKg * 100))} mg
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">IV infusion over 30 min</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Emergency Code Blue Logging Sub-Form */}
          {isLoggingEvent && (
            <form onSubmit={handleLogEvent} className="bg-red-50/70 p-5 rounded-xl border border-red-300 space-y-4">
              <div className="flex items-center gap-2 border-b border-red-200 pb-2 text-red-900 font-black uppercase text-xs">
                <span>🚨</span> Log Code Blue Resuscitation Event for Medical Record
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Event Type *
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white font-medium"
                  >
                    <option value="cardiac_arrest_code_blue">Cardiac Arrest (Code Blue)</option>
                    <option value="acute_respiratory_failure">Acute Respiratory Failure / Apnea</option>
                    <option value="status_epilepticus">Status Epilepticus</option>
                    <option value="severe_septic_shock">Severe Septic Shock</option>
                    <option value="anaphylaxis">Severe Anaphylaxis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Resuscitation Outcome *
                  </label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white font-medium"
                  >
                    <option value="rosc_achieved">ROSC Achieved (Return of Spontaneous Circulation)</option>
                    <option value="stabilized_transferred_picu">Stabilized & Transferred to PICU</option>
                    <option value="ongoing_cpr">Ongoing CPR / Prolonged Resuscitation</option>
                    <option value="expired">Expired (Efforts Ceased)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Confirmed Broselow Tape Color
                  </label>
                  <input
                    type="text"
                    disabled
                    value={activeZone.label}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-gray-100 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                  Resuscitation Narrative Summary
                </label>
                <textarea
                  rows={2}
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  placeholder="e.g. Asystolic arrest. 2 cycles CPR performed. Bag-valve-mask with 100% O2, ETT 4.0 cuffed placed at 11.5 cm depth. 1 dose Epinephrine 0.85 mL given. ROSC achieved after 4 minutes."
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoggingEvent(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 shadow"
                >
                  {submitting ? 'Recording Event...' : 'Save Resuscitation Event'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs">
          <span className="text-gray-500">
            AHA PALS 2020 Standard &bull; NABH Pediatric Resuscitation Code Compliant
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold"
          >
            Close Resuscitation Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
