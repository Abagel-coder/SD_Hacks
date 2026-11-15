import { describe, expect, it } from 'vitest';
import {
  createSessionToken, isAuthenticated, passwordMatches, safeNextPath, SESSION_MAX_AGE_SECONDS, verifySessionToken,
} from './session';

const SECRET = 'test-secret';
const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);

describe('session cookie', () => {
  it('accepts a token it signed', () => {
    expect(verifySessionToken(createSessionToken(SECRET, NOW), SECRET, NOW)).toBe(true);
  });

  it('expires after 7 days', () => {
    const token = createSessionToken(SECRET, NOW);
    expect(verifySessionToken(token, SECRET, NOW + (SESSION_MAX_AGE_SECONDS - 60) * 1000)).toBe(true);
    expect(verifySessionToken(token, SECRET, NOW + (SESSION_MAX_AGE_SECONDS + 1) * 1000)).toBe(false);
  });

  it('rejects a wrong secret, a tampered expiry, garbage and a missing secret', () => {
    const token = createSessionToken(SECRET, NOW);
    expect(verifySessionToken(token, 'other-secret', NOW)).toBe(false);
    const [v, exp, sig] = token.split('.');
    expect(verifySessionToken(`${v}.${Number(exp) + 999999}.${sig}`, SECRET, NOW)).toBe(false);
    expect(verifySessionToken('nonsense', SECRET, NOW)).toBe(false);
    expect(verifySessionToken('', SECRET, NOW)).toBe(false);
    expect(verifySessionToken(token, undefined, NOW)).toBe(false);
  });

  it('lets everything through when BUSINESS_PASSWORD is unset', () => {
    expect(isAuthenticated(undefined, {}, NOW)).toBe(true);
  });

  it('needs a valid cookie when BUSINESS_PASSWORD is set', () => {
    const env = { BUSINESS_PASSWORD: 'pw', SESSION_SECRET: SECRET };
    expect(isAuthenticated(undefined, env, NOW)).toBe(false);
    expect(isAuthenticated(createSessionToken(SECRET, NOW), env, NOW)).toBe(true);
    // Set password but no secret: fail closed.
    expect(isAuthenticated(createSessionToken(SECRET, NOW), { BUSINESS_PASSWORD: 'pw' }, NOW)).toBe(false);
  });
});

describe('password check', () => {
  it('matches only the exact password', () => {
    const env = { BUSINESS_PASSWORD: 'harbor-123' };
    expect(passwordMatches('harbor-123', env)).toBe(true);
    expect(passwordMatches('harbor-12', env)).toBe(false);
    expect(passwordMatches('', env)).toBe(false);
    expect(passwordMatches('anything', {})).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('keeps same-site paths and drops the rest', () => {
    expect(safeNextPath('/invoices?x=1')).toBe('/invoices?x=1');
    expect(safeNextPath('//evil.example')).toBe('/invoices');
    expect(safeNextPath('https://evil.example')).toBe('/invoices');
    expect(safeNextPath(null)).toBe('/invoices');
    expect(safeNextPath(null, '/')).toBe('/');
  });
});
