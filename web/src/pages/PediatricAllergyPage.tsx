import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPediatricPramAssessments,
  getPediatricAnaphylaxisPlans,
  type PediatricPramRecord,
  type PediatricAnaphylaxisPlanRecord,
} from '../api';

export const PediatricAllergyPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pram' | 'anaphylaxis'>('pram');
  const [pramList, setPramList] = useState<PediatricPramRecord[]>([]);
  const [planList, setPlanList] = useState<PediatricAnaphylaxisPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pramRes, planRes] = await Promise.all([
        getPediatricPramAssessments(),
        getPediatricAnaphylaxisPlans(),
      ]);
      setPramList(pramRes.assessments);
      setPlanList(planRes.plans);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric allergy & asthma console');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const severePramCount = pramList.filter(
    p => p.severity_tier === 'impending_respiratory_failure_8_12' || p.total_pram_score >= 8
  ).length;

  const totalAllergyPatients = planList.length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>🫁</span> Pediatric Asthma & Allergy Emergency Command Center
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Acute Asthma Exacerbation Scoring (PRAM 0-12, GINA Pathway) & WAO Anaphylaxis Emergency Action Plans
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
        >
          <span>🔄</span> {loading ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Asthma Assessments</span>
          <span className="text-2xl font-black text-teal-700 mt-1 block">{pramList.length}</span>
          <span className="text-[11px] text-slate-400">PRAM 0-12 score audits</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">Severe / Impending Failure</span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">{severePramCount}</span>
          <span className="text-[11px] text-slate-400">PRAM ≥ 8 / PICU standby</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">Active Anaphylaxis Plans</span>
          <span className="text-2xl font-black text-red-700 mt-1 block">{totalAllergyPatients}</span>
          <span className="text-[11px] text-slate-400">EpiPen weight-titrated</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">Clinical Protocols</span>
          <span className="text-sm font-bold text-indigo-900 mt-1 block">GINA & WAO Guidelines</span>
          <span className="text-[11px] text-slate-400">Burst SABA & 1:1,000 Epi</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('pram')}
          className={`pb-3 px-5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'pram'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>🫁</span> Acute Asthma PRAM Exacerbation Registry ({pramList.length})
        </button>
        <button
          onClick={() => setActiveTab('anaphylaxis')}
          className={`pb-3 px-5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'anaphylaxis'
              ? 'border-red-600 text-red-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>💉</span> Pediatric Anaphylaxis Emergency Action Plans ({planList.length})
        </button>
      </div>

      {/* Tab 1: PRAM Assessments Table */}
      {activeTab === 'pram' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading asthma assessments...</div>
          ) : pramList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No pediatric asthma PRAM assessments registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Code / Date</th>
                    <th className="py-3 px-4">Patient (Child)</th>
                    <th className="py-3 px-4">SpO2</th>
                    <th className="py-3 px-4">PRAM Score</th>
                    <th className="py-3 px-4">Severity Tier</th>
                    <th className="py-3 px-4">Burst SABA Response</th>
                    <th className="py-3 px-4">Steroids / MgSO4</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pramList.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-teal-900">
                        <Link to={`/patients/${p.patient_id}?tab=pediatric_allergy`} className="hover:underline">
                          {p.assessment_code}
                        </Link>
                        <span className="block text-[10px] font-normal text-slate-400 font-sans mt-0.5">
                          {p.assessment_datetime.replace('T', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <Link to={`/patients/${p.patient_id}`} className="font-semibold text-slate-900 hover:underline">
                          {p.patient_name}
                        </Link>
                        <span className="block text-[11px] text-slate-500 font-mono">
                          UHID: {p.patient_uhid}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`font-bold ${p.oxygen_saturation_pct < 92 ? 'text-rose-600' : 'text-slate-800'}`}>
                          {p.oxygen_saturation_pct}%
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <strong className="text-base text-slate-900">{p.total_pram_score} / 12</strong>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                            p.severity_tier === 'impending_respiratory_failure_8_12'
                              ? 'bg-rose-500 text-white animate-pulse'
                              : p.severity_tier === 'moderate_4_7'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.severity_tier.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 capitalize text-slate-700">
                        {p.response_to_burst_saba.replace(/_/g, ' ')}
                      </td>

                      <td className="py-3 px-4 text-[11px]">
                        <span className={p.systemic_steroid_given ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                          Steroid: {p.systemic_steroid_given ? 'Yes' : 'No'}
                        </span>
                        <span className="block text-slate-500">
                          IV MgSO4: {p.iv_magnesium_given ? 'Yes' : 'No'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <a
                          href={`/pediatric-allergy/pram/${p.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium border border-slate-300"
                        >
                          🖨️ Dossier
                        </a>
                        <Link
                          to={`/patients/${p.patient_id}?tab=pediatric_allergy`}
                          className="px-2.5 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded text-xs font-semibold border border-teal-200"
                        >
                          Chart ➜
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Anaphylaxis Plans Table */}
      {activeTab === 'anaphylaxis' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading anaphylaxis action plans...</div>
          ) : planList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No pediatric anaphylaxis action plans registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Plan Code</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Weight</th>
                    <th className="py-3 px-4">Confirmed Allergens</th>
                    <th className="py-3 px-4">IM Epinephrine</th>
                    <th className="py-3 px-4">Device Selection</th>
                    <th className="py-3 px-4">Emergency Contact</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {planList.map(plan => (
                    <tr key={plan.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-red-900">
                        <Link to={`/patients/${plan.patient_id}?tab=pediatric_allergy`} className="hover:underline">
                          {plan.plan_code}
                        </Link>
                        <span className="block text-[10px] font-normal text-slate-400 font-sans mt-0.5">
                          {plan.diagnosis_date}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <Link to={`/patients/${plan.patient_id}`} className="font-semibold text-slate-900 hover:underline">
                          {plan.patient_name}
                        </Link>
                        <span className="block text-[11px] text-slate-500 font-mono">
                          UHID: {plan.patient_uhid}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {plan.child_weight_kg} kg
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(plan.known_allergens || []).map((alg, i) => (
                            <span key={i} className="bg-red-50 text-red-700 text-[10px] px-1.5 py-0.5 rounded border border-red-200">
                              {alg}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <strong className="text-red-900 text-sm">{plan.epinephrine_im_dose_mg} mg</strong>
                        <span className="text-[10px] text-slate-500 block">({plan.epinephrine_im_volume_ml} mL of 1:1,000)</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {plan.autoinjector_type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700 text-[11px]">
                        <strong>{plan.emergency_contact_name}</strong>
                        <span className="block text-slate-500">{plan.emergency_contact_phone}</span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <a
                          href={`/pediatric-allergy/anaphylaxis/${plan.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold border border-red-200"
                        >
                          🖨️ Wallet Card
                        </a>
                        <Link
                          to={`/patients/${plan.patient_id}?tab=pediatric_allergy`}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium border border-slate-300"
                        >
                          Chart ➜
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
