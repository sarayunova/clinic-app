import React, { useEffect, useState, useMemo } from 'react';
import {
  getPediatricRenalAssessments,
  createPediatricRenalAssessment,
  deletePediatricRenalAssessment,
  getPdSessions,
  getPdSession,
  updatePdSessionStatus,
  deletePdCycle,
  type PediatricRenalAssessmentRecord,
  type PdSessionRecord,
  type PdCycleRecord,
  type PdEffluentLabRecord,
} from '../api';
import {
  calculateBedsideSchwartzEgfr,
  calculateFluidOverload,
  calculateUrinaryIndices,
  determineKdigoAkiStage,
  evaluateNephrotoxicMedications,
  type PatientCategory,
} from '../pediatricRenalEngine';
import { PdSessionModal } from './PdSessionModal';
import { PdCycleLoggerModal } from './PdCycleLoggerModal';
import { PdEffluentModal } from './PdEffluentModal';

interface PediatricRenalTabProps {
  patientId: number;
  patientName: string;
  patientDob?: string;
  patientGender?: string;
}

const COMMON_NEPHROTOXICS = [
  'Amikacin',
  'Gentamicin',
  'Vancomycin',
  'Indomethacin',
  'Ibuprofen',
  'Colistin',
  'AmphotericinB',
];

export const PediatricRenalTab: React.FC<PediatricRenalTabProps> = ({
  patientId,
  patientName,
}) => {
  const [assessments, setAssessments] = useState<PediatricRenalAssessmentRecord[]>([]);
  const [sessions, setSessions] = useState<PdSessionRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [activeSessionDetail, setActiveSessionDetail] = useState<{
    session: PdSessionRecord;
    cycles: PdCycleRecord[];
    effluentLabs: PdEffluentLabRecord[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isAssessmentFormOpen, setIsAssessmentFormOpen] = useState(false);
  const [isPdSessionModalOpen, setIsPdSessionModalOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [isEffluentModalOpen, setIsEffluentModalOpen] = useState(false);

  // Renal assessment calculator state
  const [patientCategory, setPatientCategory] = useState<PatientCategory>('term_infant');
  const [heightCm, setHeightCm] = useState<number>(50);
  const [dryWeightKg, setDryWeightKg] = useState<number>(3.2);
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(3.4);
  const [baselineScr, setBaselineScr] = useState<number>(0.5);
  const [currentScr, setCurrentScr] = useState<number>(0.9);
  const [urineOutputMl, setUrineOutputMl] = useState<string>('45');
  const [urineOutputHours, setUrineOutputHours] = useState<string>('12');
  const [serumNa, setSerumNa] = useState<string>('138');
  const [urineNa, setUrineNa] = useState<string>('35');
  const [serumBun, setSerumBun] = useState<string>('25');
  const [urineUrea, setUrineUrea] = useState<string>('280');
  const [urineCr, setUrineCr] = useState<string>('40');
  const [selectedMeds, setSelectedMeds] = useState<string[]>(['Amikacin']);
  const [clinicalActionPlan, setClinicalActionPlan] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [assessRes, sessRes] = await Promise.all([
        getPediatricRenalAssessments({ patientId }),
        getPdSessions({ patientId }),
      ]);
      setAssessments(assessRes.assessments);
      setSessions(sessRes.sessions);

      // Auto-select active session or first session
      const active = sessRes.sessions.find(s => s.status === 'active') || sessRes.sessions[0];
      if (active) {
        setSelectedSessionId(active.id);
        const detail = await getPdSession(active.id);
        setActiveSessionDetail(detail);
      } else {
        setSelectedSessionId(null);
        setActiveSessionDetail(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load renal records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadSessionDetail = async (id: number) => {
    try {
      setSelectedSessionId(id);
      const detail = await getPdSession(id);
      setActiveSessionDetail(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load PD session details');
    }
  };

  // Real-time engine evaluations
  const egfrCalc = useMemo(() => {
    return calculateBedsideSchwartzEgfr({
      heightCm,
      scrMgDl: currentScr,
      patientCategory,
    });
  }, [heightCm, currentScr, patientCategory]);

  const foCalc = useMemo(() => {
    return calculateFluidOverload({
      dryWeightKg,
      currentWeightKg,
    });
  }, [dryWeightKg, currentWeightKg]);

  const isNeonate = patientCategory === 'preterm_infant' || patientCategory === 'term_infant';

  const uopCalc = useMemo(() => {
    const ml = parseFloat(urineOutputMl);
    const hrs = parseFloat(urineOutputHours);
    if (!isNaN(ml) && !isNaN(hrs) && hrs > 0 && currentWeightKg > 0) {
      return Math.round((ml / (currentWeightKg * hrs)) * 100) / 100;
    }
    return undefined;
  }, [urineOutputMl, urineOutputHours, currentWeightKg]);

  const kdigoCalc = useMemo(() => {
    return determineKdigoAkiStage({
      baselineScr,
      currentScr,
      uopMlKgH: uopCalc,
      uopDurationHours: parseFloat(urineOutputHours) || 6,
      isNeonate,
    });
  }, [baselineScr, currentScr, uopCalc, urineOutputHours, isNeonate]);

  const urinaryCalc = useMemo(() => {
    const sNa = parseFloat(serumNa);
    const uNa = parseFloat(urineNa);
    const sBun = parseFloat(serumBun);
    const uUrea = parseFloat(urineUrea);
    const uCr = parseFloat(urineCr);

    return calculateUrinaryIndices({
      serumNaMeqL: !isNaN(sNa) ? sNa : undefined,
      urineNaMeqL: !isNaN(uNa) ? uNa : undefined,
      serumCrMgDl: currentScr,
      urineCrMgDl: !isNaN(uCr) ? uCr : undefined,
      serumBunMgDl: !isNaN(sBun) ? sBun : undefined,
      urineUreaMgDl: !isNaN(uUrea) ? uUrea : undefined,
      isNeonate,
    });
  }, [serumNa, urineNa, currentScr, urineCr, serumBun, urineUrea, isNeonate]);

  const nephrotoxicAlerts = useMemo(() => {
    return evaluateNephrotoxicMedications(selectedMeds, kdigoCalc.overallStage, egfrCalc.egfr);
  }, [selectedMeds, kdigoCalc.overallStage, egfrCalc.egfr]);

  const handleToggleMed = (med: string) => {
    setSelectedMeds(prev =>
      prev.includes(med) ? prev.filter(m => m !== med) : [...prev, med]
    );
  };

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPediatricRenalAssessment({
        patientId,
        assessmentDatetime: new Date().toISOString().slice(0, 16),
        patientCategory,
        heightCm,
        dryWeightKg,
        currentWeightKg,
        baselineCreatinineMgDl: baselineScr,
        currentCreatinineMgDl: currentScr,
        urineOutputMl: urineOutputMl ? parseFloat(urineOutputMl) : null,
        urineOutputHours: urineOutputHours ? parseFloat(urineOutputHours) : null,
        serumSodiumMeqL: serumNa ? parseFloat(serumNa) : null,
        urineSodiumMeqL: urineNa ? parseFloat(urineNa) : null,
        serumBunMgDl: serumBun ? parseFloat(serumBun) : null,
        urineUreaMgDl: urineUrea ? parseFloat(urineUrea) : null,
        urineCreatinineMgDl: urineCr ? parseFloat(urineCr) : null,
        nephrotoxicMedications: selectedMeds,
        clinicalActionPlan: clinicalActionPlan || null,
      });
      setIsAssessmentFormOpen(false);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
    }
  };

  const handleDeleteAssessment = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this renal assessment record?')) return;
    try {
      await deletePediatricRenalAssessment(id);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete assessment');
    }
  };

  const handleDeactivateSession = async (status: 'completed' | 'aborted') => {
    if (!selectedSessionId) return;
    const reason = window.prompt(`Enter reason for marking session as ${status}:`);
    if (reason === null) return;

    try {
      await updatePdSessionStatus(selectedSessionId, { status, deactivationReason: reason });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update session status');
    }
  };

  const handleDeleteCycle = async (cycleId: number) => {
    if (!selectedSessionId) return;
    if (!window.confirm('Delete this cycle flowsheet entry?')) return;

    try {
      await deletePdCycle(selectedSessionId, cycleId);
      loadSessionDetail(selectedSessionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete cycle');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>💧</span> Pediatric & Neonatal Renal Surveillance / Acute PD
          </h2>
          <p className="text-xs text-gray-500">
            KDIGO AKI Staging (AWAKEN), Bedside Schwartz eGFR, Fluid Overload (%FO), and Bedside Peritoneal Dialysis Flowsheet
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAssessmentFormOpen(!isAssessmentFormOpen)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
          >
            <span>➕</span> {isAssessmentFormOpen ? 'Close Calculator' : 'New KDIGO Assessment'}
          </button>
          <button
            onClick={() => setIsPdSessionModalOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
          >
            <span>🌀</span> Initiate Peritoneal Dialysis
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Embedded Assessment Calculator Form */}
      {isAssessmentFormOpen && (
        <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-md p-5 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">
              Neonatal & Pediatric Renal Assessment Calculator
            </h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold">
              Live Clinical Decision Support
            </span>
          </div>

          <form onSubmit={handleSaveAssessment} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                <select
                  value={patientCategory}
                  onChange={(e) => setPatientCategory(e.target.value as PatientCategory)}
                  className="w-full border rounded px-2 py-1.5 text-xs bg-white"
                >
                  <option value="preterm_infant">Preterm Infant (&lt; 37w / k=0.33)</option>
                  <option value="term_infant">Term Infant (&lt; 1 yr / k=0.45)</option>
                  <option value="child">Child (1 - 16 yrs / k=0.413)</option>
                  <option value="adolescent_female">Adolescent Female (&ge; 16y / k=0.55)</option>
                  <option value="adolescent_male">Adolescent Male (&ge; 16y / k=0.70)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Height (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={heightCm}
                  onChange={(e) => setHeightCm(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1.5 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Dry/Admission Wt (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={dryWeightKg}
                  onChange={(e) => setDryWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1.5 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Current Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={currentWeightKg}
                  onChange={(e) => setCurrentWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1.5 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Baseline SCr (mg/dL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={baselineScr}
                  onChange={(e) => setBaselineScr(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1.5 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Current SCr (mg/dL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={currentScr}
                  onChange={(e) => setCurrentScr(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1.5 text-xs font-bold text-indigo-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Urine Output (mL)</label>
                <input
                  type="number"
                  step="1"
                  value={urineOutputMl}
                  onChange={(e) => setUrineOutputMl(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Collection (Hours)</label>
                <input
                  type="number"
                  step="1"
                  value={urineOutputHours}
                  onChange={(e) => setUrineOutputHours(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Optional Urinary Indices */}
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-gray-600 hover:text-gray-900">
                Optional: Urinary Indices (Serum/Urine Na, BUN/Urea, Urine Cr) for FENa / FEUrea
              </summary>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 p-2 bg-slate-50 border rounded">
                <div>
                  <label className="text-[10px] text-gray-600">Serum Na (mEq/L)</label>
                  <input
                    type="number"
                    value={serumNa}
                    onChange={(e) => setSerumNa(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600">Urine Na (mEq/L)</label>
                  <input
                    type="number"
                    value={urineNa}
                    onChange={(e) => setUrineNa(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600">Serum BUN (mg/dL)</label>
                  <input
                    type="number"
                    value={serumBun}
                    onChange={(e) => setSerumBun(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600">Urine Urea (mg/dL)</label>
                  <input
                    type="number"
                    value={urineUrea}
                    onChange={(e) => setUrineUrea(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600">Urine Cr (mg/dL)</label>
                  <input
                    type="number"
                    value={urineCr}
                    onChange={(e) => setUrineCr(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs"
                  />
                </div>
              </div>
            </details>

            {/* Nephrotoxic Exposure Check */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Active Nephrotoxic Medication Exposures (NINJA Triage)
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_NEPHROTOXICS.map(med => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => handleToggleMed(med)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                      selectedMeds.includes(med)
                        ? 'bg-rose-100 border-rose-400 text-rose-800'
                        : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {selectedMeds.includes(med) ? '✓ ' : '+ '}
                    {med}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Clinical Decision Calculation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              {/* Bedside Schwartz */}
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                <span className="text-[10px] text-gray-500 font-semibold block uppercase">Bedside Schwartz eGFR</span>
                <span className="text-xl font-black text-indigo-700">{egfrCalc.egfr}</span>
                <span className="text-[10px] text-gray-500 block">mL/min/1.73m² (k={egfrCalc.kFactor})</span>
                <span className="text-[11px] text-gray-600 font-medium block mt-1">{egfrCalc.ckdStageDescription}</span>
              </div>

              {/* Fluid Overload % */}
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                <span className="text-[10px] text-gray-500 font-semibold block uppercase">Fluid Overload (%FO)</span>
                <span
                  className={`text-xl font-black ${
                    foCalc.severity === 'severe_critical'
                      ? 'text-rose-700'
                      : foCalc.severity === 'moderate_warning'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {foCalc.fluidOverloadPct}%
                </span>
                <span className="text-[10px] block mt-0.5 font-medium text-gray-600">
                  {foCalc.severity === 'severe_critical' && '🚨 Critical ≥ 20% (RRT Alert)'}
                  {foCalc.severity === 'moderate_warning' && '⚠️ Warning 10-20%'}
                  {foCalc.severity === 'mild' && 'Mild 5-10%'}
                  {foCalc.severity === 'normal' && 'Normal &lt; 5%'}
                </span>
              </div>

              {/* Hourly UOP */}
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                <span className="text-[10px] text-gray-500 font-semibold block uppercase">Hourly Urine Output</span>
                <span className="text-xl font-black text-blue-700">
                  {uopCalc !== undefined ? `${uopCalc} mL/kg/h` : 'N/A'}
                </span>
                <span className="text-[10px] text-gray-500 block">
                  {isNeonate ? 'Normal: ≥ 1.0 mL/kg/h' : 'Normal: ≥ 0.5 mL/kg/h'}
                </span>
              </div>

              {/* KDIGO Overall Stage */}
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                <span className="text-[10px] text-gray-500 font-semibold block uppercase">KDIGO AKI Stage</span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded text-sm font-black text-white mt-1 ${
                    kdigoCalc.overallStage === 3
                      ? 'bg-rose-600'
                      : kdigoCalc.overallStage === 2
                      ? 'bg-orange-500'
                      : kdigoCalc.overallStage === 1
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                >
                  {kdigoCalc.stageName}
                </span>
                <span className="text-[10px] text-gray-600 block mt-1">
                  SCr Stage: {kdigoCalc.scrStage} | UOP Stage: {kdigoCalc.uopStage}
                </span>
              </div>
            </div>

            {/* FENa & Nephrotoxic Warnings */}
            {urinaryCalc.etiology !== 'indeterminate' && (
              <div
                className={`p-2.5 rounded-lg text-xs border ${
                  urinaryCalc.etiology === 'prerenal'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-purple-50 border-purple-300 text-purple-900'
                }`}
              >
                <strong>Etiology Triage:</strong> {urinaryCalc.explanation}
              </div>
            )}

            {nephrotoxicAlerts.length > 0 && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                <span className="text-xs font-bold text-rose-900 block">
                  ⚠️ Nephrotoxic Drug Exposure Alerts ({nephrotoxicAlerts.length}):
                </span>
                {nephrotoxicAlerts.map(a => (
                  <div key={a.drug} className="text-xs text-rose-800">
                    <strong>{a.drug}:</strong> {a.warning} <em>({a.dosageGuidance})</em>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Clinical Action Plan & Physician Notes
              </label>
              <textarea
                rows={2}
                value={clinicalActionPlan}
                onChange={(e) => setClinicalActionPlan(e.target.value)}
                placeholder="e.g. Fluid restrict to insensible losses, hold amikacin, monitor serial electrolytes q12h"
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsAssessmentFormOpen(false)}
                className="px-3 py-1.5 border rounded text-xs text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow"
              >
                Save Renal Assessment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Peritoneal Dialysis Flowsheet Section */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>🌀</span> Acute Peritoneal Dialysis Flowsheet
              </h3>
              <p className="text-xs text-gray-500">
                Hourly Inflow, Dwell, Drain & Cumulative Net Ultrafiltration (UF) Balance
              </p>
            </div>

            {/* Session Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-700">Select Session:</label>
              <select
                value={selectedSessionId || ''}
                onChange={(e) => loadSessionDetail(Number(e.target.value))}
                className="border rounded-lg px-2.5 py-1 text-xs bg-white font-medium"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.session_number} ({s.status.toUpperCase()}) - {s.start_datetime.slice(0, 10)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeSessionDetail && (
            <div className="space-y-4">
              {/* Session Summary Header Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-xl border">
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Status / Indication</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white mt-0.5 ${
                      activeSessionDetail.session.status === 'active'
                        ? 'bg-emerald-600'
                        : activeSessionDetail.session.status === 'completed'
                        ? 'bg-blue-600'
                        : 'bg-gray-600'
                    }`}
                  >
                    {activeSessionDetail.session.status.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-gray-700 font-medium block truncate mt-0.5">
                    {activeSessionDetail.session.indication.replace(/_/g, ' ')}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Solution & Dose</span>
                  <span className="text-xs font-bold text-gray-900 block mt-0.5">
                    {activeSessionDetail.session.solution_type === 'dextrose_1_5' && '1.5% Dextrose'}
                    {activeSessionDetail.session.solution_type === 'dextrose_2_5' && '2.5% Dextrose'}
                    {activeSessionDetail.session.solution_type === 'dextrose_4_25' && '4.25% Dextrose'}
                    {activeSessionDetail.session.solution_type === 'custom_compound' && 'Custom Compound'}
                  </span>
                  <span className="text-[11px] text-blue-700 font-bold block">
                    {activeSessionDetail.session.calculated_fill_volume_ml} mL ({activeSessionDetail.session.fill_volume_ml_per_kg} mL/kg)
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Cycle Timing</span>
                  <span className="text-xs font-semibold text-gray-800 block mt-0.5">
                    In: {activeSessionDetail.session.inflow_time_minutes}m | Dwell: {activeSessionDetail.session.dwell_time_minutes}m | Out: {activeSessionDetail.session.drain_time_minutes}m
                  </span>
                  <span className="text-[11px] text-gray-500 block">
                    Target: {activeSessionDetail.session.target_cycles_count} cycles
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Cumulative In/Out</span>
                  <span className="text-xs font-semibold text-gray-800 block mt-0.5">
                    In: {activeSessionDetail.session.cumulative_inflow_ml} mL
                  </span>
                  <span className="text-xs font-semibold text-gray-800 block">
                    Out: {activeSessionDetail.session.cumulative_outflow_ml} mL
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Net Ultrafiltration</span>
                  <span
                    className={`text-lg font-black block mt-0.5 ${
                      activeSessionDetail.session.cumulative_net_uf_ml >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {activeSessionDetail.session.cumulative_net_uf_ml >= 0
                      ? `+${activeSessionDetail.session.cumulative_net_uf_ml} mL`
                      : `${activeSessionDetail.session.cumulative_net_uf_ml} mL`}
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    {activeSessionDetail.cycles.length} cycles completed
                  </span>
                </div>
              </div>

              {/* Action Bar for Active Session */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {activeSessionDetail.session.status === 'active' && (
                    <>
                      <button
                        onClick={() => setIsCycleModalOpen(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
                      >
                        <span>📝</span> Log Cycle #{activeSessionDetail.cycles.length + 1}
                      </button>
                      <button
                        onClick={() => setIsEffluentModalOpen(true)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
                      >
                        <span>🔬</span> Log Effluent Lab (WBC/Culture)
                      </button>
                      <button
                        onClick={() => handleDeactivateSession('completed')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        Complete Session
                      </button>
                      <button
                        onClick={() => handleDeactivateSession('aborted')}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        Abort Session
                      </button>
                    </>
                  )}
                </div>

                <a
                  href={`/pediatric-renal/${activeSessionDetail.session.id}/print`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <span>🖨️</span> Print Official PD Flowsheet
                </a>
              </div>

              {/* Flowsheet Table */}
              <div className="overflow-x-auto border rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                  <thead className="bg-gray-100 text-gray-700 font-semibold uppercase">
                    <tr>
                      <th className="px-3 py-2">Cycle #</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2 text-right">Inflow (mL)</th>
                      <th className="px-3 py-2 text-center">Dwell (m)</th>
                      <th className="px-3 py-2 text-right">Outflow (mL)</th>
                      <th className="px-3 py-2 text-right">Net UF (mL)</th>
                      <th className="px-3 py-2 text-right">Cum. UF (mL)</th>
                      <th className="px-3 py-2">Appearance</th>
                      <th className="px-3 py-2">Girth / Leak</th>
                      <th className="px-3 py-2">Nurse</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {activeSessionDetail.cycles.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-6 text-center text-gray-500">
                          No cycle exchanges recorded yet. Click &quot;Log Cycle #1&quot; to begin.
                        </td>
                      </tr>
                    ) : (
                      activeSessionDetail.cycles.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-bold text-blue-700">#{c.cycle_number}</td>
                          <td className="px-3 py-2 text-gray-600">{c.cycle_start_time.slice(11, 16)}</td>
                          <td className="px-3 py-2 text-right font-medium">{c.inflow_ml}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{c.dwell_duration_minutes}</td>
                          <td className="px-3 py-2 text-right font-medium">{c.outflow_ml}</td>
                          <td
                            className={`px-3 py-2 text-right font-bold ${
                              c.net_uf_ml >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {c.net_uf_ml >= 0 ? `+${c.net_uf_ml}` : c.net_uf_ml}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-black ${
                              c.cumulative_uf_ml >= 0 ? 'text-emerald-800' : 'text-rose-800'
                            }`}
                          >
                            {c.cumulative_uf_ml >= 0 ? `+${c.cumulative_uf_ml}` : c.cumulative_uf_ml}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                                c.effluent_appearance === 'cloudy_turbid' || c.effluent_appearance === 'fibrin_clots'
                                  ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {c.effluent_appearance.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {c.abdominal_girth_cm ? `${c.abdominal_girth_cm} cm` : '-'}
                            {c.catheter_site_leakage === 1 && (
                              <span className="ml-1 text-[10px] text-red-600 font-bold">(Leak)</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{c.nurse_name || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeleteCycle(c.id)}
                              className="text-red-500 hover:text-red-700 font-semibold text-xs"
                              title="Delete cycle"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Effluent Surveillance History */}
              {activeSessionDetail.effluentLabs.length > 0 && (
                <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🔬</span> Effluent Cytology & Microbiology Surveillance Logs
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeSessionDetail.effluentLabs.map(lab => (
                      <div
                        key={lab.id}
                        className={`p-3 rounded-lg border text-xs ${
                          lab.peritonitis_confirmed === 1
                            ? 'bg-rose-50 border-rose-300 text-rose-900'
                            : 'bg-white border-purple-200 text-gray-800'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold">{lab.sample_datetime.slice(0, 16).replace('T', ' ')}</span>
                          {lab.peritonitis_confirmed === 1 ? (
                            <span className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded text-[10px]">
                              PERITONITIS CONFIRMED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[10px]">
                              CLEAR / NORMAL
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] mb-1">
                          <div>WBC: <strong>{lab.wbc_count_per_mcl} /µL</strong></div>
                          <div>Neutrophils: <strong>{lab.neutrophils_percent}%</strong></div>
                        </div>
                        {lab.gram_stain && (
                          <div className="text-[11px]">Smear: {lab.gram_stain}</div>
                        )}
                        {lab.culture_growth && (
                          <div className="text-[11px]">Culture: {lab.culture_growth}</div>
                        )}
                        {lab.empiric_antibiotic_initiated && (
                          <div className="text-[11px] text-purple-800 font-semibold mt-1">
                            Rx: {lab.empiric_antibiotic_initiated}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historical Renal Assessments List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
          <span>📋</span> Prior Renal & AKI Assessments ({assessments.length})
        </h3>

        {loading ? (
          <p className="text-xs text-gray-500 py-4">Loading renal assessments...</p>
        ) : assessments.length === 0 ? (
          <p className="text-xs text-gray-500 py-4">
            No previous renal assessments on file. Click &quot;New KDIGO Assessment&quot; to perform an evaluation.
          </p>
        ) : (
          <div className="space-y-3">
            {assessments.map(a => (
              <div
                key={a.id}
                className="p-4 rounded-xl border bg-gray-50/70 hover:bg-gray-50 transition space-y-2"
              >
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold text-white ${
                        a.kdigo_overall_stage === 3
                          ? 'bg-rose-600'
                          : a.kdigo_overall_stage === 2
                          ? 'bg-orange-500'
                          : a.kdigo_overall_stage === 1
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      }`}
                    >
                      KDIGO Stage {a.kdigo_overall_stage}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">
                      {a.assessment_datetime.slice(0, 16).replace('T', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">
                      by {a.assessed_by_name || 'Staff'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteAssessment(a.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-gray-500 text-[10px] block">eGFR</span>
                    <span className="font-bold text-indigo-700">{a.calculated_egfr} mL/min/1.73m²</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">SCr (Base &rarr; Curr)</span>
                    <span className="font-medium text-gray-800">
                      {a.baseline_creatinine_mg_dl} &rarr; {a.current_creatinine_mg_dl} mg/dL
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">Fluid Overload</span>
                    <span
                      className={`font-bold ${
                        a.calculated_fluid_overload_pct >= 20
                          ? 'text-rose-600'
                          : a.calculated_fluid_overload_pct >= 10
                          ? 'text-amber-600'
                          : 'text-gray-800'
                      }`}
                    >
                      {a.calculated_fluid_overload_pct}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">Urine Output</span>
                    <span className="font-medium text-gray-800">
                      {a.calculated_uop_ml_kg_h !== null ? `${a.calculated_uop_ml_kg_h} mL/kg/h` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] block">FENa / Etiology</span>
                    <span className="font-medium text-gray-800">
                      {a.calculated_fena_pct !== null ? `${a.calculated_fena_pct}% (${a.prerenal_vs_atn})` : 'N/A'}
                    </span>
                  </div>
                </div>

                {a.clinical_action_plan && (
                  <div className="text-xs text-gray-700 bg-white p-2 rounded border mt-2">
                    <strong>Plan:</strong> {a.clinical_action_plan}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <PdSessionModal
        patientId={patientId}
        patientName={patientName}
        defaultWeightKg={currentWeightKg}
        isOpen={isPdSessionModalOpen}
        onClose={() => setIsPdSessionModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />

      {activeSessionDetail && (
        <>
          <PdCycleLoggerModal
            sessionId={activeSessionDetail.session.id}
            sessionNumber={activeSessionDetail.session.session_number}
            patientName={patientName}
            nextCycleNumber={activeSessionDetail.cycles.length + 1}
            prescribedFillVolume={activeSessionDetail.session.calculated_fill_volume_ml}
            isOpen={isCycleModalOpen}
            onClose={() => setIsCycleModalOpen(false)}
            onSuccess={() => {
              loadSessionDetail(activeSessionDetail.session.id);
            }}
          />

          <PdEffluentModal
            sessionId={activeSessionDetail.session.id}
            sessionNumber={activeSessionDetail.session.session_number}
            isOpen={isEffluentModalOpen}
            onClose={() => setIsEffluentModalOpen(false)}
            onSuccess={() => {
              loadSessionDetail(activeSessionDetail.session.id);
            }}
          />
        </>
      )}
    </div>
  );
};
