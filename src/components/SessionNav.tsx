'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountChip } from '@/components/AccountChip';
import { useAccount } from '@/hooks/useAccount';
import { useSession } from '@/hooks/useSession';

/** Log in when logged out; the account and Sign out when logged in. */
export function SessionNav() {
  const session = useSession();
  const account = useAccount('business');
  const pathname = usePathname();
  if (!session) return null;

  if (!session.signedIn) {
    const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    return (
      <Link href={`/login${next}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200">
        Log in
      </Link>
    );
  }
  // Login off (local dev), or an account picked: the chip, whose Sign out clears the cookie too.
  if (!session.loginEnabled || account) return <AccountChip kind="business" />;
  return (
    // A plain link: the route handler clears the cookie and redirects, so it must not be prefetched.
    <a href="/api/auth/logout" className="rounded-full px-4 py-2 text-sm font-semibold text-gray-300 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-white">
      Sign out
    </a>
  );
}
