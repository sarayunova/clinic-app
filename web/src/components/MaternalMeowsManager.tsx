import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { api, type MaternalMeowsEpisode, type MaternalMeowsObservation, type Patient } from '../api';
import { evaluateMeows, evaluateSepsisBundleCompliance, type MeowsInput } from '../meowsScoring';
import { useAuth } from '../auth';

interface Props {
  patient: Patient;
}

export function MaternalMeowsManager({ patient }: Props) {
  const { can } = useAuth();
  const [episodes, setEpisodes] = useState<MaternalMeowsEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<MaternalMeowsEpisode | null>(null);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showObsModal, setShowObsModal] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load episodes
  const loadEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ patientId: number; count: number; episodes: MaternalMeowsEpisode[] }>(
        'GET',
        `/api/patients/${patient.id}/meows-episodes`
      );
      setEpisodes(res.episodes || []);
      if (res.episodes && res.episodes.length > 0 && !selectedEpisodeId) {
        setSelectedEpisodeId(res.episodes[0]!.id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patient.id]);

  // Load detailed episode with observations
  const loadSelectedEpisode = async (id: number) => {
    try {
      const data = await api<MaternalMeowsEpisode>('GET', `/api/meows-episodes/${id}`);
      setSelectedEpisode(data);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    if (selectedEpisodeId) {
      loadSelectedEpisode(selectedEpisodeId);
    } else {
      setSelectedEpisode(null);
    }
  }, [selectedEpisodeId]);

  // Episode form state
  const [episodeType, setEpisodeType] = useState<'antenatal' | 'intrapartum' | 'postpartum' | 'post_op_lscs'>('postpartum');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [highRiskFlags, setHighRiskFlags] = useState('');

  // Observation form state
  const [rr, setRr] = useState('16');
  const [spo2, setSpo2] = useState('98');
  const [suppO2, setSuppO2] = useState(false);
  const [o2Flow, setO2Flow] = useState('0');
  const [tempC, setTempC] = useState('36.8');
  const [sbp, setSbp] = useState('118');
  const [dbp, setDbp] = useState('74');
  const [hr, setHr] = useState('78');
  const [avpu, setAvpu] = useState<'alert' | 'voice' | 'pain' | 'unresponsive' | 'confused_agitated'>('alert');
  const [pain, setPain] = useState('0');
  const [lochia, setLochia] = useState<'normal' | 'scant' | 'heavy_foul_smelling' | 'excessive_clots_hemorrhage'>('normal');
  const [urineMlHr, setUrineMlHr] = useState('45');
  const [proteinuria, setProteinuria] = useState<'nil' | 'trace' | '1+' | '2+' | '3+' | '4+'>('nil');

  // Sepsis fields
  const [infectionSite, setInfectionSite] = useState('');
  const [wbc, setWbc] = useState('');
  const [lactate, setLactate] = useState('');
  const [bundleBloodCultures, setBundleBloodCultures] = useState(false);
  const [bundleLactate, setBundleLactate] = useState(false);
  const [bundleAntibiotics, setBundleAntibiotics] = useState(false);
  const [bundleFluids, setBundleFluids] = useState(false);
  const [bundleO2, setBundleO2] = useState(false);
  const [bundleFoley, setBundleFoley] = useState(false);
  const [bundleNotes, setBundleNotes] = useState('');

  // Escalation & action
  const [escalated, setEscalated] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  // Live MEOWS evaluation
  const liveEval = useMemo(() => {
    return evaluateMeows({
      respiratoryRate: rr ? Number(rr) : null,
      spo2Percent: spo2 ? Number(spo2) : null,
      supplementalO2: suppO2,
      o2FlowRateLpm: o2Flow ? Number(o2Flow) : null,
      temperatureC: tempC ? Number(tempC) : null,
      bpSystolic: sbp ? Number(sbp) : null,
      bpDiastolic: dbp ? Number(dbp) : null,
      heartRate: hr ? Number(hr) : null,
      avpuConsciousness: avpu,
      painScore: Number(pain) || 0,
      lochiaStatus: lochia,
      urineOutputMlHr: urineMlHr ? Number(urineMlHr) : null,
      proteinuria,
      whiteCellCountK: wbc ? Number(wbc) : null,
      serumLactateMmolL: lactate ? Number(lactate) : null,
    });
  }, [rr, spo2, suppO2, o2Flow, tempC, sbp, dbp, hr, avpu, pain, lochia, urineMlHr, proteinuria, wbc, lactate]);

  const bundleEval = useMemo(() => {
    return evaluateSepsisBundleCompliance({
      bloodCulturesTaken: bundleBloodCultures,
      lactateDrawn: bundleLactate,
      ivAntibioticsGiven: bundleAntibiotics,
      ivFluidsBolusGiven: bundleFluids,
      oxygenApplied: bundleO2,
      foleyUrineHourly: bundleFoley,
    });
  }, [bundleBloodCultures, bundleLactate, bundleAntibiotics, bundleFluids, bundleO2, bundleFoley]);

  // Handle start episode
  const handleStartEpisode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        episodeType,
        clinicalIndication: clinicalIndication || null,
        primaryDiagnosis: primaryDiagnosis || null,
        highRiskFlags: highRiskFlags || null,
        status: 'active_monitoring' as const,
      };

      const res = await api<MaternalMeowsEpisode>('POST', `/api/patients/${patient.id}/meows-episodes`, payload);
      setShowEpisodeModal(false);
      await loadEpisodes();
      setSelectedEpisodeId(res.id);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  // Handle log observation
  const handleLogObservation = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEpisodeId) return;
    setBusy(true);
    setError(null);
    try {
      const payload: any = {
        respiratoryRate: rr ? Number(rr) : null,
        spo2Percent: spo2 ? Number(spo2) : null,
        supplementalO2: suppO2,
        o2FlowRateLpm: o2Flow ? Number(o2Flow) : null,
        temperatureC: tempC ? Number(tempC) : null,
        bpSystolic: sbp ? Number(sbp) : null,
        bpDiastolic: dbp ? Number(dbp) : null,
        heartRate: hr ? Number(hr) : null,
        avpuConsciousness: avpu,
        painScore: Number(pain) || 0,
        lochiaStatus: lochia,
        urineOutputMlHr: urineMlHr ? Number(urineMlHr) : null,
        proteinuria,

        actionRequired: liveEval.actionRequired,
        actionTaken: actionNotes || null,
        escalatedToDoctor: escalated,
        escalatedToName: doctorName || null,

        suspectedInfectionSite: infectionSite || null,
        serumLactateMmolL: lactate ? Number(lactate) : null,
        whiteCellCountK: wbc ? Number(wbc) : null,

        bundleBloodCulturesTaken: bundleBloodCultures,
        bundleLactateDrawn: bundleLactate,
        bundleIvAntibioticsGiven: bundleAntibiotics,
        bundleIvFluidsBolusGiven: bundleFluids,
        bundleOxygenApplied: bundleO2,
        bundleFoleyUrineHourly: bundleFoley,
        bundleNotes: bundleNotes || null,
      };

      await api('POST', `/api/meows-episodes/${selectedEpisodeId}/observations`, payload);
      setShowObsModal(false);
      await loadSelectedEpisode(selectedEpisodeId);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  // Handle delete observation
  const handleDeleteObs = async (obsId: number) => {
    if (!confirm('Are you sure you want to delete this MEOWS observation?')) return;
    try {
      await api('DELETE', `/api/meows-observations/${obsId}`);
      if (selectedEpisodeId) await loadSelectedEpisode(selectedEpisodeId);
    } catch (err) {
      setError(err);
    }
  };

  // Handle update status
  const handleUpdateStatus = async (newStatus: 'active_monitoring' | 'stepped_down_stable' | 'transferred_to_hdu_icu' | 'discharged' | 'resolved') => {
    if (!selectedEpisode) return;
    try {
      await api('PUT', `/api/meows-episodes/${selectedEpisode.id}`, {
        ...selectedEpisode,
        status: newStatus,
      });
      await loadEpisodes();
      await loadSelectedEpisode(selectedEpisode.id);
    } catch (err) {
      setError(err);
    }
  };

  // Handle delete episode
  const handleDeleteEpisode = async (episodeId: number) => {
    if (!confirm('Are you sure you want to delete this entire MEOWS episode and all its observations?')) return;
    try {
      await api('DELETE', `/api/meows-episodes/${episodeId}`);
      setSelectedEpisodeId(null);
      await loadEpisodes();
    } catch (err) {
      setError(err);
    }
  };

  const getTriggerClass = (trigger: 'green' | 'yellow' | 'red') => {
    if (trigger === 'red') return 'bg-rose-100 text-rose-800 font-bold border border-rose-300';
    if (trigger === 'yellow') return 'bg-amber-100 text-amber-800 font-bold border border-amber-300';
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌡️</span>
            <h2 className="text-xl font-bold text-slate-800">Maternal Early Obstetric Warning System (MEOWS) &amp; Sepsis (SOS)</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            RCOG / MBRRACE-UK Track-and-Trigger Monitoring, Sepsis in Obstetrics Score (SOS) &amp; 1-Hour Maternal Sepsis Resuscitation Bundle
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEpisodeModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <span>+</span> Start MEOWS Episode
          </button>
          <button
            type="button"
            onClick={loadEpisodes}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {Boolean(error) && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
          <strong>Error:</strong> {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {/* Main Grid: Episodes List & Selected Episode Observations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Episodes List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">MEOWS Monitoring Episodes</h3>
          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">Loading episodes...</div>
          ) : episodes.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
              <span className="text-3xl block mb-2">🤰</span>
              <p className="font-medium">No active MEOWS episodes</p>
              <p className="text-xs text-slate-400 mt-1">Start a MEOWS monitoring episode for high-risk antenatal, intrapartum, or postpartum recovery care.</p>
            </div>
          ) : (
            episodes.map((ep) => {
              const isSelected = ep.id === selectedEpisodeId;
              let statusBadge = 'bg-emerald-100 text-emerald-800';
              if (ep.status === 'transferred_to_hdu_icu') statusBadge = 'bg-rose-100 text-rose-800 font-bold';
              else if (ep.status === 'stepped_down_stable' || ep.status === 'resolved') statusBadge = 'bg-slate-100 text-slate-700';

              return (
                <div
                  key={ep.id}
                  onClick={() => setSelectedEpisodeId(ep.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          {new Date(ep.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                          {new Date(ep.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs uppercase px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700">
                          {ep.episodeType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {ep.clinicalIndication || ep.primaryDiagnosis || 'Routine obstetric surveillance'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-xs">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${statusBadge}`}>
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEpisode(ep.id);
                      }}
                      className="text-rose-600 hover:text-rose-800 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Episode Details & MEOWS Flowsheet */}
        <div className="lg:col-span-8">
          {selectedEpisode ? (
            <div className="space-y-6">
              {/* Episode Header & Status Bar */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800">
                        MEOWS Episode #{selectedEpisode.id} ({selectedEpisode.episodeType.replace(/_/g, ' ').toUpperCase()})
                      </h3>
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 capitalize">
                        {selectedEpisode.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Started: {new Date(selectedEpisode.startedAt).toLocaleString()} • Managed by {selectedEpisode.createdByName || 'Staff'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowObsModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      + Record MEOWS Observation
                    </button>
                  </div>
                </div>

                {/* Indication & High-Risk Flags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-700">Clinical Indication:</span>{' '}
                    <span className="text-slate-600">{selectedEpisode.clinicalIndication || 'General maternal surveillance'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-700">High-Risk Obstetric Flags:</span>{' '}
                    <span className="text-slate-600">{selectedEpisode.highRiskFlags || 'None documented'}</span>
                  </div>
                </div>

                {/* Status Switcher */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                  <span className="font-semibold text-slate-600">Update Episode Status:</span>
                  <select
                    value={selectedEpisode.status}
                    onChange={(e) => handleUpdateStatus(e.target.value as any)}
                    className="text-xs px-2.5 py-1 border rounded-lg bg-white border-slate-300"
                  >
                    <option value="active_monitoring">Active Bedside Monitoring</option>
                    <option value="stepped_down_stable">Stepped Down / Stable on Routine Care</option>
                    <option value="transferred_to_hdu_icu">Transferred to Obstetric HDU / ICU</option>
                    <option value="discharged">Discharged Home</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Serial Observations Table */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Serial MEOWS Observations &amp; Sepsis Triggers</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Track-and-trigger flowsheet with physiological parameters, obstetric triggers, and Sepsis in Obstetrics (SOS) screening
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowObsModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    + Record Observation
                  </button>
                </div>

                {(!selectedEpisode.observations || selectedEpisode.observations.length === 0) ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="font-medium text-slate-600">No MEOWS observations recorded yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Log periodic maternal bedside vitals (RR, SpO2, Temp, BP, HR, AVPU, Lochia, Urine, Proteinuria) to monitor for clinical deterioration.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowObsModal(true)}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Record First MEOWS Observation
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Resp / SpO2</th>
                          <th className="p-2.5">Temp (°C)</th>
                          <th className="p-2.5">BP (mmHg)</th>
                          <th className="p-2.5">Pulse (bpm)</th>
                          <th className="p-2.5">AVPU / Pain</th>
                          <th className="p-2.5">Lochia / Urine</th>
                          <th className="p-2.5">Trigger Summary</th>
                          <th className="p-2.5">SOS Score</th>
                          <th className="p-2.5">Action &amp; Staff</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEpisode.observations.map((obs) => {
                          let alertBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                          if (obs.overallAlertLevel === 'critical_multiple_red') {
                            alertBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse';
                          } else if (obs.overallAlertLevel === 'urgent_two_yellow_one_red') {
                            alertBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
                          } else if (obs.overallAlertLevel === 'single_yellow') {
                            alertBadgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
                          }

                          return (
                            <tr key={obs.id} className="hover:bg-slate-50/70">
                              <td className="p-2.5 font-medium text-slate-800">
                                <div>{new Date(obs.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="text-[10px] text-slate-400">{new Date(obs.recordedAt).toLocaleDateString()}</div>
                              </td>

                              <td className="p-2.5">
                                <div>
                                  <span className={`px-1.5 py-0.5 rounded text-[11px] ${getTriggerClass(obs.rrTrigger)}`}>
                                    RR: {obs.respiratoryRate ?? '-'}
                                  </span>
                                </div>
                                <div className="mt-1">
                                  <span className={`px-1.5 py-0.5 rounded text-[11px] ${getTriggerClass(obs.spo2Trigger)}`}>
                                    SpO2: {obs.spo2Percent != null ? `${obs.spo2Percent}%` : '-'}
                                    {obs.supplementalO2 && ' (+O2)'}
                                  </span>
                                </div>
                              </td>

                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[11px] ${getTriggerClass(obs.tempTrigger)}`}>
                                  {obs.temperatureC != null ? `${obs.temperatureC}°C` : '-'}
                                </span>
                              </td>

                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[11px] ${getTriggerClass(obs.bpTrigger)}`}>
                                  {obs.bpSystolic ?? '-'}/{obs.bpDiastolic ?? '-'}
                                </span>
                              </td>

                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[11px] ${getTriggerClass(obs.hrTrigger)}`}>
                                  {obs.heartRate ?? '-'}
                                </span>
                              </td>

                              <td className="p-2.5 text-slate-600">
                                <div className="capitalize font-semibold">{obs.avpuConsciousness}</div>
                                <div className="text-[10px] text-slate-400">Pain: {obs.painScore}/3</div>
                              </td>

                              <td className="p-2.5 text-slate-600">
                                <div className="capitalize">{obs.lochiaStatus.replace(/_/g, ' ')}</div>
                                <div className="text-[10px] text-slate-400">
                                  Urine: {obs.urineOutputMlHr != null ? `${obs.urineOutputMlHr} mL/h` : 'N/A'} • Prot: {obs.proteinuria}
                                </div>
                              </td>

                              <td className="p-2.5">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs border ${alertBadgeClass}`}>
                                  {obs.redTriggersCount > 0 ? `${obs.redTriggersCount} Red ` : ''}
                                  {obs.yellowTriggersCount > 0 ? `${obs.yellowTriggersCount} Yellow` : obs.redTriggersCount === 0 ? 'Normal' : ''}
                                </span>
                              </td>

                              <td className="p-2.5">
                                {obs.sosScore > 0 ? (
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${obs.sosScore >= 6 ? 'bg-rose-100 text-rose-800 border border-rose-300' : obs.sosScore >= 4 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                                    SOS: {obs.sosScore} ({obs.sosRiskLevel.replace(/_/g, ' ')})
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0 (Low)</span>
                                )}
                              </td>

                              <td className="p-2.5 text-slate-700 max-w-xs">
                                <div>{obs.actionRequired || 'Routine care'}</div>
                                {obs.actionTaken && <div className="text-[10px] text-slate-500 mt-0.5">Taken: {obs.actionTaken}</div>}
                                <div className="text-[10px] text-slate-400 mt-0.5">By {obs.recordedByName || 'Nurse'}</div>
                              </td>

                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteObs(obs.id)}
                                  className="text-slate-400 hover:text-rose-600 text-xs"
                                  title="Delete observation"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              Select or start a MEOWS monitoring episode to view observation charts and sepsis triggers.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Start MEOWS Episode */}
      {showEpisodeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">Start New MEOWS Monitoring Episode</h3>
              <button
                type="button"
                onClick={() => setShowEpisodeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartEpisode} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Episode Phase / Setting</label>
                <select
                  value={episodeType}
                  onChange={(e) => setEpisodeType(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                >
                  <option value="postpartum">Postpartum Ward (Normal Delivery)</option>
                  <option value="post_op_lscs">Post-Operative Recovery (LSCS Delivery)</option>
                  <option value="intrapartum">Intrapartum / Labor Suite</option>
                  <option value="antenatal">Antenatal Ward (High-Risk Inpatient)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Indication</label>
                <input
                  type="text"
                  placeholder="e.g. Day 1 Post-LSCS, Pre-eclampsia monitoring, Fever in labor"
                  value={clinicalIndication}
                  onChange={(e) => setClinicalIndication(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Diagnosis</label>
                <input
                  type="text"
                  placeholder="e.g. P1L1 Day 1 post Emergency LSCS for PROM"
                  value={primaryDiagnosis}
                  onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">High-Risk Obstetric Flags</label>
                <input
                  type="text"
                  placeholder="e.g. Gestational Hypertension, BMI > 35, Chorioamnionitis"
                  value={highRiskFlags}
                  onChange={(e) => setHighRiskFlags(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEpisodeModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Starting...' : 'Start Episode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Serial MEOWS Observation */}
      {showObsModal && selectedEpisode && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🩺</span>
                <h3 className="text-lg font-bold text-slate-800">Record Bedside MEOWS Observation &amp; Sepsis Screen</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowObsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogObservation} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Dynamic Live Score Gauge */}
              <div className="p-4 rounded-xl border bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">MEOWS Composite Evaluation</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded font-bold border ${liveEval.badgeClass}`}>
                      {liveEval.alertTitle}
                    </span>
                    <span className="text-xs text-slate-600">
                      ({liveEval.redCount} Red, {liveEval.yellowCount} Yellow Triggers)
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium mt-1.5">{liveEval.actionRequired}</p>
                </div>

                {liveEval.sosScore > 0 && (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg sm:max-w-xs text-xs">
                    <div className="font-bold text-slate-700">Sepsis in Obstetrics Score (SOS)</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-lg font-black text-rose-700">{liveEval.sosScore}</span>
                      <span className={`px-2 py-0.2 rounded text-[11px] ${liveEval.sosBadgeClass}`}>
                        {liveEval.sosRiskLevel.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Vitals Input Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Core Physiological Vitals</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Resp Rate (/min) • <span className={`text-[10px] px-1 py-0.2 rounded ${getTriggerClass(liveEval.rrTrigger)}`}>{liveEval.rrTrigger.toUpperCase()}</span>
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      placeholder="11-20"
                      value={rr}
                      onChange={(e) => setRr(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SpO2 (%) • <span className={`text-[10px] px-1 py-0.2 rounded ${getTriggerClass(liveEval.spo2Trigger)}`}>{liveEval.spo2Trigger.toUpperCase()}</span>
                    </label>
                    <input
                      type="number"
                      min="40"
                      max="100"
                      placeholder=">=96%"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Temperature (°C) • <span className={`text-[10px] px-1 py-0.2 rounded ${getTriggerClass(liveEval.tempTrigger)}`}>{liveEval.tempTrigger.toUpperCase()}</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="30"
                      max="44"
                      placeholder="36.0-37.4"
                      value={tempC}
                      onChange={(e) => setTempC(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pulse (bpm) • <span className={`text-[10px] px-1 py-0.2 rounded ${getTriggerClass(liveEval.hrTrigger)}`}>{liveEval.hrTrigger.toUpperCase()}</span>
                    </label>
                    <input
                      type="number"
                      min="30"
                      max="220"
                      placeholder="60-99"
                      value={hr}
                      onChange={(e) => setHr(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Systolic BP (mmHg)
                    </label>
                    <input
                      type="number"
                      min="40"
                      max="260"
                      placeholder="100-139"
                      value={sbp}
                      onChange={(e) => setSbp(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Diastolic BP (mmHg) • <span className={`text-[10px] px-1 py-0.2 rounded ${getTriggerClass(liveEval.bpTrigger)}`}>{liveEval.bpTrigger.toUpperCase()}</span>
                    </label>
                    <input
                      type="number"
                      min="20"
                      max="160"
                      placeholder="50-89"
                      value={dbp}
                      onChange={(e) => setDbp(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Consciousness (AVPU)
                    </label>
                    <select
                      value={avpu}
                      onChange={(e) => setAvpu(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    >
                      <option value="alert">Alert (A)</option>
                      <option value="voice">Responds to Voice (V)</option>
                      <option value="pain">Responds only to Pain (P)</option>
                      <option value="unresponsive">Unresponsive (U)</option>
                      <option value="confused_agitated">New Agitation / Confusion</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-4">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={suppO2}
                        onChange={(e) => setSuppO2(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>On Supplemental O2</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Obstetric Specific Parameters */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Obstetric Clinical Indicators</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pain Score (0-3)</label>
                    <select
                      value={pain}
                      onChange={(e) => setPain(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    >
                      <option value="0">0 - None / Comfortable</option>
                      <option value="1">1 - Mild</option>
                      <option value="2">2 - Moderate</option>
                      <option value="3">3 - Severe non-labor pain</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lochia / Vaginal Loss • <span className={`text-[10px] px-1 py-0.2 rounded ${getTriggerClass(liveEval.lochiaTrigger)}`}>{liveEval.lochiaTrigger.toUpperCase()}</span>
                    </label>
                    <select
                      value={lochia}
                      onChange={(e) => setLochia(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    >
                      <option value="normal">Normal / Physiological</option>
                      <option value="scant">Scant</option>
                      <option value="heavy_foul_smelling">Heavy Foul-Smelling (Yellow)</option>
                      <option value="excessive_clots_hemorrhage">Excessive Clots / Hemorrhage (Red)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hourly Urine (mL/hr) • <span className={`text-[10px] px-1 py-0.2 rounded ${getTriggerClass(liveEval.urineTrigger)}`}>{liveEval.urineTrigger.toUpperCase()}</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="1000"
                      placeholder="Normal >= 30"
                      value={urineMlHr}
                      onChange={(e) => setUrineMlHr(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Proteinuria • <span className={`text-[10px] px-1 py-0.2 rounded ${getTriggerClass(liveEval.proteinuriaTrigger)}`}>{liveEval.proteinuriaTrigger.toUpperCase()}</span>
                    </label>
                    <select
                      value={proteinuria}
                      onChange={(e) => setProteinuria(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    >
                      <option value="nil">Nil</option>
                      <option value="trace">Trace</option>
                      <option value="1+">1+ (Yellow)</option>
                      <option value="2+">2+ (Red - Pre-eclampsia)</option>
                      <option value="3+">3+ (Red)</option>
                      <option value="4+">4+ (Red)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sepsis Screening & 1-Hour Bundle */}
              <div className="space-y-3 pt-3 border-t border-slate-100 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                    3. Sepsis in Obstetrics Score (SOS) &amp; 1-Hour Bundle
                  </h4>
                  <span className={`text-xs px-2.5 py-0.5 rounded font-bold border ${liveEval.sosBadgeClass}`}>
                    SOS Score: {liveEval.sosScore} ({liveEval.sosRiskLevel.replace(/_/g, ' ').toUpperCase()})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">Suspected Infection Site</label>
                    <input
                      type="text"
                      placeholder="e.g. Chorioamnionitis, Endometritis, UTI, Wound"
                      value={infectionSite}
                      onChange={(e) => setInfectionSite(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-white border-purple-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">White Cell Count (k/uL)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Normal 4-12"
                      value={wbc}
                      onChange={(e) => setWbc(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-white border-purple-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">Serum Lactate (mmol/L)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder=">=2 is elevated, >=4 critical"
                      value={lactate}
                      onChange={(e) => setLactate(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-white border-purple-200"
                    />
                  </div>
                </div>

                {/* 1-Hour Sepsis Bundle Checklist */}
                <div className="pt-2 border-t border-purple-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-950">1-Hour Sepsis Resuscitation Bundle Checklist:</span>
                    <span className="text-xs font-semibold text-purple-800">
                      {bundleEval.completedCount} / {bundleEval.totalElements} Completed
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-purple-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bundleBloodCultures}
                        onChange={(e) => setBundleBloodCultures(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>1. Blood &amp; local cultures drawn</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-purple-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bundleLactate}
                        onChange={(e) => setBundleLactate(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>2. Serum lactate drawn</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-purple-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bundleAntibiotics}
                        onChange={(e) => setBundleAntibiotics(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>3. Broad-spectrum IV antibiotics</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-purple-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bundleFluids}
                        onChange={(e) => setBundleFluids(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>4. IV fluid bolus (30 mL/kg)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-purple-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bundleO2}
                        onChange={(e) => setBundleO2(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>5. High-flow O2 applied</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-purple-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bundleFoley}
                        onChange={(e) => setBundleFoley(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>6. Foley catheter (hourly urometer)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Escalation & Actions */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">4. Medical Escalation &amp; Plan</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={escalated}
                        onChange={(e) => setEscalated(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Escalated to Obstetrician / Doctor</span>
                    </label>
                    {escalated && (
                      <input
                        type="text"
                        placeholder="Doctor's name"
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 border rounded-lg border-slate-300"
                      />
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Actions taken (e.g. IV fluids started, cannula flushed, repeat vitals in 30m)"
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowObsModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save MEOWS Observation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
