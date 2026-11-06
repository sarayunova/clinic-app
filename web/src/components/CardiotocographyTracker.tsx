import React, { useState, useEffect, useMemo } from 'react';
import type { CtgEpisode, CtgEpisodesResponse } from '../api';
import {
  evaluateCtgParams,
  generateSyntheticCtgTrace,
  type CtgTestType,
  type FhrVariabilityCategory,
  type DecelerationType,
  type CtgTracePoint,
} from '../ctgEngine';

interface Props {
  patientId: number;
}

export function CardiotocographyTracker({ patientId }: Props) {
  const [episodes, setEpisodes] = useState<CtgEpisode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [form, setForm] = useState({
    testType: 'antenatal_nst' as CtgTestType,
    performedAt: new Date().toISOString().slice(0, 16),
    gestationalAgeWeeks: '34',
    indication: 'Routine 3rd trimester Non-Stress Test (NST)',
    durationMinutes: '20',
    paperSpeedCmMin: '1.0',
    baselineFhrBpm: '140',
    variabilityCategory: 'moderate' as FhrVariabilityCategory,
    variabilityAmplitudeBpm: '12',
    accelerationsCount: '2',
    accelerationsCriteria: '15x15' as '15x15' | '10x10',
    decelerationsType: 'none' as DecelerationType,
    decelerationsRecurrent: false,
    decelerationsDetails: '',
    uterineContractionsPer10min: '1',
    fetalMovementFelt: true,
    vibroacousticStimulationDone: false,
    vasResponse: '',
    clinicalActionPlan: '',
    recommendedFollowUp: 'Repeat NST in 1 week or earlier if decreased fetal movements.',
    notes: 'Patient positioned in semi-Fowler with left lateral tilt. Reassuring FHR reactivity observed.',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/patients/${patientId}/ctg/episodes`);
      if (!res.ok) throw new Error('Failed to load CTG episodes');
      const data: CtgEpisodesResponse = await res.json();
      setEpisodes(data.episodes || []);
      if (data.episodes && data.episodes.length > 0) {
        setSelectedEpisodeId((prev) => (prev ? prev : data.episodes[0]!.id));
      } else {
        setSelectedEpisodeId(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading CTG records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const selectedEpisode = useMemo(() => {
    if (!selectedEpisodeId) return episodes[0] || null;
    return episodes.find((e) => e.id === selectedEpisodeId) || episodes[0] || null;
  }, [episodes, selectedEpisodeId]);

  // Parse trace points for selected episode
  const activeTracePoints: CtgTracePoint[] = useMemo(() => {
    if (!selectedEpisode) return [];
    if (selectedEpisode.fhr_trace_data_json) {
      try {
        return JSON.parse(selectedEpisode.fhr_trace_data_json);
      } catch {
        return [];
      }
    }
    return [];
  }, [selectedEpisode]);

  // Live calculation preview during modal form entry
  const livePreview = useMemo(() => {
    const base = Number(form.baselineFhrBpm) || 140;
    const dur = Number(form.durationMinutes) || 20;
    const acc = Number(form.accelerationsCount) || 0;
    const toco = Number(form.uterineContractionsPer10min) || 0;

    return evaluateCtgParams({
      gestationalAgeWeeks: form.gestationalAgeWeeks ? Number(form.gestationalAgeWeeks) : null,
      durationMinutes: dur,
      baselineFhrBpm: base,
      variabilityCategory: form.variabilityCategory,
      variabilityAmplitudeBpm: form.variabilityAmplitudeBpm ? Number(form.variabilityAmplitudeBpm) : null,
      accelerationsCount: acc,
      accelerationsCriteria: form.accelerationsCriteria,
      decelerationsType: form.decelerationsType,
      decelerationsRecurrent: form.decelerationsRecurrent,
      uterineContractionsPer10min: toco,
      fetalMovementFelt: form.fetalMovementFelt,
    });
  }, [form]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const base = Number(form.baselineFhrBpm);
      if (!base || base < 50 || base > 220) throw new Error('Valid baseline FHR between 50 and 220 bpm required');

      const payload = {
        testType: form.testType,
        performedAt: form.performedAt,
        gestationalAgeWeeks: form.gestationalAgeWeeks ? Number(form.gestationalAgeWeeks) : null,
        indication: form.indication || null,
        durationMinutes: Number(form.durationMinutes) || 20,
        paperSpeedCmMin: Number(form.paperSpeedCmMin) || 1.0,
        baselineFhrBpm: base,
        variabilityCategory: form.variabilityCategory,
        variabilityAmplitudeBpm: form.variabilityAmplitudeBpm ? Number(form.variabilityAmplitudeBpm) : null,
        accelerationsCount: Number(form.accelerationsCount) || 0,
        accelerationsCriteria: form.accelerationsCriteria,
        decelerationsType: form.decelerationsType,
        decelerationsRecurrent: form.decelerationsRecurrent,
        decelerationsDetails: form.decelerationsDetails || null,
        uterineContractionsPer10min: Number(form.uterineContractionsPer10min) || 0,
        fetalMovementFelt: form.fetalMovementFelt,
        vibroacousticStimulationDone: form.vibroacousticStimulationDone,
        vasResponse: form.vasResponse || null,
        clinicalActionPlan: form.clinicalActionPlan || null,
        recommendedFollowUp: form.recommendedFollowUp || null,
        notes: form.notes || null,
      };

      const res = await fetch(`/api/patients/${patientId}/ctg/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to save CTG episode');
      }

      const created = await res.json();
      setShowModal(false);
      setSuccessMsg('CTG / NST recording saved successfully!');
      await loadData();
      if (created.episode?.id) setSelectedEpisodeId(created.episode.id);
    } catch (err: any) {
      setError(err?.message || 'Error saving CTG recording');
    }
  };

  // Handle Delete
  const handleDelete = async (epId: number) => {
    if (!window.confirm('Delete this CTG episode record?')) return;
    try {
      setError(null);
      const res = await fetch(`/api/patients/${patientId}/ctg/episodes/${epId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete CTG episode');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error deleting episode');
    }
  };

  // SVG dimensions for CTG strip rendering
  const svgWidth = 800;
  const fhrHeight = 160;
  const tocoHeight = 90;
  const gap = 15;
  const totalSvgHeight = fhrHeight + gap + tocoHeight;

  // Scale functions
  const maxMin = selectedEpisode?.duration_minutes || 20;
  const getX = (minute: number) => (minute / maxMin) * (svgWidth - 60) + 45;
  // FHR scale: 60 to 200 bpm -> y: fhrHeight to 10
  const getYFhr = (bpm: number) => {
    const clamped = Math.min(Math.max(bpm, 60), 200);
    return fhrHeight - ((clamped - 60) / (200 - 60)) * (fhrHeight - 20) - 10;
  };
  // TOCO scale: 0 to 100 mmHg -> y: totalSvgHeight to fhrHeight + gap + 10
  const getYToco = (mmHg: number) => {
    const clamped = Math.min(Math.max(mmHg, 0), 100);
    return totalSvgHeight - (clamped / 100) * (tocoHeight - 20) - 10;
  };

  // Build SVG path strings
  const fhrPath = useMemo(() => {
    if (!activeTracePoints.length) return '';
    return activeTracePoints.reduce((acc, pt, idx) => {
      const x = getX(pt.timeMinute);
      const y = getYFhr(pt.fhrBpm);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [activeTracePoints, maxMin]);

  const tocoPath = useMemo(() => {
    if (!activeTracePoints.length) return '';
    return activeTracePoints.reduce((acc, pt, idx) => {
      const x = getX(pt.timeMinute);
      const y = getYToco(pt.tocoMmHg);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [activeTracePoints, maxMin]);

  return (
    <div className="ctg-tracker space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>📈 Cardiotocography (CTG) &amp; Non-Stress Test (NST)</span>
            {selectedEpisode && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                  selectedEpisode.figo_classification === 'normal'
                    ? 'bg-green-100 text-green-800'
                    : selectedEpisode.figo_classification === 'suspicious'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {selectedEpisode.figo_classification.toUpperCase()}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500">
            FIGO 2015 &amp; ACOG 3-Tier Guidelines, continuous FHR baseline, variability, decelerations, tachysystole detection, and printable paper-strip trace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/patients/${patientId}/ctg/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn small secondary flex items-center gap-1"
            >
              <span>🖨️</span> Print CTG Strip Report
            </a>
          )}
          <button
            type="button"
            className="btn small primary"
            onClick={() => setShowModal(true)}
          >
            ➕ Record New CTG / NST Trace
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm flex justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold">✕</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading cardiotocography records...</div>
      ) : episodes.length === 0 ? (
        /* Empty State */
        <div className="p-8 text-center bg-gray-50 border rounded-lg space-y-4">
          <div className="text-4xl">📈</div>
          <h3 className="text-lg font-semibold text-gray-700">No CTG or NST Traces Recorded</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            This patient does not have any recorded Non-Stress Tests (NST) or intrapartum cardiotocograph traces. Record a trace to evaluate fetal heart rate baseline, variability, accelerations, decelerations, and contraction frequency.
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowModal(true)}
          >
            Record New CTG Trace
          </button>
        </div>
      ) : (
        /* Workspace */
        <div className="space-y-4">
          {/* Episode Selector Tabs */}
          {episodes.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b pb-2">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => setSelectedEpisodeId(ep.id)}
                  className={`btn small ${selectedEpisodeId === ep.id ? 'primary' : 'secondary'} flex items-center gap-1`}
                >
                  <span>{ep.test_type === 'antenatal_nst' ? 'NST' : 'CTG'}</span>
                  <span className="text-[11px] opacity-80">{ep.performed_at.slice(0, 10)}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    ep.figo_classification === 'normal'
                      ? 'bg-green-400'
                      : ep.figo_classification === 'suspicious'
                      ? 'bg-amber-400'
                      : 'bg-red-500'
                  }`} />
                </button>
              ))}
            </div>
          )}

          {selectedEpisode && (
            <div className="space-y-4">
              {/* Classification & Parameter Badges Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 border rounded shadow-sm">
                <div className="border-r pr-3">
                  <span className="text-xs text-gray-400 font-semibold uppercase">FIGO 2015 Classification</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-sm font-bold uppercase px-2 py-0.5 rounded ${
                      selectedEpisode.figo_classification === 'normal'
                        ? 'bg-green-100 text-green-800'
                        : selectedEpisode.figo_classification === 'suspicious'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedEpisode.figo_classification}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {selectedEpisode.test_type.replace(/_/g, ' ').toUpperCase()} • {selectedEpisode.duration_minutes} min
                  </div>
                </div>

                <div className="border-r pr-3">
                  <span className="text-xs text-gray-400 font-semibold uppercase">ACOG / NICHD 3-Tier</span>
                  <div className="text-sm font-bold text-gray-800 capitalize mt-1">
                    {selectedEpisode.nichd_category.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-blue-700 font-medium mt-0.5">
                    NST: <b className="uppercase">{selectedEpisode.nst_classification.replace(/_/g, ' ')}</b>
                  </div>
                </div>

                <div className="border-r pr-3">
                  <span className="text-xs text-gray-400 font-semibold uppercase">FHR Morphometry</span>
                  <div className="text-sm font-bold text-gray-800 mt-1">
                    {selectedEpisode.baseline_fhr_bpm} <span className="text-xs font-normal text-gray-500">bpm baseline</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Var: <span className="capitalize font-semibold">{selectedEpisode.variability_category}</span> | Accel: <b>{selectedEpisode.accelerations_count}</b>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-semibold uppercase">Decelerations &amp; Uterine</span>
                  <div className="text-sm font-bold text-gray-800 capitalize mt-1">
                    {selectedEpisode.decelerations_type.replace(/_/g, ' ')}
                    {selectedEpisode.decelerations_recurrent ? ' (Recurrent)' : ''}
                  </div>
                  <div className={`text-xs mt-0.5 ${selectedEpisode.tachysystole_present ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                    Contractions: {selectedEpisode.uterine_contractions_per_10min}/10min
                    {selectedEpisode.tachysystole_present ? ' ⚠️ Tachysystole' : ''}
                  </div>
                </div>
              </div>

              {/* High-Resolution Interactive CTG Paper Strip SVG */}
              <div className="bg-white border rounded shadow-sm p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <div className="font-bold text-sm text-gray-800 uppercase tracking-wide flex items-center gap-2">
                    <span>📜 Continuous CTG Dual-Panel Strip Graph</span>
                    <span className="text-xs font-normal text-gray-500">
                      (Paper Speed {selectedEpisode.paper_speed_cm_min} cm/min • Duration {selectedEpisode.duration_minutes} min)
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-blue-600 inline-block rounded-sm" /> FHR (60-200 bpm)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-purple-600 inline-block rounded-sm" /> TOCO (0-100 mmHg)
                    </span>
                  </div>
                </div>

                {/* SVG Container with horizontal scroll for responsiveness */}
                <div className="overflow-x-auto bg-[#faf8f5] p-2 rounded border border-[#f0eae0]">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${totalSvgHeight}`}
                    className="w-full min-w-[750px] select-none"
                    style={{ fontFeatureSettings: '"tnum"' }}
                  >
                    {/* Background Grid Lines for FHR */}
                    <rect x="40" y="5" width={svgWidth - 55} height={fhrHeight} fill="#fffdfa" stroke="#e8dfd8" strokeWidth="1" />

                    {[60, 80, 100, 120, 140, 160, 180, 200].map((bpm) => {
                      const y = getYFhr(bpm);
                      const isNormalBand = bpm === 110 || bpm === 160;
                      return (
                        <g key={bpm}>
                          <line
                            x1="40"
                            y1={y}
                            x2={svgWidth - 15}
                            y2={y}
                            stroke={isNormalBand ? '#bbf7d0' : '#f2e8dc'}
                            strokeWidth={isNormalBand ? 1.5 : 0.8}
                            strokeDasharray={isNormalBand ? '4 2' : undefined}
                          />
                          <text x="35" y={y + 3} textAnchor="end" fontSize="9" fill="#9c8c7c" fontFamily="sans-serif">
                            {bpm}
                          </text>
                        </g>
                      );
                    })}

                    {/* Baseline Guide Line */}
                    <line
                      x1="40"
                      y1={getYFhr(selectedEpisode.baseline_fhr_bpm)}
                      x2={svgWidth - 15}
                      y2={getYFhr(selectedEpisode.baseline_fhr_bpm)}
                      stroke="#93c5fd"
                      strokeWidth="1.2"
                      strokeDasharray="5 3"
                    />

                    {/* Time vertical division lines (every 2 minutes) */}
                    {Array.from({ length: Math.floor(maxMin / 2) + 1 }).map((_, i) => {
                      const m = i * 2;
                      const x = getX(m);
                      return (
                        <g key={m}>
                          <line x1={x} y1="5" x2={x} y2={fhrHeight + 5} stroke="#f2e8dc" strokeWidth="0.8" />
                          <line x1={x} y1={fhrHeight + gap} x2={x} y2={totalSvgHeight - 5} stroke="#f2e8dc" strokeWidth="0.8" />
                          <text x={x} y={fhrHeight + 12} textAnchor="middle" fontSize="8" fill="#9c8c7c" fontFamily="sans-serif">
                            {m}'
                          </text>
                        </g>
                      );
                    })}

                    {/* FHR Curve */}
                    {fhrPath && (
                      <path
                        d={fhrPath}
                        fill="none"
                        stroke="#1d4ed8"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Background Grid Lines for TOCO */}
                    <rect x="40" y={fhrHeight + gap} width={svgWidth - 55} height={tocoHeight} fill="#fffdfa" stroke="#e8dfd8" strokeWidth="1" />

                    {[0, 20, 40, 60, 80, 100].map((mmHg) => {
                      const y = getYToco(mmHg);
                      return (
                        <g key={mmHg}>
                          <line x1="40" y1={y} x2={svgWidth - 15} y2={y} stroke="#f2e8dc" strokeWidth="0.8" />
                          <text x="35" y={y + 3} textAnchor="end" fontSize="9" fill="#9c8c7c" fontFamily="sans-serif">
                            {mmHg}
                          </text>
                        </g>
                      );
                    })}

                    {/* TOCO Curve */}
                    {tocoPath && (
                      <path
                        d={tocoPath}
                        fill="none"
                        stroke="#7e22ce"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Labels */}
                    <text x="45" y="16" fontSize="10" fontWeight="bold" fill="#1e3a8a" fontFamily="sans-serif">
                      FHR (bpm)
                    </text>
                    <text x="45" y={fhrHeight + gap + 14} fontSize="10" fontWeight="bold" fill="#581c87" fontFamily="sans-serif">
                      TOCO (mmHg)
                    </text>
                  </svg>
                </div>
              </div>

              {/* Resuscitation & Clinical Guidance Card */}
              {selectedEpisode.intrauterine_resuscitation_required ? (
                <div className="bg-red-50 border border-red-200 p-4 rounded shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-red-900 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                      <span>🚨 Intrauterine Resuscitation Protocol Active</span>
                    </h4>
                    <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded font-bold">
                      URGENT ESCALATION
                    </span>
                  </div>
                  <p className="text-xs text-red-800">
                    Pathological features or uterine tachysystole detected. Apply standard intrauterine resuscitation bundle immediately:
                  </p>
                  <ul className="text-xs text-red-900 list-disc list-inside space-y-1">
                    <li>Discontinue or pause Oxytocin / uterotonic infusion immediately.</li>
                    <li>Reposition mother to left lateral decubitus position to relieve aortocaval compression.</li>
                    <li>Administer IV fluid bolus (500–1000 mL Ringer Lactate).</li>
                    <li>Administer supplemental oxygen by face mask if maternal hypoxemia.</li>
                    <li>Consider acute tocolysis (Terbutaline 0.25 mg SC) for persistent tachysystole.</li>
                    <li>Prepare OT for emergency crash cesarean if FHR does not recover within 15–30 minutes.</li>
                  </ul>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 p-4 rounded shadow-sm text-xs text-green-900">
                  <b>Reassuring Fetal Profile:</b> FIGO Normal &amp; Category I tracing. Baseline {selectedEpisode.baseline_fhr_bpm} bpm with moderate variability and reassuring reactivity. Continue routine obstetric care.
                </div>
              )}

              {/* Action Plan & Notes */}
              <div className="bg-white border rounded shadow-sm p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="font-bold text-gray-800 uppercase tracking-wide">Clinical Action Plan &amp; Findings</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedEpisode.id)}
                    className="text-red-500 hover:text-red-700 font-semibold"
                  >
                    Delete Episode
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-700">
                  <div>
                    <b>Action Plan:</b> {selectedEpisode.clinical_action_plan || 'Routine monitoring.'}
                  </div>
                  <div>
                    <b>Recommended Follow-up:</b> {selectedEpisode.recommended_follow_up || '—'}
                  </div>
                </div>
                {selectedEpisode.notes && (
                  <div className="text-gray-500 pt-1 border-t">
                    <b>Notes:</b> {selectedEpisode.notes}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record CTG Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold">➕ Record New Cardiotocography / NST Trace</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Test Type, GA, & Performed At */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Test Type</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={form.testType}
                    onChange={(e) => setForm({ ...form, testType: e.target.value as any })}
                  >
                    <option value="antenatal_nst">Antenatal Non-Stress Test (NST)</option>
                    <option value="intrapartum_continuous">Intrapartum Continuous CTG</option>
                    <option value="intrapartum_intermittent">Intrapartum Intermittent CTG</option>
                    <option value="oxytocin_challenge_test">Oxytocin Challenge Test (OCT)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Performed Date/Time</label>
                  <input
                    type="datetime-local"
                    className="w-full border p-2 rounded"
                    value={form.performedAt}
                    onChange={(e) => setForm({ ...form, performedAt: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Gestational Age (Weeks)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={form.gestationalAgeWeeks}
                    onChange={(e) => setForm({ ...form, gestationalAgeWeeks: e.target.value })}
                    placeholder="e.g. 34"
                  />
                </div>
              </div>

              {/* Indication & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold block mb-1">Clinical Indication</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded"
                    value={form.indication}
                    onChange={(e) => setForm({ ...form, indication: e.target.value })}
                    placeholder="e.g. Reduced fetal movements, post-dates, high-risk ANC"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Duration (Minutes)</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                  >
                    <option value="20">20 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="40">40 Minutes</option>
                    <option value="60">60 Minutes</option>
                  </select>
                </div>
              </div>

              {/* FHR Morphology Evaluation Box */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-3">
                <span className="font-bold text-blue-900 block uppercase tracking-wide">
                  FHR Morphological Parameters
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Baseline FHR (bpm)</label>
                    <input
                      type="number"
                      className="w-full border p-2 rounded font-bold text-sm"
                      value={form.baselineFhrBpm}
                      onChange={(e) => setForm({ ...form, baselineFhrBpm: e.target.value })}
                      required
                      placeholder="Normal: 110 - 160"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Baseline Variability</label>
                    <select
                      className="w-full border p-2 rounded"
                      value={form.variabilityCategory}
                      onChange={(e) => setForm({ ...form, variabilityCategory: e.target.value as any })}
                    >
                      <option value="moderate">Moderate (6–25 bpm) - Normal</option>
                      <option value="minimal">Minimal (3–5 bpm)</option>
                      <option value="absent">Absent (0–2 bpm) - Pathological</option>
                      <option value="marked">Marked / Saltatory (&gt; 25 bpm)</option>
                      <option value="sinusoidal">Sinusoidal Pattern - Ominous</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Accelerations Count</label>
                    <input
                      type="number"
                      className="w-full border p-2 rounded"
                      value={form.accelerationsCount}
                      onChange={(e) => setForm({ ...form, accelerationsCount: e.target.value })}
                      placeholder="&ge; 2 in 20m for Reactive"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Decelerations Type</label>
                    <select
                      className="w-full border p-2 rounded"
                      value={form.decelerationsType}
                      onChange={(e) => setForm({ ...form, decelerationsType: e.target.value as any })}
                    >
                      <option value="none">None (Reassuring)</option>
                      <option value="early">Early (Head compression)</option>
                      <option value="variable_uncomplicated">Variable (Uncomplicated)</option>
                      <option value="variable_complicated">Variable (Complicated / Atypical)</option>
                      <option value="late">Late (Uteroplacental insufficiency)</option>
                      <option value="prolonged">Prolonged (&ge; 2 min)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Contractions / 10 min</label>
                    <input
                      type="number"
                      className="w-full border p-2 rounded font-bold"
                      value={form.uterineContractionsPer10min}
                      onChange={(e) => setForm({ ...form, uterineContractionsPer10min: e.target.value })}
                      placeholder="&gt; 5 is Tachysystole"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={form.decelerationsRecurrent}
                        onChange={(e) => setForm({ ...form, decelerationsRecurrent: e.target.checked })}
                      />
                      Recurrent Decels (&gt;50%)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={form.fetalMovementFelt}
                        onChange={(e) => setForm({ ...form, fetalMovementFelt: e.target.checked })}
                      />
                      Fetal Movements Felt
                    </label>
                  </div>
                </div>

                {/* Real-Time Live Classification Preview */}
                <div className="p-2.5 bg-white border rounded space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-700">Auto-Evaluated Classification:</span>
                    <div className="flex gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        livePreview.figoClassification === 'normal'
                          ? 'bg-green-100 text-green-800'
                          : livePreview.figoClassification === 'suspicious'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {livePreview.figoLabel}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        livePreview.nichdCategory === 'category_1_normal'
                          ? 'bg-green-100 text-green-800'
                          : livePreview.nichdCategory === 'category_2_indeterminate'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {livePreview.nichdLabel}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        livePreview.nstClassification === 'reactive'
                          ? 'bg-green-100 text-green-800'
                          : livePreview.nstClassification === 'non_reactive'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {livePreview.nstLabel}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-600">{livePreview.clinicalSummary}</p>
                </div>
              </div>

              {/* Action Plan & Notes */}
              <div>
                <label className="font-semibold block mb-1">Clinical Plan / Resuscitation Measures</label>
                <textarea
                  rows={2}
                  className="w-full border p-2 rounded"
                  value={form.clinicalActionPlan}
                  onChange={(e) => setForm({ ...form, clinicalActionPlan: e.target.value })}
                  placeholder={livePreview.recommendedActions.join('; ')}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save CTG Recording &amp; Generate Trace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
