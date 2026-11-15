import { NextResponse, type NextRequest } from 'next/server';
import { gate } from '@/lib/auth/gate';
import { SESSION_COOKIE } from '@/lib/auth/session';

/** Business login gate (Next 16 renamed middleware to proxy). Off when BUSINESS_PASSWORD is unset. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const result = gate(pathname, request.cookies.get(SESSION_COOKIE)?.value);
  if (result === 'allow') return NextResponse.next();
  if (result === 'unauthorized') {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except build output and static files in public/.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)'],
};
