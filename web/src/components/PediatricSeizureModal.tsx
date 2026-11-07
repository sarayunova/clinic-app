import React, { useState, useMemo } from 'react';
import { createPediatricSeizureEpisode, type PediatricSeizureRecord } from '../api';
import {
  evaluatePediatricSeizureProtocol,
  getBroselowZone,
  type PediatricSeizureParams,
  type BroselowZone,
} from '../pediatricSeizureEngine';

interface PediatricSeizureModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (episode: PediatricSeizureRecord) => void;
  defaultWeightKg?: number;
  defaultAgeMonths?: number;
}

export const PediatricSeizureModal: React.FC<PediatricSeizureModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultWeightKg = 14.0,
  defaultAgeMonths = 36,
}) => {
  const [seizureStartDatetime, setSeizureStartDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [seizureType, setSeizureType] = useState<
    'generalized_tonic_clonic' | 'focal_with_impaired_awareness' | 'myoclonic' | 'absence_atypical' | 'subtle_neonatal' | 'non_convulsive_status'
  >('generalized_tonic_clonic');
  const [etiology, setEtiology] = useState<
    'febrile_status' | 'known_epilepsy' | 'cns_infection_meningitis_encephalitis' | 'electrolyte_derangement_hypoglycemia_hyponatremia' | 'acute_trauma_intracranial_hemorrhage' | 'toxic_ingestion' | 'unknown_cryptogenic'
  >('febrile_status');

  const [patientAgeMonths, setPatientAgeMonths] = useState<string>(String(defaultAgeMonths));
  const [weightKg, setWeightKg] = useState<string>(String(defaultWeightKg));
  const [seizureDurationMinutes, setSeizureDurationMinutes] = useState<string>('8.0');
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<string>('95');
  const [ivIoAccessEstablished, setIvIoAccessEstablished] = useState<boolean>(true);
  const [benzodiazepineDosesGiven, setBenzodiazepineDosesGiven] = useState<number>(1);
  const [secondLineAsmGiven, setSecondLineAsmGiven] = useState<boolean>(false);

  // Selected treatment fields
  const [phase2BenzodiazepineGiven, setPhase2BenzodiazepineGiven] = useState<string>('Midazolam IN 0.2 mg/kg');
  const [phase3SecondLineAgent, setPhase3SecondLineAgent] = useState<string>('Levetiracetam (Keppra) 60 mg/kg IV');
  const [clinicalNotes, setClinicalNotes] = useState<string>('Pediatric Status Epilepticus resuscitation initiated per AES/PALS algorithm.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live evaluation
  const calcResult = useMemo(() => {
    const params: PediatricSeizureParams = {
      weightKg: Number(weightKg) || 10,
      ageMonths: Number(patientAgeMonths) || 12,
      seizureDurationMinutes: Number(seizureDurationMinutes) || 0,
      bloodGlucoseMgDl: bloodGlucoseMgDl ? Number(bloodGlucoseMgDl) : undefined,
      ivIoAccessEstablished,
      benzodiazepineDosesGiven,
      secondLineAsmGiven,
    };
    return evaluatePediatricSeizureProtocol(params);
  }, [weightKg, patientAgeMonths, seizureDurationMinutes, bloodGlucoseMgDl, ivIoAccessEstablished, benzodiazepineDosesGiven, secondLineAsmGiven]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        patientId,
        seizureStartDatetime,
        seizureType,
        etiology,
        patientAgeMonths: Number(patientAgeMonths),
        weightKg: Number(weightKg),
        broselowColorZone: calcResult.broselowZone,
        currentAlgorithmPhase: calcResult.phase,
        totalSeizureDurationMinutes: Number(seizureDurationMinutes),
        bloodGlucoseMgDl: bloodGlucoseMgDl ? Number(bloodGlucoseMgDl) : null,
        d10wBolusGivenMl: calcResult.d10wBolusMl || null,
        phase2BenzodiazepineGiven,
        phase2DoseCount: benzodiazepineDosesGiven,
        phase3SecondLineAgent: secondLineAsmGiven ? phase3SecondLineAgent : null,
        phase3SecondLineDoseMg: secondLineAsmGiven ? Math.min(4500, Math.round(Number(weightKg) * 60)) : null,
        phase3InfusionStatus: secondLineAsmGiven ? 'infusing' : 'not_started',
        phase4PicuEscalationStatus: calcResult.phase === 'phase_4_refractory_rsi_picu_gt_40m' ? 'rsi_intubation_underway' : 'not_needed',
        clinicalNotes,
      };

      const res = await createPediatricSeizureEpisode(payload);
      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate Pediatric Status Epilepticus resuscitation');
    } finally {
      setLoading(false);
    }
  };

  const broselowColorStyles: Record<BroselowZone, string> = {
    grey: 'bg-gray-200 text-gray-800 border-gray-400',
    pink: 'bg-pink-100 text-pink-800 border-pink-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    yellow: 'bg-amber-100 text-amber-900 border-amber-300',
    white: 'bg-white text-gray-900 border-gray-400',
    blue: 'bg-blue-100 text-blue-900 border-blue-300',
    orange: 'bg-orange-100 text-orange-900 border-orange-300',
    green: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    not_applicable: 'bg-gray-100 text-gray-700 border-gray-300',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-red-900 flex items-center gap-2">
              <span>⚡</span> Pediatric Status Epilepticus Resuscitation (AES Algorithm)
            </h2>
            <p className="text-xs text-gray-500">
              American Epilepsy Society & PALS Time-Critical Emergency Protocol • Patient: <span className="font-semibold">{patientName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            {error}
          </div>
        )}

        {calcResult.escalationWarning && (
          <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-600 text-red-950 text-xs font-bold animate-pulse">
            🚨 {calcResult.escalationWarning}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Demographics & Time */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-red-50/50 p-3.5 rounded-lg border border-red-100">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Seizure Start Datetime</label>
              <input
                type="datetime-local"
                value={seizureStartDatetime}
                onChange={(e) => setSeizureStartDatetime(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Elapsed Seizure Time (min)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="300"
                value={seizureDurationMinutes}
                onChange={(e) => setSeizureDurationMinutes(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-black text-red-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Child Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="2"
                max="120"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Broselow Color Zone</label>
              <div className={`mt-1 text-xs font-black uppercase px-2 py-1.5 rounded border text-center ${broselowColorStyles[calcResult.broselowZone]}`}>
                {calcResult.broselowZone} zone ({weightKg} kg)
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Seizure Type & Etiology */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Seizure Semiology / Type</label>
              <select
                value={seizureType}
                onChange={(e) => setSeizureType(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5 mt-1 font-semibold text-gray-800"
              >
                <option value="generalized_tonic_clonic">Generalized Tonic-Clonic (Convulsive)</option>
                <option value="focal_with_impaired_awareness">Focal Motor / Impaired Awareness</option>
                <option value="myoclonic">Myoclonic Status</option>
                <option value="subtle_neonatal">Subtle Neonatal Seizure</option>
                <option value="non_convulsive_status">Non-Convulsive Status (cEEG)</option>
                <option value="absence_atypical">Atypical Absence Status</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Suspected Etiology</label>
              <select
                value={etiology}
                onChange={(e) => setEtiology(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5 mt-1 text-gray-800"
              >
                <option value="febrile_status">Febrile Status Epilepticus</option>
                <option value="known_epilepsy">Known Epilepsy (Breakthrough / Missed Dose)</option>
                <option value="cns_infection_meningitis_encephalitis">CNS Infection (Meningitis/Encephalitis)</option>
                <option value="electrolyte_derangement_hypoglycemia_hyponatremia">Electrolyte / Hypoglycemia</option>
                <option value="acute_trauma_intracranial_hemorrhage">Trauma / Intracranial Hemorrhage</option>
                <option value="toxic_ingestion">Toxic Ingestion / Toxidrome</option>
                <option value="unknown_cryptogenic">Cryptogenic / Unknown</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Bedside Blood Glucose (mg/dL)</label>
              <input
                type="number"
                min="10"
                max="800"
                value={bloodGlucoseMgDl}
                onChange={(e) => setBloodGlucoseMgDl(e.target.value)}
                className={`w-full text-xs border rounded p-1.5 mt-1 font-bold ${calcResult.glucoseEmergency ? 'bg-red-100 border-red-500 text-red-900' : ''}`}
                placeholder="Target > 60 mg/dL"
              />
            </div>
          </div>

          {/* Hypoglycemia Emergency Alert */}
          {calcResult.glucoseEmergency && (
            <div className="p-3 bg-red-100 border-2 border-red-500 rounded-lg text-xs text-red-950 font-medium">
              🩸 <strong>CRITICAL HYPOGLYCEMIA DETECTED (&lt; 60 mg/dL):</strong> Administer immediate <strong>10% Dextrose (D10W)</strong> bolus:
              <span className="font-mono font-black text-sm ml-2 bg-white px-2 py-0.5 rounded border border-red-400">
                {calcResult.d10wBolusMl} mL IV/IO (2 mL/kg)
              </span>
            </div>
          )}

          {/* Section 3: Algorithm Phase & Resuscitation Milestones */}
          <div className="border-2 border-indigo-200 rounded-xl p-4 bg-indigo-50/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200 pb-2">
              <div>
                <span className="text-[10px] font-bold text-indigo-700 uppercase">Current AES Algorithm Status:</span>
                <h3 className="text-base font-black text-indigo-950">{calcResult.phaseName}</h3>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 rounded bg-indigo-800 text-white">
                Window: {calcResult.timeWindow}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5">
                <span className="font-bold text-indigo-900 uppercase text-[10px]">Priority Actions:</span>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {calcResult.priorityActions.map((act, i) => (
                    <li key={i}>{act}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 bg-white p-3 rounded-lg border border-indigo-200">
                <span className="font-bold text-gray-700 uppercase text-[10px] block">Bedside Resuscitation Status:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ivIoAccessEstablished}
                    onChange={(e) => setIvIoAccessEstablished(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>IV or IO Access Secured</span>
                </label>
                <div className="flex items-center gap-2">
                  <span>Benzodiazepine Doses Given:</span>
                  <select
                    value={benzodiazepineDosesGiven}
                    onChange={(e) => setBenzodiazepineDosesGiven(Number(e.target.value))}
                    className="border rounded p-1 text-xs font-bold text-indigo-900"
                  >
                    <option value={0}>0 (None yet)</option>
                    <option value={1}>1 Dose Given</option>
                    <option value={2}>2 Doses Given (Max BZD Limit)</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={secondLineAsmGiven}
                    onChange={(e) => setSecondLineAsmGiven(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Second-line ASM Infused (Keppra / Fosphenytoin / Valproate)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Calculated Medication Dosing Options */}
          <div className="border border-gray-200 rounded-lg p-3.5 bg-gray-50/50 space-y-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
              Weight & Broselow-Calibrated Emergency Medication Doses
            </h3>
            <div className="space-y-2.5">
              {calcResult.medicationOptions.map((med, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-black text-gray-900">{med.drugName}</span>
                    <span className="font-mono font-bold text-red-700 text-sm bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      {med.calculatedDoseMgOrMl}
                    </span>
                  </div>
                  <div className="text-gray-500 text-[11px]">
                    <strong>Route:</strong> {med.route} • <strong>Formula:</strong> {med.standardDosePerKg} (Max {med.maxDose})
                  </div>
                  <p className="text-gray-700 text-[11px]">{med.adminInstructions}</p>
                  {med.warnings && (
                    <p className="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 text-[10px] font-medium">
                      ⚠️ {med.warnings}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Clinical Notes & Team Communication</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="w-full text-xs border rounded p-2 mt-1"
              placeholder="e.g. Seizure lasted 8 minutes, aborted 2 minutes after Midazolam IN. Post-ictal snoring respirations monitored."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-red-700 text-white rounded text-xs font-bold hover:bg-red-800 shadow"
            >
              {loading ? 'Initiating...' : 'Initiate Seizure Algorithm Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
