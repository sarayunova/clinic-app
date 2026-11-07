import React, { useEffect, useState } from 'react';
import {
  getAbdmPatientData,
  linkAbhaProfile,
  mockAadhaarVerifyAbha,
  unlinkAbhaProfile,
  generateFhirBundle,
  createAbdmConsent,
  revokeAbdmConsent,
} from '../api';
import { downloadFhirBundleJson } from '../fhirR4Engine';
import { generateQrSvgDataUri } from '../qrSvg';

export function AbdmProfileTab({ patientId }: { patientId: number }) {
  const [profile, setProfile] = useState<any | null>(null);
  const [consents, setConsents] = useState<any[]>([]);
  const [fhirBundles, setFhirBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Link Form State
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [abhaNumberInput, setAbhaNumberInput] = useState('');
  const [abhaAddressInput, setAbhaAddressInput] = useState('');
  const [linking, setLinking] = useState(false);

  // FHIR Generation State
  const [selectedBundleType, setSelectedBundleType] = useState<
    'OPConsultation' | 'AntenatalRecord' | 'DischargeSummary' | 'ImmunizationRecord'
  >('OPConsultation');
  const [generatingFhir, setGeneratingFhir] = useState(false);
  const [latestGeneratedJson, setLatestGeneratedJson] = useState<string | null>(null);
  const [latestGeneratedHash, setLatestGeneratedHash] = useState<string | null>(null);
  const [latestGeneratedBundleId, setLatestGeneratedBundleId] = useState<string | null>(null);

  // Consent Form State
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentRequester, setConsentRequester] = useState('');
  const [consentHipId, setConsentHipId] = useState('HIP-DISTRICT-HOSP-01');
  const [consentSaving, setConsentSaving] = useState(false);

  const fetchAbdmData = async () => {
    try {
      const res = await getAbdmPatientData(patientId);
      setProfile(res.profile);
      setConsents(res.consents);
      setFhirBundles(res.fhirBundles);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load ABDM data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAbdmData();
  }, [patientId]);

  const handleManualLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abhaNumberInput.trim() || !abhaAddressInput.trim()) return;
    setLinking(true);
    try {
      await linkAbhaProfile(patientId, {
        abhaNumber: abhaNumberInput.trim(),
        abhaAddress: abhaAddressInput.trim(),
      });
      setShowLinkForm(false);
      await fetchAbdmData();
    } catch (err: any) {
      alert(err?.message || 'Error linking ABHA credentials');
    } finally {
      setLinking(false);
    }
  };

  const handleMockAadhaarVerify = async () => {
    setLinking(true);
    try {
      await mockAadhaarVerifyAbha(patientId);
      await fetchAbdmData();
      alert('Aadhaar OTP verified successfully! Verified ABHA credentials issued.');
    } catch (err: any) {
      alert(err?.message || 'Error verifying Aadhaar');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink the ABHA profile for this patient?')) return;
    try {
      await unlinkAbhaProfile(patientId);
      await fetchAbdmData();
    } catch (err: any) {
      alert(err?.message || 'Error unlinking ABHA');
    }
  };

  const handleGenerateFhir = async () => {
    setGeneratingFhir(true);
    try {
      const res = await generateFhirBundle(patientId, {
        bundleType: selectedBundleType,
      });
      setLatestGeneratedJson(res.bundleJson);
      setLatestGeneratedHash(res.bundleHash);
      setLatestGeneratedBundleId(res.bundleId);
      await fetchAbdmData();
    } catch (err: any) {
      alert(err?.message || 'Error generating FHIR bundle');
    } finally {
      setGeneratingFhir(false);
    }
  };

  const handleCreateConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentRequester.trim()) return;
    setConsentSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      await createAbdmConsent({
        patientId,
        purposeCode: 'CARETREE',
        hiTypes: 'OPConsultation,DischargeSummary,ImmunizationRecord',
        requesterName: consentRequester.trim(),
        requesterHipId: consentHipId.trim(),
        dateRangeFrom: today,
        dateRangeTo: nextYear,
        expiryAt: nextYear,
      });
      setShowConsentModal(false);
      setConsentRequester('');
      await fetchAbdmData();
    } catch (err: any) {
      alert(err?.message || 'Error creating consent artifact');
    } finally {
      setConsentSaving(false);
    }
  };

  const handleRevokeConsent = async (consentId: string) => {
    if (!confirm('Revoke this ABDM consent artifact?')) return;
    try {
      await revokeAbdmConsent(consentId);
      await fetchAbdmData();
    } catch (err: any) {
      alert(err?.message || 'Error revoking consent');
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-slate-400">Loading ABDM records...</div>;
  }

  // Generate QR for ABHA Card if linked
  const abhaQrUri = profile?.abha_number
    ? generateQrSvgDataUri(`https://healthid.ndhm.gov.in/${profile.abha_number}`, 100)
    : null;

  return (
    <div className="space-y-6">
      {/* ABDM Profile Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-800">Ayushman Bharat Digital Mission (ABDM)</span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                ABHA & FHIR R4
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              National Health Authority (NHA) unified health identifier, patient consent & interoperable health record bridge.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!profile && (
              <>
                <button
                  type="button"
                  onClick={handleMockAadhaarVerify}
                  disabled={linking}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                  title="Generate instant verified ABHA profile via simulated Aadhaar OTP"
                >
                  ⚡ Instant Demo Aadhaar OTP
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkForm(!showLinkForm)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900"
                >
                  {showLinkForm ? 'Cancel' : '+ Manual Link ABHA'}
                </button>
              </>
            )}

            {profile && (
              <button
                type="button"
                onClick={handleUnlink}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
              >
                Unlink ABHA
              </button>
            )}
          </div>
        </div>

        {error && <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}

        {/* Manual Link Form */}
        {showLinkForm && !profile && (
          <form onSubmit={handleManualLink} className="mt-4 p-4 bg-slate-50 border rounded-xl space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-700">Link Existing ABHA Credentials</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">14-Digit ABHA Number</label>
                <input
                  type="text"
                  value={abhaNumberInput}
                  onChange={(e) => setAbhaNumberInput(e.target.value)}
                  placeholder="e.g. 14-1234-5678-9012"
                  className="w-full text-xs p-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ABHA Address (PHR Handle)</label>
                <input
                  type="text"
                  value={abhaAddressInput}
                  onChange={(e) => setAbhaAddressInput(e.target.value)}
                  placeholder="e.g. patient@abdm"
                  className="w-full text-xs p-2 border rounded-lg"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={linking}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {linking ? 'Linking...' : 'Verify & Link'}
              </button>
            </div>
          </form>
        )}

        {/* Official ABHA Card Presentation */}
        {profile ? (
          <div className="mt-5 max-w-md mx-auto bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden border-2 border-amber-300">
            {/* Top Tricolor Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 flex">
              <div className="w-1/3 bg-orange-500"></div>
              <div className="w-1/3 bg-white"></div>
              <div className="w-1/3 bg-green-600"></div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div className="text-[11px] font-bold tracking-widest text-amber-200 uppercase">
                NATIONAL HEALTH AUTHORITY
              </div>
              <div className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-emerald-800">
                ABHA VERIFIED
              </div>
            </div>

            <div className="my-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-emerald-100 font-medium">ABHA Number</div>
                <div className="font-mono text-xl font-black tracking-wider text-white">
                  {profile.abha_number}
                </div>

                <div className="text-xs text-emerald-100 font-medium mt-2">ABHA Address</div>
                <div className="text-sm font-bold text-amber-200">{profile.abha_address}</div>

                <div className="text-xs text-white/90 mt-2">
                  <strong>Name:</strong> {profile.kyc_full_name || 'Verified Patient'}
                </div>
              </div>

              {abhaQrUri && (
                <div className="bg-white p-1 rounded-lg shrink-0">
                  <img src={abhaQrUri} alt="ABHA QR Code" className="w-16 h-16" />
                </div>
              )}
            </div>

            <div className="border-t border-emerald-600/60 pt-2 flex justify-between text-[10px] text-emerald-200">
              <span>Auth: {profile.auth_method}</span>
              <span>Linked: {new Date(profile.linked_at).toLocaleDateString('en-IN')}</span>
            </div>
          </div>
        ) : (
          !showLinkForm && (
            <div className="mt-5 p-6 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 space-y-2">
              <div className="text-3xl">🆔</div>
              <div className="font-bold text-slate-700">No ABHA Health ID Linked</div>
              <p className="text-xs max-w-sm mx-auto">
                Link the patient&apos;s Ayushman Bharat Health Account (ABHA) to enable digital health records sharing and ABDM compliance.
              </p>
            </div>
          )
        )}
      </div>

      {/* FHIR R4 Clinical Summary Bundle Engine */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">FHIR R4 Clinical Information Exporter</h3>
            <p className="text-xs text-slate-500">
              Generate standardized HL7 FHIR R4 Document Bundles compliant with NRCES / NDHM profiles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedBundleType}
              onChange={(e) => setSelectedBundleType(e.target.value as any)}
              className="rounded-lg border-slate-300 text-xs p-2 border font-medium text-slate-700"
            >
              <option value="OPConsultation">OP Consultation Record</option>
              <option value="AntenatalRecord">Antenatal Surveillance Record</option>
              <option value="DischargeSummary">Inpatient Discharge Summary</option>
              <option value="ImmunizationRecord">Immunization Record</option>
            </select>

            <button
              type="button"
              onClick={handleGenerateFhir}
              disabled={generatingFhir}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {generatingFhir ? 'Generating...' : '⚡ Generate FHIR Bundle'}
            </button>
          </div>
        </div>

        {/* Display Recently Generated Bundle */}
        {latestGeneratedJson && (
          <div className="space-y-3 border border-emerald-200 rounded-xl p-4 bg-emerald-50/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-800">Bundle ID:</span>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-slate-700">
                  {latestGeneratedBundleId}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadFhirBundleJson(latestGeneratedJson, latestGeneratedBundleId || 'bundle')}
                  className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  📥 Download .json
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(latestGeneratedJson);
                    alert('FHIR R4 JSON copied to clipboard!');
                  }}
                  className="px-3 py-1 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900"
                >
                  📋 Copy JSON
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 flex items-center gap-2">
              <span>SHA-256 Digest:</span>
              <span className="font-mono text-emerald-800 font-semibold">{latestGeneratedHash}</span>
            </div>

            {/* Scrollable JSON View */}
            <div className="max-h-60 overflow-y-auto bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono">
              <pre>{latestGeneratedJson}</pre>
            </div>
          </div>
        )}

        {/* Generated Bundles History */}
        {fhirBundles.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Exported Bundles History</h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {fhirBundles.map((b) => (
                <div key={b.id} className="p-3 bg-white flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{b.bundle_type}</span>
                    <span className="text-slate-400 ml-2">({new Date(b.created_at).toLocaleString('en-IN')})</span>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      Hash: {b.bundle_hash.slice(0, 16)}...
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    Compliant
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ABDM Consent Artifacts Registry */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">ABDM Consent Management</h3>
            <p className="text-xs text-slate-500">
              HIP/HIU Patient Consent Artifacts for legal sharing of clinical health records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowConsentModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900"
          >
            + Register Consent Artifact
          </button>
        </div>

        {consents.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs italic">
            No ABDM consent artifacts currently registered for this patient.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
                <tr>
                  <th className="p-2">Requester / HIP</th>
                  <th className="p-2">Purpose</th>
                  <th className="p-2">Health Info Types</th>
                  <th className="p-2">Valid Until</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consents.map((c) => (
                  <tr key={c.id}>
                    <td className="p-2 font-bold text-slate-800">
                      {c.requester_name}
                      <div className="text-[10px] text-slate-500 font-normal">{c.requester_hip_id}</div>
                    </td>
                    <td className="p-2">{c.purpose_code}</td>
                    <td className="p-2 text-slate-600">{c.hi_types}</td>
                    <td className="p-2">{c.expiry_at}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'GRANTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'REVOKED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {c.status === 'GRANTED' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeConsent(c.consent_id)}
                          className="px-2 py-0.5 text-[10px] rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-800">Register ABDM Consent Artifact</h2>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateConsent} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requester Hospital / Clinic</label>
                <input
                  type="text"
                  value={consentRequester}
                  onChange={(e) => setConsentRequester(e.target.value)}
                  placeholder="e.g. Apollo Cradle Hospital"
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requester HIP ID</label>
                <input
                  type="text"
                  value={consentHipId}
                  onChange={(e) => setConsentHipId(e.target.value)}
                  placeholder="e.g. HIP-APOLLO-001"
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowConsentModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consentSaving}
                  className="px-4 py-1.5 font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {consentSaving ? 'Registering...' : 'Grant Consent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
