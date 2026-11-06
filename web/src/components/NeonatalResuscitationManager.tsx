import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { api, type NeonatalResuscitationEvent, type NeonatalNewsObservation, type Me } from '../api';
import {
  calculateApgarScore,
  calculateSilvermanScore,
  calculateNeonatalNews,
  evaluateNeonatalGlucose,
  evaluateNrpChecklist,
  type ApgarComponents,
  type SilvermanComponents,
  type NewsInput,
} from '../neonatalScoring';
import { useAuth } from '../auth';

interface Props {
  patientId: number;
}

export function NeonatalResuscitationManager({ patientId }: Props) {
  const { can } = useAuth();
  const [events, setEvents] = useState<NeonatalResuscitationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NeonatalResuscitationEvent | null>(null);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load events
  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ patientId: number; count: number; events: NeonatalResuscitationEvent[] }>(
        'GET',
        `/api/patients/${patientId}/neonatal-resuscitations`
      );
      setEvents(res.events || []);
      if (res.events && res.events.length > 0 && !selectedEventId) {
        setSelectedEventId(res.events[0]!.id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [patientId]);

  // Load selected event details with NEW-S observations
  const loadSelectedEvent = async (id: number) => {
    try {
      const data = await api<NeonatalResuscitationEvent>('GET', `/api/neonatal-resuscitations/${id}`);
      setSelectedEvent(data);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      loadSelectedEvent(selectedEventId);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId]);

  // Event creation form state
  const [formDeliveryTimestamp, setFormDeliveryTimestamp] = useState(() => new Date().toISOString().slice(0, 16));
  const [formGestationWeeks, setFormGestationWeeks] = useState('39');
  const [formGestationDays, setFormGestationDays] = useState('2');
  const [formBirthWeightGrams, setFormBirthWeightGrams] = useState('3200');
  const [formBabyGender, setFormBabyGender] = useState<'female' | 'male' | 'ambiguous' | 'unspecified'>('unspecified');
  const [formDeliveryMode, setFormDeliveryMode] = useState<'vaginal' | 'cesarean' | 'assisted_vacuum_forceps'>('vaginal');
  const [formLiquor, setFormLiquor] = useState<'clear' | 'meconium_thin' | 'meconium_thick' | 'blood_stained' | 'absent'>('clear');

  // APGAR 1m
  const [apgar1m, setApgar1m] = useState<ApgarComponents>({
    heartRate: 2,
    respiratoryEffort: 2,
    muscleTone: 2,
    reflexIrritability: 2,
    color: 1,
  });

  // APGAR 5m
  const [apgar5m, setApgar5m] = useState<ApgarComponents>({
    heartRate: 2,
    respiratoryEffort: 2,
    muscleTone: 2,
    reflexIrritability: 2,
    color: 2,
  });

  // APGAR 10m
  const [hasApgar10m, setHasApgar10m] = useState(false);
  const [apgar10m, setApgar10m] = useState<ApgarComponents>({
    heartRate: 2,
    respiratoryEffort: 2,
    muscleTone: 2,
    reflexIrritability: 2,
    color: 2,
  });

  // Silverman-Anderson Retraction Score
  const [sas, setSas] = useState<SilvermanComponents>({
    thoracoabdominalMovement: 0,
    intercostalRetraction: 0,
    xiphoidRetraction: 0,
    naresDilation: 0,
    expiratoryGrunt: 0,
  });

  // NRP Checklist
  const [initialStepsDone, setInitialStepsDone] = useState(true);
  const [delayedClampingSec, setDelayedClampingSec] = useState('60');
  const [tempMethod, setTempMethod] = useState<'skin_to_skin' | 'radiant_warmer' | 'plastic_wrap_preterm' | 'transwarmer_mattress' | 'incubator'>('radiant_warmer');
  const [initialTempC, setInitialTempC] = useState('36.8');
  const [meconiumMgmt, setMeconiumMgmt] = useState<'not_applicable' | 'vigorous_routine_care' | 'non_vigorous_bulb_suction' | 'endotracheal_suctioning'>('not_applicable');
  const [suppO2, setSuppO2] = useState(false);
  const [fio2Pct, setFio2Pct] = useState('21');
  const [ppvDone, setPpvDone] = useState(false);
  const [ppvDevice, setPpvDevice] = useState<'t_piece_resuscitator' | 'self_inflating_bag' | 'flow_inflating_bag'>('t_piece_resuscitator');
  const [ppvStartSec, setPpvStartSec] = useState('45');
  const [mrSopaDone, setMrSopaDone] = useState(false);
  const [lmaOrEtt, setLmaOrEtt] = useState<'none' | 'lma_size_1' | 'ett_oral' | 'ett_nasal'>('none');
  const [compressionsDone, setCompressionsDone] = useState(false);
  const [compressionsSec, setCompressionsSec] = useState('0');
  const [epiGiven, setEpiGiven] = useState(false);
  const [epiDoseMg, setEpiDoseMg] = useState('0');
  const [volGiven, setVolGiven] = useState(false);
  const [volMl, setVolMl] = useState('0');

  // Hypoglycemia
  const [atRiskHypoglycemia, setAtRiskHypoglycemia] = useState(false);
  const [hypoReason, setHypoReason] = useState('');
  const [initialGlucose, setInitialGlucose] = useState('');
  const [glucoseAction, setGlucoseAction] = useState<'none' | 'early_breastfeeding' | 'supplemental_formula_ebm' | 'dextrose_10pct_bolus_infusion'>('none');

  // Outcome
  const [outcome, setOutcome] = useState<'routine_maternal_side' | 'postnatal_ward_observation' | 'sncu_level_2' | 'nicu_level_3' | 'neonatal_death'>('routine_maternal_side');
  const [phCord, setPhCord] = useState('');
  const [beCord, setBeCord] = useState('');
  const [pediatrician, setPediatrician] = useState('');
  const [nurse, setNurse] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  // Calculations for live previews
  const apgar1mEval = useMemo(() => calculateApgarScore(apgar1m), [apgar1m]);
  const apgar5mEval = useMemo(() => calculateApgarScore(apgar5m), [apgar5m]);
  const apgar10mEval = useMemo(() => calculateApgarScore(apgar10m), [apgar10m]);
  const sasEval = useMemo(() => calculateSilvermanScore(sas), [sas]);
  const nrpGuidance = useMemo(() => {
    return evaluateNrpChecklist({
      apgar1mTotal: apgar1mEval.total,
      initialStepsDone,
      heartRateUnder100: apgar1m.heartRate < 2,
      apneicOrGasping: apgar1m.respiratoryEffort < 2,
      ppvInitiated: ppvDone,
      ppvStartSeconds: ppvStartSec ? Number(ppvStartSec) : null,
      chestNotMovingOrHrUnder100AfterPpv: mrSopaDone,
      hrUnder60AfterEffectivePpv: compressionsDone,
    });
  }, [apgar1mEval.total, initialStepsDone, apgar1m, ppvDone, ppvStartSec, mrSopaDone, compressionsDone]);

  // NEW-S Observation Form State
  const [newsPostnatalHours, setNewsPostnatalHours] = useState('1');
  const [newsHr, setNewsHr] = useState('136');
  const [newsRr, setNewsRr] = useState('48');
  const [newsTemp, setNewsTemp] = useState('36.7');
  const [newsSpo2, setNewsSpo2] = useState('98');
  const [newsO2, setNewsO2] = useState(false);
  const [newsColor, setNewsColor] = useState<'pink' | 'acrocyanosis' | 'pallor' | 'central_cyanosis' | 'jaundice_early'>('pink');
  const [newsTone, setNewsTone] = useState<'normal_active' | 'mildly_floppy_jittery' | 'lethargic_poor_suck' | 'severely_hypotonic_seizures'>('normal_active');
  const [newsGrunt, setNewsGrunt] = useState<'none' | 'intermittent_audible_stethoscope' | 'persistent_audible_naked_ear'>('none');
  const [newsGlucose, setNewsGlucose] = useState('');
  const [newsFeeding, setNewsFeeding] = useState<'breastfeeding_well' | 'poor_latch' | 'expressed_breast_milk' | 'formula' | 'npo_iv_fluids'>('breastfeeding_well');
  const [newsAction, setNewsAction] = useState('');

  const liveNewsEval = useMemo(() => {
    return calculateNeonatalNews({
      heartRate: newsHr ? Number(newsHr) : null,
      respiratoryRate: newsRr ? Number(newsRr) : null,
      temperatureC: newsTemp ? Number(newsTemp) : null,
      spo2Percent: newsSpo2 ? Number(newsSpo2) : null,
      supplementalOxygen: newsO2,
      color: newsColor,
      toneNeurology: newsTone,
      gruntingStridor: newsGrunt,
    });
  }, [newsHr, newsRr, newsTemp, newsSpo2, newsO2, newsColor, newsTone, newsGrunt]);

  const liveGlucoseEval = useMemo(() => {
    if (!newsGlucose) return null;
    return evaluateNeonatalGlucose(Number(newsPostnatalHours) || 0, Number(newsGlucose));
  }, [newsPostnatalHours, newsGlucose]);

  // Create event handler
  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: any = {
        deliveryTimestamp: new Date(formDeliveryTimestamp).toISOString(),
        gestationalAgeWeeks: formGestationWeeks ? Number(formGestationWeeks) : null,
        gestationalAgeDays: formGestationDays ? Number(formGestationDays) : null,
        birthWeightGrams: formBirthWeightGrams ? Number(formBirthWeightGrams) : null,
        babyGender: formBabyGender,
        deliveryMode: formDeliveryMode,
        liquorAppearance: formLiquor,

        apgar1mHeartRate: apgar1m.heartRate,
        apgar1mRespiratoryEffort: apgar1m.respiratoryEffort,
        apgar1mMuscleTone: apgar1m.muscleTone,
        apgar1mReflexIrritability: apgar1m.reflexIrritability,
        apgar1mColor: apgar1m.color,
        apgar1mTotal: apgar1mEval.total,

        apgar5mHeartRate: apgar5m.heartRate,
        apgar5mRespiratoryEffort: apgar5m.respiratoryEffort,
        apgar5mMuscleTone: apgar5m.muscleTone,
        apgar5mReflexIrritability: apgar5m.reflexIrritability,
        apgar5mColor: apgar5m.color,
        apgar5mTotal: apgar5mEval.total,

        apgar10mHeartRate: hasApgar10m ? apgar10m.heartRate : null,
        apgar10mRespiratoryEffort: hasApgar10m ? apgar10m.respiratoryEffort : null,
        apgar10mMuscleTone: hasApgar10m ? apgar10m.muscleTone : null,
        apgar10mReflexIrritability: hasApgar10m ? apgar10m.reflexIrritability : null,
        apgar10mColor: hasApgar10m ? apgar10m.color : null,
        apgar10mTotal: hasApgar10m ? apgar10mEval.total : null,

        sasThoracoabdominalMovement: sas.thoracoabdominalMovement,
        sasIntercostalRetraction: sas.intercostalRetraction,
        sasXiphoidRetraction: sas.xiphoidRetraction,
        sasNaresDilation: sas.naresDilation,
        sasExpiratoryGrunt: sas.expiratoryGrunt,
        sasTotalScore: sasEval.total,
        sasDistressSeverity: sasEval.severity,

        initialStepsCompleted: initialStepsDone,
        delayedCordClampingSeconds: delayedClampingSec ? Number(delayedClampingSec) : null,
        temperatureControlMethod: tempMethod,
        initialTemperatureC: initialTempC ? Number(initialTempC) : null,
        meconiumManagement: meconiumMgmt,
        supplementalOxygenGiven: suppO2,
        targetFio2Percent: fio2Pct ? Number(fio2Pct) : 21,
        ppvInitiated: ppvDone,
        ppvDevice: ppvDone ? ppvDevice : null,
        ppvStartSeconds: ppvDone && ppvStartSec ? Number(ppvStartSec) : null,
        mrSopaStepsRequired: mrSopaDone,
        laryngealMaskOrEttUsed: lmaOrEtt,
        chestCompressionsPerformed: compressionsDone,
        chestCompressionsDurationSeconds: compressionsDone && compressionsSec ? Number(compressionsSec) : 0,
        epinephrineGiven: epiGiven,
        epinephrineDoseMg: epiGiven && epiDoseMg ? Number(epiDoseMg) : 0,
        volumeExpanderGiven: volGiven,
        volumeExpanderMl: volGiven && volMl ? Number(volMl) : 0,

        atRiskHypoglycemia: atRiskHypoglycemia,
        hypoglycemiaRiskReason: hypoReason || null,
        initialBloodGlucoseMgDl: initialGlucose ? Number(initialGlucose) : null,
        glucoseManagementAction: glucoseAction,

        primaryResuscitationOutcome: outcome,
        cordBloodGasPh: phCord ? Number(phCord) : null,
        cordBloodGasBe: beCord ? Number(beCord) : null,
        pediatricianAttending: pediatrician || null,
        resuscitationNurse: nurse || null,
        notes: eventNotes || null,
      };

      const created = await api<NeonatalResuscitationEvent>('POST', `/api/patients/${patientId}/neonatal-resuscitations`, payload);
      setShowEventModal(false);
      await loadEvents();
      setSelectedEventId(created.id);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  // Add NEW-S observation handler
  const handleAddNews = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;
    setBusy(true);
    setError(null);
    try {
      const payload: any = {
        postnatalAgeHours: newsPostnatalHours ? Number(newsPostnatalHours) : null,
        heartRateBpm: newsHr ? Number(newsHr) : null,
        hrScore: liveNewsEval.hrScore,
        respiratoryRateBpm: newsRr ? Number(newsRr) : null,
        rrScore: liveNewsEval.rrScore,
        temperatureC: newsTemp ? Number(newsTemp) : null,
        tempScore: liveNewsEval.tempScore,
        spo2Percent: newsSpo2 ? Number(newsSpo2) : null,
        spo2Score: liveNewsEval.spo2Score,
        supplementalOxygen: newsO2,
        oxygenScore: liveNewsEval.oxygenScore,
        color: newsColor,
        colorScore: liveNewsEval.colorScore,
        toneNeurology: newsTone,
        toneScore: liveNewsEval.toneScore,
        gruntingStridor: newsGrunt,
        gruntingScore: liveNewsEval.gruntingScore,
        totalNewsScore: liveNewsEval.totalScore,
        alertSeverity: liveNewsEval.alertSeverity,
        bloodGlucoseMgDl: newsGlucose ? Number(newsGlucose) : null,
        feedingStatus: newsFeeding || null,
        clinicalActionTaken: newsAction || liveNewsEval.clinicalAction,
      };

      await api('POST', `/api/neonatal-resuscitations/${selectedEventId}/news`, payload);
      setShowNewsModal(false);
      await loadSelectedEvent(selectedEventId);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  // Delete observation handler
  const handleDeleteNews = async (obsId: number) => {
    if (!confirm('Are you sure you want to delete this NEW-S observation?')) return;
    try {
      await api('DELETE', `/api/neonatal-news/${obsId}`);
      if (selectedEventId) await loadSelectedEvent(selectedEventId);
    } catch (err) {
      setError(err);
    }
  };

  // Delete event handler
  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to permanently delete this neonatal resuscitation record and all its NEW-S observations?')) return;
    try {
      await api('DELETE', `/api/neonatal-resuscitations/${eventId}`);
      setSelectedEventId(null);
      await loadEvents();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">👶</span>
            <h2 className="text-xl font-bold text-slate-800">Newborn Early Warning Score (NEWS) & Golden Minute Resuscitation</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            NRP 8th Edition Resuscitation Timeline, APGAR (1, 5, 10 min), Silverman-Anderson Retraction Score, Hypoglycemia Protocol & Serial NEW-S Chart
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEventModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <span>+</span> Record Birth Resuscitation
          </button>
          <button
            type="button"
            onClick={loadEvents}
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

      {/* Main Grid: Events List & Selected Event Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Events List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Birth Resuscitation Episodes</h3>
          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">Loading records...</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
              <span className="text-3xl block mb-2">👶</span>
              <p className="font-medium">No neonatal resuscitation records</p>
              <p className="text-xs text-slate-400 mt-1">Document the delivery transition, APGAR scores, and golden minute resuscitation steps.</p>
            </div>
          ) : (
            events.map((ev) => {
              const isSelected = ev.id === selectedEventId;
              const apgar1mBadge = calculateApgarScore({
                heartRate: ev.apgar1mHeartRate,
                respiratoryEffort: ev.apgar1mRespiratoryEffort,
                muscleTone: ev.apgar1mMuscleTone,
                reflexIrritability: ev.apgar1mReflexIrritability,
                color: ev.apgar1mColor,
              });
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
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
                          {new Date(ev.deliveryTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                          {new Date(ev.deliveryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs uppercase px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700">
                          {ev.deliveryMode}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Gestation: {ev.gestationalAgeWeeks ? `${ev.gestationalAgeWeeks}w ${ev.gestationalAgeDays || 0}d` : 'Unknown'} •{' '}
                        Weight: {ev.birthWeightGrams ? `${ev.birthWeightGrams}g` : 'Not recorded'} •{' '}
                        Sex: <span className="capitalize">{ev.babyGender}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold border ${apgar1mBadge.badgeClass}`}>
                      APGAR 1m: {ev.apgar1mTotal}/10
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                      5m: {ev.apgar5mTotal}/10
                    </span>
                    {ev.sasTotalScore > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded font-bold border bg-amber-50 text-amber-800 border-amber-200">
                        SAS: {ev.sasTotalScore}/10 ({ev.sasDistressSeverity})
                      </span>
                    )}
                    {ev.ppvInitiated && (
                      <span className="text-xs px-2 py-0.5 rounded font-bold border bg-indigo-50 text-indigo-800 border-indigo-200">
                        PPV Done
                      </span>
                    )}
                    {ev.chestCompressionsPerformed && (
                      <span className="text-xs px-2 py-0.5 rounded font-bold border bg-rose-50 text-rose-800 border-rose-200">
                        Compressions
                      </span>
                    )}
                    {ev.atRiskHypoglycemia && (
                      <span className="text-xs px-2 py-0.5 rounded font-bold border bg-purple-50 text-purple-800 border-purple-200">
                        At-Risk Glucose
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100">
                    <span className="capitalize font-medium text-slate-700">
                      Disposition: {ev.primaryResuscitationOutcome.replace(/_/g, ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(ev.id);
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

        {/* Right Column: Selected Resuscitation Event Details & NEW-S Chart */}
        <div className="lg:col-span-8">
          {selectedEvent ? (
            <div className="space-y-6">
              {/* Event Overview Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800">
                        Neonatal Delivery & Resuscitation Episode #{selectedEvent.id}
                      </h3>
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 capitalize">
                        {selectedEvent.primaryResuscitationOutcome.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Delivered: {new Date(selectedEvent.deliveryTimestamp).toLocaleString()} • Documented by {selectedEvent.createdByName || 'Staff'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/neonatal-resuscitations/${selectedEvent.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      🖨️ Print Chart
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowNewsModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      + Add NEW-S Observation
                    </button>
                  </div>
                </div>

                {/* Scores Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* APGAR Card */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">APGAR Profile</div>
                    <div className="flex items-baseline gap-3 mt-1">
                      <div>
                        <span className="text-2xl font-black text-slate-800">{selectedEvent.apgar1mTotal}</span>
                        <span className="text-xs text-slate-500">/10 (1m)</span>
                      </div>
                      <div className="text-slate-300 font-light">|</div>
                      <div>
                        <span className="text-2xl font-black text-emerald-700">{selectedEvent.apgar5mTotal}</span>
                        <span className="text-xs text-slate-500">/10 (5m)</span>
                      </div>
                      {selectedEvent.apgar10mTotal != null && (
                        <>
                          <div className="text-slate-300 font-light">|</div>
                          <div>
                            <span className="text-2xl font-black text-indigo-700">{selectedEvent.apgar10mTotal}</span>
                            <span className="text-xs text-slate-500">/10 (10m)</span>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {calculateApgarScore({
                        heartRate: selectedEvent.apgar1mHeartRate,
                        respiratoryEffort: selectedEvent.apgar1mRespiratoryEffort,
                        muscleTone: selectedEvent.apgar1mMuscleTone,
                        reflexIrritability: selectedEvent.apgar1mReflexIrritability,
                        color: selectedEvent.apgar1mColor,
                      }).label}
                    </p>
                  </div>

                  {/* Silverman-Anderson Retraction Score Card */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Silverman-Anderson (SAS)</div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-800">{selectedEvent.sasTotalScore}</span>
                      <span className="text-xs text-slate-500">/10</span>
                      <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                        {selectedEvent.sasDistressSeverity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {calculateSilvermanScore({
                        thoracoabdominalMovement: selectedEvent.sasThoracoabdominalMovement,
                        intercostalRetraction: selectedEvent.sasIntercostalRetraction,
                        xiphoidRetraction: selectedEvent.sasXiphoidRetraction,
                        naresDilation: selectedEvent.sasNaresDilation,
                        expiratoryGrunt: selectedEvent.sasExpiratoryGrunt,
                      }).guidance}
                    </p>
                  </div>

                  {/* Golden Minute & NRP Card */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">NRP Resuscitation Steps</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${selectedEvent.initialStepsCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {selectedEvent.initialStepsCompleted ? '✓ Initial Steps' : 'Initial Steps Incomplete'}
                      </span>
                      {selectedEvent.ppvInitiated ? (
                        <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-indigo-100 text-indigo-800">
                          ✓ PPV ({selectedEvent.ppvStartSeconds}s)
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-600">No PPV</span>
                      )}
                      {selectedEvent.mrSopaStepsRequired && (
                        <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800">MR. SOPA</span>
                      )}
                      {selectedEvent.chestCompressionsPerformed && (
                        <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-rose-100 text-rose-800">
                          Compressions ({selectedEvent.chestCompressionsDurationSeconds}s)
                        </span>
                      )}
                      {selectedEvent.epinephrineGiven && (
                        <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-rose-200 text-rose-900">
                          Epinephrine {selectedEvent.epinephrineDoseMg}mg
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1.5">
                      Cord clamp: {selectedEvent.delayedCordClampingSeconds || 0}s • Temp: {selectedEvent.initialTemperatureC ? `${selectedEvent.initialTemperatureC}°C` : 'N/A'} ({selectedEvent.temperatureControlMethod.replace(/_/g, ' ')})
                    </div>
                  </div>
                </div>

                {/* Glycemia & Cord Gas Sub-section */}
                {(selectedEvent.atRiskHypoglycemia || selectedEvent.cordBloodGasPh != null || selectedEvent.notes) && (
                  <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-lg text-xs text-purple-900 space-y-1">
                    {selectedEvent.atRiskHypoglycemia && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold">⚠️ At-Risk Hypoglycemia:</span>
                        <span>{selectedEvent.hypoglycemiaRiskReason || 'Clinical risk protocol activated'}</span>
                        {selectedEvent.initialBloodGlucoseMgDl != null && (
                          <span className="px-1.5 py-0.5 bg-white border border-purple-200 rounded font-semibold">
                            Initial BG: {selectedEvent.initialBloodGlucoseMgDl} mg/dL ({selectedEvent.glucoseManagementAction.replace(/_/g, ' ')})
                          </span>
                        )}
                      </div>
                    )}
                    {(selectedEvent.cordBloodGasPh != null || selectedEvent.cordBloodGasBe != null) && (
                      <div>
                        <span className="font-bold">Cord Blood Gas:</span> pH {selectedEvent.cordBloodGasPh ?? 'N/A'}, Base Excess {selectedEvent.cordBloodGasBe ? `${selectedEvent.cordBloodGasBe} mmol/L` : 'N/A'}
                      </div>
                    )}
                    {selectedEvent.notes && (
                      <div>
                        <span className="font-bold">Notes:</span> {selectedEvent.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Serial NEW-S Observations Table */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Serial Newborn Early Warning (NEW-S) Chart</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bedside Track-and-Trigger monitoring for early detection of neonatal clinical deterioration
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewsModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    + Record Observation
                  </button>
                </div>

                {(!selectedEvent.newsObservations || selectedEvent.newsObservations.length === 0) ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="font-medium text-slate-600">No NEW-S observations recorded yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Log periodic bedside vitals (HR, RR, Temp, SpO2, Color, Tone, Grunting, Blood Glucose) to track early warning score.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowNewsModal(true)}
                      className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Record First NEW-S Observation
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                          <th className="p-2.5">Time / Age</th>
                          <th className="p-2.5">Heart Rate</th>
                          <th className="p-2.5">Resp Rate</th>
                          <th className="p-2.5">Temp (°C)</th>
                          <th className="p-2.5">SpO2 / O2</th>
                          <th className="p-2.5">Color / Tone / Grunt</th>
                          <th className="p-2.5">Glucose</th>
                          <th className="p-2.5">Score / Severity</th>
                          <th className="p-2.5">Action & Nurse</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEvent.newsObservations.map((obs) => {
                          let badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                          if (obs.alertSeverity === 'red_high') badgeBg = 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';
                          else if (obs.alertSeverity === 'yellow_medium') badgeBg = 'bg-amber-100 text-amber-800 border-amber-300';

                          return (
                            <tr key={obs.id} className="hover:bg-slate-50/70">
                              <td className="p-2.5 font-medium text-slate-800">
                                <div>{new Date(obs.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="text-[10px] text-slate-400">
                                  {obs.postnatalAgeHours != null ? `${obs.postnatalAgeHours}h post-birth` : new Date(obs.recordedAt).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="p-2.5">
                                <span className={obs.hrScore >= 3 ? 'font-bold text-rose-600' : obs.hrScore === 1 ? 'text-amber-700' : 'text-slate-800'}>
                                  {obs.heartRateBpm ?? '-'} bpm
                                </span>
                              </td>
                              <td className="p-2.5">
                                <span className={obs.rrScore >= 3 ? 'font-bold text-rose-600' : obs.rrScore === 1 ? 'text-amber-700' : 'text-slate-800'}>
                                  {obs.respiratoryRateBpm ?? '-'} /min
                                </span>
                              </td>
                              <td className="p-2.5">
                                <span className={obs.tempScore >= 3 ? 'font-bold text-rose-600' : obs.tempScore === 1 ? 'text-amber-700' : 'text-slate-800'}>
                                  {obs.temperatureC != null ? `${obs.temperatureC}°C` : '-'}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <div>
                                  <span className={obs.spo2Score >= 3 ? 'font-bold text-rose-600' : 'text-slate-800'}>
                                    {obs.spo2Percent != null ? `${obs.spo2Percent}%` : '-'}
                                  </span>
                                  {obs.supplementalOxygen && (
                                    <span className="ml-1 text-[10px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 font-semibold">
                                      +O2
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 text-slate-600">
                                <div className="capitalize">{obs.color.replace(/_/g, ' ')}</div>
                                <div className="text-[10px] text-slate-400 capitalize">
                                  Tone: {obs.toneNeurology.replace(/_/g, ' ')} • Grunt: {obs.gruntingStridor.replace(/_/g, ' ')}
                                </div>
                              </td>
                              <td className="p-2.5">
                                {obs.bloodGlucoseMgDl != null ? (
                                  <span className={`font-semibold ${obs.bloodGlucoseMgDl < 40 ? 'text-rose-600' : 'text-slate-700'}`}>
                                    {obs.bloodGlucoseMgDl} mg/dL
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${badgeBg}`}>
                                  Score: {obs.totalNewsScore} ({obs.alertSeverity.replace(/_/g, ' ')})
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-700 max-w-xs">
                                <div>{obs.clinicalActionTaken || 'Routine observations'}</div>
                                <div className="text-[10px] text-slate-400">By {obs.recordedByName || 'Nurse'}</div>
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNews(obs.id)}
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
              Select or record a birth resuscitation episode to view APGAR scores and serial NEW-S observations.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Create Neonatal Resuscitation Episode */}
      {showEventModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">👶</span>
                <h3 className="text-lg font-bold text-slate-800">Record Neonatal Delivery & Golden Minute Resuscitation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Delivery Context */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Delivery Context & Timing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formDeliveryTimestamp}
                      onChange={(e) => setFormDeliveryTimestamp(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gestational Age (wks + days)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="20"
                        max="44"
                        placeholder="Weeks"
                        value={formGestationWeeks}
                        onChange={(e) => setFormGestationWeeks(e.target.value)}
                        className="w-1/2 text-xs px-3 py-2 border rounded-lg border-slate-300"
                      />
                      <input
                        type="number"
                        min="0"
                        max="6"
                        placeholder="Days"
                        value={formGestationDays}
                        onChange={(e) => setFormGestationDays(e.target.value)}
                        className="w-1/2 text-xs px-3 py-2 border rounded-lg border-slate-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Birth Weight (grams)</label>
                    <input
                      type="number"
                      min="300"
                      max="7000"
                      placeholder="e.g. 3200"
                      value={formBirthWeightGrams}
                      onChange={(e) => setFormBirthWeightGrams(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={formBabyGender}
                      onChange={(e) => setFormBabyGender(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    >
                      <option value="unspecified">Unspecified / Unknown</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="ambiguous">Ambiguous</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Mode</label>
                    <select
                      value={formDeliveryMode}
                      onChange={(e) => setFormDeliveryMode(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    >
                      <option value="vaginal">Normal Vaginal Delivery</option>
                      <option value="cesarean">Cesarean Section (LSCS)</option>
                      <option value="assisted_vacuum_forceps">Assisted (Vacuum / Forceps)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amniotic Fluid / Liquor</label>
                    <select
                      value={formLiquor}
                      onChange={(e) => setFormLiquor(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    >
                      <option value="clear">Clear / Normal</option>
                      <option value="meconium_thin">Thin Meconium Stained</option>
                      <option value="meconium_thick">Thick Pea-soup Meconium</option>
                      <option value="blood_stained">Blood Stained</option>
                      <option value="absent">Absent / Anhydramnios</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* APGAR 1 Minute & 5 Minute Scores */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">2. APGAR Scoring (1 & 5 Minutes)</h4>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded font-bold border ${apgar1mEval.badgeClass}`}>
                      1m Total: {apgar1mEval.total}/10 ({apgar1mEval.label})
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded font-bold border ${apgar5mEval.badgeClass}`}>
                      5m Total: {apgar5mEval.total}/10 ({apgar5mEval.label})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1 Minute APGAR Picker */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="font-bold text-xs text-slate-700 uppercase">1-Minute APGAR Breakdown</div>
                    
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Heart Rate</label>
                      <select
                        value={apgar1m.heartRate}
                        onChange={(e) => setApgar1m({ ...apgar1m, heartRate: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - Absent</option>
                        <option value={1}>1 - Slow (&lt; 100 bpm)</option>
                        <option value={2}>2 - &gt;= 100 bpm</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Respiratory Effort</label>
                      <select
                        value={apgar1m.respiratoryEffort}
                        onChange={(e) => setApgar1m({ ...apgar1m, respiratoryEffort: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - Absent / Apneic</option>
                        <option value={1}>1 - Slow, irregular, gasping</option>
                        <option value={2}>2 - Good strong vigorous cry</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Muscle Tone</label>
                      <select
                        value={apgar1m.muscleTone}
                        onChange={(e) => setApgar1m({ ...apgar1m, muscleTone: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - Flaccid / Limp</option>
                        <option value={1}>1 - Some flexion of extremities</option>
                        <option value={2}>2 - Active motion / Well-flexed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reflex Irritability</label>
                      <select
                        value={apgar1m.reflexIrritability}
                        onChange={(e) => setApgar1m({ ...apgar1m, reflexIrritability: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - No response</option>
                        <option value={1}>1 - Grimace / Weak response</option>
                        <option value={2}>2 - Vigorous cry, sneeze, cough</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Color</label>
                      <select
                        value={apgar1m.color}
                        onChange={(e) => setApgar1m({ ...apgar1m, color: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - Blue all over / Pale</option>
                        <option value={1}>1 - Body pink, extremities blue (Acrocyanosis)</option>
                        <option value={2}>2 - Completely pink all over</option>
                      </select>
                    </div>
                  </div>

                  {/* 5 Minute APGAR Picker */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="font-bold text-xs text-slate-700 uppercase">5-Minute APGAR Breakdown</div>
                    
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Heart Rate</label>
                      <select
                        value={apgar5m.heartRate}
                        onChange={(e) => setApgar5m({ ...apgar5m, heartRate: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - Absent</option>
                        <option value={1}>1 - Slow (&lt; 100 bpm)</option>
                        <option value={2}>2 - &gt;= 100 bpm</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Respiratory Effort</label>
                      <select
                        value={apgar5m.respiratoryEffort}
                        onChange={(e) => setApgar5m({ ...apgar5m, respiratoryEffort: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - Absent / Apneic</option>
                        <option value={1}>1 - Slow, irregular, gasping</option>
                        <option value={2}>2 - Good strong vigorous cry</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Muscle Tone</label>
                      <select
                        value={apgar5m.muscleTone}
                        onChange={(e) => setApgar5m({ ...apgar5m, muscleTone: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - Flaccid / Limp</option>
                        <option value={1}>1 - Some flexion of extremities</option>
                        <option value={2}>2 - Active motion / Well-flexed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reflex Irritability</label>
                      <select
                        value={apgar5m.reflexIrritability}
                        onChange={(e) => setApgar5m({ ...apgar5m, reflexIrritability: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - No response</option>
                        <option value={1}>1 - Grimace / Weak response</option>
                        <option value={2}>2 - Vigorous cry, sneeze, cough</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Color</label>
                      <select
                        value={apgar5m.color}
                        onChange={(e) => setApgar5m({ ...apgar5m, color: Number(e.target.value) })}
                        className="w-full text-xs px-2 py-1.5 border rounded-lg bg-white border-slate-300"
                      >
                        <option value={0}>0 - Blue all over / Pale</option>
                        <option value={1}>1 - Body pink, extremities blue (Acrocyanosis)</option>
                        <option value={2}>2 - Completely pink all over</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Optional 10-Minute APGAR toggle */}
                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={hasApgar10m}
                      onChange={(e) => setHasApgar10m(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Add 10-Minute APGAR Score (Indicated if 5m score &lt; 7 or ongoing resuscitation)</span>
                  </label>
                  {hasApgar10m && (
                    <div className="mt-3 p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-900 mb-1">10m Heart Rate</label>
                        <select
                          value={apgar10m.heartRate}
                          onChange={(e) => setApgar10m({ ...apgar10m, heartRate: Number(e.target.value) })}
                          className="w-full text-xs px-2 py-1 border rounded bg-white"
                        >
                          <option value={0}>0 - Absent</option>
                          <option value={1}>1 - &lt; 100 bpm</option>
                          <option value={2}>2 - &gt;= 100 bpm</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-900 mb-1">10m Resp Effort</label>
                        <select
                          value={apgar10m.respiratoryEffort}
                          onChange={(e) => setApgar10m({ ...apgar10m, respiratoryEffort: Number(e.target.value) })}
                          className="w-full text-xs px-2 py-1 border rounded bg-white"
                        >
                          <option value={0}>0 - Apnea</option>
                          <option value={1}>1 - Irregular</option>
                          <option value={2}>2 - Strong cry</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-900 mb-1">10m Tone</label>
                        <select
                          value={apgar10m.muscleTone}
                          onChange={(e) => setApgar10m({ ...apgar10m, muscleTone: Number(e.target.value) })}
                          className="w-full text-xs px-2 py-1 border rounded bg-white"
                        >
                          <option value={0}>0 - Flaccid</option>
                          <option value={1}>1 - Some flexion</option>
                          <option value={2}>2 - Active</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-900 mb-1">10m Reflex</label>
                        <select
                          value={apgar10m.reflexIrritability}
                          onChange={(e) => setApgar10m({ ...apgar10m, reflexIrritability: Number(e.target.value) })}
                          className="w-full text-xs px-2 py-1 border rounded bg-white"
                        >
                          <option value={0}>0 - None</option>
                          <option value={1}>1 - Grimace</option>
                          <option value={2}>2 - Vigorous</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-900 mb-1">10m Color</label>
                        <select
                          value={apgar10m.color}
                          onChange={(e) => setApgar10m({ ...apgar10m, color: Number(e.target.value) })}
                          className="w-full text-xs px-2 py-1 border rounded bg-white"
                        >
                          <option value={0}>0 - Blue</option>
                          <option value={1}>1 - Acrocyanosis</option>
                          <option value={2}>2 - Pink</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Silverman-Anderson Retraction Score (SAS) */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    3. Silverman-Anderson Retraction Score (Respiratory Distress)
                  </h4>
                  <span className={`text-xs px-2.5 py-0.5 rounded font-bold border ${sasEval.badgeClass}`}>
                    Score: {sasEval.total}/10 ({sasEval.label})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Thoracoabdominal</label>
                    <select
                      value={sas.thoracoabdominalMovement}
                      onChange={(e) => setSas({ ...sas, thoracoabdominalMovement: Number(e.target.value) })}
                      className="w-full text-xs px-2 py-1.5 border rounded bg-white border-slate-300"
                    >
                      <option value={0}>0 - Synchronized</option>
                      <option value={1}>1 - Lag on inspiration</option>
                      <option value={2}>2 - See-saw paradoxical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Intercostal Retraction</label>
                    <select
                      value={sas.intercostalRetraction}
                      onChange={(e) => setSas({ ...sas, intercostalRetraction: Number(e.target.value) })}
                      className="w-full text-xs px-2 py-1.5 border rounded bg-white border-slate-300"
                    >
                      <option value={0}>0 - None</option>
                      <option value={1}>1 - Mild / barely visible</option>
                      <option value={2}>2 - Marked / deep</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Xiphoid Retraction</label>
                    <select
                      value={sas.xiphoidRetraction}
                      onChange={(e) => setSas({ ...sas, xiphoidRetraction: Number(e.target.value) })}
                      className="w-full text-xs px-2 py-1.5 border rounded bg-white border-slate-300"
                    >
                      <option value={0}>0 - None</option>
                      <option value={1}>1 - Mild</option>
                      <option value={2}>2 - Marked</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nares Dilation</label>
                    <select
                      value={sas.naresDilation}
                      onChange={(e) => setSas({ ...sas, naresDilation: Number(e.target.value) })}
                      className="w-full text-xs px-2 py-1.5 border rounded bg-white border-slate-300"
                    >
                      <option value={0}>0 - None</option>
                      <option value={1}>1 - Mild / slight</option>
                      <option value={2}>2 - Marked flaring</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Expiratory Grunt</label>
                    <select
                      value={sas.expiratoryGrunt}
                      onChange={(e) => setSas({ ...sas, expiratoryGrunt: Number(e.target.value) })}
                      className="w-full text-xs px-2 py-1.5 border rounded bg-white border-slate-300"
                    >
                      <option value={0}>0 - None</option>
                      <option value={1}>1 - Stethoscope only</option>
                      <option value={2}>2 - Naked ear audible</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* NRP 8th Edition Checklist */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    4. NRP 8th Edition "The Golden Minute" & Resuscitation Algorithm
                  </h4>
                  <span className="text-xs font-medium text-slate-600">
                    {nrpGuidance.goldenMinuteAchieved ? '✓ Golden Minute Achieved' : '⚠️ Ventilation Alert'}
                  </span>
                </div>

                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <span className="font-bold">Clinical Algorithm Recommendation:</span> {nrpGuidance.algorithmSummary}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={initialStepsDone}
                        onChange={(e) => setInitialStepsDone(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Initial Steps Done (Warm, dry, position, clear airway, stimulate)</span>
                    </label>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Delayed Cord Clamping (seconds)</label>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={delayedClampingSec}
                        onChange={(e) => setDelayedClampingSec(e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded bg-white border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Thermal Control Method</label>
                      <select
                        value={tempMethod}
                        onChange={(e) => setTempMethod(e.target.value as any)}
                        className="w-full text-xs px-2 py-1 border rounded bg-white border-slate-300"
                      >
                        <option value="radiant_warmer">Radiant Warmer</option>
                        <option value="skin_to_skin">Skin-to-skin Contact</option>
                        <option value="plastic_wrap_preterm">Plastic Wrap / Bag (Preterm &lt; 32w)</option>
                        <option value="transwarmer_mattress">Thermal Mattress</option>
                        <option value="incubator">Transport Incubator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Initial Temp (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="30"
                        max="42"
                        value={initialTempC}
                        onChange={(e) => setInitialTempC(e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded bg-white border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ppvDone}
                        onChange={(e) => setPpvDone(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Positive Pressure Ventilation (PPV) Initiated</span>
                    </label>

                    {ppvDone && (
                      <div className="space-y-2 p-2 bg-indigo-50/50 rounded border border-indigo-100">
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">PPV Device</label>
                          <select
                            value={ppvDevice}
                            onChange={(e) => setPpvDevice(e.target.value as any)}
                            className="w-full text-xs px-2 py-1 border rounded bg-white"
                          >
                            <option value="t_piece_resuscitator">T-Piece Resuscitator (Neopuff)</option>
                            <option value="self_inflating_bag">Self-Inflating Bag (Ambu)</option>
                            <option value="flow_inflating_bag">Flow-Inflating Anesthesia Bag</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <div className="w-1/2">
                            <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Start Time (sec)</label>
                            <input
                              type="number"
                              min="0"
                              max="600"
                              value={ppvStartSec}
                              onChange={(e) => setPpvStartSec(e.target.value)}
                              className="w-full text-xs px-2 py-1 border rounded bg-white"
                              placeholder="e.g. 45"
                            />
                          </div>
                          <div className="w-1/2">
                            <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Target FiO2 %</label>
                            <input
                              type="number"
                              min="21"
                              max="100"
                              value={fio2Pct}
                              onChange={(e) => setFio2Pct(e.target.value)}
                              className="w-full text-xs px-2 py-1 border rounded bg-white"
                            />
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-indigo-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mrSopaDone}
                            onChange={(e) => setMrSopaDone(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span>MR. SOPA Corrective Steps Performed</span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Airway Device Used</label>
                      <select
                        value={lmaOrEtt}
                        onChange={(e) => setLmaOrEtt(e.target.value as any)}
                        className="w-full text-xs px-2 py-1 border rounded bg-white border-slate-300"
                      >
                        <option value="none">None (Face Mask)</option>
                        <option value="lma_size_1">Laryngeal Mask Airway (LMA Size 1)</option>
                        <option value="ett_oral">Endotracheal Tube (Oral Intubation)</option>
                        <option value="ett_nasal">Endotracheal Tube (Nasal Intubation)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compressionsDone}
                        onChange={(e) => setCompressionsDone(e.target.checked)}
                        className="rounded text-rose-600"
                      />
                      <span>Chest Compressions Performed (3:1)</span>
                    </label>

                    {compressionsDone && (
                      <div>
                        <label className="block text-[11px] font-semibold text-rose-900 mb-0.5">Duration (seconds)</label>
                        <input
                          type="number"
                          min="0"
                          max="3600"
                          value={compressionsSec}
                          onChange={(e) => setCompressionsSec(e.target.value)}
                          className="w-full text-xs px-2 py-1 border rounded bg-white border-rose-200"
                        />
                      </div>
                    )}

                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={epiGiven}
                        onChange={(e) => setEpiGiven(e.target.checked)}
                        className="rounded text-rose-600"
                      />
                      <span>Epinephrine 1:10,000 Given</span>
                    </label>

                    {epiGiven && (
                      <div>
                        <label className="block text-[11px] font-semibold text-rose-900 mb-0.5">Dose (mg)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          value={epiDoseMg}
                          onChange={(e) => setEpiDoseMg(e.target.value)}
                          className="w-full text-xs px-2 py-1 border rounded bg-white border-rose-200"
                        />
                      </div>
                    )}

                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={volGiven}
                        onChange={(e) => setVolGiven(e.target.checked)}
                        className="rounded text-rose-600"
                      />
                      <span>Volume Expander (NS 10 mL/kg)</span>
                    </label>

                    {volGiven && (
                      <div>
                        <label className="block text-[11px] font-semibold text-rose-900 mb-0.5">Volume (mL)</label>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          value={volMl}
                          onChange={(e) => setVolMl(e.target.value)}
                          className="w-full text-xs px-2 py-1 border rounded bg-white border-rose-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hypoglycemia & Disposition */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  5. Glycemic Screening & Final Disposition
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-purple-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={atRiskHypoglycemia}
                        onChange={(e) => setAtRiskHypoglycemia(e.target.checked)}
                        className="rounded text-purple-600"
                      />
                      <span>At-Risk for Neonatal Hypoglycemia (IDM / SGA / LGA / Preterm)</span>
                    </label>

                    {atRiskHypoglycemia && (
                      <>
                        <input
                          type="text"
                          placeholder="Risk reason (e.g. Infant of Diabetic Mother, Birth weight > 4000g)"
                          value={hypoReason}
                          onChange={(e) => setHypoReason(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 border rounded bg-white border-purple-200"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Initial Blood Glucose (mg/dL)"
                            value={initialGlucose}
                            onChange={(e) => setInitialGlucose(e.target.value)}
                            className="w-1/2 text-xs px-2.5 py-1.5 border rounded bg-white border-purple-200"
                          />
                          <select
                            value={glucoseAction}
                            onChange={(e) => setGlucoseAction(e.target.value as any)}
                            className="w-1/2 text-xs px-2 py-1.5 border rounded bg-white border-purple-200"
                          >
                            <option value="none">No immediate action</option>
                            <option value="early_breastfeeding">Early Breastfeeding within 30-60m</option>
                            <option value="supplemental_formula_ebm">Supplemental Formula / EBM (5-10 mL/kg)</option>
                            <option value="dextrose_10pct_bolus_infusion">IV 10% Dextrose Bolus (2 mL/kg) + Infusion</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Resuscitation Outcome / Ward</label>
                      <select
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value as any)}
                        className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                      >
                        <option value="routine_maternal_side">Routine Maternal Side (Rooming-in)</option>
                        <option value="postnatal_ward_observation">Postnatal Ward Frequent Observation</option>
                        <option value="sncu_level_2">Special Newborn Care Unit (SNCU - Level 2)</option>
                        <option value="nicu_level_3">Neonatal Intensive Care Unit (NICU - Level 3)</option>
                        <option value="neonatal_death">Neonatal Demise</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Cord Blood Gas pH</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 7.28"
                          value={phCord}
                          onChange={(e) => setPhCord(e.target.value)}
                          className="w-full text-xs px-2 py-1.5 border rounded border-slate-300"
                        />
                      </div>
                      <div className="w-1/2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Base Excess (mmol/L)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. -4.2"
                          value={beCord}
                          onChange={(e) => setBeCord(e.target.value)}
                          className="w-full text-xs px-2 py-1.5 border rounded border-slate-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Attending Pediatrician</label>
                    <input
                      type="text"
                      placeholder="Doctor's name"
                      value={pediatrician}
                      onChange={(e) => setPediatrician(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Resuscitation Nurse / Midwife</label>
                    <input
                      type="text"
                      placeholder="Nurse's name"
                      value={nurse}
                      onChange={(e) => setNurse(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Clinical Transition Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Enter any additional observations, suctioning, or maternal counseling notes..."
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Neonatal Resuscitation Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Serial NEW-S Observation */}
      {showNewsModal && selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🩺</span>
                <h3 className="text-lg font-bold text-slate-800">Record Bedside NEW-S Observation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNews} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Dynamic Live Score Gauge */}
              <div className="p-4 rounded-xl border bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Composite NEW-S Score</div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black text-slate-800">{liveNewsEval.totalScore}</span>
                    <span className="text-xs text-slate-500">points</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded font-bold border ${liveNewsEval.badgeClass}`}>
                      {liveNewsEval.alertSeverity.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{liveNewsEval.clinicalAction}</p>
                </div>
              </div>

              {/* Vitals Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Postnatal Age (hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="1000"
                    value={newsPostnatalHours}
                    onChange={(e) => setNewsPostnatalHours(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    min="30"
                    max="250"
                    placeholder="Normal 110-160"
                    value={newsHr}
                    onChange={(e) => setNewsHr(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                  />
                  <span className="text-[10px] text-slate-400">Score: {liveNewsEval.hrScore}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Respiratory Rate (/min)</label>
                  <input
                    type="number"
                    min="10"
                    max="150"
                    placeholder="Normal 40-60"
                    value={newsRr}
                    onChange={(e) => setNewsRr(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                  />
                  <span className="text-[10px] text-slate-400">Score: {liveNewsEval.rrScore}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="32"
                    max="42"
                    placeholder="Target 36.5-37.5"
                    value={newsTemp}
                    onChange={(e) => setNewsTemp(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                  />
                  <span className="text-[10px] text-slate-400">Score: {liveNewsEval.tempScore}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    min="40"
                    max="100"
                    placeholder="Target >= 95%"
                    value={newsSpo2}
                    onChange={(e) => setNewsSpo2(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                  />
                  <span className="text-[10px] text-slate-400">Score: {liveNewsEval.spo2Score}</span>
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newsO2}
                      onChange={(e) => setNewsO2(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>On Supplemental O2 (+3)</span>
                  </label>
                </div>
              </div>

              {/* Color, Tone, Grunting */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Color</label>
                  <select
                    value={newsColor}
                    onChange={(e) => setNewsColor(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 border rounded-lg border-slate-300"
                  >
                    <option value="pink">Pink all over (0)</option>
                    <option value="acrocyanosis">Acrocyanosis / Blue hands & feet (1)</option>
                    <option value="pallor">Pallor / Pale (3)</option>
                    <option value="central_cyanosis">Central Cyanosis (3)</option>
                    <option value="jaundice_early">Early Jaundice &lt; 24h (3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tone & Neurology</label>
                  <select
                    value={newsTone}
                    onChange={(e) => setNewsTone(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 border rounded-lg border-slate-300"
                  >
                    <option value="normal_active">Normal Tone, Active & Alert (0)</option>
                    <option value="mildly_floppy_jittery">Mildly Floppy / Jittery (1)</option>
                    <option value="lethargic_poor_suck">Lethargic / Poor Suck (2)</option>
                    <option value="severely_hypotonic_seizures">Severely Hypotonic / Convulsions (3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Respiratory Grunt / Stridor</label>
                  <select
                    value={newsGrunt}
                    onChange={(e) => setNewsGrunt(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 border rounded-lg border-slate-300"
                  >
                    <option value="none">None / Quiet breathing (0)</option>
                    <option value="intermittent_audible_stethoscope">Intermittent / Stethoscope only (1)</option>
                    <option value="persistent_audible_naked_ear">Persistent Naked Ear Grunt (3)</option>
                  </select>
                </div>
              </div>

              {/* Glycemia & Feeding */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1">Bedside Blood Glucose (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    max="500"
                    placeholder="Optional check"
                    value={newsGlucose}
                    onChange={(e) => setNewsGlucose(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border rounded-lg bg-white border-purple-200"
                  />
                  {liveGlucoseEval && (
                    <div className="mt-1 text-[11px] font-semibold text-purple-800">
                      Status: <span className={`px-1.5 py-0.5 rounded border ${liveGlucoseEval.badgeClass}`}>{liveGlucoseEval.label}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1">Feeding Method</label>
                  <select
                    value={newsFeeding}
                    onChange={(e) => setNewsFeeding(e.target.value as any)}
                    className="w-full text-xs px-3 py-1.5 border rounded-lg bg-white border-purple-200"
                  >
                    <option value="breastfeeding_well">Breastfeeding well / Good latch</option>
                    <option value="poor_latch">Poor latch / Reluctant feeder</option>
                    <option value="expressed_breast_milk">Expressed Breast Milk (EBM) via spoon/paladai</option>
                    <option value="formula">Infant Formula Feed</option>
                    <option value="npo_iv_fluids">NPO / On IV Maintenance Fluids</option>
                  </select>
                </div>
              </div>

              {/* Action Taken */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Action Taken</label>
                <input
                  type="text"
                  placeholder={liveNewsEval.clinicalAction}
                  value={newsAction}
                  onChange={(e) => setNewsAction(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg border-slate-300"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewsModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Logging...' : 'Save Observation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
