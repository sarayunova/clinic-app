import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMaternalCardiacAssessments,
  getMaternalIcpEpisodes,
  type MaternalCardiacRecord,
  type MaternalIcpRecord,
} from '../api';

export const MaternalComorbiditiesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cardiac' | 'icp'>('cardiac');
  const [cardiacList, setCardiacList] = useState<MaternalCardiacRecord[]>([]);
  const [icpList, setIcpList] = useState<MaternalIcpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardiacRes, icpRes] = await Promise.all([
        getMaternalCardiacAssessments(),
        getMaternalIcpEpisodes(),
      ]);
      setCardiacList(cardiacRes.assessments);
      setIcpList(icpRes.surveillance);
    } catch (err: any) {
      setError(err?.message || 'Failed to load maternal comorbidities console');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const highRiskCardiacCount = cardiacList.filter(
    c => c.mwho_class === 'mwho_III' || c.mwho_class === 'mwho_IV' || c.carpreg_ii_score > 4
  ).length;

  const severeIcpCount = icpList.filter(
    i => i.icp_severity_tier === 'severe_100_plus' || i.total_serum_bile_acids_umol_l >= 100
  ).length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>🤰</span> High-Risk Maternal Medical Comorbidities Command Center
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Cardio-Obstetrics (ESC mWHO & CARPREG-II Risk Scoring) & Obstetric Cholestasis (ICP Bile Acids & Delivery Planner)
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
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Cardiac Patients</span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">{cardiacList.length}</span>
          <span className="text-[11px] text-slate-400">mWHO Stratified</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">High Cardiac Risk / mWHO IV</span>
          <span className="text-2xl font-black text-rose-800 mt-1 block">{highRiskCardiacCount}</span>
          <span className="text-[11px] text-slate-400">ICU postpartum priority</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">Total ICP Episodes</span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">{icpList.length}</span>
          <span className="text-[11px] text-slate-400">Bile acids surveillance</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">Severe ICP (≥100 µmol/L)</span>
          <span className="text-2xl font-black text-red-700 mt-1 block">{severeIcpCount}</span>
          <span className="text-[11px] text-slate-400">Delivery at 35-36 weeks</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('cardiac')}
          className={`pb-3 px-5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'cardiac'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>❤️</span> Maternal Heart Disease Cohort ({cardiacList.length})
        </button>
        <button
          onClick={() => setActiveTab('icp')}
          className={`pb-3 px-5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'icp'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>🟡</span> Intrahepatic Cholestasis Cohort ({icpList.length})
        </button>
      </div>

      {/* Tab 1: Maternal Cardiac Cohort Table */}
      {activeTab === 'cardiac' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading cardiac assessments...</div>
          ) : cardiacList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No maternal cardiac assessments registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Code / Date</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Diagnosis</th>
                    <th className="py-3 px-4">mWHO Class</th>
                    <th className="py-3 px-4">CARPREG-II Score</th>
                    <th className="py-3 px-4">Event Risk</th>
                    <th className="py-3 px-4">Delivery Plan</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cardiacList.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-rose-900">
                        <Link to={`/patients/${c.patient_id}?tab=maternal_comorbidities`} className="hover:underline">
                          {c.assessment_code}
                        </Link>
                        <span className="block text-[10px] font-normal text-slate-400 font-sans mt-0.5">
                          {c.assessment_datetime.slice(0, 10)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <Link to={`/patients/${c.patient_id}`} className="font-semibold text-slate-900 hover:underline">
                          {c.patient_name}
                        </Link>
                        <span className="block text-[11px] text-slate-500 font-mono">
                          UHID: {c.patient_uhid}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-800 font-medium max-w-xs truncate" title={c.cardiac_diagnosis}>
                        {c.cardiac_diagnosis}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            c.mwho_class === 'mwho_IV'
                              ? 'bg-rose-500 text-white animate-pulse'
                              : c.mwho_class === 'mwho_III'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {c.mwho_class.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {c.carpreg_ii_score} Points
                      </td>

                      <td className="py-3 px-4">
                        <span className={`font-bold ${c.predicted_cardiac_event_risk_pct > 20 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {c.predicted_cardiac_event_risk_pct}%
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs truncate" title={c.delivery_mode_recommendation}>
                        {c.delivery_mode_recommendation}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <a
                          href={`/maternal-comorbidities/cardiac/${c.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium border border-slate-300"
                        >
                          🖨️ Dossier
                        </a>
                        <Link
                          to={`/patients/${c.patient_id}?tab=maternal_comorbidities`}
                          className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold border border-rose-200"
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

      {/* Tab 2: Intrahepatic Cholestasis Cohort Table */}
      {activeTab === 'icp' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading ICP episodes...</div>
          ) : icpList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No ICP surveillance episodes registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Episode Code</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Gestation</th>
                    <th className="py-3 px-4">Bile Acids (µmol/L)</th>
                    <th className="py-3 px-4">Severity Tier</th>
                    <th className="py-3 px-4">UDCA Dose</th>
                    <th className="py-3 px-4">Delivery Week</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {icpList.map(i => (
                    <tr key={i.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-900">
                        <Link to={`/patients/${i.patient_id}?tab=maternal_comorbidities`} className="hover:underline">
                          {i.episode_code}
                        </Link>
                        <span className="block text-[10px] font-normal text-slate-400 font-sans mt-0.5">
                          {i.observation_datetime.slice(0, 10)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <Link to={`/patients/${i.patient_id}`} className="font-semibold text-slate-900 hover:underline">
                          {i.patient_name}
                        </Link>
                        <span className="block text-[11px] text-slate-500 font-mono">
                          UHID: {i.patient_uhid}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800">
                        {i.gestational_age_weeks} Weeks
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`font-black text-sm ${
                            i.total_serum_bile_acids_umol_l >= 100
                              ? 'text-rose-600'
                              : i.total_serum_bile_acids_umol_l >= 40
                              ? 'text-amber-600'
                              : 'text-slate-800'
                          }`}
                        >
                          {i.total_serum_bile_acids_umol_l} µmol/L
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            i.icp_severity_tier === 'severe_100_plus'
                              ? 'bg-rose-500 text-white animate-pulse'
                              : i.icp_severity_tier === 'moderate_40_99'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {i.icp_severity_tier.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {i.udca_prescribed_mg_day} mg/d
                      </td>

                      <td className="py-3 px-4 font-bold text-indigo-900">
                        {i.recommended_delivery_gestation_weeks} Wks
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <a
                          href={`/maternal-comorbidities/icp/${i.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium border border-slate-300"
                        >
                          🖨️ Dossier
                        </a>
                        <Link
                          to={`/patients/${i.patient_id}?tab=maternal_comorbidities`}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-xs font-semibold border border-amber-200"
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
