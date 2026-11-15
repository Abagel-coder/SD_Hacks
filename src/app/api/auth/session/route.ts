import { cookies } from 'next/headers';
import { authEnabled, isAuthenticated, SESSION_COOKIE } from '@/lib/auth/session';

/** Public. Tells the nav whether to show Log in or Sign out (the cookie itself is httpOnly). */
export async function GET() {
  const signedIn = isAuthenticated((await cookies()).get(SESSION_COOKIE)?.value);
  return Response.json({ signedIn, loginEnabled: authEnabled() }, { headers: { 'Cache-Control': 'no-store' } });
}
