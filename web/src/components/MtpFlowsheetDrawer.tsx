import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMtpDetails,
  addMtpRound,
  deactivateMtp,
  type MtpActivationRecord,
  type MtpRoundRecord,
} from '../api';
import {
  calculateMtpPackRecommendation,
  evaluateTransfusionTargets,
} from '../bloodMtpEngine';

interface MtpFlowsheetDrawerProps {
  isOpen: boolean;
  mtpId: number;
  onClose: () => void;
  onChanged?: () => void;
}

export function MtpFlowsheetDrawer({
  isOpen,
  mtpId,
  onClose,
  onChanged,
}: MtpFlowsheetDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    mtp: MtpActivationRecord;
    rounds: MtpRoundRecord[];
  } | null>(null);

  // New Round form state
  const [showAddRound, setShowAddRound] = useState(false);
  const [savingRound, setSavingRound] = useState(false);
  const [roundStartTime, setRoundStartTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [prbcIssued, setPrbcIssued] = useState(4);
  const [prbcTransfused, setPrbcTransfused] = useState(4);
  const [ffpIssued, setFfpIssued] = useState(4);
  const [ffpTransfused, setFfpTransfused] = useState(4);
  const [plateletsIssued, setPlateletsIssued] = useState(1);
  const [plateletsTransfused, setPlateletsTransfused] = useState(1);
  const [cryoIssued, setCryoIssued] = useState(0);
  const [cryoTransfused, setCryoTransfused] = useState(0);
  const [tempCelsius, setTempCelsius] = useState<number | ''>(36.2);
  const [heartRate, setHeartRate] = useState<number | ''>(110);
  const [bpSys, setBpSys] = useState<number | ''>(95);
  const [bpDia, setBpDia] = useState<number | ''>(60);
  const [spo2, setSpo2] = useState<number | ''>(98);
  const [hbGDl, setHbGDl] = useState<number | ''>(7.8);
  const [plateletsKUl, setPlateletsKUl] = useState<number | ''>(65);
  const [inr, setInr] = useState<number | ''>(1.4);
  const [fibrinogenMgDl, setFibrinogenMgDl] = useState<number | ''>(180);
  const [ionizedCalcium, setIonizedCalcium] = useState<number | ''>(1.05);
  const [phAbg, setPhAbg] = useState<number | ''>(7.28);
  const [lactateMmolL, setLactateMmolL] = useState<number | ''>(3.2);
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Deactivate modal state
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [outcomeSummary, setOutcomeSummary] = useState('Hemostasis secured surgically. Bleeding controlled. Transferred to ICU hemodynamically stable.');

  const loadData = () => {
    setLoading(true);
    getMtpDetails(mtpId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        alert('Failed to load MTP flowsheet: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !mtpId) return;
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 15000); // 15-second refresh during active resuscitation
    return () => clearInterval(timer);
  }, [isOpen, mtpId]);

  if (!isOpen) return null;

  const mtp = data?.mtp;
  const rounds = data?.rounds || [];
  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;

  // Real-time calculations
  const nextRoundNumber = (mtp?.current_pack_round || 1) + 1;
  const recommendation = calculateMtpPackRecommendation(
    nextRoundNumber,
    latestRound?.fibrinogen_mg_dl,
    latestRound?.ionized_calcium_mmol_l,
  );

  const targetsEvaluation = evaluateTransfusionTargets({
    hbGDl: latestRound?.hb_g_dl,
    plateletsKUl: latestRound?.platelets_k_ul,
    inr: latestRound?.inr,
    fibrinogenMgDl: latestRound?.fibrinogen_mg_dl,
    tempCelsius: latestRound?.temp_celsius,
    ionizedCalciumMmolL: latestRound?.ionized_calcium_mmol_l,
    phAbg: latestRound?.ph_abg,
    lactateMmolL: latestRound?.lactate_mmol_l,
  });

  const handleLogRound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingRound(true);
      await addMtpRound(mtpId, {
        roundNumber: nextRoundNumber,
        roundStartTime,
        prbcIssued: Number(prbcIssued),
        prbcTransfused: Number(prbcTransfused),
        ffpIssued: Number(ffpIssued),
        ffpTransfused: Number(ffpTransfused),
        plateletsIssued: Number(plateletsIssued),
        plateletsTransfused: Number(plateletsTransfused),
        cryoIssued: Number(cryoIssued),
        cryoTransfused: Number(cryoTransfused),
        tempCelsius: tempCelsius !== '' ? Number(tempCelsius) : null,
        heartRate: heartRate !== '' ? Number(heartRate) : null,
        bloodPressureSys: bpSys !== '' ? Number(bpSys) : null,
        bloodPressureDia: bpDia !== '' ? Number(bpDia) : null,
        spo2: spo2 !== '' ? Number(spo2) : null,
        hbGDl: hbGDl !== '' ? Number(hbGDl) : null,
        plateletsKUl: plateletsKUl !== '' ? Number(plateletsKUl) : null,
        inr: inr !== '' ? Number(inr) : null,
        fibrinogenMgDl: fibrinogenMgDl !== '' ? Number(fibrinogenMgDl) : null,
        ionizedCalciumMmolL: ionizedCalcium !== '' ? Number(ionizedCalcium) : null,
        phAbg: phAbg !== '' ? Number(phAbg) : null,
        lactateMmolL: lactateMmolL !== '' ? Number(lactateMmolL) : null,
        clinicalNotes: clinicalNotes || undefined,
      });

      alert(`Round ${nextRoundNumber} logged successfully!`);
      setShowAddRound(false);
      loadData();
      if (onChanged) onChanged();
    } catch (err: any) {
      alert('Failed to log MTP round: ' + err.message);
    } finally {
      setSavingRound(false);
    }
  };

  const handleDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDeactivating(true);
      await deactivateMtp(mtpId, { outcomeSummary });
      alert('Massive Transfusion Protocol deactivated.');
      setShowDeactivate(false);
      loadData();
      if (onChanged) onChanged();
    } catch (err: any) {
      alert('Failed to deactivate MTP: ' + err.message);
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-rose-700 text-white p-4 flex justify-between items-center shadow-inner">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">🩸</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-wide uppercase">
                  Massive Transfusion Protocol (MTP) Resuscitation Flowsheet
                </h2>
                <span className="bg-white text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  Code: {mtp?.mtp_code}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    mtp?.status === 'ACTIVE'
                      ? 'bg-rose-900 text-rose-200 border border-rose-400 animate-pulse'
                      : 'bg-emerald-800 text-emerald-100'
                  }`}
                >
                  {mtp?.status}
                </span>
              </div>
              <div className="text-xs text-rose-100 mt-0.5">
                Patient: <strong className="text-white">{mtp?.patient_name}</strong> (UHID: {mtp?.uhid})
                &nbsp;|&nbsp; Trigger: <strong className="text-white">{mtp?.trigger_reason.replace(/_/g, ' ')}</strong>
                &nbsp;|&nbsp; Activated: {mtp?.activation_time ? new Date(mtp.activation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/mtp/${mtpId}/print`}
              target="_blank"
              className="px-3 py-1.5 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-xs font-bold border border-rose-500 transition-colors flex items-center gap-1"
            >
              <span>🖨️ Print Dossier</span>
            </Link>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-rose-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-5 text-xs">
          {loading && !mtp ? (
            <div className="text-center py-12 text-slate-500 font-semibold">Loading MTP resuscitation record...</div>
          ) : (
            <>
              {/* Cumulative Tally & Ratio Tracker Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm text-center">
                  <div className="text-[10px] uppercase font-bold text-rose-700 tracking-wider">PRBC Transfused</div>
                  <div className="text-2xl font-black text-rose-800 mt-1">{mtp?.total_prbc_transfused || 0} <span className="text-xs font-normal text-slate-500">Units</span></div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm text-center">
                  <div className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">FFP Transfused</div>
                  <div className="text-2xl font-black text-amber-800 mt-1">{mtp?.total_ffp_transfused || 0} <span className="text-xs font-normal text-slate-500">Units</span></div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm text-center">
                  <div className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Platelets</div>
                  <div className="text-2xl font-black text-blue-800 mt-1">{mtp?.total_platelets_transfused || 0} <span className="text-xs font-normal text-slate-500">Adult Doses</span></div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-sm text-center">
                  <div className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">Cryoprecipitate</div>
                  <div className="text-2xl font-black text-purple-800 mt-1">{mtp?.total_cryo_transfused || 0} <span className="text-xs font-normal text-slate-500">Units</span></div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">PRBC : FFP Ratio</div>
                  <div className="text-2xl font-black text-emerald-800 mt-1">
                    {mtp?.total_ffp_transfused ? `1 : ${(mtp.total_ffp_transfused / (mtp.total_prbc_transfused || 1)).toFixed(1)}` : '1 : 1 Target'}
                  </div>
                </div>
              </div>

              {/* Lethal Triad Warning Banner if Present */}
              {targetsEvaluation.lethalTriadPresent && (
                <div className="bg-rose-100 border-2 border-rose-500 text-rose-900 p-3 rounded-xl font-bold flex items-center gap-2.5 animate-pulse">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <div className="uppercase tracking-wider text-xs">LETHAL TRIAD DETECTED: Acidosis + Hypothermia + Coagulopathy!</div>
                    <div className="text-[11px] font-normal text-rose-800">
                      Extreme mortality risk. Focus on damage-control surgery, active patient re-warming, and aggressive fibrinogen replacement.
                    </div>
                  </div>
                </div>
              )}

              {/* Active Pack Guidance Card */}
              {mtp?.status === 'ACTIVE' && (
                <div className="bg-gradient-to-r from-rose-50 to-amber-50 p-4 rounded-xl border border-rose-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-rose-800 text-xs flex items-center gap-1.5">
                      <span>📦</span> Protocol Recommendation: {recommendation.packName}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">
                      Balanced 1:1:1 Ratio Resuscitation
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-bold text-slate-800">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      PRBC: <span className="text-rose-700">{recommendation.prbcUnits} Units</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      FFP: <span className="text-amber-700">{recommendation.ffpUnits} Units</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      Platelets: <span className="text-blue-700">{recommendation.plateletAdultDoses} Adult Dose</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      Cryo: <span className="text-purple-700">{recommendation.cryoUnits} Units</span>
                    </div>
                  </div>

                  <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5 pt-1">
                    {recommendation.actionItems.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Target Parameter Checklist */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Hemostatic Targets & Point-of-Care Surveillance
                  </span>
                  <span className="text-[10px] text-slate-400">Based on latest serial lab checkpoint</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center">
                  {targetsEvaluation.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border text-xs ${
                        m.status === 'optimal'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : m.status === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold text-slate-500">{m.name}</div>
                      <div className="font-extrabold mt-0.5">{m.value}</div>
                      <div className="text-[9px] text-slate-400">Target: {m.target}</div>
                    </div>
                  ))}
                </div>

                {targetsEvaluation.recommendations.length > 0 && (
                  <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-900 space-y-0.5">
                    <strong>Action Required: </strong>
                    {targetsEvaluation.recommendations.join(' • ')}
                  </div>
                )}
              </div>

              {/* Log Next Round Action Bar */}
              {mtp?.status === 'ACTIVE' && (
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800 text-xs">
                    Current Resuscitation Round: Pack {mtp.current_pack_round}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRound(!showAddRound)}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <span>{showAddRound ? '✕ Cancel' : `+ Log Round ${nextRoundNumber} & Labs`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeactivate(true)}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-sm transition-colors"
                    >
                      ✓ Deactivate MTP (Bleeding Controlled)
                    </button>
                  </div>
                </div>
              )}

              {/* Form to Log New Round */}
              {showAddRound && (
                <form
                  onSubmit={handleLogRound}
                  className="bg-white p-5 rounded-xl border border-rose-300 shadow-md space-y-4 animate-in fade-in zoom-in duration-100"
                >
                  <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-xs uppercase">
                      Log Resuscitation Round {nextRoundNumber} (Transfused Units & Labs)
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={roundStartTime}
                        onChange={(e) => setRoundStartTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">PRBC Transfused</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={prbcTransfused}
                        onChange={(e) => setPrbcTransfused(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">FFP Transfused</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={ffpTransfused}
                        onChange={(e) => setFfpTransfused(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Platelets (Adult)</label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={plateletsTransfused}
                        onChange={(e) => setPlateletsTransfused(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cryo Units</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={cryoTransfused}
                        onChange={(e) => setCryoTransfused(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                  </div>

                  {/* Vitals & POC Hemostatic Labs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">Temp (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={tempCelsius}
                        onChange={(e) => setTempCelsius(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">Heart Rate (bpm)</label>
                      <input
                        type="number"
                        value={heartRate}
                        onChange={(e) => setHeartRate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">BP Sys/Dia (mmHg)</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          placeholder="Sys"
                          value={bpSys}
                          onChange={(e) => setBpSys(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-1/2 px-1 py-1.5 border border-slate-300 rounded text-xs text-center"
                        />
                        <input
                          type="number"
                          placeholder="Dia"
                          value={bpDia}
                          onChange={(e) => setBpDia(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-1/2 px-1 py-1.5 border border-slate-300 rounded text-xs text-center"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">Hb (g/dL)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={hbGDl}
                        onChange={(e) => setHbGDl(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">Platelets (k/uL)</label>
                      <input
                        type="number"
                        value={plateletsKUl}
                        onChange={(e) => setPlateletsKUl(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">Fibrinogen (mg/dL)</label>
                      <input
                        type="number"
                        value={fibrinogenMgDl}
                        onChange={(e) => setFibrinogenMgDl(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">INR</label>
                      <input
                        type="number"
                        step="0.1"
                        value={inr}
                        onChange={(e) => setInr(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">iCa (mmol/L)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={ionizedCalcium}
                        onChange={(e) => setIonizedCalcium(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">ABG pH</label>
                      <input
                        type="number"
                        step="0.01"
                        value={phAbg}
                        onChange={(e) => setPhAbg(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">Lactate (mmol/L)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={lactateMmolL}
                        onChange={(e) => setLactateMmolL(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">Clinical Round Notes</label>
                      <input
                        type="text"
                        placeholder="Hemostatic interventions, surgical status..."
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddRound(false)}
                      className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingRound}
                      className="px-5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-bold"
                    >
                      {savingRound ? 'Saving...' : `Record Round ${nextRoundNumber}`}
                    </button>
                  </div>
                </form>
              )}

              {/* Rounds Flowsheet Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs uppercase text-slate-700">
                  Resuscitation Rounds Timeline & Serial Parameters
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-3">Round</th>
                        <th className="py-2.5 px-3">Start Time</th>
                        <th className="py-2.5 px-3">PRBC : FFP</th>
                        <th className="py-2.5 px-3">Plt / Cryo</th>
                        <th className="py-2.5 px-3">Vitals (BP, HR, T)</th>
                        <th className="py-2.5 px-3">POC Labs (Hb, Plt, Fib)</th>
                        <th className="py-2.5 px-3">ABG / Lactate</th>
                        <th className="py-2.5 px-3">Notes & Attending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rounds.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-black text-rose-800 text-xs">Pack {r.round_number}</td>
                          <td className="py-2 px-3 text-slate-700 font-semibold">{r.round_start_time}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {r.prbc_transfused} PRBC : {r.ffp_transfused} FFP
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {r.platelets_transfused} Plt / {r.cryo_transfused} Cryo
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {r.blood_pressure_sys ? `${r.blood_pressure_sys}/${r.blood_pressure_dia} mmHg` : ''}
                            {r.heart_rate ? ` • ${r.heart_rate} bpm` : ''}
                            {r.temp_celsius ? ` • ${r.temp_celsius}°C` : ''}
                          </td>
                          <td className="py-2 px-3 font-medium">
                            {r.hb_g_dl ? `Hb ${r.hb_g_dl}g` : ''}
                            {r.platelets_k_ul ? ` • Plt ${r.platelets_k_ul}k` : ''}
                            {r.fibrinogen_mg_dl ? ` • Fib ${r.fibrinogen_mg_dl}mg` : ''}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {r.ph_abg ? `pH ${r.ph_abg}` : ''}
                            {r.lactate_mmol_l ? ` • Lac ${r.lactate_mmol_l}` : ''}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            <div>{r.clinical_notes || 'Round administered'}</div>
                            <div className="text-[10px] text-slate-400">By {r.recorded_by_name}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deactivate Outcome Box if already deactivated */}
              {mtp?.status === 'DEACTIVATED' && (
                <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>✓</span> Massive Transfusion Protocol Deactivated at {mtp.deactivation_time ? new Date(mtp.deactivation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                  <div className="text-emerald-800 font-medium">
                    Outcome Summary: <span className="font-normal">{mtp.outcome_summary}</span>
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    Deactivated by: {mtp.deactivated_by_name}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
          <div className="text-slate-500">
            Emergency Hemotherapy & Blood Bank Transfusion Monitoring Console
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close Flowsheet
          </button>
        </div>
      </div>

      {/* Deactivation Modal */}
      {showDeactivate && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleDeactivate}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4 text-xs"
          >
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>🛑</span> Deactivate Massive Transfusion Protocol
            </div>
            <p className="text-slate-600">
              Confirm that active surgical hemorrhage has ceased, hemostasis is verified, and patient is stable.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Clinical Outcome Summary & Management Plan *
              </label>
              <textarea
                required
                rows={3}
                value={outcomeSummary}
                onChange={(e) => setOutcomeSummary(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeactivate(false)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deactivating}
                className="px-5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold"
              >
                {deactivating ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
