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
      `SELECT s.last_seen_at, s.expires_at, u.id, u.username, u.full_name, u.role, u.active, u.must_change_password
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(hash) as
    | { last_seen_at: string; expires_at: string; id: number; username: string; full_name: string; role: Role; active: number; must_change_password: number }
    | undefined;
  if (!row) return null;
  const now = Date.now();
  const idleLimit = Date.parse(row.last_seen_at) + cfg.sessionIdleMinutes * 60_000;
  if (!row.active || now > Date.parse(row.expires_at) || now > idleLimit) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  // Refresh activity at most once a minute to limit writes.
  if (now - Date.parse(row.last_seen_at) > 60_000) {
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(new Date(now).toISOString(), hash);
  }
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: row.must_change_password === 1,
  };
}

export function destroySession(db: DB, token: string | undefined): void {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function destroyUserSessions(db: DB, userId: number, exceptToken?: string): void {
  if (exceptToken) db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(userId, sha256(exceptToken));
  else db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ---------- Login throttling (in memory; resets on restart) ----------

export class LoginThrottle {
  private attempts = new Map<string, { fails: number; lockedUntil: number }>();
  constructor(private max: number, private lockMinutes: number) {}

  /** Seconds remaining if locked, else 0. */
  lockedFor(username: string): number {
    const a = this.attempts.get(username.toLowerCase());
    if (!a || a.lockedUntil <= Date.now()) return 0;
    return Math.ceil((a.lockedUntil - Date.now()) / 1000);
  }
  fail(username: string): void {
    const k = username.toLowerCase();
    const a = this.attempts.get(k) ?? { fails: 0, lockedUntil: 0 };
    a.fails += 1;
    if (a.fails >= this.max) {
      a.lockedUntil = Date.now() + this.lockMinutes * 60_000;
      a.fails = 0;
    }
    this.attempts.set(k, a);
  }
  succeed(username: string): void {
    this.attempts.delete(username.toLowerCase());
  }
}
