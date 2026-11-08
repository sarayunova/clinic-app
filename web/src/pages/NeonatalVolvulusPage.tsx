import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalVolvulusEpisodes, type NeonatalVolvulusRecord } from '../api';

export const NeonatalVolvulusPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalVolvulusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalVolvulusEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load volvulus episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, []);

  const filtered = episodes.filter((ep) => {
    const matchesSearch =
      ep.episode_code.toLowerCase().includes(search.toLowerCase()) ||
      (ep.patient_name && ep.patient_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || ep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const orCrashCount = episodes.filter(e => e.urgency_tier === 'immediate_operating_room_crash').length;
  const laddIndicatedCount = episodes.filter(e => e.ladd_procedure_indicated === 1).length;
  const highLactateCount = episodes.filter(e => e.serum_lactate_mmol_l >= 3.0).length;
  const inOrCount = episodes.filter(e => e.status === 'in_operating_room_ladd').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🌀</span> Neonatal Bilious Emesis & Midgut Volvulus Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP Surgical Protocol: Intestinal Malrotation, UGI Corkscrew Duodenum, Doppler Whirlpool & Emergent Ladd Procedure
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 shadow-sm">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider">Immediate OR Transfer</div>
          <div className="text-2xl font-black text-red-900 mt-1">{orCrashCount}</div>
          <div className="text-[11px] text-red-600 mt-0.5">Crash laparotomy indication</div>
        </div>

        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/70 shadow-sm">
          <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">Ladd Indicated</div>
          <div className="text-2xl font-black text-purple-900 mt-1">{laddIndicatedCount}</div>
          <div className="text-[11px] text-purple-600 mt-0.5">Volvulus detorsion & band lysis</div>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 shadow-sm">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">High Lactate (≥ 3.0)</div>
          <div className="text-2xl font-black text-amber-900 mt-1">{highLactateCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Bowel ischemia alert</div>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 shadow-sm">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">In Operating Room</div>
          <div className="text-2xl font-black text-blue-900 mt-1">{inOrCount}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">Active operative detorsion</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-gray-500 whitespace-nowrap">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1 text-xs bg-gray-50"
          >
            <option value="all">All Statuses</option>
            <option value="emergent_surgical_consult">Emergent Consult</option>
            <option value="in_operating_room_ladd">In Operating Room</option>
            <option value="post_op_bowel_recovery">Post-Op Recovery</option>
            <option value="resolved_feeding_tolerated">Resolved</option>
            <option value="short_bowel_syndrome_care">Short Bowel Care</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full mb-2"></div>
            <p className="text-xs">Loading volvulus episodes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            No volvulus protocol records match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                <tr>
                  <th className="py-2.5 px-4">Episode Code</th>
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Age / Weight</th>
                  <th className="py-2.5 px-4">Emesis Color</th>
                  <th className="py-2.5 px-4">Lactate</th>
                  <th className="py-2.5 px-4">Upper GI / Doppler</th>
                  <th className="py-2.5 px-4">Urgency Tier</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-800">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-red-900">
                      {ep.episode_code}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-900">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline text-indigo-600">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4">
                      Day {ep.age_days} &middot; {ep.weight_kg} kg
                    </td>
                    <td className="py-2.5 px-4 capitalize font-medium">
                      {ep.emesis_color.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-red-700">
                      {ep.serum_lactate_mmol_l} mmol/L
                    </td>
                    <td className="py-2.5 px-4">
                      {ep.upper_gi_finding ? (
                        <span className="font-semibold">{ep.upper_gi_finding.replace(/_/g, ' ')}</span>
                      ) : Boolean(ep.doppler_us_whirlpool_sign) ? (
                        <span className="text-red-700 font-bold">Whirlpool Sign (+)</span>
                      ) : (
                        <span className="text-gray-500">Plain film only</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          ep.urgency_tier === 'immediate_operating_room_crash'
                            ? 'bg-red-600 text-white'
                            : ep.urgency_tier === 'emergent_imaging_workup'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {ep.urgency_tier.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_volvulus`}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold"
                      >
                        Open Chart
                      </Link>
                      <a
                        href={`#/print/neonatal-volvulus/${ep.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-medium"
                      >
                        🖨️ Dossier
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
