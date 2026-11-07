import React, { useEffect, useState } from 'react';
import {
  getAmsPrescriptions,
  getAmsPrescription,
  type AmsPrescriptionRecord,
  type AmsTimeoutReviewRecord,
  type AmsIsolateRecord,
} from '../api';
import { evaluateAntibioticTimeout } from '../amsEngine';
import { AmsPrescriptionModal } from './AmsPrescriptionModal';
import { AmsTimeoutModal } from './AmsTimeoutModal';
import { AmsIsolateModal } from './AmsIsolateModal';

interface AmsTabProps {
  patientId: number;
  patientName: string;
}

export const AmsTab: React.FC<AmsTabProps> = ({ patientId, patientName }) => {
  const [prescriptions, setPrescriptions] = useState<AmsPrescriptionRecord[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<{
    prescription: AmsPrescriptionRecord;
    reviews: AmsTimeoutReviewRecord[];
    isolates: AmsIsolateRecord[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPrescribeOpen, setIsPrescribeOpen] = useState(false);
  const [isTimeoutOpen, setIsTimeoutOpen] = useState(false);
  const [isIsolateOpen, setIsIsolateOpen] = useState(false);

  const loadPrescriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAmsPrescriptions({ patientId });
      setPrescriptions(res.prescriptions);
      if (res.prescriptions.length > 0) {
        const first = res.prescriptions[0]!;
        const detail = await getAmsPrescription(first.id);
        setSelectedPrescription(detail);
      } else {
        setSelectedPrescription(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load antimicrobial stewardship records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrescriptions();
  }, [patientId]);

  const handleSelectPrescription = async (id: number) => {
    try {
      const detail = await getAmsPrescription(id);
      setSelectedPrescription(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    }
  };

  const timeoutInfo = selectedPrescription
    ? evaluateAntibioticTimeout({
        prescribedDatetime: selectedPrescription.prescription.prescribed_datetime,
        hasReviewLogged: selectedPrescription.reviews.length > 0,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>💊</span> Antimicrobial Stewardship (AMS) & AWaRe Surveillance
          </h2>
          <p className="text-xs text-gray-500">
            WHO AWaRe Stratification (Access, Watch, Reserve), 48–72h Antibiotic Timeouts, and Pathogen Sensitivities
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPrescribeOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
          >
            <span>➕</span> New Antibiotic Order
          </button>
          <button
            onClick={() => setIsIsolateOpen(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
          >
            <span>🧫</span> Record Culture Isolate
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* 48-72h Antibiotic Timeout Alert Banner */}
      {selectedPrescription && selectedPrescription.prescription.status === 'active' && timeoutInfo && (
        <div
          className={`p-4 rounded-xl border-2 flex flex-wrap items-center justify-between gap-3 ${
            timeoutInfo.urgency === 'overdue_critical'
              ? 'bg-rose-50 border-rose-400 text-rose-950'
              : timeoutInfo.urgency === 'due_warning'
              ? 'bg-amber-50 border-amber-400 text-amber-950'
              : 'bg-emerald-50 border-emerald-300 text-emerald-950'
          }`}
        >
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">
                {timeoutInfo.urgency === 'overdue_critical' ? '🚨' : timeoutInfo.urgency === 'due_warning' ? '⏰' : '✅'}
              </span>
              <h3 className="text-sm font-black uppercase tracking-wide">
                48–72h Antibiotic Stewardship Timeout Status
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border">
                {timeoutInfo.hoursElapsed}h elapsed
              </span>
            </div>
            <p className="text-xs font-medium">{timeoutInfo.recommendation}</p>
          </div>
          {timeoutInfo.isTimeoutDue && (
            <button
              onClick={() => setIsTimeoutOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow"
            >
              Perform Clinical Timeout Review
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Active Prescriptions & Selected Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prescription List Column */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide border-b pb-2">
            Antimicrobial Regimens ({prescriptions.length})
          </h3>

          {loading ? (
            <p className="text-xs text-gray-500 py-4">Loading prescriptions...</p>
          ) : prescriptions.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">
              No antibiotic orders on record for this patient.
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {prescriptions.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPrescription(p.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                    selectedPrescription?.prescription.id === p.id
                      ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-900 text-sm">{p.drug_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        p.aware_tier === 'access'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.aware_tier === 'watch'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {p.aware_tier}
                    </span>
                  </div>
                  <div className="text-gray-600 font-medium">
                    {p.dosage} | {p.frequency} ({p.route.toUpperCase()})
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-gray-500 mt-2 pt-1 border-t">
                    <span>Started: {p.prescribed_datetime.slice(0, 10)}</span>
                    <span className="font-bold uppercase text-gray-700">{p.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Prescription Detailed Panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedPrescription ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    {selectedPrescription.prescription.drug_name}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                        selectedPrescription.prescription.aware_tier === 'access'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedPrescription.prescription.aware_tier === 'watch'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      WHO {selectedPrescription.prescription.aware_tier}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Indication: <strong>{selectedPrescription.prescription.indication.replace(/_/g, ' ')}</strong> | Prescribed by: {selectedPrescription.prescription.prescribed_by_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-800 font-bold uppercase">
                    Status: {selectedPrescription.prescription.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Prescription Clinical Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-xl border text-xs">
                <div>
                  <span className="text-gray-500 text-[10px] block uppercase font-semibold">Dosage & Route</span>
                  <span className="font-bold text-gray-900 block mt-0.5">
                    {selectedPrescription.prescription.dosage} ({selectedPrescription.prescription.route.toUpperCase()})
                  </span>
                  <span className="text-[11px] text-gray-600">{selectedPrescription.prescription.frequency}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block uppercase font-semibold">Duration Plan</span>
                  <span className="font-bold text-gray-900 block mt-0.5">
                    {selectedPrescription.prescription.planned_duration_days} days
                  </span>
                  <span className="text-[11px] text-gray-600">Started: {selectedPrescription.prescription.prescribed_datetime.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block uppercase font-semibold">Baseline Markers</span>
                  <span className="text-[11px] text-gray-800 block mt-0.5">
                    WBC: <strong>{selectedPrescription.prescription.baseline_wbc || '-'}</strong>
                  </span>
                  <span className="text-[11px] text-gray-800 block">
                    CRP: <strong>{selectedPrescription.prescription.baseline_crp_mg_l ? `${selectedPrescription.prescription.baseline_crp_mg_l} mg/L` : '-'}</strong>
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block uppercase font-semibold">Diagnostic Cultures</span>
                  <span className="font-bold text-gray-900 block mt-0.5">
                    {selectedPrescription.prescription.cultures_sent === 1 ? 'Sent Pre-Treatment' : 'Not Recorded'}
                  </span>
                  <span className="text-[10px] text-gray-600 truncate block">
                    {selectedPrescription.prescription.culture_specimen_types || 'Blood'}
                  </span>
                </div>
              </div>

              {/* Timeout Reviews History */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Timeout Reviews ({selectedPrescription.reviews.length})
                  </h4>
                  <button
                    onClick={() => setIsTimeoutOpen(true)}
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold"
                  >
                    + Add Review
                  </button>
                </div>

                {selectedPrescription.reviews.length === 0 ? (
                  <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded border text-center">
                    No 48–72h timeout reviews performed yet for this prescription.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedPrescription.reviews.map(r => (
                      <div key={r.id} className="p-3 rounded-lg border bg-slate-50 text-xs space-y-1">
                        <div className="flex justify-between items-center font-bold text-gray-900">
                          <span className="text-indigo-800 uppercase tracking-wide">
                            Decision: {r.timeout_action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-gray-500 font-normal">
                            {r.review_datetime.slice(0, 16).replace('T', ' ')} (at {r.hours_since_initiation}h)
                          </span>
                        </div>
                        <div className="text-gray-700">
                          Culture: <strong>{r.culture_result_summary.replace(/_/g, ' ')}</strong> | Response: {r.clinical_response.replace(/_/g, ' ')}
                        </div>
                        <div className="text-gray-600 bg-white p-2 rounded border mt-1">
                          {r.justification_notes}
                        </div>
                        {r.new_antimicrobial_regimen && (
                          <div className="text-emerald-700 font-semibold mt-1">
                            New Regimen: {r.new_antimicrobial_regimen}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Microbiology Isolates */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                  Microbiology Culture & Sensitivity Isolates ({selectedPrescription.isolates.length})
                </h4>

                {selectedPrescription.isolates.length === 0 ? (
                  <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded border text-center">
                    No culture isolates linked directly to this prescription episode.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedPrescription.isolates.map(iso => {
                      let sensMap: Record<string, string> = {};
                      try {
                        sensMap = JSON.parse(iso.sensitivities_json || '{}');
                      } catch {
                        sensMap = {};
                      }
                      return (
                        <div key={iso.id} className="p-3 rounded-lg border bg-purple-50/40 text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-purple-950 text-sm">
                              {iso.pathogen_isolated} ({iso.specimen_type.toUpperCase()})
                            </span>
                            <span className="text-gray-500 text-[11px]">
                              Collected: {iso.collection_datetime.slice(0, 10)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {Object.entries(sensMap).map(([d, s]) => (
                              <span
                                key={d}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  s.toUpperCase() === 'S'
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : s.toUpperCase() === 'I'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-rose-100 text-rose-900 border-rose-300'
                                }`}
                              >
                                {d}: {s.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500 text-xs">
              Select an antimicrobial prescription order from the left to view timeout surveillance and culture sensitivities.
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AmsPrescriptionModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isPrescribeOpen}
        onClose={() => setIsPrescribeOpen(false)}
        onSuccess={() => loadPrescriptions()}
      />

      {selectedPrescription && (
        <AmsTimeoutModal
          prescriptionId={selectedPrescription.prescription.id}
          drugName={selectedPrescription.prescription.drug_name}
          patientName={patientName}
          hoursElapsed={timeoutInfo?.hoursElapsed || 48}
          isOpen={isTimeoutOpen}
          onClose={() => setIsTimeoutOpen(false)}
          onSuccess={() => handleSelectPrescription(selectedPrescription.prescription.id)}
        />
      )}

      <AmsIsolateModal
        patientId={patientId}
        patientName={patientName}
        prescriptionId={selectedPrescription?.prescription.id}
        isOpen={isIsolateOpen}
        onClose={() => setIsIsolateOpen(false)}
        onSuccess={() => {
          if (selectedPrescription) {
            handleSelectPrescription(selectedPrescription.prescription.id);
          }
        }}
      />
    </div>
  );
};
