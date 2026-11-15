import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';
import { proxy } from './proxy';

const SECRET = 'test-secret';
const req = (path: string, cookie?: string) =>
  new NextRequest(`https://vouch.test${path}`, {
    method: path.startsWith('/api/webhooks') ? 'POST' : 'GET',
    headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {},
  });

describe('proxy (login gate)', () => {
  afterEach(() => vi.unstubAllEnvs());

  describe('with BUSINESS_PASSWORD set', () => {
    const on = () => {
      vi.stubEnv('BUSINESS_PASSWORD', 'pw');
      vi.stubEnv('SESSION_SECRET', SECRET);
    };

    it('redirects a logged-out page request to /login with next', () => {
      on();
      const res = proxy(req('/invoices/abc?tab=1'));
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get('location')!);
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('next')).toBe('/invoices/abc?tab=1');
    });

    it('returns 401 JSON for a logged-out API request', async () => {
      on();
      const res = proxy(req('/api/invoices'));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Sign in required.' });
    });

    it('lets a valid session through and rejects a forged one', () => {
      on();
      expect(proxy(req('/api/invoices', createSessionToken(SECRET))).headers.get('x-middleware-next')).toBe('1');
      expect(proxy(req('/api/invoices', createSessionToken('wrong'))).status).toBe(401);
    });

    it('never blocks the ElevenLabs webhook, which checks its own signature', () => {
      on();
      const res = proxy(req('/api/webhooks/elevenlabs'));
      expect(res.headers.get('x-middleware-next')).toBe('1');
    });

    it('does not exempt look-alike webhook paths', () => {
      on();
      expect(proxy(req('/api/webhooks/elevenlabs-other')).status).toBe(401);
      expect(proxy(req('/api/webhooks/other')).status).toBe(401);
    });

    it('leaves the landing page, /login and the auth APIs open', () => {
      on();
      for (const path of ['/', '/login', '/api/auth/login', '/api/auth/session', '/api/auth/logout']) {
        expect(proxy(req(path)).headers.get('x-middleware-next'), path).toBe('1');
      }
    });

    it('redirects every business page to /login and back', () => {
      on();
      for (const path of ['/invoices', '/invoices/abc', '/blocklist', '/backtest', '/vendor']) {
        const res = proxy(req(path));
        expect(res.status, path).toBe(307);
        const location = new URL(res.headers.get('location')!);
        expect(location.pathname).toBe('/login');
        expect(location.searchParams.get('next')).toBe(path);
      }
    });

    it('returns 401 for every business API', () => {
      on();
      for (const path of ['/api/invoices', '/api/invoices/abc', '/api/invoices/abc/verify', '/api/blocklist', '/api/backtest', '/api/calls/abc/sync']) {
        expect(proxy(req(path)).status, path).toBe(401);
      }
    });
  });

  it('does nothing when BUSINESS_PASSWORD is unset', () => {
    vi.stubEnv('BUSINESS_PASSWORD', '');
    expect(proxy(req('/invoices')).headers.get('x-middleware-next')).toBe('1');
    expect(proxy(req('/api/invoices')).headers.get('x-middleware-next')).toBe('1');
  });
});
