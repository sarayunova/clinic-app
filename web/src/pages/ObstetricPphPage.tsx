import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getObstetricPphEpisodes,
  updateObstetricPphEpisode,
  type ObstetricPphRecord,
} from '../api';

export const ObstetricPphPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricPphRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getObstetricPphEpisodes({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load obstetric PPH records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  const handleUpdateStatus = async (id: number, newStatus: any) => {
    try {
      await updateObstetricPphEpisode(id, { status: newStatus });
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 via-rose-800 to-amber-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
            <span>Labor & Delivery / HDU Acute Hemorrhage Registry</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Postpartum Hemorrhage (PPH) & WHO E-MOTIVE Console
          </h1>
          <p className="text-rose-100 mt-2 max-w-2xl text-sm leading-relaxed">
            Calibrated drape & gravimetric Quantitative Blood Loss (QBL), Obstetric Shock Index surveillance, WHO E-MOTIVE first-response package, and Bakri balloon tamponade stewardship.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[180px]">
          <span className="text-xs uppercase tracking-wider text-rose-200 font-bold block">
            Active Hemorrhage Episodes
          </span>
          <span className="text-3xl font-black mt-1 block">
            {episodes.filter((e) => e.status !== 'resolved').length}
          </span>
          <span className="text-[11px] text-rose-100">Patients on active resuscitation</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border rounded-lg px-2.5 py-1.5 bg-gray-50 font-medium"
          >
            <option value="all">All Episodes ({episodes.length})</option>
            <option value="resuscitation_active">Resuscitation Active</option>
            <option value="tamponade_active">Bakri Tamponade Active</option>
            <option value="stabilized">Stabilized</option>
            <option value="surgical_escalation">Surgical Escalation</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <button
          onClick={fetchEpisodes}
          className="px-3 py-1.5 border rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Refresh Registry
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-500">Loading episodes...</div>
      ) : episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
          <p className="text-sm text-gray-600">No PPH resuscitation episodes matching this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-red-800 bg-red-50 px-2.5 py-1 rounded-md">
                      {ep.episode_code}
                    </span>
                    <div className="text-[11px] text-gray-500 mt-1 uppercase font-semibold">
                      {ep.delivery_mode} Delivery {ep.gestation_weeks ? `(${ep.gestation_weeks}w)` : ''}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                      ep.status === 'resuscitation_active'
                        ? 'bg-red-100 text-red-800'
                        : ep.status === 'tamponade_active'
                        ? 'bg-purple-100 text-purple-800'
                        : ep.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ep.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Total QBL</span>
                    <span className="font-extrabold text-red-900 text-base">
                      {ep.gravimetric_qbl_ml} mL
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      Drape: {ep.drape_blood_volume_ml} mL | Sponge: {ep.swab_sponge_weight_net_g}g
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Shock Index</span>
                    <span
                      className={`font-extrabold text-base ${
                        ep.shock_index >= 1.0 ? 'text-red-700' : ep.shock_index >= 0.9 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {ep.shock_index}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      BP: {ep.initial_sbp}/{ep.initial_dbp} | HR: {ep.initial_heart_rate}
                    </span>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-500">4T Etiology:</span>
                    <span className="font-semibold capitalize">{ep.etiology_4t.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">E-MOTIVE Package:</span>
                    <span className="font-medium text-emerald-700">
                      {[
                        ep.emotive_massage_done && 'M',
                        ep.emotive_oxytocin_given && 'O',
                        ep.emotive_txa_given && 'T',
                        ep.emotive_iv_fluids_given && 'I',
                        ep.emotive_exam_completed && 'V',
                        ep.emotive_escalation_needed && 'E',
                      ]
                        .filter(Boolean)
                        .join('-') || 'Initiated'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bakri Balloon:</span>
                    <span className="font-medium text-purple-900">
                      {ep.bakri_balloon_placed ? `${ep.bakri_fill_volume_ml} mL Saline` : 'Not Placed'}
                    </span>
                  </div>
                </div>

                {ep.clinical_notes && (
                  <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50/80 p-2 rounded border border-gray-100">
                    {ep.clinical_notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t flex justify-between items-center gap-2">
                <Link
                  to={`/patients/${ep.patient_id}?tab=obstetric_pph`}
                  className="text-xs font-bold text-red-600 hover:text-red-800"
                >
                  Open Chart &rarr;
                </Link>
                <div className="flex items-center gap-2">
                  <a
                    href={`/obstetric-pph/${ep.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Print
                  </a>
                  <select
                    value={ep.status}
                    onChange={(e) => handleUpdateStatus(ep.id, e.target.value)}
                    className="text-[11px] font-semibold border rounded px-1.5 py-0.5 bg-gray-50"
                  >
                    <option value="resuscitation_active">Active</option>
                    <option value="tamponade_active">Tamponade</option>
                    <option value="stabilized">Stabilized</option>
                    <option value="surgical_escalation">OT Escalation</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
