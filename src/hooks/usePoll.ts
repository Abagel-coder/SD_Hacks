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
    void refresh();
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
