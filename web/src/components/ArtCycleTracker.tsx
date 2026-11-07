import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type ArtCycleRecord,
  type UserRow,
  getArtCycles,
  createArtCycle,
  updateArtCycle,
  deleteArtCycle,
} from '../api';
import { useAuth, useMe } from '../auth';
import {
  parseGardnerGrade,
  calculateHcgDoublingKinetics,
  type HcgKineticsInput,
} from '../artEngine';

interface Props {
  patient: Patient;
}

export function ArtCycleTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [cycles, setCycles] = useState<ArtCycleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<ArtCycleRecord>>({
    patientId: patient.id,
    cycleNumber: 1,
    startDate: new Date().toISOString().substring(0, 10),
    cycleType: 'icsi_fresh',
    protocolType: 'gnrh_antagonist',
    indication: 'tubal_factor',
    indicationNotes: '',

    gonadotropinType: 'Recombinant FSH (Gonal-F) + HMG (Menopur)',
    totalGonadotropinDoseIu: 2250,
    stimulationDays: 10,
    peakEstradiolPgMl: 2800,
    triggerProgesteroneNgMl: 0.9,
    triggerType: 'rhcg_250mcg',
    triggerDatetime: '',

    opuDatetime: '',
    totalOocytesRetrieved: 12,
    matureMiiOocytes: 10,
    inseminationMethod: 'icsi',
    fertilized2pnCount: 8,
    fertilizationRatePercent: 80.0,

    day3EmbryosCount: 7,
    day5BlastocystsCount: 4,
    embryosTransferredCount: 1,
    transferStage: 'day_5_blastocyst',
    transferDatetime: '',
    transferredEmbryosDetails: '4AA',
    endometrialThicknessAtTransferMm: 9.8,
    transferDifficulty: 'easy',
    embryosFrozenCount: 3,
    frozenStorageStraws: 'Tank 2, Canister B, Straw #1204 (4BA, 4BB), Straw #1205 (3BB)',

    lutealSupportRegimen: 'Micronized progesterone 400 mg BD vaginally + Estradiol valerate 2 mg BD',
    betaHcgDay14MiuMl: 420,
    betaHcgDay16MiuMl: 890,
    hcgDoublingTimeHours: 44.5,
    clinicalPregnancyStatus: 'cycle_in_progress',
    gestationalSacsCount: 1,
    fetalHeartPresent: true,
    cycleNotes: '',

    leadEmbryologist: 'Senior Clinical Embryologist',
    reviewedBy: me?.id || 1,
  });

  const loadCycles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getArtCycles(patient.id);
      setCycles(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load ART cycles');
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
    loadCycles();
    loadUsers();
  }, [patient.id]);

  // Live Gardner blastocyst grade analysis
  const blastoEval = form.transferredEmbryosDetails
    ? parseGardnerGrade(form.transferredEmbryosDetails)
    : null;

  // Live hCG doubling time calculation
  let liveKinetics = null;
  if (
    form.betaHcgDay14MiuMl &&
    form.betaHcgDay16MiuMl &&
    form.betaHcgDay14MiuMl > 0 &&
    form.betaHcgDay16MiuMl > 0
  ) {
    const input: HcgKineticsInput = {
      hcg1Value: form.betaHcgDay14MiuMl,
      hcg1Datetime: '2026-01-01T08:00:00Z',
      hcg2Value: form.betaHcgDay16MiuMl,
      hcg2Datetime: '2026-01-03T08:00:00Z', // 48h default interval
    };
    liveKinetics = calculateHcgDoublingKinetics(input);
  }

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      patientId: patient.id,
      cycleNumber: cycles.length + 1,
      startDate: new Date().toISOString().substring(0, 10),
      cycleType: 'icsi_fresh',
      protocolType: 'gnrh_antagonist',
      indication: 'tubal_factor',
      indicationNotes: '',
      gonadotropinType: 'Recombinant FSH + HMG',
      totalGonadotropinDoseIu: 2250,
      stimulationDays: 10,
      peakEstradiolPgMl: 2800,
      triggerProgesteroneNgMl: 0.9,
      triggerType: 'rhcg_250mcg',
      triggerDatetime: '',
      opuDatetime: '',
      totalOocytesRetrieved: 0,
      matureMiiOocytes: 0,
      inseminationMethod: 'icsi',
      fertilized2pnCount: 0,
      fertilizationRatePercent: undefined,
      day3EmbryosCount: 0,
      day5BlastocystsCount: 0,
      embryosTransferredCount: 1,
      transferStage: 'day_5_blastocyst',
      transferDatetime: '',
      transferredEmbryosDetails: '4AA',
      endometrialThicknessAtTransferMm: 9.5,
      transferDifficulty: 'easy',
      embryosFrozenCount: 0,
      frozenStorageStraws: '',
      lutealSupportRegimen: 'Micronized progesterone 400 mg BD vaginally',
      betaHcgDay14MiuMl: undefined,
      betaHcgDay16MiuMl: undefined,
      hcgDoublingTimeHours: undefined,
      clinicalPregnancyStatus: 'cycle_in_progress',
      gestationalSacsCount: 0,
      fetalHeartPresent: false,
      cycleNotes: '',
      leadEmbryologist: '',
      reviewedBy: me?.id || 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (c: ArtCycleRecord) => {
    setEditingId(c.id);
    setForm({ ...c });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this ART cycle record?')) return;
    try {
      await deleteArtCycle(id);
      await loadCycles();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      let calcFertRate = form.fertilizationRatePercent;
      if (form.matureMiiOocytes && form.matureMiiOocytes > 0 && form.fertilized2pnCount) {
        calcFertRate = Math.round((form.fertilized2pnCount / form.matureMiiOocytes) * 1000) / 10;
      }

      const payload = {
        ...form,
        patientId: patient.id,
        fertilizationRatePercent: calcFertRate,
        hcgDoublingTimeHours: liveKinetics?.doublingTimeHours ?? form.hcgDoublingTimeHours,
        reviewedBy: Number(form.reviewedBy || me?.id || 1),
      };

      if (editingId) {
        await updateArtCycle(editingId, payload);
      } else {
        await createArtCycle(payload);
      }

      setShowModal(false);
      await loadCycles();
    } catch (err: any) {
      setError(err?.message || 'Failed to save ART cycle record');
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
                Assisted Reproductive Technology (ART) &amp; IVF-ICSI Tracker
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800">
                Series 7C
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              COH protocol optimization, Gardner blastocyst grading, Single Embryo Transfer (SET), cryostorage straws, and serial beta-hCG doubling kinetics.
            </p>
          </div>
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>+</span> Initiate ART Cycle
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

      {/* Cycles List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">
            ART / IVF-ICSI Cycles ({cycles.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading ART cycles...</div>
        ) : cycles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No ART cycles recorded for this patient. Click &quot;Initiate ART Cycle&quot; to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3">Cycle #</th>
                  <th className="p-3">Start Date</th>
                  <th className="p-3">Type &amp; Protocol</th>
                  <th className="p-3">Oocytes / 2PN</th>
                  <th className="p-3">Transfer / Gardner</th>
                  <th className="p-3">Frozen</th>
                  <th className="p-3">Beta-hCG &amp; Outcome</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cycles.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="p-3 font-bold text-violet-900">
                      Cycle #{c.cycleNumber}
                    </td>
                    <td className="p-3 text-slate-700 font-medium">
                      {c.startDate}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800 capitalize">
                        {c.cycleType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-slate-500 capitalize">
                        {c.protocolType.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="p-3 text-slate-700">
                      <div>
                        {c.totalOocytesRetrieved} oocytes ({c.matureMiiOocytes} MII)
                      </div>
                      <div className="text-xs text-slate-500">
                        2PN: {c.fertilized2pnCount} ({c.fertilizationRatePercent ?? 0}%)
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">
                        {c.embryosTransferredCount > 0
                          ? `${c.embryosTransferredCount} ET (${c.transferStage?.replace(/_/g, ' ') || 'Stage'})`
                          : 'Freeze All'}
                      </div>
                      {c.transferredEmbryosDetails && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-violet-100 text-violet-800">
                          {c.transferredEmbryosDetails}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-700">
                      <div className="font-medium">{c.embryosFrozenCount} blastocysts</div>
                      {c.frozenStorageStraws && (
                        <div className="text-xs text-slate-400 truncate max-w-xs">{c.frozenStorageStraws}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">
                        {c.betaHcgDay14MiuMl ? `${c.betaHcgDay14MiuMl} mIU/mL` : 'Pending'}
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          c.clinicalPregnancyStatus.includes('intrauterine')
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.clinicalPregnancyStatus.includes('biochemical')
                            ? 'bg-amber-100 text-amber-800'
                            : c.clinicalPregnancyStatus.includes('negative')
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-violet-100 text-violet-800'
                        }`}
                      >
                        {c.clinicalPregnancyStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${patient.id}/art-cycles/${c.id}/print`}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                      >
                        Print Summary
                      </Link>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                      >
                        Edit
                      </button>
                      {(can('user:manage') || can('patient:write_clinical')) && (
                        <button
                          onClick={() => handleDelete(c.id)}
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

      {/* Modal for Creating / Editing ART Cycle */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {editingId ? 'Edit ART / Embryo Transfer Cycle' : 'Initiate New ART / IVF-ICSI Cycle'}
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
              {/* Cycle Basics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cycle Number *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={form.cycleNumber ?? 1}
                    onChange={(e) => setForm({ ...form, cycleNumber: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm text-center font-bold text-violet-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date (CD 1/2) *</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cycle Type *</label>
                  <select
                    value={form.cycleType}
                    onChange={(e) => setForm({ ...form, cycleType: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold"
                  >
                    <option value="icsi_fresh">ICSI (Fresh Cycle)</option>
                    <option value="ivf_fresh">IVF (Fresh Cycle)</option>
                    <option value="fet_frozen_transfer">Frozen Embryo Transfer (FET)</option>
                    <option value="iui_husband">IUI (Husband / Partner)</option>
                    <option value="iui_donor">IUI (Donor)</option>
                    <option value="oocyte_vitrification">Oocyte Vitrification / Banking</option>
                    <option value="surrogacy">Gestational Surrogacy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Protocol *</label>
                  <select
                    value={form.protocolType}
                    onChange={(e) => setForm({ ...form, protocolType: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-medium"
                  >
                    <option value="gnrh_antagonist">GnRH Antagonist (Fixed / Flexible)</option>
                    <option value="gnrh_agonist_long">GnRH Agonist Long (Luteal Leuprolide)</option>
                    <option value="gnrh_agonist_short">GnRH Agonist Short (Flare)</option>
                    <option value="minimal_stimulation">Minimal Stimulation / Mild IVF</option>
                    <option value="natural_modified">Natural / Modified Natural FET</option>
                    <option value="hrt_programmed">Programmed HRT FET (Estradiol + Prog)</option>
                  </select>
                </div>
              </div>

              {/* Indication */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Infertility Indication *</label>
                  <select
                    value={form.indication}
                    onChange={(e) => setForm({ ...form, indication: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  >
                    <option value="tubal_factor">Tubal Factor (Bilateral Hydrosalpinx / Occlusion)</option>
                    <option value="male_factor">Male Factor (Oligoasthenoteratozoospermia / Azoospermia)</option>
                    <option value="pcos_ovulatory">PCOS / Anovulatory Infertility</option>
                    <option value="diminished_ovarian_reserve">Diminished Ovarian Reserve (Low AMH)</option>
                    <option value="endometriosis">Endometriosis (Stage III / IV)</option>
                    <option value="unexplained">Unexplained Infertility</option>
                    <option value="genetic_pgt">Preimplantation Genetic Testing (PGT-A / PGT-M)</option>
                    <option value="secondary_infertility">Secondary Infertility</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Indication Notes</label>
                  <input
                    type="text"
                    value={form.indicationNotes || ''}
                    placeholder="e.g. AMH 0.8 ng/mL, AFC 6, severe teratozoospermia (2% normal forms)"
                    onChange={(e) => setForm({ ...form, indicationNotes: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Controlled Ovarian Stimulation & Trigger */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                <h4 className="font-bold text-slate-800 text-sm">
                  Controlled Ovarian Stimulation (COH) &amp; Ovulation Trigger
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gonadotropin Regimen</label>
                    <input
                      type="text"
                      value={form.gonadotropinType || ''}
                      placeholder="e.g. Gonal-F 225 IU + Menopur 75 IU"
                      onChange={(e) => setForm({ ...form, gonadotropinType: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Dose (IU)</label>
                    <input
                      type="number"
                      min={0}
                      max={15000}
                      value={form.totalGonadotropinDoseIu ?? ''}
                      placeholder="e.g. 2250"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          totalGonadotropinDoseIu: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Stimulation Days</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={form.stimulationDays ?? ''}
                      placeholder="e.g. 10"
                      onChange={(e) =>
                        setForm({ ...form, stimulationDays: e.target.value ? Number(e.target.value) : undefined })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Peak Estradiol E2 (pg/mL)</label>
                    <input
                      type="number"
                      min={0}
                      max={25000}
                      value={form.peakEstradiolPgMl ?? ''}
                      placeholder="e.g. 2800"
                      onChange={(e) =>
                        setForm({ ...form, peakEstradiolPgMl: e.target.value ? Number(e.target.value) : undefined })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Trigger Progesterone P4 (ng/mL)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={50}
                      value={form.triggerProgesteroneNgMl ?? ''}
                      placeholder="e.g. 0.9 (premature rise >1.5 ng/mL suggests freeze-all)"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          triggerProgesteroneNgMl: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Trigger Agent</label>
                    <select
                      value={form.triggerType || 'rhcg_250mcg'}
                      onChange={(e) => setForm({ ...form, triggerType: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    >
                      <option value="rhcg_250mcg">Recombinant hCG (Ovitrelle 250 mcg)</option>
                      <option value="urinary_hcg_10000iu">Urinary hCG 10,000 IU</option>
                      <option value="gnrh_agonist_dual">Dual Trigger (GnRHa 0.2 mg + hCG 1000 IU)</option>
                      <option value="gnrh_agonist_solo_ohss_prevention">GnRH Agonist Solo (OHSS Prevention)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Trigger Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={form.triggerDatetime || ''}
                      onChange={(e) => setForm({ ...form, triggerDatetime: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Oocyte Retrieval & Insemination */}
              <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-4 space-y-4">
                <h4 className="font-bold text-violet-900 text-sm">
                  Oocyte Retrieval (OPU) &amp; Fertilization Metrics
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-violet-950 mb-1">Total Oocytes Retrieved</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.totalOocytesRetrieved ?? 0}
                      onChange={(e) => setForm({ ...form, totalOocytesRetrieved: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-violet-300 rounded text-sm bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-violet-950 mb-1">Mature (MII) Oocytes</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.matureMiiOocytes ?? 0}
                      onChange={(e) => setForm({ ...form, matureMiiOocytes: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-violet-300 rounded text-sm bg-white text-center font-bold text-violet-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-violet-950 mb-1">Insemination Method</label>
                    <select
                      value={form.inseminationMethod || 'icsi'}
                      onChange={(e) => setForm({ ...form, inseminationMethod: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-violet-300 rounded text-sm bg-white"
                    >
                      <option value="icsi">ICSI</option>
                      <option value="standard_ivf">Standard Conventional IVF</option>
                      <option value="half_ivf_half_icsi">50/50 Split (IVF / ICSI)</option>
                      <option value="frozen_thawed">Thawed Oocytes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-violet-950 mb-1">Fertilized (2PN) Count</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.fertilized2pnCount ?? 0}
                      onChange={(e) => {
                        const count = Number(e.target.value);
                        const mii = form.matureMiiOocytes || form.totalOocytesRetrieved || 1;
                        setForm({
                          ...form,
                          fertilized2pnCount: count,
                          fertilizationRatePercent: Math.round((count / mii) * 1000) / 10,
                        });
                      }}
                      className="w-full px-3 py-1.5 border border-violet-300 rounded text-sm bg-white text-center font-bold text-emerald-800"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-violet-900 bg-violet-100/70 p-2.5 rounded border border-violet-200">
                  <span>
                    Fertilization Rate (2PN / MII):{' '}
                    <strong className="text-violet-950">
                      {form.matureMiiOocytes && form.matureMiiOocytes > 0
                        ? `${Math.round(((form.fertilized2pnCount ?? 0) / form.matureMiiOocytes) * 1000) / 10}%`
                        : '0%'}
                    </strong>{' '}
                    (Standard benchmark: &gt;=70% for ICSI, &gt;=65% for IVF)
                  </span>
                  <span>Day 3 Cleaved: <strong>{form.day3EmbryosCount ?? 0}</strong> | Day 5 Blastocysts: <strong>{form.day5BlastocystsCount ?? 0}</strong></span>
                </div>
              </div>

              {/* Embryo Cohort, Gardner Blastocyst Grading & Transfer */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
                <h4 className="font-bold text-slate-800 text-sm">
                  Embryo Cohort, Gardner Blastocyst Grading &amp; Transfer
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Stage</label>
                    <select
                      value={form.transferStage || 'day_5_blastocyst'}
                      onChange={(e) => setForm({ ...form, transferStage: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    >
                      <option value="day_5_blastocyst">Day 5 Blastocyst (Preferred)</option>
                      <option value="day_6_blastocyst">Day 6 Blastocyst</option>
                      <option value="day_3_cleavage">Day 3 Cleavage Stage</option>
                      <option value="freeze_all_no_transfer">Freeze-All (OHSS / High P4 / PGT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Embryos Transferred (SET)</label>
                    <input
                      type="number"
                      min={0}
                      max={3}
                      value={form.embryosTransferredCount ?? 1}
                      onChange={(e) => setForm({ ...form, embryosTransferredCount: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm text-center font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gardner Blastocyst Grade</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={form.transferredEmbryosDetails || ''}
                      placeholder="e.g. 4AA, 4BA, 3BB"
                      onChange={(e) => setForm({ ...form, transferredEmbryosDetails: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm text-center font-mono font-bold text-violet-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Endometrial Thickness (mm)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={4}
                      max={20}
                      value={form.endometrialThicknessAtTransferMm ?? 9.5}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          endometrialThicknessAtTransferMm: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm text-center"
                    />
                  </div>
                </div>

                {blastoEval?.grade && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                      blastoEval.tier === 'top_quality'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : blastoEval.tier === 'good_quality'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div>
                      <span className="font-bold">Gardner Tier: </span>
                      <span className="capitalize">{blastoEval.tier.replace(/_/g, ' ')}</span> &mdash;{' '}
                      {blastoEval.summary}
                    </div>
                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-white/80">
                      Exp {blastoEval.grade.expansion} | ICM {blastoEval.grade.innerCellMass} | TE {blastoEval.grade.trophectoderm}
                    </span>
                  </div>
                )}

                {/* Cryostorage Registry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Embryos Frozen / Vitrified</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={form.embryosFrozenCount ?? 0}
                      onChange={(e) => setForm({ ...form, embryosFrozenCount: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cryostorage Straws / Tank IDs</label>
                    <input
                      type="text"
                      value={form.frozenStorageStraws || ''}
                      placeholder="e.g. Tank 1, Canister C, Straw #401 (4BA, 4AB)"
                      onChange={(e) => setForm({ ...form, frozenStorageStraws: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Serial Beta-hCG Kinetics Calculator & Pregnancy Outcome */}
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-4">
                <h4 className="font-bold text-indigo-950 text-sm">
                  Serial Beta-hCG Kinetics &amp; Clinical Pregnancy Outcome
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-900 mb-1">Day 14 Beta-hCG (mIU/mL)</label>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={form.betaHcgDay14MiuMl ?? ''}
                      placeholder="e.g. 420"
                      onChange={(e) =>
                        setForm({ ...form, betaHcgDay14MiuMl: e.target.value ? Number(e.target.value) : undefined })
                      }
                      className="w-full px-3 py-1.5 border border-indigo-300 rounded text-sm bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-indigo-900 mb-1">Day 16 Beta-hCG (mIU/mL)</label>
                    <input
                      type="number"
                      min={0}
                      max={200000}
                      value={form.betaHcgDay16MiuMl ?? ''}
                      placeholder="e.g. 890"
                      onChange={(e) =>
                        setForm({ ...form, betaHcgDay16MiuMl: e.target.value ? Number(e.target.value) : undefined })
                      }
                      className="w-full px-3 py-1.5 border border-indigo-300 rounded text-sm bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-indigo-900 mb-1">Clinical Pregnancy Status *</label>
                    <select
                      value={form.clinicalPregnancyStatus}
                      onChange={(e) => setForm({ ...form, clinicalPregnancyStatus: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-indigo-300 rounded text-sm bg-white font-semibold"
                    >
                      <option value="cycle_in_progress">Cycle In Progress / Luteal Phase</option>
                      <option value="clinical_intrauterine_sac">Clinical Intrauterine Pregnancy (Sac+FH+)</option>
                      <option value="biochemical_pregnancy">Biochemical Pregnancy (hCG positive, sac-)</option>
                      <option value="ectopic_pregnancy">Ectopic / Pregnancy of Unknown Location</option>
                      <option value="negative_not_pregnant">Negative / Not Pregnant</option>
                      <option value="cancelled_ohss_risk">Cancelled due to OHSS Risk</option>
                      <option value="freeze_all">Freeze All (Transfer Deferred)</option>
                    </select>
                  </div>
                </div>

                {liveKinetics && (
                  <div
                    className={`p-3 rounded-lg text-xs border ${
                      liveKinetics.interpretation === 'normal_viable_trajectory'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : liveKinetics.interpretation === 'slow_suboptimal_rise'
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between mb-1">
                      <span>hCG Doubling Kinetics: {liveKinetics.doublingTimeHours > 0 ? `${liveKinetics.doublingTimeHours} hours` : 'N/A'}</span>
                      <span>48h Increase: +{liveKinetics.twoDayPercentIncrease}%</span>
                    </div>
                    <div>{liveKinetics.clinicalSummary}</div>
                  </div>
                )}
              </div>

              {/* Reviewer & Embryologist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Clinical Embryologist</label>
                  <input
                    type="text"
                    value={form.leadEmbryologist || ''}
                    placeholder="e.g. Dr. A. Sharma, PhD, Embryology Lead"
                    onChange={(e) => setForm({ ...form, leadEmbryologist: e.target.value })}
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
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update ART Cycle' : 'Save ART Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
