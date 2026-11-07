import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type LaborInductionEpisode,
  type UserRow,
  getInductionEpisodes,
  createInductionEpisode,
  updateInductionEpisode,
  deleteInductionEpisode,
} from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculateLaborInduction,
  type BishopScoreInput,
} from '../inductionEngine';

interface Props {
  patient: Patient;
}

export function InductionTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [episodes, setEpisodes] = useState<LaborInductionEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<LaborInductionEpisode>>({
    patientId: patient.id,
    initiationDate: new Date().toISOString().substring(0, 10),
    initiationTime: new Date().toTimeString().substring(0, 5),
    gestationalAgeWeeks: 40,
    gestationalAgeDays: 1,
    indication: 'post_dates',
    indicationDetails: '',
    previousCesareanCount: 0,

    dilationCm: 1,
    effacementPercent: 30,
    fetalStation: -2,
    consistency: 'firm',
    position: 'posterior',

    ripeningMethod: 'foley_bulb_mechanical',
    ripeningDoseDetails: '16 Fr Foley catheter inflated with 30-50 mL sterile saline',
    contraindicationsChecked: true,

    oxytocinUsed: false,
    oxytocinStartTime: '',
    oxytocinStartRateMUPerMin: 2,
    oxytocinMaxRateMUPerMin: 20,
    armPerformed: false,
    armTime: '',
    liquorStatus: 'clear',

    tachysystoleDetected: false,
    uterineHyperstimulationManagement: '',

    inductionOutcome: 'in_progress',
    cesareanReason: '',
    deliveryDatetime: '',
    birthWeightGrams: undefined,
    apgar1Min: undefined,
    apgar5Min: undefined,
    postpartumComplications: '',
    inductionSummaryNotes: '',
    attendingObstetrician: me?.fullName || '',
    reviewedBy: me?.id || 1,
  });

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getInductionEpisodes(patient.id);
      setEpisodes(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load induction records');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const u = await api<UserRow[]>('GET', '/api/users');
      setUsers(u);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadEpisodes();
    loadUsers();
  }, [patient.id]);

  // Real-time Bishop calculation
  const liveBishopInput: BishopScoreInput = {
    dilationCm: Number(form.dilationCm ?? 0),
    effacementPercent: Number(form.effacementPercent ?? 0),
    fetalStation: Number(form.fetalStation ?? 0) as -3 | -2 | -1 | 0 | 1 | 2 | 3,
    consistency: (form.consistency as 'firm' | 'medium' | 'soft') ?? 'firm',
    position: (form.position as 'posterior' | 'mid' | 'anterior') ?? 'posterior',
    previousCesarean: (form.previousCesareanCount ?? 0) > 0,
    gestationalAgeWeeks: form.gestationalAgeWeeks ?? 40,
    parity: 'nulliparous',
  };

  const liveBishopResult = calculateLaborInduction(liveBishopInput);

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      patientId: patient.id,
      initiationDate: new Date().toISOString().substring(0, 10),
      initiationTime: new Date().toTimeString().substring(0, 5),
      gestationalAgeWeeks: 40,
      gestationalAgeDays: 1,
      indication: 'post_dates',
      indicationDetails: '',
      previousCesareanCount: 0,
      dilationCm: 1,
      effacementPercent: 30,
      fetalStation: -2,
      consistency: 'firm',
      position: 'posterior',
      ripeningMethod: 'foley_bulb_mechanical',
      ripeningDoseDetails: '16 Fr Foley catheter inflated with 30-50 mL sterile saline',
      contraindicationsChecked: true,
      oxytocinUsed: false,
      oxytocinStartTime: '',
      oxytocinStartRateMUPerMin: 2,
      oxytocinMaxRateMUPerMin: 20,
      armPerformed: false,
      armTime: '',
      liquorStatus: 'clear',
      tachysystoleDetected: false,
      uterineHyperstimulationManagement: '',
      inductionOutcome: 'in_progress',
      cesareanReason: '',
      deliveryDatetime: '',
      birthWeightGrams: undefined,
      apgar1Min: undefined,
      apgar5Min: undefined,
      postpartumComplications: '',
      inductionSummaryNotes: '',
      attendingObstetrician: me?.fullName || '',
      reviewedBy: me?.id || 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (ep: LaborInductionEpisode) => {
    setEditingId(ep.id);
    setForm({ ...ep });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this labor induction record?')) return;
    try {
      await deleteInductionEpisode(id);
      await loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...form,
        patientId: patient.id,
        calculatedBishopScore: liveBishopResult.totalScore,
        cervixFavorability: liveBishopResult.favorability,
        reviewedBy: Number(form.reviewedBy || me?.id || 1),
      };

      if (editingId) {
        await updateInductionEpisode(editingId, payload);
      } else {
        await createInductionEpisode(payload);
      }

      setShowModal(false);
      await loadEpisodes();
    } catch (err: any) {
      setError(err?.message || 'Failed to save induction episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statutory Header & Info */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-800">
                Labor Induction & Modified Bishop Score Optimizer
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                Series 7A
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Evidence-based cervical ripening, Modified Bishop scoring, oxytocin titration regimen, and hyperstimulation surveillance.
            </p>
          </div>
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>+</span> Start Labor Induction
          </button>
        </div>

        {/* Statutory PC-PNDT banner */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-amber-800">Statutory Notice:</span>
            <span>Compliance with Pre-Conception & Pre-Natal Diagnostic Techniques (PC-PNDT) Act. Disclosure of fetal sex is prohibited by law.</span>
          </div>
          <span className="font-semibold text-amber-700">Strictly Enforced</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Episode Cards / Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">
            Induction Episodes ({episodes.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading induction records...</div>
        ) : episodes.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No labor induction episodes recorded for this patient. Click &quot;Start Labor Induction&quot; to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3">Initiation</th>
                  <th className="p-3">Gestation</th>
                  <th className="p-3">Indication</th>
                  <th className="p-3 text-center">Bishop Score</th>
                  <th className="p-3">Ripening Method</th>
                  <th className="p-3">Oxytocin</th>
                  <th className="p-3">Outcome</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{ep.initiationDate}</div>
                      <div className="text-xs text-slate-400">{ep.initiationTime || 'Time unspec.'}</div>
                    </td>
                    <td className="p-3 text-slate-700 font-medium">
                      {ep.gestationalAgeWeeks}w {ep.gestationalAgeDays}d
                    </td>
                    <td className="p-3">
                      <span className="capitalize text-slate-800 font-medium">
                        {ep.indication.replace(/_/g, ' ')}
                      </span>
                      {ep.previousCesareanCount > 0 && (
                        <div className="text-xs text-rose-600 font-bold mt-0.5">
                          Prior C-Section (x{ep.previousCesareanCount})
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            ep.calculatedBishopScore >= 8
                              ? 'bg-emerald-100 text-emerald-800'
                              : ep.calculatedBishopScore >= 6
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ep.calculatedBishopScore} / 13
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5 capitalize">
                          {ep.cervixFavorability.split('_')[0]}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-700">
                      <div className="font-medium capitalize">{ep.ripeningMethod.replace(/_/g, ' ')}</div>
                      {ep.ripeningDoseDetails && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{ep.ripeningDoseDetails}</div>
                      )}
                    </td>
                    <td className="p-3">
                      {ep.oxytocinUsed ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Yes ({ep.oxytocinMaxRateMUPerMin ? `${ep.oxytocinMaxRateMUPerMin} mU/min` : 'Titrated'})
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          ep.inductionOutcome.includes('vaginal')
                            ? 'bg-emerald-100 text-emerald-800'
                            : ep.inductionOutcome.includes('cesarean')
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ep.inductionOutcome.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${patient.id}/induction/${ep.id}/print`}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                      >
                        Print Flowsheet
                      </Link>
                      <button
                        onClick={() => handleOpenEdit(ep)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                      >
                        Edit
                      </button>
                      {(can('user:manage') || can('patient:write_clinical')) && (
                        <button
                          onClick={() => handleDelete(ep.id)}
                          className="text-xs font-medium text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Creating / Editing Induction Episode */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {editingId ? 'Edit Labor Induction Record' : 'Initiate Labor Induction & Bishop Assessment'}
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: <span className="font-semibold text-slate-700">{patient.fullName}</span> (ID: #{patient.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="overflow-y-auto p-5 space-y-6">
              {/* Initiation Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initiation Date *</label>
                  <input
                    type="date"
                    required
                    value={form.initiationDate}
                    onChange={(e) => setForm({ ...form, initiationDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={form.initiationTime || ''}
                    onChange={(e) => setForm({ ...form, initiationTime: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gestational Age *</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={24}
                      max={44}
                      required
                      value={form.gestationalAgeWeeks ?? 40}
                      onChange={(e) => setForm({ ...form, gestationalAgeWeeks: Number(e.target.value) })}
                      className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm text-center"
                    />
                    <span className="text-xs text-slate-500">w</span>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      required
                      value={form.gestationalAgeDays ?? 0}
                      onChange={(e) => setForm({ ...form, gestationalAgeDays: Number(e.target.value) })}
                      className="w-14 px-2 py-1.5 border border-slate-300 rounded text-sm text-center"
                    />
                    <span className="text-xs text-slate-500">d</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prior C-Section Count</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={form.previousCesareanCount ?? 0}
                    onChange={(e) => setForm({ ...form, previousCesareanCount: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm text-center font-bold text-rose-700"
                  />
                </div>
              </div>

              {/* Indication */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Indication *</label>
                  <select
                    value={form.indication}
                    onChange={(e) => setForm({ ...form, indication: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="post_dates">Post-Dates / Prolonged Pregnancy (&gt;=41w)</option>
                    <option value="preeclampsia_gest_htn">Preeclampsia / Gestational Hypertension</option>
                    <option value="prom_rom">Premature Rupture of Membranes (PROM)</option>
                    <option value="oligohydramnios">Oligohydramnios (AFI &lt; 5 cm or DVP &lt; 2 cm)</option>
                    <option value="fgr_placental">Fetal Growth Restriction (FGR / Placental Insufficiency)</option>
                    <option value="gdm_diabetes">Gestational Diabetes Mellitus (GDM / Pre-gestational)</option>
                    <option value="maternal_medical">Maternal Medical Disease (Renal / Cardiac / Cholestasis)</option>
                    <option value="elective_39w">Elective Induction (ARRIVE trial &gt;=39w nullipara)</option>
                    <option value="other">Other Clinical Indication</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Indication Details</label>
                  <input
                    type="text"
                    value={form.indicationDetails || ''}
                    placeholder="e.g. 41+3 weeks, AFI 4.2 cm, reassuring CTG category 1"
                    onChange={(e) => setForm({ ...form, indicationDetails: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Modified Bishop Score Optimizer Box */}
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-indigo-100 pb-2">
                  <div>
                    <h4 className="font-bold text-indigo-900 text-sm">
                      Modified Bishop Score Cervical Assessment
                    </h4>
                    <p className="text-xs text-indigo-700">
                      Standardized scoring (0–13 points) to direct mechanical vs pharmacological ripening.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-indigo-800">Calculated Score</div>
                      <div className="text-2xl font-black text-indigo-950">
                        {liveBishopResult.totalScore} <span className="text-sm font-normal text-indigo-600">/ 13</span>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        liveBishopResult.favorability === 'favorable_ge_8'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : liveBishopResult.favorability === 'intermediate_6_7'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {liveBishopResult.favorability.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* The 5 Bishop Criteria Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">1. Dilation (cm)</label>
                    <select
                      value={form.dilationCm}
                      onChange={(e) => setForm({ ...form, dilationCm: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value={0}>0 cm (Closed - 0 pts)</option>
                      <option value={1}>1-2 cm (1 pt)</option>
                      <option value={3}>3-4 cm (2 pts)</option>
                      <option value={5}>&gt;=5 cm (3 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">2. Effacement (%)</label>
                    <select
                      value={form.effacementPercent}
                      onChange={(e) => setForm({ ...form, effacementPercent: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value={0}>0-30% (0 pts)</option>
                      <option value={40}>40-50% (1 pt)</option>
                      <option value={60}>60-70% (2 pts)</option>
                      <option value={80}>&gt;=80% (3 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">3. Station (-3 to +3)</label>
                    <select
                      value={form.fetalStation}
                      onChange={(e) => setForm({ ...form, fetalStation: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value={-3}>-3 station (0 pts)</option>
                      <option value={-2}>-2 station (1 pt)</option>
                      <option value={-1}>-1 / 0 station (2 pts)</option>
                      <option value={1}>+1 / +2 station (3 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">4. Consistency</label>
                    <select
                      value={form.consistency}
                      onChange={(e) => setForm({ ...form, consistency: e.target.value as any })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="firm">Firm (0 pts)</option>
                      <option value="medium">Medium (1 pt)</option>
                      <option value="soft">Soft (2 pts)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">5. Position</label>
                    <select
                      value={form.position}
                      onChange={(e) => setForm({ ...form, position: e.target.value as any })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="posterior">Posterior (0 pts)</option>
                      <option value="mid">Mid-position (1 pt)</option>
                      <option value="anterior">Anterior (2 pts)</option>
                    </select>
                  </div>
                </div>

                {/* Clinical Ripening Recommendation Alert */}
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    (form.previousCesareanCount ?? 0) > 0
                      ? 'bg-rose-50 border border-rose-300 text-rose-900'
                      : 'bg-indigo-100/60 border border-indigo-200 text-indigo-950'
                  }`}
                >
                  <span className="font-bold text-sm">💡</span>
                  <div>
                    <div className="font-bold mb-0.5 capitalize">Recommended: {liveBishopResult.recommendedRipening.replace(/_/g, ' ')}</div>
                    <div>{liveBishopResult.ripeningRationale}</div>
                    {(form.previousCesareanCount ?? 0) > 0 && (
                      <div className="font-bold text-rose-700 mt-1">
                        ⚠️ WARNING: Prostaglandins (Dinoprostone &amp; Misoprostol) are contraindicated due to prior uterine scar. Only mechanical cervical ripening (Foley / Cook balloon) is permitted.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ripening Method & Regimen */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chosen Ripening Method *</label>
                  <select
                    value={form.ripeningMethod}
                    onChange={(e) => setForm({ ...form, ripeningMethod: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="foley_bulb_mechanical">Foley Catheter (Mechanical Ripening)</option>
                    <option value="cook_double_balloon">Cook Double-Balloon Catheter</option>
                    <option value="dinoprostone_pge2_tape" disabled={(form.previousCesareanCount ?? 0) > 0}>
                      Dinoprostone PGE2 Vaginal Tape 10 mg (Propess) {(form.previousCesareanCount ?? 0) > 0 ? '[Contraindicated in Scar]' : ''}
                    </option>
                    <option value="dinoprostone_pge2_gel" disabled={(form.previousCesareanCount ?? 0) > 0}>
                      Dinoprostone PGE2 Endocervical Gel 0.5 mg {(form.previousCesareanCount ?? 0) > 0 ? '[Contraindicated in Scar]' : ''}
                    </option>
                    <option value="misoprostol_pge1_oral" disabled={(form.previousCesareanCount ?? 0) > 0}>
                      Misoprostol PGE1 Oral Solution 25 mcg 2-hourly {(form.previousCesareanCount ?? 0) > 0 ? '[Contraindicated in Scar]' : ''}
                    </option>
                    <option value="misoprostol_pge1_vaginal" disabled={(form.previousCesareanCount ?? 0) > 0}>
                      Misoprostol PGE1 Vaginal Tablet 25 mcg 4-6 hourly {(form.previousCesareanCount ?? 0) > 0 ? '[Contraindicated in Scar]' : ''}
                    </option>
                    <option value="direct_arm_oxytocin">Direct Amniotomy (ARM) &amp; IV Oxytocin</option>
                    <option value="none">None / Spontaneous labor established</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ripening Details / Device Volume</label>
                  <input
                    type="text"
                    value={form.ripeningDoseDetails || ''}
                    placeholder="e.g. Foley 16Fr with 40 mL sterile water, taped to inner thigh with gentle traction"
                    onChange={(e) => setForm({ ...form, ripeningDoseDetails: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Oxytocin Regimen & Amniotomy (ARM) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="oxytocinUsed"
                      checked={form.oxytocinUsed}
                      onChange={(e) => setForm({ ...form, oxytocinUsed: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="oxytocinUsed" className="text-xs font-bold text-slate-800 cursor-pointer">
                      Oxytocin (Pitocin) IV Infusion Regimen
                    </label>
                  </div>
                  <span className="text-xs text-slate-500">
                    ACOG low-dose: 1–2 mU/min, increase by 1–2 mU/min q30m (Target: 3–4 contractions / 10m)
                  </span>
                </div>

                {form.oxytocinUsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={form.oxytocinStartTime || ''}
                        onChange={(e) => setForm({ ...form, oxytocinStartTime: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Start Rate (mU/min)</label>
                      <input
                        type="number"
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={form.oxytocinStartRateMUPerMin ?? 2}
                        onChange={(e) => setForm({ ...form, oxytocinStartRateMUPerMin: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Max Titrated Rate (mU/min)</label>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        step={1}
                        value={form.oxytocinMaxRateMUPerMin ?? 20}
                        onChange={(e) => setForm({ ...form, oxytocinMaxRateMUPerMin: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* ARM & Liquor */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="armPerformed"
                      checked={form.armPerformed}
                      onChange={(e) => setForm({ ...form, armPerformed: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="armPerformed" className="text-xs font-bold text-slate-800 cursor-pointer">
                      Amniotomy (ARM) Performed
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ARM Time</label>
                    <input
                      type="time"
                      disabled={!form.armPerformed}
                      value={form.armTime || ''}
                      onChange={(e) => setForm({ ...form, armTime: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Liquor Status</label>
                    <select
                      value={form.liquorStatus || 'clear'}
                      onChange={(e) => setForm({ ...form, liquorStatus: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    >
                      <option value="clear">Clear Amniotic Fluid</option>
                      <option value="meconium_grade_1">Meconium Grade 1 (Thin)</option>
                      <option value="meconium_grade_2">Meconium Grade 2 (Moderate)</option>
                      <option value="meconium_grade_3">Meconium Grade 3 (Thick Pea-soup)</option>
                      <option value="blood_stained">Blood Stained</option>
                    </select>
                  </div>
                </div>

                {/* Tachysystole / Hyperstimulation */}
                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tachysystoleDetected"
                      checked={form.tachysystoleDetected}
                      onChange={(e) => setForm({ ...form, tachysystoleDetected: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <label htmlFor="tachysystoleDetected" className="text-xs font-bold text-rose-700 cursor-pointer">
                      Uterine Tachysystole (&gt;5 contractions in 10 min over 30 min window)
                    </label>
                  </div>
                  {form.tachysystoleDetected && (
                    <input
                      type="text"
                      placeholder="Management: Discontinue oxytocin, left lateral, IV fluids, tocolysis (Terbutaline 0.25 mg SC)"
                      value={form.uterineHyperstimulationManagement || ''}
                      onChange={(e) => setForm({ ...form, uterineHyperstimulationManagement: e.target.value })}
                      className="flex-1 px-3 py-1 border border-rose-300 rounded text-xs bg-rose-50/50"
                    />
                  )}
                </div>
              </div>

              {/* Delivery Outcome & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Induction Outcome *</label>
                  <select
                    value={form.inductionOutcome}
                    onChange={(e) => setForm({ ...form, inductionOutcome: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm font-medium"
                  >
                    <option value="in_progress">Induction In Progress</option>
                    <option value="vaginal_delivery_spontaneous">Vaginal Delivery (Spontaneous)</option>
                    <option value="vaginal_delivery_vacuum_forceps">Instrumental Vaginal Delivery (Vacuum/Forceps)</option>
                    <option value="emergency_cesarean_failed_induction">Emergency Cesarean - Failed Induction</option>
                    <option value="emergency_cesarean_fetal_distress">Emergency Cesarean - Fetal Distress (NRFHR)</option>
                    <option value="emergency_cesarean_arrest_of_dilation">Emergency Cesarean - Arrest of Dilation</option>
                    <option value="cancelled_patient_request">Cancelled / Patient Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={form.deliveryDatetime || ''}
                    onChange={(e) => setForm({ ...form, deliveryDatetime: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Birth Weight (grams)</label>
                  <input
                    type="number"
                    min={400}
                    max={6500}
                    value={form.birthWeightGrams ?? ''}
                    placeholder="e.g. 3250"
                    onChange={(e) =>
                      setForm({ ...form, birthWeightGrams: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* APGAR & Reviewer */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">APGAR 1 min</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.apgar1Min ?? ''}
                    placeholder="e.g. 8"
                    onChange={(e) =>
                      setForm({ ...form, apgar1Min: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">APGAR 5 min</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.apgar5Min ?? ''}
                    placeholder="e.g. 9"
                    onChange={(e) =>
                      setForm({ ...form, apgar5Min: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Attending Obstetrician</label>
                  <input
                    type="text"
                    value={form.attendingObstetrician || ''}
                    onChange={(e) => setForm({ ...form, attendingObstetrician: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reviewed By Doctor *</label>
                  <select
                    required
                    value={form.reviewedBy}
                    onChange={(e) => setForm({ ...form, reviewedBy: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Induction Summary Notes</label>
                <textarea
                  rows={2}
                  value={form.inductionSummaryNotes || ''}
                  placeholder="Record labor progression, cervical check timing, analgesic requirements (epidural), or operative decision rationale..."
                  onChange={(e) => setForm({ ...form, inductionSummaryNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded text-sm font-medium text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Induction Record' : 'Save & Initiate Induction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
