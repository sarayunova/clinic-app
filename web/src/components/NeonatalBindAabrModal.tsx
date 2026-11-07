import React, { useState, useEffect } from 'react';
import {
  createNeonatalBindEpisode,
  calculateNeonatalBind,
  NeonatalBindAabrRecord,
} from '../api';

interface Props {
  patientId: number;
  admissionId?: number | null;
  gestationalAgeWeeks?: number;
  birthWeightGrams?: number;
  onClose: () => void;
  onSuccess: (record: NeonatalBindAabrRecord) => void;
}

export const NeonatalBindAabrModal: React.FC<Props> = ({
  patientId,
  admissionId,
  gestationalAgeWeeks = 38.0,
  birthWeightGrams = 3100,
  onClose,
  onSuccess,
}) => {
  const [assessmentDatetime, setAssessmentDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [gaWeeks, setGaWeeks] = useState(gestationalAgeWeeks);
  const [weightGrams, setWeightGrams] = useState(birthWeightGrams);
  const [peakTsbMgDl, setPeakTsbMgDl] = useState(18.5);
  const [directBili, setDirectBili] = useState<number | undefined>(undefined);
  const [albuminGDl, setAlbuminGDl] = useState<number | undefined>(3.2);

  const [mentalStatusScore, setMentalStatusScore] = useState(1);
  const [muscleToneScore, setMuscleToneScore] = useState(1);
  const [cryScore, setCryScore] = useState(0);

  const [aabrRightEar, setAabrRightEar] = useState<'not_tested' | 'pass' | 'refer'>('pass');
  const [aabrLeftEar, setAabrLeftEar] = useState<'not_tested' | 'pass' | 'refer'>('pass');
  const [exchangePerformed, setExchangePerformed] = useState(false);
  const [ivigGiven, setIvigGiven] = useState(false);

  const [status, setStatus] = useState<'evaluating' | 'under_phototherapy' | 'post_exchange_transfusion' | 'cleared_pass' | 'high_risk_neuro_followup'>('under_phototherapy');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    calculateNeonatalBind({
      gestationalAgeWeeks: gaWeeks,
      birthWeightGrams: weightGrams,
      peakTsbMgDl,
      albuminGDl,
      mentalStatusScore,
      muscleToneScore,
      cryScore,
      aabrRightEar,
      aabrLeftEar,
    })
      .then((res) => setPreview(res.evalResult))
      .catch((err) => console.error(err));
  }, [gaWeeks, weightGrams, peakTsbMgDl, albuminGDl, mentalStatusScore, muscleToneScore, cryScore, aabrRightEar, aabrLeftEar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createNeonatalBindEpisode({
        patientId,
        admissionId,
        assessmentDatetime,
        gestationalAgeWeeks: gaWeeks,
        birthWeightGrams: weightGrams,
        peakTsbMgDl,
        directBilirubinMgDl: directBili,
        albuminGDl,
        mentalStatusScore,
        muscleToneScore,
        cryScore,
        aabrRightEar,
        aabrLeftEar,
        exchangeTransfusionPerformed: exchangePerformed,
        ivigGiven,
        status,
        clinicalNotes: clinicalNotes || undefined,
      });
      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create neonatal BIND & AABR assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-yellow-200 animate-fadeIn">
        <div className="bg-gradient-to-r from-amber-600 to-yellow-600 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>🧠</span> Neonatal Hyperbilirubinemia BIND Score & AABR Screening
            </h2>
            <p className="text-xs text-yellow-100">
              AAP 2022 / NICE CG98 / JCIH 2019 Neuro-Auditory Toxicity Protocol
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-yellow-200 text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {preview && (
            <div
              className={`p-4 rounded-lg border flex flex-col gap-2 ${
                preview.urgentExchangeIndicated
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : preview.totalBindScore >= 4
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="font-bold text-sm tracking-wide uppercase flex items-center gap-1.5">
                  <span>{preview.urgentExchangeIndicated ? '🚨' : '📊'}</span>
                  BIND Score: {preview.totalBindScore}/9 — {preview.bindSeverity.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/70 shadow-sm">
                  B/A Ratio: {preview.calculatedBARatio ? `${preview.calculatedBARatio} mg/g (Cutoff: ${preview.bARatioThreshold})` : 'Albumin Not Entered'}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/70 shadow-sm">
                  AABR: {preview.aabrOverallResult.toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-medium">{preview.phototherapyRecommendation}</p>
              {preview.neuroAuditoryRecommendations?.length > 0 && (
                <ul className="text-xs list-disc pl-4 space-y-0.5">
                  {preview.neuroAuditoryRecommendations.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Neonatal Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Assessment Datetime
              </label>
              <input
                type="datetime-local"
                value={assessmentDatetime}
                onChange={(e) => setAssessmentDatetime(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Gestational Age (weeks)
              </label>
              <input
                type="number"
                step="0.1"
                min="23"
                max="44"
                value={gaWeeks}
                onChange={(e) => setGaWeeks(parseFloat(e.target.value) || 38)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Birth Weight (grams)
              </label>
              <input
                type="number"
                step="10"
                min="400"
                max="6000"
                value={weightGrams}
                onChange={(e) => setWeightGrams(parseInt(e.target.value) || 3000)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                required
              />
            </div>
          </div>

          {/* Bilirubin & Albumin */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Peak Total Serum Bilirubin (mg/dL) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="50"
                value={peakTsbMgDl}
                onChange={(e) => setPeakTsbMgDl(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-amber-300 rounded px-2.5 py-1.5 font-bold text-amber-900 bg-amber-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Direct / Conjugated Bilirubin (mg/dL)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={directBili ?? ''}
                onChange={(e) => setDirectBili(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Serum Albumin (g/dL)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="6.0"
                value={albuminGDl ?? ''}
                onChange={(e) => setAlbuminGDl(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5"
                placeholder="For B/A ratio"
              />
            </div>
          </div>

          {/* BIND Score Components (0-3 each) */}
          <div className="bg-yellow-50/60 p-4 rounded-lg border border-yellow-200 space-y-3">
            <h3 className="text-xs font-bold text-yellow-900 uppercase tracking-wider">
              Radmacher Acute Bilirubin Encephalopathy (BIND) 0-3 Sub-Scores
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  1. Mental Status (0-3)
                </label>
                <select
                  value={mentalStatusScore}
                  onChange={(e) => setMentalStatusScore(parseInt(e.target.value))}
                  className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                >
                  <option value={0}>0 - Normal / Sleepy but easily arousable</option>
                  <option value={1}>1 - Sleepy / Poor feeding / Mild stupor</option>
                  <option value={2}>2 - Lethargic / Irritable / Moderately stuporous</option>
                  <option value={3}>3 - Semicoma / Coma / Persistent seizures</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  2. Muscle Tone (0-3)
                </label>
                <select
                  value={muscleToneScore}
                  onChange={(e) => setMuscleToneScore(parseInt(e.target.value))}
                  className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                >
                  <option value={0}>0 - Normal symmetric active tone</option>
                  <option value={1}>1 - Mild hypotonia / decreased resistance</option>
                  <option value={2}>2 - Hypertonia alternating with hypotonia</option>
                  <option value={3}>3 - Retrocollis / Opisthotonos / Rigidity</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  3. Cry Characteristics (0-3)
                </label>
                <select
                  value={cryScore}
                  onChange={(e) => setCryScore(parseInt(e.target.value))}
                  className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                >
                  <option value={0}>0 - Normal vigorous consolable cry</option>
                  <option value={1}>1 - High-pitched pitch upon arousal</option>
                  <option value={2}>2 - Shrill / Piercing / Inconsolable</option>
                  <option value={3}>3 - Weak / Inaudible / Absent (Silent)</option>
                </select>
              </div>
            </div>
          </div>

          {/* AABR Hearing & Interventions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Automated Auditory Brainstem Response (AABR)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-600 block mb-1">Right Ear:</span>
                  <select
                    value={aabrRightEar}
                    onChange={(e: any) => setAabrRightEar(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="not_tested">Not Tested</option>
                    <option value="pass">Pass</option>
                    <option value="refer">Refer</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs text-gray-600 block mb-1">Left Ear:</span>
                  <select
                    value={aabrLeftEar}
                    onChange={(e: any) => setAabrLeftEar(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="not_tested">Not Tested</option>
                    <option value="pass">Pass</option>
                    <option value="refer">Refer</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded border border-gray-200 flex flex-col justify-center space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={exchangePerformed}
                  onChange={(e) => setExchangePerformed(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Double-Volume Exchange Transfusion (DVET) Performed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={ivigGiven}
                  onChange={(e) => setIvigGiven(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Intravenous Immunoglobulin (IVIG) Administered</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Clinical Status
              </label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="evaluating">Evaluating / Admission</option>
                <option value="under_phototherapy">Under Intensive Phototherapy</option>
                <option value="post_exchange_transfusion">Post-Exchange Transfusion</option>
                <option value="cleared_pass">Cleared / Normal AABR Pass</option>
                <option value="high_risk_neuro_followup">High-Risk Neurodevelopmental Follow-Up</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Clinical Notes / Action Plan
              </label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5"
                placeholder="Specific neurological or nursing notes..."
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
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {submitting ? 'Recording Assessment...' : 'Record BIND Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
