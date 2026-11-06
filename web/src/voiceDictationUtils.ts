/**
 * Speech dictation formatting and clinical terminology normalisation helpers.
 */

const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  bp: 'BP',
  fhs: 'FHS',
  fhr: 'FHR',
  lscs: 'LSCS',
  nvd: 'NVD',
  usg: 'USG',
  iv: 'IV',
  im: 'IM',
  prn: 'PRN',
  sos: 'SOS',
  bd: 'BD',
  tds: 'TDS',
  od: 'OD',
  qid: 'QID',
  hs: 'HS',
  po: 'PO',
  pv: 'PV',
  ps: 'PS',
  pr: 'PR',
  lmp: 'LMP',
  edd: 'EDD',
  ga: 'GA',
  afi: 'AFI',
  nt: 'NT',
  nb: 'NB',
  gdm: 'GDM',
  pih: 'PIH',
  dfmc: 'DFMC',
  cbc: 'CBC',
  tsh: 'TSH',
  ogtt: 'OGTT',
  rh: 'Rh',
  hb: 'Hb',
  spo2: 'SpO2',
  bpm: 'bpm',
  mmhg: 'mmHg',
};

/**
 * Formats spoken dictation text:
 * 1. Converts spoken punctuation commands ("full stop", "comma", "new line", etc.) into punctuation.
 * 2. Normalizes whitespace and capitalization after sentence terminators.
 * 3. Expands and capitalizes common medical abbreviations (BP, FHS, LSCS, etc.).
 */
export function formatDictationTranscript(rawSpeech: string): string {
  if (!rawSpeech) return '';

  let text = rawSpeech;

  // 1. Spoken punctuation commands
  text = text
    .replace(/\b(full stop|period)\b/gi, '.')
    .replace(/\b(comma)\b/gi, ',')
    .replace(/\b(colon)\b/gi, ':')
    .replace(/\b(semi colon|semicolon)\b/gi, ';')
    .replace(/\b(question mark)\b/gi, '?')
    .replace(/\b(exclamation mark|exclamation point)\b/gi, '!')
    .replace(/\b(new line|next line)\b/gi, '\n')
    .replace(/\b(new paragraph)\b/gi, '\n\n')
    .replace(/\b(dash|hyphen)\b/gi, '-')
    .replace(/\b(bullet point|bullet)\b/gi, '• ');

  // 2. Clean spaces around punctuation
  text = text
    .replace(/[ \t]+([.,!?:;])/g, '$1') // remove space before punctuation
    .replace(/([.,!?:;])(?![ \t]|$|\n)/g, '$1 ') // ensure single space after punctuation
    .replace(/[ \t]*\n[ \t]*/g, '\n') // clean spaces around newlines
    .replace(/[ \t]{2,}/g, ' '); // collapse multiple spaces on same line

  // 3. Capitalize first letter of text and sentences
  text = text.replace(/(^|[:.!?\n]\s*)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);

  // 4. Medical Abbreviations capitalization
  const words = text.split(/([ \t]+|[.,!?:;\n]+)/);
  const formatted = words.map((w) => {
    const lower = w.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(MEDICAL_ABBREVIATIONS, lower)) {
      return MEDICAL_ABBREVIATIONS[lower]!;
    }
    return w;
  });

  return formatted.join('').trim();
}

/**
 * Appends new dictated text to existing field text cleanly with appropriate spacing.
 */
export function appendDictatedText(existingText: string, newText: string): string {
  const hasTrailingNewline = existingText.endsWith('\n');
  const current = existingText.replace(/[ \t]+$/, '');
  const added = newText.trim();
  if (!current) return added;
  if (!added) return current;

  // If added starts with punctuation (like '.', ',', ':'), attach directly
  if (/^[.,!?:;]/.test(added)) {
    return `${current.replace(/\s+$/, '')}${added}`;
  }

  // If current ends with newline, append directly
  if (hasTrailingNewline) {
    return `${current}${added}`;
  }

  return `${current} ${added}`;
}

export interface QuickPhraseCategory {
  category: string;
  icon: string;
  phrases: Array<{ label: string; text: string }>;
}

export const CLINICAL_QUICK_PHRASES: QuickPhraseCategory[] = [
  {
    category: 'Presenting Complaints',
    icon: '💬',
    phrases: [
      { label: 'Routine ANC visit', text: 'Came for routine antenatal checkup. No active complaints.' },
      { label: 'Nausea & vomiting', text: 'Complaints of nausea, vomiting and morning sickness for past few days.' },
      { label: 'Lower abdominal pain', text: 'Complains of mild lower abdominal aching pain, intermittent, no bleeding or leaking PV.' },
      { label: 'Decreased fetal movement', text: 'Perceiving decreased fetal movements since morning.' },
      { label: 'Headache & blurring', text: 'Complaints of persistent headache, epigastric discomfort, and occasional blurring of vision.' },
    ],
  },
  {
    category: 'Examination Findings',
    icon: '🩺',
    phrases: [
      { label: 'Normal general exam', text: 'Patient conscious, oriented, afebrile. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or pedal edema.' },
      { label: 'Cardiorespiratory clear', text: 'Bilateral air entry equal, chest clear, no added sounds. S1 S2 heard regular, no murmurs.' },
      { label: 'Abdomen obstetric normal', text: 'Per abdomen: Uterus corresponds to gestational age, relaxed, cephalic presentation, FHS 140 bpm regular. Good fetal movements felt.' },
      { label: 'Pedal edema present', text: 'Bilateral pitting pedal edema present (Grade 1+).' },
      { label: 'Pelvis adequate', text: 'Per vaginum: Cervix soft, os closed, no active bleeding or leaking liquor. Pelvis clinically adequate.' },
    ],
  },
  {
    category: 'Assessment & Diagnosis',
    icon: '📋',
    phrases: [
      { label: 'Normal intrauterine pregnancy', text: 'Single live intrauterine pregnancy corresponding to gestational age with reassuring fetal status.' },
      { label: 'Gestational hypertension', text: 'Gestational hypertension. Blood pressure elevated (≥ 140/90 mmHg). Needs serial monitoring and lab workup.' },
      { label: 'Gestational diabetes (GDM)', text: 'Gestational Diabetes Mellitus (GDM). Requires dietary regulation and blood glucose profiling.' },
      { label: 'Mild Anemia', text: 'Mild nutritional anemia in pregnancy. Iron supplementation advised.' },
      { label: 'High-risk: Prior LSCS', text: 'Previous 1 LSCS with term pregnancy. Monitored for scar tenderness and trial of labor vs repeat elective section.' },
    ],
  },
  {
    category: 'Advice & Instructions',
    icon: '💊',
    phrases: [
      { label: 'Routine ANC advice', text: 'Adequate rest in left lateral position. High protein balanced diet, green leafy vegetables, plenty of fluids. Continue Iron, Calcium, and Vitamin supplements.' },
      { label: 'Daily fetal kicks (DFMC)', text: 'Monitor Daily Fetal Movement Count (DFMC) after meals (minimum 10 movements over 12 hours).' },
      { label: 'Emergency warning signs', text: 'Advised to report immediately to emergency if any bleeding PV, leaking watery discharge, severe headache, epigastric pain, or decreased fetal movements.' },
      { label: 'Low salt diet', text: 'Restricted salt intake, avoid fried and processed foods. Regular BP charting twice daily.' },
      { label: 'Routine follow-up in 2w', text: 'Follow-up review after 2 weeks with routine antenatal blood and urine reports.' },
    ],
  },
];
