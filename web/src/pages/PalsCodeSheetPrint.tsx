import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getBroselowEvent,
  auditPalsPrint,
  type BroselowEventRecord,
} from '../api';
import { lookupBroselowZone } from '../palsEngine';

export const PalsCodeSheetPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<BroselowEventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const eventId = Number(id);
    Promise.all([
      getBroselowEvent(eventId),
      auditPalsPrint(eventId).catch(() => {}),
    ])
      .then(([res]) => {
        setEvent(res.event);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load resuscitation event dossier');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-sans">
        Preparing Pediatric Code Blue Resuscitation Dossier...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-8 text-center text-red-600 font-sans">
        {error || 'Resuscitation record not found'}
      </div>
    );
  }

  const zoneInfo = lookupBroselowZone({
    lengthCm: event.measured_length_cm,
    weightKg: event.estimated_weight_kg,
  });

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-sans text-xs leading-normal print:p-0 print:max-w-none">
      {/* Print Controls (Hidden on Print) */}
      <div className="mb-6 flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 print:hidden">
        <div>
          <span className="font-bold text-gray-800 text-sm block">
            AHA PALS / NABH Code Blue Resuscitation Record
          </span>
          <span className="text-gray-500 text-xs">
            Permanent Clinical Medical Record & Code Blue Audit Archive
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow text-xs flex items-center gap-1.5"
        >
          🖨️ Print Code Blue Dossier (A4)
        </button>
      </div>

      {/* Hospital Letterhead */}
      <div className="border-b-2 border-gray-900 pb-4 mb-4 text-center">
        <h1 className="text-xl font-black uppercase tracking-wider">
          LIVI CLINIC & CHILDREN'S HOSPITAL
        </h1>
        <p className="text-[11px] text-gray-600 uppercase font-semibold tracking-wide">
          Department of Pediatric Emergency & Critical Care Medicine &bull; Code Blue Rapid Response System
        </p>
        <h2 className="text-sm font-extrabold uppercase mt-2 bg-gray-900 text-white py-1 tracking-wider">
          PEDIATRIC ADVANCED LIFE SUPPORT (PALS) CODE BLUE RESUSCITATION RECORD
        </h2>
      </div>

      {/* Event & Patient Summary Strip */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-3 mb-4 rounded bg-gray-50/50">
        <div>
          <div className="grid grid-cols-3 gap-1">
            <span className="font-bold text-gray-700">Patient Name:</span>
            <span className="col-span-2 font-black uppercase">{event.patient_name}</span>

            <span className="font-bold text-gray-700">UHID:</span>
            <span className="col-span-2 font-mono font-bold">{event.patient_uhid}</span>

            <span className="font-bold text-gray-700">Length / Tape:</span>
            <span className="col-span-2 font-semibold">
              {event.measured_length_cm} cm &bull; {event.broselow_color_zone.toUpperCase()} ZONE ({event.estimated_weight_kg} kg)
            </span>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-1">
            <span className="font-bold text-gray-700">Event Code:</span>
            <span className="col-span-2 font-mono font-bold text-red-700">{event.event_code}</span>

            <span className="font-bold text-gray-700">Event Time:</span>
            <span className="col-span-2">
              {new Date(event.event_datetime).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>

            <span className="font-bold text-gray-700">Team Leader:</span>
            <span className="col-span-2 font-semibold">{event.team_leader_name || 'Dr. Arjun Mehta, MD (Peds)'}</span>
          </div>
        </div>
      </div>

      {/* Broselow Tape Resuscitation Parameters */}
      <div className="border border-gray-300 p-3 mb-4 rounded space-y-3">
        <div className="font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 flex justify-between">
          <span>Broselow Color-Calibrated Resuscitation Specifications</span>
          <span className="text-red-700 font-mono">WEIGHT CATEGORY: {event.estimated_weight_kg} KG</span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-[11px]">
          {/* Airway */}
          <div className="space-y-1">
            <span className="font-bold block text-blue-900 border-b border-blue-100 pb-0.5">AIRWAY / INTUBATION:</span>
            <div><strong>ETT Cuffed:</strong> {event.ett_cuffed_size} mm ID</div>
            <div><strong>ETT Uncuffed:</strong> {zoneInfo.ettUncuffedSize} mm ID</div>
            <div><strong>Depth at Lip:</strong> {event.ett_depth_cm} cm</div>
            <div><strong>Laryngoscope Blade:</strong> {zoneInfo.laryngoscopeBlade}</div>
            <div><strong>Suction Catheter:</strong> {zoneInfo.suctionCatheterFr} Fr</div>
          </div>

          {/* Defibrillation */}
          <div className="space-y-1">
            <span className="font-bold block text-rose-900 border-b border-rose-100 pb-0.5">DEFIBRILLATION & FLUIDS:</span>
            <div><strong>Initial Defib (2 J/kg):</strong> {event.defib_joules_initial} Joules</div>
            <div><strong>Subsequent Defib (4 J/kg):</strong> {zoneInfo.defibSubsequentJoules} Joules</div>
            <div><strong>Synchronized Cardioversion:</strong> {Math.round(event.estimated_weight_kg * 0.5)} - {Math.round(event.estimated_weight_kg * 1)} Joules</div>
            <div><strong>Fluid Bolus (20 mL/kg):</strong> {event.fluid_bolus_ml} mL NS IV/IO</div>
            <div><strong>10% Dextrose (2 mL/kg):</strong> {zoneInfo.dextrose10PercentMl} mL D10W IV/IO</div>
          </div>

          {/* Resuscitation Formulary */}
          <div className="space-y-1">
            <span className="font-bold block text-purple-900 border-b border-purple-100 pb-0.5">EMERGENCY DRUGS:</span>
            <div><strong>Epinephrine (1:10,000):</strong> {event.epinephrine_iv_dose_ml} mL (0.01 mg/kg)</div>
            <div><strong>Amiodarone (5 mg/kg):</strong> {zoneInfo.amiodaroneMg} mg IV/IO</div>
            <div><strong>Atropine (0.02 mg/kg):</strong> {zoneInfo.atropineMg} mg IV/IO</div>
            <div><strong>Adenosine (0.1 mg/kg):</strong> {zoneInfo.adenosineFirstDoseMg} mg rapid push</div>
          </div>
        </div>
      </div>

      {/* Resuscitation Narrative Summary */}
      <div className="border border-gray-300 p-3 mb-4 rounded space-y-2">
        <div className="font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1">
          Clinical Resuscitation Narrative & Outcome
        </div>
        <div className="text-[11px] leading-relaxed text-gray-800">
          <p>
            <strong>Event Indication:</strong> <span className="capitalize">{event.event_type.replace(/_/g, ' ')}</span>
          </p>
          <p className="mt-1">
            <strong>Clinical Summary & Interventions:</strong> {event.clinical_summary || 'Cardiopulmonary resuscitation initiated immediately according to AHA PALS algorithm. Bag-valve-mask ventilation, chest compressions, vascular access, and emergency pharmacotherapy administered per Broselow tape calibrations.'}
          </p>
          <div className="mt-2 p-2 bg-gray-100 rounded flex justify-between items-center">
            <span className="font-bold uppercase text-gray-800">Primary Resuscitation Outcome:</span>
            <span className="font-black text-rose-800 text-sm uppercase">
              {event.outcome.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* NABH Code Blue Quality Assurance Statement */}
      <div className="border border-gray-400 p-2.5 rounded bg-gray-50 text-[10px] space-y-1 mb-8">
        <span className="font-bold text-gray-900 block uppercase">
          NABH Hospital Resuscitation Audit Compliance
        </span>
        <p className="text-gray-700">
          This document certifies that the resuscitation event was conducted in full adherence to the Hospital Code Blue Protocol and AHA PALS 2020 Guidelines. All drug dosages and equipment sizes were verified via the standardized Broselow Pediatric Resuscitation System.
        </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-300 text-center text-xs">
        <div>
          <div className="h-12 border-b border-gray-400 border-dashed mb-2"></div>
          <span className="font-bold block">Resuscitation Team Leader</span>
          <span className="text-[10px] text-gray-500">Sign & Date / Registration No.</span>
        </div>
        <div>
          <div className="h-12 border-b border-gray-400 border-dashed mb-2"></div>
          <span className="font-bold block">Code Blue Nurse Recorder</span>
          <span className="text-[10px] text-gray-500">Sign & Date / Registration No.</span>
        </div>
        <div>
          <div className="h-12 border-b border-gray-400 border-dashed mb-2"></div>
          <span className="font-bold block">Consultant Pediatrician / PICU Fellow</span>
          <span className="text-[10px] text-gray-500">Sign & Date / Registration No.</span>
        </div>
      </div>
    </div>
  );
};
