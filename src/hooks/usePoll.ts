'use client';

import { useCallback, useEffect, useState } from 'react';

export function usePoll<T>(url: string, intervalMs = 1500) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData((await res.json()) as T);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  }, [url]);

  useEffect(() => {
    // Defer the first fetch so setState is not synchronous inside the effect body
    // (eslint react-hooks/set-state-in-effect).
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
