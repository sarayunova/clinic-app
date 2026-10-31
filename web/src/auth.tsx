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
}

const Ctx = createContext<AuthApi | null>(null);

/** Screen lock: log out after this much inactivity (server session idle limit is 30 min). */
const IDLE_LOCK_MS = 15 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const idleTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const { needsSetup } = await api<{ needsSetup: boolean }>('GET', '/api/setup/status');
      if (needsSetup) return setState({ status: 'needs-setup' });
      try {
        const me = await api<Me>('GET', '/api/me');
        setState({ status: 'ready', me });
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

  // Server says session is gone -> lock the screen.
  useEffect(() => {
    const onUnauthorized = () => setState((s) => (s.status === 'ready' ? { status: 'logged-out', notice: 'Your session ended. Please log in again.' } : s));
    window.addEventListener('clinic:unauthorized', onUnauthorized);
    return () => window.removeEventListener('clinic:unauthorized', onUnauthorized);
  }, []);

  // Idle lock while logged in.
  const loggedIn = state.status === 'ready';
  useEffect(() => {
    if (!loggedIn) return;
    const reset = () => {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => void logout('Locked after inactivity. Please log in again.'), IDLE_LOCK_MS);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      window.clearTimeout(idleTimer.current);
    };
  }, [loggedIn, logout]);

  const can = useCallback((perm: string) => state.status === 'ready' && state.me.permissions.includes(perm), [state]);

  return <Ctx.Provider value={{ state, refresh, logout, can }}>{children}</Ctx.Provider>;
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
