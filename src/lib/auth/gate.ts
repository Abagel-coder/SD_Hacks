import { isAuthenticated } from './session';

export type GateResult = 'allow' | 'redirect' | 'unauthorized';

/**
 * Paths reachable without a session: the public landing page, the login page and API, and the
 * ElevenLabs webhook (called by ElevenLabs' servers, which have no cookie; it checks its own HMAC
 * signature instead). Everything else, including the business pages and their APIs, needs a login.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/webhooks/elevenlabs' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  );
}

export function gate(pathname: string, cookieValue: string | undefined, env: Record<string, string | undefined> = process.env, nowMs = Date.now()): GateResult {
  if (isPublicPath(pathname) || isAuthenticated(cookieValue, env, nowMs)) return 'allow';
  return pathname === '/api' || pathname.startsWith('/api/') ? 'unauthorized' : 'redirect';
}
