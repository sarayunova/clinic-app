import React, { useState } from 'react';
import { createMgso4Protocol } from '../api';

interface Mgso4ProtocolModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const Mgso4ProtocolModal: React.FC<Mgso4ProtocolModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [regimenType, setRegimenType] = useState<'zuspan_iv' | 'pritchard_im' | 'neuroprotection_preterm'>('zuspan_iv');
  const [indication, setIndication] = useState<
    'severe_preeclampsia_impending' | 'antepartum_eclampsia' | 'intrapartum_eclampsia' | 'postpartum_eclampsia' | 'fetal_neuroprotection_lt32w'
  >('severe_preeclampsia_impending');
  const [initiationDatetime, setInitiationDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [loadingDoseDetails, setLoadingDoseDetails] = useState('4g IV bolus in 100 mL NS over 15-20 min');
  const [maintenanceRateGPerH, setMaintenanceRateGPerH] = useState<number>(1.0);
  const [calciumGluconateAtBedside, setCalciumGluconateAtBedside] = useState(true);
  const [baselinePatellarReflex, setBaselinePatellarReflex] = useState('normal_2_plus');
  const [baselineRespiratoryRate, setBaselineRespiratoryRate] = useState<number>(18);
  const [baselineUrineOutputMlHr, setBaselineUrineOutputMlHr] = useState<number>(45);
  const [foleyCatheterInSitu, setFoleyCatheterInSitu] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegimenTypeChange = (type: 'zuspan_iv' | 'pritchard_im' | 'neuroprotection_preterm') => {
    setRegimenType(type);
    if (type === 'zuspan_iv') {
      setLoadingDoseDetails('4g IV bolus in 100 mL NS over 15-20 min');
      setMaintenanceRateGPerH(1.0);
    } else if (type === 'pritchard_im') {
      setLoadingDoseDetails('4g IV over 20 min + 10g IM (5g in each buttock with 2% lignocaine)');
      setMaintenanceRateGPerH(1.25); // ~5g IM q4h equivalent
    } else {
      setLoadingDoseDetails('4g IV over 30 min (preterm neuroprotection)');
      setMaintenanceRateGPerH(1.0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calciumGluconateAtBedside) {
      setError('MANDATORY SAFETY REQUIREMENT: 10% Calcium Gluconate (10 mL) must be verified at bedside before initiating Magnesium Sulfate!');
      return;
    }
    if (baselinePatellarReflex === 'absent_0') {
      setError('SAFETY HAZARD: Patellar deep tendon reflex is absent! Magnesium Sulfate is contraindicated without neurology review.');
      return;
    }
    if (baselineRespiratoryRate < 16) {
      setError('SAFETY HAZARD: Respiratory rate is < 16 bpm! Initiate airway support before starting infusion.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createMgso4Protocol({
        patientId,
        regimenType,
        indication,
        initiationDatetime: new Date(initiationDatetime).toISOString(),
        loadingDoseDetails,
        maintenanceRateGPerH: Number(maintenanceRateGPerH),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create MgSO4 resuscitation protocol');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 p-5 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h2 className="text-lg font-black tracking-wide uppercase">
                Initiate MgSO₄ Resuscitation Protocol
              </h2>
            </div>
            <p className="text-xs text-rose-100 mt-1">
              Severe Pre-Eclampsia / Eclampsia Seizure Prophylaxis for <span className="font-bold underline">{patientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-rose-200 text-2xl font-bold p-1 rounded transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-800 text-xs font-semibold flex items-center gap-2">
              <span className="text-base">🚨</span> {error}
            </div>
          )}

          {/* Mandatory Safety Alert */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex gap-3 text-amber-900">
            <span className="text-2xl">⚠️</span>
            <div className="text-xs leading-relaxed">
              <span className="font-bold uppercase tracking-wider block mb-1">
                ACOG & FOGSI Critical Safety Mandate
              </span>
              Before connecting or administering Magnesium Sulfate, verify:
              1. Patellar reflex is present (+2)
              2. Respiratory rate &ge; 16 breaths/min
              3. Urine output &ge; 30 mL/hr via Foley catheter
              4. <strong>10% Calcium Gluconate (10 mL / 1 g) is at the patient's bedside</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Regimen Type */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Resuscitation Regimen *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleRegimenTypeChange('zuspan_iv')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                    regimenType === 'zuspan_iv'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  Zuspan Regimen (IV)
                  <span className="block text-[10px] font-normal opacity-90">4g load + 1g/h IV</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRegimenTypeChange('pritchard_im')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                    regimenType === 'pritchard_im'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  Pritchard Regimen (IM)
                  <span className="block text-[10px] font-normal opacity-90">4g IV + 10g IM</span>
                </button>
              </div>
            </div>

            {/* Indication */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Clinical Indication *
              </label>
              <select
                value={indication}
                onChange={(e) => setIndication(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="severe_preeclampsia_impending">Severe Pre-Eclampsia Impending (BP ≥ 160/110)</option>
                <option value="antepartum_eclampsia">Antepartum Eclampsia (Seizure before onset of labor)</option>
                <option value="intrapartum_eclampsia">Intrapartum Eclampsia (Seizure during labor)</option>
                <option value="postpartum_eclampsia">Postpartum Eclampsia (Seizure following delivery)</option>
                <option value="fetal_neuroprotection_lt32w">Fetal Neuroprotection Preterm (&lt; 32 weeks)</option>
              </select>
            </div>
          </div>

          {/* Baseline Safety Verification Parameters */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
              Pre-Administration Safety Checks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Patellar Reflex *
                </label>
                <select
                  value={baselinePatellarReflex}
                  onChange={(e) => setBaselinePatellarReflex(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white font-medium focus:ring-rose-500"
                >
                  <option value="normal_2_plus">Normal Knee Jerk (+2)</option>
                  <option value="brisk_3_plus">Brisk (+3)</option>
                  <option value="hyperactive_clonus_4_plus">Hyperactive / Clonus (+4)</option>
                  <option value="sluggish_1_plus">Sluggish (+1)</option>
                  <option value="absent_0">ABSENT (0) - CONTRAINDICATED</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Respiratory Rate (bpm) *
                </label>
                <input
                  type="number"
                  min="8"
                  max="50"
                  value={baselineRespiratoryRate}
                  onChange={(e) => setBaselineRespiratoryRate(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white focus:ring-rose-500"
                />
                <span className="text-[10px] text-gray-500">Safe threshold: &ge; 16 bpm</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Urine Output (mL/hr) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={baselineUrineOutputMlHr}
                  onChange={(e) => setBaselineUrineOutputMlHr(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md p-1.5 text-xs bg-white focus:ring-rose-500"
                />
                <span className="text-[10px] text-gray-500">Safe threshold: &ge; 30 mL/hr</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 p-2.5 bg-white border border-gray-300 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={calciumGluconateAtBedside}
                  onChange={(e) => setCalciumGluconateAtBedside(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 block">
                    10% Calcium Gluconate (10 mL) at Bedside
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Mandatory antidote drawn up and verified ready
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-white border border-gray-300 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={foleyCatheterInSitu}
                  onChange={(e) => setFoleyCatheterInSitu(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 block">
                    Indwelling Foley Catheter with Urometer
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Continuous strict hourly urine measurement in place
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Loading Dose Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Initiation Datetime *
              </label>
              <input
                type="datetime-local"
                value={initiationDatetime}
                onChange={(e) => setInitiationDatetime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Maintenance Rate (g/hr)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="3"
                value={maintenanceRateGPerH}
                onChange={(e) => setMaintenanceRateGPerH(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white text-gray-800 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Loading Dose Administration Specification
            </label>
            <input
              type="text"
              value={loadingDoseDetails}
              onChange={(e) => setLoadingDoseDetails(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-gray-50 text-gray-800"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? 'Initiating Protocol...' : 'Confirm & Start Resuscitation Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
