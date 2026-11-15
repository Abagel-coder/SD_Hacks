import { NextResponse } from 'next/server';
import {
  authEnabled, createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth/session';
import { rateLimited } from '@/lib/rate-limit';

/** Body: { password }. Sets the signed session cookie on success. */
export async function POST(req: Request) {
  const limited = rateLimited(req, 'login');
  if (limited) return limited;
  if (!authEnabled()) return NextResponse.json({ ok: true, loginDisabled: true });

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error('Login: BUSINESS_PASSWORD is set but SESSION_SECRET is not');
    return NextResponse.json({ error: 'Sign-in is not configured on the server.' }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === 'string' ? body.password : '';
  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "That password didn't work. Try again." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
