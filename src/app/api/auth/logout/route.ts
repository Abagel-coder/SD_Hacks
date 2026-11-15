import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';

function signOut(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303);
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0,
  });
  return res;
}

/** Clears the session cookie and sends the browser to /login. */
export const GET = signOut;
export const POST = signOut;
