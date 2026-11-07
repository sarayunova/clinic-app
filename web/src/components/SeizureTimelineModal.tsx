import React, { useState } from 'react';
import { logPediatricSeizureTimeline, type PediatricSeizureTimelineRecord } from '../api';

interface SeizureTimelineModalProps {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: PediatricSeizureTimelineRecord) => void;
  defaultElapsedMinutes?: number;
}

export const SeizureTimelineModal: React.FC<SeizureTimelineModalProps> = ({
  episodeId,
  isOpen,
  onClose,
  onSuccess,
  defaultElapsedMinutes = 5.0,
}) => {
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString().slice(0, 16));
  const [elapsedMinutes, setElapsedMinutes] = useState<string>(String(defaultElapsedMinutes));
  const [actionType, setActionType] = useState<
    'airway_oxygen_positioning' | 'blood_glucose_checked' | 'd10w_bolus_administered' | 'iv_io_access_secured' | 'first_line_benzodiazepine' | 'second_line_asm_administered' | 'rsi_intubation_preoxygenation' | 'anesthetic_infusion_started' | 'seizure_aborted' | 'eeg_monitoring_initiated' | 'vital_signs_recorded'
  >('first_line_benzodiazepine');

  const [medicationName, setMedicationName] = useState<string>('Midazolam');
  const [doseAdministered, setDoseAdministered] = useState<string>('2.5 mg');
  const [route, setRoute] = useState<'iv' | 'io' | 'intranasal' | 'buccal' | 'rectal' | 'im' | 'infusion' | 'inhalation' | 'oral' | 'subcutaneous'>('intranasal');

  const [heartRateBpm, setHeartRateBpm] = useState<string>('138');
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState<string>('102');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState<string>('64');
  const [spo2Percent, setSpo2Percent] = useState<string>('97');
  const [activeMotorActivity, setActiveMotorActivity] = useState<boolean>(true);
  const [clinicalObservations, setClinicalObservations] = useState<string>('Delivered via MAD atomizer into bilateral nares. High-flow O2 continuing.');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleActionChange = (action: any) => {
    setActionType(action);
    if (action === 'airway_oxygen_positioning') {
      setMedicationName('');
      setDoseAdministered('');
      setRoute('inhalation');
      setClinicalObservations('Airway opened, secretions suctioned, 100% O2 via NRB mask at 15 LPM.');
    } else if (action === 'blood_glucose_checked') {
      setMedicationName('Point-of-care Blood Glucose');
      setDoseAdministered('');
      setClinicalObservations('Fingerstick glucose check performed.');
    } else if (action === 'd10w_bolus_administered') {
      setMedicationName('10% Dextrose (D10W)');
      setDoseAdministered('25 mL (2 mL/kg)');
      setRoute('iv');
      setClinicalObservations('Administered slow IV bolus for severe hypoglycemia.');
    } else if (action === 'first_line_benzodiazepine') {
      setMedicationName('Midazolam (Intranasal)');
      setDoseAdministered('2.5 mg');
      setRoute('intranasal');
    } else if (action === 'second_line_asm_administered') {
      setMedicationName('Levetiracetam (Keppra)');
      setDoseAdministered('60 mg/kg IV');
      setRoute('iv');
      setClinicalObservations('ESETT protocol: Keppra 60 mg/kg diluted in 100 mL NS over 10 minutes.');
    } else if (action === 'seizure_aborted') {
      setActiveMotorActivity(false);
      setClinicalObservations('Motor convulsions ceased. Bilateral flaccid extremities, post-ictal breathing.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        timestamp,
        elapsedMinutes: Number(elapsedMinutes),
        actionType,
        medicationName: medicationName || null,
        doseAdministered: doseAdministered || null,
        route: route || null,
        heartRateBpm: heartRateBpm ? Number(heartRateBpm) : null,
        bloodPressureSystolic: bloodPressureSystolic ? Number(bloodPressureSystolic) : null,
        bloodPressureDiastolic: bloodPressureDiastolic ? Number(bloodPressureDiastolic) : null,
        spo2Percent: spo2Percent ? Number(spo2Percent) : null,
        activeMotorActivity,
        clinicalObservations: clinicalObservations || null,
      };

      const res = await logPediatricSeizureTimeline(episodeId, payload);
      onSuccess(res.log);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to log seizure timeline event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h3 className="font-bold text-red-950 text-base flex items-center gap-2">
            <span>⏱️</span> Log Bedside Seizure Resuscitation Event
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 bg-red-50/50 p-2.5 rounded">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Elapsed Minutes</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={elapsedMinutes}
                onChange={(e) => setElapsedMinutes(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-black text-red-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Timestamp</label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Resuscitation Action</label>
            <select
              value={actionType}
              onChange={(e) => handleActionChange(e.target.value)}
              className="w-full text-xs border rounded p-2 mt-1 font-bold text-indigo-950"
            >
              <option value="airway_oxygen_positioning">1. Airway Positioning & High-Flow Oxygen</option>
              <option value="blood_glucose_checked">2. Point-of-Care Blood Glucose Check</option>
              <option value="d10w_bolus_administered">3. D10W 2 mL/kg Bolus (Hypoglycemia)</option>
              <option value="iv_io_access_secured">4. IV or IO Access Secured</option>
              <option value="first_line_benzodiazepine">5. First-line Benzodiazepine Administered</option>
              <option value="second_line_asm_administered">6. Second-line ASM (Keppra/Fosphenytoin/Valproate)</option>
              <option value="rsi_intubation_preoxygenation">7. RSI Pre-oxygenation & Endotracheal Intubation</option>
              <option value="anesthetic_infusion_started">8. Continuous Anesthetic Infusion (Midaz/Propofol)</option>
              <option value="seizure_aborted">9. Seizure Cessation / Aborted</option>
              <option value="eeg_monitoring_initiated">10. Continuous EEG Monitoring Initiated</option>
              <option value="vital_signs_recorded">11. Vital Signs Logged</option>
            </select>
          </div>

          {/* Medication fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Medication Name</label>
              <input
                type="text"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1"
                placeholder="e.g. Midazolam"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Dose</label>
              <input
                type="text"
                value={doseAdministered}
                onChange={(e) => setDoseAdministered(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold text-red-900"
                placeholder="e.g. 2.5 mg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Route</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5 mt-1 font-medium"
              >
                <option value="intranasal">Intranasal (IN MAD)</option>
                <option value="iv">Intravenous (IV)</option>
                <option value="io">Intraosseous (IO)</option>
                <option value="buccal">Buccal</option>
                <option value="rectal">Rectal (PR)</option>
                <option value="im">Intramuscular (IM)</option>
                <option value="infusion">IV Infusion</option>
                <option value="inhalation">Inhalation (O2)</option>
              </select>
            </div>
          </div>

          {/* Vitals */}
          <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Heart Rate (bpm)</label>
              <input
                type="number"
                min="40"
                max="250"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">BP (Systolic / Diastolic)</label>
              <div className="flex gap-1 items-center mt-1">
                <input
                  type="number"
                  placeholder="Sys"
                  value={bloodPressureSystolic}
                  onChange={(e) => setBloodPressureSystolic(e.target.value)}
                  className="w-1/2 text-xs border rounded p-1.5"
                />
                <input
                  type="number"
                  placeholder="Dia"
                  value={bloodPressureDiastolic}
                  onChange={(e) => setBloodPressureDiastolic(e.target.value)}
                  className="w-1/2 text-xs border rounded p-1.5"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">SpO2 (%)</label>
              <input
                type="number"
                min="50"
                max="100"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold text-blue-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-red-50/60 rounded border border-red-200">
            <input
              type="checkbox"
              id="activeMotor"
              checked={activeMotorActivity}
              onChange={(e) => setActiveMotorActivity(e.target.checked)}
              className="rounded text-red-600"
            />
            <label htmlFor="activeMotor" className="text-xs font-bold text-red-950 cursor-pointer">
              Active Convulsive Motor Activity Still Ongoing? (Uncheck if seizure stopped)
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Clinical Observations</label>
            <input
              type="text"
              value={clinicalObservations}
              onChange={(e) => setClinicalObservations(e.target.value)}
              className="w-full text-xs border rounded p-1.5 mt-1"
              placeholder="e.g. Eye deviation to left, clonic jerking of right arm."
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
              {loading ? 'Logging...' : 'Save Resuscitation Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
