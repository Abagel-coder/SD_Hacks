import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Business login: one shared password (BUSINESS_PASSWORD) and a signed session cookie (SESSION_SECRET).
 * When BUSINESS_PASSWORD is unset the login is off, so local dev and tests run without it.
 */
export const SESSION_COOKIE = 'vouch_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type Env = Record<string, string | undefined>;

export function authEnabled(env: Env = process.env): boolean {
  return Boolean(env.BUSINESS_PASSWORD);
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Compares two strings in constant time, whatever their lengths. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(input: string, env: Env = process.env): boolean {
  const expected = env.BUSINESS_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

/** Token format: v1.<expires unix seconds>.<HMAC-SHA256 of "v1.<expires>">. */
export function createSessionToken(secret: string, nowMs = Date.now()): string {
  const payload = `v1.${Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string | undefined, nowMs = Date.now()): boolean {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !/^\d+$/.test(parts[1])) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  if (!safeEqual(parts[2], sign(payload, secret))) return false;
  return Number(parts[1]) * 1000 > nowMs;
}

/** True when the request may go through: login is off, or the cookie carries a valid session. */
export function isAuthenticated(cookieValue: string | undefined, env: Env = process.env, nowMs = Date.now()): boolean {
  if (!authEnabled(env)) return true;
  return verifySessionToken(cookieValue, env.SESSION_SECRET, nowMs);
}

/** Only same-site paths, so ?next= can't send someone to another site. Default: the invoice dashboard. */
export function safeNextPath(next: string | null | undefined, fallback = '/invoices'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
