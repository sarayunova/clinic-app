import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Ctx } from '../app.js';
import { requirePerm, requireUser } from '../app.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { badRequest, notFound, forbidden } from '../errors.js';
import { nowIso } from '../time.js';
import { tx } from '../db.js';
import { generateFhirR4Bundle, type PatientDemographics, type DoctorDetails, type ClinicalEncounterData } from '../fhirR4Engine.js';

const AbhaLinkSchema = z.object({
  abhaNumber: z.string().min(14).max(18),
  abhaAddress: z.string().min(3).max(100),
  authMethod: z.enum(['AADHAAR_OTP', 'MOBILE_OTP', 'DEMOGRAPHIC']).default('AADHAAR_OTP'),
  kycFullName: z.string().optional().nullable(),
  kycGender: z.string().optional().nullable(),
  kycDob: z.string().optional().nullable(),
  kycMobile: z.string().optional().nullable(),
  kycAddress: z.string().optional().nullable(),
});

const ConsentArtifactSchema = z.object({
  patientId: z.number().int().positive(),
  purposeCode: z.enum(['CARETREE', 'PATRQT', 'PUBHLTH']).default('CARETREE'),
  hiTypes: z.string().default('OPConsultation,DischargeSummary,ImmunizationRecord'),
  requesterName: z.string().min(2),
  requesterHipId: z.string().min(2),
  dateRangeFrom: z.string().min(10),
  dateRangeTo: z.string().min(10),
  expiryAt: z.string().min(10),
});

function getClinicSettings(ctx: Ctx): Record<string, string> {
  const rows = ctx.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export function registerAbdmRoutes(app: FastifyInstance, ctx: Ctx) {
  // 1. Get Patient ABDM / ABHA Profile and Records
  app.get<{ Params: { patientId: string } }>('/api/abdm/patient/:patientId', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const profile = ctx.db.prepare('SELECT * FROM abdm_patient_profiles WHERE patient_id = ?').get(patientId);
    const consents = ctx.db.prepare('SELECT * FROM abdm_consent_artifacts WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
    const fhirBundles = ctx.db.prepare('SELECT id, patient_id, bundle_id, bundle_type, bundle_hash, created_at FROM abdm_fhir_bundles WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);

    return {
      profile: profile ?? null,
      consents,
      fhirBundles,
    };
  });

  // 2. Link / Update ABHA Profile
  app.post<{ Params: { patientId: string } }>('/api/abdm/patient/:patientId/link', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk staff cannot manage ABDM health IDs');
    }

    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const parsed = AbhaLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    // Format ABHA number as XX-XXXX-XXXX-XXXX if not already formatted
    const rawDigits = data.abhaNumber.replace(/\D/g, '');
    let formattedAbha = data.abhaNumber;
    if (rawDigits.length === 14) {
      formattedAbha = `${rawDigits.slice(0, 2)}-${rawDigits.slice(2, 6)}-${rawDigits.slice(6, 10)}-${rawDigits.slice(10, 14)}`;
    }

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          INSERT INTO abdm_patient_profiles (
            patient_id, abha_number, abha_address, status, auth_method,
            kyc_full_name, kyc_gender, kyc_dob, kyc_mobile, kyc_address,
            linked_at, updated_at
          ) VALUES (?, ?, ?, 'VERIFIED', ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(patient_id) DO UPDATE SET
            abha_number = excluded.abha_number,
            abha_address = excluded.abha_address,
            status = 'VERIFIED',
            auth_method = excluded.auth_method,
            kyc_full_name = excluded.kyc_full_name,
            kyc_gender = excluded.kyc_gender,
            kyc_dob = excluded.kyc_dob,
            kyc_mobile = excluded.kyc_mobile,
            kyc_address = excluded.kyc_address,
            updated_at = excluded.updated_at
        `)
        .run(
          patientId,
          formattedAbha,
          data.abhaAddress,
          data.authMethod,
          data.kycFullName ?? patient.full_name,
          data.kycGender ?? 'Female',
          data.kycDob ?? patient.date_of_birth,
          data.kycMobile ?? patient.phone,
          data.kycAddress ?? patient.address,
          nowIso(),
          nowIso(),
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'abdm.profile_link',
        entity: 'abdm_patient_profiles',
        entityId: patientId,
        detail: { abhaNumber: formattedAbha, abhaAddress: data.abhaAddress },
      });
    });

    const updated = ctx.db.prepare('SELECT * FROM abdm_patient_profiles WHERE patient_id = ?').get(patientId);
    return updated;
  });

  // 3. Mock Aadhaar OTP Verification & Auto-Generation for Sandbox Demo
  app.post<{ Params: { patientId: string } }>('/api/abdm/patient/:patientId/mock-aadhaar-verify', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk staff cannot perform ABDM verification');
    }

    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    // Generate random 14-digit ABHA number: 91-XXXX-XXXX-XXXX
    const random12 = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const mockAbhaNumber = `91-${random12.slice(0, 4)}-${random12.slice(4, 8)}-${random12.slice(8, 12)}`;
    const usernameSlug = patient.full_name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'patient';
    const mockAbhaAddress = `${usernameSlug}${patient.id}@abdm`;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          INSERT INTO abdm_patient_profiles (
            patient_id, abha_number, abha_address, status, auth_method,
            kyc_full_name, kyc_gender, kyc_dob, kyc_mobile, kyc_address,
            linked_at, updated_at
          ) VALUES (?, ?, ?, 'VERIFIED', 'AADHAAR_OTP', ?, 'Female', ?, ?, ?, ?, ?)
          ON CONFLICT(patient_id) DO UPDATE SET
            abha_number = excluded.abha_number,
            abha_address = excluded.abha_address,
            status = 'VERIFIED',
            auth_method = 'AADHAAR_OTP',
            kyc_full_name = excluded.kyc_full_name,
            kyc_dob = excluded.kyc_dob,
            kyc_mobile = excluded.kyc_mobile,
            kyc_address = excluded.kyc_address,
            updated_at = excluded.updated_at
        `)
        .run(
          patientId,
          mockAbhaNumber,
          mockAbhaAddress,
          patient.full_name,
          patient.date_of_birth,
          patient.phone,
          patient.address,
          nowIso(),
          nowIso(),
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'abdm.profile_link',
        entity: 'abdm_patient_profiles',
        entityId: patientId,
        detail: { abhaNumber: mockAbhaNumber, mockAadhaarVerified: true },
      });
    });

    const verifiedProfile = ctx.db.prepare('SELECT * FROM abdm_patient_profiles WHERE patient_id = ?').get(patientId);
    return verifiedProfile;
  });

  // 4. Unlink ABHA Profile
  app.delete<{ Params: { patientId: string } }>('/api/abdm/patient/:patientId/unlink', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'user:manage')) {
      throw forbidden('Only senior clinical staff can unlink ABHA profiles');
    }

    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    tx(ctx.db, () => {
      ctx.db.prepare('DELETE FROM abdm_patient_profiles WHERE patient_id = ?').run(patientId);

      audit(ctx.db, {
        actorId: user.id,
        action: 'abdm.profile_unlink',
        entity: 'abdm_patient_profiles',
        entityId: patientId,
      });
    });

    return { success: true, message: 'ABHA profile unlinked successfully' };
  });

  // 5. Generate Standard FHIR R4 Bundle
  app.post<{ Params: { patientId: string }; Body: { bundleType: 'OPConsultation' | 'DischargeSummary' | 'ImmunizationRecord' | 'AntenatalRecord'; visitId?: number; admissionId?: number } }>('/api/abdm/patient/:patientId/generate-fhir', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:read_clinical')) {
      throw forbidden('Desk staff cannot export clinical FHIR bundles');
    }

    const patientId = Number.parseInt(req.params.patientId, 10);
    if (Number.isNaN(patientId)) throw badRequest('Invalid patient ID');

    const patient: any = ctx.db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
    if (!patient) throw notFound('Patient not found');

    const abhaProfile: any = ctx.db.prepare('SELECT * FROM abdm_patient_profiles WHERE patient_id = ?').get(patientId);
    const settings = getClinicSettings(ctx);
    const clinicName = settings.clinicName ?? 'LiVi Clinic';

    const patientDemo: PatientDemographics = {
      id: patient.id,
      uhid: patient.patient_number,
      fullName: patient.full_name,
      ageYears: patient.estimated_age_years ?? undefined,
      phone: patient.phone ?? undefined,
      address: patient.address ?? undefined,
      abhaNumber: abhaProfile?.abha_number,
      abhaAddress: abhaProfile?.abha_address,
      gravida: patient.gravida ?? undefined,
      para: patient.para ?? undefined,
      lastMenstrualPeriod: patient.last_menstrual_period ?? undefined,
    };

    const doctor: DoctorDetails = {
      id: user.id,
      name: user.fullName,
      qualification: settings.doctorQualifications ?? 'MBBS, MS (OBGYN)',
      registrationNumber: settings.doctorRegNo ?? settings.doctorRegNumber ?? 'REG-NMC-88421',
      council: 'State Medical Council',
    };

    const bundleType = req.body?.bundleType ?? 'OPConsultation';

    // Retrieve live patient records based on bundleType
    let encounterData: ClinicalEncounterData = {
      encounterId: `enc-${Date.now()}`,
      type: bundleType,
      visitDate: nowIso(),
    };

    if (bundleType === 'ImmunizationRecord') {
      const immRows = ctx.db
        .prepare(`
          SELECT * FROM vaccinations
          WHERE patient_id = ?
          ORDER BY administered_date DESC
        `)
        .all(patientId) as any[];

      encounterData.immunizations = immRows.map((r) => ({
        vaccineName: r.vaccine_name,
        doseNumber: r.dose_number ?? 1,
        administeredDate: r.administered_date || nowIso(),
        lotNumber: r.lot_number ?? undefined,
        site: r.site ?? undefined,
      }));
    } else {
      // OP Consultation or Antenatal Record
      const latestVisit: any = ctx.db
        .prepare(`
          SELECT * FROM visits
          WHERE patient_id = ?
          ORDER BY visit_at DESC LIMIT 1
        `)
        .get(patientId);

      if (latestVisit) {
        encounterData.encounterId = latestVisit.id;
        encounterData.visitDate = latestVisit.visit_at;
        encounterData.chiefComplaint = latestVisit.chief_complaint ?? undefined;
        encounterData.diagnosis = latestVisit.diagnosis ?? undefined;
        encounterData.notes = latestVisit.clinical_notes ?? undefined;

        const latestVitals: any = ctx.db
          .prepare(`
            SELECT * FROM visit_vitals
            WHERE visit_id = ?
            ORDER BY recorded_at DESC LIMIT 1
          `)
          .get(latestVisit.id);

        if (latestVitals) {
          encounterData.vitals = {
            systolicBp: latestVitals.systolic_mmhg ?? undefined,
            diastolicBp: latestVitals.diastolic_mmhg ?? undefined,
            heartRate: latestVitals.pulse_bpm ?? undefined,
            temperatureCelsius: latestVitals.temperature_c ?? undefined,
          };
        }
      }
    }

    const bundleResult = generateFhirR4Bundle(patientDemo, doctor, encounterData, clinicName);

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          INSERT INTO abdm_fhir_bundles (
            patient_id, bundle_id, bundle_type, fhir_json, bundle_hash, exported_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          patientId,
          bundleResult.bundleId,
          bundleType,
          bundleResult.bundleJson,
          bundleResult.bundleHash,
          user.id,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'abdm.fhir_export',
        entity: 'abdm_fhir_bundles',
        entityId: bundleResult.bundleId,
        detail: { bundleType, bundleHash: bundleResult.bundleHash },
      });
    });

    return bundleResult;
  });

  // 6. Get Single FHIR Bundle
  app.get<{ Params: { id: string } }>('/api/abdm/fhir-bundle/:id', async (req) => {
    requirePerm(req, 'patient:read_clinical');

    const id = req.params.id;
    const bundle: any = ctx.db.prepare('SELECT * FROM abdm_fhir_bundles WHERE id = ? OR bundle_id = ?').get(id, id);
    if (!bundle) throw notFound('FHIR Bundle not found');

    return {
      ...bundle,
      fhirObject: JSON.parse(bundle.fhir_json),
    };
  });

  // 7. Register Consent Artifact
  app.post('/api/abdm/consent', async (req: FastifyRequest) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk staff cannot record ABDM consent artifacts');
    }

    const parsed = ConsentArtifactSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Validation failed: ' + JSON.stringify(parsed.error.format()));
    }

    const data = parsed.data;
    const consentId = `consent-${crypto.randomUUID()}`;

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          INSERT INTO abdm_consent_artifacts (
            patient_id, consent_id, purpose_code, status, hi_types,
            requester_name, requester_hip_id, date_range_from, date_range_to, expiry_at
          ) VALUES (?, ?, ?, 'GRANTED', ?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.patientId,
          consentId,
          data.purposeCode,
          data.hiTypes,
          data.requesterName,
          data.requesterHipId,
          data.dateRangeFrom,
          data.dateRangeTo,
          data.expiryAt,
        );

      audit(ctx.db, {
        actorId: user.id,
        action: 'abdm.consent_record',
        entity: 'abdm_consent_artifacts',
        entityId: consentId,
        detail: { patientId: data.patientId, status: 'GRANTED', requester: data.requesterName },
      });
    });

    const record = ctx.db.prepare('SELECT * FROM abdm_consent_artifacts WHERE consent_id = ?').get(consentId);
    return record;
  });

  // 8. Revoke Consent Artifact
  app.post<{ Params: { id: string } }>('/api/abdm/consent/:id/revoke', async (req) => {
    const user = requireUser(req);
    if (!can(user.role, 'patient:write_clinical') && !can(user.role, 'care:write_nursing')) {
      throw forbidden('Desk staff cannot revoke ABDM consent');
    }

    const id = req.params.id;
    const existing: any = ctx.db.prepare('SELECT * FROM abdm_consent_artifacts WHERE id = ? OR consent_id = ?').get(id, id);
    if (!existing) throw notFound('Consent artifact not found');

    tx(ctx.db, () => {
      ctx.db
        .prepare(`
          UPDATE abdm_consent_artifacts
          SET status = 'REVOKED'
          WHERE id = ?
        `)
        .run(existing.id);

      audit(ctx.db, {
        actorId: user.id,
        action: 'abdm.consent_record',
        entity: 'abdm_consent_artifacts',
        entityId: existing.consent_id,
        detail: { status: 'REVOKED' },
      });
    });

    return { success: true, message: 'Consent artifact revoked' };
  });
}
