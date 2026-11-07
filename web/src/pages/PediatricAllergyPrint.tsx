import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getPediatricPramAssessment,
  getPediatricAnaphylaxisPlan,
  auditPediatricAllergyPrint,
  type PediatricPramRecord,
  type PediatricAnaphylaxisPlanRecord,
} from '../api';

export const PediatricAllergyPrint: React.FC = () => {
  const { type, id } = useParams<{ type: 'pram' | 'anaphylaxis'; id: string }>();
  const [pram, setPram] = useState<PediatricPramRecord | null>(null);
  const [plan, setPlan] = useState<PediatricAnaphylaxisPlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) return;
    const fetchDoc = async () => {
      setLoading(true);
      try {
        if (type === 'pram') {
          const res = await getPediatricPramAssessment(Number(id));
          setPram(res.assessment);
        } else {
          const res = await getPediatricAnaphylaxisPlan(Number(id));
          setPlan(res.plan);
        }
        await auditPediatricAllergyPrint(type, Number(id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [type, id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Loading Pediatric Respiratory & Allergy Document...
      </div>
    );
  }

  if (error || (!pram && !plan)) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center font-sans">
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
          {error || 'Record not found'}
        </div>
        <Link to="/pediatric-allergy" className="text-blue-600 underline text-sm">
          &larr; Return to Pediatric Allergy Console
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 text-slate-900 font-sans">
      {/* Non-printing Control Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden bg-slate-100 p-3 rounded-lg border border-slate-300">
        <Link to="/pediatric-allergy" className="text-blue-600 hover:underline text-xs font-semibold">
          &larr; Back to Pediatric Allergy Console
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-red-700 text-white rounded-lg text-xs font-bold hover:bg-red-800 shadow"
        >
          🖨️ Print {type === 'pram' ? 'Asthma Protocol' : 'Wallet Emergency Card'}
        </button>
      </div>

      {/* Sheet Container */}
      <div className="max-w-4xl mx-auto border-2 border-slate-800 p-6 rounded-lg space-y-5">
        {/* Header */}
        <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              DIVISION OF PEDIATRIC PULMONOLOGY & ALLERGY
            </h1>
            <h2 className="text-sm font-bold text-slate-700">
              {type === 'pram'
                ? 'Pediatric Respiratory Assessment Measure (PRAM) & Acute Asthma Protocol'
                : 'Pediatric Anaphylaxis Emergency Action Plan & School Health Card'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Protocol: {type === 'pram' ? 'GINA Acute Pediatric Asthma Management' : 'World Allergy Organization (WAO) Anaphylaxis Guidelines'}
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-sm font-bold block text-red-900">
              {pram?.assessment_code || plan?.plan_code}
            </span>
            <span className="text-[11px] text-slate-500">
              {pram?.assessment_datetime.replace('T', ' ') || plan?.diagnosis_date}
            </span>
          </div>
        </div>

        {/* Patient Demographics */}
        <div className="bg-slate-50 p-3 rounded border border-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Child Name</span>
            <strong className="text-slate-900">{pram?.patient_name || plan?.patient_name}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">UHID</span>
            <strong className="font-mono text-slate-900">{pram?.patient_uhid || plan?.patient_uhid}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">
              {pram ? 'Assessment Date' : 'Child Weight'}
            </span>
            <strong className="text-slate-900">
              {pram ? pram.assessment_datetime.slice(0, 10) : `${plan?.child_weight_kg} kg`}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Document Type</span>
            <strong className="text-slate-900 uppercase">{type === 'pram' ? 'Acute Asthma PRAM' : 'Emergency Action Plan'}</strong>
          </div>
        </div>

        {/* PRAM VIEW */}
        {pram && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-teal-50 rounded border border-teal-300">
                <span className="text-teal-900 block text-[10px] uppercase font-bold">Total PRAM Score</span>
                <strong className="text-xl text-teal-950 font-black block mt-0.5">{pram.total_pram_score} / 12</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Severity Tier</span>
                <strong className="text-xs uppercase block mt-1 text-slate-900 font-bold">
                  {pram.severity_tier.replace(/_/g, ' ')}
                </strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Room Air SpO2</span>
                <strong className="text-sm text-slate-900 block mt-0.5">{pram.oxygen_saturation_pct}%</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Burst SABA Response</span>
                <strong className="text-xs text-slate-900 block mt-1 capitalize">
                  {pram.response_to_burst_saba.replace(/_/g, ' ')}
                </strong>
              </div>
            </div>

            {/* Score breakdown table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-300 pb-1">
                PRAM Score Components Auscultation & Examination
              </h3>
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 font-bold text-slate-800">
                  <tr>
                    <th className="p-2 border-b border-r border-slate-300">Clinical Sign</th>
                    <th className="p-2 border-b border-r border-slate-300">Score Range</th>
                    <th className="p-2 border-b border-r border-slate-300">Patient Score</th>
                    <th className="p-2 border-b border-slate-300">Evaluation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-bold">Room Air SpO2</td>
                    <td className="p-2 border-r border-slate-200">0 to 2 pts</td>
                    <td className="p-2 border-r border-slate-200 font-bold">{pram.o2_score} pts</td>
                    <td className="p-2">{pram.oxygen_saturation_pct}% on pulse oximetry</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-bold">Suprasternal Indrawing</td>
                    <td className="p-2 border-r border-slate-200">0 or 2 pts</td>
                    <td className="p-2 border-r border-slate-200 font-bold">{pram.suprasternal_retractions_score} pts</td>
                    <td className="p-2">{pram.suprasternal_retractions_score === 2 ? 'Present (Tracheal tug)' : 'Absent'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-bold">Scalene Muscle Contraction</td>
                    <td className="p-2 border-r border-slate-200">0 or 2 pts</td>
                    <td className="p-2 border-r border-slate-200 font-bold">{pram.scalene_muscle_contraction_score} pts</td>
                    <td className="p-2">{pram.scalene_muscle_contraction_score === 2 ? 'Active accessory muscle use' : 'Absent'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-bold">Air Entry</td>
                    <td className="p-2 border-r border-slate-200">0 to 3 pts</td>
                    <td className="p-2 border-r border-slate-200 font-bold">{pram.air_entry_score} pts</td>
                    <td className="p-2">{pram.air_entry_score === 0 ? 'Normal' : pram.air_entry_score === 1 ? 'Decreased bases' : pram.air_entry_score === 2 ? 'Widespread decrease' : 'Silent chest'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-slate-200 font-bold">Wheezing</td>
                    <td className="p-2 border-r border-slate-200">0 to 3 pts</td>
                    <td className="p-2 border-r border-slate-200 font-bold">{pram.wheezing_score} pts</td>
                    <td className="p-2">{pram.wheezing_score === 0 ? 'Absent' : pram.wheezing_score === 1 ? 'Expiratory only' : pram.wheezing_score === 2 ? 'Inspiratory & Expiratory' : 'Audible / Silent chest'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-300 text-xs space-y-1">
              <strong className="text-slate-800 uppercase block">Treatment & Disposition Guideline:</strong>
              <p className="text-slate-700">
                {pram.total_pram_score <= 3
                  ? 'Mild: SABA 4-6 puffs via spacer. Reassess at 60 mins. Discharge home if stable with written action plan.'
                  : pram.total_pram_score <= 7
                  ? 'Moderate: Burst SABA + Ipratropium x 3 doses Q20min. Oral systemic corticosteroid (Dexamethasone 0.6 mg/kg). Admit if PRAM ≥ 4 after 2 hours.'
                  : 'Severe (PRAM 8-12): Continuous nebulization, Systemic IV steroid, IV Magnesium Sulfate 50 mg/kg (max 2g) over 20-30 min. Urgent PICU admission.'}
              </p>
            </div>
          </div>
        )}

        {/* ANAPHYLAXIS WALLET CARD VIEW */}
        {plan && (
          <div className="space-y-4">
            {/* Wallet Card Cut-out Box */}
            <div className="border-4 border-dashed border-red-600 p-4 rounded-xl bg-red-50/50 space-y-3">
              <div className="flex items-center justify-between border-b-2 border-red-600 pb-2">
                <span className="text-sm font-black text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🚨</span> EMERGENCY ANAPHYLAXIS WALLET ACTION CARD
                </span>
                <span className="text-xs bg-red-600 text-white font-bold px-2.5 py-0.5 rounded-full uppercase">
                  WEIGHT: {plan.child_weight_kg} KG
                </span>
              </div>

              {/* Patient & Allergens */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Child Name:</span>
                  <strong className="text-sm text-slate-900">{plan.patient_name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Emergency Phone:</span>
                  <strong className="text-sm text-red-700 font-mono">{plan.emergency_contact_phone} ({plan.emergency_contact_name})</strong>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded border border-red-200">
                <span className="text-xs font-bold text-red-900 block mb-1">CONFIRMED SEVERE ALLERGENS:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(plan.known_allergens || []).map((alg, i) => (
                    <span key={i} className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded font-bold">
                      ⚠️ {alg}
                    </span>
                  ))}
                </div>
              </div>

              {/* Exact Dose & Injection Instructions */}
              <div className="bg-red-600 text-white p-3 rounded-lg text-xs space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider block text-yellow-300">
                  STEP 1: INJECT EPINEPHRINE IMMEDIATELY
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-red-200 block text-[10px]">PRESCRIBED DOSE:</span>
                    <strong className="text-base text-white">{plan.epinephrine_im_dose_mg} mg IM ({plan.epinephrine_im_volume_ml} mL)</strong>
                  </div>
                  <div>
                    <span className="text-red-200 block text-[10px]">DEVICE TYPE:</span>
                    <strong className="text-xs text-white uppercase">{plan.autoinjector_type.replace(/_/g, ' ')}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-red-100 pt-1">
                  Inject firmly into the outer mid-thigh (through clothes if necessary). Hold in place for 3 seconds.
                </p>
              </div>

              {/* Action Rules */}
              <div className="text-[11px] text-slate-800 space-y-1 bg-white p-2.5 rounded border border-slate-200">
                <p><strong>STEP 2:</strong> Lay child completely FLAT with legs raised. DO NOT allow standing or walking.</p>
                <p><strong>STEP 3:</strong> Call Emergency Ambulance immediately (Dial 108 / 112). State "Anaphylaxis".</p>
                <p><strong>STEP 4:</strong> If no improvement within 5 to 10 minutes, inject a SECOND dose of Epinephrine.</p>
              </div>
            </div>

            {/* Secondary Meds */}
            <div className="p-3 bg-slate-50 rounded border border-slate-300 text-xs grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Oral Antihistamine (Adjunct):</span>
                <strong className="text-slate-900">{plan.antihistamine_prescribed || 'None prescribed'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Oral Steroids:</span>
                <strong className="text-slate-900">{plan.steroid_prescribed || 'None prescribed'}</strong>
              </div>
            </div>

            {plan.clinical_instructions && (
              <div className="p-3 bg-white rounded border border-slate-300 text-xs">
                <span className="font-bold text-slate-800 block mb-0.5">Physician Instructions:</span>
                <p className="text-slate-700">{plan.clinical_instructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Signatures */}
        <div className="pt-6 border-t-2 border-slate-800 grid grid-cols-2 gap-6 text-xs">
          <div className="border-t border-slate-400 pt-2 text-center">
            <span className="font-bold block text-slate-900">
              {pram?.assessed_by_name || plan?.attending_physician_name || 'Attending Pediatrician'}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Consultant Pediatric Pulmonologist / Allergist</span>
          </div>

          <div className="border-t border-slate-400 pt-2 text-center">
            <span className="font-bold block text-slate-900">Parent / Legal Guardian Acknowledgment</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Trained in Epinephrine Autoinjector Administration</span>
          </div>
        </div>
      </div>
    </div>
  );
};
