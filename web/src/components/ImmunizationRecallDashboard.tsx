import React, { useState, useEffect } from 'react';
import {
  type Patient,
  type ImmunizationRecallItem,
  type CommunicationDispatchLog,
  getImmunizationRecallList,
  getPatientImmunizationStatus,
  dispatchWhatsappReminder,
  getCommunicationDispatchLogs,
} from '../api';
import { useAuth } from '../auth';

interface Props {
  patient?: Patient;
}

export function ImmunizationRecallDashboard({ patient }: Props) {
  const { can } = useAuth();
  const [filterMode, setFilterMode] = useState<'all' | 'overdue' | 'due_now' | 'upcoming'>('all');
  const [recallList, setRecallList] = useState<ImmunizationRecallItem[]>([]);
  const [singlePatientStatus, setSinglePatientStatus] = useState<any | null>(null);
  const [dispatchLogs, setDispatchLogs] = useState<CommunicationDispatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'english' | 'hindi'>('english');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [dispatching, setDispatching] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      if (patient) {
        const [stat, logs] = await Promise.all([
          getPatientImmunizationStatus(patient.id),
          getCommunicationDispatchLogs(patient.id),
        ]);
        setSinglePatientStatus(stat);
        setDispatchLogs(logs);
      } else {
        const list = await getImmunizationRecallList();
        setRecallList(list);
      }
    } catch (err) {
      console.error('Error loading immunization recall data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patient?.id]);

  const handleSendWhatsApp = async (
    patientId: number,
    phone: string,
    messageText: string,
    deepLinkUrl?: string | null,
  ) => {
    if (!phone) {
      alert('Patient does not have a recorded phone or emergency contact number.');
      return;
    }
    try {
      setDispatching(patientId);
      // 1. Audit & save dispatch log
      await dispatchWhatsappReminder({
        patientId,
        recipientPhone: phone,
        triggerEvent: 'immunization_due',
        language,
        messageBody: messageText,
        deepLinkUrl: deepLinkUrl || null,
      });

      // 2. Open WhatsApp link in new window
      if (deepLinkUrl) {
        window.open(deepLinkUrl, '_blank', 'noopener,noreferrer');
      }

      // Refresh dispatch logs if on patient page
      if (patient) {
        const logs = await getCommunicationDispatchLogs(patient.id);
        setDispatchLogs(logs);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to dispatch WhatsApp reminder');
    } finally {
      setDispatching(null);
    }
  };

  const handleCopySms = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white p-6 rounded-xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📲</span>
              <h2 className="text-2xl font-bold tracking-tight">
                Automated Immunization Recall &amp; WhatsApp Engine
              </h2>
            </div>
            <p className="text-emerald-100 mt-1 max-w-2xl text-sm leading-relaxed">
              Standardized Indian Academy of Pediatrics (IAP) &amp; National Immunization Schedule
              surveillance. Detects missed milestones, overdue boosters, and generates one-click
              bilingual (English &amp; Hindi) WhatsApp and SMS recall notices.
            </p>
          </div>

          {/* Language Selector */}
          <div className="bg-white/10 backdrop-blur-sm p-1.5 rounded-lg border border-white/20 flex items-center gap-1">
            <span className="text-xs text-emerald-100 px-2 font-medium">Language:</span>
            <button
              onClick={() => setLanguage('english')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                language === 'english'
                  ? 'bg-white text-emerald-900 shadow'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('hindi')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                language === 'hindi'
                  ? 'bg-white text-emerald-900 shadow'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              हिंदी (Hindi)
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Single Patient Detailed View */}
      {patient && singlePatientStatus && (
        <div className="space-y-6">
          {!singlePatientStatus.hasDob ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-sm">
              ⚠️ Date of birth is not recorded for this patient. Please update the patient profile
              with date of birth to activate automated IAP vaccine recall.
            </div>
          ) : (
            <>
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Infant Age</div>
                  <div className="text-xl font-bold text-gray-900 mt-1">
                    {singlePatientStatus.evaluation?.ageWeeks} Weeks
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    ({singlePatientStatus.evaluation?.ageDays} days old)
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
                  <div className="text-xs text-red-600 uppercase font-semibold">Overdue Vaccines</div>
                  <div className="text-xl font-bold text-red-700 mt-1">
                    {singlePatientStatus.evaluation?.overdue?.length || 0}
                  </div>
                  <div className="text-xs text-red-500 mt-0.5">Requires Immediate Catch-up</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                  <div className="text-xs text-amber-600 uppercase font-semibold">Due Now</div>
                  <div className="text-xl font-bold text-amber-700 mt-1">
                    {singlePatientStatus.evaluation?.dueNow?.length || 0}
                  </div>
                  <div className="text-xs text-amber-500 mt-0.5">Current Age Milestone</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
                  <div className="text-xs text-emerald-600 uppercase font-semibold">Completed</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {singlePatientStatus.evaluation?.completedCount || 0}
                  </div>
                  <div className="text-xs text-emerald-500 mt-0.5">Documented Administered</div>
                </div>
              </div>

              {/* Action Banner with WhatsApp Link */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 text-base">
                      Personalized Vaccine Reminder Message
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ready to send directly to parent contact ({singlePatientStatus.phone || 'No phone recorded'})
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        handleCopySms(
                          language === 'hindi'
                            ? singlePatientStatus.hindiReminderText
                            : singlePatientStatus.englishReminderText,
                          patient.id,
                        )
                      }
                      className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 transition-colors flex items-center gap-1.5"
                    >
                      <span>📋</span>
                      <span>{copiedId === patient.id ? 'Copied!' : 'Copy SMS Draft'}</span>
                    </button>

                    <button
                      onClick={() =>
                        handleSendWhatsApp(
                          patient.id,
                          singlePatientStatus.phone,
                          language === 'hindi'
                            ? singlePatientStatus.hindiReminderText
                            : singlePatientStatus.englishReminderText,
                          language === 'hindi'
                            ? singlePatientStatus.hindiWhatsAppLink
                            : singlePatientStatus.englishWhatsAppLink,
                        )
                      }
                      disabled={dispatching === patient.id || !singlePatientStatus.phone}
                      className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <span>💬</span>
                      <span>
                        {dispatching === patient.id ? 'Launching...' : 'Send WhatsApp Reminder'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Message Preview Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                  {language === 'hindi'
                    ? singlePatientStatus.hindiReminderText
                    : singlePatientStatus.englishReminderText}
                </div>
              </div>

              {/* Vaccine Milestone Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800 flex justify-between items-center">
                  <span>Vaccine Milestone Breakdown</span>
                  <span className="text-xs font-normal text-gray-500">
                    Indian Academy of Pediatrics Standard Matrix
                  </span>
                </div>

                <div className="divide-y divide-gray-100 text-sm">
                  {/* Overdue */}
                  {singlePatientStatus.evaluation?.overdue?.map((item: any) => (
                    <div
                      key={item.vaccine.code}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 bg-red-50/40"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{item.vaccine.name}</span>
                          <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">
                            OVERDUE
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Recommended Age: {item.vaccine.labelAge} • Overdue by ~{item.daysOverdueOrDue} days
                        </div>
                      </div>
                      <span className="text-xs font-medium text-red-700">Urgent catch-up dose</span>
                    </div>
                  ))}

                  {/* Due Now */}
                  {singlePatientStatus.evaluation?.dueNow?.map((item: any) => (
                    <div
                      key={item.vaccine.code}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 bg-amber-50/40"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{item.vaccine.name}</span>
                          <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                            DUE NOW
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Milestone Age: {item.vaccine.labelAge} • Current Milestone
                        </div>
                      </div>
                      <span className="text-xs font-medium text-amber-700">Schedule this week</span>
                    </div>
                  ))}

                  {/* Upcoming */}
                  {singlePatientStatus.evaluation?.upcomingNext30d?.map((item: any) => (
                    <div
                      key={item.vaccine.code}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 bg-sky-50/30"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{item.vaccine.name}</span>
                          <span className="text-xs bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded">
                            Upcoming
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Milestone Age: {item.vaccine.labelAge} • Due in ~{item.daysOverdueOrDue} days
                        </div>
                      </div>
                      <span className="text-xs font-medium text-sky-700">Advance notice</span>
                    </div>
                  ))}

                  {singlePatientStatus.evaluation?.overdue?.length === 0 &&
                    singlePatientStatus.evaluation?.dueNow?.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        🎉 All age-appropriate vaccinations are up-to-date!
                      </div>
                    )}
                </div>
              </div>

              {/* Dispatch Logs Table */}
              {dispatchLogs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
                    Communication Dispatch History
                  </div>
                  <div className="divide-y divide-gray-100 text-xs">
                    {dispatchLogs.map((log) => (
                      <div key={log.id} className="p-4 flex justify-between items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800 capitalize">
                              {log.communicationType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 uppercase font-bold">
                              {log.language}
                            </span>
                          </div>
                          <div className="text-gray-500">
                            Sent to: {log.recipientPhone} • Trigger: {log.triggerEvent.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <div className="text-right text-gray-400">
                          <div>{log.createdAt?.replace('T', ' ').substring(0, 16)}</div>
                          <div className="text-[10px]">By: {log.sentByName || 'Staff'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Mode 2: Clinic-wide Recall Roster View */}
      {!patient && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Filter by Status:</span>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterMode === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Defaulters ({recallList.length})
              </button>
              <button
                onClick={() => setFilterMode('overdue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterMode === 'overdue'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Overdue Only (
                {recallList.filter((r) => r.overdue.length > 0).length})
              </button>
              <button
                onClick={() => setFilterMode('due_now')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterMode === 'due_now'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Due Now (
                {recallList.filter((r) => r.dueNow.length > 0).length})
              </button>
            </div>

            <div className="text-xs text-gray-500">
              Showing {recallList.length} pediatric patients with pending vaccines
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Scanning pediatric vaccine schedules...</div>
          ) : recallList.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500 space-y-2">
              <div className="text-3xl">🎉</div>
              <p className="font-semibold text-gray-800">No overdue or pending vaccinations found!</p>
              <p className="text-xs text-gray-400">All registered pediatric patients are up to date.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recallList
                .filter((item) => {
                  if (filterMode === 'overdue') return item.overdue.length > 0;
                  if (filterMode === 'due_now') return item.dueNow.length > 0;
                  return true;
                })
                .map((item) => {
                  const messageText =
                    language === 'hindi' ? item.hindiReminderText : item.englishReminderText;
                  const whatsAppLink =
                    language === 'hindi' ? item.hindiWhatsAppLink : item.englishWhatsAppLink;

                  return (
                    <div
                      key={item.patientId}
                      className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:border-emerald-300 transition-all space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-900 text-base">
                              {item.fullName}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                              #{item.patientNumber}
                            </span>
                            <span className="text-xs text-gray-500">
                              DOB: {item.dateOfBirth} ({item.ageWeeks} weeks old)
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Contact: <strong>{item.phone || 'No phone'}</strong>
                            {item.parentName ? ` (${item.parentName})` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCopySms(messageText, item.patientId)}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 transition-colors"
                          >
                            {copiedId === item.patientId ? 'Copied!' : 'Copy SMS'}
                          </button>

                          <button
                            onClick={() =>
                              handleSendWhatsApp(
                                item.patientId,
                                item.phone,
                                messageText,
                                whatsAppLink,
                              )
                            }
                            disabled={dispatching === item.patientId || !item.phone}
                            className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <span>💬</span>
                            <span>
                              {dispatching === item.patientId ? 'Sending...' : 'WhatsApp'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Items Badges */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        {item.overdue.map((v) => (
                          <span
                            key={v.vaccine.code}
                            className="text-xs px-2.5 py-1 bg-red-100 text-red-800 font-semibold rounded-md flex items-center gap-1"
                          >
                            <span>⚠️</span>
                            <span>{v.vaccine.name} (Overdue ~{v.daysOverdueOrDue}d)</span>
                          </span>
                        ))}
                        {item.dueNow.map((v) => (
                          <span
                            key={v.vaccine.code}
                            className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 font-semibold rounded-md flex items-center gap-1"
                          >
                            <span>⏳</span>
                            <span>{v.vaccine.name} (Due Now)</span>
                          </span>
                        ))}
                        {item.upcomingNext30d.map((v) => (
                          <span
                            key={v.vaccine.code}
                            className="text-xs px-2.5 py-1 bg-sky-50 text-sky-700 rounded-md"
                          >
                            📅 {v.vaccine.name} (Due ~{v.daysOverdueOrDue}d)
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
