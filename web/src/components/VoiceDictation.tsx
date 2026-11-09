import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatDictationTranscript,
  CLINICAL_QUICK_PHRASES,
} from '../voiceDictationUtils';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstanceLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstanceLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export const DICTATION_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
] as const;

export interface SpeechRecognitionController {
  isSupported: boolean;
  isListening: boolean;
  interimText: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearError: () => void;
  lang: string;
  setLang: (lang: string) => void;
}

/**
 * Hook managing browser Web Speech API recognition.
 * Designed for clinical reliability: creates a fresh SpeechRecognition session
 * each time to avoid browser-level InvalidStateError, and auto-restarts on
 * silence pauses until the doctor explicitly stops dictating.
 */
export function useSpeechRecognition({
  onFinalText,
  lang = 'en-IN',
}: {
  onFinalText: (formattedText: string) => void;
  lang?: string;
}): SpeechRecognitionController {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState(lang);

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;
  const currentLangRef = useRef(currentLang);
  currentLangRef.current = currentLang;

  const cleanupInstance = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  const createAndStartSession = useCallback(() => {
    if (!isSupported) return;

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    cleanupInstance();

    try {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLangRef.current || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setInterimText('');
      };

      recognition.onend = () => {
        // If the doctor hasn't explicitly stopped, restart automatically so pauses don't cut off speech
        if (shouldListenRef.current) {
          restartTimerRef.current = window.setTimeout(() => {
            if (shouldListenRef.current) {
              createAndStartSession();
            }
          }, 150);
        } else {
          setIsListening(false);
          setInterimText('');
        }
      };

      recognition.onerror = (e) => {
        if (e.error === 'no-speech') {
          // Normal idle event when speaker pauses; do not stop session
          return;
        }
        if (e.error === 'aborted') {
          // Aborted during switch or stop; ignore
          return;
        }
        if (e.error === 'not-allowed') {
          shouldListenRef.current = false;
          setIsListening(false);
          setInterimText('');
          setError('Microphone access blocked. Click the lock icon in your browser address bar and set Microphone to "Allow".');
          return;
        }
        if (e.error === 'network') {
          shouldListenRef.current = false;
          setIsListening(false);
          setInterimText('');
          setError('Voice dictation network error: Chrome requires an active internet connection for cloud speech-to-text. Check your internet connection or use Quick Clinical Phrases.');
          return;
        }
        if (e.error === 'audio-capture') {
          shouldListenRef.current = false;
          setIsListening(false);
          setInterimText('');
          setError('No microphone found on this device. Please connect a microphone or headset and try again.');
          return;
        }

        setError(`Speech recognition error: ${e.error}`);
        if (!shouldListenRef.current) {
          setIsListening(false);
          setInterimText('');
        }
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        try {
          let finalChunk = '';
          let currentInterim = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i];
            if (!item || !item[0]) continue;
            const transcript = item[0].transcript;
            if (item.isFinal) {
              finalChunk += transcript + ' ';
            } else {
              currentInterim += transcript;
            }
          }

          if (finalChunk.trim()) {
            const formatted = formatDictationTranscript(finalChunk);
            if (formatted) {
              onFinalTextRef.current(formatted);
            }
          }

          setInterimText(currentInterim);
        } catch (err) {
          console.error('Error handling speech recognition results:', err);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('SpeechRecognition session start failed:', err);
      shouldListenRef.current = false;
      setIsListening(false);
      setError('Unable to activate microphone. Please check browser speech permissions.');
    }
  }, [cleanupInstance, isSupported]);

  const startListening = useCallback(() => {
    shouldListenRef.current = true;
    setError(null);
    createAndStartSession();
  }, [createAndStartSession]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    setInterimText('');
    cleanupInstance();
  }, [cleanupInstance]);

  const toggleListening = useCallback(() => {
    if (shouldListenRef.current || isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      cleanupInstance();
    };
  }, [cleanupInstance]);

  return {
    isSupported,
    isListening,
    interimText,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearError: () => setError(null),
    lang: currentLang,
    setLang: setCurrentLang,
  };
}

/**
 * Compact microphone button placed next to individual field labels.
 * Reflects whether THIS field is actively recording speech, and triggers dictation directly.
 */
export function VoiceFieldMic({
  isListening,
  onToggle,
  title = 'Click to dictate into this field by voice',
}: {
  isListening: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`btn small ${isListening ? 'danger' : ''}`}
      onClick={onToggle}
      title={isListening ? 'Click to stop dictating' : title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.5rem',
        fontSize: '0.8rem',
        borderRadius: '12px',
        background: isListening ? '#fee2e2' : undefined,
        color: isListening ? '#b91c1c' : undefined,
        borderColor: isListening ? '#f87171' : undefined,
        fontWeight: isListening ? 600 : 400,
        boxShadow: isListening ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={isListening ? { display: 'inline-block', animation: 'fadein 0.8s infinite alternate' } : undefined}
      >
        {isListening ? '🔴' : '🎤'}
      </span>
      <span>{isListening ? 'Listening…' : 'Dictate'}</span>
    </button>
  );
}

interface DictationToolbarProps {
  activeField: string;
  fieldLabels: Record<string, string>;
  onSelectField: (fieldKey: string) => void;
  onAppendText: (fieldKey: string, text: string) => void;
  speechRecognition?: SpeechRecognitionController;
  disabled?: boolean;
}

/**
 * Full consultation smart dictation bar & clinical phrase drawer.
 */
export function DictationToolbar({
  activeField,
  fieldLabels,
  onSelectField,
  onAppendText,
  speechRecognition,
  disabled = false,
}: DictationToolbarProps) {
  const [showPhrases, setShowPhrases] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  // Fallback to internal hook if not passed from parent
  const internalRec = useSpeechRecognition({
    onFinalText: (formatted) => {
      onAppendText(activeField, formatted);
    },
  });

  const rec = speechRecognition ?? internalRec;

  const insertPunctuation = (punct: string) => {
    onAppendText(activeField, punct);
  };

  const insertPhrase = (phraseText: string) => {
    onAppendText(activeField, phraseText);
  };

  return (
    <div
      className="card stack no-print"
      style={{
        marginBottom: '0.8rem',
        padding: '0.7rem 1rem',
        background: rec.isListening ? '#fef2f2' : '#f8fafc',
        border: `1.5px solid ${rec.isListening ? '#f87171' : '#cbd5e1'}`,
        transition: 'all 0.2s ease',
      }}
    >
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div className="row wrap" style={{ alignItems: 'center', gap: '0.6rem' }}>
          {/* Target field selector */}
          <div className="row" style={{ alignItems: 'center', gap: '0.35rem' }}>
            <span className="small muted">Target:</span>
            <select
              value={activeField}
              onChange={(e) => onSelectField(e.target.value)}
              disabled={disabled}
              style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem', fontWeight: 500 }}
            >
              {Object.entries(fieldLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Language selector */}
          <select
            value={rec.lang}
            onChange={(e) => rec.setLang(e.target.value)}
            disabled={disabled || rec.isListening}
            title="Dictation language model"
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.4rem' }}
          >
            {DICTATION_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          {/* Voice Microphone Toggle */}
          {rec.isSupported ? (
            <button
              type="button"
              className={`btn small ${rec.isListening ? 'danger' : 'primary'}`}
              onClick={rec.toggleListening}
              disabled={disabled}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
              }}
            >
              <span aria-hidden="true">{rec.isListening ? '🛑' : '🎙️'}</span>
              <span>{rec.isListening ? 'Stop Listening' : 'Voice Dictate'}</span>
            </button>
          ) : (
            <span className="small muted">
              🎤 Voice dictation supported in Chrome, Edge, Safari
            </span>
          )}

          {/* Clinical Phrases Drawer Toggle */}
          <button
            type="button"
            className="btn small"
            onClick={() => setShowPhrases((p) => !p)}
            style={{ fontSize: '0.85rem' }}
          >
            {showPhrases ? 'Hide Clinical Phrases' : '⚡ Quick Clinical Phrases'}
          </button>
        </div>

        {/* Punctuation Shortcuts */}
        <div className="row wrap" style={{ gap: '0.3rem', alignItems: 'center' }}>
          <span className="small muted" style={{ fontSize: '0.75rem' }}>Voice shortcuts:</span>
          <button
            type="button"
            className="chip-btn"
            onClick={() => insertPunctuation('.')}
            title="Insert full stop / period"
          >
            . (Period)
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => insertPunctuation(',')}
            title="Insert comma"
          >
            , (Comma)
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => insertPunctuation('\n')}
            title="Insert new line"
          >
            ↵ New Line
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => insertPunctuation('-')}
            title="Insert dash / hyphen"
          >
            - Dash
          </button>
        </div>
      </div>

      {/* Live Interim Streaming Transcript */}
      {rec.isListening && (
        <div
          style={{
            marginTop: '0.4rem',
            padding: '0.5rem 0.8rem',
            background: '#ffffff',
            borderRadius: '6px',
            border: '1.5px solid #ef4444',
            fontSize: '0.88rem',
            color: '#991b1b',
            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)',
          }}
        >
          <div className="row wrap" style={{ alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem', display: 'inline-block' }}>🔴</span>
            <strong>Listening to {fieldLabels[activeField] || activeField}:</strong>
            <span style={{ fontStyle: rec.interimText ? 'normal' : 'italic', color: rec.interimText ? '#1e293b' : '#64748b' }}>
              {rec.interimText || 'Speak clearly into your microphone… (say "full stop", "comma", "new line" to punctuate)'}
            </span>
          </div>
        </div>
      )}

      {/* Error Message with Dismiss Button */}
      {rec.error && (
        <div
          className="banner warn small"
          style={{
            marginTop: '0.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
            padding: '0.5rem 0.8rem',
          }}
        >
          <span>⚠️ {rec.error}</span>
          <button
            type="button"
            className="btn small"
            onClick={rec.clearError}
            style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Clinical Phrases Drawer */}
      {showPhrases && (
        <div
          style={{
            marginTop: '0.6rem',
            padding: '0.6rem 0.8rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
          }}
        >
          {/* Category Tabs */}
          <div className="row wrap" style={{ gap: '0.3rem', marginBottom: '0.5rem' }}>
            {CLINICAL_QUICK_PHRASES.map((cat, idx) => (
              <button
                key={cat.category}
                type="button"
                className={`btn small ${activeCategory === idx ? 'primary' : ''}`}
                onClick={() => setActiveCategory(idx)}
                style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem' }}
              >
                {cat.icon} {cat.category}
              </button>
            ))}
          </div>

          {/* Phrase Chips */}
          <div className="row wrap" style={{ gap: '0.4rem' }}>
            {CLINICAL_QUICK_PHRASES[activeCategory]?.phrases.map((phrase) => (
              <button
                key={phrase.label}
                type="button"
                className="chip-btn pill-add"
                onClick={() => insertPhrase(phrase.text)}
                title={phrase.text}
                style={{ fontSize: '0.8rem' }}
              >
                + {phrase.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
