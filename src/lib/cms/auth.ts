// Editor authentication for the live page editor.
//
// WebCrypto rather than node:crypto, because this runs on Cloudflare Workers
// where node:crypto's sync PBKDF2 doesn't exist. (Boston's copy of this uses
// node:crypto — it's a Node server on Railway. Same design, different runtime.)
//
// PBKDF2-SHA256 at 100k iterations. Not the strongest option going — argon2 or
// scrypt would be better — but it needs no native module, it's what WebCrypto
// gives us on Workers, and the threat model is a handful of client logins
// rather than a credential database worth attacking. Revisit if a site ever
// holds more than a few dozen accounts.

import type { AstroCookies } from 'astro';
import { getDb } from './env';

export type CmsRole = 'admin' | 'viewer';

export interface CmsUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: CmsRole;
}

export const displayName = (u: CmsUser): string => `${u.first_name} ${u.last_name}`.trim() || u.email;

const SESSION_COOKIE = 'cms_session';
const SESSION_DAYS = 14;
const PBKDF2_ITERATIONS = 100_000;

// ── Passwords ───────────────────────────────────────────────────────────────

const toHex = (buf: ArrayBuffer | Uint8Array): string =>
  [...new Uint8Array(buf as ArrayBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array =>
  new Uint8Array((hex.match(/.{2}/g) ?? []).map((byte: string) => parseInt(byte, 16)));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256
  );
  return toHex(bits);
}

/** Self-describing hash: `pbkdf2$<iterations>$<salt>$<hash>`, so the cost can be raised later without invalidating old rows. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${await pbkdf2(password, salt, PBKDF2_ITERATIONS)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2' || !salt || !expected) return false;

  const actual = await pbkdf2(password, fromHex(salt), Number(iterations));

  // Constant-time compare. A plain `===` leaks how many leading characters
  // matched through timing, which over enough attempts narrows the hash.
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const id = toHex(crypto.getRandomValues(new Uint8Array(32)));
  await db
    .prepare('INSERT INTO cms_sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(id, userId, Date.now() + SESSION_DAYS * 86_400_000)
    .run();

  // Opportunistic sweep of this user's dead sessions. Cheap, indexed, and it
  // keeps the table from growing without bound on a site nobody ever prunes.
  await db.prepare('DELETE FROM cms_sessions WHERE user_id = ? AND expires_at < ?').bind(userId, Date.now()).run();

  return id;
}

/**
 * Resolve a session id to its user.
 *
 * Expiry is compared in SQL rather than in JS so an expired row can never be
 * returned by a code path that forgot to check.
 */
export async function getSessionUser(sessionId: string): Promise<CmsUser | null> {
  const db = await getDb();
  if (!db || !sessionId) return null;

  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role
         FROM cms_sessions s
         JOIN cms_users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ?`
    )
    .bind(sessionId, Date.now())
    .first<CmsUser>();

  return row ?? null;
}

export async function destroySession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db?.prepare('DELETE FROM cms_sessions WHERE id = ?').bind(sessionId).run();
}

// ── Cookies ─────────────────────────────────────────────────────────────────

export const getSessionToken = (cookies: AstroCookies): string | undefined => cookies.get(SESSION_COOKIE)?.value;

export function setSessionCookie(cookies: AstroCookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    // `import.meta.env.DEV` so the cookie still works over plain http on
    // localhost. A Secure cookie is simply dropped there, which presents as
    // "signing in does nothing" with no error anywhere.
    secure: !import.meta.env.DEV,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export const clearSessionCookie = (cookies: AstroCookies): void => cookies.delete(SESSION_COOKIE, { path: '/' });

// ── Guards ──────────────────────────────────────────────────────────────────

/** The signed-in editor for this request, or null. */
export async function requireUser(cookies: AstroCookies): Promise<CmsUser | null> {
  const token = getSessionToken(cookies);
  return token ? await getSessionUser(token).catch(() => null) : null;
}

/**
 * Two roles, and only one of them can change anything.
 *
 *   admin   page copy, pictures, portal documents, enquiries, accounts
 *   viewer  sees the document lists. Read-only, everywhere, always.
 *
 * There is deliberately no middle tier. The previous one ('editor', allowed to
 * change page copy) also turned out to be enough to delete documents from the
 * staff portal, because both live behind the same signed-in admin. A role that
 * has to be reasoned about before it is safe to hand out is a role that will
 * eventually be handed out wrongly.
 *
 * Anything that writes checks isAdmin. Treat a missing role as a viewer, so a
 * malformed row can only ever lose privileges.
 */
export const isAdmin = (user: CmsUser | null): boolean => user?.role === 'admin';

/** True when this user may change the site in any way. */
export const canEdit = (user: CmsUser | null): boolean => isAdmin(user);

export const roleLabel = (role: CmsRole): string =>
  role === 'admin' ? 'Full administrator' : 'Can view and download files';

// ── Sign-in throttle ────────────────────────────────────────────────────────

/**
 * Per-isolate failed-attempt counter.
 *
 * Deliberately in memory and deliberately modest: it slows down someone
 * guessing passwords against a login page without needing another table or a
 * KV namespace. On Workers each isolate keeps its own tally, so it is a speed
 * bump rather than a wall — which is the honest description of what it is. A
 * site that needs a real limit should put a Cloudflare rate-limit binding in
 * front of /admin/login, the same way the contact form does.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 10 * 60_000;

export function throttled(key: string): boolean {
  const hit = attempts.get(key);
  if (!hit) return false;
  if (Date.now() > hit.until) {
    attempts.delete(key);
    return false;
  }
  return hit.count >= MAX_ATTEMPTS;
}

export function recordFailure(key: string): void {
  const hit = attempts.get(key);
  if (hit && Date.now() <= hit.until) hit.count += 1;
  else attempts.set(key, { count: 1, until: Date.now() + LOCKOUT_MS });
}

export const clearFailures = (key: string): void => void attempts.delete(key);
