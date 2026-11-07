import React, { useState, useMemo } from 'react';
import { createNeonatalHieAssessment, type NeonatalHieRecord } from '../api';
import { evaluateNeonatalHie, type NeonatalHieInput } from '../neonatalHieEngine';

interface HieAssessmentModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assessment: NeonatalHieRecord) => void;
  defaultBirthDatetime?: string;
  defaultGestationalAge?: number;
  defaultBirthWeightKg?: number;
}

export const HieAssessmentModal: React.FC<HieAssessmentModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultBirthDatetime = new Date().toISOString().slice(0, 16),
  defaultGestationalAge = 38.5,
  defaultBirthWeightKg = 3.1,
}) => {
  const [birthDatetime, setBirthDatetime] = useState<string>(defaultBirthDatetime);
  const [assessmentDatetime, setAssessmentDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(defaultGestationalAge);
  const [birthWeightKg, setBirthWeightKg] = useState<number>(defaultBirthWeightKg);
  const [apgar10m, setApgar10m] = useState<string>('4');
  const [resuscitationDurationMinutes, setResuscitationDurationMinutes] = useState<string>('12');
  const [cordOrArterialPh, setCordOrArterialPh] = useState<string>('6.95');
  const [baseDeficitMmolL, setBaseDeficitMmolL] = useState<string>('18.0');

  const [levelOfConsciousness, setLevelOfConsciousness] = useState<'hyperalert' | 'lethargic_obtunded' | 'stuporous_comatose'>('lethargic_obtunded');
  const [muscleTone, setMuscleTone] = useState<'normal' | 'hypotonic' | 'flaccid'>('hypotonic');
  const [primitiveReflexesSuckMoro, setPrimitiveReflexesSuckMoro] = useState<'normal_exaggerated' | 'weak_incomplete' | 'absent'>('weak_incomplete');
  const [autonomicFunction, setAutonomicFunction] = useState<'normal' | 'sympathetic_parasympathetic_skew' | 'depressed_bradycardia'>('sympathetic_parasympathetic_skew');
  const [clinicalSeizuresPresent, setClinicalSeizuresPresent] = useState<boolean>(true);
  const [coolingDeviceType, setCoolingDeviceType] = useState<'servo_controlled_cooling_blanket' | 'selective_head_cooling_cap' | 'phase_change_material_mattress'>('servo_controlled_cooling_blanket');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcResult = useMemo(() => {
    try {
      const birthTime = new Date(birthDatetime).getTime();
      const assessTime = new Date(assessmentDatetime).getTime();
      const hoursFromBirth = Math.max(0, Number(((assessTime - birthTime) / (3600 * 1000)).toFixed(1)));

      const input: NeonatalHieInput = {
        gestationalAgeWeeks: Number(gestationalAgeWeeks) || 38,
        birthWeightKg: Number(birthWeightKg) || 3.0,
        hoursFromBirth,
        apgar10m: apgar10m ? Number(apgar10m) : undefined,
        resuscitationDurationMinutes: resuscitationDurationMinutes ? Number(resuscitationDurationMinutes) : undefined,
        cordOrArterialPh: cordOrArterialPh ? Number(cordOrArterialPh) : undefined,
        baseDeficitMmolL: baseDeficitMmolL ? Number(baseDeficitMmolL) : undefined,
        levelOfConsciousness,
        muscleTone,
        primitiveReflexesSuckMoro,
        autonomicFunction,
        clinicalSeizuresPresent,
      };
      return evaluateNeonatalHie(input);
    } catch {
      return null;
    }
  }, [
    birthDatetime,
    assessmentDatetime,
    gestationalAgeWeeks,
    birthWeightKg,
    apgar10m,
    resuscitationDurationMinutes,
    cordOrArterialPh,
    baseDeficitMmolL,
    levelOfConsciousness,
    muscleTone,
    primitiveReflexesSuckMoro,
    autonomicFunction,
    clinicalSeizuresPresent,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createNeonatalHieAssessment({
        patientId,
        birthDatetime,
        assessmentDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        birthWeightKg: Number(birthWeightKg),
        apgar10m: apgar10m ? Number(apgar10m) : undefined,
        resuscitationDurationMinutes: resuscitationDurationMinutes ? Number(resuscitationDurationMinutes) : undefined,
        cordOrArterialPh: cordOrArterialPh ? Number(cordOrArterialPh) : undefined,
        baseDeficitMmolL: baseDeficitMmolL ? Number(baseDeficitMmolL) : undefined,
        levelOfConsciousness,
        muscleTone,
        primitiveReflexesSuckMoro,
        autonomicFunction,
        clinicalSeizuresPresent,
        coolingDeviceType,
        targetCoreTempCelsius: 33.5,
        protocolStatus: calcResult?.isCoolingEligible ? 'cooling_active' : 'eligible_pending',
        clinicalNotes: clinicalNotes.trim() || undefined,
      });

      onSuccess(res.assessment);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record HIE assessment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-gradient-to-r from-cyan-700 to-blue-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>❄️</span> Neonatal HIE Sarnat Staging & Cooling Eligibility
            </h2>
            <p className="text-xs text-cyan-100 mt-0.5">
              Patient: <strong className="text-white">{patientName}</strong> | TOBY & CoolCap 6-Hour Neuroprotection Protocol
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-bold leading-none p-1">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Timing & Perinatal Vitals */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Birth Datetime</label>
              <input
                type="datetime-local"
                value={birthDatetime}
                onChange={e => setBirthDatetime(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Assessment Time</label>
              <input
                type="datetime-local"
                value={assessmentDatetime}
                onChange={e => setAssessmentDatetime(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Gestation (Weeks)</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="44"
                value={gestationalAgeWeeks}
                onChange={e => setGestationalAgeWeeks(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Birth Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="6"
                value={birthWeightKg}
                onChange={e => setBirthWeightKg(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded"
                required
              />
            </div>
          </div>

          {/* Criterion A: Physiological Acidemia */}
          <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-200 text-xs space-y-2">
            <span className="font-bold text-blue-950 uppercase tracking-wider block">
              Criterion A: Perinatal Acidemia & Resuscitation
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Cord / 1h Blood Gas pH</label>
                <input
                  type="number"
                  step="0.01"
                  min="6.5"
                  max="7.6"
                  value={cordOrArterialPh}
                  onChange={e => setCordOrArterialPh(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded font-bold"
                />
                <span className="text-[10px] text-slate-500">Criteria: ≤ 7.00</span>
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Base Deficit (mmol/L)</label>
                <input
                  type="number"
                  step="0.5"
                  value={baseDeficitMmolL}
                  onChange={e => setBaseDeficitMmolL(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded font-bold"
                />
                <span className="text-[10px] text-slate-500">Criteria: ≥ 16.0</span>
              </div>
              <div>
                <label className="block text-slate-600 mb-1">10-Minute Apgar</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={apgar10m}
                  onChange={e => setApgar10m(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded"
                />
                <span className="text-[10px] text-slate-500">Criteria: ≤ 5</span>
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Resuscitation (mins)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={resuscitationDurationMinutes}
                  onChange={e => setResuscitationDurationMinutes(e.target.value)}
                  className="w-full px-2 py-1 border border-blue-300 rounded"
                />
                <span className="text-[10px] text-slate-500">Criteria: ≥ 10 min PPV</span>
              </div>
            </div>
          </div>

          {/* Criterion B: Sarnat Encephalopathy Grading */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2.5">
            <span className="font-bold text-slate-800 uppercase tracking-wider block">
              Criterion B: Neurological Examination & Sarnat Staging
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Consciousness</label>
                <select
                  value={levelOfConsciousness}
                  onChange={e => setLevelOfConsciousness(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                >
                  <option value="hyperalert">Hyperalert / Irritable (Stage I)</option>
                  <option value="lethargic_obtunded">Lethargic / Obtunded (Stage II)</option>
                  <option value="stuporous_comatose">Stuporous / Comatose (Stage III)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Muscle Tone</label>
                <select
                  value={muscleTone}
                  onChange={e => setMuscleTone(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                >
                  <option value="normal">Normal or mildly hypertonic (Stage I)</option>
                  <option value="hypotonic">Hypotonic (Stage II)</option>
                  <option value="flaccid">Flaccid (Stage III)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Primitive Reflexes (Suck & Moro)</label>
                <select
                  value={primitiveReflexesSuckMoro}
                  onChange={e => setPrimitiveReflexesSuckMoro(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                >
                  <option value="normal_exaggerated">Normal or Exaggerated Moro (Stage I)</option>
                  <option value="weak_incomplete">Weak / Incomplete Moro & Suck (Stage II)</option>
                  <option value="absent">Completely Absent (Stage III)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Autonomic Function</label>
                <select
                  value={autonomicFunction}
                  onChange={e => setAutonomicFunction(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                >
                  <option value="normal">Normal (Stage I)</option>
                  <option value="sympathetic_parasympathetic_skew">Miosis / Parasympathetic skew (Stage II)</option>
                  <option value="depressed_bradycardia">Depressed / Bradycardia / Asymmetric pupils (Stage III)</option>
                </select>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={clinicalSeizuresPresent}
                  onChange={e => setClinicalSeizuresPresent(e.target.checked)}
                  className="rounded text-blue-600 h-4 w-4"
                />
                <span>Clinical or Electrographic Neonatal Seizures Observed</span>
              </label>
            </div>
          </div>

          {/* Section: Live Cooling Eligibility Badge */}
          {calcResult && (
            <div className="p-4 bg-gradient-to-r from-slate-900 to-cyan-950 text-white rounded-xl shadow-inner space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-cyan-800/60 pb-2">
                <div>
                  <span className="font-extrabold text-sm text-cyan-300 block">{calcResult.sarnatStageLabel}</span>
                  <span className="text-[11px] text-slate-400">
                    Window: {calcResult.timeWindowStatus.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-black uppercase ${
                    calcResult.isCoolingEligible
                      ? 'bg-cyan-500 text-slate-950 animate-pulse'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {calcResult.isCoolingEligible ? '❄️ COOLING PROTOCOL INDICATED' : 'NOT ELIGIBLE FOR COOLING'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white/10 p-2 rounded">
                  <span className="text-slate-400 block text-[10px]">Target Core Temp</span>
                  <strong className="text-sm text-white">33.5°C ± 0.5°C</strong>
                </div>
                <div className="bg-white/10 p-2 rounded">
                  <span className="text-slate-400 block text-[10px]">Cooling Duration</span>
                  <strong className="text-sm text-white">72 Hours</strong>
                </div>
                <div className="bg-white/10 p-2 rounded">
                  <span className="text-slate-400 block text-[10px]">Rewarming Rate</span>
                  <strong className="text-sm text-cyan-300">+0.5°C / hour</strong>
                </div>
                <div className="bg-white/10 p-2 rounded">
                  <span className="text-slate-400 block text-[10px]">Rewarming Time</span>
                  <strong className="text-sm text-white">6 Hours (to 36.5°C)</strong>
                </div>
              </div>

              {calcResult.eligibilityReasons.length > 0 && (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-cyan-300 font-bold uppercase block">Eligibility Met By:</span>
                  <ul className="list-disc list-inside text-cyan-100 text-[11px]">
                    {calcResult.eligibilityReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {calcResult.contraindicationsOrExclusions.length > 0 && (
                <div className="p-2 bg-rose-950/80 rounded border border-rose-500/50 text-rose-200">
                  <strong>Exclusion Notice:</strong> {calcResult.contraindicationsOrExclusions.join('; ')}
                </div>
              )}
            </div>
          )}

          {/* Device Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Cooling Modality Device</label>
              <select
                value={coolingDeviceType}
                onChange={e => setCoolingDeviceType(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              >
                <option value="servo_controlled_cooling_blanket">Servo-Controlled Whole-Body Cooling Blanket</option>
                <option value="selective_head_cooling_cap">Selective Head Cooling Cap with Mild Core Cooling</option>
                <option value="phase_change_material_mattress">Phase Change Material (PCM) Cooling Mattress</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Clinical Notes</label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={e => setClinicalNotes(e.target.value)}
                placeholder="e.g. Cord prolapse; emergency LSCS; rectally probed at 4 cm depth."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Register HIE Assessment & Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
