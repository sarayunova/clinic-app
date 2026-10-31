import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type Me } from './api';

type AuthState =
  | { status: 'loading' }
  | { status: 'needs-setup' }
  | { status: 'logged-out'; notice?: string }
  | { status: 'ready'; me: Me };

interface AuthApi {
  state: AuthState;
  refresh: () => Promise<void>;
  logout: (notice?: string) => Promise<void>;
  can: (perm: string) => boolean;
  /** Screen lock: still signed in, but covered until the password is entered again. */
  locked: boolean;
  lock: (reason?: 'manual' | 'idle') => Promise<void>;
  unlock: (password: string) => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

/** Log out after this much inactivity (the server's own idle limit is 30 min). The screen locks sooner than this. */
const IDLE_LOGOUT_MS = 15 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [locked, setLocked] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);
  const lockTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const { needsSetup } = await api<{ needsSetup: boolean }>('GET', '/api/setup/status');
      if (needsSetup) return setState({ status: 'needs-setup' });
      try {
        const me = await api<Me>('GET', '/api/me');
        setState({ status: 'ready', me });
        setLocked(me.locked);
      } catch {
        setState({ status: 'logged-out' });
      }
    } catch (e) {
      setState({ status: 'logged-out', notice: (e as Error).message });
    }
  }, []);

  const logout = useCallback(async (notice?: string) => {
    try {
      await api('POST', '/api/auth/logout');
    } catch {
      /* already logged out or offline - still lock the screen */
    }
    setState({ status: 'logged-out', notice });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lock = useCallback(async (reason: 'manual' | 'idle' = 'manual') => {
    setLocked(true); // cover the screen first; the server then refuses everything until unlocked
    try {
      await api('POST', '/api/auth/lock', { reason });
    } catch {
      /* offline or session gone: the screen stays covered either way */
    }
  }, []);

  const unlock = useCallback(async (password: string) => {
    await api('POST', '/api/auth/unlock', { password });
    setLocked(false);
  }, []);

  // Another tab or a background refresh was told the screen is locked.
  useEffect(() => {
    const onLocked = () => setLocked(true);
    window.addEventListener('clinic:locked', onLocked);
    return () => window.removeEventListener('clinic:locked', onLocked);
  }, []);

  // Server says session is gone -> lock the screen.
  useEffect(() => {
    const onUnauthorized = () => setState((s) => (s.status === 'ready' ? { status: 'logged-out', notice: 'Your session ended. Please log in again.' } : s));
    window.addEventListener('clinic:unauthorized', onUnauthorized);
    return () => window.removeEventListener('clinic:unauthorized', onUnauthorized);
  }, []);

  // Inactivity: cover the screen after a few minutes (work in progress is kept), and log out after a longer time.
  const loggedIn = state.status === 'ready';
  const lockAfterMs = state.status === 'ready' ? state.me.screenLockMinutes * 60_000 : 0;
  useEffect(() => {
    if (!loggedIn) return;
    let last = 0;
    const reset = () => {
      const now = Date.now();
      if (now - last < 2000) return; // pointer movement fires constantly; once every couple of seconds is plenty
      last = now;
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => void logout('Logged out after inactivity. Please log in again.'), IDLE_LOGOUT_MS);
      window.clearTimeout(lockTimer.current);
      if (lockAfterMs > 0 && !locked) lockTimer.current = window.setTimeout(() => void lock('idle'), lockAfterMs);
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    last = 0;
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      window.clearTimeout(idleTimer.current);
      window.clearTimeout(lockTimer.current);
    };
  }, [loggedIn, logout, lock, locked, lockAfterMs]);

  const can = useCallback((perm: string) => state.status === 'ready' && state.me.permissions.includes(perm), [state]);

  return <Ctx.Provider value={{ state, refresh, logout, can, locked, lock, unlock }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** The logged-in user. Only call inside screens rendered when status === 'ready'. */
export function useMe(): Me {
  const { state } = useAuth();
  if (state.status !== 'ready') throw new Error('Not logged in');
  return state.me;
}
