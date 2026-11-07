import React, { useState, useMemo } from 'react';
import { createNeonatalSepsisEpisode, type NeonatalSepsisRecord } from '../api';
import {
  calculateKaiserEosRisk,
  calculateItRatio,
  calculateNeonatalAntibioticDosing,
  type KaiserEosInput,
} from '../neonatalSepsisEngine';

interface NeonatalSepsisModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (episode: NeonatalSepsisRecord) => void;
  defaultGestationalWeeks?: number;
  defaultBirthWeightKg?: number;
}

export const NeonatalSepsisModal: React.FC<NeonatalSepsisModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultGestationalWeeks = 38.0,
  defaultBirthWeightKg = 3.1,
}) => {
  const [evaluationDatetime, setEvaluationDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<string>(String(defaultGestationalWeeks));
  const [gestationalAgeDays, setGestationalAgeDays] = useState<string>('0');
  const [birthWeightKg, setBirthWeightKg] = useState<string>(String(defaultBirthWeightKg));
  const [maternalTempCelsius, setMaternalTempCelsius] = useState<string>('37.2');
  const [romHours, setRomHours] = useState<string>('6');
  const [maternalGbsStatus, setMaternalGbsStatus] = useState<'positive' | 'negative' | 'unknown'>('unknown');
  const [maternalIapStatus, setMaternalIapStatus] = useState<'adequate' | 'inadequate' | 'none'>('none');
  const [clinicalPresentation, setClinicalPresentation] = useState<'well_appearing' | 'equivocal' | 'clinical_illness'>('well_appearing');

  // Lab biomarkers
  const [bandsPercent, setBandsPercent] = useState<string>('');
  const [segmentedPercent, setSegmentedPercent] = useState<string>('');
  const [crpMgL, setCrpMgL] = useState<string>('');
  const [plateletsKUl, setPlateletsKUl] = useState<string>('');
  const [bloodCultureDrawn, setBloodCultureDrawn] = useState<boolean>(false);
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live Kaiser EOS calculations
  const eosCalculation = useMemo(() => {
    const gaWeeks = parseFloat(gestationalAgeWeeks) || 38;
    const gaDays = parseInt(gestationalAgeDays, 10) || 0;
    const wtKg = parseFloat(birthWeightKg) || 3.0;
    const tempC = parseFloat(maternalTempCelsius) || 37.0;
    const rom = parseFloat(romHours) || 0;

    const input: KaiserEosInput = {
      gestationalAgeWeeks: gaWeeks,
      gestationalAgeDays: gaDays,
      birthWeightGrams: wtKg * 1000,
      maternalTempCelsius: tempC,
      romHours: rom,
      maternalGbsStatus,
      maternalIapStatus,
      clinicalPresentation,
    };

    const eos = calculateKaiserEosRisk(input);
    const abx = calculateNeonatalAntibioticDosing(wtKg * 1000, gaWeeks);

    let itRatioResult = null;
    const bands = parseFloat(bandsPercent);
    const segs = parseFloat(segmentedPercent);
    if (!isNaN(bands) && !isNaN(segs)) {
      itRatioResult = calculateItRatio({
        bandsPercent: bands,
        segmentedNeutrophilsPercent: segs,
      });
    }

    return { eos, abx, itRatioResult };
  }, [
    gestationalAgeWeeks,
    gestationalAgeDays,
    birthWeightKg,
    maternalTempCelsius,
    romHours,
    maternalGbsStatus,
    maternalIapStatus,
    clinicalPresentation,
    bandsPercent,
    segmentedPercent,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await createNeonatalSepsisEpisode({
        patientId,
        evaluationDatetime,
        gestationalAgeWeeks: parseFloat(gestationalAgeWeeks),
        gestationalAgeDays: parseInt(gestationalAgeDays, 10) || 0,
        birthWeightKg: parseFloat(birthWeightKg),
        maternalTempCelsius: parseFloat(maternalTempCelsius),
        romHours: parseFloat(romHours) || 0,
        maternalGbsStatus,
        maternalIapStatus,
        clinicalPresentation,
        bloodCultureDrawn,
        empiricAntibioticsStarted: eosCalculation.eos.antibioticIndicated,
        ampicillinDoseMg: eosCalculation.abx.ampicillinDoseMg,
        gentamicinDoseMg: eosCalculation.abx.gentamicinDoseMg,
        itRatio: eosCalculation.itRatioResult ? eosCalculation.itRatioResult.itRatio : undefined,
        crpMgL: crpMgL ? parseFloat(crpMgL) : undefined,
        plateletsKUl: plateletsKUl ? parseFloat(plateletsKUl) : undefined,
        status: eosCalculation.eos.antibioticIndicated ? 'active_treatment' : 'evaluating',
        clinicalNotes: clinicalNotes || undefined,
      });

      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate neonatal sepsis evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-rose-700 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🩺</span> Neonatal Sepsis Evaluation & Kaiser EOS Calculator
            </h2>
            <p className="text-amber-100 text-sm mt-0.5">
              Patient: <span className="font-semibold text-white">{patientName}</span> (ID: {patientId})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Section 1: Perinatal History & Maternal Risk Factors */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-amber-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span>1.</span> Maternal Intrapartum Risk Factors & Perinatal Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Evaluation Time</label>
                <input
                  type="datetime-local"
                  value={evaluationDatetime}
                  onChange={(e) => setEvaluationDatetime(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Gestational Age</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="1"
                    min="22"
                    max="44"
                    value={gestationalAgeWeeks}
                    onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                    className="w-2/3 text-sm border rounded-lg px-3 py-2 bg-white"
                    placeholder="Wks"
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={gestationalAgeDays}
                    onChange={(e) => setGestationalAgeDays(e.target.value)}
                    className="w-1/3 text-sm border rounded-lg px-2 py-2 bg-white"
                    placeholder="Days"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Birth Weight (kg)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.4"
                  max="6.0"
                  value={birthWeightKg}
                  onChange={(e) => setBirthWeightKg(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Max Maternal Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  min="35.0"
                  max="42.0"
                  value={maternalTempCelsius}
                  onChange={(e) => setMaternalTempCelsius(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-amber-200/60">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rupture of Membranes (ROM Hours)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="200"
                  value={romHours}
                  onChange={(e) => setRomHours(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                  required
                />
                <span className="text-[11px] text-gray-500">Threshold: &gt;18 hours elevates EOS risk</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Maternal GBS Status</label>
                <select
                  value={maternalGbsStatus}
                  onChange={(e) => setMaternalGbsStatus(e.target.value as any)}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="unknown">Unknown</option>
                  <option value="positive">Positive (+)</option>
                  <option value="negative">Negative (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Intrapartum Prophylaxis (IAP)</label>
                <select
                  value={maternalIapStatus}
                  onChange={(e) => setMaternalIapStatus(e.target.value as any)}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="none">None</option>
                  <option value="adequate">Adequate (IV Pen/Amp/Cefazolin &ge; 4h prior)</option>
                  <option value="inadequate">Inadequate (&lt; 4h or oral only)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Infant Clinical Presentation */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span>2.</span> Infant Clinical Physical Examination Stratification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label
                className={`border rounded-xl p-3.5 cursor-pointer flex flex-col justify-between transition-all ${
                  clinicalPresentation === 'well_appearing'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">Well-Appearing</span>
                    <input
                      type="radio"
                      name="clinicalPresentation"
                      checked={clinicalPresentation === 'well_appearing'}
                      onChange={() => setClinicalPresentation('well_appearing')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    Normal respiratory effort, stable vitals, active suck, good tone, pink color.
                  </p>
                </div>
              </label>

              <label
                className={`border rounded-xl p-3.5 cursor-pointer flex flex-col justify-between transition-all ${
                  clinicalPresentation === 'equivocal'
                    ? 'border-amber-500 bg-amber-50/70 text-amber-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">Equivocal</span>
                    <input
                      type="radio"
                      name="clinicalPresentation"
                      checked={clinicalPresentation === 'equivocal'}
                      onChange={() => setClinicalPresentation('equivocal')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    Mild transient tachypnea (&gt;60/min), mild grunting &lt;2h, transient temp instability (&gt;37.5°C or &lt;36.5°C).
                  </p>
                </div>
              </label>

              <label
                className={`border rounded-xl p-3.5 cursor-pointer flex flex-col justify-between transition-all ${
                  clinicalPresentation === 'clinical_illness'
                    ? 'border-red-500 bg-red-50/70 text-red-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">Clinical Illness</span>
                    <input
                      type="radio"
                      name="clinicalPresentation"
                      checked={clinicalPresentation === 'clinical_illness'}
                      onChange={() => setClinicalPresentation('clinical_illness')}
                      className="text-red-600 focus:ring-red-500"
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    Persistent respiratory distress, hemodynamic instability, lethargy, encephalopathy, seizures.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Live Kaiser EOS Recommendation Display */}
          <div
            className={`rounded-xl border p-4 transition-colors ${
              eosCalculation.eos.recommendation === 'blood_culture_empiric_antibiotics'
                ? 'bg-red-50 border-red-300'
                : eosCalculation.eos.recommendation === 'serial_physical_exams'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-emerald-50 border-emerald-300'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-gray-600">
                  Kaiser Permanente EOS Calculator Result
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-2xl font-black text-gray-900">
                    {eosCalculation.eos.eosRiskPer1000} / 1,000
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase ${
                      eosCalculation.eos.recommendation === 'blood_culture_empiric_antibiotics'
                        ? 'bg-red-200 text-red-800'
                        : eosCalculation.eos.recommendation === 'serial_physical_exams'
                        ? 'bg-amber-200 text-amber-800'
                        : 'bg-emerald-200 text-emerald-800'
                    }`}
                  >
                    {eosCalculation.eos.recommendationLabel}
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-700 max-w-md">
                <p className="font-medium text-gray-900">Action Plan:</p>
                <p>{eosCalculation.eos.actionGuidance}</p>
              </div>
            </div>

            {eosCalculation.eos.antibioticIndicated && (
              <div className="mt-3 pt-3 border-t border-red-200/60 bg-red-100/50 rounded-lg p-3 text-xs text-red-900 flex flex-col md:flex-row gap-4 justify-between">
                <div>
                  <span className="font-bold">Prescribed Empiric Dosing:</span>
                  <div className="mt-1">
                    Ampicillin: <span className="font-semibold">{eosCalculation.abx.ampicillinDoseMg} mg</span> IV q{eosCalculation.abx.ampicillinIntervalHours}h
                  </div>
                  <div>
                    Gentamicin: <span className="font-semibold">{eosCalculation.abx.gentamicinDoseMg} mg</span> IV q{eosCalculation.abx.gentamicinIntervalHours}h
                  </div>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-red-950">
                    <input
                      type="checkbox"
                      checked={bloodCultureDrawn}
                      onChange={(e) => setBloodCultureDrawn(e.target.checked)}
                      className="rounded border-red-300 text-red-600 focus:ring-red-500 h-4 w-4"
                    />
                    <span>Blood culture collected prior to antibiotic initiation</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Hematology & Biomarkers */}
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-blue-900 text-sm uppercase tracking-wider flex items-center justify-between">
              <span>3. Hematologic Left-Shift & Sepsis Biomarkers (Optional)</span>
              {eosCalculation.itRatioResult && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-semibold ${
                    eosCalculation.itRatioResult.isElevated
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  I/T Ratio: {eosCalculation.itRatioResult.itRatio} (
                  {eosCalculation.itRatioResult.isElevated ? 'Significant Left Shift ≥ 0.20' : 'Normal'})
                </span>
              )}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bands (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={bandsPercent}
                  onChange={(e) => setBandsPercent(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full text-sm border rounded-lg px-3 py-1.5 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Segmented (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={segmentedPercent}
                  onChange={(e) => setSegmentedPercent(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full text-sm border rounded-lg px-3 py-1.5 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">C-Reactive Protein (mg/L)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="300"
                  value={crpMgL}
                  onChange={(e) => setCrpMgL(e.target.value)}
                  placeholder="e.g. 12.5"
                  className="w-full text-sm border rounded-lg px-3 py-1.5 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Platelets (×10³/µL)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="1000"
                  value={plateletsKUl}
                  onChange={(e) => setPlateletsKUl(e.target.value)}
                  placeholder="e.g. 180"
                  className="w-full text-sm border rounded-lg px-3 py-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Neonatal Clinical Plan & Notes</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. Infant delivered via emergency LSCS for fetal distress; active grunt noted at 10m of life. Blood culture drawn."
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-600 to-rose-700 hover:from-amber-700 hover:to-rose-800 text-white rounded-lg text-sm font-semibold shadow-md disabled:opacity-50"
            >
              {submitting ? 'Initiating...' : 'Record Sepsis Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
