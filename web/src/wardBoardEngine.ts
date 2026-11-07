/**
 * Ward Board Audio Alert & Critical Deterioration Classification Engine
 * Uses the Web Audio API to synthesize alert chimes without external audio assets.
 */

class WebAudioAlertSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playCriticalAlarm() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // High-priority 3-pulse urgent chime: 880Hz -> 659.25Hz -> 880Hz (A5 -> E5 -> A5)
      const freqs = [880, 659.25, 880];
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);

        gain.gain.setValueAtTime(0.001, now + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.18 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 0.16);
      });
    } catch {
      // Audio playback suppressed by browser policy or unsupported
    }
  }

  public playGentleNotice() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Ignore audio errors
    }
  }
}

export const wardAudio = new WebAudioAlertSynth();

export interface DeteriorationStatusInfo {
  level: 'NORMAL_GREEN' | 'WARNING_YELLOW' | 'CRITICAL_RED';
  badgeLabel: string;
  badgeClass: string;
  borderClass: string;
}

export function getDeteriorationBadge(level: 'NORMAL_GREEN' | 'WARNING_YELLOW' | 'CRITICAL_RED'): DeteriorationStatusInfo {
  switch (level) {
    case 'CRITICAL_RED':
      return {
        level: 'CRITICAL_RED',
        badgeLabel: 'CRITICAL ALERT',
        badgeClass: 'bg-red-600 text-white animate-pulse',
        borderClass: 'border-red-500 bg-red-50/40',
      };
    case 'WARNING_YELLOW':
      return {
        level: 'WARNING_YELLOW',
        badgeLabel: 'WARNING',
        badgeClass: 'bg-amber-500 text-white',
        borderClass: 'border-amber-400 bg-amber-50/30',
      };
    case 'NORMAL_GREEN':
    default:
      return {
        level: 'NORMAL_GREEN',
        badgeLabel: 'STABLE',
        badgeClass: 'bg-emerald-600 text-white',
        borderClass: 'border-slate-200 bg-white',
      };
  }
}
