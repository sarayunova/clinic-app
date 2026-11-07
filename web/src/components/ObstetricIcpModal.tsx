import React, { useState, useEffect } from 'react';
import {
  createObstetricIcpEpisode,
  calculateObstetricIcp,
  ObstetricIcpRecord,
} from '../api';

interface Props {
  patientId: number;
  admissionId?: number | null;
  gestationWeeks?: number;
  onClose: () => void;
  onSuccess: (record: ObstetricIcpRecord) => void;
}

export const ObstetricIcpModal: React.FC<Props> = ({
  patientId,
  admissionId,
  gestationWeeks = 34.0,
  onClose,
  onSuccess,
}) => {
  const [diagnosisDatetime, setDiagnosisDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [gaWeeks, setGaWeeks] = useState(gestationWeeks);
  const [peakTsba, setPeakTsba] = useState(48.0);
  const [baselineAlt, setBaselineAlt] = useState<number | undefined>(85);
  const [baselineAst, setBaselineAst] = useState<number | undefined>(68);

  const [pruritusSeverityScore, setPruritusSeverityScore] = useState(7);
  const [pruritusPalmsSoles, setPruritusPalmsSoles] = useState(true);
  const [nocturnalWorsening, setNocturnalWorsening] = useState(true);

  const [udcaStarted, setUdcaStarted] = useState(true);
  const [udcaDoseMgDay, setUdcaDoseMgDay] = useState(1000);
  const [ctgSurveillance, setCtgSurveillance] = useState<'weekly' | 'twice_weekly' | 'daily' | 'continuous_inpatient'>('twice_weekly');
  const [plannedDeliveryWeeks, setPlannedDeliveryWeeks] = useState(37.0);

  const [status, setStatus] = useState<'active_surveillance' | 'medication_titration' | 'planned_induction' | 'delivered' | 'resolved'>('active_surveillance');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    calculateObstetricIcp({
      gestationWeeks: gaWeeks,
      peakTsbaUmolL: peakTsba,
      baselineAltUL: baselineAlt,
      baselineAstUL: baselineAst,
      pruritusSeverityScore,
      pruritusPalmsSoles,
      nocturnalWorsening,
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult?.recommendedDeliveryTimingWeeksMin) {
          setPlannedDeliveryWeeks(res.evalResult.recommendedDeliveryTimingWeeksMin);
        }
        if (res.evalResult?.recommendedUdcaDoseMgDay) {
          setUdcaDoseMgDay(res.evalResult.recommendedUdcaDoseMgDay);
        }
      })
      .catch((err) => console.error(err));
  }, [gaWeeks, peakTsba, baselineAlt, baselineAst, pruritusSeverityScore, pruritusPalmsSoles, nocturnalWorsening]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createObstetricIcpEpisode({
        patientId,
        admissionId,
        diagnosisDatetime,
        gestationWeeks: gaWeeks,
        peakTsbaUmolL: peakTsba,
        baselineAltUL: baselineAlt,
        baselineAstUL: baselineAst,
        pruritusSeverityScore,
        pruritusPalmsSoles,
        nocturnalWorsening,
        udcaStarted,
        udcaDoseMgDay,
        ctgSurveillanceFrequency: ctgSurveillance,
        plannedDeliveryWeeks,
        status,
        clinicalNotes: clinicalNotes || undefined,
      });
      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create obstetric cholestasis (ICP) episode');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-emerald-200 animate-fadeIn">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>🩺</span> Intrahepatic Cholestasis of Pregnancy (ICP) Evaluation
            </h2>
            <p className="text-xs text-teal-100">
              SMFM 2021 / RCOG 43 / ACOG Fasting Bile Acids Risk Stratification & Delivery Protocol
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-teal-200 text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {preview && (
            <div
              className={`p-4 rounded-lg border flex flex-col gap-2 ${
                preview.icpSeverityTier === 'severe_ge_100'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : preview.icpSeverityTier === 'moderate_40_99'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="font-bold text-sm tracking-wide uppercase flex items-center gap-1.5">
                  <span>{preview.icpSeverityTier === 'severe_ge_100' ? '🚨' : '🧪'}</span>
                  ICP Tier: {preview.icpSeverityTier.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/70 shadow-sm">
                  Recommended Delivery: {preview.recommendedDeliveryTimingWeeksMin} - {preview.recommendedDeliveryTimingWeeksMax} weeks
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/70 shadow-sm">
                  UDCA: {preview.recommendedUdcaDoseMgDay} mg/day
                </span>
              </div>
              <p className="text-xs font-medium">{preview.stillbirthRiskAssessment}</p>
              <p className="text-xs text-gray-700 italic">{preview.deliveryTimingRationale}</p>
            </div>
          )}

          {/* Episode Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Diagnosis Datetime
              </label>
              <input
                type="datetime-local"
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
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
                min="12"
                max="43"
                value={gaWeeks}
                onChange={(e) => setGaWeeks(parseFloat(e.target.value) || 34)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                required
              />
            </div>
          </div>

          {/* Bile Acids & Liver Enzymes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Peak Fasting Bile Acids (TSBA umol/L) *
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="500.0"
                value={peakTsba}
                onChange={(e) => setPeakTsba(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-teal-300 rounded px-2.5 py-1.5 font-bold text-teal-900 bg-teal-50"
                required
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Mild: 10-39 | Mod: 40-99 | Severe: &ge;100 umol/L
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Baseline ALT (SGPT U/L)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="2000"
                value={baselineAlt ?? ''}
                onChange={(e) => setBaselineAlt(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Baseline AST (SGOT U/L)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="2000"
                value={baselineAst ?? ''}
                onChange={(e) => setBaselineAst(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Pruritus Symptoms */}
          <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-3">
            <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Pruritus Symptom Evaluation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Severity Score (0-10 VAS)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={pruritusSeverityScore}
                  onChange={(e) => setPruritusSeverityScore(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white font-bold"
                  required
                />
              </div>
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={pruritusPalmsSoles}
                    onChange={(e) => setPruritusPalmsSoles(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Palms & Soles Predominance (Classic)</span>
                </label>
              </div>
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={nocturnalWorsening}
                    onChange={(e) => setNocturnalWorsening(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Nocturnal Exacerbation / Sleep Loss</span>
                </label>
              </div>
            </div>
          </div>

          {/* Management & Delivery Planning */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                UDCA Total Daily Dose (mg/day)
              </label>
              <input
                type="number"
                step="100"
                min="300"
                max="3000"
                value={udcaDoseMgDay}
                onChange={(e) => setUdcaDoseMgDay(parseInt(e.target.value) || 900)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 font-bold text-teal-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Antenatal CTG Surveillance
              </label>
              <select
                value={ctgSurveillance}
                onChange={(e: any) => setCtgSurveillance(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="weekly">Weekly NST</option>
                <option value="twice_weekly">Twice-Weekly NST</option>
                <option value="daily">Daily NST</option>
                <option value="continuous_inpatient">Continuous Inpatient Monitoring</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Planned Delivery GA (weeks)
              </label>
              <input
                type="number"
                step="0.1"
                min="32"
                max="41"
                value={plannedDeliveryWeeks}
                onChange={(e) => setPlannedDeliveryWeeks(parseFloat(e.target.value) || 37)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 font-bold"
                required
              />
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
                <option value="active_surveillance">Active Outpatient Surveillance</option>
                <option value="medication_titration">Medication Titration</option>
                <option value="planned_induction">Planned Induction Scheduled</option>
                <option value="delivered">Delivered / Postpartum</option>
                <option value="resolved">Resolved Postpartum</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Clinical Notes / Plan
              </label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5"
                placeholder="e.g. Betamethasone course scheduled if delivery < 37w..."
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
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {submitting ? 'Recording Episode...' : 'Record ICP Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
