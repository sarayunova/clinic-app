import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, type BackupStatus, type SecurityStatus } from './api';
import { useAuth, useMe } from './auth';
import { AuthScreens, ChangePasswordPage } from './pages/AuthScreens';
import { Dashboard } from './pages/Dashboard';
import { PatientsPage } from './pages/Patients';
import { PatientPage } from './pages/PatientPage';
import { UsersPage } from './pages/Users';
import { VisitPage } from './pages/VisitPage';
import { WardsPage } from './pages/Wards';
import { AdmitPage } from './pages/AdmitPage';
import { AdmissionPage } from './pages/AdmissionPage';
import { BillingPage } from './pages/Billing';
import { InvoicePage } from './pages/InvoicePage';
import { InvoicePrint, ReceiptPrint } from './pages/PrintPages';
import { DischargePrint, PrescriptionPrint } from './pages/ClinicalPrints';
import { ClinicalSummaryPrint } from './pages/ClinicalSummaryPrint';
import { UltrasoundPrint } from './pages/UltrasoundPrint';
import { LabOrderPrint } from './pages/LabOrderPrint';
import { PartographPrint } from './pages/PartographPrint';
import { OperativeNotePrint } from './pages/OperativeNotePrint';
import { RiskAssessmentPrint } from './pages/RiskAssessmentPrint';
import { ObstetricDischargePrint } from './pages/ObstetricDischargePrint';
import { MaternityAdmissionPrint } from './pages/MaternityAdmissionPrint';
import { AntenatalLabPrint } from './pages/AntenatalLabPrint';
import { MedicationExposurePrint } from './pages/MedicationExposurePrint';
import { PphAssessmentPrint } from './pages/PphAssessmentPrint';
import { NeonatalResuscitationPrint } from './pages/NeonatalResuscitationPrint';
import { MaternalMeowsPrint } from './pages/MaternalMeowsPrint';
import { NeonatalJaundicePrint } from './pages/NeonatalJaundicePrint';
import { FolliculometryPrint } from './pages/FolliculometryPrint';
import { ErasReedaPrint } from './pages/ErasReedaPrint';
import { GestationalDiabetesPrint } from './pages/GestationalDiabetesPrint';
import { CardiotocographyPrint } from './pages/CardiotocographyPrint';
import { PediatricGrowthPrint } from './pages/PediatricGrowthPrint';
import { CervicalScreeningPrint } from './pages/CervicalScreeningPrint';
import { IucdPrint } from './pages/IucdPrint';
import { PndtFormFPrint } from './pages/PndtFormFPrint';
import { GeneticScreeningPrint } from './pages/GeneticScreeningPrint';
import { FetalDopplerPrint } from './pages/FetalDopplerPrint';
import { PreeclampsiaScreeningPrint } from './pages/PreeclampsiaScreeningPrint';
import { MultipleGestationPrint } from './pages/MultipleGestationPrint';
import { InductionPrint } from './pages/InductionPrint';
import { PerinatalLossPrint } from './pages/PerinatalLossPrint';
import { ArtCyclePrint } from './pages/ArtCyclePrint';
import { EndometriosisPrint } from './pages/EndometriosisPrint';
import { UrogynecologyPrint } from './pages/UrogynecologyPrint';
import { GynOncologyPrint } from './pages/GynOncologyPrint';
import { SncuPrint } from './pages/SncuPrint';
import { EmergencyQrPrint } from './pages/EmergencyQrPrint';
import { ImmunizationRecallPage } from './pages/ImmunizationRecallPage';
import { WardBoardPage } from './pages/WardBoardPage';
import { WardHandoverPrint } from './pages/WardHandoverPrint';
import { TeleconsultationsPage } from './pages/TeleconsultationsPage';
import { TeleconsultationPrint } from './pages/TeleconsultationPrint';
import { OtSchedulerPage } from './pages/OtSchedulerPage';
import { OtSchedulePrint } from './pages/OtSchedulePrint';
import { BloodBankPage } from './pages/BloodBankPage';
import { MtpFlowsheetPrint } from './pages/MtpFlowsheetPrint';
import { PediatricRenalPage } from './pages/PediatricRenalPage';
import { PdFlowsheetPrint } from './pages/PdFlowsheetPrint';
import { AmsPage } from './pages/AmsPage';
import { ObstetricHduPage } from './pages/ObstetricHduPage';
import { Mgso4FlowsheetPrint } from './pages/Mgso4FlowsheetPrint';
import { PalsEmergencyPage } from './pages/PalsEmergencyPage';
import { PalsCodeSheetPrint } from './pages/PalsCodeSheetPrint';
import { NicuTpnPage } from './pages/NicuTpnPage';
import { NicuTpnOrderPrint } from './pages/NicuTpnOrderPrint';
import { MaternalComorbiditiesPage } from './pages/MaternalComorbiditiesPage';
import { MaternalComorbiditiesPrint } from './pages/MaternalComorbiditiesPrint';
import { PediatricAllergyPage } from './pages/PediatricAllergyPage';
import { PediatricAllergyPrint } from './pages/PediatricAllergyPrint';
import { NeonatalHiePage } from './pages/NeonatalHiePage';
import { NeonatalHiePrint } from './pages/NeonatalHiePrint';
import { MaternalSepsisPage } from './pages/MaternalSepsisPage';
import { MaternalSepsisPrint } from './pages/MaternalSepsisPrint';
import { PediatricDkaPage } from './pages/PediatricDkaPage';
import { PediatricDkaPrint } from './pages/PediatricDkaPrint';
import { DeliveryWardPage } from './pages/DeliveryWardPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditPage } from './pages/AuditPage';
import { StationPage } from './pages/StationPage';
import { PriceListPage } from './pages/PriceListPage';
import { ChecklistPage } from './pages/ChecklistPage';
import { PrescriptionTemplatesPage } from './pages/PrescriptionTemplatesPage';
import { CollectionReportPage } from './pages/CollectionReport';
import { TvQueuePage } from './pages/TvQueuePage';
import { ScreenLock } from './components/ScreenLock';

export function App() {
  const location = useLocation();
  if (location.pathname === '/tv') return <TvQueuePage />;

  const { state } = useAuth();
  if (state.status === 'loading') return <p className="center muted">Loading…</p>;
  if (state.status !== 'ready') return <AuthScreens />;
  if (state.me.mustChangePassword) return <AuthScreens forceChange />;
  return <Shell />;
}

/** Tells the doctor, on every screen, when backups or the secure connection need attention. */
function SystemWarning() {
  const [warn, setWarn] = useState<string | null>(null);
  useEffect(() => {
    const check = async () => {
      const found: string[] = [];
      try {
        const b = await api<BackupStatus>('GET', '/api/backups');
        if (!b.healthy) found.push(b.warnings[0] ?? 'Backups need attention.');
      } catch {
        /* status unavailable: say nothing rather than a false alarm */
      }
      try {
        found.push(...(await api<SecurityStatus>('GET', '/api/security')).warnings);
      } catch {
        /* same */
      }
      setWarn(found.length ? found.join(' ') : null);
    };
    void check();
    const t = window.setInterval(() => void check(), 10 * 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (!warn) return null;
  return (
    <div className="banner warn no-print" role="alert">
      <strong>Needs attention.</strong> {warn} <NavLink to="/settings">Open Clinic details</NavLink>
    </div>
  );
}

function Shell() {
  const me = useMe();
  const { logout, can, locked, lock } = useAuth();
  const nav = useNavigate();
  const here = useLocation().pathname;
  // Nurses start their shift on the nurse station board. Only on arrival (login or opening the app at the home page);
  // the "Today" link still works afterwards.
  useEffect(() => {
    if (me.role === 'nurse' && here === '/') nav('/station', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const links = [
    { to: '/', label: 'Today', icon: '📅', end: true },
    ...(can('station:read') ? [{ to: '/station', label: 'Nurse station', icon: '🩺', end: false }] : []),
    { to: '/patients', label: 'Patients', icon: '👥', end: false },
    { to: '/wards', label: 'Wards', icon: '🛏️', end: false },
    ...(can('patient:read_clinical') ? [{ to: '/ward-board', label: 'Ward Board', icon: '📊', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/teleconsultations', label: 'Teleconsult', icon: '📹', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/ot-schedule', label: 'OT Schedule', icon: '🔪', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/blood-bank', label: 'Blood Bank', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-renal', label: 'Renal & PD', icon: '💧', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/ams', label: 'AMS & Antibiogram', icon: '🧫', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-hdu', label: 'Obstetric HDU', icon: '🤰', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pals-emergency', label: 'PALS Emergency', icon: '🚨', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/nicu-tpn', label: 'NICU TPN', icon: '🧪', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/maternal-comorbidities', label: 'Maternal Comorbidities', icon: '🤰', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-allergy', label: 'Asthma & Allergy', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-hie', label: 'Neonatal HIE', icon: '🧊', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/maternal-sepsis', label: 'Maternal Sepsis', icon: '🚨', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-dka', label: 'Pediatric DKA', icon: '🍼', end: false }] : []),
    ...(can('ipd:read_basic') || can('station:read') ? [{ to: '/delivery-ward', label: 'Delivery ward', icon: '👶', end: false }] : []),
    ...(can('billing:read') ? [{ to: '/billing', label: 'Billing', icon: '💳', end: false }] : []),
    ...(can('settings:manage') ? [{ to: '/settings', label: 'Clinic', icon: '🏥', end: false }] : []),
    ...(can('user:manage') ? [{ to: '/users', label: 'Staff', icon: '🔑', end: false }] : []),
    ...(can('audit:read') ? [{ to: '/audit', label: 'Audit', icon: '🔍', end: false }] : []),
    { to: '/account', label: 'Account', icon: '⚙️', end: false },
  ];
  return (
    <>
    <ScreenLock />
    <div className="shell" inert={locked} aria-hidden={locked}>
      <nav className="nav" aria-label="Main">
        <div className="brand">Clinic</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span aria-hidden="true">{l.icon}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}
        <div className="nav-user">
          <div>{me.fullName}</div>
          <div className="muted small">{me.role}</div>
          <button className="btn small" onClick={() => void lock('manual')}>
            Lock screen
          </button>
          <button className="btn small" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </nav>
      <main className="main">
        {can('backup:manage') && <SystemWarning />}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/immunization-recall" element={can('patient:read_clinical') ? <ImmunizationRecallPage /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/new" element={<PatientPage />} />
          <Route path="/patients/:id" element={<PatientPage />} />
          <Route path="/patients/:id/summary/print" element={can('patient:read_clinical') ? <ClinicalSummaryPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/ultrasounds/:id/print" element={can('patient:read_clinical') ? <UltrasoundPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/lab-orders/:id/print" element={can('patient:read_clinical') ? <LabOrderPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/partographs/:id/print" element={can('patient:read_clinical') ? <PartographPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/operative-notes/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <OperativeNotePrint /> : <Navigate to="/patients" replace />} />
          <Route path="/risk-assessments/:id/print" element={can('patient:read_clinical') ? <RiskAssessmentPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/obstetric-discharges/:id/print" element={can('patient:read_clinical') ? <ObstetricDischargePrint /> : <Navigate to="/patients" replace />} />
          <Route path="/maternity-admissions/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <MaternityAdmissionPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/antenatal-labs/:id/print" element={can('patient:read_clinical') ? <AntenatalLabPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/medication-exposures/:id/print" element={can('patient:read_clinical') ? <MedicationExposurePrint /> : <Navigate to="/patients" replace />} />
          <Route path="/pph-assessments/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <PphAssessmentPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/neonatal-resuscitations/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <NeonatalResuscitationPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/meows-episodes/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <MaternalMeowsPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/neonatal-jaundice/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <NeonatalJaundicePrint /> : <Navigate to="/patients" replace />} />
          <Route path="/folliculometry/:id/print" element={can('patient:read_clinical') ? <FolliculometryPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/eras-reeda/:id/print" element={can('patient:read_clinical') || can('ipd:read') ? <ErasReedaPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:id/gdm/print" element={can('patient:read_clinical') ? <GestationalDiabetesPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/ctg/:episodeId/print" element={can('patient:read_clinical') ? <CardiotocographyPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:id/pediatric/growth/print" element={can('patient:read_clinical') ? <PediatricGrowthPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/cervical-screenings/:id/print" element={can('patient:read_clinical') ? <CervicalScreeningPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/contraception/iucd/:id/print" element={can('patient:read_clinical') ? <IucdPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/pndt/:id/print" element={can('patient:read_clinical') ? <PndtFormFPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/genetic-screening/:id/print" element={can('patient:read_clinical') ? <GeneticScreeningPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/doppler/:id/print" element={can('patient:read_clinical') ? <FetalDopplerPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/preeclampsia/:id/print" element={can('patient:read_clinical') ? <PreeclampsiaScreeningPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/multiple-gestation/:id/print" element={can('patient:read_clinical') ? <MultipleGestationPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/induction/:id/print" element={can('patient:read_clinical') ? <InductionPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/perinatal-loss/:id/print" element={can('patient:read_clinical') ? <PerinatalLossPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/art-cycles/:id/print" element={can('patient:read_clinical') ? <ArtCyclePrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/endometriosis/:id/print" element={can('patient:read_clinical') ? <EndometriosisPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/urogynecology/:id/print" element={can('patient:read_clinical') ? <UrogynecologyPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/gyn-oncology/:id/print" element={can('patient:read_clinical') ? <GynOncologyPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/sncu/:id/print" element={can('patient:read_clinical') ? <SncuPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/patients/:patientId/emergency-card/print" element={can('patient:read_clinical') ? <EmergencyQrPrint /> : <Navigate to="/patients" replace />} />
          <Route path="/ward-board" element={can('patient:read_clinical') ? <WardBoardPage /> : <Navigate to="/" replace />} />
          <Route path="/ward-board/handover-print" element={can('patient:read_clinical') ? <WardHandoverPrint /> : <Navigate to="/ward-board" replace />} />
          <Route path="/teleconsultations" element={can('patient:read_clinical') ? <TeleconsultationsPage /> : <Navigate to="/" replace />} />
          <Route path="/teleconsultations/:id/print" element={can('patient:read_clinical') ? <TeleconsultationPrint /> : <Navigate to="/teleconsultations" replace />} />
          <Route path="/ot-schedule" element={can('patient:read_clinical') ? <OtSchedulerPage /> : <Navigate to="/" replace />} />
          <Route path="/ot-schedule/:id/print" element={can('patient:read_clinical') ? <OtSchedulePrint /> : <Navigate to="/ot-schedule" replace />} />
          <Route path="/blood-bank" element={can('patient:read_clinical') ? <BloodBankPage /> : <Navigate to="/" replace />} />
          <Route path="/mtp/:id/print" element={can('patient:read_clinical') ? <MtpFlowsheetPrint /> : <Navigate to="/blood-bank" replace />} />
          <Route path="/pediatric-renal" element={can('patient:read_clinical') ? <PediatricRenalPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-renal/:id/print" element={can('patient:read_clinical') ? <PdFlowsheetPrint /> : <Navigate to="/pediatric-renal" replace />} />
          <Route path="/ams" element={can('patient:read_clinical') ? <AmsPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-hdu" element={can('patient:read_clinical') ? <ObstetricHduPage /> : <Navigate to="/" replace />} />
          <Route path="/mgso4/:id/print" element={can('patient:read_clinical') ? <Mgso4FlowsheetPrint /> : <Navigate to="/obstetric-hdu" replace />} />
          <Route path="/pals-emergency" element={can('patient:read_clinical') ? <PalsEmergencyPage /> : <Navigate to="/" replace />} />
          <Route path="/pals/:id/print" element={can('patient:read_clinical') ? <PalsCodeSheetPrint /> : <Navigate to="/pals-emergency" replace />} />
          <Route path="/nicu-tpn" element={can('patient:read_clinical') ? <NicuTpnPage /> : <Navigate to="/" replace />} />
          <Route path="/nicu-tpn/:id/print" element={can('patient:read_clinical') ? <NicuTpnOrderPrint /> : <Navigate to="/nicu-tpn" replace />} />
          <Route path="/maternal-comorbidities" element={can('patient:read_clinical') ? <MaternalComorbiditiesPage /> : <Navigate to="/" replace />} />
          <Route path="/maternal-comorbidities/:type/:id/print" element={can('patient:read_clinical') ? <MaternalComorbiditiesPrint /> : <Navigate to="/maternal-comorbidities" replace />} />
          <Route path="/pediatric-allergy" element={can('patient:read_clinical') ? <PediatricAllergyPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-allergy/:type/:id/print" element={can('patient:read_clinical') ? <PediatricAllergyPrint /> : <Navigate to="/pediatric-allergy" replace />} />
          <Route path="/neonatal-hie" element={can('patient:read_clinical') ? <NeonatalHiePage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-hie/:id/print" element={can('patient:read_clinical') ? <NeonatalHiePrint /> : <Navigate to="/neonatal-hie" replace />} />
          <Route path="/maternal-sepsis" element={can('patient:read_clinical') ? <MaternalSepsisPage /> : <Navigate to="/" replace />} />
          <Route path="/maternal-sepsis/:id/print" element={can('patient:read_clinical') ? <MaternalSepsisPrint /> : <Navigate to="/maternal-sepsis" replace />} />
          <Route path="/pediatric-dka" element={can('patient:read_clinical') ? <PediatricDkaPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-dka/:id/print" element={can('patient:read_clinical') ? <PediatricDkaPrint /> : <Navigate to="/pediatric-dka" replace />} />
          <Route path="/delivery-ward" element={can('ipd:read_basic') || can('station:read') ? <DeliveryWardPage /> : <Navigate to="/" replace />} />
          <Route path="/visits/:id" element={can('visit:read') ? <VisitPage /> : <Navigate to="/" replace />} />
          <Route path="/visits/:id/print" element={can('visit:read') ? <PrescriptionPrint /> : <Navigate to="/" replace />} />
          <Route path="/admissions/:id/print" element={can('ipd:read') ? <DischargePrint /> : <Navigate to="/wards" replace />} />
          <Route path="/wards" element={<WardsPage />} />
          <Route path="/admissions/new" element={can('admission:create') ? <AdmitPage /> : <Navigate to="/wards" replace />} />
          <Route path="/admissions/:id" element={<AdmissionPage />} />
          <Route path="/billing" element={can('billing:read') ? <BillingPage /> : <Navigate to="/" replace />} />
          <Route path="/billing/prices" element={can('pricelist:manage') ? <PriceListPage /> : <Navigate to="/billing" replace />} />
          <Route path="/billing/report" element={can('billing:read') ? <CollectionReportPage /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id" element={can('billing:read') ? <InvoicePage /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id/print" element={can('billing:read') ? <InvoicePrint /> : <Navigate to="/" replace />} />
          <Route path="/invoices/:id/receipts/:pid" element={can('billing:read') ? <ReceiptPrint /> : <Navigate to="/" replace />} />
          <Route path="/settings/checklist" element={can('settings:manage') ? <ChecklistPage /> : <Navigate to="/" replace />} />
          <Route path="/settings/prescription-templates" element={can('visit:write') ? <PrescriptionTemplatesPage /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={can('settings:manage') ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/users" element={can('user:manage') ? <UsersPage /> : <Navigate to="/" replace />} />
          <Route path="/station" element={can('station:read') ? <StationPage /> : <Navigate to="/" replace />} />
          <Route path="/audit" element={can('audit:read') ? <AuditPage /> : <Navigate to="/" replace />} />
          <Route path="/tv" element={<TvQueuePage />} />
          <Route path="/account" element={<ChangePasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
    </>
  );
}
