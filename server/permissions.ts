export type Role = 'doctor' | 'nurse' | 'attender';
export const ROLES: Role[] = ['doctor', 'nurse', 'attender'];

export type Permission =
  | 'patient:read_basic' // name, number, age, phone, allergy alert
  | 'patient:read_clinical' // histories, notes, medicines
  | 'patient:write_demographics'
  | 'patient:write_allergies'
  | 'patient:write_clinical'
  | 'appointment:read'
  | 'appointment:create'
  | 'appointment:status_front' // scheduled / waiting / cancelled / absent
  | 'appointment:status_clinical' // in_consultation / completed
  | 'visit:read' // consultation records of any patient
  | 'visit:create'
  | 'visit:write' // edit draft consultation content and prescription
  | 'visit:finalise' // finalise and amend
  | 'vitals:write'
  | 'bed:manage'
  | 'ipd:read_basic' // who is admitted where (no clinical content)
  | 'ipd:read' // clinical admission records and care entries
  | 'admission:create'
  | 'admission:write' // edit diagnosis, assessment, treatment plan
  | 'care:write_nursing' // nursing notes, observations
  | 'care:write_clinical' // doctor rounds, procedures, investigations
  | 'order:write' // order and stop medicines
  | 'med:administer' // record given / withheld / refused
  | 'discharge:write' // discharge summary and addenda
  | 'billing:read' // invoices, payments, balances
  | 'invoice:write' // create, edit draft, issue
  | 'payment:take' // record payments
  | 'billing:authorise' // adjustments, refunds, cancelling an invoice
  | 'backup:manage' // see backup status, run a backup now
  | 'settings:manage' // clinic details
  | 'user:manage'
  | 'audit:read'
  | 'record:export' // download a patient's complete record
  | 'attachment:read' // view uploaded documents
  | 'attachment:write' // upload documents
  | 'attachment:void'; // remove (void) a document

const MATRIX: Record<Role, Permission[]> = {
  doctor: [
    'patient:read_basic',
    'patient:read_clinical',
    'patient:write_demographics',
    'patient:write_allergies',
    'patient:write_clinical',
    'appointment:read',
    'appointment:create',
    'appointment:status_front',
    'appointment:status_clinical',
    'visit:read',
    'visit:create',
    'visit:write',
    'visit:finalise',
    'vitals:write',
    'bed:manage',
    'ipd:read_basic',
    'ipd:read',
    'admission:create',
    'admission:write',
    'care:write_nursing',
    'care:write_clinical',
    'order:write',
    'med:administer',
    'discharge:write',
    'billing:read',
    'invoice:write',
    'payment:take',
    'billing:authorise',
    'settings:manage',
    'backup:manage',
    'user:manage',
    'audit:read',
    'record:export',
    'attachment:read',
    'attachment:write',
    'attachment:void',
  ],
  nurse: [
    'patient:read_basic',
    'patient:read_clinical',
    'patient:write_allergies',
    'appointment:read',
    'appointment:status_front',
    'visit:read',
    'visit:create',
    'vitals:write',
    'ipd:read_basic',
    'ipd:read',
    'admission:create',
    'care:write_nursing',
    'med:administer',
    'attachment:read',
    'attachment:write',
  ],
  attender: [
    'patient:read_basic',
    'patient:write_demographics',
    'appointment:read',
    'appointment:create',
    'appointment:status_front',
    'ipd:read_basic',
    'billing:read',
    'invoice:write',
    'payment:take',
  ],
};

export function can(role: Role, perm: Permission): boolean {
  return MATRIX[role].includes(perm);
}

export function permissionsFor(role: Role): Permission[] {
  return [...MATRIX[role]];
}
