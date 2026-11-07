import React, { useState, useEffect } from 'react';
import {
  createPediatricStatusEpilepticusEpisode,
  calculatePediatricStatusEpilepticus,
  PediatricStatusEpilepticusRecord,
} from '../api';

interface Props {
  patientId: number;
  admissionId?: number | null;
  ageMonths?: number;
  weightKg?: number;
  onClose: () => void;
  onSuccess: (record: PediatricStatusEpilepticusRecord) => void;
}

export const PediatricStatusEpilepticusModal: React.FC<Props> = ({
  patientId,
  admissionId,
  ageMonths = 24,
  weightKg = 12.0,
  onClose,
  onSuccess,
}) => {
  const [seizureOnsetDatetime, setSeizureOnsetDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [ageM, setAgeM] = useState(ageMonths);
  const [weight, setWeight] = useState(weightKg);
  const [etiology, setEtiology] = useState<'febrile_status' | 'known_epilepsy' | 'cns_infection' | 'toxic_metabolic' | 'trauma_stroke' | 'unknown'>('febrile_status');
  const [seizureSemiology, setSeizureSemiology] = useState<'generalized_tonic_clonic' | 'focal_motor' | 'non_convulsive_status' | 'myoclonic'>('generalized_tonic_clonic');

  const [phase1BenzoGiven, setPhase1BenzoGiven] = useState(true);
  const [phase1BenzoAgent, setPhase1BenzoAgent] = useState<'midazolam_buccal_in' | 'lorazepam_iv' | 'diazepam_rectal'>('lorazepam_iv');
  const [phase1BenzoDoseMg, setPhase1BenzoDoseMg] = useState(1.2);
  const [phase1AdministeredMinute, setPhase1AdministeredMinute] = useState(5);

  const [phase2SecondLineGiven, setPhase2SecondLineGiven] = useState(false);
  const [phase2Agent, setPhase2Agent] = useState<'levetiracetam' | 'fosphenytoin' | 'valproate_sodium'>('levetiracetam');
  const [phase2DoseMg, setPhase2DoseMg] = useState(720);
  const [phase2AdministeredMinute, setPhase2AdministeredMinute] = useState(15);

  const [phase3RefractoryStatus, setPhase3RefractoryStatus] = useState(false);
  const [phase3InfusionAgent, setPhase3InfusionAgent] = useState<'midazolam_infusion' | 'propofol_infusion' | 'ketamine_infusion'>('midazolam_infusion');
  const [phase3InfusionRate, setPhase3InfusionRate] = useState(1.2);

  const [seizureCessationMinute, setSeizureCessationMinute] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<'active_seizure' | 'refractory_status' | 'seizure_abated_post_ictal' | 'picu_neuro_monitoring' | 'resolved'>('active_seizure');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    calculatePediatricStatusEpilepticus({
      ageMonths: ageM,
      weightKg: weight,
      minutesFromOnset: phase1AdministeredMinute,
      etiology,
      seizureSemiology,
      phase1BenzoGiven,
      phase2Given: phase2SecondLineGiven,
      seizureOngoing: status === 'active_seizure' || status === 'refractory_status',
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult?.recommendedPhase1Benzo?.doseMg && !phase1BenzoDoseMg) {
          setPhase1BenzoDoseMg(res.evalResult.recommendedPhase1Benzo.doseMg);
        }
      })
      .catch((err) => console.error(err));
  }, [ageM, weight, phase1AdministeredMinute, etiology, seizureSemiology, phase1BenzoGiven, phase2SecondLineGiven, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createPediatricStatusEpilepticusEpisode({
        patientId,
        admissionId,
        seizureOnsetDatetime,
        ageMonths: ageM,
        weightKg: weight,
        etiology,
        seizureSemiology,
        phase1BenzoGiven,
        phase1BenzoAgent: phase1BenzoGiven ? phase1BenzoAgent : undefined,
        phase1BenzoDoseMg: phase1BenzoGiven ? phase1BenzoDoseMg : undefined,
        phase1AdministeredMinute: phase1BenzoGiven ? phase1AdministeredMinute : undefined,
        phase2SecondLineGiven,
        phase2Agent: phase2SecondLineGiven ? phase2Agent : undefined,
        phase2DoseMg: phase2SecondLineGiven ? phase2DoseMg : undefined,
        phase2AdministeredMinute: phase2SecondLineGiven ? phase2AdministeredMinute : undefined,
        phase3RefractoryStatus,
        phase3InfusionAgent: phase3RefractoryStatus ? phase3InfusionAgent : undefined,
        phase3InfusionRateMcgKgMin: phase3RefractoryStatus ? phase3InfusionRate : undefined,
        seizureCessationMinute,
        status,
        clinicalNotes: clinicalNotes || undefined,
      });
      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create status epilepticus episode');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-red-200 animate-fadeIn">
        <div className="bg-gradient-to-r from-red-700 to-rose-700 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>⚡</span> Pediatric Status Epilepticus Resuscitation Protocol
            </h2>
            <p className="text-xs text-red-100">
              AES 2016 / PALS 2025 / ESETT Stepwise Emergency Anticonvulsant Algorithm
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {preview && (
            <div
              className={`p-4 rounded-lg border flex flex-col gap-2 ${
                preview.urgencyLevel === 'critical_emergency'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="font-bold text-sm tracking-wide uppercase flex items-center gap-1.5">
                  <span>🚨</span> {preview.phaseDescription}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/70 shadow-sm">
                  Urgency: {preview.urgencyLevel.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-semibold text-red-950">
                Airway Directive: {preview.airwayActionPlan}
              </p>
              {preview.clinicalChecklist?.length > 0 && (
                <ul className="text-xs list-disc pl-4 space-y-0.5">
                  {preview.clinicalChecklist.slice(0, 3).map((c: string, idx: number) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Child Demographics & Onset */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Seizure Onset
              </label>
              <input
                type="datetime-local"
                value={seizureOnsetDatetime}
                onChange={(e) => setSeizureOnsetDatetime(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Age (months)
              </label>
              <input
                type="number"
                min="0"
                max="216"
                value={ageM}
                onChange={(e) => setAgeM(parseInt(e.target.value) || 0)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Weight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="120.0"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 10)}
                className="w-full text-sm border border-red-300 rounded px-2.5 py-1.5 font-bold text-red-900 bg-red-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Etiology
              </label>
              <select
                value={etiology}
                onChange={(e: any) => setEtiology(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="febrile_status">Febrile Status Epilepticus</option>
                <option value="known_epilepsy">Known Epilepsy (Breakthrough)</option>
                <option value="cns_infection">CNS Infection (Meningitis/Encephalitis)</option>
                <option value="toxic_metabolic">Toxic / Metabolic / Hypoglycemia</option>
                <option value="trauma_stroke">Trauma / Stroke / Anoxia</option>
                <option value="unknown">Unknown / Acute Cryptogenic</option>
              </select>
            </div>
          </div>

          {/* Phase 1: Emergent Benzodiazepine */}
          <div className="p-4 bg-red-50/60 rounded-lg border border-red-200 space-y-3">
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-red-950 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={phase1BenzoGiven}
                  onChange={(e) => setPhase1BenzoGiven(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Phase 1: Emergent Benzodiazepine (0-10 min)</span>
              </label>
              <span className="text-xs text-gray-500 font-medium">Max 2 doses</span>
            </div>

            {phase1BenzoGiven && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Agent & Route</label>
                  <select
                    value={phase1BenzoAgent}
                    onChange={(e: any) => setPhase1BenzoAgent(e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1.5 bg-white"
                  >
                    <option value="lorazepam_iv">Lorazepam IV (0.1 mg/kg)</option>
                    <option value="midazolam_buccal_in">Midazolam Intranasal/Buccal (0.2 mg/kg)</option>
                    <option value="diazepam_rectal">Diazepam Rectal (0.3 mg/kg)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dose Administered (mg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={phase1BenzoDoseMg}
                    onChange={(e) => setPhase1BenzoDoseMg(parseFloat(e.target.value) || 0)}
                    className="w-full text-sm border rounded px-2 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Minute Administered</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={phase1AdministeredMinute}
                    onChange={(e) => setPhase1AdministeredMinute(parseInt(e.target.value) || 0)}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Phase 2: Urgent Control Second-Line AED */}
          <div className="p-4 bg-amber-50/60 rounded-lg border border-amber-200 space-y-3">
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-amber-950 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={phase2SecondLineGiven}
                  onChange={(e) => setPhase2SecondLineGiven(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Phase 2: Urgent Non-Sedating Second-Line AED (10-30 min)</span>
              </label>
              <span className="text-xs text-gray-500 font-medium">ESETT Protocol</span>
            </div>

            {phase2SecondLineGiven && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Second-Line Agent</label>
                  <select
                    value={phase2Agent}
                    onChange={(e: any) => setPhase2Agent(e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1.5 bg-white"
                  >
                    <option value="levetiracetam">Levetiracetam (Keppra) 60 mg/kg IV</option>
                    <option value="fosphenytoin">Fosphenytoin 20 mg PE/kg IV</option>
                    <option value="valproate_sodium">Valproate Sodium 40 mg/kg IV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dose Given (mg)</label>
                  <input
                    type="number"
                    step="10"
                    value={phase2DoseMg}
                    onChange={(e) => setPhase2DoseMg(parseFloat(e.target.value) || 0)}
                    className="w-full text-sm border rounded px-2 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Minute Administered</label>
                  <input
                    type="number"
                    min="0"
                    max="360"
                    value={phase2AdministeredMinute}
                    onChange={(e) => setPhase2AdministeredMinute(parseInt(e.target.value) || 0)}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Phase 3: Refractory Status Epilepticus */}
          <div className="p-4 bg-purple-50/60 rounded-lg border border-purple-200 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-purple-950 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={phase3RefractoryStatus}
                onChange={(e) => setPhase3RefractoryStatus(e.target.checked)}
                className="rounded text-purple-600"
              />
              <span>Phase 3: Refractory Status Infusion & Intubation (&gt; 30 min)</span>
            </label>

            {phase3RefractoryStatus && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Continuous Infusion Agent</label>
                  <select
                    value={phase3InfusionAgent}
                    onChange={(e: any) => setPhase3InfusionAgent(e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1.5 bg-white"
                  >
                    <option value="midazolam_infusion">Midazolam (0.1 - 2.0 mg/kg/hr)</option>
                    <option value="ketamine_infusion">Ketamine (1.0 - 5.0 mg/kg/hr)</option>
                    <option value="propofol_infusion">Propofol (Short-term PICU only)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Infusion Rate (mcg/kg/min or mg/hr)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={phase3InfusionRate}
                    onChange={(e) => setPhase3InfusionRate(parseFloat(e.target.value) || 0)}
                    className="w-full text-sm border rounded px-2 py-1.5 font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Seizure Cessation (minute from onset)
              </label>
              <input
                type="number"
                min="0"
                max="1440"
                value={seizureCessationMinute ?? ''}
                onChange={(e) => setSeizureCessationMinute(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5"
                placeholder="Leave blank if ongoing"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Current Clinical Status
              </label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="active_seizure">Active Seizure (Ongoing)</option>
                <option value="refractory_status">Refractory Status (Phase 3)</option>
                <option value="seizure_abated_post_ictal">Seizure Abated / Post-Ictal</option>
                <option value="picu_neuro_monitoring">PICU Continuous EEG Monitoring</option>
                <option value="resolved">Resolved / Transferred to Ward</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Clinical Notes / Airway Record
              </label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5"
                placeholder="Airway details, pupil exam..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {submitting ? 'Initiating Resuscitation...' : 'Initiate Seizure Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
