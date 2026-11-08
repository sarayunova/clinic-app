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
import { NeonatalRdsPage } from './pages/NeonatalRdsPage';
import { NeonatalRdsPrint } from './pages/NeonatalRdsPrint';
import { MaternalVtePage } from './pages/MaternalVtePage';
import { MaternalVtePrint } from './pages/MaternalVtePrint';
import { PediatricSeizuresPage } from './pages/PediatricSeizuresPage';
import { PediatricSeizurePrint } from './pages/PediatricSeizurePrint';
import { NeonatalSepsisPage } from './pages/NeonatalSepsisPage';
import { NeonatalSepsisPrint } from './pages/NeonatalSepsisPrint';
import { ObstetricHypertensionPage } from './pages/ObstetricHypertensionPage';
import { ObstetricHypertensionPrint } from './pages/ObstetricHypertensionPrint';
import { PediatricSepticShockPage } from './pages/PediatricSepticShockPage';
import { PediatricSepticShockPrint } from './pages/PediatricSepticShockPrint';
import { NeonatalHypoglycemiaPage } from './pages/NeonatalHypoglycemiaPage';
import { NeonatalHypoglycemiaPrint } from './pages/NeonatalHypoglycemiaPrint';
import { ObstetricPphPage } from './pages/ObstetricPphPage';
import { ObstetricPphPrint } from './pages/ObstetricPphPrint';
import { PediatricPardsPage } from './pages/PediatricPardsPage';
import { PediatricPardsPrint } from './pages/PediatricPardsPrint';
import { NeonatalBindAabrPage } from './pages/NeonatalBindAabrPage';
import { NeonatalBindAabrPrint } from './pages/NeonatalBindAabrPrint';
import { ObstetricIcpPage } from './pages/ObstetricIcpPage';
import { ObstetricIcpPrint } from './pages/ObstetricIcpPrint';
import { PediatricStatusEpilepticusPage } from './pages/PediatricStatusEpilepticusPage';
import { PediatricStatusEpilepticusPrint } from './pages/PediatricStatusEpilepticusPrint';
import { NeonatalNecPage } from './pages/NeonatalNecPage';
import { NeonatalNecPrint } from './pages/NeonatalNecPrint';
import { ObstetricPasPage } from './pages/ObstetricPasPage';
import { ObstetricPasPrint } from './pages/ObstetricPasPrint';
import { PediatricTbiPecarnPage } from './pages/PediatricTbiPecarnPage';
import { PediatricTbiPecarnPrint } from './pages/PediatricTbiPecarnPrint';
import { NeonatalPphnPage } from './pages/NeonatalPphnPage';
import { NeonatalPphnPrint } from './pages/NeonatalPphnPrint';
import { ObstetricAfePage } from './pages/ObstetricAfePage';
import { ObstetricAfePrint } from './pages/ObstetricAfePrint';
import { PediatricAsthmaStatusPage } from './pages/PediatricAsthmaStatusPage';
import { PediatricAsthmaStatusPrint } from './pages/PediatricAsthmaStatusPrint';
import { NeonatalBpdPage } from './pages/NeonatalBpdPage';
import { NeonatalBpdPrint } from './pages/NeonatalBpdPrint';
import { ObstetricAflpPage } from './pages/ObstetricAflpPage';
import { ObstetricAflpPrint } from './pages/ObstetricAflpPrint';
import { PediatricPolytraumaPage } from './pages/PediatricPolytraumaPage';
import { PediatricPolytraumaPrint } from './pages/PediatricPolytraumaPrint';
import { NeonatalHspdaPage } from './pages/NeonatalHspdaPage';
import { NeonatalHspdaPrint } from './pages/NeonatalHspdaPrint';
import { ObstetricDkaPage } from './pages/ObstetricDkaPage';
import { ObstetricDkaPrint } from './pages/ObstetricDkaPrint';
import { PediatricAnaphylaxisPage } from './pages/PediatricAnaphylaxisPage';
import { PediatricAnaphylaxisPrint } from './pages/PediatricAnaphylaxisPrint';
import { NeonatalIvhPage } from './pages/NeonatalIvhPage';
import { NeonatalIvhPrint } from './pages/NeonatalIvhPrint';
import { ObstetricPpromPage } from './pages/ObstetricPpromPage';
import { ObstetricPpromPrint } from './pages/ObstetricPpromPrint';
import { PediatricSvtPage } from './pages/PediatricSvtPage';
import { PediatricSvtPrint } from './pages/PediatricSvtPrint';
import { NeonatalHypocalcemiaPage } from './pages/NeonatalHypocalcemiaPage';
import { NeonatalHypocalcemiaPrint } from './pages/NeonatalHypocalcemiaPrint';
import { ObstetricPosttermPage } from './pages/ObstetricPosttermPage';
import { ObstetricPosttermPrint } from './pages/ObstetricPosttermPrint';
import { PediatricCroupPage } from './pages/PediatricCroupPage';
import { PediatricCroupPrint } from './pages/PediatricCroupPrint';
import { NeonatalPolycythemiaPage } from './pages/NeonatalPolycythemiaPage';
import { NeonatalPolycythemiaPrint } from './pages/NeonatalPolycythemiaPrint';
import { ObstetricShoulderDystociaPage } from './pages/ObstetricShoulderDystociaPage';
import { ObstetricShoulderDystociaPrint } from './pages/ObstetricShoulderDystociaPrint';
import { PediatricForeignBodyPage } from './pages/PediatricForeignBodyPage';
import { PediatricForeignBodyPrint } from './pages/PediatricForeignBodyPrint';
import { NeonatalHypomagnesemiaPage } from './pages/NeonatalHypomagnesemiaPage';
import { NeonatalHypomagnesemiaPrint } from './pages/NeonatalHypomagnesemiaPrint';
import { ObstetricPpcmPage } from './pages/ObstetricPpcmPage';
import { ObstetricPpcmPrint } from './pages/ObstetricPpcmPrint';
import { PediatricSepticArthritisPage } from './pages/PediatricSepticArthritisPage';
import { PediatricSepticArthritisPrint } from './pages/PediatricSepticArthritisPrint';
import { NeonatalChylothoraxPage } from './pages/NeonatalChylothoraxPage';
import { NeonatalChylothoraxPrint } from './pages/NeonatalChylothoraxPrint';
import { ObstetricCordProlapsePage } from './pages/ObstetricCordProlapsePage';
import { ObstetricCordProlapsePrint } from './pages/ObstetricCordProlapsePrint';
import { PediatricIntussusceptionPage } from './pages/PediatricIntussusceptionPage';
import { PediatricIntussusceptionPrint } from './pages/PediatricIntussusceptionPrint';
import { NeonatalMasPage } from './pages/NeonatalMasPage';
import { NeonatalMasPrint } from './pages/NeonatalMasPrint';
import { ObstetricUterineInversionPage } from './pages/ObstetricUterineInversionPage';
import { ObstetricUterineInversionPrint } from './pages/ObstetricUterineInversionPrint';
import { PediatricAppendicitisPage } from './pages/PediatricAppendicitisPage';
import { PediatricAppendicitisPrint } from './pages/PediatricAppendicitisPrint';
import { NeonatalTtnPage } from './pages/NeonatalTtnPage';
import { NeonatalTtnPrint } from './pages/NeonatalTtnPrint';
import { ObstetricPdphPage } from './pages/ObstetricPdphPage';
import { ObstetricPdphPrint } from './pages/ObstetricPdphPrint';
import { PediatricBacterialMeningitisPage } from './pages/PediatricBacterialMeningitisPage';
import { PediatricBacterialMeningitisPrint } from './pages/PediatricBacterialMeningitisPrint';
import { NeonatalAopPage } from './pages/NeonatalAopPage';
import { NeonatalAopPrint } from './pages/NeonatalAopPrint';
import { ObstetricRetainedPlacentaPage } from './pages/ObstetricRetainedPlacentaPage';
import { ObstetricRetainedPlacentaPrint } from './pages/ObstetricRetainedPlacentaPrint';
import { PediatricPyloricStenosisPage } from './pages/PediatricPyloricStenosisPage';
import { PediatricPyloricStenosisPrint } from './pages/PediatricPyloricStenosisPrint';
import { NeonatalSghPage } from './pages/NeonatalSghPage';
import { NeonatalSghPrint } from './pages/NeonatalSghPrint';
import { ObstetricTolacPage } from './pages/ObstetricTolacPage';
import { ObstetricTolacPrint } from './pages/ObstetricTolacPrint';
import { PediatricKawasakiPage } from './pages/PediatricKawasakiPage';
import { PediatricKawasakiPrint } from './pages/PediatricKawasakiPrint';
import { NeonatalVolvulusPage } from './pages/NeonatalVolvulusPage';
import { NeonatalVolvulusPrint } from './pages/NeonatalVolvulusPrint';
import { ObstetricEcvPage } from './pages/ObstetricEcvPage';
import { ObstetricEcvPrint } from './pages/ObstetricEcvPrint';
import { PediatricDkaCerebralEdemaPage } from './pages/PediatricDkaCerebralEdemaPage';
import { PediatricDkaCerebralEdemaPrint } from './pages/PediatricDkaCerebralEdemaPrint';
import { NeonatalMeconiumIleusPage } from './pages/NeonatalMeconiumIleusPage';
import { NeonatalMeconiumIleusPrint } from './pages/NeonatalMeconiumIleusPrint';
import { ObstetricPlacentalAbruptionPage } from './pages/ObstetricPlacentalAbruptionPage';
import { ObstetricPlacentalAbruptionPrint } from './pages/ObstetricPlacentalAbruptionPrint';
import { PediatricHusPage } from './pages/PediatricHusPage';
import { PediatricHusPrint } from './pages/PediatricHusPrint';
import { NeonatalEaTefPage } from './pages/NeonatalEaTefPage';
import { NeonatalEaTefPrint } from './pages/NeonatalEaTefPrint';
import { ObstetricVasaPreviaPage } from './pages/ObstetricVasaPreviaPage';
import { ObstetricVasaPreviaPrint } from './pages/ObstetricVasaPreviaPrint';
import { PediatricEmpyemaPage } from './pages/PediatricEmpyemaPage';
import { PediatricEmpyemaPrint } from './pages/PediatricEmpyemaPrint';
import { NeonatalAbdominalDefectsPage } from './pages/NeonatalAbdominalDefectsPage';
import { NeonatalAbdominalDefectsPrint } from './pages/NeonatalAbdominalDefectsPrint';
import { ObstetricSptPage } from './pages/ObstetricSptPage';
import { ObstetricSptPrint } from './pages/ObstetricSptPrint';
import { PediatricOsteomyelitisPage } from './pages/PediatricOsteomyelitisPage';
import { PediatricOsteomyelitisPrint } from './pages/PediatricOsteomyelitisPrint';
import { NeonatalIntestinalAtresiaPage } from './pages/NeonatalIntestinalAtresiaPage';
import { NeonatalIntestinalAtresiaPrint } from './pages/NeonatalIntestinalAtresiaPrint';
import { ObstetricHellpPage } from './pages/ObstetricHellpPage';
import { ObstetricHellpPrint } from './pages/ObstetricHellpPrint';
import { PediatricScfePage } from './pages/PediatricScfePage';
import { PediatricScfePrint } from './pages/PediatricScfePrint';
import { NeonatalCdhPage } from './pages/NeonatalCdhPage';
import { NeonatalCdhPrint } from './pages/NeonatalCdhPrint';
import { ObstetricHyperemesisPage } from './pages/ObstetricHyperemesisPage';
import { ObstetricHyperemesisPrint } from './pages/ObstetricHyperemesisPrint';
import { PediatricAcuteScrotumPage } from './pages/PediatricAcuteScrotumPage';
import { PediatricAcuteScrotumPrint } from './pages/PediatricAcuteScrotumPrint';
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
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-rds', label: 'Neonatal RDS', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/maternal-vte', label: 'Maternal VTE', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-seizures', label: 'Status Epilepticus', icon: '⚡', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-sepsis', label: 'Neonatal Sepsis', icon: '👶', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-hypertension', label: 'Obstetric HTN', icon: '⚡', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-septic-shock', label: 'Septic Shock', icon: '🧸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-hypoglycemia', label: 'Neonatal Hypoglycemia', icon: '🍼', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-pph', label: 'Obstetric PPH', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-pards', label: 'Pediatric ARDS', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-bind-aabr', label: 'Neonatal BIND', icon: '👂', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-icp', label: 'Obstetric ICP', icon: '🧪', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-status-epilepticus', label: 'Pediatric Status Resus', icon: '⚡', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-nec', label: 'Neonatal NEC', icon: '🫄', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-pas', label: 'Obstetric PAS', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-tbi', label: 'Pediatric TBI', icon: '🧠', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-pphn', label: 'Neonatal PPHN', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-afe', label: 'Obstetric AFE', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-asthma', label: 'Pediatric Asthma', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-bpd', label: 'Neonatal BPD', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-aflp', label: 'Obstetric AFLP', icon: '🩺', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-polytrauma', label: 'Pediatric Trauma', icon: '🚨', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-hspda', label: 'Neonatal hsPDA', icon: '🫀', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-dka', label: 'Obstetric DKA', icon: '🩺', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-anaphylaxis', label: 'Pediatric Anaphylaxis', icon: '🚨', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-ivh', label: 'Neonatal IVH', icon: '🧠', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-pprom', label: 'Obstetric PPROM', icon: '🩺', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-svt', label: 'Pediatric SVT', icon: '⚡', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-hypocalcemia', label: 'Neonatal Hypocalcemia', icon: '🧪', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-postterm', label: 'Obstetric Post-Term', icon: '🩺', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-croup', label: 'Pediatric Croup', icon: '🌬️', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-polycythemia', label: 'Neonatal Polycythemia', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-shoulder-dystocia', label: 'Shoulder Dystocia', icon: '🚨', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-foreign-body', label: 'Pediatric Choking FBAO', icon: '🥜', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-hypomagnesemia', label: 'Neonatal Hypomagnesemia', icon: '⚡', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-ppcm', label: 'Obstetric PPCM', icon: '🫀', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-septic-arthritis', label: 'Septic Arthritis Kocher', icon: '🦴', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-chylothorax', label: 'Neonatal Chylothorax', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-cord-prolapse', label: 'Cord Prolapse', icon: '🚨', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-intussusception', label: 'Intussusception', icon: '🌀', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-mas', label: 'Neonatal MAS', icon: '💨', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-uterine-inversion', label: 'Uterine Inversion', icon: '⚡', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-appendicitis', label: 'Pediatric Appendicitis', icon: '🩹', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-ttn', label: 'Neonatal TTN', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-pdph', label: 'Obstetric PDPH', icon: '💉', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-meningitis', label: 'Pediatric Meningitis', icon: '🧠', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-aop', label: 'Neonatal AOP', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-retained-placenta', label: 'Retained Placenta', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-pyloric-stenosis', label: 'Pyloric Stenosis', icon: '🍼', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-sgh', label: 'Neonatal SGH', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-tolac', label: 'Obstetric TOLAC', icon: '🤰', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-kawasaki', label: 'Pediatric Kawasaki', icon: '❤️', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-volvulus', label: 'Neonatal Volvulus', icon: '🌀', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-ecv', label: 'Obstetric ECV', icon: '🔄', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-dka-ce', label: 'Pediatric DKA CE', icon: '🧠', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-meconium-ileus', label: 'Meconium Ileus & CF', icon: '🍼', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-placental-abruption', label: 'Placental Abruption', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-hus', label: 'Pediatric HUS', icon: '🔬', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-ea-tef', label: 'Neonatal EA/TEF', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-vasa-previa', label: 'Vasa Previa', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-empyema', label: 'Pediatric Empyema', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-abdominal-defects', label: 'Wall Defects & Silo', icon: '👶', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-spt', label: 'Obstetric SPT', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-osteomyelitis', label: 'Acute Osteomyelitis', icon: '🦴', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-intestinal-atresia', label: 'Intestinal Atresia', icon: '👶', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-hellp', label: 'Obstetric HELLP', icon: '🩸', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-scfe', label: 'Pediatric SCFE', icon: '🦴', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/neonatal-cdh', label: 'Neonatal CDH', icon: '🫁', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/obstetric-hyperemesis', label: 'Hyperemesis Gravidarum', icon: '🤰', end: false }] : []),
    ...(can('patient:read_clinical') ? [{ to: '/pediatric-acute-scrotum', label: 'Acute Scrotum', icon: '🩻', end: false }] : []),
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
          <Route path="/neonatal-rds" element={can('patient:read_clinical') ? <NeonatalRdsPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-rds/print/:id" element={can('patient:read_clinical') ? <NeonatalRdsPrint /> : <Navigate to="/neonatal-rds" replace />} />
          <Route path="/neonatal-rds/:id/print" element={can('patient:read_clinical') ? <NeonatalRdsPrint /> : <Navigate to="/neonatal-rds" replace />} />
          <Route path="/maternal-vte" element={can('patient:read_clinical') ? <MaternalVtePage /> : <Navigate to="/" replace />} />
          <Route path="/maternal-vte/print/:id" element={can('patient:read_clinical') ? <MaternalVtePrint /> : <Navigate to="/maternal-vte" replace />} />
          <Route path="/maternal-vte/:id/print" element={can('patient:read_clinical') ? <MaternalVtePrint /> : <Navigate to="/maternal-vte" replace />} />
          <Route path="/pediatric-seizures" element={can('patient:read_clinical') ? <PediatricSeizuresPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-seizures/print/:id" element={can('patient:read_clinical') ? <PediatricSeizurePrint /> : <Navigate to="/pediatric-seizures" replace />} />
          <Route path="/pediatric-seizures/:id/print" element={can('patient:read_clinical') ? <PediatricSeizurePrint /> : <Navigate to="/pediatric-seizures" replace />} />
          <Route path="/neonatal-sepsis" element={can('patient:read_clinical') ? <NeonatalSepsisPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-sepsis/print/:id" element={can('patient:read_clinical') ? <NeonatalSepsisPrint /> : <Navigate to="/neonatal-sepsis" replace />} />
          <Route path="/neonatal-sepsis/:id/print" element={can('patient:read_clinical') ? <NeonatalSepsisPrint /> : <Navigate to="/neonatal-sepsis" replace />} />
          <Route path="/patients/:patientId/neonatal-sepsis/:id/print" element={can('patient:read_clinical') ? <NeonatalSepsisPrint /> : <Navigate to="/neonatal-sepsis" replace />} />
          <Route path="/obstetric-hypertension" element={can('patient:read_clinical') ? <ObstetricHypertensionPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-hypertension/print/:id" element={can('patient:read_clinical') ? <ObstetricHypertensionPrint /> : <Navigate to="/obstetric-hypertension" replace />} />
          <Route path="/obstetric-hypertension/:id/print" element={can('patient:read_clinical') ? <ObstetricHypertensionPrint /> : <Navigate to="/obstetric-hypertension" replace />} />
          <Route path="/patients/:patientId/obstetric-hypertension/:id/print" element={can('patient:read_clinical') ? <ObstetricHypertensionPrint /> : <Navigate to="/obstetric-hypertension" replace />} />
          <Route path="/pediatric-septic-shock" element={can('patient:read_clinical') ? <PediatricSepticShockPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-septic-shock/print/:id" element={can('patient:read_clinical') ? <PediatricSepticShockPrint /> : <Navigate to="/pediatric-septic-shock" replace />} />
          <Route path="/pediatric-septic-shock/:id/print" element={can('patient:read_clinical') ? <PediatricSepticShockPrint /> : <Navigate to="/pediatric-septic-shock" replace />} />
          <Route path="/patients/:patientId/pediatric-septic-shock/:id/print" element={can('patient:read_clinical') ? <PediatricSepticShockPrint /> : <Navigate to="/pediatric-septic-shock" replace />} />
          <Route path="/neonatal-hypoglycemia" element={can('patient:read_clinical') ? <NeonatalHypoglycemiaPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-hypoglycemia/:id/print" element={can('patient:read_clinical') ? <NeonatalHypoglycemiaPrint /> : <Navigate to="/neonatal-hypoglycemia" replace />} />
          <Route path="/patients/:patientId/neonatal-hypoglycemia/:id/print" element={can('patient:read_clinical') ? <NeonatalHypoglycemiaPrint /> : <Navigate to="/neonatal-hypoglycemia" replace />} />
          <Route path="/obstetric-pph" element={can('patient:read_clinical') ? <ObstetricPphPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-pph/:id/print" element={can('patient:read_clinical') ? <ObstetricPphPrint /> : <Navigate to="/obstetric-pph" replace />} />
          <Route path="/patients/:patientId/obstetric-pph/:id/print" element={can('patient:read_clinical') ? <ObstetricPphPrint /> : <Navigate to="/obstetric-pph" replace />} />
          <Route path="/pediatric-pards" element={can('patient:read_clinical') ? <PediatricPardsPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-pards/:id/print" element={can('patient:read_clinical') ? <PediatricPardsPrint /> : <Navigate to="/pediatric-pards" replace />} />
          <Route path="/patients/:patientId/pediatric-pards/:id/print" element={can('patient:read_clinical') ? <PediatricPardsPrint /> : <Navigate to="/pediatric-pards" replace />} />
          <Route path="/neonatal-bind-aabr" element={can('patient:read_clinical') ? <NeonatalBindAabrPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-bind-aabr/:id/print" element={can('patient:read_clinical') ? <NeonatalBindAabrPrint /> : <Navigate to="/neonatal-bind-aabr" replace />} />
          <Route path="/patients/:patientId/neonatal-bind-aabr/:id/print" element={can('patient:read_clinical') ? <NeonatalBindAabrPrint /> : <Navigate to="/neonatal-bind-aabr" replace />} />
          <Route path="/obstetric-icp" element={can('patient:read_clinical') ? <ObstetricIcpPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-icp/:id/print" element={can('patient:read_clinical') ? <ObstetricIcpPrint /> : <Navigate to="/obstetric-icp" replace />} />
          <Route path="/patients/:patientId/obstetric-icp/:id/print" element={can('patient:read_clinical') ? <ObstetricIcpPrint /> : <Navigate to="/obstetric-icp" replace />} />
          <Route path="/pediatric-status-epilepticus" element={can('patient:read_clinical') ? <PediatricStatusEpilepticusPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-status-epilepticus/:id/print" element={can('patient:read_clinical') ? <PediatricStatusEpilepticusPrint /> : <Navigate to="/pediatric-status-epilepticus" replace />} />
          <Route path="/patients/:patientId/pediatric-status-epilepticus/:id/print" element={can('patient:read_clinical') ? <PediatricStatusEpilepticusPrint /> : <Navigate to="/pediatric-status-epilepticus" replace />} />
          <Route path="/neonatal-nec" element={can('patient:read_clinical') ? <NeonatalNecPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-nec/:id/print" element={can('patient:read_clinical') ? <NeonatalNecPrint /> : <Navigate to="/neonatal-nec" replace />} />
          <Route path="/patients/:patientId/neonatal-nec/:id/print" element={can('patient:read_clinical') ? <NeonatalNecPrint /> : <Navigate to="/neonatal-nec" replace />} />
          <Route path="/obstetric-pas" element={can('patient:read_clinical') ? <ObstetricPasPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-pas/:id/print" element={can('patient:read_clinical') ? <ObstetricPasPrint /> : <Navigate to="/obstetric-pas" replace />} />
          <Route path="/patients/:patientId/obstetric-pas/:id/print" element={can('patient:read_clinical') ? <ObstetricPasPrint /> : <Navigate to="/obstetric-pas" replace />} />
          <Route path="/pediatric-tbi" element={can('patient:read_clinical') ? <PediatricTbiPecarnPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-tbi/:id/print" element={can('patient:read_clinical') ? <PediatricTbiPecarnPrint /> : <Navigate to="/pediatric-tbi" replace />} />
          <Route path="/patients/:patientId/pediatric-tbi/:id/print" element={can('patient:read_clinical') ? <PediatricTbiPecarnPrint /> : <Navigate to="/pediatric-tbi" replace />} />
          <Route path="/neonatal-pphn" element={can('patient:read_clinical') ? <NeonatalPphnPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-pphn/:id/print" element={can('patient:read_clinical') ? <NeonatalPphnPrint /> : <Navigate to="/neonatal-pphn" replace />} />
          <Route path="/patients/:patientId/neonatal-pphn/:id/print" element={can('patient:read_clinical') ? <NeonatalPphnPrint /> : <Navigate to="/neonatal-pphn" replace />} />
          <Route path="/obstetric-afe" element={can('patient:read_clinical') ? <ObstetricAfePage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-afe/:id/print" element={can('patient:read_clinical') ? <ObstetricAfePrint /> : <Navigate to="/obstetric-afe" replace />} />
          <Route path="/patients/:patientId/obstetric-afe/:id/print" element={can('patient:read_clinical') ? <ObstetricAfePrint /> : <Navigate to="/obstetric-afe" replace />} />
          <Route path="/pediatric-asthma" element={can('patient:read_clinical') ? <PediatricAsthmaStatusPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-asthma/:id/print" element={can('patient:read_clinical') ? <PediatricAsthmaStatusPrint /> : <Navigate to="/pediatric-asthma" replace />} />
          <Route path="/patients/:patientId/pediatric-asthma/:id/print" element={can('patient:read_clinical') ? <PediatricAsthmaStatusPrint /> : <Navigate to="/pediatric-asthma" replace />} />
          <Route path="/neonatal-bpd" element={can('patient:read_clinical') ? <NeonatalBpdPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-bpd/:id/print" element={can('patient:read_clinical') ? <NeonatalBpdPrint /> : <Navigate to="/neonatal-bpd" replace />} />
          <Route path="/patients/:patientId/neonatal-bpd/:id/print" element={can('patient:read_clinical') ? <NeonatalBpdPrint /> : <Navigate to="/neonatal-bpd" replace />} />
          <Route path="/obstetric-aflp" element={can('patient:read_clinical') ? <ObstetricAflpPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-aflp/:id/print" element={can('patient:read_clinical') ? <ObstetricAflpPrint /> : <Navigate to="/obstetric-aflp" replace />} />
          <Route path="/patients/:patientId/obstetric-aflp/:id/print" element={can('patient:read_clinical') ? <ObstetricAflpPrint /> : <Navigate to="/obstetric-aflp" replace />} />
          <Route path="/pediatric-polytrauma" element={can('patient:read_clinical') ? <PediatricPolytraumaPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-polytrauma/:id/print" element={can('patient:read_clinical') ? <PediatricPolytraumaPrint /> : <Navigate to="/pediatric-polytrauma" replace />} />
          <Route path="/patients/:patientId/pediatric-polytrauma/:id/print" element={can('patient:read_clinical') ? <PediatricPolytraumaPrint /> : <Navigate to="/pediatric-polytrauma" replace />} />
          <Route path="/neonatal-hspda" element={can('patient:read_clinical') ? <NeonatalHspdaPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-hspda/:id/print" element={can('patient:read_clinical') ? <NeonatalHspdaPrint /> : <Navigate to="/neonatal-hspda" replace />} />
          <Route path="/patients/:patientId/neonatal-hspda/:id/print" element={can('patient:read_clinical') ? <NeonatalHspdaPrint /> : <Navigate to="/neonatal-hspda" replace />} />
          <Route path="/obstetric-dka" element={can('patient:read_clinical') ? <ObstetricDkaPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-dka/:id/print" element={can('patient:read_clinical') ? <ObstetricDkaPrint /> : <Navigate to="/obstetric-dka" replace />} />
          <Route path="/patients/:patientId/obstetric-dka/:id/print" element={can('patient:read_clinical') ? <ObstetricDkaPrint /> : <Navigate to="/obstetric-dka" replace />} />
          <Route path="/pediatric-anaphylaxis" element={can('patient:read_clinical') ? <PediatricAnaphylaxisPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-anaphylaxis/:id/print" element={can('patient:read_clinical') ? <PediatricAnaphylaxisPrint /> : <Navigate to="/pediatric-anaphylaxis" replace />} />
          <Route path="/patients/:patientId/pediatric-anaphylaxis/:id/print" element={can('patient:read_clinical') ? <PediatricAnaphylaxisPrint /> : <Navigate to="/pediatric-anaphylaxis" replace />} />
          <Route path="/neonatal-ivh" element={can('patient:read_clinical') ? <NeonatalIvhPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-ivh/:id/print" element={can('patient:read_clinical') ? <NeonatalIvhPrint /> : <Navigate to="/neonatal-ivh" replace />} />
          <Route path="/patients/:patientId/neonatal-ivh/:id/print" element={can('patient:read_clinical') ? <NeonatalIvhPrint /> : <Navigate to="/neonatal-ivh" replace />} />
          <Route path="/obstetric-pprom" element={can('patient:read_clinical') ? <ObstetricPpromPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-pprom/:id/print" element={can('patient:read_clinical') ? <ObstetricPpromPrint /> : <Navigate to="/obstetric-pprom" replace />} />
          <Route path="/patients/:patientId/obstetric-pprom/:id/print" element={can('patient:read_clinical') ? <ObstetricPpromPrint /> : <Navigate to="/obstetric-pprom" replace />} />
          <Route path="/pediatric-svt" element={can('patient:read_clinical') ? <PediatricSvtPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-svt/:id/print" element={can('patient:read_clinical') ? <PediatricSvtPrint /> : <Navigate to="/pediatric-svt" replace />} />
          <Route path="/patients/:patientId/pediatric-svt/:id/print" element={can('patient:read_clinical') ? <PediatricSvtPrint /> : <Navigate to="/pediatric-svt" replace />} />
          <Route path="/neonatal-hypocalcemia" element={can('patient:read_clinical') ? <NeonatalHypocalcemiaPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-hypocalcemia/:id/print" element={can('patient:read_clinical') ? <NeonatalHypocalcemiaPrint /> : <Navigate to="/neonatal-hypocalcemia" replace />} />
          <Route path="/patients/:patientId/neonatal-hypocalcemia/:id/print" element={can('patient:read_clinical') ? <NeonatalHypocalcemiaPrint /> : <Navigate to="/neonatal-hypocalcemia" replace />} />
          <Route path="/obstetric-postterm" element={can('patient:read_clinical') ? <ObstetricPosttermPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-postterm/:id/print" element={can('patient:read_clinical') ? <ObstetricPosttermPrint /> : <Navigate to="/obstetric-postterm" replace />} />
          <Route path="/patients/:patientId/obstetric-postterm/:id/print" element={can('patient:read_clinical') ? <ObstetricPosttermPrint /> : <Navigate to="/obstetric-postterm" replace />} />
          <Route path="/pediatric-croup" element={can('patient:read_clinical') ? <PediatricCroupPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-croup/:id/print" element={can('patient:read_clinical') ? <PediatricCroupPrint /> : <Navigate to="/pediatric-croup" replace />} />
          <Route path="/patients/:patientId/pediatric-croup/:id/print" element={can('patient:read_clinical') ? <PediatricCroupPrint /> : <Navigate to="/pediatric-croup" replace />} />
          <Route path="/neonatal-polycythemia" element={can('patient:read_clinical') ? <NeonatalPolycythemiaPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-polycythemia/:id/print" element={can('patient:read_clinical') ? <NeonatalPolycythemiaPrint /> : <Navigate to="/neonatal-polycythemia" replace />} />
          <Route path="/patients/:patientId/neonatal-polycythemia/:id/print" element={can('patient:read_clinical') ? <NeonatalPolycythemiaPrint /> : <Navigate to="/neonatal-polycythemia" replace />} />
          <Route path="/obstetric-shoulder-dystocia" element={can('patient:read_clinical') ? <ObstetricShoulderDystociaPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-shoulder-dystocia/:id/print" element={can('patient:read_clinical') ? <ObstetricShoulderDystociaPrint /> : <Navigate to="/obstetric-shoulder-dystocia" replace />} />
          <Route path="/patients/:patientId/obstetric-shoulder-dystocia/:id/print" element={can('patient:read_clinical') ? <ObstetricShoulderDystociaPrint /> : <Navigate to="/obstetric-shoulder-dystocia" replace />} />
          <Route path="/pediatric-foreign-body" element={can('patient:read_clinical') ? <PediatricForeignBodyPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-foreign-body/:id/print" element={can('patient:read_clinical') ? <PediatricForeignBodyPrint /> : <Navigate to="/pediatric-foreign-body" replace />} />
          <Route path="/patients/:patientId/pediatric-foreign-body/:id/print" element={can('patient:read_clinical') ? <PediatricForeignBodyPrint /> : <Navigate to="/pediatric-foreign-body" replace />} />
          <Route path="/neonatal-hypomagnesemia" element={can('patient:read_clinical') ? <NeonatalHypomagnesemiaPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-hypomagnesemia/:id/print" element={can('patient:read_clinical') ? <NeonatalHypomagnesemiaPrint /> : <Navigate to="/neonatal-hypomagnesemia" replace />} />
          <Route path="/patients/:patientId/neonatal-hypomagnesemia/:id/print" element={can('patient:read_clinical') ? <NeonatalHypomagnesemiaPrint /> : <Navigate to="/neonatal-hypomagnesemia" replace />} />
          <Route path="/obstetric-ppcm" element={can('patient:read_clinical') ? <ObstetricPpcmPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-ppcm/:id/print" element={can('patient:read_clinical') ? <ObstetricPpcmPrint /> : <Navigate to="/obstetric-ppcm" replace />} />
          <Route path="/patients/:patientId/obstetric-ppcm/:id/print" element={can('patient:read_clinical') ? <ObstetricPpcmPrint /> : <Navigate to="/obstetric-ppcm" replace />} />
          <Route path="/pediatric-septic-arthritis" element={can('patient:read_clinical') ? <PediatricSepticArthritisPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-septic-arthritis/:id/print" element={can('patient:read_clinical') ? <PediatricSepticArthritisPrint /> : <Navigate to="/pediatric-septic-arthritis" replace />} />
          <Route path="/patients/:patientId/pediatric-septic-arthritis/:id/print" element={can('patient:read_clinical') ? <PediatricSepticArthritisPrint /> : <Navigate to="/pediatric-septic-arthritis" replace />} />
          <Route path="/neonatal-chylothorax" element={can('patient:read_clinical') ? <NeonatalChylothoraxPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-chylothorax/:id/print" element={can('patient:read_clinical') ? <NeonatalChylothoraxPrint /> : <Navigate to="/neonatal-chylothorax" replace />} />
          <Route path="/patients/:patientId/neonatal-chylothorax/:id/print" element={can('patient:read_clinical') ? <NeonatalChylothoraxPrint /> : <Navigate to="/neonatal-chylothorax" replace />} />
          <Route path="/obstetric-cord-prolapse" element={can('patient:read_clinical') ? <ObstetricCordProlapsePage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-cord-prolapse/:id/print" element={can('patient:read_clinical') ? <ObstetricCordProlapsePrint /> : <Navigate to="/obstetric-cord-prolapse" replace />} />
          <Route path="/patients/:patientId/obstetric-cord-prolapse/:id/print" element={can('patient:read_clinical') ? <ObstetricCordProlapsePrint /> : <Navigate to="/obstetric-cord-prolapse" replace />} />
          <Route path="/pediatric-intussusception" element={can('patient:read_clinical') ? <PediatricIntussusceptionPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-intussusception/:id/print" element={can('patient:read_clinical') ? <PediatricIntussusceptionPrint /> : <Navigate to="/pediatric-intussusception" replace />} />
          <Route path="/patients/:patientId/pediatric-intussusception/:id/print" element={can('patient:read_clinical') ? <PediatricIntussusceptionPrint /> : <Navigate to="/pediatric-intussusception" replace />} />
          <Route path="/neonatal-mas" element={can('patient:read_clinical') ? <NeonatalMasPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-mas/:id/print" element={can('patient:read_clinical') ? <NeonatalMasPrint /> : <Navigate to="/neonatal-mas" replace />} />
          <Route path="/patients/:patientId/neonatal-mas/:id/print" element={can('patient:read_clinical') ? <NeonatalMasPrint /> : <Navigate to="/neonatal-mas" replace />} />
          <Route path="/obstetric-uterine-inversion" element={can('patient:read_clinical') ? <ObstetricUterineInversionPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-uterine-inversion/:id/print" element={can('patient:read_clinical') ? <ObstetricUterineInversionPrint /> : <Navigate to="/obstetric-uterine-inversion" replace />} />
          <Route path="/patients/:patientId/obstetric-uterine-inversion/:id/print" element={can('patient:read_clinical') ? <ObstetricUterineInversionPrint /> : <Navigate to="/obstetric-uterine-inversion" replace />} />
          <Route path="/pediatric-appendicitis" element={can('patient:read_clinical') ? <PediatricAppendicitisPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-appendicitis/:id/print" element={can('patient:read_clinical') ? <PediatricAppendicitisPrint /> : <Navigate to="/pediatric-appendicitis" replace />} />
          <Route path="/patients/:patientId/pediatric-appendicitis/:id/print" element={can('patient:read_clinical') ? <PediatricAppendicitisPrint /> : <Navigate to="/pediatric-appendicitis" replace />} />
          <Route path="/neonatal-ttn" element={can('patient:read_clinical') ? <NeonatalTtnPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-ttn/:id/print" element={can('patient:read_clinical') ? <NeonatalTtnPrint /> : <Navigate to="/neonatal-ttn" replace />} />
          <Route path="/patients/:patientId/neonatal-ttn/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalTtnPrint /> : <Navigate to="/neonatal-ttn" replace />} />
          <Route path="/obstetric-pdph" element={can('patient:read_clinical') ? <ObstetricPdphPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-pdph/:id/print" element={can('patient:read_clinical') ? <ObstetricPdphPrint /> : <Navigate to="/obstetric-pdph" replace />} />
          <Route path="/patients/:patientId/obstetric-pdph/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricPdphPrint /> : <Navigate to="/obstetric-pdph" replace />} />
          <Route path="/pediatric-meningitis" element={can('patient:read_clinical') ? <PediatricBacterialMeningitisPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-meningitis/:id/print" element={can('patient:read_clinical') ? <PediatricBacterialMeningitisPrint /> : <Navigate to="/pediatric-meningitis" replace />} />
          <Route path="/patients/:patientId/pediatric-meningitis/:episodeId/print" element={can('patient:read_clinical') ? <PediatricBacterialMeningitisPrint /> : <Navigate to="/pediatric-meningitis" replace />} />
          <Route path="/neonatal-aop" element={can('patient:read_clinical') ? <NeonatalAopPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-aop/:id/print" element={can('patient:read_clinical') ? <NeonatalAopPrint /> : <Navigate to="/neonatal-aop" replace />} />
          <Route path="/patients/:patientId/neonatal-aop/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalAopPrint /> : <Navigate to="/neonatal-aop" replace />} />
          <Route path="/obstetric-retained-placenta" element={can('patient:read_clinical') ? <ObstetricRetainedPlacentaPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-retained-placenta/:id/print" element={can('patient:read_clinical') ? <ObstetricRetainedPlacentaPrint /> : <Navigate to="/obstetric-retained-placenta" replace />} />
          <Route path="/patients/:patientId/obstetric-retained-placenta/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricRetainedPlacentaPrint /> : <Navigate to="/obstetric-retained-placenta" replace />} />
          <Route path="/pediatric-pyloric-stenosis" element={can('patient:read_clinical') ? <PediatricPyloricStenosisPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-pyloric-stenosis/:id/print" element={can('patient:read_clinical') ? <PediatricPyloricStenosisPrint /> : <Navigate to="/pediatric-pyloric-stenosis" replace />} />
          <Route path="/patients/:patientId/pediatric-pyloric-stenosis/:episodeId/print" element={can('patient:read_clinical') ? <PediatricPyloricStenosisPrint /> : <Navigate to="/pediatric-pyloric-stenosis" replace />} />
          <Route path="/neonatal-sgh" element={can('patient:read_clinical') ? <NeonatalSghPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-sgh/:id/print" element={can('patient:read_clinical') ? <NeonatalSghPrint /> : <Navigate to="/neonatal-sgh" replace />} />
          <Route path="/patients/:patientId/neonatal-sgh/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalSghPrint /> : <Navigate to="/neonatal-sgh" replace />} />
          <Route path="/obstetric-tolac" element={can('patient:read_clinical') ? <ObstetricTolacPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-tolac/:id/print" element={can('patient:read_clinical') ? <ObstetricTolacPrint /> : <Navigate to="/obstetric-tolac" replace />} />
          <Route path="/patients/:patientId/obstetric-tolac/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricTolacPrint /> : <Navigate to="/obstetric-tolac" replace />} />
          <Route path="/pediatric-kawasaki" element={can('patient:read_clinical') ? <PediatricKawasakiPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-kawasaki/:id/print" element={can('patient:read_clinical') ? <PediatricKawasakiPrint /> : <Navigate to="/pediatric-kawasaki" replace />} />
          <Route path="/patients/:patientId/pediatric-kawasaki/:episodeId/print" element={can('patient:read_clinical') ? <PediatricKawasakiPrint /> : <Navigate to="/pediatric-kawasaki" replace />} />
          <Route path="/neonatal-volvulus" element={can('patient:read_clinical') ? <NeonatalVolvulusPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-volvulus/:id/print" element={can('patient:read_clinical') ? <NeonatalVolvulusPrint /> : <Navigate to="/neonatal-volvulus" replace />} />
          <Route path="/patients/:patientId/neonatal-volvulus/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalVolvulusPrint /> : <Navigate to="/neonatal-volvulus" replace />} />
          <Route path="/obstetric-ecv" element={can('patient:read_clinical') ? <ObstetricEcvPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-ecv/:id/print" element={can('patient:read_clinical') ? <ObstetricEcvPrint /> : <Navigate to="/obstetric-ecv" replace />} />
          <Route path="/patients/:patientId/obstetric-ecv/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricEcvPrint /> : <Navigate to="/obstetric-ecv" replace />} />
          <Route path="/pediatric-dka-ce" element={can('patient:read_clinical') ? <PediatricDkaCerebralEdemaPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-dka-ce/:id/print" element={can('patient:read_clinical') ? <PediatricDkaCerebralEdemaPrint /> : <Navigate to="/pediatric-dka-ce" replace />} />
          <Route path="/patients/:patientId/pediatric-dka-ce/:episodeId/print" element={can('patient:read_clinical') ? <PediatricDkaCerebralEdemaPrint /> : <Navigate to="/pediatric-dka-ce" replace />} />
          <Route path="/neonatal-meconium-ileus" element={can('patient:read_clinical') ? <NeonatalMeconiumIleusPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-meconium-ileus/:id/print" element={can('patient:read_clinical') ? <NeonatalMeconiumIleusPrint /> : <Navigate to="/neonatal-meconium-ileus" replace />} />
          <Route path="/patients/:patientId/neonatal-meconium-ileus/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalMeconiumIleusPrint /> : <Navigate to="/neonatal-meconium-ileus" replace />} />
          <Route path="/obstetric-placental-abruption" element={can('patient:read_clinical') ? <ObstetricPlacentalAbruptionPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-placental-abruption/:id/print" element={can('patient:read_clinical') ? <ObstetricPlacentalAbruptionPrint /> : <Navigate to="/obstetric-placental-abruption" replace />} />
          <Route path="/patients/:patientId/obstetric-placental-abruption/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricPlacentalAbruptionPrint /> : <Navigate to="/obstetric-placental-abruption" replace />} />
          <Route path="/pediatric-hus" element={can('patient:read_clinical') ? <PediatricHusPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-hus/:id/print" element={can('patient:read_clinical') ? <PediatricHusPrint /> : <Navigate to="/pediatric-hus" replace />} />
          <Route path="/patients/:patientId/pediatric-hus/:episodeId/print" element={can('patient:read_clinical') ? <PediatricHusPrint /> : <Navigate to="/pediatric-hus" replace />} />
          <Route path="/neonatal-ea-tef" element={can('patient:read_clinical') ? <NeonatalEaTefPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-ea-tef/:id/print" element={can('patient:read_clinical') ? <NeonatalEaTefPrint /> : <Navigate to="/neonatal-ea-tef" replace />} />
          <Route path="/patients/:patientId/neonatal-ea-tef/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalEaTefPrint /> : <Navigate to="/neonatal-ea-tef" replace />} />
          <Route path="/obstetric-vasa-previa" element={can('patient:read_clinical') ? <ObstetricVasaPreviaPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-vasa-previa/:id/print" element={can('patient:read_clinical') ? <ObstetricVasaPreviaPrint /> : <Navigate to="/obstetric-vasa-previa" replace />} />
          <Route path="/patients/:patientId/obstetric-vasa-previa/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricVasaPreviaPrint /> : <Navigate to="/obstetric-vasa-previa" replace />} />
          <Route path="/pediatric-empyema" element={can('patient:read_clinical') ? <PediatricEmpyemaPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-empyema/:id/print" element={can('patient:read_clinical') ? <PediatricEmpyemaPrint /> : <Navigate to="/pediatric-empyema" replace />} />
          <Route path="/patients/:patientId/pediatric-empyema/:episodeId/print" element={can('patient:read_clinical') ? <PediatricEmpyemaPrint /> : <Navigate to="/pediatric-empyema" replace />} />
          <Route path="/neonatal-abdominal-defects" element={can('patient:read_clinical') ? <NeonatalAbdominalDefectsPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-abdominal-defects/:id/print" element={can('patient:read_clinical') ? <NeonatalAbdominalDefectsPrint /> : <Navigate to="/neonatal-abdominal-defects" replace />} />
          <Route path="/patients/:patientId/neonatal-abdominal-defects/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalAbdominalDefectsPrint /> : <Navigate to="/neonatal-abdominal-defects" replace />} />
          <Route path="/obstetric-spt" element={can('patient:read_clinical') ? <ObstetricSptPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-spt/:id/print" element={can('patient:read_clinical') ? <ObstetricSptPrint /> : <Navigate to="/obstetric-spt" replace />} />
          <Route path="/patients/:patientId/obstetric-spt/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricSptPrint /> : <Navigate to="/obstetric-spt" replace />} />
          <Route path="/pediatric-osteomyelitis" element={can('patient:read_clinical') ? <PediatricOsteomyelitisPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-osteomyelitis/:id/print" element={can('patient:read_clinical') ? <PediatricOsteomyelitisPrint /> : <Navigate to="/pediatric-osteomyelitis" replace />} />
          <Route path="/patients/:patientId/pediatric-osteomyelitis/:episodeId/print" element={can('patient:read_clinical') ? <PediatricOsteomyelitisPrint /> : <Navigate to="/pediatric-osteomyelitis" replace />} />
          <Route path="/neonatal-intestinal-atresia" element={can('patient:read_clinical') ? <NeonatalIntestinalAtresiaPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-intestinal-atresia/:id/print" element={can('patient:read_clinical') ? <NeonatalIntestinalAtresiaPrint /> : <Navigate to="/neonatal-intestinal-atresia" replace />} />
          <Route path="/patients/:patientId/neonatal-intestinal-atresia/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalIntestinalAtresiaPrint /> : <Navigate to="/neonatal-intestinal-atresia" replace />} />
          <Route path="/obstetric-hellp" element={can('patient:read_clinical') ? <ObstetricHellpPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-hellp/:id/print" element={can('patient:read_clinical') ? <ObstetricHellpPrint /> : <Navigate to="/obstetric-hellp" replace />} />
          <Route path="/patients/:patientId/obstetric-hellp/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricHellpPrint /> : <Navigate to="/obstetric-hellp" replace />} />
          <Route path="/pediatric-scfe" element={can('patient:read_clinical') ? <PediatricScfePage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-scfe/:id/print" element={can('patient:read_clinical') ? <PediatricScfePrint /> : <Navigate to="/pediatric-scfe" replace />} />
          <Route path="/patients/:patientId/pediatric-scfe/:episodeId/print" element={can('patient:read_clinical') ? <PediatricScfePrint /> : <Navigate to="/pediatric-scfe" replace />} />
          <Route path="/neonatal-cdh" element={can('patient:read_clinical') ? <NeonatalCdhPage /> : <Navigate to="/" replace />} />
          <Route path="/neonatal-cdh/:id/print" element={can('patient:read_clinical') ? <NeonatalCdhPrint /> : <Navigate to="/neonatal-cdh" replace />} />
          <Route path="/patients/:patientId/neonatal-cdh/:episodeId/print" element={can('patient:read_clinical') ? <NeonatalCdhPrint /> : <Navigate to="/neonatal-cdh" replace />} />
          <Route path="/obstetric-hyperemesis" element={can('patient:read_clinical') ? <ObstetricHyperemesisPage /> : <Navigate to="/" replace />} />
          <Route path="/obstetric-hyperemesis/:id/print" element={can('patient:read_clinical') ? <ObstetricHyperemesisPrint /> : <Navigate to="/obstetric-hyperemesis" replace />} />
          <Route path="/patients/:patientId/obstetric-hyperemesis/:episodeId/print" element={can('patient:read_clinical') ? <ObstetricHyperemesisPrint /> : <Navigate to="/obstetric-hyperemesis" replace />} />
          <Route path="/pediatric-acute-scrotum" element={can('patient:read_clinical') ? <PediatricAcuteScrotumPage /> : <Navigate to="/" replace />} />
          <Route path="/pediatric-acute-scrotum/:id/print" element={can('patient:read_clinical') ? <PediatricAcuteScrotumPrint /> : <Navigate to="/pediatric-acute-scrotum" replace />} />
          <Route path="/patients/:patientId/pediatric-acute-scrotum/:episodeId/print" element={can('patient:read_clinical') ? <PediatricAcuteScrotumPrint /> : <Navigate to="/pediatric-acute-scrotum" replace />} />
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
