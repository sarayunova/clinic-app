import React, { useState, useEffect } from 'react';
import {
  getPediatricPramAssessments,
  deletePediatricPramAssessment,
  getPediatricAnaphylaxisPlans,
  deletePediatricAnaphylaxisPlan,
  type PediatricPramRecord,
  type PediatricAnaphylaxisPlanRecord,
} from '../api';
import { PediatricPramModal } from './PediatricPramModal';
import { AnaphylaxisPlanModal } from './AnaphylaxisPlanModal';

interface PediatricAllergyTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricAllergyTab: React.FC<PediatricAllergyTabProps> = ({
  patientId,
  patientName,
}) => {
  const [subTab, setSubTab] = useState<'pram' | 'anaphylaxis'>('pram');
  const [pramList, setPramList] = useState<PediatricPramRecord[]>([]);
  const [planList, setPlanList] = useState<PediatricAnaphylaxisPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPramModalOpen, setIsPramModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pramRes, planRes] = await Promise.all([
        getPediatricPramAssessments({ patientId }),
        getPediatricAnaphylaxisPlans({ patientId }),
      ]);
      setPramList(pramRes.assessments);
      setPlanList(planRes.plans);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric allergy and respiratory records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [patientId]);

  const handleDeletePram = async (id: number) => {
    if (!window.confirm('Delete this PRAM asthma assessment?')) return;
    try {
      await deletePediatricPramAssessment(id);
      fetchRecords();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete PRAM assessment');
    }
  };

  const handleDeletePlan = async (id: number) => {
    if (!window.confirm('Delete this anaphylaxis action plan?')) return;
    try {
      await deletePediatricAnaphylaxisPlan(id);
      fetchRecords();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete anaphylaxis action plan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-teal-900 via-slate-900 to-rose-950 text-white p-4 rounded-xl shadow-md">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🫁</span> Pediatric Asthma & Allergy Emergency Center
          </h2>
          <p className="text-xs text-teal-200 mt-0.5">
            Pediatric Respiratory Assessment Measure (PRAM 0-12) & WAO Anaphylaxis Emergency Action Plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          {subTab === 'pram' ? (
            <button
              onClick={() => setIsPramModalOpen(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition"
            >
              <span>🫁</span> Record PRAM Asthma Score
            </button>
          ) : (
            <button
              onClick={() => setIsPlanModalOpen(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition"
            >
              <span>💉</span> Create Anaphylaxis Action Plan
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Sub-tab Switcher */}
      <div className="flex border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setSubTab('pram')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
            subTab === 'pram'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>🫁</span> Acute Asthma PRAM Assessments ({pramList.length})
        </button>
        <button
          onClick={() => setSubTab('anaphylaxis')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
            subTab === 'anaphylaxis'
              ? 'border-red-600 text-red-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>💉</span> Emergency Anaphylaxis Action Plans ({planList.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading records...</div>
      ) : subTab === 'pram' ? (
        /* PRAM Assessments */
        pramList.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
            <span className="text-3xl block mb-2">🫁</span>
            <p className="text-sm font-medium text-slate-700">No acute asthma PRAM assessments recorded.</p>
            <p className="text-xs text-slate-500 mt-1">Score SpO2, retractions, scalene contractions, air entry, and wheezing.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pramList.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-teal-900">{p.assessment_code}</span>
                    <span className="text-xs text-slate-500">{p.assessment_datetime.replace('T', ' ')}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        p.severity_tier === 'impending_respiratory_failure_8_12'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : p.severity_tier === 'moderate_4_7'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      PRAM Score: {p.total_pram_score} / 12 ({p.severity_tier.replace(/_/g, ' ')})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/pediatric-allergy/pram/${p.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium border border-slate-300 flex items-center gap-1"
                    >
                      <span>🖨️</span> Asthma Dossier
                    </a>
                    <button
                      onClick={() => handleDeletePram(p.id)}
                      className="text-slate-400 hover:text-rose-600 text-xs p-1"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Room Air SpO2</span>
                    <strong className={`text-sm font-bold ${p.oxygen_saturation_pct < 92 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {p.oxygen_saturation_pct}%
                    </strong>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Suprasternal Tug</span>
                    <strong className="text-sm font-bold text-slate-900">
                      {p.suprasternal_retractions_score === 2 ? 'Present (2)' : 'Absent (0)'}
                    </strong>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Scalene Contraction</span>
                    <strong className="text-sm font-bold text-slate-900">
                      {p.scalene_muscle_contraction_score === 2 ? 'Present (2)' : 'Absent (0)'}
                    </strong>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Air Entry Score</span>
                    <strong className="text-sm font-bold text-slate-900">{p.air_entry_score} / 3</strong>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Wheezing Score</span>
                    <strong className="text-sm font-bold text-slate-900">{p.wheezing_score} / 3</strong>
                  </div>
                </div>

                <div className="text-xs bg-teal-50/60 p-2.5 rounded border border-teal-100 text-teal-950 flex flex-wrap gap-4">
                  <div>
                    <strong>SABA Response:</strong> {p.response_to_burst_saba.replace('_', ' ')}
                  </div>
                  <div>
                    <strong>Steroid Given:</strong> {p.systemic_steroid_given === 1 ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>IV Magnesium:</strong> {p.iv_magnesium_given === 1 ? 'Yes' : 'No'}
                  </div>
                </div>

                {p.clinical_notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                    <strong>Notes:</strong> {p.clinical_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Anaphylaxis Plans */
        planList.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
            <span className="text-3xl block mb-2">💉</span>
            <p className="text-sm font-medium text-slate-700">No pediatric anaphylaxis action plans registered.</p>
            <p className="text-xs text-slate-500 mt-1">Calculate weight-based Epinephrine and configure autoinjector instructions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {planList.map(plan => (
              <div key={plan.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-red-900">{plan.plan_code}</span>
                    <span className="text-xs text-slate-500">Diagnosed: {plan.diagnosis_date}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-red-100 text-red-800">
                      Child Wt: {plan.child_weight_kg} kg
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/pediatric-allergy/anaphylaxis/${plan.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold border border-red-200 flex items-center gap-1"
                    >
                      <span>🖨️</span> Wallet Card & Action Plan
                    </a>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-slate-400 hover:text-rose-600 text-xs p-1"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Allergens badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Known Allergens:</span>
                  {(plan.known_allergens || []).map((alg, idx) => (
                    <span key={idx} className="bg-rose-50 text-rose-800 border border-rose-200 text-xs px-2 py-0.5 rounded-full font-medium">
                      ⚠️ {alg}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-red-50 rounded border border-red-200">
                    <span className="text-red-900 block text-[10px] font-bold uppercase">IM Epinephrine Dose</span>
                    <strong className="text-base text-red-950 font-black">{plan.epinephrine_im_dose_mg} mg</strong>
                    <span className="text-[10px] text-red-700 block">({plan.epinephrine_im_volume_ml} mL of 1:1000)</span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Autoinjector Selection</span>
                    <strong className="text-xs text-slate-900 font-bold block mt-0.5 uppercase">
                      {plan.autoinjector_type.replace(/_/g, ' ')}
                    </strong>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Emergency Contact</span>
                    <strong className="text-xs text-slate-900 font-bold block mt-0.5">{plan.emergency_contact_name}</strong>
                    <span className="text-[10px] text-slate-500 block">{plan.emergency_contact_phone}</span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">School Plan Shared</span>
                    <strong className="text-xs text-emerald-700 font-bold block mt-0.5">
                      {plan.school_health_action_plan_shared === 1 ? '✓ Yes, Documented' : 'Pending'}
                    </strong>
                  </div>
                </div>

                {plan.clinical_instructions && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                    <strong>Instructions:</strong> {plan.clinical_instructions}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Modals */}
      <PediatricPramModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isPramModalOpen}
        onClose={() => setIsPramModalOpen(false)}
        onSuccess={() => fetchRecords()}
      />

      <AnaphylaxisPlanModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onSuccess={() => fetchRecords()}
      />
    </div>
  );
};
