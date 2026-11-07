import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type GynOncologyEpisode,
  type UserRow,
  getGynOncologyEpisodes,
  createGynOncologyEpisode,
  updateGynOncologyEpisode,
  deleteGynOncologyEpisode,
} from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculateRmi1,
  evaluateIotaSimpleRules,
  evaluatePmbEndometrialThickness,
  type RmiCalculationInput,
  type IotaRulesInput,
} from '../gynOncologyEngine';

interface Props {
  patient: Patient;
}

export function GynOncologyTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [episodes, setEpisodes] = useState<GynOncologyEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<GynOncologyEpisode>>({
    patientId: patient.id,
    assessmentDate: new Date().toISOString().substring(0, 10),
    clinicalIndication: 'adnexal_mass',
    menopausalStatus: 'postmenopausal',

    ca125LevelUml: 185.0,
    he4PmolL: 95.0,
    romaScorePercent: 42.5,

    lesionMaxDiameterMm: 68.0,
    proportionSolidTissuePercent: 35.0,
    papillaryProjectionsCount: 2,
    acousticShadowsPresent: false,
    ascitesPresent: true,
    bilateralLesions: true,
    multilocularCysts: true,
    colorDopplerScore: 3,

    endometrialThicknessMm: 6.5,
    endometrialBiopsyDone: false,
    endometrialHistology: '',

    cervicalLesionVisible: false,
    figoClinicalStage: 'FIGO Stage IC2 suspected',

    multidisciplinaryTumorBoardStatus: 'pending_board_review',
    managementPlan: 'Urgent CT abdomen & pelvis with IV contrast. MDT discussion for primary debulking laparotomy vs neoadjuvant chemotherapy.',
    surgicalStagingDetails: 'Total abdominal hysterectomy, bilateral salpingo-oophorectomy, infragastric omentectomy, peritoneal washings.',
    clinicalNotes: 'Ascites identified on ultrasound with bilateral multilocular-solid ovarian masses. CA-125 elevated.',

    gynOncologistName: 'Consultant Gynecological Oncologist',
    reviewedBy: me?.id || 1,
  });

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGynOncologyEpisodes(patient.id);
      setEpisodes(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load oncology records');
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

  // Live RMI Calculation
  const isPost = form.menopausalStatus === 'postmenopausal';
  const rmiInput: RmiCalculationInput = {
    ca125LevelUml: form.ca125LevelUml ?? 0,
    isPostmenopausal: isPost,
    multilocularCysts: Boolean(form.multilocularCysts),
    solidAreasPresent: (form.proportionSolidTissuePercent ?? 0) > 0,
    bilateralLesions: Boolean(form.bilateralLesions),
    ascitesPresent: Boolean(form.ascitesPresent),
    metastasesPresent: false,
  };
  const liveRmi = calculateRmi1(rmiInput);

  // Live IOTA Simple Rules Evaluation
  const iotaInput: IotaRulesInput = {
    b1Unilocular: !form.multilocularCysts && (form.proportionSolidTissuePercent ?? 0) === 0,
    b2SolidLargestLt7mm: false,
    b3AcousticShadows: Boolean(form.acousticShadowsPresent),
    b4SmoothMultilocularLt100mm: Boolean(form.multilocularCysts) && (form.lesionMaxDiameterMm ?? 0) < 100,
    b5NoBloodFlowScore1: (form.colorDopplerScore ?? 1) === 1,
    m1IrregularSolid: (form.proportionSolidTissuePercent ?? 0) > 50,
    m2Ascites: Boolean(form.ascitesPresent),
    m3AtLeast4PapillaryStructures: (form.papillaryProjectionsCount ?? 0) >= 4,
    m4IrregularMultilocularSolidGe100mm: Boolean(form.multilocularCysts) && (form.lesionMaxDiameterMm ?? 0) >= 100,
    m5VeryStrongBloodFlowScore4: (form.colorDopplerScore ?? 1) === 4,
  };
  const liveIota = evaluateIotaSimpleRules(iotaInput);

  // Live PMB Thickness Check
  const livePmb = evaluatePmbEndometrialThickness({
    isPostmenopausal: isPost,
    hasPostmenopausalBleeding: form.clinicalIndication === 'postmenopausal_bleeding',
    endometrialThicknessMm: form.endometrialThicknessMm ?? 0,
  });

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      patientId: patient.id,
      assessmentDate: new Date().toISOString().substring(0, 10),
      clinicalIndication: 'adnexal_mass',
      menopausalStatus: 'premenopausal',
      ca125LevelUml: 22.0,
      he4PmolL: undefined,
      romaScorePercent: undefined,
      lesionMaxDiameterMm: 45.0,
      proportionSolidTissuePercent: 0,
      papillaryProjectionsCount: 0,
      acousticShadowsPresent: false,
      ascitesPresent: false,
      bilateralLesions: false,
      multilocularCysts: false,
      colorDopplerScore: 1,
      endometrialThicknessMm: undefined,
      endometrialBiopsyDone: false,
      endometrialHistology: '',
      cervicalLesionVisible: false,
      figoClinicalStage: 'Benign suspected',
      multidisciplinaryTumorBoardStatus: 'not_required_benign',
      managementPlan: 'Conservative repeat ultrasound in 3 months vs elective cystectomy',
      surgicalStagingDetails: '',
      clinicalNotes: '',
      gynOncologistName: '',
      reviewedBy: me?.id || 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (ep: GynOncologyEpisode) => {
    setEditingId(ep.id);
    setForm({ ...ep });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this oncology risk stratification record?')) {
      return;
    }
    try {
      await deleteGynOncologyEpisode(id);
      loadEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: Partial<GynOncologyEpisode> = {
        ...form,
        rmiScore: liveRmi.rmiScore,
        rmiRiskTier: liveRmi.riskTier,
        iotaSimpleRulesCategory: liveIota.category,
      };

      if (editingId) {
        await updateGynOncologyEpisode(editingId, payload);
      } else {
        await createGynOncologyEpisode(payload);
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
            <span>🔬</span> Gynecological Oncology & Malignancy Risk Stratifier
          </h2>
          <p className="text-sm text-slate-500">
            RMI-1 Jacobs score (U × M × CA-125), IOTA Simple Rules, PMB endometrial thickness triage, and Tumor Board registry
          </p>
        </div>
        {(can('patient:write_clinical') || can('care:write_nursing')) && (
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow transition flex items-center gap-2"
          >
            <span>+</span> Record Oncology Assessment
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
        <div className="text-center py-12 text-slate-500">Loading oncology records...</div>
      ) : episodes.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No gynecological oncology risk assessments recorded for this patient yet.
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
                      ep.rmiRiskTier === 'high_risk_gt_200'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : ep.rmiRiskTier === 'intermediate_risk_26_200'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    RMI = {ep.rmiScore} ({ep.rmiRiskTier.replace(/_/g, ' ').toUpperCase()})
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded font-medium ${
                      ep.iotaSimpleRulesCategory === 'malignant'
                        ? 'bg-rose-100 text-rose-800'
                        : ep.iotaSimpleRulesCategory === 'benign'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    IOTA: {ep.iotaSimpleRulesCategory.toUpperCase()}
                  </span>
                  {ep.multidisciplinaryTumorBoardStatus === 'discussed_approved' && (
                    <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded font-medium">
                      MDT Discussed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/patients/${patient.id}/gyn-oncology/${ep.id}/print`}
                    target="_blank"
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-300 flex items-center gap-1"
                  >
                    <span>🖨️</span> Oncology Dossier
                  </Link>
                  {(can('patient:write_clinical') || can('care:write_nursing')) && (
                    <button
                      onClick={() => handleOpenEdit(ep)}
                      className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded border border-rose-200"
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

              {/* Summary Columns */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block">Indication & Menopause</span>
                  <span className="font-medium text-slate-800 capitalize block">
                    {ep.clinicalIndication.replace(/_/g, ' ')} ({ep.menopausalStatus})
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    CA-125: {ep.ca125LevelUml ? `${ep.ca125LevelUml} U/mL` : 'Not tested'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">Mass Morphology</span>
                  <span className="font-medium text-slate-800 block">
                    {ep.lesionMaxDiameterMm ? `${ep.lesionMaxDiameterMm} mm` : '—'}, Solid {ep.proportionSolidTissuePercent ?? 0}%
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Ascites: {ep.ascitesPresent ? 'Yes' : 'No'} | Bilateral: {ep.bilateralLesions ? 'Yes' : 'No'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">Endometrium & Staging</span>
                  <span className="font-medium text-slate-800 block">
                    ET: {ep.endometrialThicknessMm ? `${ep.endometrialThicknessMm} mm` : 'N/A'} (Biopsy: {ep.endometrialBiopsyDone ? 'Done' : 'Not done'})
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {ep.figoClinicalStage || 'No FIGO stage assigned'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">Oncologist & Care Plan</span>
                  <span className="font-medium text-slate-800 truncate block">
                    {ep.gynOncologistName || ep.managementPlan || 'Surveillance'}
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

      {/* Modal Editor */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  {editingId ? 'Edit Malignancy Risk Stratification' : 'Record Gynecological Oncology Assessment'}
                </h3>
                <p className="text-xs text-slate-500">
                  RMI-1 calculation (U × M × CA-125), IOTA ultrasound features, and PMB endometrial evaluation
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
              {/* Patient Indication & Status */}
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
                    value={form.clinicalIndication || 'adnexal_mass'}
                    onChange={(e) => setForm({ ...form, clinicalIndication: e.target.value as any })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="adnexal_mass">Adnexal / Ovarian Mass</option>
                    <option value="postmenopausal_bleeding">Postmenopausal Bleeding (PMB)</option>
                    <option value="cervical_neoplasia_suspected">Suspected Cervical Neoplasia</option>
                    <option value="endometrial_thickening">Incidental Endometrial Thickening</option>
                    <option value="abnormal_uterine_bleeding">Atypical Abnormal Uterine Bleeding</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Menopausal Status *</label>
                  <select
                    value={form.menopausalStatus || 'postmenopausal'}
                    onChange={(e) => setForm({ ...form, menopausalStatus: e.target.value as any })}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="premenopausal">Premenopausal (M = 1)</option>
                    <option value="postmenopausal">Postmenopausal (M = 3)</option>
                  </select>
                </div>
              </div>

              {/* RMI-1 Engine & Biomarkers */}
              <div className="bg-rose-50/60 border border-rose-200 p-5 rounded-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                  <div>
                    <h4 className="font-bold text-rose-950 text-sm">
                      Risk of Malignancy Index 1 (RMI-1 Jacobs) Engine
                    </h4>
                    <p className="text-[11px] text-rose-800">
                      RMI = U (Ultrasound Score: 0, 1, or 3) × M (Menopause: 1 or 3) × CA-125 (U/mL). Cutoff &gt; 200 for MDT referral.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-3 py-1 bg-rose-700 text-white rounded-lg shadow-xs">
                      RMI: {liveRmi.rmiScore} ({liveRmi.riskTier.replace(/_/g, ' ').toUpperCase()})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Serum CA-125 (U/mL) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={form.ca125LevelUml ?? 0}
                      onChange={(e) => setForm({ ...form, ca125LevelUml: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-bold text-base"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Serum HE4 (pmol/L)</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      placeholder="Optional"
                      value={form.he4PmolL ?? ''}
                      onChange={(e) => setForm({ ...form, he4PmolL: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">ROMA Score (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      placeholder="Optional"
                      value={form.romaScorePercent ?? ''}
                      onChange={(e) => setForm({ ...form, romaScorePercent: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center"
                    />
                  </div>
                </div>

                {/* Ultrasound Morphology Toggles (U score criteria) */}
                <div className="bg-white p-3 rounded-lg border border-rose-200">
                  <span className="block text-xs font-semibold text-rose-900 mb-2">
                    Ultrasound Morphology Criteria (1 point each; 1 feature gives U=1, &ge; 2 features give U=3):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <label className="flex items-center gap-1.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(form.multilocularCysts)}
                        onChange={(e) => setForm({ ...form, multilocularCysts: e.target.checked })}
                        className="rounded text-rose-600"
                      />
                      <span>Multilocular cysts</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={(form.proportionSolidTissuePercent ?? 0) > 0}
                        onChange={(e) => setForm({ ...form, proportionSolidTissuePercent: e.target.checked ? 30 : 0 })}
                        className="rounded text-rose-600"
                      />
                      <span>Solid areas present</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(form.bilateralLesions)}
                        onChange={(e) => setForm({ ...form, bilateralLesions: e.target.checked })}
                        className="rounded text-rose-600"
                      />
                      <span>Bilateral lesions</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(form.ascitesPresent)}
                        onChange={(e) => setForm({ ...form, ascitesPresent: e.target.checked })}
                        className="rounded text-rose-600"
                      />
                      <span>Ascites present</span>
                    </label>
                  </div>
                </div>

                <div className="mt-3 text-xs text-rose-900 bg-rose-100/60 p-2.5 rounded border border-rose-200">
                  <strong>Risk Evaluation:</strong> {liveRmi.riskSummary} — <em>{liveRmi.recommendation}</em>
                </div>
              </div>

              {/* Endometrial & Cervical Assessment */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <h4 className="font-semibold text-slate-800 text-sm mb-3">
                  Endometrial Assessment (PMB Threshold: &gt; 4 mm) & Cervical Staging
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Endometrial Thickness (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      placeholder="e.g. 5.5"
                      value={form.endometrialThicknessMm ?? ''}
                      onChange={(e) => setForm({ ...form, endometrialThicknessMm: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Endometrial Biopsy Done?</label>
                    <select
                      value={form.endometrialBiopsyDone ? '1' : '0'}
                      onChange={(e) => setForm({ ...form, endometrialBiopsyDone: e.target.value === '1' })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value="0">No / Pending</option>
                      <option value="1">Yes (Pipelle / Hysteroscopic)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">FIGO Clinical Stage</label>
                    <input
                      type="text"
                      placeholder="e.g. Benign, Stage IA, Stage IIIC"
                      value={form.figoClinicalStage || ''}
                      onChange={(e) => setForm({ ...form, figoClinicalStage: e.target.value })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                    </input>
                  </div>
                </div>

                {livePmb.biopsyIndicated && (
                  <div className="mt-3 p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded text-xs">
                    ⚠️ <strong>Biopsy Trigger:</strong> {livePmb.rationale}
                  </div>
                )}
              </div>

              {/* Multidisciplinary Tumor Board (MDT) & Management */}
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">MDT Status *</label>
                    <select
                      value={form.multidisciplinaryTumorBoardStatus || 'not_required_benign'}
                      onChange={(e) => setForm({ ...form, multidisciplinaryTumorBoardStatus: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    >
                      <option value="not_required_benign">Not Required (Benign Feature Mass)</option>
                      <option value="pending_board_review">Pending MDT Board Presentation</option>
                      <option value="discussed_approved">Discussed & Care Plan Approved by Tumor Board</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Gynecological Oncologist Name</label>
                    <input
                      type="text"
                      value={form.gynOncologistName || ''}
                      onChange={(e) => setForm({ ...form, gynOncologistName: e.target.value })}
                      placeholder="Consultant Gyn Oncologist"
                      className="w-full border border-slate-300 rounded p-1.5 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Oncological Care & Surgical Staging Plan</label>
                  <textarea
                    rows={2}
                    value={form.managementPlan || ''}
                    onChange={(e) => setForm({ ...form, managementPlan: e.target.value })}
                    placeholder="e.g. Primary cytoreductive surgery vs NACT followed by interval debulking..."
                    className="w-full border border-slate-300 rounded p-2 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-xs shadow disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Record' : 'Save Oncology Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
