import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, clientIp, rateLimited, resetRateLimits } from './rate-limit';

const opts = { limit: 3, windowMs: 60_000 };

describe('rate limit', () => {
  beforeEach(() => resetRateLimits());

  it('allows up to the limit, then blocks until the window resets', () => {
    for (let i = 0; i < 3; i++) expect(checkRateLimit('k', opts, 1000).ok).toBe(true);
    expect(checkRateLimit('k', opts, 2000)).toEqual({ ok: false, retryAfterSeconds: 59 });
    expect(checkRateLimit('k', opts, 61_001).ok).toBe(true);
  });

  it('counts each key separately', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('a', opts, 0);
    expect(checkRateLimit('a', opts, 0).ok).toBe(false);
    expect(checkRateLimit('b', opts, 0).ok).toBe(true);
  });

  it('reads the client IP from x-forwarded-for', () => {
    const req = new Request('https://x.test', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } });
    expect(clientIp(req)).toBe('1.2.3.4');
  });

  it('returns 429 with Retry-After after 10 requests a minute from one IP', async () => {
    const req = () => new Request('https://x.test', { headers: { 'x-forwarded-for': '5.6.7.8' } });
    for (let i = 0; i < 10; i++) expect(rateLimited(req(), 'upload')).toBeNull();
    const res = rateLimited(req(), 'upload')!;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await res.json()).error).toMatch(/Too many requests/);
    // Other buckets and other IPs are unaffected.
    expect(rateLimited(req(), 'verify')).toBeNull();
  });
});
