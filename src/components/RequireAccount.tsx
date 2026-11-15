'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAccount } from '@/hooks/useAccount';
import type { AccountKind } from '@/lib/accounts';

/** Shows its children only to a signed-in account of the given kind; everyone else goes to the login page. */
export function RequireAccount({ kind, children }: { kind: AccountKind; children: ReactNode }) {
  const account = useAccount(kind);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (account === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [account, kind, pathname, router]);

  if (!account) return null;
  return <>{children}</>;
}
