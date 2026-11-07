import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type PerinatalLossEpisode,
  type UserRow,
  getPerinatalLossEpisodes,
  createPerinatalLossEpisode,
  updatePerinatalLossEpisode,
  deletePerinatalLossEpisode,
} from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculateAntiDRequirements,
  calculatePerinatalLossAudit,
  type PerinatalLossInput,
} from '../perinatalLossEngine';

interface Props {
  patient: Patient;
}

export function PerinatalLossTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [episodes, setEpisodes] = useState<PerinatalLossEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<PerinatalLossEpisode>>({
    patientId: patient.id,
    lossType: 'stillbirth_antepartum',
    diagnosisDate: new Date().toISOString().substring(0, 10),
    deliveryDate: new Date().toISOString().substring(0, 10),
    deliveryTime: new Date().toTimeString().substring(0, 5),
    gestationalAgeWeeks: 32,
    gestationalAgeDays: 0,
    fetalBirthWeightG: 1650,
    modeOfDelivery: 'induced_vaginal',
    fetalPresentation: 'cephalic',
    fetalAppearance: 'fresh_stillbirth',

    primaryCauseCategory: 'placental_abruption',
    primaryCauseDetails: 'Acute placental abruption with retroplacental clot ~200 mL',
    contributingFactors: 'Maternal chronic hypertension / sudden acute abruption',

    maternalBloodGroup: 'O_negative',
    fetomaternalHemorrhageMl: 10,
    antiDAdministered: true,
    antiDDoseMcg: 300,

    lactationSuppressionGiven: true,
    lactationSuppressionDetails: 'Cabergoline 1 mg PO stat single dose within 24h of delivery',
    memoryBoxOffered: true,
    memoryBoxAccepted: true,
    bereavementCounselorContacted: true,

    recurrenceRiskCategory: 'moderate_2_to_5_pct',
    futurePregnancyPlan:
      'Pre-conceptional consultation. Low-dose Aspirin 150 mg nightly from 11-14w up to 36w. Calcium 2 g/day. Serial growth scans and uterine artery Doppler from 24w.',
    counselingNotes: 'Debriefed parents in private bereavement suite. Bereavement memory pack provided.',
    consultantName: me?.fullName || '',
    reviewedBy: me?.id || 1,
  });

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPerinatalLossEpisodes(patient.id);
      setEpisodes(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load perinatal loss records');
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

  // Live Audit Preview
  const auditInput: PerinatalLossInput = {
    lossType: form.lossType || 'stillbirth_antepartum',
    gestationalAgeWeeks: form.gestationalAgeWeeks || 32,
    gestationalAgeDays: form.gestationalAgeDays || 0,
    fetalBirthWeightG: form.fetalBirthWeightG || undefined,
    primaryCauseCategory: form.primaryCauseCategory || 'placental_abruption',
    primaryCauseDetails: form.primaryCauseDetails || '',
    maternalBloodGroup: form.maternalBloodGroup || undefined,
    fetomaternalHemorrhageMl: form.fetomaternalHemorrhageMl || undefined,
  };

  const liveAudit = calculatePerinatalLossAudit(auditInput);
  const liveAntiD = calculateAntiDRequirements(form.maternalBloodGroup || undefined, form.fetomaternalHemorrhageMl || 0);

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      patientId: patient.id,
      lossType: 'stillbirth_antepartum',
      diagnosisDate: new Date().toISOString().substring(0, 10),
      deliveryDate: new Date().toISOString().substring(0, 10),
      deliveryTime: new Date().toTimeString().substring(0, 5),
      gestationalAgeWeeks: 32,
      gestationalAgeDays: 0,
      fetalBirthWeightG: 1650,
      modeOfDelivery: 'induced_vaginal',
      fetalPresentation: 'cephalic',
      fetalAppearance: 'fresh_stillbirth',
      primaryCauseCategory: 'placental_abruption',
      primaryCauseDetails: '',
      contributingFactors: '',
      maternalBloodGroup: 'O_negative',
      fetomaternalHemorrhageMl: 10,
      antiDAdministered: true,
      antiDDoseMcg: 300,
      lactationSuppressionGiven: true,
      lactationSuppressionDetails: 'Cabergoline 1 mg PO stat single dose within 24h of delivery',
      memoryBoxOffered: true,
      memoryBoxAccepted: true,
      bereavementCounselorContacted: true,
      recurrenceRiskCategory: 'moderate_2_to_5_pct',
      futurePregnancyPlan: liveAudit.futurePregnancyPlan.join(' '),
      counselingNotes: '',
      consultantName: me?.fullName || '',
      reviewedBy: me?.id || 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (ep: PerinatalLossEpisode) => {
    setEditingId(ep.id);
    setForm({ ...ep });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this perinatal loss audit record?')) return;
    try {
      await deletePerinatalLossEpisode(id);
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
        reviewedBy: Number(form.reviewedBy || me?.id || 1),
      };

      if (editingId) {
        await updatePerinatalLossEpisode(editingId, payload);
      } else {
        await createPerinatalLossEpisode(payload);
      }

      setShowModal(false);
      await loadEpisodes();
    } catch (err: any) {
      setError(err?.message || 'Failed to save perinatal loss record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Guidelines */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-800">
                Perinatal Loss &amp; Stillbirth / IUFD Registry &amp; Audit
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                Series 7B
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              RCOG Green-top 55 &amp; WHO stillbirth audit standard: ReCoDe etiology classification, FMH/Anti-D calculation, bereavement pathway &amp; future pregnancy care plan.
            </p>
          </div>
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>+</span> Log Demise / Loss Episode
          </button>
        </div>

        {/* Statutory PC-PNDT banner */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-amber-800">Statutory Notice:</span>
            <span>Compliance with Pre-Conception &amp; Pre-Natal Diagnostic Techniques (PC-PNDT) Act. Disclosure of fetal sex is prohibited by law.</span>
          </div>
          <span className="font-semibold text-amber-700">Strictly Enforced</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Episodes List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">
            Perinatal Loss &amp; Demise Audit Records ({episodes.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading audit records...</div>
        ) : episodes.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No perinatal loss episodes recorded for this patient. Click &quot;Log Demise / Loss Episode&quot; to register a case.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3">Diagnosis / Delivery</th>
                  <th className="p-3">Loss Classification</th>
                  <th className="p-3">Gestation &amp; Weight</th>
                  <th className="p-3">Primary Etiology</th>
                  <th className="p-3">Anti-D / FMH</th>
                  <th className="p-3">Recurrence Risk</th>
                  <th className="p-3">Bereavement Plan</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{ep.diagnosisDate}</div>
                      <div className="text-xs text-slate-400">
                        {ep.deliveryDate ? `Delivered: ${ep.deliveryDate}` : 'Pending delivery'}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-rose-700 capitalize text-xs">
                        {ep.lossType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700">
                      <div>{ep.gestationalAgeWeeks}w {ep.gestationalAgeDays}d</div>
                      <div className="text-xs text-slate-500">
                        {ep.fetalBirthWeightG ? `${ep.fetalBirthWeightG} g` : 'Weight unspec.'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800 capitalize">
                        {ep.primaryCauseCategory.replace(/_/g, ' ')}
                      </div>
                      {ep.primaryCauseDetails && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{ep.primaryCauseDetails}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {ep.antiDAdministered ? (
                        <span className="text-purple-700 font-bold">
                          Administered ({ep.antiDDoseMcg} mcg)
                        </span>
                      ) : (
                        <span className="text-slate-400">Not indicated / Rh+</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          ep.recurrenceRiskCategory === 'high_gt_5_pct'
                            ? 'bg-rose-100 text-rose-800'
                            : ep.recurrenceRiskCategory === 'moderate_2_to_5_pct'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.recurrenceRiskCategory.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      <div className={ep.lactationSuppressionGiven ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                        Cabergoline: {ep.lactationSuppressionGiven ? 'Given' : 'Declined'}
                      </div>
                      <div className={ep.memoryBoxAccepted ? 'text-indigo-700' : 'text-slate-400'}>
                        Memory Box: {ep.memoryBoxAccepted ? 'Accepted' : 'Offered'}
                      </div>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${patient.id}/perinatal-loss/${ep.id}/print`}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                      >
                        Print Dossier
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

      {/* Modal for Creating / Editing Perinatal Loss Record */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {editingId ? 'Edit Perinatal Loss & Audit Record' : 'Record Perinatal Loss & Demise Audit'}
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
              {/* Event Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Loss Classification *</label>
                  <select
                    value={form.lossType}
                    onChange={(e) => setForm({ ...form, lossType: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold text-rose-700"
                  >
                    <option value="stillbirth_antepartum">Stillbirth (Antepartum &gt;=24w)</option>
                    <option value="stillbirth_intrapartum">Stillbirth (Intrapartum)</option>
                    <option value="late_miscarriage_12_20w">Late Miscarriage (12–20w)</option>
                    <option value="early_miscarriage_lt_12w">Early Miscarriage (&lt;12w)</option>
                    <option value="neonatal_death_early">Early Neonatal Death (&lt;7d)</option>
                    <option value="medical_termination_anomaly">Termination for Fetal Anomaly (TOPFA)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Diagnosis Date *</label>
                  <input
                    type="date"
                    required
                    value={form.diagnosisDate}
                    onChange={(e) => setForm({ ...form, diagnosisDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gestation *</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={4}
                      max={44}
                      required
                      value={form.gestationalAgeWeeks ?? 32}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fetal Weight (grams)</label>
                  <input
                    type="number"
                    min={10}
                    max={6000}
                    value={form.fetalBirthWeightG ?? ''}
                    placeholder="e.g. 1650"
                    onChange={(e) =>
                      setForm({ ...form, fetalBirthWeightG: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm text-center font-medium"
                  />
                </div>
              </div>

              {/* Delivery Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={form.deliveryDate || ''}
                    onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mode of Delivery *</label>
                  <select
                    value={form.modeOfDelivery}
                    onChange={(e) => setForm({ ...form, modeOfDelivery: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  >
                    <option value="induced_vaginal">Induced Vaginal Delivery</option>
                    <option value="spontaneous_vaginal">Spontaneous Vaginal Delivery</option>
                    <option value="emergency_cesarean">Emergency Cesarean Section</option>
                    <option value="elective_cesarean">Elective Cesarean Section</option>
                    <option value="surgical_evacuation_d_and_e">Surgical Evacuation (D&amp;E)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fetal Appearance</label>
                  <select
                    value={form.fetalAppearance}
                    onChange={(e) => setForm({ ...form, fetalAppearance: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  >
                    <option value="fresh_stillbirth">Fresh Stillbirth (Intrapartum / &lt;12h)</option>
                    <option value="macerated_slight_peeling">Slight Maceration (Peeling &gt;12h)</option>
                    <option value="macerated_moderate">Moderate Maceration (Demise &gt;24h)</option>
                    <option value="macerated_severe">Severe Maceration (Demise &gt;72h)</option>
                    <option value="gross_anomalies_present">Gross Structural Anomalies Present</option>
                  </select>
                </div>
              </div>

              {/* Etiology Classification */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                <h4 className="font-bold text-slate-800 text-sm">
                  Primary Etiology Classification (ReCoDe)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cause Category *</label>
                    <select
                      value={form.primaryCauseCategory}
                      onChange={(e) => {
                        const cat = e.target.value as any;
                        setForm({ ...form, primaryCauseCategory: cat });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm font-semibold"
                    >
                      <option value="placental_abruption">Placental Abruption</option>
                      <option value="placental_insufficiency_infarction">Placental Insufficiency / Infarction (FGR)</option>
                      <option value="fetal_anomaly_genetic">Fetal Structural / Genetic Anomaly</option>
                      <option value="umbilical_cord_accident">Umbilical Cord Accident (Prolapse / True Knot)</option>
                      <option value="chorioamnionitis_infection">Intrauterine Infection / Chorioamnionitis</option>
                      <option value="maternal_medical_preeclampsia">Preeclampsia / Eclampsia / HELLP</option>
                      <option value="maternal_medical_diabetes">Poorly Controlled Maternal Diabetes</option>
                      <option value="maternal_cholestasis_icp">Intrahepatic Cholestasis of Pregnancy (ICP)</option>
                      <option value="intrapartum_asphyxia">Intrapartum Asphyxia</option>
                      <option value="unexplained_idiopathic">Unexplained / Idiopathic Stillbirth</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Specific Cause Details *</label>
                    <input
                      type="text"
                      required
                      value={form.primaryCauseDetails || ''}
                      placeholder="e.g. Acute concealed abruption, 250 mL retroplacental hematoma"
                      onChange={(e) => setForm({ ...form, primaryCauseDetails: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contributing Factors</label>
                  <input
                    type="text"
                    value={form.contributingFactors || ''}
                    placeholder="e.g. Maternal BMI 34, chronic hypertension, delayed presentation"
                    onChange={(e) => setForm({ ...form, contributingFactors: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Maternal Blood Group & Anti-D FMH Calculator */}
              <div className="border border-purple-200 bg-purple-50/40 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="font-bold text-purple-900 text-sm">
                      Fetomaternal Hemorrhage (FMH) &amp; Anti-D Calculator
                    </h4>
                    <p className="text-xs text-purple-700">
                      RCOG Green-top 22: Kleihauer-Betke test within 2 hours of delivery for all Rh-negative mothers.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-purple-900">Maternal Blood Group:</label>
                    <select
                      value={form.maternalBloodGroup || 'O_negative'}
                      onChange={(e) => setForm({ ...form, maternalBloodGroup: e.target.value })}
                      className="px-2 py-1 border border-purple-300 rounded text-xs bg-white font-bold"
                    >
                      <option value="A_positive">A Positive (Rh+)</option>
                      <option value="A_negative">A Negative (Rh-)</option>
                      <option value="B_positive">B Positive (Rh+)</option>
                      <option value="B_negative">B Negative (Rh-)</option>
                      <option value="AB_positive">AB Positive (Rh+)</option>
                      <option value="AB_negative">AB Negative (Rh-)</option>
                      <option value="O_positive">O Positive (Rh+)</option>
                      <option value="O_negative">O Negative (Rh-)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-purple-200">
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      Kleihauer-Betke FMH (mL fetal blood)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={form.fetomaternalHemorrhageMl ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const calc = calculateAntiDRequirements(form.maternalBloodGroup || undefined, val);
                        setForm({
                          ...form,
                          fetomaternalHemorrhageMl: val,
                          antiDDoseMcg: calc.recommendedDoseMcg,
                          antiDAdministered: calc.indicated,
                        });
                      }}
                      className="w-full px-3 py-1.5 border border-purple-300 rounded text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      Recommended Anti-D Dose (mcg)
                    </label>
                    <input
                      type="number"
                      value={form.antiDDoseMcg ?? 300}
                      onChange={(e) => setForm({ ...form, antiDDoseMcg: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-purple-300 rounded text-sm bg-white font-bold text-purple-900"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="antiDAdministered"
                      checked={form.antiDAdministered}
                      onChange={(e) => setForm({ ...form, antiDAdministered: e.target.checked })}
                      className="h-4 w-4 rounded border-purple-300 text-purple-600"
                    />
                    <label htmlFor="antiDAdministered" className="text-xs font-bold text-purple-900 cursor-pointer">
                      Anti-D Administered &lt;72h
                    </label>
                  </div>
                </div>

                <div className="text-xs text-purple-900 bg-purple-100/70 p-2.5 rounded border border-purple-200">
                  {liveAntiD.rationale}
                </div>
              </div>

              {/* Bereavement Support & Lactation Suppression */}
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-4">
                <h4 className="font-bold text-emerald-900 text-sm">
                  Bereavement Care &amp; Lactation Suppression Pathway
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="lactationSuppressionGiven"
                      checked={form.lactationSuppressionGiven}
                      onChange={(e) => setForm({ ...form, lactationSuppressionGiven: e.target.checked })}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600"
                    />
                    <label htmlFor="lactationSuppressionGiven" className="text-xs font-bold text-emerald-950 cursor-pointer">
                      Cabergoline 1 mg PO Stat Given
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="memoryBoxAccepted"
                      checked={form.memoryBoxAccepted}
                      onChange={(e) => setForm({ ...form, memoryBoxAccepted: e.target.checked })}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600"
                    />
                    <label htmlFor="memoryBoxAccepted" className="text-xs font-bold text-emerald-950 cursor-pointer">
                      Memory Box / Footprints Accepted
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="bereavementCounselorContacted"
                      checked={form.bereavementCounselorContacted}
                      onChange={(e) => setForm({ ...form, bereavementCounselorContacted: e.target.checked })}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600"
                    />
                    <label htmlFor="bereavementCounselorContacted" className="text-xs font-bold text-emerald-950 cursor-pointer">
                      Bereavement Counselor Engaged
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200">
                  <label className="block text-xs font-semibold text-emerald-900 mb-1">
                    Future Pregnancy Protocol &amp; Recurrence Prevention Plan *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={form.futurePregnancyPlan || ''}
                    placeholder="e.g. Aspirin 150 mg from 12w, early anomaly scan at 16w, serial growth scans from 24w, induction at 37–38w..."
                    onChange={(e) => setForm({ ...form, futurePregnancyPlan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-emerald-300 rounded text-xs bg-white"
                  />
                </div>
              </div>

              {/* Reviewer & Consultant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Attending Consultant Name</label>
                  <input
                    type="text"
                    value={form.consultantName || ''}
                    onChange={(e) => setForm({ ...form, consultantName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reviewed By Consultant *</label>
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
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Audit Record' : 'Save Perinatal Loss Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
