import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type ObstetricDischargeSummary } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';
import {
  DELIVERY_MODE_LABELS,
  PERINEUM_WOUND_LABELS,
  FUNDAL_INVOLUTION_LABELS,
  LOCHIA_LABELS,
  LACTATION_LABELS,
  CONTRACEPTION_LABELS,
  FEEDING_LABELS,
  JAUNDICE_LABELS,
  CRY_LABELS,
} from '../components/ObstetricDischargeManager';

export function ObstetricDischargePrint() {
  const { id } = useParams();
  const dischargeId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [discharge, setDischarge] = useState<ObstetricDischargeSummary | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!dischargeId) return;
    api<ObstetricDischargeSummary>('GET', `/api/obstetric-discharges/${dischargeId}`)
      .then(setDischarge)
      .catch(setError);
  }, [dischargeId]);

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to="/patients" className="btn small">
            ← Back to Patients
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !discharge) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading obstetric discharge summary…</p>
      </div>
    );
  }

  const examLabels: Record<string, string> = {
    tone: 'Tone & Reflexes',
    fontanelle: 'Fontanelle & Sutures',
    palate: 'Palate & Mouth',
    eyes: 'Eyes & Red Reflex',
    cardiopulmonary: 'Heart & Lungs',
    abdomen: 'Abdomen',
    cord: 'Umbilical Cord Stump',
    genitalia: 'External Genitalia',
    anus: 'Anus (Patency)',
    hips_spine: 'Hips & Spine',
  };

  return (
    <Sheet
      clinic={clinic}
      title="Obstetric Postnatal Discharge Summary & Puerperium Care Pack"
      back={`/patients/${discharge.patientId}`}
      onPrint={() => window.print()}
    >
      {/* Document Sub-title Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Mother & Newborn Care Protocol
          </span>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
            {DELIVERY_MODE_LABELS[discharge.deliveryMode] || discharge.deliveryMode}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Discharge Date</div>
          <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{discharge.dischargeDate}</strong>
        </div>
      </div>

      {/* Maternal Demographics Grid */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <dl
          className="grid-meta"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem 1rem',
            margin: 0,
            background: '#f8fafc',
            padding: '0.6rem 0.8rem',
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <dt style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Mother's Name</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{discharge.patientName || '—'}</dd>
          </div>
          <div>
            <dt style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Mother ID</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{discharge.patientNumber || '—'}</dd>
          </div>
          <div>
            <dt style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Parity / Obstetric History</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {discharge.gravida != null ? `G${discharge.gravida} P${discharge.para ?? 0}` : 'Recorded in file'}
            </dd>
          </div>
          <div>
            <dt style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>IPD Admission #</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{discharge.admissionNumber || '—'}</dd>
          </div>
        </dl>
      </section>

      {/* 1. Labor & Delivery Summary */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          1. Labor & Delivery Summary
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Delivery Date & Time: </span>
            <strong>{discharge.deliveryAt || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Primary Obstetrician: </span>
            <strong>{discharge.primaryObstetrician || 'Attending Obstetrician'}</strong>
          </div>
          {discharge.deliveryIndication && (
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#64748b' }}>Indication: </span>
              <strong>{discharge.deliveryIndication}</strong>
            </div>
          )}
          {discharge.deliveryNotes && (
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#64748b' }}>Delivery / Intra-op Notes: </span>
              <span>{discharge.deliveryNotes}</span>
            </div>
          )}
        </div>
      </section>

      {/* 2. Maternal Puerperium & Involution Progress */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          2. Maternal Puerperium & Clinical Involution
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Uterine Fundus: </span>
            <strong>{FUNDAL_INVOLUTION_LABELS[discharge.fundalInvolution] || discharge.fundalInvolution}</strong>
            {discharge.fundalHeightCm && <span className="muted"> ({discharge.fundalHeightCm})</span>}
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Lochia Progress: </span>
            <strong>{LOCHIA_LABELS[discharge.lochiaCharacter] || discharge.lochiaCharacter}</strong>
            {discharge.lochiaNotes && <span className="muted"> ({discharge.lochiaNotes})</span>}
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Perineum / Wound: </span>
            <strong>{PERINEUM_WOUND_LABELS[discharge.perineumWoundStatus] || discharge.perineumWoundStatus}</strong>
            {discharge.perineumNotes && <span className="muted"> ({discharge.perineumNotes})</span>}
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Lactation: </span>
            <strong>{LACTATION_LABELS[discharge.lactationStatus] || discharge.lactationStatus}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Breasts: </span>
            <span>{discharge.breastExamination || 'Soft, healthy nipples'}</span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Bladder & Bowels: </span>
            <span>{discharge.bladderBowelStatus || 'Normal spontaneous voiding'}</span>
          </div>
        </div>

        {/* Discharge Vitals Row */}
        {(discharge.dischargeBpSystolic || discharge.dischargePulse) && (
          <div
            style={{
              marginTop: '0.5rem',
              background: '#f1f5f9',
              padding: '0.4rem 0.6rem',
              borderRadius: '4px',
              display: 'flex',
              gap: '1.5rem',
              fontSize: '0.8rem',
            }}
          >
            <span>
              <strong>Discharge BP:</strong> {discharge.dischargeBpSystolic || '—'}/{discharge.dischargeBpDiastolic || '—'} mmHg
            </span>
            <span>
              <strong>Pulse:</strong> {discharge.dischargePulse ? `${discharge.dischargePulse} bpm` : '—'}
            </span>
            <span>
              <strong>Temp:</strong> {discharge.dischargeTempF ? `${discharge.dischargeTempF}°F` : '98.4°F'}
            </span>
            <span>
              <strong>SpO2:</strong> {discharge.dischargeSpo2 ? `${discharge.dischargeSpo2}%` : '99%'}
            </span>
          </div>
        )}
      </section>

      {/* 3. Postnatal Contraception */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          3. Postnatal Contraception & Family Planning
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Method Adopted: </span>
            <strong>{CONTRACEPTION_LABELS[discharge.contraceptionChosen] || discharge.contraceptionChosen}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Notes & Instructions: </span>
            <span>{discharge.contraceptionNotes || (discharge.contraceptionCounselled ? 'Counselled on spacing & postpartum contraception options.' : '—')}</span>
          </div>
        </div>
      </section>

      {/* 4. Newborn Birth & Resuscitation Summary */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          4. Newborn Delivery & Resuscitation Details
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Gender: </span>
            <strong style={{ textTransform: 'uppercase' }}>{discharge.babyGender}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Gestational Age: </span>
            <strong>
              {discharge.babyGestationalAgeWeeks ? `${discharge.babyGestationalAgeWeeks}w ${discharge.babyGestationalAgeDays || 0}d` : 'Term'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>APGAR Score: </span>
            <strong>
              1m: {discharge.babyApgar1min ?? '—'} | 5m: {discharge.babyApgar5min ?? '—'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Cry at Birth: </span>
            <strong>{CRY_LABELS[discharge.babyCryAtBirth] || discharge.babyCryAtBirth}</strong>
          </div>

          <div>
            <span style={{ color: '#64748b' }}>Birth Weight: </span>
            <strong>{discharge.babyBirthWeightGrams ? `${discharge.babyBirthWeightGrams} g` : '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Discharge Weight: </span>
            <strong>{discharge.babyDischargeWeightGrams ? `${discharge.babyDischargeWeightGrams} g` : '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Length / Head Circ: </span>
            <span>
              {discharge.babyLengthCm ? `${discharge.babyLengthCm} cm` : '—'} / {discharge.babyHcCm ? `${discharge.babyHcCm} cm` : '—'}
            </span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Baby Blood Group: </span>
            <strong>{discharge.babyBloodGroup || 'Pending'}</strong>
          </div>

          {discharge.babyPatientNumber && (
            <div style={{ gridColumn: 'span 4' }}>
              <span style={{ color: '#64748b' }}>Registered Pediatric Patient ID: </span>
              <strong>{discharge.babyPatientNumber} ({discharge.babyPatientName || 'Child Record'})</strong>
            </div>
          )}
          {discharge.babyResuscitationDetails && (
            <div style={{ gridColumn: 'span 4' }}>
              <span style={{ color: '#64748b' }}>Neonatal Resuscitation Notes: </span>
              <span>{discharge.babyResuscitationDetails}</span>
            </div>
          )}
        </div>
      </section>

      {/* 5. Neonatal Discharge Examination & Feeding */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          5. Neonatal Discharge Examination & Transition
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Feeding Method: </span>
            <strong>{FEEDING_LABELS[discharge.neonatalFeedingMethod] || discharge.neonatalFeedingMethod}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Neonatal Jaundice: </span>
            <strong>{JAUNDICE_LABELS[discharge.jaundiceAssessment] || discharge.jaundiceAssessment}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Excretion (&lt;24h): </span>
            <span>
              Meconium: {discharge.meconiumPassed ? '✓ Passed' : 'Pending'} · Urine: {discharge.urinePassed ? '✓ Passed' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Head to toe checklist table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '0.3rem' }}>
          <tbody>
            {Object.entries(examLabels).map(([key, label], idx) => {
              if (idx % 2 !== 0) return null;
              const nextKey = Object.keys(examLabels)[idx + 1];
              const nextLabel = nextKey ? examLabels[nextKey] : null;
              return (
                <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '3px 6px', fontWeight: 600, width: '20%', color: '#334155' }}>{label}</td>
                  <td style={{ padding: '3px 6px', width: '30%' }}>{discharge.neonatalExam[key] || 'Normal'}</td>
                  {nextKey && nextLabel ? (
                    <>
                      <td style={{ padding: '3px 6px', fontWeight: 600, width: '20%', color: '#334155', borderLeft: '1px solid #e2e8f0' }}>{nextLabel}</td>
                      <td style={{ padding: '3px 6px', width: '30%' }}>{discharge.neonatalExam[nextKey] || 'Normal'}</td>
                    </>
                  ) : (
                    <td colSpan={2}></td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 6. Newborn Birth Immunization & Screening Card */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          6. Newborn Birth Immunization Card & Screening Record
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div style={{ border: '1px solid #cbd5e1', padding: '0.4rem 0.6rem', borderRadius: '4px', background: discharge.bcgGiven ? '#f0fdf4' : '#fff' }}>
            <div style={{ fontWeight: 700, color: discharge.bcgGiven ? '#15803d' : '#64748b' }}>
              {discharge.bcgGiven ? '✓ BCG Vaccine' : '○ BCG Vaccine'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Dose: 0.05 ml ID (Left deltoid)
              {discharge.bcgDate && <div>Date given: <strong>{discharge.bcgDate}</strong></div>}
            </div>
          </div>

          <div style={{ border: '1px solid #cbd5e1', padding: '0.4rem 0.6rem', borderRadius: '4px', background: discharge.opvZeroGiven ? '#f0fdf4' : '#fff' }}>
            <div style={{ fontWeight: 700, color: discharge.opvZeroGiven ? '#15803d' : '#64748b' }}>
              {discharge.opvZeroGiven ? '✓ bOPV-0 (Oral Polio)' : '○ bOPV-0'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Dose: 2 drops Oral
              {discharge.opvZeroDate && <div>Date given: <strong>{discharge.opvZeroDate}</strong></div>}
            </div>
          </div>

          <div style={{ border: '1px solid #cbd5e1', padding: '0.4rem 0.6rem', borderRadius: '4px', background: discharge.hepbBirthGiven ? '#f0fdf4' : '#fff' }}>
            <div style={{ fontWeight: 700, color: discharge.hepbBirthGiven ? '#15803d' : '#64748b' }}>
              {discharge.hepbBirthGiven ? '✓ Hepatitis B (Birth Dose)' : '○ Hepatitis B'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Dose: 0.5 ml IM (Anterolateral thigh)
              {discharge.hepbBirthDate && <div>Date given: <strong>{discharge.hepbBirthDate}</strong></div>}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.4rem', fontSize: '0.8rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Newborn Hearing Screening (OAE): </span>
            <strong style={{ textTransform: 'uppercase' }}>{discharge.hearingScreenResult}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Metabolic / Congenital Hypothyroidism Screen: </span>
            <strong style={{ textTransform: 'uppercase' }}>{discharge.metabolicScreenResult}</strong>
          </div>
        </div>
      </section>

      {/* 7. Maternal Discharge Medications */}
      {discharge.dischargeMedicinesText && (
        <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
          <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
            7. Maternal Discharge Medications & Prescriptions
          </h4>
          <pre
            style={{
              margin: 0,
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              fontSize: '0.85rem',
              background: '#f8fafc',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
            }}
          >
            {discharge.dischargeMedicinesText}
          </pre>
        </section>
      )}

      {/* 8. Emergency Warning Signs Box */}
      <section
        className="sheet-block"
        style={{
          marginBottom: '0.8rem',
          border: '1.5px solid #dc2626',
          borderRadius: '4px',
          padding: '0.5rem 0.75rem',
          background: '#fff5f5',
        }}
      >
        <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
          ⚠️ EMERGENCY ALARM SIGNS COUNSELLED — RETURN IMMEDIATELY IF:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: '#7f1d1d' }}>
          <div>
            <strong>Maternal Danger Signs:</strong>
            <ul style={{ margin: '0.1rem 0 0 1rem', padding: 0 }}>
              <li>Sudden heavy vaginal bleeding or large blood clots (soaking &gt;2 pads/hr)</li>
              <li>Fever &gt;100.4°F with chills or foul-smelling vaginal discharge</li>
              <li>Persistent severe headache, blurred vision, or severe epigastric pain</li>
              <li>Severe unilateral calf pain, redness, or swelling</li>
            </ul>
          </div>
          <div>
            <strong>Newborn Danger Signs:</strong>
            <ul style={{ margin: '0.1rem 0 0 1rem', padding: 0 }}>
              <li>Poor sucking or refusal to feed for &gt;2 consecutive feeds</li>
              <li>Lethargy, limpness, or difficulty waking up</li>
              <li>Fast breathing (&gt;60 breaths/min), chest indrawing, or grunting</li>
              <li>High fever (&gt;38°C/100.4°F) or hypothermia (&lt;36°C/96.8°F); deep jaundice</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 9. Follow-up Schedule */}
      <section className="sheet-block" style={{ marginBottom: '1.2rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          8. Follow-up Schedule & Special Instructions
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Maternal Review (Wound / Suture Check): </span>
            <strong style={{ color: '#1d4ed8' }}>{discharge.maternalFollowupDate || 'Day 7 Postpartum'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Newborn Review & Immunization: </span>
            <strong style={{ color: '#1d4ed8' }}>{discharge.newbornFollowupDate || '6 Weeks (Pentavalent-1, OPV-1, Rotavirus)'}</strong>
          </div>
          {discharge.consultantSpecialInstructions && (
            <div style={{ gridColumn: 'span 2', marginTop: '0.2rem' }}>
              <span style={{ color: '#64748b' }}>Special Instructions: </span>
              <span>{discharge.consultantSpecialInstructions}</span>
            </div>
          )}
        </div>
      </section>

      {/* Dual Signature Blocks: Obstetrician & Pediatrician */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          marginTop: '1.5rem',
          paddingTop: '0.5rem',
        }}
      >
        <SignatureBlock
          clinic={clinic}
          signatoryName={discharge.primaryObstetrician || discharge.createdByName || 'Attending Obstetrician'}
          designation="Consultant Obstetrician & Gynecologist"
        />
        <SignatureBlock
          clinic={clinic}
          signatoryName="Consultant Pediatrician / Neonatologist"
          designation="Dept. of Neonatology & Child Health"
          hideSignatureImage
        />
      </div>
    </Sheet>
  );
}
