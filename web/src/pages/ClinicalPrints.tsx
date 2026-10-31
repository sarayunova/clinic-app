import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Admission, type Visit } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { ErrorBanner, formatAge } from '../components/ui';

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

function Signature({ name, reg }: { name: string; reg?: string }) {
  return (
    <div className="signature">
      <div className="signature-line" />
      <div>{name}</div>
      {reg && <div className="small">Reg. no. {reg}</div>}
    </div>
  );
}

export function PrescriptionPrint() {
  const { id } = useParams();
  const { clinic, error: clinicError } = useClinic();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [withDiagnosis, setWithDiagnosis] = useState(false);
  useEffect(() => {
    api<Visit>('GET', `/api/visits/${id}`).then(setVisit, setError);
  }, [id]);

  if (error || clinicError) return <div className="page narrow"><ErrorBanner error={error ?? clinicError} /></div>;
  if (!visit || !clinic) return <p className="muted">Loading…</p>;
  if (visit.status !== 'final') {
    return <div className="page narrow"><div className="banner warn">Only a finalised consultation can be printed. Finalise it first.</div></div>;
  }
  const amended = visit.revisions.filter((r) => r.kind === 'amendment').length;
  const items = visit.prescriptionItems;

  return (
    <Sheet
      clinic={clinic}
      title="PRESCRIPTION"
      back={`/visits/${visit.id}`}
      onPrint={logPrint('prescription', visit.id)}
      controls={
        <label className="row">
          <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={withDiagnosis} onChange={(e) => setWithDiagnosis(e.target.checked)} />
          <span>Print the assessment / diagnosis on this prescription</span>
        </label>
      }
    >
      <dl className="sheet-meta">
        <div><dt>Patient</dt><dd>{visit.patientName}</dd></div>
        <div><dt>Date</dt><dd>{visit.visitDate}</dd></div>
        <div><dt>Patient no.</dt><dd>{visit.patientNumber}</dd></div>
        <div><dt>Age</dt><dd>{formatAge(visit.ageYears, visit.ageIsEstimated)}</dd></div>
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
      <Signature name={visit.finalisedByName ?? clinic.doctorName} reg={clinic.registrationNo} />
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
      <Signature name={s.writtenByName} reg={clinic.registrationNo} />
    </Sheet>
  );
}
