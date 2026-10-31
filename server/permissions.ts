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
  | 'user:manage'
  | 'audit:read';

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
    'user:manage',
    'audit:read',
  ],
  nurse: [
    'patient:read_basic',
    'patient:read_clinical',
    'patient:write_allergies',
    'appointment:read',
    'appointment:status_front',
  ],
  attender: [
    'patient:read_basic',
    'patient:write_demographics',
    'appointment:read',
    'appointment:create',
    'appointment:status_front',
  ],
};

export function can(role: Role, perm: Permission): boolean {
  return MATRIX[role].includes(perm);
}

export function permissionsFor(role: Role): Permission[] {
  return [...MATRIX[role]];
}
