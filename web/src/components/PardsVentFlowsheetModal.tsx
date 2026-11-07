import React, { useState } from 'react';
import { logPediatricPardsFlowsheet } from '../api';
import {
  calculateOxygenationIndex,
  calculateOxygenSaturationIndex,
  calculateDrivingPressure,
} from '../pediatricPardsEngine';

interface Props {
  episodeId: number;
  weightKg: number;
  currentPeep: number;
  currentMap: number;
  currentFio2: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PardsVentFlowsheetModal: React.FC<Props> = ({
  episodeId,
  weightKg,
  currentPeep,
  currentMap,
  currentFio2,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursOnProtocol, setHoursOnProtocol] = useState(2.0);
  const [pipCmh2o, setPipCmh2o] = useState<number | undefined>(26.0);
  const [plateauPressureCmh2o, setPlateauPressureCmh2o] = useState<number | undefined>(22.0);
  const [peepCmh2o, setPeepCmh2o] = useState(currentPeep || 8.0);
  const [mapCmh2o, setMapCmh2o] = useState(currentMap || 13.0);
  const [fio2Percent, setFio2Percent] = useState(currentFio2 || 50.0);
  const [tidalVolumeSetMl, setTidalVolumeSetMl] = useState<number | undefined>(70);
  const [respiratoryRateSet, setRespiratoryRateSet] = useState<number | undefined>(24);
  const [respiratoryRateTotal, setRespiratoryRateTotal] = useState<number | undefined>(26);
  const [abgPh, setAbgPh] = useState<number | undefined>(7.28);
  const [abgPao2Mmhg, setAbgPao2Mmhg] = useState<number | undefined>(80.0);
  const [abgPco2Mmhg, setAbgPco2Mmhg] = useState<number | undefined>(52.0);
  const [abgHco3MeqL, setAbgHco3MeqL] = useState<number | undefined>(24.0);
  const [spo2Percent, setSpo2Percent] = useState<number | undefined>(93.0);
  const [pronePositioningHours, setPronePositioningHours] = useState(2.0);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drivingPressure = calculateDrivingPressure(plateauPressureCmh2o, peepCmh2o);
  const oi = calculateOxygenationIndex(mapCmh2o, fio2Percent, abgPao2Mmhg);
  const osi = calculateOxygenSaturationIndex(mapCmh2o, fio2Percent, spo2Percent ?? 93);
  const measuredVtPerKg = tidalVolumeSetMl && weightKg > 0 ? Math.round((tidalVolumeSetMl / weightKg) * 10) / 10 : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await logPediatricPardsFlowsheet(episodeId, {
        logDatetime,
        hoursOnProtocol,
        pipCmh2o,
        plateauPressureCmh2o,
        peepCmh2o,
        mapCmh2o,
        fio2Percent,
        tidalVolumeSetMl,
        tidalVolumeMeasuredMlKg: measuredVtPerKg ?? undefined,
        respiratoryRateSet,
        respiratoryRateTotal,
        abgPh,
        abgPao2Mmhg,
        abgPco2Mmhg,
        abgHco3MeqL,
        spo2Percent,
        pronePositioningHours,
        notes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record ventilation flowsheet log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 my-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bedside PARDS Ventilation Flowsheet</h2>
            <p className="text-xs text-gray-500">Record mechanics, ABG, driving pressure & prone cycle</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Log Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hours on Protocol</label>
              <input
                type="number"
                step="0.5"
                value={hoursOnProtocol}
                onChange={(e) => setHoursOnProtocol(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border rounded px-2 py-1.5"
                required
              />
            </div>
          </div>

          {/* Ventilator Pressures */}
          <div className="bg-indigo-50/70 p-3 rounded border border-indigo-200 space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-indigo-950 mb-0.5">PIP (cmH2O)</label>
                <input
                  type="number"
                  step="0.5"
                  value={pipCmh2o || ''}
                  onChange={(e) => setPipCmh2o(parseFloat(e.target.value) || undefined)}
                  className="w-full text-xs border rounded px-1.5 py-1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-indigo-950 mb-0.5">Pplat</label>
                <input
                  type="number"
                  step="0.5"
                  value={plateauPressureCmh2o || ''}
                  onChange={(e) => setPlateauPressureCmh2o(parseFloat(e.target.value) || undefined)}
                  className="w-full text-xs border rounded px-1.5 py-1 font-bold text-indigo-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-indigo-950 mb-0.5">PEEP</label>
                <input
                  type="number"
                  step="0.5"
                  value={peepCmh2o}
                  onChange={(e) => setPeepCmh2o(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs border rounded px-1.5 py-1 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-indigo-950 mb-0.5">MAP</label>
                <input
                  type="number"
                  step="0.5"
                  value={mapCmh2o}
                  onChange={(e) => setMapCmh2o(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs border rounded px-1.5 py-1 font-bold"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-bold text-indigo-950 pt-1 border-t border-indigo-200">
              <span>
                Driving Pressure (&Delta;P = Pplat - PEEP):{' '}
                <strong className={drivingPressure !== null && drivingPressure >= 15 ? 'text-red-700' : 'text-emerald-700'}>
                  {drivingPressure !== null ? `${drivingPressure} cmH2O` : '-'}
                </strong>
              </span>
              <span>
                {drivingPressure !== null && drivingPressure >= 15 ? 'HIGH DRIVING PRESSURE' : 'Safe (<15)'}
              </span>
            </div>
          </div>

          {/* Tidal Volume & FiO2 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Set Vt (mL)</label>
              <input
                type="number"
                step="1"
                value={tidalVolumeSetMl || ''}
                onChange={(e) => setTidalVolumeSetMl(parseFloat(e.target.value) || undefined)}
                className="w-full text-xs border rounded px-2 py-1.5 font-bold"
              />
              {measuredVtPerKg && (
                <span className="text-[10px] text-gray-600 block mt-0.5">
                  ({measuredVtPerKg} mL/kg for {weightKg} kg)
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">FiO2 (%)</label>
              <input
                type="number"
                step="1"
                value={fio2Percent}
                onChange={(e) => setFio2Percent(parseFloat(e.target.value) || 21)}
                className="w-full text-xs border rounded px-2 py-1.5 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">SpO2 (%)</label>
              <input
                type="number"
                step="1"
                value={spo2Percent || ''}
                onChange={(e) => setSpo2Percent(parseFloat(e.target.value) || undefined)}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
          </div>

          {/* Arterial Blood Gas */}
          <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
            <span className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
              Arterial Blood Gas (ABG)
            </span>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-gray-500">pH</label>
                <input
                  type="number"
                  step="0.01"
                  value={abgPh || ''}
                  onChange={(e) => setAbgPh(parseFloat(e.target.value) || undefined)}
                  className="w-full border rounded px-1.5 py-0.5 text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500">PaO2 (mmHg)</label>
                <input
                  type="number"
                  step="1"
                  value={abgPao2Mmhg || ''}
                  onChange={(e) => setAbgPao2Mmhg(parseFloat(e.target.value) || undefined)}
                  className="w-full border rounded px-1.5 py-0.5 text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500">PCO2 (mmHg)</label>
                <input
                  type="number"
                  step="1"
                  value={abgPco2Mmhg || ''}
                  onChange={(e) => setAbgPco2Mmhg(parseFloat(e.target.value) || undefined)}
                  className="w-full border rounded px-1.5 py-0.5 text-center"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500">HCO3</label>
                <input
                  type="number"
                  step="0.5"
                  value={abgHco3MeqL || ''}
                  onChange={(e) => setAbgHco3MeqL(parseFloat(e.target.value) || undefined)}
                  className="w-full border rounded px-1.5 py-0.5 text-center"
                />
              </div>
            </div>
            <div className="mt-2 text-xs flex justify-between font-semibold text-gray-800">
              <span>Oxygenation Index (OI): {oi !== null ? oi : '-'}</span>
              <span>Oxygen Saturation Index (OSI): {osi !== null ? osi : '-'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Prone Positioning (Hours)</label>
              <input
                type="number"
                step="0.5"
                value={pronePositioningHours}
                onChange={(e) => setPronePositioningHours(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Respiratory Rate (Total)</label>
              <input
                type="number"
                value={respiratoryRateTotal || ''}
                onChange={(e) => setRespiratoryRateTotal(parseInt(e.target.value) || undefined)}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nursing Observations</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Patient placed prone. Chest expansion symmetric. Secretions cleared."
              className="w-full text-xs border rounded px-2 py-1.5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border rounded text-xs text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
