import React, { useState, useMemo } from 'react';
import { createMaternalIcpEpisode, type MaternalIcpRecord } from '../api';
import { calculateMaternalIcp, type MaternalIcpInput } from '../maternalComorbidityEngine';

interface MaternalIcpModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (episode: MaternalIcpRecord) => void;
}

export const MaternalIcpModal: React.FC<MaternalIcpModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [observationDatetime, setObservationDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(33);
  const [patientWeightKg, setPatientWeightKg] = useState<number>(64);
  const [pruritusSeverity, setPruritusSeverity] = useState<
    'mild_nocturnal_palms_soles' | 'moderate_continuous' | 'severe_intractable_excoriations'
  >('moderate_continuous');
  const [totalSerumBileAcidsUmolL, setTotalSerumBileAcidsUmolL] = useState<string>('52');
  const [altUL, setAltUL] = useState<string>('95');
  const [astUL, setAstUL] = useState<string>('82');
  const [totalBilirubinMgDl, setTotalBilirubinMgDl] = useState<string>('1.2');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcResult = useMemo(() => {
    try {
      const input: MaternalIcpInput = {
        totalSerumBileAcidsUmolL: Number(totalSerumBileAcidsUmolL) || 0,
        gestationalAgeWeeks: Number(gestationalAgeWeeks) || 30,
        patientWeightKg: Number(patientWeightKg) || 60,
        pruritusSeverity,
      };
      return calculateMaternalIcp(input);
    } catch {
      return null;
    }
  }, [totalSerumBileAcidsUmolL, gestationalAgeWeeks, patientWeightKg, pruritusSeverity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createMaternalIcpEpisode({
        patientId,
        observationDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        patientWeightKg: Number(patientWeightKg),
        pruritusSeverity,
        totalSerumBileAcidsUmolL: Number(totalSerumBileAcidsUmolL),
        altUL: altUL ? Number(altUL) : undefined,
        astUL: astUL ? Number(astUL) : undefined,
        totalBilirubinMgDl: totalBilirubinMgDl ? Number(totalBilirubinMgDl) : undefined,
        status: 'active_monitoring',
        clinicalNotes: clinicalNotes.trim() || undefined,
      });

      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record ICP surveillance episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-yellow-800 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🟡</span> Intrahepatic Cholestasis of Pregnancy (ICP) Surveillance
            </h2>
            <p className="text-xs text-amber-100 mt-0.5">
              Patient: <strong className="text-white">{patientName}</strong> | RCOG Green-top Guideline #43
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

          {/* Section 1: Demographics & Gestation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observation Datetime</label>
              <input
                type="datetime-local"
                value={observationDatetime}
                onChange={e => setObservationDatetime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Gestation (Weeks)</label>
              <input
                type="number"
                step="0.1"
                min="10"
                max="44"
                value={gestationalAgeWeeks}
                onChange={e => setGestationalAgeWeeks(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Patient Weight (kg)</label>
              <input
                type="number"
                step="0.5"
                min="35"
                max="180"
                value={patientWeightKg}
                onChange={e => setPatientWeightKg(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
          </div>

          {/* Section 2: Symptoms & Bile Acids */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pruritus Severity</label>
              <select
                value={pruritusSeverity}
                onChange={e => setPruritusSeverity(e.target.value as any)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-amber-500"
              >
                <option value="mild_nocturnal_palms_soles">Mild: Nocturnal itching confined to palms & soles</option>
                <option value="moderate_continuous">Moderate: Continuous daytime & nighttime itching</option>
                <option value="severe_intractable_excoriations">Severe: Intractable with excoriations & sleep loss</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-950 mb-1">
                Total Serum Bile Acids (µmol/L) *
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="500"
                value={totalSerumBileAcidsUmolL}
                onChange={e => setTotalSerumBileAcidsUmolL(e.target.value)}
                className="w-full px-3 py-1.5 border-2 border-amber-400 bg-amber-50/50 rounded font-bold text-base text-amber-950 focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          </div>

          {/* Liver Function Tests */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
              Concurrent Liver Function Tests (LFTs)
            </span>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">ALT (U/L)</label>
                <input
                  type="number"
                  step="1"
                  value={altUL}
                  onChange={e => setAltUL(e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">AST (U/L)</label>
                <input
                  type="number"
                  step="1"
                  value={astUL}
                  onChange={e => setAstUL(e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Total Bilirubin (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={totalBilirubinMgDl}
                  onChange={e => setTotalBilirubinMgDl(e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Live Stratification & Guidance */}
          {calcResult && (
            <div className="p-4 bg-gradient-to-r from-slate-900 to-amber-950 text-white rounded-xl shadow-inner space-y-3">
              <div className="flex items-center justify-between border-b border-amber-900/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {calcResult.severityLabel}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    calcResult.severityTier === 'severe_100_plus'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : calcResult.severityTier === 'moderate_40_99'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {calcResult.severityTier.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Stillbirth Risk Assessment:</span>
                  <p className="text-amber-100">{calcResult.stillbirthRiskAssessment}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Recommended Delivery Window:</span>
                  <p className="text-white font-bold text-sm">{calcResult.deliveryTimingGuidance}</p>
                </div>
              </div>

              <div className="p-2.5 bg-white/10 rounded border border-white/10 text-xs">
                <span className="text-amber-300 font-bold block mb-0.5">Ursodeoxycholic Acid (UDCA) Guidance:</span>
                <p className="text-white">{calcResult.udcaDoseExplanation}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Action Items:</span>
                <ul className="list-disc list-inside text-[11px] text-amber-100 space-y-0.5">
                  {calcResult.clinicalActionItems.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-600 mb-1">Clinical Surveillance Notes</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={e => setClinicalNotes(e.target.value)}
              placeholder="e.g. Counseled on fetal movements; weekly CTG & biophysical profile planned; check coagulation profile at 34 weeks."
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-amber-500"
            />
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
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Saving ICP Record...' : 'Save ICP Surveillance Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
