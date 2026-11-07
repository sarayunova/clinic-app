import React, { useState, useEffect } from 'react';
import {
  getMaternalCardiacAssessments,
  deleteMaternalCardiacAssessment,
  getMaternalIcpEpisodes,
  deleteMaternalIcpEpisode,
  type MaternalCardiacRecord,
  type MaternalIcpRecord,
} from '../api';
import { MaternalCardiacModal } from './MaternalCardiacModal';
import { MaternalIcpModal } from './MaternalIcpModal';

interface MaternalComorbiditiesTabProps {
  patientId: number;
  patientName: string;
}

export const MaternalComorbiditiesTab: React.FC<MaternalComorbiditiesTabProps> = ({
  patientId,
  patientName,
}) => {
  const [subTab, setSubTab] = useState<'cardiac' | 'icp'>('cardiac');
  const [cardiacList, setCardiacList] = useState<MaternalCardiacRecord[]>([]);
  const [icpList, setIcpList] = useState<MaternalIcpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCardiacModalOpen, setIsCardiacModalOpen] = useState(false);
  const [isIcpModalOpen, setIsIcpModalOpen] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardiacRes, icpRes] = await Promise.all([
        getMaternalCardiacAssessments({ patientId }),
        getMaternalIcpEpisodes({ patientId }),
      ]);
      setCardiacList(cardiacRes.assessments);
      setIcpList(icpRes.surveillance);
    } catch (err: any) {
      setError(err?.message || 'Failed to load maternal comorbidity records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [patientId]);

  const handleDeleteCardiac = async (id: number) => {
    if (!window.confirm('Delete this maternal cardiac assessment?')) return;
    try {
      await deleteMaternalCardiacAssessment(id);
      fetchRecords();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleDeleteIcp = async (id: number) => {
    if (!window.confirm('Delete this ICP surveillance record?')) return;
    try {
      await deleteMaternalIcpEpisode(id);
      fetchRecords();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-rose-900 via-purple-950 to-slate-900 text-white p-4 rounded-xl shadow-md">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🤰</span> High-Risk Maternal Medical Comorbidities
          </h2>
          <p className="text-xs text-rose-200 mt-0.5">
            Cardio-Obstetrics (mWHO & CARPREG-II) & Intrahepatic Cholestasis of Pregnancy (ICP Bile Acids)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {subTab === 'cardiac' ? (
            <button
              onClick={() => setIsCardiacModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition"
            >
              <span>❤️</span> New Cardiac Risk Assessment
            </button>
          ) : (
            <button
              onClick={() => setIsIcpModalOpen(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition"
            >
              <span>🟡</span> New ICP Surveillance Episode
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
          onClick={() => setSubTab('cardiac')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
            subTab === 'cardiac'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>❤️</span> Maternal Heart Disease & CARPREG-II ({cardiacList.length})
        </button>
        <button
          onClick={() => setSubTab('icp')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
            subTab === 'icp'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>🟡</span> Intrahepatic Cholestasis of Pregnancy ({icpList.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading records...</div>
      ) : subTab === 'cardiac' ? (
        /* Cardiac Tab Content */
        cardiacList.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
            <span className="text-3xl block mb-2">❤️</span>
            <p className="text-sm font-medium text-slate-700">No maternal cardiac assessments recorded.</p>
            <p className="text-xs text-slate-500 mt-1">Assess mWHO class, CARPREG-II score, and hemodynamic delivery recommendations.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cardiacList.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-rose-900">{c.assessment_code}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      Gestation: {c.gestational_age_weeks ? `${c.gestational_age_weeks} wks` : 'Not specified'}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        c.mwho_class === 'mwho_IV'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : c.mwho_class === 'mwho_III'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {c.mwho_class.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/maternal-comorbidities/cardiac/${c.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium border border-slate-300 flex items-center gap-1"
                    >
                      <span>🖨️</span> Dossier
                    </a>
                    <button
                      onClick={() => handleDeleteCardiac(c.id)}
                      className="text-slate-400 hover:text-rose-600 text-xs p-1"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-700">
                  <strong className="text-slate-900">Diagnosis:</strong> {c.cardiac_diagnosis}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">CARPREG-II Score</span>
                    <strong className="text-sm text-rose-900 font-bold">{c.carpreg_ii_score} Points</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Predicted Events</span>
                    <strong className="text-sm text-slate-900 font-bold">{c.predicted_cardiac_event_risk_pct}%</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Baseline NYHA</span>
                    <strong className="text-sm text-slate-900 font-bold">Class {c.nyha_class_baseline}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Postpartum ICU</span>
                    <strong className={`text-sm font-bold ${c.icu_postpartum_bed_reserved ? 'text-rose-600' : 'text-slate-600'}`}>
                      {c.icu_postpartum_bed_reserved ? 'Mandatory Reserved' : 'Routine Floor'}
                    </strong>
                  </div>
                </div>

                <div className="text-xs bg-rose-50/70 p-2.5 rounded border border-rose-100 text-rose-950 space-y-1">
                  <div>
                    <strong>Delivery Recommendation:</strong> {c.delivery_mode_recommendation}
                  </div>
                  {c.monitoring_plan_antepartum && (
                    <div>
                      <strong>Hemodynamic Monitoring:</strong> {c.monitoring_plan_antepartum}
                    </div>
                  )}
                  {c.attending_cardiologist_name && (
                    <div className="text-slate-600">
                      Cardiologist: {c.attending_cardiologist_name}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ICP Tab Content */
        icpList.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
            <span className="text-3xl block mb-2">🟡</span>
            <p className="text-sm font-medium text-slate-700">No ICP surveillance episodes recorded.</p>
            <p className="text-xs text-slate-500 mt-1">Track total serum bile acids, UDCA titration, and planned delivery weeks.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {icpList.map(i => (
              <div key={i.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-amber-900">{i.episode_code}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      Gestation: {i.gestational_age_weeks} wks
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        i.icp_severity_tier === 'severe_100_plus'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : i.icp_severity_tier === 'moderate_40_99'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {i.icp_severity_tier.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/maternal-comorbidities/icp/${i.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium border border-slate-300 flex items-center gap-1"
                    >
                      <span>🖨️</span> Dossier
                    </a>
                    <button
                      onClick={() => handleDeleteIcp(i.id)}
                      className="text-slate-400 hover:text-rose-600 text-xs p-1"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-amber-50 rounded border border-amber-200">
                    <span className="text-amber-900 block text-[10px] font-bold uppercase">Serum Bile Acids</span>
                    <strong className="text-base text-amber-950 font-black">{i.total_serum_bile_acids_umol_l} µmol/L</strong>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">UDCA Prescribed</span>
                    <strong className="text-sm text-slate-900 font-bold">{i.udca_prescribed_mg_day} mg/day</strong>
                    <span className="text-[10px] text-slate-400 block">({i.udca_dose_mg_kg_day} mg/kg/d)</span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Target Delivery</span>
                    <strong className="text-sm text-indigo-900 font-bold">{i.recommended_delivery_gestation_weeks} Weeks</strong>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Surveillance Interval</span>
                    <strong className="text-sm text-slate-900 font-bold">Q{i.fetal_surveillance_interval_days} Days</strong>
                  </div>
                </div>

                {i.clinical_notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                    <strong>Surveillance Note:</strong> {i.clinical_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Modals */}
      <MaternalCardiacModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isCardiacModalOpen}
        onClose={() => setIsCardiacModalOpen(false)}
        onSuccess={() => fetchRecords()}
      />

      <MaternalIcpModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isIcpModalOpen}
        onClose={() => setIsIcpModalOpen(false)}
        onSuccess={() => fetchRecords()}
      />
    </div>
  );
};
