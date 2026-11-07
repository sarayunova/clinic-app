import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPewsObservations,
  getBroselowEvents,
  type PewsObservationRecord,
  type BroselowEventRecord,
} from '../api';
import { lookupBroselowZone, calculatePews } from '../palsEngine';
import { PewsLoggerModal } from './PewsLoggerModal';
import { PalsBroselowDrawer } from './PalsBroselowDrawer';

interface PalsEmergencyCardProps {
  patientId: number;
  patientName: string;
  patientAgeYears?: number;
  patientWeightKg?: number;
  patientHeightCm?: number;
}

export const PalsEmergencyCard: React.FC<PalsEmergencyCardProps> = ({
  patientId,
  patientName,
  patientWeightKg = 12,
  patientHeightCm = 85,
}) => {
  const [pewsList, setPewsList] = useState<PewsObservationRecord[]>([]);
  const [eventsList, setEventsList] = useState<BroselowEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPewsOpen, setIsPewsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pewsRes, eventsRes] = await Promise.all([
        getPewsObservations({ patientId }),
        getBroselowEvents({ patientId }),
      ]);
      setPewsList(pewsRes.observations);
      setEventsList(eventsRes.events);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load PALS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const latestPews = pewsList[0] || null;
  const zoneInfo = lookupBroselowZone({
    lengthCm: patientHeightCm,
    weightKg: patientWeightKg,
  });

  const pewsCalc = latestPews
    ? calculatePews({
        behaviorScore: latestPews.behavior_score,
        cardiovascularScore: latestPews.cardiovascular_score,
        respiratoryScore: latestPews.respiratory_score,
        persistentVomitingPostOp: latestPews.persistent_vomiting_postop === 1,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>🧸</span> Pediatric Early Warning (PEWS) & PALS Resuscitation Tape
          </h2>
          <p className="text-xs text-gray-500">
            Monaghan Bedside Deterioration Scoring, AHA PALS Algorithm, and Broselow Weight-Calibrated Resuscitation Formulary
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPewsOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
          >
            <span>➕</span> Record Bedside PEWS
          </button>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
          >
            <span>⚡</span> Open Broselow Resuscitation Drawer
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">
          Loading Pediatric Resuscitation & PEWS records...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Broselow Quick Tape Bar & Resuscitation Quick Card */}
          <div
            className="p-5 rounded-2xl text-white shadow-md relative overflow-hidden"
            style={{ backgroundColor: zoneInfo.hexColor }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-black/30 backdrop-blur-xs text-white">
                  Broselow Color Zone: {zoneInfo.label}
                </span>
                <h3 className="text-xl font-black mt-2">
                  Emergency Resuscitation Quick Guide (~{zoneInfo.midWeightKg} kg)
                </h3>
                <p className="text-xs text-white/90">
                  Calibrated for Length {patientHeightCm} cm / Weight {patientWeightKg} kg
                </p>
              </div>

              <button
                onClick={() => setIsDrawerOpen(true)}
                className="px-4 py-2 bg-white text-gray-900 rounded-xl font-black text-xs shadow hover:bg-gray-100 transition-colors"
              >
                Open Full Tape Drawer & Equipment &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-white/20 text-xs">
              <div className="bg-black/20 p-2.5 rounded-lg backdrop-blur-xs">
                <span className="text-white/80 block text-[11px]">ETT Cuffed / Uncuffed:</span>
                <span className="font-black text-sm">{zoneInfo.ettCuffedSize} / {zoneInfo.ettUncuffedSize} mm</span>
                <span className="block text-[10px] text-white/70">Depth: {zoneInfo.ettDepthLipCm} cm</span>
              </div>
              <div className="bg-black/20 p-2.5 rounded-lg backdrop-blur-xs">
                <span className="text-white/80 block text-[11px]">Epi 1:10,000 (0.01 mg/kg):</span>
                <span className="font-black text-sm">{zoneInfo.epinephrineIvDoseMl} mL IV/IO</span>
                <span className="block text-[10px] text-white/70">q3-5 min + saline flush</span>
              </div>
              <div className="bg-black/20 p-2.5 rounded-lg backdrop-blur-xs">
                <span className="text-white/80 block text-[11px]">Defib Joules (2 / 4 J/kg):</span>
                <span className="font-black text-sm">{zoneInfo.defibInitialJoules} J / {zoneInfo.defibSubsequentJoules} J</span>
                <span className="block text-[10px] text-white/70">Cardioversion: {Math.round(zoneInfo.midWeightKg * 0.5)} J</span>
              </div>
              <div className="bg-black/20 p-2.5 rounded-lg backdrop-blur-xs">
                <span className="text-white/80 block text-[11px]">Fluid Bolus (20 mL/kg):</span>
                <span className="font-black text-sm">{zoneInfo.fluidBolusMl} mL NS</span>
                <span className="block text-[10px] text-white/70">D10W: {zoneInfo.dextrose10PercentMl} mL</span>
              </div>
            </div>
          </div>

          {/* Latest Bedside PEWS Observation Card */}
          {latestPews && pewsCalc ? (
            <div className={`p-5 rounded-xl border shadow-sm ${
              pewsCalc.badgeColor === 'red'
                ? 'bg-rose-50 border-rose-300'
                : pewsCalc.badgeColor === 'yellow'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-white border-gray-200'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4 border-gray-200/60">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-white shadow-sm ${
                    pewsCalc.badgeColor === 'red'
                      ? 'bg-rose-600 animate-pulse'
                      : pewsCalc.badgeColor === 'yellow'
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}>
                    {pewsCalc.totalScore}
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-gray-900">
                      Latest Bedside PEWS: {pewsCalc.riskLabel}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Assessed on {new Date(latestPews.observation_datetime).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })} by {latestPews.assessed_by_name || 'Staff Nurse'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsPewsOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow"
                >
                  Log Repeat Score
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Behavior Score:</span>
                  <span className="font-bold text-gray-900">{latestPews.behavior_score} / 3</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Cardiovascular Score:</span>
                  <span className="font-bold text-gray-900">{latestPews.cardiovascular_score} / 3</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Respiratory Score:</span>
                  <span className="font-bold text-gray-900">{latestPews.respiratory_score} / 3</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Post-Op Vomiting:</span>
                  <span className="font-bold text-gray-900">{latestPews.persistent_vomiting_postop ? '+1 (Present)' : 'None (0)'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div className="bg-white/80 p-2 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[10px]">Heart Rate</span>
                  <span className="font-bold">{latestPews.heart_rate_bpm} bpm</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[10px]">Respiratory Rate</span>
                  <span className="font-bold">{latestPews.respiratory_rate_bpm} bpm</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[10px]">Capillary Refill</span>
                  <span className="font-bold">{latestPews.crt_seconds} sec</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[10px]">SpO₂ / FiO₂</span>
                  <span className="font-bold">{latestPews.spo2_percent}% on {latestPews.fio2_percent}% O₂</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[10px]">Temperature</span>
                  <span className="font-bold">{latestPews.temperature_celsius ? `${latestPews.temperature_celsius} °C` : '-'}</span>
                </div>
              </div>

              {pewsCalc.escalationRequired && (
                <div className="mt-3 p-3 bg-rose-600 text-white rounded-lg text-xs font-bold space-y-1">
                  <span className="uppercase block">🚨 Immediate Action Required:</span>
                  {pewsCalc.clinicalActions.map((act, i) => (
                    <div key={i} className="flex items-center gap-1.5 font-normal">
                      <span>&bull;</span> {act}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-8 text-center rounded-xl border border-dashed border-gray-300 space-y-2">
              <span className="text-3xl">🧸</span>
              <h4 className="text-sm font-bold text-gray-800">No PEWS Observations Recorded</h4>
              <p className="text-xs text-gray-500">
                Log the initial bedside Pediatric Early Warning Score to monitor this patient's clinical trajectory.
              </p>
              <button
                onClick={() => setIsPewsOpen(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow"
              >
                Log First PEWS Observation
              </button>
            </div>
          )}

          {/* PEWS History Table */}
          {pewsList.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-xs font-black uppercase text-gray-900 tracking-wide">
                  PEWS Observation Trend & Vitals History
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Total Score</th>
                      <th className="py-2.5 px-3">Behavior</th>
                      <th className="py-2.5 px-3">CV</th>
                      <th className="py-2.5 px-3">Resp</th>
                      <th className="py-2.5 px-3">Vomiting</th>
                      <th className="py-2.5 px-3">Vitals (HR/RR/CRT/SpO₂)</th>
                      <th className="py-2.5 px-3">Assessed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pewsList.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                          {new Date(row.observation_datetime).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded font-black text-xs ${
                            row.total_pews_score >= 5
                              ? 'bg-rose-100 text-rose-800'
                              : row.total_pews_score >= 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            Score {row.total_pews_score} ({row.risk_level.replace(/_/g, ' ')})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{row.behavior_score}</td>
                        <td className="py-2.5 px-3 font-semibold">{row.cardiovascular_score}</td>
                        <td className="py-2.5 px-3 font-semibold">{row.respiratory_score}</td>
                        <td className="py-2.5 px-3">{row.persistent_vomiting_postop ? '+1' : '0'}</td>
                        <td className="py-2.5 px-3 text-gray-700">
                          {row.heart_rate_bpm} bpm / {row.respiratory_rate_bpm} RR / {row.crt_seconds}s CRT / {row.spo2_percent}%
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">{row.assessed_by_name || 'Staff Nurse'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resuscitation Events (Code Blue) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Emergency Resuscitation & Code Blue Events</h3>
                <p className="text-xs text-gray-500">Documented PALS resuscitation interventions and outcomes</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Log Resuscitation Event
              </button>
            </div>

            {eventsList.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500">
                No acute Code Blue or resuscitation events logged for this patient.
              </div>
            ) : (
              <div className="space-y-3">
                {eventsList.map((evt) => (
                  <div key={evt.id} className="p-4 rounded-xl border border-red-200 bg-red-50/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-red-600 text-white">
                          {evt.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="font-bold text-gray-800 text-xs">
                          Tape Zone: {evt.broselow_color_zone.toUpperCase()} ({evt.estimated_weight_kg} kg)
                        </span>
                      </div>
                      <Link
                        to={`/pals/${evt.id}/print`}
                        target="_blank"
                        className="px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded border border-gray-300 shadow-xs flex items-center gap-1"
                      >
                        🖨️ Print Code Blue Record
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-700 pt-1">
                      <div>
                        <span className="text-gray-500 block">ETT Size & Depth:</span>
                        <span className="font-semibold">{evt.ett_cuffed_size} mm at {evt.ett_depth_cm} cm</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Defib Joules:</span>
                        <span className="font-semibold">{evt.defib_joules_initial} Joules</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Epinephrine IV:</span>
                        <span className="font-semibold">{evt.epinephrine_iv_dose_ml} mL (1:10k)</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Resuscitation Outcome:</span>
                        <span className="font-black text-rose-800 capitalize">{evt.outcome.replace(/_/g, ' ')}</span>
                      </div>
                    </div>

                    {evt.clinical_summary && (
                      <p className="text-xs text-gray-600 pt-1 bg-white/70 p-2 rounded">
                        <strong>Summary:</strong> {evt.clinical_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {isPewsOpen && (
        <PewsLoggerModal
          patientId={patientId}
          patientName={patientName}
          onClose={() => setIsPewsOpen(false)}
          onSuccess={() => {
            setIsPewsOpen(false);
            loadData();
          }}
        />
      )}

      <PalsBroselowDrawer
        patientId={patientId}
        patientName={patientName}
        initialLengthCm={patientHeightCm}
        initialWeightKg={patientWeightKg}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEventLogged={loadData}
      />
    </div>
  );
};
