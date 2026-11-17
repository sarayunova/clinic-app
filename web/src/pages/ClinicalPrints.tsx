import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, type Admission, type Visit } from '../api';
import { useAuth } from '../auth';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner, formatAge } from '../components/ui';
import { calculateEdd, calculateGestationalAge, formatGpal } from '../pregnancy';

const logPrint = (kind: 'prescription' | 'discharge_summary', id: number) => () => {
  void api('POST', '/api/print-log', { kind, id }).catch(() => {});
};

function Allergy({ status, details }: { status: 'unknown' | 'none' | 'known'; details: string | null }) {
  return (
    <div>
      <strong>Allergies: </strong>
      {status === 'known' ? details : status === 'none' ? 'None known' : 'Not recorded'}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sheet-block">
      <h3>{title}</h3>
      <div className="pre">{children}</div>
    </section>
  );
}



export function PrescriptionPrint() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const { clinic, error: clinicError } = useClinic();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [withDiagnosis, setWithDiagnosis] = useState(false);
  const [finalising, setFinalising] = useState(false);
  const [finaliseError, setFinaliseError] = useState<string | null>(null);

  useEffect(() => {
    api<Visit>('GET', `/api/visits/${id}`).then(setVisit, setError);
  }, [id]);

  useEffect(() => {
    if (visit && clinic && searchParams.get('autoPrint') === '1') {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [visit, clinic, searchParams]);

  const handleFinaliseNow = async () => {
    if (!visit) return;
    try {
      setFinalising(true);
      setFinaliseError(null);
      await api<Visit>('POST', `/api/visits/${visit.id}/finalise`, { version: visit.version });
      const updated = await api<Visit>('GET', `/api/visits/${id}`);
      setVisit(updated);
    } catch (e) {
      setFinaliseError((e as Error).message || 'Failed to finalise consultation');
    } finally {
      setFinalising(false);
    }
  };

  if (error || clinicError) return <div className="page narrow"><ErrorBanner error={error ?? clinicError} /></div>;
  if (!visit || !clinic) return <p className="muted">Loading…</p>;

  const isDraft = visit.status !== 'final';
  const amended = (visit.revisions ?? []).filter((r) => r.kind === 'amendment').length;
  const items = visit.prescriptionItems ?? [];

  return (
    <Sheet
      clinic={clinic}
      title={isDraft ? 'PRESCRIPTION (DRAFT PREVIEW)' : 'PRESCRIPTION'}
      back={`/visits/${visit.id}`}
      onPrint={logPrint('prescription', visit.id)}
      controls={
        <div className="stack" style={{ gap: '0.5rem' }}>
          {isDraft && (
            <div
              className="banner warn no-print"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.6rem',
                margin: 0,
              }}
            >
              <div>
                <strong>Draft Prescription Mode</strong>
                <div className="small muted">
                  This consultation is currently unfinalised. You can print/save a draft preview now, or click to lock and apply the doctor&apos;s official digital signature &amp; seal.
                </div>
                {finaliseError && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: '0.2rem' }}>{finaliseError}</div>}
              </div>
              {can('visit:finalise') && (
                <button
                  type="button"
                  className="btn small primary"
                  disabled={finalising}
                  onClick={handleFinaliseNow}
                >
                  {finalising ? 'Finalising…' : '🔒 Finalise & Sign Official Rx'}
                </button>
              )}
            </div>
          )}
          <label className="row">
            <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={withDiagnosis} onChange={(e) => setWithDiagnosis(e.target.checked)} />
            <span>Print the assessment / diagnosis on this prescription</span>
          </label>
        </div>
      }
    >
      {isDraft && (
        <div
          className="print-only draft-notice"
          style={{
            textAlign: 'center',
            color: '#dc2626',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            border: '1px dashed #dc2626',
            padding: '0.35rem',
            margin: '0.5rem 0',
          }}
        >
          — DRAFT PRESCRIPTION · PENDING DOCTOR SIGN-OFF —
        </div>
      )}
      <dl className="sheet-meta">
        <div><dt>Patient</dt><dd>{visit.patientName}</dd></div>
        <div><dt>Date</dt><dd>{visit.visitDate}</dd></div>
        <div><dt>Patient no.</dt><dd>{visit.patientNumber}</dd></div>
        <div><dt>Age</dt><dd>{formatAge(visit.ageYears, visit.ageIsEstimated)}</dd></div>
        {formatGpal(visit) && (
          <div><dt>Obstetric</dt><dd>{formatGpal(visit)}</dd></div>
        )}
        {(() => {
          const ga = calculateGestationalAge(visit.lastMenstrualPeriod as string | null, visit.visitDate);
          const edd = calculateEdd(visit.lastMenstrualPeriod as string | null);
          if (ga && edd && ga.isPlausiblePregnancy) {
            return <div><dt>Gestational Age</dt><dd>{ga.formatted} · EDD {edd}</dd></div>;
          }
          return null;
        })()}
      </dl>
      <Allergy status={visit.allergyStatus} details={visit.allergyDetails} />
      {withDiagnosis && visit.assessment && <Block title="Assessment">{visit.assessment}</Block>}

      <h3>Medicines</h3>
      {items.length === 0 ? (
        <p>No medicines prescribed.</p>
      ) : (
        <table className="table">
          <thead><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead>
          <tbody>
            {items.map((m, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <strong>{m.medicine}</strong>{m.strength ? ` ${m.strength}` : ''}
                  {m.route && <div className="small">Route: {m.route}</div>}
                  {m.instructions && <div className="small">{m.instructions}</div>}
                </td>
                <td>{m.dose ?? ''}</td>
                <td>{m.frequency ?? ''}</td>
                <td>{m.duration ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {visit.advice && <Block title="Advice">{visit.advice}</Block>}
      {visit.followUpDate && <p><strong>Follow-up: </strong>{visit.followUpDate}</p>}
      {isDraft ? (
        <div style={{ marginTop: '2rem', textAlign: 'right', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
          <div className="muted small">[Draft preview — official doctor signature &amp; registration seal applied upon finalisation]</div>
        </div>
      ) : (
        <SignatureBlock clinic={clinic} signatoryName={visit.finalisedByName ?? clinic.doctorName} />
      )}
      {amended > 0 && <p className="small">This is the current version; the consultation was amended {amended} time{amended > 1 ? 's' : ''} after it was finalised.</p>}
    </Sheet>
  );
}

export function DischargePrint() {
  const { id } = useParams();
  const { clinic, error: clinicError } = useClinic();
  const [adm, setAdm] = useState<Admission | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<Admission>('GET', `/api/admissions/${id}`).then(setAdm, setError);
  }, [id]);

  if (error || clinicError) return <div className="page narrow"><ErrorBanner error={error ?? clinicError} /></div>;
  if (!adm || !clinic) return <p className="muted">Loading…</p>;
  const s = adm.discharge?.summary;
  if (adm.status !== 'discharged' || !s) {
    return <div className="page narrow"><div className="banner warn">The discharge summary can be printed after the patient has been discharged.</div></div>;
  }
  const addenda = adm.discharge?.addenda ?? [];

  return (
    <Sheet clinic={clinic} title="DISCHARGE SUMMARY" back={`/admissions/${adm.id}`} onPrint={logPrint('discharge_summary', adm.id)}>
      <dl className="sheet-meta">
        <div><dt>Patient</dt><dd>{adm.patientName}</dd></div>
        <div><dt>Patient no.</dt><dd>{adm.patientNumber}</dd></div>
        <div><dt>Age</dt><dd>{formatAge(adm.ageYears, adm.ageIsEstimated)}</dd></div>
        <div><dt>Admission no.</dt><dd>{adm.admissionNumber}</dd></div>
        <div><dt>Admitted</dt><dd>{adm.admittedDate} {adm.admittedTime}</dd></div>
        <div><dt>Discharged</dt><dd>{adm.dischargedDate} {adm.dischargedTime}</dd></div>
      </dl>
      <Allergy status={adm.allergyStatus} details={adm.allergyDetails} />
      {adm.reason && <Block title="Reason for admission">{adm.reason}</Block>}
      <Block title="Final diagnosis">{s.finalDiagnosis}</Block>
      {s.findings && <Block title="Key findings and investigations">{s.findings}</Block>}
      {s.course && <Block title="Course in hospital">{s.course}</Block>}
      {s.procedures && <Block title="Procedures done">{s.procedures}</Block>}
      <Block title="Condition at discharge">{s.conditionAtDischarge}</Block>
      {s.dischargeMedicines && <Block title="Medicines to take home">{s.dischargeMedicines}</Block>}
      {s.instructions && <Block title="Instructions">{s.instructions}</Block>}
      {s.warningSigns && <Block title="Come back or call straight away if">{s.warningSigns}</Block>}
      {s.followUp && <Block title="Follow-up">{s.followUp}</Block>}
      {addenda.map((a) => (
        <Block key={a.id} title={`Addendum, ${a.createdDate}`}>{a.content}</Block>
      ))}
      <SignatureBlock clinic={clinic} signatoryName={s.writtenByName ?? clinic.doctorName} designation="Consultant In-Charge" />
    </Sheet>
  );
}
