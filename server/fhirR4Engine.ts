import crypto from 'node:crypto';

export interface PatientDemographics {
  id: number;
  uhid: string;
  fullName: string;
  ageYears?: number;
  gender?: string;
  phone?: string;
  address?: string;
  abhaNumber?: string;
  abhaAddress?: string;
  gravida?: number;
  para?: number;
  lastMenstrualPeriod?: string;
  expectedDateOfDelivery?: string;
}

export interface DoctorDetails {
  id: number;
  name: string;
  qualification?: string;
  registrationNumber?: string;
  council?: string;
}

export interface ClinicalEncounterData {
  encounterId: number | string;
  type: 'OPConsultation' | 'DischargeSummary' | 'ImmunizationRecord' | 'AntenatalRecord';
  visitDate: string;
  chiefComplaint?: string;
  diagnosis?: string;
  notes?: string;
  vitals?: {
    systolicBp?: number;
    diastolicBp?: number;
    heartRate?: number;
    respiratoryRate?: number;
    temperatureCelsius?: number;
    spo2?: number;
    fetalHeartRate?: number;
    fundalHeightCm?: number;
    downesScore?: number;
    silvermanScore?: number;
  };
  medicines?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  immunizations?: Array<{
    vaccineName: string;
    doseNumber?: number;
    administeredDate: string;
    lotNumber?: string;
    site?: string;
  }>;
}

export interface FhirBundleOutput {
  bundleId: string;
  bundleJson: string;
  bundleHash: string;
  fhirObject: Record<string, unknown>;
}

export function generateFhirR4Bundle(
  patient: PatientDemographics,
  doctor: DoctorDetails,
  encounter: ClinicalEncounterData,
  clinicName: string = 'LiVi Clinic for Women & Children'
): FhirBundleOutput {
  const bundleId = `urn:uuid:${crypto.randomUUID()}`;
  const compositionId = `urn:uuid:${crypto.randomUUID()}`;
  const patientResId = `urn:uuid:${crypto.randomUUID()}`;
  const practitionerResId = `urn:uuid:${crypto.randomUUID()}`;
  const encounterResId = `urn:uuid:${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();

  const entries: Array<{ fullUrl: string; resource: Record<string, unknown> }> = [];

  // 1. Patient Resource
  const patientResource: Record<string, unknown> = {
    resourceType: 'Patient',
    id: patientResId.replace('urn:uuid:', ''),
    meta: {
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient']
    },
    identifier: [
      {
        system: 'https://healthid.ndhm.gov.in',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'Medical Record Number' }] },
        value: patient.uhid
      }
    ],
    name: [
      {
        text: patient.fullName
      }
    ],
    telecom: patient.phone ? [{ system: 'phone', value: patient.phone, use: 'mobile' }] : undefined,
    gender: (patient.gender?.toLowerCase() === 'male' || patient.gender?.toLowerCase() === 'boy') ? 'male' : 'female'
  };

  if (patient.abhaNumber) {
    (patientResource.identifier as Array<Record<string, unknown>>).push({
      system: 'https://ndhm.in/abha-number',
      type: { coding: [{ system: 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code', code: 'ABHA', display: 'Ayushman Bharat Health Account' }] },
      value: patient.abhaNumber
    });
  }

  if (patient.abhaAddress) {
    (patientResource.identifier as Array<Record<string, unknown>>).push({
      system: 'https://ndhm.in/abha-address',
      value: patient.abhaAddress
    });
  }

  // 2. Practitioner Resource
  const practitionerResource: Record<string, unknown> = {
    resourceType: 'Practitioner',
    id: practitionerResId.replace('urn:uuid:', ''),
    meta: {
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner']
    },
    identifier: [
      {
        system: 'https://doctor.ndhm.gov.in',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MD', display: 'Medical License Number' }] },
        value: doctor.registrationNumber ?? 'REG-NMC-DEFAULT'
      }
    ],
    name: [
      {
        text: doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`
      }
    ],
    qualification: doctor.qualification
      ? [{ code: { coding: [{ system: 'http://snomed.info/sct', display: doctor.qualification }] }, text: doctor.qualification }]
      : undefined
  };

  // 3. Encounter Resource
  const encounterResource: Record<string, unknown> = {
    resourceType: 'Encounter',
    id: encounterResId.replace('urn:uuid:', ''),
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounter.type === 'DischargeSummary' ? 'IMP' : 'AMB',
      display: encounter.type === 'DischargeSummary' ? 'inpatient encounter' : 'ambulatory'
    },
    subject: { reference: patientResId, display: patient.fullName },
    participant: [
      {
        individual: { reference: practitionerResId, display: doctor.name }
      }
    ],
    period: {
      start: encounter.visitDate
    }
  };

  const sectionEntries: Array<{ reference: string; display: string }> = [];

  // 4. Condition Resource (Diagnosis)
  if (encounter.diagnosis || encounter.chiefComplaint) {
    const conditionResId = `urn:uuid:${crypto.randomUUID()}`;
    const conditionResource: Record<string, unknown> = {
      resourceType: 'Condition',
      id: conditionResId.replace('urn:uuid:', ''),
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }]
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }]
      },
      code: {
        text: encounter.diagnosis || encounter.chiefComplaint
      },
      subject: { reference: patientResId },
      encounter: { reference: encounterResId }
    };
    entries.push({ fullUrl: conditionResId, resource: conditionResource });
    sectionEntries.push({ reference: conditionResId, display: 'Chief Complaint / Diagnosis' });
  }

  // 5. Observations (Vitals / Obstetric Parameters)
  if (encounter.vitals) {
    const v = encounter.vitals;
    if (v.systolicBp != null && v.diastolicBp != null) {
      const obsBpId = `urn:uuid:${crypto.randomUUID()}`;
      entries.push({
        fullUrl: obsBpId,
        resource: {
          resourceType: 'Observation',
          id: obsBpId.replace('urn:uuid:', ''),
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }],
            text: 'Blood Pressure'
          },
          subject: { reference: patientResId },
          component: [
            {
              code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
              valueQuantity: { value: v.systolicBp, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
            },
            {
              code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
              valueQuantity: { value: v.diastolicBp, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
            }
          ]
        }
      });
      sectionEntries.push({ reference: obsBpId, display: 'Blood Pressure' });
    }

    if (v.heartRate != null) {
      const obsHrId = `urn:uuid:${crypto.randomUUID()}`;
      entries.push({
        fullUrl: obsHrId,
        resource: {
          resourceType: 'Observation',
          id: obsHrId.replace('urn:uuid:', ''),
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }]
          },
          subject: { reference: patientResId },
          valueQuantity: { value: v.heartRate, unit: 'beats/minute', system: 'http://unitsofmeasure.org', code: '/min' }
        }
      });
      sectionEntries.push({ reference: obsHrId, display: 'Heart Rate' });
    }

    if (v.spo2 != null) {
      const obsSpo2Id = `urn:uuid:${crypto.randomUUID()}`;
      entries.push({
        fullUrl: obsSpo2Id,
        resource: {
          resourceType: 'Observation',
          id: obsSpo2Id.replace('urn:uuid:', ''),
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' }]
          },
          subject: { reference: patientResId },
          valueQuantity: { value: v.spo2, unit: '%', system: 'http://unitsofmeasure.org', code: '%' }
        }
      });
      sectionEntries.push({ reference: obsSpo2Id, display: 'Oxygen Saturation SpO2' });
    }

    if (v.fetalHeartRate != null) {
      const obsFhrId = `urn:uuid:${crypto.randomUUID()}`;
      entries.push({
        fullUrl: obsFhrId,
        resource: {
          resourceType: 'Observation',
          id: obsFhrId.replace('urn:uuid:', ''),
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: '55283-6', display: 'Fetal Heart rate' }]
          },
          subject: { reference: patientResId },
          valueQuantity: { value: v.fetalHeartRate, unit: 'beats/minute', system: 'http://unitsofmeasure.org', code: '/min' }
        }
      });
      sectionEntries.push({ reference: obsFhrId, display: 'Fetal Heart Rate' });
    }
  }

  // 6. Medication Requests
  if (encounter.medicines && encounter.medicines.length > 0) {
    for (const med of encounter.medicines) {
      const medResId = `urn:uuid:${crypto.randomUUID()}`;
      entries.push({
        fullUrl: medResId,
        resource: {
          resourceType: 'MedicationRequest',
          id: medResId.replace('urn:uuid:', ''),
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            text: med.name
          },
          subject: { reference: patientResId },
          dosageInstruction: [
            {
              text: `${med.dosage || ''} ${med.frequency || ''} ${med.duration ? `for ${med.duration}` : ''} ${med.instructions || ''}`.trim()
            }
          ]
        }
      });
      sectionEntries.push({ reference: medResId, display: `Medication: ${med.name}` });
    }
  }

  // 7. Immunizations
  if (encounter.immunizations && encounter.immunizations.length > 0) {
    for (const imm of encounter.immunizations) {
      const immResId = `urn:uuid:${crypto.randomUUID()}`;
      entries.push({
        fullUrl: immResId,
        resource: {
          resourceType: 'Immunization',
          id: immResId.replace('urn:uuid:', ''),
          status: 'completed',
          vaccineCode: {
            text: imm.vaccineName
          },
          patient: { reference: patientResId },
          occurrenceDateTime: imm.administeredDate,
          lotNumber: imm.lotNumber ?? undefined
        }
      });
      sectionEntries.push({ reference: immResId, display: `Immunization: ${imm.vaccineName}` });
    }
  }

  // 8. Composition Resource
  const compositionResource: Record<string, unknown> = {
    resourceType: 'Composition',
    id: compositionId.replace('urn:uuid:', ''),
    meta: {
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle']
    },
    status: 'final',
    type: {
      coding: [
        {
          system: 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-document-type',
          code: encounter.type === 'ImmunizationRecord' ? '41000179103' : encounter.type === 'DischargeSummary' ? '373942005' : '4241000179101',
          display: encounter.type === 'ImmunizationRecord' ? 'Immunization Record' : encounter.type === 'DischargeSummary' ? 'Discharge Summary' : 'OP Consultation Record'
        }
      ],
      text: encounter.type
    },
    subject: { reference: patientResId, display: patient.fullName },
    encounter: { reference: encounterResId },
    date: nowIso,
    author: [{ reference: practitionerResId, display: doctor.name }],
    title: `${clinicName} - ${encounter.type}`,
    custodian: { display: clinicName },
    section: [
      {
        title: 'Clinical Summary & Observations',
        entry: sectionEntries
      }
    ]
  };

  // Bundle entry order: Composition MUST be the first entry in a FHIR Document Bundle
  const allEntries = [
    { fullUrl: compositionId, resource: compositionResource },
    { fullUrl: patientResId, resource: patientResource },
    { fullUrl: practitionerResId, resource: practitionerResource },
    { fullUrl: encounterResId, resource: encounterResource },
    ...entries
  ];

  const fhirBundle: Record<string, unknown> = {
    resourceType: 'Bundle',
    id: bundleId.replace('urn:uuid:', ''),
    meta: {
      versionId: '1',
      lastUpdated: nowIso,
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle']
    },
    identifier: {
      system: 'https://livi-clinic.in/bundles',
      value: bundleId
    },
    type: 'document',
    timestamp: nowIso,
    entry: allEntries
  };

  const bundleJson = JSON.stringify(fhirBundle, null, 2);
  const bundleHash = crypto.createHash('sha256').update(bundleJson).digest('hex');

  return {
    bundleId,
    bundleJson,
    bundleHash,
    fhirObject: fhirBundle
  };
}
