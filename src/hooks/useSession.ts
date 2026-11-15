'use client';

import { useEffect, useState } from 'react';

export interface SessionState {
  signedIn: boolean;
  loginEnabled: boolean;
}

/** Whether this browser has a business session. null while loading. */
export function useSession(): SessionState | null {
  const [state, setState] = useState<SessionState | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<SessionState>) : null))
      .then((json) => { if (!cancelled && json) setState(json); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return state;
}
