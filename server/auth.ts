import crypto from 'node:crypto';
import type { DB } from './db.js';
import type { Config } from './config.js';
import type { Role } from './permissions.js';
import { badRequest } from './errors.js';

export const MIN_PASSWORD_LENGTH = 10;

// ---------- Password hashing (scrypt, built in; no native add-ons) ----------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem }, (e, k) =>
      e ? reject(e) : resolve(k),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || Number(n) !== SCRYPT.N || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function assertStrongPassword(password: string, username?: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (password.length > 200) throw badRequest('Password is too long');
  if (username && password.toLowerCase().includes(username.toLowerCase()))
    throw badRequest('Password must not contain the username');
}

// ---------- Sessions ----------

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
  /** The screen is locked: the session is still valid but only unlock and log out are allowed. */
  locked: boolean;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(db: DB, cfg: Config, userId: number): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions(token_hash, user_id, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?)').run(
    sha256(token),
    userId,
    new Date(now).toISOString(),
    new Date(now).toISOString(),
    new Date(now + cfg.sessionMaxHours * 3600_000).toISOString(),
  );
  return token;
}

/** Returns the user for a valid, unexpired session, otherwise null. Expired sessions are removed. */
export function resolveSession(db: DB, cfg: Config, token: string | undefined): SessionUser | null {
  if (!token) return null;
  const hash = sha256(token);
  const row = db
    .prepare(
      `SELECT s.last_seen_at, s.expires_at, s.locked_at, u.id, u.username, u.full_name, u.role, u.active, u.must_change_password
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(hash) as
    | { last_seen_at: string; expires_at: string; locked_at: string | null; id: number; username: string; full_name: string; role: Role; active: number; must_change_password: number }
    | undefined;
  if (!row) return null;
  const now = Date.now();
  const idleLimit = Date.parse(row.last_seen_at) + cfg.sessionIdleMinutes * 60_000;
  if (!row.active || now > Date.parse(row.expires_at) || now > idleLimit) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  // Refresh activity at most once a minute to limit writes. A locked session is not refreshed: background polling must not
  // keep a locked, unattended screen alive, so it ends at the normal idle limit.
  if (!row.locked_at && now - Date.parse(row.last_seen_at) > 60_000) {
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(new Date(now).toISOString(), hash);
  }
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: row.must_change_password === 1,
    locked: row.locked_at != null,
  };
}

export function lockSession(db: DB, token: string | undefined): void {
  if (token) db.prepare('UPDATE sessions SET locked_at = ? WHERE token_hash = ? AND locked_at IS NULL').run(new Date().toISOString(), sha256(token));
}

export function unlockSession(db: DB, token: string | undefined): void {
  if (token) db.prepare('UPDATE sessions SET locked_at = NULL, last_seen_at = ? WHERE token_hash = ?').run(new Date().toISOString(), sha256(token));
}

export function destroySession(db: DB, token: string | undefined): void {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function destroyUserSessions(db: DB, userId: number, exceptToken?: string): void {
  if (exceptToken) db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(userId, sha256(exceptToken));
  else db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ---------- Login throttling ----------

/**
 * Counts failed logins per username and locks the name for a few minutes after too many.
 * With a database the counts survive a server restart (restarting the server must not clear a lockout);
 * without one (some tests) they live in memory.
 */
export class LoginThrottle {
  private memory = new Map<string, { fails: number; lockedUntil: number }>();
  constructor(private max: number, private lockMinutes: number, private db?: DB) {}

  private read(k: string): { fails: number; lockedUntil: number } {
    if (!this.db) return this.memory.get(k) ?? { fails: 0, lockedUntil: 0 };
    const r = this.db.prepare('SELECT fails, locked_until FROM login_attempts WHERE username = ?').get(k) as
      | { fails: number; locked_until: number }
      | undefined;
    return r ? { fails: r.fails, lockedUntil: r.locked_until } : { fails: 0, lockedUntil: 0 };
  }

  private write(k: string, a: { fails: number; lockedUntil: number }): void {
    if (!this.db) {
      this.memory.set(k, a);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO login_attempts(username, fails, locked_until, updated_at) VALUES (?,?,?,?)
         ON CONFLICT(username) DO UPDATE SET fails = excluded.fails, locked_until = excluded.locked_until, updated_at = excluded.updated_at`,
      )
      .run(k, a.fails, a.lockedUntil, new Date().toISOString());
    // Names that were only ever mistyped are forgotten after a day, so random usernames cannot fill the table.
    this.db
      .prepare('DELETE FROM login_attempts WHERE locked_until < ? AND updated_at < ?')
      .run(Date.now(), new Date(Date.now() - 86_400_000).toISOString());
  }

  /** Seconds remaining if locked, else 0. */
  lockedFor(username: string): number {
    const a = this.read(username.toLowerCase());
    if (a.lockedUntil <= Date.now()) return 0;
    return Math.ceil((a.lockedUntil - Date.now()) / 1000);
  }
  fail(username: string): void {
    const k = username.toLowerCase();
    const a = this.read(k);
    a.fails += 1;
    if (a.fails >= this.max) {
      a.lockedUntil = Date.now() + this.lockMinutes * 60_000;
      a.fails = 0;
    }
    this.write(k, a);
  }
  succeed(username: string): void {
    const k = username.toLowerCase();
    if (!this.db) this.memory.delete(k);
    else this.db.prepare('DELETE FROM login_attempts WHERE username = ?').run(k);
  }
}
