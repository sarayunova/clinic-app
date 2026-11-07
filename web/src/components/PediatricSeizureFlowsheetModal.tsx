import React, { useState } from 'react';
import { logPediatricSeizureFlowsheet } from '../api';

interface Props {
  episodeId: number;
  minutesFromOnset?: number;
  onClose: () => void;
  onSuccess: (res: any) => void;
}

export const PediatricSeizureFlowsheetModal: React.FC<Props> = ({
  episodeId,
  minutesFromOnset = 10,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [mins, setMins] = useState(minutesFromOnset);
  const [phaseActive, setPhaseActive] = useState<'phase_1_emergent_benzo' | 'phase_2_urgent_control' | 'phase_3_refractory_infusion' | 'post_seizure_stabilization'>('phase_2_urgent_control');
  const [seizureActivityPresent, setSeizureActivityPresent] = useState(true);

  const [vitalsHr, setVitalsHr] = useState<number | undefined>(145);
  const [vitalsSbp, setVitalsSbp] = useState<number | undefined>(95);
  const [vitalsDbp, setVitalsDbp] = useState<number | undefined>(55);
  const [vitalsSpo2, setVitalsSpo2] = useState<number | undefined>(97.0);

  const [airwayStatus, setAirwayStatus] = useState<'patent_spontaneous' | 'bag_valve_mask' | 'intubated_ett' | 'laryngeal_mask'>('patent_spontaneous');
  const [infusionRate, setInfusionRate] = useState<number | undefined>(undefined);
  const [eegBackground, setEegBackground] = useState<'not_monitoring' | 'normal' | 'slowing' | 'continuous_spikes' | 'burst_suppression' | 'flat'>('not_monitoring');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await logPediatricSeizureFlowsheet(episodeId, {
        logDatetime,
        minutesFromOnset: mins,
        phaseActive,
        seizureActivityPresent,
        vitalsHr,
        vitalsSbp,
        vitalsDbp,
        vitalsSpo2,
        airwayStatus,
        infusionRateMcgKgMin: infusionRate,
        eegBackground,
        notes: notes || undefined,
      });
      onSuccess(res);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to log seizure flowsheet checkpoint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-red-200">
        <div className="bg-gradient-to-r from-red-700 to-rose-700 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-md font-bold flex items-center gap-2">
              <span>⏱️</span> Log Seizure Resuscitation Checkpoint
            </h2>
            <p className="text-xs text-red-100">
              Bedside Status Epilepticus Vital Signs & Airway Timeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Log Datetime
              </label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Minutes from Onset
              </label>
              <input
                type="number"
                min="0"
                max="1440"
                value={mins}
                onChange={(e) => setMins(parseInt(e.target.value) || 0)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Active Protocol Phase
              </label>
              <select
                value={phaseActive}
                onChange={(e: any) => setPhaseActive(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
              >
                <option value="phase_1_emergent_benzo">Phase 1: Emergent Benzodiazepine (0-10m)</option>
                <option value="phase_2_urgent_control">Phase 2: Urgent Second-Line AED (10-30m)</option>
                <option value="phase_3_refractory_infusion">Phase 3: Refractory Infusion (&gt;30m)</option>
                <option value="post_seizure_stabilization">Post-Seizure Stabilization</option>
              </select>
            </div>
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-red-900">
                <input
                  type="checkbox"
                  checked={seizureActivityPresent}
                  onChange={(e) => setSeizureActivityPresent(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Active Seizure Convulsion Ongoing</span>
              </label>
            </div>
          </div>

          {/* Vitals */}
          <div className="p-3 bg-red-50/50 rounded border border-red-200 space-y-2">
            <span className="text-[11px] font-bold text-red-950 uppercase block">
              Hemodynamics & Oxygenation
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-gray-600 font-semibold">HR (bpm)</label>
                <input
                  type="number"
                  value={vitalsHr ?? ''}
                  onChange={(e) => setVitalsHr(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full text-xs border rounded p-1"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 font-semibold">SBP (mmHg)</label>
                <input
                  type="number"
                  value={vitalsSbp ?? ''}
                  onChange={(e) => setVitalsSbp(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full text-xs border rounded p-1"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 font-semibold">DBP (mmHg)</label>
                <input
                  type="number"
                  value={vitalsDbp ?? ''}
                  onChange={(e) => setVitalsDbp(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full text-xs border rounded p-1"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 font-semibold">SpO2 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={vitalsSpo2 ?? ''}
                  onChange={(e) => setVitalsSpo2(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full text-xs border rounded p-1 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Airway Status
              </label>
              <select
                value={airwayStatus}
                onChange={(e: any) => setAirwayStatus(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
              >
                <option value="patent_spontaneous">Patent / Spontaneous Breathing</option>
                <option value="bag_valve_mask">Bag-Valve-Mask Assist</option>
                <option value="intubated_ett">Intubated (ETT Mechanical Vent)</option>
                <option value="laryngeal_mask">Laryngeal Mask Airway (LMA)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                EEG Background Pattern
              </label>
              <select
                value={eegBackground}
                onChange={(e: any) => setEegBackground(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
              >
                <option value="not_monitoring">Not Monitoring</option>
                <option value="continuous_spikes">Continuous Electrographic Spikes</option>
                <option value="burst_suppression">Burst Suppression (Target RSE)</option>
                <option value="slowing">Diffuse Slowing / Post-Ictal</option>
                <option value="normal">Normal Background</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Bedside Notes / Interventions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
              placeholder="e.g. Levetiracetam infusion finished; convulsions ceased..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
