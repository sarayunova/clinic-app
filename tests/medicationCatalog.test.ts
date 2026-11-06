import { describe, expect, it } from 'vitest';
import {
  QUICK_MEDICATIONS,
  QUICK_IPD_ORDERS,
  FREQUENCY_CHIPS,
  DURATION_CHIPS,
  ROUTE_CHIPS,
  INSTRUCTION_CHIPS,
  isItemBlank,
  applyQuickMedication,
  findStandardDirections,
  type MedicationItemForm,
} from '../web/src/medicationCatalog.js';

describe('Medication Catalog & Prescribing Accelerators', () => {
  it('contains well-formed quick medications across categories', () => {
    expect(QUICK_MEDICATIONS.length).toBeGreaterThanOrEqual(10);
    const categories = new Set(QUICK_MEDICATIONS.map((m) => m.category));
    expect(categories.has('Antenatal')).toBe(true);
    expect(categories.has('Obstetric & Gynae')).toBe(true);
    expect(categories.has('General')).toBe(true);

    for (const med of QUICK_MEDICATIONS) {
      expect(med.id).toBeTruthy();
      expect(med.name).toBeTruthy();
      expect(med.medicine).toBeTruthy();
      expect(med.strength).toBeTruthy();
      expect(med.dose).toBeTruthy();
      expect(med.route).toBeTruthy();
      expect(med.frequency).toBeTruthy();
      expect(med.duration).toBeTruthy();
      expect(med.instructions).toBeTruthy();
    }
  });

  it('contains essential obstetric & inpatient medications', () => {
    const medNames = QUICK_MEDICATIONS.map((m) => m.medicine.toLowerCase());
    expect(medNames.some((m) => m.includes('folic acid'))).toBe(true);
    expect(medNames.some((m) => m.includes('ferrous ascorbate'))).toBe(true);
    expect(medNames.some((m) => m.includes('calcium'))).toBe(true);
    expect(medNames.some((m) => m.includes('paracetamol'))).toBe(true);
    expect(medNames.some((m) => m.includes('dydrogesterone'))).toBe(true);
    expect(medNames.some((m) => m.includes('progesterone'))).toBe(true);

    expect(QUICK_IPD_ORDERS.length).toBeGreaterThanOrEqual(5);
    const ipdNames = QUICK_IPD_ORDERS.map((o) => o.medicine.toLowerCase());
    expect(ipdNames.some((m) => m.includes('oxytocin'))).toBe(true);
    expect(ipdNames.some((m) => m.includes('ceftriaxone'))).toBe(true);
  });

  it('detects blank vs non-blank item form rows', () => {
    const blank: MedicationItemForm = {
      medicine: '  ',
      strength: '',
      dose: '',
      route: '',
      frequency: '',
      duration: '',
      instructions: '',
    };
    expect(isItemBlank(blank)).toBe(true);

    const populated: MedicationItemForm = {
      ...blank,
      medicine: 'Paracetamol',
    };
    expect(isItemBlank(populated)).toBe(false);
  });

  it('replaces trailing blank row when applying quick medication', () => {
    const folic = QUICK_MEDICATIONS.find((m) => m.id === 'folic-acid')!;
    const blank: MedicationItemForm = {
      medicine: '',
      strength: '',
      dose: '',
      route: '',
      frequency: '',
      duration: '',
      instructions: '',
    };
    const initial = [blank];
    const result = applyQuickMedication(initial, folic);

    expect(result).toHaveLength(1);
    expect(result[0]!.medicine).toBe('Folic Acid');
    expect(result[0]!.strength).toBe('5 mg');
    expect(result[0]!.duration).toBe('30 days');
  });

  it('appends a new row when the last row is already filled', () => {
    const pcm = QUICK_MEDICATIONS.find((m) => m.id === 'paracetamol-650')!;
    const iron = QUICK_MEDICATIONS.find((m) => m.id === 'ferrous-ascorbate')!;
    const existing: MedicationItemForm[] = [
      {
        medicine: 'Paracetamol',
        strength: '650 mg',
        dose: '1 tablet',
        route: 'oral',
        frequency: 'SOS',
        duration: '3 days',
        instructions: 'After food',
      },
    ];

    const result = applyQuickMedication(existing, iron);
    expect(result).toHaveLength(2);
    expect(result[0]!.medicine).toBe('Paracetamol');
    expect(result[1]!.medicine).toBe('Ferrous Ascorbate + Folic Acid');
  });

  it('respects maximum item limit', () => {
    const folic = QUICK_MEDICATIONS.find((m) => m.id === 'folic-acid')!;
    const filled: MedicationItemForm[] = Array.from({ length: 30 }, (_, i) => ({
      medicine: `Med ${i}`,
      strength: '1 mg',
      dose: '1',
      route: 'oral',
      frequency: 'OD',
      duration: '1 day',
      instructions: '',
    }));

    const result = applyQuickMedication(filled, folic, 30);
    expect(result).toHaveLength(30);
  });

  it('finds standard directions case-insensitively', () => {
    const match = findStandardDirections('paracetamol');
    expect(match).toBeDefined();
    expect(match?.strength).toBe('650 mg');

    const match2 = findStandardDirections('Dydrogesterone 10mg');
    expect(match2).toBeDefined();
    expect(match2?.medicine).toBe('Dydrogesterone');

    expect(findStandardDirections('unknownxyz')).toBeUndefined();
  });

  it('provides standard frequency, duration, route, and instruction chips', () => {
    expect(FREQUENCY_CHIPS).toContain('1-0-0 (once daily)');
    expect(FREQUENCY_CHIPS).toContain('1-0-1 (twice daily)');
    expect(FREQUENCY_CHIPS).toContain('SOS (when needed)');

    expect(DURATION_CHIPS).toContain('3 days');
    expect(DURATION_CHIPS).toContain('5 days');
    expect(DURATION_CHIPS).toContain('30 days');

    expect(ROUTE_CHIPS).toContain('oral');
    expect(ROUTE_CHIPS).toContain('IV');

    expect(INSTRUCTION_CHIPS).toContain('After food');
    expect(INSTRUCTION_CHIPS).toContain('Before food');
    expect(INSTRUCTION_CHIPS).toContain('At bedtime');
  });
});
