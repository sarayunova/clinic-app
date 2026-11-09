import { useEffect, useRef, useState } from 'react';
import {
  formatDictationTranscript,
  appendDictatedText,
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

/**
 * Hook managing browser Web Speech API recognition.
 */
export function useSpeechRecognition({
  onFinalText,
  lang = 'en-IN',
}: {
  onFinalText: (formattedText: string) => void;
  lang?: string;
}) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;

  useEffect(() => {
    if (!isSupported) return;

    try {
      const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Ctor) return;

      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setInterimText('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognition.onerror = (e) => {
        setIsListening(false);
        setInterimText('');
        if (e.error === 'no-speech') {
          // Ignorable idle event
          return;
        }
        if (e.error === 'not-allowed') {
          setError('Microphone permission denied. Allow microphone access in your browser to dictate.');
        } else {
          setError(`Speech recognition: ${e.error}`);
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

      return () => {
        try {
          recognition.abort();
        } catch {
          // cleanup ignore
        }
        recognitionRef.current = null;
      };
    } catch (err) {
      console.warn('SpeechRecognition initialization failed:', err);
      recognitionRef.current = null;
    }
  }, [isSupported, lang]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      setError(null);
      recognitionRef.current.start();
    } catch {
      // Recognition may already be running
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  return {
    isSupported,
    isListening,
    interimText,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearError: () => setError(null),
  };
}

/**
 * Compact microphone button placed next to individual field labels.
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
      title={isListening ? 'Click to stop listening' : title}
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
      }}
    >
      <span aria-hidden="true">{isListening ? '🔴' : '🎤'}</span>
      <span>{isListening ? 'Listening…' : 'Dictate'}</span>
    </button>
  );
}

interface DictationToolbarProps {
  activeField: string;
  fieldLabels: Record<string, string>;
  onSelectField: (fieldKey: string) => void;
  onAppendText: (fieldKey: string, text: string) => void;
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
  disabled = false,
}: DictationToolbarProps) {
  const [showPhrases, setShowPhrases] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  const { isSupported, isListening, interimText, error, toggleListening } = useSpeechRecognition({
    onFinalText: (formatted) => {
      onAppendText(activeField, formatted);
    },
  });

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
        background: isListening ? '#fef2f2' : '#f8fafc',
        border: `1px solid ${isListening ? '#fca5a5' : '#cbd5e1'}`,
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
              disabled={disabled || isListening}
              style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
            >
              {Object.entries(fieldLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Microphone Toggle */}
          {isSupported ? (
            <button
              type="button"
              className={`btn small ${isListening ? 'danger' : 'primary'}`}
              onClick={toggleListening}
              disabled={disabled}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
              }}
            >
              <span aria-hidden="true">{isListening ? '🛑' : '🎙️'}</span>
              <span>{isListening ? 'Stop Listening' : 'Voice Dictate'}</span>
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
            onClick={() => insertPunctuation('\r\n')}
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
      {isListening && (
        <div
          style={{
            marginTop: '0.4rem',
            padding: '0.4rem 0.6rem',
            background: '#ffffff',
            borderRadius: '4px',
            border: '1px solid #f87171',
            fontSize: '0.85rem',
            color: '#b91c1c',
          }}
        >
          <div className="row" style={{ alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ animation: 'pulse 1s infinite' }}>🔴</span>
            <strong>Listening to {fieldLabels[activeField] || activeField}:</strong>
            <span>{interimText || 'Speak clearly into microphone…'}</span>
          </div>
          <div className="small muted" style={{ marginTop: '0.2rem', color: '#6b7280' }}>
            Tip: Say "full stop", "comma", "new line" to punctuate automatically.
          </div>
        </div>
      )}

      {error && (
        <div className="banner error small" style={{ marginTop: '0.4rem' }}>
          {error}
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
