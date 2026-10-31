import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, type ClinicSettings } from '../api';

export function useClinic() {
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<ClinicSettings>('GET', '/api/settings').then(setClinic, setError);
  }, []);
  return { clinic, error };
}

const stamp = () => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

/** A printable page: clinic letterhead, title, body. Controls marked no-print are hidden on paper. */
export function Sheet({
  clinic,
  title,
  back,
  onPrint,
  controls,
  children,
}: {
  clinic: ClinicSettings;
  title: string;
  back: string;
  onPrint?: () => void;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page narrow">
      <div className="row no-print" style={{ justifyContent: 'space-between' }}>
        <Link to={back}>← Back</Link>
        <button className="btn primary" onClick={() => { onPrint?.(); window.print(); }}>Print</button>
      </div>
      {controls && <div className="no-print">{controls}</div>}
      <article className="sheet">
        <header className="sheet-head">
          <h1>{clinic.clinicName || 'Clinic name not set'}</h1>
          {clinic.address && <div className="pre">{clinic.address}</div>}
          <div>{[clinic.phone && `Phone: ${clinic.phone}`, clinic.doctorName, clinic.registrationNo && `Reg. no. ${clinic.registrationNo}`].filter(Boolean).join(' · ')}</div>
          {!clinic.clinicName && <div className="banner warn no-print">The doctor can add the clinic name and address under “Clinic” in the menu so they print here.</div>}
        </header>
        <h2 className="sheet-title">{title}</h2>
        {children}
        <footer className="sheet-foot small">Printed {stamp()}</footer>
      </article>
    </div>
  );
}
