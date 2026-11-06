/**
 * Standard medication presets, common prescribing quick-picks,
 * and frequency/duration chips for fast clinical data entry.
 *
 * Doctors retain full clinical discretion to modify, edit, or delete any field.
 */

export interface QuickMedication {
  id: string;
  name: string;
  category: 'Antenatal' | 'Obstetric & Gynae' | 'General';
  medicine: string;
  strength: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface QuickIpdOrder {
  id: string;
  name: string;
  medicine: string;
  strength: string;
  dose: string;
  route: string;
  frequency: string;
  instructions: string;
}

export type MedicationItemForm = {
  medicine: string;
  strength: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
};

export const QUICK_MEDICATIONS: readonly QuickMedication[] = [
  // --- Antenatal & Supplements ---
  {
    id: 'folic-acid',
    name: 'Folic Acid 5mg',
    category: 'Antenatal',
    medicine: 'Folic Acid',
    strength: '5 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-0 (once daily)',
    duration: '30 days',
    instructions: 'After breakfast',
  },
  {
    id: 'ferrous-ascorbate',
    name: 'Iron (Ferrous Ascorbate)',
    category: 'Antenatal',
    medicine: 'Ferrous Ascorbate + Folic Acid',
    strength: '100 mg elemental iron',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-0 (once daily)',
    duration: '30 days',
    instructions: 'After food; do not take with milk, tea or calcium',
  },
  {
    id: 'calcium-d3',
    name: 'Calcium + Vit D3',
    category: 'Antenatal',
    medicine: 'Calcium Carbonate + Vitamin D3',
    strength: '500 mg + 250 IU',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-1 (twice daily)',
    duration: '30 days',
    instructions: 'After food (separate from iron by at least 2 hours)',
  },
  {
    id: 'doxylamine-b6',
    name: 'Doxylamine + B6',
    category: 'Antenatal',
    medicine: 'Doxylamine Succinate + Pyridoxine',
    strength: '10 mg / 10 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '0-0-1 (bedtime)',
    duration: '10 days',
    instructions: 'At bedtime for morning sickness / nausea',
  },
  {
    id: 'l-methylfolate-dha',
    name: 'L-Methylfolate + DHA',
    category: 'Antenatal',
    medicine: 'L-Methylfolate + Pyridoxal-5P + DHA',
    strength: '1 mg + 0.5 mg + 200 mg',
    dose: '1 capsule',
    route: 'oral',
    frequency: '1-0-0 (once daily)',
    duration: '30 days',
    instructions: 'After breakfast',
  },

  // --- Obstetric & Gynaecology ---
  {
    id: 'dydrogesterone',
    name: 'Dydrogesterone 10mg',
    category: 'Obstetric & Gynae',
    medicine: 'Dydrogesterone',
    strength: '10 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-1 (twice daily)',
    duration: '14 days',
    instructions: 'After food (luteal support)',
  },
  {
    id: 'progesterone-200',
    name: 'Progesterone SR 200mg',
    category: 'Obstetric & Gynae',
    medicine: 'Natural Micronized Progesterone',
    strength: '200 mg',
    dose: '1 capsule',
    route: 'per vaginal',
    frequency: '0-0-1 (bedtime)',
    duration: '14 days',
    instructions: 'Insert deep vaginally at bedtime',
  },
  {
    id: 'labetalol-100',
    name: 'Labetalol 100mg',
    category: 'Obstetric & Gynae',
    medicine: 'Labetalol',
    strength: '100 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-1 (twice daily)',
    duration: '14 days',
    instructions: 'After food; monitor BP regularly',
  },
  {
    id: 'tranexamic-500',
    name: 'Tranexamic Acid 500mg',
    category: 'Obstetric & Gynae',
    medicine: 'Tranexamic Acid',
    strength: '500 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-1-1 (thrice daily)',
    duration: '4 days',
    instructions: 'During heavy menstrual bleeding',
  },
  {
    id: 'metformin-500',
    name: 'Metformin 500mg',
    category: 'Obstetric & Gynae',
    medicine: 'Metformin',
    strength: '500 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-1 (twice daily)',
    duration: '30 days',
    instructions: 'With or immediately after meals (PCOS / insulin resistance)',
  },

  // --- General & Symptomatic ---
  {
    id: 'paracetamol-650',
    name: 'Paracetamol 650mg',
    category: 'General',
    medicine: 'Paracetamol',
    strength: '650 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: 'SOS (when needed)',
    duration: '3 days',
    instructions: 'After food for fever or pain (max 3/day)',
  },
  {
    id: 'pantoprazole-40',
    name: 'Pantoprazole 40mg',
    category: 'General',
    medicine: 'Pantoprazole',
    strength: '40 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-0 (once daily)',
    duration: '14 days',
    instructions: '30 mins before breakfast on empty stomach',
  },
  {
    id: 'ondansetron-4',
    name: 'Ondansetron 4mg',
    category: 'General',
    medicine: 'Ondansetron',
    strength: '4 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-1 (twice daily)',
    duration: '5 days',
    instructions: '30 mins before meals',
  },
  {
    id: 'drotaverine-40',
    name: 'Drotaverine 40mg',
    category: 'General',
    medicine: 'Drotaverine',
    strength: '40 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-1-1 (thrice daily)',
    duration: '3 days',
    instructions: 'After food for abdominal cramps / spasm',
  },
  {
    id: 'amox-clav-625',
    name: 'Amoxicillin-Clav 625mg',
    category: 'General',
    medicine: 'Amoxicillin + Potassium Clavulanate',
    strength: '625 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-1 (twice daily)',
    duration: '5 days',
    instructions: 'After food; complete the full course',
  },
  {
    id: 'cefixime-200',
    name: 'Cefixime 200mg',
    category: 'General',
    medicine: 'Cefixime',
    strength: '200 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-0-1 (twice daily)',
    duration: '5 days',
    instructions: 'After food; complete the full course',
  },
];

export const QUICK_IPD_ORDERS: readonly QuickIpdOrder[] = [
  {
    id: 'inj-ceftriaxone',
    name: 'Inj Ceftriaxone 1g IV',
    medicine: 'Inj Ceftriaxone',
    strength: '1 g',
    dose: '1 vial',
    route: 'IV',
    frequency: '1-0-1 (twice daily)',
    instructions: 'IV slowly after negative skin test',
  },
  {
    id: 'inj-pantoprazole',
    name: 'Inj Pantoprazole 40mg IV',
    medicine: 'Inj Pantoprazole',
    strength: '40 mg',
    dose: '1 vial',
    route: 'IV',
    frequency: '1-0-0 (once daily)',
    instructions: 'Slow IV push in morning',
  },
  {
    id: 'inj-ondansetron',
    name: 'Inj Ondansetron 4mg IV',
    medicine: 'Inj Ondansetron',
    strength: '4 mg / 2 ml',
    dose: '4 mg',
    route: 'IV',
    frequency: '1-0-1 (twice daily)',
    instructions: 'Slow IV push',
  },
  {
    id: 'inj-pcm-infusion',
    name: 'Inj Paracetamol 1g Infusion',
    medicine: 'Inj Paracetamol IV Infusion',
    strength: '1000 mg / 100 ml',
    dose: '100 ml',
    route: 'IV infusion',
    frequency: 'SOS (when needed)',
    instructions: 'IV infusion over 15-20 min for fever > 100°F',
  },
  {
    id: 'inj-tranexamic',
    name: 'Inj Tranexamic Acid 500mg IV',
    medicine: 'Inj Tranexamic Acid',
    strength: '500 mg / 5 ml',
    dose: '500 mg',
    route: 'IV',
    frequency: '1-1-1 (thrice daily)',
    instructions: 'Slow IV push over 5 minutes',
  },
  {
    id: 'inj-oxytocin',
    name: 'Inj Oxytocin 10 IU in RL',
    medicine: 'Inj Oxytocin',
    strength: '10 IU',
    dose: '10 IU in 500 ml RL',
    route: 'IV infusion',
    frequency: 'Continuous',
    instructions: 'Titrate infusion rate as per obstetric protocol',
  },
  {
    id: 'inj-drotaverine',
    name: 'Inj Drotaverine 40mg IM/IV',
    medicine: 'Inj Drotaverine',
    strength: '40 mg / 2 ml',
    dose: '40 mg',
    route: 'IM / IV',
    frequency: 'SOS (when needed)',
    instructions: 'Slow IM or IV for severe pain / colic',
  },
  {
    id: 'tab-pcm-ipd',
    name: 'Tab Paracetamol 650mg',
    medicine: 'Paracetamol',
    strength: '650 mg',
    dose: '1 tablet',
    route: 'oral',
    frequency: '1-1-1 (thrice daily)',
    instructions: 'After food for fever or pain',
  },
];

export const FREQUENCY_CHIPS: readonly string[] = [
  '1-0-0 (once daily)',
  '1-0-1 (twice daily)',
  '1-1-1 (thrice daily)',
  '0-0-1 (bedtime)',
  'SOS (when needed)',
  '1-1-1-1 (four times daily)',
  'Once weekly',
];

export const DURATION_CHIPS: readonly string[] = [
  '3 days',
  '5 days',
  '7 days',
  '14 days',
  '30 days',
  'Till delivery',
  'Till review',
];

export const ROUTE_CHIPS: readonly string[] = [
  'oral',
  'IV',
  'IM',
  'per vaginal',
  'topical',
  'sublingual',
  'SC',
];

export const INSTRUCTION_CHIPS: readonly string[] = [
  'After food',
  'Before food',
  'Empty stomach',
  'At bedtime',
  'With milk',
  'With plenty of water',
];

export const IPD_FREQUENCY_CHIPS: readonly string[] = [
  '1-0-0 (once daily)',
  '1-0-1 (twice daily)',
  '1-1-1 (thrice daily)',
  '0-0-1 (bedtime)',
  'SOS (when needed)',
  'Stat (once now)',
  'Continuous',
];

export const IPD_ROUTE_CHIPS: readonly string[] = [
  'IV',
  'IM',
  'oral',
  'SC',
  'IV infusion',
  'per vaginal',
];

export const MEDICINE_SUGGESTIONS: readonly string[] = Array.from(
  new Set([
    ...QUICK_MEDICATIONS.map((m) => m.medicine),
    ...QUICK_IPD_ORDERS.map((m) => m.medicine),
    'Metronidazole',
    'Azithromycin',
    'Levothyroxine',
    'Insulin Regular',
    'Insulin Glargine',
    'Betamethasone',
    'Dexamethasone',
    'Magnesium Sulphate',
    'Ranitidine',
  ])
).sort((a, b) => a.localeCompare(b));

/**
 * Checks whether an item row is untouched / empty.
 */
export function isItemBlank(item: MedicationItemForm): boolean {
  return Object.values(item).every((v) => !v || v.trim() === '');
}

/**
 * Inserts a quick medication into the existing items list.
 * If the trailing item is completely blank, it populates that blank row.
 * Otherwise, it appends a new item up to maxItems.
 */
export function applyQuickMedication(
  items: MedicationItemForm[],
  quick: QuickMedication,
  maxItems = 30
): MedicationItemForm[] {
  const newRow: MedicationItemForm = {
    medicine: quick.medicine,
    strength: quick.strength,
    dose: quick.dose,
    route: quick.route,
    frequency: quick.frequency,
    duration: quick.duration,
    instructions: quick.instructions,
  };

  if (items.length > 0 && isItemBlank(items[items.length - 1]!)) {
    const updated = [...items];
    updated[items.length - 1] = newRow;
    return updated;
  }

  if (items.length >= maxItems) {
    return items;
  }

  return [...items, newRow];
}

/**
 * Case-insensitive lookup for matching quick medication defaults.
 */
export function findStandardDirections(medicineName: string): QuickMedication | undefined {
  const q = medicineName.trim().toLowerCase();
  if (!q) return undefined;
  return QUICK_MEDICATIONS.find(
    (m) =>
      m.medicine.toLowerCase() === q ||
      m.name.toLowerCase() === q ||
      m.medicine.toLowerCase().includes(q) ||
      q.includes(m.medicine.toLowerCase())
  );
}
