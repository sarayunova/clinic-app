import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type EndometriosisEpisode,
  type UserRow,
  getEndometriosisEpisodes,
  createEndometriosisEpisode,
  updateEndometriosisEpisode,
  deleteEndometriosisEpisode,
} from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculateRasrmScore,
  buildEnzianCompositeCode,
  evaluateEndometriosis,
  type RasrmScoreInput,
  type EnzianInput,
  type VasPainScores,
} from '../endometriosisEngine';

interface Props {
  patient: Patient;
}

export function EndometriosisTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [episodes, setEpisodes] = useState<EndometriosisEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<EndometriosisEpisode>>({
    patientId: patient.id,
    assessmentDate: new Date().toISOString().substring(0, 10),
    indication: 'dysmenorrhea',
    surgicalApproach: 'laparoscopy',

    vasDysmenorrhea: 7,
    vasDyspareunia: 5,
    vasDyschezia: 3,
    vasDysuria: 1,
    vasChronicPelvicPain: 4,

    rasrmPeritonealSuperficialPts: 2,
    rasrmPeritonealDeepPts: 4,
    rasrmOvaryRightSuperficialPts: 0,
    rasrmOvaryRightDeepPts: 0,
    rasrmOvaryLeftSuperficialPts: 2,
    rasrmOvaryLeftDeepPts: 16,
    rasrmAdhesionsOvaryRightPts: 0,
    rasrmAdhesionsOvaryLeftPts: 4,
    rasrmAdhesionsTubeRightPts: 0,
    rasrmAdhesionsTubeLeftPts: 4,
    pouchOfDouglasObliteration: 'partial_4pts',

    enzianPeritoneum: 'P1',
    enzianOvaryLeft: 'O2',
    enzianOvaryRight: null,
    enzianTubeLeft: 'T1',
    enzianTubeRight: null,
    enzianCompartmentA: 'A1',
    enzianCompartmentB: 'B2',
    enzianCompartmentC: null,
    enzianExtragenitalF: null,
    enzianAdenomyosisFa: false,

    medicalManagementRegimen: 'Dienogest 2 mg daily orally with calcium & Vitamin D3',
    surgicalProcedurePerformed: 'Laparoscopic excision of deep infiltrating endometriosis and left ovarian cystectomy',
    fertilitySparing: true,
    postOpHormonalSuppression: 'GnRH analogue 3.75 mg monthly depot x 3 months followed by Dienogest',
    clinicalNotes: 'Pouch of Douglas partially obliterated. Complete excision achieved without bowel resection.',
    leadSurgeon: 'Gynecological Endoscopy Surgeon',
    reviewedBy: me?.id || 1,
  });

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEndometriosisEpisodes(patient.id);
      setEpisodes(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load endometriosis records');
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

  // Live Calculations
  const rasrmInput: RasrmScoreInput = {
    peritonealSuperficialPts: form.rasrmPeritonealSuperficialPts || 0,
    peritonealDeepPts: form.rasrmPeritonealDeepPts || 0,
    ovaryRightSuperficialPts: form.rasrmOvaryRightSuperficialPts || 0,
    ovaryRightDeepPts: form.rasrmOvaryRightDeepPts || 0,
    ovaryLeftSuperficialPts: form.rasrmOvaryLeftSuperficialPts || 0,
    ovaryLeftDeepPts: form.rasrmOvaryLeftDeepPts || 0,
    adhesionsOvaryRightPts: form.rasrmAdhesionsOvaryRightPts || 0,
    adhesionsOvaryLeftPts: form.rasrmAdhesionsOvaryLeftPts || 0,
    adhesionsTubeRightPts: form.rasrmAdhesionsTubeRightPts || 0,
    adhesionsTubeLeftPts: form.rasrmAdhesionsTubeLeftPts || 0,
    pouchOfDouglasObliteration: form.pouchOfDouglasObliteration || 'none',
  };
  const liveRasrm = calculateRasrmScore(rasrmInput);

  const enzianInput: EnzianInput = {
    peritoneum: form.enzianPeritoneum,
    ovaryRight: form.enzianOvaryRight,
    ovaryLeft: form.enzianOvaryLeft,
    tubeRight: form.enzianTubeRight,
    tubeLeft: form.enzianTubeLeft,
    compartmentA: form.enzianCompartmentA,
    compartmentB: form.enzianCompartmentB,
    compartmentC: form.enzianCompartmentC,
    extragenitalF: form.enzianExtragenitalF,
    adenomyosisFa: form.enzianAdenomyosisFa,
  };
  const liveEnzianCode = buildEnzianCompositeCode(enzianInput);

  const painInput: VasPainScores = {
    dysmenorrhea: form.vasDysmenorrhea || 0,
    dyspareunia: form.vasDyspareunia || 0,
    dyschezia: form.vasDyschezia || 0,
    dysuria: form.vasDysuria || 0,
    chronicPelvicPain: form.vasChronicPelvicPain || 0,
  };
  const liveEval = evaluateEndometriosis(rasrmInput, enzianInput, painInput);

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      patientId: patient.id,
      assessmentDate: new Date().toISOString().substring(0, 10),
      indication: 'dysmenorrhea',
      surgicalApproach: 'laparoscopy',
      vasDysmenorrhea: 6,
      vasDyspareunia: 4,
      vasDyschezia: 0,
      vasDysuria: 0,
      vasChronicPelvicPain: 3,
      rasrmPeritonealSuperficialPts: 2,
      rasrmPeritonealDeepPts: 2,
      rasrmOvaryRightSuperficialPts: 0,
      rasrmOvaryRightDeepPts: 0,
      rasrmOvaryLeftSuperficialPts: 0,
      rasrmOvaryLeftDeepPts: 0,
      rasrmAdhesionsOvaryRightPts: 0,
      rasrmAdhesionsOvaryLeftPts: 0,
      rasrmAdhesionsTubeRightPts: 0,
      rasrmAdhesionsTubeLeftPts: 0,
      pouchOfDouglasObliteration: 'none',
      enzianPeritoneum: 'P1',
      enzianOvaryLeft: null,
      enzianOvaryRight: null,
      enzianTubeLeft: null,
      enzianTubeRight: null,
      enzianCompartmentA: null,
      enzianCompartmentB: null,
      enzianCompartmentC: null,
      enzianExtragenitalF: null,
      enzianAdenomyosisFa: false,
      medicalManagementRegimen: 'Dienogest 2 mg daily orally',
      surgicalProcedurePerformed: 'Diagnostic laparoscopy with adhesiolysis',
      fertilitySparing: true,
      postOpHormonalSuppression: '',
      clinicalNotes: '',
      leadSurgeon: 'Gynecologist',
      reviewedBy: me?.id || 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (ep: EndometriosisEpisode) => {
    setEditingId(ep.id);
    setForm({
      ...ep,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this endometriosis staging record?')) {
      return;
    }
    try {
      await deleteEndometriosisEpisode(id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: Partial<EndometriosisEpisode> = {
        ...form,
        rasrmTotalScore: liveRasrm.totalScore,
        rasrmStage: liveRasrm.stage,
        enzianCompositeCode: liveEnzianCode,
      };

      if (editingId) {
        await updateEndometriosisEpisode(editingId, payload);
      } else {
        await createEndometriosisEpisode(payload);
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
            <span>🎗️</span> Endometriosis & Deep Infiltrating Endometriosis (DIE) Staging
          </h2>
          <p className="text-sm text-slate-500">
            rASRM anatomical score, #Enzian 2021 classification, VAS pain scoring, and surgical planning
          </p>
        </div>
        {(can('patient:write_clinical') || can('care:write_nursing')) && (
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow transition flex items-center gap-2"
          >
            <span>+</span> Record Staging Episode
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Episode List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading staging records...</div>
      ) : episodes.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No endometriosis staging records logged for this patient yet.
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
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      ep.rasrmStage === 'stage_4_severe'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : ep.rasrmStage === 'stage_3_moderate'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : ep.rasrmStage === 'stage_2_mild'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    rASRM {ep.rasrmStage.toUpperCase().replace('_', ' ')} ({ep.rasrmTotalScore} pts)
                  </span>
                  <span className="bg-purple-100 text-purple-900 text-xs px-2.5 py-0.5 rounded font-mono font-medium">
                    #Enzian: {ep.enzianCompositeCode || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/patients/${patient.id}/endometriosis/${ep.id}/print`}
                    target="_blank"
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-300 flex items-center gap-1"
                  >
                    <span>🖨️</span> Operative Dossier
                  </Link>
                  {(can('patient:write_clinical') || can('care:write_nursing')) && (
                    <button
                      onClick={() => handleOpenEdit(ep)}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium rounded border border-indigo-200"
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

              {/* Episode Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block">Indication & Approach</span>
                  <span className="font-medium text-slate-800 capitalize">
                    {ep.indication.replace(/_/g, ' ')} ({ep.surgicalApproach})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">VAS Pain Scores (0–10)</span>
                  <span className="font-medium text-slate-800">
                    Dysmenorrhea: {ep.vasDysmenorrhea} | Dyspareunia: {ep.vasDyspareunia} | Dyschezia: {ep.vasDyschezia}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Medical Management</span>
                  <span className="font-medium text-slate-800 truncate block">
                    {ep.medicalManagementRegimen || 'None specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Surgeon & Clinician</span>
                  <span className="font-medium text-slate-800">
                    {ep.leadSurgeon || '—'} (Rev: {ep.reviewedByName || 'Staff'})
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Staging & Surgery Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  {editingId ? 'Edit Endometriosis Staging' : 'Record New Endometriosis Staging'}
                </h3>
                <p className="text-xs text-slate-500">
                  Comprehensive rASRM point calculator, #Enzian 2021 compartments, and pain profile
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
              {/* Baseline Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
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
                  <label className="block font-medium text-slate-700 mb-1">Clinical Indication *</label>
                  <select
                    value={form.indication || 'dysmenorrhea'}
                    onChange={(e) => setForm({ ...form, indication: e.target.value as any })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="chronic_pelvic_pain">Chronic Pelvic Pain</option>
                    <option value="dysmenorrhea">Severe Dysmenorrhea</option>
                    <option value="deep_dyspareunia">Deep Dyspareunia</option>
                    <option value="infertility_workup">Infertility / Subfertility Workup</option>
                    <option value="adnexal_mass_endometrioma">Adnexal Mass / Endometrioma</option>
                    <option value="surgical_follow_up">Post-Surgical Follow-up</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Approach *</label>
                  <select
                    value={form.surgicalApproach || 'laparoscopy'}
                    onChange={(e) => setForm({ ...form, surgicalApproach: e.target.value as any })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="laparoscopy">Laparoscopy (Gold Standard)</option>
                    <option value="robotic">Robotic-Assisted Laparoscopy</option>
                    <option value="laparotomy">Laparotomy</option>
                    <option value="clinical_imaging_only">Clinical & High-Resolution MRI / TVS</option>
                  </select>
                </div>
              </div>

              {/* VAS Pain Assessment (0-10) */}
              <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-lg">
                <h4 className="font-semibold text-amber-900 text-sm mb-2 flex items-center justify-between">
                  <span>Visual Analogue Scale (VAS) Pain Severity (0–10)</span>
                  <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-medium capitalize">
                    {liveEval.painSeverityTier} Pain Profile
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 mb-1">Dysmenorrhea (0–10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form.vasDysmenorrhea ?? 0}
                      onChange={(e) => setForm({ ...form, vasDysmenorrhea: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">Dyspareunia (0–10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form.vasDyspareunia ?? 0}
                      onChange={(e) => setForm({ ...form, vasDyspareunia: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">Dyschezia (0–10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form.vasDyschezia ?? 0}
                      onChange={(e) => setForm({ ...form, vasDyschezia: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">Dysuria (0–10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form.vasDysuria ?? 0}
                      onChange={(e) => setForm({ ...form, vasDysuria: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">Chronic Pain (0–10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form.vasChronicPelvicPain ?? 0}
                      onChange={(e) => setForm({ ...form, vasChronicPelvicPain: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* rASRM Point Scoring Grid */}
              <div className="bg-indigo-50/50 border border-indigo-200 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-indigo-950 text-sm">
                    rASRM Staging Points Calculator (Revised ASRM)
                  </h4>
                  <div className="text-right">
                    <span className="text-xs text-indigo-800 font-semibold mr-2">
                      Total: {liveRasrm.totalScore} pts
                    </span>
                    <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded font-bold">
                      {liveRasrm.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 mb-1">Peritoneum Superficial (pts)</label>
                    <select
                      value={form.rasrmPeritonealSuperficialPts ?? 0}
                      onChange={(e) => setForm({ ...form, rasrmPeritonealSuperficialPts: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value={0}>0 - None</option>
                      <option value={1}>1 - &lt; 1 cm</option>
                      <option value={2}>2 - 1 to 3 cm</option>
                      <option value={4}>4 - &gt; 3 cm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">Peritoneum Deep (pts)</label>
                    <select
                      value={form.rasrmPeritonealDeepPts ?? 0}
                      onChange={(e) => setForm({ ...form, rasrmPeritonealDeepPts: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value={0}>0 - None</option>
                      <option value={2}>2 - &lt; 1 cm</option>
                      <option value={4}>4 - 1 to 3 cm</option>
                      <option value={6}>6 - &gt; 3 cm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">R Ovary Superficial (pts)</label>
                    <select
                      value={form.rasrmOvaryRightSuperficialPts ?? 0}
                      onChange={(e) => setForm({ ...form, rasrmOvaryRightSuperficialPts: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value={0}>0 - None</option>
                      <option value={1}>1 - &lt; 1 cm</option>
                      <option value={2}>2 - 1 to 3 cm</option>
                      <option value={4}>4 - &gt; 3 cm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">R Ovary Deep / Cyst (pts)</label>
                    <select
                      value={form.rasrmOvaryRightDeepPts ?? 0}
                      onChange={(e) => setForm({ ...form, rasrmOvaryRightDeepPts: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value={0}>0 - None</option>
                      <option value={4}>4 - &lt; 1 cm</option>
                      <option value={16}>16 - 1 to 3 cm</option>
                      <option value={20}>20 - &gt; 3 cm</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">L Ovary Superficial (pts)</label>
                    <select
                      value={form.rasrmOvaryLeftSuperficialPts ?? 0}
                      onChange={(e) => setForm({ ...form, rasrmOvaryLeftSuperficialPts: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value={0}>0 - None</option>
                      <option value={1}>1 - &lt; 1 cm</option>
                      <option value={2}>2 - 1 to 3 cm</option>
                      <option value={4}>4 - &gt; 3 cm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">L Ovary Deep / Cyst (pts)</label>
                    <select
                      value={form.rasrmOvaryLeftDeepPts ?? 0}
                      onChange={(e) => setForm({ ...form, rasrmOvaryLeftDeepPts: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value={0}>0 - None</option>
                      <option value={4}>4 - &lt; 1 cm</option>
                      <option value={16}>16 - 1 to 3 cm</option>
                      <option value={20}>20 - &gt; 3 cm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">Ovarian Adhesions (R/L)</label>
                    <div className="flex gap-1">
                      <select
                        value={form.rasrmAdhesionsOvaryRightPts ?? 0}
                        onChange={(e) => setForm({ ...form, rasrmAdhesionsOvaryRightPts: Number(e.target.value) })}
                        className="w-1/2 border border-slate-300 rounded p-1.5 bg-white"
                        title="Right Ovary Adhesions"
                      >
                        <option value={0}>R: 0</option>
                        <option value={2}>R: 2 (filmy)</option>
                        <option value={8}>R: 8 (dense)</option>
                        <option value={16}>R: 16 (extensive)</option>
                      </select>
                      <select
                        value={form.rasrmAdhesionsOvaryLeftPts ?? 0}
                        onChange={(e) => setForm({ ...form, rasrmAdhesionsOvaryLeftPts: Number(e.target.value) })}
                        className="w-1/2 border border-slate-300 rounded p-1.5 bg-white"
                        title="Left Ovary Adhesions"
                      >
                        <option value={0}>L: 0</option>
                        <option value={2}>L: 2 (filmy)</option>
                        <option value={8}>L: 8 (dense)</option>
                        <option value={16}>L: 16 (extensive)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">Pouch of Douglas (POD)</label>
                    <select
                      value={form.pouchOfDouglasObliteration || 'none'}
                      onChange={(e) => setForm({ ...form, pouchOfDouglasObliteration: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white font-medium"
                    >
                      <option value="none">None (0 pts)</option>
                      <option value="partial_4pts">Partial obliteration (4 pts)</option>
                      <option value="complete_40pts">Complete obliteration (40 pts - Stage IV)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* #Enzian 2021 DIE Classification */}
              <div className="bg-purple-50/50 border border-purple-200 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-purple-950 text-sm">
                    #Enzian 2021 Deep Infiltrating Endometriosis (DIE) Classification
                  </h4>
                  <div className="text-right">
                    <span className="bg-purple-700 text-white text-xs px-2.5 py-1 rounded font-mono font-bold">
                      {liveEnzianCode}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 mb-1">
                      Compartment A (Vagina / RV Space)
                    </label>
                    <select
                      value={form.enzianCompartmentA || ''}
                      onChange={(e) => setForm({ ...form, enzianCompartmentA: e.target.value || null })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value="">A0 - No lesion</option>
                      <option value="A1">A1 - Lesion &lt; 1 cm</option>
                      <option value="A2">A2 - Lesion 1 to 3 cm</option>
                      <option value="A3">A3 - Lesion &gt; 3 cm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">
                      Compartment B (USL / Parametrium)
                    </label>
                    <select
                      value={form.enzianCompartmentB || ''}
                      onChange={(e) => setForm({ ...form, enzianCompartmentB: e.target.value || null })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value="">B0 - No lesion</option>
                      <option value="B1">B1 - Lesion &lt; 1 cm</option>
                      <option value="B2">B2 - Lesion 1 to 3 cm</option>
                      <option value="B3">B3 - Lesion &gt; 3 cm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">
                      Compartment C (Rectum / Sigmoid)
                    </label>
                    <select
                      value={form.enzianCompartmentC || ''}
                      onChange={(e) => setForm({ ...form, enzianCompartmentC: e.target.value || null })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value="">C0 - No lesion</option>
                      <option value="C1">C1 - Lesion &lt; 1 cm</option>
                      <option value="C2">C2 - Lesion 1 to 3 cm</option>
                      <option value="C3">C3 - Lesion &gt; 3 cm</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Extragenital (FB, FU, FI)</label>
                    <input
                      type="text"
                      placeholder="e.g. FB (bladder), FU (ureter), FI (bowel)"
                      value={form.enzianExtragenitalF || ''}
                      onChange={(e) => setForm({ ...form, enzianExtragenitalF: e.target.value || null })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="adenomyosisFa"
                      checked={Boolean(form.enzianAdenomyosisFa)}
                      onChange={(e) => setForm({ ...form, enzianAdenomyosisFa: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                    <label htmlFor="adenomyosisFa" className="text-slate-800 font-medium">
                      FA - Adenomyosis Coexisting
                    </label>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="fertilitySparing"
                      checked={Boolean(form.fertilitySparing)}
                      onChange={(e) => setForm({ ...form, fertilitySparing: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <label htmlFor="fertilitySparing" className="text-slate-800 font-medium">
                      Fertility Sparing Intent
                    </label>
                  </div>
                </div>
              </div>

              {/* Management Plan & Notes */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Medical Management Regimen (First-line / Hormonal)
                  </label>
                  <input
                    type="text"
                    value={form.medicalManagementRegimen || ''}
                    onChange={(e) => setForm({ ...form, medicalManagementRegimen: e.target.value })}
                    placeholder="e.g. Dienogest 2mg daily, LNG-IUS 52mg, GnRH analogue depot"
                    className="w-full border border-slate-300 rounded p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Surgical Procedure Performed / Operative Findings
                  </label>
                  <textarea
                    rows={2}
                    value={form.surgicalProcedurePerformed || ''}
                    onChange={(e) => setForm({ ...form, surgicalProcedurePerformed: e.target.value })}
                    placeholder="e.g. Laparoscopic cystectomy, peritoneal lesion excision, ureterolysis, shaving of rectal nodule"
                    className="w-full border border-slate-300 rounded p-2 bg-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Lead Surgeon</label>
                    <input
                      type="text"
                      value={form.leadSurgeon || ''}
                      onChange={(e) => setForm({ ...form, leadSurgeon: e.target.value })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Reviewing Clinician *</label>
                    <select
                      value={form.reviewedBy || me?.id || 1}
                      onChange={(e) => setForm({ ...form, reviewedBy: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-xs shadow disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Record' : 'Save Staging Episode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
