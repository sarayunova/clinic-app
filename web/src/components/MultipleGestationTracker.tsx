import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type MultipleGestationPregnancy,
  type MultipleGestationAssessment,
  type FetusAssessmentItem,
} from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculateMultipleGestation,
  type MultipleGestationResult,
  type Plurality,
  type Chorionicity,
  type Amnionicity,
  type FetalPresentation,
  type UaFlow,
  type FetusAssessmentData,
} from '../multipleGestationEngine';

interface Props {
  patient: Patient;
}

export function MultipleGestationTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [pregnancies, setPregnancies] = useState<MultipleGestationPregnancy[]>([]);
  const [selectedPregnancy, setSelectedPregnancy] = useState<MultipleGestationPregnancy | null>(null);
  const [assessments, setAssessments] = useState<MultipleGestationAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<MultipleGestationPregnancy>>({
    patientId: patient.id,
    plurality: 'twins',
    chorionicity: 'mcda',
    amnionicity: 'diamniotic',
    firstTrimesterSign: 't_sign',
    dividingMembraneThicknessMm: 1.5,
    placentalConfiguration: 'single_anterior',
    conceptionMethod: 'spontaneous',
    status: 'active',
    diagnosisGestationWeeks: 12,
    baselineNotes: 'Monochorionic diamniotic (MCDA) twins diagnosed at 12w scan.',
  });

  // Assessment Modal State
  const [showAssessModal, setShowAssessModal] = useState(false);
  const [editingAssessId, setEditingAssessId] = useState<number | null>(null);
  const [savingAssess, setSavingAssess] = useState(false);

  const initialAssessForm = (): Partial<MultipleGestationAssessment> => {
    return {
      pregnancyId: selectedPregnancy?.id,
      patientId: patient.id,
      assessmentDate: new Date().toISOString().substring(0, 10),
      assessmentTime: new Date().toTimeString().substring(0, 5),
      gestationalAgeWeeks: 24,
      gestationalAgeDays: 0,
      fetuses: [
        {
          label: 'Twin A',
          presentation: 'cephalic',
          bpdMm: 60,
          hcMm: 220,
          acMm: 198,
          flMm: 44,
          efwG: 680,
          efwPercentile: 50,
          dvpCm: 4.5,
          bladderVisualized: true,
          uaPi: 1.15,
          uaFlow: 'normal_positive',
          mcaPi: 1.70,
          mcaPsvCmS: 28.0,
          mcaPsvMom: 1.02,
          dvAWave: 'positive',
          hydropsPresent: false,
          demised: false,
        },
        {
          label: 'Twin B',
          presentation: 'breech',
          bpdMm: 58,
          hcMm: 215,
          acMm: 192,
          flMm: 42,
          efwG: 630,
          efwPercentile: 40,
          dvpCm: 4.2,
          bladderVisualized: true,
          uaPi: 1.18,
          uaFlow: 'normal_positive',
          mcaPi: 1.72,
          mcaPsvCmS: 29.0,
          mcaPsvMom: 1.05,
          dvAWave: 'positive',
          hydropsPresent: false,
          demised: false,
        },
      ],
      cordEntanglementNoted: false,
      clinicalNotes: 'Concordant growth, adequate amniotic fluid volumes, and normal Doppler hemodynamics in both twins.',
      performedBy: me.fullName || 'Attending Sonologist',
    };
  };

  const [assessForm, setAssessForm] = useState<Partial<MultipleGestationAssessment>>(initialAssessForm());

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const pRes = await api<MultipleGestationPregnancy[]>(
        'GET',
        `/api/patients/${patient.id}/multiple-gestation/pregnancies`,
      );
      setPregnancies(pRes || []);
      const active = (pRes || []).find((p) => p.status === 'active') || pRes[0] || null;
      setSelectedPregnancy(active);

      if (active) {
        const aRes = await api<MultipleGestationAssessment[]>(
          'GET',
          `/api/multiple-gestation/pregnancies/${active.id}/assessments`,
        );
        setAssessments(aRes || []);
      } else {
        setAssessments([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load multiple gestation records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patient.id]);

  const handleSelectPregnancy = async (preg: MultipleGestationPregnancy) => {
    setSelectedPregnancy(preg);
    setLoading(true);
    try {
      const aRes = await api<MultipleGestationAssessment[]>(
        'GET',
        `/api/multiple-gestation/pregnancies/${preg.id}/assessments`,
      );
      setAssessments(aRes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      if (selectedPregnancy && profileForm.id) {
        await api('PUT', `/api/multiple-gestation/pregnancies/${profileForm.id}`, profileForm);
      } else {
        await api('POST', '/api/multiple-gestation/pregnancies', {
          ...profileForm,
          patientId: patient.id,
        });
      }
      setShowProfileModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pregnancy profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenCreateAssess = () => {
    if (!selectedPregnancy) return;
    setEditingAssessId(null);
    setAssessForm(initialAssessForm());
    setShowAssessModal(true);
  };

  const handleOpenEditAssess = (rec: MultipleGestationAssessment) => {
    setEditingAssessId(rec.id);
    setAssessForm({ ...rec });
    setShowAssessModal(true);
  };

  const handleSaveAssess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPregnancy) return;
    setSavingAssess(true);
    setError(null);
    try {
      const payload = {
        ...assessForm,
        pregnancyId: selectedPregnancy.id,
        patientId: patient.id,
        plurality: selectedPregnancy.plurality,
        chorionicity: selectedPregnancy.chorionicity,
        amnionicity: selectedPregnancy.amnionicity,
      };

      if (editingAssessId) {
        await api('PUT', `/api/multiple-gestation/assessments/${editingAssessId}`, payload);
      } else {
        await api('POST', '/api/multiple-gestation/assessments', payload);
      }
      setShowAssessModal(false);
      const aRes = await api<MultipleGestationAssessment[]>(
        'GET',
        `/api/multiple-gestation/pregnancies/${selectedPregnancy.id}/assessments`,
      );
      setAssessments(aRes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
    } finally {
      setSavingAssess(false);
    }
  };

  const handleDeleteAssess = async (id: number) => {
    if (!confirm('Are you sure you want to delete this multiple gestation assessment?')) return;
    try {
      await api('DELETE', `/api/multiple-gestation/assessments/${id}`);
      if (selectedPregnancy) {
        const aRes = await api<MultipleGestationAssessment[]>(
          'GET',
          `/api/multiple-gestation/pregnancies/${selectedPregnancy.id}/assessments`,
        );
        setAssessments(aRes || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assessment');
    }
  };

  // Live real-time calculation preview
  let liveCalc: MultipleGestationResult | null = null;
  if (
    selectedPregnancy &&
    assessForm.gestationalAgeWeeks &&
    assessForm.fetuses &&
    assessForm.fetuses.length >= 2
  ) {
    try {
      liveCalc = calculateMultipleGestation({
        plurality: selectedPregnancy.plurality,
        chorionicity: selectedPregnancy.chorionicity,
        amnionicity: selectedPregnancy.amnionicity,
        gestationalAgeWeeks: Number(assessForm.gestationalAgeWeeks),
        gestationalAgeDays: Number(assessForm.gestationalAgeDays) || 0,
        fetuses: assessForm.fetuses as FetusAssessmentData[],
        cordEntanglementNoted: Boolean(assessForm.cordEntanglementNoted),
      });
    } catch {
      liveCalc = null;
    }
  }

  const updateFetus = (index: number, updates: Partial<FetusAssessmentItem>) => {
    setAssessForm((prev) => {
      const updated = [...(prev.fetuses || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], ...updates };
      }
      return { ...prev, fetuses: updated };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">👥</span>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Multiple Gestation Surveillance Tracker (Twins & Triplets)
                </h2>
                <p className="text-sm text-slate-500">
                  Chorionicity/Amnionicity determination, TTTS Quintero Staging, Gratacós sFGR Staging,
                  TAPS MCA-PSV Discordance, and Tailored Delivery Planning
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(can('patient:write_clinical') || can('care:write_nursing')) && (
              <>
                <button
                  onClick={() => {
                    setProfileForm({
                      patientId: patient.id,
                      plurality: 'twins',
                      chorionicity: 'mcda',
                      amnionicity: 'diamniotic',
                      firstTrimesterSign: 't_sign',
                      dividingMembraneThicknessMm: 1.5,
                      conceptionMethod: 'spontaneous',
                      status: 'active',
                      diagnosisGestationWeeks: 12,
                    });
                    setShowProfileModal(true);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  ⚙️ Pregnancy Profile
                </button>
                {selectedPregnancy && (
                  <button
                    onClick={handleOpenCreateAssess}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition"
                  >
                    <span>➕</span> Record Twin Ultrasound
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Selected Pregnancy Details Card */}
        {selectedPregnancy ? (
          <div className="mt-4 p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div>
              <span className="text-indigo-400 font-semibold block uppercase">Plurality</span>
              <span className="font-bold text-sm text-indigo-950 capitalize">
                {selectedPregnancy.plurality}
              </span>
            </div>
            <div>
              <span className="text-indigo-400 font-semibold block uppercase">Chorionicity</span>
              <span className="font-bold text-sm text-indigo-950 uppercase">
                {selectedPregnancy.chorionicity} ({selectedPregnancy.amnionicity})
              </span>
            </div>
            <div>
              <span className="text-indigo-400 font-semibold block uppercase">Membrane Sign</span>
              <span className="font-semibold text-slate-800">
                {selectedPregnancy.firstTrimesterSign ? selectedPregnancy.firstTrimesterSign.replace('_', ' ').toUpperCase() : '—'}
                {selectedPregnancy.dividingMembraneThicknessMm ? ` (${selectedPregnancy.dividingMembraneThicknessMm} mm)` : ''}
              </span>
            </div>
            <div>
              <span className="text-indigo-400 font-semibold block uppercase">Placenta</span>
              <span className="font-semibold text-slate-800 capitalize">
                {selectedPregnancy.placentalConfiguration ? selectedPregnancy.placentalConfiguration.replace(/_/g, ' ') : 'Single'}
              </span>
            </div>
            <div>
              <span className="text-indigo-400 font-semibold block uppercase">Status</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800">
                {selectedPregnancy.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex justify-between items-center">
            <span>No active multiple pregnancy profile found for this patient. Click "Pregnancy Profile" to register twins or triplets.</span>
            {(can('patient:write_clinical') || can('care:write_nursing')) && (
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs"
              >
                Create Twin Profile
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800 font-bold">✕</button>
        </div>
      )}

      {/* Assessments Timeline / Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-800">
            Surveillance &amp; Discordance History ({assessments.length} scans)
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading assessments...</div>
        ) : assessments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">👶👶</div>
            <p className="text-slate-600 font-medium">No multiple gestation assessments recorded yet.</p>
            <p className="text-slate-400 text-sm mt-1">
              Record longitudinal biometry, amniotic fluid DVP, and Doppler velocimetry to track discordance and TTTS/sFGR staging.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {assessments.map((rec) => {
              const isSignificant = rec.efwDiscordancePercent >= 20.0;
              const hasTtts = rec.tttsStage !== 'none';
              const hasSfgr = rec.sfgrType !== 'none';
              return (
                <div key={rec.id} className="p-6 hover:bg-slate-50/60 transition">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-bold text-slate-900">{rec.assessmentDate}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                          GA: {rec.gestationalAgeWeeks}w {rec.gestationalAgeDays}d
                        </span>
                        <span
                          className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isSignificant
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          Δ EFW: {rec.efwDiscordancePercent}% ({rec.discordanceSeverity.replace(/_/g, ' ')})
                        </span>

                        {hasTtts && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase bg-red-600 text-white animate-pulse">
                            TTTS {rec.tttsStage.toUpperCase()}
                          </span>
                        )}
                        {hasSfgr && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-500 text-white">
                            sFGR {rec.sfgrType.toUpperCase()}
                          </span>
                        )}
                        {rec.tapsStage !== 'none' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-purple-600 text-white">
                            TAPS {rec.tapsStage.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Fetuses Side-by-Side Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {rec.fetuses.map((f, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1"
                          >
                            <div className="flex justify-between items-center font-bold text-slate-800 border-b border-slate-200 pb-1">
                              <span>{f.label}</span>
                              <span className="capitalize font-semibold text-slate-500">{f.presentation}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>EFW:</span>
                              <span className="font-bold text-slate-900">{f.efwG} g {f.efwPercentile ? `(${f.efwPercentile}th centile)` : ''}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Amniotic DVP:</span>
                              <span className={`font-semibold ${f.dvpCm < 2.0 ? 'text-red-600 font-bold' : f.dvpCm > 8.0 ? 'text-purple-600 font-bold' : 'text-slate-800'}`}>
                                {f.dvpCm} cm {f.bladderVisualized ? '• Bladder +' : '• Bladder EMPTY'}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>UA Doppler:</span>
                              <span className="font-semibold text-slate-800">
                                {f.uaPi ? `PI ${f.uaPi} • ` : ''}{f.uaFlow.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {f.mcaPsvMom && (
                              <div className="flex justify-between text-slate-600">
                                <span>MCA PSV:</span>
                                <span className="font-semibold text-slate-800">{f.mcaPsvMom} MoM</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Directives & Action Plan */}
                      <div className="p-3 bg-slate-100 rounded-lg text-xs space-y-1 text-slate-800">
                        <div>
                          <b>⏱️ Surveillance Interval:</b> {rec.surveillanceIntervalRecommendation}
                        </div>
                        <div>
                          <b>📅 Delivery Timing:</b> {rec.deliveryTimingRecommendation}
                        </div>
                        <div>
                          <b>🏥 Delivery Mode:</b> {rec.deliveryModeRecommendation}
                        </div>
                        {rec.corticosteroidsIndicated && (
                          <div className="text-red-700 font-bold">
                            💉 Antenatal Corticosteroids indicated for fetal lung maturation.
                          </div>
                        )}
                        {rec.actionPlan && (
                          <div className="text-slate-600 pt-1 italic">
                            Plan: {rec.actionPlan}
                          </div>
                        )}
                      </div>

                      {rec.clinicalNotes && (
                        <p className="text-xs text-slate-600 italic">
                          Notes: {rec.clinicalNotes}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-400">
                        Performed by: {rec.performedBy || 'Clinician'} • Reviewed by: {rec.reviewedByName || 'Doctor'}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-start">
                      <Link
                        to={`/patients/${patient.id}/multiple-gestation/${rec.id}/print`}
                        target="_blank"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <span>🖨️</span> Print Report
                      </Link>

                      {(can('patient:write_clinical') || can('care:write_nursing')) && (
                        <button
                          onClick={() => handleOpenEditAssess(rec)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
                        >
                          Edit
                        </button>
                      )}

                      {(can('user:manage') || can('patient:write_clinical')) && (
                        <button
                          onClick={() => handleDeleteAssess(rec.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-semibold transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: PREGNANCY PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-800">Multiple Gestation Pregnancy Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plurality</label>
                  <select
                    value={profileForm.plurality}
                    onChange={(e) => setProfileForm({ ...profileForm, plurality: e.target.value as Plurality })}
                    className="w-full border border-slate-300 rounded p-2"
                  >
                    <option value="twins">Twins (Twin A, Twin B)</option>
                    <option value="triplets">Triplets (A, B, C)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chorionicity</label>
                  <select
                    value={profileForm.chorionicity}
                    onChange={(e) => setProfileForm({ ...profileForm, chorionicity: e.target.value as Chorionicity })}
                    className="w-full border border-slate-300 rounded p-2"
                  >
                    <option value="dcda">DCDA (Dichorionic Diamniotic)</option>
                    <option value="mcda">MCDA (Monochorionic Diamniotic)</option>
                    <option value="mcma">MCMA (Monochorionic Monoamniotic)</option>
                    <option value="tcta">TCTA (Trichorionic Triamniotic)</option>
                    <option value="dcta">DCTA (Dichorionic Triamniotic)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amnionicity</label>
                  <select
                    value={profileForm.amnionicity}
                    onChange={(e) => setProfileForm({ ...profileForm, amnionicity: e.target.value as Amnionicity })}
                    className="w-full border border-slate-300 rounded p-2"
                  >
                    <option value="diamniotic">Diamniotic</option>
                    <option value="monoamniotic">Monoamniotic</option>
                    <option value="triamniotic">Triamniotic</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">1st Trimester Sign</label>
                  <select
                    value={profileForm.firstTrimesterSign || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, firstTrimesterSign: (e.target.value || null) as any })}
                    className="w-full border border-slate-300 rounded p-2"
                  >
                    <option value="">Unspecified</option>
                    <option value="lambda_sign">Lambda / Twin Peak Sign (&gt;2 mm)</option>
                    <option value="t_sign">T-Sign (&lt;2 mm)</option>
                    <option value="no_dividing_membrane">No Dividing Membrane (MCMA)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Membrane Thickness (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={profileForm.dividingMembraneThicknessMm ?? ''}
                    onChange={(e) => setProfileForm({ ...profileForm, dividingMembraneThicknessMm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Placental Configuration</label>
                  <select
                    value={profileForm.placentalConfiguration || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, placentalConfiguration: (e.target.value || null) as any })}
                    className="w-full border border-slate-300 rounded p-2"
                  >
                    <option value="">Unspecified</option>
                    <option value="two_separate">Two Separate Placentas</option>
                    <option value="two_fused">Two Fused Placentas</option>
                    <option value="single_anterior">Single Anterior Placenta</option>
                    <option value="single_posterior">Single Posterior Placenta</option>
                    <option value="single_fundal">Single Fundal Placenta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Baseline Clinical Notes</label>
                <textarea
                  rows={2}
                  value={profileForm.baselineNotes || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, baselineNotes: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TWIN ULTRASOUND ASSESSMENT MODAL */}
      {showAssessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-800">
                {editingAssessId ? 'Edit Twin Ultrasound Assessment' : 'New Multiple Gestation Ultrasound Assessment'}
              </h3>
              <button onClick={() => setShowAssessModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveAssess} className="p-6 space-y-6">
              {/* Date & Gestation */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={assessForm.assessmentDate}
                    onChange={(e) => setAssessForm({ ...assessForm, assessmentDate: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={assessForm.assessmentTime || ''}
                    onChange={(e) => setAssessForm({ ...assessForm, assessmentTime: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GA Weeks</label>
                  <input
                    type="number"
                    min={14}
                    max={42}
                    required
                    value={assessForm.gestationalAgeWeeks}
                    onChange={(e) => setAssessForm({ ...assessForm, gestationalAgeWeeks: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GA Days</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    required
                    value={assessForm.gestationalAgeDays}
                    onChange={(e) => setAssessForm({ ...assessForm, gestationalAgeDays: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
              </div>

              {/* Individual Fetuses Inputs */}
              {(assessForm.fetuses || []).map((fetus, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="font-bold text-sm text-indigo-900">{fetus.label}</span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600">Presentation:</label>
                      <select
                        value={fetus.presentation}
                        onChange={(e) => updateFetus(idx, { presentation: e.target.value as FetalPresentation })}
                        className="text-xs border border-slate-300 rounded p-1 bg-white"
                      >
                        <option value="cephalic">Cephalic</option>
                        <option value="breech">Breech</option>
                        <option value="transverse">Transverse</option>
                        <option value="oblique">Oblique</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">EFW (grams)</label>
                      <input
                        type="number"
                        required
                        value={fetus.efwG}
                        onChange={(e) => updateFetus(idx, { efwG: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded p-1.5 bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">EFW Centile</label>
                      <input
                        type="number"
                        step="0.1"
                        value={fetus.efwPercentile ?? ''}
                        onChange={(e) => updateFetus(idx, { efwPercentile: e.target.value ? Number(e.target.value) : null })}
                        className="w-full border border-slate-300 rounded p-1.5 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Amniotic DVP (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={fetus.dvpCm}
                        onChange={(e) => updateFetus(idx, { dvpCm: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded p-1.5 bg-white font-bold"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={Boolean(fetus.bladderVisualized)}
                          onChange={(e) => updateFetus(idx, { bladderVisualized: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        <span>Bladder Visualized</span>
                      </label>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">UA End-Diastolic Flow</label>
                      <select
                        value={fetus.uaFlow}
                        onChange={(e) => updateFetus(idx, { uaFlow: e.target.value as UaFlow })}
                        className="w-full border border-slate-300 rounded p-1.5 bg-white"
                      >
                        <option value="normal_positive">Positive (Normal)</option>
                        <option value="reduced">Reduced</option>
                        <option value="absent_aedf">Absent (AEDF)</option>
                        <option value="reversed_redf">Reversed (REDF)</option>
                        <option value="intermittent_absent_reversed">Intermittent Absent/Reversed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">UA PI</label>
                      <input
                        type="number"
                        step="0.01"
                        value={fetus.uaPi ?? ''}
                        onChange={(e) => updateFetus(idx, { uaPi: e.target.value ? Number(e.target.value) : null })}
                        className="w-full border border-slate-300 rounded p-1.5 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">MCA PSV (MoM)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={fetus.mcaPsvMom ?? ''}
                        onChange={(e) => updateFetus(idx, { mcaPsvMom: e.target.value ? Number(e.target.value) : null })}
                        className="w-full border border-slate-300 rounded p-1.5 bg-white"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-red-700">
                        <input
                          type="checkbox"
                          checked={Boolean(fetus.hydropsPresent)}
                          onChange={(e) => updateFetus(idx, { hydropsPresent: e.target.checked })}
                          className="rounded text-red-600"
                        />
                        <span>Hydrops Fetalis</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              {/* REAL-TIME DISCORDANCE & COMPLICATION PREVIEW */}
              {liveCalc && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                  liveCalc.tttsStage !== 'none' || liveCalc.sfgrType !== 'none' || liveCalc.efwDiscordancePercent >= 20.0
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}>
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>⚡ Live Discordance: {liveCalc.efwDiscordancePercent}% ({liveCalc.discordanceSeverity.replace(/_/g, ' ')})</span>
                    <span>Larger: {liveCalc.largerFetusLabel} • Smaller: {liveCalc.smallerFetusLabel}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div>TTTS: <b>{liveCalc.tttsSummary}</b></div>
                    <div>sFGR: <b>{liveCalc.sfgrSummary}</b></div>
                    <div>Timing: <b>{liveCalc.deliveryTimingRecommendation}</b></div>
                  </div>
                  <div className="font-semibold pt-1">
                    Mode: {liveCalc.deliveryModeRecommendation}
                  </div>
                </div>
              )}

              {/* Notes & Attending */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Notes</label>
                  <textarea
                    rows={2}
                    value={assessForm.clinicalNotes || ''}
                    onChange={(e) => setAssessForm({ ...assessForm, clinicalNotes: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Performed By</label>
                  <input
                    type="text"
                    value={assessForm.performedBy || ''}
                    onChange={(e) => setAssessForm({ ...assessForm, performedBy: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAssessModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssess}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-sm"
                >
                  {savingAssess ? 'Saving...' : editingAssessId ? 'Update Assessment' : 'Save Twin Ultrasound'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
