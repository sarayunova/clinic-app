import React, { useState } from 'react';
import { logNeonatalNivFlowsheet, type NeonatalNivFlowsheetRecord } from '../api';

interface NivFlowsheetModalProps {
  rdsEpisodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: NeonatalNivFlowsheetRecord) => void;
  defaultHoursOnProtocol?: number;
  currentPeep?: number;
  currentFlow?: number;
  currentFio2?: number;
}

export const NivFlowsheetModal: React.FC<NivFlowsheetModalProps> = ({
  rdsEpisodeId,
  isOpen,
  onClose,
  onSuccess,
  defaultHoursOnProtocol = 1.0,
  currentPeep = 6.0,
  currentFlow = 6.0,
  currentFio2 = 35.0,
}) => {
  const [logDatetime, setLogDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [hoursOnProtocol, setHoursOnProtocol] = useState<string>(String(defaultHoursOnProtocol));
  const [respiratoryRateBpm, setRespiratoryRateBpm] = useState<string>('58');
  const [heartRateBpm, setHeartRateBpm] = useState<string>('142');
  const [spo2Percent, setSpo2Percent] = useState<string>('93');
  const [silvermanScore, setSilvermanScore] = useState<string>('2');
  const [downesScore, setDownesScore] = useState<string>('2');
  const [peepCmh2o, setPeepCmh2o] = useState<string>(String(currentPeep));
  const [flowLpm, setFlowLpm] = useState<string>(String(currentFlow));
  const [fio2Percent, setFio2Percent] = useState<string>(String(currentFio2));
  const [nasalColumellaSkinCheck, setNasalColumellaSkinCheck] = useState<'intact' | 'erythema' | 'erosion' | 'necrosis'>('intact');
  const [gastricDistension, setGastricDistension] = useState<'none' | 'mild' | 'marked_vented'>('none');
  const [arterialBloodGasPh, setArterialBloodGasPh] = useState<string>('7.34');
  const [arterialPco2Mmhg, setArterialPco2Mmhg] = useState<string>('44');
  const [arterialPao2Mmhg, setArterialPao2Mmhg] = useState<string>('64');
  const [notes, setNotes] = useState<string>('Prongs repositioned; bubbling continuous; nasal septum pink and intact.');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        logDatetime,
        hoursOnProtocol: Number(hoursOnProtocol),
        respiratoryRateBpm: Number(respiratoryRateBpm),
        heartRateBpm: Number(heartRateBpm),
        spo2Percent: Number(spo2Percent),
        silvermanScore: Number(silvermanScore),
        downesScore: Number(downesScore),
        peepCmh2o: Number(peepCmh2o),
        flowLpm: Number(flowLpm),
        fio2Percent: Number(fio2Percent),
        nasalColumellaSkinCheck,
        gastricDistension,
        arterialBloodGasPh: arterialBloodGasPh ? Number(arterialBloodGasPh) : null,
        arterialPco2Mmhg: arterialPco2Mmhg ? Number(arterialPco2Mmhg) : null,
        arterialPao2Mmhg: arterialPao2Mmhg ? Number(arterialPao2Mmhg) : null,
        notes: notes || null,
      };

      const res = await logNeonatalNivFlowsheet(rdsEpisodeId, payload);
      onSuccess(res.log);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to log NIV checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h3 className="font-bold text-sky-900 text-lg flex items-center gap-2">
            <span>⏱️</span> Log Bedside Bubble CPAP Flowsheet Checkpoint
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 bg-sky-50 p-2.5 rounded">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Checkpoint Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Hours on Protocol (Hr)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursOnProtocol}
                onChange={(e) => setHoursOnProtocol(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold text-sky-900"
              />
            </div>
          </div>

          {/* Vitals & Retraction Scores */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Resp Rate (bpm)</label>
              <input
                type="number"
                min="20"
                max="140"
                value={respiratoryRateBpm}
                onChange={(e) => setRespiratoryRateBpm(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Heart Rate (bpm)</label>
              <input
                type="number"
                min="50"
                max="240"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">SpO2 (%) [Target 91-95%]</label>
              <input
                type="number"
                step="0.5"
                min="50"
                max="100"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold text-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Silverman Score (0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={silvermanScore}
                onChange={(e) => setSilvermanScore(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Downes Score (0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={downesScore}
                onChange={(e) => setDownesScore(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Gastric Distension</label>
              <select
                value={gastricDistension}
                onChange={(e) => setGastricDistension(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5 mt-1"
              >
                <option value="none">None (Soft)</option>
                <option value="mild">Mild</option>
                <option value="marked_vented">Marked (OG Tube Vented)</option>
              </select>
            </div>
          </div>

          {/* CPAP settings */}
          <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block text-xs font-semibold text-gray-700">PEEP (cm H2O)</label>
              <input
                type="number"
                step="0.5"
                min="4"
                max="10"
                value={peepCmh2o}
                onChange={(e) => setPeepCmh2o(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold text-sky-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Flow (LPM)</label>
              <input
                type="number"
                step="0.5"
                min="2"
                max="12"
                value={flowLpm}
                onChange={(e) => setFlowLpm(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">FiO2 (%)</label>
              <input
                type="number"
                step="1"
                min="21"
                max="100"
                value={fio2Percent}
                onChange={(e) => setFio2Percent(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold text-amber-700"
              />
            </div>
          </div>

          {/* Critical Columella & Septum Skin Check */}
          <div className="border-2 border-red-200 bg-red-50/40 p-3 rounded-lg">
            <label className="block text-xs font-bold text-red-900 uppercase">
              🛡️ Nasal Columella & Septal Skin Integrity Check (Mandatory Every Shift)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              <label className={`flex items-center gap-1.5 p-2 rounded border text-xs cursor-pointer ${nasalColumellaSkinCheck === 'intact' ? 'bg-emerald-100 border-emerald-400 font-bold text-emerald-900' : 'bg-white'}`}>
                <input
                  type="radio"
                  name="columella"
                  value="intact"
                  checked={nasalColumellaSkinCheck === 'intact'}
                  onChange={() => setNasalColumellaSkinCheck('intact')}
                />
                Intact & Pink
              </label>
              <label className={`flex items-center gap-1.5 p-2 rounded border text-xs cursor-pointer ${nasalColumellaSkinCheck === 'erythema' ? 'bg-amber-100 border-amber-400 font-bold text-amber-900' : 'bg-white'}`}>
                <input
                  type="radio"
                  name="columella"
                  value="erythema"
                  checked={nasalColumellaSkinCheck === 'erythema'}
                  onChange={() => setNasalColumellaSkinCheck('erythema')}
                />
                Erythema (Blanching)
              </label>
              <label className={`flex items-center gap-1.5 p-2 rounded border text-xs cursor-pointer ${nasalColumellaSkinCheck === 'erosion' ? 'bg-orange-100 border-orange-400 font-bold text-orange-900' : 'bg-white'}`}>
                <input
                  type="radio"
                  name="columella"
                  value="erosion"
                  checked={nasalColumellaSkinCheck === 'erosion'}
                  onChange={() => setNasalColumellaSkinCheck('erosion')}
                />
                Superficial Erosion
              </label>
              <label className={`flex items-center gap-1.5 p-2 rounded border text-xs cursor-pointer ${nasalColumellaSkinCheck === 'necrosis' ? 'bg-red-200 border-red-500 font-bold text-red-950' : 'bg-white'}`}>
                <input
                  type="radio"
                  name="columella"
                  value="necrosis"
                  checked={nasalColumellaSkinCheck === 'necrosis'}
                  onChange={() => setNasalColumellaSkinCheck('necrosis')}
                />
                Necrosis / Slough
              </label>
            </div>
            {nasalColumellaSkinCheck !== 'intact' && (
              <p className="text-xs text-red-700 mt-2 font-medium">
                ⚠️ Skin breakdown warning: Immediately relieve prong pressure, ensure 2 mm gap between prongs and columella, apply protective silicone barrier gel.
              </p>
            )}
          </div>

          {/* ABG */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">ABG pH (optional)</label>
              <input
                type="number"
                step="0.01"
                min="6.8"
                max="7.8"
                value={arterialBloodGasPh}
                onChange={(e) => setArterialBloodGasPh(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">ABG PaCO2 (mmHg)</label>
              <input
                type="number"
                step="0.5"
                min="15"
                max="120"
                value={arterialPco2Mmhg}
                onChange={(e) => setArterialPco2Mmhg(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">ABG PaO2 (mmHg)</label>
              <input
                type="number"
                step="0.5"
                min="15"
                max="250"
                value={arterialPao2Mmhg}
                onChange={(e) => setArterialPao2Mmhg(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Bedside Nursing Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border rounded p-1.5 mt-1"
              placeholder="e.g. Vigorous bubbling observed; humidification chamber warm at 37°C."
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
              className="px-5 py-2 bg-sky-700 text-white rounded text-xs font-bold hover:bg-sky-800 shadow"
            >
              {loading ? 'Recording...' : 'Save Flowsheet Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
