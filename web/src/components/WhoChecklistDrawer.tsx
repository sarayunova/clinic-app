import React, { useEffect, useState } from 'react';
import {
  getOtSchedule,
  updateWhoChecklist,
  type OtScheduleRecord,
  type WhoChecklistRecord,
} from '../api';

interface WhoChecklistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: number;
  onSaved?: () => void;
}

export function WhoChecklistDrawer({
  isOpen,
  onClose,
  scheduleId,
  onSaved,
}: WhoChecklistDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<OtScheduleRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'signin' | 'timeout' | 'signout'>('signin');

  // Form State
  const [signinCompleted, setSigninCompleted] = useState(false);
  const [signinPatientConfirmed, setSigninPatientConfirmed] = useState(true);
  const [signinSiteMarked, setSigninSiteMarked] = useState(true);
  const [signinAnesthesiaSafetyCheck, setSigninAnesthesiaSafetyCheck] = useState(true);
  const [signinPulseOximeterFunctioning, setSigninPulseOximeterFunctioning] = useState(true);
  const [signinKnownAllergy, setSigninKnownAllergy] = useState(false);
  const [signinDifficultAirwayRisk, setSigninDifficultAirwayRisk] = useState(false);
  const [signinBloodLossRisk, setSigninBloodLossRisk] = useState(false);
  const [signinNurseAnesthetistName, setSigninNurseAnesthetistName] = useState('');

  const [timeoutCompleted, setTimeoutCompleted] = useState(false);
  const [timeoutTeamIntroduced, setTimeoutTeamIntroduced] = useState(true);
  const [timeoutVerbalConfirmation, setTimeoutVerbalConfirmation] = useState(true);
  const [timeoutSurgeonReview, setTimeoutSurgeonReview] = useState('');
  const [timeoutAnesthetistReview, setTimeoutAnesthetistReview] = useState('');
  const [timeoutNursingSterilityConfirmed, setTimeoutNursingSterilityConfirmed] = useState(true);
  const [timeoutAntibioticProphylaxisGiven, setTimeoutAntibioticProphylaxisGiven] = useState(true);
  const [timeoutAntibioticNameDose, setTimeoutAntibioticNameDose] = useState('Inj. Cefazolin 1g IV stat');
  const [timeoutImagingDisplayed, setTimeoutImagingDisplayed] = useState(true);
  const [timeoutCompletedByName, setTimeoutCompletedByName] = useState('');

  const [signoutCompleted, setSignoutCompleted] = useState(false);
  const [signoutProcedureRecordedName, setSignoutProcedureRecordedName] = useState('');
  const [signoutCountsCorrect, setSignoutCountsCorrect] = useState(true);
  const [signoutSpecimenLabeled, setSignoutSpecimenLabeled] = useState(true);
  const [signoutEquipmentProblems, setSignoutEquipmentProblems] = useState('');
  const [signoutRecoveryConcerns, setSignoutRecoveryConcerns] = useState('');
  const [signoutCompletedByName, setSignoutCompletedByName] = useState('');

  useEffect(() => {
    if (!isOpen || !scheduleId) return;
    setLoading(true);
    getOtSchedule(scheduleId)
      .then((res) => {
        setSchedule(res.schedule);
        const who = res.whoChecklist;
        if (who) {
          setSigninCompleted(Boolean(who.signin_completed));
          setSigninPatientConfirmed(who.signin_patient_confirmed === 1);
          setSigninSiteMarked(who.signin_site_marked === 1);
          setSigninAnesthesiaSafetyCheck(who.signin_anesthesia_safety_check === 1);
          setSigninPulseOximeterFunctioning(who.signin_pulse_oximeter_functioning === 1);
          setSigninKnownAllergy(who.signin_known_allergy === 1);
          setSigninDifficultAirwayRisk(who.signin_difficult_airway_risk === 1);
          setSigninBloodLossRisk(who.signin_blood_loss_risk === 1);
          setSigninNurseAnesthetistName(who.signin_nurse_anesthetist_name || res.schedule.scrub_nurse_name || '');

          setTimeoutCompleted(Boolean(who.timeout_completed));
          setTimeoutTeamIntroduced(who.timeout_team_introduced === 1);
          setTimeoutVerbalConfirmation(who.timeout_verbal_confirmation === 1);
          setTimeoutSurgeonReview(who.timeout_surgeon_review || '');
          setTimeoutAnesthetistReview(who.timeout_anesthetist_review || '');
          setTimeoutNursingSterilityConfirmed(who.timeout_nursing_sterility_confirmed === 1);
          setTimeoutAntibioticProphylaxisGiven(who.timeout_antibiotic_prophylaxis_given === 1);
          setTimeoutAntibioticNameDose(who.timeout_antibiotic_name_dose || 'Inj. Cefazolin 1g IV stat');
          setTimeoutImagingDisplayed(who.timeout_imaging_displayed === 1);
          setTimeoutCompletedByName(who.timeout_completed_by_name || res.schedule.primary_surgeon_name || '');

          setSignoutCompleted(Boolean(who.signout_completed));
          setSignoutProcedureRecordedName(who.signout_procedure_recorded_name || res.schedule.procedure_name);
          setSignoutCountsCorrect(who.signout_counts_correct === 1);
          setSignoutSpecimenLabeled(who.signout_specimen_labeled === 1);
          setSignoutEquipmentProblems(who.signout_equipment_problems || '');
          setSignoutRecoveryConcerns(who.signout_recovery_concerns || '');
          setSignoutCompletedByName(who.signout_completed_by_name || '');
        } else {
          setSignoutProcedureRecordedName(res.schedule.procedure_name);
          setSigninNurseAnesthetistName(res.schedule.scrub_nurse_name || '');
          setTimeoutCompletedByName(res.schedule.primary_surgeon_name || '');
        }
        setLoading(false);
      })
      .catch((err) => {
        alert('Failed to load WHO surgical safety checklist: ' + err.message);
        setLoading(false);
      });
  }, [isOpen, scheduleId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateWhoChecklist(scheduleId, {
        signinCompleted,
        signinPatientConfirmed,
        signinSiteMarked,
        signinAnesthesiaSafetyCheck,
        signinPulseOximeterFunctioning,
        signinKnownAllergy,
        signinDifficultAirwayRisk,
        signinBloodLossRisk,
        signinNurseAnesthetistName,
        timeoutCompleted,
        timeoutTeamIntroduced,
        timeoutVerbalConfirmation,
        timeoutSurgeonReview,
        timeoutAnesthetistReview,
        timeoutNursingSterilityConfirmed,
        timeoutAntibioticProphylaxisGiven,
        timeoutAntibioticNameDose,
        timeoutImagingDisplayed,
        timeoutCompletedByName,
        signoutCompleted,
        signoutProcedureRecordedName,
        signoutCountsCorrect,
        signoutSpecimenLabeled,
        signoutEquipmentProblems,
        signoutRecoveryConcerns,
        signoutCompletedByName,
      });
      alert('WHO Surgical Safety Checklist saved successfully!');
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      alert('Error updating checklist: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="bg-teal-700 text-white p-4 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <h2 className="text-lg font-bold tracking-tight">
                WHO Surgical Safety Checklist (Safe Surgery Saves Lives)
              </h2>
            </div>
            {schedule && (
              <p className="text-xs text-teal-100 mt-1">
                Patient: <span className="font-semibold text-white">{schedule.patient_name}</span> ({schedule.uhid})
                &nbsp;|&nbsp; Procedure: <span className="font-semibold text-white">{schedule.procedure_name}</span>
                &nbsp;|&nbsp; OT Room: <span className="font-semibold text-white">{schedule.ot_room.replace(/_/g, ' ')}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-teal-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg"
          >
            &times;
          </button>
        </div>

        {/* Progress Phase Bar */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('signin')}
            className={`py-3 px-4 flex items-center justify-center gap-2 transition-colors border-r border-slate-200 ${
              activeTab === 'signin'
                ? 'bg-white text-teal-700 border-b-2 border-b-teal-600 font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                signinCompleted ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            >
              {signinCompleted ? '✓' : '1'}
            </span>
            <span>PHASE 1: SIGN IN</span>
            {signinCompleted && <span className="text-[10px] text-emerald-600 uppercase font-bold">(Done)</span>}
          </button>

          <button
            onClick={() => setActiveTab('timeout')}
            className={`py-3 px-4 flex items-center justify-center gap-2 transition-colors border-r border-slate-200 ${
              activeTab === 'timeout'
                ? 'bg-white text-teal-700 border-b-2 border-b-teal-600 font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                timeoutCompleted ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            >
              {timeoutCompleted ? '✓' : '2'}
            </span>
            <span>PHASE 2: TIME OUT</span>
            {timeoutCompleted && <span className="text-[10px] text-emerald-600 uppercase font-bold">(Done)</span>}
          </button>

          <button
            onClick={() => setActiveTab('signout')}
            className={`py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'signout'
                ? 'bg-white text-teal-700 border-b-2 border-b-teal-600 font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                signoutCompleted ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            >
              {signoutCompleted ? '✓' : '3'}
            </span>
            <span>PHASE 3: SIGN OUT</span>
            {signoutCompleted && <span className="text-[10px] text-emerald-600 uppercase font-bold">(Done)</span>}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading checklist data...</div>
          ) : (
            <div className="space-y-6">
              {/* PHASE 1: SIGN IN */}
              {activeTab === 'signin' && (
                <div className="space-y-4 bg-white p-5 rounded-xl border border-teal-100 shadow-sm">
                  <div className="border-b border-slate-200 pb-2 mb-3">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block"></span>
                      Phase 1: Sign In (Before Induction of Anesthesia)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Conducted with Patient, Nurse, and Anesthesia Professional prior to inducing anesthesia.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signinPatientConfirmed}
                        onChange={(e) => setSigninPatientConfirmed(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Patient Identity & Consent Verified</div>
                        <div className="text-slate-500">Patient has confirmed identity, site, procedure and consent.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signinSiteMarked}
                        onChange={(e) => setSigninSiteMarked(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Surgical Site Marked</div>
                        <div className="text-slate-500">Site marked with permanent marker or confirmed Not Applicable.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signinAnesthesiaSafetyCheck}
                        onChange={(e) => setSigninAnesthesiaSafetyCheck(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Anesthesia Safety Check Completed</div>
                        <div className="text-slate-500">Anesthesia machine & medication check fully verified.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signinPulseOximeterFunctioning}
                        onChange={(e) => setSigninPulseOximeterFunctioning(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Pulse Oximeter Connected & Functioning</div>
                        <div className="text-slate-500">Continuous audio pulse tone audible on patient.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signinKnownAllergy}
                        onChange={(e) => setSigninKnownAllergy(e.target.checked)}
                        className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Does Patient Have a Known Allergy?</div>
                        <div className="text-slate-500">Check red alert band and cross-verify latex / drug allergies.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signinDifficultAirwayRisk}
                        onChange={(e) => setSigninDifficultAirwayRisk(e.target.checked)}
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Difficult Airway / Aspiration Risk?</div>
                        <div className="text-slate-500">Equipment / difficult airway cart and assistance available.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer md:col-span-2">
                      <input
                        type="checkbox"
                        checked={signinBloodLossRisk}
                        onChange={(e) => setSigninBloodLossRisk(e.target.checked)}
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Risk of &gt; 500 mL Blood Loss (7 mL/kg in children)?</div>
                        <div className="text-slate-500">Adequate large-bore IV access and fluids/blood products cross-matched and planned.</div>
                      </div>
                    </label>

                    <div className="md:col-span-2 pt-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Sign In Verified By (Nurse / Anesthesia Professional Name):
                      </label>
                      <input
                        type="text"
                        value={signinNurseAnesthetistName}
                        onChange={(e) => setSigninNurseAnesthetistName(e.target.value)}
                        placeholder="Nurse or Anesthetist Name"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Complete Sign In Toggle */}
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signinCompleted}
                        onChange={(e) => setSigninCompleted(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span className="font-bold text-xs text-slate-800">
                        Mark Phase 1 (Sign In) as Verified & Completed
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('timeout')}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold"
                    >
                      Next: Phase 2 (Time Out) &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* PHASE 2: TIME OUT */}
              {activeTab === 'timeout' && (
                <div className="space-y-4 bg-white p-5 rounded-xl border border-teal-100 shadow-sm">
                  <div className="border-b border-slate-200 pb-2 mb-3">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block"></span>
                      Phase 2: Time Out (Before Skin Incision)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Conducted with the Entire Surgical Team: Surgeon, Anesthesia Professional, and Scrub/Circulating Nurse.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timeoutTeamIntroduced}
                        onChange={(e) => setTimeoutTeamIntroduced(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Team Introductions Completed</div>
                        <div className="text-slate-500">All team members have introduced themselves by name and role.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timeoutVerbalConfirmation}
                        onChange={(e) => setTimeoutVerbalConfirmation(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Verbal Confirmation of Patient & Site</div>
                        <div className="text-slate-500">Surgeon, Anesthetist and Nurse verbally confirm: patient, site, and procedure.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timeoutNursingSterilityConfirmed}
                        onChange={(e) => setTimeoutNursingSterilityConfirmed(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Nursing Sterility Confirmed</div>
                        <div className="text-slate-500">Sterility indicators checked, pack integrity verified, no equipment issues.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timeoutImagingDisplayed}
                        onChange={(e) => setTimeoutImagingDisplayed(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Essential Imaging Displayed</div>
                        <div className="text-slate-500">USG / CT / MRI correctly oriented and viewable in OT (or N/A).</div>
                      </div>
                    </label>

                    <div className="md:col-span-2 p-3 rounded-lg border border-teal-200 bg-teal-50/50">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={timeoutAntibioticProphylaxisGiven}
                          onChange={(e) => setTimeoutAntibioticProphylaxisGiven(e.target.checked)}
                          className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">
                            Antibiotic Prophylaxis Given within the Last 60 Minutes?
                          </div>
                          <div className="text-slate-500 mb-2">
                            Mandatory surgical site infection prophylaxis prior to skin incision.
                          </div>
                          <input
                            type="text"
                            value={timeoutAntibioticNameDose}
                            onChange={(e) => setTimeoutAntibioticNameDose(e.target.value)}
                            placeholder="Drug name, dose, route, and time administered"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-teal-500 focus:border-teal-500"
                          />
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Surgeon Review (Critical / Unexpected Steps, Duration, Blood Loss):
                      </label>
                      <textarea
                        value={timeoutSurgeonReview}
                        onChange={(e) => setTimeoutSurgeonReview(e.target.value)}
                        rows={2}
                        placeholder="Anticipated blood loss, operative nuances, standby needs..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Anesthesia Review (Patient Specific Concerns):
                      </label>
                      <textarea
                        value={timeoutAnesthetistReview}
                        onChange={(e) => setTimeoutAnesthetistReview(e.target.value)}
                        rows={2}
                        placeholder="Hemodynamic stability, airway backup, blood availability..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Time Out Completed By (Lead Surgeon / Nurse Name):
                      </label>
                      <input
                        type="text"
                        value={timeoutCompletedByName}
                        onChange={(e) => setTimeoutCompletedByName(e.target.value)}
                        placeholder="Lead Surgeon or Verifying Practitioner"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Complete Time Out Toggle */}
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timeoutCompleted}
                        onChange={(e) => setTimeoutCompleted(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span className="font-bold text-xs text-slate-800">
                        Mark Phase 2 (Time Out) as Completed
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('signout')}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold"
                    >
                      Next: Phase 3 (Sign Out) &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* PHASE 3: SIGN OUT */}
              {activeTab === 'signout' && (
                <div className="space-y-4 bg-white p-5 rounded-xl border border-teal-100 shadow-sm">
                  <div className="border-b border-slate-200 pb-2 mb-3">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block"></span>
                      Phase 3: Sign Out (Before Patient Leaves Operating Room)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Conducted with Nurse, Anesthesia Professional and Surgeon before patient transfer to PACU/Recovery.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="md:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Name of the Actual Procedure Performed:
                      </label>
                      <input
                        type="text"
                        value={signoutProcedureRecordedName}
                        onChange={(e) => setSignoutProcedureRecordedName(e.target.value)}
                        placeholder="e.g., Lower Segment Cesarean Section under Spinal Anesthesia"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signoutCountsCorrect}
                        onChange={(e) => setSignoutCountsCorrect(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Surgical Counts Correct</div>
                        <div className="text-slate-500">
                          Instrument, sponge/mop, and needle counts are 100% reconciled and accounted for.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signoutSpecimenLabeled}
                        onChange={(e) => setSignoutSpecimenLabeled(e.target.checked)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Specimen Labeled Correctly</div>
                        <div className="text-slate-500">
                          Specimen container labeled including patient UHID, name, and anatomical site read aloud (or N/A).
                        </div>
                      </div>
                    </label>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Equipment Problems to be Addressed:
                      </label>
                      <textarea
                        value={signoutEquipmentProblems}
                        onChange={(e) => setSignoutEquipmentProblems(e.target.value)}
                        rows={2}
                        placeholder="Nil or note any cautery, suction, or instrumentation malfunctions..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Key Concerns for PACU Recovery & Postoperative Management:
                      </label>
                      <textarea
                        value={signoutRecoveryConcerns}
                        onChange={(e) => setSignoutRecoveryConcerns(e.target.value)}
                        rows={2}
                        placeholder="Monitoring uterine tone, PPH observation, analgesia, antiemetics..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Sign Out Completed By (Name):
                      </label>
                      <input
                        type="text"
                        value={signoutCompletedByName}
                        onChange={(e) => setSignoutCompletedByName(e.target.value)}
                        placeholder="Nurse or Practitioner completing Sign Out"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Complete Sign Out Toggle */}
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signoutCompleted}
                        onChange={(e) => setSignoutCompleted(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span className="font-bold text-xs text-slate-800">
                        Mark Phase 3 (Sign Out) as Completed
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Flowsheet Status:</span>
            {signinCompleted && timeoutCompleted && signoutCompleted ? (
              <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                All 3 Phases Complete ✓
              </span>
            ) : (
              <span className="text-amber-700 font-medium bg-amber-100 px-2 py-0.5 rounded">
                Checklist In Progress
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
            >
              {saving ? 'Saving...' : 'Save WHO Checklist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
