import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type UrogynecologyEpisode,
  type UserRow,
  getUrogynEpisodes,
  createUrogynEpisode,
  updateUrogynEpisode,
  deleteUrogynEpisode,
} from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculatePopqStage,
  type PopqGridInput,
  type PopqCalculationResult,
} from '../urogynecologyEngine';

interface Props {
  patient: Patient;
}

export function UrogynecologyTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [episodes, setEpisodes] = useState<UrogynecologyEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<UrogynecologyEpisode>>({
    patientId: patient.id,
    assessmentDate: new Date().toISOString().substring(0, 10),
    parity: 'P3+0',
    menopausalStatus: 'postmenopausal',

    popqAaCm: +1.0,
    popqBaCm: +3.0,
    popqCCm: -1.0,
    popqGhCm: 4.5,
    popqPbCm: 2.5,
    popqTvlCm: 9.0,
    popqApCm: -2.0,
    popqBpCm: -1.0,
    popqDCm: -5.0,

    urinaryIncontinenceType: 'mixed_mui',
    padCountPerDay: 2,
    bladderDiaryDayFrequency: 8,
    bladderDiaryNocturia: 3,
    leakEpisodes24h: 3,
    botherScoreIciqSf: 14,

    pessaryManagement: 'fitted_ring',
    pessarySizeMm: 70,
    pessaryChangeIntervalWeeks: 12,
    pelvicFloorPhysiotherapy: true,
    surgicalProcedurePlanned: 'Anterior colporrhaphy + Midurethral sling (TOT)',
    clinicalNotes: 'Stage III anterior prolapse (cystocele) with mixed urinary incontinence. Trial of size 70mm ring pessary initiated.',

    performedBy: 'Urogynecologist',
    reviewedBy: me?.id || 1,
  });

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUrogynEpisodes(patient.id);
      setEpisodes(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load urogynecology records');
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

  // Live POP-Q Calculation
  const gridInput: PopqGridInput = {
    aa: form.popqAaCm ?? -3,
    ba: form.popqBaCm ?? -3,
    c: form.popqCCm ?? -7,
    gh: form.popqGhCm ?? 3.5,
    pb: form.popqPbCm ?? 3.0,
    tvl: form.popqTvlCm ?? 9.0,
    ap: form.popqApCm ?? -3,
    bp: form.popqBpCm ?? -3,
    d: form.popqDCm ?? null,
  };
  const liveCalc: PopqCalculationResult = calculatePopqStage(gridInput);

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      patientId: patient.id,
      assessmentDate: new Date().toISOString().substring(0, 10),
      parity: 'P2+0',
      menopausalStatus: 'postmenopausal',
      popqAaCm: -1.0,
      popqBaCm: +1.0,
      popqCCm: -5.0,
      popqGhCm: 4.0,
      popqPbCm: 3.0,
      popqTvlCm: 9.0,
      popqApCm: -2.0,
      popqBpCm: -2.0,
      popqDCm: -7.0,
      urinaryIncontinenceType: 'stress_sui',
      padCountPerDay: 1,
      bladderDiaryDayFrequency: 6,
      bladderDiaryNocturia: 1,
      leakEpisodes24h: 1,
      botherScoreIciqSf: 9,
      pessaryManagement: 'none',
      pessarySizeMm: undefined,
      pessaryChangeIntervalWeeks: undefined,
      pelvicFloorPhysiotherapy: true,
      surgicalProcedurePlanned: '',
      clinicalNotes: '',
      performedBy: 'Urogynecologist',
      reviewedBy: me?.id || 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (ep: UrogynecologyEpisode) => {
    setEditingId(ep.id);
    setForm({ ...ep });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this urogynecology POP-Q record?')) {
      return;
    }
    try {
      await deleteUrogynEpisode(id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: Partial<UrogynecologyEpisode> = {
        ...form,
        popqStage: liveCalc.stage,
        leadingCompartment: liveCalc.leadingCompartment,
        leadingEdgeDistanceCm: liveCalc.leadingEdgeDistanceCm,
      };

      if (editingId) {
        await updateUrogynEpisode(editingId, payload);
      } else {
        await createUrogynEpisode(payload);
      }
      setShowModal(false);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>🌸</span> Urogynecology & POP-Q Pelvic Floor Dysfunction Registry
          </h2>
          <p className="text-sm text-slate-500">
            Standardized 9-point POP-Q grid, Stage 0–IV automated staging, incontinence stratification, and pessary registry
          </p>
        </div>
        {(can('patient:write_clinical') || can('care:write_nursing')) && (
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow transition flex items-center gap-2"
          >
            <span>+</span> New POP-Q Examination
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Episodes List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading urogynecology records...</div>
      ) : episodes.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No urogynecology or POP-Q assessments recorded for this patient yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900">{ep.assessmentDate}</span>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                      ep.popqStage === 'stage_4'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : ep.popqStage === 'stage_3'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : ep.popqStage === 'stage_2'
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                        : ep.popqStage === 'stage_1'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    POP-Q {ep.popqStage.toUpperCase().replace('_', ' ')}
                  </span>
                  <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded font-medium">
                    Leading Edge: {ep.leadingEdgeDistanceCm > 0 ? `+${ep.leadingEdgeDistanceCm}` : ep.leadingEdgeDistanceCm} cm ({ep.leadingCompartment.replace(/_/g, ' ')})
                  </span>
                  {ep.pessaryManagement !== 'none' && (
                    <span className="bg-teal-100 text-teal-800 text-xs px-2.5 py-0.5 rounded font-medium">
                      Pessary: {ep.pessaryManagement.replace(/_/g, ' ')} ({ep.pessarySizeMm}mm)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/patients/${patient.id}/urogynecology/${ep.id}/print`}
                    target="_blank"
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-300 flex items-center gap-1"
                  >
                    <span>🖨️</span> POP-Q Report
                  </Link>
                  {(can('patient:write_clinical') || can('care:write_nursing')) && (
                    <button
                      onClick={() => handleOpenEdit(ep)}
                      className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium rounded border border-emerald-200"
                    >
                      Edit
                    </button>
                  )}
                  {can('patient:write_clinical') && (
                    <button
                      onClick={() => handleDelete(ep.id)}
                      className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded border border-rose-200"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* 3x3 POP-Q Grid Display Mini & Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3 text-xs text-slate-600">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 font-mono">
                  <div className="grid grid-cols-3 text-center border-b border-slate-200 pb-1 mb-1 font-bold">
                    <span>{ep.popqAaCm > 0 ? `+${ep.popqAaCm}` : ep.popqAaCm}</span>
                    <span>{ep.popqBaCm > 0 ? `+${ep.popqBaCm}` : ep.popqBaCm}</span>
                    <span>{ep.popqCCm > 0 ? `+${ep.popqCCm}` : ep.popqCCm}</span>
                  </div>
                  <div className="grid grid-cols-3 text-center border-b border-slate-200 pb-1 mb-1 text-slate-500">
                    <span>{ep.popqGhCm}</span>
                    <span>{ep.popqPbCm}</span>
                    <span>{ep.popqTvlCm}</span>
                  </div>
                  <div className="grid grid-cols-3 text-center font-bold">
                    <span>{ep.popqApCm > 0 ? `+${ep.popqApCm}` : ep.popqApCm}</span>
                    <span>{ep.popqBpCm > 0 ? `+${ep.popqBpCm}` : ep.popqBpCm}</span>
                    <span>{ep.popqDCm !== null && ep.popqDCm !== undefined ? (ep.popqDCm > 0 ? `+${ep.popqDCm}` : ep.popqDCm) : '—'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block">Incontinence Profile</span>
                  <span className="font-medium text-slate-800 capitalize block">
                    {ep.urinaryIncontinenceType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Pads/day: {ep.padCountPerDay} | ICIQ-SF: {ep.botherScoreIciqSf ?? 'N/A'}/21
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">Plan / Reconstruction</span>
                  <span className="font-medium text-slate-800 truncate block">
                    {ep.surgicalProcedurePlanned || (ep.pessaryManagement !== 'none' ? 'Conservative pessary management' : 'Pelvic floor physiotherapy')}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    PFMT / Physio: {ep.pelvicFloorPhysiotherapy ? 'Active' : 'Not started'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">Examiner</span>
                  <span className="font-medium text-slate-800 block">
                    {ep.performedBy || '—'}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Rev: {ep.reviewedByName || 'Staff'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POP-Q Examination Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  {editingId ? 'Edit POP-Q Assessment' : 'New POP-Q Pelvic Floor Examination'}
                </h3>
                <p className="text-xs text-slate-500">
                  Enter standardized 9 points (in cm relative to hymenal ring: - above, + below)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Patient Profile Header */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Assessment Date *</label>
                  <input
                    type="date"
                    required
                    value={form.assessmentDate || ''}
                    onChange={(e) => setForm({ ...form, assessmentDate: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Parity</label>
                  <input
                    type="text"
                    placeholder="e.g. G3P3, P2+1"
                    value={form.parity || ''}
                    onChange={(e) => setForm({ ...form, parity: e.target.value })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Menopausal Status *</label>
                  <select
                    value={form.menopausalStatus || 'postmenopausal'}
                    onChange={(e) => setForm({ ...form, menopausalStatus: e.target.value as any })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white capitalize"
                  >
                    <option value="premenopausal">Premenopausal</option>
                    <option value="perimenopausal">Perimenopausal</option>
                    <option value="postmenopausal">Postmenopausal</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Examiner</label>
                  <input
                    type="text"
                    value={form.performedBy || ''}
                    onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
                    placeholder="Clinician name"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>

              {/* Standard 3x3 POP-Q Grid Editor & Live Staging */}
              <div className="bg-emerald-50/60 border border-emerald-200 p-5 rounded-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                  <div>
                    <h4 className="font-bold text-emerald-950 text-sm">
                      Standardized 3 × 3 POP-Q Examination Grid (cm)
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      Distances relative to hymen (- proximal/inside, + distal/outside hymen). gh, pb, tvl are lengths.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-3 py-1 bg-emerald-700 text-white rounded-lg shadow-xs">
                      {liveCalc.stageLabel}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-emerald-300 shadow-inner max-w-xl mx-auto">
                  {/* Row 1: Aa, Ba, C */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      Point Aa (-3 to +3)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={-3}
                      max={3}
                      required
                      value={form.popqAaCm ?? -3}
                      onChange={(e) => setForm({ ...form, popqAaCm: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-amber-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">Ant wall 3cm</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      Point Ba (-3 to +tvl)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={-3}
                      max={20}
                      required
                      value={form.popqBaCm ?? -3}
                      onChange={(e) => setForm({ ...form, popqBaCm: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-amber-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">Max ant wall</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      Point C (-tvl to +tvl)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={-20}
                      max={20}
                      required
                      value={form.popqCCm ?? -7}
                      onChange={(e) => setForm({ ...form, popqCCm: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-purple-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">Cervix / Cuff</span>
                  </div>

                  {/* Row 2: gh, pb, tvl */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      gh (Genital Hiatus)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0.5}
                      max={15}
                      required
                      value={form.popqGhCm ?? 3.5}
                      onChange={(e) => setForm({ ...form, popqGhCm: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-slate-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">Meatus to pb</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      pb (Perineal Body)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0.5}
                      max={15}
                      required
                      value={form.popqPbCm ?? 3.0}
                      onChange={(e) => setForm({ ...form, popqPbCm: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-slate-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">pb to mid-anus</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      tvl (Total Vaginal Len)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={2}
                      max={20}
                      required
                      value={form.popqTvlCm ?? 9.0}
                      onChange={(e) => setForm({ ...form, popqTvlCm: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-slate-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">Total length</span>
                  </div>

                  {/* Row 3: Ap, Bp, D */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      Point Ap (-3 to +3)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={-3}
                      max={3}
                      required
                      value={form.popqApCm ?? -3}
                      onChange={(e) => setForm({ ...form, popqApCm: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-blue-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">Post wall 3cm</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      Point Bp (-3 to +tvl)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={-3}
                      max={20}
                      required
                      value={form.popqBpCm ?? -3}
                      onChange={(e) => setForm({ ...form, popqBpCm: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-blue-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">Max post wall</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                      Point D (Post fornix)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={-20}
                      max={20}
                      value={form.popqDCm ?? ''}
                      onChange={(e) => setForm({ ...form, popqDCm: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="Blank if hyst"
                      className="w-full border border-slate-300 rounded p-2 text-center font-bold text-base bg-purple-50"
                    />
                    <span className="block text-[10px] text-slate-400 text-center mt-0.5">Omit if hysterectomy</span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-emerald-900 bg-emerald-100/60 p-2.5 rounded border border-emerald-200">
                  <strong>Clinical Assessment:</strong> {liveCalc.compartmentSummary}
                </div>
              </div>

              {/* Urinary Incontinence & Bladder Diary */}
              <div className="bg-sky-50/50 border border-sky-200 p-4 rounded-lg">
                <h4 className="font-semibold text-sky-950 text-sm mb-3">
                  Urinary Incontinence & Bladder Diary Metrics
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Incontinence Type *</label>
                    <select
                      value={form.urinaryIncontinenceType || 'none'}
                      onChange={(e) => setForm({ ...form, urinaryIncontinenceType: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value="none">None / Continent</option>
                      <option value="stress_sui">Stress Urinary Incontinence (SUI)</option>
                      <option value="urge_uui">Urgency Incontinence / OAB (UUI)</option>
                      <option value="mixed_mui">Mixed Incontinence (MUI)</option>
                      <option value="overflow">Overflow Incontinence</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Daily Pad Count</label>
                    <input
                      type="number"
                      min={0}
                      value={form.padCountPerDay ?? 0}
                      onChange={(e) => setForm({ ...form, padCountPerDay: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">ICIQ-SF Bother Score (0–21)</label>
                    <input
                      type="number"
                      min={0}
                      max={21}
                      placeholder="0 to 21"
                      value={form.botherScoreIciqSf ?? ''}
                      onChange={(e) => setForm({ ...form, botherScoreIciqSf: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Daytime Frequency / 24h</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g. 7"
                      value={form.bladderDiaryDayFrequency ?? ''}
                      onChange={(e) => setForm({ ...form, bladderDiaryDayFrequency: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Nocturia Episodes</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g. 2"
                      value={form.bladderDiaryNocturia ?? ''}
                      onChange={(e) => setForm({ ...form, bladderDiaryNocturia: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Leak Episodes / 24h</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g. 3"
                      value={form.leakEpisodes24h ?? ''}
                      onChange={(e) => setForm({ ...form, leakEpisodes24h: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Pessary & Surgical Management */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <h4 className="font-semibold text-slate-800 text-sm mb-3">
                  Management Pathway (Pessary vs Surgical Reconstruction)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Pessary Status</label>
                    <select
                      value={form.pessaryManagement || 'none'}
                      onChange={(e) => setForm({ ...form, pessaryManagement: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value="none">None</option>
                      <option value="fitted_ring">Fitted Ring Pessary</option>
                      <option value="fitted_gellhorn">Fitted Gellhorn Pessary</option>
                      <option value="fitted_cube">Fitted Cube Pessary</option>
                      <option value="pessary_declined">Patient Declined Pessary</option>
                      <option value="pessary_failed">Pessary Trial Failed / Extrusion</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Pessary Size (mm)</label>
                    <input
                      type="number"
                      min={30}
                      max={120}
                      placeholder="e.g. 65, 70, 75"
                      value={form.pessarySizeMm ?? ''}
                      onChange={(e) => setForm({ ...form, pessarySizeMm: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Follow-up / Change (weeks)</label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      placeholder="e.g. 12"
                      value={form.pessaryChangeIntervalWeeks ?? ''}
                      onChange={(e) => setForm({ ...form, pessaryChangeIntervalWeeks: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">
                      Surgical Procedure Planned (if indicated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Laparoscopic Sacrocolpopexy, Anterior colporrhaphy, Midurethral sling"
                      value={form.surgicalProcedurePlanned || ''}
                      onChange={(e) => setForm({ ...form, surgicalProcedurePlanned: e.target.value })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="pelvicFloorPhysiotherapy"
                      checked={Boolean(form.pelvicFloorPhysiotherapy)}
                      onChange={(e) => setForm({ ...form, pelvicFloorPhysiotherapy: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <label htmlFor="pelvicFloorPhysiotherapy" className="text-slate-800 font-medium text-xs">
                      Pelvic Floor Muscle Training (PFMT) Prescribed
                    </label>
                  </div>
                </div>

                <div className="mt-3 text-xs">
                  <label className="block font-medium text-slate-700 mb-1">Clinical Notes & Follow-up Plan</label>
                  <textarea
                    rows={2}
                    value={form.clinicalNotes || ''}
                    onChange={(e) => setForm({ ...form, clinicalNotes: e.target.value })}
                    placeholder="Enter examination notes, counseling, or surgical clearance details..."
                    className="w-full border border-slate-300 rounded p-2 bg-white"
                  />
                </div>

                <div className="mt-3 text-xs">
                  <label className="block font-medium text-slate-700 mb-1">Reviewing Clinician *</label>
                  <select
                    value={form.reviewedBy || me?.id || 1}
                    onChange={(e) => setForm({ ...form, reviewedBy: Number(e.target.value) })}
                    className="w-full sm:w-1/2 border border-slate-300 rounded p-1.5 bg-white"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs shadow disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Record' : 'Save POP-Q Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
