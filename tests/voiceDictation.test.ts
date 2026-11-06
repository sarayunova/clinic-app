import { describe, expect, it } from 'vitest';
import {
  formatDictationTranscript,
  appendDictatedText,
  CLINICAL_QUICK_PHRASES,
} from '../web/src/voiceDictationUtils.js';

describe('Voice Dictation & Clinical Speech Helper', () => {
  describe('formatDictationTranscript', () => {
    it('handles empty and null speech inputs gracefully', () => {
      expect(formatDictationTranscript('')).toBe('');
      expect(formatDictationTranscript('   ')).toBe('');
    });

    it('converts spoken punctuation commands into punctuation marks', () => {
      const speech1 = 'patient presents with headache comma nausea comma and mild epigastric pain full stop';
      expect(formatDictationTranscript(speech1)).toBe('Patient presents with headache, nausea, and mild epigastric pain.');

      const speech2 = 'is there any leaking per vaginum question mark no active bleeding period';
      expect(formatDictationTranscript(speech2)).toBe('Is there any leaking per vaginum? No active bleeding.');

      const speech3 = 'plan colon bed rest dash left lateral position next line monitor fetal movement';
      expect(formatDictationTranscript(speech3)).toBe('Plan: Bed rest - left lateral position\nMonitor fetal movement');
    });

    it('capitalizes sentence beginnings and normalizes spacing around punctuation', () => {
      const speech = 'blood pressure elevated .starting labetalol .review in two days';
      const formatted = formatDictationTranscript(speech);
      expect(formatted).toBe('Blood pressure elevated. Starting labetalol. Review in two days');
    });

    it('automatically capitalizes standard medical abbreviations', () => {
      const speech = 'patient has elevated bp full stop fhs is 140 bpm regular comma planned for elective lscs comma start iv fluids and sos paracetamol';
      const formatted = formatDictationTranscript(speech);
      expect(formatted).toBe('Patient has elevated BP. FHS is 140 bpm regular, planned for elective LSCS, start IV fluids and SOS paracetamol');
    });

    it('formats obstetric abbreviations correctly (LMP, EDD, GA, AFI, DFMC)', () => {
      const speech = 'lmp is 2026-04-10 comma edd is 2027-01-15 comma ga is 28 weeks comma afi is normal comma advise dfmc charting';
      const formatted = formatDictationTranscript(speech);
      expect(formatted).toBe('LMP is 2026-04-10, EDD is 2027-01-15, GA is 28 weeks, AFI is normal, advise DFMC charting');
    });
  });

  describe('appendDictatedText', () => {
    it('appends text with a clean separating space when needed', () => {
      expect(appendDictatedText('Patient presents with fever.', 'Mild cough since yesterday.')).toBe(
        'Patient presents with fever. Mild cough since yesterday.'
      );
    });

    it('attaches punctuation directly to current text without unwanted space', () => {
      expect(appendDictatedText('FHS 142 bpm', '.')).toBe('FHS 142 bpm.');
      expect(appendDictatedText('Severe headache', ', blurring of vision')).toBe('Severe headache, blurring of vision');
    });

    it('attaches directly after existing newline', () => {
      expect(appendDictatedText('1. Bed rest\n', '2. Low salt diet')).toBe('1. Bed rest\n2. Low salt diet');
    });

    it('handles blank inputs without adding extra spaces', () => {
      expect(appendDictatedText('', 'Presenting complaints')).toBe('Presenting complaints');
      expect(appendDictatedText('Existing notes', '')).toBe('Existing notes');
    });
  });

  describe('CLINICAL_QUICK_PHRASES', () => {
    it('includes all 4 standard consultation categories', () => {
      expect(CLINICAL_QUICK_PHRASES).toHaveLength(4);
      const categories = CLINICAL_QUICK_PHRASES.map((c) => c.category);
      expect(categories).toContain('Presenting Complaints');
      expect(categories).toContain('Examination Findings');
      expect(categories).toContain('Assessment & Diagnosis');
      expect(categories).toContain('Advice & Instructions');
    });

    it('contains clinically valid obstetric and general phrases', () => {
      const allText = CLINICAL_QUICK_PHRASES.flatMap((c) => c.phrases.map((p) => p.text)).join(' ');
      expect(allText).toContain('FHS');
      expect(allText).toContain('gestational age');
      expect(allText).toContain('DFMC');
      expect(allText).toContain('left lateral');
      expect(allText).toContain('pallor');
    });
  });
});
