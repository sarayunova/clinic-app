import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './TvQueuePage.css';

export interface TvQueueItem {
  id: number;
  tokenNumber: number;
  displayName: string;
  status: 'scheduled' | 'waiting' | 'in_consultation' | 'completed';
  scheduledTime: string;
  room?: string;
}

export interface TvQueueResponse {
  clinicName: string;
  doctorName: string;
  serverTime: string;
  serverDate: string;
  current: TvQueueItem[];
  next: TvQueueItem[];
  waiting: TvQueueItem[];
  scheduled: TvQueueItem[];
  completedCount: number;
  totalToday: number;
}

function playTwoToneChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: C5 (523.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, now + 0.22);
    gain2.gain.setValueAtTime(0.4, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.85);
  } catch {
    // Audio output blocked or unsupported
  }
}

export function TvQueuePage() {
  const [data, setData] = useState<TvQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [audioEnabled, setAudioEnabled] = useState(() => {
    try {
      return localStorage.getItem('tv_audio_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const prevTokenRef = useRef<number | null>(null);
  const audioEnabledRef = useRef(audioEnabled);
  audioEnabledRef.current = audioEnabled;

  // Local clock ticker
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/tv/queue');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TvQueueResponse;
      setData(json);
      setError(null);

      // Detect newly called token to trigger sound chime
      const currentToken = json.current[0]?.tokenNumber ?? null;
      if (
        currentToken !== null &&
        prevTokenRef.current !== null &&
        currentToken !== prevTokenRef.current
      ) {
        if (audioEnabledRef.current) {
          playTwoToneChime();
        }
      }
      prevTokenRef.current = currentToken;
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
    const interval = window.setInterval(() => void fetchQueue(), 4000);
    return () => window.clearInterval(interval);
  }, [fetchQueue]);

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    try {
      localStorage.setItem('tv_audio_enabled', String(next));
    } catch {
      // storage unavailable
    }
    if (next) {
      playTwoToneChime(); // Preview chime so user hears it and browser permits audio
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const activeServing = data?.current[0] ?? null;
  const nextUp = data?.next ?? [];
  const waitingList = data?.waiting ?? [];

  const timeString = clock.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateString = clock.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="tv-container">
      {/* Top Banner / Clinic Branding & Clock */}
      <header className="tv-header">
        <div>
          <div className="tv-brand-title">
            <span>🏥</span>
            <span>{data?.clinicName || 'Clinic'}</span>
          </div>
          {data?.doctorName && <div className="tv-doctor-sub">{data.doctorName}</div>}
        </div>

        <div className="tv-header-center">
          <div className="tv-banner-pill">Waiting Room Queue Display</div>
        </div>

        <div className="tv-header-right">
          <div className="tv-clock">
            <div className="tv-clock-time">{timeString}</div>
            <div className="tv-clock-date">{dateString}</div>
          </div>
          <div className="tv-controls">
            <button
              type="button"
              className={`tv-ctrl-btn ${audioEnabled ? 'active' : ''}`}
              onClick={toggleAudio}
              title={audioEnabled ? 'Sound is on (Click to mute)' : 'Sound is off (Click to enable audio chime)'}
            >
              {audioEnabled ? '🔔 Sound: ON' : '🔕 Sound: OFF'}
            </button>
            <button
              type="button"
              className="tv-ctrl-btn"
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? 'Exit Fullscreen' : '⛶ Fullscreen'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid: NOW SERVING (Left Hero) vs PLEASE GET READY & QUEUE (Right) */}
      <main className="tv-main-grid">
        {/* Left Column: Current Patient with Doctor */}
        <div className="tv-card-hero">
          {activeServing ? (
            <>
              <div className="tv-hero-badge">
                <span className="tv-pulse-dot" />
                <span>Now Serving</span>
              </div>
              <div className="tv-token-big">Token #{activeServing.tokenNumber}</div>
              <div className="tv-patient-hero-name">{activeServing.displayName}</div>
              <div className="tv-hero-room">
                <span>🚪</span>
                <span>{activeServing.room || 'Consultation Room 1'}</span>
                <span style={{ color: '#94a3b8', fontSize: '1.2rem', marginLeft: 'auto' }}>
                  Scheduled {activeServing.scheduledTime}
                </span>
              </div>
            </>
          ) : (
            <div className="tv-empty-hero">
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🩺</div>
              <h2>Doctor is Available</h2>
              <p>Next patient will be called shortly. Please keep your token ready.</p>
            </div>
          )}
        </div>

        {/* Right Column: Next in Line & Waiting Queue */}
        <div className="tv-right-column">
          {/* Section: Next to be seen */}
          <div className="tv-section-box">
            <div className="tv-section-title">
              <span>⏳</span>
              <span>Please Get Ready (Next in Line)</span>
            </div>
            {nextUp.length === 0 ? (
              <div style={{ color: '#94a3b8', padding: '1rem 0' }}>No patients waiting in queue.</div>
            ) : (
              <div className="tv-next-grid">
                {nextUp.map((item) => (
                  <div key={item.id} className="tv-next-card">
                    <div className="tv-next-token">Token #{item.tokenNumber}</div>
                    <div className="tv-next-name">{item.displayName}</div>
                    <div className="tv-next-time">{item.scheduledTime}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Upcoming Checked-In Queue */}
          <div className="tv-section-box" style={{ flex: 1 }}>
            <div className="tv-section-title">
              <span>📋</span>
              <span>Waiting in Lobby ({waitingList.length})</span>
            </div>
            {waitingList.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '1.05rem', padding: '0.75rem 0' }}>
                {nextUp.length > 0 ? 'All waiting patients are lined up above.' : 'Queue is clear.'}
              </div>
            ) : (
              <div className="tv-waiting-list">
                {waitingList.map((item) => (
                  <div key={item.id} className="tv-waiting-pill">
                    <span className="tv-waiting-num">#{item.tokenNumber}</span>
                    <span className="tv-waiting-name">{item.displayName}</span>
                    <span className="tv-waiting-time">{item.scheduledTime}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Bar: Summary Stats & Exit Link */}
      <footer className="tv-footer">
        <div className="tv-stats-row">
          <div className="tv-stat-item">
            <strong>{data?.waiting.length ? data.waiting.length + nextUp.length : nextUp.length}</strong>
            <span>Waiting Patients</span>
          </div>
          <div className="tv-stat-item">
            <strong>{data?.completedCount ?? 0}</strong>
            <span>Completed Today</span>
          </div>
          <div className="tv-stat-item">
            <strong>{data?.totalToday ?? 0}</strong>
            <span>Total Booked Today</span>
          </div>
        </div>

        <div>
          {error && <span style={{ color: '#ef4444', marginRight: '1rem' }}>⚠️ Connection interrupted, retrying…</span>}
          <Link to="/" className="tv-back-link">
            ← Staff Dashboard
          </Link>
        </div>
      </footer>
    </div>
  );
}
