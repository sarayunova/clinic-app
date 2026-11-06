import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type OperativeNote } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { AllergyBadge, ErrorBanner, formatAge } from '../components/ui';

export function OperativeNotePrint() {
  const { id } = useParams();
  const opId = Number(id);
  const { clinic, error: clinicError } = useClinic();
  const [note, setNote] = useState<OperativeNote | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!Number.isInteger(opId) || opId < 1) return;
    api<OperativeNote>('GET', `/api/operative-notes/${opId}`).then(setNote, setError);
  }, [opId]);

  const logPrint = () => {
    if (!opId) return;
    void api('POST', `/api/operative-notes/${opId}/print`).catch(() => {});
  };

  if (error || clinicError) {
    return (
      <div className="page narrow">
        <ErrorBanner error={error ?? clinicError} />
      </div>
    );
  }

  if (!note || !clinic) {
    return <p className="muted" style={{ padding: '2rem' }}>Loading operative delivery record…</p>;
  }

  const backUrl = note.admissionId ? `/admissions/${note.admissionId}` : `/patients/${note.patientId}`;
  const isEmergency = note.urgency === 'emergency';
  const isPph = note.estimatedBloodLossMl >= 1000;

  return (
    <Sheet
      clinic={clinic}
      title="OPERATIVE DELIVERY & SURGICAL RECORD"
      back={backUrl}
      onPrint={logPrint}
      controls={
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span className="small muted">Operative Ref: <strong>{note.operativeNumber}</strong></span>
        </div>
      }
    >
      {/* Patient Demographics & Surgery Timing */}
      <section className="sheet-block">
        <dl className="sheet-meta" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div>
            <dt>Patient Name:</dt>
            <dd><strong>{note.patientName}</strong></dd>
          </div>
          <div>
            <dt>Patient MRN / ID:</dt>
            <dd>{note.patientNumber}</dd>
          </div>
          <div>
            <dt>Age / Gender:</dt>
            <dd>{note.dateOfBirth ? formatAge(new Date().getFullYear() - Number(note.dateOfBirth.slice(0, 4)), false) : '—'} / Female</dd>
          </div>
          <div>
            <dt>Admission / Bed:</dt>
            <dd>{note.admissionNumber ? `${note.admissionNumber} (${note.bedRoom ?? ''} / ${note.bedLabel ?? ''})` : 'Outpatient / Day Care'}</dd>
          </div>
          <div>
            <dt>Allergy Status:</dt>
            <dd>{note.allergyStatus ? <AllergyBadge status={note.allergyStatus} details={note.allergyDetails} /> : 'None recorded'}</dd>
          </div>
          <div>
            <dt>Surgery Date & Time:</dt>
            <dd><strong>{note.surgeryDate}</strong> ({note.startTime}{note.endTime ? ` – ${note.endTime}` : ''})</dd>
          </div>
        </dl>
      </section>

      {/* Procedure & Surgical Team */}
      <section className="sheet-block" style={{ borderTop: '2px solid var(--border)', paddingTop: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', margin: 0, textTransform: 'uppercase', color: 'var(--primary)' }}>
            {note.procedureName}
          </h2>
          <div>
            <span className={`badge ${isEmergency ? 'danger' : 'info'}`} style={{ fontWeight: 700 }}>
              {isEmergency ? 'EMERGENCY PROCEDURE' : 'ELECTIVE PROCEDURE'}
            </span>
            <span className="badge muted" style={{ marginLeft: '0.4rem' }}>
              Anesthesia: {note.anesthesiaType.toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '4px', borderLeft: '4px solid var(--primary)', marginBottom: '0.6rem' }}>
          <span className="small muted">Primary Indication: </span>
          <strong>{note.indication}</strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.4rem', fontSize: '0.85rem' }}>
          <div><span className="muted">Lead Surgeon:</span> <strong>{note.surgeonName}</strong></div>
          <div><span className="muted">Assistant:</span> <strong>{note.assistantName || '—'}</strong></div>
          <div><span className="muted">Anesthetist:</span> <strong>{note.anesthetistName || '—'}</strong></div>
          <div><span className="muted">Pediatrician:</span> <strong>{note.pediatricianName || '—'}</strong></div>
          <div><span className="muted">Scrub Nurse:</span> <strong>{note.scrubNurseName || '—'}</strong></div>
        </div>
      </section>

      {/* WHO Pre-operative Surgical Safety Checklist Certification */}
      <section className="sheet-block" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.35rem', textTransform: 'uppercase', color: '#0369a1' }}>
          🛡️ WHO Surgical Safety Verification (Sign-In & Time-Out)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.3rem', fontSize: '0.82rem' }}>
          <div>{note.preopIdentityConsentVerified ? '☑' : '☐'} Patient Identity & Consent Confirmed</div>
          <div>{note.preopSiteMarked ? '☑' : '☐'} Surgical Site Marked / Confirmed</div>
          <div>{note.preopAnesthesiaSafetyChecked ? '☑' : '☐'} Anesthesia Machine & Drug Check Done</div>
          <div>{note.preopPulseOximeterFunctioning ? '☑' : '☐'} Pulse Oximeter Functioning</div>
          <div>{note.preopAllergiesReviewed ? '☑' : '☐'} Known Allergies Reviewed</div>
          <div>{note.preopDifficultAirwayAssessed ? '☑' : '☐'} Airway / Aspiration Risk Evaluated</div>
        </div>
        {(note.preopBloodAvailabilityUnits || note.preopAntibioticProphylaxis) && (
          <div style={{ fontSize: '0.82rem', marginTop: '0.35rem', color: '#334155' }}>
            {note.preopBloodAvailabilityUnits ? <div><span className="muted">Blood Availability:</span> {note.preopBloodAvailabilityUnits}</div> : null}
            {note.preopAntibioticProphylaxis ? <div><span className="muted">Pre-Op Antibiotic:</span> {note.preopAntibioticProphylaxis}</div> : null}
          </div>
        )}
      </section>

      {/* Operative Technique & Findings */}
      <section className="sheet-block" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.35rem', textTransform: 'uppercase' }}>
          Operative Findings & Surgical Technique
        </h3>
        <table className="table small" style={{ width: '100%', marginBottom: '0.5rem' }}>
          <tbody>
            <tr>
              <th style={{ width: '22%' }}>Incision Type:</th>
              <td style={{ width: '28%', textTransform: 'capitalize' }}>{note.incisionType}</td>
              <th style={{ width: '22%' }}>Fetal Presentation:</th>
              <td style={{ width: '28%', textTransform: 'capitalize' }}>{note.presentation}</td>
            </tr>
            <tr>
              <th>Liquor:</th>
              <td style={{ textTransform: 'capitalize' }}>{note.liquorCharacteristics ? note.liquorCharacteristics.replace(/_/g, ' ') : 'Clear'}</td>
              <th>Placenta Delivery:</th>
              <td>{note.placentaDelivery === 'spontaneous_cct' ? 'Spontaneous (CCT)' : 'Manual Removal'} ({note.placentaCompleteness ? note.placentaCompleteness.replace(/_/g, ' ') : 'Complete & Intact'})</td>
            </tr>
            <tr>
              <th>Uterine Closure:</th>
              <td colSpan={3}>{note.uterineClosure || 'Closed in 2 continuous layers with absorbable suture'}</td>
            </tr>
            {note.extractionDetails && (
              <tr>
                <th>Delivery Details:</th>
                <td colSpan={3}>{note.extractionDetails}</td>
              </tr>
            )}
            {note.findingsNotes && (
              <tr>
                <th>Pelvic Findings:</th>
                <td colSpan={3}>{note.findingsNotes}</td>
              </tr>
            )}
            <tr>
              <th>Blood Loss:</th>
              <td>
                <strong style={{ color: isPph ? 'var(--danger)' : 'inherit' }}>
                  {note.estimatedBloodLossMl} ml {isPph ? '(Postpartum Hemorrhage)' : ''}
                </strong>
              </td>
              <th>Tubal Sterilization:</th>
              <td>{note.tubalLigationPerformed ? `Performed (${note.tubalLigationNotes || 'Bilateral Pomeroy'})` : 'Not performed'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Newborn Delivery Summary */}
      {note.babyGender && (
        <section className="sheet-block" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', background: '#f8fafc', padding: '0.6rem', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.35rem', textTransform: 'uppercase', color: '#15803d' }}>
            👶 Newborn Delivery Record & APGAR Score
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.4rem', fontSize: '0.85rem' }}>
            <div><span className="muted">Gender:</span> <strong style={{ textTransform: 'capitalize' }}>{note.babyGender}</strong></div>
            <div><span className="muted">Birth Weight:</span> <strong>{note.babyWeightGrams ? `${note.babyWeightGrams} g` : '—'}</strong></div>
            <div><span className="muted">Time of Birth:</span> <strong>{note.babyDeliveryTime || note.startTime}</strong></div>
            <div>
              <span className="muted">APGAR Score:</span>{' '}
              <strong style={{ color: Number(note.apgar1min) >= 7 ? '#15803d' : '#dc2626' }}>1m: {note.apgar1min ?? '—'}/10</strong> ·{' '}
              <strong style={{ color: Number(note.apgar5min) >= 8 ? '#15803d' : '#dc2626' }}>5m: {note.apgar5min ?? '—'}/10</strong>
            </div>
          </div>
          {note.babyResuscitationDetails && (
            <div style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>
              <span className="muted">Immediate Resuscitation:</span> {note.babyResuscitationDetails}
            </div>
          )}
        </section>
      )}

      {/* Safety Counts & Closure */}
      <section className="sheet-block" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.35rem', textTransform: 'uppercase', color: '#166534' }}>
          ✅ Swab, Needle & Instrument Count Certification
        </h3>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
          <span>{note.spongeCountVerified ? '☑' : '☒'} Laparotomy Sponges / Gauzes Correct</span>
          <span>{note.needleCountVerified ? '☑' : '☒'} Surgical Needles Correct</span>
          <span>{note.instrumentCountVerified ? '☑' : '☒'} Instruments Correct</span>
          {note.drainPlaced && <span>⚠️ Abdominal Drain: {note.drainType || 'Placed'}</span>}
        </div>
        {note.closureDetails && (
          <div style={{ fontSize: '0.83rem', marginTop: '0.35rem' }}>
            <span className="muted">Closure Details:</span> {note.closureDetails}
          </div>
        )}
      </section>

      {/* Post-Operative Orders */}
      <section className="sheet-block" style={{ borderTop: '2px solid var(--border)', paddingTop: '0.6rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem', textTransform: 'uppercase', color: 'var(--primary)' }}>
          📋 Post-Operative Orders & Recovery Protocol
        </h3>
        <ol style={{ margin: '0 0 0.5rem', paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '1.6' }}>
          {note.postopVitalsMonitoring && <li><strong>Monitoring:</strong> {note.postopVitalsMonitoring}</li>}
          {note.postopIvFluids && <li><strong>IV Fluids & Uterotonics:</strong> {note.postopIvFluids}</li>}
          {note.postopAnalgesia && <li><strong>Analgesia:</strong> {note.postopAnalgesia}</li>}
          {note.postopAntibiotics && <li><strong>Antibiotics:</strong> {note.postopAntibiotics}</li>}
          {note.postopThromboprophylaxis && <li><strong>Thromboprophylaxis:</strong> {note.postopThromboprophylaxis}</li>}
          {note.postopDiet && <li><strong>Diet:</strong> {note.postopDiet}</li>}
          {note.postopCatheterInstructions && <li><strong>Urinary Catheter:</strong> {note.postopCatheterInstructions}</li>}
          {note.specialInstructions && <li><strong>Special Instructions:</strong> {note.specialInstructions}</li>}
        </ol>
      </section>

      {/* Dual Signature Blocks: Operating Surgeon + Anesthetist / Nursing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem', pageBreakInside: 'avoid' }}>
        <div>
          <SignatureBlock clinic={clinic} signatoryName={note.surgeonName} designation="Lead Operating Surgeon" alignment="left" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', textAlign: 'center' }}>
          <div style={{ minHeight: '60px' }} />
          <div style={{ borderTop: '1px solid var(--text)', paddingTop: '0.3rem', fontSize: '0.85rem' }}>
            <strong>{note.anesthetistName || 'Consultant Anesthesiologist'}</strong>
            <div className="muted small">Anesthetist / OT In-Charge Signature</div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
