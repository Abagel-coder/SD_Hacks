import { cookies } from 'next/headers';
import { isAuthenticated, safeNextPath, SESSION_COOKIE } from '@/lib/auth/session';
import { AccountStep } from './AccountStep';
import { PasswordForm } from './PasswordForm';

/** Password first (when BUSINESS_PASSWORD is set), then the demo account picker. */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  const signedIn = isAuthenticated((await cookies()).get(SESSION_COOKIE)?.value);
  if (!signedIn) return <PasswordForm next={safeNextPath(typeof next === 'string' ? next : null)} />;
  return <AccountStep />;
}
