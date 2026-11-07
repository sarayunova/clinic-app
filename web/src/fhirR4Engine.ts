/**
 * ABDM & FHIR R4 Clinical Summary Helper
 * Formats, validates and packages FHIR R4 bundles for client display and export.
 */

export interface AbdmPatientProfile {
  id: number;
  patient_id: number;
  abha_number: string;
  abha_address: string;
  status: 'VERIFIED' | 'PENDING_OTP' | 'UNLINKED';
  auth_method: 'AADHAAR_OTP' | 'MOBILE_OTP' | 'DEMOGRAPHIC';
  kyc_full_name?: string;
  kyc_gender?: string;
  kyc_dob?: string;
  kyc_mobile?: string;
  kyc_address?: string;
  linked_at: string;
  updated_at: string;
}

export interface AbdmConsentArtifact {
  id: number;
  patient_id: number;
  consent_id: string;
  purpose_code: string;
  status: 'REQUESTED' | 'GRANTED' | 'DENIED' | 'REVOKED' | 'EXPIRED';
  hi_types: string;
  requester_name: string;
  requester_hip_id: string;
  date_range_from: string;
  date_range_to: string;
  expiry_at: string;
  created_at: string;
}

export interface AbdmFhirBundleRecord {
  id: number;
  patient_id: number;
  bundle_id: string;
  bundle_type: 'OPConsultation' | 'DischargeSummary' | 'ImmunizationRecord' | 'AntenatalRecord';
  bundle_hash: string;
  created_at: string;
  fhir_json?: string;
  fhirObject?: Record<string, unknown>;
}

export function downloadFhirBundleJson(bundleJson: string, bundleId: string) {
  const blob = new Blob([bundleJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fhir-r4-${bundleId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
