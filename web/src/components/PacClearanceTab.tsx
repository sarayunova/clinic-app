import React, { useEffect, useState } from 'react';
import {
  getPatientPac,
  createPatientPac,
  deletePatientPac,
  type PacClearanceRecord,
  type AsaGrade,
  type MallampatiClass,
  type PacClearanceStatus,
  type PlannedAnesthesiaTechnique,
} from '../api';
import {
  ASA_DEFINITIONS,
  evaluateAirwayRisk,
  evaluateNpoFasting,
} from '../otPacEngine';
import { useMe } from '../auth';

interface PacClearanceTabProps {
  patientId: number;
}

export function PacClearanceTab({ patientId }: PacClearanceTabProps) {
  const me = useMe();
  const isDoctor = me.role === 'doctor';

  const [clearances, setClearances] = useState<PacClearanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [asaGrade, setAsaGrade] = useState<AsaGrade>('ASA_I');
  const [mallampatiClass, setMallampatiClass] = useState<MallampatiClass>('CLASS_I');
  const [mouthOpeningCm, setMouthOpeningCm] = useState(4.0);
  const [thyromentalDistanceCm, setThyromentalDistanceCm] = useState(6.5);
  const [dentitionStatus, setDentitionStatus] = useState<'intact' | 'loose_teeth' | 'edentulous' | 'dentures_present'>('intact');
  const [neckMobility, setNeckMobility] = useState<'normal_full' | 'restricted_extension' | 'fixed_flexion'>('normal_full');
  const [npoSolidHours, setNpoSolidHours] = useState(8);
  const [npoClearLiquidHours, setNpoClearLiquidHours] = useState(2);
  const [cardiovascularAssessment, setCardiovascularAssessment] = useState('S1, S2 audible. Normal sinus rhythm. Hemodynamically stable.');
  const [respiratoryAssessment, setRespiratoryAssessment] = useState('Bilateral air entry equal, clear. SpO2 >98% on room air.');
  const [airwayNotes, setAirwayNotes] = useState('');
  const [plannedAnesthesiaTechnique, setPlannedAnesthesiaTechnique] = useState<PlannedAnesthesiaTechnique>('SPINAL');
  const [pacClearanceStatus, setPacClearanceStatus] = useState<PacClearanceStatus>('FIT_FOR_SURGERY');
  const [highRiskWarnings, setHighRiskWarnings] = useState('');
  const [preopOrdersInstructions, setPreopOrdersInstructions] = useState('NPO after midnight. 18G IV line in non-dominant forearm. Standby 1 unit blood.');
  const [bloodProductsCrossmatched, setBloodProductsCrossmatched] = useState('1 Unit PRBC Crossmatched & Reserved');

  const loadData = () => {
    setLoading(true);
    getPatientPac(patientId)
      .then((res) => {
        setClearances(res.clearances);
        setLoading(false);
      })
      .catch((err) => {
        alert('Failed to load PAC records: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Real-time airway risk & fasting engine calculations
  const airwayEvaluation = evaluateAirwayRisk({
    mallampatiClass,
    mouthOpeningCm,
    thyromentalDistanceCm,
    dentitionStatus,
    neckMobility,
  });

  const fastingEvaluation = evaluateNpoFasting(npoSolidHours, npoClearLiquidHours);
  const selectedAsa = ASA_DEFINITIONS[asaGrade];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDoctor) {
      alert('Only doctors can issue Pre-Anesthesia Clearances (PAC).');
      return;
    }

    try {
      setSaving(true);
      await createPatientPac(patientId, {
        evaluationDate,
        asaGrade,
        mallampatiClass,
        mouthOpeningCm,
        thyromentalDistanceCm,
        dentitionStatus,
        neckMobility,
        npoSolidHours,
        npoClearLiquidHours,
        cardiovascularAssessment,
        respiratoryAssessment,
        airwayNotes: airwayNotes || airwayEvaluation.summary,
        plannedAnesthesiaTechnique,
        pacClearanceStatus,
        highRiskWarnings: highRiskWarnings || (airwayEvaluation.warnings.length > 0 ? airwayEvaluation.warnings.join(' | ') : undefined),
        preopOrdersInstructions,
        bloodProductsCrossmatched,
      });
      alert('Pre-Anesthesia Clearance (PAC) recorded successfully!');
      setShowNewForm(false);
      loadData();
    } catch (err: any) {
      alert('Error creating PAC: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this PAC record?')) return;
    try {
      await deletePatientPac(id);
      loadData();
    } catch (err: any) {
      alert('Failed to delete PAC: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>🩺</span> Pre-Anesthesia Clearance (PAC) & Airway Triage Console
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Standardized ASA Physical Status Classification, Mallampati Airway Risk stratification, and Fasting compliance verification.
          </p>
        </div>

        {isDoctor && (
          <button
            type="button"
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>{showNewForm ? '✕ Cancel' : '+ New PAC Evaluation'}</span>
          </button>
        )}
      </div>

      {/* New PAC Form */}
      {showNewForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-teal-200 shadow-md space-y-6">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">
              Record Pre-Anesthesia Assessment & Clearance
            </h3>
            <span className="text-xs bg-teal-100 text-teal-800 font-semibold px-2.5 py-0.5 rounded-full">
              Doctor In-Charge
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Evaluation Date
              </label>
              <input
                type="date"
                required
                value={evaluationDate}
                onChange={(e) => setEvaluationDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Planned Anesthesia Technique
              </label>
              <select
                value={plannedAnesthesiaTechnique}
                onChange={(e) => setPlannedAnesthesiaTechnique(e.target.value as PlannedAnesthesiaTechnique)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="SPINAL">Spinal Anesthesia (Subarachnoid Block)</option>
                <option value="EPIDURAL">Epidural Anesthesia / Analgesia</option>
                <option value="CSE">Combined Spinal-Epidural (CSE)</option>
                <option value="GENERAL_ENDOTRACHEAL">General Anesthesia (Endotracheal)</option>
                <option value="TIVA">Total Intravenous Anesthesia (TIVA)</option>
                <option value="LOCAL_MAC">Monitored Anesthesia Care (MAC) / Local</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PAC Clearance Status
              </label>
              <select
                value={pacClearanceStatus}
                onChange={(e) => setPacClearanceStatus(e.target.value as PacClearanceStatus)}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-bold ${
                  pacClearanceStatus === 'FIT_FOR_SURGERY'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : pacClearanceStatus === 'FIT_WITH_HIGH_RISK'
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : pacClearanceStatus === 'PROCEED_EMERGENCY_LIFE_SAVING'
                    ? 'border-red-300 bg-red-50 text-red-800'
                    : 'border-yellow-300 bg-yellow-50 text-yellow-800'
                }`}
              >
                <option value="FIT_FOR_SURGERY">FIT FOR SURGERY</option>
                <option value="FIT_WITH_HIGH_RISK">FIT WITH HIGH RISK</option>
                <option value="PROCEED_EMERGENCY_LIFE_SAVING">PROCEED (EMERGENCY / LIFE-SAVING)</option>
                <option value="DEFERRED_PENDING_OPTIMIZATION">DEFERRED (PENDING OPTIMIZATION)</option>
              </select>
            </div>
          </div>

          {/* Section: ASA Physical Status Classification */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>🏷️</span> ASA Physical Status Classification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select ASA Physical Status Grade
                </label>
                <select
                  value={asaGrade}
                  onChange={(e) => setAsaGrade(e.target.value as AsaGrade)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                >
                  <option value="ASA_I">ASA Class I: Normal healthy patient</option>
                  <option value="ASA_II">ASA Class II: Mild systemic disease (controlled GDM / mild HTN)</option>
                  <option value="ASA_III">ASA Class III: Severe systemic disease (preeclampsia, severe GDM, BMI &ge; 40)</option>
                  <option value="ASA_IV">ASA Class IV: Severe systemic disease that is a constant threat to life</option>
                  <option value="ASA_V">ASA Class V: Moribund patient not expected to survive without surgery</option>
                  <option value="ASA_I_E">ASA Class I-E: Emergency surgery in healthy patient</option>
                  <option value="ASA_II_E">ASA Class II-E: Emergency surgery with mild systemic disease</option>
                  <option value="ASA_III_E">ASA Class III-E: Emergency surgery with severe systemic disease</option>
                  <option value="ASA_IV_E">ASA Class IV-E: Emergency surgery with life-threatening condition</option>
                  <option value="ASA_V_E">ASA Class V-E: Emergency resuscitation / moribund patient</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>{selectedAsa.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedAsa.severityLevel === 'low'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedAsa.severityLevel === 'moderate'
                        ? 'bg-blue-100 text-blue-800'
                        : selectedAsa.severityLevel === 'high'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedAsa.severityLevel} severity {selectedAsa.isEmergency ? '• Emergency' : ''}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">{selectedAsa.description}</p>
              </div>
            </div>
          </div>

          {/* Section: Airway Examination & Mallampati Triage */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>🌬️</span> Airway Triage & Intubation Risk Score
              </h4>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  airwayEvaluation.difficultyRisk === 'high_difficult_airway'
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : airwayEvaluation.difficultyRisk === 'moderate'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                Risk: {airwayEvaluation.difficultyRisk.replace(/_/g, ' ').toUpperCase()} (Score: {airwayEvaluation.riskScore})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mallampati Class
                </label>
                <select
                  value={mallampatiClass}
                  onChange={(e) => setMallampatiClass(e.target.value as MallampatiClass)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                >
                  <option value="CLASS_I">Class I (Fauces, pillars, soft palate, uvula)</option>
                  <option value="CLASS_II">Class II (Fauces, soft palate, uvula)</option>
                  <option value="CLASS_III">Class III (Soft palate, base of uvula)</option>
                  <option value="CLASS_IV">Class IV (Hard palate visible only)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mouth Opening (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="8"
                  value={mouthOpeningCm}
                  onChange={(e) => setMouthOpeningCm(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Thyromental Dist (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="2"
                  max="12"
                  value={thyromentalDistanceCm}
                  onChange={(e) => setThyromentalDistanceCm(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Dentition Status
                </label>
                <select
                  value={dentitionStatus}
                  onChange={(e) => setDentitionStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                >
                  <option value="intact">Intact / Normal</option>
                  <option value="loose_teeth">Loose Teeth Present</option>
                  <option value="edentulous">Edentulous</option>
                  <option value="dentures_present">Dentures Present</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Neck Mobility
                </label>
                <select
                  value={neckMobility}
                  onChange={(e) => setNeckMobility(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                >
                  <option value="normal_full">Normal Full Range</option>
                  <option value="restricted_extension">Restricted Extension</option>
                  <option value="fixed_flexion">Fixed Flexion</option>
                </select>
              </div>
            </div>

            {/* Airway Warnings Banner */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
              <p className="font-semibold text-slate-700">{airwayEvaluation.summary}</p>
              {airwayEvaluation.warnings.length > 0 && (
                <ul className="mt-1 list-disc list-inside text-red-600 space-y-0.5">
                  {airwayEvaluation.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Section: NPO Fasting Verification */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>⏱️</span> NPO Fasting Compliance Guidelines
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Solid Food Fasting (Hours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="48"
                    value={npoSolidHours}
                    onChange={(e) => setNpoSolidHours(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Min: 6 hrs recommended</span>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clear Liquids Fasting (Hours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={npoClearLiquidHours}
                    onChange={(e) => setNpoClearLiquidHours(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Min: 2 hrs recommended</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs flex items-center">
                {fastingEvaluation.isFastingCompliant ? (
                  <div className="text-emerald-700 font-semibold flex items-center gap-2">
                    <span className="text-lg">✓</span> Patient meets standard NPO fasting guidelines for elective surgery.
                  </div>
                ) : (
                  <div className="text-amber-700 font-semibold space-y-1">
                    <div className="flex items-center gap-1.5 text-red-600 font-bold">
                      <span>⚠️</span> NPO Guidelines Alert
                    </div>
                    {fastingEvaluation.solidFastingWarning && <div>• {fastingEvaluation.solidFastingWarning}</div>}
                    {fastingEvaluation.clearFluidWarning && <div>• {fastingEvaluation.clearFluidWarning}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Clinical Assessments & Orders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cardiovascular Examination</label>
              <textarea
                rows={2}
                value={cardiovascularAssessment}
                onChange={(e) => setCardiovascularAssessment(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Respiratory Examination</label>
              <textarea
                rows={2}
                value={respiratoryAssessment}
                onChange={(e) => setRespiratoryAssessment(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Blood Products Crossmatched</label>
              <input
                type="text"
                value={bloodProductsCrossmatched}
                onChange={(e) => setBloodProductsCrossmatched(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">High Risk Warnings / Anesthetic Cautions</label>
              <input
                type="text"
                value={highRiskWarnings}
                onChange={(e) => setHighRiskWarnings(e.target.value)}
                placeholder="e.g. Difficult airway cart in theater, severe pre-eclampsia precautions"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Preoperative Orders & Anesthesia Instructions</label>
              <textarea
                rows={2}
                value={preopOrdersInstructions}
                onChange={(e) => setPreopOrdersInstructions(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Authorize & Issue PAC Clearance'}
            </button>
          </div>
        </form>
      )}

      {/* Clearances List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading clearance records...</div>
      ) : clearances.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
          <p className="text-sm font-semibold">No Pre-Anesthesia Clearances (PAC) recorded yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            {isDoctor
              ? 'Click "+ New PAC Evaluation" above to record airway assessment and surgical fitness.'
              : 'PAC evaluation must be completed by an attending medical doctor.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clearances.map((c) => {
            const asaInfo = ASA_DEFINITIONS[c.asa_grade];
            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-teal-200 transition-colors space-y-4"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        c.pac_clearance_status === 'FIT_FOR_SURGERY'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : c.pac_clearance_status === 'FIT_WITH_HIGH_RISK'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : c.pac_clearance_status === 'PROCEED_EMERGENCY_LIFE_SAVING'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                      }`}
                    >
                      {c.pac_clearance_status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {asaInfo?.title || c.asa_grade}
                    </span>
                    <span className="text-xs text-slate-500">
                      • Technique: <strong>{c.planned_anesthesia_technique.replace(/_/g, ' ')}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>
                      Evaluated on: <strong>{c.evaluation_date}</strong> by{' '}
                      <strong>{c.anesthesiologist_name}</strong>
                    </span>
                    {isDoctor && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-red-500 hover:text-red-700 font-semibold"
                        title="Delete PAC record"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Mallampati Class</span>
                    <span className="font-semibold text-slate-800">{c.mallampati_class.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Mouth Opening / TMD</span>
                    <span className="font-semibold text-slate-800">{c.mouth_opening_cm} cm / {c.thyromental_distance_cm} cm</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Dentition / Neck</span>
                    <span className="font-semibold text-slate-800">{c.dentition_status.replace(/_/g, ' ')} / {c.neck_mobility.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">NPO Fasting Status</span>
                    <span className="font-semibold text-slate-800">Solid: {c.npo_solid_hours}h | Clear: {c.npo_clear_liquid_hours}h</span>
                  </div>
                </div>

                {/* Clinical Notes & High Risk Warnings */}
                {(c.high_risk_warnings || c.preop_orders_instructions || c.blood_products_crossmatched) && (
                  <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 text-xs space-y-1.5">
                    {c.high_risk_warnings && (
                      <div className="text-red-700 font-semibold">
                        ⚠️ High Risk Warning: <span className="font-normal">{c.high_risk_warnings}</span>
                      </div>
                    )}
                    {c.preop_orders_instructions && (
                      <div className="text-slate-700">
                        📋 Preop Orders: <span className="font-normal">{c.preop_orders_instructions}</span>
                      </div>
                    )}
                    {c.blood_products_crossmatched && (
                      <div className="text-slate-700">
                        🩸 Blood Bank: <span className="font-normal">{c.blood_products_crossmatched}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
