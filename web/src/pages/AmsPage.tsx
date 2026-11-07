import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAmsDashboard,
  getAmsAntibiogram,
  getAmsPrescriptions,
  getAmsIsolates,
  type AmsPrescriptionRecord,
  type AmsIsolateRecord,
} from '../api';
import { evaluateAntibioticTimeout } from '../amsEngine';
import { AmsTimeoutModal } from '../components/AmsTimeoutModal';
import { AmsPrescriptionModal } from '../components/AmsPrescriptionModal';
import { AmsIsolateModal } from '../components/AmsIsolateModal';

export const AmsPage: React.FC = () => {
  const [activePrescriptions, setActivePrescriptions] = useState<AmsPrescriptionRecord[]>([]);
  const [recentIsolates, setRecentIsolates] = useState<AmsIsolateRecord[]>([]);
  const [antibiogram, setAntibiogram] = useState<Array<{
    pathogen: string;
    totalIsolates: number;
    drugs: Record<string, { testedCount: number; susceptibleCount: number; susceptibilityPct: number }>;
  }>>([]);
  const [allPrescriptions, setAllPrescriptions] = useState<AmsPrescriptionRecord[]>([]);
  const [allIsolates, setAllIsolates] = useState<AmsIsolateRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'antibiogram' | 'timeouts' | 'prescriptions' | 'isolates'>('antibiogram');
  const [timeoutModalPrescription, setTimeoutModalPrescription] = useState<AmsPrescriptionRecord | null>(null);
  const [isPrescribeOpen, setIsPrescribeOpen] = useState(false);
  const [isIsolateOpen, setIsIsolateOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, antiRes, prescRes, isoRes] = await Promise.all([
        getAmsDashboard(),
        getAmsAntibiogram(),
        getAmsPrescriptions(),
        getAmsIsolates(),
      ]);
      setActivePrescriptions(dashRes.activePrescriptions);
      setRecentIsolates(dashRes.recentIsolates);
      setAntibiogram(antiRes.antibiogram);
      setAllPrescriptions(prescRes.prescriptions);
      setAllIsolates(isoRes.isolates);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load AMS dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'access':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">ACCESS (First-Line)</span>;
      case 'watch':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">WATCH (High Resistance Risk)</span>;
      case 'reserve':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">RESERVE (Restricted)</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{tier}</span>;
    }
  };

  // Summaries
  const totalActive = activePrescriptions.length;
  const accessCount = activePrescriptions.filter(p => p.aware_tier === 'access').length;
  const watchCount = activePrescriptions.filter(p => p.aware_tier === 'watch').length;
  const reserveCount = activePrescriptions.filter(p => p.aware_tier === 'reserve').length;

  const pendingTimeouts = activePrescriptions.filter(p => {
    const evalRes = evaluateAntibioticTimeout({
      prescribedDatetime: p.prescribed_datetime,
      hasReviewLogged: (p.timeout_reviews_count || 0) > 0,
    });
    return evalRes.isTimeoutDue;
  });

  const calculateTierPercent = (count: number, total: number) => {
    if (!total || total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  const antibioticsList = [
    'Ampicillin',
    'Amikacin',
    'Gentamicin',
    'Cefotaxime',
    'Ceftriaxone',
    'Piperacillin-Tazobactam',
    'Meropenem',
    'Vancomycin',
    'Colistin',
    'Linezolid',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧫</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Hospital Antimicrobial Stewardship (AMS) & Cumulative Antibiogram
            </h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Institutional AWaRe Compliance, 48–72 Hour Timeout Enforcement, and Pathogen Antimicrobial Susceptibility Surveillance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPrescribeOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow transition-colors flex items-center gap-2"
          >
            <span>➕</span> Order Antibiotic
          </button>
          <button
            onClick={() => setIsIsolateOpen(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow transition-colors flex items-center gap-2"
          >
            <span>🔬</span> Record Culture Isolate
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium border border-gray-300 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Prescriptions</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-gray-900">{totalActive}</span>
            <span className="text-xs text-blue-600 font-medium">Inpatients Under AMS</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AWaRe Distribution</div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {calculateTierPercent(accessCount, totalActive)}% Access
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              {calculateTierPercent(watchCount, totalActive)}% Watch
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">
              {calculateTierPercent(reserveCount, totalActive)}% Reserve
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500">Target: &gt;60% Access per WHO guidance</div>
        </div>

        <div className={`p-5 rounded-xl border shadow-sm ${pendingTimeouts.length > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
          <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider">48–72h Timeouts Pending</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-3xl font-extrabold ${pendingTimeouts.length > 0 ? 'text-amber-700 animate-pulse' : 'text-gray-900'}`}>
              {pendingTimeouts.length}
            </span>
            <span className="text-xs text-amber-800 font-medium">Re-evaluation Due</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Surveillance Isolates</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-purple-700">{allIsolates.length}</span>
            <span className="text-xs text-purple-600 font-medium">Cumulative Pathogens</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('antibiogram')}
            className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'antibiogram'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>📊</span> Cumulative Antibiogram Matrix
          </button>
          <button
            onClick={() => setActiveTab('timeouts')}
            className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'timeouts'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>⏰</span> 48–72h Timeouts Due
            {pendingTimeouts.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white font-bold">
                {pendingTimeouts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('prescriptions')}
            className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'prescriptions'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>📋</span> Active Antibiotic Registry ({allPrescriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('isolates')}
            className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'isolates'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>🔬</span> Microbiology Isolates ({allIsolates.length})
          </button>
        </nav>
      </div>

      {/* Tab 1: Antibiogram Matrix */}
      {activeTab === 'antibiogram' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Hospital Cumulative Antibiogram (% Susceptible)</h3>
              <p className="text-xs text-gray-500">
                Calculated according to CLSI M39-A4 guidelines. Minimum sample size threshold: 30 isolates recommended.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span> &ge; 80% (High Susceptibility)
              </span>
              <span className="flex items-center gap-1 font-medium">
                <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span> 50–79% (Intermediate)
              </span>
              <span className="flex items-center gap-1 font-medium">
                <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span> &lt; 50% (High Resistance)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 uppercase font-semibold">
                  <th className="py-2.5 px-3 sticky left-0 bg-gray-100 z-10 border-r border-gray-200">
                    Pathogen Organism
                  </th>
                  <th className="py-2.5 px-3 text-center border-r border-gray-200">Total Isolates (N)</th>
                  {antibioticsList.map((abx) => (
                    <th key={abx} className="py-2.5 px-3 text-center border-r border-gray-200 whitespace-nowrap">
                      {abx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {antibiogram.length === 0 ? (
                  <tr>
                    <td colSpan={antibioticsList.length + 2} className="py-8 text-center text-gray-500">
                      No positive microbiology isolates recorded yet. Add isolates to populate the hospital antibiogram.
                    </td>
                  </tr>
                ) : (
                  antibiogram.map((row) => (
                    <tr key={row.pathogen} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-bold text-gray-900 italic sticky left-0 bg-white border-r border-gray-200 shadow-sm">
                        {row.pathogen}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-gray-700 border-r border-gray-200">
                        {row.totalIsolates}
                      </td>
                      {antibioticsList.map((abx) => {
                        const cell = row.drugs?.[abx];
                        if (!cell || cell.testedCount === 0) {
                          return (
                            <td key={abx} className="py-2.5 px-3 text-center text-gray-400 border-r border-gray-200">
                              -
                            </td>
                          );
                        }
                        const pct = cell.susceptibilityPct;
                        let bgClass = 'bg-rose-50 text-rose-800 font-bold';
                        if (pct >= 80) bgClass = 'bg-emerald-50 text-emerald-800 font-bold';
                        else if (pct >= 50) bgClass = 'bg-amber-50 text-amber-800 font-bold';

                        return (
                          <td
                            key={abx}
                            className={`py-2.5 px-3 text-center border-r border-gray-200 ${bgClass}`}
                            title={`${cell.susceptibleCount} / ${cell.testedCount} susceptible`}
                          >
                            {pct}%
                            <span className="block text-[10px] text-gray-500 font-normal">
                              ({cell.susceptibleCount}/{cell.testedCount})
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: 48-72h Timeouts */}
      {activeTab === 'timeouts' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">48–72h Mandatory Antibiotic Timeout Queue</h3>
              <p className="text-xs text-gray-500">
                Prescriptions past 48 hours without a documented de-escalation / discontinuation review
              </p>
            </div>
          </div>

          {pendingTimeouts.length === 0 ? (
            <div className="text-center py-12 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-3xl">✅</span>
              <p className="text-sm font-semibold text-emerald-800 mt-2">
                All active antimicrobial prescriptions are fully reviewed or within their initial 48-hour window!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left divide-y divide-gray-200">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Antimicrobial</th>
                    <th className="py-2.5 px-3">Tier</th>
                    <th className="py-2.5 px-3">Prescribed On</th>
                    <th className="py-2.5 px-3">Hours Elapsed</th>
                    <th className="py-2.5 px-3">Urgency</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingTimeouts.map((p) => {
                    const evalRes = evaluateAntibioticTimeout({
                      prescribedDatetime: p.prescribed_datetime,
                      hasReviewLogged: false,
                    });

                    return (
                      <tr key={p.id} className="hover:bg-amber-50/50">
                        <td className="py-3 px-3">
                          <Link
                            to={`/patients/${p.patient_id}?tab=ams`}
                            className="font-bold text-blue-600 hover:underline"
                          >
                            {p.patient_name || `Patient #${p.patient_id}`}
                          </Link>
                          <div className="text-[11px] text-gray-500">UHID: {p.patient_uhid}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900">{p.drug_name}</div>
                          <div className="text-gray-500">{p.dosage} ({p.frequency})</div>
                        </td>
                        <td className="py-3 px-3">{getTierBadge(p.aware_tier)}</td>
                        <td className="py-3 px-3 text-gray-600">
                          {new Date(p.prescribed_datetime).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-700">
                          {evalRes.hoursElapsed} hrs
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                            {evalRes.urgency.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setTimeoutModalPrescription(p)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow transition-colors"
                          >
                            Perform Timeout Review
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
      )}

      {/* Tab 3: Prescriptions Registry */}
      {activeTab === 'prescriptions' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Hospital Antimicrobial Prescriptions</h3>
              <p className="text-xs text-gray-500">Active and completed courses across all pediatric and neonatal wards</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left divide-y divide-gray-200">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Antimicrobial Regimen</th>
                  <th className="py-2.5 px-3">Tier</th>
                  <th className="py-2.5 px-3">Indication</th>
                  <th className="py-2.5 px-3">Prescribed By</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Patient File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allPrescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No antimicrobial prescriptions found.
                    </td>
                  </tr>
                ) : (
                  allPrescriptions.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <Link
                          to={`/patients/${p.patient_id}?tab=ams`}
                          className="font-bold text-blue-600 hover:underline"
                        >
                          {p.patient_name || `Patient #${p.patient_id}`}
                        </Link>
                        <div className="text-[11px] text-gray-500">UHID: {p.patient_uhid}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-gray-900">{p.drug_name}</div>
                        <div className="text-gray-500">{p.dosage} - {p.frequency} ({p.route?.toUpperCase()})</div>
                      </td>
                      <td className="py-3 px-3">{getTierBadge(p.aware_tier)}</td>
                      <td className="py-3 px-3 text-gray-700 capitalize">
                        {p.indication.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {p.prescribed_by_name || 'Medical Officer'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/patients/${p.patient_id}?tab=ams`}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium border border-gray-300"
                        >
                          Open AMS Tab →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Microbiology Isolates */}
      {activeTab === 'isolates' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Microbiology Culture & Sensitivity Isolates</h3>
              <p className="text-xs text-gray-500">Microbiological proof of bacterial pathogens and resistance profiles</p>
            </div>
            <button
              onClick={() => setIsIsolateOpen(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow"
            >
              ➕ Record Isolate
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left divide-y divide-gray-200">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Specimen</th>
                  <th className="py-2.5 px-3">Pathogen Isolated</th>
                  <th className="py-2.5 px-3">MDR Status</th>
                  <th className="py-2.5 px-3">Collection Date</th>
                  <th className="py-2.5 px-3">Sensitivities Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allIsolates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No positive microbiology isolates recorded.
                    </td>
                  </tr>
                ) : (
                  allIsolates.map((iso) => {
                    let parsedSens: Record<string, string> = {};
                    try {
                      parsedSens = JSON.parse(iso.sensitivities_json || '{}');
                    } catch {
                      parsedSens = {};
                    }
                    const entries = Object.entries(parsedSens);

                    return (
                      <tr key={iso.id} className="hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <Link
                            to={`/patients/${iso.patient_id}?tab=ams`}
                            className="font-bold text-blue-600 hover:underline"
                          >
                            {iso.patient_name || `Patient #${iso.patient_id}`}
                          </Link>
                          <div className="text-[11px] text-gray-500">UHID: {iso.patient_uhid}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold uppercase text-gray-700">
                          {iso.specimen_type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-3 italic font-bold text-gray-900">
                          {iso.pathogen_isolated}
                          {iso.colony_count_cfu_ml && (
                            <span className="block text-[11px] text-gray-500 not-italic">
                              {iso.colony_count_cfu_ml}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {iso.multidrug_resistant === 1 ? (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              MDR POSITIVE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                              Standard
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {new Date(iso.collection_datetime).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {entries.slice(0, 5).map(([drug, val]) => (
                              <span
                                key={drug}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  val === 'S' || val === 's'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : val === 'R' || val === 'r'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {drug}: {String(val).toUpperCase()}
                              </span>
                            ))}
                            {entries.length > 5 && (
                              <span className="text-[10px] text-gray-500">+{entries.length - 5} more</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeout Review Modal */}
      {timeoutModalPrescription && (
        <AmsTimeoutModal
          prescriptionId={timeoutModalPrescription.id}
          drugName={timeoutModalPrescription.drug_name}
          patientName={timeoutModalPrescription.patient_name || 'Patient'}
          hoursElapsed={Math.round(
            (Date.now() - new Date(timeoutModalPrescription.prescribed_datetime).getTime()) / (1000 * 60 * 60)
          )}
          isOpen={true}
          onClose={() => setTimeoutModalPrescription(null)}
          onSuccess={() => {
            setTimeoutModalPrescription(null);
            fetchData();
          }}
        />
      )}

      {/* Prescription Modal */}
      <AmsPrescriptionModal
        patientId={allPrescriptions[0]?.patient_id || 1}
        patientName="Pediatric Ward"
        isOpen={isPrescribeOpen}
        onClose={() => setIsPrescribeOpen(false)}
        onSuccess={() => {
          setIsPrescribeOpen(false);
          fetchData();
        }}
      />

      {/* Isolate Modal */}
      <AmsIsolateModal
        patientId={allPrescriptions[0]?.patient_id || 1}
        patientName="Microbiology Lab"
        isOpen={isIsolateOpen}
        onClose={() => setIsIsolateOpen(false)}
        onSuccess={() => {
          setIsIsolateOpen(false);
          fetchData();
        }}
      />
    </div>
  );
};
